// Single input-reading module (§4, §9.3): reads window.__gbSensor when
// present (GoBalance's analog tilt, ~60Hz), falls back to ArrowLeft/
// ArrowRight keydown/keyup otherwise, for desktop dev/testing only.
// window.__gbSensor is the authority when present -- never combine both, or
// the game double-applies input and over-steers (GOBALANCE_SDK.md).
//
// `y` is never read anywhere in this module or anywhere downstream of it --
// this is a strict left/right lean-only game (§4, §11), including for a
// hypothetical future full-pipe section: going further around the loop is
// purely a function of how long a left/right lean is held, never a
// different tilt axis.
//
// Exposes one continuous -1..1 target-steering value -- gameplay code never
// touches keyboard/sensor state directly (§9.3).

const state = { left: false, right: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') state.left = true;
  if (e.code === 'ArrowRight') state.right = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') state.left = false;
  if (e.code === 'ArrowRight') state.right = false;
});

export function getSteeringInput() {
  const sensor = window.__gbSensor;
  if (sensor) {
    return Math.max(-1, Math.min(1, sensor.x));
  }
  let x = 0;
  if (state.left) x -= 1;
  if (state.right) x += 1;
  return x;
}
