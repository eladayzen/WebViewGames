// RAPHAEL, IN THE ROOM.
//
// The mesh and the rig are Sewer Shred's (`public/models/raphael.glb`): a
// Mixamo-rigged turtle, 8,835 triangles, one 1024px texture. Taking it rather
// than generating a new one is not laziness -- it is the same character the
// platform already ships, which is the whole point of a shared cast.
//
// FIVE CLIPS, FOUR OF THEM BLENDED EVERY FRAME. An idle, and a four-way
// crouch walk -- forward, back, left, right -- mixed by where the player is
// travelling relative to where the body is pointing. core/locomotion.js does
// that arithmetic and core/facing.js decides where the body points; this file
// is only the part that needs a skeleton.
//
// THE FOUR WALKS SHARE ONE CLOCK. Each has its own length (1.13s to 1.27s), so
// letting the mixer advance them independently would drift them apart within a
// couple of seconds and blend a left foot into a right one. Instead their
// timeScale is zero and a single phase drives all four: `action.time = phase x
// its own duration`. One phase, four clips, feet always in agreement.
//
// TWO LAYERS. The legs walk while the arms throw: every clip is split into
// sub-clips by bone (render/mask.js) and each slice gets its own action, so a
// slice with no leg tracks cannot move a leg whatever weight it is given.
// three.js has no bone masking of its own, and this is the only way its mixer
// offers to build one.
//
// `clips.json` is still fetched rather than required: without it the rig
// stands in its bind pose and the game runs.
//
// WHY THE MUZZLE IS A BONE AND NOT AN OFFSET. Survivor measured the barrel off
// the sprite every frame because a hand-drawn gun moves with the walk cycle;
// the same is true of a rigged arm, more so. Reading `mixamorigRightHand`'s
// world position means the throw leaves the hand -- and keeps leaving the hand
// once the hand starts moving, with no second pass over this file.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { u } from './units.js';
import { glowTexture } from './stage.js';
import { blendWeights, blendedStride, cadenceHz } from '../core/locomotion.js';
import { bucketize, bonesIn, sliceClip } from './mask.js';
import { THROW, THROW_SPAN, throwEnvelope, throwClipTime } from '../core/throwing.js';
import { WALK, IDLE, CLIP_ALIAS } from '../core/clipsets.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

/** Standing height in scene units. Sewer Shred's value, so he matches himself. */
export const RIDER_H = num('rh', 1.55);

/**
 * Which way the mesh faces in its bind pose, in degrees.
 *
 * Mixamo characters face +Z, so 0 is correct and this should never need
 * touching -- but "should never" is how the last three facing bugs started,
 * and `?yaw0=180` is a reload rather than a rebuild.
 */
const YAW0 = (num('yaw0', 0) * Math.PI) / 180;

/**
 * HOW HE IS SHADED.
 *
 *   ?shade=lambert   cheap per-vertex diffuse, what the sewer games use
 *   ?shade=toon      banded diffuse through a stepped gradient ramp
 *
 * The toon path is not just a different material: a cartoon turtle under a
 * smooth falloff reads as a plastic model of a cartoon turtle. Banding the
 * light into three steps puts a hard terminator on him, which is what makes a
 * cel-shaded character look drawn rather than lit.
 *
 * ?emis= scales a self-illumination term on top of either. IT DEFAULTS TO
 * ZERO, and the reason is worth keeping.
 *
 * Self-illumination was added to solve "he is hard to see in a murky room".
 * It is the wrong tool for that, and Elad called it straight away: "self lit
 * is not good". Emissive light has no direction, so it fills the shadow side
 * at exactly the same strength as the lit side -- it does not brighten a
 * character, it FLATTENS one, and it is worst precisely where the form reads
 * most, along the terminator. On the toon path it is worse still, because the
 * banding it exists to produce gets lifted off the bottom step and the hard
 * edge dissolves.
 *
 * The actual fix for a murky room is to stop the room being murky, which is
 * what the brighter floor, the pale fog and the lifted hemisphere now do. The
 * knob stays so a dim scene can borrow a little back on a board, but nothing
 * reaches for it unless asked.
 */
