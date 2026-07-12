// Single funnel for all input sources: keyboard, touch-drag, and (later) gamepad
// all resolve to handleAction(action, active), keeping listeners out of game logic.

const state = {
  left: false,
  right: false,
  up: false,
  down: false,
  pointerActive: false,
  pointerX: 0,
  pointerY: 0,
};

export function handleAction(action, active) {
  if (action in state) state[action] = active;
}

const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};

window.addEventListener('keydown', (e) => {
  const action = KEY_MAP[e.code];
  if (action) handleAction(action, true);
});

window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.code];
  if (action) handleAction(action, false);
});

let dragStart = null;

export function initPointerInput(target) {
  target.addEventListener('pointerdown', (e) => {
    dragStart = { x: e.clientX, y: e.clientY };
    state.pointerActive = true;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    state.pointerX = (e.clientX - dragStart.x) / 80;
    state.pointerY = (e.clientY - dragStart.y) / 80;
  });
  window.addEventListener('pointerup', () => {
    dragStart = null;
    state.pointerActive = false;
    state.pointerX = 0;
    state.pointerY = 0;
  });
}

export function getMoveVector() {
  let x = 0;
  let y = 0;
  if (state.left) x -= 1;
  if (state.right) x += 1;
  if (state.up) y += 1;
  if (state.down) y -= 1;
  if (state.pointerActive) {
    x += state.pointerX;
    y -= state.pointerY;
  }
  // GoBalance SDK: the Unity host publishes the balance board's raw analog
  // tilt here every frame (~60Hz) whenever the game's WebGameController has
  // forwardSteeringKeys off (this game reads the analog value directly
  // instead of via synthetic arrow-key events — see GOBALANCE_SDK.md).
  // Purely additive, so it composes cleanly with keyboard/pointer, and is a
  // no-op in a normal browser where window.__gbSensor is simply undefined.
  const sensor = window.__gbSensor;
  if (sensor) {
    x += sensor.x;
    y += sensor.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
