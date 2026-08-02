// Small explicit state machine (build doc §9.2):
//   'running'       -- normal play
//   'levelcomplete' -- a tier was reached; world frozen behind the transition
//                      overlay while its countdown runs
//   'gameover'      -- out of lives
//
// The game still reaches a playable state immediately on load with no key
// needed (GOBALANCE_SDK.md's contract) -- 'levelcomplete' is only ever entered
// mid-run, never at boot.
//
// 'levelcomplete' is deliberately a THIRD state rather than a flag on
// 'running': everything in core/main.js's tick is already gated on
// `gs.current === 'running'`, so a distinct state freezes the entire world --
// scroll, spawners, collision, input -- with no extra guards to add or forget.

export function createGameState() {
  return { current: 'running' };
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
