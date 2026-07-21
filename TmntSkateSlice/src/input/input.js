// Single input funnel (build doc §4). This game is Analog mode
// (`forwardSteeringKeys = false` on the GoBalance WebGameController) --
// continuous proportional lean, x-axis only, no attack button of any kind.
// The nunchaku swing is never a separate input; it is purely a reaction to
// positional overlap, handled in entities/player.js.
//
// __gbSensor is the authority whenever present -- read directly as a
// continuous value (no press/release hysteresis; that pattern belongs to
// games translating analog tilt into discrete digital actions, not to a
// genuinely analog game like this one). Arrow keys are dev-only fallback,
// additive, and only apply when __gbSensor is absent.
//
// y is read from nowhere -- this is a strict single-axis game (§4, §11): do
// not wire ArrowUp/ArrowDown or any y-derived behavior to gameplay.

let keyLeft = false;
let keyRight = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') keyLeft = true;
  else if (e.code === 'ArrowRight') keyRight = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') keyLeft = false;
  else if (e.code === 'ArrowRight') keyRight = false;
});

// Returns a continuous steering axis in roughly [-1, 1]: negative = left,
// positive = right. __gbSensor.x (real board tilt, or Editor keyboard proxy
// upstream of this page) wins whenever present; keyboard fallback is purely
// for testing this page outside the SDK/board.
export function getSteerAxis() {
  const sensor = window.__gbSensor;
  if (sensor) return Math.max(-1, Math.min(1, sensor.x));

  let axis = 0;
  if (keyLeft) axis -= 1;
  if (keyRight) axis += 1;
  return axis;
}
