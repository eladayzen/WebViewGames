// WebAudio (§9.3): decode once per clip, a fresh source node per trigger, one
// one-time gesture unlock. NOT <audio> elements — they do not overlap reliably
// and they stall on a mobile WebView.
//
// Everything degrades silently: a missing clip is a no-op, never an exception.
// There is no console on-device, and audio is the last thing that should be
// able to take the run down with it.
//
// The barrel's AUDIO DUCK is part of the section's "something changed" read
// (§5.7, §7.2) and is a gain ramp on the master bus, not a per-clip change.

const CLIPS = {
  carve: 'assets/audio/carve.mp3',
  coin: 'assets/audio/coin.mp3',
  orb: 'assets/audio/orb.mp3',
  slot: 'assets/audio/slot-fill.mp3',
  launch: 'assets/audio/launch.mp3',
  payout: 'assets/audio/payout.mp3',
  land: 'assets/audio/land.mp3',
  barrel: 'assets/audio/barrel.mp3',
  wipeout: 'assets/audio/wipeout.mp3',
  crew: 'assets/audio/crew-pass.mp3',
  alert: 'assets/audio/alert.mp3',
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = {};
    this.muted = false;
    this._duck = 1;
    this._duckTarget = 1;
    this._unlocked = false;
  }

  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
      return;
    }

    // One-time gesture unlock. The SDK forwards Space/Enter and synthetic
    // clicks, and a normal browser needs a real gesture; either resumes it.
    const unlock = () => {
      if (this._unlocked || !this.ctx) return;
      this._unlocked = true;
      this.ctx.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    await Promise.all(Object.entries(CLIPS).map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(buf);
      } catch (e) {
        /* missing clip: silent, never fatal */
      }
    }));
  }

  play(key, { volume = 1, rate = 1 } = {}) {
    if (!this.ctx || this.muted) return;
    const buf = this.buffers[key];
    if (!buf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = volume;
      src.connect(g).connect(this.master);
      src.start();
    } catch (e) {
      /* never fatal */
    }
  }

  /** The barrel duck: outside audio drops as the wave closes over (§5.7). */
  duck(on) { this._duckTarget = on ? 0.42 : 1; }

  update(dt) {
    if (!this.master) return;
    this._duck += (this._duckTarget - this._duck) * Math.min(1, dt * 3.2);
    this.master.gain.value = (this.muted ? 0 : 0.85) * this._duck;
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }
}
