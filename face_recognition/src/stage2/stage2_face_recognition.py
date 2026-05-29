"""
Stage 2: Face Recognition using ArcFace (via DeepFace)
Shelter Monitoring System — Face Recognition Pipeline

Responsibilities:
  - Generate and persist ArcFace embeddings for all enrolled identities
  - Match an incoming face crop against the embedding database
  - Use AGGREGATED voting across all enrollment photos (not just top-1)
    to prevent confusion between visually similar identities (e.g. Sarah / Nanda)
  - Apply per-identity cosine similarity thresholds calibrated from
    intra-class vs inter-class distance analysis
  - Return alert_flag = True + alert_type = "unknown_person" on no-match

Separation fix for Sarah / Nanda confusion
-------------------------------------------
Root cause: with only 3 enrollment photos and a single nearest-neighbour
lookup, one unlucky photo can cause a cross-identity match.

Fix applied here:
  1. Multi-sample aggregated voting  — score = mean of top-K per-identity
     distances, not just the single closest match.
  2. Margin enforcement              — winner must beat runner-up by at least
     MARGIN_MIN (default 0.08) in cosine distance.
  3. Per-identity adaptive threshold — computed from intra-class variance so
     identities whose enrollment photos are more spread out get a looser
     threshold.
  4. Minimum photo guard             — warns loudly if any identity has fewer
     than MIN_PHOTOS_WARN photos; accuracy degrades below 5.

Usage
-----
  # (Re)generate embeddings from data/faces/:
  python src/stage2/stage2_face_recognition.py enroll

  # Identify a single face image:
  python src/stage2/stage2_face_recognition.py identify --image path/to/face.jpg

  # Run diagnostics — show intra/inter class distances:
  python src/stage2/stage2_face_recognition.py diagnose

  # Integration (import):
  from src.stage2.stage2_face_recognition import FaceRecognizer
  rec = FaceRecognizer()
  result = rec.identify(face_rgb_array)
"""

import json
import logging
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# ─────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────

BASE_DIR       = Path(__file__).resolve().parents[2]   # face_recognition/
FACES_DIR      = BASE_DIR / "data"  / "faces"
MODELS_DIR     = BASE_DIR / "models"
LOG_DIR        = BASE_DIR / "logs"
EMBEDDINGS_NPY = MODELS_DIR / "embeddings.npy"
METADATA_JSON  = MODELS_DIR / "employee_metadata.json"
THRESHOLD_LOG  = LOG_DIR    / "recognition_threshold_log.md"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────

# Base cosine similarity threshold — a score ABOVE this = match
# (cosine similarity: 1.0 = identical, 0.0 = unrelated)
# DeepFace returns distance (lower = more similar); we convert below.
BASE_SIMILARITY_THRESHOLD = 0.45

# Minimum margin between winner and runner-up (cosine similarity units).
# If winner - runner-up gap < MARGIN_MIN → reject as ambiguous.
# Increase this value to reduce Sarah/Nanda-style confusions.
MARGIN_MIN = 0.08

# How many enrollment photos per identity to average in aggregated voting.
# "None" = use all available photos.
TOP_K_PER_IDENTITY = None

# Warn when any identity has fewer than this many photos.
MIN_PHOTOS_WARN = 5

# ArcFace model (via DeepFace). Alternatives: "Facenet512", "VGG-Face"
MODEL_NAME = "ArcFace"

# Image extensions recognised for enrollment
PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}

# ─────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / f"stage2_{datetime.now().strftime('%Y%m%d')}.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
# Utility — cosine similarity / distance conversion
# ─────────────────────────────────────────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return cosine similarity in [−1, 1]. Higher = more similar."""
    a = a / (np.linalg.norm(a) + 1e-10)
    b = b / (np.linalg.norm(b) + 1e-10)
    return float(np.dot(a, b))


def deepface_distance_to_similarity(distance: float) -> float:
    """
    DeepFace returns cosine *distance* (0 = identical, 2 = opposite).
    Convert to similarity score in [0, 1] for consistent thresholding.
    similarity = 1 − (distance / 2)
    """
    return max(0.0, 1.0 - (distance / 2.0))


