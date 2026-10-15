"""Phase 1: grid, spines, flat stacks and objects -> prep/layout.json + debug images.

All coordinates written to disk are normalised to 0..1 (x by image width, y by image height),
so the result does not depend on the upscale factor. Manual corrections live in prep/overrides.json
and are applied on top of the automatic detection (see README section in that file).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy.ndimage import uniform_filter1d, median_filter, binary_opening, binary_closing, label
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[1]
BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "base.png"
OVR = ROOT / "prep" / "overrides.json"
OUT = ROOT / "prep" / "layout.json"
DBG = ROOT / "debug"

GRID_W = 1280          # working width for grid detection
WORK_W = 2560          # working width for spine detection
MIN_SPINE = 0.004      # min spine width, fraction of frame width
BLOCK = 8              # block size (px @ WORK_W) for orientation classification


# ----------------------------------------------------------------------------- helpers
def resize_w(img, w):
    s = w / img.shape[1]
    return cv2.resize(img, (w, round(img.shape[0] * s)), interpolation=cv2.INTER_AREA)


def wood_mask(bgr):
    """Dark warm-brown pixels: the frame (and the back panel, which is the same material)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = (hsv[..., i].astype(int) for i in range(3))
    return ((h >= 3) & (h <= 22) & (s >= 35) & (v >= 15) & (v <= 150)).astype(np.uint8)


def plateau(profile, centre, thr_frac=0.5, reach=40):
    """Edges of the plateau around `centre` where profile stays above base + thr_frac*(peak-base)."""
    lo, hi = max(0, centre - reach), min(len(profile), centre + reach + 1)
    seg = profile[lo:hi]
    peak = profile[centre]
    base = np.percentile(seg, 10)
    thr = base + thr_frac * (peak - base)
    a = centre
    while a > lo and profile[a - 1] >= thr:
        a -= 1
    b = centre
    while b < hi - 1 and profile[b + 1] >= thr:
        b += 1
    return a, b + 1


def snap_to_edge(grad_profile, pos, radius):
    lo, hi = max(0, pos - radius), min(len(grad_profile), pos + radius + 1)
    return lo + int(np.argmax(grad_profile[lo:hi]))


def load_overrides():
    if OVR.exists():
        return json.loads(OVR.read_text(encoding="utf-8"))
    return {}


