# Mikey's power icon (public/ui/mike.webp) from the current Mikey art
# (~/Documents/TMNT/TMNT MM Full body/wagonPrototype/Mikey.webp), in the same medallion format
# as the others: his head and shoulders on a blue disc inside the bronze ring, which is copied
# pixel-for-pixel from raph.webp so the set matches.
#   python3 tools/make-mike-icon.py "<path to Mikey.webp>" public/ui
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
S, R_IN = 256, 113            # icon size, inner radius of the ring
raph = Image.open(f'{out}/raph.webp').convert('RGBA')
bg = raph.getpixel((40, 128))  # the blue disc behind Raph

art = Image.open(src).convert('RGBA')
art = art.crop(art.getbbox())
cx, cy, side = 0.37 * art.width, 0.30 * art.height, 0.50 * art.width   # head + shoulders
head = art.crop((round(cx - side / 2), round(cy - side * 0.42), round(cx + side / 2), round(cy + side * 0.58))).resize((S, S), Image.LANCZOS)

disc = Image.new('RGBA', (S, S), bg)
disc.alpha_composite(head)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).ellipse([S / 2 - R_IN, S / 2 - R_IN, S / 2 + R_IN, S / 2 + R_IN], fill=255)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
icon.paste(disc, (0, 0), mask)
# the ring: everything of Raph's icon outside the inner radius
ring_mask = Image.new('L', (S, S), 255)
ImageDraw.Draw(ring_mask).ellipse([S / 2 - R_IN + 2, S / 2 - R_IN + 2, S / 2 + R_IN - 2, S / 2 + R_IN - 2], fill=0)
icon.paste(raph, (0, 0), Image.composite(raph.getchannel('A'), Image.new('L', (S, S), 0), ring_mask))
icon.save(f'{out}/mike.webp', 'WEBP', quality=88, method=6)
print('ok')