# ─────────────────────────────────────────────────────────────────
# Embedding generation
# ─────────────────────────────────────────────────────────────────

def _get_embedding(image_path: Path) -> np.ndarray | None:
    """
    Generate ArcFace embedding for a single image file.
    Returns None if DeepFace cannot extract a face.
    """
    try:
        # pyrefly: ignore [missing-import]
        from deepface import DeepFace
        result = DeepFace.represent(
            img_path          = str(image_path),
            model_name        = MODEL_NAME,
            enforce_detection = False,
            detector_backend  = "mtcnn",
        )
        if result and len(result) > 0:
            return np.array(result[0]["embedding"], dtype=np.float32)
    except Exception as e:
        logger.warning(f"  Embedding failed for {image_path.name}: {e}")
    return None


def _get_embedding_from_array(face_rgb: np.ndarray) -> np.ndarray | None:
    """
    Generate ArcFace embedding from an RGB numpy array (live webcam crop).
    Writes to a temp file because DeepFace.represent() needs a path.
    """
    try:
        from deepface import DeepFace
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name
            Image.fromarray(face_rgb).save(tmp_path)
        try:
            result = DeepFace.represent(
                img_path          = tmp_path,
                model_name        = MODEL_NAME,
                enforce_detection = False,
                detector_backend  = "mtcnn",
            )
            if result and len(result) > 0:
                return np.array(result[0]["embedding"], dtype=np.float32)
        finally:
            os.unlink(tmp_path)
    except Exception as e:
        logger.warning(f"  Live embedding failed: {e}")
    return None


# ─────────────────────────────────────────────────────────────────
# Enrollment — build embeddings.npy + employee_metadata.json
# ─────────────────────────────────────────────────────────────────

def enroll_all(faces_dir: Path = FACES_DIR) -> dict:
    """
    Walk data/faces/<name>/ subdirectories, generate ArcFace embeddings
    for every photo, and persist to models/embeddings.npy + metadata.json.

    Embedding matrix shape: (N_photos_total, embedding_dim)
    Metadata maps each row index → identity name + source photo path.

    Returns a summary dict.
    """
    if not faces_dir.exists():
        logger.error(f"Faces directory not found: {faces_dir}")
        sys.exit(1)

    identity_dirs = sorted([
        d for d in faces_dir.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ])

    if not identity_dirs:
        logger.error(f"No identity subdirectories found in {faces_dir}")
        sys.exit(1)

    logger.info(f"Found {len(identity_dirs)} identity folders: "
                f"{[d.name for d in identity_dirs]}")

    all_embeddings = []
    metadata       = {
        "model":      MODEL_NAME,
        "enrolled_at": datetime.now().isoformat(),
        "identities": {},   # name → list of row indices
        "rows": [],         # row_index → {name, photo_path}
    }

    row_idx = 0
    summary = {}

    for id_dir in identity_dirs:
        name   = id_dir.name
        photos = sorted([
            p for p in id_dir.iterdir()
            if p.suffix in PHOTO_EXTENSIONS
        ])

        if not photos:
            logger.warning(f"  [{name}] No photos found — skipping.")
            continue

        if len(photos) < MIN_PHOTOS_WARN:
            logger.warning(
                f"  [{name}] Only {len(photos)} photo(s). "
                f"Recommend {MIN_PHOTOS_WARN}+ for reliable recognition. "
                f"Sarah/Nanda-style confusions are more likely with few photos."
            )

        logger.info(f"  [{name}] Enrolling {len(photos)} photo(s)…")
        metadata["identities"][name] = []
        success_count = 0

        for photo_path in photos:
            emb = _get_embedding(photo_path)
            if emb is None:
                logger.warning(f"    Skipped (no face): {photo_path.name}")
                continue

            all_embeddings.append(emb)
            metadata["rows"].append({
                "row":        row_idx,
                "name":       name,
                "photo_path": str(photo_path),
            })
            metadata["identities"][name].append(row_idx)
            row_idx      += 1
            success_count += 1

        logger.info(f"    → {success_count}/{len(photos)} embeddings generated.")
        summary[name] = {"photos": len(photos), "embedded": success_count}

    if not all_embeddings:
        logger.error("No embeddings generated. Check photos and DeepFace installation.")
        sys.exit(1)

    embedding_matrix = np.stack(all_embeddings, axis=0)  # (N, D)
    np.save(str(EMBEDDINGS_NPY), embedding_matrix)
    logger.info(f"Embeddings saved → {EMBEDDINGS_NPY}  shape={embedding_matrix.shape}")

    with open(METADATA_JSON, "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Metadata saved  → {METADATA_JSON}")

    # Compute and save per-identity adaptive thresholds
    thresholds = _compute_adaptive_thresholds(embedding_matrix, metadata)
    metadata["adaptive_thresholds"] = thresholds
    with open(METADATA_JSON, "w") as f:
        json.dump(metadata, f, indent=2)

    _write_threshold_log(embedding_matrix, metadata, thresholds, summary)
    return summary


