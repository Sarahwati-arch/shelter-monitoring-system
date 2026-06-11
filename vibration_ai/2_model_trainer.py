import os
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    features_X_path = os.path.join(base_dir, "features_X.npy")
    features_y_path = os.path.join(base_dir, "features_y.npy")
    models_dir = os.path.join(base_dir, "models")
    
    if not os.path.exists(features_X_path) or not os.path.exists(features_y_path):
        print("Error: features_X.npy or features_y.npy not found.")
        return

    print("Loading datasets...")
    X = np.load(features_X_path)
    y = np.load(features_y_path)
    print(f"Data shape: X={X.shape}, y={y.shape}")

    # 3.1 Setup pemisahan data (80:20) dengan stratify=y
    print("Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    
    # 3.2 Inisialisasi dan fit StandardScaler
    print("Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # 3.3 Inisialisasi dan training RandomForestClassifier
    print("Training RandomForest model...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # 3.4 Lakukan prediksi pada data test
    y_pred = model.predict(X_test_scaled)
    
    # 3.5 Hitung metrik performa
    acc = accuracy_score(y_test, y_pred)
    clf_report = classification_report(y_test, y_pred)
    conf_matrix = confusion_matrix(y_test, y_pred)
    
    # Generate report text
    report_text = f"=== EVALUATION REPORT ===\n"
    report_text += f"Accuracy: {acc:.4f}\n\n"
    report_text += f"Classification Report:\n{clf_report}\n"
    report_text += f"Confusion Matrix:\n{conf_matrix}\n"
    print(report_text)
    
    # 3.6 Logika otomatis warning jika akurasi < 85%
    if acc < 0.85:
        print("\nWARNING: Akurasi model < 85%. Pertimbangkan untuk melakukan tuning / hyperparameter adjustment!\n")
        report_text += "\nWARNING: Model accuracy is below 85% threshold. Tuning required.\n"
    
    # 3.7 Ekspor file matang
    model_out_path = os.path.join(models_dir, "vibration_classifier.pkl")
    scaler_out_path = os.path.join(models_dir, "scaler.pkl")
    report_out_path = os.path.join(models_dir, "evaluation_report.txt")
    
    joblib.dump(model, model_out_path)
    print(f"Model saved to {model_out_path}")
    
    joblib.dump(scaler, scaler_out_path)
    print(f"Scaler saved to {scaler_out_path}")
    
    with open(report_out_path, "w") as f:
        f.write(report_text)
    print(f"Evaluation report saved to {report_out_path}")

if __name__ == "__main__":
    main()
