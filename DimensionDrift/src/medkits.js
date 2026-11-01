// MEDKITS — the only way health comes back.
//
// Skirmish is dead-is-dead: no lives, no respawn, no regeneration. That is a
// good rule and it has one consequence that has to be answered or the mode is
// a countdown wearing a health bar — WITHOUT A SOURCE OF HEALTH, THE LENGTH OF
// A RUN IS FIXED BEFORE IT STARTS. A hundred points of health against drones
// that deal six is at most sixteen hits, and no amount of skill changes the
// arithmetic; it only changes how long they take to arrive. The player's good
// play buys delay, never recovery, and a resource that can only ever go down
// stops being a resource and becomes a timer.
//
// So: kits on the hill. They are the one thing in this game that moves health
// the other way, and everything about them follows from wanting that to be a
// DECISION rather than a top-up.
//
// ── THEY CANNOT BE WASTED ──────────────────────────────────────────────────
//
// A kit ridden through at full health is NOT consumed. It stays standing.
//
// The alternative — take it, overflow, lose it — punishes the player for being
// in good shape at the wrong moment, which is the opposite of what a health
// pickup should teach. It also makes the right play "avoid the medkit", and a
// pickup you are supposed to dodge is a design that has gone somewhere wrong.
// This way the kit is simply there, and it is there for the version of you
// that needs it.
//
// It also means a kit left behind is information rather than a mistake: you
// rode past it because you did not need it.
//
// ── WHERE THEY STAND, AND WHY IT IS THE REWARD BAND ────────────────────────
//
// Inside |u| = 0.62 * HALF, which is `pickups.js`'s limit and is here for
// `pickups.js`'s reason: the inside trees start at 0.80 and the rocks at 0.74,
// so the reward space and the hazard space stay disjoint BY CONSTRUCTION. A
// health pickup that could ask you to ride into a tree would be the single
// worst object in the game — it would charge health for the attempt to recover
// health, and the player would have no way to see that coming.
//
// ── AND THEY ARE COLLECTED BY A FIGHTER, NOT BY THE RIDER ──────────────────
//
// `update` takes the roster, for `fighters.js`'s reason. In two player both
// riders can take kits; in PVP the kit goes to whoever reaches it, which is a
// real contest and needs no code of its own. Nothing here knows what a player
// is.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLitMaterial } from './lit.js';
import { HALF, VIEW, meshHeight } from './mountain.js';
import { mulberry32, range, clamp } from './rng.js';

// ── PLACEMENT ───────────────────────────────────────────────────────────────

/**
 * ONE KIT EVERY ~320 m, which is about one per two squads.
 *
 * Solved against the damage rather than chosen. A squad that is not cleared
 * costs roughly 18 points of health (measured: 32% of bolts land, a squad of
 * two or three gets four or five off); a kit returns 30. So a player who takes
 * every kit and fights badly still loses ground slowly, and one who fights
 * well gains it back. That is the shape a recovery item should have — it
 * rewards the fight, it does not replace it.
 *
 * ANY CHANGE TO `HEAL`, TO `blaster.damage` OR TO SKIRMISH'S `density` BREAKS
 * THAT SUM and this number has to be re-derived.
 */
const BAND = 110;
const CHANCE = 0.34;              // per band, so ~320 m between kits
const START_JITTER = 70;          // where in its band a kit stands

const U_LIMIT = HALF * 0.62;      // 19.8 m — pickups' limit, pickups' reason
const HOVER = 1.35;               // metres of air under the kit's centre
const BOB = 0.22;
const SPIN = 0.9;                 // radians per second

/** Lateral grab radius, and the vertical window. The motes' numbers. */
const GRAB_R = 2.3;
const GRAB_UP = 2.8;
const GRAB_DOWN = 1.2;

/** Health returned. See the cadence note above — the two are one number. */
export const HEAL = 30;

const POP_TIME = 0.3;
const POP_RISE = 2.0;