# ─────────────────────────────────────────────────────────────────
# Adaptive threshold computation
# ─────────────────────────────────────────────────────────────────

def _compute_adaptive_thresholds(
        embedding_matrix: np.ndarray,
        metadata: dict) -> dict[str, float]:
    """
    For each identity, compute an adaptive recognition threshold based on
    intra-class cosine similarity spread.

    Threshold = mean(intra_class_similarities) − 2 × std(intra_class_similarities)

    This ensures identities with tight enrollment clusters get a strict
    threshold, while those with more variation get a looser one.
    Falls back to BASE_SIMILARITY_THRESHOLD if < 2 photos.

    The margin between the top identity score and runner-up is checked
    separately in FaceRecognizer.identify() via MARGIN_MIN.
    """
    thresholds = {}

    for name, row_indices in metadata["identities"].items():
        if len(row_indices) < 2:
            thresholds[name] = BASE_SIMILARITY_THRESHOLD
            logger.info(f"  [{name}] threshold=BASE ({BASE_SIMILARITY_THRESHOLD:.2f}) "
                        f"(only {len(row_indices)} embedding)")
            continue

        vecs = embedding_matrix[row_indices]  # (K, D)
        sims = []
        for i in range(len(vecs)):
            for j in range(i + 1, len(vecs)):
                sims.append(cosine_similarity(vecs[i], vecs[j]))

        mean_sim = float(np.mean(sims))
        std_sim  = float(np.std(sims))
        # Threshold: require at least mean − 2σ similarity to accept a match
        # Clamp to [BASE − 0.15, BASE + 0.10] so it doesn't drift too far
        thr = float(np.clip(
            mean_sim - 2.0 * std_sim,
            BASE_SIMILARITY_THRESHOLD - 0.15,
            BASE_SIMILARITY_THRESHOLD + 0.10,
        ))
        thresholds[name] = round(thr, 4)
        logger.info(
            f"  [{name}] intra-class mean={mean_sim:.3f} std={std_sim:.3f} "
            f"→ adaptive_threshold={thr:.3f}"
        )

    return thresholds


# ─────────────────────────────────────────────────────────────────
# Threshold log
# ─────────────────────────────────────────────────────────────────

