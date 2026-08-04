// Small explicit state machine (build doc §9.2):
//   'intro'         -- the onboarding explainer (ui/hud.js's tutorial
//                      overlay); world built but frozen, shown at the start
//                      of every run before 'running'
//   'running'       -- normal play
//   'levelcomplete' -- a tier was reached; world frozen behind the transition
//                      overlay while its countdown runs
//   'gameover'      -- out of lives
//
// GOBALANCE_SDK.md's contract: the game's first playable/countdown state
// must be reachable on page load with NO KEY REQUIRED. 'intro' satisfies
// this the same way a countdown would -- core/main.js's tick auto-advances
// it on its own (data/introTutorial.js's INTRO_LANE_STEP_AUTO_ADVANCE_SEC /
// INTRO_JUMP_STEP_AUTO_ADVANCE_SEC) even with zero interaction, so a
// click/Space/Enter on the tutorial's continue buttons is a SPEED-UP over
// that fallback, never a requirement.
// 'levelcomplete' is only ever entered mid-run, never at boot.
//
// 'levelcomplete'/'intro' are deliberately their own states rather than a
// flag on 'running': everything in core/main.js's tick is already gated on
// `gs.current === 'running'`, so a distinct state freezes the entire world --
// scroll, spawners, collision, input -- with no extra guards to add or forget.

export function createGameState() {
  return { current: 'intro' };
}

export function restartToRunning(gs) {
  gs.current = 'running';
}

export function triggerGameOver(gs) {
  gs.current = 'gameover';
}

export function triggerLevelComplete(gs) {
  gs.current = 'levelcomplete';
}

export function triggerIntro(gs) {
  gs.current = 'intro';
}
