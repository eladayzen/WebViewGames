// WHAT YOU KEEP. The save is read back from a place a player (or a bug) could have
// scribbled on, so what matters is that nothing bad survives the round trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeProgress, decodeProgress, VERSION } from '../src/systems/save.js';
import { createBuild, ABILITIES } from '../src/core/abilities.js';

test('ONLY PERMANENT ABILITIES ARE SAVED; the turtles are not', () => {
  const b = createBuild();
  b.rapid = 3; b.hearts = 1; b.leo = 2; b.mikey = 1;
  const blob = encodeProgress(b);
  assert.equal(blob.v, VERSION);
  assert.deepEqual(blob.perm, { rapid: 3, hearts: 1 });
});

test('A SAVE ROUND-TRIPS', () => {
  const b = createBuild(); b.rapid = 2; b.damage = 1; b.reach = 4;
  assert.deepEqual(decodeProgress(encodeProgress(b)), { rapid: 2, damage: 1, reach: 4 });
  assert.deepEqual(decodeProgress(JSON.stringify(encodeProgress(b))), { rapid: 2, damage: 1, reach: 4 }, 'a string blob too');
});

test('A CORRUPT OR HOSTILE SAVE COSTS NOTHING BUT THE SAVE', () => {
  for (const bad of [null, undefined, '', 'not json', '{', 42, [], { v: 99, perm: { rapid: 3 } }, { v: 1 }, { v: 1, perm: 'x' }]) {
    assert.deepEqual(decodeProgress(bad), {}, `accepted ${JSON.stringify(bad)}`);
  }
});

test('IT CANNOT SMUGGLE IN ANYTHING THE GAME DOES NOT ALLOW', () => {
  const got = decodeProgress({ v: 1, perm: { rapid: 999, nonsense: 5, leo: 1, damage: -3, pierce: 'x', reach: 2.9 } });
  assert.equal(got.rapid, ABILITIES.rapid.max, 'not clamped to the cap');
  assert.equal(got.nonsense, undefined, 'an unknown ability got in');
  assert.equal(got.leo, undefined, 'a temporary ability got in');
  assert.equal(got.damage, undefined);
  assert.equal(got.pierce, undefined);
  assert.equal(got.reach, 2, 'a fraction was not floored');
});
