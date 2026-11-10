// ONE SCALE FOR THE WHOLE WORLD, AND THE THINGS IT MUST NOT TOUCH.
//
// Elad, 1 Nov: "everything is moving too fast - the enemies, me, the
// projectiles - because our input is so hard to control." The fix is a
// single multiplier rather than new constants, because the constants carry
// reasoning that is about RATIOS -- the enemy speed is a ratio to the
// player's walk, the shot speed is written as a multiple of the enemy's --
// and a scale applied to all of them leaves every one of those arguments
// standing. See core/pace.js.
//
// Two things can go wrong with a scale, and this file exists for both.
//
// 1. APPLYING IT TWICE. SHOT.speedPxS is derived from ENEMY.speedPxS, which
//    is already paced. A well-meaning `paced()` added to the derived value
//    would make enemy fire SLOWER than the enemies throwing it -- a thing
//    nobody would think to check and everybody would feel as the game being
//    subtly wrong.
//
// 2. PACING A DISTANCE. Pace is px/second. Ranges, standoffs and the magnet
//    radius are px, and they are the geometry of a dodge. Scaling them would
//    silently redesign every encounter in the game while looking like a
//    speed change.

import test from 'node:test';
import assert from 'node:assert/strict';

// Set BEFORE the first import: every module reads the query string once, at
// load. node --test gives each file its own process, so this cannot leak.
// 0.5 is chosen over the real default purely because the arithmetic is
// checkable by eye.
globalThis.location = { search: '?pace=0.5' };
globalThis.window = { addEventListener() {} };

const { PACE, paced } = await import('../src/core/pace.js');
const { ENEMY, SHOT, SHOOTER, updateEnemyShots } = await import('../src/systems/horde.js');
const { BULLET, updateFiring, updateBullets } = await import('../src/systems/combat.js');
const { TUNING } = await import('../src/systems/input.js');
const { createWorld } = await import('../src/core/world.js');
const { createBuild, stats } = await import('../src/core/abilities.js');

test('the URL sets it, and a nonsense value does not', async () => {
  assert.equal(PACE, 0.5);
  assert.equal(paced(200), 100);

  // A fresh module instance with a junk value must fall back rather than
  // multiplying the world by NaN, which would freeze everything in place.
  globalThis.location = { search: '?pace=banana' };
  const junk = await import('../src/core/pace.js?junk');
  assert.equal(junk.PACE, 0.7, 'falls back to the default');
  globalThis.location = { search: '?pace=0.5' };
});

test('THE PACE IS APPLIED TO ENEMY FIRE EXACTLY ONCE', () => {
  // The whole reason SHOT.speedPxS is written as a multiple of the enemy's
  // walk. At pace 0.5 the grunt walks 100 and its star flies 120. Paced
  // twice it would fly 60 -- slower than the thing that threw it.
  assert.equal(ENEMY.speedPxS, 100, '200 x 0.5');
  assert.equal(SHOT.speedPxS, 120, '120, not 60');
  assert.ok(SHOT.speedPxS > ENEMY.speedPxS,
    'a thrown star must outrun the arm that threw it');
});

test('EVERY RATIO SURVIVES THE SCALE -- that is why it is a scale', () => {
  // These are the relationships the comments in horde.js and combat.js
  // argue for at length. None of them may move when the pace does.
  assert.equal(TUNING.speedPxS / ENEMY.speedPxS, 520 / 200, 'player vs horde');
  assert.equal(SHOT.speedPxS / ENEMY.speedPxS, 1.2, 'enemy fire vs the horde');
  assert.equal(BULLET.speedPxS / TUNING.speedPxS, 980 / 520, 'own fire vs the walk');
});

test('DISTANCES ARE NOT PACED -- the geometry of a dodge is unchanged', () => {
  assert.equal(SHOOTER.standoffPx, 520, 'where a shooter stops');
  assert.equal(SHOT.maxTravelPx, 1560, 'how far its star gets');
  assert.equal(stats(createBuild()).magnetPx, 260, 'the gem magnet radius');
  assert.equal(stats(createBuild()).rangePx, 620, 'how far the player can shoot');
});

