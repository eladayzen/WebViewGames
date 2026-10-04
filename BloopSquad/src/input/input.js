// Board input, carried over from Nova Vanguard because the shape of it is a
// hardware finding rather than a preference:
//
//   - the deadzone RESCALES, so just past the threshold reads as ~0 rather than
//     jumping to the threshold value;
//   - the board reports lean-forward as POSITIVE y while screen y grows
//     downward, so the sensor's y is negated (and only the sensor's -- the
//     keyboard fallback is already correct);
//   - lateral is lightly deadzoned and fast, vertical heavily deadzoned and
//     slower, which is the lean-ergonomics asymmetry expressed as constants.
//
// Everything is feature-detected: `window.__gbSensor` simply does not exist in
// a normal browser, and the game has to stay playable at a plain URL because
// that is where it is developed.

import { PLAYER } from '../data/tuning.js';

const keys = new Set();
let rampX = 0;
let rampY = 0;

export function initInput() {
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

function deadzone(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

/** @returns {{x:number, y:number, source:'board'|'keyboard'}} both in -1..1 */
export function readInput(dt) {
  const s = typeof window !== 'undefined' ? window.__gbSensor : null;
  if (s && (typeof s.x === 'number' || typeof s.y === 'number')) {
    return {
      x: deadzone((s.x || 0) * PLAYER.sensorXSign, PLAYER.deadzoneX),
      y: deadzone((s.y || 0) * PLAYER.sensorYSign, PLAYER.deadzoneY),
      source: 'board',
    };
  }
  // Desktop fallback. Ramped rather than binary so a keyboard feels a little
  // like a lean -- a dev convenience, never a second input path.
  const tx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
             (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const ty = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) -
             (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
  const k = Math.min(1, dt / PLAYER.keyboardRampS);
  rampX += (tx - rampX) * k;
  rampY += (ty - rampY) * k;
  if (Math.abs(rampX) < 0.001) rampX = 0;
  if (Math.abs(rampY) < 0.001) rampY = 0;
  return { x: rampX, y: rampY, source: 'keyboard' };
}

export function keyHeld(code) {
  return keys.has(code);
}
