// Monsters: drift in from an edge, cross the field, leave. Nothing chases.
//
// THE DESIGN RULE THIS FILE ENFORCES, and the reason the game can put threats
// below the player at all: every threat must be answerable by leaning SIDEWAYS.
// A monster crossing the pod's row is nudged so it clears the pod's centre by
// MONSTERS.passClearance -- the player still has to move, but a lateral lean is
// always enough, and nothing ever demands the expensive forward/back axis.
//
// The clearance is applied ONCE, when the monster is still far away, and never
// re-applied. A monster that steered continuously would be chasing the player
// by another name, and the player could never learn where it was going.

import { MONSTERS, DESIGN_W, DESIGN_H, PLAYER, DIFFICULTY, difficulty01, lerpDiff } from '../data/tuning.js';
import { playHit } from './audio.js';

// How close to the pod's column a crossing has to be before it counts as a
// pass at all. Roughly "could this have hit me if I had stood still?".
const PASS_LANE_PX = 420;

function pickTier(rng, d) {
  // The crowd grows UP as well as out: late runs shift weight off the smalls
  // and onto the bigger tiers, so more monsters does not just mean more chaff.
  const bonus = DIFFICULTY.largeShareBonus * d;
  const w = MONSTERS.tierWeights;
  const small = Math.max(0, w.small - bonus);
  const medium = w.medium + bonus * 0.45;
  const r = rng.next();
  if (r < small) return 'small';
  if (r < small + medium) return 'medium';
  return 'large';
}

function pickEdge(rng) {
  const r = rng.next();
  const w = MONSTERS.edgeWeights;
  let acc = w.top;
  if (r < acc) return 'top';
  acc += w.left;
  if (r < acc) return 'left';
  acc += w.right;
  if (r < acc) return 'right';
  return 'bottom';
}

export function spawnMonster(w, rng) {
  const d = difficulty01(w.time);
  // The crowd grows with the CLOCK (the ramp) and with the PLAYER'S LEVEL, so
  // the escalation is felt on both sides: levels hand out toys, and levels also
  // fill the field. The level term is capped hard because it stacks on the time
  // ramp, and the two together are how a game for six-year-olds quietly becomes
  // unplayable at minute five.
  const levelBonus = Math.min(
    DIFFICULTY.maxLiveLevelCap,
    (w.level - 1) * DIFFICULTY.maxLivePerLevel
  );
  const cap = Math.round(lerpDiff(DIFFICULTY.maxLive, d) + levelBonus);
  if (w.monsters.filter((m) => m.alive).length >= cap) return null;

  const tierName = pickTier(rng, d);
  const tier = MONSTERS.tiers[tierName];
  const edge = pickEdge(rng);
  const margin = tier.radius + 20;
  // Difficulty moves the SPEED and the CROWD, never the health: a monster that
  // takes more hits later reads as the gun getting weaker, not the game getting
  // harder.
  const speed = MONSTERS.driftPxS * MONSTERS.driftMul * tier.speedMul *
                lerpDiff(DIFFICULTY.speedMul, d);

  let x, y, vx, vy;
  // A shallow angle across the field rather than a straight line, so the same
  // edge does not always produce the same path.
  const skew = (rng.next() - 0.5) * 0.55;
  // Side arrivals lean downward: an entry from the left that drifts UP is a
  // riser as well, and those were the bulk of what read as "too many coming
  // from below". Top and bottom arrivals keep a symmetric lateral skew, which
  // only decides how diagonally they cross.
  const sideSkew = skew + MONSTERS.sideSkewBias;
  if (edge === 'top') {
    x = margin + rng.next() * (DESIGN_W - margin * 2); y = -margin;
    vx = speed * skew; vy = speed;
  } else if (edge === 'bottom') {
    x = margin + rng.next() * (DESIGN_W - margin * 2); y = DESIGN_H + margin;
    vx = speed * skew; vy = -speed;
  } else if (edge === 'left' || edge === 'right') {
    // SIDE ARRIVALS ENTER HIGH, in the top MONSTERS.sideEntryMaxYFrac of the
    // screen, never down at the pod's row. A top arrival is far away by
    // construction; a side arrival used to be able to appear at the player's
    // own height, a screen-width away and closing, with no travel time to read
    // it in. That is the case the reaction floor exists to catch, and the fix
    // is to place it out of reach rather than to slow it down.
    const yMax = Math.max(margin + 1, DESIGN_H * MONSTERS.sideEntryMaxYFrac);
    y = margin + rng.next() * (yMax - margin);
    x = edge === 'left' ? -margin : DESIGN_W + margin;
    vx = edge === 'left' ? speed : -speed;
    vy = speed * sideSkew;
  }

  const m = {
    alive: true, tierName, x, y, vx, vy,
    r: tier.radius,
    hp: tier.hp, maxHp: tier.hp,
    tint: tier.tint, points: tier.points, coins: tier.coins,
    hitT: 0,
    squashT: 0,
    // Cosmetic personality, so a wave does not read as one sprite repeated.
    // One, two or three eyes -- all three appear in the locked art frame, and
    // the eye count is the cheapest way to make two same-tier monsters read as
    // different creatures rather than one sprite repeated.
    eyes: rng.next() < 0.34 ? 1 : (rng.next() < 0.62 ? 2 : 3),
    horns: rng.next() < 0.55,
    // Which way the smile leans, and how fast it blinks. Blinking is the single
    // most alive-looking thing a static shape can do.
    blinkPhase: rng.next() * 6,
    grin: 0.8 + rng.next() * 0.4,
    wobble: rng.next() * Math.PI * 2,
    // Measurement bookkeeping (see world.stats).
    bornT: w.time,
    clearanceApplied: false,
    countedPass: false,
    countedNear: false,
  };
  w.monsters.push(m);
  return m;
}

