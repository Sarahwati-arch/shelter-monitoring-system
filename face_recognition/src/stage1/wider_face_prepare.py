"""
WIDER FACE Dataset — Download, Parse, and Sample
Shelter Monitoring System — Stage 1 Threshold Tuning

What this script does:
  1. Downloads WIDER FACE validation split (smaller than train, enough for tuning)
  2. Parses the official ground-truth annotation file (wider_face_val_bbx_gt.txt)
  3. Filters images into three difficulty buckets: Easy / Medium / Hard
  4. Samples the exact images you need for threshold tuning:
       - 4 angled/profile faces        ← from Hard subset
       - 4 partial occlusion faces     ← from Hard subset
       - 4 images with no valid face   ← near-zero-size boxes (ignored faces)
  5. Copies sampled images into:
       data/environment_frames/samples/wider/

Usage:
    # Step 1 — place the dataset under face_recognition/data/wider_raw/
    #   wider_raw/wider_face_annotations/wider_face_split/wider_face_val_bbx_gt
    #   wider_raw/WIDER_val/WIDER_val/images/0--Parade/ ...

    # Step 2 — parse annotations and sample images for tuning
    python src/stage1/wider_face_prepare.py sample --n-angled 4 --n-occluded 4 --n-noface 4

    # Step 3 — verify what was sampled
    python src/stage1/wider_face_prepare.py verify
"""

import sys
import shutil
import random
import argparse
from pathlib import Path
from dataclasses import dataclass, field

# ─────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────

BASE_DIR    = Path(__file__).resolve().parents[2]   # face_recognition/
DATA_DIR    = BASE_DIR / "data"
RAW_DIR     = DATA_DIR / "wider_raw"                # root where you placed the dataset

# ── Actual folder structure from the downloaded WIDER FACE zip ──
# wider_raw/
#   wider_face_annotations/
#     wider_face_split/
#       wider_face_val_bbx_gt       ← no .txt extension
#       wider_face_train_bbx_gt
#       wider_face_val.mat  etc.
#   WIDER_val/
#     WIDER_val/
#       images/
#         0--Parade/
#         1--Handshaking/  ...
#   WIDER_train/
#     WIDER_train/
#       images/  ...

ANNO_FILE   = RAW_DIR / "wider_face_annotations" / "wider_face_split" / "wider_face_val_bbx_gt"
IMAGES_DIR  = RAW_DIR / "WIDER_val" / "WIDER_val" / "images"
SAMPLE_DIR  = DATA_DIR / "environment_frames" / "samples" / "wider"

RAW_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
# No download needed — dataset already extracted locally.
# Place the dataset so the folder tree matches:
#
#   face_recognition/data/wider_raw/
#     wider_face_annotations/wider_face_split/wider_face_val_bbx_gt
#     WIDER_val/WIDER_val/images/0--Parade/ ...
#     WIDER_train/WIDER_train/images/       (not used for tuning)
#
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# WIDER FACE annotation schema
# ─────────────────────────────────────────────
#
# Each face box in wider_face_val_bbx_gt.txt has 10 fields:
#   x1  y1  w  h  blur  expression  illumination  invalid  occlusion  pose
#
# Relevant fields for us:
#   pose      : 0 = typical, 1 = atypical (angled/profile)
#   occlusion : 0 = none, 1 = partial, 2 = heavy
#   invalid   : 1 = this box should be IGNORED (too small, wrong label, etc.)
#   blur      : 0 = clear, 1 = normal blur, 2 = heavy blur

@dataclass
class FaceBox:
    x: int
    y: int
    w: int
    h: int
    blur: int        # 0 clear / 1 normal / 2 heavy
    expression: int  # 0 typical / 1 exaggerated
    illumination: int
    invalid: int     # 1 = ignore this box
    occlusion: int   # 0 none / 1 partial / 2 heavy
    pose: int        # 0 typical / 1 atypical (angled)


