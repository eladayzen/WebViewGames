// Air enemies (§5.5, §6.2). POC ships one type -- the Drone.
//
// Behaviour is composed from three orthogonal pieces (§6.2) so that MVP's
// remaining five types are DATA, not code:
//     entry path  ->  formation slot behaviour  ->  fire pattern
// This file owns the first two; /patterns owns the third.
//
// Three geometry rules are load-bearing and are enforced here rather than
// left to authoring discipline:
//
//   * Squadrons enter from the LEFT or RIGHT EDGE ONLY -- never from the top
//     centre, never straight down (§5.5).
//   * The swoop dips to y = 0.62 -- the TOP of the player band -- and NEVER
//     into it. Galaga's straight-down plunge is not ported at any tier, and
//     neither is the "survivors dive continuously" escalation: both are
//     portrait mechanics that collapse in a shallow frame (§5.5).
//   * Every downward velocity component obeys the mode's approach cap (§5.3),
//     including the entry path's own loop and the swoop's descent. The cap is
//     applied by DERIVING durations from it, not by clamping after the fact --
//     a clamp would silently deform the authored path instead of failing.

import {
  ENEMY,
  enemyDef,
  ENTRY_PACE,
  FORMATIONS,
  FORMATION_X,
  BANDS,
  DESIGN_W,
  DESIGN_H,
  levelHp,
  levelAt,
  levelVariantPatterns,
} from '../data/tuning.js';
import { cfg } from '../core/mode.js';
import { alloc } from '../core/state.js';

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Formation layout -- §5.5. F1 wide grid, F2 flattened lens, F3 chevron arc.
// ---------------------------------------------------------------------------
//
// One function turns a (formation id, slot index) pair into a position, and
// every shape is DATA in tuning.js -- which is what makes "add variety" a table
// edit rather than a code change, and what lets the validator walk every slot
// of every shape at boot instead of trusting the author.
//
// Slot positions are BUILT ONCE at module load, not computed per call. The
// shapes are static authored data, this is read several times per craft per
// frame, and nothing in the hot loop may allocate (§9.1). It also removes the
// shared-scratch-object footgun a per-call version would have.

