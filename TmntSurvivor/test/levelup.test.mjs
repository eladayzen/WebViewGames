// Choosing by leaning, on a board nobody stands still on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createChoice, updateChoice, zoneFor, holdProgress, CHOOSE } from '../src/core/levelup.js';

const OPTS = ['rapid', 'multi', 'damage'];
/** Hold a lean for a number of seconds, returning whatever got taken. */
function hold(choice, leanX, seconds, step = 1 / 60) {
  let took = null;
  for (let t = 0; t < seconds; t += step) took = took || updateChoice(choice, leanX, step);
  return took;
}

test('the three zones are left, centre, right', () => {
  assert.equal(zoneFor(-1), 0);
  assert.equal(zoneFor(0), 1);
  assert.equal(zoneFor(1), 2);
});

test('STANDING STILL DOES NOT INSTANTLY PICK THE MIDDLE CARD', () => {
  // The resting position of a player who is reading is dead centre. Without
  // the grace period the game chooses for them before they have looked up.
  const c = createChoice(OPTS);
  assert.equal(hold(c, 0, CHOOSE.graceS * 0.9), null);
  assert.equal(holdProgress(c), 0, 'and nothing is filling yet either');
});

test('holding past the grace period takes the card', () => {
  const c = createChoice(OPTS);
  const took = hold(c, 0, CHOOSE.graceS + CHOOSE.holdS + 0.1);
  assert.equal(took, 'multi', 'centre is the middle option');
});

test('A WOBBLE ACROSS A BOUNDARY RESETS THE HOLD rather than mis-picking', () => {
  // Nobody stands perfectly still on a balance board. A commit that fired on
  // zone entry would fire on whichever card the player wobbled through.
  const c = createChoice(OPTS);
  hold(c, -1, CHOOSE.graceS + CHOOSE.holdS * 0.8);   // nearly taken the left one
  assert.equal(c.taken, null);
  const took = updateChoice(c, 0, 1 / 60);            // wobbles back to centre
  assert.equal(took, null, 'the near-complete hold must not land on the new card');
  assert.equal(holdProgress(c), 0, 'and it starts again from zero');
});

test('leaning hard left or right takes the outer cards', () => {
  const left = createChoice(OPTS);
  assert.equal(hold(left, -1, CHOOSE.graceS + CHOOSE.holdS + 0.1), 'rapid');
  const right = createChoice(OPTS);
  assert.equal(hold(right, 1, CHOOSE.graceS + CHOOSE.holdS + 0.1), 'damage');
});

test('ONLY ONE CARD CAN EVER BE TAKEN', () => {
  const c = createChoice(OPTS);
  assert.equal(hold(c, -1, CHOOSE.graceS + CHOOSE.holdS + 0.1), 'rapid');
  assert.equal(hold(c, 1, 5), null, 'the screen is spent; holding again takes nothing');
  assert.equal(c.taken, 'rapid');
});

test('an empty third slot cannot be held', () => {
  // Late in a run the draw is short. Leaning at a card that is not there must
  // do nothing rather than crash or pick its neighbour.
  const c = createChoice(['rapid', 'multi']);
  assert.equal(hold(c, 1, CHOOSE.graceS + CHOOSE.holdS + 0.5), null);
  assert.equal(c.taken, null);
});
