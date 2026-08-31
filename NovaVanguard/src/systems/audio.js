// The audio layer (MVP item 21, §9.3's `/audio` box).
//
// WEBAUDIO, NOT `<audio>` ELEMENTS, and this game is the reason the build doc
// states that as a rule rather than a preference: an HTMLAudioElement has ONE
// playback head, so replaying it mid-sound restarts it and audibly clips. Nova
// Vanguard fires ten bolts a second unconditionally (§5.6's auto-fire) and a
// scatter volley can land three impacts in one frame -- every sound in the game
// is a rapid repeat. So a clip is decoded ONCE into an AudioBuffer and every
// trigger gets a FRESH BufferSourceNode, which overlaps itself cleanly and is
// the node type WebAudio expects to be thrown away after one use.
//
// NOTHING HERE IS EVER LOAD-BEARING. Every browser call is try/caught and every
// entry point no-ops until (or unless) the buffers exist, so a WebAudio failure
// -- unsupported browser, blocked autoplay, a 404 on one clip -- degrades to
// silence and never to a broken game. That is the same contract /render holds
// for a sprite that has not been generated yet, and the same one index.html's
// rAF shim holds for frame callbacks.
//
// THE GESTURE UNLOCK IS SELF-INSTALLED. Mobile WebViews (and desktop browsers)
// refuse to start an AudioContext until a real user gesture, and the SDK runs
// this game inside a WKWebView. Callers do not wire that up: this module listens
// once for the first pointerdown/touchstart/keydown anywhere on the page and
// resumes the context. It also resumes on visibilitychange, defensively -- there
// is no confirmed precedent in this repo for whether WKWebView suspends an
// AudioContext under Unity's overlay the way it suspends requestAnimationFrame
// (see the shim note in index.html), so this is a cheap guard against an
// unverified-on-device gotcha rather than a solved problem copied from
// elsewhere.
//
// THE MIX IS DATA (AUDIO in /data/tuning.js), not constants in this file.
// §9.3's whole argument for one tuning file is that the on-device pass should be
// a config session, and the mix -- especially how far the fire clips sit under
// everything else -- is the thing most likely to need retuning through a phone
// speaker. Nothing below hardcodes a level.
//
// WHY A MODULE SINGLETON rather than an object threaded through update(). An
// AudioContext genuinely is a page singleton (one game instance per page load),
// and sounds have to be triggered from six systems that do not otherwise know
// about each other -- /player, /systems/collision, /systems/pickups,
// /systems/director, /enemies/boss and /surface/transition. Threading a sink
// through every one of those signatures would have been a wide diff for no
// isolation: unlike the renderer's `fx` facade (which exists to keep §9.1's "no
// system touches a renderer API" rule enforceable), there is no layering rule
// here to protect. `sfx('kill')` reads like what it is.

import { AUDIO } from '../data/tuning.js';

// Clip id -> file. Relative paths, exactly as /render/textures.js resolves its
// sprites: the SDK serves the game over a real local HTTP server from the game
// folder's own root (see ../../GOBALANCE_SDK.md), so these resolve against
// index.html either way and there is no base-path special case.
//
// FOUR FIRE CLIPS FOR FIVE WEAPONS is deliberate. The standard bolt and the
// scatter fan share `fire`, because a scatter round IS the standard round --
// three of them in an authored fan (WEAPONS.scatter) -- and giving it a
// different voice would say "different projectile" about a projectile that is
// not. The three weapons that fire something genuinely different each get their
// own: the Lance's needle, the Swarm's missiles, the Flak's crescent.
const MANIFEST = {
  fire: 'assets/audio/sfx-fire.mp3',
  fireHeavy: 'assets/audio/sfx-fire-heavy.mp3',
  fireLance: 'assets/audio/sfx-fire-lance.mp3',
  fireSwarm: 'assets/audio/sfx-fire-swarm.mp3',
  impact: 'assets/audio/sfx-impact.mp3',
  kill: 'assets/audio/sfx-kill.mp3',
  deflect: 'assets/audio/sfx-deflect.mp3',
  orbPop: 'assets/audio/sfx-orb-pop.mp3',
  fireRapid: 'assets/audio/sfx-fire-rapid.mp3',
  playerHit: 'assets/audio/sfx-player-hit.mp3',
  playerDown: 'assets/audio/sfx-player-down.mp3',
  pickup: 'assets/audio/sfx-pickup.mp3',
  weaponExpire: 'assets/audio/sfx-weapon-expire.mp3',
  podKill: 'assets/audio/sfx-pod-kill.mp3',
  bossWarning: 'assets/audio/sfx-boss-warning.mp3',
  bossDeath: 'assets/audio/sfx-boss-death.mp3',
  sector: 'assets/audio/sfx-sector.mp3',
  musicBed: 'assets/audio/music-bed.mp3',
};

