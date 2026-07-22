import os
import json
import numpy as np

def generate_earthquake_signal(num_samples=50):
    # Earthquakes have high amplitude and sustained energy
    # We simulate this with a mix of low frequency oscillation and high variance noise
    t = np.linspace(0, 5, num_samples)
    base_vibration = 2.0 * np.sin(2 * np.pi * 1.5 * t) # 1.5 Hz base
    noise = np.random.normal(1.0, 1.5, num_samples)
    
    signal = np.abs(base_vibration + noise) + 1.0 # Ensure positive magnitudes
    return signal.tolist()

def main():
    base_dir = r"d:\shelter-monitoring-system\vibration_ai\models\real_life_datasets\class_4_earthquake"
    os.makedirs(base_dir, exist_ok=True)
    
    print(f"Generating simulated earthquake data in {base_dir}...")
    
    for i in range(1, 6):
        file_path = os.path.join(base_dir, f"class_4_{i}_earthquake_simulated.json")
        signal = generate_earthquake_signal(num_samples=60)
        
        with open(file_path, 'w') as f:
            json.dump(signal, f, indent=4)
            
        print(f"Created {file_path} with {len(signal)} readings.")
        
if __name__ == "__main__":
    main()
