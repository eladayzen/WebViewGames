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
// number and defending it. So every value below is overridable from the URL,
// and the deliverable of this prototype is the values that felt right on a
// real board -- not the ones in this file.
//
// (An earlier version of this comment also promised the values were "shown
// on screen". They never were. Said here rather than quietly deleted,
// because somebody standing on a board with no readout is going to want one
// and should know it was meant to exist.)
//
//   ?dzx=0.08  sideways deadzone        ?dzy=0.20  forward/back deadzone
//   ?spd=520   walk speed, px/sec       ?ramp=0.12 keyboard ease, seconds
//
// ?spd= IS THE SPEED BEFORE THE GLOBAL PACE. Everything that travels in this
// game is scaled by core/pace.js, so the walk speed actually used is
// ?spd= x ?pace=, and the two compose. Read pace.js before changing either:
// moving ?spd= alone changes how fast the player is RELATIVE TO THE HORDE,
// which is a different decision from how fast the game is.
//
// Everything is feature-detected: at a plain dev URL there is no board, the
// arrows and WASD stand in, and nothing here throws.

import { paced } from '../core/pace.js';

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (key, fallback) => {
  const v = Number(QS.get(key));
  return Number.isFinite(v) && QS.get(key) !== null ? v : fallback;
};

export const TUNING = {
  // Bloop Squad's shipped values, as the STARTING POINT and nothing more.
  deadzoneX: num('dzx', 0.08),
  deadzoneY: num('dzy', 0.20),
  // 520 was the number every other value in the game was tuned against, so
  // it stays written as 520 and the pace does the cutting -- see pace.js.
  speedPxS: paced(num('spd', 520)),
  keyboardRampS: num('ramp', 0.12),

  // BOARD AXIS SIGNS -- applied to the sensor read ONLY, never to the desktop
  // keyboard fallback.
  //
  // THE BUG THESE FIX (Elad, on the real board, 8 Nov): "up is down and down is
  // up." Leaning forward walked him down the screen.
  //
  // This is the SAME bug Nova Vanguard already found and wrote down, and the
  // reasoning there is the authority: the board reports lean-forward as
  // POSITIVE y, while screen space has positive y pointing DOWN. So the raw
  // value has to be negated for forward to mean forward. GOBALANCE_SDK.md
  // publishes `__gbSensor = {x, y}` without stating a sign convention for y,
  // and most shipped games never touch that axis -- so every game that uses it
  // rediscovers this, and hardware is the authority.
  //
  // WHY IT IS A SIGN ON THE SENSOR AND NOT ON THE MOVEMENT. Negating the
  // movement would also invert the keyboard, where ArrowDown correctly means
  // "walk down the screen" and is not broken. Only the board's y is wrong, so
  // only the board's y is flipped. Named constants, so that if the hardware
  // ever disagrees again this is a one-character change with a paper trail
  // rather than a hunt through the input module.
  sensorXSign: num('sxs', 1),   // lateral confirmed correct on the board
  sensorYSign: num('sys', -1),
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

/** The board's raw axes, turned the way the screen means them. */
function signed(x, y) {
  return { x: x * TUNING.sensorXSign, y: y * TUNING.sensorYSign };
}

/**
 * The board's own tilt for seat 0, or null when no board is driving it.
 *
 * `window.__gbSensor` is the single-board global the app has always published
 * and every shipped game reads. `__gbPlayers` is the per-seat array that
 * arrived with multiplayer; seat 0 of it is the same board. Reading both means
 * this works on an older app build that only publishes the first.
 *
 * Both paths go through `signed()`, because both carry the board's own y
 * convention and both were wrong in the same direction.
 */
function boardTilt() {
  if (typeof window === 'undefined') return null;
  const arr = window.__gbPlayers;
  if (Array.isArray(arr) && arr.length && Array.isArray(arr[0])) {
    return signed(arr[0][0], arr[0][1]);
  }
  const s = window.__gbSensor;
  if (s && typeof s.x === 'number' && typeof s.y === 'number') return signed(s.x, s.y);
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
