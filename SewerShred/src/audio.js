// Sound. The music is a Suno track (public/audio/music.mp3); every SFX is
// synthesized in WebAudio, so it reacts continuously (wheel roar follows speed,
// slime turns the roar to a squelch, pizza blips climb the scale with combo).
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicBuf = null;
    const unlock = () => {
      if (this.paused) return;
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.master);
    // music lowpass — muffles under hit-stop / game over for a "thud"
    this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 20000;
    this.musicLP.connect(this.musicGain);

    // noise buffer shared by everything
    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    // continuous wheel roar
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    this.roarF = ctx.createBiquadFilter(); this.roarF.type = 'bandpass'; this.roarF.Q.value = 0.8; this.roarF.frequency.value = 300;
    this.roarG = ctx.createGain(); this.roarG.gain.value = 0;
    src.connect(this.roarF).connect(this.roarG).connect(this.sfx);
    src.start();
    // rumble oscillator under it (wheels over plate seams)
    this.rumble = ctx.createOscillator(); this.rumble.type = 'sawtooth'; this.rumble.frequency.value = 40;
    this.rumbleG = ctx.createGain(); this.rumbleG.gain.value = 0;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 160;
    this.rumble.connect(rlp).connect(this.rumbleG).connect(this.sfx);
    this.rumble.start();

    if (this.pendingMusic) this.loadMusic(this.pendingMusic);
  }

  async loadMusic(url) {
    if (!this.ctx) { this.pendingMusic = url; return; }
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      this.musicBuf = await this.ctx.decodeAudioData(buf);
      if (this.wantMusic) this.startMusic();
    } catch (e) { /* music is optional */ }
  }

  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || !this.musicBuf || this.musicSrc) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.musicBuf; s.loop = true;
    s.connect(this.musicLP);
    s.start();
    this.musicSrc = s;
    this.musicGain.gain.setTargetAtTime(0.42, this.ctx.currentTime, 0.4);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.03);
  }

  /** Pause freezes every sound, music included, exactly where it was. */
  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend(); else this.ctx.resume();
  }

  muffle(on, time = 0.05) {
    if (!this.ctx) return;
    this.musicLP.frequency.setTargetAtTime(on ? 500 : 20000, this.ctx.currentTime, time);
  }

  /** Per-frame: speed in m/s, slime 0/1, airborne. */
  ride(speed, slime, active, water = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = active ? Math.min(1, speed / 45) : 0;
    // water: a brighter, louder hiss (spray) and the wheel rumble drowns out
    this.roarG.gain.setTargetAtTime(active ? (water ? 0.2 : 0.07) + v * 0.12 : 0, t, 0.06);
    this.roarF.frequency.setTargetAtTime(water ? 1500 + v * 900 : slime ? 520 + v * 300 : 260 + v * 700, t, 0.08);
    this.roarF.Q.setTargetAtTime(slime ? 4 : water ? 1.2 : 0.8, t, 0.1);
    this.rumbleG.gain.setTargetAtTime(active ? (slime || water ? 0.03 : 0.08) : 0, t, 0.1);
    this.rumble.frequency.setTargetAtTime(30 + v * 50, t, 0.1);
  }

  _env(node, t, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq, { type = 'square', dur = 0.12, vol = 0.18, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noiseHit({ dur = 0.25, vol = 0.4, freq = 1200, q = 0.7, type = 'bandpass', sweep = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, vol, dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  pizza(combo) {
    const base = 523.25 * Math.pow(2, (Math.min(combo, 12) * 2) / 12);
    this.tone(base, { type: 'square', dur: 0.07, vol: 0.12 });
    this.tone(base * 1.5, { type: 'square', dur: 0.1, vol: 0.1, delay: 0.05 });
    this.tone(base * 2, { type: 'triangle', dur: 0.14, vol: 0.08, delay: 0.1 });
  }
  shield() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.16, vol: 0.14, delay: i * 0.06 }));
    this.noiseHit({ dur: 0.5, vol: 0.12, freq: 3000, sweep: 0.3, q: 3 });
  }
  hit() {
    this.noiseHit({ dur: 0.35, vol: 0.7, freq: 900, sweep: 0.2, q: 0.6 });
    this.tone(110, { type: 'sawtooth', dur: 0.35, vol: 0.35, slide: 0.35 });
    this.tone(70, { type: 'sine', dur: 0.4, vol: 0.5, slide: 0.5 });
  }
  smash() {
    this.noiseHit({ dur: 0.18, vol: 0.6, freq: 2400, q: 1.5 });
    this.noiseHit({ dur: 0.35, vol: 0.4, freq: 600, q: 0.8, sweep: 0.4, delay: 0.03 });
    this.tone(180, { type: 'square', dur: 0.12, vol: 0.18, slide: 0.5 });
  }
  saw() {
    // metal-on-metal screech
    this.tone(1800, { type: 'sawtooth', dur: 0.3, vol: 0.12, slide: 0.6 });
    this.noiseHit({ dur: 0.3, vol: 0.4, freq: 4200, q: 4, sweep: 0.5 });
  }
  kick() {
    // whoosh of the spin, then the smack
    this.noiseHit({ dur: 0.18, vol: 0.3, freq: 500, sweep: 5, q: 2 });
    this.noiseHit({ dur: 0.12, vol: 0.7, freq: 2600, q: 1.0, delay: 0.07 });
    this.tone(220, { type: 'square', dur: 0.12, vol: 0.25, slide: 0.4, delay: 0.07 });
    this.tone(880, { type: 'triangle', dur: 0.18, vol: 0.1, slide: 1.5, delay: 0.1 });
  }
  shieldPop() {
    this.tone(1200, { type: 'sine', dur: 0.3, vol: 0.2, slide: 0.25 });
    this.noiseHit({ dur: 0.3, vol: 0.3, freq: 4000, sweep: 0.2, q: 2 });
  }
  near() {
    this.noiseHit({ dur: 0.28, vol: 0.35, freq: 600, sweep: 6, q: 2.5 });
  }
  land() {
    this.tone(90, { type: 'sine', dur: 0.2, vol: 0.35, slide: 0.5 });
    this.noiseHit({ dur: 0.12, vol: 0.25, freq: 400, q: 0.6 });
  }
  trick() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, { type: 'square', dur: 0.09, vol: 0.1, delay: i * 0.045 }));
  }
  splash() { this.noiseHit({ dur: 0.3, vol: 0.25, freq: 700, q: 5, sweep: 0.4 }); }
  beep(hi) { this.tone(hi ? 1046 : 523, { type: 'square', dur: hi ? 0.35 : 0.12, vol: 0.16 }); }
  over() {
    this.muffle(true, 0.3);
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, { type: 'square', dur: 0.22, vol: 0.13, delay: i * 0.16 }));
  }
}
