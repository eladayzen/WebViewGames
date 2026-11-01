// THE HORDE: spawning, chasing, dying, and what they leave behind.
//
// Enemies here are not Bloop Squad's monsters. Bloop's descend on fixed paths
// and the player dodges them; these SEEK, and the pressure comes from being
// surrounded rather than from anything being fast. That difference is the
// whole genre, and it is why the chase is the simplest code in the file and
// the spawn rule is the hardest.

import { WORLD, DESIGN_W, DESIGN_H } from '../core/world.js';

// Overridable from the URL for the same reason the movement values are: these
// are feel numbers and a desk is the wrong place to settle them.
//   ?espd=330  chase speed, px/sec     ?epop=0.55  how fast the horde grows
const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return QS.get(k) !== null && Number.isFinite(v) ? v : d;
};

export const ENEMY = {
  radius: 34,
  // 200 against the player's 520, and the ratio is deliberately far wider than
  // the genre's. Two wrong values got here first and the second was wrong for
  // a more interesting reason than the first.
  //
  // 132 was too slow: the player walks away from the entire horde in a
  // straight line, nothing ever reaches them, the gems drop out of magnet
  // range and the run never levels. Outrunnable enemies do not make an easy
  // survivor game, they make one with no loop in it.
  //
  // 330 was MUCH too fast -- Elad, immediately, on a board. That number came
  // from the genre, where the player is about 1.6x the horde. But that
  // assumes a THUMBSTICK: instant response, instant reversal, full speed in
  // any direction the moment you ask. A balance board has none of those. The
  // deadzone eats the first part of every lean, changing direction means
  // shifting your weight, and the forward/back axis is slower to engage than
  // sideways. Nominal 520 is nothing like 520 of usable, responsive movement,
  // so the margin on paper has to be far wider than the margin that is wanted
  // in the hand.
  speedPxS: num('espd', 200),
  hp: 10,
  touchDamage: 1,
  // Spawned just outside the visible frame: close enough to arrive soon,
  // far enough that nothing pops into existence in front of the player.
  spawnMarginPx: 180,
};

export const GEM = { radius: 13, value: 1 };

export const HEART = {
  radius: 19,
  // How often a kill leaves one. Low enough that finding one is an event,
  // high enough that a long run is not a slow slide to zero.
  dropChance: num('hdrop', 0.07),
};

/**
 * How many should be alive right now.
 *
 * A COUNT, NOT A RATE. Driving a horde by spawns-per-second means a player who
 * kills nothing drowns while a player who kills everything starves, and both
 * feel like the game is broken. A target population self-corrects: clear the
 * field and it refills, fall behind and it stops growing.
 */
export function targetPopulation(timeS) {
  return Math.min(90, Math.floor(6 + timeS * num('epop', 0.55)));
}

/** Somewhere just off the edge of what the player can see. */
function spawnPoint(cam, rng) {
  const halfW = DESIGN_W / 2 + ENEMY.spawnMarginPx;
  const halfH = DESIGN_H / 2 + ENEMY.spawnMarginPx;
  const edge = Math.floor(rng() * 4);
  const t = rng();
  let x, y;
  if (edge === 0) { x = cam.x - halfW + t * halfW * 2; y = cam.y - halfH; }
  else if (edge === 1) { x = cam.x - halfW + t * halfW * 2; y = cam.y + halfH; }
  else if (edge === 2) { x = cam.x - halfW; y = cam.y - halfH + t * halfH * 2; }
  else { x = cam.x + halfW; y = cam.y - halfH + t * halfH * 2; }
  return {
    x: Math.max(0, Math.min(WORLD.width, x)),
    y: Math.max(0, Math.min(WORLD.height, y)),
  };
}

export function updateHorde(w, dt, rng = Math.random) {
  const want = targetPopulation(w.timeS);
  // ALIVE, not length. The array keeps its dead until it is compacted, so
  // topping up against `.length` meant the horde was never refilled: kill the
  // first six and the field stays empty until 220 corpses have accumulated,
  // which never happens because nothing is spawning. Found by playing it --
  // the HUD said "horde 0" while the game looked like it was working.
  let alive = 0;
  for (const e of w.enemies) if (e.alive) alive++;
  while (alive < want) {
    alive++;
    const p = spawnPoint(w.camera, rng);
    w.enemies.push({ x: p.x, y: p.y, hp: ENEMY.hp, alive: true, hitT: 0 });
  }

  for (const e of w.enemies) {
    if (!e.alive) continue;
    const dx = w.player.x - e.x;
    const dy = w.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * ENEMY.speedPxS * dt;
    e.y += (dy / d) * ENEMY.speedPxS * dt;
    if (e.hitT > 0) e.hitT -= dt;

    // ENEMIES DO NOT OVERLAP THE PLAYER, they stop on contact. Letting them
    // walk through means a swarm stacks invisibly on one pixel and the player
    // cannot see how much trouble they are in.
    if (d < ENEMY.radius + w.playerRadius) {
      w.contact = true;
    }
  }
}

/** Kill it, and leave a gem where it fell. */
export function killEnemy(w, e, rng = Math.random) {
  e.alive = false;
  w.gems.push({ x: e.x, y: e.y, alive: true });
  if (rng() < HEART.dropChance) w.hearts.push({ x: e.x, y: e.y, alive: true });
  w.kills += 1;
}

/**
 * Hearts, which are NOT magnetised, and that is the whole design of them.
 *
 * Gems come to you: collecting them is not a decision, it is a reward for
 * killing. A heart makes you GO AND GET IT -- usually back through the gap
 * the horde just came from, because that is where the thing died. The player
 * weighs the walk against the heart, every time, and that is a real decision
 * made with nothing but movement, which is the only verb this game has.
 *
 * Give them a magnet and they become gems with a different colour.
 */
export function updateHearts(w, onCollect) {
  for (const h of w.hearts) {
    if (!h.alive) continue;
    if (Math.hypot(w.player.x - h.x, w.player.y - h.y) < w.playerRadius + HEART.radius) {
      h.alive = false;
      onCollect(1);
    }
  }
  if (w.hearts.length > 60) w.hearts = w.hearts.filter((h) => h.alive);
}

/**
 * Pull gems in and collect them.
 *
 * THE MAGNET IS WHY THIS FEELS GOOD. Walking over every gem individually is
 * admin; a radius that hoovers them toward you turns killing a cluster into
 * one satisfying pull. It is also the ability players reach for first, which
 * is a good sign it belongs in the pool.
 */
export function updateGems(w, dt, magnetPx, onCollect) {
  for (const g of w.gems) {
    if (!g.alive) continue;
    const dx = w.player.x - g.x;
    const dy = w.player.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < magnetPx) {
      // Faster the closer it gets, so the last stretch snaps rather than drifts.
      const pull = 240 + (1 - d / magnetPx) * 900;
      g.x += (dx / d) * pull * dt;
      g.y += (dy / d) * pull * dt;
    }
    if (d < w.playerRadius + GEM.radius) {
      g.alive = false;
      onCollect(GEM.value);
    }
  }
  // Compacted here rather than every frame elsewhere: both lists are walked
  // once per frame anyway and splicing inside the walk is how off-by-ones get in.
  if (w.gems.length > 400) w.gems = w.gems.filter((g) => g.alive);
}

export function compactEnemies(w) {
  if (w.enemies.length > 220) w.enemies = w.enemies.filter((e) => e.alive);
}
