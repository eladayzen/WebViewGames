// Board max-angle calibration -- the tilt-to-input scale (PREF_BOBO_MAX_ANGLE),
// NOT this game's own SENSITIVITY dial (systems/steeringSettings.js's
// gb:sensitivity call, which tunes OUR hysteresis on top of whatever the host
// already normalises tilt to). Built against Assets/GoBalance/WebGames/
// BOARD_SENSITIVITY.md (gobalance repo), Revision 1 (2026-09-29) -- that doc
// is the actual shared contract between platforms (GoBalance/Unity here,
// bobo_play/Flutter separately building their own equivalent against the
// same doc), NOT this file -- the two repos have no code-sharing path, so
// each platform gets its own implementation kept in lockstep by the doc's
// revision line. If the algorithm here ever changes, bump that revision and
// say so, the same discipline the doc itself asks for.
//
// TEMPLATE FILE within THIS platform though, same spirit as ui/devUnlock.js
// -- meant to be copied verbatim into other GoBalance web games. Both UX
// shapes (a number the player edits, and this tilt-right/tilt-left wizard)
// end at the same host call, so the percentile math, the span/2, the 0.92
// landing fraction, and the movement gate belong in ONE place per platform,
// not reimplemented per game.
//
// EVERYTHING IS FEATURE-DETECTED, same discipline as systems/scoreboard.js:
// window.GoBalance.getMaxAngle/setMaxAngle/setMaxAngleSession are injected by
// the Unity host and simply don't exist at a plain dev URL, so every entry
// point here answers "unavailable" rather than throwing, and the game is
// fully playable (calibration UI just doesn't offer itself) outside the app.
//
// These three names are CONFIRMED (2026-09-29, gobalance-33) -- live in
// Resources/GoBalanceWebSdk.txt on window.GoBalance, resolving the C#-side
// bridge's sensor.maxangle.get/set/session. Not yet committed on their end
// (a PR is holding commits repo-wide) -- re-verify against their file if
// this stops working after their next sync.

/** The SDK, or null outside the app / before the wrapper lands. */
function sdk() {
  return typeof window !== 'undefined' && window.GoBalance ? window.GoBalance : null;
}

export function maxAngleAvailable() {
  const gb = sdk();
  return !!(gb && typeof gb.getMaxAngle === 'function');
}

/** Resolves {value, default, min, max}, or null if unavailable. Never throws. */
export function getMaxAngle() {
  const gb = sdk();
  if (!gb || typeof gb.getMaxAngle !== 'function') return Promise.resolve(null);
  return Promise.resolve(gb.getMaxAngle()).catch(() => null);
}

/** Persists. Resolves {value, default, min, max} (the CLAMPED, actually-applied
 *  value -- render from this, not from what was asked for), or null. */
export function setMaxAngle(degrees) {
  const gb = sdk();
  if (!gb || typeof gb.setMaxAngle !== 'function') return Promise.resolve(null);
  return Promise.resolve(gb.setMaxAngle(Math.round(degrees))).catch(() => null);
}

/** Session-only -- restored on exit. Used to widen the ruler to 45 degrees
 *  for the calibration sample itself, per BOARD_SENSITIVITY.md: the tilt a
 *  game receives is raw/maxAngle already clamped to 1, so sampling at the
 *  CURRENT (smaller) max angle would just read 1.0 for anyone who can already
 *  tilt past it -- there'd be nothing to measure. */
export function setMaxAngleSession(degrees) {
  const gb = sdk();
  if (!gb || typeof gb.setMaxAngleSession !== 'function') return Promise.resolve(null);
  return Promise.resolve(gb.setMaxAngleSession(Math.round(degrees))).catch(() => null);
}

// --- Pure math, exported for its own testing -------------------------------

/** Linear-interpolated percentile (p in 0..1) of an UNSORTED array. */
export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

