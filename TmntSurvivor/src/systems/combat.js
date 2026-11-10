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
import { paced } from '../core/pace.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

/**
 * THE HITBOX, which is deliberately not the drawn size. sprites.js draws this
 * star at 64px while it hits at radius 9, so the art is far more generous than
 * the maths -- which is the right way round for the player's own fire: missing
 * something that looked like a hit costs a fraction of a second, and a shot
 * that connects off-screen-looking would read as the gun cheating.
 *
 * ?bhit= to try a different one on a board.
 */
// Paced with everything else. The lifetime below is derived as
// range / speed, so the shot still covers exactly the range the build says
// it does -- it takes longer to get there, which is the point.
export const BULLET = { radius: num('bhit', 9), speedPxS: paced(980) };

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
  w.lastFireS = w.timeS;

  // SHOTS LEAVE THE BARREL, not the player's navel. `w.muzzle` is written by
  // the renderer from the actual sprite (see core/world.js); without one --
  // every headless test, and the first frame before anything has drawn --
  // the player's centre stands in, which is where this used to fire from.
  const from = w.muzzle ?? w.player;
  // Aimed FROM THE MUZZLE as well, not just spawned there. Spawning at the
  // barrel while still aiming along the centre-to-target line makes a shot
  // visibly miss something it was pointed at, and the error is worst at close
  // range, which is exactly when the player is watching.
  const base = Math.atan2(target.y - from.y, target.x - from.x);
  const n = st.projectiles;
  const spread = n > 1 ? 0.20 : 0;
  for (let i = 0; i < n; i++) {
    const a = base + (n === 1 ? 0 : (i - (n - 1) / 2) * spread);
    w.bullets.push({
      x: from.x, y: from.y,
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
/**
 * THE KATANA. A blade that sweeps around the turtle, is sheathed, and comes
 * back -- not a permanent orbit.
 *
 * WHY IT RESTS. Elad's call, and it is what makes this card different in kind
 * from the other seven. Everything else in the build is a number that goes up
 * and then just is: fire faster, hit harder, move quicker. A weapon that
 * circles you forever is one more of those. Drawn and sheathed, it is the one
 * thing that changes what the player should be DOING from moment to moment --
 * wade in while it is out, keep your spacing while it is not -- which is the
 * only rhythm in a genre whose whole input is where you stand.
 *
 * EACH LEVEL SHORTENS THE REST, IT DOES NOT LENGTHEN THE SWEEP. Three levels
 * run 6.0s -> 4.2s -> 3.0s of rest against a sweep that stays at 4s. Longer
 * sweeps would walk the weapon toward being permanently out, which is the
 * thing it is deliberately not; shorter rests make it come back sooner while
 * keeping the gap the player plays around. Level 3 is still off a third of
 * the time.
 *
 * `hitCooldownS` is a different clock and is not part of this: it is how long
 * one enemy is immune after a blade touches it, so a sweep does not shred a
 * single target at frame rate.
 *
 *   ?kdur=4  seconds out      ?krest=6  seconds sheathed at level 1
 */
export const KATANA = {
  radius: 26,
  distancePx: 150,
  speedRadS: 2.6,
  damage: 8,
  hitCooldownS: 0.5,
  drawnS: num('kdur', 4.0),
  restS: [num('krest', 6.0), 4.2, 3.0],
  bladeLenPx: 92,
  // Degrees added to the sweep angle when the sprite is drawn. 0 points the
  // tip outward along the radius, 90 lays it on the tangent. The art itself
  // points right, so this is purely about how the swing should read and not
  // about correcting the asset.
  //
  //   ?krot=0
  artRotRad: (num('krot', 0) * Math.PI) / 180,
};

/** Seconds the weapon stays sheathed at this many levels. */
export function restFor(blades) {
  return KATANA.restS[Math.min(Math.max(blades, 1), KATANA.restS.length) - 1];
}

/**
 * Is the blade out right now, and how far through its current state is it?
 *
 * Returned together because the drawing needs both: the sweep is drawn only
 * while out, and the HUD has to show the rest filling back up or the weapon
 * reads as having broken rather than as resting.
 */
export function katanaState(w, blades) {
  if (blades <= 0) return { out: false, progress: 0 };
  const rest = restFor(blades);
  const cycle = KATANA.drawnS + rest;
  const t = w.katanaT % cycle;
  return t < KATANA.drawnS
    ? { out: true, progress: t / KATANA.drawnS }
    : { out: false, progress: (t - KATANA.drawnS) / rest };
}

export function updateKatana(w, st, dt) {
  // The sweep keeps turning whether or not the blade is out, so it is never
  // drawn from a standing start -- it comes back mid-swing, which is what a
  // weapon being unsheathed looks like.
  w.bladePhase += KATANA.speedRadS * dt;
  if (st.blades <= 0) return;
  w.katanaT += dt;
  if (!katanaState(w, st.blades).out) {
    // Per-enemy immunity still ticks down while sheathed, or an enemy
    // touched on the last frame of a sweep would be immune into the next.
    for (const e of w.enemies) if (e.bladeCool > 0) e.bladeCool -= dt;
    return;
  }
  for (let i = 0; i < st.blades; i++) {
    const a = w.bladePhase + (i * Math.PI * 2) / st.blades;
    const ox = w.player.x + Math.cos(a) * KATANA.distancePx;
    const oy = w.player.y + Math.sin(a) * KATANA.distancePx;
    for (const e of w.enemies) {
      if (!e.alive) continue;
      if ((e.bladeCool || 0) > 0) { continue; }
      if (Math.hypot(e.x - ox, e.y - oy) > ENEMY.radius + KATANA.radius) continue;
      e.hp -= KATANA.damage;
      e.hitT = 0.09;
      e.bladeCool = KATANA.hitCooldownS;
      if (e.hp <= 0) killEnemy(w, e);
    }
  }
  for (const e of w.enemies) if (e.bladeCool > 0) e.bladeCool -= dt;
}
