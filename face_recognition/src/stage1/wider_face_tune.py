"""
WIDER FACE Threshold Tuning Runner
Shelter Monitoring System — Stage 1

Runs stage1_face_detect.tune_threshold() on the sampled WIDER FACE images
and writes a detailed report to logs/wider_face_tuning_report.md.

This script is separate from wider_face_prepare.py (which handles download/sampling)
so each concern stays in one file.

Usage:
    python src/stage1/wider_face_tune.py
    python src/stage1/wider_face_tune.py --thresholds 0.7 0.8 0.85 0.9
    python src/stage1/wider_face_tune.py --sample-dir data/environment_frames/samples/wider
"""

import json
import argparse
import numpy as np
from pathlib import Path
from datetime import datetime
from PIL import Image
from mtcnn import MTCNN

# ─────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────

BASE_DIR   = Path(__file__).resolve().parents[2]   # face_recognition/
SAMPLE_DIR = BASE_DIR / "data" / "environment_frames" / "samples" / "wider"
LOG_DIR    = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ── Initialise detector once at module level ──
print("Loading MTCNN detector…")
detector = MTCNN()
print("MTCNN ready.")

# ─────────────────────────────────────────────
# Category ground truth
# ─────────────────────────────────────────────
#
# What SHOULD happen per category at an ideal threshold:
#
#   angled   → face IS present (just rotated) → alert should NOT fire
#   occluded → face is partially hidden       → alert SHOULD fire
#   noface   → no usable face                 → alert SHOULD fire
#
# Use filename prefix (set by wider_face_prepare.py) to assign ground truth.

GROUND_TRUTH = {
    "angled":   False,   # alert_flag should be False (face present)
    "occluded": True,    # alert_flag should be True  (face hidden)
    "noface":   True,    # alert_flag should be True  (no face)
}


def get_category(filename: str) -> str | None:
    """Extract category prefix from filename set by wider_face_prepare.py."""
    stem = Path(filename).stem
    for cat in GROUND_TRUTH:
        if stem.startswith(cat):
            return cat
    return None


# ─────────────────────────────────────────────
# Per-image detection (inline, no file I/O)
# ─────────────────────────────────────────────

def run_detection(image_path: Path, threshold: float) -> dict:
    """
    Run MTCNN on one image at the given threshold.
    Returns a result dict with detection info.
    """
    pil_img   = Image.open(image_path).convert("RGB")
    image_rgb = np.array(pil_img)

    raw       = detector.detect_faces(image_rgb)
    valid     = [d for d in raw if d["confidence"] >= threshold]

    alert_flag = len(valid) == 0
    top_conf   = max((d["confidence"] for d in raw), default=0.0)

    return {
        "image":       image_path.name,
        "category":    get_category(image_path.name),
        "threshold":   threshold,
        "raw_count":   len(raw),
        "valid_count": len(valid),
        "alert_flag":  alert_flag,
        "top_conf":    round(top_conf, 4),
    }


# ─────────────────────────────────────────────
# Tuning loop
# ─────────────────────────────────────────────

def run_tuning(sample_dir: Path,
               thresholds: list[float]) -> dict[float, list[dict]]:
    """
    Run detection at every threshold across all sampled images.

    Returns:
        { threshold: [result_dict, ...] }
    """
    images = sorted(
        p for p in sample_dir.iterdir()
        if p.suffix.lower() in (".jpg", ".jpeg", ".png")
    )

    if not images:
        sys.exit(f"ERROR: No images found in {sample_dir}\n"
                 f"Run wider_face_prepare.py sample first.")

    print(f"\n  Found {len(images)} images in {sample_dir}")

    results = {}
    for thr in thresholds:
        print(f"\n  ── Threshold {thr} ──")
        thr_results = []
        for img_path in images:
            r = run_detection(img_path, thr)
            thr_results.append(r)
            status = "ALERT" if r["alert_flag"] else "ok   "
            print(f"    [{status}] {r['image']:<55} conf={r['top_conf']:.3f}")
        results[thr] = thr_results

    return results


# ─────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────

def compute_metrics(results: list[dict]) -> dict:
    """
    Compute TP/FP/FN/TN and derived metrics for one threshold.

    Ground truth: GROUND_TRUTH dict maps category → expected alert_flag.
    Uncategorised images (no prefix) are skipped.
    """
    tp = fp = fn = tn = skipped = 0

    for r in results:
        cat = r["category"]
        if cat is None or cat not in GROUND_TRUTH:
            skipped += 1
            continue

        expected = GROUND_TRUTH[cat]
        actual   = r["alert_flag"]

        if expected and actual:       tp += 1   # alert should fire, did fire
        elif expected and not actual: fn += 1   # alert should fire, didn't
        elif not expected and actual: fp += 1   # alert shouldn't fire, did
        else:                         tn += 1   # no alert expected, none fired

    total    = tp + fp + fn + tn
    accuracy = (tp + tn) / total if total else 0
    precision = tp / (tp + fp) if (tp + fp) else 0
    recall    = tp / (tp + fn) if (tp + fn) else 0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) else 0)

    return {
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "skipped": skipped,
        "accuracy":  round(accuracy, 3),
        "precision": round(precision, 3),
        "recall":    round(recall, 3),
        "f1":        round(f1, 3),
    }


# ─────────────────────────────────────────────
# Report writer
# ─────────────────────────────────────────────

