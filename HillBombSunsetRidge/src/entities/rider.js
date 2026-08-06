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
  HOP_HIP_FOLD, HOP_KNEE_FOLD,
  AIR_TUCK_HIP, AIR_TUCK_KNEE, AIR_ARM_LIFT, LAND_ARM_LIFT,
  LAND_HIP_BEND, LAND_KNEE_BEND, LAND_SPINE_CURL,
  TUCK_SPINE, TUCK_HIP, TUCK_KNEE, BRAKE_SPINE, BRAKE_BOARD_PITCH,
  GRIND_YAW, GRIND_HIP_BEND, GRIND_KNEE_BEND,
  GRIND_ARM_SPREAD, GRIND_ELBOW_OPEN, GRIND_PUSH_LOCKOUT,
  RIM_COLOR, RIM_STRENGTH, RIM_POWER,
  BALANCE_CARVE, BALANCE_LATERAL, BALANCE_LATERAL_REF, BALANCE_SMOOTH,
  BALANCE_LIFT_BASE, BALANCE_LIFT_ASYM, ARM_LIFT_MAX,
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
        // Signed by the drift direction captured at takeoff (main.js), so the
        // rotation continues the rider's own momentum instead of fighting it.
        yawExtra = s.airT * Math.PI * 2 * (s.spinDir || 1);
      }
      // HOP-OVER has NO whole-body rotation -- it's a leg tuck applied directly
      // to the rig's bones after the mixer runs (further down). The barrel roll
      // that used to live here "didn't make a lot of sense" and is gone.
      const rollExtra = 0;

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
      const grindYaw = grindPose * GRIND_YAW * (s.grindYawSign || 1);

      tilt.rotation.x = s.tucking * 0.30 + pitchExtra;
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
        if (s.grinding) pushLockT = GRIND_PUSH_LOCKOUT;
        else if (pushLockT > 0) pushLockT = Math.max(0, pushLockT - dt);

        // A landing absorb bars it too. Partly because kick-pushing while
        // soaking up an impact is nonsense, and partly mechanical: a push lifts
        // one foot clear of the deck, and the board is pinned to the FEET
        // during a pose, so a push overlapping an absorb dragged the deck off
        // its resting height (measured up to 0.067 of drift on exactly those
        // landings, versus ~0.002 on the clean ones).
        if (s.airActive || pushLockT > 0 || landPose > 0.001) {
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
          const fold = Math.sin(Math.min(1, s.airT) * Math.PI);
          const hopping = s.airTrick === 'hop';
          const hip = fold * Math.max(AIR_TUCK_HIP, hopping ? HOP_HIP_FOLD : 0);
          const knee = fold * Math.max(AIR_TUCK_KNEE, hopping ? HOP_KNEE_FOLD : 0);
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
            if (upLegL) {
              upLegL.rotation.x -= tk * TUCK_HIP;
              upLegR.rotation.x -= tk * TUCK_HIP;
              if (legL) legL.rotation.x += tk * TUCK_KNEE;
              if (legR) legR.rotation.x += tk * TUCK_KNEE;
            }
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
          if (liftL > 0.001) {
            armL.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -liftL));
          }
          if (liftR > 0.001) {
            armR.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -liftR));
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
          const posing = s.airActive || grindPose > 0.001 || landPose > 0.001;
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
          if (!posing) { restBoardLocal.copy(board.position); hasRestBoard = true; }
        }
      } else {
        // Other modes keep the board at its neutral spot under the rider.
        board.position.set(0, BOARD_Y, 0);
      }

      // TAIL DRAG: pitch the deck nose-up while braking, so the board visibly
      // rides on its tail rather than the whole thing sliding flat.
      board.rotation.x = -(s.braking || 0) * BRAKE_BOARD_PITCH;

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
      } else {
        tilt.position.set(0, 0, 0);
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
