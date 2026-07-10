"""
MQTT -> Supabase Bridge for Shelter Monitoring System
Subscribes to Accel and Gyro topics, merges them, and inserts into Supabase.
"""

import json
import math
import os
import sys
import time
import requests
from dotenv import load_dotenv

import numpy as np
import joblib
import librosa
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr

from paho.mqtt.client import Client as MQTTClient, CallbackAPIVersion
from supabase import create_client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

load_dotenv()

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHAT_ID_FALLBACK = os.getenv("CHAT_ID")  # fallback jika DB tidak tersedia

# Vibration thresholds are now dynamically loaded from DB

# ---------------------------------------------------------------------------
# AI Model Initialization
# ---------------------------------------------------------------------------

AI_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vibration_ai", "models")
MODEL_PATH = os.path.join(AI_MODELS_DIR, "vibration_classifier.pkl")
SCALER_PATH = os.path.join(AI_MODELS_DIR, "scaler.pkl")

ai_model = None
ai_scaler = None

if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
    print("Loading AI Model and Scaler...")
    ai_model = joblib.load(MODEL_PATH)
    ai_scaler = joblib.load(SCALER_PATH)
    print("AI Model loaded successfully.")
else:
    print("WARN: AI Model or Scaler not found. AI features disabled.")

CLASS_NAMES = {0: "Normal/AC", 1: "Footsteps", 2: "Sabotage/Maintenance", 3: "Vehicle", 4: "Earthquake"}
CLASS_RISK_MAP = {0: "low", 1: "low", 2: "high", 3: "medium", 4: "high"}
_ai_buffers: dict = {}
_last_ai_metadata: dict = {}

def extract_features_from_signal(signal):
    if len(signal) == 0: return np.zeros(14)
    mean = np.mean(signal)
    std = np.std(signal)
    skewness = skew(signal)
    kurt = kurtosis(signal)
    min_val = np.min(signal)
    max_val = np.max(signal)
    range_val = max_val - min_val
    median = np.median(signal)
    mad = median_abs_deviation(signal)
    iqr_val = iqr(signal)
    rms = np.sqrt(np.mean(np.array(signal)**2))
    energy = np.sum(np.array(signal)**2)
    zcr = np.mean(librosa.feature.zero_crossing_rate(np.array(signal)))
    peak = np.max(np.abs(signal))
    crest_factor = peak / rms if rms > 0 else 0.0
    return [zcr, mean, mad, skewness, std, kurt, crest_factor, min_val, max_val, range_val, median, iqr_val, rms, energy]

