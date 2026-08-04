// Bomb presence floor (2026-08-05). Direct feedback: with bomb spawns left
// purely to chance, a player could camp a play-area EDGE and go bomb-free
// for a long stretch. This tracks how long it's been since a bomb was
// actually on screen; once that exceeds BOMB_PRESENCE_MAX_GAP_SEC with none
// currently active, the next spawn is FORCED to a bomb (core/main.js passes
// this through to systems/spawner.js), so there's almost never a real gap.
//
// Deliberately minimal -- this is a presence FLOOR, not the difficulty-curve
// system (that's separate, future work, not built here per direct
// instruction). Keep it that way: this file only ever answers "has it been
// too long since a bomb was on screen," nothing about how hard the game is
// overall. A later difficulty pass can read/tune BOMB_PRESENCE_MAX_GAP_SEC
// (e.g. shrink it as stages progress) without needing to touch how this
// works.
const BOMB_PRESENCE_MAX_GAP_SEC = 5;

export function createBombPresence() {
  return { gapSec: 0 };
}

export function resetBombPresence(bp) {
  bp.gapSec = 0;
}

// Call once per frame with whether a bomb is CURRENTLY active/unresolved on
// screen. Returns true exactly when the gap has grown too long and the next
// spawn should be forced to a bomb. Self-resets once a bomb is on screen
// again (including the forced one, the frame after it spawns) -- no separate
// acknowledgement call needed.
export function updateBombPresence(bp, dt, bombOnScreen) {
  if (bombOnScreen) {
    bp.gapSec = 0;
    return false;
  }
  bp.gapSec += dt;
  return bp.gapSec >= BOMB_PRESENCE_MAX_GAP_SEC;
}
