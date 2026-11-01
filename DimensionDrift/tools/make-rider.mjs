// RAPHAEL, from a 31k-triangle Mixamo FBX to something this game can carry.
//
// Kept in the tree because an asset pipeline that lives in somebody's shell
// history is an asset that cannot be rebuilt. Every number here was arrived at
// against a measurement and two of them cost a round each to find — see the
// flip-V note and the bind-height note below.
//
// INPUTS, which are not in this repo (they are in ~/Documents/3d):
//   raph-raw.glb      Ref/rigged/model@Skateboarding.fbx, run through three's
//                     FBXLoader and GLTFExporter in a browser. That round trip
//                     is what carries the SKIN across; nothing in node reads
//                     FBX. Materials are stripped on the way out because the
//                     FBX's texture is an external reference GLTFExporter
//                     cannot resolve ("No valid image data found").
//   fbx-diffuse.png   the same FBX's diffuse, read back off the loaded
//                     three material through a canvas once the image has
//                     actually decoded — which takes a beat after the load
//                     callback fires, and reads as `null` if you look too soon.
//
// OUTPUT: public/models/raphael.glb, 8,835 triangles, 904 KB.
//
//   node tools/make-rider.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { simplify, weld, dedup, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const DIR = '/private/tmp/claude-501/-Users-eladayzen-UnityProjects-bobo-play-web-games-carve/ab559f97-1d34-4aab-bce3-96b2576a0f69/scratchpad/view';
const io = new NodeIO();
const doc = await io.read(path.join(DIR, 'raph-raw.glb'));
const root = doc.getRoot();

const count = () => root.listMeshes().reduce((a, m) => a + m.listPrimitives()
  .reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
console.log('in   ', Math.round(count()), 'triangles');

// ── THE TEXTURE GOES ON FIRST, AND THAT ORDER IS NOT COSMETIC ──────────────
// `prune()` removes attributes nothing references, and a UV set on a material
// with no map is exactly that. Attaching the albedo after the pipeline left a
// mesh with POSITION, NORMAL, JOINTS and WEIGHTS and no TEXCOORD_0 at all —
// a correctly decimated, correctly skinned, completely untexturable turtle.
//
// `lit.js` is one hand-written flat-shaded model with no PBR path: it reads a
// base colour and an optional map and nothing else. The normal, metallic and
// roughness maps have nowhere to go, so they are not carried.
const png = fs.readFileSync(path.join(DIR, 'fbx-diffuse.png'));
const jpg = await sharp(png).resize(1024, 1024, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer();
console.log('tex  ', (png.length / 1048576).toFixed(1), 'MB 2048 png ->', (jpg.length / 1024).toFixed(0), 'KB 1024 jpg');
const tex = doc.createTexture('raphael').setImage(jpg).setMimeType('image/jpeg');
for (const mat of root.listMaterials()) {
  mat.setBaseColorTexture(tex);
  mat.setBaseColorFactor([1, 1, 1, 1]);
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(1);
}

// ── FLIP V ─────────────────────────────────────────────────────────────────
// FBX puts the UV origin at the BOTTOM left and glTF puts it at the TOP left.
// three's FBXLoader handles the difference at the sampler (`texture.flipY`),
// which glTF has no equivalent for — so GLTFExporter writes the raw UVs and
// the result samples the atlas upside down.
//
// On a character this does NOT look like a mirrored texture, which is what
// made it worth a note: the atlas is a patchwork of islands, so a V flip
// sends every island to a different island's pixels and the turtle comes out
// in green, red and brown CAMOUFLAGE. Two rounds went into suspecting the
// decimator and the wrong texture file before the actual cause, which is one
// subtraction.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const uv = prim.getAttribute('TEXCOORD_0');
    if (!uv) continue;
    const a = uv.getArray();
    for (let i = 1; i < a.length; i += 2) a[i] = 1 - a[i];
    uv.setArray(a);
  }
}

await MeshoptSimplifier.ready;
// WELD FIRST or the simplifier sees a cloud of unshared vertices and can
// collapse almost nothing. The FBX arrives unindexed through three.
await doc.transform(
  weld(),
  dedup(),
  // 0.26 lands near 8,000 — a third over the 5,917 the current rider carries,
  // which is the right side of it for a character with a shell on his back.
  // lockBorder keeps the UV seams from tearing, which on a texture-atlased
  // character is the difference between a decimate and a ruin.
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.26, error: 0.004, lockBorder: true }),
  resample(),
  prune(),
  dedup(),
);
console.log('out  ', Math.round(count()), 'triangles');

// ── CENTIMETRES TO METRES, AND DOWN TO THE SIZE THE CODE ASSUMES ───────────
// Mixamo FBX ships in centimetres and this one stands 185 units tall. The
// game's `RIDER_SCALE = 1.06` carries a comment saying what it assumes —
// "Mixamo ships ~1.6 m" — so the honest place to absorb the difference is
// here, in the asset, rather than by changing a constant that every rider in
// every mode reads. 1.60 / 185.2 = 0.00864.
//
// Baked onto the SCENE ROOT rather than into the vertices, so the skeleton's
// bind matrices and the mesh stay in the units they were authored in and
// nothing has to be re-derived if this number is wrong.
const TARGET_M = 1.60;
// MEASURED IN WORLD SPACE, NOT OFF THE ACCESSOR. A skinned mesh's POSITION
// attribute is in bind-local space and its real size comes from the inverse
// bind matrices and the bone chain — reading the accessor's own extent here
// returned 0.8 for a character who stands 185 units tall, and scaling by the
// ratio made him twice as wrong as before. The height below is the one the
// viewer reports after skinning, which is the number that matters.
const BIND_HEIGHT = 185.1;
const k = TARGET_M / BIND_HEIGHT;
console.log('scale', BIND_HEIGHT, 'units ->', TARGET_M, 'm  (x' + k.toFixed(5) + ')');
for (const scene of root.listScenes()) {
  for (const node of scene.listChildren()) {
    const sc = node.getScale();
    node.setScale([sc[0] * k, sc[1] * k, sc[2] * k]);
    const tr = node.getTranslation();
    node.setTranslation([tr[0] * k, tr[1] * k, tr[2] * k]);
  }
}

const out = path.join(DIR, 'raphael.glb');
await io.write(out, doc);
console.log('wrote', (fs.statSync(out).size / 1024).toFixed(0), 'KB ->', out);