/** Which fire clip a weapon uses. A weapon with no row here falls back to the
 *  standard bolt's, so adding a WEAPONS row can never produce a silent gun. */
const WEAPON_CLIP = {
  standard: 'fire',
  // RAPID GETS ITS OWN VOICE (playtest round 10). Amit asked for "stronger
  // change [...] also in audio" between the standard shot and RAPID. The clip
  // was generated in the audio pass and left unwired because the weapon did not
  // exist yet; it does now, and a weapon whose entire identity is its rate is
  // the one that most needs to sound different -- rate is a rhythm, and the ear
  // reads rhythm faster than the eye reads a tint.
  rapid: 'fireRapid',
  scatter: 'fire',
  lance: 'fireLance',
  swarm: 'fireSwarm',
  flak: 'fireHeavy',
};

// Per-clip trigger counts, for the mix pass. A run's mix is decided far more by
// HOW OFTEN a clip fires than by its authored gain -- the fire clip at 0.16 and
// ten triggers a second is louder in aggregate than a kill at 0.55 -- and there
// is no way to see that by listening once. Two integers per clip, read through
// audioStats() on `__nv`.
const triggerCount = {};
let deniedCount = 0;

let ctx = null;
let masterGain = null;
let sfxBus = null;
let musicBus = null;
const buffers = {};
const lastPlayedAt = {};
let muted = AUDIO.startMuted;

// --- the app's own mute, which is a SEPARATE input from the player's --------
//
// The GoBalance SDK (Assets/GoBalance/WebGames/Resources/GoBalanceWebSdk.txt)
// already silences us when the app is muted: it shadows AudioContext's
// `destination` getter and splices a host-owned gain node in front of the real
// one, so our whole chain is downstream of a gain we do not control.
//
// What it does NOT do is tell us. So without this the in-game mute button can
// contradict what the player hears -- silent game, button showing unmuted, and
// pressing it does nothing because the silence is upstream of masterGain.
//
// TWO INPUTS, NOT ONE. The app's mute and the player's own are tracked
// separately and OR'd, deliberately: the SDK is careful to only ever undo its
// OWN muting ("a game with its own sound toggle must not have it silently
// switched back on when the app is unmuted"), and collapsing the two into a
// single flag would throw that away -- unmuting in the lobby would clear a mute
// the player set themselves.
let hostMuted = false;

// --- per-channel mutes (the player's sound popup) ---------------------------
//
// Music and sound effects are separately switchable because they are separately
// wanted: a player on a board often wants the game's feedback -- hits, kills,
// the boss warning -- while listening to their own music. One master switch
// cannot express that, and a game that only offers all-or-nothing gets muted
// entirely by anyone who dislikes its soundtrack.
//
// Persisted, because this is a preference rather than a per-run state. Stored
// under a namespaced key so it cannot collide with anything else the WebView
// holds. localStorage can throw outright in a restricted WebView, so every
// access is guarded and simply degrades to session-only.
let musicOn = true;
let sfxOn = true;

const PREF_KEY = 'novavanguard:audio';

let prefsLoaded = false;

function loadPrefs() {
  // Idempotent and called from two places: once at module load, so the sound
  // menu can paint the real state before any audio exists, and again when the
  // graph is built in case that somehow happens first. Without the module-load
  // call, isMusicOn() answers with a default until the player has heard
  // something -- and the menu would open showing the wrong switches.
  if (prefsLoaded) return;
  prefsLoaded = true;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (typeof p.musicOn === 'boolean') musicOn = p.musicOn;
    if (typeof p.sfxOn === 'boolean') sfxOn = p.sfxOn;
    if (typeof p.muted === 'boolean') muted = p.muted;
  } catch (err) {
    /* private mode, or no storage: defaults stand */
  }
}

