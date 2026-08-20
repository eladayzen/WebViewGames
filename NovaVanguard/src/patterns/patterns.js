// Bullet patterns (§5.5). POC ships B1 and B2 (§10, POC-5).
//
// Every pattern DECLARES its guaranteed aisle so /systems/constraints.js can
// verify it (§9.3), and every pattern respects three floors (§5.3):
//
//   * Downward velocity <= the active mode's pattern descent cap. The scroll
//     counts against that budget in Mode S. That is a binding TUNING RULE,
//     not a physics claim -- an air bullet is genuinely in the air frame, but
//     the downward optical flow of the whole ground plane measurably shortens
//     the read. Do not "optimise" it away for air projectiles.
//   * A continuously traversable gap of at least AISLE_MIN (173 px), which
//     must also be REACHABLE: at the moment the pattern commits, the nearest
//     aisle edge is within LATERAL_MAX * (timeToImpact - 0.25 s) of the
//     player. A gap the player physically cannot get to is a violated aisle.
//   * A moving aisle travels at most AISLE_MOVE_MAX (420 px/s) -- half the
//     player's lateral top speed -- so following it is a committed lean, not
//     a chase.
//
// "The references let patterns degenerate into 'find the one pixel gap.' That
// is not survivable on a balance board and is forbidden here."

import {
  PATTERNS,
  PLAYABLE_X,
  AISLE_MIN,
  AISLE_MOVE_MAX,
  LATERAL_ONLY_TEST_Y,
  BULLET,
  BOSS,
  INPUT,
  FX,
  DESIGN_W,
  DESIGN_H,
  BANDS,
  levelAt,
} from '../data/tuning.js';
import { cfg } from '../core/mode.js';
import { alloc, liveCount } from '../core/state.js';

import { lockedShooters, craftEmitters } from '../enemies/enemies.js';
import { bossEmitters } from '../enemies/boss.js';

const _shooters = [];

// Golden-angle stride, advanced once per spawned orb, so consecutive orbs in a
// volley breathe out of phase with each other (FX.enemyBulletPulse). Advanced
// in spawn order, which the seeded scenario makes deterministic -- so the two
// framing modes still render frame-identical content, which §0.1's whole A/B
// depends on.
let _pulseSeq = 0;

/** Bullet spawn respecting the simultaneous-bullet density cap (§5.3). The
 *  cap is a floor of the pacing contract, so it is enforced at the spawner
 *  rather than trusted to authoring: an over-budget volley is silently
 *  trimmed rather than allowed through. */
function spawnOrb(w, x, y, vx, vy, r, patternId) {
  if (liveCount(w.enemyBullets) >= w.caps.bullets) return null;
  const b = alloc(w.enemyBullets);
  if (!b) return null;
  b.alive = true;
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  // Trade bullet count for bullet size: dense-looking but individually
  // trackable. If a pattern needs more bullets to feel dangerous, it is the
  // wrong pattern (§5.3).
  b.r = Math.max(w.caps.minBulletRadius, r);
  b.pattern = patternId;
  b.counted = false;
  _pulseSeq += FX.enemyBulletPulse.spawnPhaseStride;
  b.phase = _pulseSeq % (Math.PI * 2);
  return b;
}

// ---------------------------------------------------------------------------
// B1 -- Sparse aimed lob
// ---------------------------------------------------------------------------
// "3-5 fat orbs from scattered craft, aimed at the player's x AT TIME OF FIRE,
// staggered 0.4 s apart. Move and it misses; the aisle is everywhere but where
// you were." Its aisle is not authored geometry -- the whole frame minus the
// orbs' own footprint is traversable -- so it declares a wide constant.

function createB1(owner) {
  return {
    id: 'B1',
    def: PATTERNS.B1,
    owner: owner || null,
    cooldown: 1.2,
    burst: 0,
    burstT: 0,
    aisle: { x: DESIGN_W * 0.5, w: PATTERNS.B1.guaranteedAisle, active: false },
    update(w, dt) {
      const d = this.def;
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burstT += d.staggerS;
          this.burst--;
          fireB1Orb(w, d, this.owner);
        }
        return;
      }
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.cooldown = volleyInterval(w, this);
        this.burst = d.orbs;
        this.burstT = 0;
      }
    },
  };
}

