// Digital input only (build doc §4): forwardSteeringKeys = true on the
// GoBalance WebGameController -- synthetic ArrowLeft/ArrowRight/ArrowUp
// keydown/keyup KeyboardEvents with hysteresis. This game never reads
// window.__gbSensor (§4's "why digital, not analog" -- lane-slots and jump
// are discrete, exactly digital mode's archetype).
//
// Reuses CarRacer/src/input.js's pollLaneStep()-style edge-detected one-shot
// primitive, extended with an edge-detected jump boolean -- a fresh keydown,
// not a hold; holding the key never repeats a step, matching both the SDK's
// own press/release hysteresis and the genre's snap-between-lanes feel.
//
// Keyed on e.code, not e.key: Unity's synthetic KeyboardEvents set `code`,
// not a layout-dependent `key` (GOBALANCE_SDK.md).

const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up' };

const state = { left: false, right: false, up: false };
let leftWasDown = false;
let rightWasDown = false;
let upWasDown = false;

window.addEventListener('keydown', (e) => {
  const action = KEY_MAP[e.code];
  if (action) state[action] = true;
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.code];
  if (action) state[action] = false;
});

// Edge-detected +-1 lane step -- one press = one discrete step, no repeat
// while held (§4).
export function pollLaneStep() {
  let step = 0;
  if (state.left && !leftWasDown) step -= 1;
  if (state.right && !rightWasDown) step += 1;
  leftWasDown = state.left;
  rightWasDown = state.right;
  return step;
}

// Edge-detected one-shot jump press (§4: ArrowUp press, ignored while
// already airborne -- that "no double-jump" guard lives in
// entities/player.js's startPlayerJump(), not here; this just reports "a
// fresh press happened").
export function pollJumpPress() {
  const pressed = state.up && !upWasDown;
  upWasDown = state.up;
  return pressed;
}
