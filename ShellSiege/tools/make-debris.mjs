// Bone debris for the death burst, from the Fantasy Rivals pack.
//
// WHY THESE TWO. The pack has no character animation, so its 20 rigged
// fighters are not enemies without a retargeting job. Its PROPS have no such
// problem -- a skull and a pile of bones are static meshes that need no rig,
// no clip and no retarget, and they are exactly what a skeleton should come
// apart into. It is the cheapest honest use of the pack available today.
//
// NO TEXTURE. The props are mapped to a shared 1024px Fantasy Rivals atlas,
// and carrying a whole atlas for debris that is on screen for 900ms and never
// larger than a fist would be absurd. They are drawn in flat bone white, which
// is what they are.
//
//   node tools/make-debris.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

globalThis.self = globalThis;
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
};
globalThis.window = globalThis;
globalThis.Image = class { addEventListener() {} removeEventListener() {} };
globalThis.URL.createObjectURL ??= () => '';
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
};

const SRC = path.join(process.env.HOME,
  'UnityProjects/webgame-art/polygon-fantasy-rivals/Synty/PolygonFantasyRivals/Models');
const OUT = path.resolve('public/models/debris.glb');

// Each is normalised to its own longest axis so the game can size them in
// units without knowing anything about the pack's scale.
const WANT = { skull: 'SM_Prop_Skull_01.fbx', bones: 'SM_Prop_Bones_01.fbx' };

const loader = new FBXLoader();
const out = new THREE.Group();

for (const [name, file] of Object.entries(WANT)) {
  const buf = fs.readFileSync(path.join(SRC, file));
  const obj = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  let mesh = null;
  obj.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) { console.error(name, '-- no mesh in', file); continue; }

  const geo = mesh.geometry.clone();
  geo.deleteAttribute('uv');          // no atlas ships, so the uvs are dead weight
  geo.deleteAttribute('uv1');
  geo.deleteAttribute('color');
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const span = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  // Centre on its own middle so it tumbles about itself rather than orbiting
  // a point somewhere off in the pack's authoring space.
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  geo.scale(1 / span, 1 / span, 1 / span);
  geo.computeVertexNormals();

  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  m.name = name;
  out.add(m);
  console.log(`${name.padEnd(6)} ${geo.attributes.position.count} verts  span ${span.toFixed(1)} -> 1.00  <- ${file}`);
}

new GLTFExporter().parse(
  out,
  (gltf) => {
    fs.writeFileSync(OUT, Buffer.from(gltf));
    console.log('->', OUT, (fs.statSync(OUT).size / 1024).toFixed(1), 'KB');
  },
  (err) => { console.error('export failed:', err); process.exit(1); },
  { binary: true, onlyVisible: false },
);
