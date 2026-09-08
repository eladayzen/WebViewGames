// Goodie-rush bonus waves (2026-09-07). Short celebratory windows triggered as
// the score crosses each of a set of ascending thresholds (BONUS_WAVE_TRIGGER_-
// SCORES, one inside levels 1/3/5 -- see data/constants.js). While active: no
// bombs spawn, the spawn rate is cranked, and only good items rain down -- a
// wave of goodies. core/main.js owns the actual spawn-config override and the
// on-screen bomb clear; this module is just the fire-each-threshold-once +
// countdown state, mirroring the other small per-run systems here (heartDrop).

import { BONUS_WAVE_DURATION_SEC } from '../data/constants.js';

export function createBonusWave() {
  // nextIndex = the next threshold in BONUS_WAVE_TRIGGER_SCORES still to fire.
  return { active: false, timer: 0, nextIndex: 0 };
}

export function resetBonusWave(bw) {
  bw.active = false;
  bw.timer = 0;
  bw.nextIndex = 0;
}

// Begin a rush. Advances nextIndex so the threshold that just fired can't fire
// again -- each one happens exactly once per run.
export function startBonusWave(bw) {
  bw.active = true;
  bw.timer = BONUS_WAVE_DURATION_SEC;
  bw.nextIndex += 1;
}

// Should a rush start THIS frame? True when there's still an unfired threshold,
// the score has reached it, and no rush is already running (so two waves never
// overlap -- if a later threshold is already crossed, it simply fires the frame
// after the current one ends). `triggers` is the ascending score array.
export function shouldStartBonusWave(bw, score, triggers) {
  return !bw.active
    && bw.nextIndex < triggers.length
    && score >= triggers[bw.nextIndex];
}

// Tick the countdown; returns true on the single frame the rush ends, so the
// caller can restore normal spawning (and reset the bomb-presence floor).
export function updateBonusWave(bw, dt) {
  if (!bw.active) return false;
  bw.timer -= dt;
  if (bw.timer <= 0) {
    bw.active = false;
    bw.timer = 0;
    return true;
  }
  return false;
}
