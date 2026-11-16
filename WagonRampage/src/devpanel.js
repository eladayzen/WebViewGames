// Dev panel: every look value live, plus god mode. Shown on localhost or with ?dev=1 (never in
// the shipped WebView). Values persist in this browser; "Copy values" puts the JSON on the
// clipboard so the chosen look can be baked into LOOK in main.js.
import GUI from 'lil-gui';

const KEY = 'wr_look';

export function devPanelWanted() {
  const h = location.hostname;
  return new URLSearchParams(location.search).has('dev') || h === 'localhost' || h === '127.0.0.1';
}

export function loadSavedLook(look) {
  try { Object.assign(look, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage blocked */ }
}

const PKEY = 'wr_presets';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

// presets: { name: values } baked in main.js; custom slots re-saved here override the baked copy
export function buildDevPanel(look, presets, apply, G) {
  const gui = new GUI({ title: 'DEV — look' });
  // below the pause/mute corner buttons, scrollable if the window is short
  Object.assign(gui.domElement.style, { zIndex: 60, top: '64px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' });
  const baked = new Set(Object.keys(presets));
  const saved = read(PKEY, {});
  for (const n of Object.keys(saved)) if (n !== 'Default') presets[n] = { ...presets[n], ...saved[n] };
  const persist = (name, v) => { const s = read(PKEY, {}); if (v) s[name] = v; else delete s[name]; write(PKEY, s); };
  const state = { preset: read(KEY + '_preset', read(KEY, null) ? 'Custom 1' : 'Default') };
  if (!(state.preset in presets)) state.preset = 'Default';
  const save = () => write(KEY, look);
  const on = () => { apply(); save(); };
  const add = (f, k, a, b, s) => f.add(look, k, a, b, s).onChange(on);
  const col = (f, k) => f.addColor(look, k).onChange(on);
  const load = (name) => {
    Object.assign(look, presets.Default, presets[name]);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    write(KEY + '_preset', name); on();
  };

  const game = gui.addFolder('Game  ·  keys Z Leo  X Raph  C Mikey  V Donnie  B Saws');
  const acts = {
    god: () => { G.god = !G.god; godBtn.name(G.god ? 'God mode: ON' : 'God mode: off'); },
    // Default is read-only: saving while on it makes a new preset instead
    store: () => {
      if (state.preset === 'Default') return acts.saveNew();
      presets[state.preset] = { ...look }; persist(state.preset, { ...look });
    },
    saveNew: () => {
      let n = 1; while (`Custom ${n}` in presets) n++;
      const name = `Custom ${n}`;
      presets[name] = { ...look }; persist(name, { ...look });
      state.preset = name; write(KEY + '_preset', name);
      presetCtl.options(Object.keys(presets)).setValue(name);
    },
    // presets made here can be deleted; a baked one (from main.js) just drops your edits to it
    del: () => {
      const name = state.preset;
      if (name === 'Default') return;
      persist(name, null);
      if (baked.has(name)) { load(name); return; }
      delete presets[name];
      state.preset = 'Default';
      presetCtl.options(Object.keys(presets)).setValue('Default');
    },
    copy: () => { const j = JSON.stringify(look, null, 2); navigator.clipboard?.writeText(j).catch(() => {}); console.log('[look]', j); },
  };
  const presetCtl = game.add(state, 'preset', Object.keys(presets)).name('Look preset').onChange(load);
  game.add(acts, 'store').name('Save current → this preset');
  game.add(acts, 'saveNew').name('Save current as NEW preset');
  game.add(acts, 'del').name('Delete this preset');
  const godBtn = game.add(acts, 'god').name(G.god ? 'God mode: ON' : 'God mode: off');
  game.add(acts, 'copy').name('Copy values (JSON)');

  add(game, 'shake', 0, 2, 0.01).name('Camera shake ×');
  add(game, 'hitStop', 0, 2, 0.01).name('Freeze frame ×');

  const post = gui.addFolder('Camera & post');
  add(post, 'exposure', 0.5, 2.5, 0.01);
  add(post, 'saturation', 0.5, 1.6, 0.01);
  add(post, 'contrast', 0.8, 1.3, 0.01);
  add(post, 'vignette', 0, 0.8, 0.01);
  add(post, 'speedBlur', 0, 2, 0.01);
  add(post, 'bloomStrength', 0, 2, 0.01);
  add(post, 'bloomRadius', 0, 1, 0.01);
  add(post, 'bloomThreshold', 0.5, 1.5, 0.01);

  const sun = gui.addFolder('Directional (moon) light');
  add(sun, 'sunIntensity', 0, 6, 0.05);
  col(sun, 'sunColor');
  add(sun, 'sunAzimuth', -180, 180, 1);
  add(sun, 'sunElevation', 5, 89, 1);
  add(sun, 'hemiIntensity', 0, 3, 0.01);
  col(sun, 'hemiSky');
  col(sun, 'hemiGround');

  const city = gui.addFolder('City lights');
  add(city, 'lampLight', 0, 120, 1);
  add(city, 'lampPool', 0, 1, 0.01);
  add(city, 'neonLight', 0, 160, 1);
  add(city, 'windows', 0, 2.5, 0.01);
  add(city, 'neonSigns', 0, 3, 0.01);
  add(city, 'underglow', 0, 1.5, 0.01);
  add(city, 'fogDensity', 0, 0.012, 0.0001);

  const road = gui.addFolder('Wet road');
  add(road, 'roadWet', 0, 1.5, 0.01);
  add(road, 'roadDark', 0, 0.8, 0.01);
  add(road, 'fresnelBase', 0, 0.4, 0.005);
  add(road, 'fresnelEdge', 0, 1.2, 0.01);
  add(road, 'dampSheen', 0, 1, 0.01);
  add(road, 'walkWet', 0, 1, 0.01);

  const foot = gui.addFolder('Foot cars');
  col(foot, 'footRacer'); col(foot, 'footTruck');
  add(foot, 'footRough', 0, 1, 0.01); add(foot, 'footMetal', 0, 1, 0.01);
  col(foot, 'footGlow'); add(foot, 'footStripes', 0, 3, 0.01);

  const heroes = gui.addFolder('Heroes');
  add(heroes, 'raphHeight', 1.5, 4, 0.01);
  add(heroes, 'hatchRadius', 0.3, 1.6, 0.01);
  add(heroes, 'hatchZ', -1.5, 1.5, 0.01);

  return gui;
}
