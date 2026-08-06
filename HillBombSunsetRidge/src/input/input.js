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

import { DEADZONE } from '../data/constants.js';

export const STEER_REGULAR = 'regular';
export const STEER_ANALOG = 'analog';
export const STEER_MODES = [STEER_REGULAR, STEER_ANALOG];

const keys = new Set();
// A trick can still be fired programmatically (the lab's auto-trick, and the
// 'T' key) even though the manual pop input is gone -- see forcePop.
let popEdge = false;
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
 * @returns {{carve:number, tuck:number, brake:number, pop:boolean}}
 *   carve in [-1,1]; tuck and brake each in [0,1]; pop is a one-shot edge that
 *   now only fires programmatically.
 *
 * THE FORE/AFT AXIS IS TUCK AND BRAKE, not the trick pop. Lean forward to tuck
 * and gain speed, lean back to drag the tail and slow down. The manual pop that
 * used to live on this axis is gone: tricks already fire automatically off
 * ramps, and asking for a sharp forward JAB to distinguish "trick" from a
 * sustained "tuck" is not something to ask of someone balancing on a board.
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
  // +y is FORWARD (tuck), -y is BACK (brake). In 'regular' mode these arrive as
  // ArrowUp/ArrowDown, which the host only dispatches when forwardVerticalAxis
  // is ticked on the scene -- it is off by DEFAULT and fails silently, so a
  // build with it unticked simply has no tuck and no brake at all.
  if (keys.has('ArrowUp') || keys.has('KeyW')) y += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y -= 1;

  const carve = applyDeadzone(Math.max(-1, Math.min(1, x)));
  const ay = applyDeadzone(Math.max(-1, Math.min(1, y)));

  const pop = popEdge;
  popEdge = false;
  return { carve, tuck: Math.max(0, ay), brake: Math.max(0, -ay), pop };
}

/** Lets the lobby fire a trick programmatically (auto-trick toggle). */
export function forcePop() {
  popEdge = true;
}
