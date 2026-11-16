# Draw the gadget-slot icons (public/ui/{shield,nitro,harpoon}.png) in the same round 256 px
# format as saws.png: dark disc, coloured rim, a simple bold symbol.
#   python3 tools/make-gadget-icons.py public/ui
import math, sys
from PIL import Image, ImageDraw, ImageFilter

S = 1024
c = S / 2
out = sys.argv[1]

def base(rim):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([16, 16, S - 16, S - 16], fill=(28, 26, 34, 255), outline=rim, width=22)
    return im, d

def glow(im, draw_fn, col, blur=22):
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(g), col)
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(blur)))

def save(im, name):
    im.resize((256, 256), Image.LANCZOS).save(f'{out}/{name}.png')

# RIOT SHIELD: a heater shield with a bright edge and a vertical rib
im, d = base((80, 180, 255, 255))
shield = [(c - 260, c - 300), (c + 260, c - 300), (c + 260, c + 20), (c, c + 330), (c - 260, c + 20)]
glow(im, lambda g, col: g.polygon(shield, fill=col), (80, 180, 255, 255))
d.polygon(shield, fill=(70, 78, 96, 255), outline=(150, 210, 255, 255))
d.line(shield + [shield[0]], fill=(150, 210, 255, 255), width=26, joint='curve')
d.rectangle([c - 22, c - 290, c + 22, c + 300], fill=(150, 210, 255, 255))
d.rectangle([c - 250, c - 120, c + 250, c - 80], fill=(150, 210, 255, 255))
save(im, 'shield')

# NITRO: a gas bottle with a blue flame out of its nozzle
im, d = base((70, 160, 255, 255))
flame = [(c + 140, c - 360), (c + 230, c - 170), (c + 170, c - 60), (c + 60, c - 120), (c + 90, c - 230)]
glow(im, lambda g, col: g.polygon(flame, fill=col), (80, 170, 255, 255), 30)
d.polygon(flame, fill=(120, 200, 255, 255))
d.polygon([(c + 130, c - 280), (c + 175, c - 170), (c + 120, c - 120), (c + 95, c - 180)], fill=(235, 248, 255, 255))
bottle = [c - 150, c - 120, c + 110, c + 330]
d.rounded_rectangle(bottle, radius=90, fill=(40, 110, 220, 255), outline=(170, 215, 255, 255), width=18)
d.rectangle([c - 60, c - 210, c + 30, c - 110], fill=(150, 156, 170, 255))
d.rectangle([c - 20, c - 160, c + 110, c - 120], fill=(150, 156, 170, 255))
d.rectangle([c - 150, c + 60, c + 110, c + 130], fill=(240, 240, 250, 255))
save(im, 'nitro')

# HARPOON: a barbed head on a shaft with a coiled cable
im, d = base((60, 220, 190, 255))
a = math.radians(-45)
def P(x, y):  # rotate around centre
    return (c + x * math.cos(a) - y * math.sin(a), c + x * math.sin(a) + y * math.cos(a))
head = [P(330, 0), P(160, -110), P(190, 0), P(160, 110)]
barbs = [[P(200, -40), P(120, -150), P(150, -40)], [P(200, 40), P(120, 150), P(150, 40)]]
glow(im, lambda g, col: g.polygon(head, fill=col), (60, 230, 200, 255))
d.line([P(-300, 0), P(180, 0)], fill=(196, 202, 214, 255), width=46)
d.polygon(head, fill=(220, 226, 236, 255), outline=(60, 230, 200, 255))
for b in barbs: d.polygon(b, fill=(220, 226, 236, 255))
for k in range(3):  # cable coil at the tail
    r = 90 + k * 34
    x, y = P(-260, 120)
    d.arc([x - r, y - r, x + r, y + r], 30, 330, fill=(60, 220, 190, 255), width=16)
save(im, 'harpoon')
print('ok')
