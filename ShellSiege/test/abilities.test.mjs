// The draw and the stacking -- the two things that would quietly ruin a run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, createBuild, stats, draw, take, offerable, xpForLevel } from '../src/core/abilities.js';

/** A deterministic rng, so a failure is reproducible rather than a story. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test('A DRAW NEVER OFFERS THE SAME ABILITY TWICE', () => {
  // Two identical cards is not bad luck, it reads as the game being broken.
  const rng = seeded(7);
  for (let i = 0; i < 400; i++) {
    const got = draw(createBuild(), rng);
    assert.equal(new Set(got).size, got.length, `duplicate in ${got.join(', ')}`);
  }
});

test('a maxed ability stops being offered', () => {
  const b = createBuild();
  for (let i = 0; i < ABILITIES.pierce.max; i++) take(b, 'pierce');
  assert.equal(b.pierce, ABILITIES.pierce.max);
  assert.ok(!offerable(b).includes('pierce'));
  const rng = seeded(3);
  for (let i = 0; i < 300; i++) assert.ok(!draw(b, rng).includes('pierce'));
});

test('taking one past its cap does nothing', () => {
  const b = createBuild();
  for (let i = 0; i < ABILITIES.multi.max + 5; i++) take(b, 'multi');
  assert.equal(b.multi, ABILITIES.multi.max);
});

test('NEAR THE END A SHORT DRAW IS CORRECT, not a padded one', () => {
  const b = createBuild();
  // Max everything but two. slice(0, -2) rather than slice(0, 6): this pool
  // is six abilities, not Survivor's eight, and a hardcoded 6 maxed ALL of
  // them -- so the test asked for a draw of two from an empty pool and the
  // assertion it really cares about never ran.
  for (const k of Object.keys(ABILITIES).slice(0, -2)) {
    for (let i = 0; i < ABILITIES[k].max; i++) take(b, k);
  }
  const got = draw(b, seeded(11));
  assert.equal(got.length, 2);
  assert.equal(new Set(got).size, 2);
});

test('stacking moves the numbers the game actually reads', () => {
  const b = createBuild();
  const base = stats(b);
  take(b, 'rapid'); take(b, 'multi'); take(b, 'swift');
  const after = stats(b);
  assert.ok(after.fireIntervalS < base.fireIntervalS, 'rapid shortens the gap between shots');
  assert.equal(after.projectiles, base.projectiles + 1);
  // speedMul, not Survivor's speedPxS: here SWIFT is a multiplier the world
  // already applies to walk speed, so the ability needed no new plumbing.
  assert.ok(after.speedMul > base.speedMul);
  // And nothing it did not touch moved.
  assert.equal(after.rangePx, base.rangePx);
});

test('EVERY ABILITY CHANGES SOMETHING -- no dead cards in the pool', () => {
  // A card that does nothing is worse than a missing card: the player spends
  // their pick on it and learns the choice does not matter.
  const base = JSON.stringify(stats(createBuild()));
  for (const key of Object.keys(ABILITIES)) {
    const b = take(createBuild(), key);
    assert.notEqual(JSON.stringify(stats(b)), base, `${key} changed no stat`);
  }
});

test('levels cost more as they go, and the first is cheap', () => {
  assert.ok(xpForLevel(1) < xpForLevel(2));
  assert.ok(xpForLevel(5) < xpForLevel(6));
  assert.ok(xpForLevel(1) <= 20, 'the first level must arrive early enough to teach the loop');
});