def _write_threshold_log(
        embedding_matrix: np.ndarray,
        metadata: dict,
        thresholds: dict,
        enrollment_summary: dict):
    """
    Write logs/recognition_threshold_log.md — documents intra-class and
    inter-class distances so the team can tune MARGIN_MIN and thresholds.
    """
    lines = [
        "# Recognition Threshold Log",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Model: {MODEL_NAME}",
        f"Base threshold: {BASE_SIMILARITY_THRESHOLD}",
        f"Margin min: {MARGIN_MIN}",
        "",
        "## Enrollment Summary",
        "",
        "| Identity | Photos | Embedded | Adaptive Threshold |",
        "|----------|--------|----------|--------------------|",
    ]

    for name, info in enrollment_summary.items():
        thr = thresholds.get(name, BASE_SIMILARITY_THRESHOLD)
        lines.append(
            f"| {name} | {info['photos']} | {info['embedded']} | {thr:.4f} |"
        )

    # Inter-class distances — key for diagnosing Sarah/Nanda confusion
    identity_names = list(metadata["identities"].keys())
    if len(identity_names) >= 2:
        lines += [
            "",
            "## Inter-Class Cosine Similarity (lower = more separable)",
            "",
            "Values close to intra-class mean → identities hard to separate.",
            "If Sarah↔Nanda inter-class similarity ≈ their intra-class mean,",
            "increase MARGIN_MIN or add more diverse enrollment photos.",
            "",
            "| Identity A | Identity B | Mean Inter-Class Sim | Min Sim | Max Sim |",
            "|------------|------------|----------------------|---------|---------|",
        ]

        for i in range(len(identity_names)):
            for j in range(i + 1, len(identity_names)):
                name_a = identity_names[i]
                name_b = identity_names[j]
                rows_a = metadata["identities"].get(name_a, [])
                rows_b = metadata["identities"].get(name_b, [])
                if not rows_a or not rows_b:
                    continue

                vecs_a = embedding_matrix[rows_a]
                vecs_b = embedding_matrix[rows_b]
                inter_sims = [
                    cosine_similarity(vecs_a[r], vecs_b[s])
                    for r in range(len(vecs_a))
                    for s in range(len(vecs_b))
                ]
                lines.append(
                    f"| {name_a} | {name_b} "
                    f"| {np.mean(inter_sims):.4f} "
                    f"| {np.min(inter_sims):.4f} "
                    f"| {np.max(inter_sims):.4f} |"
                )

    lines += [
        "",
        "## Tuning Notes",
        "",
        "- If inter-class sim (Sarah↔Nanda) > 0.55: add more photos varying",
        "  lighting and angle. Similarity this high means the model sees them",
        "  as very close — more diverse enrollment is the primary fix.",
        "- If adaptive threshold feels too loose: increase BASE_SIMILARITY_THRESHOLD",
        "  from 0.60 toward 0.65.",
        "- If legitimate team members get flagged as unknown: decrease MARGIN_MIN",
        "  from 0.08 toward 0.05.",
        "- With only 3 photos per person: confusion between similar-looking people",
        "  is expected. Minimum recommended: 5 photos, ideally 10–15.",
    ]

    THRESHOLD_LOG.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"Threshold log written → {THRESHOLD_LOG}")


# ─────────────────────────────────────────────────────────────────
# FaceRecognizer — main class for webcam_test.py integration
# ─────────────────────────────────────────────────────────────────

