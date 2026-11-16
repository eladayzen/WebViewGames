// The one input: HOLD. Held = keyboard OR pointer/touch OR board.
//
// Keyed on e.code, not e.key: Unity's synthetic KeyboardEvents set `code`.
//
// BOARD: window.__gbSensor is a plain global the host rewrites at ~60 Hz; it is
// polled once per frame (pollBoard). Hold = |x| past PRESS, kept until |x| drops
// under RELEASE -- the same hysteresis HalfShellHustle uses for its jump, so a
// lean resting on the threshold does not chatter. Lateral axis ONLY: forward /
// back is the hard axis on a balance board, and y is never read.
//
// The Unity scene must set forwardSteeringKeys = false. With it on, the host
// also synthesises ArrowLeft/Right from the same lean; those are not hold keys
// here, so nothing doubles, but they would still be noise.
import { INPUT } from '../game/constants.js';

const HOLD = new Set(INPUT.HOLD_CODES);
const state = { holdKey: false, holdPtr: false, board: false, up: false, dn: false, lastKey: -1e9 };
let press = 0.35, release = 0.21;

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
    if (HOLD.has(e.code)) { state.holdKey = true; e.preventDefault(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') state.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { state.dn = true; e.preventDefault(); }
    state.lastKey = performance.now();
  });
  addEventListener('keyup', (e) => {
    if (HOLD.has(e.code)) state.holdKey = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') state.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') state.dn = false;
  });
  // A key held while the page loses focus never sends its keyup.
  addEventListener('blur', () => { state.holdKey = state.up = state.dn = false; state.holdPtr = false; });
  surface.addEventListener('pointerdown', (e) => { state.holdPtr = true; e.preventDefault(); });
  addEventListener('pointerup', () => { state.holdPtr = false; });
  addEventListener('pointercancel', () => { state.holdPtr = false; });
}

/** Once per frame: read the board, with hysteresis. Absent outside the app. */
export function pollBoard() {
  const s = window.__gbSensor;
  if (!s || typeof s.x !== 'number' || !isFinite(s.x)) { state.board = false; return; }
  const ax = Math.abs(s.x);
  state.board = state.board ? ax > release : ax > press;
}

export const holding = () => state.holdKey || state.holdPtr || state.board;
/** Direct (dev) controller: Up/Down set the height on the face. */
export const directKeys = () => state;
