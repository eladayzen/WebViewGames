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
// object. Mute/currently-playing-music state IS per-instance state, mirroring
// systems/juice.js's createJuice()/resetJuice() pattern, so it resets
// cleanly on restart like every other system.
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

let ctx = null;

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
  return {
    muted: false,
    musicSource: null,
    musicGain: null,
  };
}

export function resetAudio(audio) {
  stopMusic(audio);
  audio.muted = false;
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.musicGain) {
    audio.musicGain.gain.value = muted ? 0 : MUSIC_VOLUME;
  }
}

export function toggleMuted(audio) {
  setMuted(audio, !audio.muted);
  return audio.muted;
}

// Fresh BufferSource per play, not a reused <audio> element -- <audio> tags
// clip/restart when replayed rapidly (e.g. two quick pizza catches back to
// back), while a new WebAudio node per trigger overlaps itself cleanly.
export function playSfx(audio, buffer, volume = SFX_VOLUME) {
  if (!buffer || audio.muted) return;
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

export function startMusic(audio, buffer, volume = MUSIC_VOLUME) {
  if (!buffer) return;
  const c = getContext();
  if (!c) return;
  stopMusic(audio);
  try {
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = c.createGain();
    gain.gain.value = audio.muted ? 0 : volume;
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
