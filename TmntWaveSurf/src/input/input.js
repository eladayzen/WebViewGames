// Input: the board, the keyboard and the touch screen, reduced to what the rider needs.
//
// Keyed on e.code, not e.key: Unity's synthetic KeyboardEvents set `code`.
//
// AXIS (player setting, picked on the start card and in settings):
//   'lr' = lean LEFT = up, lean RIGHT = down.   'fb' = lean FORWARD = up, BACK = down.
// Signs: __gbSensor.x < 0 is left; y is Unity-convention, y > 0 is forward.
//
// MODE (dev toggle):
//   'relative' (main) -- the lean is a scale, not a switch: how far you lean is how fast
//       the rider climbs or drops; centre holds the line. control() returns -1..1.
//   'burst' -- the centre means nothing; one input only: a HARD lean either way along the
//       axis bursts the rider up (edge-triggered, re-armed once the lean comes back).
//       takeBurst() returns true once per burst.
//
// holding() stays "up intent" with hysteresis -- the cards and the comic use it (1 s lean = go).
//
// The Unity scene must set forwardSteeringKeys = false, or the host also synthesises
// arrow keys from the same lean.
import { INPUT } from '../game/constants.js';

const UP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA']);
const DN_KEYS = new Set(['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD']);
const AXIS_KEY = 'tmntwavesurf:axis';

let axis = (() => { try { return localStorage.getItem(AXIS_KEY) === 'fb' ? 'fb' : 'lr'; } catch { return 'lr'; } })();
let mode = INPUT.MODE === 'burst' ? 'burst' : 'relative';
const state = { upKey: false, dnKey: false, ptr: false, board: false, hard: false, lean: 0, burst: false,
  up: false, dn: false, lastKey: -1e9 };
let press = 0.35, release = 0.21;

/** 'lr' | 'fb' -- which way of leaning drives the rider. Remembered on this device. */
export function setAxis(a) {
  axis = a === 'fb' ? 'fb' : 'lr'; state.board = state.hard = false;
  try { localStorage.setItem(AXIS_KEY, axis); } catch { /* restricted WebView */ }
}
export const getAxis = () => axis;
/** 'relative' | 'burst' */
export function setInputMode(m) { mode = m === 'burst' ? 'burst' : 'relative'; state.board = state.hard = state.burst = false; }
export const inputMode = () => mode;

/** Apply the player's sensitivity (10..100). Mirrors WebGameController.ApplySensitivity. */
export function setSensitivity(pct) {
  const s = Math.min(1, Math.max(0, pct / 100));
  press = INPUT.PRESS_AT_MIN + (INPUT.PRESS_AT_MAX - INPUT.PRESS_AT_MIN) * s;
  release = press * INPUT.RELEASE_RATIO;
}
export const thresholds = () => ({ press, release });

/** @param {Element} surface  pressing here (not on a button above it) is a hold */
export function installInput(surface) {
  addEventListener('keydown', (e) => {
    const up = UP_KEYS.has(e.code), dn = DN_KEYS.has(e.code);
    if (up) state.upKey = true;
    if (dn) state.dnKey = true;
    if ((up || dn) && !e.repeat) state.burst = true;   // burst mode: any direction key is the one input
    if (up || dn) e.preventDefault();
    if (e.code === 'ArrowUp' || e.code === 'KeyW') state.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') state.dn = true;
    state.lastKey = performance.now();
  });
  addEventListener('keyup', (e) => {
    if (UP_KEYS.has(e.code)) state.upKey = false;
    if (DN_KEYS.has(e.code)) state.dnKey = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') state.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') state.dn = false;
  });
  // A key held while the page loses focus never sends its keyup.
  addEventListener('blur', () => { state.upKey = state.dnKey = state.up = state.dn = state.ptr = false; });
  surface.addEventListener('pointerdown', (e) => { state.ptr = true; state.burst = true; e.preventDefault(); });
  addEventListener('pointerup', () => { state.ptr = false; });
  addEventListener('pointercancel', () => { state.ptr = false; });
}

/** Raw lean on both axes, "up" positive: lr = left, fb = forward. Null outside the app. */
export function rawLean() {
  const s = window.__gbSensor;
  if (!s || typeof s.x !== 'number' || !isFinite(s.x)) return null;
  return { lr: -s.x, fb: typeof s.y === 'number' && isFinite(s.y) ? s.y : 0 };
}

/** Once per frame: read the board, with hysteresis. Absent outside the app. */
export function pollBoard() {
  const r = rawLean();
  if (!r) { state.lean = 0; state.board = state.hard = false; return; }
  const l = axis === 'fb' ? r.fb : r.lr;
  state.lean = l;
  state.board = state.board ? l > release : l > press;                    // up intent (cards, comic, relative "hold")
  const hp = Math.min(0.95, press * INPUT.BURST_HARD), hr = hp * INPUT.RELEASE_RATIO;
  const wasHard = state.hard;
  state.hard = state.hard ? Math.abs(l) > hr : Math.abs(l) > hp;          // burst: a HARD lean, either way
  if (state.hard && !wasHard) state.burst = true;
}

/** Relative mode: -1 (full down) .. 0 (hold the line) .. +1 (full up). */
export function control() {
  if (state.upKey || state.ptr) return 1;
  if (state.dnKey) return -1;
  const l = state.lean, a = Math.abs(l);
  const dead = press * INPUT.REL_DEAD, full = Math.min(0.95, press * INPUT.REL_FULL);
  if (a <= dead) return 0;
  return Math.sign(l) * Math.min(1, (a - dead) / (full - dead));
}
/** Burst mode: true once per burst (key press, screen press, or a fresh hard lean). */
export function takeBurst() { const b = state.burst; state.burst = false; return b; }
export function clearBurst() { state.burst = false; }

export const holding = () => state.upKey || state.ptr || state.board || (mode === 'burst' && state.hard);
/** Direct (dev) controller: Up/Down set the height on the face. */
export const directKeys = () => state;
