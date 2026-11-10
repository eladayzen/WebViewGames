#!/bin/sh
# usage: ./measure-speed.sh <level> <tag>  -> renders t=5.0 and t=5.1, prints right-to-left speed per height band
cd "$(dirname "$0")"
L=$1; TAG=$2
[ -n "$NOCAP" ] || EVALS="frames[cur].contentWindow.__fixedT=5.0|frames[cur].contentWindow.__fixedT=5.125" node capture.mjs "levels.html?level=$L" spd-$TAG 2500,3600 >/dev/null 2>&1
python3 - "$TAG" <<'PY'
import sys, numpy as np
from PIL import Image, ImageFilter
tag=sys.argv[1]
def hp(path):  # band-pass: kill paper grain (small blur) and static shading gradients (minus big blur)
    im=Image.open(path).convert('L')
    return np.asarray(im.filter(ImageFilter.GaussianBlur(3)),dtype=np.float32)-np.asarray(im.filter(ImageFilter.GaussianBlur(30)),dtype=np.float32)
A=hp(f'shots/spd-{tag}-1.png')
B=hp(f'shots/spd-{tag}-2.png')
H,W=A.shape
# template tracking: pick the most textured 160x36 patch in each height band of frame A, find it in frame B
for name,fy in [('crest/top 0.30',0.30),('upper face 0.45',0.45),('mid face 0.60',0.60),('lower face 0.75',0.75),('trough/bottom 0.92',0.92)]:
    best=None
    for yc in range(int(H*fy)-30, int(H*fy)+31, 10):
        for xc in range(int(W*0.38), int(W*0.70), 16):
            v=A[yc-18:yc+18, xc:xc+160].var()
            if best is None or v>best[0]: best=(v,yc,xc)
    v,yc,xc=best; T=A[yc-18:yc+18, xc:xc+160]
    res=[]
    for dy in range(-6,7,2):
        for s in range(-40, min(440, xc)):
            P=B[yc-18+dy:yc+18+dy, xc-s:xc-s+160]
            res.append((np.abs(P-T).mean(), s, dy))
    e,s,dy=min(res); static=np.abs(B[yc-18:yc+18, xc:xc+160]-T).mean()
    print(f'{name:22s} shift {s:4d}px -> {s/W/0.125:5.2f} screen-widths/s  (dy {dy}, err {e:.1f} vs static {static:.1f})')
PY
