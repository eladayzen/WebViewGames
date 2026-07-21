// Stage / difficulty-ramp tracker (§5.2). Advances on score OR elapsed-time
// threshold, whichever comes first (a hybrid, per the doc's own suggested
// default), always restarting from stage 0 on a new run (§3 step 9, §8 --
// no persistent meta-progression between runs).

import { STAGES } from '../data/stages.js';

export function createDifficulty() {
  return { stageIndex: 0, elapsedSec: 0, justAdvanced: false };
}

export function resetDifficulty(d) {
  d.stageIndex = 0;
  d.elapsedSec = 0;
  d.justAdvanced = false;
}

export function getStage(d) {
  return STAGES[d.stageIndex];
}

// Call once per frame while running. `score` is the current run score.
// Returns true (and flips justAdvanced) exactly on the frame a new stage
// starts, so the caller can fire the stage-transition banner (§7) once.
export function updateDifficulty(d, dt, score) {
  d.elapsedSec += dt;
  d.justAdvanced = false;

  const stage = STAGES[d.stageIndex];
  const isLastStage = d.stageIndex >= STAGES.length - 1;
  if (isLastStage) return false;

  if (score >= stage.advanceScore || d.elapsedSec >= stage.advanceTimeSec) {
    d.stageIndex += 1;
    d.justAdvanced = true;
    return true;
  }
  return false;
}
