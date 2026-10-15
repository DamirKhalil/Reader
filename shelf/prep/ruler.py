"""Debug helper: crop of the 2560-wide work image with a ruler, scaled 2x. usage: ruler.py x0 y0 x1 y1 out"""
import sys, cv2
x0, y0, x1, y1 = map(int, sys.argv[1:5])
w = cv2.resize(cv2.imread("assets/base.png"), (2560, 1732), interpolation=cv2.INTER_AREA)[y0:y1, x0:x1]
c = cv2.resize(w, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
for x in range((x0 // 10 + 1) * 10, x1, 10):
    L = 30 if x % 50 == 0 else 10
    cv2.line(c, ((x - x0) * 2, 0), ((x - x0) * 2, L), (0, 255, 255), 1)
    if x % 50 == 0: cv2.putText(c, str(x), ((x - x0) * 2 + 2, 42), 0, 0.45, (0, 255, 255), 1)
for y in range((y0 // 10 + 1) * 10, y1, 10):
    L = 30 if y % 50 == 0 else 10
    cv2.line(c, (0, (y - y0) * 2), (L, (y - y0) * 2), (0, 255, 255), 1)
    if y % 50 == 0: cv2.putText(c, str(y), (32, (y - y0) * 2 + 5), 0, 0.45, (0, 255, 255), 1)
cv2.imwrite(sys.argv[5], c)