test('a slower bullet still covers its full range, it just takes longer', () => {
  // The lifetime is derived as range / speed, so pacing the speed without
  // touching the range leaves the reach exactly where the build says it is.
  // If that derivation were ever replaced with a constant lifetime, the
  // pace would silently shorten every weapon in the game.
  const w = createWorld();
  const st = stats(createBuild());
  w.enemies.push({ x: w.player.x + 300, y: w.player.y, alive: true, hp: 999, kind: 'grunt' });
  updateFiring(w, st, 1);
  assert.equal(w.bullets.length, 1, 'nothing was fired');

  const b = w.bullets[0];
  const from = { x: b.x, y: b.y };
  w.enemies.length = 0;                       // nothing to stop it short
  const dt = 1 / 240;
  let flewS = 0;
  while (b.alive && flewS < 60) { updateBullets(w, dt); flewS += dt; }

  const travelled = Math.hypot(b.x - from.x, b.y - from.y);
  assert.ok(Math.abs(travelled - st.rangePx) < 5,
    `travelled ${Math.round(travelled)}px, range is ${st.rangePx}px`);
  // And it took longer than it would have at full pace, which is the change.
  assert.ok(flewS > st.rangePx / 980, 'a paced shot is slower in the air');
});

test('A SLOWER SHOT IS NOT AN EVERLASTING SHOT', () => {
  // The bound on enemy fire used to be a distance alone, and a distance
  // alone stretches into more TIME the moment the speed is scaled. Measured
  // over a seeded two-minute run of the real update functions, pace 0.7
  // took the peak number of live enemy shots from 15 to 48 -- the exact
  // "field fills with projectiles" failure that maxTravelPx was written to
  // prevent. The second bound, in seconds and derived from the UNPACED
  // speed, is what holds it.
  // INSIDE THE WORLD. The first version of this test parked the shot at
  // (1e5, 1e5) to keep it away from the player and it died on frame one --
  // updateEnemyShots also expires anything outside the world bounds, which
  // is 7680 x 4320. It read as the time bound firing instantly.
  const flightS = (shot) => {
    const w = {
      player: { x: 1000, y: 10 }, playerRadius: 42,   // far off the shot's line
      enemyShots: [shot],
    };
    const dt = 1 / 120;
    let t = 0;
    while (shot.alive && t < 120) { updateEnemyShots(w, dt); t += dt; }
    return t;
  };

  const shot = {
    x: 1000, y: 2160, vx: SHOT.speedPxS, vy: 0,
    travelled: 0, aliveS: 0, alive: true,
  };
  const lived = flightS(shot);

  // At pace 0.5 the distance bound (1560px at 120px/s = 13s) is the LOOSER
  // of the two, so the time bound is what ends it -- and it ends it after
  // the same seconds a shot gets at full pace.
  assert.ok(Math.abs(lived - SHOT.maxAliveS) < 0.1,
    `lived ${lived.toFixed(2)}s, bound is ${SHOT.maxAliveS}s`);
  assert.ok(shot.travelled < SHOT.maxTravelPx,
    'it expired on time, with distance to spare');
  assert.equal(SHOT.maxAliveS, (520 * 3) / (200 * 1.2),
    'the seconds are derived from the UNPACED speed, or the pace stretches them');
});

test('at pace 1 the second bound changes nothing', () => {
  // The whole claim of the time bound is that it only bites once the world
  // is slowed. If it ever expired a shot EARLY at full pace it would be a
  // silent nerf to every shooter in the game, and nobody would connect it
  // to a change described as "make things slower".
  //
  // Asked algebraically rather than by loading the modules a second time at
  // pace 1: an import with a cache-busting query gets a fresh horde.js but
  // the SAME already-cached pace.js, so it would quietly still be at 0.5
  // and the test would prove nothing. Dividing the paced speed back out is
  // the honest way to ask what happens at pace 1.
  const unpacedShotSpeed = SHOT.speedPxS / PACE;
  assert.ok(Math.abs(SHOT.maxAliveS * unpacedShotSpeed - SHOT.maxTravelPx) < 1e-6,
    'at pace 1 the two bounds land on the same instant');
});
