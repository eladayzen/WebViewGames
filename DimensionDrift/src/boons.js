// BOONS — abilities, floating in the air, taken by riding through them.
//
// ── WHY THE GATES WERE NOT ENOUGH ──────────────────────────────────────────
//
// Skirmish already hands out abilities, at every fifth gate (`POWER_EVERY` in
// modes/skirmish.js). That works on a level with a floor, because a gate is
// planted on the floor and a power gate is 1.85x the size of a slalom one, so
// it is legible from sixty metres and it is worth steering for.
//
// IT STOPS WORKING THE MOMENT THE GROUND IS AN EXPERIMENT. The experimental
// levels either do not draw the surface at all or draw it as a holographic
// grid, and a gate planted on a surface like that is either invisible or a row
// of little flags announcing a floor the level is trying not to have. The
// POC's answer was to drop the gates, and the cost was written down honestly
// at the time: "this mode has no reward gates while the ground is off, so no
// weapon and no heal from a gate."
//
// That cost turned out to be the whole problem. A level with no gates has
// nothing on it asking the player to steer — just drones to shoot and a
// surface to not fall off — and "it is not clear what I should do" is the
// correct response to a level that is not asking for anything.
//
// SO THE ABILITIES COME OFF THE FLOOR. A boon hangs in open air at head
// height, which is exactly where a flying level can afford to put something,
// and it works identically on all three ground styles — nothing about it knows
// or cares whether the surface under it is drawn.
//
// ── IT IS THE SAME VOCABULARY, DELIBERATELY ────────────────────────────────
//
// A boon wears the SAME SIGIL the gate wears for the same gift: the star for
// keen, the three-star fan for storm, the heater shield for a barrier. Those
// glyphs are already taught by the gates on every other level, and a pickup
// that invented its own symbols would be a second vocabulary for one set of
// facts. The disc, the ring and the glyph are `makeSigilTexture`'s, built
// there and borrowed here.
//
// ── AND IT PAYS ABILITIES, NEVER HEALTH ────────────────────────────────────
//
// `mend` is deliberately NOT in this pool. The medkits are the health economy
// and their cadence is solved against the drones' damage per kilometre; a
// second airborne source of health would break that sum silently, and the sum
// is the thing keeping "dead is dead" meaningful. Boons change what you can
// DO. Kits change how long you last.
//
// ── COLLECTED BY A FIGHTER, FOR fighters.js's REASON ───────────────────────
//
// `update` takes the roster rather than the rider, so two players both take
// boons, and in PVP a boon goes to whoever reaches it first. Nothing in this
// file knows what a player is.

import * as THREE from 'three';
import { makeLitMaterial } from './lit.js';
import { HALF, VIEW, meshHeight } from './mountain.js';
import { segDist2 } from './medkits.js';
import { mulberry32, range, clamp } from './rng.js';

// ── PLACEMENT ───────────────────────────────────────────────────────────────

/**
 * ONE BOON EVERY ~260 m, which is a little under one per squad.
 *
 * Set against the gates it replaces rather than invented. Skirmish puts a
 * reward at every fifth gate and the gate rate works out near one reward every
 * 300 m, so this lands in the same place — a level that swaps gates for boons
 * plays at the same tempo rather than becoming a different mode.
 *
 * IT IS SLIGHTLY MORE GENEROUS THAN THE GATES, and that is the one deliberate
 * difference. A gate is two poles nine metres apart and you can take it by
 * riding roughly the right line; a boon is a 2.5 m grab radius at head height
 * and you have to actually go to it. Paying a little more often for a tighter
 * ask keeps the expected return about level.
 */
const BAND = 120;
const CHANCE = 0.46;              // per band, so ~260 m between boons
const START_JITTER = 80;          // where in its band a boon hangs

