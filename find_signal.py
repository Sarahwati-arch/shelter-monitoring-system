import os
import numpy as np
import joblib
import librosa
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr

AI_MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vibration_ai", "models")
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
    zcr = np.mean(librosa.feature.zero_crossing_rate(np.array(signal)))
    peak = np.max(np.abs(signal))
    crest_factor = peak / rms if rms > 0 else 0.0
    return [zcr, mean, mad, skewness, std, kurt, crest_factor, min_val, max_val, range_val, median, iqr_val, rms, energy]

def test_signal(signal, name):
    f = extract_features(signal)
    fs = scaler.transform([f])
    probs = model.predict_proba(fs)[0]
    pred = int(model.predict(fs)[0])
    conf = float(np.max(probs))
    print(f"{name:20s}: Pred={CLASS_NAMES[pred]:15s} Conf={conf*100:.1f}%")
    return CLASS_NAMES[pred], conf, signal

signals = []
t = np.linspace(0, 10, 50)
signals.append((np.sin(t) * 2 + 2, "Sine Wave Low"))
signals.append((np.sin(t * 5) * 5 + 5, "Sine Wave High"))
signals.append((np.random.normal(2, 0.5, 50), "Gaussian Noise"))
signals.append((np.ones(50) * 2, "Constant"))
signals.append((np.array([5 if i%5==0 else 1 for i in range(50)]), "Impulse 5"))
signals.append((np.array([8 if i%10==0 else 0 for i in range(50)]), "Impulse 10"))
signals.append((np.linspace(0, 10, 50), "Linear Ramp"))
signals.append((np.abs(np.sin(t * 2) * 10), "Abs Sine 10"))
signals.append((np.random.uniform(0, 1, 50), "Uniform Low"))
signals.append((np.random.uniform(0, 10, 50), "Uniform High"))

for sig, name in signals:
    test_signal(sig, name)
