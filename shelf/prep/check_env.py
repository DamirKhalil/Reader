"""Phase 0: verify the toolchain and print versions."""
import importlib, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def ver(mod):
    try:
        m = importlib.import_module(mod)
        return getattr(m, "__version__", "ok")
    except Exception as e:  # noqa
        return f"MISSING ({e.__class__.__name__})"

print("python      ", sys.version.split()[0])
for mod in ["numpy", "cv2", "PIL", "scipy", "torch", "transformers", "imageio"]:
    print(f"{mod:12}", ver(mod))

import cv2, numpy as np
print("dnn_superres", hasattr(cv2, "dnn_superres"))
model = ROOT / "models" / "EDSR_x4.pb"
if model.exists():
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(model)); sr.setModel("edsr", 4)
    img = cv2.imread(str(ROOT / "assets" / "source.jpg"))[400:464, 600:664]
    t = time.time(); out = sr.upsample(img)
    dt = time.time() - t
    full = dt * (1280 * 866) / (64 * 64)
    print(f"EDSR x4      ok, 64x64 -> {out.shape[1]}x{out.shape[0]} in {dt:.2f}s (full frame ≈ {full/60:.1f} min)")
else:
    print("EDSR x4      model missing -> run prep/download_models.sh")

for cmd in (["node", "--version"], ["npx", "--no-install", "remotion", "versions"]):
    try:
        out = subprocess.run(cmd, cwd=ROOT / "video", capture_output=True, text=True, timeout=120).stdout.strip()
        print(" ".join(cmd[:2]), "->", out.splitlines()[0] if out else "?")
    except Exception as e:  # noqa
        print(" ".join(cmd), "FAILED", e)
