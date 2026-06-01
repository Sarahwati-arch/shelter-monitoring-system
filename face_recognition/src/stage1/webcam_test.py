"""
Webcam Live Test — Stage 1 Face Detection
Shelter Monitoring System

Tests MTCNN face detection, bounding boxes, landmark overlay,
alert flag logic, and (optionally) Stage 2 recognition in real time
using your laptop camera.

Controls (while window is open):
  Q or ESC  — quit
  S         — save current frame snapshot to logs/snapshots/
  P         — pause / resume feed
  +/-       — raise/lower confidence threshold on the fly

Usage:
  # Detection only (no recognition):
  python src/stage1/webcam_test.py

  # With recognition against enrolled faces in data/faces/:
  python src/stage1/webcam_test.py --recognize

  # Use a specific camera index (0 = default laptop cam, 1 = external):
  python src/stage1/webcam_test.py --cam-index 1

  # Save every frame automatically:
  python src/stage1/webcam_test.py --save-all
"""

import cv2
import sys
import json
import argparse
import numpy as np
from pathlib import Path
from datetime import datetime
# pyrefly: ignore [missing-import]
from mtcnn import MTCNN

# ─────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────

BASE_DIR      = Path(__file__).resolve().parents[2]   # face_recognition/
SNAPSHOT_DIR  = BASE_DIR / "logs" / "snapshots"
FACES_DIR     = BASE_DIR / "data" / "faces"
LOG_DIR       = BASE_DIR / "logs"

SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

DEFAULT_THRESHOLD = 0.80
CAMERA_ID         = "WEBCAM_LAPTOP"

# Overlay colours (BGR)
COLOR_FACE_BOX   = (0, 255, 0)     # green  — face detected
COLOR_ALERT_BOX  = (0, 0, 255)     # red    — alert state
COLOR_NAME_BOX   = (255, 165, 0)   # orange — recognised name
COLOR_LANDMARK   = (255, 255, 0)   # cyan   — eye/nose/mouth dots
COLOR_HUD        = (200, 200, 200) # light grey — HUD text

# ─────────────────────────────────────────────
# MTCNN detector (loaded once)
# ─────────────────────────────────────────────

print("Loading MTCNN…")
detector = MTCNN()
print("MTCNN ready.\n")

# ─────────────────────────────────────────────
# Stage 2 recognition — FaceRecognizer
# ─────────────────────────────────────────────

def load_recognizer():
    """
    Returns a FaceRecognizer instance if embeddings are available.
    Falls back gracefully if Stage 2 hasn't been enrolled yet.

    Uses aggregated voting + margin enforcement to avoid confusion
    between similar-looking identities (e.g. Sarah / Nanda).
    """
    # Check enrolled photos exist (any extension)
    extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
    enrolled = [
        p for p in FACES_DIR.rglob("*")
        if p.suffix in extensions and p.parent != FACES_DIR
    ]
    if not enrolled:
        print(f"  WARNING: No enrolled faces found in {FACES_DIR}")
        print("  Add photos: data/faces/<name>/photo_001.jpg")
        print("  Then run:   python src/stage2/stage2_face_recognition.py enroll")
        print("  Recognition will be skipped.\n")
        return None

    identities = set(p.parent.name for p in enrolled)
    print(f"  Found {len(enrolled)} enrolled image(s) across "
          f"{len(identities)} identit(ies): {sorted(identities)}")

    # Load Stage 2 FaceRecognizer
    try:
        sys.path.insert(0, str(BASE_DIR / "src"))
        from stage2.stage2_face_recognition import FaceRecognizer
        recognizer = FaceRecognizer()
        print("  Stage 2 FaceRecognizer loaded (aggregated voting + margin check).\n")
        return recognizer
    except FileNotFoundError:
        print("  Embeddings not found — run enrollment first:")
        print("  python src/stage2/stage2_face_recognition.py enroll\n")
        return None
    except Exception as e:
        print(f"  Stage 2 load failed: {e}")
        print("  Recognition will be skipped.\n")
        return None