/**
 * A CROSS, and the shape is doing the work rather than the colour.
 *
 * Every other hue in this game already answers a question — lime is a mote or
 * a time gate, violet a boost, cyan a power, orange hostile, pink and navy the
 * slalom's two sides. There was no seventh colour left that would read at
 * sixty metres, and inventing one would have added a seventh thing to learn.
 *
 * A cross needs no learning. It is the one glyph in this vocabulary that
 * arrives already meaning something, and it survives being eight pixels wide
 * in a way that a colour difference does not.
 *
 * Built as three crossed bars rather than two, so it reads as a cross from any
 * bearing the rider can approach from — including from directly behind, which
 * on a one-way descent is where it is seen last and matters most.
 *
 * AND IT IS BIGGER THAN THE CORE IT SITS ON. The first cut made the bars 1.30
 * long — a half-extent of 0.65 — around a core of radius 1.08, so the entire
 * cross was INSIDE the opaque shell and never rendered. On the hill it came
 * back as a dark green lump with no glyph on it at all, which is the one thing
 * this prop cannot afford to be: the whole argument for a cross is that the
 * shape carries the meaning where no colour was left to.
 *
 * 2.70 against a core of 0.70. The bright arms now stand well clear and the
 * core reads as the dark heart of the cross rather than as a box with
 * something hidden in it.
 */
function buildCrossGeometry(scale = 1) {
  const L = 2.70 * scale;
  const W = 0.62 * scale;
  const a = new THREE.BoxGeometry(L, W, W);
  const b = new THREE.BoxGeometry(W, L, W);
  const c = new THREE.BoxGeometry(W, W, L);
  return mergeGeometries([a, b, c], false);
}

/**
 * The casing the cross sits inside: an open octahedral cage.
 *
 * THE SAME TWO-TONE THE DRONE USES, and for the reason `pickups.js` recorded
 * after a four-round colour audition — a single-colour prop fails somewhere in
 * a five-stop arc, because every hue is at some hour the same brightness as
 * the sky or the ground behind it. A dark lit piece against an unlit bright
 * one has no camouflage hour: when the light goes, the bright half is still
 * the brightest thing in its own silhouette.
 *
 * INSIDE the cross rather than around it. The drone puts its bright eye on a
 * dark hull because the hull is the shape that matters there; here the CROSS
 * is the shape that matters, so the arrangement inverts — bright arms, dark
 * heart. 0.70 against the arms' 1.35 half-extent.
 */
function buildShellGeometry() {
  const g = new THREE.OctahedronGeometry(0.70, 0);
  g.scale(1, 1.05, 1);
  return g;
}

