// Single input module (build doc §4, §9.3).
//
// TWO STEERING MODES, switchable live from the settings panel. The board is the
// only place either can honestly be judged, so both ship rather than one being
// compiled in (the same reasoning as HalfShellHustle's steering panel).
//
//   'regular'  -- the SDK's DEFAULT digital mode (forwardSteeringKeys = true).
//                 The host converts board tilt into synthetic ArrowLeft/Right
//                 keydown/keyup with its own hysteresis, and this game just
//                 reads them like any keyboard. Note this does NOT make the
//                 game lane-based: arrows set carve to +-1, and CARVE_SMOOTH
//                 then eases that into the pendulum, so movement stays free and
//                 continuous. It is also the mode where the host's
//                 gb:sensitivity dial does anything.
//
//   'analog'   -- reads window.__gbSensor directly for a continuous lean.
//                 Requires forwardSteeringKeys = OFF on the scene.
//
// THE DOUBLE-INPUT HAZARD, and why the sensor read is gated. __gbSensor is
// published every pump in BOTH modes -- the scene flag gates only the synthetic
// key dispatch, not the sensor value (GOBALANCE_SDK.md "Gotchas"). So reading it
// unconditionally, as this file used to, double-applies the tilt the moment the
// game runs in the default digital mode. Gating it on the mode is what makes
// 'regular' safe to be the default.
//
// The desktop keyboard is not a third path: it produces the same ArrowLeft/
// ArrowRight this module already reads, which is precisely why digital mode
// needs no special casing. Tuning decided on a keyboard will still overstate how
// easy the pop is -- see §12.

import { DEADZONE, POP_PRESS, POP_RELEASE } from '../data/constants.js';

export const STEER_REGULAR = 'regular';
export const STEER_ANALOG = 'analog';
export const STEER_MODES = [STEER_REGULAR, STEER_ANALOG];

const keys = new Set();
let popLatched = false; // hysteresis state for the back-lean edge
let popEdge = false; // consumed once per frame by the game loop
let steerMode = STEER_REGULAR;
// Board zero. A rider isn't necessarily standing level when the scene loads, so
// analog mode subtracts a captured centre rather than trusting raw zero.
let centre = { x: 0, y: 0 };

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

export function setSteerMode(mode) {
  if (STEER_MODES.includes(mode)) steerMode = mode;
}
export function getSteerMode() {
  return steerMode;
}

/**
 * Capture the board's current tilt as centre. Returns false when there's no
 * sensor (i.e. a normal browser), so the caller can say so rather than claiming
 * to have recentred nothing.
 */
export function recentreBoard() {
  const s = window.__gbSensor;
  if (!s) return false;
  centre = { x: s.x, y: s.y };
  return true;
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

  // ANALOG ONLY -- see the double-input note at the top of this file.
  if (steerMode === STEER_ANALOG) {
    const sensor = window.__gbSensor;
    if (sensor) {
      x += sensor.x - centre.x;
      y += sensor.y - centre.y;
    }
  }

  // Always read: in 'regular' mode these ARE the board (the host dispatches
  // them), and on a desktop they're the keyboard. Keyed on e.code, which is
  // what the host's synthetic events set.
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('Space')) y += 1;

  const carve = applyDeadzone(Math.max(-1, Math.min(1, x)));

  // Back-lean pop: edge-detected with our own hysteresis, because analog mode
  // ships none of its own. Thresholds are intentionally more forgiving than the
  // SDK's digital-mode numbers (§4) -- this is the physically hard axis.
  //
  // In 'regular' mode this axis arrives as ArrowUp, which the host only
  // dispatches when forwardVerticalAxis is ticked (off by default, and it fails
  // silently). Tricks fire automatically off ramps, so the manual pop is a
  // bonus rather than a requirement either way.
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
