// Pull Mixamo animation clips out of the rigged FBXs and write them as
// three.js AnimationClip JSON that the game loads at runtime.
//
// The game's mesh is `public/models/raphael.glb` -- a Mixamo rig, bones named
// `mixamorigHips` and so on -- and these FBXs carry the same rig, so clips
// bind BY BONE NAME with no retargeting. The FBXs are not in the repo (they
// live in ~/Documents/3d); the JSON output is, so the game rebuilds without
// them.
//
//   node tools/extract-clips.mjs --list     # what is in the source files
//   node tools/extract-clips.mjs            # write public/models/clips.json
//
// What is kept per track:
//   - every bone QUATERNION track, resampled to 30 fps
//   - the Hips POSITION track, Y only, relative to frame 0. Root motion
//     forward and sideways would fight the sim, which owns where the player
//     is; the up-and-down bob is what makes a walk read as a walk.
//
// WHY THE SEAM CHECK. These are loops. If a clip's last pose does not match
// its first, the cycle visibly hitches once per stride, and at a crouch walk's
// tempo that is about twice a second -- obvious, and very easy to stare at
// without seeing. --list prints the first-to-last delta per clip so a bad loop
// is caught here rather than on a board.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// FBXLoader reaches for DOM image loading for embedded textures. We only want
// the animation, so give it inert stand-ins.
globalThis.self = globalThis;
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
};
globalThis.window = globalThis;
globalThis.Image = class { addEventListener() {} removeEventListener() {} };
globalThis.URL.createObjectURL ??= () => '';

const HOME = process.env.HOME;
const MOVE = path.join(HOME, 'Documents/3d/fightAnimations/move animatrions');
const FIGHT = path.join(HOME, 'Documents/3d/fightAnimations');

// name in the game -> source file
//
// MORE THAN ONE OF EACH, on purpose. Which idle and which gait suit a
// crouching turtle in an isometric arena is a judgement nobody can make from a
// file name, so both idles and every walk in the folder are extracted and the
// game switches between them from the URL -- see render/rig.js SETS. The cost
// is about 90 KB per clip in clips.json, which is worth paying while the
// answer is still open and trivial to trim once it is not.
// WHAT SHIPS AND WHAT IS ONLY FOR AUDITIONS.
//
// Every clip in here costs about 60-250 KB of `clips.json`, which the WebView
// parses on every launch, and the full set is 1236 KB for a build that uses
// six of them. `--all` emits everything, which is what you want while Elad is
// choosing a gait; the default emits only the clips the shipped defaults can
// actually reach. The audition switches (?walk=sneak and friends) therefore
// need a `--all` build, and render/clipsets.js falls back rather than breaking
// if one is asked for and is not there.
const AUDITION_ONLY = new Set([
  'idle', 'walk_sneak', 'walk_mutant', 'walk_crouched', 'walk_backwards',
  'throw_down', 'throw_horiz',
]);
const ALL = process.argv.includes('--all');

const WANT = {
  idle: [MOVE, 'Ninja Idle.fbx'],
  idle2: [MOVE, 'Ninja Idle (1).fbx'],
  // THE FOUR-WAY SET. These exist so the character can FACE ONE WAY AND MOVE
  // ANOTHER -- see render/locomotion.js. A character who always walks the way
  // he is facing needs exactly one walk clip; four of them is the asset set
  // telling you he is meant to strafe.
  walk_f: [MOVE, 'Crouch Walk Forward.fbx'],
  walk_b: [MOVE, 'Crouch Walk Back.fbx'],
  walk_l: [MOVE, 'Crouch Walk Left.fbx'],
  walk_r: [MOVE, 'Crouch Walk Right.fbx'],

  // Alternative gaits. Only the crouch set above is a native four-way set;
  // these are single forward clips, so a set built on one of them borrows the
  // crouch set's sideways clips. Said plainly here rather than discovered
  // later from a strafe that does not match the walk.
  walk_sneak: [MOVE, 'Sneak Walk.fbx'],
  walk_mutant: [MOVE, 'Mutant Walking.fbx'],
  walk_crouched: [MOVE, 'Crouched Walking.fbx'],
  walk_backwards: [MOVE, 'Walking Backwards.fbx'],

  // THE THROWS, taken from the Sewer Shred attack audition's own tagging
  // (~/Documents/3d/fightAnimations/TAGS.md, 2026-11-16): three clips it
  // dropped as melee and marked **THROW** because that is what they read as.
  // They play on the UPPER BODY ONLY, over whatever the legs are doing -- see
  // render/mask.js.
  throw_slash: [FIGHT, 'Stable Sword Inward Slash.fbx'],
  throw_down: [FIGHT, 'Standing Melee Attack Downward.fbx'],
  throw_horiz: [FIGHT, 'Standing Melee Attack Horizontal.fbx'],
};

