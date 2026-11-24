"""Kolbo white-background PNGs (art/raw) -> trimmed transparent webp in src/assets.
White key = flood fill from the border (white inside the art survives), with a
soft alpha ramp so anti-aliased and hazy edges dissolve.
usage: python3 tools/cut_env.py   (from TmntRooftopRun/)"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageOps

RAW = 'art/raw'; OUT = 'src/assets'
os.makedirs(OUT, exist_ok=True)

def key_white(im, lo=225):
    im = im.convert('RGBA'); a = np.asarray(im).astype(np.int32)
    m = a[..., :3].min(axis=2)
    mask = Image.fromarray(np.where(m >= lo, 255, 0).astype(np.uint8), 'L').copy()
    W, H = mask.size; px = mask.load()
    for x in range(W):
        for y in (0, H - 1):
            if px[x, y] == 255: ImageDraw.floodfill(mask, (x, y), 128)
    for y in range(H):
        for x in (0, W - 1):
            if px[x, y] == 255: ImageDraw.floodfill(mask, (x, y), 128)
    bg = np.asarray(mask) == 128
    # grow the background by the soft ramp: near-white pixels next to it fade
    alpha = np.where(bg, np.clip((248 - m) * 255 // 30, 0, 255), 255).astype(np.uint8)
    a[..., 3] = alpha
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def save(im, name, max_w=None, max_h=None):
    im = im.crop(im.getbbox())
    s = 1.0
    if max_w: s = min(s, max_w / im.width)
    if max_h: s = min(s, max_h / im.height)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = os.path.join(OUT, name + '.webp'); im.save(p, 'WEBP', quality=88, method=6); print(p, im.size)

R = lambda n: Image.open(os.path.join(RAW, n))
save(key_white(R('skyline.png')), 'skyline', max_h=900)
save(key_white(R('bridge.png')), 'bridge', max_w=1024)
def key_all_white(im, lo=242):
    a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., :3].min(axis=2) >= lo, 0, a[..., 3]); return Image.fromarray(a, 'RGBA')
save(key_all_white(key_white(R('tower.png'))), 'tower', max_h=700)        # white trapped between the legs
pr = key_white(R('props.png')); pa = np.asarray(pr).copy()
pa[..., 3] = np.where(pa[..., :3].min(axis=2) >= 240, 0, pa[..., 3])       # white trapped under the props
save(Image.fromarray(pa, 'RGBA'), 'props', max_w=800)
save(ImageOps.mirror(key_white(R('foot.png'))), 'foot', max_h=600)      # face left, toward the turtle
save(key_white(R('pizza.png')), 'pizza', max_h=256)
save(key_white(R('cornice.png')), 'cornice', max_w=1024)
f = R('facade.jpeg').convert('RGB'); f = f.resize((1024, 1024), Image.LANCZOS)
f.save(os.path.join(OUT, 'facade.webp'), 'WEBP', quality=85, method=6); print('facade', f.size)

# ---- pass 2 (match the concept)
save(key_white(R('skyline2.png')), 'skyline2', max_w=1300)
save(key_white(R('skyline3.png')), 'skyline3', max_w=1300)
save(key_white(R('cloud1.png'), lo=236), 'cloud1', max_w=1000)
save(key_white(R('cloud2.png'), lo=236), 'cloud2', max_w=900)
save(key_white(R('bldA.png')), 'bldA', max_h=1000)
save(key_white(R('bldB.png')), 'bldB', max_h=1000)
save(key_all_white(key_white(R('billboard.png'))), 'billboard', max_w=700)
save(key_white(R('hut.png')), 'hut', max_w=600)
