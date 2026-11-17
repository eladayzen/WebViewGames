# Re-creates src/assets/*.webp from the prototype's full-size PNG sprites, sized for
# what is actually drawn: the 2D canvas is CSS pixels (no DPR), so at 1080p Mikey is
# 205 px tall. Each sprite keeps ~1.4x headroom over its on-screen size; quality 82.
# Usage (from TmntWaveSurf/): python3 tools/convert-sprites.py
from PIL import Image
import os
HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', '..', 'DawnPatrol', 'experiments', 'wave-levels')
DST = os.path.join(HERE, '..', 'src', 'assets')
HAPPY = os.path.expanduser('~/Documents/TMNT/TMNT MM Full body/start and win screen prototype/micky happy.webp')
# name -> max height in px (on screen at 1080p: mikey 205, boss 164, yacht 195, obstacles ~160, cards ~560)
SIZES = {'mikey_surf': 300, 'boss': 240, 'yacht_boss': 280, 'jetski_boss': 240,
         'obstacle_a': 240, 'obstacle_b': 220, 'projectile': 120}
def save(im, name, maxh, q=82):
    im = im.convert('RGBA'); im = im.crop(im.getbbox()) if name == 'mikey_happy' else im
    if im.height > maxh: im = im.resize((round(im.width * maxh / im.height), maxh), Image.LANCZOS)
    out = os.path.join(DST, name + '.webp'); im.save(out, 'WEBP', quality=q, method=6, alpha_quality=90)
    print(name, im.size, os.path.getsize(out) // 1024, 'KB')
for n, mh in SIZES.items(): save(Image.open(os.path.join(SRC, n + '.png')), n, mh)
if os.path.exists(HAPPY): save(Image.open(HAPPY), 'mikey_happy', 600, 80)
