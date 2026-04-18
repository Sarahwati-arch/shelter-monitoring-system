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
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "TelkomShelterVibra/#")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Default device/shelter mapping
DEFAULT_DEVICE_ID = os.getenv("DEVICE_ALPHA", "e5f6a7b8-c9d0-1234-efab-345678901234")
DEFAULT_SHELTER_ID = os.getenv("SHELTER_ALPHA", "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

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
# Buffer: store latest Accel + Gyro, insert when both are available
# ---------------------------------------------------------------------------

buffer = {
    "accel": None,   # {"accel_x": ..., "accel_y": ..., "accel_z": ...}
    "accel_ts": 0,   # timestamp when accel arrived
    "gyro": None,    # {"gyro_x": ..., "gyro_y": ..., "gyro_z": ...}
    "gyro_ts": 0,    # timestamp when gyro arrived
}

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


def try_insert() -> None:
    """Insert if both accel and gyro are buffered and fresh."""
    now = time.time()

    if buffer["accel"] is None or buffer["gyro"] is None:
        return

    age_accel = now - buffer["accel_ts"]
    age_gyro = now - buffer["gyro_ts"]

    if age_accel > PAIR_TIMEOUT or age_gyro > PAIR_TIMEOUT:
        return

    accel = buffer["accel"]
    gyro = buffer["gyro"]

    data = {**accel, **gyro}
    insert_vibration(data)

    # Reset buffer
    buffer["accel"] = None
    buffer["gyro"] = None


def insert_vibration(data: dict) -> None:
    """Insert a single vibration reading into Supabase."""
    accel_x = data.get("accel_x", 0.0)
    accel_y = data.get("accel_y", 0.0)
    accel_z = data.get("accel_z", 0.0)
    gyro_x = data.get("gyro_x", 0.0)
    gyro_y = data.get("gyro_y", 0.0)
    gyro_z = data.get("gyro_z", 0.0)

    risk_level = calc_risk_level(accel_x, accel_y, accel_z)

    device_id = DEFAULT_DEVICE_ID
    shelter_id = DEFAULT_SHELTER_ID

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

    supabase.table("vibration_data").insert(row).execute()
    print(f"  -> Inserted | risk={risk_level} | "
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
        # Subscribe to both Accel and Gyro topics
        client.subscribe("Accel")
        client.subscribe("Gyro")
        print("Subscribed to: Accel")
        print("Subscribed to: Gyro")
    else:
        print(f"MQTT connection failed with code: {reason_code}")


def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"Invalid payload on {topic}: {e}")
        return

    print(f"[{topic}] {payload}")

    now = time.time()

    if "Accel" in topic:
        buffer["accel"] = payload
        buffer["accel_ts"] = now
    elif "Gyro" in topic:
        buffer["gyro"] = payload
        buffer["gyro_ts"] = now
    else:
        return

    try:
        try_insert()
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
