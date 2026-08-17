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
  INPUT,
  FX,
  DESIGN_W,
  DESIGN_H,
  BANDS,
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
        this.cooldown = d.volleyIntervalS * cadenceOf(this.owner);
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

function createB2(owner) {
  return {
    id: 'B2',
    def: PATTERNS.B2,
    // B2 IS THE EMITTER'S PATTERN (§6.2). When owned, the sweep visibly
    // originates at the craft that is emitting it, which is the whole reason
    // the type reads as something to go and deal with rather than as ambient
    // pressure -- and killing the owner ends the sweep because the emitter
    // instance dies with it.
    owner: owner || null,
    cooldown: 3.0,
    row: 0,
    rowT: 0,
    gapX: DESIGN_W * 0.5,
    gapDir: 1,
    aisle: { x: DESIGN_W * 0.5, w: PATTERNS.B2.guaranteedAisle, active: false },
    update(w, dt) {
      const d = this.def;
      if (this.row > 0) {
        this.rowT -= dt;
        if (this.rowT <= 0) {
          this.rowT += d.rowIntervalS;
          this.row--;
          emitB2Row(w, this, d);
          // The gap travels with the fan, at the authored speed -- which is
          // capped below half the player's lateral top speed.
          this.gapX += this.gapDir * d.aisleMoveSpeed * d.rowIntervalS;
          const lo = PLAYABLE_X.min * DESIGN_W + d.guaranteedAisle * 0.5;
          const hi = PLAYABLE_X.max * DESIGN_W - d.guaranteedAisle * 0.5;
          if (this.gapX < lo) {
            this.gapX = lo;
            this.gapDir = 1;
          }
          if (this.gapX > hi) {
            this.gapX = hi;
            this.gapDir = -1;
          }
          this.aisle.x = this.gapX;
        }
        if (this.row === 0) this.aisle.active = false;
        return;
      }
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.cooldown = d.volleyIntervalS * cadenceOf(this.owner);
        commitB2(w, this, d);
      }
    },
  };
}

/** Where B2's rows are born. An owned sweep leaves the owner's own hull (just
 *  below it, so the orbs are not drawn under the craft); an unowned one uses
 *  the authored band position. Either way the value feeds the reachability
 *  arithmetic below, so the aisle stays answerable from wherever it starts. */
function b2SpawnY(st) {
  if (st.owner) return st.owner.y + 30;
  return BANDS.formation.bottom * DESIGN_H * 0.72;
}

/** Commit the volley: choose a REACHABLE starting aisle (§5.3). */
function commitB2(w, st, d) {
  if (!st.owner && !lockedShooters(w, _shooters).length) return;
  const m = cfg();
  const vy = m.patternDescentTuned;

  const spawnY = b2SpawnY(st);
  const timeToImpact = Math.max(0.3, (w.player.y - spawnY) / vy);
  // Reachability: the nearest aisle edge must be within
  // LATERAL_MAX * (timeToImpact - 0.25 s) of the player's current x.
  const reach = Math.max(0, INPUT.lateralMax * (timeToImpact - 0.25));

  st.gapDir = w.player.x > DESIGN_W * 0.5 ? -1 : 1;
  // Start the aisle offset from the player -- the pattern should make them
  // move -- but never further than they can actually get to in time.
  const desired = w.player.x + st.gapDir * DESIGN_W * 0.22;
  const lo = Math.max(
    PLAYABLE_X.min * DESIGN_W + d.guaranteedAisle * 0.5,
    w.player.x - reach
  );
  const hi = Math.min(
    PLAYABLE_X.max * DESIGN_W - d.guaranteedAisle * 0.5,
    w.player.x + reach
  );
  st.gapX = Math.max(lo, Math.min(hi, desired));
  st.aisle.x = st.gapX;
  st.aisle.w = d.guaranteedAisle;
  st.aisle.active = true;
  st.row = d.rows;
  st.rowT = 0;
}

function emitB2Row(w, st, d) {
  const m = cfg();
  const vy = m.patternDescentTuned;
  const y = b2SpawnY(st);
  const lo = PLAYABLE_X.min * DESIGN_W;
  const hi = PLAYABLE_X.max * DESIGN_W;
  const half = d.guaranteedAisle * 0.5 + d.orbRadius;

  // Phase the row so successive rows are offset -- otherwise three identical
  // rows read as one object rather than as a sweep.
  const phase = ((d.rows - st.row) % 2) * d.orbSpacing * 0.5;
  for (let x = lo + phase; x <= hi; x += d.orbSpacing) {
    if (Math.abs(x - st.gapX) < half) continue; // the authored aisle
    // A small lateral drift in the sweep's direction, so the fan visibly
    // fans. Well under the aim ratio, and it does not touch vy.
    spawnOrb(w, x, y, st.gapDir * 26, vy, d.orbRadius, 'B2');
  }
}

// ---------------------------------------------------------------------------

const FACTORIES = { B1: createB1, B2: createB2 };

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

export function updateEmitters(w, dt) {
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

/** Every live aisle, for the dev guide (`L`). */
export function activeAisles(w, out) {
  out.length = 0;
  for (const em of collectEmitters(w, _aisleScan)) {
    if (em.aisle && em.aisle.active) out.push(em.aisle);
  }
  return out;
}

export { AISLE_MIN };
