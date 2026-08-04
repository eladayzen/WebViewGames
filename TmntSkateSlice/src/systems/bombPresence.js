// Bomb presence floor (2026-08-05, raised to a count of 2). Direct feedback:
// with bomb spawns left purely to chance, a player could camp a play-area
// EDGE and go bomb-free for a long stretch. This tracks how long the bomb
// count has stayed below BOMB_PRESENCE_MIN_COUNT; once that exceeds
// BOMB_PRESENCE_MAX_GAP_SEC, the next spawn is FORCED to a bomb (core/
// main.js passes this through to systems/spawner.js), so there's almost
// never a real gap below the floor.
//
// Deliberately minimal -- this is a presence FLOOR, not the difficulty-curve
// system (that's separate, future work, not built here per direct
// instruction). Keep it that way: this file only ever answers "has the bomb
// count been under the floor too long," nothing about how hard the game is
// overall. A later difficulty pass can read/tune either constant (e.g. raise
// the count further, or shrink the gap, as stages progress) without needing
// to touch how this works.
const BOMB_PRESENCE_MAX_GAP_SEC = 5;
const BOMB_PRESENCE_MIN_COUNT = 2; // pushed up 2026-08-05, was checking for >=1

export function createBombPresence() {
  return { gapSec: 0 };
}

export function resetBombPresence(bp) {
  bp.gapSec = 0;
}

// Call once per frame with how many bombs are CURRENTLY active/unresolved on
// screen. Returns true exactly when the gap under the floor has grown too
// long and the next spawn should be forced to a bomb. Self-resets once the
// count is back at/above the floor (including from the forced spawn itself,
// the frame after it lands) -- no separate acknowledgement call needed.
export function updateBombPresence(bp, dt, bombCount) {
  if (bombCount >= BOMB_PRESENCE_MIN_COUNT) {
    bp.gapSec = 0;
    return false;
  }
  bp.gapSec += dt;
  return bp.gapSec >= BOMB_PRESENCE_MAX_GAP_SEC;
}
