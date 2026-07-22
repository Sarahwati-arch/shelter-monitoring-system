# Face Recognition Module - Technical Summary

## 1. Overview
*   **Purpose**: The Face Recognition module identifies individuals entering the shelter.
*   **Problem it solves**: Prevents unauthorized access and automates logging of shelter officers and staff, replacing manual checks.
*   **High-level architecture**: A hybrid edge-cloud pipeline where edge devices (Raspberry Pi/laptop cameras) detect and crop faces locally (MTCNN), extract embeddings, and recognize individuals via ArcFace and an aggregated voting strategy. The system captures evidence and syncs unknown face alerts to a Supabase backend.
*   **Integration**: Fits into the broader Shelter Monitoring System capstone project by ensuring physical security and identity verification.

## 2. Project Structure
The `face_recognition` directory handles all related functionality.

*   **`src/stage1/stage1_face_detect.py`**:
    *   **Purpose**: Face detection, cropping, and alignment.
    *   **Used for**: Inference, utilities.
    *   **Main classes/functions**: `detect_faces`, `align_face`, `crop_face`, `annotate_frame`, `process_directory`, `tune_threshold`.
    *   **Interactions**: Imported by `webcam_test.py`. Uses MTCNN.
*   **`src/stage1/webcam_test.py`**:
    *   **Purpose**: Live testing using a laptop webcam.
    *   **Used for**: Inference, deployment (testing).
    *   **Main classes/functions**: `run`, `process_frame`, `draw_hud`, `load_recognizer`.
    *   **Interactions**: Imports `stage1_face_detect.py`, `stage2_face_recognition.py`, `supabase_uploader.py`.
*   **`src/stage2/stage2_face_recognition.py`**:
    *   **Purpose**: Generating ArcFace embeddings and matching identities.
    *   **Used for**: Training (enrollment), Inference.
    *   **Main classes/functions**: `FaceRecognizer`, `identify`, `enroll_all`, `enroll_single_image`, `enroll_multiple_images`, `_compute_adaptive_thresholds`, `run_diagnostics`.
    *   **Interactions**: Used by `webcam_test.py`, `sync_employees.py`. Utilizes `embeddings.npy` and `employee_metadata.json`.
*   **`src/sync_employees.py`**:
    *   **Purpose**: Edge synchronization of new employee profiles from the cloud.
    *   **Used for**: Enrollment, deployment.
    *   **Main classes/functions**: `sync_new_employees`.
    *   **Interactions**: Communicates with Supabase to download photos, calls `enroll_multiple_images` to update local embeddings.
*   **`src/pi_camera/pi_camera_test.py`**:
    *   **Purpose**: Live inference on a Raspberry Pi camera.
    *   **Used for**: Deployment, inference.
    *   **Main classes/functions**: `run_pi`.
    *   **Interactions**: Uses `Picamera2`, imports `process_frame` from `webcam_test.py`.
*   **`src/pi_camera/supabase_uploader.py`**:
    *   **Purpose**: Uploading intrusion evidence to the cloud and creating alert records.
    *   **Used for**: Deployment, alerts.
    *   **Main classes/functions**: `upload_snapshot_and_alert`.
    *   **Interactions**: Talks to Supabase `cctv_evidence` storage and `alerts` table.
*   **`scripts/migrate_faces_to_supabase.py`**:
    *   **Purpose**: One-off script to migrate locally enrolled faces to the Supabase cloud.
    *   **Used for**: Utilities.
    *   **Main classes/functions**: `migrate`.
*   **`models/`**:
    *   **Purpose**: Stores `embeddings.npy` and `employee_metadata.json`. Used for Inference.
*   **`data/faces/`**:
    *   **Purpose**: Local storage of raw enrollment images. Used for Training/Enrollment.
*   **`logs/`**:
    *   **Purpose**: Stores snapshot images, session JSON logs, and threshold tuning logs. Used for debugging and evidence.

## 3. End-to-End Pipeline
1.  **Camera initialization**:
    *   **File**: `pi_camera_test.py` or `webcam_test.py`
    *   **Function**: `run_pi()` or `run()`
    *   **Input**: Camera index or Picamera2 config.
2.  **Frame acquisition**:
    *   **File**: `pi_camera_test.py` or `webcam_test.py`
    *   **Function**: `picam2.capture_array()` or `cap.read()`
    *   **Output**: RGB/BGR frame (`numpy.ndarray`).
3.  **Face detection**:
    *   **File**: `stage1_face_detect.py`
    *   **Function**: `MTCNN.detect_faces()`
    *   **Input**: Resized RGB frame.
    *   **Output**: List of bounding boxes, confidence scores, and 5-point landmarks.
