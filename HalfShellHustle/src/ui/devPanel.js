// Dev tools panel -- wrench button, bottom-left corner, hidden until
// ui/devUnlock.js's 7-second-hold-plus-code gesture unmounts it. Created
// entirely in JS (not in index.html) and only ever appended to the DOM once,
// on unlock -- see initDevPanel()'s returned `mount()`.
//
// SPLIT FROM THE PLAYER SETTINGS PANEL (2026-09-16, direct request): every
// row that used to live in ui/steeringPanel.js EXCEPT sensitivity/SFX/music
// moved here -- steering MODE, every absolute-mode tilt threshold, VFX,
// RECENTRE BOARD, and the "NEXT THEME (DEV)" theme-skip button. None of that
// is a real player's business; a curious tap on "absolute" mode or a
// theme-skip mid-run is not a thing to leave one accidental gesture away.
// ADD POINTS (+100/+300/+500/+1000, 2026-09-17) joined the same reasoning --
// reaching a tier (or the final one, to check the victory screen) by
// actually playing is slow while iterating.
//
// MODE IN PARTICULAR IS DEV-ONLY NOW: data/constants.js's
// DEFAULT_STEERING_MODE is stepped, always, on a fresh install -- absolute
// is something a developer opts INTO from here, never the default a player
// lands on. See systems/steeringSettings.js's header for how the two panels
// stay in sync despite MODE living only in this one.
//
// DRIVEN BY TWO KEYS, same as the settings panel (see ui/panelRows.js's
// header) -- but unlike that one, THIS panel has no "Enter opens me" branch:
// it can only ever be opened by tapping the (hidden-until-unlocked) wrench
// button. Enter always defaults to the settings panel when nothing is open;
// see ui/panelState.js for the flag that keeps the two from fighting over
// the same keypress once this one IS open.

import {
  STEERING_MODES,
} from '../data/constants.js';
import { recenterBoard } from '../input/input.js';
import { playSfx } from '../systems/audio.js';
import { getVfxEnabled, setVfxEnabled } from '../systems/vfxSettings.js';
import { state, onSteeringStateChange } from '../systems/steeringSettings.js';
import { createRowPanel } from './panelRows.js';
import { setDevPanelOpen } from './panelState.js';
import { closeSteeringPanel } from './steeringPanel.js';

const WRENCH = '&#128295;'; // 🔧 -- distinct from the settings gear (&#9881;)

// "Jump to next theme" (direct request) -- with 5+ environment themes in
// TIER_THEMES rotation, earning enough points to actually SEE the next one
// while iterating on art was slow. The real tier-up logic (gs/levelIndex/
// beginLevelComplete) lives inside core/main.js's own closure, not reachable
// from here -- so this file only renders the button; main.js registers what
// pressing it actually does. No-ops harmlessly if pressed before main.js
// finishes registering.
let nextThemeHandler = null;
export function setNextThemeHandler(fn) {
  nextThemeHandler = fn;
}

// "Add N points" quick-adds (direct request) -- same reasoning as the theme
// skip above: reaching a tier (or the final one, to check the victory
// screen) by actually playing is slow while iterating. Same ownership split
// -- the real score/tier-up logic lives in core/main.js's closure; this file
// only renders the buttons and calls back into whatever main.js registers.
let addScoreHandler = null;
export function setAddScoreHandler(fn) {
  addScoreHandler = fn;
}

