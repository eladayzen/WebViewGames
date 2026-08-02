// Bomb-kill set state/logic (2026-08-02) -- mirrors systems/boxes.js but with
// no timer. Fed by killBomb() in core/main.js from every player-caused bomb
// destruction that didn't cost a life. See data/bombKills.js for tuning.

import { BOMB_KILL_SET } from '../data/bombKills.js';
import { pickDistinctBoosters } from '../data/powerUps.js';

export function createBombKills() {
  return { progress: 0 };
}

export function resetBombKills(bk) {
  bk.progress = 0;
}

// Register one bomb kill. Increments progress; on reaching the target it resets
// internally and returns { id, label, hex, bonusScore, effects } so the caller
// can fire the reward + celebration (same shape as a box completion). Returns
// null on a non-completing kill.
export function registerBombKill(bk) {
  bk.progress += 1;
  if (bk.progress >= BOMB_KILL_SET.requiredCount) {
    bk.progress = 0;
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