class FaceRecognizer:
    """
    Loads pre-computed embeddings and identifies a face crop.

    Used by webcam_test.py and any downstream consumer.

    Example
    -------
    rec    = FaceRecognizer()
    result = rec.identify(face_rgb_numpy_array)
    # result = {
    #   "identity":   "victoria",
    #   "similarity": 0.74,
    #   "alert_flag": False,
    #   "alert_type": None,
    #   "scores":     {"victoria": 0.74, "sarah": 0.51, "nanda": 0.49},
    # }
    """

    def __init__(self,
                 embeddings_path: Path = EMBEDDINGS_NPY,
                 metadata_path:   Path = METADATA_JSON):

        if not embeddings_path.exists() or not metadata_path.exists():
            raise FileNotFoundError(
                f"Embeddings or metadata not found.\n"
                f"  Expected: {embeddings_path}\n"
                f"            {metadata_path}\n"
                f"  Run first: python src/stage2/stage2_face_recognition.py enroll"
            )

        self.embeddings: np.ndarray = np.load(str(embeddings_path))
        with open(metadata_path) as f:
            self.metadata: dict = json.load(f)

        self.adaptive_thresholds: dict[str, float] = self.metadata.get(
            "adaptive_thresholds", {}
        )
        logger.info(
            f"FaceRecognizer loaded: "
            f"{self.embeddings.shape[0]} embeddings, "
            f"{len(self.metadata['identities'])} identities"
        )

    # ── Core identification ──────────────────────────────────────

    def identify(self, face_rgb: np.ndarray) -> dict:
        """
        Identify a face from an RGB numpy array.

        Strategy (aggregated voting):
          For each enrolled identity, compute cosine similarity between the
          query embedding and ALL that identity's enrollment embeddings, then
          take the mean of the top-K similarities.  The identity with the
          highest mean score wins — provided it clears its adaptive threshold
          AND beats the runner-up by at least MARGIN_MIN.

        Returns
        -------
        {
          "identity":   str,   # name or "unknown"
          "similarity": float, # winning score (0–1)
          "alert_flag": bool,
          "alert_type": str | None,
          "scores":     dict,  # per-identity aggregated scores
        }
        """
        query_emb = _get_embedding_from_array(face_rgb)
        if query_emb is None:
            return {
                "identity":   "unknown",
                "similarity": 0.0,
                "alert_flag": True,
                "alert_type": "recognition_failure",
                "scores":     {},
            }

        scores = self._aggregate_scores(query_emb)

        if not scores:
            return {
                "identity":   "unknown",
                "similarity": 0.0,
                "alert_flag": True,
                "alert_type": "unknown_person",
                "scores":     {},
            }

        # Sort identities by score descending
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        best_name,   best_score   = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0

        # ── Threshold check ──
        thr = self.adaptive_thresholds.get(best_name, BASE_SIMILARITY_THRESHOLD)
        passes_threshold = best_score >= thr

        # ── Margin check — key fix for Sarah/Nanda confusion ──
        margin = best_score - second_score
        passes_margin = margin >= MARGIN_MIN

        if passes_threshold and passes_margin:
            return {
                "identity":   best_name,
                "similarity": round(best_score, 4),
                "alert_flag": False,
                "alert_type": None,
                "scores":     {k: round(v, 4) for k, v in scores.items()},
            }
        else:
            reason = []
            if not passes_threshold:
                reason.append(f"score {best_score:.3f} < threshold {thr:.3f}")
            if not passes_margin:
                reason.append(
                    f"margin {margin:.3f} < min {MARGIN_MIN} "
                    f"(ambiguous between {best_name} / {ranked[1][0]})"
                )
            logger.debug(f"  Rejected '{best_name}': {'; '.join(reason)}")
            return {
                "identity":   "unknown",
                "similarity": round(best_score, 4),
                "alert_flag": True,
                "alert_type": "unknown_person",
                "scores":     {k: round(v, 4) for k, v in scores.items()},
            }

    # ── Aggregated per-identity scoring ─────────────────────────

    def _aggregate_scores(self, query_emb: np.ndarray) -> dict[str, float]:
        """
        For each identity, compute the mean cosine similarity across all
        (or top-K) of their enrollment embeddings.

        This is the core fix for the Sarah/Nanda confusion: instead of
        relying on whichever single enrollment photo happens to be closest,
        we average across all photos so one outlier photo can't dominate.
        """
        scores = {}

        for name, row_indices in self.metadata["identities"].items():
            if not row_indices:
                continue

            enrolled_vecs = self.embeddings[row_indices]   # (K, D)
            per_photo_sims = [
                cosine_similarity(query_emb, enrolled_vecs[i])
                for i in range(len(enrolled_vecs))
            ]

            # Optionally keep only top-K (less noisy with many photos)
            if TOP_K_PER_IDENTITY is not None:
                per_photo_sims = sorted(per_photo_sims, reverse=True)[:TOP_K_PER_IDENTITY]

            scores[name] = float(np.mean(per_photo_sims))

        return scores


# ─────────────────────────────────────────────────────────────────
# Diagnostics — standalone separation report
# ─────────────────────────────────────────────────────────────────

