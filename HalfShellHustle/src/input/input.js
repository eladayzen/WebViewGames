// Board / keyboard input, with two switchable steering modes -- see
// data/constants.js's STEERING_* block for what each mode is and why. Tuned
// live from ui/steeringPanel.js so the two can be compared on real hardware
// rather than guessed at.
//
// Keyed on e.code, not e.key: Unity's synthetic KeyboardEvents set `code`, not
// a layout-dependent `key` (GOBALANCE_SDK.md).
//
// updateSteering() must be called ONCE per frame, before the poll functions --
// it takes the single sensor sample the whole frame reasons about, and advances
// the hysteresis/edge state the polls then read.

import {
  LANE_X, STEERING_STEPPED, STEERING_ABSOLUTE, DEFAULT_STEERING_MODE,
  LANE_ZONE_THRESHOLD, LANE_ZONE_HYSTERESIS,
  JUMP_TILT_THRESHOLD, JUMP_TILT_HYSTERESIS,
} from '../data/constants.js';

const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up' };

const keys = { left: false, right: false, up: false };
let leftWasDown = false;
let rightWasDown = false;
let upWasDown = false;

window.addEventListener('keydown', (e) => {
  const action = KEY_MAP[e.code];
  if (action) keys[action] = true;
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.code];
  if (action) keys[action] = false;
});

// --- Live-tunable steering state. ui/steeringPanel.js owns the UI, this owns
// the values, so input logic has one home and the panel stays dumb. ---
const tuning = {
  mode: DEFAULT_STEERING_MODE,
  laneZone: LANE_ZONE_THRESHOLD,
  laneHysteresis: LANE_ZONE_HYSTERESIS,
  jumpTilt: JUMP_TILT_THRESHOLD,
};

// Board neutral. Absolute mode is FAR more sensitive to a drifted centre than
// stepped mode: there a bad centre only changes how far you lean for a gesture,
// but here it parks you permanently in the wrong lane. Handled game-side by
// subtracting a captured offset -- deliberately not via the SDK's own
// setFixCenter(), which would mean reaching into the shared Unity project for
// something we can do entirely on our side.
const center = { x: 0, y: 0 };

// Last committed lane zone, held across frames so the hysteresis below has
// something to be sticky about. Starts centred.
let laneZone = 1;
let jumpTiltHeld = false;
let jumpTiltWasHeld = false;

export function setSteeringMode(mode) { tuning.mode = mode; }
export function getSteeringMode() { return tuning.mode; }
export function setLaneZoneThreshold(v) { tuning.laneZone = v; }
export function setLaneZoneHysteresis(v) { tuning.laneHysteresis = v; }
export function setJumpTiltThreshold(v) { tuning.jumpTilt = v; }

// Reads the host's analog board value. WebGameController publishes it every
// pump (~60Hz) and -- confirmed against that source -- publishes it
// UNCONDITIONALLY, in digital mode too; only the synthetic key dispatch is
// gated on forwardSteeringKeys. So its presence is a reliable "am I inside the
// Unity WebView" test.
//
// Outside Unity there is no sensor, so held arrow keys stand in for one. That
// makes absolute mode fully testable in a plain browser, and it's a faithful
// simulation -- holding Left really does mean "standing on the left of the
// board". Strictly a FALLBACK: inside Unity the real sensor always wins, which
// is what stops a scene left in digital mode from applying its synthetic keys
// on top of the analog read.
function readTilt() {
  const sensor = window.__gbSensor;
  if (sensor) return { x: sensor.x - center.x, y: sensor.y - center.y };
  const vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return { x: vx, y: keys.up ? 1 : 0 };
}

