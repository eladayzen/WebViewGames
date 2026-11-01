// AUTOMATIC AIM, AUTOMATIC FIRE.
//
// The player never presses anything. They choose WHERE TO BE, and everything
// else follows from that -- which is both the genre's design and the only
// thing this hardware can do, since a balance board has no buttons. The two
// requirements happen to agree, which is rare and worth noticing.
//
// So the only decisions here are: who to shoot at, and what happens when the
// shot lands. Both are kept dull on purpose.

import { killEnemy, ENEMY } from './horde.js';

export const BULLET = { radius: 9, speedPxS: 980 };

/**
 * The nearest living enemy within range, or null.
 *
 * NEAREST, not strongest, not weakest, not whatever is in front. Nearest is
 * the only rule a player can predict without being told it, and a targeting
 * rule the player cannot predict reads as the gun misfiring.
 *
 * Linear scan over the whole horde every shot. With a target population
 * capped at 90 that is nothing, and a spatial index here would be optimising
 * the one thing that is not slow.
 */
export function nearestEnemy(w, rangePx) {
  let best = null;
  let bestD = rangePx;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * Fire if it is time to, at whatever is nearest.
 *
 * SPLIT SHOT FANS, it does not stack on one line. Several projectiles along
 * the exact same vector is indistinguishable from one projectile doing more
 * damage, so the ability would be invisible -- the player would read it as
 * nothing having happened. A small spread makes it legible and makes it worse
 * against a single target and better against a crowd, which is a real choice
 * rather than a bigger number.
 */
export function updateFiring(w, st, dt) {
  w.fireT -= dt;
  if (w.fireT > 0) return;
  const target = nearestEnemy(w, st.rangePx);
  if (!target) return;

  w.fireT = st.fireIntervalS;
  const base = Math.atan2(target.y - w.player.y, target.x - w.player.x);
  const n = st.projectiles;
  const spread = n > 1 ? 0.20 : 0;
  for (let i = 0; i < n; i++) {
    const a = base + (n === 1 ? 0 : (i - (n - 1) / 2) * spread);
    w.bullets.push({
      x: w.player.x, y: w.player.y,
      vx: Math.cos(a) * BULLET.speedPxS,
      vy: Math.sin(a) * BULLET.speedPxS,
      alive: true,
      pierce: st.pierce,
      damage: st.damage,
      lifeS: st.rangePx / BULLET.speedPxS,
      hit: new Set(),
    });
  }
}

export function updateBullets(w, dt) {
  for (const b of w.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.lifeS -= dt;
    if (b.lifeS <= 0) { b.alive = false; continue; }

    for (const e of w.enemies) {
      if (!e.alive || b.hit.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) > ENEMY.radius + BULLET.radius) continue;
      e.hp -= b.damage;
      e.hitT = 0.09;
      // Remembered PER BULLET so a piercing shot cannot hit the same enemy
      // twice as it passes through -- which at high fire rates reads as
      // random extra damage nobody can account for.
      b.hit.add(e);
      if (e.hp <= 0) killEnemy(w, e);
      if (b.pierce > 0) b.pierce -= 1;
      else { b.alive = false; break; }
    }
  }
  if (w.bullets.length > 500) w.bullets = w.bullets.filter((b) => b.alive);
}

/**
 * The orbiting weapon -- the one ability that is a behaviour rather than a
 * number, so that the pool is not entirely arithmetic.
 *
 * It damages on contact and has its own short cooldown per enemy, which is
 * what stops a stationary player parked in a crowd from deleting the horde
 * for free.
 */
export const ORBIT = { radius: 22, distancePx: 150, speedRadS: 2.6, damage: 8, cooldownS: 0.5 };

export function updateOrbiters(w, st, dt) {
  w.orbitPhase += ORBIT.speedRadS * dt;
  if (st.orbiters <= 0) return;
  for (let i = 0; i < st.orbiters; i++) {
    const a = w.orbitPhase + (i * Math.PI * 2) / st.orbiters;
    const ox = w.player.x + Math.cos(a) * ORBIT.distancePx;
    const oy = w.player.y + Math.sin(a) * ORBIT.distancePx;
    for (const e of w.enemies) {
      if (!e.alive) continue;
      if ((e.orbitCool || 0) > 0) { continue; }
      if (Math.hypot(e.x - ox, e.y - oy) > ENEMY.radius + ORBIT.radius) continue;
      e.hp -= ORBIT.damage;
      e.hitT = 0.09;
      e.orbitCool = ORBIT.cooldownS;
      if (e.hp <= 0) killEnemy(w, e);
    }
  }
  for (const e of w.enemies) if (e.orbitCool > 0) e.orbitCool -= dt;
}
