// Put a Fantasy Rivals character on its feet WITH MOTION, by retargeting.
//
// THE QUESTION THIS ANSWERS. The pack has twenty-one rigged characters and
// not one animation clip -- the only two .anim files in 173 MB are decorative
// runes. So the characters are not enemies as they stand. There is a fast way
// to fix that, for one reason:
//
//   THEY ALL SHARE ONE SKELETON. 49 bones (47 on three of them), identical
//   naming, in both Characters.fbx and Characters_BR.fbx. So this is not
//   twenty-one rigging jobs. It is ONE bone map, written once, and then every
//   character in the pack can play every clip we own.
//
//   node tools/make-rival.mjs [CharacterName] [out.glb]
//
// ----------------------------------------------------------------------
// THE TWO THINGS THAT MADE THE FIRST VERSION OF THIS PRODUCE A MONSTER.
//
// 1. THE CHARACTERS ARE NESTED INSIDE EACH OTHER, NOT SIDE BY SIDE.
//
//    All ten characters in one FBX use the SAME bone names, and FBXLoader
//    resolves that by NESTING them: the loaded graph really contains
//
//      Head <- Head <- Head <- Head <- Head <- Neck <- Spine_03 <- ...
//
//    -- a chain of five bones all called `Head`, each belonging to a
//    different character. A walk of the scene graph from the root reaches
//    537 bones carrying eleven copies of every name, so anything that poses
//    "the bone called Hand_R" drives whichever character it met first, and a
//    character's own bones have OTHER CHARACTERS' bones as ancestors.
//
//    Deleting siblings cannot fix this: every character climbs to the same
//    shared `Root`, so a "is this subtree mine?" test answers yes for all of
//    them and nothing is ever dropped. That is what happened -- the export
//    carried all ten characters, which is also why their bones came out
//    named `Hips_4` and why one enemy weighed a megabyte.
//
//    THE FIX IS TO REBUILD THE SKELETON, not to prune the old one. See
//    isolate() below.
//
// 2. three's SkeletonUtils.retargetClip LOSES THE LEGS on this pair of rigs.
//
//    Measured: the torso and arms came across acceptably and the feet ended
//    up ABOVE the hips (ankles at y=126 with hips at y=87) -- a character
//    walking with its feet near its chest. Rather than fight it, the
//    rotation transfer is done here, in about fifteen lines, as the
//    world-space delta it should be:
//
//      delta    = Rsrc(t) * inverse(Rsrc_bind)   -- what the source bone DID
//      Rtgt(t)  = delta * Rtgt_bind              -- do the same TO the target
//      local(t) = inverse(Rtgt_parent_world(t)) * Rtgt(t)
//
//    This is correct whatever the two rigs' bind poses are, which is the
//    whole point: Mixamo's is a T-pose and Synty's is an A-pose.
//
// BIND POSES COME FROM `skeleton.boneInverses`, never from the node
// transforms. boneInverses[i] is the inverse of that bone's world matrix AT
// BIND TIME, so it is immune to whatever pose the file was saved in. A
// Mixamo ANIMATION-only FBX has no skin and therefore no bind pose at all,
// which is why SRC_RIG below must be a `model@...` export: a stand-in
// skeleton built from an animation file is "bound" mid-stride, and every
// character retargeted through it comes out hunched on all fours.
//
// And read those bind rotations with decompose(), NOT setFromRotationMatrix:
// the matrices carry the rig's unit scale, and setFromRotationMatrix assumes
// orthonormal basis vectors.
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

const ART = path.join(process.env.HOME, 'UnityProjects/webgame-art/polygon-fantasy-rivals/Synty/PolygonFantasyRivals');
const MOVE = path.join(process.env.HOME, 'Documents/3d/fightAnimations/move animatrions');
const FIGHT = path.join(process.env.HOME, 'Documents/3d/fightAnimations');
const SRC_RIG = path.join(process.env.HOME, 'Documents/3d/Ref/rigged/model@Kicking.fbx');
// CC0, and the only animation source in this project whose licence is settled.
// One skinned FBX carrying 46 clips -- so it is both the rig AND the clips.
const CC0_RIG = path.join(process.env.HOME,
  'Documents/3d/cc0-animation-library/AnimationLibrary_Standard.fbx');

