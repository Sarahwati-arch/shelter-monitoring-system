# Alert Trigger Logic — Face Recognition Pipeline

## Alert Condition 1: No Face Detected
- Trigger: YOLO detects ≥1 person in frame, but MTCNN finds no face in the person's ROI
- Reason: Person may be masked, has back turned, or face is occluded
- Action: Log alert with timestamp + frame snapshot

## Alert Condition 2: Unknown Person
- Trigger: Face detected and recognized, but cosine similarity < threshold (no match in DB)
- Reason: Person is not an enrolled employee
- Action: Log alert + send Telegram notification with frame snapshot

## Alert Condition 3: Recognition Failure
- Trigger: Face detected but embedding generation fails (image quality too low)
- Action: Log warning, retry on next frame

## Normal Flow
- Person detected → Face detected → Match found (similarity ≥ threshold) → Log access as "employee_id verified"
