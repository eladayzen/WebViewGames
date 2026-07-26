// Small explicit state machine (build doc §9.2): 'running' -> 'gameover' ->
// back to 'running' on restart. No countdown/menu state -- the game reaches
// its first playable state immediately on load with no key needed
// (GOBALANCE_SDK.md's contract), which POC's simplest possible fail state
// (a hit ends the run immediately, §2) doesn't need a countdown ramp-up to
// satisfy.

export function createGameState() {
  return { current: 'running' };
}

export function restartToRunning(gs) {
  gs.current = 'running';
}

export function triggerGameOver(gs) {
  gs.current = 'gameover';
}
