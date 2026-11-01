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
import { WEAPONS, TEAM } from './weapons.js';

// ── THE RULES A MODE SETS, AND WHY THEY ARE NOT CONSTANTS ──────────────────
//
// Two modes now want different fights out of the same drones, and the
// difference is not cosmetic: in chill vibe a drone is a scoring target that
// cannot hurt you and dies to one hit, and in skirmish it is an enemy with
// health that shoots back. Hard-coding either would have meant the other mode
// getting a balance change it never asked for — and chill vibe's numbers are
// the ones a thousand measured metres were spent on.
//
// So the hostile half is OFF by default. A file that ships a new capability
// switched off is a file that cannot break the mode that was already working.
const DEFAULT_RULES = {
  /** Do the drones shoot back? */
  hostile: false,
  /** How many hits a drone takes. 1 is the game chill vibe was measured on. */
  droneHp: 1,
  /** A multiplier on SQUAD_CHANCE, so a mode can thin or thicken the hill. */
  density: 1,
};

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
/**
 * A NINJA STAR — four points, a hole, and a thickness.
 *
 * It is a plate rather than a disc, built in the XY plane and flown along -Z
 * like everything else, so the same `lookAt` basis the bolts use orients it
 * and the spin is one extra rotation about that axis.
 *
 * THE SPIN IS NOT DECORATION. A flat plate seen edge-on from a chase camera is
 * one pixel wide and simply is not there; spinning it means it presents its
 * face to the key once a revolution and flashes, which is both how a thrown
 * star actually behaves and the only reason this reads as a star at sixty
 * metres instead of as a dash. See `spin` in `weapons.js`.
 *
 * FOUR POINTS, NOT SIX OR EIGHT. At the sizes this is drawn — 0.42 m across,
 * which is a handful of pixels past thirty metres — six points blur into a
 * disc. Four survives being small, which is the only test that matters here.
 */
