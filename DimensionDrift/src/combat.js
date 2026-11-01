// COMBAT — the drones, the gun that finds them, and the bolts in between.
//
// ── WHY THERE IS NO FIRE BUTTON, AND WHY THAT IS THE DESIGN ────────────────
//
// This game has one input: a lean. Speed is not granted, it is the component of
// gravity along wherever the board is pointing minus drag minus what the edge
// scrubs, so every turn is already a negotiation. Bolting a trigger onto that
// would add a second, unrelated conversation — aim here, steer there — and the
// sensor the real hardware sends has nowhere to put it.
//
// So the gun is automatic, and the ONLY input to it is WHERE THE BOARD POINTS.
// A drone inside the corridor ahead of the heading is acquired and shot; a
// drone outside it rides past untouched and pays nothing. That makes combat a
// LINE mechanic, which is the mechanic this game already is — the same reason
// `pickups.js` places its motes along steepest descent rather than at points:
// the reward has to be bought with a commitment of heading, because heading is
// the only currency the player actually spends.
//
// Read that corridor as the thesis of this file. Everything below is in service
// of it: the squads are spread ACROSS the piste so that a full sweep costs a
// traverse, the fire range is long enough that the decision is made early, and
// the bolt is guided so that a shot fired at something you were genuinely
// pointed at connects. All the agency is in the acquisition. None of it is in
// the trigger, because there is no trigger.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO (STAGE ONE) ─────────────────────────
//
//   - A DRONE IS NOT A HAZARD. It hovers 3.4–5.8 m over the drawn surface,
//     clear of a standing rider's head, has no collider, and is not in
//     `scatter.js`'s obstacle list. Nothing about the difficulty of this
//     mountain moved when this file landed: `TREE_R`, the tree density, the
//     clumping, the obstacle lane and the race's blockers are all exactly what
//     they were. That is a decision, not an omission — adding a new way to
//     crash is a balance change, and it should be made on its own, with its own
//     measurements, rather than smuggled in under a feature called "enemies".
//   - NOTHING SHOOTS BACK. One direction of fire, stage one.
//   - It never places a drone outside |u| = 0.62 * HALF, which is `pickups.js`'s
//     limit and is there for its reason: the inside trees start at 0.80 and the
//     rocks at 0.74, so the reward space and the hazard space stay disjoint by
//     construction. The gun must never be able to ask you to ride into a tree.
//
// Placement is a pure function of (band index, seed) and banded the way the
// scatter and the drift lines are, so a run re-ridden from the same seed meets
// the same drones in the same places. The whole thing is FOUR DRAW CALLS
// whatever the length of the descent — pods, eyes, bolts, and the one lock ring
// — because the pods and their eyes share an instance matrix and the bolts are
// a pool rather than objects.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLitMaterial } from './lit.js';
import { HALF, VIEW, meshHeight } from './mountain.js';
import { mulberry32, range, clamp } from './rng.js';

// ── PLACEMENT ───────────────────────────────────────────────────────────────

// Seventy metres a band and at most one squad in it, starting in the first
// fourteen. A squad is at most (SQUAD_MAX-1) * STAGGER_MAX = 45 m long, so its
// tail lands at most 59 m into a 70 m band and two consecutive bands can never
// interleave — the same geometric guarantee the drift lines get, for the same
// reason. Two squads braided together is not twice the fight; it is a cloud
// with no formation in it, and the formation is the thing the player reads a
// line through. ANY INCREASE TO `STAGGER` OR `START_JITTER` HAS TO BE CHECKED
// AGAINST THIS SUM.
const BAND = 70;
const START_JITTER = 14;
const SQUAD_CHANCE = 0.62;        // a squad every ~113 m of descent
const SQUAD_MIN = 1;
const SQUAD_MAX = 4;
// MEASURED, NOT GUESSED. The first pass had these at [5,11] and [4.5,9.0], and
// `combatqa.mjs` rode a kilometre of it: 9 shots, 5 kills, 14 drones escaped and
// NOT ONE SQUAD SWEPT. Two numbers were doing that, and neither was the gun.
//
//   THE CHEVRON WAS WIDER THAN THE CORRIDOR. Four drones at up to 9 m apart
//   spans 27 m across the piste against a corridor 5–13 m wide, so no line
//   through it can ever hold more than two. A sweep was not hard; it was
//   geometrically unavailable, and a bonus that cannot be earned is not a
//   bonus, it is a number in a file.
//
//   AND THE FORMATION PASSED TOO FAST. At 5–11 m of stagger a squad is 24 m of
//   descent end to end — under a second at riding speed, against a gun on a
//   0.36 s cooldown. Three shots, four drones, before anything about aim.
//
// So: narrower than the corridor at its narrowest, and long enough that holding
// a line through it is a decision rather than a coincidence. A four-drone
// chevron now spans 9.6–19.2 m across and 24–45 m down.
const STAGGER = [8, 15];          // metres of descent between one drone and the next
const SPREAD = [3.2, 6.4];        // metres across the piste between them

