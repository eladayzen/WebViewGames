// Put a Fantasy Rivals character on its feet with MOTION, by retargeting.
//
// THE QUESTION THIS ANSWERS. The pack has twenty rigged characters and not
// one animation clip -- the only two .anim files in 173 MB are decorative
// runes. So the characters are not enemies as they stand. The question was
// whether there is a fast way to fix that, and there is, for one reason:
//
//   ALL TWENTY SHARE ONE SKELETON. 49 bones, identical naming, in both
//   Characters.fbx and Characters_BR.fbx. So this is not twenty rigging
//   jobs. It is ONE bone map, written once, and then every character in the
//   pack can play every clip we own.
//
// WHY RETARGET AND NOT JUST RENAME THE TRACKS. Renaming is the tempting
// one-liner -- rewrite `mixamorigLeftArm.quaternion` to `Shoulder_L.quaternion`
// and let the mixer bind it. It is wrong whenever the two rigs' BIND POSES
// differ, which they do: Mixamo's is a T-pose and Synty's is an A-pose, so a
// rotation that means "arm straight out" on one skeleton means "arm raised
// forty degrees above straight out" on the other. SkeletonUtils.retargetClip
// exists precisely to carry a rotation across that difference, and it is in
// three already.
//
// THE FINGERS ARE DELIBERATELY NOT MAPPED. Synty names them identically on
// both hands -- there are two bones called `Thumb_01`, one under each wrist --
// so a name-keyed track cannot tell them apart at all. They are irrelevant to
// an enemy that walks at you and swings, so they are simply left out rather
// than worked around.
//
//   node tools/make-rival.mjs [CharacterName] [out.glb]
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { retargetClip } from 'three/addons/utils/SkeletonUtils.js';

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

const WANT_CHAR = process.argv[2] || 'Character_Pig_Butcher_01';
const OUT = path.resolve(process.argv[3] || 'public/models/rival.glb');

// THE MAP. Synty bone <- Mixamo bone. Twenty-two entries, and this is the
// entire cost of unlocking the pack.
const BONES = {
  Hips: 'mixamorigHips',
  Spine_01: 'mixamorigSpine',
  Spine_02: 'mixamorigSpine1',
  Spine_03: 'mixamorigSpine2',
  Neck: 'mixamorigNeck',
  Head: 'mixamorigHead',
  Clavicle_L: 'mixamorigLeftShoulder',
  Shoulder_L: 'mixamorigLeftArm',
  Elbow_L: 'mixamorigLeftForeArm',
  Hand_L: 'mixamorigLeftHand',
  Clavicle_R: 'mixamorigRightShoulder',
  Shoulder_R: 'mixamorigRightArm',
  Elbow_R: 'mixamorigRightForeArm',
  Hand_R: 'mixamorigRightHand',
  UpperLeg_L: 'mixamorigLeftUpLeg',
  LowerLeg_L: 'mixamorigLeftLeg',
  Ankle_L: 'mixamorigLeftFoot',
  Toes_L: 'mixamorigLeftToeBase',
  UpperLeg_R: 'mixamorigRightUpLeg',
  LowerLeg_R: 'mixamorigRightLeg',
  Ankle_R: 'mixamorigRightFoot',
  Toes_R: 'mixamorigRightToeBase',
};

const CLIPS = {
  idle: [MOVE, 'Ninja Idle (1).fbx'],
  walk: [MOVE, 'Crouch Walk Forward.fbx'],
  attack: [FIGHT, 'Standing Melee Attack Downward.fbx'],
};

const loader = new FBXLoader();
const read = (p) => {
  const buf = fs.readFileSync(p);
  return loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
};

// --- the target: one character out of whichever pack file holds it
let scene = null, target = null;
for (const file of ['Models/Characters.fbx', 'Models/Characters_BR.fbx']) {
  const o = read(path.join(ART, file));
  o.traverse((x) => { if (x.isSkinnedMesh && x.name === WANT_CHAR) target = x; });
  if (target) { scene = o; console.log(`${WANT_CHAR} found in ${file}`); break; }
}
if (!target) { console.error('no such character:', WANT_CHAR); process.exit(1); }

