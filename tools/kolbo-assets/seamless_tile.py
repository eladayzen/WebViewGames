#!/usr/bin/env python3
"""Make a stochastic texture tile without a visible seam.

The generator was asked for a tileable square and produced something that
merely LOOKS even -- its left edge still does not meet its right edge, and a
tiled floor shows that as a hard grid of lines, which is worse than no texture
at all.

The fix is the standard one, and it only works because asphalt is noise:

    B = A rolled by half the image in both axes

B's OUTER edges are A's centre, so they now meet each other perfectly. The
original seam has moved to a cross through the middle of B, where it can be
covered: A's own centre is continuous texture of the same kind, so it is
blended over that cross through a feathered mask. Nothing is invented and the
result tiles exactly.

Mirror-tiling would also be seamless and would be one line, but it makes the
floor symmetrical, and at this tile size the eye reads that as a repeating
kaleidoscope within a couple of screens.
"""
import sys
import numpy as np
from PIL import Image


def seamless(src, dst, size=512, band=0.42, feather=0.16):
    a = np.asarray(Image.open(src).convert('RGB').resize((size, size), Image.LANCZOS),
                   dtype=np.float32)
    h = size // 2
    b = np.roll(np.roll(a, h, axis=0), h, axis=1)

    # A feathered box over the middle, where B's seam cross lies.
    axis = np.abs(np.arange(size) - (size - 1) / 2) / (size / 2)   # 0 centre .. 1 edge
    inner, outer = band, min(1.0, band + feather)
    ramp = np.clip((outer - axis) / (outer - inner), 0.0, 1.0)
    mask = np.minimum(ramp[:, None], ramp[None, :])[..., None]

    out = b * (1 - mask) + a * mask
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst)

    # Report the worst wrap discontinuity, so "seamless" is measured and not
    # claimed: mean absolute difference between opposite edges, 0-255.
    o = np.asarray(Image.open(dst).convert('RGB'), dtype=np.float32)
    lr = np.abs(o[:, 0] - o[:, -1]).mean()
    tb = np.abs(o[0, :] - o[-1, :]).mean()
    # ...against a baseline of how different two ADJACENT interior columns are.
    nat = np.abs(o[:, size // 3] - o[:, size // 3 + 1]).mean()
    return {'left_right': round(float(lr), 2), 'top_bottom': round(float(tb), 2),
            'neighbouring_columns': round(float(nat), 2)}


if __name__ == '__main__':
    print(seamless(sys.argv[1], sys.argv[2],
                   int(sys.argv[3]) if len(sys.argv) > 3 else 512))