function buildSlots(f) {
  const out = [];
  if (f.kind === 'ellipse') {
    // Wide ellipse, 4.5:1 in PIXELS -- the ratio is applied to the height
    // radius and then converted, so a 16:9 frame cannot stretch it.
    const ry = f.ryH * DESIGN_H;
    const rx = ry * f.ratio;

    // Spaced by ARC LENGTH, not by angle. On a 4.5:1 ellipse, equal angular
    // steps bunch craft at the two narrow ends -- 42 px apart at this size,
    // well inside two drone radii, so they would visibly overlap and stop
    // being individually countable. Uniform arc length puts every craft ~103 px
    // from its neighbours all the way round. The constraints validator asserts
    // the separation independently, so this cannot silently regress.
    const STEPS = 2048;
    const cum = new Float64Array(STEPS + 1);
    let px = rx * Math.cos(f.theta0);
    let py = ry * Math.sin(f.theta0);
    for (let i = 1; i <= STEPS; i++) {
      const th = f.theta0 + (i / STEPS) * TWO_PI;
      const x = rx * Math.cos(th);
      const y = ry * Math.sin(th);
      cum[i] = cum[i - 1] + Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    const total = cum[STEPS];
    let j = 0;
    for (let s = 0; s < f.count; s++) {
      const target = (s / f.count) * total;
      while (j < STEPS && cum[j + 1] < target) j++;
      const th = f.theta0 + (j / STEPS) * TWO_PI;
      out.push({
        x: f.cx * DESIGN_W + rx * Math.cos(th),
        y: f.cy * DESIGN_H + ry * Math.sin(th),
      });
    }
    return out;
  }

  if (f.kind === 'blocks') {
    // F5 SPLIT PODS -- two blocks at the outer thirds, centre deliberately
    // empty. Slots run block-major (all of the left block, then all of the
    // right), so a squadron filling a contiguous slot range arrives as one
    // whole block rather than as a scatter across both.
    for (const cx of f.blockCx) {
      for (let s = 0; s < f.cols * f.rows; s++) {
        const col = s % f.cols;
        const row = Math.floor(s / f.cols);
        out.push({
          x: (cx + (col - (f.cols - 1) / 2) * f.colGap) * DESIGN_W,
          y: f.rowY[row] * DESIGN_H,
        });
      }
    }
    return out;
  }

  if (f.kind === 'picket') {
    // F4 STAGGERED PICKET -- two rows offset by half a column, so no two craft
    // share a column and there is no vertical line the guns can clear in one
    // pass (§5.5: "reads as depth without using any").
    //
    // Slots run ROW-MAJOR, so a squadron filling a contiguous range arrives as
    // one whole row rather than as a zip through both -- which is what makes the
    // two-squadron waves in level three read as one rank landing and then the
    // other sliding in behind it.
    for (let row = 0; row < f.rows; row++) {
      for (let col = 0; col < f.cols; col++) {
        out.push({
          x: (f.xMin + (f.rowOffset[row] + col) * f.colGap) * DESIGN_W,
          y: f.rowY[row] * DESIGN_H,
        });
      }
    }
    return out;
  }

  if (f.kind === 'chevron') {
    // A very flat V whose APEX IS THE LOWEST POINT -- nearest the player, so it
    // is the natural focus-fire target §5.5 says it should be.
    const n = f.count;
    const mid = (n - 1) / 2;
    for (let s = 0; s < n; s++) {
      const k = 1 - Math.abs(s - mid) / mid;
      out.push({
        x: (f.xMin + ((f.xMax - f.xMin) * s) / (n - 1)) * DESIGN_W,
        y: (f.wingY + (f.apexY - f.wingY) * k) * DESIGN_H,
      });
    }
    return out;
  }

  const span = FORMATION_X.max - FORMATION_X.min;
  for (let s = 0; s < f.cols * f.rows; s++) {
    const col = s % f.cols;
    const row = Math.floor(s / f.cols);
    out.push({
      x: (FORMATION_X.min + (span * col) / (f.cols - 1)) * DESIGN_W,
      y: f.rowY[row] * DESIGN_H,
    });
  }
  return out;
}

const SLOTS = {};
for (const id of Object.keys(FORMATIONS)) SLOTS[id] = buildSlots(FORMATIONS[id]);

/** World-space centre of a formation slot, before the whole-formation drift.
 *  The returned record is SHARED and must be treated as read-only. */
export function slotPosition(formationId, slotIndex) {
  const a = SLOTS[formationId] || SLOTS.F1;
  return a[Math.max(0, Math.min(a.length - 1, slotIndex))];
}

export function slotCount(formationId) {
  return (SLOTS[formationId] || SLOTS.F1).length;
}

/** The whole formation may drift laterally, slowly, within layout bounds. It
 *  never drifts downward out of its band (§5.5) -- note this returns an x
 *  offset only, by construction. */
export function formationDriftX(time) {
  const amp = ENEMY.formationDriftMax * (ENEMY.formationDriftPeriodS / TWO_PI);
  // Cap the excursion so the outermost slot stays inside FORMATION_X.
  const maxExcursion = 0.04 * DESIGN_W;
  const a = Math.min(amp, maxExcursion);
  return a * Math.sin((time / ENEMY.formationDriftPeriodS) * TWO_PI);
}

// ---------------------------------------------------------------------------
// Entry paths (§5.5)
// ---------------------------------------------------------------------------

/**
 * Evaluate the entry path at normalised t in [0,1].
 *
 * A long looping curve: the craft advances across the frame while curling
 * through one full loop, so the transit reads as flight rather than as a
 * slide. That transit IS the pre-lock kill window and the whole basis of the
 * Mode A case -- reading time comes from the fly-in and the hold, not from
 * travel distance -- so the path is deliberately long and fully visible.
 */
function entryPoint(p, t, out) {
  const lin = p.x0 + (p.x1 - p.x0) * t;
  out.x = lin - p.side * p.loopX * Math.sin(TWO_PI * t);
  out.y = p.y0 + p.amp * Math.sin(TWO_PI * t);
}

const _a = { x: 0, y: 0 };
const _b = { x: 0, y: 0 };

function entryHeading(p, t) {
  // Numeric derivative -- cheaper to keep correct than an analytic one that
  // has to be updated every time the path shape changes.
  const e = 0.004;
  entryPoint(p, Math.max(0, t - e), _a);
  entryPoint(p, Math.min(1, t + e), _b);
  return Math.atan2(_b.y - _a.y, _b.x - _a.x);
}

/**
 * Launch one craft into an entry path bound for `slot` of `formationId`.
 * `side` is 'L' or 'R'. `pace` names a sub-range of §5.5's authored 2.5-4.0 s
 * transit window (see ENTRY_PACE) -- squadrons arriving at visibly different
 * speeds is half of what stops successive waves reading as the same wave, and
 * doing it as a sub-range means the variation cannot escape the spec.
 */
/**
 * A stable [0, 1) from a craft's identity, for per-craft presentation variation.
 *
 * Not an RNG and not a substitute for one -- it takes no state and advances
 * nothing, which is precisely the property wanted: the seeded stream in
 * /core/rng.js owns everything that affects GAMEPLAY (entry timing, path shape,
 * side), and this owns things that affect only how a craft looks. Keeping them
 * separate means a change to how varied the fleet looks can never move a number
 * §10's instrumentation is measuring.
 *
 * Integer avalanche mixing (xorshift-multiply), which is enough to keep
 * neighbouring slots from landing on neighbouring values -- a formation whose
 * sizes ramped smoothly left to right would read as a deliberate gradient rather
 * than as variety.
 */
function varyHash(slot, squadron, salt, formationId) {
  let h = (slot | 0) * 374761393 + (squadron | 0) * 668265263 + (salt | 0) * 2246822519;
  // Fold the formation id in so the same slot index looks different in a grid
  // than it does in a chevron.
  const f = formationId || '';
  for (let i = 0; i < f.length; i++) h = (h ^ f.charCodeAt(i)) * 2654435761;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

export function spawnEntering(w, rng, side, slot, squadron, formationId, pace, type) {
  const e = alloc(w.enemies);
  if (!e) return null;

  const sideSign = side === 'L' ? 1 : -1;
  const t = ENEMY.entry;
  const m = cfg();
  const def = enemyDef(type);

  const y0 = rng.range(t.yRange[0], t.yRange[1]) * DESIGN_H;
  const amp = m.entryLoopAmp * DESIGN_H;
  const band = ENTRY_PACE[pace] || ENTRY_PACE.normal;
  const span = t.durationS[1] - t.durationS[0];
  const dur = rng.range(
    t.durationS[0] + span * band[0],
    t.durationS[0] + span * band[1]
  );

  // The loop's own vertical excursion is a downward velocity component, so it
  // is budgeted like everything else (§5.3). Peak |dy/dt| of amp*sin(2*pi*t/T)
  // is amp*2*pi/T; solve for the amplitude the mode's cap allows and take the
  // smaller of that and the authored one.
  const ampCap = (m.patternDescentCap * dur) / TWO_PI;
  const ampUsed = Math.min(amp, ampCap);

  // Cross at least 60% of the frame width, in full view.
  const crossed = rng.range(t.minWidthCrossed, t.minWidthCrossed + 0.14);
  const x0 = side === 'L' ? -0.07 * DESIGN_W : 1.07 * DESIGN_W;
  const x1 = x0 + sideSign * (crossed + 0.13) * DESIGN_W;

  e.alive = true;
  e.type = def.id;
  // PER-LEVEL HP (§5.7's sanctioned campaign lever, LEVELS in tuning.js).
  // Level one authors no overrides, so every craft in it has exactly §6.2's
  // HP and its content is bit-for-bit what it was; level two takes the drone
  // to 2. Read here rather than at the type table so the SAME type can be a
  // different toughness in a different level without a second row.
  const hp = levelHp(w.surfaceIndex, def.id);
  e.hp = hp;
  e.maxHp = hp;
  // The Warden's shimmer shield (§6.2): whole bolts absorbed before the hull
  // takes any, no regeneration. Every other type gets 0 and never asks again.
  e.shield = def.shieldHits || 0;
  e.shieldFlashT = 0;
  e.mode = 'entering';
  e.locked = false;
  e.slot = slot;
  e.formation = formationId || 'F1';
  e.squadron = squadron;
  e.t = 0;
  e.dur = dur;
  e.hitFlashT = 0;
  // A craft that never swoops never gets a swoop clock. Setting it to Infinity
  // rather than leaving it low-and-unused means a future edit to the swoop
  // trigger cannot accidentally make an Emitter dive: there is no value of
  // `swooping < maxConcurrent` that lets Infinity <= 0 through.
  // PER-TYPE WHERE THE TYPE ASKS FOR IT. §6.2's Lancer is "the swooper, peels
  // more often than anything else", and that line is a behaviour rather than a
  // flavour note -- so it authors its own window and everything else takes the
  // shared one. ENEMY.swoop.maxConcurrent still bounds the whole formation, so
  // a picket full of Lancers cannot put more than three in the gutter at once.
  const cool = def.swoopCooldownS || ENEMY.swoop.cooldownS;
  e.swoopCooldown = def.swoops ? rng.range(cool[0], cool[1]) : Infinity;
  // A craft that owns a bullet pattern carries its own emitter instance, which
  // is what makes killing the craft remove the pattern -- there is no
  // wave-level copy to fall back on (§6.2). The instance itself is attached by
  // the director immediately after this returns: /patterns already reads back
  // into /enemies for B1's shooter list, and constructing it here would close
  // that into an import cycle for no benefit.
  e.emitter = null;

  // Per-craft variation (ENEMY.vary).
  //
  // HASHED FROM THE CRAFT'S OWN IDENTITY, NOT DRAWN FROM `rng`, and that is the
  // whole reason varyHash exists. Three extra draws per spawn would advance the
  // seeded stream by three, which shifts every subsequent entry-timing and
  // path-shape draw in the run. The content would still be deterministic and
  // still identical across a mode swap -- §0.1's requirement survives either
  // way -- but every wave would arrive with different jitter than it did before
  // this change, and §10/POC-8 measures lateral corrections per second against
  // the hardest wave with samples already collected. A presentation tweak has no
  // business invalidating those.
  //
  // Hashing (slot, squadron, formation, type) instead gives the same craft the
  // same look on every replay, in both modes, forever, while leaving the RNG
  // stream byte-for-byte where it was.
  const V = ENEMY.vary;
  const h0 = varyHash(slot, squadron, 1, formationId);
  const h1 = varyHash(slot, squadron, 2, formationId);
  const h2 = varyHash(slot, squadron, 3, formationId);
  e.sizeMul = V.sizeRange[0] + h0 * (V.sizeRange[1] - V.sizeRange[0]);
  e.tint = V.tints[Math.floor(h1 * V.tints.length) % V.tints.length];
  e.cadenceMul = V.cadenceRange[0] + h2 * (V.cadenceRange[1] - V.cadenceRange[0]);

  e.p.x0 = x0;
  e.p.x1 = x1;
  e.p.y0 = y0;
  e.p.amp = ampUsed;
  e.p.side = sideSign;
  e.p.loopX = 0.085 * DESIGN_W;

  entryPoint(e.p, 0, _a);
  e.x = _a.x;
  e.y = _a.y;
  e.heading = entryHeading(e.p, 0);
  return e;
}

// ---------------------------------------------------------------------------
// Per-craft update
// ---------------------------------------------------------------------------

export function updateEnemies(w, rng, dt) {
  const m = cfg();
  const driftX = formationDriftX(w.time);
  let swooping = 0;
  for (let i = 0; i < w.enemies.length; i++) {
    if (w.enemies[i].alive && w.enemies[i].mode === 'swooping') swooping++;
  }

  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive) continue;
    if (e.hitFlashT > 0) e.hitFlashT = Math.max(0, e.hitFlashT - dt);

    switch (e.mode) {
      case 'entering':
        stepEntering(e, dt);
        break;
      case 'peeling':
        stepPeeling(e, dt, driftX);
        break;
      case 'locked':
        stepLocked(e, dt, driftX);
        // The swoop is gated on the TYPE, not on the clock alone. §6.2's
        // Emitter "never swoops" -- and the whole reason Amit picked it as the
        // second type is that it stays put and has to be gone after, so this
        // is a hard behavioural rule and not a tuning knob. Do not add a rare
        // variant here; /systems/constraints.js asserts the type table agrees.
        if (
          enemyDef(e.type).swoops &&
          e.swoopCooldown <= 0 &&
          swooping < ENEMY.swoop.maxConcurrent &&
          w.player.alive
        ) {
          beginSwoop(e, rng, m);
          swooping++;
        }
        break;
      case 'swooping':
        stepSwooping(e, dt, driftX);
        break;
      case 'fragment':
        stepFragment(e, dt);
        break;
      case 'fleeing':
        stepFleeing(e, dt);
        break;
    }
    if (e.shieldFlashT > 0) e.shieldFlashT = Math.max(0, e.shieldFlashT - dt);
  }
}

