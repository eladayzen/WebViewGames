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
//
// ── TWO TO FOUR BOARDS ──────────────────────────────────────────────────────
//
// THERE IS NO NETWORK IN ANY OF THIS. Up to four Bluetooth boards pair to ONE
// phone, the app publishes every board's tilt into the SAME WebView, and one
// page with one loop reads several input streams. No authority, no latency
// budget, no clock sync, no reconnect protocol -- the page is the only
// authority there has ever been. Everything below is a reader, not a protocol.
//
//   window.__gbPlayers = [[x,y], [x,y], ...]   index-aligned with the roster
//   window.__gbSensor  = {x,y}                 the MAIN board only
//
// Index 0 is always the phone's own board. Found by the Carve session reading
// WebGameBridge.cs (bobo_play 820d929); our own GOBALANCE_SDK.md documents only
// the single global and does not mention the array at all, which is the same
// staleness that cost them an hour and a wrong first answer. Believe the
// bridge, not the docs.
//
// THE FALLBACK IS NOT OPTIONAL. An older app build in the field publishes the
// single global and no array. A reader that only walks the array loses its
// input entirely instead of degrading to one player, and it would do so on
// exactly the devices nobody is testing on.

import { PLAYER } from '../data/tuning.js';

const keys = new Set();

/**
 * How many players the GAME has asked for. One until something says otherwise.
 *
 * This gates two things that must not happen in a single-player run: capping
 * the roster (a four-board session feeding a two-player game must not invent
 * slots nobody can draw), and splitting the keyboard. WASD is an ALIAS for the
 * arrows in single player and has been since the first build -- QA scripts and
 * muscle memory are written against it -- so it only becomes player 2's when a
 * game declares it wants player 2. Every single-player game stays untouched.
 */
let wantPlayers = 1;

/** Per-slot state. Keyed by index, created on demand. */
const slots = new Map();

function slotOf(i) {
  let s = slots.get(i);
  if (!s) {
    // `live` starts FALSE and flips on the first real reading, never at boot.
    // A slot that exists and reads zero is indistinguishable from a player
    // standing perfectly still, so a game that trusted existence alone would
    // start a two-player run against a board nobody is on.
    s = { live: false, rampX: 0, rampY: 0, lastX: 0, lastY: 0, stillS: 0, pegged: false };
    slots.set(i, s);
  }
  return s;
}

