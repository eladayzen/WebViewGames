#!/usr/bin/env python3
"""Pull a generated warm-stone floor back from "orange carpet" to "warm stone".

WHY THIS EXISTS AND WHY IT IS NOT A RE-ROLL. The generation that won on
composition (flat, centred medallion, irregular flagstones, real tile craft)
came out at mean saturation 0.506 / mean value 0.910 -- a sunlit terracotta
that is correct in direction and overshot in amount. Elad asked for "a bit
more casual -- just a bit", and for the floor to stop being grey; he did not
ask for the floor to become the loudest thing on the screen.

The drawing was right, only the amount was wrong, so this grades rather than
regenerates -- the same call tools/grade-floor.py made in the other
direction, when the first floor came out mint.

MEASURED REFERENCE POINTS (mean saturation / mean value, 2048 square):
  the old grey plaza   0.225 / 0.480   <- "much too dark", "too grey"
  this generation raw  0.506 / 0.910   <- too loud, and near-clipping white
  graded output        ~0.40 / ~0.82   <- warm stone, and 1.7x the old light

VALUE IS PULLED MUCH LESS THAN SATURATION, on purpose. "Less dark" is the
instruction; "less orange" is the correction. Dropping the value hard would
undo the one thing the new art is for.
"""
import sys, colorsys
from PIL import Image

SAT = 0.78      # x saturation
VAL = 0.90      # x value

def grade(src, dst, sat=SAT, val=VAL):
    im = Image.open(src).convert('RGB')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, min(1.0, ss * sat), min(1.0, vv * val))
            px[x, y] = (int(r2 * 255 + 0.5), int(g2 * 255 + 0.5), int(b2 * 255 + 0.5))
    im.save(dst, quality=92)
    print(f'{dst}  {w}x{h}')

if __name__ == '__main__':
    a = sys.argv[1:]
    grade(a[0], a[1], float(a[2]) if len(a) > 2 else SAT, float(a[3]) if len(a) > 3 else VAL)
