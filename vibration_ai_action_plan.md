# Vibration AI Pipeline - Prioritized Action Plan

Here is a comprehensive, prioritized action plan to fix the Vibration AI pipeline based on the audit summary and the current codebase.

---

## 1. Prioritized Checklist

Based on the impact on model accuracy, robustness, and ability to run the pipeline at all, here is the ranked checklist:

| Priority | Issue | Why it is important | Recommended Solution | Expected Impact | Difficulty |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Critical** | **1. Base directory path bug** | The extraction script (`1_feature_extractor.py`) fails to find the dataset folders. As a result, no training data is generated (`features_X.npy` is empty). The model is completely untrained. | Update `base_dir` in `1_feature_extractor.py` to point to the `models/` directory where the data actually lives. | **Massive.** Unblocks the entire ML pipeline, allowing a model to actually be trained on real data. | Easy |
| **Critical** | **2. Invalid "JSON" file formats** | The real-world data files (like `class_0_1_normal_ac_without_ac.json.json`) are plain text logs, not valid JSON. `json.load()` will crash the pipeline. | Write a custom Python parser to extract the `accel_x`, `accel_y`, `accel_z` values from the log text and convert them into standard JSON arrays. | **High.** Prevents pipeline crashes and allows real-world data to be used. | Medium |
| **High** | **3. Real-world JSON data ignored** | `1_feature_extractor.py` only searches for `.wav` files. Even if the JSON files were valid, they are currently silently skipped. | Add a new function in `1_feature_extractor.py` to recursively parse `.json` files and extract the same 14 features from the raw acceleration arrays. | **High.** Ingests the real-world sensor data into the training set, closing the gap between lab data and real deployments. | Medium |
| **High** | **4. Severely sparse real-world data** | 16 out of 19 real-world files are 0 bytes. Three classes (Sabotage, Vehicle, Earthquake) have absolutely zero real-world examples. | Discard the 0-byte files and manually record new ESP32 sensor data for the missing classes. | **High.** Ensures the model can recognize actual physical events rather than just audio `.wav` representations. | Hard (Time-consuming) |
| **Medium** | **5. Earthquake class domain mismatch** | The `class_4_earthquake` JSON uses pre-extracted acoustic-emission features (like `hurst_exponent_rs`), whereas your system calculates 14 mechanical vibration features (ZCR, RMS). | Exclude the lab-based Earthquake JSON for now. Replace it entirely with raw ESP32 acceleration data generated via `simulator_earthquake.py`. | **Medium.** Prevents the model from learning a completely different domain/statistical fingerprint, preventing garbage predictions. | Medium |

---

## 2. Implementation Roadmap

To systematically resolve these issues without causing regression, follow this phased approach:

### **Phase 1 – Critical Fixes (Unblocking the Pipeline)**
* **Goal:** Get the `1_feature_extractor.py` script to successfully run from start to finish without silently failing or producing `(0,)` shape arrays.
* **Why first:** Until the script can find folders and parse files without crashing, no further ML work can be done.

### **Phase 2 – Dataset Parsing & Expansion**
* **Goal:** Ensure the pipeline can actually read the `.json.json` text logs and correctly extract the 14 features (ZCR, RMS, etc.) from them.
* **Why second:** Once the pathing is fixed, the pipeline needs to be able to ingest the new data format before you spend time physically recording more of it.

### **Phase 3 – Dataset Collection (Filling the Gaps)**
* **Goal:** Physically record the missing real-world data for Sabotage, Vehicle, and Earthquake using the actual ESP32 sensors.
* **Why third:** With the pipeline ready to ingest JSON, you can confidently record new data and immediately test if the pipeline processes it correctly.

### **Phase 4 – Validation and Testing**
* **Goal:** Retrain the model on the newly populated dataset and evaluate the confusion matrix, paying special attention to the Earthquake class.
* **Why fourth:** You can only evaluate the true accuracy of the pipeline once real-world data for all 5 classes is present.

---

## 3. Actionable Tasks

Here are the concrete steps to execute the roadmap:

### Task 1: Fix `base_dir` pathing in `1_feature_extractor.py`
* **Affected File:** `vibration_ai/1_feature_extractor.py` (around line 108).
* **Action:** Change the script so it looks inside the `models/` directory for the dataset folders. 
  ```python
  # Old: base_dir = os.path.dirname(os.path.abspath(__file__))
  # New:
  current_dir = os.path.dirname(os.path.abspath(__file__))
  models_dir = os.path.join(current_dir, "models")
  # Use models_dir for folder lookups
  ```
