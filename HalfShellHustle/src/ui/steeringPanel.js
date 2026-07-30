// Live board-steering tuning panel (gear button, top-right chrome row).
//
// Exists because every value that decides how the balance board feels was
// previously either baked into a Unity Inspector field we can't reach from a
// build, or hidden behind the SDK's single 0..100 gb:sensitivity dial. Direct
// feedback: those values were designed for exactly this kind of lane game and
// want experimenting with ON the build. So the panel exposes them all, live,
// persisted, and adjustable mid-run -- the board is the only place any of this
// can honestly be judged, and you can't edit a Unity field while standing on it.
//
// DRIVEN BY TWO KEYS, not just touch. Inside the Unity WebView there is no
// pointer at all: WebGameController forwards exactly Space and Enter (plus the
// synthetic steering arrows) and never forwards a click -- the single hardcoded
// `.click()` it does issue targets #restart-button and only while the game-over
// overlay is up. So in the Editor every button here is unreachable, and the
// arrows are no help either: absolute mode runs with forwardSteeringKeys OFF,
// which means no arrows are dispatched at all in exactly the mode most worth
// tuning. Space + Enter is therefore the entire available input surface, and
// the row model below is shared by both it and the touch buttons so the two can
// never drift apart.
//
// WHO OWNS WHAT: input/input.js owns the actual steering values and logic; this
// file only renders controls and pushes changes into it. The one exception is
// SENSITIVITY, which tunes thresholds living on the Unity side and so goes over
// the gb:sensitivity bridge instead -- see its row below.

import {
  STEERING_MODES, STEERING_ABSOLUTE, DEFAULT_STEERING_MODE,
  LANE_ZONE_THRESHOLD, LANE_ZONE_HYSTERESIS, JUMP_TILT_THRESHOLD,
} from '../data/constants.js';
import {
  setSteeringMode, setLaneZoneThreshold, setLaneZoneHysteresis,
  setJumpTiltThreshold, recenterBoard,
} from '../input/input.js';

const STORAGE_KEY = 'hsh:steering';

// 55 maps to pressThreshold ~= 0.3525, within a rounding error of the SDK's own
// stock 0.35 -- so a fresh install feels exactly as it did before this panel
// existed, and nothing changes until someone deliberately moves a value.
const DEFAULT_SENSITIVITY = 55;

const state = {
  mode: DEFAULT_STEERING_MODE,
  laneZone: LANE_ZONE_THRESHOLD,
  hysteresis: LANE_ZONE_HYSTERESIS,
  jumpTilt: JUMP_TILT_THRESHOLD,
  sensitivity: DEFAULT_SENSITIVITY,
};

// localStorage can throw outright in a restricted WebView (private mode,
// storage disabled). A tuning nicety must never take the game down with it, so
// both directions are guarded and simply fall back to defaults.
function load() {
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
  if (window.Unity) window.Unity.call(`gb:sensitivity:${Math.round(state.sensitivity)}`);
}

function applyAll() {
  setSteeringMode(state.mode);
  setLaneZoneThreshold(state.laneZone);
  setLaneZoneHysteresis(state.hysteresis);
  setJumpTiltThreshold(state.jumpTilt);
  pushSensitivity();
}

// --- Row model -----------------------------------------------------------
// One list, consumed by BOTH the touch buttons and the two-key menu, so a row
// can never behave differently depending on how it was reached.
const rows = [];
let selected = 0;
let panelEl = null;

function commit() {
  applyAll();
  save();
  rows.forEach((r) => r.refresh());
  refreshRelevance();
}

// Stepping WRAPS at the top rather than clamping: with only two keys there is
// no "decrease", so wrapping is the sole way back down to a lower value.
function stepValue(row, dir) {
  const { key, min, max, step } = row;
  let next = state[key] + dir * step;
  if (next > max + 1e-9) next = min;
  else if (next < min - 1e-9) next = max;
  // Float steps accumulate error (0.35 + 0.05 * 3 !== 0.50); snap to the step's
  // own precision so the readout and the stored value stay honest.
  state[key] = Math.round(next / step) * step;
  commit();
}

function addStepper({ label, key, min, max, step, fmt, note, mode }) {
  const el = document.createElement('div');
  el.className = 'sp-row';
  if (mode) el.dataset.mode = mode;

  const name = document.createElement('span');
  name.className = 'sp-label';
  name.textContent = label;
  const down = document.createElement('button');
  down.type = 'button';
  down.innerHTML = '&minus;';
  const value = document.createElement('span');
  value.className = 'sp-value';
  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = '+';

  const row = {
    el, key, min, max, step, mode,
    refresh: () => { value.textContent = fmt(state[key]); },
    activate: () => stepValue(row, 1),
  };
  down.addEventListener('click', () => stepValue(row, -1));
  up.addEventListener('click', () => stepValue(row, 1));

  el.append(name, down, value, up);
  panelEl.appendChild(el);
  if (note) {
    const hint = document.createElement('div');
    hint.className = 'sp-note';
    hint.textContent = note;
    if (mode) hint.dataset.mode = mode;
    panelEl.appendChild(hint);
  }
  rows.push(row);
}

