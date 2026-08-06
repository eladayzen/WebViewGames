// Scoring + combo-streak system (§8). Each pizza catch scores its own flat,
// tiered value (data/itemTypes.js's per-variant `score`, 10/20/30/40) --
// the combo multiplier is DISABLED for now (2026-08-06 feedback: unclear,
// hidden from the HUD, no longer applied to score). Combo streak tracking
// (comboCount/bestCombo) is left running underneath, unused by scoring, so
// re-enabling the multiplier later is just wiring currentMultiplier back
// into registerPizzaHit -- the constants/function below are kept for that.
// Combo tracks CONSECUTIVE PIZZA strikes only -- a missed pizza (let fall
// past unstruck) or a bomb hit resets it to zero; striking or missing an
// ooze canister is neutral (neither builds nor breaks the streak -- the
// doc only specifies missed-pizza/bomb-hit as breaking it).

import {
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

export function registerPizzaHit(s, points) {
  s.comboCount += 1;
  if (s.comboCount > s.bestCombo) s.bestCombo = s.comboCount;
  s.score += points;
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

// Flat bonus for completing a pizza collection box (progression update,
// 2026-07-30). Deliberately NOT multiplied by the combo multiplier -- box
// completion is its own achievement-style reward, independent of the
// per-catch streak system, which is unchanged.
export function registerBoxComplete(s, bonusScore) {
  s.score += bonusScore;
}

// Flat points for killing a bomb (shield block / blow-up / later ooze), 2026-
// 08-02. Not combo-multiplied -- defensive play is its own reward track (the
// bomb-kill set), independent of the pizza catch streak.
export function registerBombKillScore(s, points) {
  s.score += points;
}
