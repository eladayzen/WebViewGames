// Player-facing settings panel (gear button, top-right chrome row).
//
// SPLIT FROM DEV TOOLS (2026-09-16, direct request): this panel used to hold
// every steering tuning knob (mode, lane zone, hysteresis, jump tilt) plus
// VFX, RECENTRE BOARD and the theme-skip dev button, all in one place. Per
// direct instruction, everything except SENSITIVITY/SFX/MUSIC moved to a new
// hidden-until-unlocked dev tools panel (ui/devPanel.js, ui/devUnlock.js's
// 7-second-hold + code gesture) -- a player has no business seeing lane-zone
// thresholds or a theme-skip button, and MODE (stepped vs. absolute) is now a
// dev-only decision. See data/constants.js's DEFAULT_STEERING_MODE: the
// default is ALWAYS stepped unless the dev panel's MODE row has explicitly
// changed it.
//
// The underlying VALUES (systems/steeringSettings.js) are still shared with
// the dev panel -- SENSITIVITY's row here is still dimmed by MODE, which now
// lives only over there -- see that file's header for the pub/sub that keeps
// the two panels in sync.
//
// DRIVEN BY TWO KEYS, not just touch (see ui/panelRows.js's header for the
// full reasoning) -- Space + Enter is the entire available input surface
// inside the Unity WebView / the Editor with no mouse forwarded.

import {
  getSfxEnabled, setSfxEnabled, getMusicEnabled, setMusicEnabled, playSfx,
} from '../systems/audio.js';
import { state, load, applyAll, onSteeringStateChange } from '../systems/steeringSettings.js';
import {
  maxAngleAvailable, getMaxAngle, setMaxAngle, msSinceLastCalibration, FALLBACK_MAX_ANGLE,
} from '../systems/boardCalibration.js';
import { createRowPanel } from './panelRows.js';
import { isDevPanelOpen } from './panelState.js';
import { initCalibrationWizard, isCalibrationWizardOpen } from './calibrationWizard.js';

let panelEl = null;
let rp = null;
let onOpenHook = null;
let onCloseHook = null;

// MAX TILT ANGLE row state (direct request, 2026-09-29: "a place in the
// menu that I can see and change manually... below the [CALIBRATE] button").
// Mirrors the host's {value, min, max} locally. FALLBACK_MAX_ANGLE is ONLY
// the placeholder shown before the real fetch below resolves -- refreshBoardAngle
// runs once at boot (direct request: "when a new game starts, get from the
// API what's the current value... if the user changed it in another game...
// I don't want you to put it on default [again]") AND again every time the
// panel opens, so a value another game set is picked up promptly rather
// than the game silently assuming its own last-known number.
let maxAngleRow = null;
let boardAngle = { value: FALLBACK_MAX_ANGLE, min: 5, max: 45 };
let boardAngleLoaded = false;

function refreshBoardAngle() {
  if (!maxAngleAvailable()) return;
  getMaxAngle().then((applied) => {
    if (applied) { boardAngle = applied; boardAngleLoaded = true; }
    if (maxAngleRow) maxAngleRow.refresh();
  });
}
// Direct request: warn before letting a manual edit silently overwrite a
// value just measured by the wizard. Armed by the FIRST press within
// CONFIRM_WINDOW_MS of a calibration; a second press (any direction) within
// CONFIRM_ARM_MS confirms it, anything else (or letting it expire) cancels.
const CONFIRM_WINDOW_MS = 15000;
const CONFIRM_ARM_MS = 4000;
let pendingConfirm = false;
let confirmTimer = null;

// main.js supplies these -- direct request: "settings button should pause
// the game like pause as well" (this panel used to deliberately NOT pause,
// see this file's own header history; superseded). Same lifecycle-hook
// pattern as ui/calibrationWizard.js: main.js owns pausing/restoring prior
// pause state, this file only renders.
export function setSteeringPanelLifecycleHooks(onOpen, onClose) {
  onOpenHook = onOpen;
  onCloseHook = onClose;
}