function stepEntering(e, dt) {
  e.t += dt;
  const t = Math.min(1, e.t / e.dur);
  entryPoint(e.p, t, _a);
  e.x = _a.x;
  e.y = _a.y;
  // Enemy craft are flat top-down, nose along their travel direction (§0.2).
  e.heading = entryHeading(e.p, t);
  if (t >= 1) {
    // Peel to the slot and settle. The peel duration is derived from the
    // descent cap rather than fixed, so a slot below the path's exit point
    // can never produce an over-budget drop (§5.3).
    const target = slotPosition(e.formation, e.slot);
    const drop = Math.max(0, target.y - e.y);
    const minS = drop / cfg().patternDescentCap;
    e.mode = 'peeling';
    e.t = 0;
    e.dur = Math.max(ENEMY.entry.peelS, minS);
    e.s.x0 = e.x;
    e.s.y0 = e.y;
  }
}

function stepPeeling(e, dt, driftX) {
  e.t += dt;
  const k = Math.min(1, e.t / e.dur);
  // Smoothstep in x for a graceful tuck, LINEAR in y so the descent rate is
  // exactly drop/dur and provably inside the cap. An eased y would peak ~1.5x
  // the average and quietly breach it.
  const sx = k * k * (3 - 2 * k);
  const target = slotPosition(e.formation, e.slot);
  const px = e.s.x0 + (target.x + driftX - e.s.x0) * sx;
  const py = e.s.y0 + (target.y - e.s.y0) * k;
  e.heading = Math.atan2(py - e.y, px - e.x) || e.heading;
  e.x = px;
  e.y = py;
  if (k >= 1) {
    e.mode = 'locked';
    // Only now is the craft worth single score: killing it before this moment
    // is the pre-lock kill window and is worth double (§5.5, §8.2).
    e.locked = true;
    e.t = 0;
  }
}

