// ROOMS. A room is a budget spent on enemies and is over when they are dead.
// The tests are about that being true -- the budget never overspent, the room
// never "cleared" while someone is still on the way, and the next batch
// arriving when it should rather than all at once.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { BREEDS, costOf } from '../src/core/breeds.js';
import {
  ROOM, roomBudget, levelMul, spendBudget, createRoom, updateRoom, roomCleared, enemiesLeft,
} from '../src/core/rooms.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const ALL = Object.keys(BREEDS);
const costSum = (list) => list.reduce((n, k) => n + costOf(k), 0);

/** Step a room. `kill` removes whoever is alive each frame, like a perfect player. */
function run(w, room, seconds, { kill = false, dt = 1 / 30, rng = seeded(9) } = {}) {
  for (let t = 0; t < seconds; t += dt) {
    w.timeS += dt;
    updateRoom(w, room, dt, rng);
    if (kill) for (const f of w.foes) f.alive = false;
  }
}

test('ROOMS GET BIGGER AS YOU GO, within a level and across levels', () => {
  assert.equal(roomBudget(1, 0), ROOM.baseBudget);
  for (let r = 1; r < 5; r++) assert.ok(roomBudget(1, r) > roomBudget(1, r - 1), `room ${r + 1}`);
  for (let l = 2; l < 6; l++) assert.ok(roomBudget(l, 0) > roomBudget(l - 1, 0), `level ${l}`);
});

test('LEVEL ONE IS EXACTLY AS TOUGH AS THE BREED SAYS, and later levels are tougher', () => {
  assert.deepEqual(levelMul(1), { hp: 1, dmg: 1 });
  assert.ok(levelMul(2).hp > 1 && levelMul(2).dmg > 1);
  assert.ok(levelMul(5).hp > levelMul(2).hp);
});

test('A BUDGET IS NEVER OVERSPENT, and ends only when nothing more fits', () => {
  const rng = seeded(4);
  for (let budget = 1; budget <= 60; budget++) {
    const bodies = spendBudget(budget, ALL, rng);
    const spent = costSum(bodies);
    assert.ok(spent <= budget, `budget ${budget} spent ${spent}`);
    const cheapest = Math.min(...ALL.map(costOf));
    assert.ok(budget - spent < cheapest, `budget ${budget} stopped with ${budget - spent} left`);
  }
});

test('SPENDING ONLY EVER USES THE POOL, and is repeatable from a seed', () => {
  const pool = ['slayer', 'evilgod'];
  const a = spendBudget(20, pool, seeded(8));
  const b = spendBudget(20, pool, seeded(8));
  assert.deepEqual(a, b);
  for (const k of a) assert.ok(pool.includes(k));
});

test('CHEAP ENEMIES ARE COMMON AND BIG ONES ARE RARE, which is what a crowd looks like', () => {
  const rng = seeded(31);
  const n = {};
  for (let i = 0; i < 400; i++) for (const k of spendBudget(30, ALL, rng)) n[k] = (n[k] || 0) + 1;
  const cheap = ALL.filter((k) => costOf(k) === 1).reduce((a, k) => a + (n[k] || 0), 0);
  assert.ok(cheap > (n.fortgolem || 0) * 2, `cheap ${cheap} vs fort golems ${n.fortgolem}`);
});

test('A ROOM IS A FEW NON-EMPTY BATCHES, and never costs more than its budget', () => {
  for (let level = 1; level <= 3; level++) {
    for (let r = 0; r < 5; r++) {
      const room = createRoom(level, r, 5, seeded(level * 10 + r));
      assert.ok(room.batches.length >= 1 && room.batches.length <= ROOM.batches);
      for (const b of room.batches) assert.ok(b.length > 0);
      assert.ok(costSum(room.batches.flat()) <= room.budget, `level ${level} room ${r + 1}`);
      assert.equal(room.total, room.batches.flat().length);
    }
  }
});

test('THE LAST ROOM ENDS ON ITS BOSS, held to the final batch', () => {
  const room = createRoom(1, 4, 5, seeded(2));
  assert.ok(room.isLast);
  assert.equal(room.boss, 'fortgolem');
  assert.ok(room.batches.at(-1).includes('fortgolem'));
  assert.equal(room.batches.flat().filter((k) => k === 'fortgolem').length >= 1, true);
  const first = createRoom(1, 0, 5, seeded(2));
  assert.equal(first.boss, null, 'a boss in room one is not a build-up');
});

test('NOBODY ARRIVES BEFORE THE FIRST DELAY, and an empty room is not a cleared one', () => {
  const w = createWorld();
  const room = createRoom(1, 0, 5, seeded(1));
  run(w, room, ROOM.firstDelayS * 0.5);
  assert.equal(w.foes.length, 0);
  assert.equal(roomCleared(w, room), false, 'cleared before anyone had come');
});

test('THEY STREAM IN, rather than all appearing on one frame', () => {
  const w = createWorld();
  const room = createRoom(1, 2, 5, seeded(7));
  run(w, room, ROOM.firstDelayS + ROOM.staggerS * 0.5);
  assert.equal(w.foes.length, 1, 'the first batch arrived as a wall');
});

