// Falling-item spawner (§3, §5.2). Spawn rate/mix comes from the current
// stage; x-position is randomized but capped in how far it can jump from
// the previous spawn (§5.2/§11 -- never require a fast alternating
// left-right correction, only ever a single deliberate lean per approaching
// item).

import { createFallingItem } from '../entities/fallingItem.js';
import { rollItemType, ITEM_TYPES } from '../data/itemTypes.js';
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

// A minority of items -- any type, pizza/ooze/bomb alike, not tied to
// what's falling -- drop noticeably faster than the stage baseline, so the
// falling pattern reads as more varied/interesting rather than one flat
// wall-of-speed per stage.
const FAST_FALL_CHANCE = 0.25;
const FAST_FALL_MULTIPLIER = 1.6;

function pickFallSpeedFrac(stage) {
  return Math.random() < FAST_FALL_CHANCE
    ? stage.fallSpeedFrac * FAST_FALL_MULTIPLIER
    : stage.fallSpeedFrac;
}

// Returns a newly-spawned item, or null if it isn't time yet. Caller is
// responsible for pushing the result into its own items array. `boxes` (the
// live collection-box state) is threaded through to rollItemType so
// box-colored pizza variants can spawn more often while their box is active
// (see data/itemTypes.js / systems/boxes.js).
//
// `forcedBombXFrac` (optional, systems/bombPresence.js): when set, this
// spawn is FORCED to a bomb at exactly that x, bypassing both the normal
// weighted roll AND pickNextX's random-walk -- a deliberate exception to the
// "never a big x jump between spawns" rule above, since forcing the bomb
// specifically to a play-area EDGE (main.js picks whichever edge is far from
// the player) is the whole point: it's meant to threaten wherever the
// player has been safely camping, not ease in from wherever the walk was.
// sp.lastXFrac is still updated so the walk continues naturally afterward.
export function updateSpawner(sp, dt, stage, boxes, forcedBombXFrac = null) {
  sp.timer -= dt;
  if (sp.timer > 0) return null;

  sp.timer = stage.spawnIntervalSec;
  if (forcedBombXFrac != null) {
    sp.lastXFrac = forcedBombXFrac;
    return createFallingItem(ITEM_TYPES.BOMB, forcedBombXFrac, pickFallSpeedFrac(stage));
  }
  const type = rollItemType(stage, boxes);
  const x = pickNextX(sp);
  return createFallingItem(type, x, pickFallSpeedFrac(stage));
}
