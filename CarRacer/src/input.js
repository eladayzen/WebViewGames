// Single input funnel: every input source (keyboard, pointer/swipe, on-screen
// buttons, and later a Unity Bluetooth-gamepad bridge) calls handleAction()
// rather than the game reading raw events directly. All of them just set
// booleans on one `state` object -- what differs is how gameplay code reads
// it, and that's a property of the GAME, not the input source:
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

const KEY_MAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};

const state = { left: false, right: false };
let leftWasDown = false;
let rightWasDown = false;
let pendingSteps = 0;

export function handleAction(action, active) {
  if (action in state) state[action] = active;
}

window.addEventListener('keydown', (e) => {
  const action = KEY_MAP[e.key];
  if (action) handleAction(action, true);
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.key];
  if (action) handleAction(action, false);
});

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
