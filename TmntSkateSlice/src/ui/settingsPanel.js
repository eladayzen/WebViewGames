// Settings panel (gear button, top-right chrome row) -- SENSITIVITY, MUSIC,
// SFX, live and persisted. Ported from HalfShellHustle's steeringPanel.js
// pattern (2026-08-19); see that file for the fuller rationale on why this
// is one shared touch+key-navigable panel rather than several standalone
// buttons.
//
// DRIVEN BY TWO KEYS, not just touch. Inside the real Unity WebView there is
// no pointer at all: WebGameController forwards exactly Space and Enter
// (plus, in digital steering mode only, the synthetic arrow keys) and never
// forwards a click -- the SDK's one hardcoded `.click()` targets
// #restart-button and only while #gameover-overlay is up (see
// GOBALANCE_SDK.md). TmntSkateSlice runs in ANALOG mode
// (forwardSteeringKeys = false), so arrow keys aren't dispatched either --
// Space/Enter are the ONLY input the host forwards unconditionally. So the
// gear button is genuinely unreachable inside the real WebView without a
// key-driven alternative, and the row model below is shared by both it and
// the touch buttons so the two can never drift apart.
//
// WHO OWNS WHAT: this file only renders rows and pushes changes into the
// systems that actually own the state (input.js for sensitivity,
// systems/audio.js for SFX/music) -- same split HalfShellHustle's panel
// uses. SENSITIVITY deliberately does NOT use the SDK's gb:sensitivity
// bridge: that tunes Unity-side key press/release thresholds and does
// nothing at all in analog mode (confirmed against GOBALANCE_SDK.md, and
// HalfShellHustle's own identical row is marked "stepped mode only --
// tunes the HOST thresholds" for the same reason). Instead it's a
// game-side gain multiplier on the raw analog tilt -- see input.js's
// getSensitivity/setSensitivity for the actual math.

import { getSensitivity, setSensitivity } from '../input/input.js';
import { getSfxEnabled, setSfxEnabled, getMusicEnabled, setMusicEnabled } from '../systems/audio.js';

const rows = [];
let selected = 0;
let panelEl = null;
let onTap = null; // UI-tap sfx, injected by initSettingsPanel -- this file doesn't own any audio buffers itself

function commit() {
  rows.forEach((r) => r.refresh());
}

function addStepper({ label, min, max, step, fmt, get, set }) {
  const el = document.createElement('div');
  el.className = 'sp-row';

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

  // Stepping WRAPS at the top rather than clamping: with only two keys
  // there is no "decrease" outside touch, so wrapping is the sole way back
  // down to a lower value from the keyboard-only path.
  function stepValue(dir) {
    let next = get() + dir * step;
    if (next > max + 1e-9) next = min;
    else if (next < min - 1e-9) next = max;
    // Float steps accumulate error; snap to the step's own precision so
    // the readout and the stored value stay honest.
    next = Math.round(next / step) * step;
    set(next);
    commit();
  }

  const row = {
    el,
    refresh: () => { value.textContent = fmt(get()); },
    activate: () => stepValue(1),
  };
  down.addEventListener('click', () => stepValue(-1));
  up.addEventListener('click', () => stepValue(1));

  el.append(name, down, value, up);
  panelEl.appendChild(el);
  rows.push(row);
}

function addChoice({ label, values, get, set }) {
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
      if (onTap) onTap();
      run();
    },
  };
  el.addEventListener('click', row.activate);
  panelEl.appendChild(el);
  rows.push(row);
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

// `playUiTap` is a zero-arg callback (main.js supplies `() =>
// playSfx(audio, sfx.sfx_ui_tap)`) -- this file never touches the audio
// buffers/instance itself, matching the "who owns what" split above.
export function initSettingsPanel(playUiTap) {
  onTap = playUiTap;

  const button = document.getElementById('settings-button');
  panelEl = document.getElementById('settings-panel');
  if (!button || !panelEl) return;

  button.addEventListener('click', () => {
    if (onTap) onTap();
    setPanelOpen(panelEl.classList.contains('hidden'));
  });

  // The key scheme is not discoverable, and inside Unity it's the only way
  // to drive this panel at all -- so it's stated on the panel rather than
  // left to be remembered.
  const keyHint = document.createElement('div');
  keyHint.className = 'sp-keyhint';
  keyHint.textContent = 'ENTER = next row   SPACE = change';
  panelEl.appendChild(keyHint);

  addStepper({
    label: 'SENSITIVITY',
    min: 0,
    max: 100,
    step: 5,
    fmt: (v) => `${Math.round(v)}`,
    get: getSensitivity,
    set: setSensitivity,
  });
  addChoice({
    label: 'MUSIC',
    values: ['ON', 'OFF'],
    get: () => (getMusicEnabled() ? 'ON' : 'OFF'),
    set: (v) => setMusicEnabled(v === 'ON'),
  });
  addChoice({
    label: 'SFX',
    values: ['ON', 'OFF'],
    get: () => (getSfxEnabled() ? 'ON' : 'OFF'),
    set: (v) => setSfxEnabled(v === 'ON'),
  });
  addAction({
    label: 'CLOSE',
    // Reachable by key as well as touch -- with the gear unclickable
    // inside the real WebView (no pointer forwarded), this is the only way
    // back out of the menu there.
    run: () => setPanelOpen(false),
  });

  rows.forEach((r) => r.refresh());
  refreshSelection();

  // ENTER moves the selection, SPACE acts on it. These are the only two
  // keys the Unity host forwards unconditionally (see this file's header),
  // so they have to carry the whole menu between them -- hence no
  // "decrease" from the keyboard path: steppers wrap instead.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    // Never shadow the intro tutorial's own Space/Enter advance (core/
    // main.js), or the SDK's synthetic restart-click while the game-over
    // overlay is up (GOBALANCE_SDK.md) -- both already claim these keys
    // for their own overlay. Same for the stage-complete curtain beat: it's
    // a countdown the player just watches, and popping a settings panel
    // over it (which they'd then be left holding when the next stage
    // starts under them) is the last thing wanted there.
    const intro = document.getElementById('intro-tutorial-overlay');
    if (intro && !intro.classList.contains('hidden')) return;
    const gameover = document.getElementById('gameover-overlay');
    if (gameover && !gameover.classList.contains('hidden')) return;
    const stageComplete = document.getElementById('stage-complete-overlay');
    if (stageComplete && !stageComplete.classList.contains('hidden')) return;

    if (panelEl.classList.contains('hidden')) {
      // Closed: only Enter opens it. Space stays inert so it can't be
      // opened by accident, and because the gear itself can't be clicked
      // inside the real WebView this is the sole way in there.
      if (e.code !== 'Enter') return;
      e.preventDefault();
      if (onTap) onTap();
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
