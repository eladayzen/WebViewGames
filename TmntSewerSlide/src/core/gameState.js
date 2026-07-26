// Top-level state machine (§9.2): countdown -> running -> gameover -> back
// to countdown on restart. No menu state -- the GoBalance SDK contract
// requires reaching a playable/countdown state on load with no key needed.

import { COUNTDOWN_SECONDS } from '../data/constants.js';

export function createGameState() {
  return { current: 'countdown', countdownRemaining: COUNTDOWN_SECONDS, paused: false };
}

export function restartToCountdown(gs) {
  gs.current = 'countdown';
  gs.countdownRemaining = COUNTDOWN_SECONDS;
  gs.paused = false;
}

// Pause button (cross-game HUD convention, ../../BUILD_NOTES.md) -- freezes
// the whole simulation without touching gs.current, so resuming drops back
// into exactly what was paused.
export function togglePause(gs) {
  gs.paused = !gs.paused;
}

export function updateCountdown(gs, dtSeconds) {
  gs.countdownRemaining = Math.max(0, gs.countdownRemaining - dtSeconds);
  if (gs.countdownRemaining <= 0) {
    gs.current = 'running';
  }
}

export function triggerGameOver(gs) {
  gs.current = 'gameover';
}
