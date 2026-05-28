"""
Stage 1: Face Detection using MTCNN
Shelter Monitoring System — Face Recognition Pipeline

Responsibilities:
  - Detect faces in camera frames using MTCNN
  - Crop detected faces with 20-30px padding
  - Align faces using 5-point eye landmarks
  - Set alert_flag = True when no face is detected
  - Draw bounding boxes and save annotated output images
  - Log detection results per frame
"""

import os
import cv2
import json
import logging
import numpy as np
from datetime import datetime
from pathlib import Path
from PIL import Image
from mtcnn import MTCNN

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parents[2]   # face_recognition/

INPUT_DIR  = BASE_DIR / "data" / "environment_frames"
OUTPUT_DIR = BASE_DIR / "data" / "environment_frames" / "annotated"
LOG_DIR    = BASE_DIR / "logs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ── Confidence threshold (tune on 20-30 sample images) ──
# Documented choices: 0.7 / 0.8 / 0.9
# Final chosen value stored in logs/confidence_threshold_log.md
CONFIDENCE_THRESHOLD = 0.90   # <-- change when tuning

# ── Face crop padding (pixels) ──
PADDING = 25   # 20-30 px

# ── Camera ID (update per deployment) ──
CAMERA_ID = "CAM_01"

# ─────────────────────────────────────────────
# Logging setup
# ─────────────────────────────────────────────

log_file = LOG_DIR / f"stage1_{datetime.now().strftime('%Y%m%d')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# MTCNN initialisation
# ─────────────────────────────────────────────

detector = MTCNN()
logger.info("MTCNN detector loaded.")


# ─────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────

def align_face(image_rgb: np.ndarray, keypoints: dict) -> np.ndarray:
    """
    Rotate the face crop so that the eye line is horizontal.
    Uses left_eye and right_eye from MTCNN 5-point landmarks.

    Args:
        image_rgb: Full RGB frame.
        keypoints:  MTCNN keypoints dict with keys
                    left_eye, right_eye, nose, mouth_left, mouth_right.

    Returns:
        Aligned face region as RGB numpy array (cropped, post-rotation).
    """
    left_eye  = np.array(keypoints["left_eye"],  dtype=np.float32)
    right_eye = np.array(keypoints["right_eye"], dtype=np.float32)

    # Angle between eye centres
    dy = right_eye[1] - left_eye[1]
    dx = right_eye[0] - left_eye[0]
    angle = np.degrees(np.arctan2(dy, dx))

    # Centre of rotation = midpoint between eyes
    eye_centre = ((left_eye[0] + right_eye[0]) / 2,
                  (left_eye[1] + right_eye[1]) / 2)

    h, w = image_rgb.shape[:2]
    M = cv2.getRotationMatrix2D(eye_centre, angle, scale=1.0)
    aligned = cv2.warpAffine(image_rgb, M, (w, h),
                             flags=cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)
    return aligned


def crop_face(image_rgb: np.ndarray, box: list, padding: int = PADDING) -> np.ndarray:
    """
    Crop a detected face with symmetric padding, clamped to image bounds.

    Args:
        image_rgb: Full RGB frame.
        box:       [x, y, width, height] from MTCNN.
        padding:   Extra pixels on each side.

    Returns:
        Cropped face region as RGB numpy array.
    """
    x, y, w, h = box
    H, W = image_rgb.shape[:2]

    x1 = max(0,     x - padding)
    y1 = max(0,     y - padding)
    x2 = min(W - 1, x + w + padding)
    y2 = min(H - 1, y + h + padding)

    return image_rgb[y1:y2, x1:x2]


