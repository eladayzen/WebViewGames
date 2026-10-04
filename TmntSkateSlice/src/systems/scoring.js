// Scoring + streak system (§8). Each catch scores its own flat, tiered base
// value (data/itemTypes.js's per-variant `score`, 10/20/30/40), boosted by a
// STREAK multiplier (re-enabled + reworked 2026-09-07).
//
// The streak is TIMER-BASED: every catch refills a countdown to
// STREAK_WINDOW_SEC (see updateStreak) and drains it between catches; letting
// it empty resets the streak to x1. So you keep the streak by catching often,
// not by never missing -- a missed slice no longer breaks it (the clock does),
// though a bomb hit still does (registerComboBreak).
//
// The multiplier is a SINGLE, CAPPED factor applied to THIS catch's own base
// points only (registerPizzaHit) -- never re-applied to already-scored points,
// so it's "more points per item", not "multipliers over multipliers". Every
// COMBO_STEP consecutive catches bumps it by COMBO_MULTIPLIER_STEP, capped at
// COMBO_MULTIPLIER_MAX.

import {
  OOZE_SCORE,
  COMBO_STEP,
  COMBO_MULTIPLIER_STEP,
  COMBO_MULTIPLIER_MAX,
  STREAK_WINDOW_SEC,
} from '../data/constants.js';

export function createScoring() {
  return {
    score: 0,
    comboCount: 0,
    bestCombo: 0,
    streakTimer: 0, // seconds left before the streak lapses; refilled per catch
  };
}

export function resetScoring(s) {
  s.score = 0;
  s.comboCount = 0;
  s.bestCombo = 0;
  s.streakTimer = 0;
}

function currentMultiplier(s) {
  const steps = Math.floor(s.comboCount / COMBO_STEP);
  return Math.min(1 + steps * COMBO_MULTIPLIER_STEP, COMBO_MULTIPLIER_MAX);
}

// Register a catch. Refills the streak timer, applies the (capped, single)
// multiplier to this catch's base points, and returns the points actually
// AWARDED so the caller can show the boosted "+N" popup.
export function registerPizzaHit(s, points) {
  s.comboCount += 1;
  if (s.comboCount > s.bestCombo) s.bestCombo = s.comboCount;
  s.streakTimer = STREAK_WINDOW_SEC; // refill -- catching keeps the streak alive
  const gained = Math.round(points * currentMultiplier(s));
  s.score += gained;
  return gained;
}

// Drain the streak clock; when it hits zero the streak lapses back to x1.
// Called once per frame while running (core/main.js).
export function updateStreak(s, dt) {
  if (s.streakTimer <= 0) return;
  s.streakTimer -= dt;
  if (s.streakTimer <= 0) {
    s.streakTimer = 0;
    s.comboCount = 0;
  }
}

// 0..1 fill for the HUD streak timer bar.
export function getStreakTimerFrac(s) {
  return Math.max(0, Math.min(1, s.streakTimer / STREAK_WINDOW_SEC));
}

export function registerOozeHit(s) {
  // Buff is the reward; no direct score value by design (§8, §12) -- kept
  // as a named constant (currently 0) rather than a bare literal so a
  // future tuning pass can revisit the trade-off in one place.
  s.score += OOZE_SCORE;
}

// Hard break the streak immediately (a bomb hit) -- distinct from letting the
// timer lapse. Zeroes the clock too so the HUD indicator clears at once.
export function registerComboBreak(s) {
  s.comboCount = 0;
  s.streakTimer = 0;
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
