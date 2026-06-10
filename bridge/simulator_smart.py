import os
import sys
import json
import time
import random
import math
import numpy as np
import joblib
import librosa
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr
from dotenv import load_dotenv
from paho.mqtt.client import Client as MQTTClient, CallbackAPIVersion
from supabase import create_client

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
    
    # zero crossing rate requires 1D array
    zcr_array = librosa.feature.zero_crossing_rate(np.array(signal))
    zcr = np.mean(zcr_array)
    
    peak = np.max(np.abs(signal))
    crest_factor = peak / rms if rms > 0 else 0.0
    return [zcr, mean, mad, skewness, std, kurt, crest_factor, min_val, max_val, range_val, median, iqr_val, rms, energy]

# 1. Load Model
AI_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vibration_ai", "models")
MODEL_PATH = os.path.join(AI_MODELS_DIR, "vibration_classifier.pkl")
SCALER_PATH = os.path.join(AI_MODELS_DIR, "scaler.pkl")

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
CLASS_NAMES = {0: "Normal/AC", 1: "Footsteps", 2: "Sabotage", 3: "Vehicle", 4: "Earthquake"}

def find_interesting_signal():
    print("Searching for a signal that predicts Footsteps, Sabotage, or Earthquake with > 65% confidence...")
    for i in range(100000):
        # generate random waves
        A = random.uniform(0.1, 10.0)
        freq = random.uniform(0.01, 2.0)
        noise = random.uniform(0.0, 2.0)
        
        signal = [A * math.sin(j * freq) + random.uniform(-noise, noise) for j in range(50)]
        features = extract_features_from_signal(signal)
        features_scaled = scaler.transform([features])
        probs = model.predict_proba(features_scaled)[0]
        pred = int(model.predict(features_scaled)[0])
        conf = float(np.max(probs))
        
        # Target classes: 1 (Footsteps), 2 (Sabotage), 4 (Earthquake)
        if pred in [1, 2, 4] and conf >= 0.65:
            print(f"Found! Predicting: {CLASS_NAMES[pred]} with {conf*100:.1f}% confidence")
            return signal, CLASS_NAMES[pred]
            
    print("Could not find perfectly matching signal, falling back to basic simulation.")
    return [random.uniform(0, 1) for _ in range(50)], "Unknown"

target_signal, class_name = find_interesting_signal()

# 2. Setup MQTT and publish
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

def publish_signal(signal):
    for mag in signal:
        # distribute magnitude arbitrarily
        accel = {"accel_x": float(mag), "accel_y": 0.0, "accel_z": 0.0}
        gyro = {"gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0}
        client.publish(f"{device_token}/Accel", json.dumps(accel))
        client.publish(f"{device_token}/Gyro", json.dumps(gyro))
        time.sleep(0.1)

print(f"\nPublishing {class_name} Signal to MQTT...")
publish_signal(target_signal)
time.sleep(3)

client.loop_stop()
client.disconnect()
print("Done!")
