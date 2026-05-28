# Alert Logic

## Trigger Condition
- **Condition:** No face detected in frame -> raise `alert_flag = True`

## Alert Types
a) **No face/masked:** A person is detected but no face is visible or the face is covered/masked.
b) **Unknown person:** A face is detected but does not match any known profile in the database.
c) **Recognition failure:** The system failed to process the face for recognition due to technical issues or poor quality.

## Output Format
Alerts will be output in the following format:
`[timestamp] + [camera_id] + [alert_type] + [frame_snapshot_path]`

Camera Frame
    │
    ▼
[Stage 1 — MTCNN]
    │
    ├─ No face / conf < threshold ──► alert_type = "no_face_detected"  [stage=1]
    │
    └─ Face detected
           │
           ▼
       [Stage 2 — ArcFace embedding]
           │
           ├─ Exception / bad crop ──────► alert_type = "recognition_failure" [stage=2]
           │
           ├─ Similarity < threshold ────► alert_type = "unknown_person"      [stage=2]
           │
           └─ Match found ──────────────► alert_flag = False  (log only)