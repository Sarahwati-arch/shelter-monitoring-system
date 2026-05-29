import os
import json
import time
import math
import random
import sys
from dotenv import load_dotenv
from paho.mqtt.client import Client as MQTTClient, CallbackAPIVersion
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Missing config")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
resp = supabase.table("devices").select("*").limit(1).execute()

if not resp.data:
    print("No devices found in Supabase!")
    sys.exit(1)

device_token = resp.data[0]["token"]
print(f"Using existing device token: {device_token}")

client = MQTTClient(callback_api_version=CallbackAPIVersion.VERSION2)
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

def publish_point(val_x, val_y, val_z):
    accel = {"accel_x": val_x, "accel_y": val_y, "accel_z": val_z}
    gyro = {"gyro_x": 0, "gyro_y": 0, "gyro_z": 0}
    client.publish(f"{device_token}/Accel", json.dumps(accel))
    client.publish(f"{device_token}/Gyro", json.dumps(gyro))
    time.sleep(0.1)

print("\n--- Pattern 1: Constant Low Noise (Aiming for Normal) ---")
for i in range(50):
    publish_point(random.uniform(-0.02, 0.02), random.uniform(-0.02, 0.02), 1.0 + random.uniform(-0.02, 0.02))

print("Waiting for AI Inference...")
time.sleep(4)

print("\n--- Pattern 2: Periodic Spikes (Aiming for Footsteps) ---")
for i in range(50):
    # Spike every 10 points
    val = 2.5 if i % 10 == 0 else random.uniform(-0.1, 0.1)
    publish_point(val, val, 1.0 + val)

print("Waiting for AI Inference...")
time.sleep(4)

print("\n--- Pattern 3: High Frequency Oscillation (Aiming for Sabotage/Maintenance) ---")
for i in range(50):
    # Alternates positive and negative (High Zero Crossing Rate)
    val = 1.5 * math.sin(i * math.pi) 
    publish_point(val, val, 1.0 + val)

print("Waiting for AI Inference...")
time.sleep(4)

print("\n--- Pattern 4: Low Frequency High Amplitude (Aiming for Earthquake) ---")
for i in range(50):
    # Smooth sine wave with high amplitude
    val = 3.5 * math.sin(i * 0.1)
    publish_point(val, val, 1.0 + val)

print("Waiting for AI Inference...")
time.sleep(4)

print("\nAdvanced Simulation finished. Check your Dashboard!")
client.loop_stop()
client.disconnect()