# ---------------------------------------------------------------------------
# Supabase init
# ---------------------------------------------------------------------------

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or "your-" in SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in bridge/.env")
    print("       Copy .env.example -> .env and fill in your service_role key.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---------------------------------------------------------------------------
# Device token -> UUID cache
# ---------------------------------------------------------------------------

_device_cache: dict = {}  # {token: {device_id, shelter_id}}
_device_cache_ttl = 300  # 5 minutes
_device_cache_ts: float = 0

_threshold_cache: dict = {}  # {shelter_id: {temp_warning, temp_critical, ...}}
_threshold_cache_ttl = 300  # 5 minutes
_threshold_cache_ts: float = 0

# ---------------------------------------------------------------------------
# Sensor interval config publishing
# ---------------------------------------------------------------------------

_interval_cache: dict = {}         # {shelter_id: {temp_interval_ms, vib_interval_ms}}
_interval_cache_ttl = 60           # poll every 60 seconds
_interval_cache_ts: float = 0
_last_published_interval: dict = {}  # {device_token: {temp_interval_ms, vib_interval_ms}}
_mqtt_client_ref = None            # reference to MQTT client set after connect


def resolve_device(token: str) -> dict | None:
    """Look up device_id and shelter_id from device token, with caching."""
    global _device_cache, _device_cache_ts

    now = time.time()

    # Return from cache if fresh
    if token in _device_cache and (now - _device_cache_ts) < _device_cache_ttl:
        return _device_cache[token]

    # Refresh cache from Supabase
    try:
        resp = supabase.table("devices").select("device_id, shelter_id").eq("token", token).maybe_single().execute()
        if resp.data:
            _device_cache[token] = resp.data
            _device_cache_ts = now
            return resp.data
    except Exception as e:
        print(f"  -> WARN: Could not resolve device for token '{token}': {e}")

    return None

# ---------------------------------------------------------------------------
# Buffer: store latest Accel + Gyro per device, insert when both are available
# ---------------------------------------------------------------------------

_buffers: dict = {}  # {device_id: {"accel": ..., "accel_ts": ..., "gyro": ..., "gyro_ts": ...}}

# Max seconds between accel and gyro to consider them a matching pair
PAIR_TIMEOUT = 3.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


# Cache untuk Chat ID dari database
_user_chat_ids: list = []
_user_chat_ids_ts: float = 0
_user_chat_ids_ttl = 300  # 5 menit


def get_telegram_chat_ids() -> list:
    """Ambil semua telegram_chat_id dari tabel users, dengan caching 5 menit."""
    global _user_chat_ids, _user_chat_ids_ts
    now = time.time()
    if _user_chat_ids and (now - _user_chat_ids_ts) < _user_chat_ids_ttl:
        return _user_chat_ids
    try:
        resp = supabase.table("users").select("telegram_chat_id").not_.is_("telegram_chat_id", "null").execute()
        ids = [row["telegram_chat_id"] for row in (resp.data or []) if row.get("telegram_chat_id")]
        if ids:
            _user_chat_ids = ids
            _user_chat_ids_ts = now
            print(f"[TG] Loaded {len(ids)} Chat ID(s) from database.")
            return ids
    except Exception as e:
        print(f"[TG] Gagal fetch Chat ID dari DB: {e}")
    # Fallback ke .env
    if CHAT_ID_FALLBACK:
        print("[TG] Fallback ke CHAT_ID dari .env.")
        return [CHAT_ID_FALLBACK]
    return []


def send_telegram(message: str) -> None:
    """Kirim alert ke semua Telegram Chat ID yang terdaftar."""
    if not BOT_TOKEN:
        print("[TG] BOT_TOKEN belum diset di .env, skip.")
        return
    chat_ids = get_telegram_chat_ids()
    if not chat_ids:
        print("[TG] Tidak ada Chat ID yang tersedia, skip.")
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    for chat_id in chat_ids:
        try:
            requests.post(url, data={"chat_id": chat_id, "text": message}, timeout=5)
            print(f"[TG] Alert sent to {chat_id}.")
        except Exception as e:
            print(f"[TG ERROR] chat_id={chat_id}: {e}")


def calc_risk_level(accel_x: float, accel_y: float, accel_z: float, shelter_id: str) -> str:
    """Calculate risk level based on acceleration magnitude and thresholds."""
    magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)
    thresholds = load_thresholds(shelter_id)
    vib_critical = thresholds.get("vibration_critical", 20.0)
    vib_warning = thresholds.get("vibration_warning", 10.0)
    
    if magnitude >= vib_critical:
        return "high"
    elif magnitude >= vib_warning:
        return "medium"
    return "low"


def load_thresholds(shelter_id: str) -> dict:
    """Load and cache thresholds for a shelter."""
    global _threshold_cache, _threshold_cache_ts

    now = time.time()
    if _threshold_cache and (now - _threshold_cache_ts) < _threshold_cache_ttl:
        if shelter_id in _threshold_cache:
            return _threshold_cache[shelter_id]

    try:
        resp = supabase.table("thresholds").select("*").eq("shelter_id", shelter_id).maybe_single().execute()
        if resp.data:
            _threshold_cache[shelter_id] = resp.data
            _threshold_cache_ts = now
            return resp.data
    except Exception as e:
        print(f"  -> WARN: Could not load thresholds for {shelter_id}: {e}")

    # Fallback defaults
    defaults = {"temp_warning": 35.0, "temp_critical": 40.0, "vibration_warning": 0.3, "vibration_critical": 0.7}
    _threshold_cache[shelter_id] = defaults
    _threshold_cache_ts = now
    return defaults


def load_sensor_intervals(shelter_id: str) -> dict:
    """Load temp_interval_ms and vibration_interval_ms for a shelter (cached 60s)."""
    global _interval_cache, _interval_cache_ts

    now = time.time()
    if shelter_id in _interval_cache and (now - _interval_cache_ts) < _interval_cache_ttl:
        return _interval_cache[shelter_id]

    try:
        resp = (
            supabase.table("thresholds")
            .select("temp_interval_ms, vibration_interval_ms")
            .eq("shelter_id", shelter_id)
            .maybe_single()
            .execute()
        )
        if resp.data:
            intervals = {
                "temp_interval_ms":      int(resp.data.get("temp_interval_ms", 5000)),
                "vibration_interval_ms": int(resp.data.get("vibration_interval_ms", 1000)),
            }
            _interval_cache[shelter_id] = intervals
            _interval_cache_ts = now
            return intervals
    except Exception as e:
        print(f"  -> WARN: Could not load sensor intervals for {shelter_id}: {e}")

    # Fallback defaults
    defaults = {"temp_interval_ms": 5000, "vibration_interval_ms": 1000}
    _interval_cache[shelter_id] = defaults
    _interval_cache_ts = now
    return defaults


