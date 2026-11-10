#!/usr/bin/env python3
"""Slice a generated N-up walk strip into aligned frames.

Two corrections are not optional here, and both are about the generator
rather than the art:

1. The cells are not perfectly even and the character is not centred in its
   cell, so frames are found by their own alpha content, not by dividing the
   image by N.

2. Nothing guarantees the character keeps the same size or sits at the same
   height between frames. Un-aligned, the loop reads as the character
   jittering rather than walking. Every frame is therefore pinned to a shared
   horizontal centre and a shared FEET baseline, and any bob is added in code
   afterwards where it can be controlled.
"""
import sys
from collections import deque
from PIL import Image

def alpha(im, thresh=238, feather=210):
    w, h = im.size
    px = im.load()
    out = [255] * (w * h)
    seen = bytearray(w * h)
    q = deque()

    def push(x, y):
        i = y * w + x
        if seen[i]:
            return
        r, g, b = px[x, y][:3]
        if min(r, g, b) < feather:
            return
        seen[i] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0); push(x, h - 1)
    for y in range(h):
        push(0, y); push(w - 1, y)
    while q:
        x, y = q.popleft()
        r, g, b = px[x, y][:3]
        m = min(r, g, b)
        out[y * w + x] = 0 if m >= thresh else int(255 * (thresh - m) / (thresh - feather))
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h:
                push(nx, ny)
    a = Image.new('L', (w, h))
    a.putdata(out)
    return a

def columns(a, n):
    """Find the n frames across the strip.

    Blank columns separate frames -- except when they do not. Raph's mask
    tails and sai reach into the neighbouring cell, so his four frames come
    back as two merged runs. Any run wide enough to hold more than one frame
    is therefore cut again, at the column carrying the least ink near where
    the boundary should be: that is the gap between two characters even when
    a ribbon crosses it.
    """
    w, h = a.size
    px = a.load()
    ink = [sum(1 for y in range(0, h, 2) if px[x, y] > 40) for x in range(w)]
    cols = [v > 0 for v in ink]
    runs, start = [], None
    for x, on in enumerate(cols + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            if x - start > w // (n * 6):          # ignore specks
                runs.append((start, x))
            start = None

    cell = w / n
    out = []
    for x0, x1 in runs:
        parts = max(1, round((x1 - x0) / cell))
        if parts == 1:
            out.append((x0, x1))
            continue
        edges = [x0]
        for k in range(1, parts):
            want = x0 + (x1 - x0) * k / parts
            # search a window around the nominal boundary for the thinnest
            # column; ties go to the one nearest the nominal boundary.
            lo = max(edges[-1] + 1, int(want - cell * 0.22))
            hi = min(x1 - 1, int(want + cell * 0.22))
            cut = min(range(lo, hi + 1), key=lambda x: (ink[x], abs(x - want)))
            edges.append(cut)
        edges.append(x1)
        out += list(zip(edges[:-1], edges[1:]))
    return out

def slice_strip(src, out_prefix, n=4, target_h=256):
    im = Image.open(src).convert('RGBA')
    im.putalpha(alpha(im))
    runs = columns(im.getchannel('A'), n)
    if len(runs) != n:
        raise SystemExit(f'found {len(runs)} frames, expected {n}: {runs}')

    crops = [im.crop((x0, 0, x1, im.height)) for x0, x1 in runs]
    boxes = [c.getbbox() for c in crops]
    # Shared scale from the TALLEST frame, so no frame is ever upscaled.
    tallest = max(b[3] - b[1] for b in boxes)
    scale = target_h / tallest
    widest = max(b[2] - b[0] for b in boxes)
    cw = int(widest * scale) + 8
    ch = target_h + 8

    paths = []
    for i, (c, b) in enumerate(zip(crops, boxes)):
        fr = c.crop(b)
        fr = fr.resize((max(1, round(fr.width * scale)), max(1, round(fr.height * scale))),
                       Image.LANCZOS)
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        # centred horizontally, FEET on the canvas floor
        canvas.alpha_composite(fr, ((cw - fr.width) // 2, ch - fr.height - 4))
        p = f'{out_prefix}{i}.png'
        canvas.save(p)
        paths.append(p)
    return paths, (cw, ch)

if __name__ == '__main__':
    print(slice_strip(sys.argv[1], sys.argv[2],
                      int(sys.argv[3]) if len(sys.argv) > 3 else 4))
