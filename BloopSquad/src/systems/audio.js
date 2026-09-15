// Sound. Entirely synthesised -- no clips, no files, no MIME worries.
//
// WHY SYNTHESIS AND NOT SAMPLES. The brief for the sound is "make it funny",
// and the specific idea is that a monster's hit note RISES as it loses health,
// so chewing through a big one plays a little run up the keyboard and the last
// hit is the punchline. That is a pitch you have to compute per hit, which is
// what oscillators are for and what a folder of .mp3 files can only fake with
// playbackRate. It also means the game ships no audio assets at all, which
// keeps it clear of the host's MIME switch and its lack of HTTP Range support.
//
// THE HOST DOES NOT OWN THIS. `GoBalance.audio` is a stub that always reports
// {volume:1, muted:false} and the app's mute button does not reach the page --
// see GOBALANCE_APP_INTEGRATION.md. Every game starts with sound ON and ships
// its own control. This module is that control.
//
// NOTHING HERE TOUCHES THE AUDIO API AT MODULE LOAD. The systems import cleanly
// into node for headless simulation, and an `new AudioContext()` at import time
// would break that -- as well as being wrong in the browser, where the context
// must be created and resumed from a real user gesture.

const PREF_KEY = 'bloopsquad:audio';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let unlocked = false;

// Read BEFORE the graph is built, not after. Building from defaults and then
// applying the preference means a player who muted the music hears a burst of
// it on every launch -- the one audio bug that is guaranteed to be noticed.
const prefs = loadPrefs();

function loadPrefs() {
  const fallback = { sfx: true, music: true };
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return { sfx: p.sfx !== false, music: p.music !== false };
  } catch (err) {
    // localStorage can throw outright in a restricted WebView, not merely
    // return null. Sound is not worth a boot failure.
    return fallback;
  }
}

function savePrefs() {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (err) { /* see loadPrefs */ }
}

/** Build the graph on first use. Separate buses under a master, so a switch is
 *  one gain write rather than a flag every play path has to remember. */
function ensureCtx() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch (err) {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = prefs.sfx ? 1 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = prefs.music ? 1 : 0;
  musicBus.connect(master);
  return ctx;
}

/**
 * Install the one-time gesture unlock.
 *
 * Browsers block audio until a genuine user gesture and a WebView is stricter,
 * not looser. Self-installed here rather than expected of every call site --
 * a call site that forgets produces a game that is silent until something
 * unrelated happens to touch the context, which is maddening to diagnose.
 */
export function initAudio() {
  if (typeof window === 'undefined' || unlocked) return;
  const unlock = () => {
    unlocked = true;
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('touchstart', unlock);
  window.addEventListener('keydown', unlock);
}

export function getAudioPrefs() {
  return { sfx: prefs.sfx, music: prefs.music };
}

export function setSfxEnabled(on) {
  prefs.sfx = !!on;
  savePrefs();
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(prefs.sfx ? 1 : 0, ctx.currentTime, 0.01);
}

export function setMusicEnabled(on) {
  prefs.music = !!on;
  savePrefs();
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(prefs.music ? 1 : 0, ctx.currentTime, 0.01);
  // Turning music off STOPS the source rather than leaving it playing into a
  // silent gain: a muted oscillator still costs, and a player who comes back
  // should hear the bed from somewhere sensible rather than mid-phrase.
  if (!prefs.music) stopMusic();
}

/** Suspend/resume with the game's pause, through one call so the two can never
 *  drift out of step. */
export function setAudioPaused(paused) {
  if (!ctx) return;
  if (paused && ctx.state === 'running') ctx.suspend().catch(() => {});
  if (!paused && ctx.state === 'suspended' && unlocked) ctx.resume().catch(() => {});
}

/**
 * One synthesised note. Everything in the game is built from this.
 *
 * `bend` slides the pitch over the note's life, which is most of what makes a
 * sound read as cartoonish rather than as a beep: a flat tone is a UI noise, a
 * tone that moves is a character making it.
 */
function note({ freq, dur = 0.12, type = 'square', gain = 0.18, bend = 1, delay = 0, bus = sfxBus }) {
  const c = ensureCtx();
  if (!c || !bus) return;
  if (c.state === 'suspended') return;   // pre-gesture; dropping is correct
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t0 + dur);
  // A hard start clicks; a short attack and an exponential tail does not.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short filtered noise, for pops and thumps. */
function noise({ dur = 0.18, gain = 0.16, hp = 400, delay = 0 }) {
  const c = ensureCtx();
  if (!c || !sfxBus || c.state === 'suspended') return;
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(g); g.connect(sfxBus);
  src.start(t0);
}

// ---------------------------------------------------------------------------
// THE GAME'S SOUNDS
// ---------------------------------------------------------------------------

/**
 * A monster taking a hit. THE JOKE LIVES HERE.
 *
 * `progress` is 0 on the first hit and approaches 1 on the last, and the note
 * climbs a fixed number of semitones across that range. So a small monster is a
 * quick three-note rise and a large one is a long comic ladder that everyone in
 * the room can hear reaching its top -- the kill lands ON the punchline instead
 * of merely after it.
 *
 * Quantised to semitones rather than swept continuously: a smooth glide reads as
 * a machine warming up, discrete steps read as a cartoon character being
 * squeezed. It also means two monsters at different health sound like the same
 * instrument at different notes, rather than like two different effects.
 */
export function playHit(progress) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const SEMITONES = 19;            // a bit over an octave and a half of climb
  const step = Math.round(p * SEMITONES);
  const freq = 210 * Math.pow(2, step / 12);
  note({ freq, dur: 0.075, type: 'square', gain: 0.1, bend: 1.06 });
}

