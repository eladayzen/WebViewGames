// Bullets, coins, collisions and the pod itself. Small enough to live together;
// the moment any of it grows a second opinion it should split.

import { BULLETS, MONSTERS, COINS, PLAYER, DESIGN_W, DESIGN_H } from '../data/tuning.js';
import { maybeDropToy, steerHomingBullets, updateBuddies } from './toys.js';

export function updatePlayer(w, input, dt) {
  const p = w.player;
  p.x += input.x * PLAYER.lateralMaxPxS * dt;
  p.y += input.y * PLAYER.verticalMaxPxS * dt;
  p.x = Math.max(PLAYER.clampMarginX, Math.min(DESIGN_W - PLAYER.clampMarginX, p.x));
  p.y = Math.max(PLAYER.clampMinY, Math.min(PLAYER.clampMaxY, p.y));
  // The pod leans into the turn -- squash-and-stretch's cheapest cousin, and
  // most of what makes it feel alive rather than dragged.
  p.lean += (input.x - p.lean) * Math.min(1, dt * 9);
  if (p.invulnT > 0) p.invulnT = Math.max(0, p.invulnT - dt);
}

/**
 * Move what has been fired. WHAT gets fired is decided in /systems/toys.js,
 * because a toy is the firing rule for as long as it lasts.
 *
 * Bullets are born at the pod and are then INDEPENDENT of it, which is what
 * paints a ribbon behind a moving player rather than a column -- the
 * reference's signature read, and the reason the shot is worth watching.
 */
export function updateBullets(w, dt) {
  steerHomingBullets(w, dt);
  const out = 60;
  for (const b of w.bullets) {
    if (!b.alive) continue;
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (b.y < -out || b.y > DESIGN_H + out || b.x < -out || b.x > DESIGN_W + out) b.alive = false;
  }
  w.bullets = w.bullets.filter((b) => b.alive);
}

export function popMonster(w, m, rng) {
  m.alive = false;
  m.hitT = 0;
  w.stats.popped++;
  w.stats.score += m.points;
  maybeDropToy(w, m, rng);
  for (let i = 0; i < m.coins; i++) {
    const a = rng.next() * Math.PI * 2;
    const s = 40 + rng.next() * 90;
    w.coins.push({
      alive: true, x: m.x, y: m.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: COINS.lifeS,
    });
  }
  // Confetti: cosmetic only, and the reason a pop reads as a celebration
  // rather than a death.
  for (let i = 0; i < 10; i++) {
    const a = rng.next() * Math.PI * 2;
    const s = 90 + rng.next() * 220;
    w.pops.push({
      alive: true, x: m.x, y: m.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0.5 + rng.next() * 0.4, tint: m.tint, size: 5 + rng.next() * 7,
    });
  }
}

export function updateCollisions(w, rng) {
  // The buddy bots pop by touch, which is how they answer the monsters that
  // arrive from below without the player having to turn toward them.
  updateBuddies(w, (m) => popMonster(w, m, rng));

  // Bullets vs monsters.
  for (const b of w.bullets) {
    if (!b.alive) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const dx = b.x - m.x, dy = b.y - m.y;
      if (dx * dx + dy * dy > (m.r + BULLETS.radius) * (m.r + BULLETS.radius)) continue;
      b.alive = false;
      m.hp -= BULLETS.damage;
      m.hitT = 0.12;
      if (m.hp <= 0) popMonster(w, m, rng);
      break;
    }
  }

  // Monsters vs the pod.
  const p = w.player;
  if (p.invulnT <= 0 && p.alive) {
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > m.r + PLAYER.radius) continue;
      p.hearts--;
      p.invulnT = PLAYER.invulnS;
      w.stats.contacts++;
      // Being touched clears the toucher: nobody is ground down by one monster
      // parked on top of them, and the hit reads as an event rather than a
      // state.
      popMonster(w, m, rng);
      if (p.hearts <= 0) p.alive = false;
      break;
    }
  }
}

export function updateCoinsAndPops(w, dt) {
  const p = w.player;
  for (const c of w.coins) {
    if (!c.alive) continue;
    c.t -= dt;
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < COINS.magnetRadius) {
      // A coin that comes TO the player is a reward, not an errand -- and it
      // keeps the greed axis (drifting up for a coin) optional.
      c.x += (dx / (d || 1)) * COINS.magnetPxS * dt;
      c.y += (dy / (d || 1)) * COINS.magnetPxS * dt;
    } else {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.97;
      c.vy = c.vy * 0.97 + COINS.driftPxS * dt;
    }
    if (d < PLAYER.radius + COINS.radius) {
      c.alive = false;
      w.stats.coins++;
      w.stats.score += 5;
    }
    if (c.t <= 0) c.alive = false;
  }
  w.coins = w.coins.filter((c) => c.alive);

  for (const f of w.pops) {
    if (!f.alive) continue;
    f.t -= dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= 0.94;
    f.vy = f.vy * 0.94 + 120 * dt;
    if (f.t <= 0) f.alive = false;
  }
  w.pops = w.pops.filter((f) => f.alive);
}