test('A NEW FOE LANDS IN TARGETS AS THE SAME OBJECT, so the gun can see it untold', () => {
  const w = createWorld();
  const room = createRoom(1, 0, 5, seeded(3));
  run(w, room, 3);
  assert.ok(w.foes.length > 0);
  for (const f of w.foes) assert.ok(w.targets.includes(f), 'in foes but not in targets');
});

test('THE NEXT BATCH WAITS for the last to be nearly dead, so you cannot be buried', () => {
  const w = createWorld();
  const room = createRoom(1, 3, 5, seeded(5));
  const firstSize = room.batches[0].length;
  run(w, room, ROOM.maxGapS - 1);
  assert.equal(w.foes.length, firstSize, 'a second batch came while the first was alive');
});

test('...BUT NOT FOREVER -- stalling does not stop the room coming for you', () => {
  const w = createWorld();
  const room = createRoom(1, 3, 5, seeded(5));
  run(w, room, ROOM.maxGapS + 3);
  assert.ok(w.foes.length > room.batches[0].length, 'nothing arrived after the gap');
});

test('KILLING THEM BRINGS THE NEXT BATCH EARLY', () => {
  const w = createWorld();
  const room = createRoom(1, 3, 5, seeded(5));
  run(w, room, ROOM.maxGapS - 1, { kill: true });
  assert.ok(w.foes.length >= room.total, 'killing did not hurry the room along');
});

test('A ROOM CLEARS ONLY WHEN EVERYONE HAS ARRIVED AND EVERYONE IS DEAD', () => {
  const w = createWorld();
  const room = createRoom(1, 1, 5, seeded(6));
  let clearedWhileOwing = 0, prevLeft = Infinity, grew = 0;
  for (let t = 0; t < 120 && !roomCleared(w, room); t += 1 / 30) {
    w.timeS += 1 / 30;
    updateRoom(w, room, 1 / 30, seeded(9));
    const left = enemiesLeft(w, room);
    if (roomCleared(w, room) && left > 0) clearedWhileOwing++;
    // Everyone who has spawned this frame is killed next frame.
    for (const f of w.foes) f.alive = false;
    if (left > prevLeft) grew++;
    prevLeft = left;
  }
  assert.ok(roomCleared(w, room), 'never cleared');
  assert.equal(clearedWhileOwing, 0);
  assert.equal(grew, 0, 'enemiesLeft went UP, so the counter would tick backwards');
  assert.equal(w.foes.length, room.total, 'not everyone the room owed actually arrived');
  assert.equal(enemiesLeft(w, room), 0);
});

test('ON A LATER LEVEL THE SAME BREED IS TOUGHER, not just more of them', () => {
  const mk = (level) => {
    const w = createWorld();
    const room = createRoom(level, 0, 5, seeded(1));
    run(w, room, 6);
    return w.foes.find((f) => f.breed === 'slayer') || w.foes[0];
  };
  const one = mk(1), four = mk(4);
  assert.equal(one.maxHp, BREEDS[one.breed].hp, 'level 1 must be exactly the breed');
  assert.ok(four.maxHp > BREEDS[four.breed].hp);
  assert.ok(four.damage >= BREEDS[four.breed].damage);
});

test('EVERY ROOM CARRIES ITS LOOK, and it is the one the campaign says it should be', async () => {
  const { lookFor } = await import('../src/core/looks.js');
  for (let level = 1; level <= 3; level++) {
    for (let r = 0; r < 5; r++) {
      const room = createRoom(level, r, 5, seeded(1));
      assert.deepEqual(room.look, lookFor(level, r));
      assert.ok(room.look.theme && room.look.layout);
    }
  }
});

// ---- THE CURVE: what makes progression make sense ---------------------------------
import { levelMul as lm } from '../src/core/foes.js';
import { poolFor as pf, roomsIn as ri, POOL_SHIFT_PER_LEVEL } from '../src/core/breeds.js';

test('ENEMIES GROW BY COMPOUNDING, so a finished build is still eventually beaten', () => {
  assert.equal(lm(1).hp, 1); assert.equal(lm(1).dmg, 1);
  const g = (l) => lm(l + 1).hp / lm(l).hp;
  assert.ok(Math.abs(g(1) - g(8)) < 1e-9, 'growth is not a constant ratio');
  assert.ok(lm(11).hp > 4 && lm(11).dmg > 3, 'level 11 enemies are not much tougher than level 1');
});

test('ROOM BUDGETS RISE ACROSS ROOMS AND ACROSS LEVELS', () => {
  assert.ok(roomBudget(1, 4) > roomBudget(1, 0));
  assert.ok(roomBudget(2, 0) > roomBudget(1, 0));
  assert.ok(roomBudget(6, 0) > roomBudget(5, 0));
});

test('THE FIRST ROOM IS A GENTLE ONE, and every level walks further along the roster', () => {
  assert.deepEqual(pf(0, 0, false), ['slayer'], 'the first room is not just Slayers');
  assert.equal(ri(0), 5);
  const rungs = (l) => new Set(Array.from({ length: 5 }, (_, r) => pf(l, r, false)).flat()).size;
  assert.ok(rungs(3) >= rungs(0), 'a later level shows fewer kinds than the first');
  assert.ok(POOL_SHIFT_PER_LEVEL >= 1);
  assert.ok(pf(1, 0, false).length >= pf(0, 0, false).length, 'level 2 opens on a smaller roster than level 1');
});
