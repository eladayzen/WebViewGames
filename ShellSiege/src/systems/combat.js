// AUTOMATIC AIM, AUTOMATIC FIRE.
//
// Carried over from TMNT Survivor unchanged in substance, because the argument
// behind it has not changed: the player never presses anything. They choose
// WHERE TO BE and everything else follows -- which is both the genre's design
// and the only thing a balance board can do, since it has no buttons.
//
// The only edit is the noun. Survivor shot at `w.enemies`; until the horde is
// ported this shoots at `w.targets`, which are crates. The targeting rule,
// the spread, the per-bullet hit memory and the lifetime-from-range are the
// same code, so when enemies arrive they inherit a system that has already
// been played.

import { paced } from '../core/pace.js';
import { WEAPON, arcPoint } from '../core/weapon.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

/**
 * THE HITBOX, deliberately not the drawn size -- the art is more generous than
 * the maths, which is the right way round for the player's own fire.
 *
 * Paced with everything else that travels. The lifetime below is derived as
 * range / speed, so a shot still covers exactly the range the build claims; it
 * just takes longer to get there, which is the point of core/pace.js.
 */
export const BULLET = { radius: num('bhit', 9), speedPxS: paced(980) };

/** What the gun does when nothing has upgraded it. */
export const BASE_GUN = {
  // Which weapon is in hand. Carried on the STATS rather than read from the
  // URL down in the loop, so a test can ask for one explicitly and so a
  // future ability can swap it mid-run without this module caring.
  weapon: WEAPON,
  fireIntervalS: num('sfire', 0.55),
  projectiles: num('sproj', 1),
  pierce: 0,
  damage: 10,
  rangePx: num('srange', 620),
};

/**
 * The nearest living target within range, or null.
 *
 * NEAREST, not strongest, not whatever is in front. Nearest is the only rule a
 * player can predict without being told it, and a targeting rule the player
 * cannot predict reads as the gun misfiring.
 */
export function nearestTarget(w, rangePx) {
  let best = null;
  let bestD = rangePx;
  for (const e of w.targets) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * Fire if it is time to, at whatever is nearest.
 *
 * SPLIT SHOT FANS, it does not stack on one line: several projectiles along
 * the same vector are indistinguishable from one projectile doing more damage,
 * so the upgrade would be invisible. A spread makes it legible, and makes it
 * worse against one target and better against a crowd -- a real choice rather
 * than a bigger number.
 */
export function updateFiring(w, st, dt) {
  w.fireT -= dt;
  if (w.fireT > 0) return;
  const target = nearestTarget(w, st.rangePx);
  if (!target) return;

  w.fireT = st.fireIntervalS;
  w.lastFireS = w.timeS;

  // SHOTS LEAVE THE WEAPON, not the player's navel. `w.muzzle` is written by
  // the renderer off the actual rig; without one -- every headless test, and
  // the first frame before anything has drawn -- the player's centre stands in.
  const from = w.muzzle ?? w.player;
  // Aimed FROM the muzzle as well, not merely spawned there. Spawning at the
  // weapon while aiming along the centre-to-target line makes a shot visibly
  // miss what it was pointed at, and the error is worst at close range, which
  // is exactly when the player is watching.
  const base = Math.atan2(target.y - from.y, target.x - from.x);
  const n = st.projectiles;
  const spread = n > 1 ? 0.20 : 0;
  const wp = st.weapon || WEAPON;
  const speed = BULLET.speedPxS * (wp.speedMul || 1);
  for (let i = 0; i < n; i++) {
    const a = base + (n === 1 ? 0 : (i - (n - 1) / 2) * spread);
    w.bullets.push({
      x: from.x, y: from.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      alive: true,
      pierce: st.pierce,
      damage: st.damage,
      // Derived from the weapon's OWN speed, so a faster weapon covers the
      // same range in less time rather than overshooting it.
      lifeS: st.rangePx / speed,
      hit: new Set(),
      // --- the returning weapon. Copied onto the bullet at spawn so
      // updateBullets never has to look up a global, which is what keeps it
      // testable and what lets two weapons be in the air at once.
      returns: !!wp.returns,
      returnSpeedPxS: wp.returnSpeedPxS || 0,
      bow: wp.bow || 0,
      side: (w.bullets.length % 2) ? 1 : -1,
      mode: 'out',
      t: 0,
    });
  }
}

/**
 * Turn a weapon around: it is done going out, now it comes home.
 *
 * The curve's far end is not stored, because the player moves -- only where
 * the weapon turned is fixed. See core/weapon.js.
 */
function sendHome(b, w) {
  b.mode = 'back';
  b.fromX = b.x;
  b.fromY = b.y;
  b.t = 0;
  const d = Math.hypot(w.player.x - b.x, w.player.y - b.y);
  b.backDur = Math.max(0.12, d / (b.returnSpeedPxS || 1));
  // A fresh hit set: on the way back it is a new throw as far as anything it
  // passes through is concerned. Without this it would sail harmlessly through
  // the crowd it just cut into, which is the opposite of what a returning
  // blade should feel like.
  b.hit = new Set();
}

export function updateBullets(w, dt, onHit) {
  for (const b of w.bullets) {
    if (!b.alive) continue;

    if (b.mode === 'back') {
      // Homeward, along an arc rebuilt every frame against where the player is
      // NOW. Reaching the end is being caught, not expiring.
      b.t += dt / b.backDur;
      if (b.t >= 1) { b.alive = false; continue; }
      const p = arcPoint(b.fromX, b.fromY, w.player.x, w.player.y, b.t, b.bow, b.side);
      b.x = p.x;
      b.y = p.y;
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.lifeS -= dt;
      if (b.lifeS <= 0) {
        // A thrown weapon that simply vanishes at the end of its range reads
        // as a bug. One that comes back reads as the weapon it is.
        if (b.returns) sendHome(b, w);
        else { b.alive = false; continue; }
      }
    }

    for (const e of w.targets) {
      if (!e.alive || b.hit.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) > e.radius + BULLET.radius) continue;
      e.hp -= b.damage;
      e.hitT = 0.09;
      // Remembered PER BULLET so a piercing shot cannot hit the same thing
      // twice on the way through, which at high fire rates reads as random
      // extra damage nobody can account for.
      b.hit.add(e);
      // THE DEATH IS RESOLVED BEFORE THE CALLBACK IS TOLD, and the order is
      // load-bearing. It used to be the other way round, so `e.alive` was
      // still true inside onHit and every caller asking "did that kill it?"
      // got false. That silently disabled the kill counter, the XP that
      // feeds the level-up screen, and the death burst -- none of which
      // throw, so the game looked fine and simply never progressed.
      if (e.hp <= 0) {
        e.alive = false;
        e.deadAtS = w.timeS;
      }
      if (onHit) onHit(e, b);
      // THE BOUNCE. A returning weapon turns round on the first thing it bites
      // rather than stopping dead or passing through -- that is the ability.
      // Pierce still works on the way out, so an upgraded sai cuts through a
      // line and turns round at the end of it.
      if (b.mode === 'out' && b.returns && b.pierce <= 0) { sendHome(b, w); break; }
      if (b.pierce > 0) b.pierce -= 1;
      else if (!b.returns) { b.alive = false; break; }
    }
  }
  if (w.bullets.length > 400) w.bullets = w.bullets.filter((b) => b.alive);
}
