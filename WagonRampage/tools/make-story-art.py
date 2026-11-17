# Story-screen art from Elad's TMNT full-body renders (~/Documents/TMNT/TMNT MM Full body/
# wagonPrototype). Each one is trimmed to its alpha box and saved twice, as small WebP:
#   public/story/<name>.webp       full body, 720 px tall  (the level intro / outro scenes)
#   public/story/<name>_head.webp  square head crop, 192 px (the in-game speech popups; the
#                                  CSS rounds it, so the mask lives in one place)
#   python3 tools/make-story-art.py "<src dir>" public/story
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
# name: (file, head centre x, head centre y, head box size) — fractions of the trimmed image
ART = {
    'mikey':     ('Mikey.webp',          0.37, 0.28, 0.36),
    'raph_q':    ('RefaelQuestion.png',  0.48, 0.12, 0.40),
    'donnie':    ('Doni.webp',           0.78, 0.47, 0.30),
    'leo':       ('Leo.webp',            0.56, 0.29, 0.38),
    'raph_good': ('RefaelGood.png',      0.47, 0.12, 0.42),
}
for name, (f, hx, hy, hs) in ART.items():
    im = Image.open(f'{src}/{f}').convert('RGBA')
    im = im.crop(im.getbbox())
    full = im.resize((round(im.width * 720 / im.height), 720), Image.LANCZOS)
    full.save(f'{out}/{name}.webp', 'WEBP', quality=82, method=6)
    side = hs * im.width
    cx, cy = hx * im.width, hy * im.height
    box = [round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2)]
    head = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    head.paste(im.crop(box), (0, 0))
    head.resize((192, 192), Image.LANCZOS).save(f'{out}/{name}_head.webp', 'WEBP', quality=85, method=6)
    print(name, full.size)
