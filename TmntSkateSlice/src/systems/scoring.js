// Scoring + combo-streak system (§8). Score = points per strike x active
// combo multiplier. Combo tracks CONSECUTIVE PIZZA strikes only -- a missed
// pizza (let fall past unstruck) or a bomb hit resets it to zero; striking
// or missing an ooze canister is neutral (neither builds nor breaks the
// streak -- the doc only specifies missed-pizza/bomb-hit as breaking it).

import {
  PIZZA_SCORE,
  OOZE_SCORE,
  COMBO_STEP,
  COMBO_MULTIPLIER_STEP,
  COMBO_MULTIPLIER_MAX,
} from '../data/constants.js';

export function createScoring() {
  return {
    score: 0,
    comboCount: 0,
    bestCombo: 0,
  };
}

export function resetScoring(s) {
  s.score = 0;
  s.comboCount = 0;
  s.bestCombo = 0;
}

function currentMultiplier(s) {
  const steps = Math.floor(s.comboCount / COMBO_STEP);
  return Math.min(1 + steps * COMBO_MULTIPLIER_STEP, COMBO_MULTIPLIER_MAX);
}

export function registerPizzaHit(s) {
  s.comboCount += 1;
  if (s.comboCount > s.bestCombo) s.bestCombo = s.comboCount;
  s.score += Math.round(PIZZA_SCORE * currentMultiplier(s));
  return currentMultiplier(s);
}

export function registerOozeHit(s) {
  // Buff is the reward; no direct score value by design (§8, §12) -- kept
  // as a named constant (currently 0) rather than a bare literal so a
  // future tuning pass can revisit the trade-off in one place.
  s.score += OOZE_SCORE;
}

export function registerComboBreak(s) {
  s.comboCount = 0;
}

export function getComboMultiplier(s) {
  return currentMultiplier(s);
}
