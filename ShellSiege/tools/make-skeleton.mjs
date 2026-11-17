// Turn the Dungeon Skeleton demo pack into one glb the game already knows how
// to load: mesh, skeleton and all three clips in a single file.
//
// WHY THIS IS CHEAP HERE AND WOULD NOT BE ELSEWHERE. The pack is FBX, and the
// advice that came with it was that FBX means either rendering sprite sheets
// or "converting to glTF and pulling in three.js -- real work, not an import
// step". That is true of a 2D canvas game. This game is already three.js, it
// already loads a rigged glb through GLTFLoader, and tools/extract-clips.mjs
// already parses FBX in node with FBXLoader. So the whole job is: load four
// FBXs, staple the clips onto the mesh, write one glb.
//
// IT EXPORTS THE ANIMATIONS INSIDE THE GLB rather than to a side-car JSON the
// way the player's clips work. The player's clips are sliced per bone bucket
// for the two-layer system and carry measured stride metadata, which is why
// they live apart; the skeleton just plays one clip at a time, so the simplest
// thing that works is the file format's own animation support and no new
// runtime code at all.
//
// THE MATERIAL IS DROPPED ON PURPOSE. The FBX references its atlas by an
// absolute path from someone else's machine, and GLTFExporter would need a
// canvas to embed an image in node. The atlas is copied beside the glb and
// applied at load, which is both simpler and smaller.
//
//   node tools/make-skeleton.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// FBXLoader reaches for DOM image loading for embedded textures; we only want
// geometry and motion, so give it inert stand-ins. Same shims as extract-clips.
globalThis.self = globalThis;
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
};
globalThis.window = globalThis;
globalThis.Image = class { addEventListener() {} removeEventListener() {} };
globalThis.URL.createObjectURL ??= () => '';
// GLTFExporter writes its binary chunk by handing a Blob to a FileReader.
// node has Blob as a global but not FileReader, and the failure is a bare
// ReferenceError from inside the exporter rather than anything that names the
// cause. Node's Blob already exposes arrayBuffer(), so the shim is three lines.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
};

const SRC = path.join(process.env.HOME,
  'UnityProjects/webgame-art/dungeon-skeletons/DungeonCharacters/Skeletons_demo');
const OUT = path.resolve('public/models/skeleton.glb');
const ATLAS_OUT = path.resolve('public/tex/skeleton.webp');

const CLIPS = {
  idle: 'animation/DS_onehand_idle_A.FBX',
  walk: 'animation/DS_onehand_walk.FBX',
  attack: 'animation/DS_onehand_attack_A.FBX',
};

const loader = new FBXLoader();
const read = (rel) => {
  const buf = fs.readFileSync(path.join(SRC, rel));
  return loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
};

const model = read('models/DungeonSkeleton_demo.FBX');

// --- normalise: stand one unit tall, feet on the floor, centred on x/z, so
// the game can scale it by a height the same way it scales everything else.
model.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(model);
const h = box.max.y - box.min.y;
const k = 1 / h;
const wrap = new THREE.Group();
model.scale.multiplyScalar(k);
model.position.set(
  -((box.min.x + box.max.x) / 2) * k,
  -box.min.y * k,
  -((box.min.z + box.max.z) / 2) * k,
);
wrap.add(model);
wrap.updateMatrixWorld(true);

// The FBX carries the authoring scene's ambient light and camera. Exporting
// them would put a light inside the enemy, which the game would then add to
// its own scene once per Foot Soldier.
for (const o of [...model.children]) {
  if (o.isLight || o.isCamera) { o.parent.remove(o); console.log('dropped', o.type); }
}
model.traverse((o) => {
  if (o.isLight || o.isCamera) o.parent?.remove(o);
});

let skinned = 0;
model.traverse((o) => {
  if (o.isMesh) {
    skinned += o.isSkinnedMesh ? 1 : 0;
    // A plain white standard material: the atlas is applied at load time.
    o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  }
});

const animations = [];
for (const [name, rel] of Object.entries(CLIPS)) {
  const obj = read(rel);
  const clip = obj.animations[0];
  if (!clip) { console.error(name, '-- no clip in', rel); continue; }
  clip.name = name;
  // TRIM, the same way the player's clips are trimmed. The pack exports
  // position, rotation AND scale for all 24 bones -- 72 tracks a clip -- and
  // on a skeleton the scale never changes and only the root ever translates.
  // Keeping them triples the animation payload of the glb for nothing.
  const before = clip.tracks.length;
  clip.tracks = clip.tracks.filter((t) => {
    if (t.name.endsWith('.scale')) return false;
    if (t.name.endsWith('.position')) return /Bip001\.|Bip001_Pelvis/.test(t.name);
    return true;
  });
  // Float noise costs bytes and nothing else: 3dp on a quaternion is about
  // 0.06 degrees of joint error, far under what the source resample cost.
  for (const t of clip.tracks) {
    for (let i = 0; i < t.values.length; i++) t.values[i] = +t.values[i].toFixed(3);
    for (let i = 0; i < t.times.length; i++) t.times[i] = +t.times[i].toFixed(3);
  }
  console.log(`  tracks ${before} -> ${clip.tracks.length}`);
  animations.push(clip);
  console.log(`${name.padEnd(7)} ${clip.duration.toFixed(2)}s  ${String(clip.tracks.length).padStart(3)} tracks  <- ${path.basename(rel)}`);
}

console.log(`mesh: ${skinned} skinned mesh(es), source height ${h.toFixed(1)} -> 1.00`);

new GLTFExporter().parse(
  wrap,
  (gltf) => {
    fs.writeFileSync(OUT, Buffer.from(gltf));
    console.log('->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
    fs.copyFileSync(path.join(SRC, 'models/Materials/DemoSkeleton.png'), ATLAS_OUT);
    console.log('->', ATLAS_OUT, (fs.statSync(ATLAS_OUT).size / 1024).toFixed(0), 'KB');
  },
  (err) => { console.error('export failed:', err); process.exit(1); },
  { binary: true, animations, onlyVisible: false },
);
