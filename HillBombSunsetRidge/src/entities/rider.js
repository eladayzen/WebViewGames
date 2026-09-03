// The rider layer -- the ONLY thing that differs between render modes.
//
// This is the whole point of the harness. Every mode exposes an identical
// interface and sits under an identical transform hierarchy, so main.js never
// branches on mode and switching mid-run is an honest A/B/C rather than three
// different prototypes.
//
//   MODE A 'sprite' -- a plane that always faces the camera (the
//     HalfShellHustle method). Cheap and always readable from behind. Kept as
//     the control to measure the 3D modes against.
//
//   MODE B 'model' -- the raw Kolbo/Meshy mesh. UNRIGGED (verified skins:0,
//     animations:0 -- see KOLBO_ASSET_PIPELINE.md), so it cannot deform limbs.
//     Animated only by whole-body transforms. Textured, but frozen.
//
//   MODE C 'rigged' -- the same character after Mixamo auto-rigging, with real
//     SKELETAL animation from Mixamo clips. This is the mode that should win:
//     it's the only one with actual limb motion.
//
// Why mode C needs re-texturing in code: Mixamo returns the rigged mesh with
// every material and texture STRIPPED (verified Texture:0, Material:0, Video:0
// on all four exports). That is exactly why the reference build's character
// reads as bland grey plastic. Mixamo does preserve UVs, so we re-apply the
// PBR maps we already extracted from the Meshy GLB and the character comes back
// fully textured -- which should put us ahead of the reference on looks while
// matching it on animation.
//
// Transform hierarchy shared by all modes:
//   root  (world position + yaw to face down-road)
//     └ tilt  (carve roll + tuck pitch)
//         └ visual (sprite plane | static mesh | rigged mesh)

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import riderSpriteUrl from '../assets/rider_sprite.png?url';
import riggedUrl from '../assets/rig/rider_rigged.fbx?url';
import clipIdleUrl from '../assets/rig/clip_idle.fbx?url';
import clipPushUrl from '../assets/rig/clip_push.fbx?url';
import baseColorUrl from '../assets/rig/rider_basecolor.jpg?url';
import normalUrl from '../assets/rig/rider_normal.jpg?url';
import metalRoughUrl from '../assets/rig/rider_metalrough.jpg?url';
import {
  HOP_HIP_FOLD, HOP_KNEE_FOLD,
  AIR_TUCK_HIP, AIR_TUCK_KNEE, AIR_ARM_LIFT, LAND_ARM_LIFT,
  LAND_HIP_BEND, LAND_KNEE_BEND, LAND_SPINE_CURL,
  TUCK_SPINE, TUCK_SINK, TUCK_KNEE_SPLAY, TUCK_SPLAY_LEFT_SCALE,
  TUCK_ARM_FORWARD, TUCK_ELBOW_FOLD,
  BRAKE_SPINE, BRAKE_BOARD_PITCH,
  GRIND_YAW, GRIND_HIP_BEND, GRIND_KNEE_BEND,
  GRIND_ARM_SPREAD, GRIND_ELBOW_OPEN, GRIND_PUSH_LOCKOUT,
  RIM_COLOR, RIM_STRENGTH, RIM_POWER,
  BALANCE_CARVE, BALANCE_LATERAL, BALANCE_LATERAL_REF, BALANCE_SMOOTH,
  BALANCE_LIFT_BASE, BALANCE_LIFT_ASYM, ARM_LIFT_MAX,
  SPIN_LEAN,
  GRAB_CROUCH_HIP, GRAB_CROUCH_KNEE,
  GRAB_SKY_ARM, GRAB_REACH_ARM, GRAB_REACH_ELBOW,
  HOVER_FOLD_HIP, HOVER_FOLD_KNEE, HOVER_ARM_SPREAD, HOVER_ELBOW_OPEN, HOVER_LEAN,
} from '../data/constants.js';

const RIDER_HEIGHT = 1.85;
const BOARD_Y = 0.10;
// The foot BONE sits at the ankle, not the sole, so the board can't just be
// placed at the bone height. MEASURED, not guessed: sampling all 93,843 skinned
// vertices through applyBoneTransform() put the true sole 0.2263 world units
// below the lower ankle bone on this rig. Add half the deck thickness (0.04) so
// the sole rests ON the top face instead of sinking into it.
//
// An earlier guess of 0.115 buried the feet ~8cm inside the deck -- which is
// exactly the kind of thing that looks "roughly fine" standing still and then
// reads as a visible gap the moment the rider carves or jumps.
// Board size relative to the deck geometry authored below. Amit: the board read
// far too big next to the kid -- 60% of the original.
const BOARD_SCALE = 0.6;

// Authored deck half-thickness (BoxGeometry height 0.08 / 2), before scaling.
const DECK_HALF_THICKNESS = 0.04 * BOARD_SCALE;

// Drop from the STANDING foot's ankle bone to the sole, solved by measurement.
//
// Define gap = (true animated sole of the standing foot) - (deck top face), so
// gap > 0 means floating. The gap moves exactly 1:1 with the total drop, which
// two samples pinned: drop 0.2913 -> +0.080, drop 0.3713 -> +0.160. That solved
// a total drop of 0.2113 against a deck whose top sat 0.04 above the board
// centre -- so the ankle->sole part alone is 0.2113 - 0.04 = 0.1713.
//
// Keeping the two terms separate matters: rescaling the board changes the deck
// half-thickness, and the planting has to follow automatically instead of
// silently drifting.
//
// "True sole" is not a guess -- it came from sampling all 93,843 skinned
// vertices through applyBoneTransform() in the live animated pose, not from the
// bind-pose bounding box (which is a T-pose, nowhere near a skate stance).
const ANKLE_TO_SOLE = 0.1713;
const BOARD_DROP = ANKLE_TO_SOLE + DECK_HALF_THICKNESS;

const _fa = new THREE.Vector3();
const _fb = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _rup = new THREE.Vector3();
const _rx = new THREE.Vector3();
const _rz = new THREE.Vector3();
const _rbasis = new THREE.Matrix4();
// Dedicated scratch for contactPoint(). Deliberately NOT shared with the
// vectors above: an earlier bug in the trough code came from exactly this kind
// of reuse, where one call quietly clobbered another's working value.
const _cu = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _ax = new THREE.Vector3();

/**
 * Mixamo's "in place" clips still carry a Hips position track, and the second
 * clip (the leg-push) genuinely translates forward. Our game owns forward motion
 * entirely (road distance `s`), so any root translation in the clip fights it.
 *
 * Two separate problems, two separate fixes:
 *
 *  1. HORIZONTAL DRIFT -- pin the Hips X and Z to their first keyframe. This is
 *     what stops the push clip walking the rider off the board.
 *
 *  2. VERTICAL OFFSET -- the Hips Y in the clip is an ABSOLUTE value in the
 *     rig's own space, and it does NOT necessarily match the skeleton's bind
 *     position. Applying it raw stacked ~1 unit on top of the bind offset and
 *     left the rider hovering above the deck. So rather than dropping the track
 *     (which would kill the body's vertical bob) we REBASE it: shift the whole Y
 *     curve so its first keyframe equals the bone's bind Y. Bob preserved,
 *     offset gone.
 *
 * @param {THREE.AnimationClip} clip
 * @param {THREE.Object3D} rigRoot the skinned rig, used to look up bind pose
 */
function stripRootMotion(clip, rigRoot) {
  let fixed = 0;
  for (const track of clip.tracks) {
    if (!/\.position$/.test(track.name)) continue;
    const nodeName = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    if (!/Hips$/.test(nodeName)) continue;

    const bone = rigRoot.getObjectByName(nodeName);
    const v = track.values;
    const x0 = v[0];
    const z0 = v[2];
    // Rebase Y against the bind pose if we can find the bone; if we can't, fall
    // back to rebasing against the track's own first frame (still removes the
    // drift, just keeps whatever constant offset the clip had).
    const bindY = bone ? bone.position.y : v[1];
    const dy = bindY - v[1];

    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0; // X pinned
      v[i + 1] += dy; // Y rebased to bind, bob intact
      v[i + 2] = z0; // Z pinned -- the forward drift
    }
    fixed++;
  }
  return fixed;
}