function savePrefs() {
  try {
    window.localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ musicOn, sfxOn, muted })
    );
  } catch (err) {
    /* nothing to do; the session still behaves correctly */
  }
}
// The app's volume, 0..1. Today GlobalMuteBtn.cs writes only 0 or 1 -- it is a
// mute toggle, not a slider. Applied proportionally anyway: it costs nothing,
// matches the current values exactly, and the app's own comment says the float
// exists "just to prepare for adding volume adjusment in the future".
let hostVolume = 1;

/** What masterGain should actually be, from all inputs. */
function effectiveMasterGain() {
  if (muted || hostMuted) return 0;
  return AUDIO.master * hostVolume;
}
// Read preferences at module load: the sound menu asks isMusicOn()/isSfxOn()
// the first time it opens, which can be long before anything is audible.
loadPrefs();

let musicSource = null;
let loaded = false;

function getContext() {
  if (ctx) return ctx;
  // Cheap no-op if module load already did it; kept so the graph can never be
  // built from defaults regardless of call order.
  loadPrefs();
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // The safety limiter sits at the very end of the chain, after mute, so
    // nothing downstream of it can push the mix past 0 dBFS. See AUDIO.limiter
    // in /data/tuning.js for the measurement that put it there. Best-effort:
    // a browser without DynamicsCompressorNode simply connects straight
    // through rather than losing its audio.
    let tail = ctx.destination;
    try {
      const L = AUDIO.limiter;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = L.thresholdDb;
      lim.knee.value = L.kneeDb;
      lim.ratio.value = L.ratio;
      lim.attack.value = L.attackS;
      lim.release.value = L.releaseS;
      lim.connect(ctx.destination);
      tail = lim;
    } catch (err) {
      tail = ctx.destination;
    }
    // masterGain is where mute happens, so mute is one gain write rather than a
    // flag every play path has to remember to check -- and it silences music
    // and SFX together, which is what a player pressing a speaker icon means.
    // UPSTREAM of the limiter, so muting silences the limiter's input rather
    // than asking it to squash a signal that should not exist.
    masterGain = ctx.createGain();
    masterGain.gain.value = effectiveMasterGain();
    masterGain.connect(tail);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? AUDIO.sfxVolume : 0;
    sfxBus.connect(masterGain);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? AUDIO.musicVolume : 0;
    musicBus.connect(masterGain);
  } catch (err) {
    ctx = null;
  }
  return ctx;
}

function resumeIfSuspended() {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    resumeIfSuspended();
    // The music start is retried here as well as at boot: on a cold load the
    // context is suspended, so the boot-time start produced a source that was
    // never audible. Starting it again on the first gesture is what makes the
    // bed actually appear rather than requiring a restart.
    if (loaded && !musicSource) startMusic();
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

/** Fetch + decode one clip. Returns null (never throws) on any failure -- a
 *  missing clip is exactly as safe as a missing sprite. */
async function loadBuffer(src) {
  const c = getContext();
  if (!c) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return await c.decodeAudioData(bytes);
  } catch (err) {
    return null;
  }
}

/**
 * Start loading every clip. Fire-and-forget: the game boots and plays while the
 * decode is in flight, and each `sfx()` call before the buffer lands is a
 * silent no-op rather than a stall. Nothing in the run waits on audio.
 */

/**
 * Follow the app's audio state (GoBalance SDK).
 *
 * Guarded on the SDK being absent, so the game is unchanged at a plain URL --
 * `window.GoBalance` only exists inside the WebView, and every call here is
 * inert without it. That is the SDK's own design ("everything is inert outside
 * the WebView, so the API can be called unconditionally").
 *
 * Called from initAudio() rather than at module load: the SDK installs itself
 * as the first tag in <head>, but its handshake with the host is asynchronous
 * (it retries for up to a second while window.Unity appears), so reading it
 * once at import time would often read a default.
 */
function bindHostAudio() {
  const GB = typeof window !== 'undefined' ? window.GoBalance : null;
  if (!GB) return;

  const apply = (state) => {
    if (!state) return;
    hostMuted = !!state.muted;
    hostVolume = typeof state.volume === 'number' ? state.volume : 1;
    if (masterGain) masterGain.gain.value = effectiveMasterGain();
    // Let the HUD repaint the icon: the effective state just changed without
    // the player touching anything.
    if (typeof onHostAudioChange === 'function') onHostAudioChange();
  };

  apply(GB.audio);
  try {
    GB.on('audiochange', apply);
  } catch (err) {
    /* older SDK without events: the initial read above still applied */
  }
}

