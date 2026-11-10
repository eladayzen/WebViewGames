// THE ONE INPUT SCALAR (§0.2, §4).
//
// This module is the only place in the codebase that touches a tilt vector, and
// it produces exactly ONE number: `lean`, in [-1, 1], where NEGATIVE IS A LEAN
// TOWARD THE PLAYER'S LEFT AND MUST CLIMB THE FACE.
//
// THE FORWARD/BACK COMPONENT IS NEVER READ. Not for a nudge, not for a
// secondary action, not for a menu, not for a debug shortcut, not "just in
// case". `window.__gbSensor.y` does not appear anywhere in this file or in any
// other file in this game, and tools/constraint-scan.js fails the build if it
// ever does (§9.5 rule 5). Forward/back is GoBalance's expensive axis and
// building a core loop on it is disqualifying for an exertion product.
//
// MODE: ANALOG (forwardSteeringKeys = false). Tell the project owner this at
// Phase 2. The host publishes `window.__gbSensor` every pump in BOTH modes, so
// reading it while synthetic arrow keys are also being dispatched would
// double-apply the tilt and make the surfer over-steer (GOBALANCE_SDK.md).
// This game therefore never listens for the host's arrow keys -- see the
// keyboard fallback note below.

import { LEAN_DEADZONE, LEAN_KEY_RAMP_SEC } from '../data/tuning.js';

/** smoothstep, so small leans are gentle and the full range still reaches 1. */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export class Input {
  constructor() {
    this.lean = 0;

    // Desktop dev fallback only. It writes into the SAME internal scalar, so it
    // is a convenience, not a second input path (§4). It is DISABLED OUTRIGHT
    // when the Unity host is present: on-device there is then no keydown
    // handler anywhere in this game that can affect game state, which is what
    // §9.5 rule 6 actually asks for. It also means the host's synthetic arrow
    // keys -- which analog mode does not dispatch, but which a mis-set
    // WebGameController could -- can never reach the height model.
    this.keyboardEnabled = !window.Unity;
    this._keyLeft = false;
    this._keyRight = false;
    this._keyLean = 0;

    this._onKeyDown = (e) => {
      if (!this.keyboardEnabled) return;
      if (e.code === 'ArrowLeft') this._keyLeft = true;
      else if (e.code === 'ArrowRight') this._keyRight = true;
    };
    this._onKeyUp = (e) => {
      if (!this.keyboardEnabled) return;
      if (e.code === 'ArrowLeft') this._keyLeft = false;
      else if (e.code === 'ArrowRight') this._keyRight = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Sample the board once per fixed step. Returns the signed lean scalar.
   *
   * Reads ONLY the lateral component. There is deliberately no second return
   * value and no vector here for a caller to reach into.
   */
  sample(dt) {
    let raw = 0;

    const sensor = window.__gbSensor;
    if (sensor) {
      // LATERAL ONLY. sensor.y is the forward/back axis and is not read.
      raw = sensor.x;
    }

    // Keyboard ramps toward +/-1 rather than stepping, so desktop testing
    // approximates a lean. Still expect it to overstate how easy fine height
    // control is -- every number in tuning.js is a starting value to be
    // re-validated on-device (§4, §10 MVP-20).
    if (this.keyboardEnabled) {
      const dir = (this._keyRight ? 1 : 0) - (this._keyLeft ? 1 : 0);
      const step = dt / LEAN_KEY_RAMP_SEC;
      if (dir === 0) {
        this._keyLean += Math.sign(-this._keyLean) * Math.min(Math.abs(this._keyLean), step);
      } else {
        this._keyLean = Math.max(-1, Math.min(1, this._keyLean + dir * step));
      }
      if (Math.abs(this._keyLean) > Math.abs(raw)) raw = this._keyLean;
    }

    this.lean = shapeLean(raw);
    return this.lean;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

/**
 * Deadzone then smoothstep, preserving sign. Exported so the constraints
 * validator and the instrumentation panel can reason about the same curve.
 */
export function shapeLean(raw) {
  const v = Math.max(-1, Math.min(1, raw || 0));
  const mag = Math.abs(v);
  if (mag <= LEAN_DEADZONE) return 0;
  const t = (mag - LEAN_DEADZONE) / (1 - LEAN_DEADZONE);
  return Math.sign(v) * smoothstep(Math.min(1, t));
}
