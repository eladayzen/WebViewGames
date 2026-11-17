"""Quick asset diet for public/ (run once; safe to re-run).

  python3 tools/optimize-assets.py public

1. (disabled) Car GLB quantization: broke rendering, see the note at the call site.
2. Animation JSON: clips.json keeps only the clips the game plays (ride, flip, and one frame
   of spin, which Mikey is frozen in); floats in clips.json and throws.json rounded to 4 dp.
3. UI icons: ui/*.png -> ui/*.webp (the code loads .webp).
"""
import json, struct, sys, os, glob, math
from PIL import Image

pub = sys.argv[1]

def read_glb(f):
    b = open(f, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    g = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack_from('<I', b, o)[0]
    return g, bytearray(b[o + 8:o + 8 + bl])

def write_glb(f, g, binc):
    while len(binc) % 4: binc += b'\0'
    js = json.dumps(g, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binc))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binc), 0x004E4942) + bytes(binc)
    open(f, 'wb').write(out)

CT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4), 5122: ('h', 2), 5120: ('b', 1), 5121: ('B', 1)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def read_acc(g, binc, ai):
    a = g['accessors'][ai]; bv = g['bufferViews'][a['bufferView']]
    fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    stride = bv.get('byteStride', sz * n)
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<' + fmt * n, binc, base + i * stride) for i in range(a['count'])]

