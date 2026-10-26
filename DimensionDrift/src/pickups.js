// Drift lines — the one pickup this game can have without becoming a different
// game.
//
// THE TEST A PICKUP HAS TO PASS HERE. Speed is not granted: it is the component
// of gravity along wherever the board is pointing, minus drag, minus what the
// edge scrubs. So every turn is a negotiation between where you need to be and
// how fast you are willing to arrive. A coin that pays for touching it does not
// enter that negotiation — it is a position-matching mechanic, and this is the
// one game in the app that deliberately is not one.
//
// So these are not placed at points. They are placed along the LINE OF STEEPEST
// DESCENT, integrated straight out of `Terrain.gradient` — which in this game's
// physics is exactly the line of maximum acceleration. A drift line is the
// mountain telling you, in the only currency it has, where the fastest metres
// are. Riding one is not "collecting"; it is committing to the fall line for
// thirty or forty metres, with a gate coming.
//
// That makes the reward a WAGER rather than a pickup:
//
//   - a mote is worth more the more of the same chain you have already taken
//     (14, 21, 28, 35 …), and a chain taken whole pays 1.4x on top, so bailing
//     out halfway is worth very little and finishing is worth about three gates;
//   - the chain is 24–42 m long, which at riding speed is 1.0–1.7 s. Gates are
//     2.05 s apart at the tightest. A full line therefore fits inside one gate
//     interval — but only if you commit AT ONCE. Dither and you have both lost
//     the tail of the chain and arrived at the gate late and off line. The cost
//     is decisiveness, which is the only thing this game actually charges for;
//   - and following one physically speeds you up, because steepest descent is
//     where the acceleration is. You are paid twice for the dangerous line and
//     you pay for it at the next gate. That is the negotiation, priced.
//
// The score lands on the CHAIN, not on the mote — one event, one combo step —
// for the same reason `rider.js` scores a carve on the release: "a turn only
// counts once it is finished, so the reward lands on the release, which is where
// the payoff actually feels like it is". Awarding per mote would also have run
// the combo multiplier up eight steps a chain and wrecked an economy this file
// does not own.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
//   - It never places a mote outside |u| = 0.62 * HALF. Gates reach 0.48 * HALF,
//     the inside trees start at 0.80 and the rocks at 0.74, and the recovery
//     margin beyond the rim (1.10–1.50) is documented in `scatter.js` as the
//     band that once turned one mistake into four wipeouts. Nothing here can
//     bait a rider into any of them: the reward space and the hazard space are
//     disjoint by construction, and the risk is entirely in the line you give up
//     rather than in a tree someone hung a prize on.
//   - It knows nothing about gate positions and asks nothing of the course.
//     Gates are placed predictively against the real rider and drift metres from
//     any reference run, so anything anchored to them would be anchored to a
//     guess. These are anchored to the terrain, which is the one thing in this
//     world that cannot move.
//   - It is not a hazard and has no collider. Motes stand 0.55–1.55 m off the
//     snow against the gate poles' 2.2 m, so a mote inside a gate opening is
//     harmless if the two ever coincide.
//
// Placement is a pure function of (band index, seed), banded and recycled the
// way `scatter.js` does it, so a run re-ridden from the same seed has the same
// lines in the same places and the pool costs one draw call whatever the length.

import * as THREE from 'three';
import { makeLitMaterial } from './lit.js';
import { HALF, VIEW, meshHeight } from './mountain.js';
import { mulberry32, range } from './rng.js';

// A band is sixty metres and carries at most one line, and a line may only start
// in the band's first twelve. A line is at most (CHAIN_MAX-1) * STEP = 42 m end
// to end, so two consecutive bands CANNOT produce overlapping lines however the
// dice fall — the geometry guarantees at least six metres of clear snow between
// the tail of one and the head of the next. Two chains braided through each
// other is not twice the reward; it is one smear of motes with no line in it,
// and the whole point of this pickup is that it draws a line.
const BAND = 60;
const START_JITTER = 12;
const CHAIN_CHANCE = 0.45;        // one drift line every ~130 m of descent
const CHAIN_MIN = 5;
const CHAIN_MAX = 8;
const STEP = 6.0;                 // metres between motes along the line

// The reward space, and nothing beyond it. 0.62 * HALF is 19.8 m: outside the
// widest gate (0.48) so a line out there is a genuine detour, and a long way
// inside the first thing that can hurt you (0.74).
const U_LIMIT = HALF * 0.62;
const U_START_MIN = 3.5;
const U_START_MAX = 17;

