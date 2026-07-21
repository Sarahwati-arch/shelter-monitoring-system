# Vibration AI Module - Technical Code Review and System Walkthrough

This document provides a comprehensive technical code review and system walkthrough of the **Vibration AI** module based on the actual implementation in the codebase.

---

### 1. System Overview
The Vibration AI module is designed to classify the root cause of vibrations detected in shelter structures in real-time. Instead of simply measuring the magnitude of a vibration (which could trigger false alarms from harmless sources), this module uses a machine learning model to categorize the vibration into specific classes (e.g., Normal AC, Footsteps, Sabotage, Vehicle, Earthquake). 

Within the capstone project, this solves the problem of **alert fatigue** and improves the reliability of the monitoring system. It interacts with the edge IoT components via MQTT (receiving streaming accelerometer/gyroscope data) and pushes the intelligent inferences (AI label, confidence, risk level) to a Supabase PostgreSQL database. The frontend dashboard then pulls this enriched data to visually display the structural health and diagnostics.

---

### 2. Project Structure
The AI system is split across two main directories: `vibration_ai/` (offline training) and `bridge/` (real-time inference).

**Directory: `vibration_ai/`** (Used for Training & Evaluation)
* **`1_feature_extractor.py`**: Reads raw `.wav` audio files and `.json` files from dataset folders, slices them into segments, and calculates 14 statistical features using `scipy` and `librosa`. It exports `features_X.npy` and `features_y.npy`. 
* **`2_model_trainer.py`**: Loads the `.npy` feature arrays, splits them (80:20), applies `StandardScaler`, and trains a `RandomForestClassifier`. It evaluates the model (accuracy, confusion matrix) and exports the `.pkl` files to the `models/` directory.
* **`verify_installation.py`**: A simple sanity check script to ensure `scikit-learn` and `librosa` are installed correctly.
* **`models/` (Folder)**: Contains the serialized `vibration_classifier.pkl` (the model), `scaler.pkl` (feature scaler), and an `evaluation_report.txt` used during deployment/inference.

**Directory: `bridge/`** (Used for Deployment & Inference)
* **`mqtt_to_supabase.py`**: The core bridge script. It acts as an MQTT subscriber, buffers real-time sensor data, runs the AI model on the buffered window, calculates the risk, saves the results to Supabase, and triggers Telegram alerts.
* **`simulator_earthquake.py`** (and other simulators): Mock IoT edge devices used to generate artificial sine-wave signals, verify they trigger a specific AI class, and publish them via MQTT for testing.

---

### 3. End-to-End Pipeline
1. **Data Generation:** An ESP32 sensor (or `simulator_earthquake.py`) generates raw 3-axis accelerometer and gyroscope data.
2. **MQTT Publishing:** The edge device publishes JSON payloads to `<device_token>/Accel` and `<device_token>/Gyro` at specific intervals.
3. **MQTT Subscription:** The `mqtt_to_supabase.py` script receives these messages via the `paho-mqtt` client in the `on_message` callback.
4. **Data Synchronization (Buffering):** Because Accel and Gyro arrive on different topics, the script stores them in `_buffers` and waits up to 3 seconds (`PAIR_TIMEOUT`) to pair them based on timestamps.
5. **AI Buffering:** Once paired, the vibration magnitude `sqrt(x^2 + y^2 + z^2)` is appended to an AI specific buffer `_ai_buffers[device_id]`.
6. **Feature Extraction:** Once the buffer reaches exactly 50 samples (`N=50`), `extract_features_from_signal()` calculates the 14 statistical features.
7. **Prediction Pipeline:** The 14 features are scaled (`ai_scaler.transform()`) and passed to `ai_model.predict()` and `predict_proba()` to get the predicted class and confidence.
8. **Confidence & Risk Calculation:** If confidence is `>= 60%`, the `ai_label` is accepted and mapped to a risk level (`low`, `medium`, `high`). If `< 60%`, the system triggers an "AI Fallback" and uses hardcoded magnitude thresholds instead.
9. **Database Update:** The result, including the raw axes, `risk_level`, and a JSON `metadata` object containing the AI inference, is inserted into the Supabase `vibration_data` table.
10. **Notification:** If the risk is Medium or High, an alert is logged in the `alerts` table and a Telegram message is sent via the Bot API (`send_telegram()`).
11. **Dashboard Update:** The React dashboard (`dashboardService.js`) periodically fetches the latest row from `vibration_data` and parses the `metadata` JSON to update the frontend UI.