4.  **Face alignment**:
    *   **File**: `stage1_face_detect.py`
    *   **Function**: `align_face()`
    *   **Input**: RGB frame, eye keypoints.
    *   **Output**: Rotated/aligned RGB frame.
5.  **Face cropping**:
    *   **File**: `stage1_face_detect.py`
    *   **Function**: `crop_face()`
    *   **Input**: Aligned RGB frame, bounding box, `PADDING`.
    *   **Output**: Cropped RGB face numpy array.
6.  **Embedding generation**:
    *   **File**: `stage2_face_recognition.py`
    *   **Function**: `_get_embedding_from_array()`
    *   **Input**: Cropped face RGB array.
    *   **Output**: 512-D ArcFace embedding (`numpy.ndarray`).
7.  **Database loading**:
    *   **File**: `stage2_face_recognition.py`
    *   **Function**: `FaceRecognizer.__init__()`
    *   **Input**: `embeddings.npy`, `employee_metadata.json`.
    *   **Output**: In-memory `numpy` matrix and dictionary.
8.  **Similarity calculation**:
    *   **File**: `stage2_face_recognition.py`
    *   **Function**: `FaceRecognizer._aggregate_scores()`
    *   **Input**: Query embedding.
    *   **Output**: Dictionary of aggregated mean cosine similarities per identity.
9.  **Recognition decision**:
    *   **File**: `stage2_face_recognition.py`
    *   **Function**: `FaceRecognizer.identify()`
    *   **Input**: Similarity scores, adaptive thresholds, `MARGIN_MIN`.
    *   **Output**: Final identified name or `"unknown"`.
10. **Unknown face handling & Snapshot capture**:
    *   **File**: `webcam_test.py` / `pi_camera_test.py`
    *   **Function**: Loop logic handling `has_unknown`.
    *   **Input**: `"unknown"` identity.
    *   **Output**: Annotated image saved to local `logs/snapshots/`.
11. **Database & Dashboard update (Cloud)**:
    *   **File**: `supabase_uploader.py`
    *   **Function**: `upload_snapshot_and_alert()`
    *   **Input**: Snapshot filepath, alert metadata.
    *   **Output**: Uploads to Supabase bucket `cctv-evidence` and inserts row into `alerts` table.

## 4. Execution Flow
*   **Entry Point**: `src/pi_camera/pi_camera_test.py` (or `webcam_test.py` for laptops).
*   **Startup**: `run_pi()` executes first. It invokes `load_recognizer()` which instantiates `FaceRecognizer`.
*   **Initialization**: `FaceRecognizer.__init__()` loads `embeddings.npy` and `employee_metadata.json`. `Picamera2` starts streaming.
*   **Main Loop**: An infinite loop `while True:` captures frames.
    *   Calls `process_frame()` (from `webcam_test.py`).
        *   Resizes frame, calls `detector.detect_faces()`.
        *   Iterates through valid faces (`confidence >= 0.80`).
        *   Calls `align_face()` and `crop_face()`.
        *   Calls `FaceRecognizer.identify()`.
            *   Gets embedding via DeepFace.
            *   Calls `_aggregate_scores()` to compute voting similarity.
            *   Applies `adaptive_thresholds` and `MARGIN_MIN` checks.
    *   If `identity == "unknown"`, sets `has_unknown = True`.
*   **Decision Logic**: If `has_unknown` and `cooldown_seconds` (10s) passed, captures a snapshot and spawns a thread to `upload_snapshot_and_alert()`.
*   **Termination Condition**: User presses `Ctrl+C` (KeyboardInterrupt), which stops `picam2`.

## 5. Face Detection
*   **Detection model**: MTCNN (Multi-task Cascaded Convolutional Networks).
*   **Why chosen**: Highly robust and provides essential 5-point facial landmarks (eyes, nose, mouth corners) required for precise face alignment.
*   **Detection confidence threshold**: `0.80` (defined in `stage1_face_detect.py`).
*   **Face alignment process**: Uses `align_face()` to calculate the angle between the left and right eyes and applies a 2D rotation matrix (`cv2.warpAffine`) to horizontally level the face.
*   **Landmark extraction**: Returned natively by MTCNN.
*   **Bounding box generation**: Scaled back from a 640x480 resized image to the original frame dimensions.
*   **Padding**: `25` pixels of symmetric padding added during cropping to capture full facial context.
*   **Image preprocessing**: Frames are converted from BGR to RGB and resized to 640x480 for faster MTCNN inference.

