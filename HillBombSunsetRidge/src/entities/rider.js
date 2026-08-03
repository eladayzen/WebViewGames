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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import riderSpriteUrl from '../assets/rider_sprite.png?url';
import riderModelUrl from '../assets/rider.glb?url';
import riggedUrl from '../assets/rig/rider_rigged.fbx?url';
import clipIdleUrl from '../assets/rig/clip_idle.fbx?url';
import clipPushUrl from '../assets/rig/clip_push.fbx?url';
import baseColorUrl from '../assets/rig/rider_basecolor.jpg?url';
import normalUrl from '../assets/rig/rider_normal.jpg?url';
import metalRoughUrl from '../assets/rig/rider_metalrough.jpg?url';
import {
  TRICK_LAND_SETTLE_DURATION, TRICK_LAND_SETTLE_AMOUNT,
  HOP_HIP_FOLD, HOP_KNEE_FOLD,
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
  const deckMat = new THREE.MeshBasicMaterial({ color: 0x3b2f28 });
  const wheelMat = new THREE.MeshBasicMaterial({ color: 0xe8d9c0 });
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
  const modelHolder = new THREE.Group();
  modelHolder.visible = false;
  tilt.add(modelHolder);
  let modelLoaded = false;
  const staticOriginalMats = new Map();

  // --- mode C: rigged + animated -------------------------------------------
  const rigHolder = new THREE.Group();
  rigHolder.visible = false;
  tilt.add(rigHolder);
  let rigLoaded = false;
  let mixer = null;
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
    // mode B
    new Promise((resolve) => {
      new GLTFLoader().load(riderModelUrl, (gltf) => {
        const obj = gltf.scene;
        fitToRider(obj, true, 'static');
        obj.traverse((n) => {
          if (n.isMesh) {
            n.frustumCulled = false;
            staticOriginalMats.set(n, n.material);
          }
        });
        modelHolder.add(obj);
        modelLoaded = true;
        applyMode();
        resolve();
      }, undefined, () => resolve());
    }),

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
          rigLitMats.push(lit);
          rigUnlitMats.push(unlit);
          n.material = unlit;
        });

        fitToRider(obj, true, 'rigged');
        rigHolder.add(obj);

        mixer = new THREE.AnimationMixer(obj);

        const loadClip = (url, name) => new Promise((res) => {
          new FBXLoader().load(url, (anim) => {
            const clip = anim.animations[0];
            if (clip) {
              const n = stripRootMotion(clip, obj);
              clip.name = name;
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
    modelHolder.visible = mode === 'model' && modelLoaded;
    rigHolder.visible = mode === 'rigged' && rigLoaded;
    applyLighting();
  }

  function applyLighting() {
    // Mode B: swap between the GLB's own PBR materials and an unlit view of the
    // same textures. The build doc claims unlit is correct for illustrated
    // surfaces (§9.1); for a PBR character that's genuinely untested, and this
    // toggle is how it gets checked rather than assumed.
    if (modelLoaded) {
      modelHolder.traverse((n) => {
        if (!n.isMesh) return;
        const orig = staticOriginalMats.get(n);
        if (!orig) return;
        if (lit) {
          n.material = orig;
        } else {
          if (!n.userData.unlitMat) {
            n.userData.unlitMat = new THREE.MeshBasicMaterial({
              map: orig.map || null,
              color: orig.color ? orig.color.clone() : 0xffffff,
            });
          }
          n.material = n.userData.unlitMat;
        }
      });
    }
    if (rigLoaded) {
      rigMeshes.forEach((n, i) => {
        n.material = lit ? rigLitMats[i] : rigUnlitMats[i];
      });
    }
  }

  return {
    root,
    ready,

    setMode(next) {
      mode = next;
      applyMode();
    },

    setLit(next) {
      lit = next;
      applyLighting();
    },

    get modelAvailable() { return modelLoaded; },
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
      if (s.airActive && s.airTrick === 'backflip') {
        // POSITIVE, not negative -- the original sign rotated the character
        // forward-over (a front flip); Amit confirmed it needs to go backward.
        pitchExtra = s.airT * Math.PI * 2;
      }
      if (s.airActive && s.airTrick === 'spin') {
        yawExtra = s.airT * Math.PI * 2;
      }
      // HOP-OVER has NO whole-body rotation -- it's a leg tuck applied directly
      // to the rig's bones after the mixer runs (further down). The barrel roll
      // that used to live here "didn't make a lot of sense" and is gone.
      const rollExtra = 0;

      // Landing settle: a brief absorb-and-recover dip right after a TRICK
      // lands (main.js only starts this timer when airTrick was set), easing
      // from full amount at the instant of landing down to nothing -- a
      // little knee-bend read, not present on an ordinary jump.
      let settleExtra = 0;
      if (s.trickLandT > 0) {
        const settleProgress = 1 - s.trickLandT / TRICK_LAND_SETTLE_DURATION;
        settleExtra = Math.cos(settleProgress * Math.PI * 0.5) * TRICK_LAND_SETTLE_AMOUNT;
      }

      tilt.rotation.x = s.tucking * 0.30 + pitchExtra + settleExtra;
      tilt.rotation.y = yawExtra;
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
        if (s.airActive) {
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
        if (s.airTrick === 'hop' && s.airActive && upLegL) {
          // Fold in and back out across the air: 0 at launch, peak at apex,
          // 0 by landing -- so the legs are fully extended again for touchdown.
          const fold = Math.sin(Math.min(1, s.airT) * Math.PI);
          const hip = fold * HOP_HIP_FOLD;
          const knee = fold * HOP_KNEE_FOLD;
          // Signs are opposed between the two joints: the thigh swings the knee
          // UP toward the chest, the shin folds the heel BACK under the thigh.
          upLegL.rotation.x -= hip;
          upLegR.rotation.x -= hip;
          if (legL) legL.rotation.x += knee;
          if (legR) legR.rotation.x += knee;
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
          const hopping = s.airTrick === 'hop' && s.airActive;
          if (hopping) {
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
        }
      } else {
        // Other modes keep the board at its neutral spot under the rider.
        board.position.set(0, BOARD_Y, 0);
      }
    },
  };
}