/** Set by /main.js so the mute button can be repainted when the APP changes it
 *  rather than only when the player does. */
let onHostAudioChange = null;
export function setHostAudioListener(fn) {
  onHostAudioChange = fn;
}

export function initAudio() {
  // Follow the app's mute before anything is audible, so a game entered from a
  // muted lobby never makes a sound at all.
  bindHostAudio();
  const ids = Object.keys(MANIFEST);
  return Promise.all(
    ids.map((id) =>
      loadBuffer(MANIFEST[id]).then((buf) => {
        if (buf) buffers[id] = buf;
      })
    )
  ).then(() => {
    loaded = true;
    startMusic();
  });
}

/**
 * Play one clip. Fresh BufferSourceNode every time -- see the file header for
 * why a reused element is not an option in this game.
 *
 * Silent no-op if: the clip is not (yet) decoded, WebAudio is unavailable, or
 * the same clip fired inside its own AUDIO.clips[id].minGapS. The last one is
 * mix protection, not throttling: the floors are shorter than any weapon's fire
 * interval, so no rate of fire is ever held back by it.
 */
export function sfx(id, gainScale = 1) {
  const buf = buffers[id];
  if (!buf) return;
  const c = getContext();
  if (!c) return;
  const cfg = AUDIO.clips[id] || {};
  const now = c.currentTime;
  const gap = cfg.minGapS || 0;
  if (gap > 0 && now - (lastPlayedAt[id] || -1e9) < gap) {
    deniedCount++;
    return;
  }
  lastPlayedAt[id] = now;
  triggerCount[id] = (triggerCount[id] || 0) + 1;
  try {
    const source = c.createBufferSource();
    source.buffer = buf;
    // A few percent of rate spread, rolled per trigger, on the clips that
    // repeat many times a second. Ten byte-identical copies of one 0.48 s
    // sample per second phase into a buzz; this breaks that up without the
    // sound changing character. Math.random rather than the seeded stream on
    // purpose -- audio must never be able to move a single draw of the
    // scenario's RNG, which is what keeps a run reproducible (§5.2).
    const jitter = cfg.pitchJitter || 0;
    if (jitter) source.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
    const g = c.createGain();
    g.gain.value = (cfg.gain === undefined ? 0.5 : cfg.gain) * gainScale;
    source.connect(g).connect(sfxBus);
    source.start(0);
    // BufferSourceNodes are single-use; dropping the graph edge on end keeps a
    // long run from accumulating thousands of dead nodes on the bus.
    source.onended = () => {
      try {
        g.disconnect();
      } catch (err) {
        /* already gone */
      }
    };
  } catch (err) {
    /* no-op -- see file header */
  }
}

/** The fire clip for a weapon id (WEAPONS). Unknown weapon -> the standard
 *  bolt's, so a new WEAPONS row can never produce a silent gun. */
export function sfxFire(weaponId) {
  sfx(WEAPON_CLIP[weaponId] || 'fire');
}

export function startMusic() {
  const buf = buffers[AUDIO.musicTrack];
  if (!buf) return;
  const c = getContext();
  if (!c) return;
  stopMusic();
  try {
    const source = c.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    source.connect(musicBus);
    source.start(0);
    musicSource = source;
  } catch (err) {
    musicSource = null;
  }
}

export function stopMusic() {
  if (!musicSource) return;
  try {
    musicSource.stop();
  } catch (err) {
    /* already stopped -- fine */
  }
  musicSource = null;
}

/** Apply the per-channel switches to the live buses. */
function applyChannels() {
  if (sfxBus) sfxBus.gain.value = sfxOn ? AUDIO.sfxVolume : 0;
  if (musicBus) musicBus.gain.value = musicOn ? AUDIO.musicVolume : 0;
}

export function isMusicOn() { return musicOn; }
export function isSfxOn() { return sfxOn; }

/**
 * Turn the music channel on or off.
 *
 * Turning it ON also starts the bed if it is not already running: the source is
 * stopped outright when music is switched off rather than left playing into a
 * silent gain, so there is nothing to unmute back into.
 */
