// The temporary weapons: what drops them, what happens when one is collected,
// and what each one does while its timer runs.
//
// The firing itself lives here rather than in play.js so that ONE function
// decides everything that comes out of the pod. A toy does not take the gun
// over -- it fires alongside it -- and the only way to keep that honest is for
// both to be emitted by the same few lines, where a toy branch cannot quietly
// skip the base gun by returning early. It did exactly that until it was fixed;
// see updateFiring.

import { TOYS, BULLETS, PLAYER } from '../data/tuning.js';
import { registerHit } from './monsters.js';
import { playShoot, playPickup } from './audio.js';

export function createToyState() {
  return {
    active: null,   // kind object, or null for the plain gun alone
    t: 0,           // seconds left
    total: 0,       // what it started with, for the timer bar
    fireT: 0,       // the TOY's own fire clock, separate from the base gun's
    chain: [],      // bomb-chain links (verlet: x/y plus previous px/py)
    spin: 0,        // twirl's current angle / buddies' orbit angle
    side: 1,        // wand: which way the next bubble launches
    buddies: [],
    lastDropT: -99,
  };
}

/** Roll for a toy where a monster just died. */
export function maybeDropToy(w, m, rng) {
  const chance = TOYS.dropFrom[m.tierName] || 0;
  if (!chance) return;
  if (w.toyPickups.filter((t) => t.alive).length >= TOYS.maxLive) return;
  if (w.time - w.toy.lastDropT < TOYS.minGapS) return;
  if (rng.next() >= chance) return;

  // Only toys the player has reached the level for. The roster grows through a
  // run rather than being complete from the first pop, which is what makes
  // levelling feel like it opened something.
  const names = Object.keys(TOYS.kinds).filter(
    (n) => (TOYS.unlockLevel[n] || 1) <= w.level
  );
  if (!names.length) return;
  let total = 0;
  for (const n of names) total += TOYS.weights[n] || 0;
  let r = rng.next() * total;
  let pick = names[0];
  for (const n of names) {
    r -= TOYS.weights[n] || 0;
    if (r <= 0) { pick = n; break; }
  }

  w.toy.lastDropT = w.time;
  w.toyPickups.push({
    alive: true,
    kind: pick,
    x: m.x,
    // Born ABOVE the kill, so collecting it is a small climb: greed, not duty.
    y: m.y - TOYS.riseAboveKillPx,
    t: TOYS.lifeS,
    bob: 0,
  });
}

export function updateToyPickups(w, dt) {
  const p = w.player;
  for (const c of w.toyPickups) {
    if (!c.alive) continue;
    c.t -= dt;
    c.bob += dt * 3.4;
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < TOYS.magnetRadius) {
      c.x += (dx / d) * TOYS.magnetPxS * dt;
      c.y += (dy / d) * TOYS.magnetPxS * dt;
    } else {
      c.y += TOYS.driftPxS * dt;
    }
    if (d < PLAYER.radius + TOYS.radius) {
      c.alive = false;
      equip(w, c.kind);
    }
    if (c.t <= 0) c.alive = false;
  }
  w.toyPickups = w.toyPickups.filter((c) => c.alive);
}

/** One at a time: a new toy REPLACES whatever TOY is running, remainder
 *  discarded. No inventory, no stacking, nothing for a child to manage -- and
 *  note this replaces the toy only. The forward cannon is not a toy and is
 *  untouched by anything in here. */
export function equip(w, kindName) {
  const kind = TOYS.kinds[kindName];
  if (!kind) return;
  // Levels lengthen a toy a little. Deliberately small and capped: the
  // escalation a player should feel is MORE KINDS of toy, not the same one
  // overstaying -- a 60 % longer twirl is not exciting, it is a twirl you are
  // waiting out.
  const bonus = Math.min(TOYS.levelDurationCap, 1 + (w.level - 1) * TOYS.levelDurationBonus);
  const dur = kind.durationS * bonus;
  w.toy.active = kind;
  w.toy.t = dur;
  w.toy.total = dur;
  w.toy.fireT = 0;
  w.toy.spin = 0;
  w.toy.buddies = [];
  w.toy.chain = [];
  if (kind.id === 'buddies') {
    for (let i = 0; i < kind.count; i++) {
      w.toy.buddies.push({ a: (Math.PI * 2 * i) / kind.count, armT: kind.armS });
    }
  }
  if (kind.id === 'chain') {
    // Born hanging straight down, at rest. `px/py` are the verlet PREVIOUS
    // positions: equal to the current ones means zero starting velocity, so the
    // chain settles into place instead of being flung on the frame it appears.
    for (let i = 0; i < kind.links; i++) {
      const y = w.player.y + PLAYER.radius + kind.linkPx * (i + 1);
      w.toy.chain.push({ x: w.player.x, y, px: w.player.x, py: y, armT: kind.armS });
    }
  }
  w.stats.toysUsed++;
  playPickup();
}

