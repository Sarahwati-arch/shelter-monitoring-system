import os
import json
import random
import numpy as np
from scipy import signal as scipy_signal

def time_stretch(signal_arr, stretch_factor):
    """
    Stretch or compress the signal in time by the stretch_factor.
    """
    target_length = int(len(signal_arr) * stretch_factor)
    if target_length <= 0:
        return signal_arr
    return scipy_signal.resample(signal_arr, target_length)

def apply_augmentations(signal_arr):
    """
    Applies realistic physical augmentations to a vibration signal array.
    """
    aug_signal = np.copy(signal_arr)
    
    # 1. Mild time-stretching (±5-10%)
    # Randomly choose whether to stretch or compress
    factor = 1.0 + random.uniform(-0.10, 0.10)
    # Ensure it's outside the -0.05 to 0.05 range to actually have an effect
    if -0.05 < (factor - 1.0) < 0: factor -= 0.05
    if 0 < (factor - 1.0) < 0.05: factor += 0.05
    
    aug_signal = time_stretch(aug_signal, factor)
    
    # 2. Small amplitude scaling (±10-15%)
    # Preserves relative magnitude across classes without min-max normalization
    scale_factor = 1.0 + random.uniform(-0.15, 0.15)
    # Ensure we actually scale a bit
    if -0.10 < (scale_factor - 1.0) < 0: scale_factor -= 0.05
    if 0 < (scale_factor - 1.0) < 0.10: scale_factor += 0.05
        
    aug_signal = aug_signal * scale_factor
    
    # 3. Small time-shifts
    # Shift up to 5% of the signal length
    max_shift = max(1, int(len(aug_signal) * 0.05))
    shift_amount = random.randint(-max_shift, max_shift)
    aug_signal = np.roll(aug_signal, shift_amount)
    
    # 4. Light realistic sensor noise
    # Gaussian noise proportional to the original signal's standard deviation (1% to 5%)
    std_dev = np.std(aug_signal)
    if std_dev > 0:
        noise_level = random.uniform(0.01, 0.05)
        noise = np.random.normal(0, std_dev * noise_level, len(aug_signal))
        aug_signal = aug_signal + noise
        
    return aug_signal

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    datasets_dir = os.path.join(base_dir, "models", "real_life_datasets")
    
    # Ensure directory exists
    if not os.path.exists(datasets_dir):
        print(f"Error: Directory not found - {datasets_dir}")
        return
        
    class_folders = [d for d in os.listdir(datasets_dir) if os.path.isdir(os.path.join(datasets_dir, d)) and d.startswith("class_")]
    
    total_generated = 0
    total_originals = 0
    generated_per_class = {}
    
    print("Starting augmentation process...")
    
    for folder in class_folders:
        folder_path = os.path.join(datasets_dir, folder)
        
        # Find all original json files (not synthetic)
        all_files = os.listdir(folder_path)
        original_files = [f for f in all_files if f.endswith('.json') and 'synthetic' not in f]
        total_originals += len(original_files)
        
        num_originals = len(original_files)
        if num_originals == 0:
            print(f"No original JSON files found in {folder}. Skipping.")
            continue
            
        generated_per_class[folder] = 0
        
        # Count existing synthetics to avoid overwriting
        existing_synthetics = [f for f in all_files if 'synthetic' in f]
        start_idx = len(existing_synthetics)
        
        # Target is 20 MORE synthetic files per class.
        target_synthetics = 20
        augmentations_per_file = (target_synthetics // num_originals) + 1
        
        current_synthetic_count = 0
        
        for orig_file in original_files:
            orig_path = os.path.join(folder_path, orig_file)
            
            try:
                with open(orig_path, 'r') as f:
                    signal_data = json.load(f)
                    
                if not isinstance(signal_data, list):
                    print(f"Warning: {orig_file} does not contain a JSON list. Skipping.")
                    continue
                    
                signal_arr = np.array(signal_data, dtype=float)
                
                # Generate variations
                for i in range(augmentations_per_file):
                    if current_synthetic_count >= target_synthetics:
                        break
                        
                    aug_signal = apply_augmentations(signal_arr)
                    
                    # Ensure original JSON schema (list of floats)
                    aug_list = aug_signal.tolist()
                    
                    class_name = folder.split('_', 2)[-1] if folder.count('_') >= 2 else folder
                    syn_filename = f"{class_name}_synthetic_{start_idx + current_synthetic_count + 1}.json"
                    syn_path = os.path.join(folder_path, syn_filename)
                    
                    # Avoid overwriting original files
                    if not os.path.exists(syn_path) or 'synthetic' in syn_path:
                        with open(syn_path, 'w') as f:
                            json.dump(aug_list, f, indent=4)
                            
                        current_synthetic_count += 1
                        generated_per_class[folder] += 1
                        total_generated += 1
                        
            except Exception as e:
                print(f"Error processing {orig_file}: {e}")
                
    print("\n" + "="*40)
    print("AUGMENTATION SUMMARY")
    print("="*40)
    print(f"Total original files preserved: {total_originals}")
    print(f"Total synthetic files generated: {total_generated}")
    print("-" * 40)
    for cls, count in generated_per_class.items():
        print(f"{cls}: generated {count} synthetic files")
    print("="*40)
    print("All synthetic files share the exact same JSON schema as the originals (list of floats).")
    print("No per-sample min-max normalization was applied during this augmentation.")

if __name__ == "__main__":
    main()