function stepLocked(e, dt, driftX) {
  const target = slotPosition(e.formation, e.slot);
  e.x = target.x + driftX;
  // Held exactly on the slot. A per-craft hover bob was built here and removed
  // -- the authored formations have ~2 px of vertical slack and the rows that
  // would have to move are level one's, which is locked. See ENEMY.vary in
  // tuning.js for the arithmetic and for why a lateral version is no better.
  e.y = target.y;
  // Locked craft face down-screen, toward the player.
  e.heading = Math.PI / 2;
  e.swoopCooldown -= dt;
  // Locked formations hold station in SCREEN space in both modes -- they do
  // not scroll with the surface in Mode S. That is what makes the art shared
  // and the mode toggle cheap (§5.5).
}

/**
 * Launch one craft onto the exit arc (ENEMY.fragment) -- a Splitter's pair
 * (§6.2) or one of Brood Gantry's bay drones (§6.4).
 *
 * "Never a surprise dive" is the whole contract, and it is geometry rather than
 * intent: the arc rises briefly, then descends at ENEMY.fragment.descentSpeed
 * and STOPS at ENEMY.fragment.floorY -- the same 0.58 line §6.4 keeps the boss
 * above and just above the swoop's own floor. So nothing born mid-fight can
 * ever reach the player band, there is no straight-down plunge (§5.5's
 * do-not-port list), and the answer to one is always lateral.
 *
 * It stays a real craft the whole way: shootable, scoreable, and contact-
 * damaging if the player flies into it. A fragment that were merely scenery
 * would make killing a Splitter free, which is exactly the property it exists
 * to remove.
 */
