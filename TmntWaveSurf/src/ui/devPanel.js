// The developer panel: physics presets A/B/C, live sliders, Save as Custom and
// Copy JSON (the prototype's "DEV · physics" panel, unchanged), plus the dev
// switches that used to be player-visible in the prototype: the theme (Toon /
// Ooze Street), the controller (Physics / Direct) and a boss summon.
//
// NOT MOUNTED UNTIL UNLOCKED (ui/devUnlock.js: hold the shells 7 s, then the
// code). Built on demand, so nothing of it exists in the DOM for a player.
//
// Preset choice is in memory only: every boot starts on preset C. The prototype
// remembered the last preset in localStorage, which in a shipped build would let
// one dev session change the physics for every later player on that device.
// Save as Custom still persists, because that is its whole job.
import { PHYS, PHYS_PRESETS, DEFAULT_PRESET } from '../game/constants.js';

const CUSTOM_KEY = 'tmntwavesurf:phys.custom';
const DEV_KEYS = [['REL_VMAX', 0.4, 3, 0.05], ['REL_RESP', 2, 20, 0.5], ['BURST_V', 0.8, 5, 0.05], ['GRAVITY', 1, 12, 0.01], ['DAMP', 0.5, 10, 0.05], ['AIR_PEAK_Y', 0.05, 0.4, 0.005], ['AIR_TIME', 0.6, 2.5, 0.05], ['AIR_LAND_TILT', 0, 0.8, 0.01]];

function loadCustom() { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null'); } catch { return null; } }

function simRel(P) {   // relative input, full lean from rest at the trough: time to the lip
  let s0 = 0, v = 0, t = 0; const dt = 1 / 240;
  while (t < 8) { v += P.REL_RESP * (P.REL_VMAX - v) * dt; s0 += v * dt; t += dt; if (s0 >= 1) return t.toFixed(2) + ' s'; }
  return 'never';
}
function simBurst(P) {   // burst input: rise of one burst from rest
  let s0 = 0, v = P.BURST_V, t = 0; const dt = 1 / 240;
  while (v > 0 && t < 4) { v += (-P.GRAVITY - P.DAMP * v) * dt; s0 += v * dt; t += dt; }
  return s0.toFixed(2) + ' rail';
}

/** Apply the default preset to PHYS. Called at boot, before any dev UI exists. */
export function applyDefaultPreset() { Object.assign(PHYS, PHYS_PRESETS[DEFAULT_PRESET]); }

/**
 * @param {Element} parent
 * @param {object} api  { setTheme(name), getTheme(), toggleMode(), getMode(), summonBoss() }
 */
export function mountDevPanel(parent, api) {
  let devPreset = DEFAULT_PRESET;
  const dev = document.createElement('div');
  dev.id = 'dev'; dev.style.display = 'none';
  dev.innerHTML = `<div class="hd"><b>DEV</b><button id="devx" title="close (\`)">✕</button></div>
    <div class="devrow" id="devsw"></div><div id="devbody"></div>`;
  parent.appendChild(dev);
  const sw = dev.querySelector('#devsw'), body = dev.querySelector('#devbody');
  // Panel presses are not "hold": the hold listens on the gameplay canvas only,
  // and this sits above it. Clicks are stopped so the settings panel's
  // click-anywhere-to-close does not fire off them either.
  dev.addEventListener('click', e => e.stopPropagation());

  function buildSwitches() {
    const th = api.getTheme(), md = api.getMode();
    sw.innerHTML = `<button data-t="toon" class="${th === 'toon' ? 'on' : ''}">1 · 3D Toon</button>` +
      `<button data-t="ooze" class="${th === 'ooze' ? 'on' : ''}">2 · Ooze Street</button>` +
      `<button id="devctl" class="mode">C · ${md}</button><button id="devboss">B · Boss</button>` +
      `<br><button id="devinput" class="mode">Input: ${api.getInput() === 'burst' ? 'Burst (hard lean = up)' : 'Relative (lean = speed)'}</button>`;
    sw.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { api.setTheme(b.dataset.t); buildSwitches(); });
    sw.querySelector('#devctl').onclick = () => { api.toggleMode(); buildSwitches(); };
    sw.querySelector('#devboss').onclick = () => api.summonBoss();
    sw.querySelector('#devinput').onclick = () => { api.toggleInput(); buildSwitches(); };
  }
  function applyPreset(name) {
    const cfg = name === 'Custom' ? loadCustom() : PHYS_PRESETS[name]; if (!cfg) return;
    Object.assign(PHYS, cfg); devPreset = name; build();
  }
  function build() {
    const custom = loadCustom();
    const names = [...Object.keys(PHYS_PRESETS), ...(custom ? ['Custom'] : [])];
    body.innerHTML = names.map(n => `<button data-p="${n}" class="${n === devPreset ? 'on' : ''}">${n}</button>`).join('') +
      DEV_KEYS.map(([k, a, b, st]) => `<label>${k}<input type="range" min="${a}" max="${b}" step="${st}" value="${PHYS[k]}" data-k="${k}"><span id="v_${k}">${(+PHYS[k]).toFixed(3)}</span></label>`).join('') +
      `<div class="meas" id="devmeas"></div><button id="devsave">Save as Custom</button><button id="devcopy">Copy JSON</button>`;
    body.querySelectorAll('button[data-p]').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
    body.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => { PHYS[inp.dataset.k] = +inp.value; body.querySelector('#v_' + inp.dataset.k).textContent = (+inp.value).toFixed(3); devPreset = null; body.querySelectorAll('button[data-p]').forEach(b => b.classList.remove('on')); measure(); });
    body.querySelector('#devsave').onclick = () => { const o = {}; DEV_KEYS.forEach(([k]) => o[k] = PHYS[k]); try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(o)); } catch {} devPreset = 'Custom'; build(); };
    body.querySelector('#devcopy').onclick = () => { const o = {}; DEV_KEYS.forEach(([k]) => o[k] = PHYS[k]); try { navigator.clipboard?.writeText(JSON.stringify(o)); } catch {} };
    measure();
  }
  function measure() {
    const P = PHYS; body.querySelector('#devmeas').innerHTML =
      `relative, full lean trough→lip: ${simRel(P)}<br>burst: one kick rises ${simBurst(P)}<br>burst fall speed max: ${(P.GRAVITY / P.DAMP).toFixed(2)} rail/s`;
  }
  const self = {};
  dev.querySelector('#devx').onclick = () => (self.onClose ? self.onClose() : (dev.style.display = 'none'));
  buildSwitches(); build();

  return Object.assign(self, {
    el: dev,
    refreshSwitches: buildSwitches,
    setVisible(on) { dev.style.display = on ? '' : 'none'; if (on) buildSwitches(); },
    isVisible: () => dev.style.display !== 'none',
  });
}
