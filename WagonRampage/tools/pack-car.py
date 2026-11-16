"""Shrink a Meshy car GLB for the phone.

Meshy exports ~12 MB GLBs: one mesh, one material, four 4K-ish maps (emissive,
normal, base colour, metal/rough). The game only uses base colour + normal and
tints the base colour in code, so this keeps the mesh bytes untouched, re-encodes
base colour to 1024 JPEG and normal to 512 JPEG, swaps the other two images for a
1x1 placeholder and drops them from the material.

    python3 tools/pack-car.py <in.glb> <out.glb> [--base 1024] [--normal 512]
"""
import io, json, struct, sys, argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--base', type=int, default=1024)
ap.add_argument('--normal', type=int, default=512)
a = ap.parse_args()

b = open(a.src, 'rb').read()
jl = struct.unpack_from('<I', b, 12)[0]
g = json.loads(b[20:20 + jl])
bin0 = 20 + jl
bl = struct.unpack_from('<I', b, bin0)[0]
binc = b[bin0 + 8: bin0 + 8 + bl]

mat = g['materials'][0]
pbr = mat['pbrMetallicRoughness']
tex_img = lambda ti: g['textures'][ti]['source']
base_img = tex_img(pbr['baseColorTexture']['index'])
norm_img = tex_img(mat['normalTexture']['index'])

def jpeg(raw, size):
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
    o = io.BytesIO(); im.save(o, 'JPEG', quality=85); return o.getvalue()

tiny = io.BytesIO(); Image.new('RGB', (1, 1), (0, 0, 0)).save(tiny, 'JPEG'); tiny = tiny.getvalue()
img_view = {im['bufferView']: i for i, im in enumerate(g['images'])}
new_views, out = [], bytearray()
for vi, bv in enumerate(g['bufferViews']):
    raw = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    if vi in img_view:
        ii = img_view[vi]
        raw = jpeg(raw, a.base) if ii == base_img else jpeg(raw, a.normal) if ii == norm_img else tiny
        g['images'][ii]['mimeType'] = 'image/jpeg'
    while len(out) % 4: out.append(0)
    nb = dict(bv); nb['byteOffset'] = len(out); nb['byteLength'] = len(raw)
    out += raw; new_views.append(nb)
while len(out) % 4: out.append(0)
g['bufferViews'] = new_views
g['buffers'] = [{'byteLength': len(out)}]
mat.pop('emissiveTexture', None); mat.pop('emissiveFactor', None)
pbr.pop('metallicRoughnessTexture', None)
pbr['metallicFactor'] = 0.0; pbr['roughnessFactor'] = 0.6

js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
total = 12 + 8 + len(js) + 8 + len(out)
f = open(a.dst, 'wb')
f.write(struct.pack('<III', 0x46546C67, 2, total))
f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
f.close()
print(a.dst, total // 1024, 'KB')