// `--all` builds every character in the pack into public/models/rivals/.
const ARGS = process.argv.slice(2);
const ALL = ARGS[0] === '--all';
const WANT_CHAR = ALL ? null : (ARGS[0] || 'Character_Pig_Butcher_01');
const OUT = path.resolve(ARGS[1] || 'public/models/rival.glb');
const OUT_DIR = path.resolve('public/models/rivals');

// Synty bone <- source bone, ONE MAP PER SOURCE RIG. Twenty-two entries each,
// and this is the entire cost of unlocking the pack. The FINGERS ARE
// DELIBERATELY NOT MAPPED: Synty names them identically on both hands --
// there are two bones called `Thumb_01` -- so a name-keyed track cannot tell
// them apart. They are irrelevant to an enemy that walks at you and swings.
//
// TWO RIGS, because the good walk and the good attack are not Mixamo. The
// CC0 library is Rigify-named (`DEF-hips`), and its three spine bones, its
// foot/toe split and its shoulder chain line up with Synty's one for one --
// which is the only reason a second map is twenty-two lines and not a day.
const RIG_BONES = {};
RIG_BONES.mixamo = {
  Hips: 'mixamorigHips',
  Spine_01: 'mixamorigSpine', Spine_02: 'mixamorigSpine1', Spine_03: 'mixamorigSpine2',
  Neck: 'mixamorigNeck', Head: 'mixamorigHead',
  Clavicle_L: 'mixamorigLeftShoulder', Shoulder_L: 'mixamorigLeftArm',
  Elbow_L: 'mixamorigLeftForeArm', Hand_L: 'mixamorigLeftHand',
  Clavicle_R: 'mixamorigRightShoulder', Shoulder_R: 'mixamorigRightArm',
  Elbow_R: 'mixamorigRightForeArm', Hand_R: 'mixamorigRightHand',
  UpperLeg_L: 'mixamorigLeftUpLeg', LowerLeg_L: 'mixamorigLeftLeg',
  Ankle_L: 'mixamorigLeftFoot', Toes_L: 'mixamorigLeftToeBase',
  UpperLeg_R: 'mixamorigRightUpLeg', LowerLeg_R: 'mixamorigRightLeg',
  Ankle_R: 'mixamorigRightFoot', Toes_R: 'mixamorigRightToeBase',
};
RIG_BONES.cc0 = {
  Hips: 'DEF-hips',
  Spine_01: 'DEF-spine001', Spine_02: 'DEF-spine002', Spine_03: 'DEF-spine003',
  Neck: 'DEF-neck', Head: 'DEF-head',
  Clavicle_L: 'DEF-shoulderL', Shoulder_L: 'DEF-upper_armL',
  Elbow_L: 'DEF-forearmL', Hand_L: 'DEF-handL',
  Clavicle_R: 'DEF-shoulderR', Shoulder_R: 'DEF-upper_armR',
  Elbow_R: 'DEF-forearmR', Hand_R: 'DEF-handR',
  UpperLeg_L: 'DEF-thighL', LowerLeg_L: 'DEF-shinL',
  Ankle_L: 'DEF-footL', Toes_L: 'DEF-toeL',
  UpperLeg_R: 'DEF-thighR', LowerLeg_R: 'DEF-shinR',
  Ankle_R: 'DEF-footR', Toes_R: 'DEF-toeR',
};

// `rest` names a clip to pose the rig at to READ ITS BIND POSE, instead of
// taking the bind from `skeleton.boneInverses`. The CC0 file is authored
// Z-UP and FBXLoader corrects that by rotating the NODE ABOVE THE BONES --
// it says so on load. A bone's getWorldQuaternion therefore carries that
// correction and its boneInverse does not, so differencing the two leaves
// every retargeted bone rotated 90 degrees about X. Posing the rig at its
// own T-pose and reading world matrices puts bind and motion in the SAME
// space, whichever space that is, which is all a delta transfer needs.
const RIGS = {
  mixamo: { file: SRC_RIG, rest: null, bones: RIG_BONES.mixamo },
  cc0: { file: CC0_RIG, rest: 'A_TPose', bones: RIG_BONES.cc0 },
};

