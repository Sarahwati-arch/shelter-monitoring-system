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