/**
 * Steer a monster that would otherwise cross the pod's row too close to it.
 *
 * Applied once, while it is still at least a second away, and only on the
 * LATERAL axis -- the whole point is that the answer is a sideways lean.
 */
function applyClearance(w, m) {
  if (m.clearanceApplied) return;
  const p = w.player;
  const clearance = MONSTERS.passClearancePx * MONSTERS.passClearanceMul + m.r + PLAYER.radius;
  // Only meaningful for something actually heading toward the pod's row.
  if (Math.abs(m.vy) < 1) return;
  const tToRow = (p.y - m.y) / m.vy;
  if (tToRow < 1.0 || tToRow > 6) return;

  const xAtRow = m.x + m.vx * tToRow;
  const dx = xAtRow - p.x;
  if (Math.abs(dx) >= clearance) { m.clearanceApplied = true; return; }

  // Push it to the nearer side, so the correction is the smallest one that
  // works and the monster does not visibly swerve.
  const side = dx === 0 ? (m.x < p.x ? -1 : 1) : Math.sign(dx);
  const needed = side * clearance - dx;
  m.vx += needed / tToRow;
  m.clearanceApplied = true;
}

/**
 * Register a hit on a monster: the flash and the squash impulse.
 *
 * ONE PLACE, called by everything that can hurt something -- bullets, buddy
 * bots, and whatever gets added next. The two call sites used to each set
 * `hitT = 0.12` by hand, which is exactly how one of them ends up not doing
 * the squash after somebody adds it here.
 */
export function registerHit(m, damage) {
  m.hp -= damage;
  m.hitT = MONSTERS.hit.flashS;
  // The note climbs as the monster empties -- computed here because this is the
  // one place that knows both the new hp and the max. Progress is clamped at 1
  // so the killing blow is the top of the ladder rather than past it.
  playHit(m.maxHp > 0 ? 1 - Math.max(0, m.hp) / m.maxHp : 1);
  // Restart the squash rather than adding to it: a monster under sustained fire
  // gets a fresh recoil per shot, which is what "every time they get hit"
  // means. Accumulating would just hold it permanently deformed.
  m.squashT = MONSTERS.hit.squashS;
}

/** How hard monsters are pulled toward the pod at this level. 0 before the
 *  threshold, which is the state the whole six-year-old pass was tuned in. */
export function attractionAt(level) {
  const a = MONSTERS.attraction;
  if ((level || 1) < a.fromLevel) return 0;
  return Math.min(a.max, (level - a.fromLevel + 1) * a.perLevel);
}

export function updateMonsters(w, dt) {
  const p = w.player;
  const pull = attractionAt(w.level);
  const A = MONSTERS.attraction;
  for (const m of w.monsters) {
    if (!m.alive) continue;
    const wasAbove = m.y < p.y;

    applyClearance(w, m);

    // ATTRACTION, applied after clearance and therefore overriding it. Lateral
    // only: a monster that dived would demand the forward/back axis, which is
    // the expensive one on this hardware.
    //
    // The clamp is on the SPEED, not the acceleration, so a monster crossing the
    // full screen cannot accumulate sideways momentum the whole way and arrive
    // moving faster sideways than forwards. That would read as a dash, and
    // nothing in this game dashes -- being caught still has to be something the
    // player could see coming.
    if (pull > 0) {
      const dx = p.x - m.x;
      if (Math.abs(dx) > 2) {
        m.vx += Math.sign(dx) * A.accelPxS2 * pull * dt;
        const cap = A.maxLateralPxS * pull;
        if (m.vx > cap) m.vx = cap;
        if (m.vx < -cap) m.vx = -cap;
      }
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.wobble += dt * 2.2;
    if (m.hitT > 0) m.hitT = Math.max(0, m.hitT - dt);
    if (m.squashT > 0) m.squashT = Math.max(0, m.squashT - dt);

    // --- measurement, not gameplay ---------------------------------------
    const nowAbove = m.y < p.y;
    // A "pass" only counts if it happens anywhere NEAR the pod. The first
    // version counted any crossing of the pod's row, so a monster entering from
    // the left edge at the pod's height "passed" it instantly while sitting 900
    // px away -- which reported a worst reaction of 0.25 s and would have sent
    // the board session hunting a danger that was never there.
    const near = Math.abs(m.x - p.x) < PASS_LANE_PX;
    if (wasAbove !== nowAbove && near && !m.countedPass) {
      m.countedPass = true;
      w.stats.passes++;
      // How long did this monster give the player between appearing and
      // arriving? That is the reaction budget, measured rather than assumed.
      const reaction = w.time - m.bornT;
      if (reaction < w.stats.worstReactionS) w.stats.worstReactionS = reaction;
    }
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (!m.countedNear && d < m.r + PLAYER.radius + 60) {
      m.countedNear = true;
      w.stats.nearMisses++;
    }

    const out = m.r + 140;
    if (m.x < -out || m.x > DESIGN_W + out || m.y < -out || m.y > DESIGN_H + out) {
      m.alive = false;
    }
  }
  w.monsters = w.monsters.filter((m) => m.alive || m.hitT > 0);
}

export function maybeSpawn(w, rng, dt) {
  w.spawnT -= dt;
  if (w.spawnT > 0) return;
  const d = difficulty01(w.time);
  w.spawnT = MONSTERS.spawnIntervalS * lerpDiff(DIFFICULTY.spawnIntervalMul, d);
  spawnMonster(w, rng);
}