/**
 * ── NARROWER THAN EVERY OTHER PICKUP IN THE GAME, AND IT WAS MEASURED ─────
 *
 * The motes and the medkits sit inside 0.62 of half-width -- 19.8 m -- and the
 * first cut copied that. Measured over 1600 m with the rider steering AT every
 * boon it could see, CLOSEST APPROACH WAS 10.6 m and almost nothing was
 * collected. The arithmetic says why, and it is not a tuning accident:
 *
 *   The board's lateral rate under a committed lean is about 1.75 m/s. A boon
 *   is visible and worth committing to for roughly 250 m, which at 30 m/s is
 *   8.3 seconds -- SO THE WHOLE LATERAL BUDGET IS ABOUT 14 METRES. A pickup
 *   placed 19.8 m off the line is not a hard detour; it is an impossible one,
 *   and a player who commits early and carves perfectly still watches it go
 *   past five metres away.
 *
 * WHY THE OTHER TWO GET AWAY WITH 19.8. A mote is one of six on a LINE that
 * runs down the slope, so missing the first three and catching the last is a
 * normal outcome and still pays. A medkit is forgiving in a different way: it
 * is not consumed when you do not need it, so one you cannot reach today is
 * one you did not have to reach. A boon is a single point that pays once.
 *
 * 0.38 of half-width is 12.2 m, which sits inside the budget with room for the
 * approach to be imperfect. It is still well outside the line the rider is
 * already on, so the DECISION survives -- it just became a decision the board
 * can actually carry out.
 *
 * AND IT IS STILL DISJOINT FROM THE HAZARDS, which is `pickups.js`'s rule and
 * the reason any of these numbers are fractions of half-width: the inside
 * trees start at 0.80 and the rocks at 0.74, so a pickup can never ask the
 * player to ride into something that costs health.
 */
const U_LIMIT = HALF * 0.38;      // 12.2 m

/**
 * HIGHER THAN A MEDKIT, and that is the whole of how the two tell themselves
 * apart at distance. A kit hovers at 1.35 m and a boon at 2.6, so one sits at
 * about knee height off the surface and the other at head height — two objects
 * at the same altitude would have to be sorted by colour and glyph alone, and
 * at sixty metres neither of those has arrived yet.
 *
 * It is also the altitude that still works with the ground not drawn: with no
 * surface to measure against, a thing at 2.6 m reads as "in the air at the
 * height I am flying", which is the only place a flying level can put a pickup
 * and have it look deliberate.
 */
const HOVER = 2.0;
const BOB = 0.26;
const ROLL = 0.55;                // radians per second, about the view axis

/**
 * ── THE GRAB IS WIDE, AND THE FIRST CUT WAS THE WHOLE PROBLEM ─────────────
 *
 * It started at a medkit's 2.3 m with a 3.0/1.6 vertical window, and measured
 * over 1600 m of a rider steering AT the boons it collected ZERO -- worse than
 * the same ride not steering at all. The captures say exactly why, and both
 * reasons are about a point target in a game that has no point control:
 *
 *   CLOSEST APPROACH WAS 4.5 m. The board carves; it does not strafe. A rider
 *   committing to a 10 m lane change arrives with a couple of metres of error
 *   and then sails past, because by the time the error is visible the boon is
 *   already behind them. Missing a thing you spent two hundred metres aiming at
 *   by two metres is the purest form of the complaint this work started from.
 *
 *   AND `dy` SWUNG 2.6 TO 5.9 m ACROSS ONE PASS. A boon's height is baked from
 *   the mesh under ITS OWN u, and the course is a banked bowl -- so a boon out
 *   on the wall genuinely hangs metres above a rider down in the floor. The
 *   vertical window was rejecting good lines for the crime of being on a hill.
 *
 * 4.5 m of lateral forgiveness and a window of +4.5 / -3.0 around a 2.0 m
 * hover. That still leaves the DECISION intact -- the reward band is 40 m wide
 * and you have to choose to cross it -- it just stops charging for the last
 * two metres of a carve nobody can place to the metre.
 *
 * THE HOVER CAME DOWN WITH IT. At 2.6 m a dead-centre pass sat 2.6 m under the
 * ceiling of a 3.0 m window: four hundred millimetres of slack on the one axis
 * the player cannot steer in at all. At 2.0 m inside a 4.5 m window there is
 * two and a half metres either side of a perfect line.
 */
