import boardUrl from '../assets/ui_board.png?url';
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
  STANCE_MODES, STANCE_SQUARE, STANCE_SKATE, setStance,
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
  // SKATE by default -- the board is shaped like a skateboard, so standing
  // across it is what the hardware invites. See input/input.js.
  /**
   * REGULAR (square) BY DEFAULT, not skate. Amit: "the stance default will be
   * regular -- left and right. If people want to change to skate, it's their
   * choice."
   *
   * Square is the right default for two separate reasons. It steers on LEFT and
   * RIGHT, which is what anyone picking up the game assumes, whereas skate puts
   * carve on up/down and reads as broken until you know. And it is the safer
   * one to ship: skate only works if the Unity scene has forwardVerticalAxis
   * ticked, so a mis-configured scene left the game unsteerable -- square asks
   * nothing of the host.
   */
  stance: STANCE_SQUARE,
  mode: STEER_REGULAR,
  preset: CONTROLS.key,
  carveSmooth: CARVE_SMOOTH,
  carveCurve: CARVE_CURVE,
  sensitivity: DEFAULT_SENSITIVITY,
  /**
   * SOUND, on two switches that are genuinely independent -- Amit: "sfx and
   * music, controlled separately, with enable/disable options for both
   * separately."
   *
   * Two booleans rather than one master and a sub-setting, because the pair are
   * not a hierarchy: wanting the effects without the music is the common case
   * (someone playing with their own music on), and wanting music without the
   * effects is a real preference too. Either combination has to be reachable
   * without the other switch getting in the way.
   *
   * Both default ON. A game that ships silent reads as broken, and the switches
   * are one screen away for anyone who wants the quiet.
   */
  sfx: true,
  music: true,
  /** 0..100 each, independent of the on/off switches. */
  sfxVolume: 80,
  musicVolume: 70,
};

let panelEl = null;
/**
 * TWO PANELS, ONE WIDGET SET.
 *
 * Amit: "we're removing MODE, FEEL, CURVE, RECENTRE, RENDER LAB from the
 * settings -- everything we remove goes to the dev options, that's a different
 * tab... later on we will make it disappear and come up only if someone knows
 * the combination."
 *
 * The split is by AUDIENCE, not by importance. A player setting answers "how do
 * I want to play"; a dev setting answers "how is this build wired to the host",
 * and every one of the moved rows is the second kind -- steer mode and
 * sensitivity are half host-side, the carve numbers only bite on analog input,
 * and RECENTRE and RENDER LAB are instruments rather than preferences. Showing
 * them to a player is not just clutter: it invites them to break their own
 * controls in ways they cannot diagnose.
 *
 * `rows` points at whichever list is being built or shown, so addChoice and its
 * siblings need no knowledge of which panel they are on.
 */
const playerRows = [];
const devRows = [];
let rows = playerRows;
/** Which list is on screen -- swapped by the DEV OPTIONS / BACK rows. */
let showingDev = false;
let selected = 0;
let onOpenLab = null;
/** The sound system, so the two audio rows can drive it. Optional. */
let audio = null;
/** Told whenever the panel opens or closes -- see initSettingsPanel's hooks. */
let onPanelToggle = null;
/** The DEV OPTIONS row, hidden until the unlock fires. See unlockDevOptions. */
let devRow = null;