## 6. Face Recognition
*   **Recognition model**: ArcFace (via DeepFace library).
*   **Embedding dimension**: 512 dimensions.
*   **Similarity metric**: Cosine Similarity.
*   **Recognition threshold**: Base `0.45` (`BASE_SIMILARITY_THRESHOLD`).
*   **Adaptive threshold**: Computed dynamically per identity based on intra-class variance: `mean(intra_class) - 2 * std(intra_class)`. Clamped between `0.30` and `0.55`.
*   **Margin logic**: `MARGIN_MIN = 0.08`. The top match must beat the runner-up's similarity score by at least this margin to prevent confusing visually similar people (e.g., Sarah vs. Nanda).
*   **Voting mechanism**: Aggregated Voting. Instead of taking the absolute closest match (1-NN), the system calculates the mean cosine similarity across ALL enrolled photos for a given identity.
*   **Decision rules**: The highest aggregated score wins IF it exceeds the adaptive threshold AND beats the second-highest score by `MARGIN_MIN`. Otherwise, returns `"unknown"`.

## 7. Enrollment Process
*   **How new identities are added**: Can be added locally via `data/faces/<name>/` or fetched from the cloud via `sync_employees.py`.
*   **Dataset structure**: `data/faces/<Name>/<images>`.
*   **Number of images**: Warns if `< 5` photos. Recommends 10-15.
*   **Embedding generation**: `enroll_all()` or `enroll_multiple_images()` iterates through images, calls DeepFace ArcFace model, and stacks embeddings into a numpy array.
*   **Storage format**: Embeddings saved as `models/embeddings.npy` (shape: `N x 512`).
*   **Metadata generation**: Generates `models/employee_metadata.json` which maps row indices of the numpy array to identity names and stores adaptive thresholds.

## 8. Database
*   **Where embeddings are stored**: Locally at `models/embeddings.npy`.
*   **Metadata files**: `models/employee_metadata.json`.
*   **Database tables**: Supabase cloud tables: `employees` (enrollment sync), `alerts` (trigger logs), `cctv_evidence` (snapshot metadata and links).
*   **Loading process**: Loaded into RAM at application startup via `np.load()` and `json.load()` within `FaceRecognizer.__init__()`.

## 9. Snapshot / Alert System
*   **Trigger conditions**: An `"unknown"` face is detected, or no face is detected when one is expected (alert flags). Enforces a 10-second cooldown between Pi camera captures.
*   **Snapshot process**: The `annotated` frame (with bounding boxes) is saved to disk via OpenCV.
*   **File naming**: `unknown_YYYYMMDD_HHMMSS_ffffff.jpg` or `intrusion_YYYYMMDD_HHMMSS_ffffff.jpg`.
*   **Storage location**: Local cache at `logs/snapshots/`. Cloud storage at Supabase bucket `cctv-evidence`.
*   **Dashboard integration**: Pushes to `alerts` and `cctv_evidence` tables, which the React dashboard listens to.
*   **Notification flow**: Upload runs asynchronously in a thread (`threading.Thread`) to prevent camera freeze. Creates a 'critical' alert.

## 10. Integration
*   **Raspberry Pi Camera**: Integrated using `Picamera2` in `pi_camera_test.py`.
*   **Backend / Database**: Supabase (PostgreSQL + Storage) accessed directly from edge nodes via `supabase-py` client in `supabase_uploader.py` and `sync_employees.py`.
*   **Dashboard**: The React dashboard displays the `alerts` and syncs new users to the `employees` table.
*   **Other modules**: Designed as a standalone daemon that communicates via the shared Supabase backend.

## 11. Configuration
*   **Thresholds**:
    *   `CONFIDENCE_THRESHOLD = 0.80` (MTCNN detection confidence).
    *   `PADDING = 25` (Pixels added around face crop).
    *   `BASE_SIMILARITY_THRESHOLD = 0.45` (Minimum base cosine similarity).
    *   `MARGIN_MIN = 0.08` (Score gap required between top 2 identities).
*   **Paths**:
    *   `BASE_DIR`, `FACES_DIR`, `MODELS_DIR`, `LOG_DIR`, `SNAPSHOT_DIR`.
*   **Camera Settings**:
    *   Pi Camera Size: `640x480`, Format: `RGB888`.
    *   Webcam resizing: `640x480` internal detection resolution.