def annotate_frame(frame_bgr: np.ndarray, detections: list) -> np.ndarray:
    """
    Draw bounding boxes and landmark dots on a BGR frame.

    Args:
        frame_bgr:  Original BGR frame.
        detections: List of MTCNN result dicts.

    Returns:
        Annotated BGR frame.
    """
    annotated = frame_bgr.copy()

    for det in detections:
        if det["confidence"] < CONFIDENCE_THRESHOLD:
            continue

        x, y, w, h = det["box"]
        conf = det["confidence"]
        kps  = det["keypoints"]

        # Bounding box
        cv2.rectangle(annotated,
                      (x, y), (x + w, y + h),
                      color=(0, 255, 0), thickness=2)

        # Confidence label
        label = f"Face {conf:.2f}"
        cv2.putText(annotated, label, (x, y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    (0, 255, 0), 1, cv2.LINE_AA)

        # 5-point landmarks
        landmark_colors = {
            "left_eye":    (255,  0,   0),
            "right_eye":   (255,  0,   0),
            "nose":        (0,  255, 255),
            "mouth_left":  (0,    0, 255),
            "mouth_right": (0,    0, 255),
        }
        for lm_name, lm_point in kps.items():
            color = landmark_colors.get(lm_name, (255, 255, 255))
            cv2.circle(annotated, lm_point, radius=3,
                       color=color, thickness=-1)

    return annotated


# ─────────────────────────────────────────────
# Core detection function
# ─────────────────────────────────────────────

def detect_faces(frame_path: str | Path,
                 camera_id: str = CAMERA_ID,
                 save_output: bool = True) -> dict:
    """
    Run MTCNN face detection on a single frame.

    Args:
        frame_path:   Path to the input image file.
        camera_id:    Identifier for the camera that captured the frame.
        save_output:  Whether to write the annotated image to OUTPUT_DIR.

    Returns:
        result dict:
          {
            "timestamp":    ISO-8601 string,
            "camera_id":    str,
            "frame_path":   str,
            "alert_flag":   bool,   # True when no valid face detected
            "alert_type":   str | None,
            "faces":        [ { "confidence": float,
                                "box":        [x,y,w,h],
                                "keypoints":  {...},
                                "crop_path":  str | None,
                              }, ... ],
            "annotated_path": str | None,
          }
    """
    timestamp = datetime.now().isoformat()
    frame_path = Path(frame_path)

    if not frame_path.exists():
        logger.error(f"Frame not found: {frame_path}")
        return {}

    # ── Load image ──
    pil_img   = Image.open(frame_path).convert("RGB")
    image_rgb = np.array(pil_img)
    image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

    # ── Run MTCNN ──
    raw_detections = detector.detect_faces(image_rgb)

    # ── Filter by confidence ──
    valid_detections = [d for d in raw_detections
                        if d["confidence"] >= CONFIDENCE_THRESHOLD]

    alert_flag = len(valid_detections) == 0
    alert_type = "no_face_detected" if alert_flag else None

    logger.info(
        f"[{camera_id}] {frame_path.name} | "
        f"raw={len(raw_detections)} valid={len(valid_detections)} "
        f"thr={CONFIDENCE_THRESHOLD} alert={alert_flag}"
    )

    # ── Process each detected face ──
    faces_output = []
    for idx, det in enumerate(valid_detections):
        aligned_rgb = align_face(image_rgb, det["keypoints"])
        face_crop   = crop_face(aligned_rgb, det["box"])

        # Save individual crop
        crop_filename = (f"{frame_path.stem}_face{idx:02d}"
                         f"_{det['confidence']:.2f}.jpg")
        crop_path = OUTPUT_DIR / crop_filename
        if save_output and face_crop.size > 0:
            crop_pil = Image.fromarray(face_crop)
            crop_pil.save(crop_path)
        else:
            crop_path = None

        faces_output.append({
            "confidence": round(det["confidence"], 4),
            "box":        det["box"],
            "keypoints":  det["keypoints"],
            "crop_path":  str(crop_path) if crop_path else None,
        })

    # ── Annotate and save full frame ──
    annotated_path = None
    if save_output:
        annotated_bgr  = annotate_frame(image_bgr, valid_detections)
        out_name       = f"annotated_{frame_path.name}"
        annotated_path = OUTPUT_DIR / out_name
        cv2.imwrite(str(annotated_path), annotated_bgr)

    result = {
        "timestamp":      timestamp,
        "camera_id":      camera_id,
        "frame_path":     str(frame_path),
        "alert_flag":     alert_flag,
        "alert_type":     alert_type,
        "faces":          faces_output,
        "annotated_path": str(annotated_path) if annotated_path else None,
    }

    # ── Write per-frame JSON log ──
    json_log_path = LOG_DIR / f"{frame_path.stem}_result.json"
    with open(json_log_path, "w") as f:
        json.dump(result, f, indent=2)

    if alert_flag:
        logger.warning(
            f"ALERT | camera={camera_id} | type={alert_type} | "
            f"frame={frame_path.name} | ts={timestamp}"
        )

    return result


# ─────────────────────────────────────────────
# Batch processing (directory of frames)
# ─────────────────────────────────────────────

def process_directory(input_dir: str | Path = INPUT_DIR,
                      camera_id: str = CAMERA_ID,
                      extensions: tuple = (".jpg", ".jpeg", ".png")) -> list[dict]:
    """
    Process all image frames in a directory.

    Args:
        input_dir:  Folder containing raw camera frames.
        camera_id:  Camera identifier to tag in results.
        extensions: Image file extensions to process.

    Returns:
        List of result dicts (one per frame).
    """
    input_dir = Path(input_dir)
    frames    = sorted(p for p in input_dir.iterdir()
                       if p.suffix.lower() in extensions
                       and "annotated" not in p.parts)

    if not frames:
        logger.warning(f"No frames found in {input_dir}")
        return []

    logger.info(f"Processing {len(frames)} frames from {input_dir}")
    results = []
    for frame_path in frames:
        result = detect_faces(frame_path, camera_id=camera_id)
        results.append(result)

    # Summary
    alerts = sum(1 for r in results if r.get("alert_flag"))
    logger.info(f"Done. {len(frames)} frames | {alerts} alerts triggered.")
    return results


# ─────────────────────────────────────────────
# Threshold tuning helper
# ─────────────────────────────────────────────

def tune_threshold(sample_dir: str | Path,
                   thresholds: list[float] = [0.7, 0.8, 0.9],
                   camera_id: str = CAMERA_ID):
    """
    Evaluate detection counts at multiple confidence thresholds.
    Results are logged to logs/confidence_threshold_log.md.

    Args:
        sample_dir:  Folder with 20-30 labelled test images.
        thresholds:  List of thresholds to evaluate.
        camera_id:   Camera ID for logging.
    """
    global CONFIDENCE_THRESHOLD

    sample_dir = Path(sample_dir)
    frames     = sorted(p for p in sample_dir.iterdir()
                        if p.suffix.lower() in (".jpg", ".jpeg", ".png"))

    log_lines = [
        "# Confidence Threshold Tuning Log",
        f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Sample images: {len(frames)}",
        "",
        "| Threshold | Detected | Missed | Alerts | Notes |",
        "|-----------|----------|--------|--------|-------|",
    ]

    for thr in thresholds:
        CONFIDENCE_THRESHOLD = thr
        detected = missed = alerts = 0

        for frame_path in frames:
            pil_img   = Image.open(frame_path).convert("RGB")
            image_rgb = np.array(pil_img)
            raw       = detector.detect_faces(image_rgb)
            valid     = [d for d in raw if d["confidence"] >= thr]

            if valid:
                detected += 1
            else:
                missed  += 1
                alerts  += 1

        log_lines.append(
            f"| {thr}       | {detected:>8} | {missed:>6} | {alerts:>6} |       |"
        )
        logger.info(f"thr={thr} → detected={detected} missed={missed} alerts={alerts}")

    log_lines += [
        "",
        "## Chosen Threshold",
        "**Value:** (fill in after reviewing table)",
        "**Rationale:** (e.g. 0.90 minimises false negatives on clear faces while",
        "               still flagging masked/occluded faces reliably)",
    ]

    md_path = LOG_DIR / "confidence_threshold_log.md"
    md_path.write_text("\n".join(log_lines))
    logger.info(f"Threshold log written → {md_path}")

    # Restore default
    CONFIDENCE_THRESHOLD = 0.90


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Stage 1 — MTCNN Face Detection")
    sub = parser.add_subparsers(dest="cmd")

    # run on a single frame
    p_single = sub.add_parser("detect", help="Detect faces in one frame")
    p_single.add_argument("frame", help="Path to image file")
    p_single.add_argument("--cam", default=CAMERA_ID, help="Camera ID")

    # run on a directory
    p_batch = sub.add_parser("batch", help="Process a directory of frames")
    p_batch.add_argument("--dir", default=str(INPUT_DIR), help="Input directory")
    p_batch.add_argument("--cam", default=CAMERA_ID, help="Camera ID")

    # threshold tuning
    p_tune = sub.add_parser("tune", help="Tune confidence threshold")
    p_tune.add_argument("--dir", required=True, help="Sample images directory")
    p_tune.add_argument("--cam", default=CAMERA_ID)

    args = parser.parse_args()

    if args.cmd == "detect":
        result = detect_faces(args.frame, camera_id=args.cam)
        print(json.dumps(result, indent=2))

    elif args.cmd == "batch":
        process_directory(args.dir, camera_id=args.cam)

    elif args.cmd == "tune":
        tune_threshold(args.dir, camera_id=args.cam)

    else:
        parser.print_help()