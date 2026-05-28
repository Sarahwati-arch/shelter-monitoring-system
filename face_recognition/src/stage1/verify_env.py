"""
Day 1 — Environment Verification Script
Shelter Monitoring System

Run this after pip-installing dependencies to confirm everything
is wired up correctly before touching any camera frames.

Usage:
    python src/stage1/verify_env.py
"""

import sys
import importlib


def check(label: str, fn):
    try:
        result = fn()
        print(f"  ✓  {label}: {result}")
        return True
    except Exception as e:
        print(f"  ✗  {label}: {e}")
        return False


def main():
    print("\n══════════════════════════════════════════")
    print("  Shelter Monitoring — Environment Check")
    print("══════════════════════════════════════════\n")

    all_ok = True

    # ── Python version ──
    ver = sys.version_info
    ok = ver >= (3, 9)
    print(f"  {'✓' if ok else '✗'}  Python: {ver.major}.{ver.minor}.{ver.micro}"
          f"  (need ≥ 3.9)")
    all_ok &= ok

    # ── Core packages ──
    packages = [
        ("torch",           lambda: __import__("torch").__version__),
        ("torchvision",     lambda: __import__("torchvision").__version__),
        ("opencv-python",   lambda: __import__("cv2").__version__),
        ("numpy",           lambda: __import__("numpy").__version__),
        ("Pillow",          lambda: __import__("PIL").__version__),
        ("mtcnn",           lambda: __import__("mtcnn").__version__),
        ("deepface",        lambda: __import__("deepface").__version__),
        ("insightface",     lambda: __import__("insightface").__version__),
        ("facenet-pytorch", lambda: __import__("facenet_pytorch").__version__),
    ]

    print("\n── Package versions ──")
    for name, fn in packages:
        all_ok &= check(name, fn)

    # ── CUDA ──
    print("\n── CUDA / GPU ──")

    def cuda_check():
        import torch
        available = torch.cuda.is_available()
        if available:
            gpu = torch.cuda.get_device_name(0)
            mem = torch.cuda.get_device_properties(0).total_memory / 1e9
            return f"AVAILABLE — {gpu} ({mem:.1f} GB VRAM)"
        return "NOT available (CPU-only mode; acceptable for dev)"

    all_ok &= check("CUDA", cuda_check)

    def cudnn_check():
        import torch
        if torch.cuda.is_available():
            return f"cuDNN {torch.backends.cudnn.version()}"
        return "N/A (no CUDA)"

    check("cuDNN", cudnn_check)

    # ── MTCNN smoke test ──
    print("\n── MTCNN smoke test ──")

    def mtcnn_smoke():
        from mtcnn import MTCNN
        import numpy as np
        det = MTCNN()
        dummy = np.zeros((224, 224, 3), dtype=np.uint8)
        result = det.detect_faces(dummy)
        return f"loaded OK (detected {len(result)} faces in blank image)"

    all_ok &= check("MTCNN init", mtcnn_smoke)

    # ── Folder structure ──
    print("\n── Folder structure ──")
    from pathlib import Path

    base = Path(__file__).resolve().parents[2]
    required_dirs = [
        "data/faces",
        "data/environment_frames",
        "models",
        "src/stage1",
        "src/stage2",
        "logs",
    ]
    for d in required_dirs:
        full = base / d
        full.mkdir(parents=True, exist_ok=True)
        ok = full.is_dir()
        print(f"  {'✓' if ok else '✗'}  {d}/")
        all_ok &= ok

    # ── Summary ──
    print("\n══════════════════════════════════════════")
    if all_ok:
        print("  ALL CHECKS PASSED — ready for Stage 1")
    else:
        print("  SOME CHECKS FAILED — fix above before proceeding")
    print("══════════════════════════════════════════\n")


if __name__ == "__main__":
    main()