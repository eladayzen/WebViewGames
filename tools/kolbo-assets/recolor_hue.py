#!/usr/bin/env python3
"""Shift one hue range of a sprite sheet to another hue. Offline recolour.

Why not a runtime tint: Pixi's tint MULTIPLIES, so it can only ever darken.
The Foot ninja is already near-black charcoal with one bright crimson sash,
and the sash is the only thing that makes him readable against the street.
Any tint dark enough to distinguish a variant also takes the sash out, which
is the opposite of what a variant is for.

So the variant is a real second sheet, made here for nothing. Only the wrap
colour moves; the charcoal body is desaturated and falls below the saturation
floor, so it is left exactly as it was and the two variants still read as the
same character.
"""
import sys
import colorsys
import numpy as np
from PIL import Image


def recolor(src, dst, from_deg, to_deg, span=40.0, sat_gain=1.0, val_gain=1.0,
            sat_floor=0.35):
    im = Image.open(src).convert('RGBA')
    a = np.asarray(im, dtype=np.float32) / 255.0
    h, w = a.shape[:2]
    flat = a.reshape(-1, 4)
    out = flat.copy()
    shift = ((to_deg - from_deg) % 360.0) / 360.0
    lo = span / 360.0

    for i, (r, g, b, al) in enumerate(flat):
        if al < 0.04:
            continue
        hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
        if ss < sat_floor:
            continue                       # charcoal, ink, eye white: untouched
        # circular distance to the source hue
        d = abs(((hh * 360.0 - from_deg + 180.0) % 360.0) - 180.0) / 360.0
        if d > lo:
            continue
        nh = (hh + shift) % 1.0
        out[i, :3] = colorsys.hsv_to_rgb(nh, min(1.0, ss * sat_gain),
                                         min(1.0, vv * val_gain))

    Image.fromarray((np.clip(out.reshape(h, w, 4), 0, 1) * 255).astype(np.uint8)).save(dst)
    moved = int(((np.abs(out[:, :3] - flat[:, :3]).sum(1) > 0.004)).sum())
    return {'pixels_recoloured': moved, 'of_opaque': int((flat[:, 3] > 0.04).sum())}


if __name__ == '__main__':
    print(recolor(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])))
