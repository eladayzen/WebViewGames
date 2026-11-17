# TURN THE PAINTED PLAZA BACK INTO STONE.
#
# nano-banana read "cool blue-grey stone, teal only in the runes and the moss"
# as "make everything teal": the raw generation's mean hue is 0.527 (cyan) at
# 0.30 saturation, so the whole floor -- not just the accents -- came out mint.
# Under the scene's light that reads as a green room, which is the one thing
# the floor must not be, because the player is a bright green turtle and a
# green character on a green floor is the legibility failure this art exists
# to avoid.
#
# Regenerating was the obvious move and the wrong one: the DRAWING is good --
# the flagstones, the dais, the spokes, the grates, the composition -- and
# rerolling it to fix a colour cast throws away the part that is hard to get
# and keeps re-rolling the part that is easy.
#
# So this is a grade, not a regeneration. It desaturates by how saturated a
# pixel already is: stone (low/mid saturation) collapses toward neutral, while
# the runes and the ooze (high saturation) are left almost untouched. The
# accents survive as accents, the stone goes blue-grey, and Raphael becomes
# the only saturated green on screen.
#
#   python3 -I tools/grade-floor.py <in.png|jpg> <out.jpg>
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32) / 255.0

mx = a.max(axis=2)
mn = a.min(axis=2)
sat = np.where(mx > 1e-5, (mx - mn) / np.maximum(mx, 1e-5), 0.0)

# Rec.709 luma, so desaturating does not also change how light the stone is.
lum = (a * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).sum(axis=2, keepdims=True)

# How much colour a pixel keeps. Flat at 0.20 for stone, ramping to 0.95 once
# a pixel is saturated enough to be a rune or a puddle rather than a flagstone.
KEEP_LO, KEEP_HI = 0.20, 0.95
S0, S1 = 0.30, 0.62
t = np.clip((sat - S0) / (S1 - S0), 0.0, 1.0)[..., None]
keep = KEEP_LO + (KEEP_HI - KEEP_LO) * (t * t * (3 - 2 * t))      # smoothstep
out = lum + (a - lum) * keep

# A cool cast on what is left, so neutral stone reads as cold wet stone rather
# than as grey card. Blue up, green down -- the opposite of the cast removed.
out *= np.array([0.985, 0.995, 1.055], dtype=np.float32)

out = np.clip(out, 0.0, 1.0)
Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(dst, quality=88, subsampling=1, optimize=True)

def report(arr, label):
    m = arr.reshape(-1, 3).mean(axis=0)
    mx2, mn2 = arr.max(axis=2), arr.min(axis=2)
    s = np.where(mx2 > 1e-5, (mx2 - mn2) / np.maximum(mx2, 1e-5), 0).mean()
    print(f'{label}: mean RGB {m[0]*255:.0f} {m[1]*255:.0f} {m[2]*255:.0f}   mean sat {s:.3f}')

report(a, 'before')
report(out, 'after ')