// The reward space, and nothing beyond it. See the header.
const U_LIMIT = HALF * 0.62;      // 19.8 m
const U_CENTRE = 14;              // a squad's lead drone sits within this of the line

// Above a standing rider, below the gate poles' 2.2 m of meaning. A drone that
// hovered at chest height would be a hazard whether or not it had a collider,
// because it would LOOK like one, and this game has taught its players that
// anything in the lane at that height hurts.
const HOVER = [3.4, 5.8];
const BOB = 0.55;
// A pod is ~2.2 m across the fins at 1.0. At the range the gun acquires from,
// the thing the player has to notice and steer at is a dozen pixels, so this
// runs a little large for an aircraft and that is the point — the drones are
// the only object in the frame placed there to be LOOKED AT rather than ridden
// past. The bottom of a pod at the lowest hover is still 2.6 m off the snow,
// which is the number that keeps them clear of a standing rider.
const SIZE = [1.05, 1.40];

// ── THE GUN ─────────────────────────────────────────────────────────────────

// The corridor. Perpendicular distance from the ray the board is pointing
// along, flaring with range: five metres at the muzzle, thirteen at eighty.
//
// IT FLARES RATHER THAN BEING A CONE, and the difference matters. A pure cone
// of fixed half-angle is narrow where the target is close, so a drone you had
// locked at seventy metres falls out of the corridor exactly as it gets big and
// you most expect to kill it — the aim gets HARDER as the shot gets easier,
// which reads as the gun breaking. A floor on the near width fixes that: inside
// ~27 m the corridor is a constant five metres wide and a drone you were lined
// up on stays lined up.
//
// Thirteen metres at eighty is 9.2 degrees, which is about one lean of lead
// time. Wider and the gun clears the hill without being steered; narrower and a
// squad spread across the piste is unsweepable at any speed this game reaches.
const RANGE_MAX = 86;
const RANGE_MIN = 6;              // closer than this and the bolt cannot turn in time
const AIM_NEAR = 5.0;
const AIM_FAR = 15.0;

// A shot every 0.36 s, which at riding speed is one per ~14 m. A squad is in
// range for about two seconds, so a full four takes five or six shots and holds
// the line through all of them. Clearing a squad is therefore a sustained
// commitment rather than a single correct instant — the same shape as riding a
// drift line whole rather than clipping its tail.
const FIRE_CD = 0.36;
const BOLTS_CAP = 24;
const BOLT_SPEED = 135;           // m/s — 0.6 s from muzzle to the far end of range
const BOLT_LIFE = 1.6;
// Radians per second of guidance. Enough that a bolt fired at something you
// were genuinely pointed at connects through the rider's own lateral movement;
// not so much that it can turn through ninety degrees onto a target you have
// already ridden past. At 135 m/s, 11 rad/s is a 12 m turn radius.
const BOLT_TURN = 11.0;
const HIT_R = 1.6;
const MUZZLE_UP = 0.85;           // metres above the board the bolt leaves from

const POP_TIME = 0.34;
const POP_RISE = 2.4;
const RESOLVE_MARGIN = 10;        // metres past the last drone before a squad settles

// ── WHAT A KILL IS WORTH ────────────────────────────────────────────────────
//
// Escalating inside the squad, like a drift line and for the same reason: the
// wager is on the WHOLE formation, so taking the last one has to be worth more
// than taking the first, or a player optimises by snapping at whatever is
// nearest and never commits to a sweep.
//
//   one drone of four      35
//   a clean sweep of four  (35+50+65+80) * 1.5 = 345
//
// A whole drift line pays 308 and a gate pays 100, so a swept squad is the best
// thing in the game between two gates and a snatched single is worth a third of
// a gate. That ratio is the design; it is the only number here a balance pass
// should need to touch.
//
// THE SCORE LANDS PER KILL, which is where this file departs from `pickups.js`
// — and the departure is deliberate, so it is argued here rather than noticed
// later. Drift lines score per CHAIN because a mote is taken passively, eight
// to a line, and awarding each one would run the streak up eight steps and
// wreck an economy that file does not own. A kill is not that: it is discrete,
// it is caused, there are at most four in a squad, and a squad arrives every
// ~113 m. That is the rate a pair of gates already pays the streak at. Four
// steps per squad was measured against `multFor` (one step per four awards)
// before this comment was written.
const KILL_BASE = 35;
const KILL_STEP = 15;
const SWEEP_BONUS = 1.5;          // for taking every drone in a squad

/** Score for `killed` drones out of `total`, before the game's multiplier. */
export function squadValue(killed, total) {
  let v = 0;
  for (let k = 0; k < killed; k++) v += KILL_BASE + KILL_STEP * k;
  return Math.round(killed > 0 && killed === total ? v * SWEEP_BONUS : v);
}

