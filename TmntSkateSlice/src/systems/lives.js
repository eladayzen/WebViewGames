// Lives / fail-condition system (§5.4, §8). Starts at 3 lives; each bomb hit
// costs one; losing the last ends the run.
//
// `capacity` is how many heart SLOTS the player currently has (starts at
// STARTING_LIVES, the HUD draws one heart per slot). A gained life
// (red-box completion reward, 2026-08-02) first refills a lost heart; if
// already full it adds a new slot, growing capacity up to MAX_LIVES.

import { STARTING_LIVES, MAX_LIVES } from '../data/constants.js';

export function createLives() {
  return { remaining: STARTING_LIVES, capacity: STARTING_LIVES };
}

export function resetLives(l) {
  l.remaining = STARTING_LIVES;
  l.capacity = STARTING_LIVES;
}

export function loseLife(l) {
  l.remaining = Math.max(0, l.remaining - 1);
  return l.remaining;
}

// Gain a life: refill a lost heart if damaged, otherwise grow capacity by one
// (a brand-new heart), both capped at MAX_LIVES. Returns true if anything
// changed (false if already at max capacity and full).
export function gainLife(l) {
  if (l.remaining >= MAX_LIVES) return false;
  if (l.remaining >= l.capacity) l.capacity = Math.min(MAX_LIVES, l.capacity + 1);
  l.remaining = Math.min(l.capacity, l.remaining + 1);
  return true;
}

export function isDead(l) {
  return l.remaining <= 0;
}
