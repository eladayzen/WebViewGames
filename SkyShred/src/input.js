// Lean input. ONE axis is all the player ever needs: left / right, a number in [-1, 1] (positive = right).
//   - GoBalance board: window.__gbSensor.x (analog). Only X is read for steering (forward/back is the hard axis).
//   - Keyboard: arrows / A-D with a quick ramp.   - Pointer drag (touch / mouse), relative to where it started.
// The optional second axis (only used by the "nudge" altitude test mode): W/S, ArrowUp/Down or sensor.y.
// Forward lean (+) = nose down, same sign as the board (__gbSensor.y is Unity-convention, positive = forward).
const DZ = 0.12, CURVE = 1.5;     // the board dead zone + curve, from Sewer Shred's "medium" preset
const shape = (raw) => { const m = Math.max(0, Math.abs(raw) - DZ) / (1 - DZ); return Math.sign(raw) * Math.min(1, Math.pow(m, CURVE)); };

export class Input {
  constructor(el) {
    this.keyL = false; this.keyR = false; this.keyU = false; this.keyD = false; this.keyLean = 0;
    this.drag = null; this.dragLean = 0; this.anyPress = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keyL = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keyR = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.keyU = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.keyD = true;
      if (e.code === 'Space' || e.code === 'Enter') this.anyPress = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keyL = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keyR = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.keyU = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.keyD = false;
    });
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; this.drag = { x: e.clientX }; this.anyPress = true; });
    window.addEventListener('pointermove', (e) => { if (this.drag) this.dragLean = Math.max(-1, Math.min(1, (e.clientX - this.drag.x) / (window.innerWidth * 0.18))); });
    const end = () => { this.drag = null; this.dragLean = 0; };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  }
  read(dt) {
    const want = (this.keyR ? 1 : 0) - (this.keyL ? 1 : 0);
    this.keyLean += (want - this.keyLean) * Math.min(1, dt * (want === 0 ? 9 : 5.5));
    let x = this.keyLean + this.dragLean;
    const sn = window.__gbSensor;
    if (sn && typeof sn.x === 'number') x += shape(sn.x);
    return Math.max(-1, Math.min(1, x));
  }
  /** forward lean (+) = nose down, back (-) = pull up. Only used by the nudge test mode. */
  readPitch() {
    let y = (this.keyU ? 1 : 0) - (this.keyD ? 1 : 0);
    const sn = window.__gbSensor;
    if (sn && typeof sn.y === 'number') y += shape(sn.y);
    return Math.max(-1, Math.min(1, y));
  }
  consumePress() { const p = this.anyPress; this.anyPress = false; return p; }
}
