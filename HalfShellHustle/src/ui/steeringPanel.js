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
// Rows are built in JS rather than written into index.html so adding a tunable
// is a one-line change here (same reasoning as ui/hud.js's initLivesTray).
//
// WHO OWNS WHAT: input/input.js owns the actual steering values and logic; this
// file only renders controls and pushes changes into it. The one exception is
// SENSITIVITY, which tunes thresholds that live on the Unity side and is
// therefore sent over the gb:sensitivity bridge instead -- see its row below.

import {
  STEERING_MODES, STEERING_STEPPED, STEERING_ABSOLUTE, DEFAULT_STEERING_MODE,
  LANE_ZONE_THRESHOLD, LANE_ZONE_HYSTERESIS, JUMP_TILT_THRESHOLD,
} from '../data/constants.js';
import {
  setSteeringMode, setLaneZoneThreshold, setLaneZoneHysteresis,
  setJumpTiltThreshold, recenterBoard,
} from '../input/input.js';

const STORAGE_KEY = 'hsh:steering';

// 55 maps to pressThreshold ~= 0.3525, within a rounding error of the SDK's own
// stock 0.35 -- so a fresh install feels exactly as it did before this panel
// existed, and nothing changes until someone deliberately moves a slider.
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

// Everything the panel knows, applied to the systems that actually use it.
function applyAll() {
  setSteeringMode(state.mode);
  setLaneZoneThreshold(state.laneZone);
  setLaneZoneHysteresis(state.hysteresis);
  setJumpTiltThreshold(state.jumpTilt);
  pushSensitivity();
}

// One -/value/+ row. `fmt` keeps the readout narrow enough not to reflow the
// panel as digits change.
function addStepperRow(panel, { label, key, min, max, step, fmt, note, mode }) {
  const row = document.createElement('div');
  row.className = 'sp-row';
  if (mode) row.dataset.mode = mode;

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

  const render = () => { value.textContent = fmt(state[key]); };
  const nudge = (dir) => {
    const next = Math.min(max, Math.max(min, state[key] + dir * step));
    // Float steps accumulate error (0.35 + 0.01 * 3 !== 0.38); round to the
    // step's own precision so the readout and the stored value stay honest.
    state[key] = Math.round(next / step) * step;
    render();
    applyAll();
    save();
  };
  down.addEventListener('click', () => nudge(-1));
  up.addEventListener('click', () => nudge(1));

  row.append(name, down, value, up);
  panel.appendChild(row);
  if (note) {
    const hint = document.createElement('div');
    hint.className = 'sp-note';
    hint.textContent = note;
    if (mode) hint.dataset.mode = mode;
    panel.appendChild(hint);
  }
  render();
}

// Rows that only matter in one mode are dimmed rather than hidden, so the panel
// never changes height (a shifting panel is miserable to poke at on a board) and
// so it stays obvious that the other mode has its own knobs.
function markRelevance(panel) {
  const absolute = state.mode === STEERING_ABSOLUTE;
  panel.querySelectorAll('[data-mode="absolute"]').forEach((el) => {
    el.classList.toggle('sp-dim', !absolute);
  });
  panel.querySelectorAll('[data-mode="stepped"]').forEach((el) => {
    el.classList.toggle('sp-dim', absolute);
  });
}

export function initSteeringPanel() {
  load();
  applyAll();

  const button = document.getElementById('steering-button');
  const panel = document.getElementById('steering-panel');
  if (!button || !panel) return;

  button.addEventListener('click', () => panel.classList.toggle('hidden'));

  // --- mode ---
  const modeRow = document.createElement('div');
  modeRow.className = 'sp-row';
  const modeLabel = document.createElement('span');
  modeLabel.className = 'sp-label';
  modeLabel.textContent = 'MODE';
  const modeButton = document.createElement('button');
  modeButton.type = 'button';
  modeButton.className = 'sp-mode';
  const renderMode = () => { modeButton.textContent = state.mode; };
  modeButton.addEventListener('click', () => {
    const i = STEERING_MODES.indexOf(state.mode);
    state.mode = STEERING_MODES[(i + 1) % STEERING_MODES.length];
    renderMode();
    markRelevance(panel);
    applyAll();
    save();
  });
  modeRow.append(modeLabel, modeButton);
  panel.appendChild(modeRow);
  const modeNote = document.createElement('div');
  modeNote.className = 'sp-note';
  // Says the quiet part out loud, because the mode is only HALF a game-side
  // choice: absolute reads the analog sensor, which the host only leaves
  // uncontested when the scene's forwardSteeringKeys is off.
  modeNote.textContent = 'absolute needs forwardSteeringKeys = OFF on the scene';
  panel.appendChild(modeNote);

  // --- absolute-mode tunables ---
  addStepperRow(panel, {
    label: 'LANE ZONE',
    key: 'laneZone',
    mode: 'absolute',
    min: 0.1,
    max: 0.9,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    note: 'lean past this to leave the centre lane',
  });
  addStepperRow(panel, {
    label: 'HYSTERESIS',
    key: 'hysteresis',
    mode: 'absolute',
    min: 0,
    max: 0.4,
    step: 0.02,
    fmt: (v) => v.toFixed(2),
    note: 'stops a lean parked on the edge flapping between lanes',
  });
  addStepperRow(panel, {
    label: 'JUMP TILT',
    key: 'jumpTilt',
    mode: 'absolute',
    min: 0.15,
    max: 0.95,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    note: 'forward lean to jump (analog mode only sends no ArrowUp)',
  });

  // --- stepped-mode tunable (lives on the Unity side) ---
  addStepperRow(panel, {
    label: 'SENSITIVITY',
    key: 'sensitivity',
    mode: 'stepped',
    min: 0,
    max: 100,
    step: 5,
    fmt: (v) => `${Math.round(v)}`,
    note: 'stepped mode only -- tunes the HOST thresholds',
  });

  // --- recentre ---
  const recenterButton = document.createElement('button');
  recenterButton.type = 'button';
  recenterButton.className = 'sp-wide';
  recenterButton.textContent = 'RECENTRE BOARD';
  recenterButton.addEventListener('click', () => {
    const ok = recenterBoard();
    // Absolute mode makes a drifted neutral much more punishing than stepped
    // mode does -- there it only biases a gesture, here it parks you in the
    // wrong lane permanently. Confirming in-place matters because there's no
    // other way to tell whether the press did anything.
    recenterButton.textContent = ok ? 'CENTRED ✓' : 'NO SENSOR (BROWSER)';
    window.setTimeout(() => { recenterButton.textContent = 'RECENTRE BOARD'; }, 1200);
  });
  panel.appendChild(recenterButton);

  renderMode();
  markRelevance(panel);
}
