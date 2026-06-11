import os
import json
import time
import random
import sys
from dotenv import load_dotenv
from paho.mqtt.client import Client as MQTTClient, CallbackAPIVersion
from supabase import create_client

# 1. Setup
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

# 2. Get a valid device token from DB
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
resp = supabase.table("devices").select("*").limit(1).execute()

if not resp.data:
    print("No devices found in Supabase! Cannot run simulation without a valid device token.")
    sys.exit(1)

device_token = resp.data[0]["token"]
print(f"Using existing device token: {device_token}")

# 3. Connect to MQTT
client = MQTTClient(callback_api_version=CallbackAPIVersion.VERSION2)
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

def send_data(accel_range_x, accel_range_y, accel_range_z, gyro_range, count=50, delay=0.1):
    for i in range(count):
        accel = {
            "accel_x": random.uniform(*accel_range_x),
            "accel_y": random.uniform(*accel_range_y),
            "accel_z": random.uniform(*accel_range_z)
        }
        gyro = {
            "gyro_x": random.uniform(*gyro_range),
            "gyro_y": random.uniform(*gyro_range),
            "gyro_z": random.uniform(*gyro_range)
        }
        client.publish(f"{device_token}/Accel", json.dumps(accel))
        client.publish(f"{device_token}/Gyro", json.dumps(gyro))
        time.sleep(delay)

print("\n--- Phase 1: Normal Condition ---")
print("Sending 50 pairs of low-magnitude vibration data...")
send_data((-0.1, 0.1), (-0.1, 0.1), (0.9, 1.1), (-0.05, 0.05))
print("Waiting for bridge to process (AI Inference)...")
time.sleep(3)

print("\n--- Phase 2: High Vibration / Earthquake Condition ---")
print("Sending 50 pairs of high-magnitude vibration data...")
# Earthquake logic (random chaotic high values)
send_data((-2.5, 2.5), (-2.5, 2.5), (-2.5, 3.5), (-2.0, 2.0))
print("Waiting for bridge to process (AI Inference)...")
time.sleep(3)

print("\nSimulation finished. Check your Dashboard!")
client.loop_stop()
client.disconnect()