export function spawnFragment(w, x, y, dir, type, score) {
  const e = alloc(w.enemies);
  if (!e) return null;
  const def = enemyDef(type);
  const hp = levelHp(w.surfaceIndex, def.id);
  e.alive = true;
  e.type = def.id;
  e.hp = hp;
  e.maxHp = hp;
  e.shield = def.shieldHits || 0;
  e.shieldFlashT = 0;
  e.mode = 'fragment';
  e.locked = false;
  e.emitter = null;
  e.slot = -1;
  e.squadron = -1;
  e.formation = 'F1';
  e.swoopCooldown = Infinity;
  e.hitFlashT = 0;
  e.t = 0;
  e.ft = 0;
  e.fx = dir >= 0 ? 1 : -1;
  e.x = x;
  e.y = y;
  e.heading = dir >= 0 ? 0 : Math.PI;
  e.sizeMul = 1;
  e.tint = 0xffffff;
  e.cadenceMul = 1;
  // Score is the CALLER's, because the same arc serves two very different
  // things: a Splitter fragment is a drone and is worth a drone, while a bay
  // drone is worth BOSS.bay.launchScore -- less, because a carrier that paid
  // full price per launch would be a score fountain rather than a fight.
  e.fragScore = score;
  return e;
}

function stepFragment(e, dt) {
  const F = ENEMY.fragment;
  e.ft += dt;
  e.x += e.fx * F.lateralSpeed * dt;
  if (e.ft < F.riseS) {
    // A short kick upward out of the parent, so a Splitter's pair visibly
    // separates before either starts drifting down.
    e.y -= F.riseSpeed * dt;
  } else {
    e.y = Math.min(F.floorY * DESIGN_H, e.y + F.descentSpeed * dt);
  }
  e.heading = e.fx > 0 ? 0 : Math.PI;
  if (e.x < -160 || e.x > DESIGN_W + 160) e.alive = false;
}

