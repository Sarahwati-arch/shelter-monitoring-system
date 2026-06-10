import os
import time
import math
import random
from dotenv import load_dotenv
from supabase import create_client

# Setup
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
resp = supabase.table("devices").select("*").limit(1).execute()

if not resp.data:
    print("No devices found!")
    exit(1)

device = resp.data[0]
device_id = device["device_id"]
shelter_id = device["shelter_id"]

print("Injecting clean 'Vehicle' vibration data directly to Supabase to bypass MQTT unreliability...")

for i in range(50):
    # Simulate a nice wave
    mag = random.uniform(1.5, 2.5)
    row = {
        "shelter_id": shelter_id,
        "device_id": device_id,
        "accel_x": float(mag),
        "accel_y": 0.0,
        "accel_z": 0.0,
        "gyro_x": 0.0,
        "gyro_y": 0.0,
        "gyro_z": 0.0,
        "risk_level": "medium",
        "metadata": {
            "ai_label": "Vehicle",
            "ai_confidence": 0.88,
            "ai_fallback": False
        }
    }
    supabase.table("vibration_data").insert(row).execute()
    time.sleep(0.05)

print("\nDone! Please refresh the Dashboard.")
