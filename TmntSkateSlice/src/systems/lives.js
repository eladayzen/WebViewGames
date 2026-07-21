// Lives / fail-condition system (§5.4, §8). 3 lives per run; each bomb hit
// costs one; the third hit ends the run.

import { STARTING_LIVES } from '../data/constants.js';

export function createLives() {
  return { remaining: STARTING_LIVES };
}

export function resetLives(l) {
  l.remaining = STARTING_LIVES;
}

export function loseLife(l) {
  l.remaining = Math.max(0, l.remaining - 1);
  return l.remaining;
}

export function isDead(l) {
  return l.remaining <= 0;
}
