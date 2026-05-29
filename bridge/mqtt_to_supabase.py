"""
MQTT -> Supabase Bridge for Shelter Monitoring System
Subscribes to Accel and Gyro topics, merges them, and inserts into Supabase.
"""

import json
import math
import os
import sys
import time
from dotenv import load_dotenv

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

# Vibration threshold for risk level (g-force magnitude)
VIBRATION_WARNING = 2.0  # matches thresholds table

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


def calc_risk_level(accel_x: float, accel_y: float, accel_z: float) -> str:
    """Calculate risk level based on acceleration magnitude."""
    magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)
    if magnitude >= VIBRATION_WARNING:
        return "high"
    elif magnitude >= VIBRATION_WARNING * 0.6:
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
    defaults = {"temp_warning": 35.0, "temp_critical": 40.0}
    _threshold_cache[shelter_id] = defaults
    _threshold_cache_ts = now
    return defaults


def calc_temp_risk_level(temperature: float, shelter_id: str) -> str:
    """Calculate risk level for temperature based on shelter thresholds."""
    thresholds = load_thresholds(shelter_id)
    temp_critical = thresholds.get("temp_critical", 40.0)
    temp_warning = thresholds.get("temp_warning", 35.0)

    if temperature >= temp_critical:
        return "high"
    elif temperature >= temp_warning:
        return "medium"
    return "low"


def insert_temperature(payload: dict, shelter_id: str, device_id: str) -> None:
    """Insert a temperature reading into Supabase."""
    temperature = float(payload.get("temperature", 0.0))
    humidity = float(payload.get("humidity", 0.0))

    risk_level = calc_temp_risk_level(temperature, shelter_id)

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
    print(f"  -> Inserted temp | shelter={shelter_id} | device={device_id} | "
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
        limit = thresholds.get("temp_critical" if risk_level == "high" else "temp_warning", 40.0)

        alert = {
            "shelter_id": shelter_id,
            "temp_data_id": temp_data_id,
            "alert_type": "temp",
            "status": "open",
            "severity": severity,
            "message": (
                f"Temperature {'critical' if risk_level == 'high' else 'warning'}: "
                f"{temperature:.1f}°C (limit: {limit:.1f}°C)"
            ),
        }
        supabase.table("alerts").insert(alert).execute()
        print(f"  -> ALERT created: temp {severity}!")


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

    risk_level = calc_risk_level(accel_x, accel_y, accel_z)

    row = {
        "shelter_id": shelter_id,
        "device_id": device_id,
        "accel_x": accel_x,
        "accel_y": accel_y,
        "accel_z": accel_z,
        "gyro_x": gyro_x,
        "gyro_y": gyro_y,
        "gyro_z": gyro_z,
        "risk_level": risk_level,
        "metadata": {},
    }

    # Insert vibration data and get the new ID
    response = supabase.table("vibration_data").insert(row).execute()
    vibration_data_id = response.data[0]["data_id"]
    print(f"  -> Inserted | shelter={shelter_id} | device={device_id} | risk={risk_level} | "
          f"accel=({accel_x:.3f}, {accel_y:.3f}, {accel_z:.3f}) | "
          f"gyro=({gyro_x:.3f}, {gyro_y:.3f}, {gyro_z:.3f})")

    # Update device last_seen
    try:
        supabase.table("devices").update({"last_seen": "now()"}).eq(
            "device_id", device_id
        ).execute()
    except Exception:
        pass

    # Generate alert if high risk
    if risk_level == "high":
        magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)
        
        alert = {
            "shelter_id": shelter_id,
            "vibration_data_id": vibration_data_id,
            "alert_type": "vibration",
            "status": "open",
            "severity": "critical",
            "message": (
                f"Vibration critical: magnitude {magnitude:.2f} g "
                f"(limit: {VIBRATION_WARNING} g)"
            ),
        }
        supabase.table("alerts").insert(alert).execute()
        print(f"  -> ALERT created: vibration critical!")


# ---------------------------------------------------------------------------
# MQTT callbacks
# ---------------------------------------------------------------------------


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"Connected to MQTT broker {MQTT_BROKER}:{MQTT_PORT}")
        # Subscribe to all topics
        client.subscribe("#")
        print("Subscribed to: #")
    else:
        print(f"MQTT connection failed with code: {reason_code}")


def on_message(client, userdata, msg):
    topic = msg.topic
    # Expecting: <device_token>/<sensor_type> (e.g. tok_esp32_temp_alpha_001/Temp)
    parts = topic.split('/')
    if len(parts) != 2:
        return  # Ignore invalid topics

    device_token = parts[0]
    sensor_type = parts[1]

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
        return
    else:
        return

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