// --- TWO-BONE LEG IK --------------------------------------------------------
// Drops the pelvis while the FEET STAY EXACTLY WHERE THEY ARE on the deck.
//
// This is the one place in this rig that genuinely needs IK, and it is worth
// being precise about why, because everywhere else FK was the right call. An
// arm reaching "out there" for balance has no target -- two rotations describe
// it completely. A foot planted on a board IS a world-space target: the pelvis
// moves and the ankle must not, which is a constraint FK cannot express. Trying
// it with FK is exactly what slid the boots around the deck -- the hips are the
// root of the chain, so folding the legs moves the feet by construction, and no
// amount of tuning the fold changes that.
//
// Standard analytic 2-bone solve: the law of cosines gives the angle between
// the thigh and the hip->ankle line, and a pole direction chooses which way the
// knee breaks -- which is also how the knees get to point outward for free.
const _ikHip = new THREE.Vector3();
const _ikKnee = new THREE.Vector3();
const _ikAnkle = new THREE.Vector3();
const _ikTo = new THREE.Vector3();
const _ikSide = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikCur = new THREE.Vector3();
const _ikQ = new THREE.Quaternion();
const _ikQW = new THREE.Quaternion();
const _ikQP = new THREE.Quaternion();

// aimBone gets its OWN scratch. It used to borrow _ikHip/_ikKnee, which
// solveLegIK is still holding when it calls in -- the same scratch-aliasing
// class of bug that once collapsed the trough ribbons onto their centreline.
const _aimA = new THREE.Vector3();
const _aimB = new THREE.Vector3();

/** Rotate `bone` so the vector from it to `childBone` points along `dirWorld`. */
function aimBone(bone, childBone, dirWorld) {
  bone.getWorldPosition(_aimA);
  childBone.getWorldPosition(_aimB);
  _ikCur.copy(_aimB).sub(_aimA);
  if (_ikCur.lengthSq() < 1e-8) return;
  _ikCur.normalize();
  _ikQ.setFromUnitVectors(_ikCur, dirWorld);
  bone.getWorldQuaternion(_ikQW);
  _ikQW.premultiply(_ikQ);                    // desired world orientation
  bone.parent.getWorldQuaternion(_ikQP).invert();
  bone.quaternion.copy(_ikQP.multiply(_ikQW)); // back into parent space
  bone.updateMatrixWorld(true);
}

const _ikCurPole = new THREE.Vector3();

/**
 * @param {THREE.Bone} upLeg thigh  @param {THREE.Bone} lowLeg shin
 * @param {THREE.Bone} foot ankle
 * @param {THREE.Vector3} targetWorld where the ankle must end up
 * @param {THREE.Vector3} poleWorld which way the knee should break at full blend
 * @param {number} poleBlend 0 = keep the knee exactly where the CLIP has it,
 *   1 = fully at poleWorld.
 *
 * THE POLE BLEND IS WHAT STOPS THE KNEE SNAPPING. IK is otherwise binary: the
 * frame it engages it places the knee wherever its own pole says, which is
 * nowhere near where the animation had it, so the knee jumped in a single frame
 * no matter how small the tuck weight was. Starting from the CLIP's own pole
 * and rotating outward as the tuck engages means the solve is an identity at
 * weight zero -- and, unlike blending the finished bone rotations, it keeps the
 * ankle exactly on target at every intermediate weight instead of half-planting
 * the foot.
 */
function solveLegIK(upLeg, lowLeg, foot, targetWorld, poleWorld, poleBlend) {
  upLeg.getWorldPosition(_ikHip);
  lowLeg.getWorldPosition(_ikKnee);
  foot.getWorldPosition(_ikAnkle);
  const L1 = _ikHip.distanceTo(_ikKnee);
  const L2 = _ikKnee.distanceTo(_ikAnkle);
  if (L1 < 1e-5 || L2 < 1e-5) return;

  _ikTo.copy(targetWorld).sub(_ikHip);
  let d = _ikTo.length();
  if (d < 1e-5) return;
  // Clamp inside the reachable annulus, leaving a margin so the leg never locks
  // dead straight (which would make the knee direction undefined) or folds to a
  // singularity.
  const dMin = Math.abs(L1 - L2) + 1e-3;
  const dMax = L1 + L2 - 1e-3;
  d = Math.max(dMin, Math.min(dMax, d));
  _ikTo.normalize();

  // The CLIP's own pole: where the animation currently has the knee, expressed
  // perpendicular to the hip->ankle line. This is the zero-blend anchor.
  _ikCurPole.copy(_ikKnee).sub(_ikHip);
  _ikCurPole.addScaledVector(_ikTo, -_ikCurPole.dot(_ikTo));
  if (_ikCurPole.lengthSq() > 1e-8) _ikCurPole.normalize();
  else _ikCurPole.copy(poleWorld);

  // Pole, projected perpendicular to the hip->ankle line: this is the plane the
  // knee breaks in, so pointing it outward splays the knees. Blended from the
  // clip's own pole so engaging the tuck rotates the knee out smoothly rather
  // than teleporting it.
  _ikSide.copy(_ikCurPole).lerp(poleWorld, Math.max(0, Math.min(1, poleBlend)));
  _ikSide.addScaledVector(_ikTo, -_ikSide.dot(_ikTo));
  if (_ikSide.lengthSq() < 1e-8) {
    // Pole parallel to the limb: pick any perpendicular rather than bailing.
    // Returning here would leave the leg UNSOLVED after the body has already
    // been lowered, which drops the foot straight through the deck.
    _ikSide.set(0, 0, 1).addScaledVector(_ikTo, -_ikTo.z);
    if (_ikSide.lengthSq() < 1e-8) _ikSide.set(1, 0, 0).addScaledVector(_ikTo, -_ikTo.x);
  }
  _ikSide.normalize();

  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const a = Math.acos(cosA);
  _ikDir.copy(_ikTo).multiplyScalar(Math.cos(a)).addScaledVector(_ikSide, Math.sin(a));
  aimBone(upLeg, lowLeg, _ikDir);

  // Shin: now simply aim the knee at the target.
  lowLeg.getWorldPosition(_ikKnee);
  _ikDir.copy(targetWorld).sub(_ikKnee);
  if (_ikDir.lengthSq() < 1e-8) return;
  aimBone(lowLeg, foot, _ikDir.normalize());
}

