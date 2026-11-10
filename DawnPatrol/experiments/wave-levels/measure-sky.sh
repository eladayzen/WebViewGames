#!/bin/sh
# usage: ./measure-sky.sh <level> "<y1,y2,..>" [x0frac x1frac]  -> skyline speed from two frames 0.25 s apart
cd "$(dirname "$0")"
L=$1; ROWS=$2; X0=${3:-0.40}; X1=${4:-0.70}
EVAL_WAIT=600 EVALS="frames[cur].contentWindow.__fixedT=5.0|frames[cur].contentWindow.__fixedT=5.25" node capture.mjs "levels.html?level=$L" sky$L 2500,3600 >/dev/null 2>&1
python3 - "$L" "$ROWS" "$X0" "$X1" <<'PY'
import sys, numpy as np
from PIL import Image, ImageFilter
L,rows,x0f,x1f=sys.argv[1],[float(v) for v in sys.argv[2].split(',')],float(sys.argv[3]),float(sys.argv[4])
def hp(p):
    im=Image.open(p).convert('L'); return np.asarray(im.filter(ImageFilter.GaussianBlur(2)),dtype=np.float32)-np.asarray(im.filter(ImageFilter.GaussianBlur(30)),dtype=np.float32)
A=hp(f'shots/sky{L}-1.png'); B=hp(f'shots/sky{L}-2.png'); H,W=A.shape
for fy in rows:
    best=None
    for yc in range(int(H*fy)-10,int(H*fy)+11,10):
        for xc in range(int(W*x0f),int(W*x1f),16):
            v=A[yc-15:yc+15,xc:xc+140].var()
            if best is None or v>best[0]: best=(v,yc,xc)
    v,yc,xc=best; T=A[yc-15:yc+15,xc:xc+140]
    res=[(np.abs(B[yc-15:yc+15,xc-s:xc-s+140]-T).mean(),s) for s in range(-20,min(300,xc))]
    e,s=min(res); st=np.abs(B[yc-15:yc+15,xc:xc+140]-T).mean()
    print(f'level {L} row y={fy:.2f}: shift {s}px in 0.25 s -> {s/W/0.25:.2f} screen-widths/s (err {e:.1f} vs static {st:.1f})')
PY
