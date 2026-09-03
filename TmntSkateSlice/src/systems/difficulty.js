// Stage / difficulty-ramp tracker (§5.2). Advances on score OR elapsed-time
// threshold, whichever comes first (a hybrid, per the doc's own suggested
// default), always restarting from stage 0 on a new run (§3 step 9, §8 --
// no persistent meta-progression between runs).

import { STAGES } from '../data/stages.js';

export function createDifficulty() {
  return { stageIndex: 0, elapsedSec: 0 };
}

export function resetDifficulty(d) {
  d.stageIndex = 0;
  d.elapsedSec = 0;
}

export function getStage(d) {
  return STAGES[d.stageIndex];
}

// The current "score band" for the HUD progression bar (2026-08-03): the
// cumulative score threshold this stage started at (0 for stage 1) and the
// one that advances to the next stage (Infinity on the final stage -- there
// is no next threshold, so the caller shows the bare score with no bar).
export function getScoreBand(d) {
  const prevThreshold = d.stageIndex > 0 ? STAGES[d.stageIndex - 1].advanceScore : 0;
  const nextThreshold = STAGES[d.stageIndex].advanceScore;
  return { prevThreshold, nextThreshold };
}

// Call once per frame while running. `score` is the current run score.
// Returns true exactly on the frame the next stage's threshold is crossed --
// DETECTION only, does NOT advance stageIndex itself (2026-08-04, was an
// instant increment here -- the "background pops immediately" behavior
// that's being replaced by the freeze+curtain transition). The caller
// (core/main.js's beginStageComplete) freezes the world on this signal;
// commitStageAdvance below is what actually moves stageIndex forward, called
// later, once the transition's curtains are fully closed.
export function updateDifficulty(d, dt, score) {
  d.elapsedSec += dt;

  const stage = STAGES[d.stageIndex];
  const isLastStage = d.stageIndex >= STAGES.length - 1;
  if (isLastStage) return false;

  return score >= stage.advanceScore || d.elapsedSec >= stage.advanceTimeSec;
}

// True the moment the LAST stage's clear threshold is crossed -- i.e. the whole
// campaign is finished (2026-09-03). Separate from updateDifficulty (which only
// handles mid-campaign stage advances and returns false on the last stage), so
// the final stage's score threshold means "you win" rather than "next stage".
// core/main.js reads this to fire the victory beat.
export function isFinalStageCleared(d, score) {
  const isLastStage = d.stageIndex >= STAGES.length - 1;
  return isLastStage && score >= STAGES[d.stageIndex].advanceScore;
}

// Actually advances to the next stage -- called once, behind the closed
// curtain (core/main.js's 'stagecomplete' frame() branch), not the instant
// updateDifficulty detects the threshold. Advancing by exactly 1 is safe
// without a separate "pending index" (unlike an arbitrary-jump progression
// system might need) since stages are strictly sequential here.
export function commitStageAdvance(d) {
  d.stageIndex += 1;
}
