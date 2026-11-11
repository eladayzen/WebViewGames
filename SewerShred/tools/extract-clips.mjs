// Pull the Mixamo animation clips out of the rigged Raphael FBXs and write them
// as three.js AnimationClip JSON the game loads at runtime.
//
// The game's mesh is DimensionDrift's raphael.glb (Mixamo rig, bones named
// `mixamorigHips` etc.) — the same rig these FBXs were exported with, so the
// clips bind by bone name with no retargeting. The FBXs are NOT in the repo
// (~/Documents/3d/Ref/rigged); the JSON output is, so the game rebuilds without
// them.
//
//   node tools/extract-clips.mjs
//
// What is kept per track:
//   - every bone QUATERNION track, resampled to 30 fps
//   - the Hips POSITION track only for its vertical (Y) motion, rescaled to the
//     glb's units: root motion forward/sideways would fight the game's own
//     steering, but the up/down bob is what makes a push or a hop read.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// FBXLoader reaches for DOM image loading for the embedded textures. We only
// want the animation, so give it inert stand-ins.
globalThis.self = globalThis;
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
};
globalThis.window = globalThis;
globalThis.Image = class { addEventListener() {} removeEventListener() {} };
globalThis.URL.createObjectURL ??= () => '';
// GLB-local hips units (Mixamo cm) — the glb carries its scale on the scene
// root, so position tracks stay in authored units and need no conversion.

const SRC = path.join(process.env.HOME, 'Documents/3d/Ref/rigged');
const OUT = path.resolve('public/models/clips.json');
const WANT = {
  ride: 'model@SkateboardingInPlace1.fbx',
  push: 'model@Skateboarding.fbx',
  flip: 'model@Spin Flip Kick.fbx',
  kick: 'model@Kicking.fbx',
  dance: 'model@Breakdance 1990.fbx',
  spin: 'model@Northern Soul Spin Combo.fbx',
};

const loader = new FBXLoader();
const out = {};
for (const [name, file] of Object.entries(WANT)) {
  const buf = fs.readFileSync(path.join(SRC, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  let obj;
  try { obj = loader.parse(ab, ''); } catch (e) { console.error(name, 'parse failed:', e.message); continue; }
  const clip = obj.animations[0];
  if (!clip) { console.error(name, 'no clip'); continue; }
  const tracks = [];
  for (const t of clip.tracks) {
    if (t.name.endsWith('.quaternion')) {
      tracks.push(resample(t, clip.duration, 30, 4));
    } else if (t.name === 'mixamorigHips.position') {
      // keep Y only, relative to frame 0
      const r = resample(t, clip.duration, 30, 3);
      const y0 = r.values[1];
      for (let i = 0; i < r.values.length; i += 3) {
        r.values[i] = 0; r.values[i + 2] = 0; r.values[i + 1] -= y0;
      }
      r.name = 'mixamorigHips.position';
      tracks.push(r);
    }
  }
  const c = new THREE.AnimationClip(name, clip.duration, tracks);
  const json = THREE.AnimationClip.toJSON(c);
  // trim float noise to keep the file small
  for (const tr of json.tracks) {
    tr.times = tr.times.map((v) => +v.toFixed(3));
    tr.values = tr.values.map((v) => +v.toFixed(4));
  }
  out[name] = json;
  console.log(name.padEnd(6), clip.duration.toFixed(2) + 's', tracks.length, 'tracks');
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');

function resample(track, dur, fps, stride) {
  const n = Math.max(2, Math.round(dur * fps) + 1);
  const times = new Float32Array(n);
  const values = new Float32Array(n * stride);
  const interp = track.createInterpolant();
  for (let i = 0; i < n; i++) {
    const t = Math.min(dur, i / fps);
    times[i] = t;
    const v = interp.evaluate(t);
    for (let k = 0; k < stride; k++) values[i * stride + k] = v[k];
  }
  const Ctor = stride === 4 ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
  return new Ctor(track.name, times, values);
}