export class Medkits {
  constructor(terrain, scene, mood, seed = 1) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x6d1c2f) >>> 0;
    this.enabled = false;
    this.bands = Math.ceil(VIEW / BAND) + 2;

    // Dark, and emissive 0.10 so it is never a pure silhouette at the darkest
    // stop. snowCap 0 for scatter.js's reason: uSnowCap mixes upward faces
    // toward the GROUND colour and would frost this exactly as it frosted a
    // conifer.
    this.matShell = makeLitMaterial(mood, {
      color: 0x1d3a2e, wrap: 0.26, gloss: 40, specular: 0.45, emissive: 0.10, snowCap: 0,
    });
    /** Append to main's `litMaterials` so the shared sun and fog reach it. */
    this.materials = [this.matShell];

    // UNLIT, like the drone's eye and the lock ring, and for the same reason:
    // the fog lives in the lit shader, and the one element whose whole job is
    // to say "health is over there" must not haze out at the range where that
    // is worth knowing.
    //
    // Mint rather than the motes' acid lime. They are 60 degrees apart in hue
    // and, more usefully, this one is nearly white — at speed the eye sorts
    // these two by saturation long before it sorts them by hue.
    this.matCross = new THREE.MeshBasicMaterial({ color: 0xa8ffd0 });

    this.shellGeo = buildShellGeometry();
    this.crossGeo = buildCrossGeometry(1);
    this.capacity = this.bands;

    this.shells = new THREE.InstancedMesh(this.shellGeo, this.matShell, this.capacity);
    this.shells.frustumCulled = false;
    this.shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3).fill(1), 3);
    // `aTint` is a REQUIRED instanced attribute in lit.js.
    this.shellGeo.setAttribute('aTint', this.tint);
    scene.add(this.shells);

    this.crosses = new THREE.InstancedMesh(this.crossGeo, this.matCross, this.capacity);
    this.crosses.frustumCulled = false;
    // SHARED MATRIX. The cross lives inside the shell and never moves relative
    // to it, so the two meshes are one transform and two draw calls rather than
    // two of each.
    this.crosses.instanceMatrix = this.shells.instanceMatrix;
    scene.add(this.crosses);

    /** @type {Array<object|null>} one kit per band slot, or none. */
    this.kits = new Array(this.bands).fill(null);
    this.baseBand = NaN;
    this.t = 0;
    this.stats = { taken: 0, healed: 0 };
    /** (kit, fighter) => void */
    this.onTake = null;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    /** Last frame's position per fighter, for the swept grab test. */
    this._prev = new Map();
    this.setEnabled(false);
  }

  /** Pure in (band, seed): the same band rebuilt later comes back identical. */
  _buildBand(bandIdx) {
    const slot = ((bandIdx % this.bands) + this.bands) % this.bands;
    this._hide(slot);
    this.kits[slot] = null;
    const rand = mulberry32((this.seed ^ Math.imul(bandIdx + 7919, 0x9e3779b1)) >>> 0);
    if (rand() >= CHANCE) return;

    const p = bandIdx * BAND + range(rand, 0, START_JITTER);
    const u = clamp(range(rand, -U_LIMIT, U_LIMIT), -U_LIMIT, U_LIMIT);
    const z = -p;
    const x = this.terrain.xAt(u, z);
    // meshHeight, not terrain.height. Off the centre line the mesh columns are
    // metres apart and the drawn surface sags below the analytic one, so a
    // hover measured off the analytic height floats higher than it says over
    // every convex rise — the finding that already cost this project a round
    // on its trees, and a round on its drones.
    const y = meshHeight(this.terrain, x, z) + HOVER;
    this.kits[slot] = {
      x, y, z, p, u, slot,
      phase: rand() * Math.PI * 2,
      taken: false, gone: false, pop: 0,
    };
  }

  _hide(slot) {
    this._m.makeScale(0, 0, 0);
    this.shells.setMatrixAt(slot, this._m);
  }

  _ring(p) {
    const want = Math.floor(p / BAND) - 1;
    if (want === this.baseBand) return;
    if (!(want - this.baseBand >= 0) || want - this.baseBand >= this.bands || want < this.baseBand) {
      for (let i = 0; i < this.bands; i++) this._buildBand(want + i);
    } else {
      for (let k = this.baseBand; k < want; k++) this._buildBand(k + this.bands);
    }
    this.baseBand = want;
    this.shells.instanceMatrix.needsUpdate = true;
  }

  /**
   * Anyone who needs it and reaches it takes it.
   *
   * SWEPT AGAINST THE PREVIOUS POSITION, not sampled at it — the motes'
   * finding, and it applies harder here because there is only ever one kit to
   * miss. The simulation is handed real elapsed time on purpose, so a stalled
   * frame can move a rider six metres and a point test would drive straight
   * through the one piece of health on this stretch of mountain.
   */
  _collect(roster) {
    const events = [];
    const band = Math.floor((roster.fighters[0]?.p ?? 0) / BAND);
    for (const f of roster.fighters) {
      if (!f.alive) continue;
      // A KIT RIDDEN THROUGH AT FULL HEALTH IS NOT CONSUMED. See the header:
      // a pickup you are supposed to dodge is a design that went wrong.
      if (f.hp >= f.maxHp) continue;
      const rx = f.x;
      const rz = f.z;
      const prev = this._prev.get(f.id) ?? { x: rx, z: rz };
      let ax = prev.x;
      let az = prev.z;
      if ((ax - rx) * (ax - rx) + (az - rz) * (az - rz) > 900) { ax = rx; az = rz; }
      for (let b = band - 2; b <= band + 1; b++) {
        const kit = this.kits[((b % this.bands) + this.bands) % this.bands];
        if (!kit || kit.taken) continue;
        const dy = kit.y - f.y;
        if (dy > GRAB_UP || dy < -GRAB_DOWN) continue;
        if (segDist2(ax, az, rx, rz, kit.x, kit.z) > GRAB_R * GRAB_R) continue;
        const before = f.hp;
        f.heal(HEAL);
        const got = f.hp - before;
        kit.taken = true;
        kit.pop = POP_TIME;
        this.stats.taken++;
        this.stats.healed += got;
        if (this.onTake) this.onTake(kit, f, got);
        events.push({
          type: 'heal',
          healed: got,
          slot: f.slot,
          label: `+${got} health`,
          color: '#a8ffd0',
          world: new THREE.Vector3(kit.x, kit.y, kit.z),
        });
      }
    }
    for (const f of roster.fighters) this._prev.set(f.id, { x: f.x, z: f.z });
    return events;
  }

  _animate(dt) {
    for (let slot = 0; slot < this.bands; slot++) {
      const kit = this.kits[slot];
      if (!kit || kit.gone) continue;
      let scale = 1;
      let lift = 0;
      if (kit.pop > 0) {
        // A burst, not a fade. The shared lit shader is opaque by design, so
        // the one honest way to make a prop leave is to blow it open and
        // collapse it — the motes' own exit, at this one's size.
        kit.pop = Math.max(0, kit.pop - dt);
        const s = 1 - kit.pop / POP_TIME;
        scale = (1 - s * s) * (1 + Math.sin(Math.PI * s) * 1.3);
        lift = s * POP_RISE;
        if (kit.pop <= 0) { kit.gone = true; this._hide(slot); continue; }
      }
      const bob = Math.sin(this.t * 1.5 + kit.phase) * BOB;
      this._v.set(kit.x, kit.y + bob + lift, kit.z);
      // Turning slowly about its own axis AND tipped, so the cross is never
      // edge-on for long. A plus sign seen exactly along one of its bars is a
      // bar, and at 60 m that is three seconds of the kit not reading as what
      // it is.
      this._e.set(0.38, this.t * SPIN + kit.phase, 0.2);
      this._q.setFromEuler(this._e);
      this._s.setScalar(scale);
      this._m.compose(this._v, this._q, this._s);
      this.shells.setMatrixAt(slot, this._m);
    }
    this.shells.instanceMatrix.needsUpdate = true;
  }

  /**
   * Off for every mode but skirmish.
   *
   * Chill vibe and the race have no health, so a health pickup there is an
   * object that does nothing — which is worse than absent, because the player
   * will ride for it once and learn that the game lies.
   */
  setEnabled(v) {
    this.enabled = v;
    this.shells.visible = v;
    this.crosses.visible = v;
  }

  update(dt, roster, live = true) {
    if (!this.enabled) return [];
    this.t += dt;
    const lead = roster.fighters.find((f) => f.alive) ?? roster.fighters[0];
    if (!lead) return [];
    this._ring(lead.p);
    const events = live ? this._collect(roster) : [];
    this._animate(dt);
    return events;
  }

  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
    this.shells.instanceMatrix.needsUpdate = true;
    this._prev.clear();
    this.t = 0;
    this.stats = { taken: 0, healed: 0 };
  }

  dispose() {
    this.scene.remove(this.shells);
    this.scene.remove(this.crosses);
    this.shells.dispose();
    this.crosses.dispose();
    this.shellGeo.dispose();
    this.crossGeo.dispose();
    this.matShell.dispose();
    this.matCross.dispose();
  }
}

/** Squared distance from point (px,pz) to the segment (ax,az)-(bx,bz). */
function segDist2(ax, az, bx, bz, px, pz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len = vx * vx + vz * vz;
  const t = len > 1e-9 ? clamp((wx * vx + wz * vz) / len, 0, 1) : 0;
  const dx = wx - vx * t;
  const dz = wz - vz * t;
  return dx * dx + dz * dz;
}