*   **Environment Variables** (`.env`):
    *   `SUPABASE_URL`: Cloud DB endpoint.
    *   `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: API access keys.
    *   `SHELTER_ID`: Links edge node data to a specific shelter instance.

## 12. Libraries
*   `cv2` (OpenCV): Image manipulation, bounding box drawing, camera capture (webcam).
*   `numpy`: Fast matrix operations, cosine similarity math, embedding storage.
*   `mtcnn`: Core face detection model.
*   `deepface`: Wrapper for ArcFace embedding generation.
*   `picamera2`: Native interface for Raspberry Pi camera module hardware.
*   `supabase`: Cloud database and storage synchronization.
*   `PIL` (Pillow): Image format conversion bridging OpenCV and DeepFace.

## 13. Models
*   **MTCNN**:
    *   **Purpose**: Face detection and landmarking.
    *   **Inputs**: RGB Image.
    *   **Outputs**: Bounding boxes `[x,y,w,h]`, Confidence scores, Keypoints (left/right eye, nose, mouth corners).
*   **ArcFace**:
    *   **Purpose**: Face identity embedding generation.
    *   **Inputs**: Cropped, aligned face image.
    *   **Outputs**: 512-dimensional float vector (embedding).

## 14. Data Structures
*   **Detection Object**: `{"confidence": float, "box": [x, y, w, h], "keypoints": dict, "crop_path": str}`
*   **Result Dict (Alert Payload)**: `{"timestamp": str, "camera_id": str, "alert_flag": bool, "alert_type": str, "faces": list}`
*   **Identity Metadata**: `{"identities": {"name": [row_idx1, ...]}, "rows": [...], "adaptive_thresholds": {"name": float}}`

## 15. Error Handling
*   **Missing camera**: Script exits with sys.exit and an error message if `cv2.VideoCapture` fails.
*   **Failed detection**: Logs warnings and skips frame; sets `alert_flag` if no face is seen.
*   **Failed recognition**: Graceful fallback returning `identity = "unknown"`.
*   **Corrupted embeddings**: Missing `embeddings.npy` triggers `FileNotFoundError` prompting the user to run enrollment.
*   **Sync errors**: `sync_employees.py` catches `Exception`, logs errors, and retries in the next 60-second cycle without crashing.

## 16. Performance
*   **Bottlenecks**: `DeepFace.represent()` (ArcFace inference) on CPU is heavy. Sequential synchronous DeepFace calls per frame can reduce FPS.
*   **Expensive operations**: MTCNN detection over full HD images (mitigated by resizing to 640x480 prior to detection).
*   **Memory usage**: Loads the entire embedding matrix into RAM. Acceptable for hundreds of employees but scales poorly for millions.
*   **Optimization**: Inference is threaded for uploading snapshots. Resizing input frames before MTCNN greatly speeds up execution.

## 17. Limitations
*   **Hardware limitations**: Edge execution on a Raspberry Pi CPU results in low FPS during active recognition phases.
*   **Lighting/Pose**: Heavily reliant on good lighting and front-facing poses. Severe profile angles cause MTCNN to miss the face.
*   **Multiple faces**: Processing multiple faces scales linearly (O(N)), slowing down the pipeline significantly if many faces appear simultaneously.
*   **Enrollment Data**: Aggregated voting is weak if identities have fewer than 5 diverse photos.

## 18. Future Improvements
*   **Critical**: Implement async/threading for the recognition step to decouple camera frame grabbing from heavy deep learning inference, preserving smooth video feed.
*   **Recommended**: Convert models to TFLite or ONNX format for accelerated inference on edge hardware (e.g., Raspberry Pi).
*   **Optional**: Add a face tracker (like SORT) to avoid running MTCNN/DeepFace on the same person in consecutive frames.

## 19. Quick Reference

### Files
| File | Purpose |
|------|---------|
| `stage1_face_detect.py` | MTCNN detection, alignment, cropping |
| `stage2_face_recognition.py` | ArcFace embeddings, voting logic, thresholds |
| `pi_camera_test.py` | Pi camera live execution loop |
| `supabase_uploader.py` | Cloud evidence/alert submission |
| `sync_employees.py` | Pulls new enrollments from Supabase |

### Models
| Model | Purpose |
|-------|---------|
| `MTCNN` | Bounding box detection and 5-point landmarks |
| `ArcFace` | 512-D embedding extraction |

### Thresholds
| Parameter | Value | Description |
|-----------|-------|-------------|
| `CONFIDENCE_THRESHOLD` | `0.80` | Minimum confidence for MTCNN face box |
| `BASE_SIMILARITY_THRESHOLD` | `0.45` | Minimum cosine similarity for ArcFace match |
| `MARGIN_MIN` | `0.08` | Required score gap between top 2 matching identities |
| `PADDING` | `25` | Pixels added around detected face crop |

### Pipeline
| Step | Function | Output |
|------|----------|--------|
| Detection | `MTCNN.detect_faces()` | Bounding boxes, landmarks, confidence |
| Alignment | `align_face()` | Level, rotated RGB image |
| Cropping | `crop_face()` | Padded face region numpy array |
| Embedding | `DeepFace.represent()` | 512-D vector |
| Matching | `_aggregate_scores()` | Mean cosine similarities per identity |
| Decision | `identify()` | Name string or `"unknown"` |