/**
 * Per-craft cadence skew (ENEMY.vary), for an OWNED emitter only.
 *
 * WHAT THIS IS ALLOWED TO CHANGE, and it is a short list on purpose: WHEN the
 * next volley fires. Never how many orbs it contains, never how wide its aisle
 * is, never how fast it descends. §5.3's guarantees are proved per PATTERN by
 * /systems/constraints.js at boot, so anything that varied the geometry per
 * craft would be a pattern the validator cannot see -- which is exactly the kind
 * of thing that ships broken. Shifting the clock leaves every authored
 * guarantee true volley by volley, and the runtime bullet-cap assertion covers
 * the aggregate.
 *
 * An UNOWNED (wave-level) emitter has no craft to take a skew from and keeps the
 * authored interval, which is right: it is the wave's rhythm, not a craft's.
 */
function cadenceOf(owner) {
  return owner && owner.cadenceMul ? owner.cadenceMul : 1;
}

/**
 * How long until this emitter's next volley.
 *
 * Three multipliers over the authored interval, and each one exists for a
 * reason that is written down somewhere else:
 *
 *   * the owner's per-craft cadence skew (ENEMY.vary) -- so two Emitters in a
 *     formation are not a metronome played twice;
 *   * the LEVEL's fire-rate multiplier -- Amit, from the board: "level 1 has
 *     far too many projectiles on screen, it's too hard". Level one is the
 *     teaching level and his first run is the benchmark, so it fires slower.
 *     §5.7 sanctions per-level difficulty scaling and this is the same kind of
 *     lever as the per-level HP table beside it;
 *   * the BOSS multiplier -- "the boss fight needs fewer projectiles too".
 *
 * NONE OF THEM TOUCHES A FLOOR. Interval is when a volley fires, never how many
 * orbs it contains, how wide its aisle is or how fast it descends -- so every
 * §5.3 guarantee /systems/constraints.js proves per pattern is untouched, volley
 * by volley, exactly as the per-craft cadence skew already was.
 */
function volleyInterval(w, st) {
  const level = levelAt(w.surfaceIndex).fireRateMul || 1;
  const boss = st.boss ? BOSS.fireRateMul : 1;
  return st.def.volleyIntervalS * cadenceOf(st.owner) * level * boss;
}

/** Where a volley comes from. An OWNED emitter (an Emitter craft, a boss pod)
 *  fires from its owner, which is what lets the player see the source and
 *  decide to remove it. An unowned one is the wave's, and picks a random
 *  locked craft -- §5.5's "3-5 fat orbs from SCATTERED craft". */
function sourceFor(w, owner) {
  if (owner) return owner;
  const shooters = lockedShooters(w, _shooters);
  if (!shooters.length) return null;
  return shooters[Math.floor(Math.random() * shooters.length)];
}

function fireB1Orb(w, d, owner) {
  const e = sourceFor(w, owner);
  if (!e) return;
  const m = cfg();
  const vy = m.patternDescentTuned;

  // Aimed at the player's x at time of fire. The DOWNWARD component is fixed
  // at the mode's tuned descent speed and the lateral component is derived
  // from it -- which is what keeps an aimed shot inside the approach cap no
  // matter where the player is standing.
  const dx = w.player.x - e.x;
  const dy = Math.max(120, w.player.y - e.y);
  let vx = (dx / dy) * vy;
  const maxVx = d.maxAimRatio * vy;
  vx = Math.max(-maxVx, Math.min(maxVx, vx));

  spawnOrb(w, e.x, e.y + 26, vx, vy, d.orbRadius, 'B1');
}

// ---------------------------------------------------------------------------
// B2 -- Lateral sweep fan
// ---------------------------------------------------------------------------
// "A fan from one formation section sweeps sideways across the width at
// <= 420 px/s. One authored gap >= AISLE_MIN travels with the fan."
//
// Built as a short series of sparse rows whose gap advances between rows, so
// the aisle is visibly the same aisle moving -- rather than as a dense wall
// with a hole, which is the shape that degenerates into pixel-hunting.
//
// Deliberately NOT a diagonal staircase curtain: that is on the do-not-port
// list because in 16:9 it collapses into an instantaneous wall with no
// readable aisle (§5.5).

