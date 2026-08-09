// The front door: pick a mode, ride.
//
// The buttons are built from the mode REGISTRY, never written by hand. That is
// the whole design: registering a mode is the only step needed to make it
// playable, so there is no second list to forget to update and no way for the
// lobby and the game to disagree about which modes exist.
//
// Nothing else belongs on this screen. Render options, tuning and the lab all
// live behind the gear, where they can be reached mid-run and cannot stand
// between a player and a run.

import { listModes } from '../modes/mode.js';

export function createModeSelect(onPick) {
  const el = document.getElementById('mode-select');
  const list = document.getElementById('mode-list');

  for (const def of listModes()) {
    const b = document.createElement('button');
    b.className = 'ms-opt';
    b.dataset.mode = def.id;
    b.innerHTML = `<b>${def.name}</b><small>${def.tagline}</small>`;
    b.addEventListener('click', () => {
      el.classList.add('hidden');
      onPick(def.id);
    });
    list.appendChild(b);
  }

  return {
    isOpen: () => !el.classList.contains('hidden'),
    open() { el.classList.remove('hidden'); },
    close() { el.classList.add('hidden'); },
  };
}
