// Find the RELEASE frame of a throw-style clip in attacks.json: forward
// kinematics on raphael.glb, tracking each hand relative to the hips. Release
// = the hand's fastest frame (measured, not guessed — the Bloop Squad lesson:
// a hardcoded release fraction is always slightly out of sync).
//
//   node tools/throw-timing.mjs [clipNumber=8]
import fs from 'node:fs';
import * as THREE from 'three';

const n = +(process.argv[2] || 8);
const glb = fs.readFileSync('public/models/raphael.glb');
const jl = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jl).toString());
const clip = THREE.AnimationClip.parse(JSON.parse(fs.readFileSync('public/models/attacks.json', 'utf8'))[n - 1]);
const objs = gltf.nodes.map((nd) => {
  const o = new THREE.Object3D(); o.name = nd.name || '';
  if (nd.translation) o.position.fromArray(nd.translation);
  if (nd.rotation) o.quaternion.fromArray(nd.rotation);
  if (nd.scale) o.scale.fromArray(nd.scale);
  return o;
});
gltf.nodes.forEach((nd, i) => (nd.children || []).forEach((c) => objs[i].add(objs[c])));
const root = objs[gltf.scenes[0].nodes[0]];
const by = (name) => objs.find((o) => o.name === name);
const hips = by('mixamorigHips'), hands = { L: by('mixamorigLeftHand'), R: by('mixamorigRightHand') };
const mixer = new THREE.AnimationMixer(root);
mixer.clipAction(clip).play();
const step = 1 / 60, hp = new THREE.Vector3(), p = new THREE.Vector3();
let prev = null, best = { v: 0 };
const rows = [];
for (let t = 0; t < clip.duration - step / 2; t += step) {
  mixer.setTime(t); root.updateMatrixWorld(true); hips.getWorldPosition(hp);
  const cur = {};
  for (const k of ['L', 'R']) { hands[k].getWorldPosition(p); cur[k] = p.clone().sub(hp); }
  if (prev) for (const k of ['L', 'R']) {
    const v = cur[k].distanceTo(prev[k]) / step;
    if (v > best.v) best = { v, t, k, fwd: cur[k].z };
  }
  rows.push({ t, R: cur.R, L: cur.L });
  prev = cur;
}
console.log(`clip ${n} ${clip.name} ${clip.duration.toFixed(2)}s — fastest hand ${best.k} at t=${best.t.toFixed(3)}s (${best.v.toFixed(1)} u/s)`);
for (const r of rows.filter((_, i) => i % 6 === 0)) console.log(r.t.toFixed(2).padStart(5), 'R', r.R.toArray().map((x) => (x * 100).toFixed(0).padStart(5)).join(''), ' L', r.L.toArray().map((x) => x.toFixed(0).padStart(5)).join(''));
