# Draw the SAW BLADES power icon (public/ui/saws.png): a steel circular-saw blade with a hot
# orange rim on a dark disc, same 256 px round format as the turtle heads.
#   python3 tools/make-saw-icon.py public/ui/saws.png
import math, sys
from PIL import Image, ImageDraw, ImageFilter

S = 1024  # draw big, downsample for clean edges
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
c = S / 2
d.ellipse([16, 16, S - 16, S - 16], fill=(28, 26, 34, 255), outline=(255, 170, 40, 255), width=22)

teeth, R0, R1 = 18, 330, 420
pts = []
for i in range(teeth):
    a0 = i / teeth * math.tau
    a1 = (i + 0.62) / teeth * math.tau
    a2 = (i + 1) / teeth * math.tau
    pts += [(c + R0 * math.cos(a0), c + R0 * math.sin(a0)),
            (c + R1 * math.cos(a1), c + R1 * math.sin(a1)),
            (c + R0 * math.cos(a2 - 0.001), c + R0 * math.sin(a2 - 0.001))]
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).polygon(pts, fill=(255, 140, 30, 255))
im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))
d.polygon(pts, fill=(196, 202, 214, 255), outline=(90, 94, 104, 255))
d.ellipse([c - 300, c - 300, c + 300, c + 300], fill=(150, 156, 170, 255))
for k in range(6):  # expansion slots
    a = k / 6 * math.tau
    x, y = c + 205 * math.cos(a), c + 205 * math.sin(a)
    d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(70, 72, 82, 255))
d.ellipse([c - 120, c - 120, c + 120, c + 120], fill=(60, 62, 72, 255))
d.ellipse([c - 60, c - 60, c + 60, c + 60], fill=(255, 176, 50, 255))
im.resize((256, 256), Image.LANCZOS).save(sys.argv[1])
print('ok')
