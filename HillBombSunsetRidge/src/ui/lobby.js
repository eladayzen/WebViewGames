// Render-lab lobby wiring.
//
// Holds the harness's config and notifies the game when it changes. Deliberately
// dumb: it owns no rendering state, just the switches, so the comparison stays
// "same game, different rider layer" rather than "different builds".

const TOGGLES = {
  lighting: { values: ['unlit', 'lit'], index: 0 },
  swing: { values: ['full', 'half', 'off'], index: 0 },
  texres: { values: ['1024', '512', '256'], index: 0 },
  autotrick: { values: ['off', 'on'], index: 0 },
};

export function createLobby(onChange, onStart) {
  const lobby = document.getElementById('lobby');
  const modeButtons = [...document.querySelectorAll('.opt')];
  const togButtons = [...document.querySelectorAll('.tog')];
  const startButton = document.getElementById('start-button');
  // The dedicated lab button is gone from the chrome row -- the render lab is
  // now a row inside the settings panel (see ui/settingsPanel.js), which is
  // where per-game options live across all our games. Guarded rather than
  // assumed: without this, a null element here throws on boot and takes the
  // whole game down.
  const labButton = document.getElementById('lab-button');
  const modeReadout = document.getElementById('mode-readout');
  const controlsSelect = document.getElementById('controls-select');

  // URL overrides make the harness deterministically testable -- e.g.
  // ?mode=model&ride=1&autotrick=on drops straight into a hands-free mode-B run.
  // Without this, comparing modes means clicking a centred lobby, which is both
  // tedious and unreliable to automate.
  const q = new URLSearchParams(location.search);

  const config = {
    // Default is the RIGGED character -- the mode that actually represents the
    // game now. 'sprite' and 'model' were the A/B controls for the earlier
    // "which rider representation should we use" comparison, which is settled;
    // they stay reachable from the lab for reference but are no longer what you
    // get on open.
    mode: ['model', 'sprite'].includes(q.get('mode')) ? q.get('mode') : 'rigged',
    lighting: q.get('lit') === '1' ? 'lit' : 'unlit',
    swing: q.get('swing') || 'full',
    texres: q.get('texres') || '1024',
    autotrick: q.get('autotrick') === 'on' ? 'on' : 'off',
    controls: q.get('controls') === 'loose' ? 'loose' : 'planted',
  };
  // Keep the toggle cycles in sync with any URL overrides so the lobby's
  // displayed value matches what's actually running.
  for (const key of ['lighting', 'swing', 'texres', 'autotrick']) {
    const i = TOGGLES[key].values.indexOf(config[key]);
    if (i >= 0) TOGGLES[key].index = i;
    else config[key] = TOGGLES[key].values[0];
  }

  function syncUI() {
    modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === config.mode));
    togButtons.forEach((b) => {
      const t = TOGGLES[b.dataset.tog];
      b.querySelector('small').textContent = t.values[t.index];
      b.classList.toggle('active', t.index !== 0);
    });
    modeReadout.textContent = {
      sprite: 'MODE A — SPRITE',
      model: 'MODE B — 3D MODEL (STATIC)',
      rigged: 'MODE C — RIGGED + ANIMATED',
    }[config.mode] || config.mode;
  }

  if (controlsSelect) {
    controlsSelect.value = config.controls;
    controlsSelect.addEventListener('change', () => {
      config.controls = controlsSelect.value;
      onChange(config); // takes effect immediately, no restart
    });
  }

  modeButtons.forEach((b) => {
    b.addEventListener('click', () => {
      config.mode = b.dataset.mode;
      syncUI();
      onChange(config);
    });
  });

  togButtons.forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.tog;
      const t = TOGGLES[key];
      t.index = (t.index + 1) % t.values.length;
      config[key] = t.values[t.index];
      syncUI();
      onChange(config);
    });
  });

  function open() {
    lobby.classList.remove('hidden');
  }
  function close() {
    lobby.classList.add('hidden');
    onStart();
  }

  startButton.addEventListener('click', close);
  if (labButton) labButton.addEventListener('click', open);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyL') {
      if (lobby.classList.contains('hidden')) open();
      else close();
    }
  });

  syncUI();
  onChange(config);
  // Ride straight away by default -- the options screen is no longer the front
  // door ("I don't need to see all of those options in the beginning"). It's
  // still one keypress away: L, or the gear button, opens the lab mid-run and
  // every setting applies live. `?lobby=1` forces it open on load if needed.
  if (q.get('lobby') !== '1') close();

  return { config, open, close, isOpen: () => !lobby.classList.contains('hidden') };
}
