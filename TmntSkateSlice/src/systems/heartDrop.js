// Extra-life heart drop (2026-09-03). From STAGE 2 onward, drop exactly one
// catchable heart per stage at a random time, so a player can recover a life
// "about once a level". Level 1 (stageIndex 0) never drops one.
//
// Deliberately minimal and paced, mirroring systems/bombPresence.js's shape:
// it only answers "should a heart drop this frame," nothing about difficulty.
// The drop is independent of the normal weighted spawner -- core/main.js
// pushes the heart item directly when this fires, so it never displaces a
// bomb-floor spawn or disturbs the item cadence.
import { HEART_DROP_MIN_DELAY_SEC, HEART_DROP_MAX_DELAY_SEC } from '../data/constants.js';

export function createHeartDrop() {
  return { armed: false, dropped: true, elapsed: 0, delay: 0 };
}

export function resetHeartDrop(hd) {
  hd.armed = false;
  hd.dropped = true; // inert until armForStage decides
  hd.elapsed = 0;
  hd.delay = 0;
}

// Call once when a stage begins (including the first). stageIndex 0 = level 1
// (no heart); >= 1 arms one drop at a random delay into the stage.
export function armHeartDropForStage(hd, stageIndex) {
  hd.elapsed = 0;
  if (stageIndex >= 1) {
    hd.armed = true;
    hd.dropped = false;
    hd.delay =
      HEART_DROP_MIN_DELAY_SEC +
      Math.random() * (HEART_DROP_MAX_DELAY_SEC - HEART_DROP_MIN_DELAY_SEC);
  } else {
    hd.armed = false;
    hd.dropped = true; // level 1: never
  }
}

// Call once per running frame. Returns true EXACTLY once per armed stage, the
// frame its random delay elapses; self-marks so it can't fire twice.
export function updateHeartDrop(hd, dt) {
  if (hd.dropped) return false;
  hd.elapsed += dt;
  if (hd.elapsed >= hd.delay) {
    hd.dropped = true;
    return true;
  }
  return false;
}
