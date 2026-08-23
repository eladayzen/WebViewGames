"""Local art-processing helpers for the Nova Vanguard POC art pass.

Pure PIL (no numpy/scipy in this env). Two things the repo's
tools/kolbo-assets/remove_white_bg.py cannot do that this set needs:

  * border-connected cutout -- the player craft has legitimate WHITE and
    near-white livery panels and a near-white cyan engine core, so a global
    near-white threshold eats the subject. Keying only the region flood-filled
    from the image border keeps interior whites.
  * fixed shared cell rect across a set (build doc 9.5 rule 2) -- the three
    roll states must be cropped at the SAME rectangle or the sprite's centre
    shifts between states while the craft is meant to be holding a line.
"""
import math
from collections import deque
from PIL import Image, ImageChops, ImageFilter


def _minchan(im):
    r, g, b = im.convert('RGB').split()
    from PIL import ImageChops
    return ImageChops.darker(ImageChops.darker(r, g), b)


def cutout_white(im, fill_thresh=225, solid_thresh=245):
    """Key out only the BORDER-CONNECTED near-white background."""
    im = im.convert('RGBA')
    w, h = im.size
    mn = _minchan(im).load()
    inreg = bytearray(w * h)

    # scanline flood fill seeded from every border pixel that is near-white
    stack = deque()
    for x in range(w):
        for y in (0, h - 1):
            if mn[x, y] >= fill_thresh and not inreg[y * w + x]:
                stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if mn[x, y] >= fill_thresh and not inreg[y * w + x]:
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        if inreg[y * w + x]:
            continue
        xl = x
        while xl > 0 and not inreg[y * w + xl - 1] and mn[xl - 1, y] >= fill_thresh:
            xl -= 1
        xr = x
        while xr < w - 1 and not inreg[y * w + xr + 1] and mn[xr + 1, y] >= fill_thresh:
            xr += 1
        for xx in range(xl, xr + 1):
            inreg[y * w + xx] = 1
        for ny in (y - 1, y + 1):
            if 0 <= ny < h:
                xx = xl
                while xx <= xr:
                    if not inreg[ny * w + xx] and mn[xx, ny] >= fill_thresh:
                        stack.append((xx, ny))
                        while xx <= xr and mn[xx, ny] >= fill_thresh:
                            xx += 1
                    xx += 1

    span = max(1, solid_thresh - fill_thresh)
    px = im.load()
    for y in range(h):
        base = y * w
        for x in range(w):
            if inreg[base + x]:
                m = mn[x, y]
                a = 0 if m >= solid_thresh else int(255 * (solid_thresh - m) / span)
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, a)
    return im


def alpha_bbox(im, thresh=8):
    """bbox of pixels with alpha > thresh."""
    a = im.split()[3].point(lambda v: 255 if v > thresh else 0)
    return a.getbbox()


def fit(im, max_edge):
    if max(im.size) <= max_edge:
        return im
    s = max_edge / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def make_v_seamless(im, feather):
    """Cross-fade an image into a tile that repeats seamlessly in Y.

    out height H' = H - f.
      out[y] = img[y]*(y/f) + img[H-f+y]*(1-y/f)   for y in [0,f)
      out[y] = img[y]                              for y in [f,H')
    Then out[H'-1] = img[H-f-1] and out[0] = img[H-f], which are adjacent rows
    in the source, so the wrap is continuous by construction.
    """
    w, h = im.size
    f = feather
    top = im.crop((0, 0, w, f))
    tail = im.crop((0, h - f, w, h))
    mask = Image.new('L', (w, f))
    mp = mask.load()
    for y in range(f):
        v = int(255 * y / f)
        for x in range(w):
            mp[x, y] = v
    blended = Image.composite(top, tail, mask)
    out = im.crop((0, 0, w, h - f)).convert('RGB')
    out.paste(blended.convert('RGB'), (0, 0))
    return out


def luma_bbox(im, thresh=10):
    return im.convert('L').point(lambda v: 255 if v > thresh else 0).getbbox()