function setPanelOpen(open) {
  const wasOpen = !panelEl.classList.contains('hidden');
  if (open === wasOpen) return; // no real transition -- don't re-fire the hooks
  panelEl.classList.toggle('hidden', !open);
  if (open) {
    rp.setSelected(0);
    rp.refreshSelection();
    // Re-fetch MAX TILT ANGLE every time the panel opens -- in particular,
    // right after closing the calibration wizard, so the row shows the
    // value that was just measured without needing anything more specific
    // than "open Settings" to trigger a repaint.
    refreshBoardAngle();
    if (onOpenHook) onOpenHook();
  } else if (onCloseHook) {
    onCloseHook();
  }
}

export function closeSteeringPanel() {
  if (panelEl) setPanelOpen(false);
}

export function isSteeringPanelOpen() {
  return !!panelEl && !panelEl.classList.contains('hidden');
}

export function initSteeringPanel() {
  load();
  applyAll();

  const button = document.getElementById('steering-button');
  panelEl = document.getElementById('steering-panel');
  if (!button || !panelEl) return;

  rp = createRowPanel(panelEl);
  const calibration = initCalibrationWizard();

  button.addEventListener('click', () => {
    playSfx('sfx_ui_tap');
    setPanelOpen(panelEl.classList.contains('hidden'));
  });

  // No ENTER/SPACE key-hint line and no note under SENSITIVITY -- direct
  // request, 2026-10-05: this ships in the mobile app where there is no
  // keyboard, so the hint described controls the player doesn't have, and
  // "stepped mode only -- tunes the HOST thresholds" is dev vocabulary. The
  // key scheme itself still works (it's how the Editor is driven); it is
  // just no longer advertised to players.
  rp.addStepper({
    label: 'SENSITIVITY',
    key: 'sensitivity',
    mode: 'stepped',
    min: 0,
    max: 100,
    step: 5,
    fmt: (v) => `${Math.round(v)}`,
    state,
  });
  rp.addChoice({
    label: 'SFX',
    values: ['ON', 'OFF'],
    get: () => (getSfxEnabled() ? 'ON' : 'OFF'),
    set: (v) => setSfxEnabled(v === 'ON'),
  });
  rp.addChoice({
    label: 'MUSIC',
    values: ['ON', 'OFF'],
    get: () => (getMusicEnabled() ? 'ON' : 'OFF'),
    set: (v) => setMusicEnabled(v === 'ON'),
  });
  // Direct report: "hard to step right... really weird" -- traced to the
  // board's own max-tilt-angle setting, not this game's SENSITIVITY dial
  // (see systems/boardCalibration.js). Feature-detected: hidden behind the
  // same "NOT AVAILABLE" inline-message convention as every other action row
  // here rather than omitted outright, so its absence is visibly a build/
  // platform fact, not a silent gap.
  rp.addAction({
    label: 'CALIBRATE BOARD',
    run: () => {
      if (!maxAngleAvailable()) return 'NOT AVAILABLE';
      // OPEN BEFORE CLOSE, deliberately: both register with main.js's modal
      // pause owner, and opening first means the count never drops to zero
      // during the handover, so the sim is never briefly resumed underneath
      // the wizard. open() registers synchronously before its first await.
      calibration.open();
      setPanelOpen(false);
      return null;
    },
  });
  // Manual fallback/override for the value CALIBRATE BOARD measures --
  // direct request. Guarded (see CONFIRM_WINDOW_MS above): a manual step
  // shortly after a real calibration arms a "press again to change anyway"
  // warning instead of applying immediately, since a wizard-measured value
  // being silently overwritten by a stray tap defeats the whole point of
  // running it.
  maxAngleRow = rp.addExternalStepper({
    label: 'MAX TILT ANGLE',
    get: () => boardAngle.value,
    fmt: (v) => (boardAngleLoaded ? `${v}°` : '...'),
    note: 'how far you need to lean for full steering',
    onStep: (dir) => {
      if (!maxAngleAvailable()) {
        maxAngleRow.setNote('NOT AVAILABLE', true);
        window.setTimeout(() => maxAngleRow.setNote(maxAngleRow.defaultNote, false), 1200);
        return;
      }
      const recentlyCalibrated = msSinceLastCalibration() < CONFIRM_WINDOW_MS;
      if (recentlyCalibrated && !pendingConfirm) {
        pendingConfirm = true;
        maxAngleRow.setNote('You just calibrated -- press again to change anyway.', true);
        clearTimeout(confirmTimer);
        confirmTimer = window.setTimeout(() => {
          pendingConfirm = false;
          maxAngleRow.setNote(maxAngleRow.defaultNote, false);
        }, CONFIRM_ARM_MS);
        return;
      }
      if (pendingConfirm) {
        clearTimeout(confirmTimer);
        pendingConfirm = false;
        maxAngleRow.setNote(maxAngleRow.defaultNote, false);
      }
      let next = boardAngle.value + dir;
      if (next > boardAngle.max) next = boardAngle.min;
      else if (next < boardAngle.min) next = boardAngle.max;
      setMaxAngle(next).then((applied) => {
        if (applied) { boardAngle = applied; boardAngleLoaded = true; }
        maxAngleRow.refresh();
      });
    },
  });
  rp.addAction({
    label: 'CLOSE',
    // Reachable by key as well as touch -- with the gear unclickable in the
    // Editor, this is the only way back out of the menu there.
    run: () => { setPanelOpen(false); return null; },
  });

  rp.rows.forEach((r) => r.refresh());
  rp.refreshRelevance(state.mode);
  rp.refreshSelection();

  // Fetch the REAL current board max-angle once at boot, not just on first
  // panel-open -- direct request: a value another game changed (this is a
  // device-wide setting) should show correctly the very first time the
  // player ever opens Settings, not just from the second open onward.
  refreshBoardAngle();

  // Repaint whenever the DEV panel changes shared steering state (e.g. MODE) --
  // SENSITIVITY's dimming depends on it even though MODE's own row lives there.
  onSteeringStateChange(() => {
    rp.rows.forEach((r) => r.refresh());
    rp.refreshRelevance(state.mode);
  });

  // ENTER moves the selection, SPACE acts on it. These are the only two keys
  // the Unity host forwards (see ui/panelRows.js's header), so they have to
  // carry the whole menu between them -- hence no "decrease": steppers wrap
  // instead.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    // The dev panel has already claimed the keyboard -- never fight it for
    // the same keypress (see ui/panelState.js).
    if (isDevPanelOpen()) return;
    // Same for the calibration wizard: its own capture listener swallows
    // Enter/Space first (OK button), but this guard makes the panel safe even
    // if that ordering ever changes -- without it, Enter during the wizard
    // would open the settings panel UNDERNEATH the wizard overlay.
    if (isCalibrationWizardOpen()) return;
    // Both keys mean RESTART on the game-over screen (core/main.js listens for
    // them, and the host separately synth-clicks #restart-button there). Never
    // shadow that.
    const gameover = document.getElementById('gameover-overlay');
    if (gameover && !gameover.classList.contains('hidden')) return;
    // Same during a level transition: that screen is a countdown the player
    // just watches, and popping a tuning panel over it -- which they'd then be
    // left holding when the next level starts under them -- is the last thing
    // wanted there.
    const levelComplete = document.getElementById('level-complete');
    if (levelComplete && !levelComplete.classList.contains('hidden')) return;
    // Same for the victory screen -- CONTINUE is the only way off it, and a
    // stray Enter/Space popping the settings panel over an earned screen
    // would be the same "taken away from you" feeling a mid-celebration
    // panel is elsewhere here.
    const victory = document.getElementById('victory-overlay');
    if (victory && !victory.classList.contains('hidden')) return;

    if (panelEl.classList.contains('hidden')) {
      // Closed: only Enter opens it. Space stays inert so it can't be opened by
      // accident, and because the gear itself can't be clicked in the Editor
      // this is the sole way in there.
      if (e.code !== 'Enter') return;
      e.preventDefault();
      playSfx('sfx_ui_tap');
      setPanelOpen(true);
      return;
    }

    e.preventDefault();
    if (e.code === 'Enter') {
      rp.setSelected((rp.getSelected() + 1) % rp.rows.length);
      rp.refreshSelection();
    } else {
      rp.rows[rp.getSelected()].activate();
    }
  });
}