function beginSwoop(e, rng, m) {
  const slot = slotPosition(e.formation, e.slot);
  // Dip to the top of the player band at the deepest; never into it.
  const dipY = rng.range(0.55, ENEMY.swoop.minY) * DESIGN_H;

  // Phase 1, PEEL-OUT: glide from the slot down to the bottom of the
  // formation band. Uncounted against the authored 2.2-3.5 s window (see
  // ENEMY.swoop.startY's note in tuning.js) but still speed-capped, because
  // the approach budget applies to every downward component without
  // exception (§5.3).
  const outY = ENEMY.swoop.startY * DESIGN_H;
  const outS = Math.max(0, outY - slot.y) / m.swoopDescentSpeed;

  // Phase 2, DIP: 0.30 -> dipY. This is the descent §5.5 actually describes.
  const descentS = Math.max(0, dipY - outY) / m.swoopDescentSpeed;
  const returnS = ENEMY.swoop.returnS;

  // Arc ACROSS the width: at least 35% of it, away from the slot, bounced off
  // the playable bounds so the craft never swoops into a HUD margin.
  const dir = slot.x > DESIGN_W * 0.5 ? -1 : 1;
  const travel = (ENEMY.swoop.minWidthTravelled + rng.range(0.04, 0.2)) * DESIGN_W;
  let x1 = slot.x + dir * travel;
  const lo = FORMATION_X.min * DESIGN_W;
  const hi = FORMATION_X.max * DESIGN_W;
  if (x1 < lo) x1 = slot.x + travel;
  if (x1 > hi) x1 = slot.x - travel;
  x1 = Math.max(lo, Math.min(hi, x1));

  e.mode = 'swooping';
  e.t = 0;
  e.s.x0 = slot.x;
  e.s.y0 = slot.y;
  e.s.outY = outY;
  e.s.outS = outS;
  e.s.x1 = x1;
  e.s.dipY = dipY;
  e.s.descentS = descentS;
  e.s.returnS = returnS;
  e.dur = outS + descentS + returnS;
}

function stepSwooping(e, dt, driftX) {
  e.t += dt;
  const s = e.s;
  const slot = slotPosition(e.formation, e.slot);
  let x;
  let y;

  if (e.t <= s.outS) {
    // Peel-out: drop to the band bottom, easing laterally out of the grid so
    // the craft visibly separates from its neighbours before it commits.
    const k = s.outS > 0 ? e.t / s.outS : 1;
    const sx = k * k * (3 - 2 * k);
    x = s.x0 + (s.x1 - s.x0) * 0.22 * sx;
    y = s.y0 + (s.outY - s.y0) * k;
  } else if (e.t <= s.outS + s.descentS) {
    const k = s.descentS > 0 ? (e.t - s.outS) / s.descentS : 1;
    // S-curve across the width -- the visual interest lives in x, precisely so
    // that y can stay linear and provably capped.
    const sx = k * k * (3 - 2 * k);
    const xa = s.x0 + (s.x1 - s.x0) * 0.22;
    x = xa + (s.x1 - xa) * sx;
    y = s.outY + (s.dipY - s.outY) * k;
  } else {
    const k = Math.min(1, (e.t - s.outS - s.descentS) / s.returnS);
    const sk = k * k * (3 - 2 * k);
    // Curve back UP and rejoin the slot. Upward motion has no cap -- only the
    // downward component is budgeted -- so the return can be brisk.
    x = s.x1 + (slot.x + driftX - s.x1) * sk;
    y = s.dipY + (slot.y - s.dipY) * sk;
  }

  e.heading = Math.atan2(y - e.y, x - e.x) || e.heading;
  e.x = x;
  e.y = y;

  if (e.t >= e.dur) {
    e.mode = 'locked';
    const cool = enemyDef(e.type).swoopCooldownS || ENEMY.swoop.cooldownS;
    e.swoopCooldown = cool[0] + Math.random() * (cool[1] - cool[0]);
  }
}

