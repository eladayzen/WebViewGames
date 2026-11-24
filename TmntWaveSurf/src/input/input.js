// The one input: HOLD. Held = keyboard OR pointer/touch OR board.
//
// Keyed on e.code, not e.key: Unity's synthetic KeyboardEvents set `code`.
//
// BOARD: window.__gbSensor is a plain global the host rewrites at ~60 Hz; it is
// polled once per frame (pollBoard). Hold = the lean toward ONE side (INPUT.HOLD_SIDE,
// default left) past PRESS, kept until it drops under RELEASE -- the same hysteresis
// HalfShellHustle uses for its jump, so a lean resting on the threshold does not
// chatter. Every other lean (the other side, front/back, centre) is no input.
// Signs: x < 0 is left; y is Unity-convention, y > 0 is front.
//
// The Unity scene must set forwardSteeringKeys = false. With it on, the host
// also synthesises ArrowLeft/Right from the same lean; those are not hold keys
// here, so nothing doubles, but they would still be noise.
import { INPUT } from '../game/constants.js';

const SIDE_KEY = { left: 'ArrowLeft', right: 'ArrowRight', front: 'ArrowUp', back: 'ArrowDown' };
const HOLD = new Set(INPUT.HOLD_CODES);
let side = INPUT.HOLD_SIDE;
/** Which lean pushes the board up: 'left' | 'right' | 'front' | 'back'. */
export function setHoldSide(v) {
  if (!SIDE_KEY[v]) return;
  HOLD.delete(SIDE_KEY[side]); side = v; HOLD.add(SIDE_KEY[side]); state.board = false;
}
export const holdSide = () => side;
// MODE (INPUT.MODE): 'one' = one lean pushes up, everything else is nothing.
// 'classic' = the classic GoBalance controller (default): lean LEFT = up, lean RIGHT = down,
// centre = hold the line. holding() is "up" in both modes (cards, comics, ramp).
let mode = INPUT.MODE === 'classic' ? 'classic' : 'one';
export function setInputMode(m) { mode = m === 'classic' ? 'classic' : 'one'; state.board = state.boardDn = false; }
export const inputMode = () => mode;
const state = { holdKey: false, holdPtr: false, board: false, boardDn: false, dnKey: false, up: false, dn: false, lastKey: -1e9 };
let press = 0.35, release = 0.21;
HOLD.add(SIDE_KEY[side]);

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
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight') state.dnKey = true;   // classic mode: down
    state.lastKey = performance.now();
  });
  addEventListener('keyup', (e) => {
    if (HOLD.has(e.code)) state.holdKey = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') state.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') state.dn = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight') state.dnKey = false;
  });
  // A key held while the page loses focus never sends its keyup.
  addEventListener('blur', () => { state.holdKey = state.up = state.dn = state.dnKey = false; state.holdPtr = false; });
  surface.addEventListener('pointerdown', (e) => { state.holdPtr = true; e.preventDefault(); });
  addEventListener('pointerup', () => { state.holdPtr = false; });
  addEventListener('pointercancel', () => { state.holdPtr = false; });
}

/** Once per frame: read the board, with hysteresis. Absent outside the app. */
export function pollBoard() {
  const s = window.__gbSensor;
  if (!s || typeof s.x !== 'number' || !isFinite(s.x)) { state.board = state.boardDn = false; return; }
  if (mode === 'classic') {   // x < 0 = left = up, x > 0 = right = down
    state.board = state.board ? -s.x > release : -s.x > press;
    state.boardDn = state.boardDn ? s.x > release : s.x > press;
    return;
  }
  const y = typeof s.y === 'number' && isFinite(s.y) ? s.y : 0;
  const lean = side === 'left' ? -s.x : side === 'right' ? s.x : side === 'front' ? y : -y;   // toward the hold side only
  state.board = state.board ? lean > release : lean > press;
}

export const holding = () => state.holdKey || state.holdPtr || state.board;
/** +1 up, -1 down (classic mode only), 0 = no input. */
export const leanDir = () => holding() ? 1 : (mode === 'classic' && (state.boardDn || state.dnKey)) ? -1 : 0;
/** Direct (dev) controller: Up/Down set the height on the face. */
export const directKeys = () => state;