/** `damage` is per bullet and defaults to the cannon's. It is carried on the
 *  bullet rather than read from the active toy at impact time, because a bullet
 *  outlives the toy that fired it -- a twirl shot still in flight when the timer
 *  runs out must still land for three. */
function spawnBullet(w, x, y, vx, vy, homing, tint, damage) {
  if (w.bullets.length >= BULLETS.maxLive) return;
  w.bullets.push({ alive: true, x, y, vx, vy, homing: !!homing, tint, damage });
}

/**
 * Fire for this frame. Returns nothing; mutates the bullet list.
 *
 * THE PLAIN GUN IS NOT A FALLBACK, IT IS THE FLOOR. It fires straight up on its
 * own clock for the entire run and nothing in this function can stop it, slow
 * it, or bend it -- which is why it is handled FIRST, before the toy is even
 * looked at, and why it has no `if` in front of it. Every toy is strictly
 * additive on top: its own timer, its own bullets, alongside the base stream.
 *
 * This is rule 3 in tuning.js and it used to be a comment rather than a fact:
 * the twirl branch returned before reaching the base gun (nine seconds with the
 * cannon off) and the wand replaced the straight shot with a homing one. A
 * player on the board reported it as the gun stopping, which is exactly what it
 * was. A player can have a worse round; they can never have a worse pod.
 */
export function updateFiring(w, dt) {
  const p = w.player;
  const toy = w.toy;
  if (!p.alive) return;

  if (toy.active) {
    toy.t -= dt;
    if (toy.t <= 0) {
      toy.active = null;
      toy.buddies = [];
      toy.fireT = 0;
    }
  }

  // ---- THE FORWARD CANNON. Unconditional, and first. ----------------------
  //
  // A toy may make this FASTER (rapid's `baseIntervalS`) and may not do anything
  // else to it. Rule 3 forbids stopping, replacing or redirecting the cannon; it
  // does not forbid improving it, which is the opposite failure mode. The tint
  // rides along so a rate buff -- the hardest kind to see -- is visible.
  const kind = toy.active;
  const baseInterval = (kind && kind.baseIntervalS) || BULLETS.intervalS;
  p.fireT -= dt;
  if (p.fireT <= 0) {
    p.fireT = baseInterval;
    spawnBullet(w, p.x, p.y - PLAYER.radius, 0, -BULLETS.speedPxS, false,
                kind && kind.baseIntervalS ? kind.tint : undefined);
    playShoot();
  }

  if (!kind) return;

  // ---- ...and whatever the toy adds on top of it. -------------------------
  if (kind.spinRadPerS) toy.spin += kind.spinRadPerS * dt;

  if (kind.id === 'buddies') {
    // Bombs emit nothing; they detonate by touch (updateBuddies).
    for (const b of toy.buddies) {
      if (b.armT > 0) b.armT = Math.max(0, b.armT - dt);
    }
    return;
  }

  // Rapid adds no stream of its own -- its whole effect was applied above, to
  // the cannon's interval. The chain's effect is physical, in updateChain.
  if (kind.id === 'rapid') return;
  if (kind.id === 'chain') {
    for (const c of toy.chain) {
      if (c.armT > 0) c.armT = Math.max(0, c.armT - dt);
    }
    return;
  }

  // The toy keeps its OWN cadence, so its rate is independent of the gun's and
  // neither one can starve the other.
  toy.fireT -= dt;
  if (toy.fireT > 0) return;
  toy.fireT = kind.intervalS;

  if (kind.id === 'twirl') {
    for (let i = 0; i < kind.arms; i++) {
      const a = toy.spin + (Math.PI * 2 * i) / kind.arms;
      spawnBullet(w, p.x, p.y, Math.cos(a) * kind.speedPxS, Math.sin(a) * kind.speedPxS,
                  false, kind.tint, kind.damage);
    }
    return;
  }

  if (kind.id === 'wand') {
    // Alternating left/right launch: the base stream already owns the column
    // straight above the pod, and a bubble fired into it would be invisible
    // until it peeled off. The homing steer brings it back onto a target.
    toy.side = toy.side === 1 ? -1 : 1;
    const a = -Math.PI / 2 + toy.side * kind.launchSpreadRad;
    spawnBullet(w, p.x, p.y - PLAYER.radius,
                Math.cos(a) * kind.speedPxS, Math.sin(a) * kind.speedPxS,
                true, kind.tint);
  }
}

/** Homing steering, applied to bullets that have it. Turn rate is limited so a
 *  wand shot arcs toward its target rather than snapping onto it -- an arc
 *  reads as a helpful bubble, a snap reads as the game playing itself. */