def row_detail_profile(im, smooth=10, step=3):
    """Per-row VERTICAL detail: mean |p[x,y] - p[x,y+1]| across the row.

    Vertical, not horizontal, and that choice is the whole point. A plain
    plating band still contains vertical panel seams and rivet columns, so a
    horizontal-gradient profile reads it as "detailed" and is useless for
    choosing a feather. What a vertical cross-fade actually cares about is
    whether consecutive ROWS resemble each other -- a band whose rows barely
    change is a band that can be blended without ghosting, however much
    structure it has along x.
    """
    im = im.convert('L')
    w, h = im.size
    p = im.load()
    raw = []
    for y in range(h - 1):
        s = n = 0
        for x in range(0, w, step):
            s += abs(p[x, y] - p[x, y + 1])
            n += 1
        raw.append(s / n)
    raw.append(raw[-1])
    out = []
    for y in range(h):
        a, b = max(0, y - smooth), min(h, y + smooth + 1)
        out.append(sum(raw[a:b]) / (b - a))
    return out


def measure_plain_bands(im, edge_trim=12, tol=1.6):
    """(plain_top, plain_bottom, floor, median) -- how many rows at each edge
    are LOW-DETAIL enough to cross-fade through.

    This is what sizes `feather` in make_v_seamless. Build doc 9.5 rule 5 wants
    the seam made safe deliberately; measuring the bands beats assuming a
    number, because the safe feather is a property of what the generator
    actually drew, not of the prompt that asked for it.

    `edge_trim` CROPS the outermost rows before profiling. Generators leave a
    few rows of ringing at the very edge of a JPEG; because the profile is
    smoothed, leaving them in poisons the window over the first ~20 rows and
    reports a plain band of zero even when 400 plain rows are sitting there.

    A row counts as plain while it stays within `tol` x the quietest level
    found in the image (the 5th percentile of the profile).
    """
    w, h0 = im.size
    core = im.crop((0, edge_trim, w, h0 - edge_trim))
    prof = row_detail_profile(core)
    h = len(prof)
    srt = sorted(prof)
    floor = srt[max(0, int(h * 0.05))]
    median = srt[h // 2]
    thr = max(0.5, floor * tol)
    t = 0
    while t < h and prof[t] <= thr:
        t += 1
    b = 0
    while b < h and prof[h - 1 - b] <= thr:
        b += 1
    return t + edge_trim, b + edge_trim, floor, median


def recommend_feather(im, uniform_ratio=1.7, uniform_fraction=0.13, safety=0.85):
    """Pick a cross-fade feather from what the generator actually drew.

    Two regimes, and conflating them is how you get a visible seam:

      * UNIFORM texture (Ashfall's cracked crust) -- detail is the same
        everywhere, so there is no "plain band" to find and none is needed:
        blending noise into noise is invisible whatever the row mismatch says.
        Feather generously, as a fraction of height.
      * STRUCTURED texture (Kesselring's deck, the Bulwark's plating) -- the
        prompt deliberately asked for plain plating at the top and bottom
        edges, so the feather must stay INSIDE the shorter of those two runs
        or the fade ghosts real structure against real structure.

    Returns (feather, verdict_string) so build_assets can print the reasoning
    rather than just the number.
    """
    t, b, floor, median = measure_plain_bands(im)
    h = im.size[1]
    ratio = median / max(0.01, floor)
    if ratio < uniform_ratio:
        f = int(h * uniform_fraction)
        why = (f'uniform texture (median/floor {ratio:.2f} < {uniform_ratio}), '
               f'feather = {uniform_fraction:.0%} of height')
    else:
        f = max(24, int(min(t, b) * safety))
        why = (f'structured (median/floor {ratio:.2f}); plain bands top {t} / '
               f'bottom {b} rows, feather = {safety:.0%} of the shorter')
    return f, f'{why}; seam mismatch {seam_mismatch(im, f):.2f}/255'


def seam_mismatch(im, feather, step=4):
    """Mean |top row - tail row| over the rows make_v_seamless will blend.

    The direct check on the decision measure_plain_bands made: two plain bands
    that happen to sit at different brightness would still ghost, and this
    catches that where a detail profile cannot.
    """
    im = im.convert('L')
    w, h = im.size
    p = im.load()
    s = n = 0
    for y in range(0, feather, step):
        for x in range(0, w, step * 2):
            s += abs(p[x, y] - p[x, h - feather + y])
            n += 1
    return s / max(1, n)


def alpha_from_darkness(im, white=246, black=120):
    """Turn a DARK subject drawn on white into an RGBA decal.

    cutout_white is wrong for a soot/scorch decal: the decal's whole outer
    third is deliberately soft grey smoke, which a near-white key either leaves
    as an opaque grey halo (threshold too tight) or eats along with the char
    (threshold too loose). A scorch has no hard edge to find.

    So derive alpha from how far the pixel is from paper-white instead, which
    is exactly what "how much soot is here" means, and let the smoke fall off
    continuously the way it was painted.
    """
    im = im.convert('RGB')
    w, h = im.size
    src = im.load()
    out = Image.new('RGBA', (w, h))
    dst = out.load()
    span = max(1, white - black)
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            m = max(r, g, b)
            a = 0 if m >= white else 255 if m <= black else int(255 * (white - m) / span)
            dst[x, y] = (r, g, b, a)
    return out


def extract_emissive(tile, kind, bloom=0.0):
    """Pull the emissive accents OUT of a finished surface base tile.

    The emissive layer is never generated separately: a second generation could
    never register with the base, and the renderer locks glow.tilePosition.y to
    base.tilePosition.y (§5.4 requires the accents to sit exactly on the
    fissures / lamps that produced them).

    Drawn with blendMode 'add', so everything non-emissive must be pure black.

    Two keys, because the two surfaces emit differently:
      'warm'      -- Ashfall Crust. Magma is red/orange AND bright, and the rock
                     around it is a neutral near-black, so a warm-minus-cool
                     term isolates the vein cores.
      'chromatic' -- Kesselring Yards. A shipyard deck is near-neutral gunmetal
                     with SPECULAR grey highlights everywhere, so brightness
                     alone would key the whole deck. What separates a worklight
                     from a highlight here is CHROMA, not luminance: the amber
                     hazard lamps and cyan worklight strips are the only
                     saturated pixels in the frame.

    `bloom` (0..1) adds a blurred copy back on top. It spreads the accent's
    presence without widening the hot core the §5.4 budget is measured on --
    Kesselring's lamps are physically tiny and would otherwise read as dead
    pixels once the scrim is over them.

    Returns (glow_image, hot_fraction) where hot_fraction is the share of frame
    area whose emissive weight exceeds 0.25 -- the number §5.4's 12% cap is
    checked against.
    """
    from PIL import ImageChops, ImageFilter

    tile = tile.convert('RGB')
    w, h = tile.size
    glow = Image.new('RGB', (w, h), (0, 0, 0))
    tp, gp = tile.load(), glow.load()
    hot = 0
    for y in range(h):
        for x in range(w):
            r, g, b = tp[x, y]
            if kind == 'warm':
                warm = (r - b - 30) / 110.0        # orange/red only
                bright = (r - 95) / 80.0
                s = min(1.0, max(0.0, warm)) * min(1.0, max(0.0, bright))
                cr, cg, cb = 1.0, 0.92, 0.7
            else:
                mx, mn = max(r, g, b), min(r, g, b)
                sat = 0.0 if mx == 0 else (mx - mn) / mx
                lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
                s = (min(1.0, max(0.0, (sat - 0.20) / 0.22))
                     * min(1.0, max(0.0, (lum - 0.24) / 0.26)))
                cr, cg, cb = 1.0, 1.0, 1.0
            if s <= 0.0:
                continue
            s = s * s                               # keep it to the cores
            gp[x, y] = (int(r * s * cr), int(g * s * cg), int(b * s * cb))
            if s > 0.25:
                hot += 1

    if bloom > 0.0:
        halo = glow.filter(ImageFilter.GaussianBlur(5)).point(
            lambda v: int(v * bloom))
        glow = ImageChops.add(glow, halo)

    return glow, hot / float(w * h)


def desaturate_hot(im, max_sat=0.35):
    """Pull any pixel above `max_sat` back toward its own luminance.

    Build doc 5.4 caps the SURFACE AND PROP layers at saturation <= 35%, and
    exempts only *authored* emissive accents. A generator that decides on its
    own to run neon seams along a cargo pallet has authored nothing -- and if
    that neon is blue it is actively harmful, because blue-and-white is the
    PLAYER's ownership colour and props are inert scenery that must never read
    as something the player owns or can interact with.

    Doing this at build time rather than at prompt time is deliberate: it is
    the same argument 9.5 rule 6 makes for the surface scrim. The rule is
    checkable and reproducible here, whereas "please no neon" in a prompt is
    neither, and a re-roll costs a generation and may bring back a different
    unrequested accent.

    Luminance is preserved exactly, so a glowing seam stays a bright seam --
    it just stops being a coloured one.
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            if mx == 0:
                continue
            sat = (mx - mn) / mx
            if sat <= max_sat:
                continue
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            # k = how far to keep from grey so that the result sits exactly at
            # max_sat. Solving sat(lerp(lum, c, k)) = max_sat is not closed
            # form per channel, so scale the chroma by the ratio of the
            # saturations, which lands within a percent and never overshoots.
            k = max_sat / sat
            px[x, y] = (
                int(lum + (r - lum) * k),
                int(lum + (g - lum) * k),
                int(lum + (b - lum) * k),
                a,
            )
    return im


def keep_largest_component(im, thresh=24):
    """Drop every opaque island except the biggest one.

    nano-banana/gpt-image sometimes paint a soft cast shadow under a prop even
    when the prompt forbids it (KOLBO_ASSET_PIPELINE.md notes this). It is not
    near-white, so the white key leaves it as a detached dark blob -- which then
    reads in game as a smear on the ground next to the prop.
    """
    from collections import deque
    im = im.convert('RGBA')
    w, h = im.size
    a = im.split()[3].load()
    seen = bytearray(w * h)
    best, best_n = None, 0
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or a[sx, sy] <= thresh:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and a[nx, ny] > thresh:
                        seen[ny*w+nx] = 1
                        q.append((nx, ny))
            if len(comp) > best_n:
                best, best_n = comp, len(comp)
    keep = bytearray(w * h)
    for x, y in best:
        keep[y * w + x] = 1
    px = im.load()
    for y in range(h):
        for x in range(w):
            if not keep[y * w + x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


# ---------------------------------------------------------------------------
# CRAFT READABILITY OVER A DARK SURFACE (playtest round 5, Amit)
#
#   "A lot of the enemies right now are too dark. It's hard to see them on the
#    dark backgrounds. Mainly actually mainly the one that's like grey dark.
#    Also the green ones are a little bit too dark. The orange one a little bit
#    too dark. I need to find a solution for that. I don't know if you have to
#    change the whole asset maybe or just add some auto-stroke or glow."
#
# THIS IS STRUCTURAL, NOT AN ART MISS ON THREE SPRITES. 5.4 requires the surface
# to be desaturated and low-contrast, and the shipped surfaces measure FAR below
# even that: rendered luminance means of 0.071 / 0.083 / 0.074 against a 0.45
# ceiling. The ground is very dark by design -- that darkness is what makes
# bullets readable and must not be given back -- so ANY craft that is also dark
# disappears into it, and every enemy added from here hits the same wall.
#
# The two functions below are the answer, and they are deliberately the cheap
# half of the pair 9.5 rule 6 already established for surfaces ("bring it into
# band with the scrim, not with a regeneration"). Applied at BUILD TIME from the
# existing raws: no credits, deterministic, and automatic for every future
# craft rather than a note someone has to remember.
# ---------------------------------------------------------------------------


def median_luma(im, alpha_min=40):
    """Median luminance over a sprite's OPAQUE pixels, 0..1.

    Median rather than mean, deliberately: a craft is a dark hull with a few hot
    lights on it, and the mean is dragged up by the lights -- which are exactly
    the pixels that were never the problem. The median answers "how bright is
    this craft's BODY", which is the thing that vanishes into a dark surface.
    """
    px = im.load()
    vals = []
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < alpha_min:
                continue
            vals.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    if not vals:
        return 0.0
    vals.sort()
    return vals[len(vals) // 2] / 255.0


_median_luma = median_luma


def lift_luma(im, target_median, iters=14):
    """Raise a sprite's median luminance to `target_median`, hue-safe.

    A POWER CURVE ON HSV VALUE, which is the whole reason this is safe to apply
    to every craft uniformly:

      * HUE AND SATURATION ARE UNTOUCHED, so 5.4's ownership coding survives
        exactly. A purple drone stays purple, an oxblood Warden stays oxblood.
        The one thing that could break ownership -- an enemy drifting toward the
        player's blue-and-white -- is impossible by construction, because the
        channel RATIOS never change; only the common scale does.
      * IT IS MONOTONIC, so plate seams, panel lines and specular highlights
        keep their ordering. A linear gain would clip every highlight to flat
        white and take the hard-surface bevels 0.3 fixed the idiom for with it.
      * HIGHLIGHTS BARELY MOVE. v^g with g<1 lifts the dark end hard and the
        bright end almost not at all, which is precisely the distribution
        problem: what is invisible on these craft is the ARMOUR, not the lights.

    The exponent is SOLVED by bisection on the measured median rather than
    authored, because the right lift for a 0.155 Warden and a 0.358 Emitter are
    very different numbers, and hand-tuning five of them is exactly how the
    sixth craft gets forgotten.
    """
    im = im.convert('RGBA')
    cur = _median_luma(im)
    if cur <= 0.001 or target_median <= cur:
        return im, cur, 1.0
    lo, hi = 0.05, 1.0
    best, best_g, best_m = im, 1.0, cur
    for _ in range(iters):
        g = (lo + hi) * 0.5
        out = _apply_value_gamma(im, g)
        m = _median_luma(out)
        best, best_g, best_m = out, g, m
        if abs(m - target_median) < 0.004:
            break
        if m < target_median:
            hi = g          # smaller gamma lifts harder
        else:
            lo = g
    return best, best_m, best_g


def _apply_value_gamma(im, gamma):
    """v -> v**gamma in HSV, alpha and chroma ratios preserved."""
    px = im.load()
    out = Image.new('RGBA', im.size)
    op = out.load()
    lut = [int(round(255.0 * ((i / 255.0) ** gamma))) for i in range(256)]
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a:
                op[x, y] = (r, g, b, a)
                continue
            v = max(r, g, b)
            if v == 0:
                op[x, y] = (lut[0], lut[0], lut[0], a)
                continue
            nv = lut[v]
            k = nv / float(v)
            op[x, y] = (
                min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a
            )
    return out


def rim_from_alpha(im, width=7, feather=5):
    """A white outline sprite derived from a craft's own alpha.

    WHY AN ALPHA-DERIVED SILHOUETTE RATHER THAN A TINTED COPY OF THE CRAFT. The
    obvious cheap rim is the craft's own texture drawn additively behind itself
    at a slightly larger scale -- and it does nothing here, because additive
    blending adds a pixel's OWN colour: a near-black armour plate contributes
    near-black, so exactly the craft that needs the rim is the craft that would
    not get one. The outline has to come from the SHAPE, not from the colour.

    So this walks the alpha channel, keeps the band just inside the silhouette's
    edge, and feathers it outward. The renderer draws it additively behind the
    craft, tinted with that craft's own family colour (ENEMY.types[].rimColor),
    which does three things at once: it separates a dark hull from a dark ground,
    it reads as the neon idiom 0.3 fixed rather than as a UI outline, and it
    carries the type's colour identity at a distance where the hull's own detail
    has stopped being legible.

    ONE ASSET PER CRAFT, generated from the craft. Adding an enemy adds its rim
    automatically; there is nothing to remember.
    """
    im = im.convert('RGBA')
    a = im.split()[3]
    # Inner edge band: alpha minus an eroded copy of itself.
    eroded = a.filter(ImageFilter.MinFilter(max(3, width | 1)))
    band = ImageChops.subtract(a, eroded)
    # Push it outward a little and soften, so the rim reads as light bleeding
    # off the hull rather than as a drawn stroke.
    grown = band.filter(ImageFilter.MaxFilter(3))
    soft = grown.filter(ImageFilter.GaussianBlur(feather))
    rim = Image.new('RGBA', im.size, (255, 255, 255, 0))
    rim.putalpha(soft)
    white = Image.new('RGBA', im.size, (255, 255, 255, 255))
    white.putalpha(soft)
    return white
