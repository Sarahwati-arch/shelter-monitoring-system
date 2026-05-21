# CCTV Pipeline

Camera Frame (from Raspberry Pi Camera)
        ↓
[STAGE 1] YOLOv8 Person Detection
        → Output: Bounding boxes of detected persons
        ↓
[STAGE 2] MTCNN Face Detection (within each person's bounding box ROI)
        → Output: Face crop + 5 landmark points (eyes, nose, mouth corners)
        → If NO face found → ALERT (person detected, face hidden/masked)
        ↓
[STAGE 3] DeepFace Face Recognition
        → Output: Employee ID + confidence score
        → If person is unknown → ALERT (unknown person )