export const SHADE = {
  mode: QS.get('shade') === 'toon' ? 'toon' : 'lambert',
  emissive: num('emis', 0),
  steps: num('toonsteps', 3),
};

export const LOCO = {
  // Below this he is standing, not walking. The board's deadzone already
  // means small leans produce nothing, so this only has to catch the crawl
  // between "the deadzone opened" and "he is actually going somewhere".
  minSpeed: num('locomin', 0.25),
  // How fast the idle/walk mix follows. ?locomix=
  mixRate: num('locomix', 12),
  // A thumb on the measured cadence, for when the right answer and the good
  // answer differ. 1 means the feet exactly match the ground. ?cad=
  // 0.7 -- Elad, after seeing it: movement animation 30% slower. The measured
  // answer is 1.0 (the feet exactly match the ground), but at full walk speed
  // that is 2.5 cycles a second against a clip authored at 0.89, and a crouch
  // walk at nearly 3x reads frantic. This trades a little foot slide for a
  // gait that looks like a gait. ?cad=1 restores the measured value.
  cadence: num('cad', 0.7),
};

/** A stepped ramp for MeshToonMaterial: N flat bands instead of a falloff. */
function toonGradient(steps) {
  const n = Math.max(2, Math.round(steps));
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.round((255 * (i + 1)) / n);
  const t = new THREE.DataTexture(data, n, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;      // NEAREST is the whole point: no ramp
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Rebuild the glb's material in whichever style is switched on. */
function makeMaterial(src) {
  // The base self-illumination, before ?emis= scales it. Green rather than
  // grey so the light he carries is his own colour and not a wash.
  const emissive = new THREE.Color(0x24381b).multiplyScalar(SHADE.emissive);
  const common = { map: src.map, color: 0xffffff, emissive };
  const mat = SHADE.mode === 'toon'
    ? new THREE.MeshToonMaterial({ ...common, gradientMap: toonGradient(SHADE.steps) })
    : new THREE.MeshLambertMaterial(common);
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
  return mat;
}

export async function loadRig(scene) {
  const gltf = await new GLTFLoader().loadAsync('models/raphael.glb');
  const model = gltf.scene;

  // Measure the bind height in WORLD space. The glb carries its scale on the
  // scene root and the accessor bounds lie about it -- Sewer Shred found this
  // the hard way, and a wrongly-scaled turtle is a 10x error, not a 10% one.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const k = RIDER_H / (box.max.y - box.min.y);

  let hand = null;
  const bones = {};
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.material = makeMaterial(o.material);
    }
    if (o.isBone) {
      bones[o.name] = o;
      if (o.name === 'mixamorigRightHand') hand = o;
    }
  });

  const root = new THREE.Group();          // position + facing
  const scaler = new THREE.Group();        // the one place scale lives
  scaler.scale.setScalar(k);
  scaler.position.y = -box.min.y * k;      // feet on the floor, not hips
  scaler.add(model);
  root.add(scaler);
  scene.add(root);


  // THE FEMUR IS THE RULER. A clip's stride is measured in femurs because a
  // bone's rest offset is the one length the source FBX and this glb agree
  // on -- their raw units do not match, and hips height would not do either,
  // since a crouch walk's hips sit lower than this bind pose by exactly the
  // amount of the crouch.
  //
  // MEASURED BETWEEN TWO WORLD POSITIONS, not as `bone.position.length()`.
  // A bone's local offset is expressed in the skeleton's own raw units and
  // carries none of the scale stacked above it -- the glb's own root scale,
  // then `scaler` -- so reading it directly gave 36 scene units of femur on a
  // 1.55-unit character, a stride of 165 units per cycle, and a cadence of one
  // step every forty seconds. The gap between two bones in world space has
  // every scale already applied and cannot be wrong in that way.
  let femur = 0;
  {
    const hip = bones.mixamorigLeftUpLeg;
    const knee = bones.mixamorigLeftLeg;
    if (hip && knee) {
      root.updateMatrixWorld(true);
      femur = hip.getWorldPosition(new THREE.Vector3())
        .distanceTo(knee.getWorldPosition(new THREE.Vector3()));
    }
  }

  // A blob under him. Not a shadow map: one skinned character does not justify
  // a depth pass on a phone, and at this camera angle a soft ellipse is what
  // the eye actually reads as contact.
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: glowTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'),
      transparent: true, depthWrite: false, opacity: 0.55, fog: false,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  root.add(blob);

  // The four slots, resolved to whichever gait is switched on.
  const WALKS = [WALK.f, WALK.b, WALK.l, WALK.r];

  const mixer = new THREE.AnimationMixer(model);
  /** actions[clipName][bucketIndex] -- one action per layer slice. */
  const actions = {};
  /** "walk_sneak -> walk_f" for anything this build stood in for. */
  const aliased = [];
  const meta = {};        // per clip: duration, strideFemurs, releaseAt
  const strideU = {};     // scene units covered per cycle, per clip
  // MUTATED IN PLACE, never reassigned. The object this module returns is
  // built before loadClips runs, so rebinding this name would leave every
  // caller holding the original empty array while the closure used the real
  // one -- the game would look fine and `rig.buckets` would lie.
  const buckets = [];     // [{ m, bones }] ascending by mask weight

  let phase = 0;          // the one clock the four walks share, 0..1
  let walkMix = 0;        // 0 = idle, 1 = walking; eased, never snapped
  let throwT = Infinity;  // seconds since the throw window opened

  /** Load clips.json if it was shipped. Silent and harmless when it was not. */
  async function loadClips(url = 'models/clips.json') {
    let data;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      data = await res.json();
    } catch { return []; }

    buckets.length = 0;
    buckets.push(...bucketize(bonesIn(data)));
    for (const [name, json] of Object.entries(data)) {
      meta[name] = {
        duration: json.duration,
        // Read off the RAW json. These are deliberately NOT in `userData`:
        // three treats that field as a JSON *string* and calls JSON.parse on
        // it, so an object there throws during parse.
        strideFemurs: json.strideFemurs || 0,
        releaseAt: json.releaseAt || 0,
      };
      strideU[name] = meta[name].strideFemurs * femur;
      actions[name] = buckets.map((b, i) => {
        const sliced = sliceClip(json, b.bones, i);
        if (!sliced.tracks.length) return null;
        const a = mixer.clipAction(THREE.AnimationClip.parse(sliced));
        a.play();
        a.timeScale = 0;          // every layer is driven by hand, not by the mixer
        a.setEffectiveWeight(0);
        return a;
      });
    }
    aliasMissing();
    if (aliased.length) console.info('clips: trimmed build, standing in —', aliased.join(', '));
    return Object.keys(data);
  }

  /**
   * Point any audition clip this build did not ship at its shipped stand-in.
   * See CLIP_ALIAS: the alternative is a limb that silently stops moving.
   */
  function aliasMissing() {
    for (const [from, to] of Object.entries(CLIP_ALIAS)) {
      if (actions[from] || !actions[to]) continue;
      actions[from] = actions[to];
      strideU[from] = strideU[to];
      meta[from] = meta[to];
      aliased.push(`${from} -> ${to}`);
    }
  }

  function hasWalks() { return WALKS.every((n) => actions[n]); }
  function hasThrow() { return !!actions[THROW.clip]; }
  function throwing() { return throwT < THROW_SPAN; }
  /** Seconds since the throw window opened; Infinity when he is not throwing. */
  function throwPhase() { return throwT; }

  /**
   * Open the throw window. Ignored while one is already playing.
   *
   * `skipS` starts it part-way in, which is how the release is made to land on
   * the shot even when there was no warning. In the normal case the sim's fire
   * countdown gives `preS` of notice and skip is 0, so the full wind-up plays;
   * after a pause in firing the countdown is already at zero, and skipping
   * straight to the release is better than throwing a fifth of a second after
   * the star has left.
   */
  function startThrow(skipS = 0) {
    if (!hasThrow() || throwing()) return false;
    throwT = Math.max(0, Math.min(THROW_SPAN, skipS));
    return true;
  }

  /** Set one clip's weight across every bucket, scaled per bucket. */
  function setLayer(name, weightFor) {
    const row = actions[name];
    if (!row) return;
    for (let i = 0; i < row.length; i++) {
      if (row[i]) row[i].setEffectiveWeight(weightFor(buckets[i].m));
    }
  }

  /**
   * Drive both layers.
   *
   * THE ARITHMETIC IS THE WHOLE DESIGN. In every bucket the throw takes
   * `w x mask` and the locomotion keeps `1 - w x mask`, so the two always sum
   * to exactly 1 -- no bucket ever drifts toward the bind pose, and with no
   * throw playing (w = 0) the walk drives every bone at full strength. That is
   * the required fallback, and it is arithmetic rather than a special case.
   *
   * @param {number} speedUnitsS how fast he is actually travelling, scene units
   * @param {number} localAngle  travel direction relative to facing; 0 is ahead
   */
  function setLocomotion(speedUnitsS, localAngle, dt) {
    if (throwT < THROW_SPAN) throwT += dt;

    // --- the upper layer -------------------------------------------------
    let w = 0;
    if (hasThrow() && throwing()) {
      w = throwEnvelope(throwT);
      const m = meta[THROW.clip];
      const t = throwClipTime(throwT, m.releaseAt, m.duration);
      const row = actions[THROW.clip];
      for (let i = 0; i < row.length; i++) if (row[i]) row[i].time = t;
    }
    setLayer(THROW.clip, (mask) => w * mask);

    // --- the lower layer, which is also the upper layer when w is 0 ------
    const keep = (mask) => 1 - w * mask;

    const moving = speedUnitsS > LOCO.minSpeed;
    // Eased so that clipping the deadzone on and off does not strobe him
    // between crouching and standing several times a second.
    walkMix += ((moving ? 1 : 0) - walkMix) * Math.min(1, dt * LOCO.mixRate);
    setLayer(IDLE, (mask) => (1 - walkMix) * keep(mask));

    if (!hasWalks()) return;

    const bw = blendWeights(localAngle);
    const stride = blendedStride(bw, {
      f: strideU[WALK.f], b: strideU[WALK.b], l: strideU[WALK.l], r: strideU[WALK.r],
    });
    const hz = cadenceHz(speedUnitsS, stride) * LOCO.cadence;
    phase = (phase + hz * dt) % 1;
    if (phase < 0) phase += 1;

    for (const [key, n] of [['f', WALK.f], ['b', WALK.b], ['l', WALK.l], ['r', WALK.r]]) {
      const row = actions[n];
      const time = phase * meta[n].duration;
      for (let i = 0; i < row.length; i++) {
        if (!row[i]) continue;
        row[i].setEffectiveWeight(bw[key] * walkMix * keep(buckets[i].m));
        row[i].time = time;
      }
    }
  }

  const _v = new THREE.Vector3();
  /** The right hand, in world units. Null until the rig has a hand bone. */
  function muzzle() {
    if (!hand) return null;
    hand.updateWorldMatrix(true, false);
    return _v.setFromMatrixPosition(hand.matrixWorld);
  }

  /**
   * Put him where the sim says, facing the way the sim says.
   * `facing` is the sim's screen-plane angle: atan2(dy, dx) over x/y.
   */
  function place(simX, simY, facing) {
    root.position.set(u(simX), 0, u(simY));
    // The sim's (dx, dy) maps to the scene's (x, z); a three.js yaw of
    // atan2(x, z) points a +Z-facing mesh along it.
    root.rotation.y = Math.atan2(Math.cos(facing), Math.sin(facing)) + YAW0;
  }

  function update(dt) { mixer.update(dt); }

  return {
    root, model, mixer, place, update, loadClips, setLocomotion, muzzle,
    startThrow, throwing, throwPhase, hasThrow, hasWalks,
    actions, meta, strideU, femur, buckets, bones, aliased, height: RIDER_H,
    set: WALK, idleName: IDLE, shade: SHADE,
  };
}
