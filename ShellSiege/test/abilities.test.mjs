// The stacking and the table -- the things that would quietly ruin a run.
// (The draw itself is core/roll.js now, and is tested in roll.test.mjs.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, KINDS, createBuild, stats, take, offerable } from '../src/core/abilities.js';

test('a maxed ability stops being offered', () => {
  const b = createBuild();
  for (let i = 0; i < ABILITIES.pierce.max; i++) take(b, 'pierce');
  assert.equal(b.pierce, ABILITIES.pierce.max);
  assert.ok(!offerable(b).includes('pierce'));
});

test('taking one past its cap does nothing', () => {
  const b = createBuild();
  for (let i = 0; i < ABILITIES.damage.max + 5; i++) take(b, 'damage');
  assert.equal(b.damage, ABILITIES.damage.max);
});

test('stacking moves the numbers the game actually reads', () => {
  const b = createBuild();
  const base = stats(b);
  take(b, 'rapid');
  const after = stats(b);
  assert.ok(after.fireIntervalS < base.fireIntervalS, 'rapid shortens the gap between shots');
  assert.equal(after.projectiles, 1, 'one dagger only, for now');
  assert.equal(after.speedMul, 1, 'player speed is never upgraded');
  // And nothing it did not touch moved.
  assert.equal(after.rangePx, base.rangePx);
  assert.equal(after.maxHpMul, base.maxHpMul);
});

test('EVERY ABILITY CHANGES SOMETHING -- no dead rolls in the pool', () => {
  // A roll that does nothing is worse than a missing one: the player waits
  // for the box, sees it open, and learns the box does not matter.
  // Permanent abilities are stat modifiers. A TEMP one is a behaviour (the turtle allies,
  // core/allies.js), which changes no stat -- its test is that it summons someone.
  for (const key of Object.keys(ABILITIES).filter((k) => ABILITIES[k].kind === 'perm' && !ABILITIES[k].locked)) {
    const b = createBuild();
    if (ABILITIES[key].requires) take(b, ABILITIES[key].requires);
    const base = JSON.stringify(stats(b));
    take(b, key);
    assert.notEqual(JSON.stringify(stats(b)), base, `${key} changed no stat`);
  }
});

test('THICK HIDE RAISES MAX HEALTH, and is a multiplier so ?php= still works', () => {
  const b = createBuild();
  assert.equal(stats(b).maxHpMul, 1);
  take(b, 'hearts');
  assert.ok(stats(b).maxHpMul > 1);
  for (let i = 0; i < 20; i++) take(b, 'hearts');
  assert.equal(b.hearts, ABILITIES.hearts.max, 'and it caps like everything else');
});

test('EVERY ABILITY SAYS WHETHER IT IS PERMANENT, and carries a usable weight', () => {
  // `kind` is what the run will read to decide what survives a death. An
  // ability without one would be silently treated as one or the other.
  for (const [k, a] of Object.entries(ABILITIES)) {
    assert.ok(KINDS.includes(a.kind), `${k} has kind ${a.kind}`);
    assert.ok(Number.isFinite(a.weight) && a.weight > 0, `${k} has weight ${a.weight}`);
    assert.ok((a.locked || a.max >= 1) && a.step > 0, `${k} cannot be taken`);
  }
});

test('THE TEMPORARY ABILITIES ARE EXACTLY THE TURTLE ALLIES (the three of them), and `clearTemp` (a death) clears them', async () => {
  const { clearTemp } = await import('../src/core/abilities.js');
  const temp = Object.keys(ABILITIES).filter((k) => ABILITIES[k].kind === 'temp').sort();
  assert.deepEqual(temp, ['donnie', 'leo', 'mikey']);
  const b = createBuild();
  take(b, 'leo'); take(b, 'donnie'); take(b, 'rapid');
  clearTemp(b);
  assert.equal(b.leo, 0); assert.equal(b.donnie, 0);
  assert.equal(b.rapid, 1, 'a permanent ability survived the level');
});

test('STAR UPGRADES ARE OFFERED ONLY ONCE YOU HAVE STARS', () => {
  const b = createBuild();
  assert.ok(!offerable(b).includes('starrate') && !offerable(b).includes('starsplit'));
  assert.equal(stats(b).stars, null);
  take(b, 'stars');
  assert.ok(offerable(b).includes('starrate') && offerable(b).includes('starsplit'));
});

test('NINJA STARS: light, slow to start, and the upgrades are rate and count, with a cap', () => {
  const b = createBuild(); take(b, 'stars');
  const s0 = stats(b);
  assert.ok(s0.stars.damage < stats(createBuild()).damage, 'stars should hit lighter than daggers');
  assert.equal(s0.stars.count, 1);
  take(b, 'starrate'); take(b, 'starsplit');
  const s1 = stats(b);
  assert.ok(s1.stars.intervalS < s0.stars.intervalS && s1.stars.count === 2);
  for (let i = 0; i < 10; i++) take(b, 'starsplit');
  assert.equal(stats(b).stars.count, 1 + ABILITIES.starsplit.max);
});

test('TWIN DAGGERS RAISES THE QUIVER TO TWO AND NO FURTHER', () => {
  const b = createBuild();
  assert.equal(stats(b).quiver, 1);
  for (let i = 0; i < 5; i++) take(b, 'multi');
  assert.equal(stats(b).quiver, 2);
});