---

### 4. Data Flow
* **Origin:** Data originates as a JSON string from MQTT (e.g., `{"accel_x": 0.5, "accel_y": 0.1, ...}`).
* **Transformation 1 (Parsing):** Decoded to a Python dictionary in `on_message()`.
* **Transformation 2 (Pairing):** Sent to `try_insert()`, combining Accel and Gyro dictionaries.
* **Transformation 3 (Magnitude):** Processed in `insert_vibration()`, collapsing the 3-axis acceleration into a single `magnitude` float.
* **Transformation 4 (Feature Vector):** A list of 50 magnitude floats is transformed into a 14-element feature vector list in `extract_features_from_signal()`.
* **Transformation 5 (Scaling):** Scaled using `StandardScaler` to match training distribution.
* **Output:** A JSON structure stored in Supabase:
  ```json
  {
    "risk_level": "high",
    "metadata": {
      "ai_label": "Earthquake", 
      "ai_confidence": 0.92, 
      "ai_fallback": false, 
      "ai_window_size": 50
    }
  }
  ```

---

### 5. Feature Engineering
The system extracts exactly **14 features** from a 1D magnitude array of length 50. 
* **Libraries:** Feature extraction relies heavily on `numpy` (basic stats), `scipy.stats` (advanced distributions), and `librosa` (audio-based features).
* **Location:** Extraction logic lives in `extract_features_from_signal()` which is identical in both `1_feature_extractor.py` and `mqtt_to_supabase.py`.
* **Features Extracted:** 
  1. Zero Crossing Rate (ZCR) 
  2. Mean 
  3. Median Absolute Deviation (MAD) 
  4. Skewness 
  5. Standard Deviation 
  6. Kurtosis 
  7. Crest Factor (Peak / RMS)
  8. Minimum 
  9. Maximum 
  10. Range 
  11. Median 
  12. Interquartile Range (IQR) 
  13. Root Mean Square (RMS) 
  14. Energy
* **Format:** The resulting feature vector is a 1D numerical array/list of shape `(14,)`.
* **Rationale:** Time-domain statistical features are highly effective for classifying mechanical vibrations. ZCR and Crest Factor are particularly sensitive to impulsive, high-frequency impacts (like sabotage or footsteps), while Energy and RMS capture continuous low-frequency vibrations (like AC or earthquakes).

---

### 6. Machine Learning Model
* **Algorithm:** `RandomForestClassifier` with `n_estimators=100` and `random_state=42`.
* **Training:** Trained entirely in `2_model_trainer.py` using supervised learning with a 80/20 train/test split. The dataset includes 5 classes (0: Normal AC, 1: Footsteps, 2: Sabotage, 3: Vehicle, 4: Earthquake).
* **Storage & Loading:** The model and its scaler are exported as `.pkl` files using `joblib`. They are loaded into memory globally at the top of `mqtt_to_supabase.py`.
* **Input/Output:** 
  * Input: A scaled 2D array of shape `(1, 14)` containing the extracted features.
  * Output: Integer class label `[0-4]` (via `predict`) and an array of class probabilities (via `predict_proba`).
* **Confidence Mechanism:** `max_prob = float(np.max(probs))` calculates confidence. If this value falls below `0.60`, the model's prediction is discarded, returning `"Unknown"` and enabling the `ai_fallback` flag.

