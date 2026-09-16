// Shared two-key-navigable row-list builder for ui/steeringPanel.js (player
// settings) and ui/devPanel.js (dev tools, gated behind ui/devUnlock.js).
//
// DRIVEN BY TWO KEYS, not just touch -- inside the Unity WebView there is no
// pointer at all: WebGameController forwards exactly Space and Enter (plus
// the synthetic steering arrows) and never forwards a click. Space + Enter
// is therefore the entire available input surface in the Editor, and the
// row model here is shared by both it and the touch buttons so the two can
// never drift apart. Both panels use the SAME builder so neither one's
// interaction model can quietly diverge from the other's.
//
// One instance per panel -- each panel owns its own rows/selection state,
// even though the underlying VALUES most rows here read/write (systems/
// steeringSettings.js) are shared between the two panels.

import { playSfx } from '../systems/audio.js';
import { commitSteering } from '../systems/steeringSettings.js';

export function createRowPanel(panelEl) {
  const rows = [];
  let selected = 0;

  // Stepping WRAPS at the top rather than clamping: with only two keys there
  // is no "decrease", so wrapping is the sole way back down to a lower value.
  function stepValue(row, dir, state) {
    const { key, min, max, step } = row;
    let next = state[key] + dir * step;
    if (next > max + 1e-9) next = min;
    else if (next < min - 1e-9) next = max;
    // Float steps accumulate error (0.35 + 0.05 * 3 !== 0.50); snap to the
    // step's own precision so the readout and the stored value stay honest.
    state[key] = Math.round(next / step) * step;
    commitSteering();
  }

  function addStepper({ label, key, min, max, step, fmt, note, mode, state }) {
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
      activate: () => stepValue(row, 1, state),
    };
    down.addEventListener('click', () => stepValue(row, -1, state));
    up.addEventListener('click', () => stepValue(row, 1, state));

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
    return row;
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
        commitSteering();
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
    return row;
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
        playSfx('sfx_ui_tap');
        const msg = run();
        if (!msg) return;
        // Confirm in place: with no other feedback channel there's otherwise
        // no way to tell whether the press did anything.
        el.textContent = msg;
        window.setTimeout(() => { el.textContent = label; }, 1200);
      },
    };
    el.addEventListener('click', row.activate);
    panelEl.appendChild(el);
    rows.push(row);
    return row;
  }

  // Rows belonging to the OTHER steering mode are dimmed, never hidden: a
  // panel that reflows as you change modes is miserable to poke at while
  // standing on a board, and dimming keeps it visible that the other mode
  // has its own knobs.
  function refreshRelevance(currentMode) {
    panelEl.querySelectorAll('[data-mode="absolute"]').forEach((el) => {
      el.classList.toggle('sp-dim', currentMode !== 'absolute');
    });
    panelEl.querySelectorAll('[data-mode="stepped"]').forEach((el) => {
      el.classList.toggle('sp-dim', currentMode === 'absolute');
    });
  }

  function refreshSelection() {
    rows.forEach((r, i) => r.el.classList.toggle('sp-sel', i === selected));
  }

  return {
    rows,
    addStepper,
    addChoice,
    addAction,
    refreshRelevance,
    refreshSelection,
    getSelected: () => selected,
    setSelected: (v) => { selected = v; },
  };
}
