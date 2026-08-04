// Single input module (build doc §4, §9.3).
//
// ANALOG MODE ONLY. The Unity host publishes the board's raw tilt at
// window.__gbSensor = {x, y} every frame when forwardSteeringKeys = false
// (GOBALANCE_SDK.md). This game reads that directly and must NEVER also listen
// for the host's synthetic arrow keys -- doing both double-applies the tilt and
// the game over-steers (the SDK's documented double-input gotcha).
//
// The desktop keyboard fallback below writes into the SAME internal vector, so
// it is a dev convenience, not a second input path. Tuning decided on a
// keyboard will systematically overstate how easy the pop is -- see §12.

import { DEADZONE, POP_PRESS, POP_RELEASE } from '../data/constants.js';

const keys = new Set();
let popLatched = false; // hysteresis state for the back-lean edge
let popEdge = false; // consumed once per frame by the game loop

export function initInput() {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    // 'T' fires a trick on demand -- the harness needs this to compare the
    // camera swing across rider modes without waiting for a ramp.
    if (e.code === 'KeyT') popEdge = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

// Applies the deadzone and rescales the remainder to a full 0..1 range, so the
// stick doesn't jump at the deadzone edge.
function applyDeadzone(v) {
  const a = Math.abs(v);
  if (a <= DEADZONE) return 0;
  return Math.sign(v) * Math.min(1, (a - DEADZONE) / (1 - DEADZONE));
}

/**
 * @returns {{carve:number, pop:boolean}} carve in [-1,1]; pop is a one-shot edge.
 */
export function readInput() {
  let x = 0;
  let y = 0;

  // GoBalance SDK: raw analog tilt, ~60Hz. Purely additive so it composes with
  // the keyboard fallback and no-ops in a normal browser (undefined sensor).
  const sensor = window.__gbSensor;
  if (sensor) {
    x += sensor.x;
    y += sensor.y;
  }

  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('Space')) y += 1;

  const carve = applyDeadzone(Math.max(-1, Math.min(1, x)));

  // Back-lean pop: edge-detected with our own hysteresis, because analog mode
  // ships none of its own. Thresholds are intentionally more forgiving than the
  // SDK's digital-mode numbers (§4) -- this is the physically hard axis.
  const ay = Math.max(-1, Math.min(1, y));
  if (!popLatched && ay >= POP_PRESS) {
    popLatched = true;
    popEdge = true;
  } else if (popLatched && ay < POP_RELEASE) {
    popLatched = false;
  }

  const pop = popEdge;
  popEdge = false;
  return { carve, pop };
}

/** Lets the lobby fire a trick programmatically (auto-trick toggle). */
export function forcePop() {
  popEdge = true;
}