const OUT = path.resolve('public/models/clips.json');
const LIST = process.argv.includes('--list');
const loader = new FBXLoader();

function load(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return loader.parse(ab, '');
}

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

/**
 * HOW FAR THE CLIP ACTUALLY TRAVELS PER CYCLE, and the yardstick to measure it
 * against.
 *
 * This is what stops the feet sliding. The game drives position itself, so the
 * clip's root motion is stripped -- but the DISTANCE it would have covered is
 * exactly how far one stride carries the character, and dividing the player's
 * real speed by it gives the cadence that makes the feet land where the ground
 * is going. Guessing a playback rate instead is how a walk ends up looking
 * like it is on ice.
 *
 * FBX units are arbitrary and differ from the glb's, so `travel` is useless on
 * its own. `femur` is the ruler: a bone's rest offset is a fixed length in the
 * skeleton and does not change with the pose, so the same bone measured in the
 * glb converts one to the other exactly. Hips height would not work -- these
 * are CROUCH walks, so the hips sit lower than the glb's bind pose and the
 * ratio would be wrong by the amount of the crouch.
 */
function rootTravel(clip) {
  const t = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
  if (!t) return 0;
  const n = t.values.length / 3;
  let d = 0;
  for (let i = 1; i < n; i++) {
    const dx = t.values[i * 3] - t.values[(i - 1) * 3];
    const dz = t.values[i * 3 + 2] - t.values[(i - 1) * 3 + 2];
    d += Math.hypot(dx, dz);
  }
  return d;
}

function femurLength(obj) {
  let v = 0;
  obj.traverse((o) => {
    if (o.isBone && o.name === 'mixamorigLeftLeg') v = o.position.length();
  });
  return v;
}

/**
 * WHEN THE HAND LETS GO, in seconds.
 *
 * A throw animation is mostly wind-up and follow-through; the only frame that
 * has to line up with anything is the one where the star leaves. Finding it by
 * eye means scrubbing a timeline and writing down a number that nobody can
 * check later, so it is measured: run the clip through a real mixer, track the
 * right hand in world space, and take the frame where it is moving fastest.
 * That is the release, and it is the same answer every time the clip is
 * re-extracted.
 */
function releaseTime(obj, clip) {
  let hand = null;
  obj.traverse((o) => { if (o.isBone && o.name === 'mixamorigRightHand') hand = o; });
  if (!hand) return 0;
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(clip);
  action.play();
  const STEPS = Math.max(8, Math.round(clip.duration * 60));
  const dt = clip.duration / STEPS;
  const v = new THREE.Vector3();
  let prev = null, best = 0, bestT = 0;
  for (let i = 0; i <= STEPS; i++) {
    const t = i * dt;
    mixer.setTime(t);
    obj.updateMatrixWorld(true);
    const p = hand.getWorldPosition(new THREE.Vector3());
    if (prev) {
      const sp = v.subVectors(p, prev).length() / dt;
      if (sp > best) { best = sp; bestT = t; }
    }
    prev = p;
  }
  action.stop();
  return bestT;
}