// The wizard samples at maxAngle=45 (WIDEN_DEG), so a reading of x maps to
// x*45 degrees exactly -- nothing saturates at 45 (BOARD_SENSITIVITY.md).
const WIDEN_DEG = 45;
// Land full deflection just inside the measured edge -- holding your exact
// measured limit to get full steering is a bad ask (BOARD_SENSITIVITY.md).
const LANDING_FRACTION = 0.92;
// The flow refuses to start counting a side's 1s sample window until the
// player has genuinely moved this many degrees that way -- so it can't be
// tapped/waited through without measuring anything.
const MOVE_GATE_DEG = 3;
const SAMPLE_MS = 1000;
const POLL_MS = 16; // ~60Hz, matching the host's own pump rate
// Safety net only -- if a side's gate never opens (no real board, or a
// player who can't or won't move that way), don't hang the wizard forever.
const PER_SIDE_TIMEOUT_MS = 8000;
// Plausibility bound on the FINAL computed value, checked right before it's
// persisted -- the host's own 5..45 clamp is a range check, not a
// plausibility one, and happily accepts both ends. Below 6, a resting hand
// is full deflection; above 30, the wizard measured something that wasn't a
// lean (the board picked up, a phone carried through the sample window).
// Caught on real hardware by the Carve/bobo_play session, same class of bug
// as span/2 vs min(): a measurement meant to fix "half my range is
// unreachable" that can instead make it worse if left unchecked.
const MIN_PLAUSIBLE_DEG = 6;
const MAX_PLAUSIBLE_DEG = 30;

/**
 * Live-samples one direction's lean. `sign` is +1 (right) or -1 (left).
 * `onTilt(x)` fires every poll with the raw normalised reading (for driving
 * a live board-tilt visual); `onGateOpen()` fires once, the moment real
 * movement crosses MOVE_GATE_DEG, so the UI can switch from "keep leaning"
 * to "hold it".
 *
 * Resolves one of:
 *   - a NUMBER: the extreme in DEGREES, SIGNED (positive for right, negative
 *     for left) -- deliberately not an absolute value. The percentile is
 *     taken at the 90th (right) / 10th (left) percentile of the signed
 *     samples, NOT 90th for both: the raw reading is mostly-positive while
 *     leaning right and mostly-negative while leaning left, so "discount the
 *     single overshoot spike at the true extreme" means moving IN from the
 *     100th percentile on the right, but IN from the 0th percentile on the
 *     left -- i.e. the 90th and 10th respectively, not the same percentile
 *     applied to a signed number both times.
 *   - `null` if `isCancelled` fired.
 *   - `'timeout'` if the movement gate never opened -- a side the player
 *     never attempted (walked away, board disconnected, didn't understand
 *     the prompt) has NO reading, and must not be reported as one. Caught by
 *     the Carve/bobo_play session: the old version pushed one sub-gate
 *     sample and resolved it as a normal reading of ~0 degrees, which a
 *     timed-out BOTH sides run turns into reach=0 -> computed=0 ->
 *     setMaxAngle(0) -> the host clamps to its 5-degree floor and PERSISTS
 *     it device-wide, with nothing on screen having said so. Distinct from
 *     `null` so the caller can tell "the player stopped this" apart from
 *     "this side never happened" even though both abort the wizard the same
 *     way.
 */
function sampleDirection(sign, { onTilt, onGateOpen, isCancelled } = {}) {
  const moveGateNorm = MOVE_GATE_DEG / WIDEN_DEG;
  const p = sign > 0 ? 0.9 : 0.1;

  return new Promise((resolve) => {
    const samples = [];
    let gateOpen = false;
    let gateOpenedAt = 0;
    const startedAt = performance.now();

    const finish = (outcome) => {
      clearInterval(timer);
      if (outcome === 'cancelled') { resolve(null); return; }
      if (outcome === 'timeout') { resolve('timeout'); return; }
      const reading = samples.length ? percentile(samples, p) : 0;
      resolve(reading * WIDEN_DEG);
    };

    const timer = setInterval(() => {
      if (isCancelled && isCancelled()) { finish('cancelled'); return; }

      const sensor = window.__gbSensor;
      const x = sensor ? sensor.x : 0;
      if (onTilt) onTilt(x);

      const now = performance.now();
      if (!gateOpen) {
        const past = sign > 0 ? x > moveGateNorm : x < -moveGateNorm;
        if (past) {
          gateOpen = true;
          gateOpenedAt = now;
          if (onGateOpen) onGateOpen();
        } else if (now - startedAt >= PER_SIDE_TIMEOUT_MS) {
          // Never moved far enough -- a genuine failure, not a sample. See
          // this function's own doc comment above for why this must not
          // resolve a number.
          finish('timeout');
          return;
        }
      }
      if (gateOpen) {
        samples.push(x);
        if (now - gateOpenedAt >= SAMPLE_MS) {
          finish('done');
        }
      }
    }, POLL_MS);
  });
}

