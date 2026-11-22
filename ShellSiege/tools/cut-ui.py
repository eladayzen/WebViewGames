"""Cut the UI pieces out of the concept frame (art-candidates/ui-concepts/moments.png).

The titles and buttons keep their painted lettering -- that font cannot be rebuilt
in CSS -- so they ship as transparent PNGs.

METHOD. The pieces sit on a dark, busy floor and have a dark outline of their own,
so a colour key on the background would eat the outline. Instead: find the piece's
BRIGHT FILL (cream burst, orange button, yellow pizza), close and fill it, then
grow the mask outward by the outline's thickness. Everything inside is kept as drawn.
"""
import sys, cv2, numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art-candidates/ui-concepts/moments.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'art-candidates/ui-concepts/cut'
import os; os.makedirs(OUT, exist_ok=True)

img = cv2.imread(SRC, cv2.IMREAD_COLOR)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
H, S, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)

def cut(name, box, fill, grow, close=9, keep=1):
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1]
    m = fill[y0:y1, x0:x1].astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    # fill holes: flood the outside, invert
    ff = m.copy(); h, w = ff.shape
    pad = cv2.copyMakeBorder(ff, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    cv2.floodFill(pad, None, (0, 0), 255)
    holes = cv2.bitwise_not(pad[1:-1, 1:-1])
    m = cv2.bitwise_or(m, holes)
    # biggest `keep` components (drops stray bright floor bits)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    order = np.argsort(-st[1:, cv2.CC_STAT_AREA]) + 1
    m = np.isin(lab, order[:keep]).astype(np.uint8) * 255
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow * 2 + 1, grow * 2 + 1)))
    m = cv2.GaussianBlur(m, (0, 0), 0.9)          # a soft edge, not a staircase
    rgba = np.dstack([sub, m])
    ys, xs = np.where(m > 8)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cv2.imwrite(f'{OUT}/{name}.png', rgba)
    print(name, rgba.shape[1], 'x', rgba.shape[0])
    return rgba

cream = (V > 200) & (S < 70)
orange = (H >= 8) & (H <= 24) & (S > 140) & (V > 170)
slice_ = (S > 95) & (V > 70) & (H >= 5) & (H <= 32)

# the lettering inside the burst is orange and green: count it as fill, or the letters become holes
green = (H >= 35) & (H <= 85) & (S > 90) & (V > 110)
cut('title_room_clear', (190, 20, 830, 240), cream | orange | green, grow=7, close=25)
cut('button_next_room', (295, 850, 735, 985), orange, grow=8, close=9)
# the five pizza slices, one by one, left to right
row = (320, 222, 710, 310)
sub = slice_[row[1]:row[3], row[0]:row[2]].astype(np.uint8) * 255
sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
n, lab, st, _ = cv2.connectedComponentsWithStats(sub)
comps = sorted([i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 600], key=lambda i: st[i, cv2.CC_STAT_LEFT])
print('slices found:', len(comps))
for idx, i in enumerate(comps):
    x, y, w, h = st[i, :4]
    box = (row[0] + x - 12, row[1] + y - 12, row[0] + x + w + 12, row[1] + y + h + 12)
    cut(f'pizza_{idx}', box, slice_, grow=5, close=7)