// WALK UPRIGHT. The first pass used `Crouch Walk Forward` and `Ninja Idle`,
// which are a human ninja sneaking -- on a dwarf, an ork and a golem that
// reads as every monster in the game creeping up on you in a crouch. Elad's
// note after seeing it: "we need a regular animation cycle for them".
//
// Two sets, because one walk cannot carry both a dark elf and a six-foot ork:
// the heavy breeds get Mixamo's mutant gait and punch, which are weighted and
// slow, and everything else gets a normal upright stride.
//
// AND THEN BOTH NORMAL CLIPS WERE REPLACED AGAIN, because neither was
// actually a walk or an attack:
//
//   `Walk Forward Arc` is a TURNING walk. The body leans into a curve for
//   the whole cycle, so every normal breed was banking through a corner
//   while travelling in a straight line. There is no plain forward walk
//   anywhere in Documents/3d -- the only other options are three crouches
//   and a sneak.
//
//   `Standing Melee Attack Downward` is a THROW. Not my reading of it: the
//   Sewer Shred attack audition tagged it that way in fightAnimations/TAGS.md
//   on 2026-11-16 and dropped it for being a throwing motion.
//
// Both now come from Quaternius' Universal Animation Library (CC0), which
// has a real `Walk_Loop`, a real in-place `Sword_Attack` -- not the `_RM`
// twin, which carries root motion the sim already drives -- and a standing
// `Idle_Loop`, so the idle no longer has to be the walk's first frame held.
//
// A clip spec is either a NAME inside the rig's own file, or a [dir, file]
// pair to read separately.
const CLIP_SETS = {
  normal: {
    rig: 'cc0',
    clips: { walk: 'Walk_Loop', attack: 'Sword_Attack', idle: 'Idle_Loop' },
  },
  // THE HEAVIES NOW WALK THE SAME WAY AS EVERYONE ELSE.
  //
  // `heavy` used to be Mixamo's mutant gait and punch, on the argument that
  // one walk cannot carry both a dark elf and a six-foot ork. That argument
  // died with the roster: the cast is five constructs, three of them golems,
  // so the mutant hunch stopped being the exception and became the majority,
  // and a slouching robot next to an upright one just reads as a bug.
  //
  // The set is KEPT rather than deleted because it is the seam where a
  // second gait goes if one is ever bought -- the rig, the bone map and the
  // per-set plumbing all still work, it simply points at the same clips for
  // now. Cadence already differs per breed: render/foes.js drives the walk
  // from distance actually stepped, so a 105 px/s fort golem plays the same
  // cycle far slower than a 230 px/s evil god without a separate clip.
  heavy: {
    rig: 'cc0',
    clips: { walk: 'Walk_Loop', attack: 'Sword_Attack', idle: 'Idle_Loop' },
  },
};

/** The big, slow ones. Everything else walks normally. */
const HEAVY = new Set([
  'Character_Big_Ork_01', 'Character_FortGolem_01', 'Character_BarbarianGiant_01',
  'Character_Troll_01', 'Character_MechanicalGolem_01', 'Character_MutantGuy_01',
  'Character_RedDemon_01', 'Character_ElementalGolem_01',
]);

// THE CHILD OF EVERY MAPPED BONE, which is how a bone's DIRECTION is known.
// A quaternion alone cannot say where a bone points; the vector to its child
// can, and that is what the two rigs have to be made to agree about.
const CHILD = {
  Hips: 'Spine_01',
  Spine_01: 'Spine_02', Spine_02: 'Spine_03', Spine_03: 'Neck', Neck: 'Head',
  Clavicle_L: 'Shoulder_L', Shoulder_L: 'Elbow_L', Elbow_L: 'Hand_L',
  Clavicle_R: 'Shoulder_R', Shoulder_R: 'Elbow_R', Elbow_R: 'Hand_R',
  UpperLeg_L: 'LowerLeg_L', LowerLeg_L: 'Ankle_L', Ankle_L: 'Toes_L',
  UpperLeg_R: 'LowerLeg_R', LowerLeg_R: 'Ankle_R', Ankle_R: 'Toes_R',
};

const loader = new FBXLoader();
const read = (p) => {
  const b = fs.readFileSync(p);
  return loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};

const REF_Y = new THREE.Vector3(0, 1, 0), REF_Z = new THREE.Vector3(0, 0, 1);
/**
 * An orthonormal frame for a bone: its own axis, plus a world reference to
 * fix the twist. The reference swaps to Z for a bone that already points
 * along Y -- a thigh -- because a reference parallel to the axis gives no
 * frame at all.
 */
