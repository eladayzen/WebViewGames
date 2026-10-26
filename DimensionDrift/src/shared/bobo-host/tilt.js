// The BoBo sensor→control pipeline, port #2 (port #1 is bobo_play's lib/tilt/,
// the original is GoBalance's AccelManagerNew.getFullSensorAngleVector).
//
// This lives in the game, not the host, because `control` is a *ratio* — lean
// angle over maxAngleDeg — so any host that smooths or clamps differently
// silently rescales every threshold in every game it hosts. See BRIDGE.md §5.
//
// Per sample: adaptive gravity-sanity gate (hold last while |a| deviates from
// its own baseline) → asin decode in degrees → neutral-relative (angle domain)
// → radial max-angle clamp → /maxAngle → V2 axis swap → hard 0.04 dead zone →
// radial gamma → rate-independent EMA (τ ≈ 0.33 s) → control.
//
// Behavioural parity with the Dart port is asserted by fixtures/tilt-golden.json;
// change nothing here without regenerating and re-running both suites.

const RAD2DEG = 180 / Math.PI;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Decode a gravity vector to the SDK's pre-swap angles, in degrees.
 *
 *   ax = +asin(gy/‖g‖), ay = −asin(gx/‖g‖)
 *
 * Self-normalising by the measured ‖g‖, so raw counts and g units decode
 * identically and the sensor's calibration scale never enters the result. The
 * asin argument is clamped because ‖g‖ is computed in floating point and
 * gy/‖g‖ can land a few ulp outside [-1,1] for a pure single-axis reading,
 * which would return NaN and poison the EMA forever.
 */
export function anglesFromGravity(gx, gy, gz) {
  const norm = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (norm < 1e-9) return { ax: 0, ay: 0 };
  return {
    ax: Math.asin(clamp(gy / norm, -1, 1)) * RAD2DEG,
    ay: -Math.asin(clamp(gx / norm, -1, 1)) * RAD2DEG,
  };
}

