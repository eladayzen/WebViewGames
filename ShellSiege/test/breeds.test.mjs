// WHO TURNS UP, AND WHAT THEY ARE. The tests are about the table being
// coherent and the introduction order being real -- not about any particular
// enemy's hit points, which are tuned by feel and would only make this brittle.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BREEDS, DEFAULT_BREED, LEVELS, poolFor, roomsIn, costOf, usedBreeds } from '../src/core/breeds.js';
import { makeFoe } from '../src/core/foes.js';

test('EVERY ROOM NAMES ONLY BREEDS THAT EXIST', () => {
  // A typo here is an enemy that never spawns, with nothing logged.
  for (const lv of LEVELS) {
    for (const pool of lv.pools) {
      assert.ok(pool.length > 0, `${lv.name} has an empty room`);
      for (const b of pool) assert.ok(BREEDS[b], `${lv.name} names unknown breed ${b}`);
    }
    assert.ok(BREEDS[lv.boss], `${lv.name} has no such boss ${lv.boss}`);
  }
});

test('a new breed is introduced ALONGSIDE the old ones, not instead of them', () => {
  // Swapping the roster wholesale reads as the game changing the subject.
  for (const lv of LEVELS) {
    for (let i = 1; i < lv.pools.length; i++) {
      const kept = lv.pools[i].filter((b) => lv.pools[i - 1].includes(b));
      assert.ok(kept.length > 0, `${lv.name} room ${i + 1} shares nobody with the room before`);
    }
  }
});

test('every breed the table defines is used by the designed order', () => {
  const used = new Set(LEVELS.flatMap((l) => [...l.pools.flat(), l.boss]));
  for (const k of Object.keys(BREEDS)) assert.ok(used.has(k), `${k} is never spawned`);
});

test('THE DESIGNED ORDER AND THE SHOW-EVERYTHING DEFAULT BOTH EXIST', () => {
  // Elad asked to see every enemy from the first room "for now". That default
  // must not have cost the real curve: it has to stay reachable with one flag.
  const all = poolFor(0, 0, true);
  assert.deepEqual([...all].sort(), Object.keys(BREEDS).sort());
  assert.deepEqual(poolFor(0, 0, false), LEVELS[0].pools[0]);
  assert.ok(poolFor(0, 0, false).length < all.length, 'the designed first room is not everyone');
});

test('a room past the end of the pool list reuses the last one rather than crashing', () => {
  const last = LEVELS[0].pools.at(-1);
  assert.deepEqual(poolFor(0, 999, false), last);
});

test('a level past the last defined one wraps round, so level 7 is not undefined', () => {
  assert.ok(roomsIn(LEVELS.length + 3) >= 1);
  assert.ok(poolFor(LEVELS.length + 3, 0, false).length >= 1);
});

test('usedBreeds covers every breed a room can spawn, so nothing spawns unloaded', () => {
  const loaded = new Set(usedBreeds());
  for (let i = 0; i < roomsIn(0); i++) {
    for (const b of poolFor(0, i)) assert.ok(loaded.has(b), `${b} would spawn unloaded`);
  }
  assert.ok(loaded.has(LEVELS[0].boss), 'and neither would the boss');
});

test('A FOE CARRIES ITS BREED’S NUMBERS, not the module defaults', () => {
  const big = makeFoe(0, 0, 0, 'fortgolem');
  const fast = makeFoe(0, 0, 0, 'evilgod');
  assert.equal(big.hp, BREEDS.fortgolem.hp);
  assert.equal(big.maxHp, BREEDS.fortgolem.hp);
  assert.equal(fast.speed, BREEDS.evilgod.speed);
  assert.ok(big.hp > fast.hp && big.speed < fast.speed, 'the fort golem must be the slow tough one');
  assert.ok(big.windupS > fast.windupS, 'and telegraph for longer, being far more dangerous');
});

test('an unknown breed falls back rather than making a foe full of undefined', () => {
  const f = makeFoe(0, 0, 0, 'wyvern');
  assert.equal(typeof f.hp, 'number');
  assert.equal(typeof f.speed, 'number');
  assert.equal(typeof f.reach, 'number');
  assert.ok(Number.isFinite(f.damage));
  assert.equal(costOf('wyvern'), BREEDS[DEFAULT_BREED].cost);
});

test('COST RISES WITH THE BREED -- a room is a sum of these, so it has to mean trouble', () => {
  // The budget treats a fort golem as several slayers. If cost and toughness
  // drift apart a "ten" room becomes a different length depending on the draw.
  assert.ok(BREEDS.fortgolem.cost > BREEDS.slayer.cost);
  for (const [k, b] of Object.entries(BREEDS)) {
    assert.ok(Number.isInteger(b.cost) && b.cost >= 1, `${k} has a strange cost ${b.cost}`);
  }
  const byHp = Object.keys(BREEDS).sort((a, b) => BREEDS[a].hp - BREEDS[b].hp);
  assert.ok(BREEDS[byHp.at(-1)].cost >= BREEDS[byHp[0]].cost, 'the toughest is not the cheapest');
});

test('every breed states the geometry the renderer and the sim both need', () => {
  for (const [k, b] of Object.entries(BREEDS)) {
    for (const f of ['glb', 'tex', 'label']) assert.equal(typeof b[f], 'string', `${k}.${f}`);
    for (const f of ['hp', 'speed', 'damage', 'radius', 'reach', 'height', 'windupS', 'recoverS']) {
      assert.ok(Number.isFinite(b[f]) && b[f] > 0, `${k}.${f} is ${b[f]}`);
    }
    assert.ok(b.reach > b.radius, `${k} cannot reach past its own body`);
  }
});