def publish_device_configs(mqtt_client) -> None:
    """Poll all active devices and publish interval config via MQTT if changed."""
    global _last_published_interval

    try:
        resp = (
            supabase.table("devices")
            .select("token, device_type, shelter_id")
            .eq("status", "active")
            .in_("device_type", ["temperature", "vibration"])
            .execute()
        )
        devices = resp.data or []
    except Exception as e:
        print(f"[Config] Could not fetch devices: {e}")
        return

    for device in devices:
        token       = device.get("token")
        dtype       = device.get("device_type")
        shelter_id  = device.get("shelter_id")
        if not token or not shelter_id:
            continue

        intervals = load_sensor_intervals(shelter_id)
        thresholds = load_thresholds(shelter_id)

        if dtype == "temperature":
            payload_dict = {
                "temp_interval_ms": intervals["temp_interval_ms"],
                "temp_warn": thresholds.get("temp_warning", 35.0),
                "temp_crit": thresholds.get("temp_critical", 40.0)
            }
        else:  # vibration
            payload_dict = {
                "vib_interval_ms": intervals["vibration_interval_ms"],
                "vib_warn": thresholds.get("vibration_warning", 0.3),
                "vib_crit": thresholds.get("vibration_critical", 0.7)
            }

        payload = json.dumps(payload_dict)
        last = _last_published_interval.get(token, {})
        
        # Only publish if value changed (or never published)
        if last != payload_dict:
            topic = f"{token}/Config"
            mqtt_client.publish(topic, payload, retain=True)
            _last_published_interval[token] = payload_dict
            print(f"[Config] Published {payload} -> {topic}")


def calc_env_risk_level(temperature: float, humidity: float, shelter_id: str) -> tuple[str, list[str]]:
    """Calculate risk level for temperature and humidity based on shelter thresholds."""
    thresholds = load_thresholds(shelter_id)
    temp_critical = thresholds.get("temp_critical", 40.0)
    temp_warning = thresholds.get("temp_warning", 35.0)
    hum_critical = thresholds.get("humidity_critical", 90.0)
    hum_warning = thresholds.get("humidity_warning", 80.0)

    temp_risk = "low"
    if temperature >= temp_critical:
        temp_risk = "high"
    elif temperature >= temp_warning:
        temp_risk = "medium"

    hum_risk = "low"
    if humidity >= hum_critical:
        hum_risk = "high"
    elif humidity >= hum_warning:
        hum_risk = "medium"
        
    risk_map = {"low": 0, "medium": 1, "high": 2}
    level_map = {0: "low", 1: "medium", 2: "high"}
    
    overall_risk = level_map[max(risk_map[temp_risk], risk_map[hum_risk])]
    
    causes = []
    if temp_risk != "low":
        causes.append("temp")
    if hum_risk != "low":
        causes.append("humidity")
        
    return overall_risk, causes


def insert_temperature(payload, shelter_id: str, device_id: str) -> None:
    """Insert a temperature reading into Supabase."""
    if isinstance(payload, dict):
        temperature = float(payload.get("temperature", 0.0))
        humidity = float(payload.get("humidity", 0.0))
    else:
        try:
            temperature = float(payload)
        except (ValueError, TypeError):
            temperature = 0.0
        humidity = 0.0

    risk_level, causes = calc_env_risk_level(temperature, humidity, shelter_id)

    row = {
        "shelter_id": shelter_id,
        "device_id": device_id,
        "temperature": temperature,
        "humidity": humidity,
        "risk_level": risk_level,
        "metadata": {},
    }

    response = supabase.table("temperature_data").insert(row).execute()
    temp_data_id = response.data[0]["data_id"]
    print(f"  -> Inserted env | shelter={shelter_id} | device={device_id} | "
          f"temp={temperature:.1f}°C | humidity={humidity:.1f}% | risk={risk_level}")

    # Update device last_seen
    try:
        supabase.table("devices").update({"last_seen": "now()"}).eq(
            "device_id", device_id
        ).execute()
    except Exception:
        pass

    # Generate alert if medium or high risk
    if risk_level in ("medium", "high"):
        thresholds = load_thresholds(shelter_id)
        severity = "critical" if risk_level == "high" else "warning"
        
        msg_parts = []
        if "temp" in causes:
            is_high = temperature >= thresholds.get("temp_critical", 40.0)
            temp_limit = thresholds.get("temp_critical" if is_high else "temp_warning", 40.0)
            msg_parts.append(f"Temp: {temperature:.1f}°C (limit: {temp_limit:.1f}°C)")
        if "humidity" in causes:
            is_high = humidity >= thresholds.get("humidity_critical", 90.0)
            hum_limit = thresholds.get("humidity_critical" if is_high else "humidity_warning", 90.0)
            msg_parts.append(f"Hum: {humidity:.1f}% (limit: {hum_limit:.1f}%)")
            
        msg = f"Environment {'critical' if risk_level == 'high' else 'warning'}: " + " | ".join(msg_parts)

        alert = {
            "shelter_id": shelter_id,
            "temp_data_id": temp_data_id,
            "alert_type": "temp",
            "status": "open",
            "severity": severity,
            "message": msg,
        }
        supabase.table("alerts").insert(alert).execute()
        print(f"  -> ALERT created: temp {severity}!")
        
        if risk_level == "high":
            send_telegram(f"🚨 [SHELTER {shelter_id[-4:]}] {msg}")