const HOVER = 1.05;               // metres of air under a mote's centre
const BOB = 0.16;
const GRAB_R = 2.0;               // lateral grab radius, metres
// Vertical window, measured from the rider's board to the mote's centre. Riding
// past one is +1.05, so a low pop off a roller still takes them and the top of a
// kicker's arc does not vacuum a whole chain off the landing below.
const GRAB_UP = 2.6;
const GRAB_DOWN = 1.0;
const RESOLVE_MARGIN = 8;         // metres past the last mote before a chain settles
// Clearance either side of a kicker's lip: its longest run-up is 14 m and its
// landing runs 46 m, plus a few metres of air on each end.
const KICKER_CLEAR_BEFORE = 22;
const KICKER_CLEAR_AFTER = 56;

// What a collection is worth, BEFORE the game's score multiplier. The k-th mote
// taken from a chain — by count taken, not by which one it was, so cutting
// across a line to snatch its tail pays what snatching one mote should.
//
// The spread is the design. A full eight-mote line pays 308, about three gates
// or one very good carve, for forty metres of committed and accurate riding.
// Two motes out of that same line pay 25. Sampling a drift line is worth almost
// nothing; riding one is worth a lot. That ratio is the wager, and it is the
// only number in this file that a balance pass should need to touch.
const MOTE_BASE = 10;
const MOTE_STEP = 5;
const FULL_BONUS = 1.4;           // multiplier for taking every mote in a chain

const POP_TIME = 0.28;
const POP_RISE = 1.7;
const GROW_BASE = 0.88;           // instance scale of a line's first mote
const GROW_STEP = 0.055;          // …and how much each one down the line gains

// How hard the line is allowed to follow the terrain. The gradient on the piste
// carries a metre of fine relief and the transverse rollers on top of the bowl's
// own lateral push, so raw steepest descent zigzags; blending it in bends the
// line without letting it wander. The floor on |dz| keeps a line from turning
// into a traverse in a hollow — a drift line must always be going DOWN, or it
// stops meaning what it means.
const DIR_BLEND = 0.45;
const MIN_DZ = 0.35;

/** Score for `taken` motes out of `total`, before the game's multiplier. */
export function chainValue(taken, total) {
  let v = 0;
  for (let k = 0; k < taken; k++) v += MOTE_BASE + MOTE_STEP * k;
  return Math.round(taken > 0 && taken === total ? v * FULL_BONUS : v);
}

/** Published so the HUD and any par calculation can price a run without guessing. */
export const PICKUP_VALUE = {
  MOTE_BASE, MOTE_STEP, FULL_BONUS, CHAIN_MIN, CHAIN_MAX, CHAIN_CHANCE, BAND,
  /** Points a whole average chain is worth, before the multiplier. */
  fullChain: chainValue(Math.round((CHAIN_MIN + CHAIN_MAX) / 2), Math.round((CHAIN_MIN + CHAIN_MAX) / 2)),
  /** Chains a run of `metres` contains, on average. */
  chainsIn: (metres) => (metres / BAND) * CHAIN_CHANCE,
};

/**
 * An irregular bipyramid: eight triangles, flat shaded, built once and shared.
 *
 * A shard rather than a ball because the whole population is a dotted line seen
 * end-on from a chase camera — at 100 m a mote is five pixels, and five pixels
 * of faceted crystal reads as a glint while five pixels of sphere reads as dirt.
 * The built-in lean matters for the same reason: an upright bipyramid spun about
 * Y presents the same silhouette four times a turn and looks static, while a
 * leaning one sweeps its facets through the sun and twinkles for free.
 */
function buildMoteGeometry(rand) {
  const g = new THREE.OctahedronGeometry(0.30, 0).toNonIndexed();
  const pos = g.attributes.position;
  // Jitter per unique vertex position so shared corners stay welded and the
  // facets stay flat — the same trick `scatter.js` uses on its rocks.
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) {
      j = [range(rand, 0.74, 1.06), range(rand, 1.40, 2.00), range(rand, 0.74, 1.06)];
      seen.set(key, j);
    }
    pos.setXYZ(i, pos.getX(i) * j[0], pos.getY(i) * j[1], pos.getZ(i) * j[2]);
  }
  g.rotateZ(0.30);
  g.rotateX(0.17);
  g.computeVertexNormals();
  return g;
}

/** Squared distance from (px,pz) to the segment (ax,az)-(bx,bz). */
function segDist2(ax, az, bx, bz, px, pz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px;
  const qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}