/**
 * Runs the full wizard: widen -> sample right -> sample left -> compute ->
 * persist. `onPhase('right' | 'left' | 'done')`, `onTilt(x, phase)`, and
 * `onGateOpen(phase)` (fires once per side, the moment real movement passes
 * MOVE_GATE_DEG -- the UI's cue to switch from "keep leaning" to "hold it")
 * all optional. `isCancelled()`, checked every poll, ends the wizard early
 * without ever calling setMaxAngle -- an aborted calibration must not
 * persist a bogus value computed from a half-finished or never-attempted
 * sample.
 *
 * Resolves `{ cancelled: true, reason }` (reason is 'cancelled', 'timeout',
 * or 'implausible' -- see below), or on completion `{ rightDeg, leftDeg,
 * reach, computed, applied }` where `applied` is the host's clamped
 * {value, default, min, max} reply (or null if the SDK wrapper isn't
 * available -- callers should check maxAngleAvailable() before ever
 * starting this).
 */
export async function runCalibrationWizard({ onPhase, onTilt, onGateOpen, isCancelled } = {}) {
  const emitPhase = (phase) => { if (onPhase) onPhase(phase); };
  const emitTilt = (phase) => (x) => { if (onTilt) onTilt(x, phase); };
  const emitGateOpen = (phase) => () => { if (onGateOpen) onGateOpen(phase); };

  // Captured BEFORE widening so an abort can put the session override back
  // to whatever was actually in effect -- sensor.maxangle.session only
  // auto-restores on GAME EXIT (per BOARD_SENSITIVITY.md), not on aborting
  // mid-run, so without this an aborted wizard would silently leave the
  // rest of the run stuck at the widened 45-degree ruler.
  const before = await getMaxAngle();

  async function abort(reason) {
    if (before) await setMaxAngleSession(before.value);
    return { cancelled: true, reason };
  }

  await setMaxAngleSession(WIDEN_DEG);
  if (isCancelled && isCancelled()) return abort('cancelled');

  emitPhase('right');
  const rightDeg = await sampleDirection(1, {
    onTilt: emitTilt('right'), onGateOpen: emitGateOpen('right'), isCancelled,
  });
  if (rightDeg === null) return abort('cancelled');
  if (rightDeg === 'timeout') return abort('timeout');

  emitPhase('left');
  const leftDeg = await sampleDirection(-1, {
    onTilt: emitTilt('left'), onGateOpen: emitGateOpen('left'), isCancelled,
  });
  if (leftDeg === null) return abort('cancelled');
  if (leftDeg === 'timeout') return abort('timeout');

  // Span/2, NOT min(|right|, |left|) -- a resting offset (the rider standing
  // slightly off-centre on an inflated cushion) cancels out of the span but
  // would otherwise look like reduced reach on whichever side it favours.
  // See BOARD_SENSITIVITY.md for the real-hardware case this fixed.
  const reach = (rightDeg - leftDeg) / 2;
  const computed = reach * LANDING_FRACTION;

  // Plausibility bound, checked BEFORE persisting -- see MIN/MAX_PLAUSIBLE_DEG's
  // own comment. This is what actually stops the timeout/near-zero case from
  // reaching setMaxAngle even if some future change to the gate logic let a
  // degenerate reading slip through -- belt and suspenders with the timeout
  // fix above, not a substitute for it.
  if (computed < MIN_PLAUSIBLE_DEG || computed > MAX_PLAUSIBLE_DEG) {
    return abort('implausible');
  }

  emitPhase('done');
  const applied = await setMaxAngle(computed);
  lastCalibratedAt = Date.now();
  return { rightDeg, leftDeg, reach, computed, applied };
}

// When a successful calibration last completed, or 0 if none has yet this
// session. Direct request: warn before letting a manual MAX TILT ANGLE edit
// (ui/steeringPanel.js) silently overwrite a value the player JUST measured
// -- that row checks this rather than each caller tracking it separately.
let lastCalibratedAt = 0;
export function msSinceLastCalibration() {
  return lastCalibratedAt ? Date.now() - lastCalibratedAt : Infinity;
}
