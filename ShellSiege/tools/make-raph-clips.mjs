// Retarget CC0 clips onto the Mixamo/Raphael rig and emit clips.json.
//
// WHY THIS EXISTS. TMNT Rooftop Run needs run / roll / jump on raphael.glb,
// and there is no run, roll or jump anywhere in ~/Documents/3d -- the whole
// local library is walks, crouches, idles and kicks. Mixamo itself needs an
// Adobe sign-in. Quaternius' Universal Animation Library (CC0) has all three,
// so the only thing missing is a retarget, which make-rival.mjs already does
// in the other direction.
//
// THREE THINGS THAT WOULD SILENTLY PRODUCE A BROKEN FILE:
//
// 1. THE CC0 FBX IS Z-UP. FBXLoader corrects it by rotating the node ABOVE
//    the bones, so getWorldQuaternion carries the correction and
//    skeleton.boneInverses does not. Differencing the two puts every bone 90
//    degrees off about X. The source bind is therefore read by POSING the rig
//    at its own A_TPose clip and taking matrixWorld -- bind and motion then
//    live in the same space, whatever that space is.
//
// 2. THE REST POSES DISAGREE. Both rigs are nominally T-posed but not
//    identically, so each bone's bind ORIENTATION is rotated until its axis
//    (the direction to its own child) points the way the source's equivalent
//    bone points. Same correction as make-rival.mjs, same reason.
//
// 3. THE HIPS TRACK HAS A CONVENTION, and it is not "world position".
//    extract-clips.mjs writes (0, y - y0, 0): X and Z forced to zero because
//    the game drives travel itself, Y as a delta from the clip's OWN first
//    frame, in the SOURCE FBX's units. A CC0 unit is not a Mixamo unit, so
//    the delta is scaled by the ratio of the two rigs' femurs -- the one
//    length both files already agree to measure.
//
//   node tools/make-raph-clips.mjs [outPath]
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
  createElement: () => ({ getContext: () => null, style: {} }),
};
globalThis.Image = class { addEventListener() {} removeEventListener() {} set src(_v) {} };
globalThis.URL.createObjectURL ??= () => '';
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

const CC0 = path.join(process.env.HOME,
  'Documents/3d/cc0-animation-library/AnimationLibrary_Standard.fbx');
const TARGET_GLB = path.resolve('public/models/raphael.glb');
const BASE_CLIPS = path.resolve('public/models/clips.json');
const OUT = path.resolve(process.argv[2] || path.join(process.env.HOME,
  'Documents/3d/cc0-animation-library/rooftop-run/clips.json'));

// The clips asked for, and the names they must carry on the other side.
const WANT = {
  run: 'Sprint_Loop',
  jog: 'Jog_Fwd_Loop',
  roll: 'Roll',            // the in-place one. Roll_RM drifts 5.1 units.
  jump_start: 'Jump_Start',
  jump_loop: 'Jump_Loop',
  jump_land: 'Jump_Land',
};

// Mixamo bone <- CC0 (Rigify) bone. The two rigs' spine counts, shoulder
// chains and foot/toe splits line up one for one, which is the only reason
// this is twenty-two lines.
const BONES = {
  mixamorigHips: 'DEF-hips',
  mixamorigSpine: 'DEF-spine001', mixamorigSpine1: 'DEF-spine002', mixamorigSpine2: 'DEF-spine003',
  mixamorigNeck: 'DEF-neck', mixamorigHead: 'DEF-head',
  mixamorigLeftShoulder: 'DEF-shoulderL', mixamorigLeftArm: 'DEF-upper_armL',
  mixamorigLeftForeArm: 'DEF-forearmL', mixamorigLeftHand: 'DEF-handL',
  mixamorigRightShoulder: 'DEF-shoulderR', mixamorigRightArm: 'DEF-upper_armR',
  mixamorigRightForeArm: 'DEF-forearmR', mixamorigRightHand: 'DEF-handR',
  mixamorigLeftUpLeg: 'DEF-thighL', mixamorigLeftLeg: 'DEF-shinL',
  mixamorigLeftFoot: 'DEF-footL', mixamorigLeftToeBase: 'DEF-toeL',
  mixamorigRightUpLeg: 'DEF-thighR', mixamorigRightLeg: 'DEF-shinR',
  mixamorigRightFoot: 'DEF-footR', mixamorigRightToeBase: 'DEF-toeR',
};

