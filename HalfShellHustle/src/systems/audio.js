// SFX + music playback. WebAudio plumbing ported from
// TmntSkateSlice/src/systems/audio.js (fresh BufferSourceNode per SFX call
// so rapid retriggers overlap instead of clipping, unlock-on-gesture, a
// visibilitychange resume) -- but with TWO INDEPENDENT toggles instead of
// one shared mute, direct request: "ability to control sfx on/off, music
// on/off." Also persisted (TmntSkateSlice's was in-memory only), so a
// preference survives a reload.
//
// This file owns the audio state and all WebAudio plumbing; ui/
// steeringPanel.js only renders the two toggle rows and calls into it --
// same ownership split that file already has with input.js for steering.
//
// Fire-and-forget by design: GOBALANCE_SDK.md requires the game reach a
// playable/countdown state on load with no key needed, so nothing here can
// block boot. playSfx/music simply stay silent until their buffer resolves
// and the AudioContext is unlocked by a real gesture.

import { AUDIO_MANIFEST } from '../data/audioAssets.js';

const STORAGE_KEY = 'hsh:audio';
const SFX_VOLUME = 0.6;
const MUSIC_VOLUME = 0.35;

const state = { sfxEnabled: true, musicEnabled: true };

// localStorage can throw outright in a restricted WebView (private mode,
// storage disabled) -- an audio preference must never take the game down
// with it, so both directions are guarded and fall back to defaults.
function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.sfxEnabled === 'boolean') state.sfxEnabled = saved.sfxEnabled;
    if (typeof saved.musicEnabled === 'boolean') state.musicEnabled = saved.musicEnabled;
  } catch {
    // Keep defaults.
  }
}
function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the preference just won't survive a reload.
  }
}
load();

// --- WebAudio context + buffers -------------------------------------------
let ctx = null;
try {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (Ctor) ctx = new Ctor();
} catch {
  ctx = null; // A restricted WebView can throw on construction outright.
}

const buffers = {}; // name -> AudioBuffer, filled in as each one decodes

async function loadAudioBuffer(url) {
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } catch {
    return null; // A missing/corrupt asset must never take the game down.
  }
}

// Browsers (and WKWebView) block audio playback until a real user gesture.
// One-time listener; resumes the EXISTING context rather than deferring its
// construction, since construction itself doesn't need a gesture, only
// starting playback does. A context stays paused (its clock doesn't
// advance) until resumed, so anything scheduled with start(0) before unlock
// simply plays from the beginning once it fires, nothing is skipped.
let unlocked = false;
function installUnlock() {
  if (!ctx) return;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    ctx.resume().catch(() => {});
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('touchstart', unlock);
  window.addEventListener('keydown', unlock);
  // Unverified-on-device gotcha, not a solved problem (same caveat
  // TmntSkateSlice's own audio.js carries): WKWebView MAY suspend the
  // AudioContext the same way it suspends requestAnimationFrame when
  // occluded by Unity's overlay (see index.html's rAF shim comment). Cheap
  // guard against that, not a proven fix.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && unlocked) ctx.resume().catch(() => {});
  });
}

// Call once at boot (core/main.js). Loads every manifest entry in the
// background and installs the unlock listener; music starts itself
// automatically the moment its buffer is ready, IF musicEnabled -- no
// separate "start the music now" call site needed.
export function initAudio() {
  for (const [name, url] of Object.entries(AUDIO_MANIFEST)) {
    loadAudioBuffer(url).then((buf) => {
      if (!buf) return;
      buffers[name] = buf;
      if (name === 'music') tryStartMusic();
    });
  }
  installUnlock();
}

export function playSfx(name) {
  if (!ctx || !state.sfxEnabled) return;
  const buf = buffers[name];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = SFX_VOLUME;
  src.connect(gain).connect(ctx.destination);
  src.start(0);
}

// --- Music: one persistent looping source ----------------------------------
let musicSource = null;
let musicGain = null;

function tryStartMusic() {
  if (!ctx || !state.musicEnabled || musicSource) return;
  const buf = buffers.music;
  if (!buf) return;
  musicSource = ctx.createBufferSource();
  musicSource.buffer = buf;
  musicSource.loop = true;
  musicGain = ctx.createGain();
  musicGain.gain.value = MUSIC_VOLUME;
  musicSource.connect(musicGain).connect(ctx.destination);
  musicSource.start(0);
}

function stopMusic() {
  if (musicSource) {
    try { musicSource.stop(); } catch { /* already stopped */ }
    musicSource.disconnect();
    musicSource = null;
  }
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
}

// --- Toggles, read/written by ui/steeringPanel.js's SFX/MUSIC rows --------
export function getSfxEnabled() { return state.sfxEnabled; }
export function getMusicEnabled() { return state.musicEnabled; }

export function setSfxEnabled(on) {
  state.sfxEnabled = on;
  save();
}

export function setMusicEnabled(on) {
  state.musicEnabled = on;
  save();
  if (on) tryStartMusic();
  else stopMusic();
}

// --- Temporary silence: level transitions AND the pause button -----------
// core/main.js calls these from beginLevelComplete/startNextLevel (direct
// request: "experiment with it stopping the music and then starting back
// when the next level starts") and from the pause toggle (direct request:
// "pause should pause music as well"). Distinct from the MUSIC toggle
// above: this never touches state.musicEnabled or the saved preference, it
// just silences/resumes the CURRENT playback. A BufferSourceNode can't be
// paused and resumed from its own position (only stopped), so "resume"
// restarts the loop from 0 -- fine for a background bed, and resumeMusic
// already no-ops via tryStartMusic's own musicEnabled check if the player
// has music off.
export function pauseMusic() {
  stopMusic();
}
export function resumeMusic() {
  tryStartMusic();
}