def _get_buffer(device_id: str) -> dict:
    """Get or create a buffer for a device."""
    if device_id not in _buffers:
        _buffers[device_id] = {
            "accel": None,
            "accel_ts": 0,
            "gyro": None,
            "gyro_ts": 0,
        }
    return _buffers[device_id]


def try_insert(shelter_id: str, device_id: str) -> None:
    """Insert if both accel and gyro are buffered and fresh."""
    buf = _get_buffer(device_id)
    now = time.time()

    if buf["accel"] is None or buf["gyro"] is None:
        return

    age_accel = now - buf["accel_ts"]
    age_gyro = now - buf["gyro_ts"]

    if age_accel > PAIR_TIMEOUT or age_gyro > PAIR_TIMEOUT:
        return

    accel = buf["accel"]
    gyro = buf["gyro"]

    data = {**accel, **gyro}
    insert_vibration(data, shelter_id, device_id)

    # Reset buffer
    buf["accel"] = None
    buf["gyro"] = None


def insert_vibration(data: dict, shelter_id: str, device_id: str) -> None:
    """Insert a single vibration reading into Supabase."""
    accel_x = data.get("accel_x", 0.0)
    accel_y = data.get("accel_y", 0.0)
    accel_z = data.get("accel_z", 0.0)
    gyro_x = data.get("gyro_x", 0.0)
    gyro_y = data.get("gyro_y", 0.0)
    gyro_z = data.get("gyro_z", 0.0)

    conventional_risk = calc_risk_level(accel_x, accel_y, accel_z, shelter_id)
    final_risk = conventional_risk
    
    # Use the last known AI metadata for this device as the base
    metadata = _last_ai_metadata.get(device_id, {}).copy()
    
    # Calculate magnitude and buffer
    magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)
    if device_id not in _ai_buffers:
        _ai_buffers[device_id] = []
    _ai_buffers[device_id].append(magnitude)
    
    # Trigger AI if buffer is full (N=50)
    if len(_ai_buffers[device_id]) >= 50:
        if ai_model and ai_scaler:
            try:
                signal = np.array(_ai_buffers[device_id])
                features = extract_features_from_signal(signal)
                features_scaled = ai_scaler.transform([features])
                probs = ai_model.predict_proba(features_scaled)[0]
                pred_class = int(ai_model.predict(features_scaled)[0])
                max_prob = float(np.max(probs))
                
                if max_prob < 0.60:
                    metadata = {"ai_label": "Unknown", "ai_confidence": max_prob, "ai_fallback": True, "ai_window_size": 50}
                    final_risk = conventional_risk
                else:
                    metadata = {"ai_label": CLASS_NAMES.get(pred_class, "Unknown"), "ai_confidence": max_prob, "ai_fallback": False, "ai_window_size": 50}
                    final_risk = CLASS_RISK_MAP.get(pred_class, conventional_risk)
            except Exception as e:
                print(f"  -> AI PREDICTION ERROR: {e}")
                metadata = {"ai_fallback": True, "error": str(e)}
        else:
            metadata = {"ai_fallback": True, "reason": "Model not loaded"}
            
        # Update cache
        _last_ai_metadata[device_id] = metadata
        
        # Reset buffer
        _ai_buffers[device_id] = []

    row = {
        "shelter_id": shelter_id,
        "device_id": device_id,
        "accel_x": accel_x,
        "accel_y": accel_y,
        "accel_z": accel_z,
        "gyro_x": gyro_x,
        "gyro_y": gyro_y,
        "gyro_z": gyro_z,
        "risk_level": final_risk,
        "metadata": metadata,
    }

    # Insert vibration data and get the new ID
    response = supabase.table("vibration_data").insert(row).execute()
    vibration_data_id = response.data[0]["data_id"]
    print(f"  -> Inserted | shelter={shelter_id} | device={device_id} | risk={final_risk} | "
          f"accel=({accel_x:.3f}, {accel_y:.3f}, {accel_z:.3f}) | "
          f"gyro=({gyro_x:.3f}, {gyro_y:.3f}, {gyro_z:.3f})")

    # Update device last_seen
    try:
        supabase.table("devices").update({"last_seen": "now()"}).eq(
            "device_id", device_id
        ).execute()
    except Exception:
        pass

    # Generate alert if medium, high or critical risk
    if final_risk in ["medium", "high", "critical"]:
        magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)
        thresholds = load_thresholds(shelter_id)
        
        is_critical = final_risk in ["high", "critical"]
        severity = "critical" if is_critical else "warning"
        vib_limit = thresholds.get("vibration_critical" if is_critical else "vibration_warning", 20.0)
        
        ai_label = metadata.get("ai_label", "Unknown")
        ai_conf = metadata.get("ai_confidence", 0.0)
        
        if not metadata.get("ai_fallback", True) and ai_label != "Unknown":
            ai_info = f" | AI Detected: {ai_label} ({(ai_conf*100):.0f}%)"
        else:
            ai_info = ""
        
        msg = (
            f"Vibration {severity}: magnitude {magnitude:.2f} g "
            f"(limit: {vib_limit:.1f} g){ai_info}"
        )

        alert = {
            "shelter_id": shelter_id,
            "vibration_data_id": vibration_data_id,
            "alert_type": "vibration",
            "status": "open",
            "severity": severity,
            "message": msg,
        }
        supabase.table("alerts").insert(alert).execute()
        print(f"  -> ALERT created: vibration {severity}!")
        
        if is_critical:
            send_telegram(f"🚨 [SHELTER {shelter_id[-4:]}] {msg}")


