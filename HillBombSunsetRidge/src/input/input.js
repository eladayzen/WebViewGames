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

import { DEADZONE, BRAKE_DEADZONE, BRAKE_HOLD_MS } from '../data/constants.js';

export const STEER_REGULAR = 'regular';
export const STEER_ANALOG = 'analog';
export const STEER_MODES = [STEER_REGULAR, STEER_ANALOG];

// --- STANCE: which way the rider is standing on the board --------------------
//
// The GoBalance board is shaped like a skateboard, so the natural thing to do
// with it is stand ACROSS it, the way you stand on a skateboard -- and once you
// do, the board's axes are rotated ninety degrees against your body. What the
// sensor calls forward is your left, and what it calls right is your forward.
//
// SKATE is the default because it is what the hardware invites. Standing square
// to the board is the odd case now, not the normal one.
//
// ONE DEPLOYMENT CONSEQUENCE, and it is not optional. In 'regular' steering the
// host turns board tilt into synthetic arrow keys, and it only dispatches
// ArrowUp/ArrowDown when `forwardVerticalAxis` is ticked on the scene -- which
// is OFF by default and fails silently. In SKATE stance, carve arrives on
// exactly those keys. So a build shipped with that box unticked does not steer
// at all: not badly, not partially, not at all. Braking is unaffected, since it
// lands on the lateral keys the host always sends.
//
// Everything downstream of readInput() is expressed in PLAYER terms -- carve,
// tuck, brake -- and never sees the board's axes at all, which is what makes
// this a change to one mapping rather than a change to the controller.
export const STANCE_SKATE = 'skate';
export const STANCE_SQUARE = 'square';
export const STANCE_MODES = [STANCE_SKATE, STANCE_SQUARE];

// FORWARD LEAN IS OFF. Amit, on the board: "I cannot do this move." Leaning
// forward on a balance board is genuinely hard -- it is the same ergonomic fact
// that put the whole core loop on the lateral axis in the first place -- and an
// input the player physically cannot produce is worse than no input, because
// everything built on it silently never happens.
//
// BACK is untouched: the brake still works, and it is the only thing on this
// axis now. Analog mode is covered too, further down, since a forward LEAN
// would otherwise still produce a tuck where the key does not.
//
// A flag rather than deletion. The tuck pose and every constant behind it stay
// exactly as they are -- Amit: "the animation is not disabled for now" -- so
// re-enabling this is one boolean if the hardware or the ergonomics change.
const FORWARD_INPUT = false;

/**
 * THE BRAKE IS OFF. Amit: "disable the input for the player to brake -- no need
 * for it."
 *
 * This is the whole fore/aft axis gone, since FORWARD_INPUT already disabled the
 * other half of it: steering is now purely lateral, which is also the axis the
 * board is comfortable on (leaning forward and back on a balance board is hard
 * and imprecise, sideways is not).
 *
 * Disabled HERE, at the one place the axis is read, rather than at the call
 * sites. Everything downstream -- the brake drag, the tail load, the deck pitch,
 * the tail sparks, the pose -- keeps working off a brake value that is simply
 * always zero, so nothing needs to learn that the input is gone and turning it
 * back on is one line. The alternative, deleting the consumers, throws away a
 * working feature to disable it.
 */
const BRAKE_INPUT = false;

const keys = new Set();
// A trick can still be fired programmatically (the lab's auto-trick, and the
// 'T' key) even though the manual pop input is gone -- see forcePop.
let popEdge = false;
let steerMode = STEER_REGULAR;
let stance = STANCE_SKATE;
// Board zero. A rider isn't necessarily standing level when the scene loads, so
// analog mode subtracts a captured centre rather than trusting raw zero.
let centre = { x: 0, y: 0 };
// When the brake input first went past its threshold, or 0 if it is not held.
// See BRAKE_HOLD_MS: an accidental weight shift is brief, a decision is not.
let brakeSince = 0;

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