@dataclass
class WiderImage:
    rel_path: str        # e.g. "0--Parade/0_Parade_marchingband_1_849.jpg"
    boxes: list[FaceBox] = field(default_factory=list)

    @property
    def valid_boxes(self):
        return [b for b in self.boxes if b.invalid == 0]

    @property
    def has_angled_face(self):
        return any(b.pose == 1 for b in self.valid_boxes)

    @property
    def has_partial_occlusion(self):
        return any(b.occlusion == 1 for b in self.valid_boxes)

    @property
    def has_heavy_occlusion(self):
        return any(b.occlusion == 2 for b in self.valid_boxes)

    @property
    def is_no_face(self):
        """
        True when all boxes are marked invalid (ignore).
        WIDER uses this for images where annotation was ambiguous
        or faces are too small to label — similar to a "no usable face" frame.
        """
        return len(self.boxes) > 0 and len(self.valid_boxes) == 0

    @property
    def has_small_faces_only(self, min_size: int = 20):
        """Faces smaller than min_size px — hard for MTCNN to pick up."""
        return all(b.w < min_size or b.h < min_size for b in self.valid_boxes)


# ─────────────────────────────────────────────
# Download
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# Parse annotation file
# ─────────────────────────────────────────────

def parse_annotations(anno_file: Path = ANNO_FILE) -> list[WiderImage]:
    """
    Parse wider_face_val_bbx_gt.txt into a list of WiderImage objects.

    File format:
        <relative_image_path>
        <num_boxes>
        x1 y1 w h blur expression illumination invalid occlusion pose
        ...
        (repeat for each image)

    Returns:
        List of WiderImage objects.
    """
    if not anno_file.exists():
        sys.exit(
            f"ERROR: Annotation file not found at {anno_file}\n"
            f"Run `python wider_face_prepare.py download` first."
        )

    images = []
    with open(anno_file, "r") as f:
        lines = [l.strip() for l in f if l.strip()]

    i = 0
    while i < len(lines):
        rel_path  = lines[i];  i += 1
        num_boxes = int(lines[i]); i += 1

        img = WiderImage(rel_path=rel_path)

        for _ in range(num_boxes):
            parts = list(map(int, lines[i].split())); i += 1
            # WIDER annotation has exactly 10 fields
            if len(parts) >= 10:
                img.boxes.append(FaceBox(*parts[:10]))
            else:
                # Malformed line — skip
                pass

        images.append(img)

    print(f"  Parsed {len(images)} images from annotation file.")
    return images


# ─────────────────────────────────────────────
# Sample
# ─────────────────────────────────────────────

def sample_images(images: list[WiderImage],
                  n_angled: int = 4,
                  n_occluded: int = 4,
                  n_noface: int = 4,
                  seed: int = 42) -> dict[str, list[WiderImage]]:
    """
    Select images for each tuning category from the parsed annotations.

    Categories:
      angled    — has at least one face with pose == 1 (atypical angle)
      occluded  — has at least one face with partial occlusion (occlusion == 1)
      noface    — all boxes are invalid (no usable face for MTCNN)

    Args:
        images:     Full parsed annotation list.
        n_angled:   How many angled-face images to sample.
        n_occluded: How many occluded-face images to sample.
        n_noface:   How many no-face images to sample.
        seed:       Random seed for reproducibility.

    Returns:
        Dict with keys 'angled', 'occluded', 'noface' → list of WiderImage.
    """
    random.seed(seed)

    pool_angled   = [img for img in images if img.has_angled_face]
    pool_occluded = [img for img in images
                     if img.has_partial_occlusion and not img.has_angled_face]
    pool_noface   = [img for img in images if img.is_no_face]

    def _safe_sample(pool, n, label):
        if len(pool) < n:
            print(f"  WARNING: only {len(pool)} images available for '{label}', "
                  f"requested {n}. Using all.")
            return pool[:]
        return random.sample(pool, n)

    sampled = {
        "angled":   _safe_sample(pool_angled,   n_angled,   "angled"),
        "occluded": _safe_sample(pool_occluded, n_occluded, "occluded"),
        "noface":   _safe_sample(pool_noface,   n_noface,   "noface"),
    }

    for cat, imgs in sampled.items():
        print(f"  {cat:>10}: {len(imgs)} images selected")

    return sampled


