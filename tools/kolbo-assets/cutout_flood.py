#!/usr/bin/env python3
"""Edge-connected white cutout.

The global near-white key in tools/kolbo-assets/remove_white_bg.py eats the
eye sclera on these characters -- big white eyes are the whole style. Flood
fill inward from the border instead, so anything enclosed by the ink outline
(eyes, highlights, the plastron) survives.
"""
import sys
from collections import deque
from PIL import Image

def cut(src, dst, max_edge=256, thresh=238, feather=210):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    out = [255] * (w * h)
    seen = bytearray(w * h)
    q = deque()

    def push(x, y):
        i = y * w + x
        if seen[i]:
            return
        r, g, b, _ = px[x, y]
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
        i = y * w + x
        r, g, b, _ = px[x, y]
        m = min(r, g, b)
        # Full cut above thresh, linear feather down to `feather` so the
        # anti-aliased rim dissolves instead of leaving a white halo.
        out[i] = 0 if m >= thresh else int(255 * (thresh - m) / (thresh - feather))
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h:
                push(nx, ny)

    alpha = Image.new('L', (w, h))
    alpha.putdata(out)
    im.putalpha(alpha)
    im = im.crop(im.getbbox())
    if max(im.size) > max_edge:
        s = max_edge / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(dst)
    return im.size

if __name__ == '__main__':
    print(cut(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 256))
