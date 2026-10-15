"""Phase 2 (no neural depth): depth / normals / spine ids / sprites / scene.json from the layout.

Depth convention: 1.0 = nearest (front of the frame), 0.0 = farthest (back wall of a cell).
Everything is derived from prep/layout.json (grid, spines, flat books, objects) so it is consistent
with the markup by construction: one constant depth per spine, no "plasticine" distortions.

Outputs (maps at WORK_W, colour at full base resolution):
  assets/depth.png              16-bit depth of base_holes_filled (holes under sprites are deep)
  assets/normal.png             RGB normal map (OpenGL convention, +Y up)
  assets/spine_id.png           R = id & 255, G = id >> 8, B = type (1 standing, 2 flat, 3 object, 4 frame)
  assets/base_holes_filled.png  base with the sprite areas filled
  assets/sprites/*.png          RGBA sprites (+ *_depth.png)
  assets/scene.json             cells, spines, objects, sprites, depth levels (normalised coords)
  debug/depth_color.png, debug/normals.png, debug/wobble.gif
"""
import argparse
import json
from pathlib import Path

import cv2
import imageio.v2 as imageio
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "assets"
DBG = ROOT / "debug"
WORK_W = 2560

LEVEL = {               # depth levels (1 = frame front)
    "frame": 1.0,
    "spine": 0.86, "spine_jitter": 0.025, "spine_round": 0.012,
    "flat": 0.84, "flat_jitter": 0.02,
    "gap": 0.55,        # shadow gap between two standing books
    "back": 0.0, "back_ramp": 0.35,   # back wall, plus ramp up to the frame along the cell edges
    "bust": 0.95, "object": 0.9, "poster": 0.45,
}
SPRITE_BOOK = {"cell": "r3c2", "index": 5}   # 0-based index of the standing spine in the Kerouac row
SPRITE_BUST = "bust_center"


def rng_for(i):
    return np.random.default_rng(1000 + int(i))


def px(b, W, H):
    return int(round(b[0] * W)), int(round(b[1] * H)), int(round(b[2] * W)), int(round(b[3] * H))


