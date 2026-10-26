// Shared board-steering VALUES -- mode, every tilt threshold, host
// sensitivity -- persisted together under one storage blob.
//
// Split out of ui/steeringPanel.js (2026-09-16) when its rows were divided
// across two panels: SENSITIVITY (plus SFX/MUSIC, which don't live here)
// stayed in the player-facing settings panel, while MODE/LANE ZONE/
// HYSTERESIS/JUMP TILT moved to the new dev tools panel (ui/devPanel.js).
// Both panels mutate the SAME state and must repaint when EITHER one
// changes it -- the settings panel's SENSITIVITY row is still dimmed by
// MODE, which now lives only in the dev panel -- hence the tiny pub/sub
// below rather than each panel owning its own copy.
//
// WHO OWNS WHAT (unchanged from the original panel's header): input/input.js
// owns the actual steering logic; this file only holds the tuning VALUES and
// pushes them into it. SENSITIVITY is the one exception -- it tunes a
// Unity-side threshold over the gb:sensitivity bridge instead.

import {
  STEERING_MODES, DEFAULT_STEERING_MODE,
  LANE_ZONE_THRESHOLD, LANE_ZONE_HYSTERESIS, JUMP_TILT_THRESHOLD,
} from '../data/constants.js';
import {
  setSteeringMode, setLaneZoneThreshold, setLaneZoneHysteresis, setJumpTiltThreshold,
} from '../input/input.js';

// RoboRun-specific, NOT 'hsh:steering' -- this file was copied unchanged
// from the TMNT source (HalfShellHustle/src/ui/steeringPanel.js), which
// still uses that literal key AND still defaults to absolute mode. Direct
// report: "the default state is not stepped" when tested in the real
// GoBalance app -- root cause was this key collision, not the default
// itself: if the two games' WebView content ever shares a localStorage
// origin (e.g. reusing the same local port across game launches), testing
// the TMNT original first persists its 'absolute' default under this same
// key, and RoboRun then silently inherits it. A reskin must never share a
// persisted-settings key with the game it was copied from -- same principle
// as never reusing its StreamingAssets folder name. See systems/vfxSettings.js
// and systems/audio.js, which had the identical latent collision.
const STORAGE_KEY = 'roborun:steering';

// 55 maps to pressThreshold ~= 0.3525, within a rounding error of the SDK's own
// stock 0.35 -- so a fresh install feels exactly as it did before this panel
// existed, and nothing changes until someone deliberately moves a value.
const DEFAULT_SENSITIVITY = 55;

// DEFAULT_STEERING_MODE (data/constants.js) is the one that matters here:
// direct request -- "always always always... the default mode is stepped,
// not absolute" unless the dev panel's own MODE row has changed it (which
// persists below, same as ever). A fresh install / cleared storage always
// lands on stepped.
export const state = {
  mode: DEFAULT_STEERING_MODE,
  laneZone: LANE_ZONE_THRESHOLD,
  hysteresis: LANE_ZONE_HYSTERESIS,
  jumpTilt: JUMP_TILT_THRESHOLD,
  sensitivity: DEFAULT_SENSITIVITY,
};

// localStorage can throw outright in a restricted WebView (private mode,
// storage disabled). A tuning nicety must never take the game down with it, so
// both directions are guarded and simply fall back to defaults.
export function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (STEERING_MODES.includes(saved.mode)) state.mode = saved.mode;
    for (const k of ['laneZone', 'hysteresis', 'jumpTilt', 'sensitivity']) {
      if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = saved[k];
    }
  } catch {
    // Keep defaults.
  }
}

export function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the settings just won't survive a reload.
  }
}

// Pushes the Unity-side sensitivity. MUST also run at boot, not only on change:
// pressThreshold is a SCENE-serialized field on the host, so it resets to the
// Inspector default every time the scene loads -- a stored preference that is
// never re-sent silently does nothing.
export function pushSensitivity() {
  if (window.Unity) window.Unity.call(`gb:sensitivity:${Math.round(state.sensitivity)}`);
}

export function applyAll() {
  setSteeringMode(state.mode);
  setLaneZoneThreshold(state.laneZone);
  setLaneZoneHysteresis(state.hysteresis);
  setJumpTiltThreshold(state.jumpTilt);
  pushSensitivity();
}

// --- Cross-panel repaint --------------------------------------------------
const listeners = [];
export function onSteeringStateChange(fn) {
  listeners.push(fn);
}

// The single commit path for BOTH panels' rows (ui/panelRows.js calls this
// after every stepper/choice activation): apply + persist, then tell every
// registered panel to repaint itself. Neither panel calls applyAll/save
// directly, so there's exactly one place this can drift.
export function commitSteering() {
  applyAll();
  save();
  listeners.forEach((fn) => fn());
}