export function steerHomingBullets(w, dt) {
  const kind = TOYS.kinds.wand;
  for (const b of w.bullets) {
    if (!b.alive || !b.homing) continue;
    let best = null;
    let bestD = kind.seekRadius;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - b.x, m.y - b.y);
      if (d < bestD) { bestD = d; best = m; }
    }
    if (!best) continue;
    const want = Math.atan2(best.y - b.y, best.x - b.x);
    const have = Math.atan2(b.vy, b.vx);
    let diff = want - have;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = Math.max(-kind.turnRate * dt, Math.min(kind.turnRate * dt, diff));
    const a = have + step;
    const sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }
}

/**
 * The bomb chain: verlet integration, then constraint relaxation.
 *
 * VERLET rather than stored velocities, because the entire behaviour the toy
 * exists for -- swinging out under acceleration, overshooting when the pod
 * stops, whipping on a direction change -- is what you get for free when
 * position is derived from the previous position. Nothing here scripts a swing:
 * the pod moves, the anchor moves with it, and the rest is consequence.
 *
 * The anchor is the pod's underside, set absolutely every frame, and that is
 * what transmits the player's acceleration into the rope: link 0 is yanked to a
 * new place while its previous position stays behind, and that gap IS the
 * velocity the physics then carries down the chain.
 */
export function updateChain(w, dt) {
  const kind = w.toy.active;
  if (!kind || kind.id !== 'chain' || !w.toy.chain.length) return;
  const p = w.player;
  const anchorX = p.x;
  const anchorY = p.y + PLAYER.radius;

  // Fixed step, clamped: a dropped frame should slow the chain, never explode it.
  const h = Math.min(dt, 1 / 30);
  for (const c of w.toy.chain) {
    const vx = (c.x - c.px) * kind.damping;
    const vy = (c.y - c.py) * kind.damping;
    c.px = c.x;
    c.py = c.y;
    c.x += vx;
    c.y += vy + kind.gravityPxS2 * h * h;
  }

  // Relax: pin link 0 to the pod, then hold each pair linkPx apart. Several
  // passes, because one pass leaves the rope visibly stretched at exactly the
  // moment the player is looking at it -- a hard direction change.
  for (let it = 0; it < kind.iterations; it++) {
    let prevX = anchorX, prevY = anchorY;
    for (const c of w.toy.chain) {
      const dx = c.x - prevX, dy = c.y - prevY;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - kind.linkPx) / d;
      // The anchor end is immovable and the link takes the whole correction.
      // Sharing it would let the rope drag the pod around -- handing the
      // player's own steering over to a physics object.
      c.x -= dx * diff;
      c.y -= dy * diff;
      prevX = c.x;
      prevY = c.y;
    }
  }
}

/** Chain links detonate on contact like every other bomb. A spent link is
 *  removed and the rope simply gets shorter: the links below re-hang from the
 *  one above on the next relaxation pass, with no special case for a gap. */
export function updateChainBombs(w, onDetonate) {
  const kind = w.toy.active;
  if (!kind || kind.id !== 'chain') return;
  for (let i = w.toy.chain.length - 1; i >= 0; i--) {
    const c = w.toy.chain[i];
    if (c.armT > 0) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - c.x, m.y - c.y) > m.r + kind.radius) continue;
      w.toy.chain.splice(i, 1);
      onDetonate(c.x, c.y, kind.tint, kind.blastDamage, kind.blastRadiusPx);
      break;
    }
  }
  // Spent, not expired -- same rule as the orbiting bombs.
  if (w.toy.chain.length === 0) {
    w.toy.active = null;
    w.toy.t = 0;
  }
}

/**
 * Buddy Bombs vs monsters.
 *
 * Each orbiter detonates on contact and is SPENT. Two bombs, two bangs, and when
 * both are gone the toy is over -- which is what turns them from a passive pet
 * into a decision: the player chooses when to spend one by choosing where to
 * fly, and that is the only choice any toy offers in a game with no buttons.
 *
 * Iterated back to front and spliced, because a detonation removes the buddy.
 */
export function updateBuddies(w, onDetonate) {
  const kind = w.toy.active;
  if (!kind || kind.id !== 'buddies') return;
  const p = w.player;
  for (let i = w.toy.buddies.length - 1; i >= 0; i--) {
    const b = w.toy.buddies[i];
    const a = w.toy.spin + b.a;
    const bx = p.x + Math.cos(a) * kind.orbitPx;
    const by = p.y + Math.sin(a) * kind.orbitPx;
    b.x = bx; b.y = by;
    if (b.armT > 0) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - bx, m.y - by) > m.r + kind.radius) continue;
      w.toy.buddies.splice(i, 1);
      onDetonate(bx, by, kind.tint, kind.blastDamage, kind.blastRadiusPx);
      break;
    }
  }
  // Spent, not expired: the toy ends when the bombs are gone. Ending on the
  // timer instead would take a bomb away from a player who was saving it.
  if (w.toy.buddies.length === 0) {
    w.toy.active = null;
    w.toy.t = 0;
  }
}