function addChoice({ label, note, values, get, set }) {
  const el = document.createElement('div');
  el.className = 'sp-row';
  const name = document.createElement('span');
  name.className = 'sp-label';
  name.textContent = label;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sp-mode';

  const row = {
    el,
    refresh: () => { button.textContent = get(); },
    activate: () => {
      set(values[(values.indexOf(get()) + 1) % values.length]);
      commit();
    },
  };
  button.addEventListener('click', row.activate);

  el.append(name, button);
  panelEl.appendChild(el);
  if (note) {
    const hint = document.createElement('div');
    hint.className = 'sp-note';
    hint.textContent = note;
    panelEl.appendChild(hint);
  }
  rows.push(row);
}

function addAction({ label, run }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'sp-wide';
  el.textContent = label;
  const row = {
    el,
    refresh: () => {},
    activate: () => {
      const msg = run();
      if (!msg) return;
      // Confirm in place: with no other feedback channel there's otherwise no
      // way to tell whether the press did anything.
      el.textContent = msg;
      window.setTimeout(() => { el.textContent = label; }, 1200);
    },
  };
  el.addEventListener('click', row.activate);
  panelEl.appendChild(el);
  rows.push(row);
}

// Rows belonging to the OTHER steering mode are dimmed, never hidden: a panel
// that reflows as you change modes is miserable to poke at while standing on a
// board, and dimming keeps it visible that the other mode has its own knobs.
function refreshRelevance() {
  const absolute = state.mode === STEERING_ABSOLUTE;
  panelEl.querySelectorAll('[data-mode="absolute"]').forEach((el) => {
    el.classList.toggle('sp-dim', !absolute);
  });
  panelEl.querySelectorAll('[data-mode="stepped"]').forEach((el) => {
    el.classList.toggle('sp-dim', absolute);
  });
}

function refreshSelection() {
  rows.forEach((r, i) => r.el.classList.toggle('sp-sel', i === selected));
}

function setPanelOpen(open) {
  panelEl.classList.toggle('hidden', !open);
  if (open) {
    selected = 0;
    refreshSelection();
  }
}

export function initSteeringPanel() {
  load();
  applyAll();

  const button = document.getElementById('steering-button');
  panelEl = document.getElementById('steering-panel');
  if (!button || !panelEl) return;

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
    values: STEERING_MODES,
    get: () => state.mode,
    set: (v) => { state.mode = v; },
    // Says the quiet part out loud: the mode is only HALF a game-side choice.
    // Absolute reads the analog sensor, which the host only leaves uncontested
    // when the scene's forwardSteeringKeys is off.
    note: 'absolute needs forwardSteeringKeys = OFF on the scene',
  });
  addStepper({
    label: 'LANE ZONE',
    key: 'laneZone',
    mode: 'absolute',
    min: 0.1,
    max: 0.9,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    note: 'lean past this to leave the centre lane',
  });
  addStepper({
    label: 'HYSTERESIS',
    key: 'hysteresis',
    mode: 'absolute',
    min: 0,
    max: 0.4,
    step: 0.02,
    fmt: (v) => v.toFixed(2),
    note: 'stops a lean parked on the edge flapping between lanes',
  });
  addStepper({
    label: 'JUMP TILT',
    key: 'jumpTilt',
    mode: 'absolute',
    min: 0.15,
    max: 0.95,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    note: 'forward lean to jump (analog mode sends no ArrowUp)',
  });
  addStepper({
    label: 'SENSITIVITY',
    key: 'sensitivity',
    mode: 'stepped',
    min: 0,
    max: 100,
    step: 5,
    fmt: (v) => `${Math.round(v)}`,
    note: 'stepped mode only -- tunes the HOST thresholds',
  });
  addAction({
    label: 'RECENTRE BOARD',
    run: () => (recenterBoard() ? 'CENTRED ✓' : 'NO SENSOR (BROWSER)'),
  });
  addAction({
    label: 'CLOSE',
    // Reachable by key as well as touch -- with the gear unclickable in the
    // Editor, this is the only way back out of the menu there.
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
    // Both keys mean RESTART on the game-over screen (core/main.js listens for
    // them, and the host separately synth-clicks #restart-button there). Never
    // shadow that.
    const gameover = document.getElementById('gameover-overlay');
    if (gameover && !gameover.classList.contains('hidden')) return;

    if (panelEl.classList.contains('hidden')) {
      // Closed: only Enter opens it. Space stays inert so it can't be opened by
      // accident, and because the gear itself can't be clicked in the Editor
      // this is the sole way in there.
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
