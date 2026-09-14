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

export function createToyState() {
  return {
    active: null,   // kind object, or null for the plain gun alone
    t: 0,           // seconds left
    total: 0,       // what it started with, for the timer bar
    fireT: 0,       // the TOY's own fire clock, separate from the base gun's
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

  const names = Object.keys(TOYS.kinds);
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
  w.toy.active = kind;
  w.toy.t = kind.durationS;
  w.toy.total = kind.durationS;
  w.toy.fireT = 0;
  w.toy.spin = 0;
  w.toy.buddies = [];
  if (kind.id === 'buddies') {
    for (let i = 0; i < kind.count; i++) {
      w.toy.buddies.push({ a: (Math.PI * 2 * i) / kind.count, cool: 0 });
    }
  }
  w.stats.toysUsed++;
}

function spawnBullet(w, x, y, vx, vy, homing, tint) {
  if (w.bullets.length >= BULLETS.maxLive) return;
  w.bullets.push({ alive: true, x, y, vx, vy, homing: !!homing, tint });
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
  p.fireT -= dt;
  if (p.fireT <= 0) {
    p.fireT = BULLETS.intervalS;
    spawnBullet(w, p.x, p.y - PLAYER.radius, 0, -BULLETS.speedPxS, false);
  }

  const kind = toy.active;
  if (!kind) return;

  // ---- ...and whatever the toy adds on top of it. -------------------------
  if (kind.spinRadPerS) toy.spin += kind.spinRadPerS * dt;

  if (kind.id === 'buddies') {
    // Buddies emit nothing; they pop by touch (updateBuddies).
    for (const b of toy.buddies) {
      if (b.cool > 0) b.cool = Math.max(0, b.cool - dt);
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
                  false, kind.tint);
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

/** Buddy bots vs monsters. They pop things by touching them, which is why they
 *  answer the monsters that arrive from below without the player turning. */
export function updateBuddies(w, onPop) {
  const kind = w.toy.active;
  if (!kind || kind.id !== 'buddies') return;
  const p = w.player;
  for (const b of w.toy.buddies) {
    const a = w.toy.spin + b.a;
    const bx = p.x + Math.cos(a) * kind.orbitPx;
    const by = p.y + Math.sin(a) * kind.orbitPx;
    b.x = bx; b.y = by;
    if (b.cool > 0) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - bx, m.y - by) > m.r + kind.radius) continue;
      registerHit(m, kind.damage);
      b.cool = kind.hitCooldownS;
      if (m.hp <= 0) onPop(m);
      break;
    }
  }
}