const GRAB_R = 4.5;
const GRAB_UP = 4.5;
const GRAB_DOWN = 3.0;

const POP_TIME = 0.32;
const POP_RISE = 2.4;

/** The face the glyph is drawn on, in metres. */
const DISC_R = 1.30;
/** The dark heart behind it, which is what gives the disc an edge in the air. */
const CORE_R = 0.52;

/**
 * WHAT A BOON MAY BE, and the weights are not the gates' weights.
 *
 * `mend` is absent — see the header. That leaves the three abilities, and the
 * barrier is the commonest of them at 3 of 8:
 *
 *   The two weapons both answer "how do I win the next fight", and between
 *   them they already cover that question twice. The barrier answers the other
 *   one, and it is the only gift in the game that lets a player choose to be
 *   somewhere dangerous on purpose. On a level whose complaint was that there
 *   was nothing to decide, that is the gift worth making common.
 *
 *   The storm stays the rare one at 2 of 8, for the gates' reason: it is the
 *   only gift that changes two things at once, and a level balanced around
 *   having it is a different level.
 */
const POOL = [
  { id: 'shield', weight: 3 },
  { id: 'keen', weight: 3 },
  { id: 'storm', weight: 2 },
];

/** The ring and the glow, per gift. The sigils' own tints. */
const TINT = {
  shield: 0xffd98a,
  keen: 0x2ee6d6,
  storm: 0x7df9ff,
};

function rollBoon(r) {
  let total = 0;
  for (const e of POOL) total += e.weight;
  let x = r * total;
  for (const e of POOL) {
    x -= e.weight;
    if (x < 0) return e.id;
  }
  return POOL[0].id;
}