// localStorage can throw outright in a restricted WebView (private mode,
// storage disabled). A tuning nicety must never take the game down with it, so
// both directions are guarded and simply fall back to defaults.
function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (STEER_MODES.includes(saved.mode)) state.mode = saved.mode;
    if (STANCE_MODES.includes(saved.stance)) state.stance = saved.stance;
    if (CONTROL_PRESETS[saved.preset]) state.preset = saved.preset;
    for (const k of ['carveSmooth', 'carveCurve', 'sensitivity']) {
      if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) state[k] = saved[k];
    }
    // Read separately from the numbers above, and only when actually boolean --
    // an older stored blob has neither key, and `undefined` must leave the
    // default alone rather than turning the sound off for everyone who has
    // played before.
    for (const k of ['sfx', 'music']) {
      if (typeof saved[k] === 'boolean') state[k] = saved[k];
    }
    for (const k of ['sfxVolume', 'musicVolume']) {
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
  setStance(state.stance);
  setControlPreset(state.preset);
  FEEL.carveSmooth = state.carveSmooth;
  FEEL.carveCurve = state.carveCurve;
  pushSensitivity();
  // At BOOT as well as on change -- a stored preference that is never re-applied
  // is not a preference, and the audio system starts with both on.
  if (audio) {
    audio.setSfx(state.sfx);
    audio.setMusic(state.music);
    audio.setSfxVolume(state.sfxVolume / 100);
    audio.setMusicVolume(state.musicVolume / 100);
  }
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
  // NOT attached here -- showRows() places whichever list is on screen, so a
  // row built for the dev panel does not appear on the player's.

  return { el, value };
}

/** A cycling choice: activating steps to the next value and wraps. */
/**
 * @param {{fmt?: (v:any) => string}} opts `fmt` renames a value for display.
 *
 * The stored value and the shown one are not always the same word: the stance
 * is 'square' internally, because that is what the geometry is, and REGULAR to
 * a player, because that is what the stance is called. Formatting at the row
 * keeps the rename out of the input system, which would otherwise have to carry
 * a display name it never uses.
 */