def write_report(all_results: dict[float, list[dict]],
                 sample_dir: Path,
                 report_path: Path):
    """
    Write a markdown report to logs/wider_face_tuning_report.md
    """
    lines = [
        "# WIDER FACE Threshold Tuning Report",
        f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Sample dir:** `{sample_dir}`",
        f"**Thresholds tested:** {list(all_results.keys())}",
        "",
        "---",
        "",
        "## Ground Truth Mapping",
        "",
        "| Category | Expected alert_flag | Meaning |",
        "|----------|--------------------|-----------------------------------------|",
        "| angled   | False              | Face present but rotated — should pass  |",
        "| occluded | True               | Partially hidden — alert should fire    |",
        "| noface   | True               | No usable face — alert should fire      |",
        "",
        "---",
        "",
        "## Results by Threshold",
        "",
    ]

    best_thr  = None
    best_f1   = -1.0

    for thr, results in all_results.items():
        m = compute_metrics(results)

        lines += [
            f"### Threshold = {thr}",
            "",
            f"| Metric    | Value |",
            f"|-----------|-------|",
            f"| Accuracy  | {m['accuracy']} |",
            f"| Precision | {m['precision']} |",
            f"| Recall    | {m['recall']} |",
            f"| F1 Score  | {m['f1']} |",
            f"| TP        | {m['tp']} |",
            f"| FP        | {m['fp']} |",
            f"| FN        | {m['fn']} |",
            f"| TN        | {m['tn']} |",
            "",
        ]

        # Per-image breakdown
        lines += [
            "| Image | Category | Expected Alert | Actual Alert | Top Conf | Result |",
            "|-------|----------|---------------|--------------|----------|--------|",
        ]
        for r in results:
            cat      = r["category"] or "unknown"
            expected = GROUND_TRUTH.get(cat)
            actual   = r["alert_flag"]
            if expected is None:
                verdict = "—"
            elif expected == actual:
                verdict = "✓ correct"
            else:
                verdict = "✗ WRONG"
            exp_str = str(expected) if expected is not None else "?"
            lines.append(
                f"| {r['image']:<55} | {cat:<8} | {exp_str:<13} "
                f"| {str(actual):<12} | {r['top_conf']:.3f}    | {verdict} |"
            )

        lines.append("")

        if m["f1"] > best_f1:
            best_f1  = m["f1"]
            best_thr = thr

    # Summary and recommendation
    lines += [
        "---",
        "",
        "## Summary Comparison",
        "",
        "| Threshold | Accuracy | Precision | Recall | F1 Score |",
        "|-----------|----------|-----------|--------|----------|",
    ]
    for thr, results in all_results.items():
        m = compute_metrics(results)
        lines.append(
            f"| {thr}       | {m['accuracy']} | {m['precision']} "
            f"| {m['recall']} | {m['f1']} |"
        )

    lines += [
        "",
        "---",
        "",
        "## Recommendation",
        "",
        f"**Best threshold by F1 score: `{best_thr}` (F1 = {best_f1:.3f})**",
        "",
        "> Update `CONFIDENCE_THRESHOLD` in `src/stage1/stage1_face_detect.py`",
        "> and record the rationale in `logs/confidence_threshold_log.md`.",
        "",
        "### Decision notes",
        "- If **FN > 0** (missed alerts): lower the threshold — "
        "masked/occluded faces are slipping through undetected.",
        "- If **FP > 0** (false alerts on angled faces): "
        "acceptable for a shelter security context; "
        "angled faces are less common at entry points.",
        "- Prioritise **Recall** over Precision — "
        "missing a real threat is worse than a false alarm.",
    ]

    report_path.write_text("\n".join(lines))
    print(f"\n  Report written → {report_path}")


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="WIDER FACE tuning runner for Stage 1 MTCNN"
    )
    parser.add_argument(
        "--sample-dir", default=str(SAMPLE_DIR),
        help=f"Directory of sampled images (default: {SAMPLE_DIR})"
    )
    parser.add_argument(
        "--thresholds", nargs="+", type=float, default=[0.7, 0.8, 0.9],
        help="Confidence thresholds to test (default: 0.7 0.8 0.9)"
    )
    parser.add_argument(
        "--report", default=str(LOG_DIR / "wider_face_tuning_report.md"),
        help="Output report path"
    )
    args = parser.parse_args()

    sample_dir  = Path(args.sample_dir)
    report_path = Path(args.report)

    print("\n══════════════════════════════════════════════════")
    print("  WIDER FACE Threshold Tuning — Stage 1 MTCNN")
    print("══════════════════════════════════════════════════")

    all_results = run_tuning(sample_dir, sorted(args.thresholds))

    # Save raw results as JSON too
    json_path = LOG_DIR / "wider_face_tuning_raw.json"
    with open(json_path, "w") as f:
        json.dump(
            {str(k): v for k, v in all_results.items()},
            f, indent=2
        )

    write_report(all_results, sample_dir, report_path)

    # Print summary to terminal
    print("\n── Summary ──\n")
    print(f"  {'Threshold':<12} {'Accuracy':<10} {'Recall':<10} {'F1':<8}")
    print(f"  {'─'*12} {'─'*10} {'─'*10} {'─'*8}")
    for thr, results in sorted(all_results.items()):
        m = compute_metrics(results)
        print(f"  {thr:<12} {m['accuracy']:<10} {m['recall']:<10} {m['f1']:<8}")

    print(f"\n  Full report → {report_path}")
    print(f"  Raw JSON    → {json_path}\n")


if __name__ == "__main__":
    main()