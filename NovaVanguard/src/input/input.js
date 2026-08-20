// Analog input (§4). Produces {carve, nudge}, both in [-1, 1].
//
// THIS GAME IS ANALOG-MODE ONLY. The Unity host must run this scene with
// `forwardSteeringKeys = false` on its WebGameController -- see
// GOBALANCE_SDK.md. In that mode Unity dispatches no synthetic arrow keys and
// publishes the raw tilt on window.__gbSensor every pump (~60Hz).
//
// The hazard GOBALANCE_SDK.md calls out: __gbSensor is published in BOTH
// modes, so a game that reads it while the host is ALSO forwarding synthetic
// keys double-applies the tilt and over-steers -- and nothing on the Unity
// side prevents that. §4 restates it: "Never also listen for the host's
// synthetic arrow keys while reading the analog vector."
//
// The defence here is structural rather than a comment: the moment
// window.__gbSensor is seen even once, the keyboard fallback is permanently
// suppressed for the session. On a desktop dev machine __gbSensor never
// appears and the keyboard works; inside the Unity WebView the keyboard path
// is dead no matter how the component happens to be configured, so a
// mis-ticked checkbox degrades to "keys ignored" instead of "steering
// doubled". `hostDetected` is surfaced in the debug panel so the state is
// visible rather than silent.

import { INPUT } from '../data/tuning.js';

const keys = new Set();
let hostDetected = false;
// Keyboard axes ramp rather than snap, so desktop feel is a little closer to
// a lean. Still a dev convenience, never a second input path.
let kx = 0;
let ky = 0;

/** Signed deadzone with rescale: just past the deadzone reads as ~0, not as a
 *  jump to the deadzone value. Without the rescale the craft would lurch the
 *  instant the player crossed the threshold. */
function deadzone(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  const scaled = (a - dz) / (1 - dz);
  return Math.sign(v) * Math.min(1, scaled);
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    // e.code, not e.key -- GOBALANCE_SDK.md's contract, and the right thing
    // for a physical-layout-independent binding regardless.
    keys.add(e.code);
    if (
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'Space'
    ) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

/** True once the Unity host has been seen publishing tilt. */
export function isHostDetected() {
  return hostDetected;
}

export function isKeyDown(code) {
  return keys.has(code);
}

/**
 * Sample the input vector for one fixed step.
 * Returns { carve, nudge, rawX, rawY, source }.
 */
export function sampleInput(dt) {
  let rawX = 0;
  let rawY = 0;
  let source = 'keyboard';

  // GoBalance SDK: the Unity host publishes the balance board's raw analog
  // tilt here every frame (~60Hz) whenever this game's WebGameController has
  // forwardSteeringKeys off. A no-op in a normal browser, where
  // window.__gbSensor is simply undefined.
  const sensor = window.__gbSensor;
  if (sensor && typeof sensor.x === 'number') {
    hostDetected = true;
    // SIGNS APPLIED HERE, AND ONLY HERE (INPUT.sensorXSign / sensorYSign).
    //
    // Amit, on the real board: "right and left are working properly, but
    // forward and backward are flipped." The board reports lean-forward as
    // positive y and screen space has positive y pointing down, so forward came
    // out as backward. Correcting it on the SENSOR READ rather than on `nudge`,
    // on `verticalMax`, or in /player is the whole point: the keyboard fallback
    // below is NOT broken -- ArrowDown correctly means "move down the screen" --
    // and any fix further downstream would invert that too, trading a board bug
    // for a desktop one.
    rawX += sensor.x * INPUT.sensorXSign;
    rawY += (sensor.y || 0) * INPUT.sensorYSign;
    source = 'board';
  }

  if (!hostDetected) {
    // Desktop dev fallback only. Writes into the SAME internal vector the
    // sensor read feeds (§4) -- additively, so it composes rather than
    // forking the control path.
    const tx =
      (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
      (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const ty =
      (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) -
      (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    const rate = dt / Math.max(0.0001, INPUT.keyboardRampS);
    kx += Math.sign(tx - kx) * Math.min(Math.abs(tx - kx), rate);
    ky += Math.sign(ty - ky) * Math.min(Math.abs(ty - ky), rate);
    rawX += kx;
    rawY += ky;
  } else {
    kx = 0;
    ky = 0;
  }

  rawX = Math.max(-1, Math.min(1, rawX));
  rawY = Math.max(-1, Math.min(1, rawY));

  return {
    // Lateral: light deadzone, fast, precise. This is ~100% of the reflexive
    // load (§0.5).
    carve: deadzone(rawX, INPUT.deadzoneX),
    // Vertical: heavy deadzone, slow. Deliberately hard to trigger by
    // accident while leaning hard sideways (§4). Do not narrow this.
    nudge: deadzone(rawY, INPUT.deadzoneY),
    rawX,
    rawY,
    source,
  };
}
