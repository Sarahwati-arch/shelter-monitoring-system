import os
import json
import random
import numpy as np
import librosa
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr

def extract_features_from_signal(signal):
    """
    Extracts 14 statistical features from a 1D numpy array.
    """
    if len(signal) == 0:
        return np.zeros(14)
        
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
    rms = np.sqrt(np.mean(signal**2))
    energy = np.sum(signal**2)
    
    # ZCR
    # librosa.feature.zero_crossing_rate returns shape (1, t)
    zcr = np.mean(librosa.feature.zero_crossing_rate(signal))
    
    # Crest Factor = Peak / RMS
    peak = np.max(np.abs(signal))
    crest_factor = peak / rms if rms > 0 else 0.0
    
    return [
        zcr, mean, mad, skewness, std, kurt, crest_factor, 
        min_val, max_val, range_val, median, iqr_val, rms, energy
    ]

def extract_from_audio_folders(base_dir, class_folders):
    X = []
    y = []
    
    for label, folder in enumerate(class_folders):
        folder_path = os.path.join(base_dir, folder)
        if not os.path.isdir(folder_path):
            print(f"Warning: Directory {folder_path} not found.")
            continue
            
        for file_name in os.listdir(folder_path):
            if file_name.endswith('.wav'):
                file_path = os.path.join(folder_path, file_name)
                try:
                    # Load audio, resample to 22050 Hz by default
                    signal, sr = librosa.load(file_path, sr=None)
                    features = extract_features_from_signal(signal)
                    X.append(features)
                    y.append(label)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    
    return X, y

def extract_from_json_folders(base_dir, class_folders):
    X = []
    y = []
    
    for label, folder in enumerate(class_folders):
        folder_path = os.path.join(base_dir, folder)
        if not os.path.isdir(folder_path):
            print(f"Warning: Directory {folder_path} not found.")
            continue
            
        for file_name in os.listdir(folder_path):
            if file_name.endswith('.json'):
                file_path = os.path.join(folder_path, file_name)
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                    
                    if isinstance(data, list) and len(data) > 0:
                        signal = np.array(data)
                        features = extract_features_from_signal(signal)
                        X.append(features)
                        y.append(label)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    
    return X, y

def process_earthquake_json(json_path, num_samples=40):
    X = []
    y = []
    
    if not os.path.isfile(json_path):
        print(f"Warning: JSON file {json_path} not found.")
        return X, y
        
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    # Randomly sample exactly `num_samples` segments
    if len(data) > num_samples:
        sampled_data = random.sample(data, num_samples)
    else:
        sampled_data = data
        
    for item in sampled_data:
        feats = item['features'][0]
        # Map to the exact same 14 features in the exact same order as `extract_features_from_signal`
        # Order: zcr, mean, mad, skewness, std, kurtosis, crest_factor, min, max, range, median, iqr, rms, energy
        feature_vector = [
            feats.get('zcr', 0.0),
            feats.get('mean', 0.0),
            feats.get('mad', 0.0),
            feats.get('skewness', 0.0),
            feats.get('std', 0.0),
            feats.get('kurtosis', 0.0),
            feats.get('crest_factor', 0.0),
            feats.get('min', 0.0),
            feats.get('max', 0.0),
            feats.get('range', 0.0),
            feats.get('median', 0.0),
            feats.get('iqr', 0.0),
            feats.get('rms', 0.0),
            feats.get('energy', 0.0)
        ]
        X.append(feature_vector)
        y.append(4) # Class 4 for earthquake
        
    return X, y

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    class_folders = [
        "class_0_normal_AC",
        "class_1_foot_steps",
        "class_2_sabotase_maint",
        "class_3_vehicle"
    ]
    
    models_dir = os.path.join(base_dir, "models")
    
    print("Extracting features from audio folders...")
    X_audio, y_audio = extract_from_audio_folders(models_dir, class_folders)
    
    print("Extracting features from earthquake JSON...")
    json_path = os.path.join(models_dir, "class_4_earthquake", "intermediate_train_w_150000_s_150000.json")
    X_json, y_json = process_earthquake_json(json_path, num_samples=40)
    
    print("Extracting features from real-life datasets...")
    real_life_dir = os.path.join(models_dir, "real_life_datasets")
    # We append class_4_earthquake so the enumerate label automatically becomes 4.
    # This assumes your real-life earthquake data are .wav files.
    # If they are JSON, you would process them similarly to the original earthquake dataset.
    real_life_folders = class_folders + ["class_4_earthquake"]
    X_real_audio, y_real_audio = extract_from_audio_folders(real_life_dir, real_life_folders)
    
    print("Extracting features from real-life JSON datasets...")
    X_real_json, y_real_json = extract_from_json_folders(real_life_dir, real_life_folders)

    # Combine data
    X_all = np.array(X_audio + X_json + X_real_audio + X_real_json)
    y_all = np.array(y_audio + y_json + y_real_audio + y_real_json)
    
    print(f"Total extracted shape: X={X_all.shape}, y={y_all.shape}")
    
    # Save to disk
    out_x = os.path.join(base_dir, "features_X.npy")
    out_y = os.path.join(base_dir, "features_y.npy")
    np.save(out_x, X_all)
    np.save(out_y, y_all)
    
    print(f"Successfully saved features to {out_x} and {out_y}")
