// Getting hit, and running out.

import test from 'node:test';
import assert from 'node:assert/strict';
import { updateSurvival, blinking, SURVIVAL } from '../src/systems/survival.js';

const fresh = () => ({ lives: 5, invulnS: 0, dead: false, contact: false });

test('a touch costs one life', () => {
  const w = fresh();
  w.contact = true;
  updateSurvival(w, 1 / 60);
  assert.equal(w.lives, 4);
});

test('A PILE OF ENEMIES COSTS ONE LIFE, NOT FIVE', () => {
  // Enemies converge, so the frame you are touched you are touching several.
  // Without the window one mistake ends the run and the player never learns
  // what they did wrong.
  const w = fresh();
  for (let i = 0; i < 30; i++) { w.contact = true; updateSurvival(w, 1 / 60); }
  assert.equal(w.lives, 4, 'half a second of being buried is still one hit');
});

test('the window runs out and the next touch lands', () => {
  const w = fresh();
  w.contact = true; updateSurvival(w, 1 / 60);
  for (let t = 0; t < SURVIVAL.invulnS + 0.1; t += 1 / 60) updateSurvival(w, 1 / 60);
  w.contact = true; updateSurvival(w, 1 / 60);
  assert.equal(w.lives, 3);
});

test('contact is cleared every frame, so letting go stops the damage', () => {
  const w = fresh();
  w.contact = true; updateSurvival(w, 1 / 60);
  for (let t = 0; t < SURVIVAL.invulnS + 0.1; t += 1 / 60) updateSurvival(w, 1 / 60);
  updateSurvival(w, 1 / 60);                 // nothing touching now
  assert.equal(w.lives, 4, 'no free hit from a stale flag');
});

test('the run ends at zero and stays ended', () => {
  const w = fresh();
  let ended = false;
  for (let i = 0; i < 5; i++) {
    w.invulnS = 0; w.contact = true;
    ended = updateSurvival(w, 1 / 60) || ended;
  }
  assert.equal(w.lives, 0);
  assert.equal(w.dead, true);
  assert.equal(ended, true);
  // And a corpse cannot go negative.
  w.invulnS = 0; w.contact = true; updateSurvival(w, 1 / 60);
  assert.equal(w.lives, 0);
});

test('the player is visibly flickering while invulnerable', () => {
  const w = fresh();
  w.contact = true; updateSurvival(w, 1 / 60);
  let seenOn = false, seenOff = false;
  for (let t = 0; t < SURVIVAL.invulnS; t += 1 / 60) {
    (blinking(w) ? (seenOff = true) : (seenOn = true));
    updateSurvival(w, 1 / 60);
  }
  assert.ok(seenOn && seenOff, 'a window the player cannot see reads as the game missing them');
});

test('HEALING NEVER EXCEEDS THE POOL', async () => {
  const { heal, SURVIVAL } = await import('../src/systems/survival.js');
  const w = { lives: SURVIVAL.maxLives - 1 };
  assert.equal(heal(w, 1), SURVIVAL.maxLives);
  assert.equal(heal(w, 5), SURVIVAL.maxLives, 'a heart at full health is not banked');
});

test('the pool is much bigger than Bloop Squad’s five', async () => {
  const { SURVIVAL } = await import('../src/systems/survival.js');
  assert.ok(SURVIVAL.maxLives >= 10);
});
