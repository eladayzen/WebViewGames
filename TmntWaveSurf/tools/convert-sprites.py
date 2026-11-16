# Re-creates src/assets/*.webp from the prototype's PNG sprites.
# Usage (from TmntWaveSurf/): python3 tools/convert-sprites.py
from PIL import Image
import os
SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'DawnPatrol', 'experiments', 'wave-levels')
DST = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
for n in ['mikey_surf', 'obstacle_a', 'obstacle_b', 'boss', 'projectile', 'jetski_boss']:
    im = Image.open(os.path.join(SRC, n + '.png'))
    im.save(os.path.join(DST, n + '.webp'), 'WEBP', quality=90, method=6, alpha_quality=100)
    print(n, im.size)