export class TiltPipeline {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxAngleDeg] Full-deflection lean angle. The ONE real
   *   sensitivity control (GoBalance's settings screen offers 12/16/19/23/26°;
   *   lower = full deflection sooner = more sensitive). 19 is
   *   Constants.BOBO_MAX_ANGLE_DEFAULT.
   * @param {number} [opts.deadZone] Unity's ClampToZero design value.
   * @param {number} [opts.gamma] Radial response exponent; 1 is the identity,
   *   >1 softens small leans. See the GAMMA note below. Defaults to 1 HERE, in
   *   the port, so `fixtures/tilt-golden.json`'s original runs still describe
   *   the pipeline they were generated from; the web games' shim
   *   (`host.js` DEFAULT_TILT) is where the shipped 1.4 is chosen.
   * @param {number} [opts.emaTauSec] See the EMA note in push().
   * @param {number} [opts.xSign] Per-hardware trim.
   * @param {number} [opts.ySign] −1 because screen y grows downward, so leaning
   *   forward must push control.y negative for "lean forward = move up".
   * @param {() => number} [opts.now] Wall clock, injectable only so a host can
   *   supply a monotonic clock; the pipeline never uses it for the EMA.
   */
  constructor({
    maxAngleDeg = 12,
    deadZone = 0.04,
    gamma = 1,
    emaTauSec = 0.33,
    xSign = 1,
    ySign = -1,
    calTargetSamples = 30,
    calMinSamples = 5,
    calMaxWindowMs = 700,
    staleAfterMs = 700,
    now = () => Date.now(),
  } = {}) {
    this.maxAngleDeg = maxAngleDeg;
    this.deadZone = deadZone;
    this.gamma = gamma;
    this.emaTauSec = emaTauSec;
    this.xSign = xSign;
    this.ySign = ySign;

    // Samples that complete a calibration outright, and the floor below which
    // the wall-clock bound refuses to close it — a neutral averaged from one or
    // two packets is noise, not a posture.
    this.calTargetSamples = calTargetSamples;
    this.calMinSamples = calMinSamples;
    // Calibration is bounded by wall time as well as sample count: the real
    // packet rate varies per unit and a slow sensor must not leave the controls
    // dead after the host's countdown has finished.
    this.calMaxWindowMs = calMaxWindowMs;
    this.staleAfterMs = staleAfterMs;
    this._now = now;

    this.reset();
  }

  /** Wipe every bit of history. Used on sensor swap; not on recenter. */
  reset() {
    // Last gate-approved angles. Held (not dropped) through rejections so a
    // burst of linear acceleration freezes the marble instead of dropping it.
    this._lastTrusted = { ax: 0, ay: 0 };
    this._hasTrusted = false;

    // Adaptive gravity-magnitude baseline. The decode is self-normalising, so
    // absolute scale never matters; this gate only rejects *deviation* from the
    // sensor's own resting magnitude, i.e. linear-acceleration contamination.
    this._gRef = null;
    this._gateRejects = 0;

    // Neutral is (0,0) by default: the sensor's own zero is centre. There is no
    // automatic zeroing — recenter() is a manual escape hatch for drift.
    this._neutral = { ax: 0, ay: 0 };
    this._calCollecting = false;
    this._calSumAx = 0;
    this._calSumAy = 0;
    this._calCount = 0;
    this._calTicks = 0;
    this._calStartedAtMs = null;
    this._progress = 1;

    this._emaPrimed = false;
    this._emaX = 0;
    this._emaY = 0;
    this._lastTSec = null;

    this._control = { x: 0, y: 0 };
    this._raw = { x: 0, y: 0 };
    this._shaped = { x: 0, y: 0 };

    this._lastSampleAtMs = null;
    this._samplesSeen = 0;
    this.measuredHz = 0;
    this._hzCount = 0;
    this._hzWindowStart = this._now();
  }

  /** Capture a fresh neutral over ~1 s. Output holds zero while collecting. */
  recenter() {
    this._calCollecting = true;
    this._calSumAx = 0;
    this._calSumAy = 0;
    this._calCount = 0;
    this._calTicks = 0;
    this._calStartedAtMs = this._now();
    this._emaPrimed = false;
    this._progress = 0;
    this._emaX = 0;
    this._emaY = 0;
    // Reset the EMA clock: without this the first post-calibration sample sees
    // the whole calibration window as its dt and over-steps.
    this._lastTSec = null;
  }

  /** Sensitivity, live — changing it must not disturb the neutral or the EMA. */
  setMaxAngle(deg) {
    this.maxAngleDeg = deg;
  }

  /**
   * Convert a THRESHOLD quoted in pre-gamma ratio units into the post-gamma
   * value that fires at the same physical lean angle.
   *
   * -- WHY EVERY GAME WITH A THRESHOLD HAS TO CALL THIS ---------------------
   * `control` is a ratio, and gamma bends it. A game that commits an action at
   * magnitude 0.46 measured a player leaning 0.46 of the gamut; under gamma 1.4
   * that same 0.46 now needs 0.59 of it, so every commit threshold, dead zone
   * and hold trigger silently got harder without anyone editing it. That is the
   * failure this file's own header warns about one paragraph up -- "silently
   * rescales every threshold in every game it hosts" -- arriving from inside
   * rather than from a host.
   *
   * So the split is the same one `maxAngleDeg` already forces:
   *   THRESHOLD  -> shapeThreshold(), stays at one fixed physical angle
   *   ANALOGUE   -> left alone, because the softening IS the feature
   *
   * `swoon` is the reason this is a method and not a comment: its judge grades
   * against `TUNING.enter`/`exit`, its charts are authored against those, and
   * `tools/sim.mjs` sweeps them. Bending them under the game would have made
   * every previously-measured difficulty number wrong while every test still
   * passed.
   */
  shapeThreshold(r) {
    return this.gamma === 1 ? r : Math.pow(clamp(r, 0, 1), this.gamma);
  }

  /** Smoothed control in the unit disc. Games poll this; last write wins. */
  get control() {
    return { x: this._control.x, y: this._control.y };
  }

  /** Pre-EMA, post-mapping tilt. Debug HUDs only — never drive physics off it. */
  get raw() {
    return { x: this._raw.x, y: this._raw.y };
  }

  /**
   * `raw` after the response curve — the dead zone and the radial gamma —
   * pre-EMA. Exists so the golden fixture can fail on the shaping stage alone
   * instead of blaming the EMA for it; like `raw` it holds its last value
   * through a gated or calibrating sample.
   */
  get shaped() {
    return { x: this._shaped.x, y: this._shaped.y };
  }

  /** 0..1 while recentering, 1 when idle. Drives the host's countdown UI. */
  get calibrationProgress() {
    return this._progress;
  }

  get calibrating() {
    return this._calCollecting;
  }

  /**
   * True while fresh packets are arriving. The host reports the same condition
   * as sensor state 'stale'; games pause rather than let the marble coast on a
   * frozen input.
   */
  get streaming() {
    return (
      this._lastSampleAtMs !== null &&
      this._now() - this._lastSampleAtMs < this.staleAfterMs
    );
  }

  /**
   * False until the first sample ever, so a game can avoid a spurious
   * sensor-loss pause in the frames before streaming starts.
   */
  get hasEverSampled() {
    return this._lastSampleAtMs !== null;
  }

  _plausibleMagnitude(m) {
    if (m < 1e-6) return false;
    if (this._gRef === null) return true;
    return Math.abs(m - this._gRef) / this._gRef < 0.35;
  }

  /**
   * Feed one raw gravity sample.
   * @param {number} tMs the host's monotonic clock at batch assembly, which is
   *   the packet clock — not the frame clock. The EMA is driven by it.
   * @returns {{x: number, y: number}} the control after this sample.
   */
  push(gx, gy, gz, tMs) {
    this._lastSampleAtMs = this._now();
    this._tickHz();
    this._samplesSeen++;

    const m = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const anglesNow = anglesFromGravity(gx, gy, gz);
    const trusted = this._plausibleMagnitude(m);
    if (trusted) {
      // First trusted sample seeds the baseline; after that it creeps, so a
      // sensor whose resting magnitude is 0.98 g or 1.03 g settles on its own
      // number rather than fighting an absolute band.
      this._gRef = this._gRef === null ? m : 0.02 * m + 0.98 * this._gRef;
      this._lastTrusted = anglesNow;
      this._hasTrusted = true;
    } else {
      this._gateRejects++;
    }
    // Nothing trustworthy has ever arrived, so there is no "last value" to hold.
    if (!this._hasTrusted) return this.control;
    const angles = this._lastTrusted;

    if (this._calCollecting) {
      this._calTicks++;
      // Relax the gate if calibration cannot finish (~3 s of rejections) — a
      // stuck calibration must never permanently zero the controls. Relaxed
      // samples use their own decode, not the stale last-trusted one.
      if (trusted || this._calTicks > 90) {
        this._calAdd(trusted ? angles : anglesNow);
        if (
          this._calCollecting &&
          this._calStartedAtMs !== null &&
          this._now() - this._calStartedAtMs >= this.calMaxWindowMs
        ) {
          this._calFinishEarly();
        }
        this._progress = this._calCollecting
          ? clamp(this._calCount / this.calTargetSamples, 0, 1)
          : 1;
      }
      this._publish(0, 0, true);
      return this.control;
    }

    // Neutral is subtracted in the ANGLE domain, before the clamp — the same
    // stage where the SDK subtracts its fixCenter. Subtracting after the clamp
    // would let a tilted mounting eat part of the gamut.
    const relAx = angles.ax - this._neutral.ax;
    const relAy = angles.ay - this._neutral.ay;

    // RADIAL clamp: the gamut is a disc, not a square. ±1 on one axis is only
    // reachable when the other is 0, which is what makes a hard diagonal lean
    // feel like a diagonal rather than a corner.
    let ax = relAx;
    let ay = relAy;
    const mag = Math.sqrt(ax * ax + ay * ay);
    if (mag > this.maxAngleDeg) {
      const s = this.maxAngleDeg / mag;
      ax *= s;
      ay *= s;
    }
    // V2 SwitchXWithY: screen x takes the pre-swap .y component and vice versa.
    const mappedX = (ay / this.maxAngleDeg) * this.xSign;
    const mappedY = (ax / this.maxAngleDeg) * this.ySign;
    this._raw = { x: mappedX, y: mappedY };

    // Hard per-axis cut, no rescale — small enough to be imperceptible, enough
    // to keep a resting marble still.
    let shapedX = clamp(Math.abs(mappedX) < this.deadZone ? 0 : mappedX, -1, 1);
    let shapedY = clamp(Math.abs(mappedY) < this.deadZone ? 0 : mappedY, -1, 1);
    // RADIAL gamma, AFTER the dead zone. Both of those words are load-bearing;
    // see the ResponseCurve class doc in the Dart port, which this mirrors.
    if (this.gamma !== 1) {
      const sm = Math.hypot(shapedX, shapedY);
      if (sm > 1e-9) {
        const sc = Math.pow(sm, this.gamma) / sm;
        shapedX = clamp(shapedX * sc, -1, 1);
        shapedY = clamp(shapedY * sc, -1, 1);
      }
    }
    this._shaped = { x: shapedX, y: shapedY };

    // Monotonic time for the EMA: BLE notifications arrive in bursts, so
    // consecutive stamps can share a millisecond — synthesize a small forward
    // step instead of dropping the sample.
    let tSec = tMs / 1000;
    const last = this._lastTSec;
    if (last !== null && tSec <= last) tSec = last + 0.005;
    const dt = last === null ? 0.033 : clamp(tSec - last, 0.001, 0.25);
    this._lastTSec = tSec;

    // Prime on the first post-calibration sample rather than ramping up from
    // zero — the player is already holding a posture when the countdown ends.
    if (!this._emaPrimed) {
      this._emaPrimed = true;
      this._emaX = shapedX;
      this._emaY = shapedY;
      this._publish(this._emaX, this._emaY);
      return this.control;
    }

    // Rate-independent EMA. The SDK applies α = 0.05 per tick, which is only
    // τ = Δt/α ≈ 0.33 s at 60 Hz; BLE packet rate is neither 60 Hz nor constant,
    // so the per-tick form would change the feel with the packet rate.
    const alpha = 1 - Math.exp(-dt / this.emaTauSec);
    this._emaX += alpha * (shapedX - this._emaX);
    this._emaY += alpha * (shapedY - this._emaY);
    this._publish(this._emaX, this._emaY);
    return this.control;
  }

  _calAdd(a) {
    if (!this._calCollecting) return;
    this._calSumAx += a.ax;
    this._calSumAy += a.ay;
    this._calCount++;
    if (this._calCount >= this.calTargetSamples) {
      this._neutral = {
        ax: this._calSumAx / this._calCount,
        ay: this._calSumAy / this._calCount,
      };
      this._calCollecting = false;
    }
  }

  _calFinishEarly() {
    if (!this._calCollecting || this._calCount < this.calMinSamples) return;
    this._neutral = {
      ax: this._calSumAx / this._calCount,
      ay: this._calSumAy / this._calCount,
    };
    this._calCollecting = false;
  }

  _publish(x, y, resetEma = false) {
    if (resetEma) {
      this._emaX = 0;
      this._emaY = 0;
    }
    this._control = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  _tickHz() {
    this._hzCount++;
    const now = this._now();
    const elapsed = now - this._hzWindowStart;
    if (elapsed >= 2000) {
      this.measuredHz = (this._hzCount / elapsed) * 1000;
      this._hzCount = 0;
      this._hzWindowStart = now;
    }
  }
}

export default TiltPipeline;