/**
 * B2 / B2T -- the lateral sweep fan (§5.5), REWRITTEN AS AN ACTUAL FAN.
 *
 * THE BUG THIS REPLACES, reported by Amit from the board: "projectiles are
 * being fired even when the enemies are gone or dead. So projectiles are being
 * fired from thin air."
 *
 * It was not an ownership leak -- the emitter did die with its craft, and the
 * ownership audit confirms it. It was the GEOMETRY. The old emitter spawned a
 * row spanning the entire playable width at the owner's altitude, so a single
 * Emitter craft sitting at x = 1271 gave birth to orbs at x = 116, 416, 566,
 * 716... Every orb except the one or two beside the craft was, literally, born
 * in empty space with no source. Measured on a level-one run: 74 orbs per clear
 * appeared with no craft within 70 px of them.
 *
 * §5.5 asks for something quite different and much better: "A fan from ONE
 * FORMATION SECTION sweeps sideways across the width [...] One authored gap
 * >= AISLE_MIN travels with the fan." A fan, from a section -- not a curtain
 * across the frame. So every orb now leaves the owner's own hull with a lateral
 * velocity, and the fan spreads as it falls. Three things follow:
 *
 *   * EVERY ORB HAS A VISIBLE SOURCE. You can see which craft is shooting at
 *     you, which is the entire reason §6.2 made B2 the Emitter's own pattern --
 *     "kill the Emitter and the sweep genuinely stops" only means something if
 *     the player can tell which craft to kill.
 *   * DENSITY DROPS. A full-width row at 300 px spacing was ~6 orbs; a 5-slot
 *     fan minus its gap is 4. Amit's other report -- "level 1 has far too many
 *     projectiles on screen" -- is substantially this bug.
 *   * THE AISLE GETS WIDER AND PROVABLE. Omitting one fan slot leaves a gap of
 *     two adjacent separations at the player's line, and both the width and its
 *     travel speed are computed from vx and the fall time rather than declared.
 *
 * NOT THE DIAGONAL STAIRCASE CURTAIN (§5.5's do-not-port list). That is a wall
 * of diagonals with no readable aisle; this is five shallow diagonals from one
 * point with a 500 px hole in the middle. The distinction is the aisle, and the
 * aisle is asserted at boot.
 */

/** Where a fan is born: the owner's hull, just below it so the orbs are not
 *  drawn underneath the craft. An unowned fan (none are authored today) falls
 *  back to a live locked craft, so even that case has a real muzzle. */
function fanMuzzle(w, st) {
  const o = st.owner || sourceFor(w, null);
  if (!o) return null;
  return { x: o.x, y: o.y + FAN_MUZZLE_DY };
}

/** How far below its owner's origin a fan is born. Exported so
 *  /systems/constraints.js sweeps the same altitudes the game fires from. */
export const FAN_MUZZLE_DY = 30;

/** Lateral velocity of fan slot `i` of `n`, from -spread to +spread. `spreadVx`
 *  is derived per shot by fanGeometry, never authored. */
function fanVx(d, i, spreadVx) {
  if (d.fanOrbs <= 1) return 0;
  return spreadVx * ((2 * i) / (d.fanOrbs - 1) - 1);
}

/**
 * The fan's geometry for one shot, from the AUTHORED SEPARATION AT THE PLAYER'S
 * LINE (`fanSepPx`) rather than from an authored lateral velocity.
 *
 * That inversion is the whole point and it is worth stating plainly. The aisle
 * is a distance measured where the player is standing, so it has to be the
 * authored quantity; spreading at a fixed px/s instead makes it a function of
 * the fall time, which changes with the muzzle's altitude (a boss fires from
 * y=370, a formation craft from y=254) and with the mode's descent speed (240
 * vs 130 px/s). Authoring the velocity put the boss's fan at a 158 px aisle in
 * Mode A -- under §5.3's 173 px floor, in a pattern whose whole contract is that
 * floor. Authoring the separation makes the aisle mode- and altitude-invariant
 * by construction, and leaves the validator something it can actually prove.
 *
 * `spreadVx` is what falls out instead, and it is clamped: an implausibly low
 * muzzle would otherwise demand a near-horizontal spray to hit its separation.
 * The clamp binding is a real (if currently unreachable) degradation of the
 * aisle, so it is reported in `clamped` and the validator asserts it never binds
 * at any altitude the game can actually fire from.
 */
export function fanGeometry(d, spawnY, vy) {
  const fallPx = LATERAL_ONLY_TEST_Y * DESIGN_H - spawnY;
  const t = Math.max(0.1, fallPx / vy);
  const n = d.fanOrbs;
  // Half the fan's total span, divided by the fall time.
  const wanted = n > 1 ? (d.fanSepPx * (n - 1) * 0.5) / t : 0;
  const spreadVx = Math.min(wanted, FAN_SPREAD_VX_MAX);
  const dv = n > 1 ? (2 * spreadVx) / (n - 1) : 0;
  const sep = dv * t;
  // Omitting a run of k slots leaves a hole of (k + 1) separations between the
  // two surviving neighbours, minus their own diameters.
  const gap = sep * ((d.fanGapSlots || 1) + 1) - 2 * d.orbRadius;
  return {
    t,
    sep,
    gap,
    span: sep * (n - 1),
    spreadVx,
    clamped: wanted > FAN_SPREAD_VX_MAX,
  };
}