export function initDevPanel() {
  const button = document.createElement('button');
  button.id = 'dev-button';
  button.type = 'button';
  button.title = 'Dev Tools';
  button.innerHTML = WRENCH;

  const panelEl = document.createElement('div');
  panelEl.id = 'dev-panel';
  panelEl.className = 'hidden';

  const rp = createRowPanel(panelEl);

  function setOpen(open) {
    panelEl.classList.toggle('hidden', !open);
    button.classList.toggle('on', open);
    setDevPanelOpen(open);
    if (open) {
      // Mutual exclusion with the player settings panel (ui/panelState.js's
      // header) -- opening one always closes the other.
      closeSteeringPanel();
      rp.setSelected(0);
      rp.refreshSelection();
    }
  }

  button.addEventListener('click', () => {
    playSfx('sfx_ui_tap');
    setOpen(panelEl.classList.contains('hidden'));
  });

  const keyHint = document.createElement('div');
  keyHint.className = 'sp-keyhint';
  keyHint.textContent = 'ENTER = next row   SPACE = change';
  panelEl.appendChild(keyHint);

  rp.addChoice({
    label: 'MODE',
    values: STEERING_MODES,
    get: () => state.mode,
    set: (v) => { state.mode = v; },
    // Says the quiet part out loud: the mode is only HALF a game-side choice.
    // Absolute reads the analog sensor, which the host only leaves uncontested
    // when the scene's forwardSteeringKeys is off.
    note: 'absolute needs forwardSteeringKeys = OFF on the scene',
  });
  rp.addStepper({
    label: 'LANE ZONE',
    key: 'laneZone',
    mode: 'absolute',
    min: 0.1,
    max: 0.9,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    note: 'lean past this to leave the centre lane',
    state,
  });
  rp.addStepper({
    label: 'HYSTERESIS',
    key: 'hysteresis',
    mode: 'absolute',
    min: 0,
    max: 0.4,
    step: 0.02,
    fmt: (v) => v.toFixed(2),
    note: 'stops a lean parked on the edge flapping between lanes',
    state,
  });
  rp.addStepper({
    label: 'JUMP TILT',
    key: 'jumpTilt',
    mode: 'absolute',
    min: 0.15,
    max: 0.95,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    note: 'lean forward OR back to jump (analog sends no arrows)',
    state,
  });
  rp.addChoice({
    label: 'VFX',
    values: ['ON', 'OFF'],
    get: () => (getVfxEnabled() ? 'ON' : 'OFF'),
    set: (v) => setVfxEnabled(v === 'ON'),
  });
  rp.addAction({
    label: 'RECENTRE BOARD',
    run: () => (recenterBoard() ? 'CENTRED ✓' : 'NO SENSOR (BROWSER)'),
  });
  rp.addAction({
    label: 'NEXT THEME (DEV)',
    run: () => {
      if (!nextThemeHandler) return 'NOT READY';
      const result = nextThemeHandler();
      return result === false ? 'NOT RUNNING' : 'JUMPING...';
    },
  });
  const addPointsLabel = document.createElement('div');
  addPointsLabel.className = 'sp-label';
  addPointsLabel.style.marginTop = '10px';
  addPointsLabel.textContent = 'ADD POINTS';
  panelEl.appendChild(addPointsLabel);
  rp.addChipRow([100, 300, 500, 1000].map((amount) => ({
    label: `+${amount}`,
    run: () => {
      if (!addScoreHandler) return 'NOT READY';
      const result = addScoreHandler(amount);
      return result === false ? 'NOT RUNNING' : 'ADDED';
    },
  })));
  rp.addAction({
    label: 'CLOSE',
    run: () => { setOpen(false); return null; },
  });

  rp.rows.forEach((r) => r.refresh());
  rp.refreshRelevance(state.mode);
  rp.refreshSelection();

  // Repaint whenever the SETTINGS panel changes shared steering state --
  // nothing there does today (SENSITIVITY doesn't affect MODE dimming here),
  // but this keeps the two panels symmetric rather than relying on that
  // staying true.
  onSteeringStateChange(() => {
    rp.rows.forEach((r) => r.refresh());
    rp.refreshRelevance(state.mode);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    // No "Enter opens me" branch here -- see this file's header. Closed means
    // inert; only the wrench button (after unlock) opens it.
    if (panelEl.classList.contains('hidden')) return;
    // Same overlay guards as the settings panel -- see its own comments.
    const gameover = document.getElementById('gameover-overlay');
    if (gameover && !gameover.classList.contains('hidden')) return;
    const levelComplete = document.getElementById('level-complete');
    if (levelComplete && !levelComplete.classList.contains('hidden')) return;
    const victory = document.getElementById('victory-overlay');
    if (victory && !victory.classList.contains('hidden')) return;

    e.preventDefault();
    if (e.code === 'Enter') {
      rp.setSelected((rp.getSelected() + 1) % rp.rows.length);
      rp.refreshSelection();
    } else {
      rp.rows[rp.getSelected()].activate();
    }
  });

  let mounted = false;
  return {
    button,
    panel: panelEl,
    // Called once, by ui/devUnlock.js's onUnlock callback. Appends the
    // button+panel to the DOM for the first time (they don't exist in it at
    // all until now) and opens the panel immediately -- the one piece of
    // feedback that the code was actually correct.
    mount() {
      if (mounted) return;
      mounted = true;
      document.body.appendChild(button);
      document.body.appendChild(panelEl);
      setOpen(true);
    },
  };
}
