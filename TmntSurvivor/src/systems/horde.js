// THE HORDE: spawning, chasing, dying, and what they leave behind.
//
// Enemies here are not Bloop Squad's monsters. Bloop's descend on fixed paths
// and the player dodges them; these SEEK, and the pressure comes from being
// surrounded rather than from anything being fast. That difference is the
// whole genre, and it is why the chase is the simplest code in the file and
// the spawn rule is the hardest.

import { WORLD, DESIGN_W, DESIGN_H } from '../core/world.js';
import { paced } from '../core/pace.js';

// Overridable from the URL for the same reason the movement values are: these
// are feel numbers and a desk is the wrong place to settle them.
//   ?espd=330  chase speed, px/sec     ?epop=0.55  how fast the horde grows
const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return QS.get(k) !== null && Number.isFinite(v) ? v : d;
};

// The walk speed BEFORE the global pace. Named because two things need it:
// the paced speed below, and SHOT's time bound, which exists precisely to
// not move when the pace does.
const UNPACED_WALK_PX_S = num('espd', 200);

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
  // Scaled by the global pace, like everything else that travels -- see
  // core/pace.js. 200 is still the number the reasoning above is about,
  // because what that reasoning fixes is the RATIO to the player's walk,
  // and a scale applied to both leaves the ratio untouched.
  speedPxS: paced(UNPACED_WALK_PX_S),
  hp: 10,
  touchDamage: 1,
  // Spawned just outside the visible frame: close enough to arrive soon,
  // far enough that nothing pops into existence in front of the player.
  spawnMarginPx: 180,
};

export const GEM = { radius: 13, value: 1 };

export const HEART = {
  radius: 19,
  // 0.0273: 30% more than the 0.021 it was cut to earlier on 2026-11-01,
  // on Elad's call after playing that cut. Roughly one heart in every 37
  // kills rather than one in 48.
  //
  // THE 70% CUT WAS RIGHT AND THIS IS NOT A REVERSAL OF IT. At the 0.07 it
  // came from, a long run gained hearts faster than the horde could take
  // them and the pool only ever went up -- running out stopped being a
  // thing that could happen, which is the one thing this number must never
  // do. 30% back is well short of that; what it fixes is the stretch of a
  // run where no heart has dropped for a minute and the pool is simply
  // draining with nothing the player can do about it.
  //
  // READ THIS WITH SURVIVAL.maxLives, which doubled in the same change.
  // Either number alone moves the difficulty the wrong way, and they have
  // now moved together twice -- down on the same day, then up. Whoever
  // tunes either one next should move both.
  dropChance: num('hdrop', 0.0273),
};

/**
 * THE SHOOTER: the one enemy that does not want to touch you.
 *
 * Every grunt walks straight at the player, so the only threat is the field
 * closing in and the only answer is to keep moving. That is one idea, and
 * after a minute the player has had it. The shooter inverts it: it stops at
 * a distance and throws, so backing off -- the answer to everything else --
 * is what walks you into its fire.
 *
 * It is a recolour, not new art: same silhouette, amber wraps instead of
 * crimson. Same character, visibly a different job.
 */
export const SHOOTER = {
  // How many of the horde are shooters. Fifteen in a hundred is enough that
  // one is almost always on screen and few enough that the horde still reads
  // as a crowd of grunts with something in it.
  share: num('sshare', 0.15),
  // IT STOPS HERE AND COMES NO CLOSER. Well outside the grunts' reach, and
  // inside the frame -- an enemy shooting from off-screen is not a threat
  // the player can answer, it is damage from nowhere.
  standoffPx: num('sdist', 520),
  // Slack around the standoff, so a ring of them does not lock to one exact
  // radius and read as a drawn circle.
  standoffSlackPx: 70,
  // Seconds between throws. The sensitive number: at the 90-enemy cap there
  // are ~13 shooters, so halving this roughly doubles the incoming fire.
  cooldownS: num('sfire', 4.0),
  hp: 10,
};

