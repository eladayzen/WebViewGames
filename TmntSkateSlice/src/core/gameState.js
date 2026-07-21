// Top-level state machine (§9.2): countdown -> running -> gameover -> back
// to running (via countdown) on restart. No menu state -- the game must
// reach its first playable/countdown state on load with no key press
// (GOBALANCE_SDK.md contract).

import { COUNTDOWN_SEC } from '../data/constants.js';

export function createGameState() {
  return { current: 'countdown', countdownRemaining: COUNTDOWN_SEC, paused: false };
}

export function restartToCountdown(gs) {
  gs.current = 'countdown';
  gs.countdownRemaining = COUNTDOWN_SEC;
  gs.paused = false;
}

// Pause button (§ HUD conventions, BUILD_NOTES.md) -- freezes the whole
// simulation (countdown/running) in frame() without touching gs.current, so
// resuming drops back into exactly the state it was paused from.
export function togglePause(gs) {
  gs.paused = !gs.paused;
}

export function updateCountdown(gs, dt) {
  gs.countdownRemaining = Math.max(0, gs.countdownRemaining - dt);
  if (gs.countdownRemaining <= 0) {
    gs.current = 'running';
  }
}

export function triggerGameOver(gs) {
  gs.current = 'gameover';
}
