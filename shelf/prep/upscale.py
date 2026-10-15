"""Phase 1.1: upscale source.jpg -> assets/base.png.
Order of preference: Real-ESRGAN (if weights present) -> EDSR x4 (OpenCV dnn_superres, tiled) -> Lanczos x2 + unsharp."""
import sys, time
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "source.jpg"
DST = ROOT / "assets" / "base.png"
TILE, PAD = 160, 12


def edsr_tiled(img, scale=4):
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(ROOT / "models" / f"EDSR_x{scale}.pb"))
    sr.setModel("edsr", scale)
    h, w = img.shape[:2]
    out = np.zeros((h * scale, w * scale, 3), np.uint8)
    tiles = [(y, x) for y in range(0, h, TILE) for x in range(0, w, TILE)]
    t0 = time.time()
    for i, (y, x) in enumerate(tiles):
        y0, x0 = max(0, y - PAD), max(0, x - PAD)
        y1, x1 = min(h, y + TILE + PAD), min(w, x + TILE + PAD)
        up = sr.upsample(img[y0:y1, x0:x1])
        ty, tx = (y - y0) * scale, (x - x0) * scale
        th, tw = (min(h, y + TILE) - y) * scale, (min(w, x + TILE) - x) * scale
        out[y * scale:y * scale + th, x * scale:x * scale + tw] = up[ty:ty + th, tx:tx + tw]
        print(f"\rtile {i + 1}/{len(tiles)}  {time.time() - t0:.0f}s", end="", flush=True)
    print()
    return out


def lanczos_unsharp(img, scale=2):
    up = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)
    blur = cv2.GaussianBlur(up, (0, 0), 1.2)
    return cv2.addWeighted(up, 1.4, blur, -0.4, 0)


def main():
    img = cv2.imread(str(SRC))
    if (ROOT / "models" / "EDSR_x4.pb").exists():
        out, method = edsr_tiled(img, 4), "EDSR x4"
    else:
        out, method = lanczos_unsharp(img, 2), "Lanczos x2 + unsharp"
    cv2.imwrite(str(DST), out)
    print(f"{method}: {img.shape[1]}x{img.shape[0]} -> {out.shape[1]}x{out.shape[0]} -> {DST}")


if __name__ == "__main__":
    sys.exit(main())
