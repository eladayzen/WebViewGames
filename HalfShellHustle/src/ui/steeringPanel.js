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
import { createRowPanel } from './panelRows.js';
import { isDevPanelOpen } from './panelState.js';

let panelEl = null;
let rp = null;

function setPanelOpen(open) {
  panelEl.classList.toggle('hidden', !open);
  if (open) {
    rp.setSelected(0);
    rp.refreshSelection();
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

  button.addEventListener('click', () => {
    playSfx('sfx_ui_tap');
    setPanelOpen(panelEl.classList.contains('hidden'));
  });

  // The key scheme is not discoverable, and inside Unity it's the only way to
  // drive this at all -- so it's stated on the panel rather than left to be
  // remembered.
  const keyHint = document.createElement('div');
  keyHint.className = 'sp-keyhint';
  keyHint.textContent = 'ENTER = next row   SPACE = change';
  panelEl.appendChild(keyHint);

  rp.addStepper({
    label: 'SENSITIVITY',
    key: 'sensitivity',
    mode: 'stepped',
    min: 0,
    max: 100,
    step: 5,
    fmt: (v) => `${Math.round(v)}`,
    note: 'stepped mode only -- tunes the HOST thresholds',
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
  rp.addAction({
    label: 'CLOSE',
    // Reachable by key as well as touch -- with the gear unclickable in the
    // Editor, this is the only way back out of the menu there.
    run: () => { setPanelOpen(false); return null; },
  });

  rp.rows.forEach((r) => r.refresh());
  rp.refreshRelevance(state.mode);
  rp.refreshSelection();

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
