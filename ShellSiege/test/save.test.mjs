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

test('THE RUN IN PROGRESS ROUND-TRIPS, temporary abilities included, and never smuggles anything in', async () => {
  const { decodeRun } = await import('../src/systems/save.js');
  const b = createBuild(); b.rapid = 2; b.leo = 1; b.stars = 1;
  const blob = encodeProgress(b, { level: 2, room: 3, build: b });
  assert.deepEqual(blob.perm, { rapid: 2 }, 'the run leaked into the bank');
  assert.deepEqual(decodeRun(blob), { level: 2, room: 3, build: { rapid: 2, leo: 1, stars: 1 } });
  assert.equal(decodeRun(encodeProgress(b)), null, 'no run was saved');
  for (const bad of [null, '', 'x', { v: 1, run: 5 }, { v: 1, run: { level: 0, room: 0 } }, { v: 1, run: { level: 1, room: -2 } }, { v: 9, run: { level: 1, room: 0 } }]) {
    assert.equal(decodeRun(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
  const got = decodeRun({ v: 1, run: { level: 2, room: 1, build: { leo: 99, nonsense: 3, swift: 2 } } });
  assert.deepEqual(got.build, { leo: ABILITIES.leo.max }, 'clamp, unknown and locked must be dropped');
});

test('THE FURTHEST LEVEL REACHED IS SAVED, never trusted, and defaults to 1', async () => {
  const { decodeUnlocked } = await import('../src/systems/save.js');
  const b = createBuild();
  assert.equal(decodeUnlocked(encodeProgress(b, null, 4)), 4);
  assert.equal(decodeUnlocked(encodeProgress(b)), 1, 'a new player has only level 1');
  for (const bad of [null, '', 'x', { v: 1, unlocked: 0 }, { v: 1, unlocked: -3 }, { v: 1, unlocked: 'a' }, { v: 1, unlocked: 99999 }, { v: 9, unlocked: 5 }]) assert.equal(decodeUnlocked(bad), 1, `accepted ${JSON.stringify(bad)}`);
});
