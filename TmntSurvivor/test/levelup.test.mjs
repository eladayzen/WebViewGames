// Choosing by leaning, on a board nobody stands still on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createChoice, updateChoice, zoneFor, holdProgress, CHOOSE } from '../src/core/levelup.js';

const OPTS = ['rapid', 'multi'];
/** Hold a lean for a number of seconds, returning whatever got taken. */
function hold(choice, leanX, seconds, step = 1 / 60) {
  let took = null;
  for (let t = 0; t < seconds; t += step) took = took || updateChoice(choice, leanX, step);
  return took;
}

test('the two zones are left and right, and CENTRE IS NEITHER', () => {
  assert.equal(zoneFor(-1), 0);
  assert.equal(zoneFor(1), 1);
  // Null, not a number. If this ever becomes 0 or 1 the centre band silently
  // turns back into a card and standing still starts choosing again.
  assert.equal(zoneFor(0), null, 'the resting position points at nothing');
});

test('STANDING STILL NEVER PICKS A CARD, however long it is held', () => {
  // This is the whole reason the screen went from three cards to two. Centre
  // is where a player stands while they read, so centre must be a safe place
  // to be -- not a third option that creeps toward committing.
  const c = createChoice(OPTS);
  assert.equal(hold(c, 0, CHOOSE.graceS + CHOOSE.holdS * 10), null);
  assert.equal(c.taken, null);
  assert.equal(holdProgress(c), 0, 'and nothing is filling, at any point');
});

test('holding past the grace period takes the card', () => {
  const c = createChoice(OPTS);
  const took = hold(c, -1, CHOOSE.graceS + CHOOSE.holdS + 0.1);
  assert.equal(took, 'rapid', 'leaning left takes the left option');
});

test('NOTHING IS TAKEN DURING THE GRACE PERIOD', () => {
  // A player can already be mid-lean when the screen opens -- carried there by
  // the movement that earned the level -- and must not have a card taken out
  // from under them for it.
  const c = createChoice(OPTS);
  assert.equal(hold(c, -1, CHOOSE.graceS * 0.9), null);
  assert.equal(holdProgress(c), 0, 'and nothing is filling yet either');
});

test('A WOBBLE ACROSS A BOUNDARY RESETS THE HOLD rather than mis-picking', () => {
  // Nobody stands perfectly still on a balance board. A commit that fired on
  // zone entry would fire on whichever card the player wobbled through.
  const c = createChoice(OPTS);
  hold(c, -1, CHOOSE.graceS + CHOOSE.holdS * 0.8);   // nearly taken the left one
  assert.equal(c.taken, null);
  const took = updateChoice(c, 0, 1 / 60);            // stands back up to centre
  assert.equal(took, null, 'the near-complete hold must not land anywhere');
  assert.equal(holdProgress(c), 0, 'and it starts again from zero');
});

test('leaning hard left or right takes the matching card', () => {
  const left = createChoice(OPTS);
  assert.equal(hold(left, -1, CHOOSE.graceS + CHOOSE.holdS + 0.1), 'rapid');
  const right = createChoice(OPTS);
  assert.equal(hold(right, 1, CHOOSE.graceS + CHOOSE.holdS + 0.1), 'multi');
});

test('ONLY ONE CARD CAN EVER BE TAKEN', () => {
  const c = createChoice(OPTS);
  assert.equal(hold(c, -1, CHOOSE.graceS + CHOOSE.holdS + 0.1), 'rapid');
  assert.equal(hold(c, 1, 5), null, 'the screen is spent; holding again takes nothing');
  assert.equal(c.taken, 'rapid');
});

test('an empty second slot cannot be held', () => {
  // Late in a run the draw is short -- one ability left in the pool. Leaning
  // at a card that is not there must do nothing rather than crash or pick its
  // neighbour.
  const c = createChoice(['rapid']);
  assert.equal(hold(c, 1, CHOOSE.graceS + CHOOSE.holdS + 0.5), null);
  assert.equal(c.taken, null);
  assert.equal(hold(c, -1, CHOOSE.graceS + CHOOSE.holdS + 0.5), 'rapid',
    'while the card that IS there is still takeable');
});
