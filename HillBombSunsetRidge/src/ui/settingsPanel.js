// Live settings panel (gear button, top-right chrome row).
//
// Same UI as HalfShellHustle's steering panel -- deliberately, so the two games
// behave identically under the same thumb -- but the rows expose THIS game's
// knobs. Hill Bomb doesn't steer by lanes, so there is no lane zone and no lane
// hysteresis; what matters here is the steering mode, how quickly carve follows
// the input, and the control preset.
//
// DRIVEN BY TWO KEYS, not just touch. Inside the Unity WebView there is no
// pointer at all: WebGameController forwards exactly Space and Enter (plus the
// synthetic steering arrows) and never forwards a click -- the single hardcoded
// .click() it issues targets #restart-button, and only while the game-over
// overlay is up. So every button here is unreachable on-device, and arrows are
// no help either since analog mode dispatches none. Space + Enter is the whole
// available input surface, and the row model below is shared by touch and keys
// so the two can't drift apart.
//
// WHO OWNS WHAT: input/input.js owns the steering values and logic; this file
// only renders controls and pushes changes into it. SENSITIVITY is the
// exception -- it tunes thresholds that live on the Unity side, so it goes over
// the gb:sensitivity bridge instead.

import {
  STEER_MODES, STEER_REGULAR, setSteerMode, recentreBoard,
} from '../input/input.js';
import { CONTROL_PRESETS, CONTROLS, setControlPreset } from '../data/controlPresets.js';
import { CARVE_SMOOTH, CARVE_CURVE } from '../data/constants.js';

const STORAGE_KEY = 'hillbomb:settings';

// 55 maps to pressThreshold ~= 0.3525, within a rounding error of the SDK's
// stock 0.35 -- so a fresh install feels exactly as it did before this panel
// existed, and nothing changes until someone deliberately moves a value.
const DEFAULT_SENSITIVITY = 55;

// Live-tunable feel values. main.js reads through this object every frame, so a
// change lands mid-run without a restart -- same pattern as CONTROLS.
export const FEEL = {
  carveSmooth: CARVE_SMOOTH,
  carveCurve: CARVE_CURVE,
};

const state = {
  mode: STEER_REGULAR,
  preset: CONTROLS.key,
  carveSmooth: CARVE_SMOOTH,
  carveCurve: CARVE_CURVE,
  sensitivity: DEFAULT_SENSITIVITY,
};

let panelEl = null;
let rows = [];
let selected = 0;
let onOpenLab = null;

// localStorage can throw outright in a restricted WebView (private mode,
// storage disabled). A tuning nicety must never take the game down with it, so
// both directions are guarded and simply fall back to defaults.
function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (STEER_MODES.includes(saved.mode)) state.mode = saved.mode;
    if (CONTROL_PRESETS[saved.preset]) state.preset = saved.preset;
    for (const k of ['carveSmooth', 'carveCurve', 'sensitivity']) {
      if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = saved[k];
    }
  } catch {
    // Keep defaults.
  }
}