def quantize_car(f):
    g, binc = read_glb(f)
    if 'KHR_mesh_quantization' in g.get('extensionsUsed', []):
        print('skip (already quantized)', f); return
    before = os.path.getsize(f)
    out = bytearray()
    views = []
    def add_view(data, stride=None, target=None):
        while len(out) % 4: out.extend(b'\0')
        v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
        if stride: v['byteStride'] = stride
        if target: v['target'] = target
        out.extend(data); views.append(v); return len(views) - 1
    # copy every non-vertex view (indices, images) as-is, remembering the new index
    remap = {}
    vert_views = set()
    for m in g['meshes']:
        for p in m['primitives']:
            for k, ai in p['attributes'].items(): vert_views.add(g['accessors'][ai]['bufferView'])
    for i, bv in enumerate(g['bufferViews']):
        if i in vert_views: continue
        data = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        nv = dict(bv); nv.pop('byteOffset', None)
        while len(out) % 4: out.extend(b'\0')
        nv['byteOffset'] = len(out); out.extend(data); views.append(nv); remap[i] = len(views) - 1
    for a in g['accessors']:
        if 'bufferView' in a and a['bufferView'] in remap: a['bufferView'] = remap[a['bufferView']]
    for im in g.get('images', []):
        if 'bufferView' in im: im['bufferView'] = remap[im['bufferView']]
    # mesh -> node (each mesh must be used by exactly one node without its own transform)
    node_of = {}
    for ni, n in enumerate(g['nodes']):
        if 'mesh' in n: node_of[n['mesh']] = ni
    for mi, m in enumerate(g['meshes']):
        node = g['nodes'][node_of[mi]]
        assert not any(k in node for k in ('matrix', 'translation', 'rotation', 'scale')), 'node has a transform'
        allp = []
        for p in m['primitives']: allp += read_acc(g, binc, p['attributes']['POSITION'])
        lo = [min(v[i] for v in allp) for i in range(3)]; hi = [max(v[i] for v in allp) for i in range(3)]
        c = [(lo[i] + hi[i]) / 2 for i in range(3)]
        half = max((hi[i] - lo[i]) / 2 for i in range(3)) or 1.0
        node['translation'] = c; node['scale'] = [half] * 3
        for p in m['primitives']:
            at = p['attributes']
            pos = read_acc(g, binc, at['POSITION'])
            q = [tuple(max(-32767, min(32767, round((v[i] - c[i]) / half * 32767))) for i in range(3)) for v in pos]
            data = b''.join(struct.pack('<hhhh', *t, 0) for t in q)
            vi = add_view(data, 8, 34962)
            g['accessors'].append({'bufferView': vi, 'componentType': 5122, 'normalized': True, 'count': len(q), 'type': 'VEC3',
                                   'min': [min(t[i] for t in q) / 32767 for i in range(3)], 'max': [max(t[i] for t in q) / 32767 for i in range(3)]})
            at['POSITION'] = len(g['accessors']) - 1
            if 'NORMAL' in at:
                nrm = read_acc(g, binc, at['NORMAL'])
                data = b''.join(struct.pack('<bbbb', *[max(-127, min(127, round(x * 127))) for x in v], 0) for v in nrm)
                vi = add_view(data, 4, 34962)
                g['accessors'].append({'bufferView': vi, 'componentType': 5120, 'normalized': True, 'count': len(nrm), 'type': 'VEC3'})
                at['NORMAL'] = len(g['accessors']) - 1
            if 'TEXCOORD_0' in at:
                uv = read_acc(g, binc, at['TEXCOORD_0'])
                if all(0 <= x <= 1 for v in uv for x in v):
                    data = b''.join(struct.pack('<HH', *[round(x * 65535) for x in v]) for v in uv)
                    vi = add_view(data, 4, 34962)
                    g['accessors'].append({'bufferView': vi, 'componentType': 5123, 'normalized': True, 'count': len(uv), 'type': 'VEC2'})
                    at['TEXCOORD_0'] = len(g['accessors']) - 1
    # drop now-unreferenced accessors (the old float ones) by rebuilding the list
    used = set()
    for m in g['meshes']:
        for p in m['primitives']:
            used.update(p['attributes'].values())
            if 'indices' in p: used.add(p['indices'])
    keep = sorted(used); amap = {o: n for n, o in enumerate(keep)}
    g['accessors'] = [g['accessors'][i] for i in keep]
    for m in g['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = amap[p['indices']]
    # drop views nobody points at
    vused = {a['bufferView'] for a in g['accessors']} | {im['bufferView'] for im in g.get('images', []) if 'bufferView' in im}
    vkeep = sorted(vused); vmap = {o: n for n, o in enumerate(vkeep)}
    final = bytearray(); newviews = []
    for i in vkeep:
        v = dict(views[i]); data = out[v['byteOffset']: v['byteOffset'] + v['byteLength']]
        while len(final) % 4: final.extend(b'\0')
        v['byteOffset'] = len(final); final.extend(data); newviews.append(v)
    for a in g['accessors']: a['bufferView'] = vmap[a['bufferView']]
    for im in g.get('images', []):
        if 'bufferView' in im: im['bufferView'] = vmap[im['bufferView']]
    g['bufferViews'] = newviews
    g['buffers'] = [{'byteLength': len(final)}]
    g.setdefault('extensionsUsed', []).append('KHR_mesh_quantization')
    g.setdefault('extensionsRequired', []).append('KHR_mesh_quantization')
    write_glb(f, g, final)
    print('quantized', f, before, '->', os.path.getsize(f))

# NOT RUN: quantize_car() produced cars that didn't render at all (world scale ~70000 on the
# mesh; measured 2026-11-17, every car vanished). Left here unfinished; fix before using.
# for name in ('wagon', 'foot_racer', 'foot_truck'):
#     quantize_car(f'{pub}/models/{name}.glb')

def rnd(x):
    if isinstance(x, float): return round(x, 4)
    if isinstance(x, list): return [rnd(v) for v in x]
    if isinstance(x, dict): return {k: rnd(v) for k, v in x.items()}
    return x

cf = f'{pub}/models/clips.json'
before = os.path.getsize(cf)
clips = json.load(open(cf))
keep = {k: clips[k] for k in ('ride', 'flip', 'spin') if k in clips}
# spin: Mikey only ever shows the frame at 7.0 s — keep that one key per track
sp = keep['spin']
for tr in sp['tracks']:
    n = len(tr['values']) // len(tr['times'])
    i = min(range(len(tr['times'])), key=lambda k: abs(tr['times'][k] - 7.0))
    tr['times'] = [7.0]; tr['values'] = tr['values'][i * n:(i + 1) * n]
json.dump(rnd(keep), open(cf, 'w'), separators=(',', ':'))
print('clips.json', before, '->', os.path.getsize(cf))
tf = f'{pub}/models/throws.json'
before = os.path.getsize(tf)
json.dump(rnd(json.load(open(tf))), open(tf, 'w'), separators=(',', ':'))
print('throws.json', before, '->', os.path.getsize(tf))

for f in glob.glob(f'{pub}/ui/*.png'):
    w = f[:-4] + '.webp'
    Image.open(f).save(w, 'WEBP', quality=88, method=6)
    print(os.path.basename(f), os.path.getsize(f), '->', os.path.getsize(w))
    os.remove(f)