// ISOLATE IN PLACE. The pack puts ten characters in one FBX, each with its
// own 49-bone skeleton, and every one of those skeletons names its bones
// `Hips`, `Spine_01` and so on. Exporting the lot would both ship ten
// characters inside every enemy AND make every animation track ambiguous --
// `Hips.quaternion` would match ten different bones.
//
// IN PLACE is the load-bearing half. The first version lifted the mesh and
// its bone root into a fresh group and scaled that: the bodies then rendered
// as nothing at all, while their blob shadows sat in exactly the right
// places. A SkinnedMesh's bindMatrix is captured in the world transform it
// had when it was bound, so moving the mesh to a different parent, or
// scaling it separately from its bones, collapses the skin silently. Nothing
// errors. The fix is to never change anything's transform relative to
// anything else -- delete the siblings, then scale the ROOT that holds the
// survivor and its bones together, which is what tools/make-skeleton.mjs
// already does.
const keep = new Set(target.skeleton.bones);
let myRoot = target.skeleton.bones[0];
while (myRoot.parent && myRoot.parent.isBone) myRoot = myRoot.parent;
const drop = [];
scene.traverse((x) => {
  if (x.isSkinnedMesh && x !== target) drop.push(x);
  else if (x.isBone && !keep.has(x)) {
    let top = x;
    while (top.parent && top.parent.isBone) top = top.parent;
    if (top !== myRoot) drop.push(top);
  }
});
for (const x of new Set(drop)) x.removeFromParent();
console.log(`isolated: dropped ${new Set(drop).size} sibling nodes`);

// MAP CANONICAL NAME -> WHATEVER THIS BONE IS ACTUALLY CALLED.
//
// The FBX holds ten characters whose bones all share names, so FBXLoader
// hands the fourth one back as `Hips_4`, `UpperLeg_L_4` and so on. The
// retarget map is written against the clean names, so the clips come out
// addressing `Hips` while the skeleton says `Hips_4`: every track binds to
// nothing, the character stands in its bind pose for ever, and NOTHING
// anywhere reports a problem. Measured on the first attempt -- bone world
// position moved 0.0000 units across forty frames.
//
// Renaming the bones to the clean names loses to the exporter, which
// uniquifies them again on the way out. Renaming the TRACKS to the bones'
// real names cannot lose, because it is done against the very objects being
// exported.
// retargetClip resolves each TARGET bone through `options.names[bone.name]`
// to find its source. So the map has to be keyed by the names the target
// skeleton really carries -- `Hips_4`, not `Hips`. Keyed by the clean names
// it silently matches nothing: every bone is skipped, the clip comes out
// with the right track names and completely flat values, and the character
// stands still. That is what happened, and it took measuring a bone through
// 180 frames of a clip that was playing at full weight to see it, because
// nothing errors and the tracks are all correctly bound.
const actualName = {};
const names = {};
for (const bone of target.skeleton.bones) {
  const canon = bone.name.replace(/_\d+$/, '');
  actualName[canon] = bone.name;
  if (BONES[canon]) names[bone.name] = BONES[canon];
}
console.log(`mapped ${Object.keys(names).length} of ${Object.keys(BONES).length} bones onto this skeleton`);
if (Object.keys(names).length < Object.keys(BONES).length * 0.8) {
  console.error('WARNING: most of the bone map found no bone -- the clip will come out flat');
}

// The pack's materials point at a shared 1024px atlas by a path from the
// author's machine, and GLTFExporter needs a canvas to embed an image in
// node. Same answer as the skeleton: strip the material, copy the atlas
// beside the glb, and apply it at load.
target.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });

