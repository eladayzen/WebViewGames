// Lean input. The board is analog (forwardSteeringKeys OFF): __gbSensor.x arrives every pump.
// Keyboard and pointer-drag stand in for it in a browser. Output: lean in [-1, 1], + = right.
export class Input {
  constructor(canvas) {
    this.keys = { left: false, right: false };
    this.keyLean = 0;
    this.drag = null;
    this.dragLean = 0;
    const k = (e, down) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.keys.left = down; e.preventDefault(); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.keys.right = down; e.preventDefault(); }
    };
    window.addEventListener('keydown', (e) => k(e, true));
    window.addEventListener('keyup', (e) => k(e, false));
    canvas.addEventListener('pointerdown', (e) => { this.drag = e.clientX; this.dragLean = 0; });
    window.addEventListener('pointermove', (e) => {
      if (this.drag === null) return;
      this.dragLean = Math.max(-1, Math.min(1, (e.clientX - this.drag) / (window.innerWidth * 0.18)));
    });
    const up = () => { this.drag = null; this.dragLean = 0; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  read(dt) {
    // keys ramp in over ~0.15 s so a tap is a nudge, a hold is full lean
    const want = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const rate = want === 0 ? 10 : 7;
    this.keyLean += (want - this.keyLean) * Math.min(1, dt * rate);
    let x = this.keyLean + this.dragLean;
    // GoBalance SDK: the Unity host publishes the balance board's raw analog tilt here every
    // frame (~60Hz) whenever the game's WebGameController has forwardSteeringKeys off (this game
    // reads the analog value directly instead of via synthetic arrow-key events — see
    // GOBALANCE_SDK.md). Purely additive, so it composes cleanly with keyboard/pointer, and is a
    // no-op in a normal browser where window.__gbSensor is simply undefined.
    const sensor = window.__gbSensor;
    if (sensor) {
      const sx = Math.abs(sensor.x) < 0.06 ? 0 : sensor.x;
      x += sx * 1.6;
    }
    if (typeof window.__leanOverride === 'number') x = window.__leanOverride;
    return Math.max(-1, Math.min(1, x));
  }
}
