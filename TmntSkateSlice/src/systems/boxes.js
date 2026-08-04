// Pizza-box collection tracker (Part 1 of the progression update,
// 2026-07-30). Each color from data/boxColors.js is an independent box:
// catching a matching-color slice increments its progress and (on the first
// catch) starts its countdown; reaching requiredCount before the timer
// expires completes the box for a bonus; the timer expiring first silently
// resets it. Mirrors systems/scoring.js's create/reset/register shape --
// plain state read/updated once per frame from the game loop, no framework.

import { BOX_COLORS, BOX_COLOR_BY_ID } from '../data/boxColors.js';

export function createBoxes() {
  const boxes = {};
  for (const c of BOX_COLORS) {
    boxes[c.id] = { progress: 0, timerRemaining: 0, active: false };
  }
  return boxes;
}

export function resetBoxes(boxes) {
  for (const c of BOX_COLORS) {
    const b = boxes[c.id];
    b.progress = 0;
    b.timerRemaining = 0;
    b.active = false;
  }
}

// Register one catch of the given color. Starts the box (and its timer) on
// the first catch; every catch AFTER that tops the timer back up by
// cfg.timerBonusSec instead (capped at cfg.timerSec, 2026-08-04 -- actively
// feeding an already-active box keeps its clock topped up rather than only
// ever draining). On completion, resets the box back to inactive/0
// internally and returns { id, bonusScore, hex, label } so the caller can
// fire the completion-frame side effects (score, particles, SFX, and swap in
// the matching per-color box icon in the popup); returns null on a
// non-completing catch.
export function registerBoxCatch(boxes, colorId) {
  const cfg = BOX_COLOR_BY_ID[colorId];
  const b = boxes[colorId];
  if (!b.active) {
    b.active = true;
    b.timerRemaining = cfg.timerSec;
  } else {
    b.timerRemaining = Math.min(cfg.timerSec, b.timerRemaining + cfg.timerBonusSec);
  }
  b.progress += 1;
  if (b.progress >= cfg.requiredCount) {
    b.progress = 0;
    b.timerRemaining = 0;
    b.active = false;
    return { id: cfg.id, bonusScore: cfg.bonusScore, hex: cfg.hex, label: cfg.label };
  }
  return null;
}

// Tick active boxes' timers. MUST be called AFTER the per-frame catch loop
// (see updateRunning in core/main.js): a catch that completes a box on the
// same frame its timer would otherwise hit zero is handled during the catch
// loop, so by the time this runs that box is already inactive and won't be
// double-handled here. This only expires boxes that got no completing catch.
export function updateBoxes(boxes, dt) {
  for (const c of BOX_COLORS) {
    const b = boxes[c.id];
    if (!b.active) continue;
    b.timerRemaining -= dt;
    if (b.timerRemaining <= 0) {
      b.progress = 0;
      b.timerRemaining = 0;
      b.active = false;
    }
  }
}

// Effective spawn weight for a color right now: boosted while its box is
// active, base otherwise (see data/boxColors.js). Read by rollItemType.
export function getEffectiveSpawnWeight(boxes, colorId) {
  const cfg = BOX_COLOR_BY_ID[colorId];
  return boxes[colorId].active ? cfg.activeSpawnWeight : cfg.baseSpawnWeight;
}
