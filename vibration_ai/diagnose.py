import os
import json
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.metrics import confusion_matrix
import pandas as pd

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    features_X_path = os.path.join(base_dir, "features_X.npy")
    features_y_path = os.path.join(base_dir, "features_y.npy")
    
    X = np.load(features_X_path)
    y = np.load(features_y_path)
    
    feature_names = [
        "ZCR", "Mean", "MAD", "Skewness", "STD", "Kurtosis", "CrestFactor",
        "Min", "Max", "Range", "Median", "IQR", "RMS", "Energy"
    ]
    
    sabotage_mask = (y == 2)
    vehicle_mask = (y == 3)
    
    X_sab = X[sabotage_mask]
    X_veh = X[vehicle_mask]
    
    print("=== 1. FEATURE COMPARISON (SABOTAGE vs VEHICLE) ===")
    print(f"{'Feature':<15} | {'Sabotage (Mean ± STD)':<25} | {'Vehicle (Mean ± STD)':<25} | {'Diff (Abs)':<10}")
    print("-" * 85)
    for i, name in enumerate(feature_names):
        m_sab = np.mean(X_sab[:, i])
        s_sab = np.std(X_sab[:, i])
        m_veh = np.mean(X_veh[:, i])
        s_veh = np.std(X_veh[:, i])
        diff = abs(m_sab - m_veh)
        print(f"{name:<15} | {m_sab:>9.4f} ± {s_sab:<9.4f} | {m_veh:>9.4f} ± {s_veh:<9.4f} | {diff:>9.4f}")
    
    print("\n=== 2. RAW DATA (First 10 points) ===")
    datasets_dir = os.path.join(base_dir, "models", "real_life_datasets")
    for cls_name in ["class_2_sabotase_maint", "class_3_vehicle"]:
        folder = os.path.join(datasets_dir, cls_name)
        if not os.path.isdir(folder): continue
        print(f"\n[{cls_name}]")
        files = [f for f in os.listdir(folder) if f.endswith('.json') and 'synthetic' not in f][:5]
        for f in files:
            with open(os.path.join(folder, f), 'r') as file:
                data = json.load(file)
                sig = np.array(data, dtype=float)[:10]
                print(f"  {f}: {np.round(sig, 4)}")
                
    print("\n=== 3. LEAVE-ONE-OUT CROSS VALIDATION ===")
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    y_pred_cv = cross_val_predict(rf, X, y, cv=5)
    cm = confusion_matrix(y, y_pred_cv)
    print("Full Confusion Matrix (Classes 0-4):")
    print(cm)
    print("\nSpecific Sabotage vs Vehicle Confusion:")
    print(f"  Sabotage predicted as Vehicle: {cm[2, 3]} times")
    print(f"  Vehicle predicted as Sabotage: {cm[3, 2]} times")
    
    print("\n=== 5. FEATURE IMPORTANCES ===")
    rf.fit(X, y)
    importances = rf.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    for idx in sorted_idx:
        print(f"  {feature_names[idx]:<15}: {importances[idx]:.4f}")

if __name__ == "__main__":
    main()
