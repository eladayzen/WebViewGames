#!/bin/sh
# Recapture level screenshots, level-2 motion stills and reference comparisons.
cd "$(dirname "$0")"
for n in 1 2 3; do node capture.mjs "levels.html?level=$n" levels-$n 3500 >/dev/null 2>&1; mv shots/levels-$n-1.png shots/levels-$n.png; done
node capture.mjs "levels.html?level=2" motion 3000,3750,4500,5250 2>&1 | grep -i "exception\|error"
i=1; for l in a b c d; do mv shots/motion-$i.png shots/motion-2-$l.png; i=$((i+1)); done
cd shots && python3 - <<'PY'
from PIL import Image, ImageDraw
ref=Image.open('../ref/frame_005.jpg').convert('RGB'); H=540
r=ref.resize((int(ref.width*H/ref.height),H))
for n in (1,2,3):
    l=Image.open(f'levels-{n}.png').convert('RGB').resize((960,540))
    out=Image.new('RGB',(r.width+970,H),'white'); out.paste(r,(0,0)); out.paste(l,(r.width+10,0))
    d=ImageDraw.Draw(out)
    for x0,w in ((0,r.width),(r.width+10,960)):
        for fy in (0.30,0.88): d.line([(x0,int(H*fy)),(x0+w,int(H*fy))],fill='red')
        d.line([(x0+int(w*0.25),0),(x0+int(w*0.25),H)],fill='yellow')
    out.save(f'ref-vs-level-{n}.png')
ims=[Image.open(f'motion-2-{c}.png').resize((960,540)) for c in 'abcd']
sh=Image.new('RGB',(1920,1080))
for i,im in enumerate(ims): sh.paste(im,((i%2)*960,(i//2)*540))
sh.save('motion-2-sheet.png')
PY