def copy_samples(sampled: dict[str, list[WiderImage]],
                 images_dir: Path = IMAGES_DIR,
                 out_dir: Path = SAMPLE_DIR):
    """
    Copy sampled images into the tuning sample directory.
    Files are renamed with their category prefix for easy review.

    Output structure:
        data/environment_frames/samples/wider/
            angled_00_<original_name>.jpg
            angled_01_<original_name>.jpg
            occluded_00_<original_name>.jpg
            noface_00_<original_name>.jpg
            ...
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    copied = 0

    for category, imgs in sampled.items():
        for idx, img in enumerate(imgs):
            src = images_dir / img.rel_path
            if not src.exists():
                print(f"  WARNING: source image not found — {src}")
                continue

            dst_name = f"{category}_{idx:02d}_{src.name}"
            dst      = out_dir / dst_name
            shutil.copy2(src, dst)
            copied += 1

    print(f"\n  Copied {copied} images → {out_dir}")
    return out_dir


def cmd_sample(args):
    print("\n── Sample WIDER FACE images for threshold tuning ──\n")

    if not ANNO_FILE.exists():
        sys.exit(
            f"ERROR: Annotation file not found at:\n  {ANNO_FILE}\n\n"
            "Expected layout inside face_recognition/data/wider_raw/:\n"
            "  wider_face_annotations/wider_face_split/wider_face_val_bbx_gt\n"
            "Check that the wider_face_annotations folder is placed correctly."
        )
    if not IMAGES_DIR.exists():
        sys.exit(
            f"ERROR: Images folder not found at:\n  {IMAGES_DIR}\n\n"
            "Expected layout inside face_recognition/data/wider_raw/:\n"
            "  WIDER_val/WIDER_val/images/0--Parade/ ...\n"
            "Check that the WIDER_val folder is placed correctly."
        )

    images  = parse_annotations()
    sampled = sample_images(images,
                            n_angled   = args.n_angled,
                            n_occluded = args.n_occluded,
                            n_noface   = args.n_noface,
                            seed       = args.seed)
    out_dir = copy_samples(sampled)

    total = sum(len(v) for v in sampled.values())
    print(f"\n  Total sampled: {total} images")
    print(f"  Location: {out_dir}")
    print("\nNext: run threshold tuning")
    print(f"  python src/stage1/stage1_face_detect.py tune --dir {out_dir}")


# ─────────────────────────────────────────────
# Verify
# ─────────────────────────────────────────────

def cmd_verify(_args):
    print("\n── Step 3: Verify sampled images ──\n")

    if not SAMPLE_DIR.exists() or not any(SAMPLE_DIR.iterdir()):
        print("  No samples found. Run `sample` first.")
        return

    files = sorted(SAMPLE_DIR.glob("*.jpg")) + sorted(SAMPLE_DIR.glob("*.png"))
    cats  = {}
    for f in files:
        cat = f.stem.split("_")[0]
        cats.setdefault(cat, []).append(f)

    for cat, imgs in sorted(cats.items()):
        print(f"  {cat:>10} : {len(imgs)} images")
        for img in imgs:
            size_kb = img.stat().st_size // 1024
            print(f"             {img.name}  ({size_kb} KB)")

    print(f"\n  Total: {len(files)} images in {SAMPLE_DIR}")


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="WIDER FACE — parse and sample for MTCNN tuning"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # sample
    p_sample = sub.add_parser("sample", help="Sample images for tuning categories")
    p_sample.add_argument("--n-angled",   type=int, default=4,
                          help="Number of angled-face images (default: 4)")
    p_sample.add_argument("--n-occluded", type=int, default=4,
                          help="Number of occluded-face images (default: 4)")
    p_sample.add_argument("--n-noface",   type=int, default=4,
                          help="Number of no-face images (default: 4)")
    p_sample.add_argument("--seed",       type=int, default=42,
                          help="Random seed for reproducibility (default: 42)")

    # verify
    sub.add_parser("verify", help="List sampled images")

    args = parser.parse_args()

    dispatch = {
        "sample":   cmd_sample,
        "verify":   cmd_verify,
    }
    dispatch[args.cmd](args)