/** Ceiling on a fan's outermost lateral speed. Never reached from any altitude
 *  the game fires from (asserted in /systems/constraints.js); it exists so a
 *  future low emitter degrades to a narrow fan rather than a horizontal spray
 *  that would leave the frame before it ever reached the player. */
export const FAN_SPREAD_VX_MAX = 340;

function rowIntervalAt(d, rowsFired) {
  if (d.rowIntervalsS && d.rowIntervalsS.length) {
    return d.rowIntervalsS[Math.min(rowsFired, d.rowIntervalsS.length - 1)];
  }
  return d.rowIntervalS;
}

function createFan(id, owner) {
  const def = PATTERNS[id];
  return {
    id,
    def,
    // B2 IS THE EMITTER'S PATTERN (§6.2). When owned, the sweep visibly
    // originates at the craft that is emitting it, which is the whole reason
    // the type reads as something to go and deal with rather than as ambient
    // pressure -- and killing the owner ends the sweep because the emitter
    // instance dies with it.
    owner: owner || null,
    cooldown: 3.0,
    row: 0,
    rowsFired: 0,
    rowT: 0,
    // Which contiguous run of fan slots is omitted. THIS is the aisle.
    gapSlot: 1,
    gapDir: 1,
    aisle: { x: DESIGN_W * 0.5, w: def.guaranteedAisle, active: false },
    update(w, dt) {
      const d = this.def;
      if (this.row > 0) {
        this.rowT -= dt;
        if (this.rowT <= 0) {
          const interval = rowIntervalAt(d, this.rowsFired);
          this.rowT += interval;
          this.row--;
          this.rowsFired++;
          emitFanRow(w, this, d);
          advanceGap(w, this, d, rowIntervalAt(d, this.rowsFired));
        }
        if (this.row === 0) this.aisle.active = false;
        return;
      }
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.cooldown = volleyInterval(w, this);
        commitFan(w, this, d);
      }
    },
  };
}

/**
 * Move the aisle one fan slot -- but ONLY if the next row is far enough away in
 * time that the move stays inside §5.3's AISLE_MOVE_MAX.
 *
 * "Patterns that move their aisle must move it no faster than 420 px/s -- half
 * the player's lateral top speed -- so following it is a committed lean, not a
 * chase." B2T fires its rows as two fast pairs with a long beat between them,
 * and shifting the gap across a 0.16 s pair would move it at ~2000 px/s. So the
 * rule polices itself here rather than being authored per pattern: the pair
 * shares one aisle, and the aisle steps between pairs. That is also exactly the
 * rhythm the pattern is for -- two rows through the same hole, then the hole
 * moves.
 */
function advanceGap(w, st, d, nextIntervalS) {
  const m = cfg();
  const muzzle = fanMuzzle(w, st);
  if (!muzzle) return;
  const g = fanGeometry(d, muzzle.y, m.patternDescentTuned);
  if (!nextIntervalS || g.sep / nextIntervalS > AISLE_MOVE_MAX) return;
  const n = d.fanOrbs - (d.fanGapSlots || 1);
  st.gapSlot += st.gapDir;
  if (st.gapSlot < 0) {
    st.gapSlot = 0;
    st.gapDir = 1;
  }
  if (st.gapSlot > n) {
    st.gapSlot = n;
    st.gapDir = -1;
  }
}

/** Commit the volley: choose a REACHABLE starting aisle (§5.3). */
function commitFan(w, st, d) {
  const muzzle = fanMuzzle(w, st);
  if (!muzzle) return;
  const m = cfg();
  const vy = m.patternDescentTuned;
  const g = fanGeometry(d, muzzle.y, vy);

  // Reachability: the aisle's landing x must be within
  // LATERAL_MAX * (timeToImpact - 0.25 s) of the player's current x.
  const reach = Math.max(0, INPUT.lateralMax * (g.t - 0.25));
  const desired = w.player.x;
  // Pick the fan slot whose omitted hole lands nearest to a spot the player can
  // actually get to. The aisle should make them MOVE -- so it is offset from
  // where they are standing -- but never further than they can travel in time.
  const dir = w.player.x > DESIGN_W * 0.5 ? -1 : 1;
  const target = Math.max(
    desired - reach,
    Math.min(desired + reach, desired + dir * DESIGN_W * 0.18)
  );
  let best = 0;
  let bestD = Infinity;
  const n = d.fanOrbs - (d.fanGapSlots || 1);
  for (let s = 0; s <= n; s++) {
    const x = gapLandingX(d, st, muzzle, g, s);
    const dd = Math.abs(x - target);
    if (dd < bestD) {
      bestD = dd;
      best = s;
    }
  }
  st.gapSlot = best;
  st.gapDir = dir;
  st.row = d.rows;
  st.rowsFired = 0;
  st.rowT = 0;
  st.aisle.active = true;
  updateAisleReadout(w, st, d, muzzle, g);
}

