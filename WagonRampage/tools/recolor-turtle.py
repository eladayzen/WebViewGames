# Recolour Raph's texture into another turtle: the red mask/pads (hue near 0, saturated) are
# rotated to the target hue; skin green and everything else is left alone.
#   python3 tools/recolor-turtle.py <raph_tex.jpg> <out.jpg> <target hue deg> [sat x] [val x]
import sys
import numpy as np
from PIL import Image

src, out, hue = sys.argv[1], sys.argv[2], float(sys.argv[3])
sat_k = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
val_k = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
hsv = np.asarray(Image.open(src).convert('RGB').convert('HSV')).astype(np.float32)
h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1], hsv[..., 2]
d = np.minimum(np.abs(h), 360 - np.abs(h))            # distance from red
w = np.clip((30 - d) / 12, 0, 1) * np.clip((s - 60) / 40, 0, 1)
h2 = np.where(w > 0, hue, h)
hsv[..., 0] = (h * (1 - w) + h2 * w) % 360 * 255 / 360
hsv[..., 1] = np.clip(s * (1 - w + w * sat_k), 0, 255)
hsv[..., 2] = np.clip(v * (1 - w + w * val_k), 0, 255)
Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB').save(out, quality=90)
print('masked px', int((w > 0.5).sum()))