/** Published so the HUD and any par calculation can price a run without guessing. */
export const COMBAT_VALUE = {
  KILL_BASE, KILL_STEP, SWEEP_BONUS, SQUAD_MIN, SQUAD_MAX, SQUAD_CHANCE, BAND,
  /** Points a swept average squad is worth, before the multiplier. */
  fullSquad: squadValue(Math.round((SQUAD_MIN + SQUAD_MAX) / 2),
    Math.round((SQUAD_MIN + SQUAD_MAX) / 2)),
  /** Squads a run of `metres` contains, on average. */
  squadsIn: (metres) => (metres / BAND) * SQUAD_CHANCE,
};

// ── GEOMETRY ────────────────────────────────────────────────────────────────

/**
 * A drone pod: a squashed faceted core with three swept fins, flat shaded.
 *
 * Built once and shared by every instance, like the spires and the motes. Low
 * enough to read as machined against a world of crystal — the scatter is all
 * irregular shards with per-bearing radii, so a REGULAR solid is the cheapest
 * way to say "this one was manufactured and the mountain was not", which is the
 * read a target needs before any colour arrives.
 */
function buildPodGeometry() {
  const parts = [];
  const core = new THREE.OctahedronGeometry(0.95, 0).toNonIndexed();
  core.scale(1.0, 0.58, 1.0);
  parts.push(core);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const fin = new THREE.TetrahedronGeometry(0.60, 0).toNonIndexed();
    fin.scale(1.30, 0.22, 0.70);
    fin.rotateY(-a);
    fin.translate(Math.cos(a) * 1.02, -0.10, Math.sin(a) * 1.02);
    parts.push(fin);
  }
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();   // FLAT, like everything else this game builds
  return g;
}

/**
 * The eye: a small solid sitting in the pod's nose, in its own mesh.
 *
 * ── THE TWO-TONE ARGUMENT, WHICH IS STRUCTURAL AND NOT DECORATIVE ──────────
 * `pickups.js` records a four-round colour audition and the finding that came
 * out of it: a single-colour prop has a camouflage hour somewhere in a five-stop
 * arc, and the only reliable fix is a prop that carries two values at once. It
 * built an inverted dark hull for exactly that and then cut it on sight, noting
 * that the structural answer was the hull if a pure colour ever failed again.
 *
 * A target is the object in this game that may least afford a bad hour, so it
 * takes the structural answer from the start: a DARK pod, which separates from
 * a pale sky and a bright slope, carrying a BRIGHT UNLIT eye, which separates
 * from a dark one. The eye's material is MeshBasic, so the lit shader's fog
 * cannot reach it — immunity by construction, and immunity is the point: in a
 * bright whiteout the eye stays hot while everything around it washes out.
 *
 * It shares the pod's `instanceMatrix`, so every spawn, bob, turn, pop and
 * despawn is mirrored for free and the pair costs one extra draw call. The
 * offset therefore lives in the GEOMETRY, not in a second matrix: -Z is the
 * pod's forward, and the pod is yawed to face the rider every frame, so the eye
 * is always the part pointed at the player.
 */
function buildEyeGeometry() {
  const g = new THREE.OctahedronGeometry(0.33, 0).toNonIndexed();
  g.scale(1.0, 0.85, 1.25);
  g.translate(0, 0.02, -0.74);
  g.computeVertexNormals();
  return g;
}

/**
 * A bolt: a long thin crystal, drawn with an unlit material on purpose.
 *
 * A tracer that the fog can reach is a tracer that disappears into the middle
 * distance of the one stop with the most fog in it, which is precisely where a
 * player needs to see that the gun is working. Basic material is immune to the
 * lit shader's fog by construction — the same trick, and the same reasoning, as
 * the eye above.
 *
 * Built along -Z so a bolt can be oriented by `lookAt`-style basis without a
 * correction quaternion.
 */
function buildBoltGeometry() {
  const g = new THREE.OctahedronGeometry(0.17, 0).toNonIndexed();
  g.scale(1.0, 1.0, 5.2);
  g.computeVertexNormals();
  return g;
}

