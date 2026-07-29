import os
import json
import numpy as np

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    datasets_dir = os.path.join(base_dir, "models", "real_life_datasets")
    
    class_folders = sorted([d for d in os.listdir(datasets_dir) if os.path.isdir(os.path.join(datasets_dir, d)) and d.startswith("class_")])
    
    print("==================================================")
    print("           REAL-LIFE DATASET ANALYSIS             ")
    print("==================================================\n")
    
    total_originals = 0
    total_synthetics = 0
    
    class_stats = {}

    for folder in class_folders:
        folder_path = os.path.join(datasets_dir, folder)
        files = os.listdir(folder_path)
        
        originals = [f for f in files if f.endswith('.json') and 'synthetic' not in f]
        synthetics = [f for f in files if f.endswith('.json') and 'synthetic' in f]
        
        total_originals += len(originals)
        total_synthetics += len(synthetics)
        
        print(f"[{folder}]")
        print(f"  - Original Files : {len(originals)}")
        print(f"  - Synthetic Files: {len(synthetics)}")
        
        # Analyze originals
        all_means = []
        all_ranges = []
        all_vars = []
        
        for orig in originals:
            try:
                with open(os.path.join(folder_path, orig), 'r') as f:
                    data = json.load(f)
                sig = np.array(data, dtype=float)
                if len(sig) > 0:
                    all_means.append(np.mean(sig))
                    all_ranges.append(np.ptp(sig))
                    all_vars.append(np.var(sig))
            except Exception as e:
                pass
                
        if all_means:
            avg_mean = np.mean(all_means)
            avg_range = np.mean(all_ranges)
            avg_var = np.mean(all_vars)
            class_stats[folder] = {
                "mean": avg_mean,
                "range": avg_range,
                "var": avg_var
            }
            print(f"  -> Avg Amplitude : {avg_mean:.4f} g")
            print(f"  -> Avg Peak-Peak : {avg_range:.4f} g")
            print(f"  -> Avg Variance  : {avg_var:.6f}")
        print()

    print("==================================================")
    print("                   CONCLUSION                     ")
    print("==================================================")
    print(f"Total Original Recordings: {total_originals}")
    print(f"Total Synthetic Augmented: {total_synthetics}")
    print(f"Total Dataset Size: {total_originals + total_synthetics} files\n")
    
    print("Class Separability Analysis:")
    for cls, stats in class_stats.items():
        print(f"  {cls:<25}: Amp={stats['mean']:.3f}g, Range={stats['range']:.3f}g, Var={stats['var']:.5f}")

if __name__ == "__main__":
    main()
