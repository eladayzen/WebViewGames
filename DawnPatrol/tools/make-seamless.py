#!/usr/bin/env python3
"""Make a generated texture tile SEAMLESSLY IN X, and prove that it does.

§9.6 rule 4 and §12 both flag horizontal seamless tiling of the wave face as a
real generation risk: "a repeating seam is very visible when the whole lower
frame is that texture scrolling at 864 px/s and rising. Verify by scrolling,
early, at POC-3, on the one texture, before five zones are commissioned."

Asking the image model for a seamless tile does not reliably produce one. What
does work is an offset-blend done locally on the generated art: take the last B
columns of the painting and cross-fade them over the first B columns, then crop
the tile to W-B. The result is genuinely periodic -- the last column and the
first column are neighbours in the ORIGINAL painting, so the wrap is a real
continuation of the brushwork rather than a cut.

This is a compositing operation on real illustrated art, not a procedurally
drawn pattern: the pixels are all Kolbo-generated paint (§9.1's standing rule).

  python3 tools/make-seamless.py IN OUT --width 4096 --height 1024 [--blend 900]

Prints a seam measurement: the mean absolute difference across the wrap join,
compared with the mean absolute difference between ordinary neighbouring
columns. A tile is seamless when the first number is no worse than the second.
"""
import argparse
import sys

from PIL import Image
import numpy as np


def offset_blend(arr, blend):
    h, w, c = arr.shape
    if blend >= w // 2:
        raise SystemExit(f'blend band {blend} too wide for a {w}px source')
    target = w - blend
    out = arr[:, :target].astype(np.float64).copy()
    ramp = np.linspace(0.0, 1.0, blend, dtype=np.float64)[None, :, None]
    tail = arr[:, target:target + blend].astype(np.float64)
    head = out[:, :blend]
    out[:, :blend] = tail * (1.0 - ramp) + head * ramp
    return out


def seam_report(arr):
    """Mean |delta| across the wrap join vs across ordinary interior columns."""
    a = arr.astype(np.float64)
    wrap = np.abs(a[:, -1] - a[:, 0]).mean()
    interior = np.abs(np.diff(a[:, :, :], axis=1)).mean()
    return wrap, interior


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--width', type=int, default=4096)
    ap.add_argument('--height', type=int, default=1024)
    ap.add_argument('--blend', type=int, default=None)
    args = ap.parse_args()

    im = Image.open(args.src).convert('RGB')
    arr = np.asarray(im)
    blend = args.blend if args.blend is not None else max(64, im.width // 6)

    before_wrap, before_interior = seam_report(arr)
    blended = offset_blend(arr, blend)
    out = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8))
    out = out.resize((args.width, args.height), Image.LANCZOS)

    after_wrap, after_interior = seam_report(np.asarray(out))
    out.save(args.dst)

    print(f'{args.src} {im.size} -> {args.dst} {out.size}  (blend band {blend}px)')
    print(f'  before: wrap delta {before_wrap:7.3f}   interior delta {before_interior:7.3f}')
    print(f'  after : wrap delta {after_wrap:7.3f}   interior delta {after_interior:7.3f}')
    verdict = 'SEAMLESS' if after_wrap <= after_interior * 1.6 else 'SEAM STILL VISIBLE'
    print(f'  verdict: {verdict}')
    if after_wrap > after_interior * 1.6:
        sys.exit(1)


if __name__ == '__main__':
    main()