// A bone's own child, which is how its DIRECTION is known: a quaternion alone
// cannot say where a bone points, the vector to its child can.
const CHILD = {
  mixamorigHips: 'mixamorigSpine',
  mixamorigSpine: 'mixamorigSpine1', mixamorigSpine1: 'mixamorigSpine2',
  mixamorigSpine2: 'mixamorigNeck', mixamorigNeck: 'mixamorigHead',
  mixamorigLeftShoulder: 'mixamorigLeftArm', mixamorigLeftArm: 'mixamorigLeftForeArm',
  mixamorigLeftForeArm: 'mixamorigLeftHand',
  mixamorigRightShoulder: 'mixamorigRightArm', mixamorigRightArm: 'mixamorigRightForeArm',
  mixamorigRightForeArm: 'mixamorigRightHand',
  mixamorigLeftUpLeg: 'mixamorigLeftLeg', mixamorigLeftLeg: 'mixamorigLeftFoot',
  mixamorigLeftFoot: 'mixamorigLeftToeBase',
  mixamorigRightUpLeg: 'mixamorigRightLeg', mixamorigRightLeg: 'mixamorigRightFoot',
  mixamorigRightFoot: 'mixamorigRightToeBase',
};

const _dp = new THREE.Vector3(), _ds = new THREE.Vector3();
const qOf = (m) => { const q = new THREE.Quaternion(); m.decompose(_dp, q, _ds); return q; };
const pOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);
const REF_Y = new THREE.Vector3(0, 1, 0), REF_Z = new THREE.Vector3(0, 0, 1);
function axisFrame(dir) {
  const x = dir.clone().normalize();
  const ref = Math.abs(x.dot(REF_Y)) < 0.9 ? REF_Y : REF_Z;
  const y = ref.clone().addScaledVector(x, -ref.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

// --- source: the CC0 rig, bind read by posing at its own T-pose. See (1).
const sbuf = fs.readFileSync(CC0);
const srcObj = new FBXLoader().parse(
  sbuf.buffer.slice(sbuf.byteOffset, sbuf.byteOffset + sbuf.byteLength), '');
let srcSkin = null;
srcObj.traverse((o) => { if (o.isSkinnedMesh && !srcSkin) srcSkin = o; });
const srcByName = new Map(srcSkin.skeleton.bones.map((b) => [b.name, b]));
const tpose = srcObj.animations.find((c) => c.name.endsWith('A_TPose'));
if (!tpose) { console.error('no A_TPose in the CC0 library'); process.exit(1); }
{
  const m = new THREE.AnimationMixer(srcObj);
  m.clipAction(tpose).play(); m.setTime(0);
  srcObj.updateMatrixWorld(true);
  m.stopAllAction(); m.uncacheRoot(srcObj);
}
const srcBind = new Map(srcSkin.skeleton.bones.map((b) => [b.name, b.matrixWorld.clone()]));

// --- target: raphael.glb, bind from boneInverses (it is a plain glb, one
// character, no duplicate names, so nothing exotic is needed here).
const tbuf = fs.readFileSync(TARGET_GLB);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(
  tbuf.buffer.slice(tbuf.byteOffset, tbuf.byteOffset + tbuf.byteLength), '', res, rej));
let tgtSkin = null;
gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !tgtSkin) tgtSkin = o; });
gltf.scene.updateMatrixWorld(true);
const tgtByName = new Map(tgtSkin.skeleton.bones.map((b) => [b.name, b]));
// 4. THE TARGET BIND MUST BE IN THE SAME SPACE THE TRANSFER WORKS IN.
//    boneInverses are world matrices that INCLUDE the node above the
//    skeleton, and raphael.glb carries a 0.0086 scale and a rotation there.
//    The per-frame loop below composes world matrices from the BONES alone,
//    starting at mixamorigHips -- which has no bone parent. Taking the bind
//    from boneInverses and the motion from a bone-only chain mixes the two
//    spaces, and the character comes out with the shell over its head.
//    Verified by rendering it. So the bind is composed exactly the way the
//    motion is: local matrices, bone parents only.
const tgtBind = new Map();
{
  const d0 = (b) => { let d = 0, p = b.parent; while (p) { d++; p = p.parent; } return d; };
  for (const b of tgtSkin.skeleton.bones.slice().sort((a, b) => d0(a) - d0(b))) {
    b.updateMatrix();
    if (b.parent && b.parent.isBone) b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix);
    else b.matrixWorld.copy(b.matrix);
    tgtBind.set(b.name, b.matrixWorld.clone());
  }
}

const pair = Object.entries(BONES).filter(([tn, sn]) => tgtByName.has(tn) && srcBind.has(sn));
console.log(`paired ${pair.length}/${Object.keys(BONES).length} bones`);
for (const [tn, sn] of Object.entries(BONES)) {
  if (!tgtByName.has(tn)) console.log('  target missing', tn);
  else if (!srcBind.has(sn)) console.log('  source missing', sn);
}

// THE FEMUR IS THE SHARED RULER. extract-clips.mjs measures it as the local
// length of mixamorigLeftLeg; the CC0 equivalent is DEF-shinL. Their ratio is
// what puts a CC0 hip bob into the units the existing six clips are written
// in. See (3).
const srcFemur = srcByName.get('DEF-shinL').position.length();
const tgtFemur = tgtByName.get('mixamorigLeftLeg').position.length();
const hipScale = tgtFemur / srcFemur;
console.log(`femur: cc0 ${srcFemur.toFixed(3)}  mixamo ${tgtFemur.toFixed(3)}  -> hip scale ${hipScale.toFixed(4)}`);

