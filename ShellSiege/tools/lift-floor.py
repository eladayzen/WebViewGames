#!/usr/bin/env python3
"""Lift a generated floor painting to the plaza's brightness and write a webp.

WHY THIS EXISTS. A floor is most of the screen, so its value sets the value of
the whole room. The first plaza measured mean value 0.480 and was called "much
too dark"; the shipped warm floor measures 0.829. A new generation comes back
at whatever exposure the model felt like -- the first three came back at 0.57,
0.67 and 0.72 -- so each is lifted to a target rather than regenerated.

A GAMMA, NOT A MULTIPLY. Scaling value by a constant clips the highlights
(painted lines and bright panels go flat white); a power curve V -> V**g
raises the mid-tones and leaves 1.0 at 1.0. g is found by bisection so the
mean lands on the target. Hue and saturation are untouched.

    python3 tools/lift-floor.py in.png out.webp [target=0.78] [quality=80]
"""
import sys, colorsys, warnings
from PIL import Image
warnings.filterwarnings('ignore')   # Pillow's getdata() deprecation, irrelevant here

def mean_v(im):
    small = im.convert('RGB').resize((128, 128))
    return sum(colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2] for r, g, b in small.getdata()) / (128 * 128)

def lift(im, target):
    # V**g with g < 1 brightens. Bisect g on the small image, apply to the big one.
    small = im.convert('RGB').resize((128, 128))
    base = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in small.getdata()]
    lo, hi = 0.2, 1.0
    for _ in range(30):
        g = (lo + hi) / 2
        m = sum(v ** g for _, _, v in base) / len(base)
        # mean(V**g) FALLS as g rises: too bright needs a LARGER g, too dark a smaller one
        lo, hi = (g, hi) if m > target else (lo, g)
    g = (lo + hi) / 2
    # a lookup table makes the full-size pass cheap: scale each channel by V'/V
    out = Image.new('RGB', im.size)
    px, dst = im.convert('RGB').load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, gg, b = px[x, y]
            v = max(r, gg, b) / 255
            if v <= 0:
                dst[x, y] = (r, gg, b); continue
            k = (v ** g) / v
            dst[x, y] = (min(255, round(r * k)), min(255, round(gg * k)), min(255, round(b * k)))
    return out, g

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    target = float(sys.argv[3]) if len(sys.argv) > 3 else 0.78
    quality = int(sys.argv[4]) if len(sys.argv) > 4 else 80
    im = Image.open(src).convert('RGB')
    before = mean_v(im)
    out, g = lift(im, target)
    out.save(dst, quality=quality, method=6)
    print(f'{src}: value {before:.3f} -> {mean_v(out):.3f} (gamma {g:.3f}), {out.size}, -> {dst}')
