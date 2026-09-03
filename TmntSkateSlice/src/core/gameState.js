// Top-level state machine (§9.2): intro -> countdown -> running ->
// stagecomplete -> back to running -> gameover -> back to intro (via
// restart) -- see core/main.js's beginIntro(), called from both boot() and
// the restart button, matching the reference onboarding-tutorial pattern's
// "shown every run, not just once ever" (WEB_MINIGAME_TECH_RETROSPECTIVE.md,
// 2026-08-04).
//
// 'intro' -- the onboarding tutorial (ui/ui.js's showIntroTutorial), two
// auto-cycling steps; world built but frozen, shown before every run. This
// satisfies GOBALANCE_SDK.md's "first playable/countdown state reachable on
// load with no key required" contract the same way a countdown does --
// core/main.js's frame() auto-advances each step on its own
// (data/introTutorial.js's INTRO_STEP_AUTO_ADVANCE_SEC) even with zero
// interaction, so a click/Space/Enter on the tutorial's NEXT/START buttons
// is a SPEED-UP over that fallback, never a requirement.
//
// 'stagecomplete' -- reaching a new stage's score threshold freezes the
// world (same free-freeze trick as 'intro': everything in frame()'s tick is
// already gated on gs.current, so a distinct state pauses spawner/collision/
// scroll with no extra guards) behind a curtain-close/open transition, ported
// from HalfShellHustle's level-complete pattern (see
// WEB_MINIGAME_TECH_RETROSPECTIVE.md and data/stageTransition.js's timing
// knobs). Only ever entered mid-run, never at boot -- resumeRunning (not
// restartToCountdown) is what returns from it, since there's no re-countdown
// on a mid-run stage change.

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

// Campaign finished (cleared the last stage). A SEPARATE state from 'gameover'
// on purpose (mirrors NovaVanguard's GameState.CLEARED): it freezes the sim the
// same way, but finishing is not failing -- the victory beat must not auto-
// restart, and its own state is what the X reads to leave without a confirm and
// what keeps Space from restarting under the player's fingers while they read
// the earned screen. See core/main.js's completeCampaign/continueFromVictory.
export function triggerCleared(gs) {
  gs.current = 'cleared';
}

export function triggerStageComplete(gs) {
  gs.current = 'stagecomplete';
}

// Resume straight into 'running' (no re-countdown) -- the mid-run
// stagecomplete -> running case, distinct from restartToCountdown's
// fresh-run-start case.
export function resumeRunning(gs) {
  gs.current = 'running';
}