/** A wave whose timer expired: survivors flee (§5.7) rather than lingering
 *  into the next wave's choreography. */
function stepFleeing(e, dt) {
  const speed = 620;
  const dir = e.x > DESIGN_W * 0.5 ? 1 : -1;
  e.x += dir * speed * dt;
  // Fleeing is lateral and slightly upward -- never downward through the
  // player band.
  e.y -= 40 * dt;
  e.heading = dir > 0 ? 0 : Math.PI;
  if (e.x < -140 || e.x > DESIGN_W + 140) e.alive = false;
}

export function fleeAll(w) {
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (e.alive) {
      e.mode = 'fleeing';
      e.locked = false;
    }
  }
}

/** Craft-owned pattern emitters that are eligible to fire this frame, in
 *  formation-slot order so the set is stable rather than pool-order noise.
 *
 *  A craft's emitter is live only while the craft is LOCKED: entering craft do
 *  not fire (§5.5), a fleeing one has disengaged, and a dead one has taken its
 *  pattern with it -- which is the point of the type. */
export function craftEmitters(w, out) {
  out.length = 0;
  const marginLo = 0.06 * DESIGN_W;
  const marginHi = 0.94 * DESIGN_W;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive || !e.emitter || e.mode !== 'locked') continue;
    // Nothing fires while transiting a HUD margin (§5.1).
    if (e.x < marginLo || e.x > marginHi) continue;
    out.push(e.emitter);
  }
  out.sort((a, b) => a.owner.slot - b.owner.slot);
  return out;
}

/** Locked craft available to fire. Entering craft do NOT fire (§5.5), and
 *  nothing fires while transiting a HUD margin (§5.1). */
export function lockedShooters(w, out) {
  out.length = 0;
  const marginLo = 0.06 * DESIGN_W;
  const marginHi = 0.94 * DESIGN_W;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive || !e.locked) continue;
    if (e.mode !== 'locked') continue;
    if (e.x < marginLo || e.x > marginHi) continue;
    out.push(e);
  }
  return out;
}

/**
 * Which authored bullet pattern this particular craft owns.
 *
 * A type may declare `patternVariants` as well as `pattern`; if it does, the
 * craft picks one by its stable identity hash. §6.2's Emitter does, and the
 * reason is the half-finished per-craft-variation thread this completes: the
 * previous pass established that variation must never change a pattern's
 * geometry at runtime, because /systems/constraints.js proves §5.3's aisle,
 * descent and density guarantees per PATTERN, statically. So the variation is
 * WHICH authored, validated pattern a craft carries -- never what is inside
 * one. Both B2 and B2T are proved at boot; picking between them cannot escape
 * the contract.
 *
 * Hashed rather than drawn from the seeded stream, for the same reason
 * varyHash exists: a draw here would advance the run's RNG and reshuffle every
 * downstream entry-timing decision, which would rewrite level one's locked
 * choreography.
 */
export function craftPatternId(w, e) {
  const def = enemyDef(e.type);
  // The list is the LEVEL's where the level names one (levelVariantPatterns),
  // and the type's otherwise. Level three adds B4 to its Emitters that way,
  // without B4 reaching level two's Emitters -- content Amit has already
  // played -- and without touching the type table at all.
  const list = levelVariantPatterns(w.surfaceIndex, e.type);
  // GATED PER LEVEL, and level one does not opt in.
  //
  // Without this gate the variants would reach level one's seven Emitters and
  // some of them would start running B2T -- which is new bullet content in a
  // level that is locked for a demo. "Do not change level one's enemies, waves
  // or boss" covers what its craft SHOOT, not just how many there are, so the
  // opt-in lives on the level row rather than on the type.
  if (!list || !list.length || !levelAt(w.surfaceIndex).craftVariants) {
    return def.pattern;
  }
  const h = varyHash(e.slot, e.squadron, 7, e.formation);
  return list[Math.floor(h * list.length) % list.length];
}

export function isInFormationBand(y) {
  return y >= BANDS.formation.top * DESIGN_H && y <= BANDS.formation.bottom * DESIGN_H;
}
