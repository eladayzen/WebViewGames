// Foot Soldier enemy mesh: the licensee maquette STL (316k triangles, no UVs,
// not in the repo — ~/Documents/TMNT/3d/Maquette) welded, decimated with
// meshoptimizer, normalised to stand 1 unit tall on its feet at the origin, Y up,
// and written as a tiny raw binary the game reads straight into a BufferGeometry.
//
//   node tools/make-foot.mjs [targetTris=7000]
//
// public/models/foot.bin layout (little-endian):
//   u32 vertexCount, u32 indexCount, f32[vertexCount*3] positions, u32[indexCount] indices
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

const SRC = path.join(process.env.HOME, 'Documents/TMNT/3d/Maquette/TMNT_3D_Maquette_Foot_Soldier.stl');
const OUT = path.resolve('public/models/foot.bin');
const target = +(process.argv[2] || 7000);

const buf = fs.readFileSync(SRC);
const n = buf.readUInt32LE(80);
// weld identical corners so the simplifier sees one connected surface
const map = new Map();
const pos = [];
const idx = new Uint32Array(n * 3);
for (let t = 0; t < n; t++) {
  const o = 84 + t * 50 + 12;
  for (let v = 0; v < 3; v++) {
    const x = buf.readFloatLE(o + v * 12), y = buf.readFloatLE(o + v * 12 + 4), z = buf.readFloatLE(o + v * 12 + 8);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let id = map.get(key);
    if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(x, y, z); }
    idx[t * 3 + v] = id;
  }
}
const P = new Float32Array(pos);
console.log('in ', n, 'tris,', P.length / 3, 'verts');

await MeshoptSimplifier.ready;
const [simp, err] = MeshoptSimplifier.simplify(idx, P, 3, target * 3, 0.02, ['LockBorder']);
console.log('out', simp.length / 3, 'tris, error', err.toFixed(4));

// compact the vertex buffer to what's referenced
const remap = new Map();
const outPos = [];
const outIdx = new Uint32Array(simp.length);
for (let i = 0; i < simp.length; i++) {
  let r = remap.get(simp[i]);
  if (r === undefined) { r = outPos.length / 3; remap.set(simp[i], r); outPos.push(P[simp[i] * 3], P[simp[i] * 3 + 1], P[simp[i] * 3 + 2]); }
  outIdx[i] = r;
}
// normalise: Y up (the maquette's tallest axis), feet at y=0, centred on x/z, 1 unit tall
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < outPos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], outPos[i + a]); mx[a] = Math.max(mx[a], outPos[i + a]); }
const h = mx[1] - mn[1];
const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
for (let i = 0; i < outPos.length; i += 3) {
  outPos[i] = (outPos[i] - cx) / h;
  outPos[i + 1] = (outPos[i + 1] - mn[1]) / h;
  outPos[i + 2] = (outPos[i + 2] - cz) / h;
}
const vc = outPos.length / 3;
const out = Buffer.alloc(8 + vc * 12 + outIdx.length * 4);
out.writeUInt32LE(vc, 0); out.writeUInt32LE(outIdx.length, 4);
Buffer.from(new Float32Array(outPos).buffer).copy(out, 8);
Buffer.from(outIdx.buffer).copy(out, 8 + vc * 12);
fs.writeFileSync(OUT, out);
console.log('->', OUT, (out.length / 1024).toFixed(0), 'KB');
