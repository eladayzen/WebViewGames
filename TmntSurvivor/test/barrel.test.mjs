// THE ROUND IN THE BARREL, and shots that leave from the end of it.
//
// Two separate things that both hang off the muzzle, and both of which look
// obviously wrong on screen while being easy to get wrong in a way no other
// test would catch.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { createWorld } = await import('../src/core/world.js');
const { updateFiring } = await import('../src/systems/combat.js');
const { barrelStarScale, BARREL_STAR } = await import('../src/systems/sprites.js');

/** The derived stats updateFiring wants, with only the fields it reads. */
function gun(over = {}) {
  return {
    fireIntervalS: 0.5, projectiles: 1, pierce: 0, damage: 1, rangePx: 900,
    ...over,
  };
}

// --- the star in the barrel -------------------------------------------------

test('THE BARREL STARTS LOADED, before a shot has ever been fired', () => {
  // w.lastFireS is -Infinity at the top of a run, so this is the value the
  // very first frame asks about. A barrel that starts empty would have the
  // player staring at a hole until their first kill.
  assert.equal(barrelStarScale(Infinity, 0.5), 1);
});

test('the barrel is EMPTY straight after a shot, then refills', () => {
  assert.equal(barrelStarScale(0, 0.5), 0, 'gone the instant it fires');
  assert.equal(barrelStarScale(BARREL_STAR.goneS * 0.99, 0.5), 0, 'still gone');
  assert.ok(barrelStarScale(BARREL_STAR.goneS + BARREL_STAR.popS * 0.5, 0.5) > 0,
    'and on its way back');
});

test('THE POP OVERSHOOTS AND THEN SETTLES -- that is the whole juice', () => {
  const at = (t) => barrelStarScale(BARREL_STAR.goneS + t * BARREL_STAR.popS, 0.5);
  let peak = 0;
  for (let t = 0; t <= 1; t += 0.02) peak = Math.max(peak, at(t));
  assert.ok(peak > 1.1, `it must visibly swell past full size, got ${peak.toFixed(3)}`);
  assert.equal(at(1), 1, 'and land exactly on full size, not above it');
  // And stay there. A curve that keeps ringing would have the star breathing
  // forever between shots.
  assert.equal(barrelStarScale(99, 0.5), 1);
});

test('the pop starts from NOTHING, so the star rises out of the barrel', () => {
  // Not from 0.5, not from 1 -- the mask hides a star that is still small
  // enough to sit inside the barrel, and that is what sells it.
  assert.equal(barrelStarScale(BARREL_STAR.goneS, 0.5), 0);
});

test('A FAST FIRE RATE STILL SHOWS A STAR, compressed rather than skipped', () => {
  // The animation is 0.28s end to end and a maxed fire rate is quicker than
  // that. Without compression the barrel would read as permanently empty for
  // the rest of the run -- at exactly the point the player earned the upgrade.
  const fast = 0.12;
  assert.ok(fast < BARREL_STAR.goneS + BARREL_STAR.popS, 'premise: faster than the animation');
  assert.equal(barrelStarScale(fast * 0.95, fast), 1,
    'the star is back before the next shot, however fast the gun is');
});

// --- shots leave the barrel -------------------------------------------------

test('SHOTS SPAWN AT THE MUZZLE, not at the player', () => {
  const w = createWorld();
  w.muzzle = { x: w.player.x + 60, y: w.player.y - 20 };
  w.enemies = [{ x: w.player.x + 400, y: w.player.y, alive: true, radius: 20 }];
  updateFiring(w, gun(), 1);
  assert.equal(w.bullets.length, 1);
  assert.equal(w.bullets[0].x, w.muzzle.x);
  assert.equal(w.bullets[0].y, w.muzzle.y);
});

test('and they are AIMED from the muzzle too, not merely spawned there', () => {
  // Spawning at the barrel while aiming along the centre-to-target line makes
  // a shot visibly miss what it was pointed at, worst at close range.
  const w = createWorld();
  w.muzzle = { x: w.player.x, y: w.player.y - 100 };
  const target = { x: w.player.x + 100, y: w.player.y, alive: true, radius: 20 };
  w.enemies = [target];
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  // From the muzzle the target is down-and-right, so vy must be POSITIVE.
  // Aimed from the player's centre it would be exactly zero.
  assert.ok(b.vy > 0, 'the shot angles down toward the target from the barrel');
  const ang = Math.atan2(target.y - w.muzzle.y, target.x - w.muzzle.x);
  assert.ok(Math.abs(Math.atan2(b.vy, b.vx) - ang) < 1e-9);
});

test('WITH NO MUZZLE PUBLISHED the player stands in, and nothing crashes', () => {
  // Every headless test and the first frame of a run are in this state.
  const w = createWorld();
  assert.equal(w.muzzle, null, 'premise: a fresh world has no muzzle yet');
  w.enemies = [{ x: w.player.x + 300, y: w.player.y, alive: true, radius: 20 }];
  updateFiring(w, gun(), 1);
  assert.equal(w.bullets[0].x, w.player.x);
  assert.equal(w.bullets[0].y, w.player.y);
});

test('firing stamps the clock the barrel star reads', () => {
  const w = createWorld();
  assert.equal(w.lastFireS, -Infinity, 'so the barrel starts loaded');
  w.timeS = 12.5;
  w.enemies = [{ x: w.player.x + 300, y: w.player.y, alive: true, radius: 20 }];
  updateFiring(w, gun(), 1);
  assert.equal(w.lastFireS, 12.5);
});

test('A VOLLEY ALL LEAVES THE SAME BARREL', () => {
  // Multi-shot spreads the angles, not the origins -- three stars appearing
  // at three different points in mid-air is not a gun firing three times.
  const w = createWorld();
  w.muzzle = { x: w.player.x + 60, y: w.player.y - 20 };
  w.enemies = [{ x: w.player.x + 400, y: w.player.y, alive: true, radius: 20 }];
  updateFiring(w, gun({ projectiles: 3 }), 1);
  assert.equal(w.bullets.length, 3);
  for (const b of w.bullets) {
    assert.equal(b.x, w.muzzle.x);
    assert.equal(b.y, w.muzzle.y);
  }
  const angles = w.bullets.map((b) => Math.atan2(b.vy, b.vx));
  assert.ok(new Set(angles).size === 3, 'while still fanning out');
});
