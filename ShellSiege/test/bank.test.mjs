// THE BANK. The rule has to be exact because the UI explains it without words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuild, ABILITIES } from '../src/core/abilities.js';
import { looseOf, bankOnWin, bankOnDeath, pickToKeep, buildFromBank, permOf } from '../src/core/bank.js';

const build = (o) => Object.assign(createBuild(), o);

test('LOOSE IS WHAT YOU HOLD BEYOND THE BANK, permanent abilities only', () => {
  const b = build({ rapid: 3, damage: 1, leo: 2, stars: 1 });
  assert.deepEqual(looseOf(b, { rapid: 1 }), { rapid: 2, damage: 1 });
  assert.deepEqual(permOf(b), { rapid: 3, damage: 1 });
});

test('CLEARING A LEVEL BANKS EVERY PERMANENT ABILITY, and never the temporary ones', () => {
  const bank = bankOnWin({ rapid: 1 }, build({ rapid: 3, reach: 2, leo: 4, shield: 2 }));
  assert.deepEqual(bank, { rapid: 3, reach: 2 });
});

test('A BANK NEVER SHRINKS ON A WIN', () => {
  assert.deepEqual(bankOnWin({ rapid: 5 }, build({ rapid: 2 })), { rapid: 5 });
});

test('DYING KEEPS THE BANK PLUS ONE PICK: the permanent ability you leaned on most', () => {
  const b = build({ rapid: 2, damage: 4, hearts: 1 });
  assert.equal(pickToKeep(b, {}), 'damage');
  assert.deepEqual(bankOnDeath({ rapid: 1 }, b), { rapid: 1, damage: 1 });
});

test('DYING WITH NOTHING LOOSE KEEPS THE BANK AS IT WAS', () => {
  assert.deepEqual(bankOnDeath({ rapid: 2 }, build({ rapid: 2 })), { rapid: 2 });
  assert.equal(pickToKeep(build({ rapid: 2 }), { rapid: 2 }), null);
});

test('A PICK CANNOT PUSH PAST AN ABILITY\'S CAP', () => {
  const max = ABILITIES.rapid.max;
  assert.deepEqual(bankOnDeath({ rapid: max }, build({ rapid: max + 1 })), { rapid: max });
});

test('A NEW BUILD FROM THE BANK HOLDS ONLY THE BANK', () => {
  const b = buildFromBank({ rapid: 2, damage: 1 }, createBuild);
  assert.equal(b.rapid, 2); assert.equal(b.damage, 1); assert.equal(b.leo, 0);
});
