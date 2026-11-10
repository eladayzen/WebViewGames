#!/usr/bin/env python3
"""Match one sprite sheet's saturation and brightness to another's.

Why this exists. Each Kolbo generation renders the character at its own
"exposure": Leo's armed walk came back 10 points more saturated and 11
brighter than his idle, at an identical hue. Side by side on a sheet that is
invisible. ALTERNATING, it is not -- the idle and the walk swap every time
the player starts or stops, and the character visibly changes colour at the
moment of the swap.

So this is only worth doing between clips of the SAME character. Matching
different characters to each other would flatten the variation that makes
them look hand-painted, and nobody sees two turtles' skins adjacent anyway.

Hue is deliberately untouched: the generations already agree on it (88 for
the skin, 209 for the mask), and pushing hue is how a blue mask turns teal.
Only S and V are scaled, by a single global gain each, measured over every
opaque coloured pixel -- which is what makes it an exposure match rather
than a recolour.
"""
import sys
import colorsys
import numpy as np
from PIL import Image


def _sv(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im, dtype=np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    v = mx
    # Opaque, and actually coloured: the ink outline and the near-white eyes
    # carry no exposure information and would drag both means toward the
    # middle.
    m = (alpha > 0.78) & (s > 0.18) & (v > 0.12)
    return im, s, v, m


def match(src, ref, dst):
    _, s_ref, v_ref, m_ref = _sv(ref)
    im, s_src, v_src, m_src = _sv(src)
    if m_ref.sum() < 50 or m_src.sum() < 50:
        raise SystemExit('not enough coloured pixels to measure')

    gs = float(s_ref[m_ref].mean() / s_src[m_src].mean())
    gv = float(v_ref[m_ref].mean() / v_src[m_src].mean())

    a = np.asarray(im, dtype=np.float32) / 255.0
    out = a.copy()
    h, w = a.shape[:2]
    flat = a[..., :3].reshape(-1, 3)
    res = np.empty_like(flat)
    for i, (r, g, b) in enumerate(flat):
        hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
        res[i] = colorsys.hsv_to_rgb(hh, min(1.0, ss * gs), min(1.0, vv * gv))
    out[..., :3] = res.reshape(h, w, 3)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(dst)
    return {'sat_gain': round(gs, 4), 'val_gain': round(gv, 4)}


if __name__ == '__main__':
    print(match(sys.argv[1], sys.argv[2], sys.argv[3]))
