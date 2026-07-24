import os
import json
import numpy as np

def generate_footstep_signal(num_samples=60):
    # Footsteps are rhythmic sharp spikes.
    signal = np.random.normal(1.0, 0.05, num_samples) # baseline noise around 1.0 (1g)
    
    # Add spikes every ~15 samples
    for i in range(10, num_samples, 15):
        spike_amp = np.random.uniform(1.2, 1.8)
        signal[i] += spike_amp
        if i + 1 < num_samples:
            signal[i+1] += spike_amp * 0.5 # rapid decay
            
    return np.abs(signal).tolist()

def generate_vehicle_signal(num_samples=60):
    # Vehicle is a sustained, lower frequency rumble with an envelope (approaching and leaving)
    t = np.linspace(0, 5, num_samples)
    base_vibration = 0.5 * np.sin(2 * np.pi * 5.0 * t) # 5 Hz engine vibration
    noise = np.random.normal(0, 0.2, num_samples)
    
    # Envelope (approaching and leaving)
    envelope = np.exp(-((t - 2.5)**2) / 2.0)
    
    signal = 1.0 + (np.abs(base_vibration + noise) * envelope)
    return signal.tolist()

def main():
    base_dir = r"d:\shelter-monitoring-system\vibration_ai\models\real_life_datasets"
    
    # 1. Footstep dataset
    footsteps_dir = os.path.join(base_dir, "class_1_foot_steps")
    os.makedirs(footsteps_dir, exist_ok=True)
    
    footstep_file = os.path.join(footsteps_dir, "class_1_dummy_footstep.json")
    with open(footstep_file, 'w') as f:
        json.dump(generate_footstep_signal(), f, indent=4)
    print(f"Created dummy footstep file: {footstep_file}")
    
    # 2. Vehicle datasets
    vehicle_dir = os.path.join(base_dir, "class_3_vehicle")
    os.makedirs(vehicle_dir, exist_ok=True)
    
    for i in range(1, 4):
        vehicle_file = os.path.join(vehicle_dir, f"class_3_dummy_vehicle_{i}.json")
        with open(vehicle_file, 'w') as f:
            json.dump(generate_vehicle_signal(), f, indent=4)
        print(f"Created dummy vehicle file: {vehicle_file}")

if __name__ == "__main__":
    main()
