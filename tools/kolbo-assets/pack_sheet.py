#!/usr/bin/env python3
"""Despeckle the sliced frames and pack each character into one strip sheet.

ONE SHEET PER CHARACTER, not one file per frame. Twenty files would be twenty
requests on a device that pulls every one of them out of the APK; five are
five. The cell size is uniform within a sheet so the game can index frames by
multiplication instead of shipping a frame table.
"""
import sys
from collections import deque
from PIL import Image

def despeckle(im, min_px=60):
    """Drop isolated opaque islands -- generator dust the cutout preserved."""
    a = im.getchannel('A')
    w, h = im.size
    px = a.load()
    seen = bytearray(w * h)
    kill = []
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or px[sx, sy] <= 24:
                continue
            blob, q = [], deque([(sx, sy)])
            seen[i] = 1
            while q:
                x, y = q.popleft()
                blob.append((x, y))
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and px[nx, ny] > 24:
                            seen[j] = 1
                            q.append((nx, ny))
            if len(blob) < min_px:
                kill += blob
    if kill:
        ap = a.load()
        for x, y in kill:
            ap[x, y] = 0
        im.putalpha(a)
    return im, len(kill)

def pack(prefix, n, out, cell_h=176):
    frames = [despeckle(Image.open(f'{prefix}{i}.png').convert('RGBA'))
              for i in range(n)]
    dropped = sum(d for _, d in frames)
    frames = [f for f, _ in frames]
    # One cell size for the whole sheet, taken from the frames themselves so
    # nothing is clipped and nothing is upscaled.
    src_w, src_h = frames[0].size
    s = cell_h / src_h
    cw, ch = round(src_w * s), cell_h
    sheet = Image.new('RGBA', (cw * n, ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f.resize((cw, ch), Image.LANCZOS), (i * cw, 0))
    sheet.save(out, 'WEBP', quality=92, method=6)
    return out, (cw, ch), dropped

if __name__ == '__main__':
    print(pack(sys.argv[1], int(sys.argv[2]), sys.argv[3]))