def run_diagnostics():
    """
    Print a full intra/inter-class similarity report to terminal.
    Use this to diagnose Sarah/Nanda-style confusion:
      - If their inter-class similarity > either's intra-class mean,
        the model sees them as more similar to each other than to themselves
        → add more varied enrollment photos immediately.
    """
    if not EMBEDDINGS_NPY.exists() or not METADATA_JSON.exists():
        print("No embeddings found. Run 'enroll' first.")
        return

    emb = np.load(str(EMBEDDINGS_NPY))
    with open(METADATA_JSON) as f:
        meta = json.load(f)

    identities = list(meta["identities"].keys())

    print("\n═══════════════════════════════════════════")
    print("  Face Recognition Diagnostics")
    print(f"  Model: {MODEL_NAME}")
    print(f"  Embeddings: {emb.shape}")
    print("═══════════════════════════════════════════\n")

    # Intra-class
    print("── Intra-Class Similarity (should be HIGH, ideally > 0.65) ──")
    intra = {}
    for name in identities:
        rows = meta["identities"][name]
        if len(rows) < 2:
            print(f"  {name}: only 1 embedding — cannot compute intra-class similarity")
            intra[name] = None
            continue
        vecs = emb[rows]
        sims = [
            cosine_similarity(vecs[i], vecs[j])
            for i in range(len(vecs))
            for j in range(i + 1, len(vecs))
        ]
        intra[name] = np.mean(sims)
        print(f"  {name}: mean={np.mean(sims):.4f}  min={np.min(sims):.4f}  "
              f"max={np.max(sims):.4f}  std={np.std(sims):.4f}")

    # Inter-class
    print("\n── Inter-Class Similarity (should be LOW, ideally < 0.50) ──")
    print("   WARNING if inter-class sim > intra-class mean for either identity\n")
    for i in range(len(identities)):
        for j in range(i + 1, len(identities)):
            a, b = identities[i], identities[j]
            rows_a = meta["identities"][a]
            rows_b = meta["identities"][b]
            if not rows_a or not rows_b:
                continue
            vecs_a = emb[rows_a]
            vecs_b = emb[rows_b]
            sims = [
                cosine_similarity(vecs_a[r], vecs_b[s])
                for r in range(len(vecs_a))
                for s in range(len(vecs_b))
            ]
            mean_inter = np.mean(sims)
            intra_a    = intra.get(a)
            intra_b    = intra.get(b)

            flag = ""
            if intra_a and mean_inter > intra_a:
                flag += f" ⚠ inter > {a} intra"
            if intra_b and mean_inter > intra_b:
                flag += f" ⚠ inter > {b} intra"
            if mean_inter > 0.55:
                flag += "  ← CONFUSION RISK: add more varied photos"

            print(f"  {a} ↔ {b}: mean={mean_inter:.4f}  "
                  f"min={np.min(sims):.4f}  max={np.max(sims):.4f}{flag}")

    print(f"\n── Adaptive Thresholds ──")
    for name, thr in meta.get("adaptive_thresholds", {}).items():
        print(f"  {name}: {thr:.4f}")

    print(f"\n── Config ──")
    print(f"  BASE_SIMILARITY_THRESHOLD : {BASE_SIMILARITY_THRESHOLD}")
    print(f"  MARGIN_MIN                : {MARGIN_MIN}")
    print(f"  TOP_K_PER_IDENTITY        : {TOP_K_PER_IDENTITY or 'all'}")
    print()


# ─────────────────────────────────────────────────────────────────
# Identify a single image file (CLI convenience)
# ─────────────────────────────────────────────────────────────────

def identify_image_file(image_path: str | Path) -> dict:
    """Load an image file and run identification. Returns result dict."""
    image_path = Path(image_path)
    if not image_path.exists():
        logger.error(f"Image not found: {image_path}")
        return {}

    face_rgb = np.array(Image.open(image_path).convert("RGB"))
    rec      = FaceRecognizer()
    result   = rec.identify(face_rgb)

    print(f"\nImage   : {image_path.name}")
    print(f"Identity: {result['identity']}")
    print(f"Score   : {result['similarity']}")
    print(f"Alert   : {result['alert_flag']} ({result['alert_type']})")
    print(f"All scores: {result['scores']}")
    return result


# ─────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Stage 2 — ArcFace Face Recognition"
    )
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("enroll",
        help="Generate embeddings from data/faces/ and save to models/")

    p_id = sub.add_parser("identify",
        help="Identify a face in a single image file")
    p_id.add_argument("--image", required=True, help="Path to face image")

    sub.add_parser("diagnose",
        help="Print intra/inter-class similarity report (Sarah/Nanda debug)")

    args = parser.parse_args()

    if args.cmd == "enroll":
        summary = enroll_all()
        print("\nEnrollment complete:")
        for name, info in summary.items():
            print(f"  {name}: {info['embedded']}/{info['photos']} embeddings")

    elif args.cmd == "identify":
        identify_image_file(args.image)

    elif args.cmd == "diagnose":
        run_diagnostics()

    else:
        parser.print_help()