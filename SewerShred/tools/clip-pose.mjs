// Where is the rider facing / how upright is he through a clip? Used to pick
// where the Spin Flip Kick's backflip ends (upright again) so the game can
// hand off into its own spin back to the ride stance.
//
//   node tools/clip-pose.mjs [clip=flip] [from=1.6]
import fs from 'node:fs';
import * as THREE from 'three';

const [clipName = 'flip', from = '1.6'] = process.argv.slice(2);
const glb = fs.readFileSync('public/models/raphael.glb');
const jl = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jl).toString());
const clip = THREE.AnimationClip.parse(JSON.parse(fs.readFileSync('public/models/clips.json', 'utf8'))[clipName]);
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
const hips = objs.find((o) => o.name === 'mixamorigHips');
const head = objs.find((o) => o.name === 'mixamorigHead');
const m = new THREE.AnimationMixer(root);
m.clipAction(clip).play();
const q = new THREE.Quaternion(), f = new THREE.Vector3(), u = new THREE.Vector3(), hp = new THREE.Vector3(), hd = new THREE.Vector3();
for (let t = +from; t <= clip.duration + 1e-6; t += 0.1) {
  m.setTime(t);
  root.updateMatrixWorld(true);
  hips.getWorldQuaternion(q);
  f.set(0, 0, 1).applyQuaternion(q);
  hips.getWorldPosition(hp); head.getWorldPosition(hd);
  u.subVectors(hd, hp).normalize();
  console.log(t.toFixed(1), 'facing', (Math.atan2(f.x, f.z) * 57.3).toFixed(0).padStart(5), 'deg   upright', u.y.toFixed(2));
}
