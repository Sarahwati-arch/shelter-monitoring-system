import os
import numpy as np
import joblib
import librosa
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr
import math
import random
import time

AI_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vibration_ai", "models")
MODEL_PATH = os.path.join(AI_MODELS_DIR, "vibration_classifier.pkl")
SCALER_PATH = os.path.join(AI_MODELS_DIR, "scaler.pkl")

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
CLASS_NAMES = {0: "Normal/AC", 1: "Footsteps", 2: "Sabotage", 3: "Vehicle", 4: "Earthquake"}

def extract_features(signal):
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
    sig_f32 = np.array(signal, dtype=np.float32)
    zcr = np.mean(librosa.feature.zero_crossing_rate(sig_f32))
    peak = np.max(np.abs(signal))
    crest_factor = peak / rms if rms > 0 else 0.0
    return [zcr, mean, mad, skewness, std, kurt, crest_factor, min_val, max_val, range_val, median, iqr_val, rms, energy]

def find_target(target_class=4):
    print(f"Finding signal for class {CLASS_NAMES[target_class]}...")
    best_conf = 0
    for i in range(1000):
        t = np.linspace(0, random.uniform(1, 20), 50)
        sig = np.sin(t) * random.uniform(1, 10) + random.uniform(-1, 1)
        f = extract_features(sig)
        fs = scaler.transform([f])
        probs = model.predict_proba(fs)[0]
        pred = int(model.predict(fs)[0])
        conf = float(np.max(probs))
        if pred == target_class:
            if conf > best_conf: best_conf = conf
            if conf > 0.65:
                return sig, conf
    print(f"Max conf found: {best_conf}")
    return None, 0

sig_eq, conf = find_target(4)
if sig_eq is not None:
    print(f"Found Earthquake! Conf: {conf}")
    
    # Send it to MQTT
    import json
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

    print("Sending...")
    for mag in sig_eq:
        accel = {"accel_x": float(mag), "accel_y": 0.0, "accel_z": 0.0}
        gyro = {"gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0}
        client.publish(f"{device_token}/Accel", json.dumps(accel))
        client.publish(f"{device_token}/Gyro", json.dumps(gyro))
        time.sleep(0.1)

    time.sleep(2)
    client.disconnect()
