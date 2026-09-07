// The temporary weapons: what drops them, what happens when one is collected,
// and what each one does while its timer runs.
//
// The firing itself lives here rather than in play.js because a toy IS the
// firing rule for as long as it lasts -- keeping it beside the base gun would
// mean two places deciding what comes out of the pod.

import { TOYS, BULLETS, PLAYER } from '../data/tuning.js';

export function createToyState() {
  return {
    active: null,   // kind object, or null for the plain gun
    t: 0,           // seconds left
    total: 0,       // what it started with, for the ring
    spin: 0,        // twirl's current angle / buddies' orbit angle
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

/** One at a time: a new toy REPLACES whatever is running, remainder discarded.
 *  No inventory, no stacking, nothing for a child to manage. */
export function equip(w, kindName) {
  const kind = TOYS.kinds[kindName];
  if (!kind) return;
  w.toy.active = kind;
  w.toy.t = kind.durationS;
  w.toy.total = kind.durationS;
  w.toy.spin = 0;
  w.toy.buddies = [];
  if (kind.id === 'buddies') {
    for (let i = 0; i < kind.count; i++) {
      w.toy.buddies.push({ a: (Math.PI * 2 * i) / kind.count, cool: 0 });
    }
  }
  w.stats.toysUsed++;
}

function spawnBullet(w, x, y, vx, vy, homing) {
  if (w.bullets.length >= BULLETS.maxLive) return;
  w.bullets.push({ alive: true, x, y, vx, vy, homing: !!homing });
}

/**
 * Fire for this frame. Returns nothing; mutates the bullet list.
 *
 * THE PLAIN GUN IS THE FALLBACK, ALWAYS. Every branch here is additive: there
 * is no toy that takes the base weapon away, so a player can have a worse round
 * but never a worse pod.
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
    }
  }

  const kind = toy.active;

  if (kind && kind.id === 'twirl') {
    toy.spin += kind.spinRadPerS * dt;
    p.fireT -= dt;
    if (p.fireT <= 0) {
      p.fireT = kind.intervalS;
      for (let i = 0; i < kind.arms; i++) {
        const a = toy.spin + (Math.PI * 2 * i) / kind.arms;
        spawnBullet(w, p.x, p.y, Math.cos(a) * kind.speedPxS, Math.sin(a) * kind.speedPxS, false);
      }
    }
    return;
  }

  if (kind && kind.id === 'buddies') {
    toy.spin += kind.spinRadPerS * dt;
    for (const b of toy.buddies) {
      if (b.cool > 0) b.cool = Math.max(0, b.cool - dt);
    }
    // Buddies do not replace the gun; the pod keeps firing underneath them.
  }

  // Base gun, and the wand's homing variant of it.
  p.fireT -= dt;
  if (p.fireT > 0) return;
  const homing = !!(kind && kind.id === 'wand');
  p.fireT = homing ? kind.intervalS : BULLETS.intervalS;
  const speed = homing ? kind.speedPxS : BULLETS.speedPxS;
  spawnBullet(w, p.x, p.y - PLAYER.radius, 0, -speed, homing);
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
      m.hp -= kind.damage;
      m.hitT = 0.12;
      b.cool = kind.hitCooldownS;
      if (m.hp <= 0) onPop(m);
      break;
    }
  }
}