def _recognize_face(recognizer, face_rgb: np.ndarray) -> tuple[str, float]:
    """
    Wrapper around FaceRecognizer.identify() that returns the
    (identity, similarity_score) tuple webcam_test expects.
    """
    result = recognizer.identify(face_rgb)
    return result["identity"], result["similarity"]


# ─────────────────────────────────────────────
# Frame processing
# ─────────────────────────────────────────────

def process_frame(frame_bgr: np.ndarray,
                  threshold: float,
                  recognizer=None) -> tuple[np.ndarray, dict]:
    """
    Run MTCNN + optional recognition on one BGR frame.

    Returns:
        annotated_frame (BGR numpy array)
        result dict with alert_flag, faces list, timestamp
    """
    image_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    raw       = detector.detect_faces(image_rgb)
    valid     = [d for d in raw if d["confidence"] >= threshold]

    alert_flag = len(valid) == 0
    alert_type = "no_face_detected" if alert_flag else None

    annotated  = frame_bgr.copy()
    faces_out  = []

    for det in valid:
        x, y, w, h = det["box"]
        conf        = det["confidence"]
        kps         = det["keypoints"]

        # Clamp box to frame bounds
        H, W = frame_bgr.shape[:2]
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(W - 1, x + w), min(H - 1, y + h)

        # ── Bounding box ──
        box_color = COLOR_FACE_BOX
        label     = f"Face {conf:.2f}"

        # ── Recognition ──
        identity, rec_conf = "—", 0.0
        if recognizer is not None:
            face_crop = image_rgb[y1:y2, x1:x2]
            if face_crop.size > 0:
                identity, rec_conf = _recognize_face(recognizer, face_crop)
                if identity == "unknown":
                    alert_flag = True
                    alert_type = "unknown_person"
                    box_color  = COLOR_ALERT_BOX
                    label      = f"UNKNOWN ({rec_conf:.2f})"
                else:
                    box_color = COLOR_NAME_BOX
                    label     = f"{identity} ({rec_conf:.2f})"

        cv2.rectangle(annotated, (x1, y1), (x2, y2),
                      color=box_color, thickness=2)
        cv2.putText(annotated, label, (x1, y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    box_color, 1, cv2.LINE_AA)

        # ── 5-point landmarks ──
        for lm_name, lm_pt in kps.items():
            cv2.circle(annotated, lm_pt, radius=3,
                       color=COLOR_LANDMARK, thickness=-1)

        faces_out.append({
            "confidence": round(conf, 4),
            "box":        [x, y, w, h],
            "identity":   identity,
            "rec_conf":   rec_conf,
        })

    # ── Alert overlay ──
    if alert_flag:
        cv2.rectangle(annotated, (0, 0),
                      (annotated.shape[1] - 1, annotated.shape[0] - 1),
                      COLOR_ALERT_BOX, thickness=4)
        cv2.putText(annotated,
                    f"ALERT: {alert_type}",
                    (10, annotated.shape[0] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                    COLOR_ALERT_BOX, 2, cv2.LINE_AA)

    return annotated, {
        "timestamp":  datetime.now().isoformat(),
        "camera_id":  CAMERA_ID,
        "alert_flag": alert_flag,
        "alert_type": alert_type,
        "faces":      faces_out,
    }


# ─────────────────────────────────────────────
# HUD overlay
# ─────────────────────────────────────────────

def draw_hud(frame: np.ndarray,
             threshold: float,
             fps: float,
             paused: bool,
             recognize_mode: bool,
             frame_count: int) -> np.ndarray:
    lines = [
        f"Threshold : {threshold:.2f}   (+/- to adjust)",
        f"FPS       : {fps:.1f}",
        f"Frames    : {frame_count}",
        f"Recognize : {'ON' if recognize_mode else 'OFF'}",
        f"Status    : {'PAUSED' if paused else 'LIVE'}",
        "Q/ESC=quit  S=snapshot  P=pause",
    ]
    for i, line in enumerate(lines):
        cv2.putText(frame, line, (10, 20 + i * 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52,
                    COLOR_HUD, 1, cv2.LINE_AA)
    return frame


# ─────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────

def run(cam_index: int = 0,
        recognize: bool = False,
        save_all: bool = False,
        threshold: float = DEFAULT_THRESHOLD):

    recognizer = load_recognizer() if recognize else None

    cap = cv2.VideoCapture(cam_index)
    if not cap.isOpened():
        sys.exit(
            f"ERROR: Cannot open camera index {cam_index}.\n"
            f"Try --cam-index 0 or 1. "
            f"Make sure no other app is using the camera."
        )

    print(f"Camera opened (index={cam_index}). Press Q or ESC to quit.\n")

    paused      = False
    frame_count = 0
    fps         = 0.0
    last_result = {}
    alert_log   = []

    t_start = datetime.now()

    while True:
        if not paused:
            ret, frame_bgr = cap.read()
            if not ret:
                print("ERROR: Lost camera feed.")
                break

            frame_count += 1
            elapsed = (datetime.now() - t_start).total_seconds()
            fps     = frame_count / elapsed if elapsed > 0 else 0.0

            annotated, result = process_frame(frame_bgr, threshold, recognizer)
            last_result = result

            if result["alert_flag"]:
                alert_log.append(result)

            if save_all:
                ts   = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                path = SNAPSHOT_DIR / f"frame_{ts}.jpg"
                cv2.imwrite(str(path), annotated)

        else:
            # Show last annotated frame while paused
            annotated = annotated.copy() if "annotated" in dir() else frame_bgr.copy()

        draw_hud(annotated, threshold, fps, paused,
                 recognize, frame_count)
        cv2.imshow("Shelter Monitor — Stage 1 Webcam Test", annotated)

        key = cv2.waitKey(1) & 0xFF

        if key in (ord("q"), 27):   # Q or ESC
            break
        elif key == ord("s"):       # S — snapshot
            ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = SNAPSHOT_DIR / f"snapshot_{ts}.jpg"
            cv2.imwrite(str(path), annotated)
            print(f"  Snapshot saved → {path}")
            # Also save the result JSON
            json_path = LOG_DIR / f"snapshot_{ts}.json"
            with open(json_path, "w") as f:
                json.dump(last_result, f, indent=2)
        elif key == ord("p"):       # P — pause/resume
            paused = not paused
            print(f"  {'PAUSED' if paused else 'RESUMED'}")
        elif key == ord("+"):       # + — raise threshold
            threshold = min(0.99, round(threshold + 0.05, 2))
            print(f"  Threshold → {threshold}")
        elif key == ord("-"):       # - — lower threshold
            threshold = max(0.50, round(threshold - 0.05, 2))
            print(f"  Threshold → {threshold}")

    cap.release()
    cv2.destroyAllWindows()

    # ── Session summary ──
    print(f"\n── Session Summary ──")
    print(f"  Frames processed : {frame_count}")
    print(f"  Alerts triggered : {len(alert_log)}")
    print(f"  Snapshots saved  : {len(list(SNAPSHOT_DIR.glob('snapshot_*.jpg')))}")

    if alert_log:
        session_log = LOG_DIR / f"webcam_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(session_log, "w") as f:
            json.dump(alert_log, f, indent=2)
        print(f"  Alert log saved  : {session_log}")


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Live webcam test — Stage 1 MTCNN face detection"
    )
    parser.add_argument(
        "--cam-index", type=int, default=0,
        help="Camera device index (0=default laptop cam, 1=external, default: 0)"
    )
    parser.add_argument(
        "--recognize", action="store_true",
        help="Enable Stage 2 recognition against data/faces/ enrolled photos"
    )
    parser.add_argument(
        "--save-all", action="store_true",
        help="Save every annotated frame to logs/snapshots/"
    )
    parser.add_argument(
        "--threshold", type=float, default=DEFAULT_THRESHOLD,
        help=f"Starting confidence threshold (default: {DEFAULT_THRESHOLD})"
    )
    args = parser.parse_args()

    run(
        cam_index  = args.cam_index,
        recognize  = args.recognize,
        save_all   = args.save_all,
        threshold  = args.threshold,
    )