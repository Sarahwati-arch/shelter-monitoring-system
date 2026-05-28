Camera Frame
    │
    ▼
Stage 1: MTCNN Face Detection
  • Confidence threshold: 0.90 (tunable)
  • Face crop + 25px padding
  • 5-landmark eye alignment
  • alert_flag = True if no valid face
    │
    ▼
Stage 2: ArcFace Embedding + Matching  (Day 2)
  • DeepFace / InsightFace
  • Cosine similarity vs enrolled employees
  • alert_type = "unknown_person" if no match