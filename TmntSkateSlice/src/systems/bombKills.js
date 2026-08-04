// Bomb-kill set state/logic (2026-08-02, timer added 2026-08-04) -- mirrors
// systems/boxes.js's start-on-first-progress/reset-on-expiry shape. Fed by
// killBomb() in core/main.js from every player-caused bomb destruction that
// didn't cost a life. See data/bombKills.js for tuning.

import { BOMB_KILL_SET } from '../data/bombKills.js';
import { pickDistinctBoosters } from '../data/powerUps.js';

export function createBombKills() {
  return { progress: 0, timerRemaining: 0, active: false };
}

export function resetBombKills(bk) {
  bk.progress = 0;
  bk.timerRemaining = 0;
  bk.active = false;
}

// Register one bomb kill. Starts the timer on the first kill, otherwise
// increments. On reaching the target it resets internally and returns
// { id, label, hex, bonusScore, effects } so the caller can fire the reward +
// celebration (same shape as a box completion). Returns null on a
// non-completing kill.
export function registerBombKill(bk) {
  if (!bk.active) {
    bk.active = true;
    bk.timerRemaining = BOMB_KILL_SET.timerSec;
  }
  bk.progress += 1;
  if (bk.progress >= BOMB_KILL_SET.requiredCount) {
    bk.progress = 0;
    bk.timerRemaining = 0;
    bk.active = false;
    return {
      id: BOMB_KILL_SET.id,
      label: BOMB_KILL_SET.label,
      hex: BOMB_KILL_SET.hex,
      bonusScore: BOMB_KILL_SET.bonusScore,
      effects: pickDistinctBoosters(BOMB_KILL_SET.boosterCount),
    };
  }
  return null;
}

// Tick the timer while active. MUST be called AFTER the per-frame kill loop
// (see updateBoxes in systems/boxes.js for the identical reasoning) -- a kill
// that completes the set on the same frame its timer would otherwise hit
// zero is handled during the kill loop, so by the time this runs the set is
// already inactive and won't be double-handled here.
export function updateBombKills(bk, dt) {
  if (!bk.active) return;
  bk.timerRemaining -= dt;
  if (bk.timerRemaining <= 0) {
    bk.progress = 0;
    bk.timerRemaining = 0;
    bk.active = false;
  }
}
