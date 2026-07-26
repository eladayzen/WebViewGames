// Digital input only (build doc §4): forwardSteeringKeys = true on the
// GoBalance WebGameController -- synthetic ArrowLeft/ArrowRight keydown/keyup
// KeyboardEvents with hysteresis. This game never reads window.__gbSensor
// (§4's "why digital, not analog" -- lane-slots are discrete, exactly digital
// mode's archetype). No jump/ArrowUp -- dropped per direct POC-playtest
// feedback along with the 3-lane-spanning jump-obstacle it existed for.
//
// Reuses CarRacer/src/input.js's pollLaneStep()-style edge-detected one-shot
// primitive -- a fresh keydown, not a hold; holding the key never repeats a
// step, matching both the SDK's own press/release hysteresis and the genre's
// snap-between-lanes feel.
//
// Keyed on e.code, not e.key: Unity's synthetic KeyboardEvents set `code`,
// not a layout-dependent `key` (GOBALANCE_SDK.md).

const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right' };

const state = { left: false, right: false };
let leftWasDown = false;
let rightWasDown = false;

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
