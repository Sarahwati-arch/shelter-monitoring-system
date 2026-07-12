#Pi Camera Live Test — Stage 1 Face Detection
import cv2
import sys
from pathlib import Path
from datetime import datetime
from picamera2 import Picamera2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stage1.webcam_test import process_frame, load_recognizer, DEFAULT_THRESHOLD, LOG_DIR, SNAPSHOT_DIR
from stage1.supabase_uploader import upload_snapshot_and_alert

def run_pi(recognize=False, threshold=DEFAULT_THRESHOLD, save_all=False, cooldown_seconds=10):
    recognizer = load_recognizer() if recognize else None
    picam2 = Picamera2()
    config = picam2.create_preview_configuration(main={"size": (640, 480), "format": "RGB888"})
    picam2.configure(config)
    picam2.start()
    print("Pi camera started. Ctrl+C to stop.\n")
    frame_count = 0
    last_alert_time = None
    try:
        while True:
            frame_bgr = picam2.capture_array()
            if frame_count == 0:
                print(f"Frame shape: {frame_bgr.shape}, dtype: {frame_bgr.dtype}")
            annotated, result = process_frame(frame_bgr, threshold, recognizer, None)
            frame_count += 1
            now = datetime.now()
            result["timestamp"] = now.isoformat()

            has_unknown = any(face["identity"] == "unknown" for face in result["faces"])

            for face in result["faces"]:
                if face["identity"] not in ("unknown", "—"):
                    print(f"  Recognized: {face['identity']} (conf: {face['rec_conf']:.2f}) — timestamp only, no upload")       

            if has_unknown:
                if last_alert_time is None or (now - last_alert_time).total_seconds() >= cooldown_seconds:
                    ts = now.strftime("%Y%m%d_%H%M%S_%f")
                    filename = f"unknown_{ts}.jpg"
                    temp_path = SNAPSHOT_DIR / filename
                    cv2.imwrite(str(temp_path), annotated)
                    upload_snapshot_and_alert(str(temp_path), filename, result)
                    try:
                        temp_path.unlink()
                    except OSError as e:
                        print(f"  Failed to delete temp file: {e}")
                    last_alert_time = now

            if save_all:
                ts = now.strftime("%Y%m%d_%H%M%S_%f")
                cv2.imwrite(str(SNAPSHOT_DIR / f"frame_{ts}.jpg"), annotated)
    except KeyboardInterrupt:
        print(f"\nStopped. Frames processed: {frame_count}")
    finally:
        picam2.stop()

if __name__ == "__main__":
    run_pi(recognize=True)