function axisFrame(dir) {
  const x = dir.clone().normalize();
  const ref = Math.abs(x.dot(REF_Y)) < 0.9 ? REF_Y : REF_Z;
  const y = ref.clone().addScaledVector(x, -ref.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

const _dp = new THREE.Vector3(), _ds = new THREE.Vector3();
const qOf = (m) => { const q = new THREE.Quaternion(); m.decompose(_dp, q, _ds); return q; };
const pOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);

/**
 * THE SYNTY HUMANOID, by name. Parent of every bone in the pack's rig.
 *
 * This table exists because THE FILE'S OWN PARENTAGE IS UNRECOVERABLE.
 * FBXLoader does not lay the ten characters out side by side; it nests every
 * repeated bone name into one chain, and a given character's bones end up
 * scattered at different depths across those chains. Measured on
 * Character_Pig_Butcher_01: of its 49 bones, the number whose nearest
 * scene-graph ancestor is also one of its own is ZERO. Its `Head` sits under
 * four other characters' `Head`s, and the `Neck` above it belongs to someone
 * else. So there is nothing to prune and nothing to walk -- the hierarchy has
 * to be asserted.
 *
 * `HAND` resolves to whichever hand came last in bone order, which is how the
 * two identically-named finger chains (`Thumb_01` under each wrist) are told
 * apart without relying on a side suffix the pack does not have.
 */
const PARENT = {
  Root: null, Hips: 'Root',
  UpperLeg_L: 'Hips', LowerLeg_L: 'UpperLeg_L', Ankle_L: 'LowerLeg_L', Ball_L: 'Ankle_L', Toes_L: 'Ball_L',
  UpperLeg_R: 'Hips', LowerLeg_R: 'UpperLeg_R', Ankle_R: 'LowerLeg_R', Ball_R: 'Ankle_R', Toes_R: 'Ball_R',
  Spine_01: 'Hips', Spine_02: 'Spine_01', Spine_03: 'Spine_02', Neck: 'Spine_03', Head: 'Neck',
  Eyebrows: 'Head', Eyes: 'Head',
  Clavicle_L: 'Spine_03', Shoulder_L: 'Clavicle_L', Elbow_L: 'Shoulder_L', Hand_L: 'Elbow_L',
  Clavicle_R: 'Spine_03', Shoulder_R: 'Clavicle_R', Elbow_R: 'Shoulder_R', Hand_R: 'Elbow_R',
  Thumb_01: 'HAND', Thumb_02: 'Thumb_01', Thumb_03: 'Thumb_02',
  IndexFinger_01: 'HAND', IndexFinger_02: 'IndexFinger_01',
  IndexFinger_03: 'IndexFinger_02', IndexFinger_04: 'IndexFinger_03',
  Finger_01: 'HAND', Finger_02: 'Finger_01', Finger_03: 'Finger_02', Finger_04: 'Finger_03',
};

/**
 * REBUILD this character's skeleton as a clean, standalone hierarchy.
 *
 * Returns a group holding one SkinnedMesh and one bone tree, with no other
 * character anywhere in it. Built from the BIND matrices and the table above,
 * so the result is bound correctly by construction rather than by preserving
 * a transform we have to be careful not to disturb.
 *
 * The bone ORDER is preserved exactly, because geometry.skinIndex addresses
 * bones by index -- reordering them silently attaches every vertex to the
 * wrong bone.
 */
function isolate(src, material) {
  const old = src.skeleton.bones;
  const bindWorld = old.map((_, i) => new THREE.Matrix4().copy(src.skeleton.boneInverses[i]).invert());

  // nearest PRECEDING bone of the wanted name -- order carries the side
  const parentOf = old.map((b, i) => {
    let want = PARENT[b.name];
    if (want === undefined) return -1;        // a bone the table does not know
    if (want === null) return -1;             // the root
    const names = want === 'HAND' ? ['Hand_L', 'Hand_R'] : [want];
    for (let j = i - 1; j >= 0; j--) if (names.includes(old[j].name)) return j;
    for (let j = i + 1; j < old.length; j++) if (names.includes(old[j].name)) return j;
    return -1;
  });
  const orphans = old.filter((b, i) => parentOf[i] < 0 && b.name !== 'Root');
  if (orphans.length) console.error('UNPARENTED:', orphans.map((b) => b.name).join(' '));

  const fresh = old.map((b) => { const n = new THREE.Bone(); n.name = b.name; return n; });
  const group = new THREE.Group();
  fresh.forEach((n, i) => {
    const local = new THREE.Matrix4();
    if (parentOf[i] >= 0) local.copy(bindWorld[parentOf[i]]).invert().multiply(bindWorld[i]);
    else local.copy(bindWorld[i]);
    local.decompose(n.position, n.quaternion, n.scale);
    if (parentOf[i] >= 0) fresh[parentOf[i]].add(n); else group.add(n);
  });

  // Sanity: a joint sits near its parent. A table mistake shows up here as a
  // limb attached across the body, long before it shows up as a bad frame.
  let far = 0, farName = '';
  for (let i = 0; i < old.length; i++) {
    if (parentOf[i] < 0) continue;
    const d = pOf(bindWorld[i]).distanceTo(pOf(bindWorld[parentOf[i]]));
    if (d > far) { far = d; farName = `${old[i].name} <- ${old[parentOf[i]].name}`; }
  }
  console.log(`rebuilt hierarchy: longest bone ${far.toFixed(1)} units (${farName})`);

  const mesh = new THREE.SkinnedMesh(src.geometry, material);
  group.add(mesh);
  group.updateMatrixWorld(true);
  // Identity bind matrix: the fresh bones ALREADY sit at their bind world
  // transforms, so boneMatrix = bindWorld * inverse(bindWorld) = identity.
  mesh.bind(new THREE.Skeleton(fresh, bindWorld.map((m) => new THREE.Matrix4().copy(m).invert())),
            new THREE.Matrix4());
  return { group, mesh, bones: fresh, bindWorld };
}

// --- the source rigs, each read ONCE for its bind pose, and the clips.
function loadRig(spec) {
  const obj = read(spec.file);
  let skin = null;
  obj.traverse((x) => { if (x.isSkinnedMesh && !skin) skin = x; });
  if (!skin) { console.error('no skin in', spec.file); process.exit(1); }
  obj.updateMatrixWorld(true);
  const byName = new Map(skin.skeleton.bones.map((b) => [b.name, b]));

  let bind;
  if (spec.rest) {
    const rest = obj.animations.find((c) => c.name === spec.rest || c.name.endsWith('|' + spec.rest));
    if (!rest) { console.error('no rest clip', spec.rest, 'in', spec.file); process.exit(1); }
    const m = new THREE.AnimationMixer(obj);
    m.clipAction(rest).play();
    m.setTime(0);
    obj.updateMatrixWorld(true);
    bind = new Map(skin.skeleton.bones.map((b) => [b.name, b.matrixWorld.clone()]));
    m.stopAllAction();
    m.uncacheRoot(obj);
  } else {
    bind = new Map(skin.skeleton.bones.map((b, i) =>
      [b.name, new THREE.Matrix4().copy(skin.skeleton.boneInverses[i]).invert()]));
  }

  const bones = spec.bones;
  for (const nm of Object.values(bones)) {
    if (!bind.has(nm)) console.error('  rig', spec.rest ? 'cc0' : 'mixamo', 'has no bone', nm);
  }
  const leg = pOf(bind.get(bones.Hips)).y - pOf(bind.get(bones.Ankle_L)).y;
  return { obj, bind, byName, bones, leg };
}

const LOADED = {};
const SOURCES = {};
for (const [set, def] of Object.entries(CLIP_SETS)) {
  const rig = LOADED[def.rig] || (LOADED[def.rig] = loadRig(RIGS[def.rig]));
  const clips = {};
  for (const [name, spec] of Object.entries(def.clips)) {
    const c = Array.isArray(spec)
      ? read(path.join(spec[0], spec[1])).animations[0]
      : rig.obj.animations.find((x) => x.name === spec || x.name.endsWith('|' + spec));
    if (c) clips[name] = c; else console.error(set, name, '-- no clip for', spec);
  }
  SOURCES[set] = { rig, clips };
  console.log(`clips[${set}] via ${def.rig}:`,
    Object.entries(clips).map(([n, c]) => `${n} ${c.duration.toFixed(2)}s`).join('  '));
}

/**
 * SHRINK THE VERTEX DATA. Twenty characters at float32 everything is 21 MB,
 * against a whole build that was 3.46 MB.
 *
 * Nothing here is lossy in a way this art can show. A normal quantised to
 * int8 is accurate to ~0.5 degrees on a flat-shaded low-poly character; UVs
 * to uint16 are accurate to 1/32 of a texel on a 2048px atlas; and skin
 * weights to uint8 move a vertex by far less than the width of a seam. The
 * one that is exactly lossless is skinIndex: 49 bones needs 6 bits, and it
 * was being stored in 32.
 *
 * POSITION IS LEFT ALONE deliberately -- quantising it needs a scale/offset
 * baked into the node transform, and a transform on a node holding a
 * SkinnedMesh is the exact thing that silently breaks the bind.
 */
function quantize(geo) {
  const before = Object.values(geo.attributes).reduce((n, a) => n + a.array.byteLength, 0);
  const uv = geo.attributes.uv;
  if (uv) {
    let lo = Infinity, hi = -Infinity;
    for (const v of uv.array) { if (v < lo) lo = v; if (v > hi) hi = v; }
    // Outside 0..1 a normalised unsigned type would wrap, so leave it be.
    if (lo >= 0 && hi <= 1) {
      const q = new Uint16Array(uv.array.length);
      for (let i = 0; i < q.length; i++) q[i] = Math.round(uv.array[i] * 65535);
      geo.setAttribute('uv', new THREE.BufferAttribute(q, uv.itemSize, true));
    }
  }
  const nrm = geo.attributes.normal;
  if (nrm) {
    const q = new Int8Array(nrm.array.length);
    for (let i = 0; i < q.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(nrm.array[i] * 127)));
    geo.setAttribute('normal', new THREE.BufferAttribute(q, nrm.itemSize, true));
  }
  const sw = geo.attributes.skinWeight;
  if (sw) {
    const q = new Uint8Array(sw.array.length);
    for (let i = 0; i < q.length; i += 4) {
      // Re-normalise each set of four so they still sum to 1 after rounding.
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += sw.array[i + k];
      let used = 0, big = 0, bigv = -1;
      for (let k = 0; k < 4; k++) {
        const v = sum > 0 ? sw.array[i + k] / sum : (k === 0 ? 1 : 0);
        const b = Math.round(v * 255);
        q[i + k] = b; used += b;
        if (v > bigv) { bigv = v; big = k; }
      }
      q[i + big] += 255 - used;         // put the rounding error on the heaviest
    }
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(q, sw.itemSize, true));
  }
  const si = geo.attributes.skinIndex;
  if (si) {
    let hi = 0;
    for (const v of si.array) if (v > hi) hi = v;
    if (hi < 256) {
      const q = new Uint8Array(si.array.length);
      for (let i = 0; i < q.length; i++) q[i] = si.array[i];
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(q, si.itemSize, false));
    }
  }
  const after = Object.values(geo.attributes).reduce((n, a) => n + a.array.byteLength, 0);
  return `${(before / 1024).toFixed(0)}->${(after / 1024).toFixed(0)} KB verts`;
}

