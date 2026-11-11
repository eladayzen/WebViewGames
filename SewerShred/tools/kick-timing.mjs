// Find the KICK frame in a clip: forward kinematics on raphael.glb's bind pose
// with the clip's bone rotations, tracking each foot's height above the hips.
// The kick is where a foot is highest. Prints a timeline so the windup/recovery
// are visible too.
//
//   node tools/kick-timing.mjs [clip=flip]
import fs from 'node:fs';
import * as THREE from 'three';

const clipName = process.argv[2] || 'flip';
const glb = fs.readFileSync('public/models/raphael.glb');
const jl = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jl).toString());
const clips = JSON.parse(fs.readFileSync('public/models/clips.json', 'utf8'));
const clip = THREE.AnimationClip.parse(clips[clipName]);

// rebuild the node tree as Object3Ds
const objs = gltf.nodes.map((n) => {
  const o = new THREE.Object3D();
  o.name = n.name || '';
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  return o;
});
gltf.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
const root = objs[gltf.scenes[0].nodes[0]];
const by = (name) => objs.find((o) => o.name === name);
const hips = by('mixamorigHips'), lf = by('mixamorigLeftFoot'), rf = by('mixamorigRightFoot');

const mixer = new THREE.AnimationMixer(root);
const action = mixer.clipAction(clip); action.play();
const step = 1 / 30;
const out = [];
const hp = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
for (let t = 0; t <= clip.duration + 1e-6; t += step) {
  mixer.setTime(t);
  root.updateMatrixWorld(true);
  hips.getWorldPosition(hp); lf.getWorldPosition(a); rf.getWorldPosition(b);
  out.push({ t, l: a.y - hp.y, r: b.y - hp.y });
}
const best = out.reduce((m, x) => (Math.max(x.l, x.r) > Math.max(m.l, m.r) ? x : m));
const rest = Math.max(out[0].l, out[0].r);
console.log(`clip ${clipName} ${clip.duration.toFixed(2)}s — highest foot at t=${best.t.toFixed(2)}s (${best.l > best.r ? 'left' : 'right'})`);
for (const x of out.filter((_, i) => i % 3 === 0)) {
  const h = Math.max(x.l, x.r) - rest;
  console.log(x.t.toFixed(2).padStart(5), '#'.repeat(Math.max(0, Math.round(h * 40))));
}
