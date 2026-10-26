// Music, wind and the sound of an edge in snow.
//
// The music is a clock as much as a soundtrack: AudioContext.currentTime is
// sample-accurate and the buffer starts at a known instant, so track position is
// exactly `currentTime - startedAt`. No dead reckoning between frames, no
// slewing toward a polled position. The course reads beats off that clock to
// decide when to place a gate, so any drift here would show up as slalom that
// does not land on the music.
//
// NOTHING BELOW MAY TOUCH THAT CLOCK. Effects are scheduled off
// `ctx.currentTime` and never off `startedAt`; no effect suspends, resumes or
// re-rates the context; the music's source, buffer and start instant are
// written in exactly three places (`start`, `stop`, `pause`) and read nowhere
// else. Sample decoding happens once at boot, before the transport ever runs.
//
// ── what is recorded and what is synthesised ─────────────────────────────────
//
// The split is not "samples are better". It is which of the two a given sound
// is actually asking for.
//
// RECORDED, because the ear knows what snow sounds like and no filter bank is
// going to fool it: the edge itself (two surfaces, groomed and powder), the
// landing, the wipeout, and the crystal of a drift-line mote.
//
// SYNTHESISED, on purpose:
//   - The gate whip and the missed-gate drop. These fire two hundred times in a
//     run. One recording played two hundred times is the classic way to make a
//     player turn the sound off — the twentieth is recognisably the same event
//     as the first. A synthesised burst is a different take every time, and it
//     is jittered on top of that.
//   - Every REWARD: the carve chime, the trick, the multiplier step, the finish.
//     These have to agree with a soundtrack whose key this file has never
//     analysed. A pitched sample cannot; three triangle notes off a pentatonic
//     can, and stay consonant against anything.
//   - Wind. Filtered noise IS wind, and a looped wind recording would put a
//     second periodicity in the bed to beat against the edge loop's.
//   - The sub under a landing and a crash. Forty-six hertz is not in any
//     library take of snow and would not survive the encode if it were.
//
// Every sampled sound degrades to its synthesised predecessor if the file does
// not load. The rider model already makes that bargain — "if the model fails to
// load the game falls back to the primitive rider rather than refusing to
// start" — and one missing effect must not be worth more than the run.

/**
 * THE PLAYLIST, and it is a playlist rather than a track because the descent is
 * endless and one 171 s loop heard six times in a run is six times the same
 * three minutes. They alternate 1-2-1-2 forever.
 *
 * MUSIC AND GRID ARE PAIRED HERE, in one literal, and that is the whole reason
 * this list is in this file rather than split between here and main.js. The
 * course is BUILT from the beat grid — `planGates` walks `grid.beats` and
 * `energyCurve(grid)` — so a buffer playing against the wrong grid is not a
 * wrong note, it is a slalom placed against music that is not playing, with no
 * error anywhere to say so. One list, one index, no way to pair them wrongly.
 *
 * `sunrise_ascent` was not generated for this; it already existed in the repo
 * (swoon's track pool) and was chosen by measurement. Its grid is BETTER than
 * carve's own — quality 4.128 against 1.70, tempo drift 0.0 against 36.7 — and
 * at 109.97 BPM against 109.988 it is the same tempo, so the two sit together
 * without the slalom changing character at the seam. Decoded length 167.602 s
 * against a stated 167.6, which is the check that matters: the grid's duration
 * is what the scheduler uses as the hand-over instant.
 *
 * A different tempo would also have been fine. `chooseSpacing` picks gate
 * spacing in SECONDS and snaps it to a musical subdivision precisely so that
 * "a fixed beat count gives a comfortable slalom at 112 BPM and an unridable
 * one at 172" — so this list can take anything the beatgrid tool will track.
 */
const TRACKS = [
  { id: 'carve_theme', music: '/audio/theme.mp3', grid: '/tracks/drift.json' },
  { id: 'sunrise_ascent', music: '/audio/sunrise_ascent.mp3', grid: '/tracks/sunrise_ascent.json' },
];

/** How far ahead sources are scheduled, seconds. */
const SCHEDULE_AHEAD = 12;

/**
 * The sampled effects. All CC0 from freesound.org, trimmed, high-passed,
 * level-matched and encoded mono offline — see assets/audio/CREDITS.md
 * for the provenance of each one. 86 kB the whole set.
 */