/** Retarget every clip onto one isolated character, and verify the result. */
function buildCharacter(found, outPath) {
  const setName = HEAVY.has(found.name) ? 'heavy' : 'normal';
  // Every name below that used to be a module global now comes from the set's
  // own rig, so one build can mix a Mixamo source and a CC0 one.
  const S = SOURCES[setName];
  const { bind: srcBind, byName: srcByName, bones: BONES, leg: srcLeg, obj: srcObj } = S.rig;
  const { group, mesh, bones, bindWorld } = isolate(found,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }));
  const shrunk = quantize(mesh.geometry);
  const byName = new Map(bones.map((b) => [b.name, b]));
  const bindOf = new Map(bones.map((b, i) => [b.name, bindWorld[i]]));

  const pair = Object.entries(BONES).filter(([tn, sn]) => byName.has(tn) && srcBind.has(sn));
  const tgtLeg = pOf(bindOf.get('Hips')).y - pOf(bindOf.get('Ankle_L')).y;
  const scale = tgtLeg / srcLeg;

  // MAKE THE TWO REST POSES AGREE BEFORE TRANSFERRING ANYTHING.
  //
  // Mixamo binds in a T-POSE and Synty in an A-POSE: the arms hang about 45
  // degrees lower at rest. Carrying a rotation across as a delta from each
  // rig's OWN bind faithfully preserves that 45 degrees, so a walk whose arms
  // swing near the body came out with every arm held wide -- measured in the
  // running game at 62 to 158 degrees from straight down, where a walk should
  // read 20 to 45. Elad saw it immediately.
  //
  // The fix is to stop preserving it. For each bone, rotate its bind
  // ORIENTATION so its bone axis -- the direction to its own child -- points
  // the way the SOURCE's equivalent bone points at rest. Transferring against
  // that corrected rest makes the target's limb land where the source's limb
  // actually is, instead of 45 degrees above it.
  //
  // Derived per bone from the two skeletons, never hardcoded: the legs come
  // out as near-identity because both rigs already agree about legs, and the
  // arms come out carrying the whole T-to-A difference.
  const restBind = new Map();
  for (const [tn, sn] of pair) {
    const base = qOf(bindOf.get(tn));
    const tc = CHILD[tn], sc = tc ? BONES[tc] : null;
    if (!tc || !bindOf.has(tc) || !sc || !srcBind.has(sc)) { restBind.set(tn, base); continue; }
    const tDir = pOf(bindOf.get(tc)).sub(pOf(bindOf.get(tn)));
    const sDir = pOf(srcBind.get(sc)).sub(pOf(srcBind.get(sn)));
    if (tDir.lengthSq() < 1e-9 || sDir.lengthSq() < 1e-9) { restBind.set(tn, base); continue; }
    // A FULL FRAME, NOT THE SHORTEST ARC.
    //
    // setFromUnitVectors aligns the bone axis and leaves the TWIST about that
    // axis arbitrary. On a mirrored limb the arbitrary choice comes out 180
    // degrees apart from its opposite number, which is exactly what happened:
    // after the first fix the LEFT arm measured a correct 25 degrees from
    // straight down and the RIGHT still measured 90, held straight out.
    //
    // Building a whole orthonormal frame from the bone axis plus a WORLD
    // reference pins the twist as well. Both rigs are modelled facing the
    // same way at bind, so the same world reference means the same thing on
    // both, and the two sides come out symmetric.
    const align = new THREE.Quaternion().setFromRotationMatrix(
      axisFrame(sDir).multiply(axisFrame(tDir).invert()));
    restBind.set(tn, align.multiply(base));
  }

  const depth = (b) => { let d = 0, p = b.parent; while (p) { d++; p = p.parent; } return d; };
  const order = bones.slice().sort((a, b) => depth(a) - depth(b));

  const animations = [];
  for (const [name, clip] of Object.entries(S.clips)) {
    const mixer = new THREE.AnimationMixer(srcObj);
    mixer.clipAction(clip).play();
    const n = Math.max(2, Math.round(clip.duration * 30));
    const times = [];
    const keys = new Map(pair.map(([tn]) => [tn, []]));
    const hips = [];
    let hips0 = null;

    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * clip.duration * 0.999;
      times.push(+t.toFixed(4));
      mixer.setTime(t);
      srcObj.updateMatrixWorld(true);

      for (const b of order) {
        const sn = BONES[b.name];
        if (sn && srcByName.has(sn)) {
          const Rs = new THREE.Quaternion();
          srcByName.get(sn).getWorldQuaternion(Rs);
          const want = Rs.multiply(qOf(srcBind.get(sn)).invert()).multiply(restBind.get(b.name));
          const pw = new THREE.Quaternion();
          if (b.parent) b.parent.getWorldQuaternion(pw);
          b.quaternion.copy(pw.invert().multiply(want));
        }
        b.updateMatrix();
        if (b.parent) b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix);
        else b.matrixWorld.copy(b.matrix);
      }
      for (const [tn] of pair) {
        const q = byName.get(tn).quaternion;
        keys.get(tn).push(q.x, q.y, q.z, q.w);
      }

      // HIPS: THE VERTICAL BOB ONLY, measured from THIS CLIP'S OWN FIRST
      // FRAME. The clip's `mixamorigHips.position` is absolute in the units
      // of the FBX it came from, and that is NOT the same file as the source
      // rig -- both are Mixamo, exported at different scales -- so
      // differencing against the RIG's bind hips mixes two coordinate
      // systems and lifts the whole character 105 units off the floor. And
      // the horizontal component is root motion: the sim already drives
      // where an enemy IS, so carrying it would make every walker slide.
      const now = new THREE.Vector3();
      srcByName.get(BONES.Hips).getWorldPosition(now);
      if (i === 0) hips0 = now.clone();
      const want = pOf(bindOf.get('Hips'));
      want.y += (now.y - hips0.y) * scale;
      const hb = byName.get('Hips');
      if (hb.parent) want.applyMatrix4(new THREE.Matrix4().copy(hb.parent.matrixWorld).invert());
      hips.push(want.x, want.y, want.z);
    }

    const tracks = pair.map(([tn]) =>
      new THREE.QuaternionKeyframeTrack(`${tn}.quaternion`, times,
        keys.get(tn).map((v) => +v.toFixed(4))));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hips.map((v) => +v.toFixed(3))));
    animations.push(new THREE.AnimationClip(name, clip.duration, tracks));
  }

  // A FALLBACK IDLE, for a set whose library has none. The CC0 library ships
  // a real standing `Idle_Loop`, so `normal` never reaches this; the Mixamo
  // side still does, because its only two idles are Ninja Idles and both are
  // crouches -- on an ork that reads as a six-foot brute sneaking. So the
  // idle there is the walk's OWN FIRST FRAME, held: it plays rarely (a foe
  // only idles while hovering exactly at its strike range) and when it does,
  // the character stands in the stance it was just walking in.
  if (!animations.some((c) => c.name === 'idle')) {
    const walk = animations.find((c) => c.name === 'walk');
    if (walk) {
      const held = walk.tracks.map((t) => {
        const n = t.getValueSize();
        const first = Array.from(t.values.slice(0, n));
        return new t.constructor(t.name, [0, 1], first.concat(first));
      });
      animations.push(new THREE.AnimationClip('idle', 1, held));
    }
  }

  // --- VERIFY, before writing anything. Applied straight to these bones: a
  // mixer bound by name is exactly what went wrong before.
  const yOf = (nm) => { const v = new THREE.Vector3(); byName.get(nm).getWorldPosition(v); return v.y; };
  let worst = 1e9, highFoot = -1e9;
  for (const c of animations) {
    const qt = new Map(c.tracks.filter((t) => t.name.endsWith('.quaternion'))
      .map((t) => [t.name.split('.')[0], t]));
    const hp = c.tracks.find((t) => t.name === 'Hips.position');
    const frames = qt.values().next().value.times.length;
    for (let k = 0; k < 5; k++) {
      const f = Math.round((k / 4) * (frames - 1));
      for (const [nm, t] of qt) byName.get(nm).quaternion.fromArray(t.values, f * 4);
      byName.get('Hips').position.fromArray(hp.values, f * 3);
      for (const b of order) {
        b.updateMatrix();
        if (b.parent) b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix);
        else b.matrixWorld.copy(b.matrix);
      }
      const a = new THREE.Vector3(), b2 = new THREE.Vector3();
      byName.get('Hips').getWorldPosition(a); byName.get('Head').getWorldPosition(b2);
      const sp = b2.sub(a);
      worst = Math.min(worst, sp.y / sp.length());
      highFoot = Math.max(highFoot, Math.min(yOf('Ankle_L'), yOf('Ankle_R')));
    }
  }
  // These clips are a crouched ninja stance, so an upright of 1.00 would be
  // WRONG; what must never happen again is a negative one, which is a
  // character folded over or inverted.
  const bindFoot = pOf(bindOf.get('Ankle_L')).y;
  const ok = worst > 0.3 && Math.abs(highFoot - bindFoot) < 25;
  const verdict = `upright>=${worst.toFixed(2)} foot=${highFoot.toFixed(0)}/${bindFoot.toFixed(0)}`;
  if (!ok) { console.error(`  SKIPPED ${path.basename(outPath)} -- failed posture (${verdict})`); return false; }

  return new Promise((res) => {
    new GLTFExporter().parse(group,
      (gltf) => {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, Buffer.from(gltf));
        console.log(`  [${setName}] ${path.basename(outPath).padEnd(30)} ${String((fs.statSync(outPath).size/1024).toFixed(0)).padStart(5)} KB  ${bones.length} bones  ${shrunk}  ${verdict}`);
        res(true);
      },
      (err) => { console.error('  export failed:', err); res(false); },
      { binary: true, animations, onlyVisible: false });
  });
}

const FILES = ['Models/Characters.fbx', 'Models/Characters_BR.fbx'];
let made = 0, skipped = 0;
for (const file of FILES) {
  const o = read(path.join(ART, file));
  const chars = [];
  o.traverse((x) => { if (x.isSkinnedMesh) chars.push(x); });
  for (const c of chars) {
    if (!ALL && c.name !== WANT_CHAR) continue;
    // The ghost overlay is a 19-bone decal, not a character.
    if (c.skeleton.bones.length < 40) { continue; }
    const out = ALL ? path.join(OUT_DIR, `${c.name}.glb`) : OUT;
    const okay = await buildCharacter(c, out);
    if (okay) made++; else skipped++;
  }
  if (!ALL && made) break;
}
console.log(`\n${made} built, ${skipped} skipped`);
