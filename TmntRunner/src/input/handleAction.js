// Single input funnel (GDD §3): every input source -- keyboard, swipe/tap,
// and later any Bluetooth-gamepad-bridged input from Unity -- calls
// handleAction(action) rather than gameplay code touching raw DOM events.
// action is one of 'LANE_LEFT' | 'LANE_RIGHT' | 'JUMP'.

const listeners = new Set();

export function onAction(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function handleAction(action) {
  for (const callback of listeners) callback(action);
}

// Keyed on e.code, not e.key: Unity's WebGameController (digital/
// forwardSteeringKeys mode) dispatches synthetic KeyboardEvents this way,
// and e.code is the reliable field for those.
const KEY_MAP = {
  ArrowLeft: 'LANE_LEFT',
  ArrowRight: 'LANE_RIGHT',
  ArrowUp: 'JUMP',
  Space: 'JUMP',
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return; // one discrete action per press, ignore key-repeat
  const action = KEY_MAP[e.code];
  if (action) handleAction(action);
});

const SWIPE_THRESHOLD_PX = 40;

export function initSwipeInput(target) {
  let startX = null;
  let startY = null;

  target.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
  });

  target.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    startY = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) {
      handleAction('JUMP'); // tap = jump, per GDD §3
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      handleAction(dx > 0 ? 'LANE_RIGHT' : 'LANE_LEFT');
    } else if (dy < 0) {
      handleAction('JUMP');
    }
  });
}
