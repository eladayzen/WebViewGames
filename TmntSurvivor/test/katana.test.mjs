// THE KATANA IS NOT ALWAYS OUT, and that is the whole point of it.
//
// Elad, 1 Nov: replace the nunchaku with a sword, "and it shouldn't be all of
// the time -- it should have a duration and a cooldown."
//
// That turns the card from a passive number into the only thing in the build
// with a rhythm, so the rhythm is what is worth guarding: it comes back, it
// genuinely stops, levelling shortens the REST rather than lengthening the
// sweep, and nothing takes damage while the blade is sheathed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { KATANA, katanaState, restFor, updateKatana } = await import('../src/systems/combat.js');
const { createWorld } = await import('../src/core/world.js');

/** A world with one enemy parked exactly where a blade will pass. */
function worldWithEnemyOnTheArc() {
  const w = createWorld();
  w.enemies = [{
    alive: true, hp: 999, kind: 'grunt',
    x: w.player.x + KATANA.distancePx, y: w.player.y,
    bladeCool: 0, hitT: 0,
  }];
  return w;
}

/** Run the weapon for `seconds`, in 60fps steps. */
function run(w, blades, seconds) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) updateKatana(w, { blades }, dt);
}

test('IT STARTS DRAWN, so taking the card does something immediately', () => {
  const w = createWorld();
  assert.equal(katanaState(w, 1).out, true);
});

test('IT GOES AWAY, and comes back', () => {
  const w = createWorld();
  const seen = [];
  const dt = 1 / 60;
  for (let t = 0; t < 24; t += dt) {
    updateKatana(w, { blades: 1 }, dt);
    seen.push(katanaState(w, 1).out);
  }
  assert.ok(seen.includes(true), 'it is out at some point');
  assert.ok(seen.includes(false), 'and sheathed at some point');
  // Out, away, out again -- a full cycle inside the window.
  const flips = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length;
  assert.ok(flips >= 2, `expected at least two state changes, saw ${flips}`);
});

test('THE SWEEP IS THE SAME LENGTH AT EVERY LEVEL; the REST is what shortens', () => {
  assert.equal(restFor(1), 6.0);
  assert.ok(restFor(2) < restFor(1), 'level 2 rests less');
  assert.ok(restFor(3) < restFor(2), 'level 3 rests less again');
  // ...and the sweep is untouched, or the weapon walks toward being permanent.
  assert.equal(KATANA.drawnS, 4.0);
});

test('EVEN AT MAX LEVEL IT IS STILL OFF A THIRD OF THE TIME', () => {
  const duty = KATANA.drawnS / (KATANA.drawnS + restFor(3));
  assert.ok(duty < 0.7, `level 3 duty cycle is ${(duty * 100).toFixed(0)}%, should stay under 70%`);
});

test('A SHEATHED BLADE DOES NO DAMAGE', () => {
  const w = worldWithEnemyOnTheArc();
  // Push the clock into the rest window and clear any damage from the sweep.
  run(w, 1, KATANA.drawnS + 0.5);
  assert.equal(katanaState(w, 1).out, false, 'precondition: sheathed');
  w.enemies[0].hp = 999;
  w.enemies[0].bladeCool = 0;
  run(w, 1, 1.0);
  assert.equal(w.enemies[0].hp, 999, 'nothing was touched while it rested');
});

test('A DRAWN BLADE DOES DAMAGE', () => {
  const w = worldWithEnemyOnTheArc();
  run(w, 1, KATANA.drawnS * 0.9);
  assert.ok(w.enemies[0].hp < 999, 'the sweep connected');
});

test('ONE ENEMY IS NOT SHREDDED AT FRAME RATE', () => {
  const w = worldWithEnemyOnTheArc();
  run(w, 1, KATANA.drawnS * 0.9);
  const hitsTaken = (999 - w.enemies[0].hp) / KATANA.damage;
  const maxPossible = (KATANA.drawnS * 0.9) / KATANA.hitCooldownS + 1;
  assert.ok(hitsTaken <= maxPossible, `${hitsTaken} hits exceeds the per-enemy cooldown`);
});

test('WITH NO LEVELS THERE IS NO WEAPON', () => {
  const w = worldWithEnemyOnTheArc();
  run(w, 0, 6);
  assert.equal(katanaState(w, 0).out, false);
  assert.equal(w.enemies[0].hp, 999);
});

test('the cycle clock does not advance before the card is taken', () => {
  // Otherwise a player who takes the katana at minute three gets it
  // mid-cooldown, through no choice of their own.
  const w = createWorld();
  run(w, 0, 10);
  assert.equal(w.katanaT, 0);
  assert.equal(katanaState(w, 1).out, true, 'still starts drawn when finally taken');
});
