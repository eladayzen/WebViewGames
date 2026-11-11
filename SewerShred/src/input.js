// Lean input, one number in [-1, 1] (positive = right).
//
// Sources, summed and clamped:
//  - GoBalance board: window.__gbSensor.x, analog. This game runs with the
//    WebGameController's forwardSteeringKeys OFF, so Unity sends no synthetic
//    arrow keys and there is no double input. Only the X (left/right) axis is
//    read — forward/back lean is never needed (it's the hard axis on the board).
//  - Keyboard (desktop testing): arrows / A-D, with a quick ramp so a tap is
//    a nudge and a hold is a full lean, like a body weight shift.
//  - Pointer drag (touch / mouse), relative to where the drag started.
export class Input {
  constructor(el) {
    this.keyL = false; this.keyR = false;
    this.keyLean = 0;
    this.drag = null; this.dragLean = 0;
    this.anyPress = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keyL = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keyR = true;
      if (e.code === 'Space' || e.code === 'Enter') this.anyPress = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keyL = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keyR = false;
    });
    el.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX }; this.anyPress = true; });
    window.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.dragLean = Math.max(-1, Math.min(1, (e.clientX - this.drag.x) / (window.innerWidth * 0.18)));
    });
    const end = () => { this.drag = null; this.dragLean = 0; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  read(dt) {
    const want = (this.keyR ? 1 : 0) - (this.keyL ? 1 : 0);
    const rate = want === 0 ? 9 : 5.5;
    this.keyLean += (want - this.keyLean) * Math.min(1, dt * rate);
    let x = this.keyLean + this.dragLean;
    // GoBalance SDK: the Unity host publishes the balance board's raw analog tilt here every
    // frame (~60Hz) whenever the game's WebGameController has forwardSteeringKeys off (this game
    // reads the analog value directly instead of via synthetic arrow-key events — see
    // GOBALANCE_SDK.md). Purely additive, so it composes cleanly with keyboard/pointer, and is a
    // no-op in a normal browser where window.__gbSensor is simply undefined.
    const sensor = window.__gbSensor;
    if (sensor) {
      // a small dead-zone so standing still is truly neutral, then a gentle curve
      const raw = sensor.x;
      const dz = 0.06;
      const m = Math.max(0, Math.abs(raw) - dz) / (1 - dz);
      x += Math.sign(raw) * Math.min(1, m * 1.25);
    }
    // also allow a test hook (headless drive script)
    if (typeof window.__leanOverride === 'number') x = window.__leanOverride;
    return Math.max(-1, Math.min(1, x));
  }

  consumePress() {
    const p = this.anyPress; this.anyPress = false; return p;
  }
}