function addChoice({ label, values, get, set, note, relevance, fmt }) {
  const { el, value } = makeRow(label, note);
  const row = {
    el,
    relevance,
    refresh() {
      const v = get();
      value.textContent = fmt ? fmt(v) : String(v).toUpperCase();
    },
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
/**
 * A DRAGGABLE SLIDER that is also key-operable.
 *
 * Amit: "the volume controllers need to be sliders for both."
 *
 * The awkward part is that this panel has two completely different input
 * surfaces. With a pointer, a slider is obvious and a stepper is tedious --
 * eight taps to cross a range. On the GoBalance board there is no pointer at
 * all and the host forwards only Enter and Space, so a slider is undraggable
 * and the only possible gesture is "act on the selected row".
 *
 * So it is BOTH: a real range input for a thumb, and activate() still steps and
 * wraps for the two-key path. Neither surface is a degraded version of the
 * other, and the value they move is the same one.
 */
function addSlider({ label, key, min, max, step, fmt, note, relevance }) {
  const { el, value } = makeRow(label, note);
  // The readout stays a button so the row still has something to select and
  // press on the board, and so it lines up with every other row's value.
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'sp-slider';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const row = {
    el,
    relevance,
    refresh() {
      value.textContent = fmt(state[key]);
      input.value = String(state[key]);
    },
    activate() {
      // Wraps rather than clamping: with only one key there is no way back down
      // a slider that has hit its top.
      let v = state[key] + step;
      if (v > max + 1e-9) v = min;
      state[key] = Math.round(v * 1000) / 1000;
      applyAll();
      save();
      row.refresh();
      refreshRelevance();
    },
  };
  input.addEventListener('input', () => {
    state[key] = Number(input.value);
    applyAll();
    value.textContent = fmt(state[key]);
  });
  // Saved on release rather than on every pixel of the drag -- localStorage
  // writes during a drag are pure waste, and in a restricted WebView each one
  // is a chance to throw.
  input.addEventListener('change', save);
  value.addEventListener('click', row.activate);
  el.insertBefore(input, value);
  rows.push(row);
  return row;
}

/**
 * THE STANCE ROW IS A PICTURE OF THE ACTUAL BOARD, not a word and not a
 * skateboard.
 *
 * Amit: "the stance needs some kind of shape, icon for it... just showing the
 * actual frame of the board like we were using in the other tutorials, with an
 * arrow explaining, and it would be a button that flips." Then, on a first pass
 * that drew a generic skateboard: "I meant the board, the BALANCE board -- we
 * have that asset in the TMNT tutorials."
 *
 * Which is the whole point. The player is standing on a GoBalance board, not a
 * skateboard, and a picture that shows them something else is worse than a word
 * -- it is a confident wrong answer. This is the same overhead artwork
 * HalfShellHustle teaches its controls with, so a player who has met one of our
 * games already recognises it.
 *
 * ROTATION IS THE WHOLE INTERACTION, and it works because the asset already
 * carries its own arrows. Turning the image a quarter turn turns the footprints
 * with it -- the rider now stands ACROSS the board, which is exactly what skate
 * stance is -- and the left/right arrows become up/down, which is exactly which
 * way they now lean. One transform says both halves of it, and neither is drawn
 * twice or able to disagree with the other.
 */
function addStance() {
  const { el, value } = makeRow('STANCE', 'tap to flip \u2014 the arrows are the way you lean');
  value.classList.add('sp-stance');
  const img = document.createElement('img');
  img.src = boardUrl;
  img.alt = '';
  img.className = 'sp-board';
  const name = document.createElement('span');
  name.className = 'sp-stance-name';
  value.appendChild(img);
  value.appendChild(name);
  const row = {
    el,
    refresh() {
      const skate = state.stance !== STANCE_SQUARE;
      img.classList.toggle('sp-board-skate', skate);
      name.textContent = skate ? 'SKATE' : 'REGULAR';
    },
    activate() {
      state.stance = state.stance === STANCE_SQUARE ? STANCE_SKATE : STANCE_SQUARE;
      applyAll();
      save();
      row.refresh();
      refreshRelevance();
    },
  };
  value.addEventListener('click', row.activate);
  rows.push(row);
  return row;
}

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

/**
 * Show one of the two lists. The rows themselves are built once at boot and
 * simply re-parented, so state, selection handlers and relevance rules survive
 * a switch -- rebuilding them each time would drop whatever the player was
 * part-way through adjusting.
 */
function showRows(list) {
  rows = list;
  showingDev = list === devRows;
  const holder = panelEl && panelEl.querySelector('.sp-rows');
  if (!holder) return;
  holder.innerHTML = '';
  // A row hidden by class stays hidden across a panel swap -- appending it does
  // not clear the class, but saying so here stops the next person adding a
  // display:block that quietly re-reveals the dev row.
  for (const r of list) holder.appendChild(r.el);
  selected = 0;
  list.forEach((r) => r.refresh());
  refreshRelevance();
  refreshSelection();
}

function refreshSelection() {
  rows.forEach((r, i) => r.el.classList.toggle('sp-sel', i === selected));
  // Keep the highlighted row visible when the panel has to scroll. On-device
  // the highlight is the only feedback about what SPACE will change, so a
  // selection that has moved off-screen leaves the menu effectively blind.
  const cur = rows[selected];
  if (cur && cur.el.scrollIntoView) cur.el.scrollIntoView({ block: 'nearest' });
}

export function closeSettingsPanel() {
  setPanelOpen(false);
}

function setPanelOpen(open) {
  panelEl.classList.toggle('hidden', !open);
  if (open) {
    selected = 0;
    refreshSelection();
  } else {
    // Always reopen on the player's page. Landing back in DEV OPTIONS because
    // that is where you were last time is a small trap, and it is the one panel
    // a player is not meant to be in.
    if (showingDev) showRows(playerRows);
  }
  if (onPanelToggle) onPanelToggle(open);
}

/**
 * Reveal the DEV OPTIONS row for this session. Called by the unlock gesture.
 *
 * Deliberately has no matching lock(): the only way back is a reload, which is
 * what stops a panel opened once from staying open on a shared device.
 */
export function unlockDevOptions() {
  if (devRow) devRow.el.classList.remove('sp-hidden');
}

export function isPanelOpen() {
  return panelEl ? !panelEl.classList.contains('hidden') : false;
}

/**
 * @param {{openLab?: () => void}} hooks
 */
export function initSettingsPanel(hooks = {}) {
  onOpenLab = hooks.openLab || null;
  audio = hooks.audio || null;
  onPanelToggle = hooks.onToggle || null;
  load();

  const button = document.getElementById('settings-button');
  panelEl = document.getElementById('settings-panel');
  if (!button || !panelEl) return;
  // The holder the two row lists are swapped in and out of. Created here rather
  // than in the markup because it is an implementation detail of the swap --
  // nothing outside this file should be able to put anything in it.
  const holder = document.createElement('div');
  holder.className = 'sp-rows';
  panelEl.appendChild(holder);
  applyAll();

  button.addEventListener('click', () => setPanelOpen(panelEl.classList.contains('hidden')));

  // The key scheme is not discoverable, and inside Unity it's the only way to
  // drive this at all -- so it's stated on the panel rather than left to be
  // remembered.
  const keyHint = document.createElement('div');
  keyHint.className = 'sp-keyhint';
  // Key hint removed -- no keyboard on the board. The handlers stay.
  keyHint.textContent = '';
  // Not appended: with no text in it, it was an empty row of padding at the
  // bottom of the panel. Kept as an element so re-adding a hint is one line.
  void keyHint;

  // ---- THE PLAYER'S PANEL ---------------------------------------------------
  // How do I want to play. Nothing here can misconfigure the controls.
  rows = playerRows;

  addStance();
  // The two sound switches. ON/OFF as a two-value choice rather than a new
  // widget type: the row model already cycles values on activate, and cycling
  // is the only interaction the board can drive.
  addChoice({
    label: 'SFX',
    values: ['on', 'off'],
    get: () => (state.sfx ? 'on' : 'off'),
    set: (v) => { state.sfx = v === 'on'; },
    note: 'ramps, rails, pickups, crashes',
  });
  addSlider({
    label: 'SFX VOLUME',
    key: 'sfxVolume',
    min: 0,
    max: 100,
    step: 10,
    fmt: (v) => `${Math.round(v)}`,
    // Dimmed rather than hidden when the switch is off: a volume that vanishes
    // makes the player wonder where it went, whereas a greyed one explains
    // itself and shows what it will be when they switch back on.
    relevance: () => state.sfx,
  });
  addChoice({
    label: 'MUSIC',
    values: ['on', 'off'],
    get: () => (state.music ? 'on' : 'off'),
    set: (v) => { state.music = v === 'on'; },
    note: 'independent of SFX',
  });
  addSlider({
    label: 'MUSIC VOLUME',
    key: 'musicVolume',
    min: 0,
    max: 100,
    step: 10,
    fmt: (v) => `${Math.round(v)}`,
    relevance: () => state.music,
  });
  /**
   * HIDDEN UNTIL UNLOCKED. Amit: "hide the dev options button."
   *
   * The row is built either way and simply not shown, which matters because the
   * dev panel has to keep working -- it is needed on real hardware, in the
   * shipped build, in front of a player who has just reported something. A
   * build flag can only be one or the other, and PROD is exactly the build
   * worth debugging.
   *
   * Reachable by holding the speed readout for seven seconds and entering the
   * code -- see ui/devUnlock.js, and main.js for where it is installed. The
   * unlock is NOT persisted: a reload re-locks it, so a device left with the
   * panel open does not stay open.
   */
  devRow = addAction({
    label: 'DEV OPTIONS',
    run: () => { showRows(devRows); return null; },
    note: 'host wiring, control tuning, render lab',
  });
  devRow.el.classList.add('sp-hidden');
  addAction({
    label: 'CLOSE',
    // Reachable by key as well as touch -- with the gear unclickable on-device,
    // this is the only way back out of the menu there.
    run: () => { setPanelOpen(false); return null; },
  });

  // ---- THE DEV PANEL --------------------------------------------------------
  // How is this build wired to the host, and what do the controls actually do.
  // Everything moved out of the panel above, unchanged in behaviour.
  rows = devRows;

  addChoice({
    label: 'MODE',
    values: STEER_MODES,
    get: () => state.mode,
    set: (v) => { state.mode = v; },
    // Says the quiet part out loud: the mode is only HALF a game-side choice.
    // Analog reads the sensor, which the host only leaves uncontested when the
    // scene's forwardSteeringKeys is off. Exactly why it is not a player row.
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
    run: () => (recentreBoard() ? 'CENTRED \u2713' : 'NO SENSOR (BROWSER)'),
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
    label: 'BACK',
    run: () => { showRows(playerRows); return null; },
  });

  showRows(playerRows);

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
