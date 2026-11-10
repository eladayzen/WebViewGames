#!/usr/bin/env python3
"""Turn the raw Kolbo generations in art/raw/ into the shipped set in
public/assets/. Idempotent, and the only thing that writes public/assets.

Run: python3 tools/build-assets.py

Why this is a script and not a sequence of one-off commands: §9.6's rules are
mechanical and easy to get subtly wrong by hand -- the character set must be
sliced at ONE shared cell rectangle with no per-frame alpha crop (rule 2), the
tiling textures must go through the seam blend (rule 4), background removal must
be LOCAL because the asset service's removebg is broken (rule 9). Encoding that
once means a re-run of the art pass reproduces the same sprites instead of
drifting.

Two decisions worth stating:

  MIRRORING. The generations draw Wren and the seabird facing RIGHT. The
  seabird is still mirrored, because it flies with the scroll (leftward).

  Wren is NOT mirrored: Amit called it on a playtest build and asked for the
  character and board flipped, so she ships facing right, as generated. Note
  what this gives up, in case it ever needs revisiting: the wave scrolls
  right-to-left with the lip up-and-to-the-LEFT (§0.2), and the mirrored
  "climb" panel put the board's nose up-LEFT, which pointed at the lip and
  made the lean-left-to-climb mapping self-teaching. Unmirrored, the nose
  reads up-right while the climb still carries her up-left, so the sprite no
  longer does that teaching work. If the mapping turns out not to read on
  hardware (§12's open question), this flag is one of the levers — §12 is
  explicit that the fix is presentation, never remapping to forward/back.

  FORMAT. Opaque textures ship as JPEG, everything with alpha as PNG. The wave
  face alone is 6 MB as a lossless PNG and ~400 KB as a quality-90 JPEG, and
  this loads over a local HTTP server into a mobile WebView.
"""
import os
import subprocess
import sys

from PIL import Image, ImageOps
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, 'art', 'raw')
WORK = os.path.join(ROOT, 'art', 'work')
OUT = os.path.join(ROOT, 'public', 'assets')

sys.path.insert(0, HERE)
from cutout import process as cutout_process  # noqa: E402


def raw(name):
    return os.path.join(RAW, name)


def out(name):
    return os.path.join(OUT, name)


def save_jpeg(im, path, quality=90):
    im.convert('RGB').save(path, 'JPEG', quality=quality, optimize=True, progressive=True)
    print(f'  -> {os.path.basename(path)} {im.size} {os.path.getsize(path)//1024} KB')


def save_png(im, path):
    im.save(path, 'PNG', optimize=True)
    print(f'  -> {os.path.basename(path)} {im.size} {os.path.getsize(path)//1024} KB')


def seamless(src, dst, width, height, blend=1100):
    subprocess.run([sys.executable, os.path.join(HERE, 'make-seamless.py'),
                    src, dst, '--width', str(width), '--height', str(height),
                    '--blend', str(blend)], check=True)


def feather(img, left=0.0, right=0.0, top=0.0, bottom=0.0, luminance=False):
    """Ramp a texture out at one or more edges.

    Two edges in this game read as a hard cut without it: the lip wall's inner
    edge, where the painted foam has to dissolve into the wave face rather than
    stop at a rectangle, and the trough wash's top edge. This is edge
    compositing on generated paint, not a procedurally drawn pattern.

    `luminance=True` ramps toward BLACK instead of toward transparent, for the
    textures that composite additively (black is their transparent).
    """
    arr = np.asarray(img.convert('RGBA')).astype(np.float64)
    h, w = arr.shape[:2]
    ramp = np.ones((h, w), dtype=np.float64)
    if left > 0:
        n = max(1, int(w * left))
        ramp[:, :n] *= np.linspace(0, 1, n)[None, :]
    if right > 0:
        n = max(1, int(w * right))
        ramp[:, w - n:] *= np.linspace(1, 0, n)[None, :]
    if top > 0:
        n = max(1, int(h * top))
        ramp[:n, :] *= np.linspace(0, 1, n)[:, None]
    if bottom > 0:
        n = max(1, int(h * bottom))
        ramp[h - n:, :] *= np.linspace(1, 0, n)[:, None]
    if luminance:
        arr[:, :, :3] *= ramp[:, :, None]
    else:
        arr[:, :, 3] *= ramp
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def cut(src, key='white', crop=True, max_edge=512, mirror=False):
    im = Image.open(src)
    img = cutout_process(im, key, crop, max_edge, 0.04)
    if mirror:
        img = ImageOps.mirror(img)
    return img