export class Boons {
  /**
   * @param {object} terrain
   * @param {THREE.Scene} scene
   * @param {object} mood
   * @param {(kind: string) => THREE.Texture} sigilFor the course's own sigil
   *   cache, passed in rather than rebuilt. Thirty textures to say three things
   *   is two megabytes of canvas, and the gates have already paid for these.
   * @param {number} seed
   */
  constructor(terrain, scene, mood, sigilFor, seed = 1) {
    this.terrain = terrain;
    this.scene = scene;
    this.sigilFor = sigilFor;
    this.seed = (seed ^ 0x51a7c3) >>> 0;
    this.enabled = false;
    this.bands = Math.ceil(VIEW / BAND) + 2;

    /**
     * NOT INSTANCED, and that is a departure from every other pool in this
     * game worth justifying.
     *
     * At VIEW 560 and BAND 120 there are seven slots, so there are at most
     * seven boons in the world. Instancing exists to stop a thousand trees
     * being a thousand draw calls; seven pickups are fourteen, which is below
     * the noise floor of a frame that already draws a mountain.
     *
     * AND THE GLYPH IS THE REASON IT CANNOT BE. A boon's face carries a
     * different texture per gift, and an InstancedMesh has one material and
     * therefore one map. Instancing these would mean either a pool per gift —
     * three meshes sized for the worst case so that capacity is three times
     * what can ever be used — or an atlas, which is a UV problem this project
     * has already been bitten by once.
     */
    this.matCore = makeLitMaterial(mood, {
      color: 0x241d33, wrap: 0.24, gloss: 44, specular: 0.5, emissive: 0.10, snowCap: 0,
    });
    /** Append to main's `litMaterials` so the shared sun and fog reach it. */
    this.materials = [this.matCore];

    this.coreGeo = new THREE.OctahedronGeometry(CORE_R, 0);
    // `aTint` is a REQUIRED instanced attribute under USE_INSTANCING in lit.js
    // — and this geometry is NOT instanced, so it must not carry one.
    this.discGeo = new THREE.PlaneGeometry(DISC_R * 2, DISC_R * 2);

    /** @type {Array<object|null>} one boon per band slot, or none. */
    this.boons = new Array(this.bands).fill(null);
    /** @type {Array<{core: THREE.Mesh, disc: THREE.Mesh}>} one rig per slot. */
    this.rigs = [];
    for (let i = 0; i < this.bands; i++) {
      const core = new THREE.Mesh(this.coreGeo, this.matCore);
      core.frustumCulled = false;
      core.visible = false;
      scene.add(core);
      // UNLIT, like the medkit's cross and the drone's eye, and for the same
      // reason: the fog lives in the lit shader, and the one element whose job
      // is to say "an ability is over there" must not haze out at the range
      // where that is worth knowing.
      //
      // DOUBLE-SIDED and facing uphill rather than billboarded, which is the
      // course's own choice for its sigils: two-player renders two cameras, and
      // a quad that turns to face one of them is a quad turned away from the
      // other.
      const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      }));
      disc.frustumCulled = false;
      disc.visible = false;
      scene.add(disc);
      this.rigs.push({ core, disc });
    }

    this.baseBand = NaN;
    this.t = 0;
    this.stats = { taken: 0, byKind: {} };
    /** (boon, fighter) => void */
    this.onTake = null;

    this._v = new THREE.Vector3();
    /** Last frame's position per fighter, for the swept grab test. */
    this._prev = new Map();
    this.setEnabled(false);
  }

  /** Pure in (band, seed): the same band rebuilt later comes back identical. */
  _buildBand(bandIdx) {
    const slot = ((bandIdx % this.bands) + this.bands) % this.bands;
    this._hide(slot);
    this.boons[slot] = null;
    const rand = mulberry32((this.seed ^ Math.imul(bandIdx + 5231, 0x9e3779b1)) >>> 0);
    if (rand() >= CHANCE) return;

    const p = bandIdx * BAND + range(rand, 0, START_JITTER);
    const u = clamp(range(rand, -U_LIMIT, U_LIMIT), -U_LIMIT, U_LIMIT);
    const z = -p;
    const x = this.terrain.xAt(u, z);
    // meshHeight, not terrain.height. Off the centre line the mesh columns are
    // metres apart and the drawn surface sags below the analytic one, so a
    // hover measured off the analytic height floats higher than it says over
    // every convex rise — the finding that already cost this project a round on
    // its trees, a round on its drones and a round on its medkits.
    const y = meshHeight(this.terrain, x, z) + HOVER;
    const gift = rollBoon(rand());
    this.boons[slot] = {
      x, y, z, p, u, slot, gift,
      phase: rand() * Math.PI * 2,
      taken: false, gone: false, pop: 0,
    };
    const rig = this.rigs[slot];
    rig.disc.material.map = this.sigilFor(gift);
    rig.disc.material.needsUpdate = true;
  }

  _hide(slot) {
    const rig = this.rigs[slot];
    if (!rig) return;
    rig.core.visible = false;
    rig.disc.visible = false;
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
  }

  /**
   * Anyone who reaches it takes it.
   *
   * SWEPT AGAINST THE PREVIOUS POSITION, not sampled at it — the motes'
   * finding. The simulation is handed real elapsed time on purpose, so a
   * stalled frame can move a rider six metres and a point test would drive
   * straight through the only ability on this stretch of mountain.
   *
   * AND UNLIKE A MEDKIT, IT IS ALWAYS TAKEN. A kit at full health is left
   * standing because health can overflow and be wasted; an ability cannot —
   * taking one while another is running refreshes or replaces it, which is
   * `givePower`'s documented behaviour and is never worse than not taking it.
   */
  _collect(roster) {
    const events = [];
    const band = Math.floor((roster.fighters[0]?.p ?? 0) / BAND);
    for (const f of roster.fighters) {
      if (!f.alive) continue;
      const rx = f.x;
      const rz = f.z;
      const prev = this._prev.get(f.id) ?? { x: rx, z: rz };
      let ax = prev.x;
      let az = prev.z;
      if ((ax - rx) * (ax - rx) + (az - rz) * (az - rz) > 900) { ax = rx; az = rz; }
      for (let b = band - 2; b <= band + 1; b++) {
        const boon = this.boons[((b % this.bands) + this.bands) % this.bands];
        if (!boon || boon.taken) continue;
        const dy = boon.y - f.y;
        if (dy > GRAB_UP || dy < -GRAB_DOWN) continue;
        if (segDist2(ax, az, rx, rz, boon.x, boon.z) > GRAB_R * GRAB_R) continue;
        boon.taken = true;
        boon.pop = POP_TIME;
        this.stats.taken++;
        this.stats.byKind[boon.gift] = (this.stats.byKind[boon.gift] ?? 0) + 1;
        if (this.onTake) this.onTake(boon, f);
        events.push({
          type: 'boon',
          gift: boon.gift,
          slot: f.slot,
          color: TINT[boon.gift] ?? 0xffffff,
          world: new THREE.Vector3(boon.x, boon.y, boon.z),
        });
      }
    }
    for (const f of roster.fighters) this._prev.set(f.id, { x: f.x, z: f.z });
    return events;
  }

  _animate(dt) {
    for (let slot = 0; slot < this.bands; slot++) {
      const boon = this.boons[slot];
      const rig = this.rigs[slot];
      if (!boon || boon.gone) continue;
      let scale = 1;
      let lift = 0;
      if (boon.pop > 0) {
        // A burst, not a fade — the medkit's exit, at this one's size.
        boon.pop = Math.max(0, boon.pop - dt);
        const s = 1 - boon.pop / POP_TIME;
        scale = (1 - s * s) * (1 + Math.sin(Math.PI * s) * 1.4);
        lift = s * POP_RISE;
        if (boon.pop <= 0) { boon.gone = true; this._hide(slot); continue; }
      }
      const bob = Math.sin(this.t * 1.4 + boon.phase) * BOB;
      this._v.set(boon.x, boon.y + bob + lift, boon.z);
      rig.core.position.copy(this._v);
      rig.disc.position.copy(this._v);
      // The core turns in its own right so the octahedron catches the key, and
      // the face ROLLS rather than turning: a disc that yawed would go edge-on
      // and vanish, which is the one thing a legend may not do.
      rig.core.rotation.set(0.4, this.t * 0.8 + boon.phase, 0.25);
      rig.disc.rotation.set(0, 0, Math.sin(this.t * ROLL + boon.phase) * 0.22);
      rig.core.scale.setScalar(scale);
      rig.disc.scale.setScalar(scale);
      rig.core.visible = this.enabled;
      rig.disc.visible = this.enabled;
    }
  }

  /**
   * Off for every mode but the skirmish family.
   *
   * Chill vibe and the race have no combat, so an ability pickup there is an
   * object that does nothing — which is worse than absent, because the player
   * will ride for it once and learn that the game lies.
   */
  setEnabled(v) {
    this.enabled = v;
    if (!v) for (let i = 0; i < this.bands; i++) this._hide(i);
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
    this._prev.clear();
    this.t = 0;
    this.stats = { taken: 0, byKind: {} };
  }

  dispose() {
    for (const rig of this.rigs) {
      this.scene.remove(rig.core);
      this.scene.remove(rig.disc);
      rig.disc.material.dispose();
    }
    this.rigs.length = 0;
    this.coreGeo.dispose();
    this.discGeo.dispose();
    this.matCore.dispose();
  }
}
