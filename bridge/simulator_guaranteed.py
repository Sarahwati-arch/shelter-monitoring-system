import os
import json
import time
import random
import numpy as np
import sys
from dotenv import load_dotenv
from paho.mqtt.client import Client as MQTTClient, CallbackAPIVersion
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
resp = supabase.table("devices").select("*").limit(1).execute()
device_token = resp.data[0]["token"]

client = MQTTClient(callback_api_version=CallbackAPIVersion.VERSION2)
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

print("Publishing Gaussian Noise (Guaranteed Vehicle > 80%)...")
sig = np.random.normal(2, 0.5, 150)
for mag in sig:
    accel = {"accel_x": float(mag), "accel_y": 0.0, "accel_z": 0.0}
    gyro = {"gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0}
    client.publish(f"{device_token}/Accel", json.dumps(accel))
    client.publish(f"{device_token}/Gyro", json.dumps(gyro))
    time.sleep(0.2)

time.sleep(2)
client.loop_stop()
client.disconnect()
print("Done!")
