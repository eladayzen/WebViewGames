// Shared falling-item behavior (§6): spawn, fall straight down (no
// horizontal drift, per §5.1), strike-band check, exit/cleanup. Pizza,
// ooze, and bombs are all just a `type` tag + sprite over this one shape --
// see data/itemTypes.js.

import { ITEM_SIZE_FRAC } from '../data/constants.js';

let nextId = 1;

export function createFallingItem(type, xFrac, speedFrac) {
  return {
    id: nextId++,
    type,
    xFrac,
    yFrac: -ITEM_SIZE_FRAC, // spawn just above the top of the screen
    prevYFrac: -ITEM_SIZE_FRAC,
    speedFrac, // fraction of canvas height fallen per second
    resolved: false, // struck, or already exited off-screen and counted
    rotationRad: 0,
    // Slow ambient tumble so falling items don't read as static/dull --
    // randomized direction and a little speed variance per item so a
    // cluster doesn't spin in visible lockstep. Cut ~70% from the initial
    // pass per Amit's feedback (2026-07-21) -- that first pass read as too
    // fast/busy.
    rotationSpeedRadPerSec: (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.12),
  };
}

export function updateFallingItem(item, dt) {
  item.prevYFrac = item.yFrac;
  item.yFrac += item.speedFrac * dt;
  item.rotationRad += item.rotationSpeedRadPerSec * dt;
}

// True exactly once, the frame the item's vertical center crosses the
// strike band -- checked against prev/current y so a fast-falling item
// can't skip past the band between two frames without being evaluated.
export function hasReachedStrikeBand(item, groundYFrac) {
  return item.prevYFrac < groundYFrac && item.yFrac >= groundYFrac;
}

// True on every frame the item's vertical extent overlaps Michelangelo's
// full head-to-feet silhouette (bandTopFrac..bandBottomFrac), not just the
// single feet line -- this is what lets a falling item be caught anywhere
// along his body instead of only exactly at his feet. Checked every frame
// (not once-per-crossing) since an item can dwell inside a tall band across
// several frames.
export function isWithinPlayerBand(item, bandTopFrac, bandBottomFrac) {
  const half = ITEM_SIZE_FRAC / 2;
  return item.yFrac + half >= bandTopFrac && item.yFrac - half <= bandBottomFrac;
}

export function isOffScreen(item) {
  return item.yFrac > 1.1;
}