# ---------------------------------------------------------------------------
# MQTT callbacks
# ---------------------------------------------------------------------------


def on_connect(client, userdata, flags, reason_code, properties=None):
    global _mqtt_client_ref
    if reason_code == 0:
        print(f"Connected to MQTT broker {MQTT_BROKER}:{MQTT_PORT}")
        # Public brokers often block root '#' subscriptions, use '+' instead
        client.subscribe("+/Accel")
        client.subscribe("+/Gyro")
        client.subscribe("+/Temp")
        print("Subscribed to: +/Accel, +/Gyro, +/Temp")
        _mqtt_client_ref = client
        # Immediately push current interval config to all active devices
        publish_device_configs(client)
    else:
        print(f"MQTT connection failed with code: {reason_code}")


# Periodic config push tracker
_last_config_push_ts: float = 0
CONFIG_PUSH_INTERVAL = 60  # seconds


def on_message(client, userdata, msg):
    global _last_config_push_ts

    print(f"DEBUG: received message on {msg.topic}")
    topic = msg.topic
    # Expecting: <device_token>/<sensor_type> (e.g. tok_esp32_temp_alpha_001/Temp)
    parts = topic.split('/')
    if len(parts) != 2:
        return  # Ignore invalid topics

    device_token = parts[0].strip()
    sensor_type = parts[1].strip()

    # Resolve token -> device_id + shelter_id
    device = resolve_device(device_token)
    if not device:
        print(f"  -> SKIP: Unknown device token '{device_token}'")
        return

    device_id = device["device_id"]
    shelter_id = device["shelter_id"]

    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"Invalid payload on {topic}: {e}")
        return

    print(f"[{topic}] {payload}")

    now = time.time()
    buf = _get_buffer(device_id)

    if sensor_type == "Accel":
        buf["accel"] = payload
        buf["accel_ts"] = now
    elif sensor_type == "Gyro":
        buf["gyro"] = payload
        buf["gyro_ts"] = now
    elif sensor_type == "Temp":
        insert_temperature(payload, shelter_id, device_id)
    else:
        return

    # Periodically re-push interval config to all devices (every 60s)
    if now - _last_config_push_ts >= CONFIG_PUSH_INTERVAL:
        _last_config_push_ts = now
        # Clear interval cache so fresh values are fetched from DB
        _interval_cache.clear()
        publish_device_configs(client)

    if sensor_type in ("Accel", "Gyro"):
        try:
            try_insert(shelter_id, device_id)
        except Exception as e:
            print(f"  -> ERROR inserting to Supabase: {e}")


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    print(f"Disconnected from MQTT (code: {reason_code}). Reconnecting...")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    client = MQTTClient(callback_api_version=CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    print(f"Connecting to {MQTT_BROKER}:{MQTT_PORT} ...")
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