---

### 7. Code Walkthrough (`mqtt_to_supabase.py`)
1. **Initialization:** The script starts by loading `.env` variables and initializing `ai_model` and `ai_scaler` via `joblib.load()`. Global dictionaries like `_device_cache` and `_buffers` are created.
2. **`main()`:** Instantiates `MQTTClient`, attaches callbacks, and calls `client.loop_forever()`.
3. **`on_message(client, userdata, msg)`:** Runs whenever a message is received. It parses the `topic` to extract the `device_token`.
4. **`resolve_device(token)`:** Queries Supabase to convert the hardware token into a `device_id` and `shelter_id` (cached for 5 minutes).
5. **Buffering (`_get_buffer`)**: It places the payload in `buf["accel"]` or `buf["gyro"]` based on the MQTT topic. 
6. **`try_insert(shelter_id, device_id)`:** Checks if both `accel` and `gyro` are present and less than 3 seconds old (`PAIR_TIMEOUT`). If so, it merges them and calls `insert_vibration()`.
7. **`insert_vibration(data, shelter_id, device_id)`:** 
   * Calculates conventional risk using `calc_risk_level()`.
   * Appends magnitude to `_ai_buffers`.
   * Once length hits 50, triggers `extract_features_from_signal()`.
   * Scales features and runs `ai_model.predict()`.
   * Assembles the final DB row and `metadata` dictionary.
   * Runs `supabase.table("vibration_data").insert(row)`.
   * Uses `load_thresholds()` to check limits, creating an alert row in Supabase and calling `send_telegram()` if breached.

---

### 8. MQTT Integration
* **Broker:** Configured via `MQTT_BROKER` (defaults to `broker.emqx.io`).
* **Topics (Subscriber):** The bridge subscribes to wildcard topics: `+/Accel`, `+/Gyro`, and `+/Temp`.
* **Topics (Publisher):** The bridge also acts as a publisher. Every 60 seconds, it sends dynamic configuration payloads to `<token>/Config` using `publish_device_configs()`.
* **Payload Format:** JSON, e.g., `{"accel_x": 0.1, "accel_y": 0.0, "accel_z": 0.0}`.
* **Buffering Mechanism:** A global dictionary `_buffers` tracks the latest payload and timestamp for each device ID to combat network desynchronization between separate Accel and Gyro topic streams.

---

### 9. Database Integration
* **Database Platform:** Supabase (PostgreSQL).
* **Primary Tables Involved:**
  * `devices`: Resolved via token caching to identify active sensors.
  * `thresholds`: Polled and cached via `load_thresholds()` to retrieve dynamic vibration/temp limits (`vibration_warning`, `vibration_critical`).
  * `vibration_data`: The main destination. Stores raw X/Y/Z data, the computed `risk_level`, and an all-important `metadata` JSONB column holding the AI inference output.
  * `alerts`: Written to if the risk level escalates.
  * `users`: Fetched via `get_telegram_chat_ids()` to send alerts.

---

### 10. Dashboard Integration
* **Backend Mechanism:** There is no dedicated backend API; the React frontend queries Supabase directly using the JS client inside `frontend/src/services/dashboardService.js`.
* **Fetching Data:** The `getLatestReading()` function fetches the most recent row from `vibration_data` and extracts the `vibration_metadata` object.
* **Frontend Component:** `frontend/src/components/dashboard/AIVibrationCard.jsx` consumes this metadata. 
* **UI Updates:** The component conditionally renders "Fallback Active" (Amber) or "AI Active" (Emerald) based on `latestMetadata.ai_fallback`. It dynamically updates a progress bar using inline styles to represent `ai_confidence`.

---

### 11. Configuration Files
* **`bridge/.env`:** Controls infrastructure connections. 
  * `MQTT_BROKER` & `MQTT_PORT`: MQTT server routing.
  * `SUPABASE_URL` & `SUPABASE_SERVICE_KEY`: DB auth. Must use `service_role` to bypass RLS policies.
  * `BOT_TOKEN`: Telegram bot token for alerting.
