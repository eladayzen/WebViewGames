#!/usr/bin/env python3
"""
Local background cutout for Kolbo-generated sprites.

Why this exists: Kolbo's own edit_image(operation="removebg") MCP tool
consistently fails with "Generation document not found" (verified on both
freshly generated images and images re-registered via upload_media, on
2026-07-20). Until that's fixed upstream, key out the flat background
locally instead -- it's fast, free, and works for any sprite generated with
"plain solid white background, isolated single object" in the prompt (the
game-assets-enhancement skill always asks for this).

Usage:
    python3 remove_white_bg.py <input> <output> [--max-edge 512] [--thresh 245] [--feather-start 225]

What it does, in order (matches the skill's Phase 2 step 3-4):
    1. Key near-white pixels to transparent, with a linear feather band so
       soft anti-aliased edges dissolve instead of leaving a white fringe.
    2. Crop to the alpha bounding box.
    3. Downscale so the long edge is <= max-edge (skip for smaller sources).

Only safe for sprites generated against a plain white/near-white
background. Do not use on photos or busy backgrounds -- it will eat
legitimate white content in the subject too.
"""
import argparse
from PIL import Image


def remove_white_bg(src, dst, max_edge=512, thresh=245, feather_start=225):
    img = Image.open(src).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m >= thresh:
                px[x, y] = (r, g, b, 0)
            elif m >= feather_start:
                alpha = int(255 * (thresh - m) / (thresh - feather_start))
                px[x, y] = (r, g, b, alpha)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    long_edge = max(img.size)
    if long_edge > max_edge:
        scale = max_edge / long_edge
        img = img.resize(
            (max(1, int(img.width * scale)), max(1, int(img.height * scale))),
            Image.LANCZOS,
        )

    img.save(dst)
    print(f"{src} -> {dst}  {img.size}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--max-edge", type=int, default=512)
    p.add_argument("--thresh", type=int, default=245)
    p.add_argument("--feather-start", type=int, default=225)
    args = p.parse_args()
    remove_white_bg(args.src, args.dst, args.max_edge, args.thresh, args.feather_start)