export const SHOT = {
  // THE HITBOX, which is not the drawn size -- systems/sprites.js draws this
  // star much larger so it can be seen coming. Left where it was when the art
  // grew, so the art is now generous: a star that looks like it clipped you
  // and did not is a gift, one that hits when it visibly missed is a bug
  // report. If the gap reads as sloppy rather than as kind on a device,
  // ?shit= closes it without touching the art.
  radius: num('shit', 16),
  // 20% faster than a grunt walks. Fast enough to punish standing still,
  // slow enough that a player who is moving at all will not be hit -- the
  // player's walk is more than double it.
  //
  // DERIVED, SO IT IS PACED EXACTLY ONCE. ENEMY.speedPxS already has the
  // global scale in it; multiplying here would apply it twice and quietly
  // make enemy fire slower than the enemies throwing it.
  speedPxS: ENEMY.speedPxS * 1.2,
  damage: 1,
  // THE PLAYER CANNOT SHOOT THESE DOWN. Nothing tests them against the
  // player's bullets and nothing should: the only way one ends is by
  // reaching the player, or by running out of the range below.
  //
  // The range is not a way of killing them, it is a bound. A shot that
  // genuinely never expired would keep flying after the player had long
  // since side-stepped it, and with ~13 shooters throwing every few seconds
  // the field would fill with projectiles nobody can see coming and nobody
  // can remove. Three times the standoff is far enough that dodging is
  // always the player's doing and never the timer's.
  maxTravelPx: num('srange', 520 * 3),
  // AND A SECOND BOUND, IN SECONDS, BECAUSE THE TWO REASONS FOR THE FIRST
  // ONE STOPPED AGREEING THE MOMENT THE WORLD GOT A PACE.
  //
  // The distance above does two jobs at once. It guarantees a shot can
  // cover a dodge -- geometry, which must not change when the game is
  // slowed -- and it guarantees shots LEAVE, which is about how long each
  // one is in the air. At one fixed speed those are the same number. Once
  // speed is scaled they are not: a slower shot crossing the same distance
  // simply lives longer, and with ~13 shooters that compounds.
  //
  // Measured rather than argued, over a simulated two-minute run driving
  // the real update functions: dropping to pace 0.7 took the peak number of
  // live enemy shots from 31 to 64, and 20 on screen at t=90s to 41. The
  // comment on maxTravelPx predicts exactly that failure -- "the field
  // would fill with projectiles nobody can see coming and nobody can
  // remove" -- it just did not foresee a pace being the thing that caused
  // it.
  //
  // So: whichever bound comes first. The distance is unchanged, so the
  // dodge geometry is untouched at any pace; the time is derived from the
  // UNPACED speed, so the air stays exactly as busy as it is today. At
  // pace 1 they expire together and this changes nothing.
  maxAliveS: num('slife', num('srange', 520 * 3) / (UNPACED_WALK_PX_S * 1.2)),
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
    const shooter = rng() < SHOOTER.share;
    w.enemies.push({
      x: p.x, y: p.y, alive: true, hitT: 0,
      kind: shooter ? 'shooter' : 'grunt',
      hp: shooter ? SHOOTER.hp : ENEMY.hp,
      // Staggered, so a wave that spawns together does not then fire
      // together. A volley that lands on one frame is unreadable and
      // unfair; the same shots spread over four seconds are neither.
      fireT: shooter ? rng() * SHOOTER.cooldownS : 0,
      standoff: shooter
        ? SHOOTER.standoffPx + (rng() - 0.5) * 2 * SHOOTER.standoffSlackPx
        : 0,
    });
  }

  for (const e of w.enemies) {
    if (!e.alive) continue;
    const dx = w.player.x - e.x;
    const dy = w.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;

    if (e.kind === 'shooter') {
      // CLOSES TO ITS STANDOFF AND NO FURTHER, and backs off if the player
      // walks into it -- otherwise a player who charges one simply deletes
      // the entire type by standing on top of it, which is the opposite of
      // the pressure it exists to create.
      const want = e.standoff;
      if (d > want + 12) {
        e.x += (dx / d) * ENEMY.speedPxS * dt;
        e.y += (dy / d) * ENEMY.speedPxS * dt;
      } else if (d < want - 12) {
        e.x -= (dx / d) * ENEMY.speedPxS * dt;
        e.y -= (dy / d) * ENEMY.speedPxS * dt;
      }
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = SHOOTER.cooldownS;
        // Aimed where the player IS, not where they are going. It does not
        // lead the target, which is what makes moving a real answer to it.
        w.enemyShots.push({
          x: e.x, y: e.y,
          vx: (dx / d) * SHOT.speedPxS,
          vy: (dy / d) * SHOT.speedPxS,
          travelled: 0,
          aliveS: 0,
          alive: true,
        });
      }
    } else {
      e.x += (dx / d) * ENEMY.speedPxS * dt;
      e.y += (dy / d) * ENEMY.speedPxS * dt;
    }

    if (e.hitT > 0) e.hitT -= dt;

    // ENEMIES DO NOT OVERLAP THE PLAYER, they stop on contact. Letting them
    // walk through means a swarm stacks invisibly on one pixel and the player
    // cannot see how much trouble they are in.
    if (d < ENEMY.radius + w.playerRadius) {
      w.contact = true;
    }
  }
}

/**
 * Enemy fire, flying and landing.
 *
 * Sets `w.contact` on a hit, exactly as a touch does, so the invulnerability
 * window and the heart cost are decided in the one place that already decides
 * them -- updateSurvival. A shot that took a life directly would bypass the
 * i-frames and a player caught between a grunt and a shot would lose two.
 */
export function updateEnemyShots(w, dt) {
  for (const s of w.enemyShots) {
    if (!s.alive) continue;
    const step = Math.hypot(s.vx, s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.travelled += step;
    s.aliveS = (s.aliveS || 0) + dt;

    if (Math.hypot(w.player.x - s.x, w.player.y - s.y) < w.playerRadius + SHOT.radius) {
      s.alive = false;
      w.contact = true;
      continue;
    }
    // Out of range, out of time, or out of the world. None of them a kill
    // -- see SHOT.maxTravelPx and SHOT.maxAliveS for why there are two.
    if (s.travelled > SHOT.maxTravelPx
        || s.aliveS > SHOT.maxAliveS
        || s.x < 0 || s.y < 0 || s.x > WORLD.width || s.y > WORLD.height) {
      s.alive = false;
    }
  }
  if (w.enemyShots.length > 200) w.enemyShots = w.enemyShots.filter((s) => s.alive);
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