// NOT NORMALISED HERE, on purpose. Scaling the node that holds a SkinnedMesh
// does not reliably scale the SKINNED result -- the bind matrices were
// captured before the scale and cancel it out. Measured: this exported at
// 180.9 units tall however the root was scaled, so the game then multiplied
// that by its own enemy height and every Foot Soldier was a 380-unit giant
// the camera was standing inside. Only its blob shadow gave it away.
//
// render/foes.js measures the posed skin at load and normalises from that,
// which is a number that cannot be wrong, and it does the same for every
// pack without this tool having to know anything.
const wrap = new THREE.Group();
wrap.add(scene);
wrap.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(scene);
const h = box.max.y - box.min.y;
console.log(`bones ${target.skeleton.bones.length}, ${target.geometry.attributes.position.count} verts, rest-pose height ${h.toFixed(1)} (normalised at load)`);

// --- THE SOURCE RIG, AND WHY IT IS A `model@` FBX.
//
// retargetClip works out how to carry a rotation across by comparing the two
// skeletons' BIND POSES, so the source has to be bound in its REST pose. A
// Mixamo animation-only export has bones and no skin, and a stand-in
// skeleton built from those bones is bound in whatever pose frame zero
// happens to be -- a mid-stride crouch. Everything then runs, every track
// binds, every bone moves, and every character comes out hunched forward on
// all fours, because that crouch is being treated as "standing straight".
//
// Mixamo's `model@...` exports are the same rig WITH the skin, so they carry
// a real bind pose. Any of them will do; this is only ever read for its rest
// pose, never for its motion.
const SRC_RIG = path.join(process.env.HOME, 'Documents/3d/Ref/rigged/model@Kicking.fbx');
const srcObj = read(SRC_RIG);
let srcSkel = null;
srcObj.traverse((x) => { if (x.isSkinnedMesh && !srcSkel) srcSkel = x; });
if (!srcSkel) { console.error('no skin in', SRC_RIG); process.exit(1); }
srcObj.updateMatrixWorld(true);
console.log(`source bind pose: ${path.basename(SRC_RIG)}, ${srcSkel.skeleton.bones.length} bones`);

const animations = [];
for (const [name, [dir, file]] of Object.entries(CLIPS)) {
  const obj = read(path.join(dir, file));
  const clip = obj.animations[0];
  if (!clip) { console.error(name, '-- no clip'); continue; }
  let out;
  try {
    out = retargetClip(target, srcSkel, clip, { names, hip: actualName.Hips || 'Hips', useFirstFramePosition: true, fps: 30 });
  } catch (e) {
    console.error(`${name} retarget failed:`, e.message);
    continue;
  }
  out.name = name;
  // retargetClip names its tracks relative to the SkinnedMesh --
  // `.bones[Shoulder_R].quaternion` -- which is valid for a mixer bound to
  // that mesh and meaningless to the exporter, which resolves names against
  // the exported node graph. Without this rename every limb track is dropped
  // with a warning and the glb exports carrying only the hips.
  for (const t of out.tracks) {
    t.name = t.name.replace(/^\.bones\[(.+?)\]/, '$1');
    const [who, prop] = t.name.split('.');
    if (actualName[who]) t.name = `${actualName[who]}.${prop}`;
  }
  const bound = out.tracks.filter((t) => target.skeleton.bones.some((b2) => b2.name === t.name.split('.')[0]));
  if (bound.length !== out.tracks.length) {
    console.error(`  WARNING: ${out.tracks.length - bound.length} track(s) name no bone on this skeleton`);
  }
  out.tracks = out.tracks.filter((t) => !t.name.endsWith('.scale'));
  for (const t of out.tracks) {
    for (let i = 0; i < t.values.length; i++) t.values[i] = +t.values[i].toFixed(3);
  }
  animations.push(out);
  console.log(`${name.padEnd(7)} ${out.duration.toFixed(2)}s  ${String(out.tracks.length).padStart(3)} tracks  <- ${file}`);
}

new GLTFExporter().parse(
  wrap,
  (gltf) => {
    fs.writeFileSync(OUT, Buffer.from(gltf));
    console.log('->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
  },
  (err) => { console.error('export failed:', err); process.exit(1); },
  { binary: true, animations, onlyVisible: false },
);