def slice_sheet(src, cols, rows, key='white', crop=True, max_edge=512, inset=0.012, mirror=False):
    """Slice a generated grid into cells. With crop=False every cell keeps the
    SAME rectangle, which is what §9.6 rule 2 requires for a character set."""
    im = Image.open(src)
    cw, ch = im.width / cols, im.height / rows
    cells = []
    for ry in range(rows):
        for cx in range(cols):
            ix, iy = cw * inset, ch * inset
            box = (round(cx * cw + ix), round(ry * ch + iy),
                   round((cx + 1) * cw - ix), round((ry + 1) * ch - iy))
            img = cutout_process(im.crop(box), key, crop, max_edge, 0.04)
            if mirror:
                img = ImageOps.mirror(img)
            cells.append(img)
    return cells


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    # -- the wave: the one set §12 flags as a real generation risk -----------
    print('wave textures (seam-verified, §9.6 rule 4 / §12)')
    seamless(raw('wave-face-raw.jpg'), os.path.join(WORK, 'face.png'), 4096, 1024)
    save_jpeg(Image.open(os.path.join(WORK, 'face.png')), out('wave-face.jpg'))

    seamless(raw('streaks.png'), os.path.join(WORK, 'streaks.png'), 4096, 1024)
    save_jpeg(Image.open(os.path.join(WORK, 'streaks.png')), out('wave-streaks.jpg'))

    # One foam generation, two layers -- they scroll at different rates and are
    # tinted separately, which is what §9.6 rule 5 actually asks for.
    fw = Image.open(raw('troughwash.png')).convert('RGB')
    fw.crop((0, int(fw.height * 0.28), fw.width, int(fw.height * 0.78))).save(os.path.join(WORK, 'foamband.png'))
    seamless(os.path.join(WORK, 'foamband.png'), os.path.join(WORK, 'trough.png'), 4096, 400)
    # Additive layer: ramp its edges to BLACK so it dissolves into the deep
    # water instead of starting at a hard horizontal line.
    save_jpeg(feather(Image.open(os.path.join(WORK, 'trough.png')), top=0.34, bottom=0.12, luminance=True),
              out('wave-trough.jpg'))
    seamless(os.path.join(WORK, 'foamband.png'), os.path.join(WORK, 'foam.png'), 3072, 260)
    foam = cutout_process(Image.open(os.path.join(WORK, 'foam.png')), 'black', False, 3072, 0)
    save_png(feather(foam, top=0.30, bottom=0.34), out('wave-foam.png'))

    print('lip wall')
    # Crop to the CURL. The generation paints a full-frame breaking wave, but
    # only about a sixth of the frame width is the lip wall in play (§5.1 puts
    # it left of x = 0.12) -- shipping the whole painting and pushing it
    # off-frame left shows the plain foam at its far edge instead of the curl.
    lip = Image.open(raw('lip.png'))
    lip = lip.crop((int(lip.width * 0.10), 0, int(lip.width * 0.52), lip.height))
    lip.save(os.path.join(WORK, 'lip-crop.png'))
    lipimg = cut(os.path.join(WORK, 'lip-crop.png'), key='magenta', crop=True, max_edge=900)
    # The inner (right) edge dissolves into the face; without it the lip wall is
    # a white rectangle with a ruled edge down the left fifth of the screen.
    save_png(feather(lipimg, right=0.34, bottom=0.10), out('wave-lip.png'))

    # -- the barrel interior -------------------------------------------------
    print('barrel')
    seamless(raw('barrel.png'), os.path.join(WORK, 'barrel.png'), 4096, 1024)
    save_jpeg(Image.open(os.path.join(WORK, 'barrel.png')), out('barrel-interior.jpg'))
    seamless(raw('kelp.png'), os.path.join(WORK, 'kelp.png'), 2048, 512)
    save_png(cutout_process(Image.open(os.path.join(WORK, 'kelp.png')), 'magenta', False, 2048, 0), out('barrel-kelp.png'))

    # -- Wren: ONE batch, ONE shared cell rectangle (§9.6 rules 1-2) --------
    print('Wren (one batch, shared cell rect, unmirrored: faces right, per Amit)')
    names = ['wren-trim', 'wren-climb', 'wren-drop', 'wren-air', 'wren-tumble', None]
    cells = slice_sheet(raw('wren-sheet.jpg'), 3, 2, key='white', crop=False, max_edge=420, mirror=False)
    for name, cell in zip(names, cells):
        if name:
            save_png(cell, out(name + '.png'))

    # -- hazards: ONE batch, one shared value slot (§9.6 rule 6) ------------
    print('hazards')
    hz = ['hazard-jellyfish', 'hazard-rock', 'hazard-timber', 'hazard-puffer', 'seabird', None]
    cells = slice_sheet(raw('hazard-sheet.png'), 3, 2, key='white', crop=True, max_edge=420)
    for name, cell in zip(hz, cells):
        if not name:
            continue
        # The seabird flies with the scroll, i.e. leftward across the sky.
        if name == 'seabird':
            cell = ImageOps.mirror(cell)
        save_png(cell, out(name + '.png'))

    # -- pickups -------------------------------------------------------------
    print('pickups')
    save_png(cut(raw('coin.png'), 'white', True, 200), out('pickup-coin.png'))
    save_png(cut(raw('orb.jpg'), 'white', True, 220), out('pickup-orb.png'))

    # -- particles -----------------------------------------------------------
    print('particles')
    save_png(cut(raw('fx-spray.png'), 'magenta', True, 192), out('fx-spray.png'))
    save_png(cut(raw('fx-foam.png'), 'magenta', True, 192), out('fx-foam.png'))
    bub = raw('fx-bubble.png')
    if os.path.exists(bub):
        save_png(cut(bub, 'magenta', True, 160), out('fx-bubble.png'))

    # -- sky + clouds --------------------------------------------------------
    print('sky + clouds')
    for src, dst in [('sky-open.jpg', 'zone-open-sea-sky.jpg'), ('sky-overhang.jpg', 'zone-overhang-sky.jpg')]:
        im = Image.open(raw(src)).convert('RGB').resize((1600, 900), Image.LANCZOS)
        save_jpeg(im, out(dst), quality=88)
    seamless(raw('clouds.png'), os.path.join(WORK, 'clouds.png'), 2048, 640)
    save_png(cutout_process(Image.open(os.path.join(WORK, 'clouds.png')), 'black', False, 2048, 0), out('clouds.png'))

    # -- zone props ----------------------------------------------------------
    print('zone props')
    props = [
        ('stack-a.jpg', 'prop-sea-stack-a.png', 560),
        ('stack-b.png', 'prop-sea-stack-b.png', 560),
        ('stack-c.jpg', 'prop-sea-stack-c.png', 560),
        ('arch.jpg', 'prop-rock-arch.png', 900),
        ('islet.jpg', 'prop-islet.png', 760),
        ('pier.jpg', 'prop-pier.png', 1400),
        ('overhang.jpg', 'prop-overhang.png', 1600),
    ]
    for src, dst, edge in props:
        if not os.path.exists(raw(src)):
            print(f'  !! missing raw {src}')
            continue
        save_png(cut(raw(src), 'white', True, edge), out(dst))

    # -- crew portraits: ONE batch, no coral (§9.6 rule 7) ------------------
    print('crew portraits')
    crew = ['crew-birdie', 'crew-otto', 'crew-marisol', 'crew-ghost', 'crew-oldsal', None]
    cells = slice_sheet(raw('crew-sheet.jpg'), 3, 2, key='white', crop=True, max_edge=220)
    for name, cell in zip(crew, cells):
        if name:
            save_png(cell, out(name + '.png'))

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)
                if os.path.isfile(os.path.join(OUT, f)))
    print(f'\ntotal shipped art: {total/1024/1024:.1f} MB')


if __name__ == '__main__':
    main()