export class Pickups {
  /**
   * @param {import('./mountain.js').Terrain} terrain
   * @param {THREE.Scene} scene
   * @param {import('./mood.js').Mood} mood
   * @param {number} seed the run's one seed — placement is a pure function of it
   */
  constructor(terrain, scene, mood, seed) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x1c9e5b) >>> 0;
    this.bands = Math.ceil(VIEW / BAND) + 2;
    this.capacity = this.bands * CHAIN_MAX;

    // Through the shared lighting model, like everything else that is not snow,
    // so a mote sits in the same air as the mountain. Two departures from the
    // scenery's settings, both deliberate:
    //   - emissive 0.50, because this is the one object in the frame that is
    //     supposed to be brighter than the snow it stands on. `lit.js` gates
    //     direct sun by altitude above the fall line, so at first light the
    //     valley floor takes no beam at all; a pale unlit prop down there is a
    //     grey smudge, which is precisely how the marker poles once failed.
    //     Emissive is what lets a collectible stay legible through the whole
    //     mood arc without inventing a second sun for it.
    //   - snowCap 0, gloss 70. Snow does not settle on wind-blown snow, and the
    //     tight lobe is what makes the facets glint as they turn.
    // The hue is cold. The reference frame carries 41 warm pixels in total and
    // every one of them is a gate flag; a cyan-white against blue-shadowed snow
    // separates from the ground without claiming a colour the frame does not own.
    this.material = makeLitMaterial(mood, {
      // ELECTRIC LIME, GLOWING -- the survivor of a four-round audition. Ice
      // (0.072 worst-case fog contrast) vanished in bright fog; green won the
      // numbers and lost the look; gold was prettier and no clearer; the dark
      // stroke worked but was cut on sight. Lime at emissive 1.25 was the one
      // that read through the bluebird whiteout at the needles in the live
      // side-by-side, and its own worst hour (sunrise, 0.304) still beats every
      // other candidate's best. Chosen by Elad: "whichever you think is best."
      color: 0xc8ff3a, wrap: 0.30, gloss: 70, specular: 0.55, emissive: 1.25, snowCap: 0,
    });
    /** Append to main's `litMaterials` so the shared sun/fog reaches them. */
    this.materials = [this.material];

    this.geometry = buildMoteGeometry(mulberry32(this.seed ^ 0x5f3a71));
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    this.geometry.setAttribute('aTint', this.tint);
    scene.add(this.mesh);

    // ── THE STROKE ──────────────────────────────────────────────────────────
    // An inverted hull: the same crystal 16% larger, back faces only, flat deep
    // navy, UNLIT AND UNFOGGED on purpose -- the game's fog lives in the lit
    // shader, so a Basic material is immune by construction, and immunity is
    // the point: in a bright whiteout the rim stays dark when the fill washes
    // out ("sometimes you cannot see the pickups well enough" -- the needles).
    // It shares the fill's instanceMatrix buffer, so every move, spawn, shrink
    // and despawn is mirrored for free and the whole thing is one extra draw.
    // DISABLED by Elad's call after seeing it -- the colour route won. Kept
    // behind the flag because it is the structural answer (a two-tone object
    // has no camouflage hour) if a pure colour ever fails again.
    const MOTE_STROKE = false;
    if (MOTE_STROKE) {
      const hullGeo = buildMoteGeometry(mulberry32(this.seed ^ 0x5f3a71));
      hullGeo.scale(1.16, 1.16, 1.16);
      this.hull = new THREE.InstancedMesh(
        hullGeo,
        new THREE.MeshBasicMaterial({ color: 0x14213d, side: THREE.BackSide }),
        this.capacity,
      );
      this.hull.frustumCulled = false;
      this.hull.instanceMatrix = this.mesh.instanceMatrix;
      scene.add(this.hull);
    }

    /** One chain (or null) per band slot, indexed by `bandIdx % bands`. */
    this.chains = new Array(this.bands).fill(null);
    this.baseBand = -1e9;
    this.t = 0;

    /** Optional per-mote hook for audio/particles: `(mote, chain) => void`. */
    this.onMote = null;
    this.stats = { motes: 0, chains: 0, full: 0, points: 0 };

    this._px = null;
    this._pz = null;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._grad = { gx: 0, gz: 0 };
  }

  // ── Placement ─────────────────────────────────────────────────────────────

  /** Does [pa, pb] touch any kicker's run-up or landing? */
  _nearKicker(pa, pb) {
    for (const k of this.terrain.kickers) {
      if (k.p + KICKER_CLEAR_AFTER > pa && k.p - KICKER_CLEAR_BEFORE < pb) return true;
    }
    return false;
  }

  /**
   * The chain a band carries, or null. A pure function of the band index and the
   * seed: a band that scrolls off and comes back is rebuilt identically, nothing
   * about a line has to be remembered, and the ring may be filled in any order.
   */
  _buildBand(bandIdx) {
    const slot = ((bandIdx % this.bands) + this.bands) % this.bands;
    const base = slot * CHAIN_MAX;
    const rand = mulberry32((this.seed ^ (bandIdx * 0x27d4eb2d)) >>> 0);

    for (let i = 0; i < CHAIN_MAX; i++) this._hide(base + i);
    this.chains[slot] = null;
    if (rand() >= CHAIN_CHANCE) return;

    const n = CHAIN_MIN + Math.floor(rand() * (CHAIN_MAX - CHAIN_MIN + 1));
    const p0 = bandIdx * BAND + rand() * START_JITTER;
    // Never across a kicker. A line drawn up a ramp reads well enough, but the
    // motes past the lip sit on the landing while the rider is four metres above
    // it, so a line the game has just launched you over is a line it has made
    // uncollectable. Kickers are ~250 m apart and lines ~130 m, so this costs a
    // line here and there and keeps the two features out of each other's way —
    // the same separation `course.js` already keeps between kickers and gates.
    if (this._nearKicker(p0, p0 + (n - 1) * STEP)) return;
    let u = (rand() < 0.5 ? -1 : 1) * range(rand, U_START_MIN, U_START_MAX);
    let z = -p0;
    let x = this.terrain.xAt(u, z);
    // Start pointed straight down the hill and let the mountain bend it.
    let dx = 0;
    let dz = -1;

    const motes = [];
    for (let k = 0; k < n; k++) {
      // meshHeight, not terrain.height. Off the centre line the mesh columns are
      // metres apart and the drawn surface sags below the analytic one; a mote
      // hung at the analytic height floats over every convex rise, which is the
      // finding that already cost this project a round on its trees.
      const y = meshHeight(this.terrain, x, z) + HOVER;
      // A mote grows down its own chain, as well as brightening. Escalating
      // value is invisible unless the geometry says so, and at 90 km/h a size
      // ramp is read before a number is: the line visibly gets worth more the
      // further you commit down it.
      motes.push({
        x, z, y, p: -z, k, size: GROW_BASE + GROW_STEP * k,
        taken: false, gone: false, pop: 0, gi: base + k,
      });

      // Steepest descent — which in this game's physics is the direction that
      // buys the most speed, which is the whole reason the line is worth riding.
      const g = this.terrain.gradient(x, z, this._grad);
      let sx = -g.gx;
      let sz = -g.gz;
      const sl = Math.hypot(sx, sz) || 1;
      sx /= sl;
      sz /= sl;
      dx += (sx - dx) * DIR_BLEND;
      dz += (sz - dz) * DIR_BLEND;
      if (dz > -MIN_DZ) dz = -MIN_DZ;
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;

      x += dx * STEP;
      z += dz * STEP;
      let uu = this.terrain.offsetOf(x, z);
      if (Math.abs(uu) > U_LIMIT) {
        uu = Math.sign(uu) * U_LIMIT;
        x = this.terrain.xAt(uu, z);
      }
    }

    const chain = {
      motes, n, taken: 0, points: 0, done: false,
      endP: motes[motes.length - 1].p,
      last: null,
    };
    this.chains[slot] = chain;

    for (const m of motes) {
      // The tail of a line is brighter than its head, because the tail is where
      // the money is. It is the only readout a player gets at 90 km/h of the
      // fact that the value escalates, and it costs one instance attribute.
      const b = 0.80 + 0.062 * m.k;
      this.tint.setXYZ(m.gi, b * 0.94, b, b * 1.08);
    }
  }

  _hide(gi) {
    this._m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(gi, this._m);
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

  // ── Frame ─────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt seconds
   * @param {import('./rider.js').Rider} rider
   * @param {boolean} live false on the title/results screens: the lines still
   *   stream and recycle behind the attract rider, but nothing is collected and
   *   nothing is scored.
   * @returns {Array} one event per RESOLVED chain — see the class comment.
   */
  /**
   * Switch the drift lines off entirely, for a mode that has no use for them.
   *
   * NOT the same as `live: false`, which only stops them being COLLECTED — the
   * bands still build and the motes still draw, so a race would be riding
   * through a currency it cannot spend. The race has no clock, and the motes
   * feed the clock; leaving them visible would be an invitation to detour for
   * nothing, and they would compete with the speed gates for the same glance.
   */
  setEnabled(v) {
    this.enabled = v;
    this.mesh.visible = v;
  }

  update(dt, rider, live = true) {
    if (this.enabled === false) return [];
    this.t += dt;
    this._ring(rider.p);
    const events = live ? this._collect(rider) : [];
    this._animate(dt);
    this._px = rider.x;
    this._pz = rider.z;
    return events;
  }

  _collect(rider) {
    const events = [];
    const rx = rider.x;
    const rz = rider.z;
    // Swept against the previous position, not sampled at it. The simulation is
    // handed real elapsed time rather than a clamped dt — deliberately, because
    // clamping desynchronises the world from the music — so a stalled frame can
    // move the rider six metres, and a point test would drive straight through a
    // whole chain and score none of it.
    let ax = this._px ?? rx;
    let az = this._pz ?? rz;
    if ((ax - rx) * (ax - rx) + (az - rz) * (az - rz) > 900) { ax = rx; az = rz; }

    const band = Math.floor(rider.p / BAND);
    // A line starts in the first 12 m of its band and is at most 42 m long, so
    // it never leaves the band that owns it. One band either side is enough, and
    // two behind covers a chain the rider is only now riding out of.
    for (let b = band - 2; b <= band + 1; b++) {
      const slot = ((b % this.bands) + this.bands) % this.bands;
      const chain = this.chains[slot];
      if (!chain || chain.done) continue;
      for (const m of chain.motes) {
        if (m.taken) continue;
        const dy = m.y - rider.y;
        if (dy > GRAB_UP || dy < -GRAB_DOWN) continue;
        if (segDist2(ax, az, rx, rz, m.x, m.z) > GRAB_R * GRAB_R) continue;
        m.taken = true;
        m.pop = POP_TIME;
        chain.points += MOTE_BASE + MOTE_STEP * chain.taken;
        chain.taken++;
        chain.last = m;
        this.stats.motes++;
        if (this.onMote) this.onMote(m, chain);
      }
      // A line settles when it is finished or when the rider is past its end.
      if (chain.taken === chain.n || rider.p > chain.endP + RESOLVE_MARGIN) {
        chain.done = true;
        if (chain.taken > 0) {
          const full = chain.taken === chain.n;
          const points = Math.round(full ? chain.points * FULL_BONUS : chain.points);
          this.stats.chains++;
          this.stats.points += points;
          if (full) this.stats.full++;
          events.push({
            type: 'drift',
            taken: chain.taken,
            total: chain.n,
            full,
            points,
            label: full ? 'clean line' : `drift ${chain.taken}/${chain.n}`,
            color: full ? '#d6ff5a' : '#edffa8',
            world: new THREE.Vector3(chain.last.x, chain.last.y, chain.last.z),
          });
        }
      }
    }
    return events;
  }

  _animate(dt) {
    for (let slot = 0; slot < this.bands; slot++) {
      const chain = this.chains[slot];
      if (!chain) continue;
      for (const m of chain.motes) {
        if (m.gone) continue;
        let scale = m.size;
        let lift = 0;
        let spin = this.t * 1.15 + m.k * 0.7;
        if (m.pop > 0) {
          // A burst, not a fade: the shared shader is opaque by design, so the
          // one honest way to make a mote leave is to blow it up and collapse it.
          m.pop = Math.max(0, m.pop - dt);
          const s = 1 - m.pop / POP_TIME;
          scale = m.size * (1 - s * s) * (1 + Math.sin(Math.PI * s));
          lift = s * POP_RISE;
          spin += s * 9;
          if (m.pop <= 0) {
            m.gone = true;
            this._hide(m.gi);
            continue;
          }
        }
        // The bob travels DOWN the chain rather than pulsing in unison, which is
        // what turns a row of dots into a current running down the hill.
        const bob = Math.sin(this.t * 2.0 - m.k * 0.85) * BOB;
        this._v.set(m.x, m.y + bob + lift, m.z);
        this._q.setFromAxisAngle(this._up, spin);
        this._s.set(scale, scale, scale);
        this._m.compose(this._v, this._q, this._s);
        this.mesh.setMatrixAt(m.gi, this._m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Place the whole ring at a distance down the mountain. Call from `_seekTo`. */
  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
    this.tint.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.t = 0;
    this._px = null;
    this._pz = null;
    this.stats = { motes: 0, chains: 0, full: 0, points: 0 };
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