function save() {
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
function pushSensitivity() {
  if (window.Unity) window.Unity.call('gb:sensitivity:' + Math.round(state.sensitivity));
}

function applyAll() {
  setSteerMode(state.mode);
  setControlPreset(state.preset);
  FEEL.carveSmooth = state.carveSmooth;
  FEEL.carveCurve = state.carveCurve;
  pushSensitivity();
}

function makeRow(label, note) {
  const el = document.createElement('div');
  el.className = 'sp-row';
  const name = document.createElement('span');
  name.className = 'sp-label';
  name.textContent = label;
  el.appendChild(name);
  const value = document.createElement('button');
  el.appendChild(value);
  if (note) {
    const n = document.createElement('small');
    n.className = 'sp-note';
    n.textContent = note;
    el.appendChild(n);
  }
  panelEl.appendChild(el);
  return { el, value };
}

/** A cycling choice: activating steps to the next value and wraps. */
function addChoice({ label, values, get, set, note, relevance }) {
  const { el, value } = makeRow(label, note);
  const row = {
    el,
    relevance,
    refresh() { value.textContent = String(get()).toUpperCase(); },
    activate() {
      const i = values.indexOf(get());
      set(values[(i + 1) % values.length]);
      applyAll();
      save();
      rows.forEach((r) => r.refresh());
      refreshRelevance();
    },
  };
  value.addEventListener('click', row.activate);
  rows.push(row);
  return row;
}

/**
 * A numeric stepper. Only ever increments and wraps at max -- there is no
 * "decrease", because Enter and Space are the only two keys available and Enter
 * is already spent on moving the selection.
 */
function addStepper({ label, key, min, max, step, fmt, note, relevance }) {
  const { el, value } = makeRow(label, note);
  const row = {
    el,
    relevance,
    refresh() { value.textContent = fmt(state[key]); },
    activate() {
      let v = state[key] + step;
      if (v > max + 1e-9) v = min;
      state[key] = Math.round(v * 1000) / 1000;
      applyAll();
      save();
      row.refresh();
    },
  };
  value.addEventListener('click', row.activate);
  rows.push(row);
  return row;
}

function addAction({ label, run, note }) {
  const { el, value } = makeRow(label, note);
  const row = {
    el,
    refresh() { if (!row._held) value.textContent = label === 'CLOSE' ? '✕' : '▸'; },
    activate() {
      const msg = run();
      if (msg) {
        row._held = true;
        value.textContent = msg;
        setTimeout(() => { row._held = false; row.refresh(); }, 1200);
      }
    },
  };
  value.addEventListener('click', row.activate);
  rows.push(row);
  return row;
}

/**
 * Dim the rows that do nothing in the current mode, rather than hiding them --
 * a row that vanishes reads as a bug, and the selection index would shift under
 * the player mid-menu.
 */
function refreshRelevance() {
  rows.forEach((r) => {
    if (!r.relevance) return;
    r.el.classList.toggle('sp-dim', !r.relevance());
  });
}

function refreshSelection() {
  rows.forEach((r, i) => r.el.classList.toggle('sp-sel', i === selected));
  // Keep the highlighted row visible when the panel has to scroll. On-device
  // the highlight is the only feedback about what SPACE will change, so a
  // selection that has moved off-screen leaves the menu effectively blind.
  const cur = rows[selected];
  if (cur && cur.el.scrollIntoView) cur.el.scrollIntoView({ block: 'nearest' });
}

function setPanelOpen(open) {
  panelEl.classList.toggle('hidden', !open);
  if (open) {
    selected = 0;
    refreshSelection();
  }
}

export function isPanelOpen() {
  return panelEl ? !panelEl.classList.contains('hidden') : false;
}

/**
 * @param {{openLab?: () => void}} hooks
 */
export function initSettingsPanel(hooks = {}) {
  onOpenLab = hooks.openLab || null;
  load();

  const button = document.getElementById('settings-button');
  panelEl = document.getElementById('settings-panel');
  if (!button || !panelEl) return;
  applyAll();

  button.addEventListener('click', () => setPanelOpen(panelEl.classList.contains('hidden')));

  // The key scheme is not discoverable, and inside Unity it's the only way to
  // drive this at all -- so it's stated on the panel rather than left to be
  // remembered.
  const keyHint = document.createElement('div');
  keyHint.className = 'sp-keyhint';
  keyHint.textContent = 'ENTER = next row   SPACE = change';
  panelEl.appendChild(keyHint);

  addChoice({
    label: 'MODE',
    values: STEER_MODES,
    get: () => state.mode,
    set: (v) => { state.mode = v; },
    // Says the quiet part out loud: the mode is only HALF a game-side choice.
    // Analog reads the sensor, which the host only leaves uncontested when the
    // scene's forwardSteeringKeys is off.
    note: 'analog needs forwardSteeringKeys = OFF on the scene',
  });
  addChoice({
    label: 'FEEL',
    values: Object.keys(CONTROL_PRESETS),
    get: () => state.preset,
    set: (v) => { state.preset = v; },
    note: 'planted settles mid-wall; loose reaches the lip',
  });
  addStepper({
    label: 'CARVE SMOOTH',
    key: 'carveSmooth',
    min: 2,
    max: 12,
    step: 1,
    fmt: (v) => v.toFixed(0),
    note: 'higher = carve follows the lean faster',
  });
  addStepper({
    label: 'CARVE CURVE',
    key: 'carveCurve',
    min: 1,
    max: 3,
    step: 0.2,
    fmt: (v) => v.toFixed(1),
    // Shapes |carve|^curve, so it only bites on a continuous input; a synthetic
    // arrow key is already hard +-1 and raising 1 to any power is still 1.
    note: 'analog only -- softens small leans near centre',
    relevance: () => state.mode !== STEER_REGULAR,
  });
  addStepper({
    label: 'SENSITIVITY',
    key: 'sensitivity',
    min: 0,
    max: 100,
    step: 5,
    fmt: (v) => `${Math.round(v)}`,
    note: 'regular mode only -- tunes the HOST thresholds',
    relevance: () => state.mode === STEER_REGULAR,
  });
  addAction({
    label: 'RECENTRE BOARD',
    run: () => (recentreBoard() ? 'CENTRED ✓' : 'NO SENSOR (BROWSER)'),
    note: 'analog only -- captures the current lean as zero',
  });
  if (onOpenLab) {
    addAction({
      label: 'RENDER LAB',
      run: () => { setPanelOpen(false); onOpenLab(); return null; },
      note: 'rider render mode A/B/C',
    });
  }
  addAction({
    label: 'CLOSE',
    // Reachable by key as well as touch -- with the gear unclickable on-device,
    // this is the only way back out of the menu there.
    run: () => { setPanelOpen(false); return null; },
  });

  rows.forEach((r) => r.refresh());
  refreshRelevance();
  refreshSelection();

  // ENTER moves the selection, SPACE acts on it. These are the only two keys
  // the Unity host forwards (see this file's header), so they have to carry the
  // whole menu between them -- hence no "decrease": steppers wrap instead.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    // Both keys mean RESTART on the game-over screen (the host separately
    // synth-clicks #restart-button there). Never shadow that.
    const gameover = document.getElementById('gameover-overlay');
    if (gameover && !gameover.classList.contains('hidden')) return;

    if (panelEl.classList.contains('hidden')) {
      // Closed: only Enter opens it. Space stays inert so it can't be opened by
      // accident -- and because Space is also the trick key here, which would
      // otherwise pop the menu open every time the player ollied.
      if (e.code !== 'Enter') return;
      e.preventDefault();
      setPanelOpen(true);
      return;
    }

    e.preventDefault();
    if (e.code === 'Enter') {
      selected = (selected + 1) % rows.length;
      refreshSelection();
    } else {
      rows[selected].activate();
    }
  });
}
