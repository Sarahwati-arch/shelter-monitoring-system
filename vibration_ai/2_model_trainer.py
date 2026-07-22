import os
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    features_X_path = os.path.join(base_dir, "features_X.npy")
    features_y_path = os.path.join(base_dir, "features_y.npy")
    features_source_path = os.path.join(base_dir, "features_source.npy")
    models_dir = os.path.join(base_dir, "models")
    
    if not os.path.exists(features_X_path) or not os.path.exists(features_y_path) or not os.path.exists(features_source_path):
        print("Error: Extracted features not found.")
        return

    print("Loading datasets...")
    X = np.load(features_X_path)
    y = np.load(features_y_path)
    sources = np.load(features_source_path)
    print(f"Data shape: X={X.shape}, y={y.shape}, sources={sources.shape}")

    # Create combined stratification key
    y_strat = [f"{lbl}_{src}" for lbl, src in zip(y, sources)]
    
    # Check minimum samples per stratum
    unique_strat, counts = np.unique(y_strat, return_counts=True)
    if any(c < 2 for c in counts):
        print("Warning: Some label+source combinations have fewer than 2 samples. Falling back to stratifying by label only.")
        stratify_key = y
    else:
        stratify_key = y_strat

    print("Splitting data...")
    X_train, X_test, y_train, y_test, src_train, src_test = train_test_split(
        X, y, sources, test_size=0.2, stratify=stratify_key, random_state=42
    )
    
    # Train RandomForestClassifier
    # (No blanket scaling since per-source raw signal normalization was applied)
    print("Training RandomForest model...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Predict on test data
    y_pred = model.predict(X_test)
    
    # Calculate performance metrics
    acc = accuracy_score(y_test, y_pred)
    clf_report = classification_report(y_test, y_pred, zero_division=0)
    conf_matrix = confusion_matrix(y_test, y_pred)
    
    # Evaluate per source
    unique_sources = np.unique(sources)
    source_reports = []
    for src in unique_sources:
        idx = (src_test == src)
        if np.sum(idx) > 0:
            src_acc = accuracy_score(y_test[idx], y_pred[idx])
            source_reports.append(f"Accuracy on {src} samples: {src_acc:.4f} ({np.sum(idx)} samples)")
        else:
            source_reports.append(f"Accuracy on {src} samples: N/A (0 samples in test set)")
            
    # Generate report text
    report_text = f"=== EVALUATION REPORT ===\n"
    report_text += f"Overall Accuracy: {acc:.4f}\n\n"
    report_text += "Per-Source Accuracy:\n"
    report_text += "\n".join(source_reports) + "\n\n"
    report_text += f"Classification Report (includes per-class recall):\n{clf_report}\n"
    report_text += f"Confusion Matrix:\n{conf_matrix}\n"
    print(report_text)
    
    if acc < 0.85:
        print("\nWARNING: Model accuracy is below 85% threshold. Tuning required.\n")
    
    # Export model and report
    model_out_path = os.path.join(models_dir, "vibration_classifier.pkl")
    report_out_path = os.path.join(models_dir, "evaluation_report.txt")
    
    joblib.dump(model, model_out_path)
    print(f"Model saved to {model_out_path}")
    
    with open(report_out_path, "w") as f:
        f.write(report_text)
    print(f"Evaluation report saved to {report_out_path}")

if __name__ == "__main__":
    main()