# ----------------------------------------------------------------------------- grid
def detect_grid(img, ovr):
    g = resize_w(img, GRID_W)
    H, W = g.shape[:2]
    m = wood_mask(g)
    px = uniform_filter1d(m.mean(0).astype(float), 5)
    py = uniform_filter1d(m.mean(1).astype(float), 3)
    posts, _ = find_peaks(px, height=0.55, distance=W // 14, width=3)
    shelves, _ = find_peaks(py, height=0.55, distance=H // 10, width=3)
    # a post is only accepted if it is not glued to the image border (border strips handled separately)
    posts = [int(p) for p in posts if 25 < p < W - 25]
    shelves = [int(s) for s in shelves if 10 < s < H - 10]
    # a shelf whose free space below it is a sliver (< 4% of frame) closes the grid: no cell row after it
    if shelves and H - shelves[-1] < 0.04 * H:
        bottom_shelf = shelves.pop()
    else:
        bottom_shelf = None

    go = ovr.get("grid", {})
    if "posts_x" in go:
        posts = [round(x * W) for x in go["posts_x"]]
    if "shelves_y" in go:
        shelves = [round(y * H) for y in go["shelves_y"]]

    gray = cv2.cvtColor(g, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
    gy = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))

    # Hough check: long, near-vertical / near-horizontal segments
    edges = cv2.Canny(cv2.GaussianBlur(g, (3, 3), 0), 40, 120)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 360, threshold=80, minLineLength=H // 8, maxLineGap=6)
    vlines, hlines = [], []
    for x1, y1, x2, y2 in (lines.reshape(-1, 4) if lines is not None else []):
        if abs(x2 - x1) <= 3 and abs(y2 - y1) > H // 8:
            vlines.append((x1 + x2) / 2)
        elif abs(y2 - y1) <= 3 and abs(x2 - x1) > W // 10:
            hlines.append((y1 + y2) / 2)

    def refine(profile, grad, centres, n, lines_):
        out = []
        for c in centres:
            a, b = plateau(profile, c)
            # snap plateau edges to the strongest gradient nearby (in a band of the image)
            a2, b2 = snap_to_edge(grad, a, 4), snap_to_edge(grad, b, 4)
            hough = [l for l in lines_ if abs(l - a2) <= 3 or abs(l - b2) <= 3]
            out.append({"centre": c, "a": int(a2), "b": int(b2), "hough_support": len(hough)})
        return out

    gxp = gx.mean(0)
    gyp = gy.mean(1)
    post_info = refine(px, gxp, posts, W, vlines)
    shelf_info = refine(py, gyp, shelves, H, hlines)
    bottom_info = refine(py, gyp, [bottom_shelf], H, hlines)[0] if bottom_shelf else None

    # Per-band refinement to absorb slight tilt / lens distortion:
    # for every cell row we re-measure post edges inside that row only, and vice versa.
    row_edges = [0] + [s["a"] for s in shelf_info] + [bottom_info["a"] if bottom_info else H]
    row_edges_b = [0] + [s["b"] for s in shelf_info] + [H]
    col_edges_a = [0] + [p["a"] for p in post_info] + [W]
    col_edges_b = [0] + [p["b"] for p in post_info] + [W]

    # border strips: left frame edge and right image edge
    left_border = plateau(px, 2, reach=40)[1] if px[:10].mean() > 0.55 else 0

    TOL = 5  # px @ GRID_W: local re-measurement may only nudge the global line this much

    def clamp(local, glob):
        return local if abs(local - glob) <= TOL else glob

    cells = []
    nrows, ncols = len(shelf_info) + 1, len(post_info) + 1
    for r in range(nrows):
        y0, y1 = row_edges_b[r], row_edges[r + 1]
        band_m = m[y0:y1]
        bpx = uniform_filter1d(band_m.mean(0).astype(float), 3)
        bgx = gx[y0:y1].mean(0)
        for c in range(ncols):
            # local post edges (re-measured in this row band)
            if c == 0:
                xa = left_border
            else:
                p = post_info[c - 1]
                xa = clamp(snap_to_edge(bgx, plateau(bpx, p["centre"], reach=30)[1], 3), p["b"])
            if c == ncols - 1:
                xb = W
            else:
                p = post_info[c]
                xb = clamp(snap_to_edge(bgx, plateau(bpx, p["centre"], reach=30)[0], 3), p["a"])
            # local shelf edges (re-measured in this column)
            col_m = m[:, xa:xb]
            cpy = uniform_filter1d(col_m.mean(1).astype(float), 3)
            cgy = gy[:, xa:xb].mean(1)
            ya = 0 if r == 0 else clamp(snap_to_edge(cgy, plateau(cpy, shelf_info[r - 1]["centre"], reach=25)[1], 3),
                                        shelf_info[r - 1]["b"])
            if r < nrows - 1:
                yb = clamp(snap_to_edge(cgy, plateau(cpy, shelf_info[r]["centre"], reach=25)[0], 3), shelf_info[r]["a"])
            elif bottom_info:
                yb = clamp(snap_to_edge(cgy, plateau(cpy, bottom_info["centre"], reach=25)[0], 3), bottom_info["a"])
            else:
                yb = H
            outer = [col_edges_a[c] if c else 0, row_edges[r] if r else 0,
                     col_edges_b[c + 1] if c < ncols - 1 else W, row_edges_b[r + 1] if r < nrows - 1 else H]
            partial = []
            if r == 0:
                partial.append("top")
            if r == nrows - 1 and yb >= H - 2:
                partial.append("bottom")
            if c == ncols - 1:
                partial.append("right")
            cells.append({
                "id": r * ncols + c, "key": f"r{r}c{c}", "row": r, "col": c,
                "bbox": [outer[0] / W, outer[1] / H, outer[2] / W, outer[3] / H],
                "inner": [xa / W, ya / H, xb / W, yb / H],
                "partial": partial, "tags": [],
            })

    grid = {
        "rows": nrows, "cols": ncols,
        "posts": [{"x0": p["a"] / W, "x1": p["b"] / W, "hough_support": p["hough_support"]} for p in post_info],
        "shelves": [{"y0": s["a"] / H, "y1": s["b"] / H, "hough_support": s["hough_support"]} for s in shelf_info],
        "left_border_x1": left_border / W,
        "bottom_shelf": {"y0": bottom_info["a"] / H, "y1": bottom_info["b"] / H} if bottom_info else None,
    }
    for key, tags in ovr.get("cell_tags", {}).items():
        for cell in cells:
            if cell["key"] == key:
                cell["tags"] = sorted(set(cell["tags"]) | set(tags))
    return grid, cells, m


# ----------------------------------------------------------------------------- spines
def coherent_edges(gray):
    """Edges that stay consistent along their length (spine borders), text averages out."""
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    cv = np.abs(cv2.blur(gx, (1, 31)))   # signed Gx averaged vertically
    ch = np.abs(cv2.blur(gy, (81, 1)))   # signed Gy averaged over a long horizontal run:
    return gx, gy, cv, ch                # flat books survive, medallions / short title bands do not


def classify_blocks(cv, ch, wood, x0, y0, x1, y1, iso=None):
    """Per-block label inside a cell: 1 = standing (vertical structure), 2 = flat, 0 = background,
    3 = object candidate (strong texture without a dominant straight-line direction)."""
    hb, wb = (y1 - y0) // BLOCK, (x1 - x0) // BLOCK
    if hb < 2 or wb < 2:
        return np.zeros((max(hb, 1), max(wb, 1)), np.uint8)
    def pool(a):
        a = a[y0:y0 + hb * BLOCK, x0:x0 + wb * BLOCK]
        return a.reshape(hb, BLOCK, wb, BLOCK).mean((1, 3))
    V, Hh, Wd = pool(cv), pool(ch), pool(wood.astype(np.float32))
    energy = V + Hh
    thr = max(6.0, np.percentile(energy, 35) * 0.8)
    lab = np.zeros((hb, wb), np.uint8)
    lab[(energy > thr) & (V >= 1.15 * Hh)] = 1
    lab[(energy > thr) & (Hh > 1.15 * V)] = 2
    lab[(Wd > 0.85) & (energy < 2 * thr)] = 0
    if iso is not None:
        I = pool(iso)
        lab[(I > 1.5 * max(energy.mean(), 1)) & (energy < 0.6 * I) & (Wd < 0.6)] = 3
    lab = median_filter(lab, size=3)
    return lab


def spine_boundaries(profile, min_w, x_off):
    prof = uniform_filter1d(profile, 3)
    pk, _ = find_peaks(prof, distance=max(2, min_w), prominence=np.percentile(prof, 60) * 0.25)
    return [int(p) + x_off for p in pk]


def detect_cell_content(cell, img_w, cv, ch, gx, gy, wood_w, ovr_cell, iso=None, obj_rects=(),
                        lab_img=None, gray_img=None):
    H, W = cv.shape
    x0, y0, x1, y1 = (round(cell["inner"][0] * W), round(cell["inner"][1] * H),
                      round(cell["inner"][2] * W), round(cell["inner"][3] * H))
    # keep a small margin away from the frame
    x0, x1, y0, y1 = x0 + 3, x1 - 3, y0 + 3, y1 - 2
    lab = classify_blocks(cv, ch, wood_w, x0, y0, x1, y1, iso)
    hb, wb = lab.shape
    min_w = max(3, round(MIN_SPINE * W))
    obj_blocks = np.zeros((hb, wb), bool)
    for rc in obj_rects:  # objects (auto + overrides) are never books
        bx0 = int((rc[0] * W - x0) // BLOCK); by0 = int((rc[1] * H - y0) // BLOCK)
        bx1 = int(np.ceil((rc[2] * W - x0) / BLOCK)); by1 = int(np.ceil((rc[3] * H - y0) / BLOCK))
        obj_blocks[max(0, by0):max(0, by1), max(0, bx0):max(0, bx1)] = True
    lab = lab.copy()
    lab[obj_blocks & (lab == 2)] = 0   # object texture must not create flat books
    flat = binary_opening(lab == 2, structure=np.ones((1, 3)))

    def rect_to_blocks(rc):
        bx0 = int((rc[0] * W - x0) // BLOCK); by0 = int((rc[1] * H - y0) // BLOCK)
        bx1 = int(np.ceil((rc[2] * W - x0) / BLOCK)); by1 = int(np.ceil((rc[3] * H - y0) / BLOCK))
        return slice(max(0, by0), max(0, by1)), slice(max(0, bx0), max(0, bx1))

    for rc in ovr_cell.get("exclude", []):
        sy, sx = rect_to_blocks(rc); flat[sy, sx] = False
    for rc in ovr_cell.get("flat", []):
        sy, sx = rect_to_blocks(rc); flat[sy, sx] = True

    spines, flats = [], []
    ch_h = y1 - y0
    bottom = y1
    # ---- 1. where do standing books stand?  judged in the bottom band, which is almost always books
    by0 = bottom - int(0.35 * ch_h)
    band_cv, band_ch = cv[by0:bottom, x0:x1], ch[by0:bottom, x0:x1]
    win = max(9, 3 * min_w)   # wide window: ornaments (medallions, bands) must not punch holes
    Vx = uniform_filter1d(band_cv.mean(0), win)
    Hx = uniform_filter1d(band_ch.mean(0), win)
    standing_x = (Vx > 0.45 * Hx) & (Vx + Hx > 2.0)
    xs_img = np.arange(x0, x1)
    for rc in ovr_cell.get("exclude", []):
        if rc[3] * H > by0:
            standing_x[(xs_img >= rc[0] * W) & (xs_img < rc[2] * W)] = False
    for rc in ovr_cell.get("standing", []):
        standing_x[(xs_img >= rc[0] * W) & (xs_img < rc[2] * W)] = True
    # remove short runs
    runs = np.flatnonzero(np.diff(np.r_[0, standing_x.astype(int), 0]))
    for ra, rb in zip(runs[::2], runs[1::2]):
        if rb - ra < 2 * min_w:
            standing_x[ra:rb] = False
    runs = np.flatnonzero(np.diff(np.r_[0, standing_x.astype(int), 0]))

    # ---- 2. spine boundaries. Three cues, each a median/fraction over the band rows (robust to text):
    #   colour step  : |Lab mean of k px left - k px right|
    #   dark valley  : the shadow gap between two books (separates identical spines of a series)
    #   line support : fraction of rows crossed by a coherent vertical edge
    sub = band_cv
    submax = np.maximum(sub, np.maximum(np.roll(sub, 1, 1), np.roll(sub, -1, 1)))
    t = np.percentile(sub[:, standing_x], 65) if standing_x.any() else 1.0
    support = (submax > t).mean(0).astype(np.float32)
    k = max(3, min_w // 2)
    lb = lab_img[by0:bottom, x0:x1]
    mean_k = cv2.blur(lb, (k, 1))
    left = np.roll(mean_k, k // 2 + 1, axis=1)
    right = np.roll(mean_k, -(k // 2 + 1), axis=1)
    step = np.median(np.linalg.norm(left - right, axis=2), axis=0)
    gb = gray_img[by0:bottom, x0:x1]
    d = 2
    valley = np.median(np.clip((np.roll(gb, d, 1) + np.roll(gb, -d, 1)) / 2 - gb, 0, None), axis=0)
    def nrm(v):
        q = np.percentile(v[standing_x], 90) if standing_x.any() else 1.0
        return np.clip(v / (q + 1e-6), 0, 2)
    prof = uniform_filter1d(nrm(step) + 0.8 * nrm(valley) + 0.6 * support, 3)
    prof[~standing_x] = 0
    prof[:k + 1] = 0; prof[-k - 1:] = 0
    pk, _ = find_peaks(prof, height=0.75, distance=max(2, min_w), prominence=0.35)
    bnds = [int(p) + x0 for p in pk]
    for ra, rb in zip(runs[::2], runs[1::2]):
        bnds += [x0 + ra, x0 + rb]
    if "boundaries" in ovr_cell:          # full manual list replaces the automatic one
        bnds = [round(xn * W) for xn in ovr_cell["boundaries"]]
        for xa_, xb_ in zip(bnds[:-1], bnds[1:]):
            standing_x[max(0, xa_ - x0):max(0, xb_ - x0)] = True
    for xn in ovr_cell.get("add_boundaries", []):
        bnds.append(round(xn * W))
    for xn in ovr_cell.get("remove_boundaries", []):
        if bnds:
            j = int(np.argmin([abs(b_ - xn * W) for b_ in bnds]))
            if abs(bnds[j] - xn * W) <= 4 * min_w:
                bnds.pop(j)
    bnds = sorted(set(bnds))
    merged = []
    for b_ in bnds:
        if merged and b_ - merged[-1] < min_w:
            merged[-1] = (merged[-1] + b_) // 2
        else:
            merged.append(b_)

    # ---- 3. top of every spine: per-spine edge scores + skyline DP over the whole cell
    gys = cv2.GaussianBlur(gy, (0, 0), 1.2)
    full_t = np.percentile(cv[y0:bottom, x0:x1], 65)
    def line_support(x):
        xa_, xb_ = min(max(x0, x - 1), x1 - 1), max(min(x1, x + 2), min(max(x0, x - 1), x1 - 1) + 1)
        c = cv[y0:bottom, xa_:xb_].max(1)
        return (c > full_t).astype(np.float32)
    min_h = int(0.25 * ch_h)
    n = bottom - y0
    cands = []          # (a, b, score[n])
    for a_, b_ in zip(merged[:-1], merged[1:]):
        ia, ib = a_ - x0, b_ - x0
        if b_ - a_ < min_w or standing_x[ia:ib].mean() < 0.6:
            continue
        strip = gys[y0:bottom, a_ + 1:max(a_ + 2, b_ - 1)]
        sm = strip.mean(1)
        # horizontal edge across the whole width; a book top is usually darker above (shadow), so the
        # dark->bright direction is preferred
        span = uniform_filter1d(np.clip(sm, 0, None) + 0.35 * np.clip(-sm, 0, None), 3)
        sup = np.maximum(line_support(a_), line_support(b_))
        win = max(6, ch_h // 12)
        csum = np.r_[0, np.cumsum(sup)]
        ys = np.arange(n)
        below = (csum[np.minimum(n, ys + win)] - csum[ys]) / win
        above = (csum[ys] - csum[np.maximum(0, ys - win)]) / win
        score = span / (np.percentile(span, 99) + 1e-6) * (0.35 + np.clip(below - above, 0, 1))
        score[n - min_h:] = -1                              # a book is at least min_h tall
        score[:2] = -1
        # ceiling: first solid flat run above the shelf where this spine's side borders have ended
        ba, bb = max(0, ia // BLOCK), min(wb, max(ia // BLOCK + 1, ib // BLOCK))
        flat_frac = flat[:, ba:bb].mean(1) if bb > ba else np.zeros(hb)
        sup_blk = np.array([sup[r * BLOCK:(r + 1) * BLOCK].mean() if r * BLOCK < n else 0 for r in range(hb)])
        ceil_y, run = 0, 0
        for r in range(hb - 1 - min_h // BLOCK, -1, -1):
            run = run + 1 if (flat_frac[r] >= 0.5 and sup_blk[r] < 0.5) else 0
            if run >= 2:
                ceil_y = (r + run) * BLOCK - BLOCK // 2
                break
        for rc in ovr_cell.get("exclude", []):
            if rc[0] * W < b_ and rc[2] * W > a_ and rc[3] * H < bottom - min_h:
                ceil_y = max(ceil_y, int(rc[3] * H) - y0)
        score[:max(0, min(ceil_y, n - min_h - 1))] = -1
        cands.append((a_, b_, np.clip(score, -1, 1.5)))

    if cands:
        step_ = 2
        states = np.arange(0, n, step_)
        S = np.array([[sc[st:st + step_].max() for st in states] for _, _, sc in cands])
        lam, cap = 0.35, max(8, ch_h // 10)
        diff = np.minimum(np.abs(states[:, None] - states[None, :]), cap) / cap   # 0..1
        trans = -lam * diff
        acc = S[0].copy(); back = []
        for i in range(1, len(cands)):
            tot = acc[:, None] + trans
            back.append(np.argmax(tot, 0))
            acc = tot.max(0) + S[i]
        path = [int(np.argmax(acc))]
        for bk in reversed(back):
            path.append(int(bk[path[-1]]))
        path.reverse()
        for (a_, b_, sc), si in zip(cands, path):
            st = states[si]
            top = y0 + st + int(np.argmax(sc[st:st + step_]))
            spines.append({"bbox": [a_, top, b_, bottom], "orientation": "standing"})
    for tp in ovr_cell.get("tops", []):            # manual top: [x0, x1, y] (normalised)
        for sp_ in spines:
            cxm = (sp_["bbox"][0] + sp_["bbox"][2]) / 2
            if tp[0] * W <= cxm <= tp[1] * W:
                sp_["bbox"][1] = round(tp[2] * H)

    # flat books never overlap a standing spine
    for sp_ in spines:
        sa, st, sb, _ = sp_["bbox"]
        flat[max(0, (st - y0) // BLOCK + 1):, max(0, (sa - x0) // BLOCK):(sb - x0) // BLOCK + 1] = False

    # ---- flat stacks: |Sobel-y| averaged over the width -> book boundaries
    lblf, nf = label(binary_closing(flat, structure=np.ones((1, 3))))
    for i in range(1, nf + 1):
        comp = lblf == i
        if comp.sum() < 4:
            continue
        rows = np.where(comp.any(1))[0]; cs = np.where(comp.any(0))[0]
        fx0, fx1 = x0 + cs.min() * BLOCK, x0 + (cs.max() + 1) * BLOCK
        fy0, fy1 = y0 + rows.min() * BLOCK, y0 + (rows.max() + 1) * BLOCK
        if fx1 - fx0 < 6 * min_w:
            continue
        prof = (ch[fy0:fy1, fx0:fx1].mean(1) * 0.7 + np.abs(gy[fy0:fy1, fx0:fx1]).mean(1) * 0.3)
        pk, _ = find_peaks(uniform_filter1d(prof, 3), distance=max(2, min_w),
                           prominence=np.percentile(prof, 60) * 0.25)
        bnds = sorted(set([fy0] + [fy0 + int(p) for p in pk] + [fy1]))
        merged = []
        for b in bnds:
            if merged and b - merged[-1] < min_w:
                merged[-1] = (merged[-1] + b) // 2
            else:
                merged.append(b)
        for a, b in zip(merged[:-1], merged[1:]):
            # horizontal extent of this book: columns where the flat mask covers the row band
            ra, rb = (a - y0) // BLOCK, max((a - y0) // BLOCK + 1, (b - y0) // BLOCK)
            cc = np.where(comp[ra:rb].any(0))[0]
            if not len(cc):
                continue
            bx0, bx1 = x0 + cc.min() * BLOCK, x0 + (cc.max() + 1) * BLOCK
            flats.append({"bbox": [bx0, a, bx1, b], "orientation": "flat"})

    # drop "flat books" that are mostly inside standing spines (aligned title bands, top caps)
    occ = np.zeros((y1 - y0 + 1, x1 - x0 + 1), bool)
    for sp_ in spines:
        sa, st, sb, sbt = sp_["bbox"]
        occ[max(0, st - y0):sbt - y0, max(0, sa - x0):sb - x0] = True
    keep = []
    for f in flats:
        fa, ft, fb, fbt = f["bbox"]
        area = max(1, (fb - fa) * (fbt - ft))
        inside = occ[max(0, ft - y0):fbt - y0, max(0, fa - x0):fb - x0].sum()
        if inside < 0.4 * area and fb - fa >= 0.12 * (x1 - x0):
            keep.append(f)
    flats = keep
    for rc in ovr_cell.get("flat_books", []):      # exact manual flat books replace overlapping auto ones
        fa, ft, fb, fbt = round(rc[0] * W), round(rc[1] * H), round(rc[2] * W), round(rc[3] * H)
        flats = [f for f in flats if not (f["bbox"][0] < fb and f["bbox"][2] > fa and
                                          min(f["bbox"][3], fbt) - max(f["bbox"][1], ft) >
                                          0.5 * (f["bbox"][3] - f["bbox"][1]))]
        flats.append({"bbox": [fa, ft, fb, fbt], "orientation": "flat", "manual": True})
    return spines, flats, lab, (x0, y0, x1, y1)


def detect_objects(cells, cv, ch, iso, wood_w, ovr):
    """Busts / figurines / framed pictures: blocks with strong texture but no dominant line direction,
    grouped into compact blobs. Overrides can drop auto objects or add manual ones."""
    H, W = cv.shape
    cand = np.zeros((H // BLOCK + 1, W // BLOCK + 1), bool)
    for cell in cells:
        x0, y0, x1, y1 = (round(cell["inner"][0] * W) + 3, round(cell["inner"][1] * H) + 3,
                          round(cell["inner"][2] * W) - 3, round(cell["inner"][3] * H) - 2)
        lab = classify_blocks(cv, ch, wood_w, x0, y0, x1, y1, iso)
        bx, by = x0 // BLOCK, y0 // BLOCK
        cand[by:by + lab.shape[0], bx:bx + lab.shape[1]] |= lab == 3
    cand = binary_closing(cand, structure=np.ones((3, 3)))
    cand = binary_opening(cand, structure=np.ones((2, 2)))
    lbl, n = label(cand)
    objs = []
    for i in range(1, n + 1):
        ys, xs = np.where(lbl == i)
        area = len(ys)
        bw, bh = np.ptp(xs) + 1, np.ptp(ys) + 1
        frac = area * BLOCK * BLOCK / (W * H)
        if frac < 0.0008 or frac > 0.02 or area / (bw * bh) < 0.4 or not 0.6 < bh / bw < 3.5:
            continue
        x0, y0, x1, y1 = xs.min() * BLOCK, ys.min() * BLOCK, (xs.max() + 1) * BLOCK, (ys.max() + 1) * BLOCK
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        cell = next((c for c in cells if c["inner"][0] * W <= cx <= c["inner"][2] * W
                     and c["inner"][1] * H <= cy <= c["inner"][3] * H), None)
        objs.append({"id": f"auto_obj{len(objs)}", "label": "object", "source": "auto",
                     "cell": cell["key"] if cell else None,
                     "bbox": [x0 / W, y0 / H, x1 / W, y1 / H]})
    oo = ovr.get("objects", {})
    drop = set(oo.get("drop_auto", []))
    objs = [o for o in objs if o["id"] not in drop]
    for o in oo.get("add", []):
        objs.append({"label": "object", "source": "override", **o})
    return objs


# ----------------------------------------------------------------------------- debug drawing
def palette(i):
    rng = np.random.default_rng(i * 7919 + 13)
    hue = rng.integers(0, 180)
    c = np.uint8([[[hue, 200 + rng.integers(0, 55), 230]]])
    return tuple(int(v) for v in cv2.cvtColor(c, cv2.COLOR_HSV2BGR)[0, 0])


def put(img, text, org, scale=0.5, color=(255, 255, 255), thick=1):
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thick + 2, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


def draw_grid(img, grid, cells):
    H, W = img.shape[:2]
    out = (img * 0.55).astype(np.uint8)
    for p in grid["posts"]:
        cv2.rectangle(out, (round(p["x0"] * W), 0), (round(p["x1"] * W), H), (0, 140, 255), 2)
    for s in grid["shelves"]:
        cv2.rectangle(out, (0, round(s["y0"] * H)), (W, round(s["y1"] * H)), (255, 140, 0), 2)
    for c in cells:
        x0, y0, x1, y1 = (round(c["inner"][0] * W), round(c["inner"][1] * H),
                          round(c["inner"][2] * W), round(c["inner"][3] * H))
        col = (80, 80, 255) if c["partial"] else (80, 255, 80)
        cv2.rectangle(out, (x0, y0), (x1, y1), col, 3)
        put(out, f'{c["id"]} {c["key"]}', (x0 + 10, y0 + 40), 1.2, (255, 255, 255), 2)
        if c["tags"]:
            put(out, ",".join(c["tags"]), (x0 + 10, y0 + 80), 0.9, (120, 230, 255), 2)
    return out


def draw_items(img, items, title, fill=0.45):
    H, W = img.shape[:2]
    out = (img * 0.35).astype(np.uint8)
    over = out.copy()
    for it in items:
        x0, y0, x1, y1 = (round(it["bbox"][0] * W), round(it["bbox"][1] * H),
                          round(it["bbox"][2] * W), round(it["bbox"][3] * H))
        col = palette(it["num"]) if "num" in it else palette(hash(it["id"]) % 9999)
        cv2.rectangle(over, (x0, y0), (x1, y1), col, -1)
        cv2.rectangle(out, (x0, y0), (x1, y1), col, 2)
    out = cv2.addWeighted(over, fill, out, 1 - fill, 0)
    for it in items:
        x0, y0, x1, y1 = (round(it["bbox"][0] * W), round(it["bbox"][1] * H),
                          round(it["bbox"][2] * W), round(it["bbox"][3] * H))
        label_ = str(it["id"]) if isinstance(it.get("id"), str) else str(it.get("num", it.get("id")))
        if it.get("orientation") == "standing":
            # vertical labels: draw rotated text into the spine
            sz = 0.5 if x1 - x0 > 18 else 0.38
            tmp = np.zeros((max(1, x1 - x0), 60, 3), np.uint8)
            put(tmp, label_, (2, min(x1 - x0 - 3, 16)), sz)
            tmp = cv2.rotate(tmp, cv2.ROTATE_90_COUNTERCLOCKWISE)
            ty1 = min(y1 - 4, H); ty0 = max(0, ty1 - tmp.shape[0])
            region = out[ty0:ty1, x0:x0 + tmp.shape[1]]
            m = tmp[-region.shape[0]:, :region.shape[1]].max(2) > 0
            region[m] = tmp[-region.shape[0]:, :region.shape[1]][m]
        else:
            put(out, label_, (x0 + 4, min(y1 - 3, y0 + 18)), 0.5)
    put(out, title, (20, 40), 1.1, (255, 255, 255), 2)
    return out


# ----------------------------------------------------------------------------- main
def main():
    ovr = load_overrides()
    img = cv2.imread(str(BASE))
    if img is None:
        sys.exit(f"missing {BASE} (run prep/upscale.py first)")
    grid, cells, _ = detect_grid(img, ovr)

    w = resize_w(img, WORK_W)
    H, W = w.shape[:2]
    gray = cv2.cvtColor(w, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx, gy, cv, ch = coherent_edges(gray)
    iso = cv2.blur(np.hypot(gx, gy), (5, 5))
    lab_img = cv2.cvtColor(w, cv2.COLOR_BGR2LAB).astype(np.float32)
    wood_w = wood_mask(w)
    objects = detect_objects(cells, cv, ch, iso, wood_w, ovr)

    items = []
    block_vis = np.zeros((H, W, 3), np.uint8)
    for cell in cells:
        oc = ovr.get("cells", {}).get(cell["key"], {})
        rects = [o["bbox"] for o in objects if o.get("cell") == cell["key"]]
        sp, fl, lab, (x0, y0, x1, y1) = detect_cell_content(cell, W, cv, ch, gx, gy, wood_w, oc, iso, rects,
                                                            lab_img, gray)
        vis = np.zeros(lab.shape + (3,), np.uint8)
        vis[lab == 1] = (60, 200, 60); vis[lab == 2] = (230, 120, 40); vis[lab == 3] = (40, 40, 230)
        vis = cv2.resize(vis, (lab.shape[1] * BLOCK, lab.shape[0] * BLOCK), interpolation=cv2.INTER_NEAREST)
        vh, vw = block_vis[y0:y0 + vis.shape[0], x0:x0 + vis.shape[1]].shape[:2]
        block_vis[y0:y0 + vh, x0:x0 + vw] = vis[:vh, :vw]
        for it in sp + fl:
            bx0, by0, bx1, by1 = it["bbox"]
            items.append({
                "cell": cell["key"], "orientation": it["orientation"],
                "bbox": [bx0 / W, by0 / H, bx1 / W, by1 / H],
                "centerX": (bx0 + bx1) / 2 / W, "centerY": (by0 + by1) / 2 / H,
                "tags": list(cell["tags"]),
            })

    # spines partly hidden behind an object (bust in front of books, photo leaning on them)
    for it in items:
        occ = []
        for o in objects:
            ox0, oy0, ox1, oy1 = o["bbox"]
            bx0, by0, bx1, by1 = it["bbox"]
            iw, ih = min(bx1, ox1) - max(bx0, ox0), min(by1, oy1) - max(by0, oy0)
            if iw > 0 and ih > 0 and iw * ih > 0.15 * (bx1 - bx0) * (by1 - by0):
                occ.append(o["id"])
        if occ:
            it["occluded_by"] = occ

    # stable ids: row-major by cell, then left->right (standing) / top->bottom (flat)
    order = {c["key"]: c["id"] for c in cells}
    items.sort(key=lambda s: (order[s["cell"]], s["orientation"] != "standing", s["centerX"], s["centerY"]))
    for i, s in enumerate(items):
        s["id"] = i + 1
        s["num"] = i + 1
    for c in cells:
        c["n_standing"] = sum(1 for s in items if s["cell"] == c["key"] and s["orientation"] == "standing")
        c["n_flat"] = sum(1 for s in items if s["cell"] == c["key"] and s["orientation"] == "flat")

    layout = {"source": "assets/base.png", "size": [img.shape[1], img.shape[0]],
              "grid": grid, "cells": cells,
              "spines": [{k: v for k, v in s.items() if k != "num"} for s in items],
              "objects": objects}
    layout["objects"] = [{k: v for k, v in o.items() if k != "num"} for o in objects]
    OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1), encoding="utf-8")

    DBG.mkdir(exist_ok=True)
    cv2.imwrite(str(DBG / "grid.png"), draw_grid(w, grid, cells))
    std = [s for s in items if s["orientation"] == "standing"]
    fl = [s for s in items if s["orientation"] == "flat"]
    cv2.imwrite(str(DBG / "spines.png"), draw_items(w, std, f"standing spines: {len(std)}"))
    cv2.imwrite(str(DBG / "flat.png"), draw_items(w, fl, f"flat books: {len(fl)}"))
    for i, o in enumerate(objects):
        o["num"] = i + 1
    cv2.imwrite(str(DBG / "objects.png"), draw_items(w, objects, f"objects: {len(objects)}", fill=0.35))
    cv2.imwrite(str(DBG / "blocks.png"), cv2.addWeighted(w, 0.5, block_vis, 0.5, 0))

    # stats
    print(f"grid {grid['rows']}x{grid['cols']} = {len(cells)} cells; "
          f"posts hough support {[p['hough_support'] for p in grid['posts']]}, "
          f"shelves {[s['hough_support'] for s in grid['shelves']]}")
    print(f"standing {len(std)}, flat {len(fl)}, objects {len(objects)}")
    for r in range(grid["rows"]):
        row = [c for c in cells if c["row"] == r]
        print("  " + "  ".join(f'{c["key"]}:{c["n_standing"]:>2}s/{c["n_flat"]:>2}f' for c in row))


if __name__ == "__main__":
    main()