/** How far the pose drifts between the first and last frame, in radians. */
function seam(clip) {
  let worst = 0;
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.quaternion')) continue;
    const n = t.values.length / 4;
    const a = new THREE.Quaternion().fromArray(t.values, 0);
    const b = new THREE.Quaternion().fromArray(t.values, (n - 1) * 4);
    worst = Math.max(worst, a.angleTo(b));
  }
  return worst;
}

if (LIST) {
  const dir = MOVE;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.fbx')).sort()) {
    let obj;
    try { obj = load(path.join(dir, f)); }
    catch (e) { console.log(f.padEnd(30), 'PARSE FAILED:', e.message); continue; }
    const bits = obj.animations.map((c) => `${c.duration.toFixed(2)}s/${c.tracks.length}tr/seam ${(seam(c) * 180 / Math.PI).toFixed(1)}deg`);
    console.log(f.padEnd(30), obj.animations.length, 'clip(s):', bits.join('  '));
  }
  process.exit(0);
}

const out = {};
for (const [name, [dir, file]] of Object.entries(WANT)) {
  if (!ALL && AUDITION_ONLY.has(name)) continue;
  const src = path.join(dir, file);
  if (!fs.existsSync(src)) { console.error(name, 'MISSING:', src); continue; }
  let obj;
  try { obj = load(src); } catch (e) { console.error(name, 'parse failed:', e.message); continue; }
  const clip = obj.animations[0];
  if (!clip) { console.error(name, 'no clip'); continue; }

  const tracks = [];
  for (const t of clip.tracks) {
    if (t.name.endsWith('.quaternion')) {
      tracks.push(resample(t, clip.duration, 30, 4));
    } else if (t.name === 'mixamorigHips.position') {
      const r = resample(t, clip.duration, 30, 3);
      const y0 = r.values[1];
      for (let i = 0; i < r.values.length; i += 3) {
        r.values[i] = 0; r.values[i + 2] = 0; r.values[i + 1] -= y0;
      }
      r.name = 'mixamorigHips.position';
      tracks.push(r);
    }
  }

  const travel = rootTravel(clip);
  const femur = femurLength(obj);

  const c = new THREE.AnimationClip(name, clip.duration, tracks);
  const json = THREE.AnimationClip.toJSON(c);
  // Carried alongside the clip, in FEMURS -- a unit both files agree on.
  //
  // A SIBLING KEY, NOT userData. three's AnimationClip.parse does
  // `JSON.parse(json.userData || '{}')`, so userData there is a stringly-typed
  // field: handing it a real object makes it parse the text "[object Object]"
  // and throw, which is exactly how this shipped the first time. An unknown
  // top-level key is ignored by parse and survives the round trip intact.
  json.strideFemurs = femur ? +(travel / femur).toFixed(4) : 0;
  if (name.startsWith('throw_')) json.releaseAt = +releaseTime(obj, clip).toFixed(3);
  // Trim float noise; this is the difference between a 300 KB file and a 900 KB one.
  for (const tr of json.tracks) {
    tr.times = tr.times.map((v) => +v.toFixed(3));
    // 3dp, not 4. These are quaternion components, so the worst case is about
    // 0.06 degrees of joint error -- well under what a 30fps resample already
    // costs -- and it takes roughly a sixth off the file the WebView parses on
    // every launch. Stride and release metadata keep their precision; they are
    // two numbers, and one of them sets the walk cadence.
    tr.values = tr.values.map((v) => +v.toFixed(3));
  }
  out[name] = json;
  console.log(name.padEnd(8), clip.duration.toFixed(2) + 's', String(tracks.length).padStart(3), 'tracks',
    ' seam', (seam(c) * 180 / Math.PI).toFixed(1) + 'deg',
    ' stride', json.strideFemurs.toFixed(2) + ' femurs',
    json.releaseAt !== undefined ? ' release ' + json.releaseAt.toFixed(2) + 's' : '', ' <-', file);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