* **Database `thresholds` table:** Acts as a remote config file. 
  * Modifying `vibration_interval_ms` updates the hardware polling rate via MQTT Config topics.
  * Modifying `vibration_critical` alters the boundaries of the conventional risk fallback mechanism.

---

### 12. Libraries and Dependencies
* **`librosa`**: Required exclusively to compute the Zero Crossing Rate (ZCR). It is a heavyweight audio library, used here because vibration data behaves similarly to audio signals.
* **`scikit-learn`**: Provides the core ML pipeline: `StandardScaler` for normalization and `RandomForestClassifier` for inference.
* **`numpy` & `scipy`**: Used heavily in `extract_features_from_signal()` to perform fast mathematical aggregations (RMS, Kurtosis, Skewness, MAD) over the vibration arrays.
* **`paho-mqtt`**: Handles all TCP/MQTT socket connections, subscriptions, and connection loss recoveries.
* **`supabase`**: The official Python client for executing REST queries against the PostgreSQL database.
* **`joblib`**: A highly efficient serialization library used to load the pre-trained Random Forest model faster than standard `pickle`.

---

### 13. Error Handling
* **Missing AI Model:** If `.pkl` files are missing on boot, the script sets `ai_model = None` and prints a warning, gracefully degrading into fallback mode rather than crashing.
* **Prediction Failures:** The actual inference is wrapped in a `try/except Exception as e:` block. If feature extraction or prediction crashes (e.g. invalid `NaN` signal), it logs the error, flags `ai_fallback = True`, and defaults to threshold-based risk calculation.
* **MQTT Failures:** The `paho-mqtt` client utilizes `loop_forever()` which handles automatic reconnections upon network drops (`on_disconnect`).
* **Database Desync:** The `try_insert()` pairing mechanism discards data if an Accel or Gyro reading is older than 3 seconds, preventing stale data from causing inaccurate magnitude calculations.

---

### 14. Performance Considerations
* **Bottleneck (Synchronous Processing):** The `on_message` callback blocks the MQTT network thread. Running `extract_features_from_signal()` (especially `librosa.zero_crossing_rate`) and Random Forest inference synchronously inside this callback could cause MQTT message queue backups if hundreds of devices send data simultaneously.
* **Memory Leaks:** The `_ai_buffers` and `_buffers` dictionaries store data based on `device_id`. If a device ID suddenly goes offline permanently, its partial buffer will remain in memory forever. A cleanup job/TTL for inactive devices is missing.
* **Optimizations Made:** The implementation heavily utilizes caching (`_device_cache_ttl = 300s`, `_threshold_cache_ttl = 300s`) to drastically reduce the number of HTTP requests made to Supabase per MQTT message.

---

### 15. Summary
* **Architecture:** A hybrid edge-cloud setup. Edge devices handle high-frequency data collection, while a cloud-hosted Python bridge handles the heavy machine learning inference and database persistence, feeding a serverless React frontend.
* **Strengths:** Excellent graceful degradation. The system seamlessly falls back to standard thresholds if the AI confidence drops or the model crashes. Caching mechanisms prevent DB rate-limiting.
* **Weaknesses:** Synchronous ML inference blocks the MQTT receiver thread. `librosa` is an extremely heavy dependency just to calculate Zero-Crossing Rate. 
* **Future Improvements:** 
  1. Move the ML inference into an asynchronous task queue (e.g., Celery/Redis or Python `asyncio`).
  2. Implement a memory cleanup routine for stale `_ai_buffers`.
  3. Replace `librosa.feature.zero_crossing_rate` with a simple native `numpy` implementation `((signal[:-1] * signal[1:]) < 0).sum()` to remove the massive `librosa` dependency footprint.