* **Verify:** Run `python 1_feature_extractor.py`. The printed shape of `X_all` should no longer be `(0,)`.

### Task 2: Fix the invalid `.json.json` log formats
* **Affected Files:** All files inside `models/real_life_datasets/`.
* **Action:** Create a one-off script called `format_logs_to_json.py`. This script should:
  1. Open the `.json.json` text files.
  2. Parse the lines using regex or string splitting to extract `accel_x`, `accel_y`, and `accel_z` floats.
  3. Calculate the magnitude: `sqrt(x^2 + y^2 + z^2)`.
  4. Save the sequence of magnitudes into a clean, valid JSON array: `[0.05, 0.08, 0.12, ...]`.
  5. Delete the old `.json.json` text logs.

### Task 3: Add JSON handling to `1_feature_extractor.py`
* **Affected File:** `vibration_ai/1_feature_extractor.py`.
* **Action:** 
  1. Create a new function `extract_from_json_folders(base_dir, folders)`.
  2. Have it iterate through `.json` files, run `json.load()`, and pass the array of magnitudes to the existing `extract_features_from_signal(signal)` function.
  3. Append the results to `X_real_json` and `y_real_json` in the `__main__` block.

### Task 4: Record missing real-world data
* **Action:** 
  1. Delete the 16 empty (0-byte) files in the `real_life_datasets` folders.
  2. Boot up your ESP32 hardware (or use `simulator_earthquake.py`).
  3. Simulate Sabotage (e.g., hitting the sensor mount), Vehicles (e.g., placing the sensor near a heavy engine), and Earthquakes (using the simulator or shaker table).
  4. Save this new data directly in the clean JSON format created in Task 2.

### Task 5: Handle the Earthquake domain mismatch
* **Affected File:** `1_feature_extractor.py` (specifically `process_earthquake_json`).
* **Action:** Comment out or remove the call to `process_earthquake_json()`. The pre-computed features (`hurst_exponent`, etc.) are incompatible with your real-time 14-feature extraction (`mqtt_to_supabase.py`). Rely strictly on the `.wav` audio files and the new simulated JSON data for the Earthquake class.

---

## 4. Success Criteria

For each improvement, here is how to confirm success:

1. **Pathing Fix:** 
   * **Confirmation:** Running `1_feature_extractor.py` results in a console output indicating `X_all` has a shape greater than 0 (e.g., `X=(160, 14)`).
2. **Invalid JSON Fix:** 
   * **Confirmation:** Opening the files in VSCode shows valid JSON syntax highlighting, and `json.load()` does not throw a `JSONDecodeError`.
3. **JSON Ingestion:** 
   * **Confirmation:** The total row count of `X_all` increases exactly by the number of valid JSON files present in the `real_life_datasets` directory.
4. **Data Sparsity Fixed:** 
   * **Confirmation:** All 5 classes in `real_life_datasets` have at least 5 non-zero-byte files.
   * **Metric:** `2_model_trainer.py` should show improved **Recall** and **F1-score** across all classes, specifically Sabotage and Vehicle, since they are no longer relying purely on synthetic/audio data.
5. **Earthquake Domain Alignment:** 
   * **Confirmation:** The `confusion_matrix` generated by `2_model_trainer.py` does not show 100% accuracy for class 4 (Earthquake). (100% accuracy usually indicates data leakage or domain mismatch where the model just learned a completely different data shape rather than actual vibration patterns).

---

## 5. Final Summary

### Top 5 Highest-Impact Improvements (Do These First):
1. Fix the `base_dir` bug in `1_feature_extractor.py` (Critical blocker).
2. Convert the text logs to valid JSON format.
3. Write the JSON-ingestion logic in the feature extractor.
4. Exclude the incompatible pre-extracted Earthquake features (`intermediate_train...json`).
5. Record real ESP32 data for Sabotage and Vehicle classes.

### Postponable Improvements:
* Tuning the `RandomForestClassifier` hyperparameters (e.g., `n_estimators`, tree depth). Do not tune the model until you have actual, valid real-world data flowing through the pipeline.
* Optimizing inference time (the 14-feature extraction is fast enough for now; focus on accuracy first).

### Dependencies:
* **Task 2 MUST be completed before Task 3.** You cannot write a JSON ingestion script if the files are not valid JSON.
* **Task 1, 2, and 3 MUST be completed before Task 4.** Do not waste time recording physical data until you have proven that your pipeline can successfully extract features from a single valid JSON file.
