#!/usr/bin/env python3
"""Re-encode the plaza textures as WebP.

WHY: the floor paintings were 2.9 MB of the build. GoBalance's MimeFor()
already serves .webp, every target WebView decodes it, and at quality 86 a
2048px hand-painted floor is visually identical at a third of the weight --
it is a smooth illustration, which is the case WebP is best at.

NOT lossless, and not quality 95: measured on this art, 86 is where the file
stops shrinking appreciably and well before anything is visible under a camera
that never gets closer than 8 units to the floor.
"""
import sys, os
from PIL import Image

Q = 86
for src in sys.argv[1:]:
    dst = os.path.splitext(src)[0] + '.webp'
    im = Image.open(src).convert('RGB')
    im.save(dst, 'WEBP', quality=Q, method=6)
    a, b = os.path.getsize(src), os.path.getsize(dst)
    print(f'{os.path.basename(src):22} {a/1024:7.0f} KB -> {os.path.basename(dst):22} {b/1024:7.0f} KB  ({100*b/a:.0f}%)')