/** Where the omitted hole is by the time it reaches the player's line. */
function gapLandingX(d, st, muzzle, g, slot) {
  const k = (d.fanGapSlots || 1);
  // Centre of the omitted run, in slot space.
  const centre = slot + (k - 1) * 0.5;
  const dv = d.fanOrbs > 1 ? (2 * g.spreadVx) / (d.fanOrbs - 1) : 0;
  const vx = -g.spreadVx + dv * centre;
  return muzzle.x + vx * g.t;
}

function updateAisleReadout(w, st, d, muzzle, g) {
  st.aisle.x = gapLandingX(d, st, muzzle, g, st.gapSlot);
  st.aisle.w = Math.max(0, g.gap);
}

function emitFanRow(w, st, d) {
  const m = cfg();
  const vy = m.patternDescentTuned;
  const muzzle = fanMuzzle(w, st);
  if (!muzzle) return;
  const g = fanGeometry(d, muzzle.y, vy);
  updateAisleReadout(w, st, d, muzzle, g);

  const k = d.fanGapSlots || 1;
  const lo = PLAYABLE_X.min * DESIGN_W;
  const hi = PLAYABLE_X.max * DESIGN_W;
  // How long an orb lives before it is retired, so an orb that would leave the
  // playable width can be dropped BEFORE it is fired. §5.1: "no bullet [...]
  // may occupy the margins." Dropping it is the only honest option -- a bullet
  // that vanished mid-flight, or one that bounced, would both be worse than one
  // that was never there. It also thins the fan for a craft near an edge, which
  // is the right answer for density too.
  const life = Math.max(0.1, (BULLET.despawnY * DESIGN_H - muzzle.y) / vy);

  let fired = 0;
  for (let i = 0; i < d.fanOrbs; i++) {
    if (i >= st.gapSlot && i < st.gapSlot + k) continue; // the authored aisle
    const vx = fanVx(d, i, g.spreadVx);
    const endX = muzzle.x + vx * life;
    if (endX < lo || endX > hi) continue;
    spawnOrb(w, muzzle.x, muzzle.y, vx, vy, d.orbRadius, st.id);
    fired++;
  }
  // A muzzle flash at the source, every row. This is the other half of the
  // answer to "fired from thin air": the fan now leaves the craft, and the
  // craft now visibly fires it.
  if (fired && _fx) _fx.muzzle(muzzle.x, muzzle.y);
}

// ---------------------------------------------------------------------------

const FACTORIES = {
  B1: createB1,
  B2: (o) => createFan('B2', o),
  B2T: (o) => createFan('B2T', o),
};

/** One pattern instance. `owner` is optional: an Emitter craft (§6.2) or a
 *  boss pod (§6.4) that the pattern belongs to and dies with. */
export function createEmitter(id, owner) {
  const f = FACTORIES[id];
  return f ? f(owner) : null;
}

export function createEmitters(ids) {
  return ids.map((id) => createEmitter(id, null));
}

// Scratch, reused every frame -- nothing in the hot loop allocates (§9.1).
const _active = [];
const _craft = [];

/**
 * Gather every pattern instance that wants to fire this frame, in PRIORITY
 * ORDER, and update only as many as §5.3's simultaneous-pattern cap allows.
 *
 * There are now three sources -- the wave's own patterns, Emitter craft, and
 * boss pods -- and the cap is a floor of the pacing contract, not a per-source
 * budget. So they compete for the same slots rather than each getting their
 * own, which is what stops "two Emitters plus the wave's B1" from quietly
 * putting three patterns on screen at Normal.
 *
 * Priority is wave -> craft -> boss, and in practice they never contend: the
 * boss phase clears the playfield first, so a boss is only ever competing with
 * its own pods. Within the craft group the order is by formation slot, so
 * which Emitter is firing is stable and legible rather than pool-order noise.
 *
 * The consequence when a wave holds more Emitters than the cap allows is
 * deliberate and good: killing the one that is firing hands the sweep to the
 * next one, so the player has to clear them ALL rather than silencing the
 * wave by removing a single craft. That is the "must be gone after
 * deliberately" property the type was chosen for, applied to the group.
 */