def object_mask(img, box, label):
    """Shape mask for an object inside its bbox. Busts / figurines via GrabCut, the rest are rectangles."""
    x0, y0, x1, y1 = box
    m = np.zeros(img.shape[:2], np.uint8)
    if label not in ("bust", "figurine"):
        m[y0:y1, x0:x1] = 1
        return m
    pad = 6
    gc = np.full(img.shape[:2], cv2.GC_BGD, np.uint8)
    gc[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] = cv2.GC_PR_BGD
    gc[y0:y1, x0:x1] = cv2.GC_PR_FGD
    # the central third of the bbox is surely the object
    cx0, cx1 = x0 + (x1 - x0) // 3, x1 - (x1 - x0) // 3
    cy0, cy1 = y0 + (y1 - y0) // 4, y1 - (y1 - y0) // 6
    gc[cy0:cy1, cx0:cx1] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(img, gc, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    m = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        m = (lbl == keep).astype(np.uint8)
    # fill holes
    ff = m.copy()
    cv2.floodFill(ff, None, (0, 0), 2)
    m[ff == 0] = 1
    return m


def dome(mask, top_level, edge_level):
    """Rounded relief inside a mask: edge_level at the silhouette, top_level at the thickest point."""
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    if dist.max() <= 0:
        return np.zeros(mask.shape, np.float32)
    t = np.sqrt(np.clip(dist / dist.max(), 0, 1))       # sqrt -> round profile
    return (edge_level + (top_level - edge_level) * t).astype(np.float32)


def build(layout, img_w):
    H, W = img_w.shape[:2]
    depth = np.zeros((H, W), np.float32)
    sid = np.zeros((H, W), np.int32)
    stype = np.zeros((H, W), np.uint8)

    # ---- frame: everything outside the cell inner rects
    frame = np.ones((H, W), bool)
    for c in layout["cells"]:
        x0, y0, x1, y1 = px(c["inner"], W, H)
        frame[y0:y1, x0:x1] = False
    depth[frame] = LEVEL["frame"]
    stype[frame] = 4

    # ---- back wall with a ramp towards the frame along the cell edges (visible inner sides of the boards)
    for c in layout["cells"]:
        x0, y0, x1, y1 = px(c["inner"], W, H)
        h, w = y1 - y0, x1 - x0
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        d_edge = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy])
        ramp_w = 0.012 * W
        r = np.clip(1 - d_edge / ramp_w, 0, 1) ** 2
        depth[y0:y1, x0:x1] = LEVEL["back"] + LEVEL["back_ramp"] * r

    spines = layout["spines"]
    objects = layout["objects"]
    # ---- objects behind books first (poster)
    for o in objects:
        if o["label"] == "frame" and o["id"].startswith("poster"):
            x0, y0, x1, y1 = px(o["bbox"], W, H)
            depth[y0:y1, x0:x1] = LEVEL["poster"]

    # ---- standing spines (constant depth + slight rounding) and the shadow gaps between them
    by_cell = {}
    for s in spines:
        by_cell.setdefault(s["cell"], []).append(s)
    for cell_key, items in by_cell.items():
        st = sorted([s for s in items if s["orientation"] == "standing"], key=lambda s: s["bbox"][0])
        for a, b in zip(st[:-1], st[1:]):          # narrow gaps between neighbours -> recessed shadow
            ax1 = px(a["bbox"], W, H)[2]; bx0 = px(b["bbox"], W, H)[0]
            if 0 < bx0 - ax1 <= 0.012 * W:
                top = max(px(a["bbox"], W, H)[1], px(b["bbox"], W, H)[1])
                bot = min(px(a["bbox"], W, H)[3], px(b["bbox"], W, H)[3])
                depth[top:bot, ax1:bx0] = LEVEL["gap"]
        for s in st:
            x0, y0, x1, y1 = px(s["bbox"], W, H)
            lvl = LEVEL["spine"] + rng_for(s["id"]).uniform(-1, 1) * LEVEL["spine_jitter"]
            s["depth"] = round(float(lvl), 4)
            w = max(1, x1 - x0)
            u = (np.arange(w) + 0.5) / w * 2 - 1
            prof = lvl + LEVEL["spine_round"] * (1 - u ** 2)
            # 1px darker seam at the border keeps neighbouring spines separable in the normal map
            depth[y0:y1, x0:x1] = prof[None, :]
            sid[y0:y1, x0:x1] = s["id"]
            stype[y0:y1, x0:x1] = 1
        for s in [s for s in items if s["orientation"] == "flat"]:
            x0, y0, x1, y1 = px(s["bbox"], W, H)
            lvl = LEVEL["flat"] + rng_for(s["id"]).uniform(-1, 1) * LEVEL["flat_jitter"]
            s["depth"] = round(float(lvl), 4)
            hgt = max(1, y1 - y0)
            v = (np.arange(hgt) + 0.5) / hgt * 2 - 1
            depth[y0:y1, x0:x1] = (lvl + 0.006 * (1 - v ** 2))[:, None]
            sid[y0:y1, x0:x1] = s["id"]
            stype[y0:y1, x0:x1] = 2

    # ---- unlabeled pixels sandwiched between books (inside stacks, under a stack lying on the
    #      standing row, unmarked thin books) are books too, slightly recessed; open back wall stays back
    objrect = np.zeros((H, W), bool)
    for o in objects:
        if not o["id"].startswith("poster"):
            ox0, oy0, ox1, oy1 = px(o["bbox"], W, H)
            objrect[oy0:oy1, ox0:ox1] = True
    for c in layout["cells"]:
        x0, y0, x1, y1 = px(c["inner"], W, H)
        lab = (stype[y0:y1, x0:x1] > 0) | (depth[y0:y1, x0:x1] >= LEVEL["poster"] - 1e-3) | objrect[y0:y1, x0:x1]
        dd = depth[y0:y1, x0:x1]
        h = y1 - y0
        for x in range(x1 - x0):
            rows = np.flatnonzero(lab[:, x])
            if len(rows) < 2:
                continue
            col = lab[:, x]
            first = rows[0]
            seg = np.flatnonzero(~col[first:]) + first          # unlabeled rows below the first label
            if not len(seg):
                continue
            below_labeled = np.r_[np.maximum.accumulate(col[::-1])[::-1][1:], False]
            fill = seg[below_labeled[seg] | (seg >= h - max(3, h // 40))]
            if len(fill):
                real = rows[(dd[rows, x] >= LEVEL["poster"] - 1e-3)]
                ref = dd[real, x].min() if len(real) else LEVEL["spine"]
                dd[fill, x] = min(ref, LEVEL["spine"]) - 0.04
        depth[y0:y1, x0:x1] = dd

    # ---- objects in front
    masks = {}
    for i, o in enumerate(objects):
        if o["id"].startswith("poster"):
            continue
        box = px(o["bbox"], W, H)
        m = object_mask(img_w, box, o["label"])
        m[frame] = 0                       # objects stay inside their cell
        masks[o["id"]] = m
        oid = 2000 + i
        o["sid"] = oid
        if o["label"] in ("bust", "figurine"):
            d = dome(m, LEVEL["bust"], LEVEL["spine"] + 0.02)
        else:
            d = np.full(m.shape, LEVEL["object"], np.float32)
        depth[m > 0] = d[m > 0]
        sid[m > 0] = oid
        stype[m > 0] = 3
        o["depth"] = LEVEL["bust"] if o["label"] in ("bust", "figurine") else LEVEL["object"]
    return depth, sid, stype, masks


def smooth_depth(depth, guide):
    """Edge-preserving smoothing guided by the photo, then a tiny blur so displacement has no hard cliffs."""
    d = cv2.bilateralFilter(depth, 7, 0.06, 3)
    try:
        d = cv2.ximgproc.guidedFilter(guide, d, 3, 1e-4)
    except Exception:  # noqa
        pass
    return np.clip(cv2.GaussianBlur(d, (0, 0), 0.8), 0, 1)


def normals_from_depth(depth, img_w, strength, detail):
    d = depth * strength
    dzdx = cv2.Sobel(d, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    dzdy = cv2.Sobel(d, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    if detail > 0:   # micro relief from the photo (embossing, text) for the glancing light
        lum = cv2.cvtColor(img_w, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        hp = lum - cv2.GaussianBlur(lum, (0, 0), 3)
        dzdx += cv2.Sobel(hp, cv2.CV_32F, 1, 0, ksize=3) / 8.0 * detail
        dzdy += cv2.Sobel(hp, cv2.CV_32F, 0, 1, ksize=3) / 8.0 * detail
    n = np.dstack([-dzdx, dzdy, np.ones_like(d)])     # image y is down, GL +Y is up
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n


def fill_book_hole(base, box, cell_inner_px):
    """Behind a pulled-out book: the dark back wall with a vertical gradient and side shadows."""
    x0, y0, x1, y1 = box
    cx0, cy0, cx1, cy1 = cell_inner_px
    # back-wall colour sampled in the empty band near the top of the cell
    sample = base[cy0 + (cy1 - cy0) // 20: cy0 + (cy1 - cy0) // 8, cx0 + 10:cx1 - 10].reshape(-1, 3)
    col = np.maximum(np.median(sample, axis=0).astype(np.float32), (34, 40, 52))   # BGR, warm dark wood
    h, w = y1 - y0, x1 - x0
    g = (0.45 + 0.75 * np.exp(-np.linspace(0, 4, h)))[:, None]   # light falls in from the top
    side = np.minimum(np.arange(w), np.arange(w)[::-1]) / max(1, w / 2)
    side = (0.55 + 0.45 * np.clip(side * 1.6, 0, 1))[None, :]   # shadows cast by the neighbours
    out = col[None, None, :] * (g * side)[..., None]
    noise = np.random.default_rng(7).normal(0, 2.0, out.shape)
    base[y0:y1, x0:x1] = np.clip(out + noise, 0, 255).astype(np.uint8)


def fill_bust_hole(base, mask, spine_tops):
    """Books behind the bust are vertical: continue each column with the same spine's texture from
    above the hole (mirror-tiled, never crossing the spine top), then TELEA along the seam."""
    ys, xs = np.where(mask > 0)
    out = base.copy()
    for x in np.unique(xs):
        col = np.where(mask[:, x] > 0)[0]
        top, bot = col.min(), col.max() + 1
        h = bot - top
        src_top = max(0, top - h, spine_tops.get(int(x), 0) + 6)
        if top - src_top < 8:
            continue
        src = base[src_top:top, x][::-1]
        if len(src) == 0:
            continue
        reps = int(np.ceil(h / len(src)))
        fill = np.concatenate([src if k % 2 == 0 else src[::-1] for k in range(reps)])[:h]
        out[top:bot, x] = fill
    m = mask.astype(np.uint8)
    edge = cv2.dilate(m, np.ones((5, 5), np.uint8)) - cv2.erode(m, np.ones((5, 5), np.uint8))
    unfilled = np.zeros_like(m)
    for x in np.unique(xs):
        col = np.where(mask[:, x] > 0)[0]
        if top_ok := (col.min() - max(0, spine_tops.get(int(x), 0) + 6) < 8):
            unfilled[col, x] = 1
    out = cv2.inpaint(out, np.maximum(edge, unfilled), 4, cv2.INPAINT_TELEA)
    # gentle shadow where the bust stood
    shadow = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 6) * 0.25
    out = (out.astype(np.float32) * (1 - shadow[..., None])).astype(np.uint8)
    return out


def sprite_rgba(base, mask, box, feather=1.2):
    x0, y0, x1, y1 = box
    rgb = base[y0:y1, x0:x1]
    a = cv2.GaussianBlur(mask[y0:y1, x0:x1].astype(np.float32), (0, 0), feather)
    a = np.clip(a * 1.2, 0, 1)
    return np.dstack([rgb, (a * 255).astype(np.uint8)])


def depth_color(d):
    return cv2.applyColorMap((np.clip(d, 0, 1) * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)


def wobble_gif(img, depth, path, frames=24, amp=8.0, width=720):
    s = width / img.shape[1]
    im = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    d = cv2.resize(depth, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_AREA)
    h, w = d.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    out = []
    for f in range(frames):
        t = 2 * np.pi * f / frames
        dx, dy = amp * np.sin(t), 0.5 * amp * np.cos(t)
        # parallax relative to the mid depth plane; backward mapping with the depth sampled at the target
        k = (d - 0.5)
        mx = (xx - dx * k).astype(np.float32)
        my = (yy - dy * k).astype(np.float32)
        fr = cv2.remap(im, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        out.append(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
    imageio.mimsave(path, out, duration=0.06, loop=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--normal-strength", type=float, default=60.0)
    ap.add_argument("--normal-detail", type=float, default=1.2)
    args = ap.parse_args()

    layout = json.loads((ROOT / "prep" / "layout.json").read_text(encoding="utf-8"))
    base = cv2.imread(str(A / "base.png"))
    BH, BW = base.shape[:2]
    w_img = cv2.resize(base, (WORK_W, round(BH * WORK_W / BW)), interpolation=cv2.INTER_AREA)
    H, W = w_img.shape[:2]

    depth_full, sid, stype, masks = build(layout, w_img)

    # ---- sprites: one Kerouac book + the central bust
    sprites = {}
    filled = base.copy()
    depth_holes = depth_full.copy()
    sx = BW / W
    ker = sorted([s for s in layout["spines"] if s["cell"] == SPRITE_BOOK["cell"] and s["orientation"] == "standing"],
                 key=lambda s: s["bbox"][0])
    book = ker[SPRITE_BOOK["index"]]
    bx0, by0, bx1, by1 = px(book["bbox"], BW, BH)
    bmask = np.zeros((BH, BW), np.uint8); bmask[by0:by1, bx0:bx1] = 1
    (A / "sprites").mkdir(exist_ok=True)
    cv2.imwrite(str(A / "sprites" / "book_kerouac.png"), sprite_rgba(base, bmask, (bx0, by0, bx1, by1), 0.6))
    cell = next(c for c in layout["cells"] if c["key"] == book["cell"])
    fill_book_hole(filled, (bx0, by0, bx1, by1), px(cell["inner"], BW, BH))
    wx0, wy0, wx1, wy1 = px(book["bbox"], W, H)
    depth_holes[wy0:wy1, wx0:wx1] = 0.12
    bd = depth_full[wy0:wy1, wx0:wx1]
    cv2.imwrite(str(A / "sprites" / "book_kerouac_depth.png"), (np.clip(bd, 0, 1) * 65535).astype(np.uint16))
    sprites["book_kerouac"] = {"file": "sprites/book_kerouac.png", "depth": "sprites/book_kerouac_depth.png",
                               "spine_id": book["id"], "bbox": book["bbox"], "depth_level": book.get("depth")}

    bust = next(o for o in layout["objects"] if o["id"] == SPRITE_BUST)
    m_w = masks[SPRITE_BUST]
    m_full = cv2.resize(m_w, (BW, BH), interpolation=cv2.INTER_LINEAR)
    m_full = (cv2.GaussianBlur(m_full.astype(np.float32), (0, 0), 1.5) > 0.5).astype(np.uint8)
    ys, xs = np.where(m_full > 0)
    pad = 8
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(BW, xs.max() + pad), min(BH, ys.max() + pad))
    cv2.imwrite(str(A / "sprites" / "bust.png"), sprite_rgba(base, m_full, box, 1.5))
    hole = cv2.dilate(m_full, np.ones((7, 7), np.uint8))
    spine_tops = {}
    for sp in layout["spines"]:
        if sp["orientation"] == "standing" and sp["cell"] == bust["cell"]:
            sx0, sy0, sx1, _ = px(sp["bbox"], BW, BH)
            for xx in range(sx0, sx1):
                spine_tops[xx] = sy0
    filled = fill_bust_hole(filled, hole, spine_tops)
    m_wd = cv2.dilate(m_w, np.ones((3, 3), np.uint8)) > 0
    # what is behind the bust: the books' depth (copy the level of the row directly above the hole)
    for x in np.unique(np.where(m_wd)[1]):
        col = np.where(m_wd[:, x])[0]
        depth_holes[col, x] = depth_full[max(0, col.min() - 2), x] if col.min() > 2 else LEVEL["spine"]
    bxw = tuple(int(round(v / sx)) for v in box)
    cv2.imwrite(str(A / "sprites" / "bust_depth.png"),
                (np.clip(depth_full[bxw[1]:bxw[3], bxw[0]:bxw[2]] * m_w[bxw[1]:bxw[3], bxw[0]:bxw[2]], 0, 1)
                 * 65535).astype(np.uint16))
    sprites["bust"] = {"file": "sprites/bust.png", "depth": "sprites/bust_depth.png", "object_id": SPRITE_BUST,
                       "bbox": [box[0] / BW, box[1] / BH, box[2] / BW, box[3] / BH]}
    cv2.imwrite(str(A / "base_holes_filled.png"), filled)
    sid_holes = sid.copy()
    sid_holes[m_wd] = 0                      # the bust lives in its sprite, not in the base

    # ---- smoothing, maps
    guide = cv2.cvtColor(w_img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    d_full = smooth_depth(depth_full, guide)
    d_holes = smooth_depth(depth_holes, guide)
    # inside a spine the depth is (almost) constant: restore the exact plateau after smoothing,
    # keeping the softened borders (2 px) from the filter
    core = cv2.erode((stype == 1).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    d_holes[core & (sid_holes > 0)] = depth_holes[core & (sid_holes > 0)]
    d_full[core] = depth_full[core]

    cv2.imwrite(str(A / "depth.png"), (np.clip(d_holes, 0, 1) * 65535).astype(np.uint16))
    n = normals_from_depth(d_holes, w_img, args.normal_strength, args.normal_detail)
    cv2.imwrite(str(A / "normal.png"), cv2.cvtColor(((n * 0.5 + 0.5) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
    idimg = np.dstack([(sid_holes & 255), (sid_holes >> 8) & 255, stype]).astype(np.uint8)
    idimg[..., 2][sid_holes == 0] = np.where(stype[sid_holes == 0] == 4, 4, 0)
    cv2.imwrite(str(A / "spine_id.png"), cv2.cvtColor(idimg, cv2.COLOR_RGB2BGR))
    cv2.imwrite(str(A / "base_2560.jpg"), w_img, [cv2.IMWRITE_JPEG_QUALITY, 94])
    filled_w = cv2.resize(filled, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(A / "base_holes_filled_2560.jpg"), filled_w, [cv2.IMWRITE_JPEG_QUALITY, 94])

    # ---- scene.json
    for c in layout["cells"]:
        c.pop("n_standing", None); c.pop("n_flat", None)
    scene = {
        "image": {"base": "base_holes_filled.png", "base_small": "base_holes_filled_2560.jpg",
                  "size": [BW, BH], "map_size": [W, H]},
        "maps": {"depth": "depth.png", "normal": "normal.png", "spine_id": "spine_id.png",
                 "spine_id_encoding": "R = id & 255, G = id >> 8, B = type (1 standing, 2 flat, 3 object, 4 frame)"},
        "depthLevels": LEVEL,
        "grid": layout["grid"],
        "cells": layout["cells"],
        "spines": layout["spines"],
        "objects": layout["objects"],
        "sprites": sprites,
        "cellTags": {t: [c["key"] for c in layout["cells"] if t in c["tags"]]
                     for t in ["king", "kafka", "kerouac", "infinite_jest", "busts"]},
    }
    (A / "scene.json").write_text(json.dumps(scene, ensure_ascii=False, indent=1), encoding="utf-8")

    # ---- debug
    DBG.mkdir(exist_ok=True)
    cv2.imwrite(str(DBG / "depth_color.png"), np.vstack([depth_color(d_full), depth_color(d_holes)]))
    cv2.imwrite(str(DBG / "normals.png"), cv2.cvtColor(((n * 0.5 + 0.5) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
    wobble_gif(w_img, d_full, DBG / "wobble.gif")
    print(f"maps {W}x{H}, base {BW}x{BH}; spines {sum(1 for s in layout['spines'] if 'depth' in s)}, "
          f"objects {len(layout['objects'])}, sprites {list(sprites)}")
    print(f"depth range {d_holes.min():.3f}..{d_holes.max():.3f}; book sprite id {book['id']} "
          f"x {book['bbox'][0]:.4f}..{book['bbox'][2]:.4f}")


if __name__ == "__main__":
    main()
