#!/usr/bin/env python3
"""Local background cutout + sprite-sheet slicing for the Dawn Patrol art pass.

Background removal is LOCAL, not via the asset service's removebg operation,
which is known broken (KOLBO_ASSET_PIPELINE.md, §9.6 rule 9).

Two things the repo's shared remove_white_bg.py does not do, both required here:

  --key magenta   White foam, white spray and off-white sea stacks cannot be cut
                  out of a white background -- the subject IS the key colour.
                  Those assets are generated on flat magenta instead (the one
                  hue §1's palette rule guarantees never appears in this game's
                  art) and keyed on that.

  --grid N        §9.6 rule 1 says generate a character's states TOGETHER as one
                  multi-panel grid, and rule 2 says slice them all at the SAME
                  cell rectangle -- per-frame alpha-bbox cropping makes the
                  sprite's centre visibly shift between carve states while she
                  is supposed to be holding a line. So this slices into N equal
                  columns and, with --no-crop, leaves every cell the same size.

Usage:
  python3 tools/cutout.py IN OUT.png [--key white|magenta] [--grid N]
                          [--no-crop] [--max-edge N] [--pad-frac 0.04]

With --grid N, OUT.png must contain a '{}' placeholder for the cell index,
or be a directory.
"""
import argparse
import os

from PIL import Image
import numpy as np


def key_alpha(arr, mode):
    """Return a float alpha in [0,1], feathered, for the given key colour."""
    rgb = arr[:, :, :3].astype(np.float64)
    if mode == 'white':
        # Distance below pure white, per the shared script's 245/225 thresholds.
        m = rgb.min(axis=2)
        alpha = np.clip((245.0 - m) / (245.0 - 225.0), 0.0, 1.0)
    elif mode == 'magenta':
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        # Magenta is high R, low G, high B. Score how magenta a pixel is.
        score = np.minimum(r, b) - g
        alpha = np.clip((110.0 - score) / 50.0, 0.0, 1.0)
    elif mode == 'black':
        m = rgb.max(axis=2)
        alpha = np.clip((m - 10.0) / 30.0, 0.0, 1.0)
    elif mode == 'none':
        alpha = np.ones(rgb.shape[:2])
    else:
        raise SystemExit(f'unknown key mode {mode}')
    return alpha


def despill(arr, alpha, mode):
    """Pull key colour back out of the semi-transparent fringe."""
    out = arr.astype(np.float64).copy()
    if mode == 'magenta':
        r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2]
        # Pull the fringe all the way back to the green channel, not to a
        # midpoint: a soft-edged WHITE subject on magenta (spray, foam) keeps a
        # visible pink halo otherwise, and pink is exactly the colour §1's
        # palette rule says must never appear.
        cap = g
        spill = (np.minimum(r, b) > g + 6)
        out[:, :, 0] = np.where(spill, np.minimum(r, cap), r)
        out[:, :, 2] = np.where(spill, np.minimum(b, cap), b)
    return out


def process(im, key, crop, max_edge, pad_frac):
    arr = np.asarray(im.convert('RGB'))
    alpha = key_alpha(arr, key)
    rgb = despill(arr, alpha, key)
    out = np.dstack([np.clip(rgb, 0, 255), (alpha * 255.0)]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')

    if crop:
        bbox = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if bbox:
            pad = int(max(img.width, img.height) * pad_frac)
            bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                    min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad))
            img = img.crop(bbox)

    if max_edge and max(img.size) > max_edge:
        s = max_edge / max(img.size)
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--key', default='white', choices=['white', 'magenta', 'black', 'none'])
    ap.add_argument('--grid', type=int, default=0, help='slice into N equal columns')
    ap.add_argument('--rows', type=int, default=1, help='with --grid, number of rows')
    ap.add_argument('--no-crop', action='store_true')
    ap.add_argument('--max-edge', type=int, default=512)
    ap.add_argument('--pad-frac', type=float, default=0.04)
    ap.add_argument('--inset', type=float, default=0.0,
                    help='trim this fraction off each cell edge, to drop panel gutters')
    args = ap.parse_args()

    im = Image.open(args.src)
    crop = not args.no_crop

    if args.grid <= 1 and args.rows <= 1:
        process(im, args.key, crop, args.max_edge, args.pad_frac).save(args.dst)
        print(f'{args.src} -> {args.dst}')
        return

    cols = max(1, args.grid)
    rows = max(1, args.rows)
    cw, ch = im.width / cols, im.height / rows
    n = 0
    for ry in range(rows):
        for cx in range(cols):
            ix, iy = cw * args.inset, ch * args.inset
            box = (round(cx * cw + ix), round(ry * ch + iy),
                   round((cx + 1) * cw - ix), round((ry + 1) * ch - iy))
            cell = im.crop(box)
            out = process(cell, args.key, crop, args.max_edge, args.pad_frac)
            path = args.dst.format(n) if '{}' in args.dst else os.path.join(args.dst, f'cell-{n}.png')
            out.save(path)
            print(f'{args.src} cell {n} {box} -> {path} {out.size}')
            n += 1


if __name__ == '__main__':
    main()
