// Two things come off the board: a TAP (an action) and BALANCE (keep running).
//
// TAP: window.__gbSensor.x is polled once per frame. A tap is EDGE-triggered
// with hysteresis -- it fires once when |x| crosses PRESS and re-arms only once
// |x| falls back under RELEASE, plus a cooldown so a wobble cannot double-fire.
// Lean LEFT or RIGHT = 'jump' (both sides the same). A second tap in the air is
// the double jump; HOLDING the lean (or a key / press) re-jumps on every landing.
// Staying in the middle does nothing, and nothing here ever changes his speed.
//
// KEYS (e.code): Left/Right arrows, A/D, Space. Pointer: a press on the canvas.
// The Unity scene must set forwardSteeringKeys = false, or the host also
// synthesises ArrowLeft/Right from the lean and every board tap fires twice.
import { INPUT } from '../game/constants.js';

const JUMP = new Set(INPUT.JUMP_CODES);
let press = 0.35, release = 0.21;
let pending = null;                // 'jump' | 'roll' | null -- the latest tap wins
let armed = true, lastTap = -1e9;
const keysDown = new Set();

export function setSensitivity(pct) {
  const s = Math.min(1, Math.max(0, pct / 100));
  press = INPUT.PRESS_AT_MIN + (INPUT.PRESS_AT_MAX - INPUT.PRESS_AT_MIN) * s;
  release = press * INPUT.RELEASE_RATIO;
}
export const thresholds = () => ({ press, release });

function tap(kind) {
  const now = performance.now();
  if (now - lastTap < INPUT.COOLDOWN_MS) return;
  lastTap = now; pending = kind;
}

export function installInput(surface) {
  addEventListener('keydown', (e) => {
    if (!JUMP.has(e.code)) return;
    e.preventDefault();
    keysDown.add(e.code);
    if (!e.repeat) tap('jump');
  });
  addEventListener('keyup', (e) => keysDown.delete(e.code));
  addEventListener('blur', () => keysDown.clear());
  // pointer: a press anywhere jumps (no hold)
  surface.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tap('jump');
  });
}

/** Once per frame. The board is absent outside the app. */
export function pollBoard() {
  const s = window.__gbSensor;
  if (s && typeof s.x === 'number' && isFinite(s.x)) {
    const ax = Math.abs(s.x);
    if (armed && ax > press) { armed = false; tap('jump'); }
    else if (!armed && ax < release) armed = true;
  } else armed = true;
}

/** 'jump' once per tap, else null. */
export function consumeTap() { const k = pending; pending = null; return k; }
export function clearTaps() { pending = null; }