/**
 * The lock: two thin rings crossed through each other, drawn around whatever
 * the gun is currently pointed at.
 *
 * ── WHY THIS EXISTS AND WHY IT IS NOT IN THE HUD ───────────────────────────
 * An automatic gun with no trigger has one problem a manual one does not: the
 * player cannot tell the difference between "the gun has not acquired that
 * drone" and "the gun has acquired it and has not got round to firing yet".
 * Both look like a quiet frame, and the whole mechanic lives in the first case
 * being FIXABLE by steering. So the acquisition has to be shown, or the only
 * feedback the corridor ever gives is the absence of a kill several seconds
 * later, by which time the drone is behind you and the lesson is unlearnable.
 *
 * It is a world-space MESH and not a screen-space reticle because this game
 * renders two cameras in two-player: a HUD element drawn once would be wrong in
 * at least one half of the frame, and drawn twice would need the HUD to know
 * about viewports. A ring in the world is simply seen by whichever camera can
 * see it, which is the correct answer in both modes for no extra code.
 *
 * CROSSED, not a single ring, so it reads as a lock from any angle rather than
 * collapsing to a line when the camera comes level with its plane — the same
 * problem an upright bipyramid has, and the same fix (see `pickups.js`).
 */
function buildLockGeometry() {
  const a = new THREE.TorusGeometry(1.45, 0.055, 3, 22).toNonIndexed();
  const b = a.clone();
  b.rotateY(Math.PI * 0.5);
  const g = mergeGeometries([a, b], false);
  g.computeVertexNormals();
  return g;
}

