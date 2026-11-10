// THE STREET IS A PLACE, NOT A SHUFFLE.
//
// The decals are what makes the floor navigable -- without landmarks a
// player crossing a uniform texture cannot tell how fast they are moving or
// whether they have been here before. That only works if the landmarks stay
// put: a street re-scattered by Math.random on every run is a street nobody
// can learn, and a decal sitting exactly where someone keeps dying could
// never be looked at twice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { decalPlan, DECAL_KINDS } from '../src/systems/ground.js';
import { WORLD } from '../src/core/world.js';

test('THE SAME SEED GIVES THE SAME STREET', () => {
  assert.deepEqual(decalPlan(12345), decalPlan(12345));
});

test('a different seed gives a different street', () => {
  assert.notDeepEqual(decalPlan(1), decalPlan(2));
});

test('every decal is inside the world', () => {
  for (const d of decalPlan()) {
    assert.ok(d.x >= 0 && d.x <= WORLD.width, `x out of bounds: ${d.x}`);
    assert.ok(d.y >= 0 && d.y <= WORLD.height, `y out of bounds: ${d.y}`);
  }
});

test('every decal names an asset that exists', () => {
  for (const d of decalPlan()) {
    assert.ok(DECAL_KINDS.includes(d.key), `unknown decal: ${d.key}`);
  }
});

test('all four kinds appear, so none is dead weight in the bundle', () => {
  const seen = new Set(decalPlan().map((d) => d.key));
  for (const k of DECAL_KINDS) assert.ok(seen.has(k), `${k} never placed`);
});

test('DECALS NEVER OUTSHINE THE HORDE', () => {
  // They are landmarks, not features. Anything approaching full opacity
  // competes with an enemy for attention, and the horde has to stay the
  // most legible thing on screen at all times.
  for (const d of decalPlan()) {
    assert.ok(d.alpha > 0.1 && d.alpha < 0.6, `alpha ${d.alpha} is too loud`);
  }
});

test('the scatter is dense enough to always have a landmark in view', () => {
  // One screen is 1920x1080; at least a couple of decals should fall in any
  // given screen-sized window, or the floor reads as empty again.
  const plan = decalPlan();
  const inView = plan.filter((d) => d.x < 1920 && d.y < 1080).length;
  assert.ok(inView >= 2, `only ${inView} decals in the first screen`);
});