// Captures the current raw tilt as the new neutral -- the fix for "I'm standing
// straight but the game thinks I'm in the left lane". Returns false in a
// browser, where there's no sensor to centre.
export function recenterBoard() {
  const sensor = window.__gbSensor;
  if (!sensor) return false;
  center.x = sensor.x;
  center.y = sensor.y;
  // Also drop any committed outer zone. Without this the hysteresis below
  // legitimately keeps holding the lane it was already in, so recentring while
  // leaned right could leave you still targeting the right lane despite having
  // just declared this position neutral -- which is the opposite of what
  // pressing "recentre" means. Re-evaluated from centre on the next frame.
  laneZone = 1;
  return true;
}

// Which lane the board is asking for, with hysteresis on both zone edges. The
// sticky part is load-bearing: without it a lean resting near a boundary
// oscillates between two lanes every frame, which in absolute mode means the
// character ping-pongs instead of just picking a lane.
function resolveLaneZone(x) {
  const lastLane = LANE_X.length - 1;
  const inner = Math.max(0, tuning.laneZone - tuning.laneHysteresis);
  // Already committed to an outer lane -- hold it until the lean comes back
  // well inside the boundary.
  if (laneZone === 0) return x < -inner ? 0 : 1;
  if (laneZone === lastLane) return x > inner ? lastLane : 1;
  // Currently centred -- needs the FULL threshold to commit outward.
  if (x < -tuning.laneZone) return 0;
  if (x > tuning.laneZone) return lastLane;
  return 1;
}

// Once per frame, before the polls below.
export function updateSteering() {
  if (tuning.mode !== STEERING_ABSOLUTE) {
    // Park the zone at centre so a later mode switch starts from a neutral
    // read rather than a stale one.
    laneZone = 1;
    jumpTiltHeld = false;
    return;
  }
  const tilt = readTilt();
  laneZone = resolveLaneZone(tilt.x);
  // Jump from tilt.y, with its own hysteresis, because analog mode means the
  // host never sends ArrowUp at all (see JUMP_TILT_THRESHOLD's note).
  const release = Math.max(0, tuning.jumpTilt - JUMP_TILT_HYSTERESIS);
  jumpTiltHeld = jumpTiltHeld ? tilt.y > release : tilt.y > tuning.jumpTilt;
}

// STEPPED mode only: edge-detected +/-1 lane step -- one press = one discrete
// step, no repeat while held. Returns 0 in absolute mode, where lane changes
// come from getLaneTarget() instead. That's the "ignore the keys entirely while
// reading the sensor" guarantee: a scene mistakenly left in digital mode can't
// apply its synthetic presses on top of the analog steering.
//
// Edge state is updated even when the mode makes the result moot, so switching
// modes mid-hold can't produce a phantom step from a stale `wasDown`.
export function pollLaneStep() {
  const left = keys.left;
  const right = keys.right;
  const freshLeft = left && !leftWasDown;
  const freshRight = right && !rightWasDown;
  leftWasDown = left;
  rightWasDown = right;

  if (tuning.mode !== STEERING_STEPPED) return 0;
  return (freshRight ? 1 : 0) - (freshLeft ? 1 : 0);
}

// ABSOLUTE mode only: the lane the board is currently standing over, or null
// when the mode doesn't apply. A TARGET, not a step -- core/main.js walks toward
// it one lane at a time, so the existing per-lane platform-block check still
// gets a say on every lane crossed. That's what makes a two-lane sweep behave
// sanely when something is parked in the middle lane.
export function getLaneTarget() {
  return tuning.mode === STEERING_ABSOLUTE ? laneZone : null;
}

// Edge-detected one-shot jump press -- from ArrowUp in stepped mode, from
// tilt.y in absolute mode (see updateSteering). The "no double-jump" guard
// lives in entities/player.js's startPlayerJump; this only reports that a fresh
// press happened.
export function pollJumpPress() {
  const up = keys.up;
  const freshKey = up && !upWasDown;
  upWasDown = up;

  if (tuning.mode === STEERING_ABSOLUTE) {
    const pressed = jumpTiltHeld && !jumpTiltWasHeld;
    jumpTiltWasHeld = jumpTiltHeld;
    return pressed;
  }
  return freshKey;
}
