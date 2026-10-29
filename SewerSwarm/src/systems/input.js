// WHERE THE PLAYER IS WALKING, and nothing else.
//
// Adapted from Bloop Squad's input layer, cut down to one seat because
// prototype 1 is single player, and opened up because the whole point of this
// prototype is to find out what the numbers should be.
//
// WHY THIS FILE IS TUNABLE AT RUNTIME. This game lives or dies on an axis the
// hardware is bad at. Leaning forward and back on the board is markedly harder
// than leaning side to side, and Bloop Squad's shipped tuning says so: its
// sideways deadzone is 0.08 and its forward/back deadzone is 0.20 -- two and a
// half times the lean before the game responds at all -- and it clamps vertical
// movement to a band rather than letting it roam.
//
// A top-down survivor cannot do that. Forward/back becomes half of all
// movement, unbounded. Whether that is playable is not a question anyone can
// answer at a desk, and it is not a question I should answer by picking a
// number and defending it. So every value below is overridable from the URL
// and shown on screen, and the deliverable of this prototype is the values
// that felt right on a real board -- not the ones in this file.
//
//   ?dzx=0.08  sideways deadzone        ?dzy=0.20  forward/back deadzone
//   ?spd=520   walk speed, px/sec       ?ramp=0.12 keyboard ease, seconds
//
// Everything is feature-detected: at a plain dev URL there is no board, the
// arrows and WASD stand in, and nothing here throws.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (key, fallback) => {
  const v = Number(QS.get(key));
  return Number.isFinite(v) && QS.get(key) !== null ? v : fallback;
};

export const TUNING = {
  // Bloop Squad's shipped values, as the STARTING POINT and nothing more.
  deadzoneX: num('dzx', 0.08),
  deadzoneY: num('dzy', 0.20),
  speedPxS: num('spd', 520),
  keyboardRampS: num('ramp', 0.12),
};

const keys = new Set();
let ramp = { x: 0, y: 0 };

export function initInput() {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  // A lost focus must not leave the player walking into the dark forever.
  window.addEventListener('blur', () => keys.clear());
}

/** Past the deadzone, rescaled so the usable range still reaches 1. */
function deadzone(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

/**
 * The board's own tilt for seat 0, or null when no board is driving it.
 *
 * `window.__gbSensor` is the single-board global the app has always published
 * and every shipped game reads. `__gbPlayers` is the per-seat array that
 * arrived with multiplayer; seat 0 of it is the same board. Reading both means
 * this works on an older app build that only publishes the first.
 */
function boardTilt() {
  if (typeof window === 'undefined') return null;
  const arr = window.__gbPlayers;
  if (Array.isArray(arr) && arr.length && Array.isArray(arr[0])) {
    return { x: arr[0][0], y: arr[0][1] };
  }
  const s = window.__gbSensor;
  if (s && typeof s.x === 'number' && typeof s.y === 'number') return s;
  return null;
}

/**
 * Where the player is being asked to walk, as -1..1 on each axis.
 *
 * Returns the SOURCE too, because "does this feel bad" has a different answer
 * on a keyboard than on a board and the readout needs to say which is being
 * judged.
 */
export function readInput(dt) {
  const t = boardTilt();
  if (t) {
    return {
      x: deadzone(t.x, TUNING.deadzoneX),
      y: deadzone(t.y, TUNING.deadzoneY),
      source: 'board',
    };
  }
  // Desktop fallback. Ramped rather than binary so a keyboard feels a little
  // like a lean -- a dev convenience, never a second input path.
  const held = (codes) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  const tx = held(['ArrowRight', 'KeyD']) - held(['ArrowLeft', 'KeyA']);
  const ty = held(['ArrowDown', 'KeyS']) - held(['ArrowUp', 'KeyW']);
  const k = Math.min(1, dt / TUNING.keyboardRampS);
  ramp.x += (tx - ramp.x) * k;
  ramp.y += (ty - ramp.y) * k;
  if (Math.abs(ramp.x) < 0.001) ramp.x = 0;
  if (Math.abs(ramp.y) < 0.001) ramp.y = 0;
  return { x: ramp.x, y: ramp.y, source: 'keyboard' };
}

/** Testing only. */
export function __setKeys(codes) {
  keys.clear();
  for (const c of codes || []) keys.add(c);
  ramp = { x: 0, y: 0 };
}