export function setMusicOn(next) {
  musicOn = !!next;
  applyChannels();
  savePrefs();
  if (musicOn) {
    resumeIfSuspended();
    if (loaded && !musicSource) startMusic();
  } else {
    stopMusic();
  }
  return musicOn;
}

export function setSfxOn(next) {
  sfxOn = !!next;
  applyChannels();
  savePrefs();
  // A tap on the control is a gesture, which is exactly what the autoplay
  // policy wants -- so use it rather than waiting for the next one.
  if (sfxOn) resumeIfSuspended();
  return sfxOn;
}

export function setMuted(next) {
  muted = !!next;
  savePrefs();
  if (masterGain) masterGain.gain.value = effectiveMasterGain();
  // A gesture is a gesture: tapping the mute control to UNmute is exactly the
  // interaction the autoplay policy wants, so use it.
  if (!muted) {
    resumeIfSuspended();
    if (loaded && !musicSource) startMusic();
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

/**
 * Re-read AUDIO.master / sfxVolume / musicVolume into the live bus gains.
 *
 * The three bus levels are read once when the context is built, so without this
 * they would be the only numbers in /data/tuning.js that an operator could not
 * actually retune on a device -- and the mix is the single most likely thing to
 * need retuning through a phone speaker (§9.3, §10). Per-clip gains need no
 * equivalent: sfx() reads AUDIO.clips on every trigger. Exposed on `__nv` in
 * /main.js beside the tuning namespace itself.
 */
/**
 * What the audio layer is actually doing, for the mix pass and for verifying a
 * build. `share` is each clip's rough contribution to the perceived mix --
 * triggers x gain^2 x clip length, normalised -- which is the number that
 * answers "is the fire layer taking over" honestly, where counting triggers
 * alone does not.
 */
export function audioStats() {
  const rows = {};
  let total = 0;
  for (const id of Object.keys(triggerCount)) {
    const g = (AUDIO.clips[id] || {}).gain || 0;
    const dur = buffers[id] ? buffers[id].duration : 0;
    const energy = triggerCount[id] * g * g * dur;
    rows[id] = { triggers: triggerCount[id], gain: g, energy };
    total += energy;
  }
  for (const id of Object.keys(rows)) {
    rows[id].share = total > 0 ? rows[id].energy / total : 0;
  }
  return {
    contextState: ctx ? ctx.state : 'none',
    decoded: Object.keys(buffers),
    missing: Object.keys(MANIFEST).filter((id) => !buffers[id]),
    muted,
    musicRunning: !!musicSource,
    retriggersDenied: deniedCount,
    clips: rows,
  };
}

export function refreshMix() {
  if (masterGain) masterGain.gain.value = effectiveMasterGain();
  applyChannels();
  if (sfxBus) sfxBus.gain.value = AUDIO.sfxVolume;
  if (musicBus) musicBus.gain.value = AUDIO.musicVolume;
}

/**
 * The state the player can actually hear, which is what the button must draw.
 *
 * Not `muted` alone: if the app has muted us, the game IS silent, and an icon
 * claiming otherwise is a lie the player can hear. Callers that need to know
 * whose mute it is can ask hostMutedState().
 */
export function isMuted() {
  return muted || hostMuted;
}

/** True when the silence is the APP's doing, not the player's. */
export function hostMutedState() {
  return hostMuted;
}

/**
 * Pause/resume suspend the whole context rather than the music source alone
 * (a BufferSourceNode has no native pause). Safe because nothing should be
 * triggering a sound while the simulation itself is frozen.
 */
export function suspendAudio() {
  const c = getContext();
  // NOT GUARDED ON state === 'running', and that guard is exactly what broke:
  // resume() and suspend() are asynchronous control messages, so unmuting while
  // the game is paused (which resumes the context, because a tap on the speaker
  // IS a user gesture) left the state still reading 'suspended' at the instant
  // the pause guard checked it -- the guard no-opped and the pending resume then
  // landed, playing the music bed over a paused game. Issuing suspend()
  // unconditionally puts it behind the resume in the same ordered queue, so the
  // last thing asked for is the thing that happens. Suspending an already
  // suspended context is a no-op, not an error.
  if (c && c.state !== 'closed') c.suspend().catch(() => {});
}

export function resumeAudio() {
  resumeIfSuspended();
}
