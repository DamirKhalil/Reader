"""Debug helper: crop debug/<name>.png (2560 work scale) next to the clean image. usage: zoom.py name x0 y0 x1 y1 out"""
import sys, cv2, numpy as np
name, x0, y0, x1, y1, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
d = cv2.imread(f"debug/{name}.png"); w = cv2.resize(cv2.imread("assets/base.png"), (d.shape[1], d.shape[0]), interpolation=cv2.INTER_AREA)
cv2.imwrite(out, np.vstack([d[y0:y1, x0:x1], w[y0:y1, x0:x1]]))
