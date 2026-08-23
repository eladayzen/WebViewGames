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

from nvlib import median_luma

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

# The craft-vs-surface separation floor (playtest round 5). A craft's median
# body luminance must clear the BRIGHTEST surface's rendered mean by at least
# this much, or it disappears into the ground it flies over.
#
# 0.24 is set from the measurement rather than from taste. Before the fix the
# five enemies measured 0.155 / 0.186 / 0.265 / 0.358 / 0.796 against a worst
# surface mean of 0.083, i.e. deltas of 0.07 to 0.71 -- and Amit named the three
# lowest, in order, unprompted. His cutoff therefore sits between the Emitter's
# 0.275 ("a little bit too dark") and the Splitter's 0.71 (never mentioned).
# 0.24 puts the floor just under the one he was willing to tolerate, so it
# fails everything he complained about and passes everything he did not.
CRAFT_CONTRAST_MIN = 0.24


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


def emit_readability(surf_rows, craft_rows):
    """Write the measured numbers into src/data/readability.js.

    WHY A GENERATED DATA FILE RATHER THAN A COMMENT. The boot validator cannot
    open a PNG -- it runs before textures load and §9.1 keeps it clear of the
    render layer entirely -- so the only way it can assert craft contrast is if
    the measurement is DATA. Generating it here means the number the validator
    checks is the number this tool measured off the shipped sprite, and a craft
    added without re-running this shows up as a missing row rather than as a
    silently unchecked one.
    """
    out = os.path.join(os.path.dirname(ASSETS), '..', 'src', 'data', 'readability.js')
    out = os.path.normpath(out)
    lines = [
        '// GENERATED by art/measure_readability.py -- do not edit by hand.',
        '//',
        '// Measured readability of the shipped art, so /systems/constraints.js can',
        '// assert §5.4 at boot instead of trusting a comment. Re-run the tool after',
        '// any art change; a craft with no row here is a boot error, which is what',
        '// stops a new enemy being added without ever being measured.',
        '//',
        '// SURFACES are the RENDERED mean luminance -- base x SURFACE.surfaceTint with',
        '// the SURFACE.scrimColor scrim over it, i.e. the pixels the player sees, not',
        '// the generation. CRAFT are the MEDIAN luminance of a sprite\'s opaque pixels:',
        '// a ship is a dark hull carrying a few hot lights and the mean is dragged up',
        '// by exactly the pixels that were never hard to see.',
        '',
        f'export const CRAFT_CONTRAST_MIN = {CRAFT_CONTRAST_MIN};',
        '',
        'export const SURFACE_LUMA = {',
    ]
    for k, v in surf_rows:
        lines.append(f"  {k}: {v:.4f},")
    lines += ['};', '', 'export const CRAFT_LUMA = {']
    for f, med, _d in craft_rows:
        key = f.replace('.png', '')
        lines.append(f"  '{key}': {med:.4f},")
    lines += ['};', '']
    with open(out, 'w') as fh:
        fh.write('\n'.join(lines))
    print(f'  wrote {os.path.relpath(out, os.path.dirname(ASSETS))}')


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

    # ----------------------------------------------------------------------
    # CRAFT CONTRAST -- the inverse measurement, added after playtest round 5.
    #
    # Everything above asks "is the surface dark and flat enough". Amit's note
    # asked the opposite question and nothing was answering it:
    #
    #   "A lot of the enemies right now are too dark. It's hard to see them on
    #    the dark backgrounds. Mainly actually mainly the one that's like grey
    #    dark. Also the green ones are a little bit too dark. The orange one a
    #    little bit too dark."
    #
    # The two halves are one measurement. §5.4 makes the ground dark ON PURPOSE
    # -- that darkness is what makes bullets readable -- so the surface cap is
    # not the thing to relax; what has to hold is a MINIMUM SEPARATION between
    # every craft and every surface it can appear on. That number is emitted
    # into src/data/readability.js so /systems/constraints.js can assert it at
    # boot, which is what turns "these three look dark" into a rule the next
    # craft inherits.
    #
    # MEDIAN, NOT MEAN, for the craft: a ship is a dark hull carrying a few hot
    # lights, and the mean is dragged up by exactly the pixels that were never
    # the problem. The median answers "how bright is the BODY".
    craft_rows = []
    surf_rows = []
    for stem in ('ashfall', 'kesselring', 'bulwark'):
        base = os.path.join(ASSETS, f'surface-{stem}-base.jpg')
        if not os.path.exists(base):
            continue
        im = Image.open(base)
        im = im.resize((im.width // 6, im.height // 6), Image.LANCZOS)
        lum, _s, _c, _n = band(composite(im, SURFACE_TINT))
        surf_rows.append((stem, lum[0]))

    print('\ncraft contrast   (sprite median luma vs each surface rendered mean)')
    worst_surface = max(v for _k, v in surf_rows) if surf_rows else 0.0
    for f in sorted(x for x in os.listdir(ASSETS)
                    if (x.startswith('enemy-') or x.startswith('ship-'))
                    and x.endswith('.png') and '-rim' not in x):
        im = Image.open(os.path.join(ASSETS, f)).convert('RGBA')
        med = median_luma(im)
        delta = med - worst_surface
        craft_rows.append((f, med, delta))
        print(f'  {f:30s} median {med:.3f}   delta {delta:+.3f}   '
              f'{"OK  " if delta >= CRAFT_CONTRAST_MIN else "DARK"}')
        fail += delta < CRAFT_CONTRAST_MIN

    emit_readability(surf_rows, craft_rows)

    print('\n' + ('ALL IN BAND' if not fail else f'{fail} MEASUREMENT(S) OUT OF BAND'))
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
