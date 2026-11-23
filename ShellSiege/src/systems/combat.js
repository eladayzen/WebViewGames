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
import { ARENA } from '../core/world.js';
import { blocksShot } from '../core/obstacles.js';

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
  fireIntervalS: num('sfire', 0.30),
  projectiles: num('sproj', 1),
  pierce: 0,
  damage: 13,
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
 * SPLIT SHOT GOES AT DIFFERENT ENEMIES, not around one. Elad, 22 Nov: aimed at an enemy and
 * then "split to the two sides of it", the shots missed most of the time -- an even fan has
 * NO projectile on the aim line, so two shots at one target both pass beside it.
 *
 * So each projectile is given its own job, in this order:
 *   1. the nearest enemies, one projectile each, dead on -- a crowd is hit more, and none of
 *      the shots is wasted on empty air beside a target;
 *   2. any projectiles left over (fewer enemies than shots) go at the nearest one again,
 *      fanned about the aim line starting WITH a dead-on one (0, +s, -s, +2s...), so the
 *      extra blades are visibly extra and the first is never off the line.
 * With one enemy that is a straight shot plus a narrow fan; with many it is a volley.
 */
/**
 * NINJA STARS: a second weapon beside the daggers, with its own clock. They are thrown and NOT
 * caught: each flies to the end of its range or the first enemy it hits. Light damage, slow at
 * first; the upgrades are fire rate and how many leave at once (a fan, nearest enemies first).
 * `st.stars` is { intervalS, count, damage, rangePx } or absent when the ability is not held.
 */
export const STAR = { speedPxS: paced(900), radius: 9, fan: 0.2 };
function fireStars(w, st, dt) {
  const sg = st.stars;
  if (!sg) return;
  w.starT = (w.starT ?? 0) - dt;
  if (w.starT > 0) return;
  const target = nearestTarget(w, sg.rangePx);
  if (!target) return;
  w.starT = sg.intervalS;
  const from = w.muzzle ?? w.player;
  const aimed = targetsFor(w, sg.rangePx, sg.count);
  const base = Math.atan2(target.y - from.y, target.x - from.x);
  for (let i = 0; i < sg.count; i++) {
    let a;
    if (i < aimed.length) a = Math.atan2(aimed[i].y - from.y, aimed[i].x - from.x);
    else { const k = i - aimed.length + 1; a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * STAR.fan; }
    w.bullets.push({
      x: from.x, y: from.y, vx: Math.cos(a) * STAR.speedPxS, vy: Math.sin(a) * STAR.speedPxS,
      alive: true, pierce: 0, damage: sg.damage, lifeS: sg.rangePx / STAR.speedPxS, hit: new Set(),
      kind: 'star', returns: false, returnSpeedPxS: 0, bow: 0, side: 1, mode: 'out', t: 0,
    });
  }
}

/** The nearest `n` living targets in range, nearest first. */
export function targetsFor(w, rangePx, n) {
  const near = [];
  for (const e of w.targets) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    if (d < rangePx) near.push([d, e]);
  }
  near.sort((a, b) => a[0] - b[0]);
  return near.slice(0, n).map((x) => x[1]);
}

/** Angle between the extra blades fanned about one target, radians (about 6 degrees). */
const FAN = 0.11;

export function updateFiring(w, st, dt) {
  // ONE DAGGER AT A TIME: nothing is thrown while one is still out. The shoot-again delay
  // (fireIntervalS) starts only when the blade is back in hand.
  fireStars(w, st, dt);
  // THE QUIVER: `quiver` daggers exist (1, or 2 once unlocked). A throw needs one in hand; the
  // shoot-again delay starts when the quiver is no longer full-out, i.e. a blade is back.
  const cap = st.quiver ?? st.projectiles;
  const out = w.bullets.reduce((n, b) => n + (b.alive && b.kind !== 'star' ? 1 : 0), 0);
  if (out >= cap) { w.fireT = st.fireIntervalS; return; }
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
  const n = Math.min(st.projectiles, cap - out);
  const aimed = targetsFor(w, st.rangePx, n);          // nearest first; at least `target`
  const base = Math.atan2(target.y - from.y, target.x - from.x);
  const spread = FAN;
  const wp = st.weapon || WEAPON;
  const speed = BULLET.speedPxS * (wp.speedMul || 1);
  for (let i = 0; i < n; i++) {
    let a;
    if (i < aimed.length) a = Math.atan2(aimed[i].y - from.y, aimed[i].x - from.x);       // its own target, dead on
    else {
      const k = i - aimed.length + 1;                                                     // 1, 2, 3 ...: +s, -s, +2s ...
      a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * spread;
    }
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
      kind: 'dagger',
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

    // WALLS STOP EVERY PROJECTILE (the arena's edge walls and tall obstacles). A star dies on one; a
    // dagger going out bounces off it and comes home; a dagger already coming home is simply caught.
    // Effects (grenades, stuns, shocks) are not projectiles and ignore walls.
    if (b.x < 0 || b.y < 0 || b.x > ARENA.width || b.y > ARENA.height || blocksShot(b.x, b.y, BULLET.radius, w.obstacles)) {
      if (b.mode === 'out' && b.returns) sendHome(b, w); else b.alive = false;
      continue;
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
