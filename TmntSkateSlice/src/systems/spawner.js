// Falling-item spawner (§3, §5.2). Spawn rate/mix comes from the current
// stage; x-position is randomized but capped in how far it can jump from
// the previous spawn (§5.2/§11 -- never require a fast alternating
// left-right correction, only ever a single deliberate lean per approaching
// item).

import { createFallingItem } from '../entities/fallingItem.js';
import { rollItemType } from '../data/itemTypes.js';
import { ITEM_MIN_X_FRAC, ITEM_MAX_X_FRAC, MAX_SPAWN_X_JUMP_FRAC } from '../data/constants.js';

export function createSpawner() {
  return { timer: 0, lastXFrac: 0.5 };
}

export function resetSpawner(sp) {
  sp.timer = 0;
  sp.lastXFrac = 0.5;
}

function pickNextX(sp) {
  const lo = Math.max(ITEM_MIN_X_FRAC, sp.lastXFrac - MAX_SPAWN_X_JUMP_FRAC);
  const hi = Math.min(ITEM_MAX_X_FRAC, sp.lastXFrac + MAX_SPAWN_X_JUMP_FRAC);
  const x = lo + Math.random() * (hi - lo);
  sp.lastXFrac = x;
  return x;
}

// Returns a newly-spawned item, or null if it isn't time yet. Caller is
// responsible for pushing the result into its own items array.
export function updateSpawner(sp, dt, stage) {
  sp.timer -= dt;
  if (sp.timer > 0) return null;

  sp.timer = stage.spawnIntervalSec;
  const type = rollItemType(stage);
  const x = pickNextX(sp);
  return createFallingItem(type, x, stage.fallSpeedFrac);
}
