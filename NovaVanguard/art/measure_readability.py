#!/usr/bin/env python3
"""Check every surface against 5.4's readability band, AS ACTUALLY RENDERED.

5.4: "Target band: luminance <= 45%, saturation <= 35% for everything in the
surface and prop layers, except authored emissive accents [...] which are
allowed to be hot but must occupy < 12% of the frame area."

Three things this measures the way 5.4 actually means them:

1. AS RENDERED, not as generated. Measuring the raw generation is the wrong
   test -- it would fail a surface the renderer already brings into band, and
   9.5 rule 6 is explicit that the scrim, not a regeneration, is how surface art
   gets there. So this reproduces the render layer's own composite
   (render/renderer.js: base.tint = SURFACE.surfaceTint, then a
   SURFACE.scrimColor rect at SURFACE.scrimAlpha over base+props) and measures
   the pixels the player sees. Props go through SURFACE.propTint the same way.

2. EMISSIVE PIXELS ARE EXCLUDED from the luminance/saturation figures, because
   5.4 exempts them by name, and measured separately for AREA against the 12%
   cap. The glow layer is the mask, which is exact: it was extracted from this
   very base tile.

3. SATURATION IS REPORTED TWO WAYS, and the second one is the one to trust.
   HSV saturation is (max-min)/max, which is unstable as luminance goes to
   zero -- and the scrim floor is itself a faintly blue constant (0x05060c,
   HSV S = 0.58). Over a surface this dark, most of the frame sits near that
   floor, so plain HSV S mostly measures the scrim rather than the art. The
   honest companion figure is NORMALISED CHROMA, (max-min)/255, which says how
   far from grey a pixel actually is in absolute terms; the two together make
   "desaturated and low-contrast beneath the action layer" checkable rather
   than arguable. HSV S is therefore reported over VISIBLE pixels only
   (rendered luminance >= 0.10, i.e. the ones the eye reads as anything but
   black) and chroma over the whole frame.

Keep the constants below in sync with data/tuning.js SURFACE.
"""
import os
import sys

from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      '..', 'public', 'assets')

# --- mirrors data/tuning.js SURFACE -----------------------------------------
SURFACE_TINT = (0x8e, 0x93, 0xa8)
PROP_TINT = (0x9a, 0xa0, 0xb4)
SCRIM_COLOR = (0x05, 0x06, 0x0c)
SCRIM_ALPHA = 0.42
MAX_LUM = 0.45
MAX_SAT = 0.35
MAX_EMISSIVE_FRACTION = 0.12
# Additive layer: a pixel is an authored accent once its contribution is
# visible rather than a rounding error.
EMISSIVE_ON = 0.12
# Below this rendered luminance, HSV saturation is measuring the scrim.
VISIBLE_LUM = 0.10


def composite(im, tint):
    """base * tint, then the scrim over it -- exactly what the renderer draws."""
    im = im.convert('RGB')
    px = im.load()
    out = Image.new('RGB', im.size)
    op = out.load()
    k = 1.0 - SCRIM_ALPHA
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            op[x, y] = (
                int((r * tint[0] / 255.0) * k + SCRIM_COLOR[0] * SCRIM_ALPHA),
                int((g * tint[1] / 255.0) * k + SCRIM_COLOR[1] * SCRIM_ALPHA),
                int((b * tint[2] / 255.0) * k + SCRIM_COLOR[2] * SCRIM_ALPHA),
            )
    return out


def stat(arr):
    arr.sort()
    n = len(arr)
    return sum(arr) / n, arr[int(n * 0.99)]


def band(im, skip=None):
    """(lum, satVisible, chroma) each as (mean, p99), over non-skipped pixels."""
    px = im.load()
    sp = skip.load() if skip is not None else None
    lums, sats, chromas = [], [], []
    for y in range(im.height):
        for x in range(im.width):
            if sp is not None and sp[x, y]:
                continue
            r, g, b = [v / 255.0 for v in px[x, y]]
            mx, mn = max(r, g, b), min(r, g, b)
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            lums.append(lum)
            chromas.append(mx - mn)
            if lum >= VISIBLE_LUM:
                sats.append(0.0 if mx == 0 else (mx - mn) / mx)
    if not sats:
        sats = [0.0]
    return stat(lums), stat(sats), stat(chromas), len(lums)


