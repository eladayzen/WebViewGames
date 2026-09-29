// Keyboard-driven stand-in for window.__gbSensor + window.GoBalance's board
// max-angle calls, OUTSIDE the real app only. Never installed if
// window.GoBalance already exists (i.e. never inside the real GoBalance
// WebView) -- side-effect-only module, safe to import unconditionally in
// production, same "ships in every build, becomes a no-op the instant the
// real host is present" discipline as input.js's own existing arrow-key
// fallback (see that file's readTilt()).
//
// WHY THIS EXISTS: input.js's fallback lets a developer STEER with arrow
// keys outside the app, but systems/boardCalibration.js reads
// window.__gbSensor and window.GoBalance.getMaxAngle/setMaxAngle/
// setMaxAngleSession DIRECTLY (it has to -- the calibration wizard is
// testing the raw sensor path itself, not steering), so without this the
// CALIBRATE BOARD row can only ever report "NOT AVAILABLE" in a plain
// browser, and there'd be no way to see or click through the wizard at all
// without a real board or a one-off test script.
//
// Arrow keys drive window.__gbSensor.x the same way a real lean would --
// held Left/Right eases toward a realistic lean rather than snapping, so the
// calibration wizard's movement gate and percentile sampling have something
// realistic to work with instead of a step function.
//
// SIDE EFFECT WORTH KNOWING: input.js's own readTilt() checks
// window.__gbSensor FIRST, before its simpler instant keys.left/right
// fallback -- so installing this ALSO changes what a developer sees when
// testing ABSOLUTE steering mode (dev panel only; STEPPED, the actual
// default, reads keys directly via its own listener and never goes through
// readTilt() at all) in a plain browser: eased and capped at KEY_LEAN_TARGET
// below, rather than an instant +/-1. Never reaches the real app (this
// entire file no-ops there), so it can't affect real device behavior --
// just a heads-up in case absolute-mode browser testing feels different
// than it used to.

if (typeof window !== 'undefined' && !window.GoBalance) {
  const keys = { left: false, right: false };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') keys.left = true;
    else if (e.code === 'ArrowRight') keys.right = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    else if (e.code === 'ArrowRight') keys.right = false;
  });

  // A held key simulates a REALISTIC comfortable lean (~0.4 of the widened
  // 45-degree calibration ruler, i.e. ~18 degrees), not a full push to 1.0 --
  // a real person can't sustain the physical extreme, and racing to 1.0
  // produces an unrealistically wide "reach" that the wizard's own
  // plausibility bound (systems/boardCalibration.js's MAX_PLAUSIBLE_DEG)
  // correctly rejects, which would make the calibration wizard look broken
  // in exactly the moment this mock exists to let someone try it.
  const KEY_LEAN_TARGET = 0.4;
  window.__gbSensor = window.__gbSensor || { x: 0, y: 0 };
  const tick = () => {
    const target = (keys.right ? KEY_LEAN_TARGET : 0) - (keys.left ? KEY_LEAN_TARGET : 0);
    window.__gbSensor.x += (target - window.__gbSensor.x) * 0.08;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // A real reply shape ({value, default, min, max}), mutated in place by
  // set/session the same way the real host clamps to 5..45.
  const state = { value: 19, default: 19, min: 5, max: 45 };
  const clamp = (v) => Math.max(state.min, Math.min(state.max, Math.round(v)));
  const reply = () => Promise.resolve({ ...state });
  window.GoBalance = {
    getMaxAngle: () => reply(),
    setMaxAngle: (v) => { state.value = clamp(v); return reply(); },
    setMaxAngleSession: (v) => { state.value = clamp(v); return reply(); },
  };

  // eslint-disable-next-line no-console
  console.log('[dev] mock GoBalance.getMaxAngle/setMaxAngle/setMaxAngleSession + keyboard sensor installed (browser only) -- hold ArrowLeft/ArrowRight to lean.');
}
