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

// SENSITIVITY (2026-08-19, settings panel) -- deliberately NOT the SDK's
// gb:sensitivity Unity bridge. That bridge retunes the HOST's key press/
// release thresholds, which only exist for `forwardSteeringKeys = true`
// (digital) games; per GOBALANCE_SDK.md it does nothing at all in analog
// mode, and HalfShellHustle's own steering panel marks its equivalent row
// "stepped mode only -- tunes the HOST thresholds" for exactly this reason.
// This game reads the raw sensor itself, so sensitivity has to be a
// GAME-SIDE gain on that raw value instead.
//
// 0..100 (same convention as the SDK's own dial, for a familiar range) maps
// geometrically -- not linearly -- onto a gain multiplier so that 50 (the
// default) lands on EXACTLY 1.0x: gain = GAIN_MIN * (GAIN_MAX/GAIN_MIN)^(pct/100).
// At pct=50 that's GAIN_MIN * sqrt(GAIN_MAX/GAIN_MIN) = sqrt(GAIN_MIN*GAIN_MAX)
// = sqrt(0.5*2.0) = 1.0 exactly -- so a fresh install (or anyone who never
// touches the setting) feels identical to how this game already shipped,
// and the dial only ever moves the feel once someone deliberately drags it.
const SENSITIVITY_STORAGE_KEY = 'tss:sensitivity';
const SENSITIVITY_DEFAULT = 50;
const SENSITIVITY_GAIN_MIN = 0.5; // pct=0: needs a much bigger lean for full speed
const SENSITIVITY_GAIN_MAX = 2.0; // pct=100: a small lean already hits full speed

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
}

function sensitivityGain() {
  const ratio = SENSITIVITY_GAIN_MAX / SENSITIVITY_GAIN_MIN;
  return SENSITIVITY_GAIN_MIN * Math.pow(ratio, sensitivityPercent / 100);
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
// for testing this page outside the SDK/board. The SENSITIVITY gain above
// applies to both paths uniformly, so the keyboard fallback correctly
// previews how the setting will feel on the real board.
export function getSteerAxis() {
  const sensor = window.__gbSensor;
  let raw;
  if (sensor) raw = sensor.x;
  else {
    raw = 0;
    if (keyLeft) raw -= 1;
    if (keyRight) raw += 1;
  }
  return Math.max(-1, Math.min(1, raw * sensitivityGain()));
}
