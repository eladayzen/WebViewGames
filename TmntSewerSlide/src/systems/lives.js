// Lives/hit tracker (§8): 3 lives + brief invulnerability window. Precedent:
// Astro_Tunnel's handleHit -- same hit-handling model against a comparable
// continuous-angular mechanic, reused here per the build doc's explicit
// instruction (§2, §10 milestone 4) rather than reinvented.

import { MAX_LIVES, HIT_INVULNERABILITY_SECONDS } from '../data/constants.js';

export function createLivesState() {
  return { lives: MAX_LIVES, invulnerableUntil: 0 };
}

export function resetLives(state) {
  state.lives = MAX_LIVES;
  state.invulnerableUntil = 0;
}

// nowSeconds is the run's own elapsed-seconds clock (not wall time), so it
// naturally freezes correctly under pause. Returns { hit, dead } -- `hit`
// false means the invulnerability window absorbed it (no double-hit off the
// same or the very next obstacle before the player can react).
export function tryHit(state, nowSeconds) {
  if (nowSeconds < state.invulnerableUntil) return { hit: false, dead: false };
  state.invulnerableUntil = nowSeconds + HIT_INVULNERABILITY_SECONDS;
  state.lives -= 1;
  return { hit: true, dead: state.lives <= 0 };
}

export function isInvulnerable(state, nowSeconds) {
  return nowSeconds < state.invulnerableUntil;
}