export function setStance(next) {
  if (STANCE_MODES.includes(next)) stance = next;
}
export function getStance() {
  return stance;
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
// ============================================================================
// FOR WHOEVER WIRES THIS INTO THE GOBALANCE SCENE -- the brake's threshold
// ============================================================================
//
// THE PROBLEM. On the physical board a rider's weight drifts onto the brake axis
// without them intending it. You shift to stay balanced, not to brake, and the
// board cannot tell the difference. Reported from the board: "you unintentionally
// press on it because of your body weight."
//
// WHAT THIS FILE ALREADY DOES. Two game-side defences, both above:
//   * BRAKE_DEADZONE -- the brake ignores anything under ~0.42 of full tilt,
//     several times the steering deadzone. ANALOG MODE ONLY: it needs the tilt
//     magnitude, which only window.__gbSensor provides.
//   * BRAKE_HOLD_MS -- the input must be sustained ~200 ms before any braking is
//     reported at all. This one works in BOTH modes, because it needs no angle,
//     only time, and a weight shift is brief where a decision is not.
//
// WHAT THE GAME CANNOT DO, AND WHY THIS NOTE EXISTS. In 'regular' (digital)
// mode the HOST decides when a tilt becomes a key and sends ArrowUp/ArrowDown;
// the game is handed a keystroke and never learns how far the board leaned. So
// the game can delay that key, but it can never raise the angle that produced
// it. If the brake still fires accidentally on the board, the fix is host-side:
//
//   the vertical axis needs a HIGHER tilt threshold than the lateral one.
//
// Steering should stay light -- carving is the whole game and wants to be
// sensitive. It is specifically the brake axis that should demand a deliberate,
// larger lean before it triggers, and in SKATE stance that axis is the board's
// LATERAL one (see the stance note above), not its fore/aft one. Whoever tunes
// the host's thresholds needs to know which physical axis they are raising,
// because the stance changes the answer.
//
// The gb:sensitivity message the settings panel sends tunes the host's
// thresholds today, but it is a single dial for both axes -- separating them is
// the change being asked for here.
// ============================================================================

export function readInput() {
  // Raw BOARD axes. +x is the board's right, +y is the board's forward. Nothing
  // outside this function should ever see them.
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
  // them), and on a desktop they're the keyboard. Keyed on e.code, which is what
  // the host's synthetic events set.
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y -= 1;

  // --- board axes -> PLAYER axes ---------------------------------------------
  //
  // SKATE stance is the board rotated a quarter turn under the rider, so the
  // mapping is a rotation and nothing more:
  //
  //     board right (+x)  ->  player forward
  //     board forward (+y) ->  player right
  //
  // which inverts to lateral = y, fore = -x. SQUARE stance is the identity, and
  // is what every measurement in this game was originally taken against.
  //
  // Doing the rotation HERE, on two numbers, is the whole point: the pendulum,
  // the brake, the poses and every constant behind them keep working in player
  // terms and never learn that a stance exists.
  const lateral = stance === STANCE_SKATE ? y : x;
  const fore = stance === STANCE_SKATE ? -x : y;

  const carve = applyDeadzone(Math.max(-1, Math.min(1, lateral)));
  let ay = applyDeadzone(Math.max(-1, Math.min(1, fore)));
  // The forward lean is disabled (see FORWARD_INPUT). Applied to the PLAYER's
  // forward, not the board's, so it stays the same physical move whichever way
  // the rider is standing -- and the brake, which is the other half of this
  // axis, keeps working in both stances.
  if (!FORWARD_INPUT && ay > 0) ay = 0;

  // --- the brake, which has to be meant -------------------------------------
  //
  // Its own deadzone, well above the steering one, and then a hold: the input
  // must be sustained for BRAKE_HOLD_MS before ANY braking is reported. On the
  // board, a rider's weight wanders onto this axis constantly without them
  // meaning it; time is what separates a shift from a decision, and it is the
  // only thing that works in digital mode, where the game is handed a key and
  // never sees how far the board actually tilted.
  //
  // Rescaled after the gate so the brake still starts from zero at the moment it
  // engages -- otherwise crossing the threshold would snap straight to 42%.
  const rawBrake = BRAKE_INPUT ? Math.max(0, -ay) : 0;
  let brake = 0;
  if (rawBrake > BRAKE_DEADZONE) {
    const now = performance.now();
    if (!brakeSince) brakeSince = now;
    if (now - brakeSince >= BRAKE_HOLD_MS) {
      brake = Math.min(1, (rawBrake - BRAKE_DEADZONE) / (1 - BRAKE_DEADZONE));
    }
  } else {
    brakeSince = 0;
  }

  const pop = popEdge;
  popEdge = false;
  return { carve, tuck: Math.max(0, ay), brake, pop };
}

/** Lets the lobby fire a trick programmatically (auto-trick toggle). */
export function forcePop() {
  popEdge = true;
}