function buildStarGeometry() {
  const R = 0.42;
  const r = 0.14;
  const half = 0.03;
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad));
  }
  const pos = [];
  const push = (ax, ay, az, bx, by, bz, cx, cy, cz) =>
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  for (let i = 0; i < 8; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 8];
    // Two faces, front and back, wound opposite so both are lit.
    push(0, 0, half, a.x, a.y, half, b.x, b.y, half);
    push(0, 0, -half, b.x, b.y, -half, a.x, a.y, -half);
    // And the rim, which is what catches the key edge-on.
    push(a.x, a.y, half, a.x, a.y, -half, b.x, b.y, half);
    push(b.x, b.y, half, a.x, a.y, -half, b.x, b.y, -half);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Built in XY, flown along -Z: stand it up so its face is across the flight
  // path rather than along it.
  g.rotateY(Math.PI / 2);
  return g;
}

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
    this.matBolt = new THREE.MeshBasicMaterial({ color: 0xff9a4d });
    // WHITE, and the colour arrives per instance. MeshBasicMaterial multiplies
    // its own colour by the instance colour, so a white base lets a star be
    // exactly the hue `weapons.js` names — steel for the default, cyan for a
    // power — without a material per weapon or a partitioned pool.
    //
    // Unlit like the bolts and the lock, and for the same reason: fog lives in
    // the lit shader, and a projectile that hazes out at the ranges where
    // knowing about it is worth most is a projectile that is not doing its job.
    this.matStar = new THREE.MeshBasicMaterial({ color: 0xffffff });

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

    // ── TWO PROJECTILE MESHES, ONE PROJECTILE POOL ─────────────────────────
    //
    // A star and a bolt are different objects and have to be: the thing coming
    // AT you and the thing leaving your hand are the two most important shapes
    // in the frame to tell apart at a glance, and they are often on screen at
    // the same time travelling in opposite directions. Two geometries, two
    // materials, two draw calls.
    //
    // The RECORDS are one pool all the same, because every projectile in this
    // game is the same simulation — fly, steer at the thing you were given,
    // test a swept sphere, expire — and splitting the pool would have been two
    // copies of that loop to keep in step. Each record carries which mesh it
    // draws into, so a weapon can change shape without the simulation knowing.
    this.starGeo = buildStarGeometry();
    this.starMesh = new THREE.InstancedMesh(this.starGeo, this.matStar, BOLTS_CAP);
    this.starMesh.frustumCulled = false;
    this.starMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Per-instance colour, so a powered star is cyan without a second material
    // and without the pool having to be partitioned by weapon.
    this.starMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(BOLTS_CAP * 3).fill(1), 3);
    this.starMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.starMesh);

    this.boltGeo = buildBoltGeometry();
    this.boltMesh = new THREE.InstancedMesh(this.boltGeo, this.matBolt, BOLTS_CAP);
    this.boltMesh.frustumCulled = false;
    this.boltMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.boltMesh);
    this.meshes = { star: this.starMesh, bolt: this.boltMesh };

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
        /** The weapon row this shot was fired with. */
        w: null,
        /** Who fired it — a Fighter, or a drone record. For the kill credit. */
        from: null,
        /** 'star' or 'bolt': which mesh this record draws into. */
        shape: 'star',
        /** True when the target is a drone, false when it is a Fighter. */
        atDrone: true,
        squad: null,
        spin: 0,
      });
    }
    /** @type {typeof DEFAULT_RULES} */
    this.rules = { ...DEFAULT_RULES };
    /** Scratch for `Roster.foesOf`, which writes into a list it is handed. */
    this._foes = [];
    /** Scratch for the live-drone list the gun walks. */
    this._cand = [];
    this._col = new THREE.Color();
    this._spinQ = new THREE.Quaternion();
    this._muzzle = new THREE.Vector3();
    /** The fighter the lock ring and the single-player HUD follow. */
    this.lead = null;
    /** (drone, weapon, by) => void — a hit that did not finish it. */
    this.onDroneHit = null;
    /** (originVec3, drone, target) => void */
    this.onEnemyShot = null;
    this.cooldown = 0;
    /** The drone the gun is currently pointed at, or null. Read by the HUD. */
    this.target = null;

    /** Optional hooks for audio and particles. Kept out of this file's imports. */
    this.onShot = null;      // (originVec3) => void
    this.onKill = null;      // (drone, squad) => void
    this.stats = { shots: 0, kills: 0, sweeps: 0, escaped: 0, points: 0,
      enemyShots: 0, enemyHits: 0, damage: 0 };

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
    if (rand() >= SQUAD_CHANCE * this.rules.density) return;

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
        // HEALTH, AND A COOLDOWN THAT STARTS SOMEWHERE RANDOM.
        //
        // The stagger matters more than it looks. A chevron built on one frame
        // with every cooldown at zero fires a volley on the first frame any of
        // them is in range — four bolts on the same tick, which a player reads
        // as one unavoidable event rather than as four machines each deciding
        // to shoot. Spreading the initial phase across the whole cooldown turns
        // the same four shots into a rhythm you can ride through.
        hp: this.rules.droneHp,
        maxHp: this.rules.droneHp,
        hurt: 0,
        squad: null,
        cd: rand() * WEAPONS.blaster.cooldown,
        /** Which fighter this one is shooting at, or null. */
        aggro: null,
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
  /**
   * THE CORRIDOR TEST, as one function that does not know who is shooting.
   *
   * This used to take a Rider and walk the drones. It now takes a SHOOTER —
   * anything with a position and a heading — a list of CANDIDATES and a WEAPON
   * row, which is the same test with the three things it actually depends on
   * named. That is what makes a drone able to run it against the players, and
   * what will make a rival able to run it against another rider without a line
   * of this changing.
   *
   * NEAREST VALID WINS, with one tie-break: a target that already has a
   * projectile on the way is taken last. Without it a four-shot burst at a
   * squad puts all four shots into the first drone, kills it four times over
   * and leaves the formation intact — which looks, from outside, exactly like
   * a gun that cannot aim.
   *
   * @param {{x:number,z:number,heading:{x:number,z:number}}} shooter
   * @param {Array<{x:number,y:number,z:number,inbound:number}>} candidates
   * @param {import('./weapons.js').Weapon} w
   */
  static acquire(shooter, candidates, w) {
    // Horizontal heading. A heading carries the slope in Y, and a gun aimed
    // along it would shoot at the ground on every steep.
    const hx = shooter.heading.x;
    const hz = shooter.heading.z;
    const hl = Math.hypot(hx, hz) || 1;
    const fx = hx / hl;
    const fz = hz / hl;

    let best = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      const dx = c.x - shooter.x;
      const dz = c.z - shooter.z;
      // Along the heading, and across it. The cross term is a 2-D wedge
      // product, which is the perpendicular distance for a unit forward.
      const along = dx * fx + dz * fz;
      if (along < w.rangeMin || along > w.rangeMax) continue;
      const across = Math.abs(dx * fz - dz * fx);
      const width = w.aimNear + (w.aimFar - w.aimNear) * (along / w.rangeMax);
      if (across > width) continue;
      const score = along + (c.inbound ?? 0) * w.rangeMax;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /**
   * THE DRONES' OWN TEST, which is NOT the corridor one.
   *
   * A drone is a turret. It has no heading the player can see and no line it
   * is committed to, so running it through `acquire` would be modelling a
   * constraint that does not exist and the player would read the misses as the
   * enemy being bad at its job for no visible reason. What a drone has instead
   * is REACH and a choice of whom to shoot.
   *
   * WHICH ENTITY. This is the method the whole `fighters.js` layer exists for.
   * It asks the roster for everyone not on its own team, takes the nearest one
   * still standing, and keeps it — the `aggro` field — until that target dies
   * or leaves reach. Keeping it matters in two player: a drone that re-chose
   * the nearest every frame would swing between two riders carving past each
   * other and land its shots on neither.
   *
   * In PVP this is unchanged. The roster hands back whoever is not on the
   * drone's team, which is both riders, and the nearest one gets shot at.
   */
  _droneAcquire(d, foes) {
    const w = WEAPONS.blaster;
    const held = d.aggro;
    if (held && held.alive) {
      const hx = held.x - d.x;
      const hy = held.y - d.y;
      const hz = held.z - d.z;
      if (hx * hx + hy * hy + hz * hz <= w.rangeMax * w.rangeMax) return held;
    }
    let best = null;
    let bestD = w.rangeMax * w.rangeMax;
    for (const f of foes) {
      const dx = f.x - d.x;
      const dy = f.y - d.y;
      const dz = f.z - d.z;
      const q = dx * dx + dy * dy + dz * dz;
      // rangeMin keeps a drone from firing at something already on top of it,
      // where a bolt at 2.6 rad/s of guidance cannot turn and would simply
      // sail past. It is the mirror of the player's own RANGE_MIN.
      if (q < w.rangeMin * w.rangeMin || q > bestD) continue;
      bestD = q;
      best = f;
    }
    d.aggro = best;
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

  /** Every live drone in reach of `p`, as a flat list the gun can walk. */
  _liveNear(p, back, fwd, into) {
    into.length = 0;
    for (const squad of this._near(p, back, fwd)) {
      if (squad.done) continue;
      for (const d of squad.drones) if (!d.dead) { d.squad = squad; into.push(d); }
    }
    return into;
  }

  /**
   * One fighter's gun, for one frame.
   *
   * THE WEAPON COMES OFF THE FIGHTER, which is the whole of what a power gate
   * changes. Nothing here knows what `keen` or `storm` are; it reads a row.
   */
  _fighterFire(dt, f) {
    if (!f.alive) { f.target = null; return; }
    const w = f.gun;
    this._liveNear(f.p, 0, 2, this._cand);
    const target = Combat.acquire(f, this._cand, w);
    f.target = target ?? null;
    if (f === this.lead) this.target = f.target;
    if (!target || f.cd > 0) return;

    // ONE SHOT PER TARGET, AND THE GUN HOLDS ITS FIRE RATHER THAN DOUBLING UP.
    // This was 56% of shots missing in the first measured ride, and the cause
    // reads as an aiming fault but is not one: a single drone held in the
    // corridor was shot every 0.36 s while the first bolt was still 0.4 s from
    // arriving, so roughly every other shot arrived at something already dead.
    //
    // NOW GATED ON HEALTH RATHER THAN ON ZERO. A drone with 3 HP takes three
    // stars, so "one at a time" would have made it un-killable at any range
    // where the flight time exceeds the cooldown. The rule the measurement
    // actually supports is "do not fire more shots than it takes to kill it",
    // and with 1 HP drones that is identical to the old behaviour — which is
    // why chill vibe's measured numbers survive this change.
    const needed = Math.ceil(target.hp / w.damage);
    if (target.inbound >= needed) return;

    f.cd = w.cooldown;
    for (let k = 0; k < w.burst; k++) {
      // A FAN, not a shotgun: the burst is spread laterally about the aim so
      // one pass of a chevron can put a star into three different drones. Each
      // projectile is still guided at the SAME target — the spread decides
      // where it starts, the guidance decides where it ends, and a star that
      // misses its drone has a real chance of meeting the next one along.
      const off = w.burst > 1 ? (k - (w.burst - 1) * 0.5) * w.spreadDeg * Math.PI / 180 : 0;
      if (!this._launch(f, target, w, off, target.squad, true)) break;
    }
    f.shots += w.burst;
    this.stats.shots += w.burst;
    if (f === this.lead) this.lockFlash = 1;
    if (this.onShot) this.onShot(this._muzzle, f);
  }

  /** Every drone in reach, deciding whether to shoot and at whom. */
  _droneFire(dt, roster) {
    if (!this.rules.hostile) return;
    const w = WEAPONS.blaster;
    const foes = roster.foesOf(TEAM.DRONE, this._foes);
    if (!foes.length) return;
    // Bands BEHIND as well as ahead: a drone the rider has already passed is
    // still a drone, and a fight you can ride out of by simply not looking
    // back is not a fight. `_near` is cheap — five slots off an array.
    for (const squad of this._near(roster.lead?.p ?? foes[0].p, 2, 2)) {
      for (const d of squad.drones) {
        if (d.dead) continue;
        d.cd -= dt;
        const target = this._droneAcquire(d, foes);
        if (!target || d.cd > 0) continue;
        d.cd = w.cooldown;
        if (!this._launch(d, target, w, 0, null, false)) continue;
        this.stats.enemyShots++;
        if (this.onEnemyShot) this.onEnemyShot(this._muzzle, d, target);
      }
    }
  }

  /**
   * Put one projectile in the air. Returns false when the pool is dry.
   *
   * @param {object} from a Fighter or a drone record
   * @param {object} at the thing to steer at
   * @param {import('./weapons.js').Weapon} w
   * @param {number} yawOff radians of lateral offset on the launch bearing
   * @param {object|null} squad the kill's squad, when the target is a drone
   * @param {boolean} atDrone which kind of thing `at` is
   */
  _launch(from, at, w, yawOff, squad, atDrone) {
    const b = this.bolts.find((x) => !x.live);
    if (!b) return false;             // 24 in the air at once is already absurd
    b.live = true;
    b.life = w.life;
    b.target = at;
    b.squad = squad;
    b.w = w;
    b.from = from;
    b.shape = w.shape;
    b.atDrone = atDrone;
    b.spin = 0;
    at.inbound = (at.inbound ?? 0) + 1;
    const up = from.muzzleUp ?? MUZZLE_UP;
    b.pos.set(from.x, (from.y ?? 0) + up, from.z);
    this._muzzle.copy(b.pos);
    // Launched straight at the target rather than along the heading. The muzzle
    // is on a board that is leaning, and a projectile that left along the board
    // and then turned would read as a correction — as the gun having missed and
    // recovered. Guidance is here for the target's own movement and the
    // shooter's, not to cover an aiming error the gun did not make.
    b.dir.set(at.x - b.pos.x, (at.drawnY ?? at.y) - b.pos.y, at.z - b.pos.z).normalize();
    if (yawOff !== 0) {
      const c = Math.cos(yawOff);
      const sn = Math.sin(yawOff);
      const dx = b.dir.x;
      const dz = b.dir.z;
      b.dir.set(dx * c - dz * sn, b.dir.y, dx * sn + dz * c).normalize();
    }
    if (b.shape === 'star') {
      const col = this._col.set(w.color);
      this.starMesh.instanceColor.setXYZ(b.gi, col.r, col.g, col.b);
      this.starMesh.instanceColor.needsUpdate = true;
    }
    return true;
  }

  /** @returns {Array} one event per drone killed this frame. */
  _stepBolts(dt) {
    const events = [];
    for (const b of this.bolts) {
      if (!b.live) continue;
      const w = b.w;
      b.life -= dt;
      const t = b.target;
      // "Still a target" means two different things for the two kinds, and
      // conflating them was the one real hazard in generalising this loop: a
      // drone is spent when `dead`, a fighter when its health reaches zero.
      const liveTarget = t && (b.atDrone ? !t.dead : t.alive);

      // Guidance. Toward the target if it is still there, otherwise straight on
      // until it expires — a star whose drone died to an earlier shot flies off
      // down the mountain, which is honest and costs nothing.
      if (liveTarget) {
        this._tmp.set(t.x - b.pos.x, (t.drawnY ?? t.y) - b.pos.y, t.z - b.pos.z);
        const d = this._tmp.length();
        if (d > 1e-4) {
          this._tmp.divideScalar(d);
          // Lerp toward the desired direction at the weapon's own turn rate,
          // which for small angles is what a slerp costs without the
          // trigonometry.
          b.dir.addScaledVector(this._tmp.sub(b.dir), Math.min(1, w.turn * dt)).normalize();
        }
      }

      const step = w.speed * dt;
      b.pos.addScaledVector(b.dir, step);

      if (liveTarget) {
        const dx = t.x - b.pos.x;
        const dy = (t.drawnY ?? t.y) - b.pos.y;
        const dz = t.z - b.pos.z;
        // Swept, not sampled: at 135 m/s a star covers 2.25 m in a 60 Hz frame
        // and 9 m in a stalled one, and a point test would pass clean through a
        // 1.6 m target. The approach is nearly radial, so closing distance plus
        // the step is a sufficient and very cheap sweep.
        const r = w.hitR + step;
        if (dx * dx + dy * dy + dz * dz < r * r) {
          const ev = b.atDrone ? this._hitDrone(b, t) : this._hitFighter(b, t);
          if (ev) events.push(ev);
          this._retire(b, t);
          continue;
        }
      }

      if (b.life <= 0) {
        this._retire(b, t);
        continue;
      }

      // Oriented along flight. Both geometries are built along -Z so the basis
      // can be used as-is; a star additionally spins about that axis, which is
      // the only reason it reads as a star rather than as a dash when it is
      // edge-on to the camera.
      this._tmp.copy(b.pos).add(b.dir);
      this._basis.lookAt(b.pos, this._tmp, this._up);
      this._q.setFromRotationMatrix(this._basis);
      if (w.spin) {
        b.spin += w.spin * dt;
        this._e.set(0, 0, b.spin);
        this._q.multiply(this._spinQ.setFromEuler(this._e));
      }
      this._s.setScalar(w.scale);
      this._m.compose(b.pos, this._q, this._s);
      this.meshes[b.shape].setMatrixAt(b.gi, this._m);
    }
    this.starMesh.instanceMatrix.needsUpdate = true;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    return events;
  }

  /** Take a projectile out of the air, wherever it was drawn. */
  _retire(b, t) {
    b.live = false;
    if (t) t.inbound = Math.max(0, (t.inbound ?? 0) - 1);
    this._hideIn(b.shape, b.gi);
    b.target = null;
  }

  /**
   * A star arrives at a drone.
   *
   * HEALTH IS WHY THIS IS NOT JUST `_kill`. A hit that does not finish a drone
   * still has to say so, or a three-hit kill is two frames where the player's
   * aim visibly connected and nothing happened — which reads as the gun being
   * broken, not as the enemy being tough. `onDroneHit` is what main hangs a
   * spark and a tick on.
   */
  _hitDrone(b, d) {
    if (b.from && b.from.hits !== undefined) b.from.hits++;
    d.hp -= b.w.damage;
    if (d.hp > 0) {
      d.hurt = 0.18;
      if (this.onDroneHit) this.onDroneHit(d, b.w, b.from);
      return null;
    }
    if (b.from && b.from.kills !== undefined) b.from.kills++;
    return this._kill(d, b.squad ?? d.squad, b.from);
  }

  /**
   * A bolt arrives at a fighter.
   *
   * The damage goes through `Fighter.damage`, which owns the grace window and
   * decides whether it lands at all — see `fighters.js`. A bolt that arrives
   * during someone's grace is still retired, because a projectile left in the
   * air would connect again on the very next frame and the window would buy
   * nothing.
   */
  _hitFighter(b, f) {
    const landed = f.damage(b.w.damage, b.from);
    if (landed) {
      this.stats.enemyHits++;
      this.stats.damage += b.w.damage;
    }
    return null;
  }

  _hideIn(shape, gi) {
    this._m.makeScale(0, 0, 0);
    this.meshes[shape].setMatrixAt(gi, this._m);
  }

  _kill(d, squad, by = null) {
    d.dead = true;
    d.aggro = null;
    d.pop = POP_TIME;
    const points = KILL_BASE + KILL_STEP * squad.killed;
    squad.points += points;
    squad.killed++;
    squad.last = d;
    this.stats.kills++;
    this.stats.points += points;
    if (this.onKill) this.onKill(d, squad, by);
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
    this.starMesh.visible = v;
    this.boltMesh.visible = v;
    if (!v) this.lock.visible = false;
  }

  /**
   * What kind of fight this is. A mode's call — see DEFAULT_RULES.
   *
   * Rebuilds the ring, because `droneHp` and `density` are both baked into
   * bands at build time and a mode that changed them without replacing what is
   * already on the hill would get one stretch of the old rules.
   */
  setRules(rules, p = null) {
    Object.assign(this.rules, rules);
    if (p !== null) this.reset(p);
  }

  /**
   * @param {number} dt seconds
   * @param {import('./rider.js').Rider} rider
   * @param {boolean} live false on the title and results screens: the drones
   *   still stream and recycle past the attract rider, but nothing fires and
   *   nothing is scored.
   * @returns {Array} kill and sweep events — see `_kill` and `_resolve`.
   */
  update(dt, roster, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    // THE RING FOLLOWS THE LEAD FIGHTER. In two player the two riders are
    // metres apart and either would do; the choice is stated rather than
    // implied so that when the field of rivals arrives — spread over hundreds
    // of metres — it is obvious that this is the line to revisit.
    const lead = roster.fighters.find((f) => f.alive) ?? roster.fighters[0];
    this.lead = lead;
    if (!lead) return [];
    this._ring(lead.p);
    let events = [];
    if (live) {
      this.target = null;
      for (const f of roster.fighters) this._fighterFire(dt, f);
      this._droneFire(dt, roster);
      events = this._stepBolts(dt);
      events = events.concat(this._resolve(lead));
    } else {
      this.target = null;
      for (const f of roster.fighters) f.target = null;
      // Projectiles in the air when a run ends still have to land or expire,
      // or the pool leaks across the results screen and the next run opens
      // with a short magazine.
      this._stepBolts(dt);
    }
    this._animate(dt, lead);
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
        // Facing WHOEVER IT IS SHOOTING AT, and the lead rider when it is
        // shooting at nobody. In two player a drone that tracked player one
        // while firing at player two would be lying about where its attention
        // is, and the pod's facing is the only tell the player has before the
        // bolt leaves.
        const watch = d.aggro && d.aggro.alive ? d.aggro : rider;
        let yaw = Math.atan2(watch.x - d.x, watch.z - d.z) + Math.PI;

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

        // A HIT THAT DOES NOT KILL STILL HAS TO LAND. With health on the
        // drones, most connecting shots do not finish one, and without a tell
        // the player's aim visibly works and nothing happens — which reads as
        // the gun being broken rather than as the enemy being tough. A short
        // flinch: the pod jumps in scale and snaps back.
        if (d.hurt > 0) {
          d.hurt = Math.max(0, d.hurt - dt);
          scale *= 1 + d.hurt * 1.6;
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
      this._hideIn('star', b.gi);
      this._hideIn('bolt', b.gi);
    }
    this.starMesh.instanceMatrix.needsUpdate = true;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    this.cooldown = 0;
    this.target = null;
    this.lockFlash = 0;
    this.lock.visible = false;
    this.t = 0;
    this.stats = { shots: 0, kills: 0, sweeps: 0, escaped: 0, points: 0,
      enemyShots: 0, enemyHits: 0, damage: 0 };
  }

  dispose() {
    this.scene.remove(this.pods);
    this.scene.remove(this.eyes);
    this.scene.remove(this.starMesh);
    this.scene.remove(this.boltMesh);
    this.scene.remove(this.lock);
    this.lockGeo.dispose();
    this.lock.material.dispose();
    this.podGeo.dispose();
    this.eyeGeo.dispose();
    this.boltGeo.dispose();
    this.starGeo.dispose();
    this.matPod.dispose();
    this.matEye.dispose();
    this.matBolt.dispose();
    this.matStar.dispose();
  }
}
