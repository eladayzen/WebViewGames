// Synthesised sound: engine hum, crunches, explosions, pickup chime. No files to load, so it
// can't fail offline. Starts on the first user gesture (WebView/browser autoplay rules).
export class Audio {
  constructor() {
    this.ctx = null; this.muted = false;
    try { this.muted = localStorage.getItem('wr_muted') === '1'; } catch (e) { /* storage blocked */ }
    const unlock = () => this.start();
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { once: true }));
  }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    // noise buffer shared by every crunch
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    // engine: two detuned saws through a lowpass
    this.eng = c.createGain(); this.eng.gain.value = 0;
    this.engLp = c.createBiquadFilter(); this.engLp.type = 'lowpass'; this.engLp.frequency.value = 500;
    this.engO = [c.createOscillator(), c.createOscillator()];
    this.engO.forEach((o, i) => { o.type = 'sawtooth'; o.frequency.value = 55 + i * 1.7; o.connect(this.engLp); o.start(); });
    this.engLp.connect(this.eng); this.eng.connect(this.master);
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('wr_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }
  setPaused(p) { if (this.ctx) (p ? this.ctx.suspend() : this.ctx.resume()); }
  engine(speed, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engO[0].frequency.setTargetAtTime(48 + speed * 2.2, t, 0.1);
    this.engO[1].frequency.setTargetAtTime(49.5 + speed * 2.25, t, 0.1);
    this.eng.gain.setTargetAtTime(on ? 0.07 : 0, t, 0.2);
  }
  _noise(dur, f0, f1, gain, q = 1, type = 'lowpass') {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.6 + Math.random() * 0.5;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  _tone(f0, f1, dur, gain, type = 'sine', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  crunch(power = 1) {
    if (!this.ctx) return;
    this._noise(0.22, 2400, 300, 0.35 * Math.min(1.5, power), 2, 'bandpass');
    this._tone(110, 45, 0.18, 0.4 * Math.min(1.5, power), 'triangle');
  }
  scrape() { if (this.ctx) this._noise(0.12, 3800, 2600, 0.06, 6, 'bandpass'); }
  thud() { if (!this.ctx) return; this._tone(80, 35, 0.25, 0.5, 'sine'); this._noise(0.15, 800, 200, 0.2); }
  boom() {
    if (!this.ctx) return;
    this._noise(1.1, 1800, 60, 0.7); this._tone(70, 25, 0.8, 0.8, 'sine');
    this._noise(0.4, 5000, 900, 0.18, 1, 'highpass');
  }
  pickup() { if (!this.ctx) return; [660, 880, 1320].forEach((f, i) => this._tone(f, f * 1.01, 0.18, 0.18, 'square', i * 0.07)); }
  raph() {
    if (!this.ctx) return;
    this._noise(0.5, 400, 6000, 0.25, 1.5, 'bandpass');
    this._tone(220, 880, 0.45, 0.2, 'sawtooth');
  }
  beep(hi) { if (this.ctx) this._tone(hi ? 1040 : 520, hi ? 1040 : 520, hi ? 0.4 : 0.15, 0.2, 'square'); }
  over() { if (this.ctx) [523, 659, 784, 1046].forEach((f, i) => this._tone(f, f, 0.25, 0.15, 'square', i * 0.12)); }
}