/** A monster popping: nobody dies, so this is a party sound, not an explosion.
 *  A rising two-note blip over a soft burst -- the confetti, in audio. */
export function playPop(progress) {
  const base = 420 + 260 * Math.max(0, Math.min(1, progress || 0));
  note({ freq: base, dur: 0.09, type: 'triangle', gain: 0.16, bend: 1.5 });
  note({ freq: base * 1.5, dur: 0.13, type: 'triangle', gain: 0.13, bend: 1.7, delay: 0.055 });
  noise({ dur: 0.16, gain: 0.1, hp: 900 });
}

/** The cannon. Fires ~6 times a second, so it has to be nearly subliminal --
 *  anything with character becomes torture inside ten seconds. */
export function playShoot() {
  note({ freq: 880, dur: 0.035, type: 'sine', gain: 0.045, bend: 0.7 });
}

/** Collecting a toy: the most cheerful thing in the game, and the only rising
 *  arpeggio, so it is unmistakable even under everything else. */
export function playPickup() {
  const root = 523.25;
  [0, 4, 7, 12].forEach((semi, i) => {
    note({ freq: root * Math.pow(2, semi / 12), dur: 0.13, type: 'triangle', gain: 0.15, delay: i * 0.055 });
  });
}

export function playCoin() {
  note({ freq: 1050, dur: 0.06, type: 'square', gain: 0.07 });
  note({ freq: 1570, dur: 0.09, type: 'square', gain: 0.06, delay: 0.045 });
}

/** The player losing a heart: a comedy descent, not a threat. Failure should be
 *  funny -- the same rule that makes monsters giggle into confetti rather than
 *  die applies to the pod's own bad news. */
export function playPlayerHit() {
  note({ freq: 380, dur: 0.30, type: 'sawtooth', gain: 0.15, bend: 0.42 });
  noise({ dur: 0.2, gain: 0.09, hp: 250 });
}

/** Game over: the descent, slower and lower, three notes. */
export function playGameOver() {
  [0, -3, -7].forEach((semi, i) => {
    note({ freq: 330 * Math.pow(2, semi / 12), dur: 0.34, type: 'triangle', gain: 0.16, delay: i * 0.2 });
  });
}

// ---------------------------------------------------------------------------
// Music: a short looping bed, also synthesised. Deliberately sparse -- it plays
// under everything for an entire run and the hit ladder has to stay audible
// over it, which is the whole point of the sound design.
// ---------------------------------------------------------------------------

let musicTimer = null;
let musicStep = 0;
const BASS = [0, 0, 5, 5, 7, 7, 5, 3];

export function startMusic() {
  if (typeof window === 'undefined' || musicTimer || !prefs.music) return;
  const c = ensureCtx();
  if (!c) return;
  const stepS = 0.32;
  musicTimer = window.setInterval(() => {
    if (!prefs.music || !musicBus) return;
    const semi = BASS[musicStep % BASS.length];
    note({ freq: 110 * Math.pow(2, semi / 12), dur: 0.26, type: 'triangle', gain: 0.10, bus: musicBus });
    if (musicStep % 4 === 0) {
      note({ freq: 440 * Math.pow(2, semi / 12), dur: 0.16, type: 'sine', gain: 0.05, bus: musicBus });
    }
    musicStep++;
  }, stepS * 1000);
}

export function stopMusic() {
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}
