// Single input funnel (build doc §4). This game is Analog mode
// (`forwardSteeringKeys = false` on the GoBalance WebGameController) --
// continuous proportional lean, x-axis only, no attack button of any kind.
// The nunchaku swing is never a separate input; it is purely a reaction to
// positional overlap, handled in entities/player.js.
//
// __gbSensor is the authority whenever present -- read directly as a
// continuous value (no press/release hysteresis; that pattern belongs to
// games translating analog tilt into discrete digital actions, not to a
// genuinely analog game like this one). Arrow keys are dev-only fallback,
// additive, and only apply when __gbSensor is absent.
//
// y is read from nowhere -- this is a strict single-axis game (§4, §11): do
// not wire ArrowUp/ArrowDown or any y-derived behavior to gameplay.

let keyLeft = false;
let keyRight = false;

// SENSITIVITY -- driven through the HOST (2026-09-01, revised).
// GOBALANCE_APP_INTEGRATION.md and NovaVanguard's settingsPanel.js are explicit:
// `GoBalance.setSensitivity(0..100)` (higher = reacts to a smaller lean) is
// applied on the Unity side to the board reading ITSELF, before __gbSensor
// ever reaches the page -- so the game must NOT also scale the sensor value,
// or the two compound and the dial stops meaning what it says.
//
// An earlier build of this game DID scale game-side, because it was tuned
// against the SDK SANDBOX (gobalance_bobo_sdk), where the legacy
// gb:sensitivity bridge is a no-op in analog mode. The PRODUCT SDK honors
// setSensitivity, so on the product that game-side gain would have been a
// double-apply. We now drive the host and read the sensor raw. The legacy
// gb:sensitivity Unity bridge is still called as a fallback (harmless where
// unsupported). The host does NOT remember the choice, so we persist it and
// re-apply on boot (see applySensitivityToHost, called from core/main.js).
const SENSITIVITY_STORAGE_KEY = 'tss:sensitivity';
const SENSITIVITY_DEFAULT = 50;

let sensitivityPercent = SENSITIVITY_DEFAULT;
try {
  const saved = window.localStorage.getItem(SENSITIVITY_STORAGE_KEY);
  if (saved != null) {
    const n = Number(saved);
    if (Number.isFinite(n) && n >= 0 && n <= 100) sensitivityPercent = n;
  }
} catch (err) {
  // localStorage can throw outright in a restricted WebView -- keep the
  // in-memory default, same guarded-both-directions pattern as
  // systems/audio.js's persisted SFX/music preference.
}

// Push the current value to the host: the real SDK call when present, else the
// legacy Unity bridge. Both are no-ops outside the app / on a plain dev URL.
function applyToHost(percent) {
  const gb = typeof window !== 'undefined' ? window.GoBalance : null;
  if (gb && typeof gb.setSensitivity === 'function') {
    gb.setSensitivity(percent);
  } else if (typeof window !== 'undefined' && window.Unity) {
    window.Unity.call('gb:sensitivity:' + percent);
  }
}

export function getSensitivity() {
  return sensitivityPercent;
}

export function setSensitivity(percent) {
  sensitivityPercent = Math.max(0, Math.min(100, percent));
  try {
    window.localStorage.setItem(SENSITIVITY_STORAGE_KEY, String(sensitivityPercent));
  } catch (err) {
    // Non-fatal: the preference just won't survive a reload.
  }
  applyToHost(sensitivityPercent);
}

// Re-apply the persisted value to the host once at startup -- the host does
// not remember it across launches (GOBALANCE_APP_INTEGRATION.md). Called from
// core/main.js boot, after the SDK has had a chance to install.
export function applySensitivityToHost() {
  applyToHost(sensitivityPercent);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') keyLeft = true;
  else if (e.code === 'ArrowRight') keyRight = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') keyLeft = false;
  else if (e.code === 'ArrowRight') keyRight = false;
});

// Returns a continuous steering axis in roughly [-1, 1]: negative = left,
// positive = right. __gbSensor.x (real board tilt, or Editor keyboard proxy
// upstream of this page) wins whenever present; keyboard fallback is purely
// for testing this page outside the SDK/board. NO game-side sensitivity gain:
// the host has already scaled the board reading by the time we see it (see the
// SENSITIVITY note above).
export function getSteerAxis() {
  const sensor = window.__gbSensor;
  let raw;
  if (sensor) raw = sensor.x;
  else {
    raw = 0;
    if (keyLeft) raw -= 1;
    if (keyRight) raw += 1;
  }
  return Math.max(-1, Math.min(1, raw));
}
