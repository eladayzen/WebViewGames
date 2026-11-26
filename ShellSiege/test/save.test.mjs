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

test('FOUR SLOTS: they round-trip, are ordered by last played, and an old single-save blob is ignored', async () => {
  const { decodeSlots, orderedSlots, SLOT_COUNT, newSlot, saveProgress, slotsNow, deleteSlot, setActiveSlot } = await import('../src/systems/save.js');
  assert.equal(SLOT_COUNT, 4);
  assert.deepEqual(decodeSlots({ v: 1, perm: { rapid: 2 } }), [null, null, null, null], 'the old save format is dropped');
  const blob = { v: 2, slots: [
    { v: 1, perm: { rapid: 2 }, unlocked: 3, saved: 100, run: { level: 3, room: 2, build: { rapid: 2, leo: 1 } } },
    null,
    { v: 1, perm: {}, unlocked: 1, saved: 500 },
    { perm: { nonsense: 9, leo: 1 }, unlocked: 99999, saved: 'x' },
  ] };
  const got = decodeSlots(JSON.stringify(blob));
  assert.equal(got.length, 4);
  assert.deepEqual(got[0].perm, { rapid: 2 });
  assert.deepEqual(got[0].run.build, { rapid: 2, leo: 1 }, 'the run keeps its temporary weapons');
  assert.deepEqual(got[3].perm, {}, 'an unknown or temporary ability got into a slot');
  assert.equal(got[3].unlocked, 1, 'a hostile level reached was kept');
  assert.deepEqual(orderedSlots(got).map((x) => x.i), [2, 0, 3], 'most recently played first');
  // the live API
  newSlot(1);
  const b = { rapid: 1 };
  saveProgress(b, { level: 2, room: 1, build: { rapid: 1, stars: 1 } }, 2);
  assert.equal(slotsNow()[1].unlocked, 2);
  assert.equal(slotsNow()[1].run.room, 1);
  assert.ok(slotsNow()[1].saved > 0, 'no timestamp');
  deleteSlot(1);
  assert.equal(slotsNow()[1], null);
  setActiveSlot(0);
});
