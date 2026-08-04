// Top-level state machine (§9.2): intro -> countdown -> running -> gameover
// -> back to intro (via restart) -- see core/main.js's beginIntro(), called
// from both boot() and the restart button, matching the reference
// onboarding-tutorial pattern's "shown every run, not just once ever"
// (WEB_MINIGAME_TECH_RETROSPECTIVE.md, 2026-08-04).
//
// 'intro' -- the onboarding tutorial (ui/ui.js's showIntroTutorial), two
// auto-cycling steps; world built but frozen, shown before every run. This
// satisfies GOBALANCE_SDK.md's "first playable/countdown state reachable on
// load with no key required" contract the same way a countdown does --
// core/main.js's frame() auto-advances each step on its own
// (data/introTutorial.js's INTRO_STEP_AUTO_ADVANCE_SEC) even with zero
// interaction, so a click/Space/Enter on the tutorial's NEXT/START buttons
// is a SPEED-UP over that fallback, never a requirement.

import { COUNTDOWN_SEC } from '../data/constants.js';

export function createGameState() {
  return { current: 'intro', countdownRemaining: COUNTDOWN_SEC, paused: false };
}

export function triggerIntro(gs) {
  gs.current = 'intro';
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