export class Combat {
  /**
   * @param {import('./mountain.js').Terrain} terrain
   * @param {THREE.Scene} scene
   * @param {import('./mood.js').Mood} mood
   * @param {number} seed the run's one seed — placement is a pure function of it
   */
  constructor(terrain, scene, mood, seed) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x3b9ac7) >>> 0;
    this.bands = Math.ceil(VIEW / BAND) + 2;
    this.capacity = this.bands * SQUAD_MAX;
    this.enabled = true;

    // THE POD IS DARK AND IT IS NOT A MISTAKE NEXT TO THE SPIRES' EMISSIVE 0.9.
    // `lit.js` adds `albedo * uEmissive`, so the scalar multiplies a COLOUR and
    // not white — the spires needed 0.9 to lift a dark violet albedo off black.
    // This one wants to STAY dark: the eye is the bright half, and a pod that
    // glowed as well would be one blob of light with no shape in it at 80 m.
    // 0.12 is enough that it is never a pure silhouette at the darkest stop.
    //
    // snowCap 0, because `uSnowCap` mixes upward faces toward the GROUND colour
    // and would frost a machine exactly the way it frosted a conifer — which is
    // half of why the forest read alpine whatever shape it was (see scatter.js).
    this.matPod = makeLitMaterial(mood, {
      color: 0x271b3f, wrap: 0.22, gloss: 46, specular: 0.55, emissive: 0.12, snowCap: 0,
    });
    /** Append to main's `litMaterials` so the shared sun/fog reaches them. */
    this.materials = [this.matPod];

    // HAZARD ORANGE, and chosen against the vocabulary rather than for taste.
    // This world already means things with colour: lime is a reward (motes and
    // time gates), violet is a boost gate, deep crimson and navy are gate poles,
    // dark violet is scenery you hit, chequered is the finish. Orange is the one
    // hot hue nothing in this game has claimed, and it is the furthest from the
    // violet-green axis the whole re-theme runs along, so it separates at every
    // stop in `mood.js` instead of only at the convenient ones.
    this.matEye = new THREE.MeshBasicMaterial({ color: 0xff6a1f });
    this.matBolt = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });

    this.podGeo = buildPodGeometry();
    this.pods = new THREE.InstancedMesh(this.podGeo, this.matPod, this.capacity);
    this.pods.frustumCulled = false;
    this.pods.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    this.podGeo.setAttribute('aTint', this.tint);
    scene.add(this.pods);

    this.eyeGeo = buildEyeGeometry();
    this.eyes = new THREE.InstancedMesh(this.eyeGeo, this.matEye, this.capacity);
    this.eyes.frustumCulled = false;
    this.eyes.instanceMatrix = this.pods.instanceMatrix;
    scene.add(this.eyes);

    this.boltGeo = buildBoltGeometry();
    this.boltMesh = new THREE.InstancedMesh(this.boltGeo, this.matBolt, BOLTS_CAP);
    this.boltMesh.frustumCulled = false;
    this.boltMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.boltMesh);

    this.lockGeo = buildLockGeometry();
    // Unlit, like the eye and the bolt: the one element whose whole job is to
    // say WHERE THE GUN IS POINTED must not be allowed to fade into the fog at
    // the ranges where that information is worth most.
    this.lock = new THREE.Mesh(this.lockGeo, new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
    this.lock.frustumCulled = false;
    this.lock.visible = false;
    scene.add(this.lock);
    /** 1 on the frame a bolt leaves, decaying — the lock's recoil. */
    this.lockFlash = 0;

    /** One squad (or null) per band slot, indexed by `bandIdx % bands`. */
    this.squads = new Array(this.bands).fill(null);
    this.baseBand = -1e9;
    this.t = 0;

    /** The pool. A bolt is live or it is not; nothing is allocated per shot. */
    this.bolts = [];
    for (let i = 0; i < BOLTS_CAP; i++) {
      this.bolts.push({
        live: false, gi: i, life: 0,
        pos: new THREE.Vector3(), dir: new THREE.Vector3(), target: null,
      });
    }
    this.cooldown = 0;
    /** The drone the gun is currently pointed at, or null. Read by the HUD. */
    this.target = null;

    /** Optional hooks for audio and particles. Kept out of this file's imports. */
    this.onShot = null;      // (originVec3) => void
    this.onKill = null;      // (drone, squad) => void
    this.stats = { shots: 0, kills: 0, sweeps: 0, escaped: 0, points: 0 };

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._tmp = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    // Reused, not rebuilt. `_animate` runs once per live drone per frame, and
    // a fresh Euler in there is ~40 allocations a frame on a full ring — which
    // is exactly the kind of steady garbage that shows up later as a stutter
    // nobody can attribute to anything.
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  // ── Placement ─────────────────────────────────────────────────────────────

  /**
   * The squad a band carries, or null. A pure function of the band index and
   * the seed: a band that scrolls off and comes back is rebuilt identically,
   * nothing about a formation has to be remembered, and the ring may be filled
   * in any order.
   */
  _buildBand(bandIdx) {
    const slot = ((bandIdx % this.bands) + this.bands) % this.bands;
    const base = slot * SQUAD_MAX;
    const rand = mulberry32((this.seed ^ (bandIdx * 0x9e3779b1)) >>> 0);

    for (let i = 0; i < SQUAD_MAX; i++) this._hide(base + i);
    this.squads[slot] = null;
    if (rand() >= SQUAD_CHANCE) return;

    const n = SQUAD_MIN + Math.floor(rand() * (SQUAD_MAX - SQUAD_MIN + 1));
    const p0 = bandIdx * BAND + rand() * START_JITTER;
    const u0 = range(rand, -U_CENTRE, U_CENTRE);
    const spread = range(rand, SPREAD[0], SPREAD[1]) * (rand() < 0.5 ? -1 : 1);
    const stagger = range(rand, STAGGER[0], STAGGER[1]);

    const drones = [];
    for (let k = 0; k < n; k++) {
      // A CHEVRON, not a wall. Each drone sits further down the hill AND
      // further across than the last, so a sweep is a widening traverse rather
      // than one instant of being aimed at a row. A wall can be cleared by
      // being in the right place once; a chevron has to be followed.
      const u = clamp(u0 + spread * (k - (n - 1) * 0.5), -U_LIMIT, U_LIMIT);
      const p = p0 + stagger * k;
      const z = -p;
      const x = this.terrain.xAt(u, z);
      // meshHeight, not terrain.height. Off the centre line the mesh columns
      // are metres apart and the drawn surface sags below the analytic one, so
      // a hover measured off the analytic height floats higher than it says
      // over every convex rise — the finding that already cost this project a
      // round on its trees.
      const y = meshHeight(this.terrain, x, z) + range(rand, HOVER[0], HOVER[1]);
      drones.push({
        x, y, z, p, u, k, gi: base + k,
        size: range(rand, SIZE[0], SIZE[1]),
        phase: rand() * Math.PI * 2,
        spin: range(rand, 0.6, 1.4) * (rand() < 0.5 ? -1 : 1),
        dead: false, gone: false, pop: 0, inbound: 0, yaw: 0,
      });
      // Brighter down the formation, because the formation is worth more down
      // it. The same one-attribute readout the drift lines use, and the only
      // way an escalating value is legible at ninety kilometres an hour.
      const b = 0.82 + 0.070 * k;
      this.tint.setXYZ(base + k, b, b * 0.97, b * 1.04);
    }

    this.squads[slot] = {
      drones, n, killed: 0, points: 0, done: false,
      endP: drones[drones.length - 1].p,
      last: null,
    };
  }

  _hide(gi) {
    this._m.makeScale(0, 0, 0);
    this.pods.setMatrixAt(gi, this._m);
  }

  _ring(p) {
    const want = Math.floor(p / BAND) - 1;
    if (want === this.baseBand) return;
    if (want - this.baseBand >= this.bands || want < this.baseBand) {
      for (let i = 0; i < this.bands; i++) this._buildBand(want + i);
      this.baseBand = want;
      this.tint.needsUpdate = true;
      return;
    }
    for (let k = this.baseBand; k < want; k++) this._buildBand(k + this.bands);
    this.baseBand = want;
    this.tint.needsUpdate = true;
  }

  /** Every squad that could matter to a rider at `p`, nearest band first. */
  _near(p, back = 2, fwd = 2) {
    const out = [];
    const band = Math.floor(p / BAND);
    for (let b = band - back; b <= band + fwd; b++) {
      const s = this.squads[((b % this.bands) + this.bands) % this.bands];
      if (s) out.push(s);
    }
    return out;
  }

  // ── The gun ───────────────────────────────────────────────────────────────

  /**
   * The drone the gun is pointed at, or null.
   *
   * The corridor test, and nothing else — no line of sight, no occlusion, no
   * preference for the biggest or the closest payout. NEAREST VALID WINS, with
   * one tie-break: a drone that already has a bolt on the way is taken last.
   * Without that tie-break a four-shot burst at a squad puts all four bolts in
   * the first drone, kills it four times over and leaves the formation intact —
   * which looks, from outside, exactly like a gun that cannot aim.
   */
  _acquire(rider) {
    // Horizontal heading. `rider.heading` carries the slope in Y and a gun that
    // aimed along it would shoot at the snow on every steep.
    const hx = rider.heading.x;
    const hz = rider.heading.z;
    const hl = Math.hypot(hx, hz) || 1;
    const fx = hx / hl;
    const fz = hz / hl;

    let best = null;
    let bestScore = Infinity;
    for (const squad of this._near(rider.p, 0, 2)) {
      if (squad.done) continue;
      for (const d of squad.drones) {
        if (d.dead) continue;
        const dx = d.x - rider.x;
        const dz = d.z - rider.z;
        // Along the heading, and across it. The cross term is a 2-D wedge
        // product, which is the perpendicular distance for a unit forward.
        const along = dx * fx + dz * fz;
        if (along < RANGE_MIN || along > RANGE_MAX) continue;
        const across = Math.abs(dx * fz - dz * fx);
        const width = AIM_NEAR + (AIM_FAR - AIM_NEAR) * (along / RANGE_MAX);
        if (across > width) continue;
        // Distance, plus a full range's penalty for already being shot at.
        const score = along + d.inbound * RANGE_MAX;
        if (score < bestScore) { bestScore = score; best = { d, squad }; }
      }
    }
    return best;
  }

  /**
   * Every drone the corridor could reach, with the numbers the test is made on.
   *
   * QA ONLY, and it exists because combat has no visible state between events:
   * a frame either has a bolt in it or it does not, and "was that drone ever
   * acquired" is invisible in a screenshot either way. This is the instrument
   * -- see the probe in `main.js` and `combatqa.mjs`. It allocates, so nothing
   * in the frame path may call it.
   */
  aheadOf(rider) {
    const hx = rider.heading.x;
    const hz = rider.heading.z;
    const hl = Math.hypot(hx, hz) || 1;
    const fx = hx / hl;
    const fz = hz / hl;
    const out = [];
    for (const squad of this._near(rider.p, 1, 2)) {
      for (const d of squad.drones) {
        const dx = d.x - rider.x;
        const dz = d.z - rider.z;
        const along = dx * fx + dz * fz;
        const across = Math.abs(dx * fz - dz * fx);
        const width = AIM_NEAR + (AIM_FAR - AIM_NEAR) * (along / RANGE_MAX);
        out.push({
          ahead: d.p - rider.p, u: d.u, along, across, width, dead: d.dead,
          inCorridor: !d.dead && along >= RANGE_MIN && along <= RANGE_MAX && across <= width,
        });
      }
    }
    return out.sort((a, b) => a.ahead - b.ahead);
  }

  _fire(dt, rider) {
    this.cooldown -= dt;
    const acquired = this._acquire(rider);
    this.target = acquired ? acquired.d : null;
    if (!acquired || this.cooldown > 0) return;

    // ONE BOLT PER TARGET, AND THE GUN HOLDS ITS FIRE RATHER THAN DOUBLING UP.
    // This was 56% of shots missing in the first measured ride, and the cause
    // reads as an aiming fault but is not one: a single drone held in the
    // corridor was shot every 0.36 s while the first bolt was still 0.4 s from
    // arriving, so roughly every other bolt arrived at something already dead
    // and flew on down the mountain. A drone takes one hit; a second bolt was
    // never anything but a wasted one.
    //
    // `inbound` already ORDERED targets by this and that was not enough -- with
    // one drone in the corridor there is nothing to re-order onto.
    if (acquired.d.inbound > 0) return;

    const bolt = this.bolts.find((b) => !b.live);
    if (!bolt) return;          // 24 in the air at once is already absurd
    this.cooldown = FIRE_CD;

    bolt.live = true;
    bolt.life = BOLT_LIFE;
    bolt.target = acquired.d;
    bolt.squad = acquired.squad;
    acquired.d.inbound++;
    bolt.pos.set(rider.x, rider.y + MUZZLE_UP, rider.z);
    // Launched straight at the target rather than along the heading. The muzzle
    // is on a board that is leaning, and a bolt that left along the board and
    // then turned would read as a correction — as the gun having missed and
    // recovered. Guidance is here for the target's own movement and the rider's,
    // not to cover an aiming error the gun did not make.
    bolt.dir.set(acquired.d.x - bolt.pos.x, acquired.d.y - bolt.pos.y, acquired.d.z - bolt.pos.z)
      .normalize();
    this.stats.shots++;
    this.lockFlash = 1;
    if (this.onShot) this.onShot(bolt.pos);
  }

  /** @returns {Array} one event per drone killed this frame. */
  _stepBolts(dt) {
    const events = [];
    for (const b of this.bolts) {
      if (!b.live) continue;
      b.life -= dt;
      const t = b.target;

      // Guidance. Toward the target if it is still alive, otherwise straight on
      // until the bolt expires — a bolt whose drone died to an earlier shot
      // flies off down the mountain, which is honest and costs nothing.
      if (t && !t.dead) {
        this._tmp.set(t.x - b.pos.x, t.y - b.pos.y, t.z - b.pos.z);
        const d = this._tmp.length();
        if (d > 1e-4) {
          this._tmp.divideScalar(d);
          // Lerp toward the desired direction at BOLT_TURN rad/s, which for
          // small angles is what a slerp costs without the trigonometry.
          b.dir.addScaledVector(this._tmp.sub(b.dir), Math.min(1, BOLT_TURN * dt)).normalize();
        }
      }

      b.pos.addScaledVector(b.dir, BOLT_SPEED * dt);

      if (t && !t.dead) {
        const dx = t.x - b.pos.x;
        const dy = t.y - b.pos.y;
        const dz = t.z - b.pos.z;
        // Swept, not sampled: at 135 m/s a bolt covers 2.25 m in a 60 Hz frame
        // and 9 m in a stalled one, and a point test would pass clean through a
        // 1.6 m target. The approach is nearly radial, so closing distance plus
        // the step is a sufficient and very cheap sweep.
        if (dx * dx + dy * dy + dz * dz < (HIT_R + BOLT_SPEED * dt) * (HIT_R + BOLT_SPEED * dt)) {
          events.push(this._kill(t, b.squad));
          b.live = false;
          t.inbound = Math.max(0, t.inbound - 1);
          this._hideBolt(b.gi);
          continue;
        }
      }

      if (b.life <= 0) {
        b.live = false;
        if (t) t.inbound = Math.max(0, t.inbound - 1);
        this._hideBolt(b.gi);
        continue;
      }

      // Oriented along flight. The geometry is built along -Z so the basis can
      // be used as-is.
      this._tmp.copy(b.pos).add(b.dir);
      this._basis.lookAt(b.pos, this._tmp, this._up);
      this._q.setFromRotationMatrix(this._basis);
      this._s.set(1, 1, 1);
      this._m.compose(b.pos, this._q, this._s);
      this.boltMesh.setMatrixAt(b.gi, this._m);
    }
    this.boltMesh.instanceMatrix.needsUpdate = true;
    return events;
  }

  _hideBolt(gi) {
    this._m.makeScale(0, 0, 0);
    this.boltMesh.setMatrixAt(gi, this._m);
  }

  _kill(d, squad) {
    d.dead = true;
    d.pop = POP_TIME;
    const points = KILL_BASE + KILL_STEP * squad.killed;
    squad.points += points;
    squad.killed++;
    squad.last = d;
    this.stats.kills++;
    this.stats.points += points;
    if (this.onKill) this.onKill(d, squad);
    return {
      type: 'kill',
      points,
      k: squad.killed,
      total: squad.n,
      label: squad.n > 1 ? `drone ${squad.killed}/${squad.n}` : 'drone',
      color: '#ffb066',
      world: new THREE.Vector3(d.x, d.y, d.z),
    };
  }

  /** @returns {Array} one event per squad that settled this frame. */
  _resolve(rider) {
    const events = [];
    for (const squad of this._near(rider.p, 3, 1)) {
      if (squad.done) continue;
      const swept = squad.killed === squad.n;
      if (!swept && rider.p <= squad.endP + RESOLVE_MARGIN) continue;
      squad.done = true;
      this.stats.escaped += squad.n - squad.killed;
      if (!swept || squad.killed === 0) continue;
      // The sweep bonus is the DIFFERENCE the multiplier makes, not the whole
      // squad again — every kill in it has already been paid at `_kill`.
      const bonus = Math.round(squad.points * (SWEEP_BONUS - 1));
      this.stats.sweeps++;
      this.stats.points += bonus;
      events.push({
        type: 'sweep',
        points: bonus,
        total: squad.n,
        label: squad.n > 1 ? `squad swept x${squad.n}` : 'clean shot',
        color: '#ff8a3d',
        world: new THREE.Vector3(squad.last.x, squad.last.y, squad.last.z),
      });
    }
    return events;
  }

  // ── Frame ─────────────────────────────────────────────────────────────────

  /**
   * Switch the drones off entirely, for a mode that has no use for them.
   *
   * NOT the same as `live: false`, which only stops the gun firing — the bands
   * still build and the pods still draw, so an attract loop still has a hill
   * with machines on it while nothing is being scored.
   */
  setEnabled(v) {
    this.enabled = v;
    this.pods.visible = v;
    this.eyes.visible = v;
    this.boltMesh.visible = v;
    if (!v) this.lock.visible = false;
  }

  /**
   * @param {number} dt seconds
   * @param {import('./rider.js').Rider} rider
   * @param {boolean} live false on the title and results screens: the drones
   *   still stream and recycle past the attract rider, but nothing fires and
   *   nothing is scored.
   * @returns {Array} kill and sweep events — see `_kill` and `_resolve`.
   */
  update(dt, rider, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    this._ring(rider.p);
    let events = [];
    if (live) {
      this._fire(dt, rider);
      events = this._stepBolts(dt);
      events = events.concat(this._resolve(rider));
    } else {
      this.target = null;
      // Bolts in the air when a run ends still have to land or expire, or the
      // pool leaks across the results screen and the next run opens with a
      // short magazine.
      this._stepBolts(dt);
    }
    this._animate(dt, rider);
    return events;
  }

  _animate(dt, rider) {
    for (let slot = 0; slot < this.bands; slot++) {
      const squad = this.squads[slot];
      if (!squad) continue;
      for (const d of squad.drones) {
        if (d.gone) continue;
        let scale = d.size;
        let lift = 0;
        // Facing the rider, horizontally. A machine that watches you is worth
        // one atan2 a frame and is most of what makes these read as hostile
        // rather than as scenery that happens to float.
        let yaw = Math.atan2(rider.x - d.x, rider.z - d.z) + Math.PI;

        if (d.pop > 0) {
          // A burst, not a fade. The shared lit shader is opaque by design, so
          // the one honest way to make a pod leave is to blow it open and
          // collapse it — the same exit the motes take, at a bigger amplitude
          // because this one was caused.
          d.pop = Math.max(0, d.pop - dt);
          const s = 1 - d.pop / POP_TIME;
          scale = d.size * (1 - s * s) * (1 + Math.sin(Math.PI * s) * 1.4);
          lift = s * POP_RISE;
          yaw += s * 11;
          if (d.pop <= 0) { d.gone = true; this._hide(d.gi); continue; }
        }

        const bob = Math.sin(this.t * 1.6 + d.phase) * BOB;
        const roll = Math.sin(this.t * 2.3 + d.phase) * 0.12;
        // The DRAWN height, kept so the lock can sit on the pod rather than on
        // the arithmetic mean of where it bobs.
        d.drawnY = d.y + bob + lift;
        this._v.set(d.x, d.drawnY, d.z);
        this._e.set(roll, yaw, this.t * d.spin * 0.35);
        this._q.setFromEuler(this._e);
        this._s.set(scale, scale, scale);
        this._m.compose(this._v, this._q, this._s);
        this.pods.setMatrixAt(d.gi, this._m);
      }
    }
    this.pods.instanceMatrix.needsUpdate = true;

    // ── the lock ───────────────────────────────────────────────────────────
    this.lockFlash = Math.max(0, this.lockFlash - dt * 4.5);
    const t = this.target;
    this.lock.visible = !!t && !t.dead && this.enabled;
    if (this.lock.visible) {
      this.lock.position.set(t.x, t.drawnY ?? t.y, t.z);
      // Spinning on two axes at incommensurate rates, so it never presents the
      // same silhouette twice and never stalls into a static shape.
      this.lock.rotation.set(this.t * 1.3, this.t * 2.1, 0);
      // Recoil: it snaps out on the shot and settles back. A gun that fires
      // with nothing moving on screen reads as a gun that did not fire.
      const k = t.size * (1 + this.lockFlash * 0.42);
      this.lock.scale.set(k, k, k);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Place the whole ring at a distance down the mountain. Call from `_seekTo`. */
  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
    this.tint.needsUpdate = true;
    this.pods.instanceMatrix.needsUpdate = true;
    for (const b of this.bolts) {
      b.live = false;
      b.target = null;
      this._hideBolt(b.gi);
    }
    this.boltMesh.instanceMatrix.needsUpdate = true;
    this.cooldown = 0;
    this.target = null;
    this.lockFlash = 0;
    this.lock.visible = false;
    this.t = 0;
    this.stats = { shots: 0, kills: 0, sweeps: 0, escaped: 0, points: 0 };
  }

  dispose() {
    this.scene.remove(this.pods);
    this.scene.remove(this.eyes);
    this.scene.remove(this.boltMesh);
    this.scene.remove(this.lock);
    this.lockGeo.dispose();
    this.lock.material.dispose();
    this.podGeo.dispose();
    this.eyeGeo.dispose();
    this.boltGeo.dispose();
    this.matPod.dispose();
    this.matEye.dispose();
    this.matBolt.dispose();
  }
}