export function initInput() {
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

/** Declare how many boards this run wants to read. Clamped to the app's four. */
export function setPlayerCount(n) {
  wantPlayers = Math.max(1, Math.min(4, n | 0));
  return wantPlayers;
}

export function playerCount() {
  return wantPlayers;
}

/**
 * How many seats the HOST says are live, right now.
 *
 * WHY THIS IS A POLL AND NOT A BOOT-TIME READ. `window.__gbPlayers` is written
 * by the bridge once per frame, which first happens AFTER the page has loaded.
 * Reading it during boot finds `undefined` every time, so a two-board session
 * sized itself to one seat and co-op could not happen in the app at all --
 * while `?players=2` in a browser worked perfectly and hid it.
 *
 * Returns 0 when the host has not spoken yet, so the caller can keep waiting
 * rather than concluding "one player".
 */
export function liveSeatCount() {
  if (typeof window === 'undefined') return 0;
  const arr = window.__gbPlayers;
  if (Array.isArray(arr) && arr.length) return arr.length;
  return 0;
}

/** Has a real board ever driven this slot? */
export function slotLive(slot = 0) {
  return !!slots.get(slot)?.live;
}

/**
 * Does this slot look like a board that has been stepped off or has dropped?
 *
 * A DISCONNECTED BOARD DOES NOT READ AS NEUTRAL. Its address stops resolving
 * and the app's angle maths yields a CONSTANT FULL DEFLECTION, so the player
 * steers hard over and stays there, forever, at full speed. There is no
 * mid-game re-pairing and the platform has no connect watchdog, so the guard
 * has to live here.
 *
 * The tell is not the magnitude -- a child really can hold a full lean -- it is
 * that a real lean is never still. A board on a human jitters; a board whose
 * address stopped resolving returns the identical float every frame. So:
 * pegged at the clamp AND bit-identical for longer than a person can hold.
 *
 * This reports; it does not decide. What a run does about a dropped player is
 * a game decision and belongs where that decision is made.
 */
export function slotDropped(slot = 0) {
  const s = slots.get(slot);
  return !!s && s.live && s.pegged && s.stillS >= PLAYER.droppedBoardS;
}

function deadzone(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

/** Read one board's raw pair, or null when that slot has no board behind it. */
function rawPair(slot) {
  if (typeof window === 'undefined') return null;
  const arr = window.__gbPlayers;
  if (Array.isArray(arr) && arr.length) {
    // Cap at what the game asked for BEFORE indexing: four boards feeding a
    // two-player game must not reach slot 2.
    if (slot < Math.min(arr.length, wantPlayers)) {
      const p = arr[slot];
      const x = Array.isArray(p) ? p[0] : p?.x;
      const y = Array.isArray(p) ? p[1] : p?.y;
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    // An array that exists but has nothing usable at this slot falls through
    // rather than returning zero -- zero is a lean, absence is not.
  }
  // The single global is the MAIN board and therefore only ever slot 0.
  if (slot === 0) {
    const s = window.__gbSensor;
    if (s && (typeof s.x === 'number' || typeof s.y === 'number')) {
      return { x: s.x || 0, y: s.y || 0 };
    }
  }
  return null;
}

/** Track stillness for the dropped-board tell. Raw values, pre-deadzone. */
function noteRaw(s, x, y, dt) {
  const same = x === s.lastX && y === s.lastY;
  s.stillS = same ? s.stillS + dt : 0;
  s.lastX = x;
  s.lastY = y;
  // The clamp is radial, so "pegged" is the magnitude of the pair and not
  // either axis on its own.
  s.pegged = Math.hypot(x, y) >= PLAYER.peggedAt;
}

/**
 * @param {number} dt
 * @param {number} slot which board to read; 0 is the phone's own.
 * @returns {{x:number, y:number, source:'board'|'keyboard'}} both in -1..1
 */
export function readInput(dt, slot = 0) {
  const s = slotOf(slot);
  const pair = rawPair(slot);
  if (pair) {
    s.live = true;
    noteRaw(s, pair.x, pair.y, dt);
    return {
      x: deadzone(pair.x * PLAYER.sensorXSign, PLAYER.deadzoneX),
      y: deadzone(pair.y * PLAYER.sensorYSign, PLAYER.deadzoneY),
      source: 'board',
    };
  }

  // Desktop fallback. Ramped rather than binary so a keyboard feels a little
  // like a lean -- a dev convenience, never a second input path.
  //
  // In single player the arrows and WASD are the same control, as they have
  // always been. Only a game that asked for two players splits them, and then
  // slot 0 is the arrows and slot 1 is WASD.
  const split = wantPlayers > 1;
  const right = split ? (slot === 0 ? ['ArrowRight'] : ['KeyD'])
                      : ['ArrowRight', 'KeyD'];
  const left  = split ? (slot === 0 ? ['ArrowLeft'] : ['KeyA'])
                      : ['ArrowLeft', 'KeyA'];
  const down  = split ? (slot === 0 ? ['ArrowDown'] : ['KeyS'])
                      : ['ArrowDown', 'KeyS'];
  const up    = split ? (slot === 0 ? ['ArrowUp'] : ['KeyW'])
                      : ['ArrowUp', 'KeyW'];
  const any = (codes) => codes.some((c) => keys.has(c)) ? 1 : 0;

  const tx = any(right) - any(left);
  const ty = any(down) - any(up);
  const k = Math.min(1, dt / PLAYER.keyboardRampS);
  s.rampX += (tx - s.rampX) * k;
  s.rampY += (ty - s.rampY) * k;
  if (Math.abs(s.rampX) < 0.001) s.rampX = 0;
  if (Math.abs(s.rampY) < 0.001) s.rampY = 0;
  // A keyboard slot never counts as live: `live` means a board drove it, and
  // the roster question it answers is about boards.
  return { x: s.rampX, y: s.rampY, source: 'keyboard' };
}

export function keyHeld(code) {
  return keys.has(code);
}

/** Forget every slot. Called on a fresh run so a dropped board is re-asked. */
export function resetInput() {
  slots.clear();
}
