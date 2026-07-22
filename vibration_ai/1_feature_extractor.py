import os
import json
import random
import numpy as np
import librosa
from scipy.stats import skew, kurtosis, median_abs_deviation, iqr
from scipy import signal as scipy_signal
from common_schema import VibrationWindow

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
    windows = []
    
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
                    # Librosa automatically normalizes audio to [-1.0, 1.0]
                    sig, sr = librosa.load(file_path, sr=22050)
                    window = VibrationWindow(signal=sig, sample_rate=22050, label=label, source="wav")
                    windows.append(window)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    
    return windows

def extract_from_json_folders(base_dir, class_folders):
    windows = []
    
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
                        sig = np.array(data, dtype=float)
                        
                        # Min-Max scale to [-1, 1] to match WAV domain
                        sig_min = np.min(sig)
                        sig_max = np.max(sig)
                        if sig_max > sig_min:
                            sig = 2.0 * (sig - sig_min) / (sig_max - sig_min) - 1.0
                        else:
                            sig = np.zeros_like(sig)
                            
                        # Resample from 100 Hz to 22050 Hz to match audio domain
                        duration = len(sig) / 100.0
                        target_points = int(duration * 22050)
                        sig_resampled = scipy_signal.resample(sig, target_points)
                        
                        window = VibrationWindow(signal=sig_resampled, sample_rate=22050, label=label, source="json_sensor")
                        windows.append(window)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    
    return windows

def process_windows(windows):
    X = []
    y = []
    sources = []
    
    for window in windows:
        features = extract_features_from_signal(window.signal)
        X.append(features)
        y.append(window.label)
        sources.append(window.source)
        
    return np.array(X), np.array(y), np.array(sources)


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    class_folders = [
        "class_0_normal_AC",
        "class_1_foot_steps",
        "class_2_sabotase_maint",
        "class_3_vehicle"
    ]
    
    models_dir = os.path.join(base_dir, "models")
    
    print("Extracting audio windows (internet datasets)...")
    audio_windows = extract_from_audio_folders(models_dir, class_folders)
    
    print("Extracting real-life audio and JSON windows...")
    real_life_dir = os.path.join(models_dir, "real_life_datasets")
    # We append class_4_earthquake so the enumerate label automatically becomes 4.
    real_life_folders = class_folders + ["class_4_earthquake"]
    
    real_audio_windows = extract_from_audio_folders(real_life_dir, real_life_folders)
    real_json_windows = extract_from_json_folders(real_life_dir, real_life_folders)

    # Combine all windows
    all_windows = audio_windows + real_audio_windows + real_json_windows
    
    print(f"Processing {len(all_windows)} total unified windows...")
    X_all, y_all, sources_all = process_windows(all_windows)
    
    print(f"Total extracted shape: X={X_all.shape}, y={y_all.shape}, sources={sources_all.shape}")
    
    # Save to disk
    out_x = os.path.join(base_dir, "features_X.npy")
    out_y = os.path.join(base_dir, "features_y.npy")
    out_sources = os.path.join(base_dir, "features_source.npy")
    
    np.save(out_x, X_all)
    np.save(out_y, y_all)
    np.save(out_sources, sources_all)
    
    print(f"Successfully saved features to {out_x}, {out_y}, and {out_sources}")
