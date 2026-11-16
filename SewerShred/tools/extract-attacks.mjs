// Pull ONLY the animation out of the 10 Mixamo fight FBXs in
// ~/Documents/3d/fightAnimations (the meshes/characters in them are ignored)
// and write them as public/models/attacks.json, numbered a1..a10 in the
// order below. Same rig convention as tools/extract-clips.mjs: bone
// quaternions at 30 fps + the Hips Y bob only (no root travel).
//
//   node tools/extract-attacks.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

globalThis.self = globalThis;
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
globalThis.window = globalThis;
globalThis.Image = class { addEventListener() {} removeEventListener() {} };
globalThis.URL.createObjectURL ??= () => '';

// Tags (Elad 2026-11-16): THROW = reads as a throwing motion — better used
// as a throw animation in other games: #4 Stable Sword Inward Slash,
// #7 Standing Melee Attack Downward, #8 Standing Melee Attack Horizontal
// (#8 is still used as a Sewer Shred attack).
const SRC = path.join(process.env.HOME, 'Documents/3d/fightAnimations');
const OUT = path.resolve('public/models/attacks.json');
export const FILES = [
  'Kicking', 'Hurricane Kick', 'Armada', 'Stable Sword Inward Slash', 'Flying Kick',
  'Martelo 2', 'Standing Melee Attack Downward', 'Standing Melee Attack Horizontal',
  'Macaco Side', 'Mutant Punch',
];
const want = new Set(JSON.parse(fs.readFileSync('public/models/clips.json')).ride.tracks.map((t) => t.name));

const loader = new FBXLoader();
const out = [];
for (const [i, file] of FILES.entries()) {
  const buf = fs.readFileSync(path.join(SRC, file + '.fbx'));
  const obj = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const clip = obj.animations[0];
  // hips scale: the source character's hips height vs Raphael's is close
  // enough on Mixamo rigs; position is kept relative to frame 0 anyway.
  const tracks = [];
  let miss = 0;
  for (const t of clip.tracks) {
    const name = t.name.replace(/^mixamorig\d*:?/, 'mixamorig');
    if (name.endsWith('.quaternion')) {
      if (!want.has(name)) { miss++; continue; }
      const r = resample(t, clip.duration, 30, 4); r.name = name; tracks.push(r);
    } else if (name === 'mixamorigHips.position') {
      const r = resample(t, clip.duration, 30, 3);
      const y0 = r.values[1];
      for (let k = 0; k < r.values.length; k += 3) { r.values[k] = 0; r.values[k + 2] = 0; r.values[k + 1] -= y0; }
      r.name = name; tracks.push(r);
    }
  }
  const json = THREE.AnimationClip.toJSON(new THREE.AnimationClip(`a${i + 1}`, clip.duration, tracks));
  for (const tr of json.tracks) { tr.times = tr.times.map((v) => +v.toFixed(3)); tr.values = tr.values.map((v) => +v.toFixed(4)); }
  json.label = file;
  out.push(json);
  console.log(String(i + 1).padStart(2), file.padEnd(34), clip.duration.toFixed(2) + 's', tracks.length, 'tracks', miss ? `(${miss} unknown bones skipped)` : '');
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');

function resample(track, dur, fps, stride) {
  const n = Math.max(2, Math.round(dur * fps) + 1);
  const times = new Float32Array(n), values = new Float32Array(n * stride);
  const interp = track.createInterpolant();
  for (let i = 0; i < n; i++) {
    const t = Math.min(dur, i / fps); times[i] = t;
    const v = interp.evaluate(t);
    for (let k = 0; k < stride; k++) values[i * stride + k] = v[k];
  }
  return new (stride === 4 ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack)(track.name, times, values);
}