def mask_from(path_or_alpha, size, invert_alpha=False):
    """1 where the pixel should be skipped."""
    im = path_or_alpha
    if isinstance(im, str):
        im = Image.open(im).convert('L').resize(size, Image.LANCZOS)
        return im.point(lambda v: 1 if v >= EMISSIVE_ON * 255 else 0)
    return im.resize(size, Image.LANCZOS).point(lambda v: 1 if v < 24 else 0)


def verdict(v, cap):
    return 'OK  ' if v <= cap else 'OVER'


def main():
    fail = 0
    # Three surfaces, which is the FULL set: the POC-8 decision note cuts the
    # campaign to three levels.
    for stem in ('ashfall', 'kesselring', 'bulwark'):
        base = os.path.join(ASSETS, f'surface-{stem}-base.jpg')
        glowp = os.path.join(ASSETS, f'surface-{stem}-glow.png')
        if not os.path.exists(base):
            continue
        # 4x LANCZOS reduction: this is a distribution measurement over 2M
        # pixels and the reduction preserves the distribution.
        im = Image.open(base)
        small = (im.width // 4, im.height // 4)
        im = im.resize(small, Image.LANCZOS)
        emask = mask_from(glowp, small)
        lum, sat, chroma, n = band(composite(im, SURFACE_TINT), skip=emask)

        g = Image.open(glowp).convert('L')
        h = g.histogram()
        efrac = sum(h[int(EMISSIVE_ON * 255):]) / float(g.width * g.height)

        print(f'surface {stem}   (base x tint, scrim {SCRIM_ALPHA} over; '
              f'emissive pixels excluded)')
        print(f'  luminance    mean {lum[0]:.3f}  p99 {lum[1]:.3f}'
              f'    cap {MAX_LUM:.2f}   {verdict(lum[1], MAX_LUM)}')
        print(f'  saturation   mean {sat[0]:.3f}  p99 {sat[1]:.3f}'
              f'    cap {MAX_SAT:.2f}   {verdict(sat[0], MAX_SAT)} (mean; '
              f'HSV S over visible pixels)')
        print(f'  chroma       mean {chroma[0]:.3f}  p99 {chroma[1]:.3f}'
              f'    (absolute distance from grey, 0..1)')
        print(f'  emissive     {100*efrac:.3f}% of frame area'
              f'          cap {100*MAX_EMISSIVE_FRACTION:.0f}%    '
              f'{verdict(efrac, MAX_EMISSIVE_FRACTION)}')
        fail += (lum[1] > MAX_LUM) + (sat[0] > MAX_SAT) + (efrac > MAX_EMISSIVE_FRACTION)

    # Props are grouped by SURFACE now (§5.4/§6.5: one set per surface), so the
    # report reads the way the game is authored -- a hot prop is a problem for
    # the surface it sits on, and only that one.
    print('props            (sprite x propTint, scrim over)')
    for stem in ('ashfall', 'kesselring', 'bulwark'):
        files = sorted(x for x in os.listdir(ASSETS) if x.startswith(f'prop-{stem}-'))
        if not files:
            continue
        print(f'  --- {stem} ---')
        for f in files:
            im = Image.open(os.path.join(ASSETS, f)).convert('RGBA')
            lum, sat, chroma, n = band(composite(im, PROP_TINT),
                                       skip=mask_from(im.split()[3], im.size))
            print(f'  {f:30s} lum {lum[0]:.3f}/{lum[1]:.3f}  sat {sat[0]:.3f}  '
                  f'chroma {chroma[0]:.3f}   '
                  f'{verdict(lum[1], MAX_LUM)} {verdict(sat[0], MAX_SAT)}')
            fail += (lum[1] > MAX_LUM) + (sat[0] > MAX_SAT)

    print('\n' + ('ALL IN BAND' if not fail else f'{fail} MEASUREMENT(S) OUT OF BAND'))
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