const SFX = {
  edgePiste: '/audio/edge_piste.mp3',
  edgePowder: '/audio/edge_powder.mp3',
  landA: '/audio/land_a.mp3',
  landB: '/audio/land_b.mp3',
  crash: '/audio/crash.mp3',
  mote: '/audio/mote.mp3',
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The mix's own levels, named because the host's mute switches now multiply
 *  them and an unmute has to have something to restore to. */
const MIX = { master: 0.9, music: 0.70, sfx: 0.55, ride: 1.0 };

export class Audio {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'interactive' });

    this.master = this.ctx.createGain();
    this.master.gain.value = MIX.master;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = MIX.music;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicFilter.Q.value = 0.6;
    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = MIX.sfx;
    this.sfxGain.connect(this.master);

    // The continuous layers get their own fader. They are the only thing in the
    // mix that is never not playing, so the one number that decides whether the
    // game feels cold and open or busy is this one, and it should be reachable
    // without touching six constants.
    this.rideGain = this.ctx.createGain();
    this.rideGain.gain.value = MIX.ride;
    this.rideGain.connect(this.master);

    // Host settings, until one arrives. Defaults must be "everything on": a
    // host that never sends `settings` must not leave the game silent.
    this._muteMusic = false;
    this._muteSfx = false;
    this._masterScale = 1;

    /** @type {{id:string, buffer:AudioBuffer, grid:object, duration:number}[]} */
    this.tracks = [];
    /** Sources scheduled but not yet finished, newest last. */
    this._scheduled = [];
    this._nextIdx = 0;
    this._nextAt = 0;
    this._nextInto = 0;
    this.startedAt = 0;
    this.playing = false;
    this._pausedAt = 0;
    this._loops = false;

    /** Decoded effects by key; a key present and null means it failed to load. */
    this.sfx = {};
    this.sfxMissing = [];
    /** Live one-shot voices, and the high water mark. Read by QA. */
    this.voices = 0;
    this.peakVoices = 0;
    this._poolI = 0;
    this._landI = 0;
    this._moteAt = 0;
  }

  /**
   * Decode every track and fetch its grid.
   *
   * THE DURATION USED EVERYWHERE IS THE GRID'S, not the buffer's. They agree to
   * 2 ms or better on both tracks, and the grid's is the one the course, the
   * mood and the hand-over instant are all expressed in — taking the buffer's
   * would put the scheduler a couple of milliseconds away from every other
   * consumer of the same number, for no gain.
   */
  async load() {
    this.tracks = await Promise.all(TRACKS.map(async (t) => {
      const [mRes, gRes] = await Promise.all([fetch(t.music), fetch(t.grid)]);
      if (!mRes.ok) throw new Error(`music ${mRes.status} ${t.music}`);
      if (!gRes.ok) throw new Error(`grid ${gRes.status} ${t.grid}`);
      const [bytes, grid] = await Promise.all([mRes.arrayBuffer(), gRes.json()]);
      const buffer = await this.ctx.decodeAudioData(bytes);
      return { id: t.id, buffer, grid, duration: grid.durationSec };
    }));
    // ORDER, NOT CONTENTS. Every track stays decoded and addressable; the order
    // is which of them this run plays and in what sequence. A mode sets it (see
    // `setOrder`), so chill vibe can run the 1-2-1-2 playlist while the race
    // runs a single track — without either of them re-decoding anything, and
    // without `tracks` indices shifting under the segment planner.
    this.order = this.tracks.map((_, i) => i);
    this._recomputeCycle();
    console.log(`[carve] playlist ${this.tracks.length} tracks, cycle ${this.cycleSec.toFixed(1)}s — `
      + this.tracks.map((t) => `${t.id} ${t.duration.toFixed(1)}s @${t.grid.bpm}`).join(', '));
    this.buffer = this.tracks[0].buffer;
    // Effects decode here, at boot, and not lazily. decodeAudioData while the
    // run is live would compete with the frame budget on a mid-range phone, and
    // an effect that arrives after the moment it belonged to is worse than one
    // that never arrives at all. This call cannot throw.
    await this.loadSfx();
    return this.buffer.duration;
  }

  /**
   * Decode the sampled effects. Never rejects and never throws: a failure is
   * recorded in `sfxMissing` and the event concerned falls back to synthesis.
   */
  async loadSfx() {
    const one = async (key, url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        this.sfx[key] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        this.sfx[key] = null;
        this.sfxMissing.push(key);
        console.warn(`[carve] sfx "${key}" unavailable, synthesising instead`, err);
      }
    };
    await Promise.all(Object.entries(SFX).map(([k, u]) => one(k, u)));
    if (this.sfxMissing.length) {
      console.warn(`[carve] ${this.sfxMissing.length}/${Object.keys(SFX).length} effects missing`);
    }
    // The samples may land after the player has already tapped start.
    this._startEdgeLayers();
    return this.sfxMissing.length === 0;
  }

  /** Must be called from a user gesture on mobile. */
  /**
   * Is there a context worth talking to?
   *
   * A closed or missing context makes every node call throw, and these voices
   * are decoration -- the caller is a countdown, a gate, a landing. Silence is
   * the right failure. See BAL-591 for what the alternative cost.
   */
  _usable() {
    return !!this.ctx && this.ctx.state !== 'closed';
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this._ensureLoops();
  }

  /**
   * The host's audio settings (BRIDGE.md §4.1 `settings`). New capability: the
   * ad-hoc bridge had no inbound direction at all, so the app's mute switches
   * did not reach the game and a muted phone still played the soundtrack.
   *
   * Applied at the three bus gains and nowhere else. Every one-shot, the ride
   * bed's own faders, `setClarity` and `silenceRide` all keep writing their own
   * nodes; a mute that reached into those would be undone by the next event
   * that touched them.
   *
   * The ride bed follows `sfx`, not `music`: it is the board on the snow.
   */
  /**
   * The hooks `panels.js` takes, so the gear panel never reaches into this
   * module's privates and never learns which audio layer carve has. Reading
   * through a getter rather than a remembered flag is what lets the panel
   * repaint the truth on open when the HOST has changed it behind our back.
   */
  get settingsHooks() {
    return {
      isMusicOn: () => !this._muteMusic,
      setMusicOn: (v) => this.applySettings({ music: !!v }),
      isSfxOn: () => !this._muteSfx,
      setSfxOn: (v) => this.applySettings({ sfx: !!v }),
    };
  }

  applySettings({ music, sfx, master } = {}) {
    if (music !== undefined) this._muteMusic = !music;
    if (sfx !== undefined) this._muteSfx = !sfx;
    if (Number.isFinite(master)) this._masterScale = clamp01(master);
    const t = this.ctx.currentTime;
    // Ramped, not assigned: a step on a live bus is an audible click, and the
    // host can send `settings` mid-run.
    this.master.gain.setTargetAtTime(MIX.master * this._masterScale, t, 0.03);
    this.musicGain.gain.setTargetAtTime(this._muteMusic ? 0 : MIX.music, t, 0.03);
    this.sfxGain.gain.setTargetAtTime(this._muteSfx ? 0 : MIX.sfx, t, 0.03);
    this.rideGain.gain.setTargetAtTime(this._muteSfx ? 0 : MIX.ride, t, 0.03);
  }

  // ── voices ────────────────────────────────────────────────────────────────

  /**
   * Tear a one-shot's node chain down when it ends.
   *
   * Every effect builds a small graph — source, filter, envelope — and hangs it
   * off a bus that lives for the whole session. A GainNode connected to a live
   * destination is still reachable from the audio graph, so it is NOT collected
   * when the last JS reference to it goes. Without this, a three minute run
   * strands something like a thousand nodes on the rendering thread and the
   * context degrades until it stops servicing the clock the gates are read off.
   *
   * @param {AudioScheduledSourceNode} src
   * @param {AudioNode[]} nodes everything downstream of `src` that this effect made
   * @param {number} endsAt context time the source is scheduled to stop
   */
  _voice(src, nodes, endsAt) {
    this.voices++;
    if (this.voices > this.peakVoices) this.peakVoices = this.voices;
    let dead = false;
    const kill = () => {
      if (dead) return;
      dead = true;
      this.voices--;
      try { src.disconnect(); } catch { /* already gone */ }
      for (const n of nodes) {
        try { n.disconnect(); } catch { /* already gone */ }
      }
    };
    src.onended = kill;
    // `onended` does not fire while the context is suspended, and the game
    // suspends nothing but can be backgrounded by the OS mid-effect. The timer
    // is the backstop, given enough slack that it never truncates a live voice.
    setTimeout(kill, Math.max(80, (endsAt - this.ctx.currentTime) * 1000 + 900));
  }

  // ── continuous layers ─────────────────────────────────────────────────────

  _noiseBuffer(seconds = 2) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /**
   * Four takes of noise, cycled.
   *
   * Two reasons, and they are the same reason. Allocating a fresh second of
   * white noise on every gate is ninety kilobytes of garbage every couple of
   * beats, generated on the main thread mid-frame. And a gate fires two hundred
   * times a run: drawing a different take each time is a large part of what
   * stops the two hundredth from being audibly the first.
   */
  _noise() {
    if (!this._pool) {
      this._pool = [];
      for (let i = 0; i < 4; i++) this._pool.push(this._noiseBuffer(1.0));
    }
    this._poolI = (this._poolI + 1) & 3;
    return this._pool[this._poolI];
  }

  /** A looping filtered-noise bed. */
  _noiseLayer(type, freq, q) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.rideGain);
    src.start(0);
    return { src, filter: f, gain: g };
  }

  /**
   * One surface of the board bed: a recorded snowboard slide, looped.
   *
   * The take is level-flattened and equal-power wrapped offline, so `loop` is
   * all that is needed here and the seam sits at the 80th percentile of the
   * material's own sample-to-sample deltas — inside the noise, not on top of it.
   * It starts at a random phase so the two surfaces never line up and beat.
   */
  _edgeLayer(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 240;
    hp.Q.value = 0.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.rideGain);
    src.start(0, Math.random() * buffer.duration);
    return { src, lp, gain: g };
  }

  _startEdgeLayers() {
    if (!this._loops || this.edge) return;
    const piste = this.sfx.edgePiste;
    const powder = this.sfx.edgePowder;
    if (!piste && !powder) return;      // stay on the synthesised edge
    this.edge = {
      piste: piste ? this._edgeLayer(piste) : null,
      powder: powder ? this._edgeLayer(powder) : null,
    };
    // If the files arrived late, retire the fallback rather than stacking on it.
    if (this.edgeSynth) {
      this.edgeSynth.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  _ensureLoops() {
    if (this._loops) return;
    this._loops = true;
    this.wind = this._noiseLayer('lowpass', 500, 0.7);
    this._startEdgeLayers();
  }

  /**
   * @param {number} speedNorm 0..1
   * @param {number} bite 0..1 — how much edge is loaded
   * @param {number} airborne 0..1
   * @param {number} powder 0..1 — 0 on the groomed piste, 1 in untracked snow
   */
  setRide(speedNorm, bite, airborne = 0, powder = 0) {
    if (!this._loops) return;
    const t = this.ctx.currentTime;
    const s = clamp01(speedNorm);
    const b = clamp01(bite);
    const air = clamp01(airborne);
    const w = clamp01(powder);

    this.wind.filter.frequency.setTargetAtTime(320 + s * 900, t, 0.10);
    this.wind.gain.gain.setTargetAtTime(0.020 + s * 0.135 + air * 0.05, t, 0.10);

    // A board is always in contact with the snow, so the bed has a floor and
    // the edge is what rides on top of it. The synthesised version multiplied
    // everything by bite, which meant a rider straight-lining the fall line at
    // ninety made no sound against the mountain at all — the one moment in the
    // game where the speed is highest and least survivable.
    const contact = (0.10 + s * 0.30) * (1 - air);
    const drive = contact * (0.35 + b * 1.25);

    // Pitch is the cue. Snow under a board rises in pitch with the speed it is
    // driven at, and a pitch ramp is read as speed long before a level ramp is.
    const rate = 0.84 + s * 0.34 + b * 0.12;
    // Bright and hard on the edge, dull and rubbing off it.
    const cut = 1800 + s * 7000 + b * 2200;

    if (this.edge) {
      // Equal power across the surface change. A linear crossfade would dip
      // three decibels exactly where the corduroy ends, and the sound cutting
      // out at the edge of the piste would read as a bug that looked deliberate.
      let kp = Math.cos(w * Math.PI * 0.5);
      let kw = Math.sin(w * Math.PI * 0.5);
      // …but only if there are two of them. If one file failed to load, the
      // survivor carries the whole bed and moves its own filter to suggest the
      // surface instead. A half-loaded crossfade that goes silent on the piste
      // would be a worse failure than having no samples at all.
      const solo = !this.edge.piste || !this.edge.powder;
      if (solo) { kp = 1; kw = 1; }
      const set = (layer, gain, mul) => {
        if (!layer) return;
        layer.gain.gain.setTargetAtTime(gain, t, 0.05);
        layer.lp.frequency.setTargetAtTime(cut * mul * (solo ? 1 - w * 0.35 : 1), t, 0.06);
        layer.src.playbackRate.setTargetAtTime(rate * mul, t, 0.08);
      };
      set(this.edge.piste, drive * kp, 1);
      // Powder is heavier and darker than hardpack under the same board.
      set(this.edge.powder, drive * kw * (solo ? 1 : 1.15), 0.92);
    } else {
      // No samples: the original filtered-noise edge, unchanged.
      if (!this.edgeSynth) this.edgeSynth = this._noiseLayer('bandpass', 1800, 1.1);
      this.edgeSynth.filter.frequency.setTargetAtTime(900 + s * 2400 + b * 900, t, 0.06);
      this.edgeSynth.filter.Q.setTargetAtTime(0.7 + b * 1.9, t, 0.10);
      this.edgeSynth.gain.gain.setTargetAtTime(b * (0.05 + s * 0.20) * (1 - air), t, 0.05);
    }
  }

  silenceRide() {
    // The boost surge goes with the wind, and BEFORE the `_loops` guard: it is
    // a one-shot rather than part of the bed, so it exists whether or not the
    // loops were ever built. Pausing or ending a run mid-boost used to leave
    // three seconds of rushing air playing over a still frame.
    if (this._surge) {
      const t0 = this.ctx.currentTime;
      try {
        this._surge.gain.cancelScheduledValues(t0);
        this._surge.gain.setValueAtTime(Math.max(0.0001, this._surge.gain.value), t0);
        this._surge.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      } catch { /* already torn down */ }
      this._surge = null;
    }
    if (!this._loops) return;
    const t = this.ctx.currentTime;
    this.wind.gain.gain.setTargetAtTime(0, t, 0.08);
    if (this.edgeSynth) this.edgeSynth.gain.gain.setTargetAtTime(0, t, 0.06);
    if (this.edge) {
      if (this.edge.piste) this.edge.piste.gain.gain.setTargetAtTime(0, t, 0.06);
      if (this.edge.powder) this.edge.powder.gain.gain.setTargetAtTime(0, t, 0.06);
    }
  }

  // ── music transport ───────────────────────────────────────────────────────

  /**
   * @param {number} offset seconds into the track to start at — for `unpause`,
   *   which resumes where the clock already is.
   *
   * THE SOURCE LOOPS, and `time` does NOT. The descent is endless and the track
   * is 171.52 s, so the audio wraps while the clock keeps counting: `time` stays
   * the run's total elapsed seconds and `lapTime` is the position within the
   * track. Everything that reads the music — the beat grid, the mood — takes
   * `lapTime`; everything that measures the run — the score, the distance, the
   * gate plan's absolute times — takes `time`.
   *
   * The loop points are left at the buffer's own ends deliberately. The decoded
   * buffer is 171.520 s and the analysed grid is 171.520 s — measured, the same
   * to the millisecond — so the default loop is already exactly the musical one,
   * and setting `loopEnd` from the grid would be a second source of truth that
   * could only ever drift from the first.
   *
   * `offset` is taken modulo the buffer for the same reason: an offset past the
   * buffer's end silently plays nothing, and after three minutes of an endless
   * run every pause would be past it.
   */
  /**
   * Start the playlist at `offset` seconds into the RUN (not into a track).
   *
   * `startedAt` still defines the clock exactly as it did when there was one
   * looping buffer: `time` is `currentTime - startedAt`, monotonic, and never
   * wraps. What changed is underneath — instead of one source with `loop = true`
   * there is a queue of sources, each scheduled at the sample-accurate instant
   * the previous one ends. `onended` was the alternative and is not one: it
   * fires on the main thread whenever it gets round to it, and a gap at the
   * hand-over is audible in a way two milliseconds of drift never would be.
   */
  /**
   * @param {number} offset seconds into the playlist to begin at.
   * @param {number} fadeIn seconds to bring the music bus up over. 0 is the
   *   old behaviour and is what `debug` and any internal restart should use.
   *
   * WHY A FADE AND NOT A HARD IN. The track is entered at `musicStart` -- 23
   * seconds into it for the race -- so the first sample the player hears is
   * mid-phrase at full level, which lands as a click followed by a band. The
   * countdown is already running when this fires, so there is somewhere for a
   * fade to live: the music arrives under the last of the numbers instead of
   * on top of them.
   *
   * EXPONENTIAL, not linear. Loudness is roughly the 0.6 power of amplitude, so
   * a linear gain ramp is most of the way there in the first third and reads as
   * a fast fade that then sits still. The ramp starts at 3% rather than at zero
   * because `exponentialRampToValueAtTime` cannot start from silence, and 3% is
   * about -30 dB -- inaudible under a countdown, and close enough to zero that
   * nothing is heard before the fade proper.
   */
  start(offset = 0, fadeIn = 0) {
    this.stop();
    // THE BUS IS RESTORED HERE, and it has to be: `fadeOut` ramps `musicGain`
    // to zero and leaves it there, so a run started after a faded ending would
    // otherwise play in silence with every flag saying it was playing. Written
    // through the same expression `applySettings` uses, so a host mute survives
    // a restart rather than being undone by it.
    clearTimeout(this._fadeTimer);
    const now = this.ctx.currentTime;
    const target = this._muteMusic ? 0 : MIX.music;
    this.musicGain.gain.cancelScheduledValues(now);
    if (fadeIn > 0 && target > 0) {
      this.musicGain.gain.setValueAtTime(target * 0.03, now);
      this.musicGain.gain.exponentialRampToValueAtTime(target, now + fadeIn);
    } else {
      this.musicGain.gain.setTargetAtTime(target, now, 0.02);
    }

    if (!this.tracks.length) return;
    const at = this.locate(offset);
    this._nextIdx = at.index;
    this._nextInto = at.offset;
    this._nextAt = now;
    this.startedAt = now - offset;
    this.playing = true;
    this._scheduleAhead();
    // Topped up on a timer rather than per frame: the game must keep playing
    // through a stalled rAF (a backgrounded tab throttles it to once a second
    // or stops it entirely) and the music is the clock everything else reads.
    clearInterval(this._schedTimer);
    this._schedTimer = setInterval(() => this._scheduleAhead(), 2000);
  }

  /**
   * Choose which tracks this run plays, and in what order.
   *
   * @param {string[]} ids track ids; unknown ones are ignored, and an empty
   *   result falls back to everything rather than to silence — a mode with a
   *   typo in its list should sound wrong, not broken.
   */
  setOrder(ids) {
    const want = (ids ?? [])
      .map((id) => this.tracks.findIndex((t) => t.id === id))
      .filter((i) => i >= 0);
    this.order = want.length ? want : this.tracks.map((_, i) => i);
    this._recomputeCycle();
  }

  _recomputeCycle() {
    this.cycleSec = this.order.reduce((a, i) => a + this.tracks[i].duration, 0);
  }

  /** The track this playlist SEGMENT plays — segment n, wrapping. */
  trackAt(n) {
    const o = this.order;
    return this.tracks[o[((n % o.length) + o.length) % o.length]];
  }

  /** Which track is playing at run time `t`, and how far into it. */
  locate(t) {
    if (!this.tracks.length) return { index: 0, offset: 0 };
    let r = ((t % this.cycleSec) + this.cycleSec) % this.cycleSec;
    // Walks the ORDER, so `index` is the position in the playlist and not in
    // the decoded set — `trackAt` is what turns one into the other.
    let i = 0;
    while (i < this.order.length - 1 && r >= this.tracks[this.order[i]].duration) {
      r -= this.tracks[this.order[i]].duration;
      i++;
    }
    return { index: i, offset: r };
  }

  /** Queue sources until the schedule reaches SCHEDULE_AHEAD seconds out. */
  _scheduleAhead() {
    if (!this.playing) return;
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD;
    let guard = 0;
    while (this._nextAt < horizon && guard++ < 32) {
      const t = this.trackAt(this._nextIdx);
      const src = this.ctx.createBufferSource();
      src.buffer = t.buffer;
      src.connect(this.musicGain);
      // Never schedule in the past: after a stall `_nextAt` can be behind the
      // clock, and `start()` with a past time plays immediately from the wrong
      // place rather than being skipped.
      const when = Math.max(this.ctx.currentTime, this._nextAt);
      src.start(when, this._nextInto);
      // Stopped at the GRID's duration, not left to run to the buffer's end.
      // They differ by a couple of milliseconds and the next source is already
      // scheduled at the grid boundary, so without this the tail of one track
      // overlaps the head of the next.
      src.stop(when + (t.duration - this._nextInto));
      this._scheduled.push(src);
      this._nextAt += t.duration - this._nextInto;
      this._nextInto = 0;
      this._nextIdx++;
    }
    // Release the ones left behind. At a 12 s horizon and ~170 s tracks only two
    // are ever live at once, so anything past the third has certainly finished;
    // without this a long run accumulates one dead BufferSource per track.
    while (this._scheduled.length > 3) {
      const src = this._scheduled.shift();
      try { src.disconnect(); } catch { /* already gone */ }
    }
  }

  /** Position within the CURRENT track, seconds. */
  get lapTime() {
    return this.locate(this.time).offset;
  }

  /** Index of the track currently playing. */
  get trackIndex() {
    return this.locate(this.time).index;
  }

  /** The grid of the track currently playing — what the mood and HUD read. */
  get grid() {
    return this.tracks.length ? this.trackAt(this.trackIndex).grid : null;
  }

  /** Which pass over the WHOLE playlist the run is on. 0 is the first. */
  get lap() {
    return this.cycleSec > 0 ? Math.floor(this.time / this.cycleSec) : 0;
  }

  stop() {
    clearInterval(this._schedTimer);
    for (const src of this._scheduled) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* already gone */ }
    }
    this._scheduled.length = 0;
    this.source = null;
    this.playing = false;
  }

  pause() {
    if (!this.playing) return;
    this._pausedAt = this.time;
    this.stop();
    this.silenceRide();
  }

  unpause() {
    if (this.playing || !this.tracks.length) return;
    this.start(this._pausedAt);
  }

  /** Authoritative track position, in seconds. */
  get time() {
    if (!this.playing) return this._pausedAt;
    return this.ctx.currentTime - this.startedAt;
  }

  /** The CURRENT track's length. `cycleSec` is the whole playlist's. */
  get duration() {
    return this.tracks.length ? this.trackAt(this.trackIndex).duration : 0;
  }

  /** 0 = fully muffled, 1 = wide open. Muffles on a wipeout. */
  setClarity(k) {
    const f = 420 + Math.pow(clamp01(k), 2) * 19580;
    this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.09);
  }

  // ── one-shots ─────────────────────────────────────────────────────────────

  _env(node, t0, attack, decay, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    g.connect(this.sfxGain);
    return g;
  }

  _tone(from, to, { type = 'triangle', attack = 0.005, decay = 0.18, gain = 0.5, delay = 0 } = {}) {
    if (!this._usable()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + attack + decay);
    const g = this._env(osc, t0, attack, decay, gain);
    osc.start(t0);
    const end = t0 + attack + decay + 0.05;
    osc.stop(end);
    this._voice(osc, [g], end);
  }

  _burst({ duration = 0.25, gain = 0.4, from = 6000, to = 400, type = 'bandpass', q = 1.2, delay = 0 } = {}) {
    if (!this._usable()) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + duration);
    src.connect(f);
    const g = this._env(f, t0, 0.008, duration, gain);
    // A random window into the take, so two bursts of the same shape are still
    // two different bursts — but never so far in that the take runs out before
    // the envelope does, which would truncate the longest of these.
    src.start(t0, Math.random() * Math.max(0, src.buffer.duration - duration - 0.05));
    const end = t0 + duration + 0.05;
    src.stop(end);
    this._voice(src, [f, g], end);
  }

  /**
   * Fire a decoded effect, or report that it is not there.
   *
   * @returns {boolean} false if the file failed to load, so the caller can fall
   *   through to the synthesised version rather than playing nothing.
   */
  _sample(key, { gain = 0.6, rate = 1, delay = 0, lowpass = 0, highpass = 0 } = {}) {
    const buf = this.sfx[key];
    if (!buf) return false;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const chain = [];
    let node = src;
    if (highpass > 0) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = highpass;
      hp.Q.value = 0.6;
      node.connect(hp);
      node = hp;
      chain.push(hp);
    }
    if (lowpass > 0) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      lp.Q.value = 0.7;
      node.connect(lp);
      node = lp;
      chain.push(lp);
    }
    // No envelope: every take is already trimmed to its onset and faded out
    // offline, so shaping it again here would only round off the attack that
    // the trimming existed to preserve.
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    const len = buf.duration / rate;
    node.connect(g);
    g.connect(this.sfxGain);
    chain.push(g);

    src.start(t0);
    const end = t0 + len + 0.02;
    src.stop(end);
    this._voice(src, chain, end);
    return true;
  }

  /**
   * Passing between the poles: a short whip of air.
   *
   * Two hundred of these a run, so it stays synthesised and it is jittered on
   * every fire. A recording repeated at that rate is the single most reliable
   * way to make someone mute a game.
   */
  gate() {
    const j = 1 + (Math.random() - 0.5) * 0.24;
    this._burst({
      duration: 0.19 + Math.random() * 0.03, gain: 0.27 + Math.random() * 0.06,
      from: 900 * j, to: 5200 * j, type: 'bandpass', q: 1.6,
    });
  }

  /**
   * A TIME GATE. Rises, because the number it pays goes up -- two quick
   * partials a fifth apart with a bright tail, unmistakably not the slalom
   * gate's single whip and smaller than the boost's whole gesture.
   */
  timeGate() {
    // THE MOTE'S OWN VOICE, PITCHED -- "you can pitch the motes or something in
    // that world." The gate already wears the mote's colour because both pay
    // time; now it speaks mote too: the same crystal sample a fifth DOWN (a
    // bigger object is a lower note) with the root landing on top, so a gate
    // reads as a large mote and not as a third instrument. The synth sweep
    // survives only as the fallback for the moment before samples load.
    const low = this._sample('mote', { rate: Math.pow(2, -7 / 12), gain: 0.5, highpass: 500 });
    this._sample('mote', { delay: 0.07, rate: 1, gain: 0.4, highpass: 700 });
    if (!low) {
      this._tone(740, 1108, { decay: 0.12, gain: 0.22 });
      this._tone(1108, 1108, { decay: 0.16, gain: 0.2, delay: 0.09 });
    }
    this._burst({ duration: 0.14, gain: 0.1, from: 2600, to: 6800, type: 'bandpass', q: 2.2 });
  }

  missed() {
    this._tone(320, 190, { type: 'sine', attack: 0.006, decay: 0.22, gain: 0.30 });
  }

  /**
   * A BOOST GATE. The same gesture as `gate()`, at a completely different size.
   *
   * Three parts, and the third is the one that matters:
   *
   *   the whip   a gate's burst an octave lower and twice as long, so the ear
   *              hears the family resemblance and then hears that this one is
   *              bigger. Slalom gate and boost gate are the same event; only
   *              the stakes differ, and the sound should say only that.
   *   the thump  a sine dropping to sub. No library take of moving air carries
   *              sixty hertz, and the shove has no weight without it.
   *   the surge  filtered noise for EXACTLY as long as the boost lasts.
   *
   * The surge is the argument for this method existing at all. A boost is not
   * an instant, it is three seconds of held speed, and a one-shot at the front
   * of it tells you a boost STARTED and then leaves you guessing when it ends.
   * The bandpass climbs while the speed floor is ramping in, sits while you are
   * riding it, and falls away as it expires — so the sound is a readout of the
   * one number the player cannot see. When you hear it go, it is gone.
   *
   * Deliberately untuned: noise, not pitch. Both tracks have to survive one of
   * these every few beats, and anything with a fundamental would be in the
   * wrong key half the time. The only tonal content is the thump, which is
   * below where the music is doing any harmonic work.
   *
   * @param {number} seconds how long the boost itself runs — `BOOST.seconds`.
   */
  boost(seconds = 3.0) {
    const t0 = this.ctx.currentTime;

    this._burst({ duration: 0.34, gain: 0.40, from: 520, to: 6400, type: 'bandpass', q: 1.1 });
    this._tone(170, 58, { type: 'sine', attack: 0.004, decay: 0.30, gain: 0.5 });

    // The climb has to finish before the hold starts and the hold before the
    // fall, or the ramps land out of order and the whole envelope inverts. The
    // floors below are what make that true for any `seconds` a mode picks,
    // including one shorter than the climb.
    const RISE = 0.45;
    const fHold = Math.max(RISE + 0.05, seconds - 0.7);
    const gHold = Math.max(0.19, seconds - 0.55);

    // ONE SURGE AT A TIME, because there is only ever one boost. Gates land as
    // little as two seconds apart and `Rider.boost` takes the MAX of the
    // remaining time and the new one — it refreshes, it does not stack. Two
    // surges sounding together would report two boosts where the rider has
    // one, and at double gain. So the outgoing one is ramped out over 60 ms
    // rather than cut: `stop()` on a noise source mid-buffer is a click.
    if (this._surge) {
      const old = this._surge;
      try {
        old.gain.cancelScheduledValues(t0);
        old.gain.setValueAtTime(Math.max(0.0001, old.gain.value), t0);
        old.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      } catch { /* already torn down */ }
    }

    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    // Looped, because the pool's takes are one second and this runs for three.
    // A second of white noise through a moving bandpass has no audible period.
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(240, t0);
    bp.frequency.exponentialRampToValueAtTime(2300, t0 + RISE);
    bp.frequency.setValueAtTime(2300, t0 + fHold);
    bp.frequency.exponentialRampToValueAtTime(380, t0 + seconds);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.30, t0 + 0.13);
    g.gain.setValueAtTime(0.30, t0 + gHold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds + 0.06);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    const end = t0 + seconds + 0.12;
    src.stop(end);
    this._voice(src, [bp, g], end);

    // Held only so the NEXT boost can find it, and cleared by identity so a
    // surge that has already been replaced cannot null out its replacement.
    this._surge = g;
    setTimeout(() => { if (this._surge === g) this._surge = null; },
      (end - this.ctx.currentTime) * 1000 + 50);
  }


  /** A finished carve. Rises with the streak — the ramp is the reward. */
  carveReward(step = 0) {
    const steps = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
    const semis = steps[Math.min(steps.length - 1, step)];
    const f = 392 * Math.pow(2, semis / 12);
    this._tone(f, f * 1.5, { type: 'triangle', attack: 0.005, decay: 0.20, gain: 0.26 });
  }

  takeoff() {
    this._burst({ duration: 0.24, gain: 0.28, from: 400, to: 2600, type: 'bandpass', q: 0.9 });
  }

  /**
   * Board back on snow.
   *
   * Layered, because the two halves of a landing want different things. The
   * weight is a synthesised sub — no library take of snow carries forty-six
   * hertz and the encode would throw it away if it did — and the snow itself is
   * recorded, because a filter bank cannot do the granularity of it.
   *
   * The two takes alternate. A run of rollers fires this four times in ten
   * seconds, and one sample four times running reads as a machine gun.
   */
  land(impact = 10, clean = true) {
    const k = Math.min(1, impact / 26);
    this._tone(130 - k * 40, 46, { type: 'sine', attack: 0.004, decay: 0.24 + k * 0.2, gain: 0.4 + k * 0.4 });
    this._landI ^= 1;
    const played = this._sample(this._landI ? 'landA' : 'landB', {
      gain: 0.42 + k * 0.52,
      // A heavier landing is a deeper one, and it opens up: at speed the snow
      // sprays rather than thumps.
      rate: 1.08 - k * 0.22 + (Math.random() - 0.5) * 0.07,
      lowpass: 2600 + k * 12000,
      highpass: 160,
    });
    if (!played) {
      this._burst({ duration: 0.30 + k * 0.2, gain: 0.26 + k * 0.24, from: 2800, to: 320, type: 'lowpass', q: 0.7 });
    }
    if (clean) this._tone(660, 990, { type: 'triangle', attack: 0.004, decay: 0.14, gain: 0.16, delay: 0.05 });
  }

  crash() {
    this._tone(150, 38, { type: 'sine', attack: 0.004, decay: 0.5, gain: 0.9 });
    const played = this._sample('crash', {
      gain: 0.92, rate: 0.94 + Math.random() * 0.10, highpass: 120,
    });
    if (!played) {
      this._burst({ duration: 0.55, gain: 0.55, from: 3200, to: 110, type: 'lowpass', q: 0.8 });
      this._burst({ duration: 0.9, gain: 0.20, from: 900, to: 200, type: 'bandpass', q: 0.5, delay: 0.09 });
    }
  }

  /**
   * One mote off a drift line.
   *
   * The ladder is a minor pentatonic, which is what lets a chain be consonant
   * with a track this file has never analysed — and lets any SUBSET of it be,
   * which matters, because a rider who cuts across a line takes the third, the
   * fourth and the seventh rather than one, two, three. It climbs because the
   * value does: pickups.js pays 10, 15, 20, 25 down a chain and grows the
   * crystals to say so, and a rising ladder is the only way that reads at
   * ninety kilometres an hour.
   *
   * @param {number} k how many have been taken from this chain already, 0-based
   */
  pickup(k = 0) {
    const semis = [0, 3, 5, 7, 10, 12, 15, 19];
    const s = semis[Math.min(semis.length - 1, Math.max(0, k))];
    // Never two on the same instant. The collection test is swept against the
    // previous position, so a stalled frame can take two motes at once, and two
    // crystals on the same sample are one click rather than two notes.
    //
    // The queue is CLAMPED to a fifth of a second ahead of now. A chain is at
    // most eight motes so it can never legitimately build a longer backlog than
    // that, and without the clamp a caller that fired a hundred of these would
    // schedule crystals four seconds into a future that has moved on.
    const now = this.ctx.currentTime;
    const at = Math.min(now + 0.20, Math.max(now, this._moteAt + 0.045));
    this._moteAt = at;
    const played = this._sample('mote', {
      delay: at - now,
      rate: Math.pow(2, s / 12),
      // Higher is brighter, so it needs less level to be heard as loudly.
      gain: 0.34 - k * 0.014,
      highpass: 900,
    });
    if (!played) {
      const f = 1046.5 * Math.pow(2, s / 12);
      this._tone(f, f, { type: 'sine', attack: 0.003, decay: 0.16, gain: 0.20, delay: at - now });
    }
  }

  /**
   * A drift line settling. One event per chain, matching how it is scored.
   *
   * A whole line is worth about three gates and is the best thing a rider can
   * do between two of them, so it gets a cascade; a sampled line gets almost
   * nothing, because it is worth almost nothing and the sound should say so
   * before the number does.
   */
  driftLine(taken = 0, total = 8, full = false) {
    if (taken <= 0) return;
    if (!full) {
      // Seven of eight is nearly the whole wager and two of eight is a sample;
      // the note says which before the number does.
      const part = Math.min(1, taken / Math.max(1, total));
      this._tone(392, 392, {
        type: 'triangle', attack: 0.006, decay: 0.12 + part * 0.10, gain: 0.10 + part * 0.08,
      });
      return;
    }
    [0, 7, 12].forEach((s, i) => {
      if (!this._sample('mote', { rate: Math.pow(2, (12 + s) / 12), gain: 0.20, delay: i * 0.055, highpass: 900 })) {
        this._tone(1046.5 * Math.pow(2, s / 12), 1046.5 * Math.pow(2, s / 12),
          { type: 'sine', attack: 0.003, decay: 0.14, gain: 0.16, delay: i * 0.055 });
      }
    });
    [0, 7, 16].forEach((s, i) => this._tone(
      261.63 * Math.pow(2, s / 12), 261.63 * Math.pow(2, s / 12),
      { type: 'triangle', attack: 0.012, decay: 0.45, gain: 0.15, delay: 0.02 + i * 0.06 },
    ));
  }

  /**
   * An aerial trick, landed. Fires straight after `land()`, which has already
   * played the snow — this is the reward on top of the physical event, and a
   * reward has to agree with the music, so it is pitched rather than recorded.
   *
   * @param {number} value the trick's own score, before the multiplier
   */
  trick(value = 0) {
    const big = Math.min(1, value / 400);
    const steps = big > 0.75 ? [0, 7, 12, 19] : big > 0.40 ? [0, 7, 12] : [0, 7];
    steps.forEach((s, i) => {
      const f = 392 * Math.pow(2, s / 12);
      this._tone(f, f, {
        type: 'triangle', attack: 0.006, decay: 0.30 - i * 0.03,
        gain: 0.19 + big * 0.09, delay: 0.06 + i * 0.075,
      });
    });
    // Only the biggest tricks get the crystal on top, or it stops meaning it.
    if (big > 0.75) this._sample('mote', { rate: 2, gain: 0.18, delay: 0.06, highpass: 900 });
  }

  /**
   * The multiplier stepping up.
   *
   * At pace this fires every four scoring events, which is every eight seconds
   * or so — the most frequent reward in the game. So it is two blips of sixty
   * milliseconds and nothing else. Anything with a tail would still be sounding
   * when the next gate arrived.
   */
  comboUp(mult = 2) {
    const s = Math.min(5, Math.max(0, mult - 2)) * 2;
    const f = 587.33 * Math.pow(2, s / 12);
    this._tone(f, f, { type: 'triangle', attack: 0.003, decay: 0.07, gain: 0.15 });
    this._tone(f * 1.5, f * 1.5, { type: 'triangle', attack: 0.003, decay: 0.10, gain: 0.12, delay: 0.075 });
  }

  countdown(final = false) {
    if (final) this._tone(880, 1760, { type: 'square', attack: 0.004, decay: 0.32, gain: 0.36 });
    else this._tone(440, 440, { type: 'square', attack: 0.004, decay: 0.14, gain: 0.25 });
  }

  /**
   * Ride the music down instead of cutting it.
   *
   * `stop()` severs a buffer source mid-sample, which is a click and then
   * nothing — fine for a crash, wrong for the end of a run that is supposed to
   * feel like coming to rest. The gain is ramped and the source is stopped only
   * once the ramp has finished, or the fade is a hard cut with extra steps.
   *
   * `playing` goes false immediately so nothing treats the tail as a live
   * transport, and the source is captured in the closure rather than read off
   * `this` — a restart during the fade calls `stop()`, and the timer must not
   * then reach in and stop the NEW source a second later.
   */
  fadeOut(seconds = 1.8) {
    if (!this.playing || !this._scheduled.length) return;
    const srcs = this._scheduled.slice();
    const t = this.ctx.currentTime;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + seconds);
    this.playing = false;
    clearInterval(this._schedTimer);
    this._scheduled.length = 0;
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      for (const src of srcs) {
        try { src.stop(); } catch { /* already stopped */ }
        try { src.disconnect(); } catch { /* already gone */ }
      }
    }, seconds * 1000 + 150);
  }

  /**
   * The run coming to rest.
   *
   * `gameOver` is a sawtooth falling 300 Hz to 60 with a noise burst behind it —
   * a death, which is what running out of lives was. The run now ends because a
   * clock reached zero on a mountain that never ends, and that is not a death;
   * it is a stop. Descending where `finish` ascends, four times the decay, half
   * the gain, and a slow enough attack that nothing in it snaps.
   */
  settle() {
    [12, 7, 4, 0].forEach((semi, i) => {
      const f = 523.25 * Math.pow(2, semi / 12);
      this._tone(f, f, {
        type: 'triangle', attack: 0.05, decay: 1.5, gain: 0.17, delay: i * 0.22,
      });
    });
  }

  gameOver() {
    this._tone(300, 60, { type: 'sawtooth', attack: 0.01, decay: 0.95, gain: 0.5 });
    this._burst({ duration: 0.9, gain: 0.32, from: 1600, to: 80, type: 'lowpass' });
  }

  finish() {
    [0, 4, 7, 12].forEach((s, i) =>
      this._tone(523.25 * Math.pow(2, s / 12), 523.25 * Math.pow(2, s / 12), {
        type: 'triangle', attack: 0.01, decay: 0.55, gain: 0.32, delay: i * 0.085,
      }));
  }

  /** Everything QA needs to prove the graph is not growing. */
  debug() {
    return {
      state: this.ctx.state,
      voices: this.voices,
      peakVoices: this.peakVoices,
      sampled: Object.keys(SFX).filter((k) => this.sfx[k]),
      missing: [...this.sfxMissing],
      edge: this.edge ? 'sampled' : this.edgeSynth ? 'synthesised' : 'idle',
      musicPlaying: this.playing,
      trackTime: +this.time.toFixed(3),
    };
  }
}

/**
 * The measured beat list as a decaying 0..1 pulse for the visuals.
 *
 * Reads the `beats` array rather than bpm*n for the reason the toolchain warns
 * about: generated audio drifts, and a synthetic grid is inverted by the outro.
 */
export class BeatPulse {
  constructor(beats) {
    this.beats = beats;
    this.i = 0;
    this.value = 0;
    this.justFired = false;
  }

  reset() {
    this.i = 0;
    this.value = 0;
  }

  update(dt, time) {
    this.justFired = false;
    if (this.i > 0 && this.beats[this.i - 1] > time) {
      this.i = this.beats.findIndex((b) => b > time);
      if (this.i < 0) this.i = this.beats.length;
    }
    while (this.i < this.beats.length && this.beats[this.i] <= time) {
      this.i++;
      this.value = 1;
      this.justFired = true;
    }
    this.value = Math.max(0, this.value - dt * 3.2);
    return this.value;
  }
}