// --- rest-pose alignment, per bone. See (2).
const restBind = new Map();
for (const [tn, sn] of pair) {
  const base = qOf(tgtBind.get(tn));
  const tc = CHILD[tn], sc = tc ? BONES[tc] : null;
  if (!tc || !tgtBind.has(tc) || !sc || !srcBind.has(sc)) { restBind.set(tn, base); continue; }
  const tDir = pOf(tgtBind.get(tc)).sub(pOf(tgtBind.get(tn)));
  const sDir = pOf(srcBind.get(sc)).sub(pOf(srcBind.get(sn)));
  if (tDir.lengthSq() < 1e-9 || sDir.lengthSq() < 1e-9) { restBind.set(tn, base); continue; }
  const align = new THREE.Quaternion().setFromRotationMatrix(
    axisFrame(sDir).multiply(axisFrame(tDir).invert()));
  restBind.set(tn, align.multiply(base));
}

const depth = (b) => { let d = 0, p = b.parent; while (p) { d++; p = p.parent; } return d; };
const order = tgtSkin.skeleton.bones.slice().sort((a, b) => depth(a) - depth(b));
const srcHips = srcByName.get('DEF-hips');

const out = {};
for (const [outName, srcName] of Object.entries(WANT)) {
  const clip = srcObj.animations.find((c) => c.name === srcName || c.name.endsWith('|' + srcName));
  if (!clip) { console.error(outName, '-- no source clip', srcName); continue; }

  const mixer = new THREE.AnimationMixer(srcObj);
  mixer.clipAction(clip).play();
  const n = Math.max(2, Math.round(clip.duration * 30));
  const times = [];
  const keys = new Map(pair.map(([tn]) => [tn, []]));
  const hipY = [];
  let y0 = null;

  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * clip.duration * 0.999;
    times.push(+t.toFixed(4));
    mixer.setTime(t);
    srcObj.updateMatrixWorld(true);

    for (const b of order) {
      const sn = BONES[b.name];
      if (sn && srcByName.has(sn) && restBind.has(b.name)) {
        const Rs = new THREE.Quaternion();
        srcByName.get(sn).getWorldQuaternion(Rs);
        const want = Rs.multiply(qOf(srcBind.get(sn)).invert()).multiply(restBind.get(b.name));
        const pw = new THREE.Quaternion();
        // BONE PARENTS ONLY -- see (4). mixamorigHips' parent is the scene
        // node, not a bone, and folding that node in here would reintroduce
        // the very transform the bind above deliberately leaves out.
        if (b.parent && b.parent.isBone) b.parent.matrixWorld.decompose(_dp, pw, _ds);
        b.quaternion.copy(pw.invert().multiply(want));
      }
      b.updateMatrix();
      if (b.parent && b.parent.isBone) b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix);
      else b.matrixWorld.copy(b.matrix);
    }
    for (const [tn] of pair) {
      const q = tgtByName.get(tn).quaternion;
      keys.get(tn).push(q.x, q.y, q.z, q.w);
    }
    const v = new THREE.Vector3();
    srcHips.getWorldPosition(v);
    if (i === 0) y0 = v.y;
    hipY.push(0, +((v.y - y0) * hipScale).toFixed(3), 0);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(srcObj);

  const tracks = [{
    name: 'mixamorigHips.position', times, values: hipY, type: 'vector',
  }];
  for (const [tn] of pair) {
    tracks.push({
      name: `${tn}.quaternion`, times,
      values: keys.get(tn).map((v) => +v.toFixed(4)), type: 'quaternion',
    });
  }
  out[outName] = {
    name: outName, duration: +clip.duration.toFixed(4), tracks,
    uuid: THREE.MathUtils.generateUUID(), blendMode: 2500,
    // A JSON STRING, not an object. AnimationClip.parse does
    // JSON.parse(json.userData), so an object here throws
    // `"[object Object]" is not valid JSON` at load -- which is exactly what
    // AnimationClip.toJSON writes, and what the existing six clips carry.
    userData: '{}',
  };
  const bob = Math.max(...hipY.filter((_, i) => i % 3 === 1)) - Math.min(...hipY.filter((_, i) => i % 3 === 1));
  console.log(`  ${outName.padEnd(11)} <- ${srcName.padEnd(14)} ${clip.duration.toFixed(2)}s  ${n} frames  ${tracks.length} tracks  hip bob ${bob.toFixed(2)}`);
}

const base = JSON.parse(fs.readFileSync(BASE_CLIPS, 'utf8'));
const merged = { ...base, ...out };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(merged));
console.log(`\n-> ${OUT}`);
console.log(`   ${Object.keys(merged).length} clips: ${Object.keys(merged).join(', ')}`);
console.log(`   ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
