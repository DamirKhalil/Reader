"""Phase 3: export render-ready textures + compact scene data into video/public/shelf/.

color.jpg    base_holes_filled, 4096 px wide (sRGB)
depth.png    8-bit depth (1 = near) at map resolution
normal.png   normal map (copied)
spine_id.png id map (copied, sample with NEAREST)
cell_id.png  R = cell id + 1 for pixels inside a cell's inner rect (0 = frame)
sprites/     sprite RGBA + depth
scene.json   cells / spines (flat arrays for a data texture) / objects / sprites / tags
"""
import json
import shutil
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "assets"
OUT = ROOT / "video" / "public" / "shelf"
COLOR_W = 4096


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "sprites").mkdir(exist_ok=True)
    scene = json.loads((A / "scene.json").read_text(encoding="utf-8"))

    base = cv2.imread(str(A / "base_holes_filled.png"))
    h = round(base.shape[0] * COLOR_W / base.shape[1])
    cv2.imwrite(str(OUT / "color.jpg"), cv2.resize(base, (COLOR_W, h), interpolation=cv2.INTER_AREA),
                [cv2.IMWRITE_JPEG_QUALITY, 93])

    d16 = cv2.imread(str(A / "depth.png"), cv2.IMREAD_UNCHANGED)
    cv2.imwrite(str(OUT / "depth.png"), (d16.astype(np.float32) / 65535 * 255 + 0.5).astype(np.uint8))
    shutil.copy(A / "normal.png", OUT / "normal.png")
    shutil.copy(A / "spine_id.png", OUT / "spine_id.png")
    for f in (A / "sprites").glob("*.png"):
        if f.name.endswith("_depth.png"):
            d = cv2.imread(str(f), cv2.IMREAD_UNCHANGED)
            cv2.imwrite(str(OUT / "sprites" / f.name), (d.astype(np.float32) / 65535 * 255 + 0.5).astype(np.uint8))
        else:
            shutil.copy(f, OUT / "sprites" / f.name)

    H, W = d16.shape
    cid = np.zeros((H, W), np.uint8)
    for c in scene["cells"]:
        x0, y0, x1, y1 = (round(c["inner"][0] * W), round(c["inner"][1] * H),
                          round(c["inner"][2] * W), round(c["inner"][3] * H))
        cid[y0:y1, x0:x1] = c["id"] + 1
    cv2.imwrite(str(OUT / "cell_id.png"), cid)

    cell_by_key = {c["key"]: c for c in scene["cells"]}
    rng = np.random.default_rng(42)
    spines = []
    for s in scene["spines"]:
        c = cell_by_key[s["cell"]]
        spines.append({
            "id": s["id"], "cell": c["id"], "row": c["row"], "col": c["col"],
            "type": 1 if s["orientation"] == "standing" else 2,
            "bbox": [round(v, 5) for v in s["bbox"]],
            "cx": round(s["centerX"], 5), "cy": round(s["centerY"], 5),
            "depth": s.get("depth", 0.85),
            "gloss": round(float(rng.uniform(0, 1) ** 2), 3),   # few glossy spines, most matte
            "occluded": bool(s.get("occluded_by")),
        })
    web = {
        "colorSize": [COLOR_W, h], "mapSize": [W, H],
        "aspect": W / H,
        "cells": [{"id": c["id"], "key": c["key"], "row": c["row"], "col": c["col"],
                   "inner": [round(v, 5) for v in c["inner"]], "tags": c["tags"], "partial": c["partial"]}
                  for c in scene["cells"]],
        "spines": spines,
        "objects": [{k: o[k] for k in ("id", "label", "cell", "bbox") if k in o} for o in scene["objects"]],
        "sprites": scene["sprites"],
        "cellTags": scene["cellTags"],
        "depthLevels": scene["depthLevels"],
    }
    (OUT / "scene.json").write_text(json.dumps(web, ensure_ascii=False), encoding="utf-8")
    print("exported to", OUT, "| color", COLOR_W, "x", h, "| spines", len(spines))


if __name__ == "__main__":
    main()