export function collectEmitters(w, out) {
  out.length = 0;
  for (const em of w.director.emitters) out.push(em);
  for (const em of craftEmitters(w, _craft)) out.push(em);
  if (w.boss.active) for (const em of bossEmitters(w, _craft)) out.push(em);
  return out;
}

// The FX facade for this frame. Held module-locally rather than on the world,
// because §9.1 keeps game state plain data and a renderer handle is not that.
let _fx = null;

export function updateEmitters(w, dt, fx) {
  _fx = fx || _fx;
  const limit = w.caps.simultaneousPatterns;
  const list = collectEmitters(w, _active);
  for (let i = 0; i < list.length && i < limit; i++) list[i].update(w, dt);
  // Anything over the cap is not merely skipped -- its aisle is retired too,
  // or a stalled emitter would keep advertising a gap the player can see in
  // the dev guide and the instrumentation would measure a pattern that is not
  // actually firing.
  for (let i = limit; i < list.length; i++) list[i].aisle.active = false;
}

export function updateEnemyBullets(w, dt) {
  const pool = w.enemyBullets;
  const despawnY = 1.02 * DESIGN_H;
  for (let i = 0; i < pool.length; i++) {
    const b = pool[i];
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > despawnY || b.x < -80 || b.x > DESIGN_W + 80) b.alive = false;
  }
}

/** The narrowest currently-active authored aisle, for instrumentation
 *  (§10's "survival rate through the narrowest authored aisle") and for the
 *  dev aisle guide. Walks every source, not just the wave's -- an Emitter's
 *  sweep is exactly the aisle a player is most likely to be pinned by. */
const _aisleScan = [];
export function activeAisle(w) {
  let best = null;
  for (const em of collectEmitters(w, _aisleScan)) {
    if (em.aisle && em.aisle.active) {
      if (!best || em.aisle.w < best.w) best = em.aisle;
    }
  }
  return best;
}

/**
 * Audit every emitter that would fire this frame and report any whose OWNER is
 * dead, missing or no longer the thing that carries it.
 *
 * Amit, from the board: "projectiles are being fired even when the enemies are
 * gone or dead. So projectiles are being fired from thin air."
 *
 * §6.2's whole claim for the Emitter type is that killing the craft removes the
 * pattern -- "kill the Emitter and the sweep genuinely stops, because the thing
 * emitting it is gone" -- and §6.4 makes the same promise for a boss pod. Both
 * are supposed to hold as a property of the OBJECT GRAPH (the emitter instance
 * is dropped with its owner) rather than because some code path remembered to
 * clear a flag. This asserts that the graph actually says so, every half second,
 * so the claim cannot quietly stop being true.
 *
 * Returns a list of human-readable violations rather than logging, so the caller
 * owns the reporting policy (once each, over the Unity bridge on-device).
 */
export function auditEmitterOwnership(w, out) {
  out.length = 0;
  for (const em of collectEmitters(w, _aisleScan)) {
    const o = em.owner;
    // A wave-level emitter legitimately has no owner: it is the wave's rhythm,
    // and B1 picks a live locked craft per orb (see sourceFor).
    if (!o) {
      if (!w.director.emitters.includes(em)) {
        out.push(`unowned emitter '${em.id}' is live but is not the wave's`);
      }
      continue;
    }
    // A craft owner must still be alive AND must still be carrying this exact
    // instance -- identity, not index, so a recycled pool slot cannot pass.
    if (o.alive === false) {
      out.push(`emitter '${em.id}' is live but its owner is dead`);
    } else if (o.type !== undefined && o.emitter !== em) {
      out.push(`emitter '${em.id}' is live but its craft no longer carries it`);
    } else if (o.index !== undefined && o.emitter !== em) {
      out.push(`emitter '${em.id}' is live but its boss pod no longer carries it`);
    }
  }
  return out;
}

/** Every live aisle, for the dev guide (`L`). */
export function activeAisles(w, out) {
  out.length = 0;
  for (const em of collectEmitters(w, _aisleScan)) {
    if (em.aisle && em.aisle.active) out.push(em.aisle);
  }
  return out;
}

export { AISLE_MIN };
