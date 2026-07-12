// Single input funnel: every input source (keyboard, pointer/swipe, on-screen
// buttons, and the GoBalance SDK's balance board -- see GOBALANCE_SDK.md)
// calls handleAction() rather than the game reading raw events directly.
// All of them just set booleans on one `state` object -- what differs is how
// gameplay code reads it, and that's a property of the GAME, not the input
// source:
//
//   pollLaneStep()  -- edge-detected +-1 step, for "runner" controllers
//                       (one press/tap = one discrete lane change).
//   getSteerHold()  -- level-triggered -1/0/+1, for "soft" controllers
//                       (continuous movement while the input is held).
//
// A game picks whichever primitive matches its control scheme; both are
// always available off the same state, so switching (or offering both, as
// this project does for comparison) never requires touching input sources.

const SWIPE_THRESHOLD_PX = 50;

// Keyed on e.code, not e.key: Unity's WebGameController (forwardSteeringKeys
// mode) dispatches synthetic KeyboardEvents for the balance board's tilt,
// and e.code is the reliable field for those (see GOBALANCE_SDK.md).
const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const state = { left: false, right: false };
let leftWasDown = false;
let rightWasDown = false;
let pendingSteps = 0;

export function handleAction(action, active) {
  if (action in state) state[action] = active;
}

window.addEventListener('keydown', (e) => {
  const action = KEY_MAP[e.code];
  if (action) handleAction(action, true);
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.code];
  if (action) handleAction(action, false);
});

// GoBalance SDK analog mode (forwardSteeringKeys = false): the Unity host
// publishes the board's raw tilt as window.__gbSensor = {x, y} every frame.
// Routed through the same handleAction() funnel as a virtual key -- with
// the same press/release hysteresis Unity itself uses for its own synthetic
// key mode, for consistency -- so pollLaneStep()/getSteerHold() both pick it
// up for free with no separate analog code path. No-op in a normal browser
// (window.__gbSensor is simply undefined). Call once per frame.
const SENSOR_PRESS = 0.35;
const SENSOR_RELEASE = 0.2;
let sensorLeftHeld = false;
let sensorRightHeld = false;

export function pollSensorInput() {
  const sensor = window.__gbSensor;
  if (!sensor) return;

  if (!sensorLeftHeld && sensor.x < -SENSOR_PRESS) {
    sensorLeftHeld = true;
    handleAction('left', true);
  } else if (sensorLeftHeld && sensor.x > -SENSOR_RELEASE) {
    sensorLeftHeld = false;
    handleAction('left', false);
  }

  if (!sensorRightHeld && sensor.x > SENSOR_PRESS) {
    sensorRightHeld = true;
    handleAction('right', true);
  } else if (sensorRightHeld && sensor.x < SENSOR_RELEASE) {
    sensorRightHeld = false;
    handleAction('right', false);
  }
}

export function initPointerInput(target) {
  let downX = null;
  let dragBaseX = null;
  let holdAction = null; // 'left' | 'right' | null -- which side is currently held

  function sideAt(clientX) {
    const rect = target.getBoundingClientRect();
    return clientX - rect.left < rect.width / 2 ? 'left' : 'right';
  }
  function setHold(action) {
    if (holdAction === action) return;
    if (holdAction) handleAction(holdAction, false);
    holdAction = action;
    if (holdAction) handleAction(holdAction, true);
  }

  target.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    dragBaseX = e.clientX;
    setHold(sideAt(e.clientX));
  });
  target.addEventListener('pointermove', (e) => {
    if (downX === null) return;
    setHold(sideAt(e.clientX));
    const dx = e.clientX - dragBaseX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
      pendingSteps += dx > 0 ? 1 : -1;
      dragBaseX = e.clientX;
    }
  });
  const endDrag = (e) => {
    if (downX !== null && dragBaseX === downX) {
      pendingSteps += sideAt(e.clientX) === 'left' ? -1 : 1;
    }
    downX = null;
    dragBaseX = null;
    setHold(null);
  };
  target.addEventListener('pointerup', endDrag);
  target.addEventListener('pointercancel', () => {
    downX = null;
    dragBaseX = null;
    setHold(null);
  });
}

// Wires a pair of persistent on-screen buttons (rather than tap/swipe zones
// covering the whole play area) into the same funnel -- useful for a soft
// controller, where the player needs to hold a fixed target reliably.
export function initButtonInput(leftEl, rightEl) {
  function wire(el, action) {
    const start = (e) => { e.preventDefault(); handleAction(action, true); };
    const end = () => handleAction(action, false);
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  }
  wire(leftEl, 'left');
  wire(rightEl, 'right');
}

export function pollLaneStep() {
  let step = 0;
  if (state.left && !leftWasDown) step -= 1;
  if (state.right && !rightWasDown) step += 1;
  leftWasDown = state.left;
  rightWasDown = state.right;

  if (pendingSteps > 0) {
    step += 1;
    pendingSteps -= 1;
  } else if (pendingSteps < 0) {
    step -= 1;
    pendingSteps += 1;
  }
  return step;
}

export function getSteerHold() {
  if (state.left && state.right) return 0;
  if (state.left) return -1;
  if (state.right) return 1;
  return 0;
}
