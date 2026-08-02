import os
import json
import numpy as np
import joblib
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr
import librosa
import warnings

# Suppress librosa warnings for tiny arrays
warnings.filterwarnings("ignore")

# Exact feature extractor from mqtt_to_supabase.py
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
    # ZCR on tiny arrays
    zcr = np.mean(librosa.feature.zero_crossing_rate(np.array(signal)))
    peak = np.max(np.abs(signal))
    crest_factor = peak / rms if rms > 0 else 0.0
    return [zcr, mean, mad, skewness, std, kurt, crest_factor, min_val, max_val, range_val, median, iqr_val, rms, energy]

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models")
    datasets_dir = os.path.join(models_dir, "real_life_datasets")
    
    model_path = os.path.join(models_dir, "vibration_classifier.pkl")
    scaler_path = os.path.join(models_dir, "scaler.pkl")
    
    if not os.path.exists(model_path):
        print("Model not found!")
        return
        
    ai_model = joblib.load(model_path)
    
    # In your current 2_model_trainer.py, scaler is NOT exported, 
    # but mqtt_to_supabase.py tries to load one. 
    # We will simulate what your deployment bridge actually does:
    try:
        ai_scaler = joblib.load(scaler_path)
        print("Loaded scaler.pkl successfully.\n")
    except Exception as e:
        ai_scaler = None
        print(f"Warning: Could not load scaler.pkl (Simulating deployment bug!)\n")
    
    class_names = {0: "Normal/AC", 1: "Footsteps", 2: "Sabotage/Maintenance", 3: "Vehicle", 4: "Earthquake"}
    
    print("=========================================================")
    print("  SIMULATING PRODUCTION PIPELINE (mqtt_to_supabase.py)  ")
    print("=========================================================\n")
    
    classes = ["class_0_normal_AC", "class_1_foot_steps", "class_2_sabotase_maint", "class_3_vehicle", "class_4_earthquake"]
    
    for class_folder in classes:
        folder_path = os.path.join(datasets_dir, class_folder)
        if not os.path.isdir(folder_path): continue
        
        # Pick the first JSON file
        json_files = [f for f in os.listdir(folder_path) if f.endswith('.json') and 'synthetic' not in f]
        if not json_files: continue
        
        test_file = json_files[0]
        test_path = os.path.join(folder_path, test_file)
        
        with open(test_path, 'r') as f:
            data = json.load(f)
            
        signal = np.array(data, dtype=float)
        
        # MOCK PRODUCTION PIPELINE:
        # In mqtt_to_supabase.py, it buffers exactly 10 points!
        # Your 1_feature_extractor resamples thousands of points, but production only uses 10.
        if len(signal) >= 10:
            buffer_signal = signal[:10]
        else:
            buffer_signal = signal
            
        sig_min = np.min(buffer_signal)
        sig_max = np.max(buffer_signal)
        range_g = sig_max - sig_min
        
        expected_class = int(class_folder.split('_')[1])
        expected_name = class_names[expected_class]
        
        print(f"[{expected_name}] - Testing File: {test_file}")
        print(f"  Production Buffer (N=10): {np.round(buffer_signal[:5], 3)}... (Range: {range_g:.3f}g)")
        
        if range_g < 0.02:
            print(f"  -> [BYPASSED] RESULT: BYPASSED AI. (Range < 0.02g). Predicted: Normal/AC\n")
            continue
            
        features = extract_features_from_signal(buffer_signal)
        
        if ai_scaler:
            try:
                features_input = ai_scaler.transform([features])
            except Exception as e:
                print(f"  -> [CRASH] Scaler version mismatch! ({e})\n")
                continue
        else:
            features_input = [features]
            
        probs = ai_model.predict_proba(features_input)[0]
        pred_class = int(ai_model.predict(features_input)[0])
        max_prob = float(np.max(probs))
        
        if max_prob < 0.60:
            print(f"  -> [UNKNOWN] RESULT: UNKNOWN (Confidence {max_prob:.2f} < 0.60 threshold)\n")
        else:
            pred_name = class_names.get(pred_class, "Unknown")
            status = "PASS" if pred_class == expected_class else "FAIL"
            print(f"  -> {status} | AI Predicted: {pred_name} (Confidence: {max_prob:.2f})\n")

if __name__ == "__main__":
    main()