export function createRider(scene, camera) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);
  scene.add(root);

  // --- the board, shared by ALL modes -------------------------------------
  // Identical across modes so it never confounds the comparison, and it
  // demonstrates the build doc's §9.1 rule that things the rider physically
  // rides on are real geometry, not billboards.
  const board = new THREE.Group();
  // Deck and wheels, lifted off near-black for the dusk-neon palette. The deck
  // was 0x3b2f28 -- luminance 50 against a playfield at 46, so a broad flat
  // plank directly under the rider was rendering as a hole in the frame. Warm
  // maple reads as an actual skateboard and separates cleanly from the indigo
  // without borrowing a hue that already means something (cyan paint, green
  // rail, magenta boundary, violet launcher, yellow hazard).
  const deckMat = new THREE.MeshBasicMaterial({ color: 0xd9a86a });
  const wheelMat = new THREE.MeshBasicMaterial({ color: 0xfff0d8 });
  board.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 2.15), deckMat));
  for (const dx of [-0.26, 0.26]) {
    for (const dz of [-0.72, 0.72]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 8), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(dx, -0.11, dz);
      board.add(w);
    }
  }
  board.scale.setScalar(BOARD_SCALE);
  board.position.y = BOARD_Y;
  tilt.add(board);

  // --- mode A: flat sprite -------------------------------------------------
  const texLoader = new THREE.TextureLoader();
  const spriteTex = texLoader.load(riderSpriteUrl);
  spriteTex.colorSpace = THREE.SRGBColorSpace;
  const spriteMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(RIDER_HEIGHT * (254 / 512), RIDER_HEIGHT),
    new THREE.MeshBasicMaterial({
      map: spriteTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
    }),
  );
  spriteMesh.position.y = RIDER_HEIGHT * 0.5 + BOARD_Y;
  spriteMesh.visible = false;
  tilt.add(spriteMesh);

  // --- shared: normalize any loaded character to a known size/origin -------
  // Meshy has no guaranteed scale; Mixamo exports at 100x (centimetres). Fitting
  // by bounding box handles both without magic numbers that break whenever a
  // model is regenerated.
  function fitToRider(obj, faceAwayFromCamera, label = '') {
    const box = new THREE.Box3().setFromObject(obj);
    if (label && window.Unity === undefined) {
      const sz = new THREE.Vector3();
      box.getSize(sz);
      console.info(`[fit] ${label}: size=(${sz.x.toFixed(2)}, ${sz.y.toFixed(2)}, `
        + `${sz.z.toFixed(2)}) minY=${box.min.y.toFixed(2)} maxY=${box.max.y.toFixed(2)}`);
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = RIDER_HEIGHT / (size.y || 1);
    obj.scale.setScalar(scale);
    obj.position.set(
      -center.x * scale,
      -box.min.y * scale + BOARD_Y,
      -center.z * scale,
    );
    // Generated from a FRONT view, so the character faces +Z; the road runs
    // toward -Z, and the camera sits behind at +Z.
    if (faceAwayFromCamera) obj.rotation.y = Math.PI;
    return scale;
  }

  // --- mode B: static 3D model ---------------------------------------------

  // --- mode C: rigged + animated -------------------------------------------
  const rigHolder = new THREE.Group();
  rigHolder.visible = false;
  tilt.add(rigHolder);
  let rigLoaded = false;
  let mixer = null;
  // The loaded rig and its clips, kept so the AI field can clone the same
  // prefab instead of a second art path -- see rigPrefab() on the API below.
  const rimUniforms = [];
  let rigObject = null;
  const rigClips = {};
  const actions = {};
  let currentClip = null;
  const rigLitMats = [];
  const rigUnlitMats = [];
  let rigMeshes = [];
  // Foot bones, cached so the board can be pinned to them every frame.
  let footL = null;
  let footR = null;
  // Leg bones, cached for the procedural HOP tuck (see update()). Mixamo's
  // standard humanoid names: UpLeg = thigh, Leg = shin.
  let upLegL = null;
  let upLegR = null;
  let legL = null;
  let legR = null;
  // Arm bones, cached for the boardslide's spread-arms balance pose.
  let armL = null;
  let armR = null;
  let foreL = null;
  let foreR = null;
  // Spine chain, cached for the landing absorb's torso curl.
  let spine = null;
  let spine1 = null;
  let spine2 = null;
  // Seconds left on the "no kick-push" lock -- held at full while grinding,
  // then counting down afterwards (Amit: not during the glide "+ 1 second
  // afterwards").
  let pushLockT = 0;
  // Smoothed arm-balance signal, -1..1. Persisted across frames because it is
  // eased rather than recomputed: an arm that steps to a new angle in a single
  // frame reads as a glitch, not a correction.
  let balance = 0;
  // The deck's tilt-local height while riding normally, sampled live and used
  // as the reference the grind crouch is compensated against.
  //
  // It CANNOT be the authored BOARD_Y: the board is pinned to the animated foot
  // bones, so its real resting height is wherever the skate stance actually
  // puts the soles -- measured at ~0.343 against a BOARD_Y of 0.10. Referencing
  // the constant subtracted that 0.24 gap as if it were crouch, sinking the
  // whole rider through the rail on every grind. Sampling the live value
  // instead is also self-correcting if the rig or board scale ever changes.
  const restBoardLocal = new THREE.Vector3();
  let hasRestBoard = false;
  // Where each ankle sits when he is NOT tucking, in the rider root's frame.
  // These become the IK targets: the tuck drops the pelvis, and the legs solve
  // back to exactly these, so the boots never move on the deck.
  const restAnkleL = new THREE.Vector3();
  const restAnkleR = new THREE.Vector3();
  let hasRestAnkle = false;
  const _tgt = new THREE.Vector3();
  const _pole = new THREE.Vector3();
  const _poseNow = new THREE.Vector3();
  // Push is an OCCASIONAL ONE-SHOT layered over idle by weight (see update()).
  let pushing = false;
  let pushTimer = 2.5 + Math.random() * 2.5;
  let pushWeight = 0; // 0 = pure idle, 1 = pure push
  let pushDuration = 0;

  function loadRigTextures() {
    const base = texLoader.load(baseColorUrl);
    base.colorSpace = THREE.SRGBColorSpace;
    const normal = texLoader.load(normalUrl);
    const mr = texLoader.load(metalRoughUrl);
    // Mixamo strips materials but PRESERVES UVs, so the maps extracted from the
    // Meshy GLB still line up on the rigged mesh. This is the step that stops
    // the rigged character looking like the reference's grey plastic.
    //
    // Do NOT set flipY = false here. That is the glTF convention; FBXLoader
    // produces UVs that want three's DEFAULT flipY = true, and forcing false
    // scrambles the mapping into confetti.
    return { base, normal, mr };
  }

  const ready = Promise.all([
    /**
     * MODE B IS GONE, and with it rider.glb -- 2.7 MB, a quarter of the whole
     * bundle.
     *
     * It was the raw unrigged mesh, kept alongside the rigged one so the render
     * lab could show them side by side while we decided which to ship. That
     * decision was made -- the game ships MODE C -- and both were still being
     * downloaded and parsed on every single launch, because the loads fire at
     * init rather than per mode. So every player was paying 2.7 MB for a
     * comparison nobody was making any more.
     *
     * The mesh has not been deleted from the repo, only from the build: it is
     * one import away if the rig ever needs re-judging against it.
     */

    // mode C
    new Promise((resolve) => {
      new FBXLoader().load(riggedUrl, (obj) => {
        const { base, normal, mr } = loadRigTextures();
        obj.traverse((n) => {
          if (!n.isMesh) return;
          n.frustumCulled = false;
          rigMeshes.push(n);
          const lit = new THREE.MeshStandardMaterial({
            map: base, normalMap: normal, metalnessMap: mr, roughnessMap: mr,
            metalness: 0.35, roughness: 0.75,
          });
          const unlit = new THREE.MeshBasicMaterial({ map: base });
          // RIM LIGHT. Recolouring the hoodie scarlet fixed the character's HUE
          // separation from the indigo ground (87 -> 115 degrees) but actually
          // cost value contrast: red is darker than the green it replaced, so
          // the luminance gap fell from 63 to 44. Hue reads fine on a monitor;
          // on a dim board-mounted screen value is the more reliable cue, and
          // that is exactly where a character can get lost.
          //
          // A fresnel rim solves it independently of palette: a bright edge
          // wherever the surface turns away from the viewer, so the silhouette
          // separates from ANY background, including future ones. Injected into
          // MeshBasicMaterial rather than switching to a lit material, because
          // the whole art direction is unlit and a real light would flatten the
          // hand-painted texture.
          //
          // three only computes normals in the basic shader when USE_ENVMAP or
          // USE_SKINNING is defined -- this rig is skinned, so transformedNormal
          // is genuinely available here. It would NOT be on an unskinned mesh.
          unlit.onBeforeCompile = (shader) => {
            shader.uniforms.uRimColor = { value: new THREE.Color(RIM_COLOR) };
            // Remembered so setTheme() can move the rim without rebuilding the
            // material -- onBeforeCompile only runs once, on first compile.
            rimUniforms.push(shader.uniforms.uRimColor);
            shader.uniforms.uRimStrength = { value: RIM_STRENGTH };
            shader.uniforms.uRimPower = { value: RIM_POWER };
            shader.vertexShader = shader.vertexShader
              .replace('void main() {', 'varying vec3 vRimN;\nvarying vec3 vRimV;\nvoid main() {')
              .replace('#include <project_vertex>',
                '#include <project_vertex>\n\tvRimN = transformedNormal;\n\tvRimV = -mvPosition.xyz;');
            shader.fragmentShader = shader.fragmentShader
              .replace('void main() {',
                'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;\n'
                + 'varying vec3 vRimN;\nvarying vec3 vRimV;\nvoid main() {')
              .replace('#include <dithering_fragment>',
                '#include <dithering_fragment>\n'
                // abs() so back-facing normals rim too -- without it, whichever
                // side of him faces away from the camera loses its edge.
                + '\tfloat rim = pow(1.0 - abs(dot(normalize(vRimN), normalize(vRimV))), uRimPower);\n'
                + '\tgl_FragColor.rgb += uRimColor * rim * uRimStrength;');
          };
          rigLitMats.push(lit);
          rigUnlitMats.push(unlit);
          n.material = unlit;
        });

        fitToRider(obj, true, 'rigged');
        rigHolder.add(obj);
        rigObject = obj;

        mixer = new THREE.AnimationMixer(obj);

        const loadClip = (url, name) => new Promise((res) => {
          new FBXLoader().load(url, (anim) => {
            const clip = anim.animations[0];
            if (clip) {
              const n = stripRootMotion(clip, obj);
              clip.name = name;
              rigClips[name] = clip;
              const action = mixer.clipAction(clip);
              action.setLoop(THREE.LoopRepeat);
              actions[name] = action;
              if (window.Unity === undefined) {
                console.info(`[rig] clip "${name}": ${clip.duration.toFixed(2)}s, `
                  + `${clip.tracks.length} tracks, root-motion tracks pinned: ${n}`);
              }
            }
            res();
          }, undefined, () => res());
        });

        obj.traverse((n) => {
          if (!n.isBone) return;
          if (!footL && /LeftFoot$/.test(n.name)) footL = n;
          if (!footR && /RightFoot$/.test(n.name)) footR = n;
          // Order matters: "LeftUpLeg" also ends in "Leg", so the thigh test
          // has to run first and the shin test must exclude it explicitly.
          if (!upLegL && /LeftUpLeg$/.test(n.name)) upLegL = n;
          else if (!legL && /LeftLeg$/.test(n.name)) legL = n;
          if (!upLegR && /RightUpLeg$/.test(n.name)) upLegR = n;
          else if (!legR && /RightLeg$/.test(n.name)) legR = n;
          // Same ordering trap as the legs: "LeftForeArm" also ends in "Arm",
          // so the forearm has to be tested before the upper arm.
          if (!foreL && /LeftForeArm$/.test(n.name)) foreL = n;
          else if (!armL && /LeftArm$/.test(n.name)) armL = n;
          if (!foreR && /RightForeArm$/.test(n.name)) foreR = n;
          else if (!armR && /RightArm$/.test(n.name)) armR = n;
          // Ordering again: "Spine1"/"Spine2" would both match a loose /Spine/,
          // so the numbered ones are tested before the bare one.
          if (!spine1 && /Spine1$/.test(n.name)) spine1 = n;
          else if (!spine2 && /Spine2$/.test(n.name)) spine2 = n;
          else if (!spine && /Spine$/.test(n.name)) spine = n;
        });

        Promise.all([
          loadClip(clipIdleUrl, 'idle'),
          loadClip(clipPushUrl, 'push'),
        ]).then(() => {
          rigLoaded = true;

          // BOTH actions play permanently and loop; their WEIGHTS are what we
          // drive (see update()). This is deliberate, and it fixes a real bug:
          // the previous version used LoopOnce + crossFade + the mixer's
          // 'finished' event, and when the one-shot ended its weight dropped to
          // zero while idle was still faded out. With total weight at zero the
          // mixer falls back to the BIND POSE -- which for this rig is the
          // T-pose, so the kid flashed into a star shape mid-ride.
          //
          // Manual weights that always sum to 1 make that impossible by
          // construction, rather than relying on event timing to line up.
          for (const key of ['idle', 'push']) {
            const a = actions[key];
            if (!a) continue;
            a.setLoop(THREE.LoopRepeat, Infinity);
            a.enabled = true;
            a.play();
          }
          if (actions.idle) actions.idle.setEffectiveWeight(1);
          if (actions.push) {
            actions.push.setEffectiveWeight(0);
            pushDuration = actions.push.getClip().duration;
          }

          applyMode();
          resolve();
        });
      }, undefined, () => resolve());
    }),
  ]);

  /** Begin one push. No-op if one is already running. */
  function triggerPush() {
    if (!actions.push || pushing) return;
    pushing = true;
    actions.push.time = 0; // restart the clip from its first frame
  }

  let mode = 'sprite';
  let lit = false;

  function applyMode() {
    spriteMesh.visible = mode === 'sprite';
    rigHolder.visible = mode === 'rigged' && rigLoaded;
    applyLighting();
  }

  function applyLighting() {
    // Mode B: swap between the GLB's own PBR materials and an unlit view of the
    // same textures. The build doc claims unlit is correct for illustrated
    // surfaces (§9.1); for a PBR character that's genuinely untested, and this
    // toggle is how it gets checked rather than assumed.
    if (rigLoaded) {
      rigMeshes.forEach((n, i) => {
        n.material = lit ? rigLitMats[i] : rigUnlitMats[i];
      });
    }
  }

  return {
    /** The push clip's live blend weight, so a check can prove it stays at 0. */
    get pushWeightDebug() { return pushWeight; },
    root,
    ready,

    /**
     * The loaded rig and its clips, for anything that needs a SECOND character
     * on screen. Returns null until the FBX has loaded.
     *
     * Handing out the prefab rather than a second art path is what keeps the AI
     * field looking like the player instead of like a different game -- and it
     * means a change to the character is a change in one place. Callers are
     * expected to SkeletonUtils.clone() it; the object itself is the player's.
     */
    /**
     * Move the rim light for a theme. The rim exists so the character separates
     * from ANY background by value rather than by hue, so it has to follow the
     * background it is separating from -- an ice-blue rim on an ember-red world
     * is the one combination that would undo the whole point of it.
     */
    setTheme(theme) {
      for (const u of rimUniforms) u.value.setHex(theme.rim);
    },

    rigPrefab() {
      return rigObject ? { object: rigObject, clips: rigClips } : null;
    },

    setMode(next) {
      mode = next;
      applyMode();
    },

    setLit(next) {
      lit = next;
      applyLighting();
    },

    get rigAvailable() { return rigLoaded; },
    get clipNames() { return Object.keys(actions); },
    get debugPushWeight() { return pushWeight; }, // verifying the mid-air push-cancel fix

    /**
     * @param {{pos:THREE.Vector3, yaw:number, carve:number, tucking:number,
     *          airActive:boolean, airT:number,
     *          airTrick:('backflip'|'spin'|null), trickLandT:number}} s
     * @param {number} dt
     */
    update(s, dt) {
      root.position.copy(s.pos);
      // Stand the rider ON the trough surface: forward along the trough, up
      // along the surface normal. Built as an explicit basis so a rolled or
      // banked wall plants them properly instead of leaving them world-upright.
      if (s.surfaceUp && s.forward) {
        // Local +Z points BACKWARD along the trough: the character art faces its
        // own -Z (see the rotation.y = PI in the loaders), so this leaves it
        // facing down the trough.
        _rz.copy(s.forward).negate();
        _rup.copy(s.surfaceUp);
        _rx.crossVectors(_rup, _rz).normalize();
        _rbasis.makeBasis(_rx, _rup, _rz);
        root.quaternion.setFromRotationMatrix(_rbasis);
      }

      // Carve roll: the body banks into the turn. Identical signal in all modes.
      // (A side-flip's barrel roll is added onto this further down, once
      // rollExtra has been computed alongside the other trick rotations.)
      const roll = -s.carve * 0.42;
      // Tuck pitch. Note this is emergent from holding a straight line -- there
      // is no forward-lean input anywhere in this game (build doc §0).
      //
      // HIGH-JUMP whole-body rotation (backflip/spin) is layered on TOP of tuck
      // here rather than living on a separate group -- there is no dedicated
      // "flip" node in this hierarchy (removed earlier per Amit's direction that
      // the character shouldn't re-angle itself for ORDINARY tricks). Reusing
      // `tilt` for the new special-jump case is deliberate: everything that
      // needs to spin with the rider -- board, sprite, model, rig -- already
      // lives under `tilt`, and the board-planting code below works entirely in
      // `tilt`-local space, so it stays correct no matter how `tilt` is rotated.
      // Both terms are recomputed from scratch every frame (not accumulated),
      // so there's no residual spin left over once airTrick clears on landing.
      //
      // Rotation is synced 1:1 to airT (0->1 across the WHOLE jump), per
      // Amit's direct correction: an earlier pass rate-multiplied the rotation
      // and held it once complete, which finished the trick visibly before the
      // rider actually touched down. "Faster" now lives entirely in each
      // trick's own height/duration (main.js's beginAir) -- a shorter flight
      // over the same one full turn already reads as quicker, without
      // decoupling the spin from the landing.
      let pitchExtra = 0;
      let yawExtra = 0;
      let spinLean = 0;
      if (s.airActive && s.airTrick === 'backflip') {
        // POSITIVE, not negative -- the original sign rotated the character
        // forward-over (a front flip); Amit confirmed it needs to go backward.
        pitchExtra = s.airT * Math.PI * 2;
      }
      if (s.airActive && s.airTrick === 'spin') {
        // Signed by the drift direction captured at takeoff (main.js), so the
        // rotation continues the rider's own momentum instead of fighting it.
        // TURNS comes from the launch height, so a scrape off a bank and a
        // full-speed kicker air are visibly different moves rather than the same
        // one at two speeds. Always whole revolutions -- see SPIN_720_HEIGHT.
        const turns = s.spinTurns || 1;
        yawExtra = s.airT * Math.PI * 2 * turns * (s.spinDir || 1);
        // Thrown off vertical by the rotation, hardest in the middle of the arc
        // and back upright to land. sin() rather than a constant because a lean
        // still present at touchdown would put the board down on its edge; this
        // is exactly zero at both ends by construction.
        spinLean = Math.sin(s.airT * Math.PI) * SPIN_LEAN * turns * (s.spinDir || 1);
      }
      // HOP-OVER has NO whole-body rotation -- it's a leg tuck applied directly
      // to the rig's bones after the mixer runs (further down). The barrel roll
      // that used to live here "didn't make a lot of sense" and is gone.
      // Only a spin rolls the body now; the barrel roll that used to live here
      // "didn't make a lot of sense" and is gone.
      const rollExtra = spinLean;

      // The landing absorb used to live here as a pitch on `tilt`. It doesn't
      // any more: rotating this group tips the BOARD with it, and an impact is
      // a compression rather than a tilt. It's real bone work now -- knees and
      // spine, applied after the mixer further down.

      // BOARDSLIDE TWIST. The whole `tilt` group swings side-on to the rail, so
      // board, body and rig all turn together as one piece -- and because the
      // board-planting code below works purely in tilt-local space, it stays
      // correct however far tilt is yawed. Driven by the same eased 0..1 signal
      // as the rail-height lift, so the rider twists into the trick exactly as
      // he rises onto the rail and untwists as he settles off it.
      const grindPose = s.grindPose || 0;
      // Hoisted alongside grindPose: both the bone pose (inside the rigged
      // branch) and the board-planting compensation (outside it) read this.
      const landPose = s.landPose || 0;
      // Hoisted: the tuck IK applies this BEFORE solving, and the compensation
      // block at the very end must preserve it rather than zeroing it. Those
      // are the only two writers of tilt.position, and they previously fought --
      // the compensation reset the sink to 0 after the legs had already been
      // solved against it, which left the legs bent while the body came back
      // up and drove the FEET down through the deck.
      const tuckSink = (s.tucking || 0) * TUCK_SINK;
      const grindYaw = grindPose * GRIND_YAW * (s.grindYawSign || 1);

      // NO tucking term here any more. This used to pitch the whole rider group
      // forward as the tuck engaged -- which also dragged the BOARD with it,
      // since the deck lives under `tilt`. Amit: pressing forward should tilt
      // the board not at all. The tuck is a real pose now (spine curl plus knee
      // bend, further down), so this legacy whole-group lean is both redundant
      // and the thing that was tipping the deck. Measured: it was setting
      // tilt.rotation.x to 0.298 and dropping the nose by 0.44.
      tilt.rotation.x = pitchExtra;
      tilt.rotation.y = yawExtra + grindYaw;
      tilt.rotation.z = roll + rollExtra;

      if (mode === 'sprite') {
        // Billboard, then re-apply roll so the sprite still leans.
        spriteMesh.quaternion.copy(camera.quaternion);
        spriteMesh.rotateZ(roll * 0.5);
      }

      if (mode === 'rigged' && mixer) {
        // Drive the idle<->push blend by hand. The clip is left running the whole
        // time; only its weight moves, and idle always takes up the remainder, so
        // the summed weight is permanently 1 and the bind-pose/T-pose fallback
        // can never be reached.
        const FADE = 0.22; // seconds to blend either way
        // Push lockout: held at full for the whole glide, then draining
        // afterwards, so the clip is barred during the grind AND for a second
        // after it. Amit asked for the tail specifically -- a kick-push firing
        // the instant the rider drops off a rail reads as a stumble.
        // THE KICK-PUSH STANDS DOWN during every custom pose, not just grinds.
        // Amit: it should not play while any of these are happening. It is a
        // full-body clip that swings a leg off the deck, so it fights whatever
        // the procedural pose is doing -- and during a tuck or a brake it also
        // fights the leg IK, which is solving those same bones against planted
        // ankles.
        const customPose = s.grinding || s.airActive || (s.landPose || 0) > 0.001
          || (s.tucking || 0) > 0.02 || (s.braking || 0) > 0.02;
        if (customPose) pushLockT = GRIND_PUSH_LOCKOUT;
        else if (pushLockT > 0) pushLockT = Math.max(0, pushLockT - dt);

        // A landing absorb bars it too. Partly because kick-pushing while
        // soaking up an impact is nonsense, and partly mechanical: a push lifts
        // one foot clear of the deck, and the board is pinned to the FEET
        // during a pose, so a push overlapping an absorb dragged the deck off
        // its resting height (measured up to 0.067 of drift on exactly those
        // landings, versus ~0.002 on the clean ones).
        /**
         * `s.held` -- the ride is stopped on a start line and has not begun.
         *
         * The rider animates OUTSIDE the simulation gate, because the camera
         * still has to see a character while a menu or a countdown is up. That
         * is right for the idle pose and wrong for this one: during 3-2-1 the
         * kid was kick-pushing on the spot, which is the one thing that says
         * "already riding" while everything else says "not yet".
         *
         * Grouped with the airborne case rather than given its own branch,
         * because the requirement is identical -- do not show the push, and do
         * not merely fade it -- and a second branch doing the same thing is a
         * second place for it to drift.
         */
        if (s.held || s.airActive || pushLockT > 0 || landPose > 0.001) {
          // NEVER show the push (leg-kick) animation mid-air -- you can't
          // kick-push off a road that isn't under your foot. This used to be
          // gated only against STARTING a new push (`!s.airActive && !pushing`
          // below), which didn't stop a push already in progress: if a launch
          // happened mid-push, `pushing` stayed true and the weight kept
          // blending IN for the rest of the air, only unwinding near the
          // clip's own natural end. That's the "second animation clip playing
          // mid-air" bug. HARD cut, not an eased fade-out: main.js sets
          // airActive true in the very same frame a launch fires, before
          // rider.update() runs that frame, so zeroing instantly here means
          // the leg-kick pose is never rendered even for a single frame --
          // an eased decay (matching FADE's ~0.22s) measured up to 0.09
          // residual weight in the first couple of airborne frames, small but
          // not the "don't play it at all" Amit actually asked for.
          pushing = false;
          pushWeight = 0;
        } else {
          // PUSH IS OCCASIONAL, NOT CONTINUOUS. Looping it made the kid look
          // like he was kick-pushing nonstop. A real rider pushes once in a
          // while and otherwise just rides, so: fire it on a randomised
          // few-second timer.
          if (!pushing) {
            pushTimer -= dt;
            if (pushTimer <= 0) {
              triggerPush();
              pushTimer = 4.5 + Math.random() * 4.5;
            }
          }
          if (pushing) {
            // Start unwinding before the clip loops around, so the blend out is
            // finished by the time it would repeat.
            const nearEnd = pushDuration > 0
              && actions.push.time >= pushDuration - FADE;
            pushWeight = Math.min(1, pushWeight + dt / FADE);
            if (nearEnd) pushing = false;
          } else {
            pushWeight = Math.max(0, pushWeight - dt / FADE);
          }
        }
        if (actions.push) actions.push.setEffectiveWeight(pushWeight);
        if (actions.idle) actions.idle.setEffectiveWeight(1 - pushWeight);

        mixer.update(dt);

        // --- HOP-OVER leg tuck (procedural, layered ON TOP of the clips) -----
        //
        // Not true IK -- it's direct FK on the Mixamo leg chain, which gets the
        // read Amit described ("knees going up, feet and skateboard closer to
        // the torso, folding his legs while jumping over") without needing a
        // solver or any new animation.
        //
        // This MUST run after mixer.update(): the mixer writes absolute bone
        // rotations every frame from the clips, so anything applied before it
        // is simply overwritten. Adding to the post-mixer value layers the
        // tuck over whatever idle/push is doing instead of fighting it.
        //
        // The board follows for free -- it's pinned to the foot bones below, so
        // lifting the feet lifts the deck with them, exactly as a real hop does.
        // EVERY air gets a pose, not just the hop -- knees up a bit, arms down
        // to the sides. The hop is the same shape with a deeper fold, so the
        // two are combined with max() rather than layered: they drive the same
        // joints in the same direction, and summing them would double the tuck
        // on a hop.
        if (s.airActive && upLegL) {
          // Fold in and back out across the air: 0 at launch, peak at apex,
          // 0 by landing -- so the legs are fully extended again for touchdown,
          // and it hands straight over to the landing absorb with no jump.
          // TWO ENVELOPES, taken at their max. The sin peaks at the apex and
          // returns to zero by airT = 1, which is right for a jump that ENDS
          // there. It no longer always does: the flight is ballistic now, and
          // over a drop airT pins at 1 while the rider keeps falling, so on its
          // own this unwinds the pose to fully extended for the whole hang.
          // airHold does not unwind -- it holds until touchdown.
          const fold = Math.sin(Math.min(1, s.airT) * Math.PI);
          const hold = s.airHold || 0;
          const hopping = s.airTrick === 'hop';
          const grabbing = s.airTrick === 'grab';
          // max() rather than sum, for the same reason the hop uses it: these
          // all drive the same two joints in the same direction, and adding
          // them would double the fold.
          const hip = Math.max(fold * Math.max(AIR_TUCK_HIP,
            hopping ? HOP_HIP_FOLD : 0, grabbing ? GRAB_CROUCH_HIP : 0),
            hold * HOVER_FOLD_HIP);
          const knee = Math.max(fold * Math.max(AIR_TUCK_KNEE,
            hopping ? HOP_KNEE_FOLD : 0, grabbing ? GRAB_CROUCH_KNEE : 0),
            hold * HOVER_FOLD_KNEE);
          // Signs are opposed between the two joints: the thigh swings the knee
          // UP toward the chest, the shin folds the heel BACK under the thigh.
          upLegL.rotation.x -= hip;
          upLegR.rotation.x -= hip;
          if (legL) legL.rotation.x += knee;
          if (legR) legR.rotation.x += knee;

          // Arms in the air are handled by the ARM LIFT block below, not here:
          // they now go UP rather than down, and routing them through the same
          // abduction path as the balance lift is what keeps every arm pose
          // one-sided and free of the hand-into-hip clipping.
        }

        // --- HOVER SPREAD ----------------------------------------------------
        // Arms out to the sides, on the same MEASURED lateral axis the
        // boardslide uses (rotation.x on the upper arms, negative spreads both
        // -- see the boardslide block below for how that was probed). Borrowed
        // rather than re-derived, so the two poses cannot disagree about which
        // way "out" is.
        //
        // A different axis from the jump's hands-high abduction, deliberately.
        // That is what makes the hover read as its own pose instead of as more
        // of the pose that is already playing, which is exactly what went wrong
        // the first time.
        if ((s.airHold || 0) > 0.001 && armL) {
          const spread = s.airHold * HOVER_ARM_SPREAD;
          const elbow = s.airHold * HOVER_ELBOW_OPEN;
          armL.rotation.x -= spread;
          armR.rotation.x -= spread;
          if (foreL) foreL.rotation.x -= elbow;
          if (foreR) foreR.rotation.x -= elbow;
        }

        // --- HOVER lean ------------------------------------------------------
        // A little of the torso trailing the board while the ground falls away.
        // Negative on this chain leans him BACK -- the same measured direction
        // the brake pose uses, borrowed rather than re-derived so the two agree
        // about which way back is.
        //
        // Small on purpose. The wide arms and the held tuck do the work of
        // reading as airborne; this only has to stop the body looking bolted
        // upright while the hill drops out from under it. Past about 0.2 it
        // starts reading as a lean-back trick of its own.
        if ((s.airHold || 0) > 0.001) {
          const lean = s.airHold * HOVER_LEAN;
          if (spine) spine.rotation.x -= lean * 0.5;
          if (spine1) spine1.rotation.x -= lean * 0.32;
          if (spine2) spine2.rotation.x -= lean * 0.18;
        }

        // --- TUCK / BRAKE pose (procedural, layered ON TOP of the clips) -----
        //
        // Forward: torso down and forward over the board with a little knee
        // bend -- the aerodynamic crouch that is now what actually earns speed.
        // Back: stand up and lean away as the tail drags.
        //
        // Deliberately two separate poses rather than one signed value: they
        // are not mirror images. A tuck curls the spine forward and bends the
        // knees; a brake straightens up and leans back without the knee bend,
        // because you are weighting the tail, not crouching.
        {
          const tk = s.tucking || 0;
          const bk = s.braking || 0;
          if (tk > 0.001) {
            const curl = tk * TUCK_SPINE;
            if (spine) spine.rotation.x += curl * 0.5;
            if (spine1) spine1.rotation.x += curl * 0.32;
            if (spine2) spine2.rotation.x += curl * 0.18;
            // NO FK leg fold here. Folding the legs forward-kinematically moves
            // the FEET -- the hips are the root of the chain -- which slid the
            // boots around on the deck. The legs are solved with IK further
            // down instead, against planted foot targets.
          }
          if (bk > 0.001) {
            // Negative on the same chain leans him BACK -- measured direction,
            // the inverse of the forward fold.
            const lean = bk * BRAKE_SPINE;
            if (spine) spine.rotation.x -= lean * 0.55;
            if (spine1) spine1.rotation.x -= lean * 0.30;
          }
        }

        // --- ARM BALANCE (procedural, layered ON TOP of the clips) -----------
        //
        // The rider's arms otherwise do nothing but replay the idle loop, which
        // is what makes him read as a puppet riding on rails. This gives them
        // the physics to react to.
        //
        // Two inputs, deliberately not one: CARVE is what he's asking for, and
        // LATERAL is what the trough is actually doing to him. The pendulum
        // lets those disagree -- carving one way while still drifting the other
        // -- and that disagreement is exactly the moment a real rider throws an
        // arm out. Summing them means the arms are busiest when he's fighting
        // the board rather than merely turning.
        //
        // Only rotation.x is used: it measured as the one strong lever on both
        // chains (0.42 of hand travel at 1.2 rad, against 0.11 for y), and it
        // is the only one that behaves the same on both arms -- z swings the
        // left hand forward and the right hand backward.
        {
          const want = Math.max(-1, Math.min(1,
            (s.carve || 0) * BALANCE_CARVE
            + ((s.lateral || 0) / BALANCE_LATERAL_REF) * BALANCE_LATERAL));
          balance += (want - balance) * (1 - Math.exp(-BALANCE_SMOOTH * dt));
        }
        // (the lift itself is applied at the very end -- see ARM LIFT below)

        // --- BOARDSLIDE pose (procedural, layered ON TOP of the clips) -------
        //
        // Same technique and the same post-mixer requirement as the hop tuck:
        // the mixer writes absolute bone rotations from the clips every frame,
        // so this has to run after it to layer rather than be overwritten.
        //
        // Arms: spread wide for balance. The axis and sign are MEASURED, not
        // assumed -- probing each local axis of the upper arms and reading the
        // hand's displacement in the rider's own frame showed rotation.x is the
        // lateral one, and the same negative sign spreads BOTH arms even though
        // the idle holds them asymmetrically (lead arm forward, trailing arm
        // out). The forearms continue the same direction, straightening the
        // arms out into the spread instead of leaving them bent.
        if (grindPose > 0.001 && armL) {
          const spread = grindPose * GRIND_ARM_SPREAD;
          const elbow = grindPose * GRIND_ELBOW_OPEN;
          armL.rotation.x -= spread;
          armR.rotation.x -= spread;
          if (foreL) foreL.rotation.x -= elbow;
          if (foreR) foreR.rotation.x -= elbow;
        }
        // Knees: bend into a crouch. Note the sign on the thigh is OPPOSITE to
        // the hop's -- the hop drives the knees up toward the chest, a crouch
        // sinks the hips down over feet that stay put. FK alone can't express
        // that (it moves the feet, not the hips), which is what the tilt-height
        // compensation further down exists to fix.
        //
        // The grind crouch and the landing absorb are THE SAME physical pose,
        // so they take the larger of the two rather than summing. They do
        // overlap in practice -- landing a backflip straight onto a rail fires
        // both, and stacking them folded the rider to 0.067 of hip-above-board
        // against a 0.63 rest stance: a cartoon squat, not an absorb.
        const crouchHip = Math.max(grindPose * GRIND_HIP_BEND, landPose * LAND_HIP_BEND);
        const crouchKnee = Math.max(grindPose * GRIND_KNEE_BEND, landPose * LAND_KNEE_BEND);
        if (crouchHip > 0.001 && upLegL) {
          upLegL.rotation.x -= crouchHip;
          upLegR.rotation.x -= crouchHip;
          if (legL) legL.rotation.x += crouchKnee;
          if (legR) legR.rotation.x += crouchKnee;
        }

        // --- LANDING ABSORB (procedural, layered ON TOP of the clips) --------
        //
        // "Every time the character lands and touches ground, a small bending
        // down -- torso goes down, knees bend -- to sell the impact."
        //
        // Knees use the same thigh/shin pairing as the grind crouch, and for
        // the same measured reason: the two joints oppose each other, and the
        // shin term has to be carried past the thigh term before the leg closes
        // at all. Spine curls forward on top, which is the part that actually
        // reads as absorbing rather than just squatting -- MEASURED as
        // +rotation.x moving the head down and forward, weighted down the chain
        // (Spine strongest, Spine2 least) so the back curls instead of hinging.
        //
        // The board stays planted through all of it via the same tilt-height
        // compensation the crouch uses -- so the body drops onto a deck that
        // doesn't move, which is what an impact looks like.
        // Legs are handled with the grind crouch above (same pose, max'd);
        // the spine curl is the landing's own, and is what actually reads as
        // absorbing rather than merely squatting.
        if (landPose > 0.001) {
          const curl = (s.landCurl || 0) * LAND_SPINE_CURL;
          if (spine) spine.rotation.x += curl * 0.5;
          if (spine1) spine1.rotation.x += curl * 0.32;
          if (spine2) spine2.rotation.x += curl * 0.18;
        }

        // --- ARM LIFT (applied last, on top of every other arm pose) --------
        //
        // ONE-SIDED BY CONSTRUCTION: both lifts are >= 0, so the arms can only
        // ever rise away from the animated idle pose, never be driven toward
        // the body. That is the fix for the hands clipping into the hip -- the
        // previous version tilted the arm line, and whichever arm went DOWN
        // pushed its hand through the torso.
        //
        // Rotated about the PARENT-space X axis rather than the bone's own
        // Euler angles. Measured, because it is not obvious: this rig's arm
        // bones are near-degenerate in their local frame -- both local x and
        // local z drag the hand inward AND up together, so no combination of
        // them abducts cleanly. A negative rotation about parent X does, and
        // does it for BOTH arms with the same sign:
        //     left  -0.135 outward, +0.101 up
        //     right +0.201 outward, +0.088 up
        if (armL && armR) {
          const mag = Math.abs(balance);
          // BASE lifts both (a person off-balance raises both arms); ASYM adds
          // more to the arm on the high side of the lean, so it reads as a
          // correction rather than a symmetric shrug.
          let liftL = BALANCE_LIFT_BASE * mag + BALANCE_LIFT_ASYM * Math.max(0, balance);
          let liftR = BALANCE_LIFT_BASE * mag + BALANCE_LIFT_ASYM * Math.max(0, -balance);

          // JUMPS: hands high, on every air and straight through the landing.
          // Same envelope as the leg tuck -- 0 at launch, peak at the apex, 0
          // by touchdown -- so it hands over to the landing absorb with no step.
          if (s.airActive) {
            // The hover does NOT go through here. This path is abduction --
            // hands high -- and it already spends 0.98 at the apex against a
            // 2.0 cap that balance lift is also drawing on. A hover routed
            // through it was never the larger of the two and showed nothing.
            // It spreads the arms LATERALLY instead; see the HOVER SPREAD block.
            const airFold = Math.sin(Math.min(1, s.airT) * Math.PI);
            const a = airFold * AIR_ARM_LIFT;
            liftL += a; liftR += a;
          }
          // The absorb keeps them up as he compresses, rather than dropping
          // them the instant he touches down. Driven by the bare envelope, NOT
          // the amount-scaled one: the crouch and spine curl should be heavier
          // after a backflip than after an ollie, but the hands go high on
          // every landing regardless -- amount-scaling gave a plain jump a
          // 0.07 rise where a backflip got far more.
          const land = (s.landEnv || 0) * LAND_ARM_LIFT;
          liftL += land; liftR += land;

          // Cap the SUM. Each source is reasonable alone, but a jump landing
          // mid-carve stacks them, and past ~2.1 the arm swings over vertical
          // and the hand starts coming back in toward the body -- which is the
          // clipping this whole approach exists to avoid.
          liftL = Math.min(liftL, ARM_LIFT_MAX);
          liftR = Math.min(liftR, ARM_LIFT_MAX);

          // TUCK: hands reach out in FRONT of the body. Parent Y, mirrored --
          // left negative and right positive each carry the hand forward.
          // Applied alongside the abduction rather than instead of it, so
          // tucking through a carve still counter-balances.
          const fwd = (s.tucking || 0) * TUCK_ARM_FORWARD;
          if (fwd > 0.001) {
            armL.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(0, 1, 0), -fwd));
            armR.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(0, 1, 0), fwd));
            // ELBOWS FOLD so the forearms point ahead down the lane, rather
            // than the arms reaching forward straight. Separate axis per arm --
            // measured, these chains are not mirror images: the left carries
            // the hand forward on parent -X and the right on parent -Z, and a
            // shared axis sends one of them backwards.
            const fold = (s.tucking || 0) * TUCK_ELBOW_FOLD;
            if (foreL) foreL.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -fold));
            if (foreR) foreR.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(0, 0, 1), -fold));
          }
          // THE GRAB. One arm to the sky, one down to the board -- and the
          // reaching arm is the whole reason this needs its own path. Every
          // other arm pose in this file only ever abducts (negative parent X,
          // hand away from the body), because that is the one direction the
          // hand cannot clip through the torso. Reaching DOWN is the forbidden
          // direction, so it is done in three parts that keep the hand outside
          // the hip the whole way: swing CLEAR of the body first, carry it
          // FORWARD over the deck, and only then fold the ELBOW to drop the
          // hand. The upper arm never has to point down through the ribs.
          const grabEnv = (s.airActive && s.airTrick === 'grab')
            ? Math.sin(Math.min(1, s.airT) * Math.PI) : 0;
          if (grabEnv > 0.001) {
            // Reaching arm: parent +Z on BOTH the upper arm and the forearm.
            // Measured as the only combination that takes the hand down and
            // AWAY from the torso at the same time -- every other axis either
            // lifts it or drags it through the ribs. See constants.js.
            armR.quaternion.premultiply(
              _q.setFromAxisAngle(_ax.set(0, 0, 1), grabEnv * GRAB_REACH_ARM));
            if (foreR) {
              foreR.quaternion.premultiply(
                _q.setFromAxisAngle(_ax.set(0, 0, 1), grabEnv * GRAB_REACH_ELBOW));
            }
            // Sky arm goes through the EXISTING abduction path rather than a
            // new axis of its own. A static probe suggested parent -Y raised the
            // hand further, but in play it measured level with the hips: that
            // probe was taken on a frozen frame, and it did not account for the
            // clip the mixer is still driving underneath. The abduction path is
            // the one that demonstrably lifts a hand every jump, so the grab
            // borrows it and just pushes it harder.
            liftL = Math.min(ARM_LIFT_MAX, Math.max(liftL, grabEnv * GRAB_SKY_ARM));
            // The reaching arm is posed above; no abduction on top of it.
            liftR = 0;
          }

          if (liftL > 0.001) {
            armL.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -liftL));
          }
          if (liftR > 0.001) {
            armR.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -liftR));
          }
        }

        // --- TUCK: DROP THE PELVIS, KEEP THE FEET PLANTED --------------------
        //
        // The sink is applied to the whole body and the legs are then solved
        // back onto the ankles' resting positions. Doing it this way round --
        // rather than folding the legs and hoping the feet land right -- is
        // what makes "the feet do not move" true by construction instead of by
        // tuning.
        {
          const tk = s.tucking || 0;
          if (tk > 0.001 && hasRestAnkle && upLegL && legL && footL) {
            // Lower the body. Everything, feet included, moves down with it...
            tilt.position.y = -tuckSink;
            tilt.updateMatrixWorld(true);
            // ...and the IK then puts the ankles back exactly where they were.
            const q = root.getWorldQuaternion(_q);
            const splay = tk * TUCK_KNEE_SPLAY;
            // Pole points outward and slightly forward, so the knees break out
            // to the sides rather than straight ahead.
            // Pole sign is per-leg and MEASURED, not assumed: a shared
            // convention broke the right knee inward (-0.095) while the left
            // went correctly outward (+0.077).
            // Blend the TARGET from wherever the clip currently has the ankle
            // toward its resting position. This is the second discontinuity:
            // the idle clip keeps moving the feet, so a target captured earlier
            // is NOT where the foot is when the IK engages, and snapping it
            // there jerked the whole leg. Lerping means the solve is an
            // identity at zero weight and fully planted at one.
            for (const [up, low, ft, rest, sgn] of [
              [upLegL, legL, footL, restAnkleL, -1],
              // MIRRORED. A shared sign swings BOTH knees the same way -- the
              // left by -0.221 and the right by -0.304 -- which is the two legs
              // clamping into each other rather than splaying apart. Note this
              // was invisible to an |x| metric: he rides a SKATE STANCE, feet
              // separated along the board rather than left-and-right, so both
              // knees sit at positive x when calm (+0.031 and +0.211) and
              // "moved outward" cannot be read from magnitude alone.
              [upLegR, legR, footR, restAnkleR, 1],
            ]) {
              _tgt.copy(rest);
              root.localToWorld(_tgt);
              ft.getWorldPosition(_poseNow);
              _tgt.lerpVectors(_poseNow, _tgt, tk);
              // The left leg's lateral component is scaled down: it responds
              // far more strongly than the right, and unscaled it swung the
              // knee out to the side instead of pointing down the lane.
              const lat = sgn * splay * (sgn < 0 ? TUCK_SPLAY_LEFT_SCALE : 1);
              _pole.set(lat, 0, -1).normalize().applyQuaternion(q);
              solveLegIK(up, low, ft, _tgt, _pole, tk);
            }
          } else if (hasRestAnkle === false && footL && footR) {
            // nothing to solve against yet
          }
        }

        // PIN THE BOARD TO THE FEET. Previously the board sat at a fixed height
        // and the rider was placed by his BIND-pose bounding box, so in an
        // animated pose his soles floated off the deck -- most visible mid-jump
        // and through carves. Deriving the board's position from the actual foot
        // bones each frame means the gap cannot exist in any pose.
        if (footL && footR) {
          footL.getWorldPosition(_fa);
          footR.getWorldPosition(_fb);
          tilt.worldToLocal(_fa);
          tilt.worldToLocal(_fb);
          // Height comes from the HIGHER foot, which is the one still standing on
          // the deck. This matters specifically because of the push animation:
          // during a push one foot leaves the board and reaches down to the road,
          // so following the LOWER foot dragged the board down to the tarmac and
          // left the standing foot visibly hovering (measured up to +6cm --
          // exactly the gap that showed up while riding).
          //
          // While both feet are on the deck the two are within a few mm, so this
          // costs nothing in the normal case.
          //
          // X/Z stay the midpoint so the deck sits centred under the stance --
          // except during a push, where the reaching foot would drag it sideways,
          // so the standing foot alone drives that too.
          const spread = Math.abs(_fa.y - _fb.y);
          // While a push is in progress the board must NOT be re-derived: the
          // standing foot is planted on a board that isn't moving, and the other
          // foot is off it entirely. Re-solving mid-push (including during the
          // crossfade in and out) made the deck twitch by a few cm. So the board
          // only tracks the feet while both are actually on it, and holds its
          // last good local position otherwise.
          //
          // Threshold is deliberately loose (0.08, not 0.12) so the crossfade
          // frames either side of the push are caught too.
          //
          // A HOP is the exception, and has to be handled explicitly: the tuck
          // folds BOTH legs, but the skate stance is staggered so the two feet
          // travel by different amounts -- spread grew to 0.325 and tripped
          // this guard on 75% of hop frames, freezing the deck on the ground
          // while the rider's feet climbed away from it. During a hop both feet
          // genuinely are on the board, so it should track them: use the
          // MIDPOINT height (not the higher foot, which would hang the deck off
          // one boot) and skip the guard entirely.
          // A GRIND CROUCH trips this guard for exactly the same reason a hop
          // does: bending both knees in a staggered stance moves the two feet
          // by different amounts, so `spread` grows past the threshold and the
          // deck would freeze at its last pre-crouch spot while the rider sank
          // away from it. Both feet really are on the board through a grind, so
          // it takes the same midpoint treatment.
          // The LANDING ABSORB joins the same club as the grind crouch here:
          // it folds both legs, the staggered stance moves the two feet by
          // different amounts, and `spread` grows past the guard -- which would
          // freeze the deck mid-air while the rider compressed away from it.
          // Any airborne pose folds both legs, and the staggered stance moves
          // the two feet unequally -- which trips the spread guard below and
          // freezes the deck away from the boots. That was already true of the
          // hop; now that EVERY air is posed, it's true of every air.
          const posing = s.airActive || grindPose > 0.001 || landPose > 0.001
            || (s.tucking || 0) > 0.001;
          // (tucking is in `posing` so the REST targets stop updating while
          // tucked -- otherwise they would chase the sink and cancel it.)
          if (posing) {
            board.position.set(
              (_fa.x + _fb.x) * 0.5,
              (_fa.y + _fb.y) * 0.5 - BOARD_DROP,
              (_fa.z + _fb.z) * 0.5,
            );
          } else if (spread <= 0.08) {
            const standing = _fa.y >= _fb.y ? _fa : _fb;
            board.position.set(
              (_fa.x + _fb.x) * 0.5,
              standing.y - BOARD_DROP,
              (_fa.z + _fb.z) * 0.5,
            );
          }
          // Keep the crouch's reference height current, but only from frames
          // where no pose is deforming the legs -- otherwise the reference
          // would chase the crouch and cancel itself out.
          if (!posing) {
            restBoardLocal.copy(board.position);
            hasRestBoard = true;
            // Ankle rest targets, in the rider root's frame so they travel with
            // him down the trough.
            restAnkleL.copy(root.worldToLocal(footL.getWorldPosition(_tgt)));
            restAnkleR.copy(root.worldToLocal(footR.getWorldPosition(_tgt)));
            hasRestAnkle = true;
          }
        }
      } else {
        // Other modes keep the board at its neutral spot under the rider.
        board.position.set(0, BOARD_Y, 0);
      }

      // TAIL DRAG: nose UP, tail down, so the deck visibly rides on its back
      // edge rather than sliding flat. Sign is POSITIVE -- the deck's tail is
      // at local +Z (the rider faces -Z), and a positive x-rotation drops that
      // end and lifts the nose. The first version had this inverted and pitched
      // the nose down into the ground, which is the opposite of a tail drag.
      board.rotation.x = (s.braking || 0) * BRAKE_BOARD_PITCH;

      // CROUCH COMPENSATION -- the piece that turns an FK leg-fold into a
      // believable crouch. Folding the legs is a forward-kinematic operation:
      // the hips are the root of the chain, so the feet (and the board pinned
      // to them) rise toward a stationary pelvis. Left alone that reads as the
      // rider tucking his board UP off the rail, the exact opposite of sinking
      // onto it.
      //
      // The fix needs no reference pose or extra measurement, because the
      // board-planting code above has already solved where the deck ended up
      // for the ACTUAL folded pose. Pushing `tilt` down by however far the deck
      // drifted from its neutral height puts the board back on the rail and
      // carries the hips down with it -- feet planted, body sinking, which is
      // what a crouch is. Self-correcting for any bend amount.
      //
      // Restricted to the grind: a hop's board SHOULD leave the ground. Held at
      // 0 until a rest sample exists, so the very first frames can't lurch.
      // Applies to the grind crouch AND the landing absorb -- both sink the
      // body over a board that must stay put. NOT the hop, whose board should
      // genuinely leave the ground.
      //
      // Done in ROOT space, not tilt-local. Cancelling the raw local-Y change
      // is only correct while `tilt` is unrotated, and it never is -- carve
      // rolls it and the tuck pitches it, so the deck's local X and Z leak into
      // world height and the cancellation comes up short. Measured: the board
      // floated 0.11-0.14 above its resting height through every absorb, which
      // is exactly the "feet and board riding up near his waist" look.
      //
      // Rotating BOTH the current and the rest local positions by the same
      // live quaternion isolates the pose's own contribution under whatever
      // rotation is in effect this frame, and leaves ordinary carve-roll
      // movement of the deck alone.
      // The TUCK joins the grind crouch and landing absorb here. Amit: the feet
      // must stay exactly where they are in the idle pose. Folding the legs is
      // forward-kinematic, so without this the feet rise toward stationary hips
      // and drag the board with them; cancelling the deck's movement pins the
      // feet in world space and sends the hips DOWN instead, which is the tuck.
      // NOTE the tuck is deliberately absent here. The grind crouch and landing
      // absorb still fold their legs with FK and need the deck movement
      // cancelled; the tuck solves its legs with IK against planted ankles, so
      // its feet -- and therefore its board -- already do not move. Running it
      // through this as well would compensate a displacement that isn't there.
      if ((grindPose > 0.001 || landPose > 0.001) && hasRestBoard) {
        // ALL THREE AXES, not just height. Amit: "the skateboard should be firm
        // on the ground, not moving at all." Cancelling only the vertical left
        // the deck's local x/z still tracking the feet, and folding the legs
        // swings them forward -- so the board slid along the ground even though
        // it held its height. Solving the whole vector pins it outright:
        //
        //   board_root = tilt.position + R * board.position   (want: R * rest)
        //   => tilt.position = R * (rest - board.position)
        //
        // The body then takes up the entire difference, which is exactly the
        // read being asked for -- hips drop and shift back over a board that
        // does not move at all.
        tilt.position.copy(restBoardLocal).sub(board.position)
          .applyQuaternion(tilt.quaternion);
        tilt.position.y -= tuckSink; // keep the tuck's drop on top
      } else {
        tilt.position.set(0, -tuckSink, 0);
      }
    },

    /**
     * World-space contact patch at the TAIL of the board, where the brake
     * sparks are struck. Distinct from contactPoint(): a grind sparks under the
     * middle of the deck, a tail drag sparks off its back edge.
     */
    tailPoint(out) {
      board.getWorldPosition(out);
      const q = board.getWorldQuaternion(_q);
      // Local +Z is the deck's tail (the rider faces local -Z), and down a
      // little so it sits on the scraping edge rather than inside the plank.
      _cu.set(0, 0, 1).applyQuaternion(q);
      out.addScaledVector(_cu, DECK_HALF_THICKNESS * 14);
      _cu.set(0, 1, 0).applyQuaternion(q);
      out.addScaledVector(_cu, -DECK_HALF_THICKNESS * 2.2);
      return out;
    },

    /**
     * World-space contact patch under the board, where sparks are struck.
     * Read after update() -- it depends on this frame's board placement.
     */
    contactPoint(out) {
      board.getWorldPosition(out);
      // Down to the deck's underside rather than its centre, so the shower
      // comes off the rail line instead of out of the middle of the plank.
      _cu.set(0, 1, 0).applyQuaternion(tilt.getWorldQuaternion(_q));
      out.addScaledVector(_cu, -DECK_HALF_THICKNESS * 2.2);
      return out;
    },
  };
}
