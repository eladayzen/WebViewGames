// Score + multiplier-decay tracker (§5.6, §8). Base distance accrual is
// unmultiplied; the multiplier only rewards pickup chains specifically.

import { SCORE_DISTANCE_RATE, PIZZA_BASE_VALUE, MAX_MULTIPLIER, MULTIPLIER_DECAY_SECONDS } from '../data/constants.js';

export function createScoringState() {
  return { score: 0, multiplier: 1, timeSincePickup: 0 };
}

export function resetScoring(state) {
  state.score = 0;
  state.multiplier = 1;
  state.timeSincePickup = 0;
}

export function accrueDistanceScore(state, speed, dt) {
  state.score += speed * dt * SCORE_DISTANCE_RATE;
}

export function collectPizza(state) {
  state.multiplier = Math.min(MAX_MULTIPLIER, state.multiplier + 1);
  state.timeSincePickup = 0;
  state.score += PIZZA_BASE_VALUE * state.multiplier;
}

// Returns true the instant the multiplier steps down this frame, so callers
// can trigger a small feedback cue -- not present in POC (§5.6 is MVP+).
export function tickMultiplierDecay(state, dtSeconds) {
  state.timeSincePickup += dtSeconds;
  if (state.timeSincePickup >= MULTIPLIER_DECAY_SECONDS && state.multiplier > 1) {
    state.multiplier -= 1;
    state.timeSincePickup = 0;
    return true;
  }
  return false;
}

// 0..1 fraction of the decay window remaining, for the HUD's depleting-
// sliver cue (§7) -- pinned to 1 once already at the floor multiplier since
// there's nothing left to decay.
export function decayFraction(state) {
  if (state.multiplier <= 1) return 1;
  return 1 - state.timeSincePickup / MULTIPLIER_DECAY_SECONDS;
}
