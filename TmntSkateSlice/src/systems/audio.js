// Lightweight WebAudio layer (2026-07-26). Buffers are decoded in
// core/assets.js alongside sprite images and passed in per call here -- same
// "best-effort, missing clip = silent no-op" philosophy render.js already
// uses for sprites that haven't been generated yet. Nothing in this file is
// ever load-bearing: every browser call is try/caught so a WebAudio failure
// (unsupported browser, autoplay block, whatever) degrades to silence, never
// a broken game -- the same contract index.html's rAF shim holds for frame
// callbacks.
//
// AudioContext is a genuine page-singleton (only ever one game instance per
// page load), so it lives at module scope rather than in the returned state
// object. Currently-playing-music state IS per-instance state, mirroring
// systems/juice.js's createJuice()/resetJuice() pattern -- but sfxEnabled/
// musicEnabled (2026-08-19) are a persisted DEVICE preference layered on
// top, not per-run state, so resetAudio deliberately leaves them alone; see
// get/setSfxEnabled and get/setMusicEnabled below.
//
// Browsers (and WKWebView) block audio playback until a real user gesture.
// This module self-installs a one-time listener for the first
// pointerdown/touchstart/keydown anywhere on the page to unlock the context
// -- callers don't need to wire that up themselves. It also resumes the
// context on visibilitychange, defensively: there's no confirmed precedent
// in this repo for whether WKWebView suspends AudioContext under Unity's
// overlay the same way it suspends requestAnimationFrame (see index.html),
// so this is a cheap guard against an unverified-on-device gotcha, not a
// solved problem copied from elsewhere.

const SFX_VOLUME = 0.6;
const MUSIC_VOLUME = 0.35;
const STORAGE_KEY = 'tss:audio';

let ctx = null;
// The one audio state object in play (there is only ever one game instance
// per page load, same assumption this file's header comment already makes
// for AudioContext) -- lets the independent get/setSfxEnabled and
// get/setMusicEnabled below (2026-08-19, settings-panel feature) reach the
// live state without main.js having to thread its local `audio` variable
// through ui/settingsPanel.js. Set once, in createAudio().
let activeAudio = null;

function getContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch (err) {
    ctx = null;
  }
  return ctx;
}

function resumeIfSuspended() {
  const c = getContext();
  if (c && c.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    resumeIfSuspended();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('touchstart', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('touchstart', unlockOnce);
  window.addEventListener('keydown', unlockOnce);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeIfSuspended();
  });
}

// Fetches + decodes one audio file. Returns null (never throws) on any
// failure -- a missing/undecoded clip is exactly as safe as a missing sprite.
export async function loadAudioBuffer(src) {
  const c = getContext();
  if (!c) return null;
  try {
    const res = await fetch(src);
    const arrayBuffer = await res.arrayBuffer();
    return await c.decodeAudioData(arrayBuffer);
  } catch (err) {
    return null;
  }
}

export function createAudio() {
  const audio = {
    sfxEnabled: true,
    musicEnabled: true,
    musicSource: null,
    musicGain: null,
    // Remembered so setMusicEnabled(true) can restart the loop without its
    // caller (the settings panel) re-passing the buffer it never had.
    musicBuffer: null,
  };
  loadPrefs(audio);
  activeAudio = audio;
  return audio;
}

// sfxEnabled/musicEnabled are a persisted DEVICE preference (see
// get/setSfxEnabled, get/setMusicEnabled below), loaded once here and
// written back on every change -- independent of resetAudio, which only
// clears per-run playback state.
function loadPrefs(audio) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.sfx === 'boolean') audio.sfxEnabled = saved.sfx;
    if (typeof saved.music === 'boolean') audio.musicEnabled = saved.music;
  } catch (err) {
    // localStorage can throw outright in a restricted WebView (private
    // mode, storage disabled) -- a settings nicety must never take the
    // game down with it, so this just falls back to the defaults above.
  }
}

function savePrefs(audio) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sfx: audio.sfxEnabled, music: audio.musicEnabled }));
  } catch (err) {
    // Non-fatal: the preference just won't survive a reload.
  }
}

// Only per-run playback state resets here -- sfxEnabled/musicEnabled are a
// persisted preference, not run state, and deliberately survive a restart
// (2026-08-19; the old single combined `muted` flag this replaced DID
// reset every run, which read as a bug once music/SFX became independent
// toggles worth remembering).
export function resetAudio(audio) {
  stopMusic(audio);
}

export function getSfxEnabled(audio = activeAudio) {
  return audio ? audio.sfxEnabled : true;
}

export function setSfxEnabled(on, audio = activeAudio) {
  if (!audio) return;
  audio.sfxEnabled = on;
  savePrefs(audio);
}

export function getMusicEnabled(audio = activeAudio) {
  return audio ? audio.musicEnabled : true;
}

// Toggling live (not just the preference): re-starts/stops the loop right
// away so the settings panel reads as doing something, not just remembering
// a value for next launch.
export function setMusicEnabled(on, audio = activeAudio) {
  if (!audio) return;
  audio.musicEnabled = on;
  savePrefs(audio);
  if (on) {
    if (audio.musicBuffer) startMusic(audio, audio.musicBuffer);
  } else {
    stopMusic(audio);
  }
}

// Fresh BufferSource per play, not a reused <audio> element -- <audio> tags
// clip/restart when replayed rapidly (e.g. two quick pizza catches back to
// back), while a new WebAudio node per trigger overlaps itself cleanly.
export function playSfx(audio, buffer, volume = SFX_VOLUME) {
  if (!buffer || !audio.sfxEnabled) return;
  const c = getContext();
  if (!c) return;
  try {
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(c.destination);
    source.start(0);
  } catch (err) {
    // no-op -- see file header
  }
}

// Safe to call unconditionally at boot regardless of the persisted
// preference -- always remembers `buffer` (so a later setMusicEnabled(true)
// has something to restart) but only actually plays it while musicEnabled
// is true, so callers never need their own getMusicEnabled() guard.
export function startMusic(audio, buffer, volume = MUSIC_VOLUME) {
  if (!buffer) return;
  audio.musicBuffer = buffer;
  if (!audio.musicEnabled) return;
  const c = getContext();
  if (!c) return;
  stopMusic(audio);
  try {
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = c.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(c.destination);
    source.start(0);
    audio.musicSource = source;
    audio.musicGain = gain;
  } catch (err) {
    // no-op -- see file header
  }
}

export function stopMusic(audio) {
  if (audio.musicSource) {
    try {
      audio.musicSource.stop();
    } catch (err) {
      // already stopped -- fine
    }
    audio.musicSource = null;
  }
  audio.musicGain = null;
}

// Pause/resume suspend the whole context rather than the individual music
// source (BufferSourceNodes have no native pause) -- safe because nothing
// else should be triggering SFX while the sim itself is paused.
export function pauseMusic() {
  const c = getContext();
  if (c && c.state === 'running') {
    c.suspend().catch(() => {});
  }
}

export function resumeMusic() {
  resumeIfSuspended();
}
