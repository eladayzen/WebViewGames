// Board sensitivity ("touchiness") control -- GoBalance SDK's per-game
// steering-hysteresis tuning, driven from in-game rather than only from the
// Unity Inspector. See GOBALANCE_SDK.md's "Board sensitivity" section for
// the host side of this contract.
//
// The host maps our 0..100 into its own tilt thresholds:
//   pressThreshold   = lerp(0.60, 0.15, pct/100)   // higher pct = smaller lean needed
//   releaseThreshold = pressThreshold * 0.6        // hysteresis gap stays proportional
//
// Only meaningful in DIGITAL mode (forwardSteeringKeys = true), which is
// this game's mode (src/input/input.js) -- the thresholds exist purely to
// turn analog board tilt into on/off arrow-key presses. A no-op in a normal
// browser, where window.Unity is undefined.
//
// WHY THIS EXISTS AS A LIVE CONTROL, not just an Inspector value: the board
// is the only way to know what "too twitchy" feels like, and the tester
// can't edit a Unity field mid-run. Adjusting while actually playing is the
// point, so this deliberately does NOT pause the game.
//
// CAVEAT worth knowing before reaching for this as a fix: the host keeps ONE
// threshold pair for BOTH axes. This game puts lane changes on left/right
// and JUMP on ArrowUp (forward lean), so making the jump more forgiving
// necessarily makes lane changes twitchier too -- there is no per-axis knob
// to separate them.

const STORAGE_KEY = 'hsh:boardSensitivity';

// 55, not 50, on purpose: it maps to pressThreshold ~= 0.3525, which is
// within a rounding error of the SDK's own stock 0.35 default. So a fresh
// install with this feature added feels EXACTLY like it did before -- the
// control changes nothing until someone deliberately moves it.
const DEFAULT_PERCENT = 55;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const STEP_PERCENT = 5;

let percent = DEFAULT_PERCENT;
let valueEl = null;

// localStorage can throw in a restricted WebView (private mode, disabled
// storage), and a settings nicety must never take the game down with it --
// so both directions are guarded and simply fall back to the default.
function loadStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PERCENT;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return DEFAULT_PERCENT;
    return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, parsed));
  } catch {
    return DEFAULT_PERCENT;
  }
}

function store(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Non-fatal: the setting just won't survive a reload.
  }
}

// Push the current value to the Unity host. MUST also be called on load, not
// only on change: pressThreshold is a SCENE-serialized field on the host, so
// it resets to the Inspector default every time the scene loads -- a stored
// preference that's never re-sent silently does nothing.
function pushToHost() {
  if (window.Unity) window.Unity.call(`gb:sensitivity:${percent}`);
}

function render() {
  if (valueEl) valueEl.textContent = `${percent}`;
}

function setPercent(next) {
  const clamped = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, next));
  if (clamped === percent) return;
  percent = clamped;
  store(percent);
  pushToHost();
  render();
}

// Wires the DOM control (index.html's #sensitivity-*) and immediately
// applies the stored value. Safe to call once at boot; returns nothing the
// caller needs to hold onto.
export function initSensitivityControl() {
  percent = loadStored();

  const button = document.getElementById('sensitivity-button');
  const panel = document.getElementById('sensitivity-panel');
  const down = document.getElementById('sensitivity-down');
  const up = document.getElementById('sensitivity-up');
  valueEl = document.getElementById('sensitivity-value');

  render();
  // Apply on boot regardless of whether the UI is present -- the stored
  // preference matters even if the panel is never opened.
  pushToHost();

  if (!button || !panel) return;

  button.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });
  if (down) down.addEventListener('click', () => setPercent(percent - STEP_PERCENT));
  if (up) up.addEventListener('click', () => setPercent(percent + STEP_PERCENT));
}
