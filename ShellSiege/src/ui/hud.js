// THE ROOM READOUT: dots, a count, and a banner.
//
// Everything here writes to the DOM ONLY WHEN THE VALUE CHANGED. The frame loop
// calls these sixty times a second and most frames nothing is different;
// rewriting innerHTML on every one of them would rebuild five elements for no
// reason and make the pulsing dot restart its animation each time.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { doorIcon } from './doors.js';

/** Banner words that have painted lettering (tools/cut-ui.py). */
const TITLE_ART = { 'ROOM CLEAR': 'ui_title_room_clear.png' };

export function createHud() {
  const strip = document.getElementById('abilities');
  let stripKey = '';
  const pips = document.getElementById('room-pips');
  const left = document.getElementById('enemies-left');
  const banner = document.getElementById('banner');
  let pipKey = '';
  let leftText = '';

  /** `room` is 0-based; `rooms` is how many the level has; the last is the boss. */
  function setRooms(room, rooms, cleared) {
    const key = `${room}/${rooms}/${cleared ? 1 : 0}`;
    if (!pips || key === pipKey) return;
    pipKey = key;
    let html = '';
    for (let i = 0; i < rooms; i++) {
      const done = i < room || (i === room && cleared);
      const boss = i === rooms - 1;
      const cls = ['pip', 'door-pip', boss ? 'boss' : '', done ? 'done' : i === room ? 'now' : ''].filter(Boolean).join(' ');
      html += `<span class="${cls}">${doorIcon(boss && !done ? 'boss' : done ? 'done' : i === room ? 'here' : 'todo')}</span>`;
    }
    pips.innerHTML = html;
  }

  function setLeft(n, show = true) {
    if (!left) return;
    const t = show ? String(n) : '';
    if (t !== leftText) { leftText = t; left.innerHTML = t ? `<b>${t}</b><i>left</i>` : ''; }
  }

  /** Show a banner. Re-triggering restarts the animation, which is the point. */
  function say(big, small = '', plain = false) {
    if (!banner) return;
    banner.classList.toggle('plain', plain);
    // Titles with painted lettering use their art; the rest are set in CSS until they get some.
    const art = TITLE_ART[big];
    banner.classList.toggle('art', !!art);
    const face = art ? `<img src="tex/${art}" alt="${big}">` : big;
    banner.innerHTML = small ? `${face}<small>${small}</small>` : face;
    banner.classList.remove('show');
    void banner.offsetWidth;          // force a reflow so the animation restarts
    banner.classList.add('show');
  }

  function hideBanner() { banner?.classList.remove('show'); }

  /** A white pop over everything, for the last kill. Re-triggerable. */
  function flash() {
    const el = document.getElementById('flash');
    if (!el) return;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  /** Two strips: the TEMPORARY abilities (allies, weapons, effects) and RAPHAEL'S UPGRADES (the permanent ones). */
  const timerSeen = {};
  const ups = document.getElementById('upgrades');
  let upKey = '';
  const slotHtml = (build, bank, k) => {
    const perm = ABILITIES[k].kind === 'perm';
    // a permanent upgrade is LOOSE (dashed, wobbling) until the level is cleared, then BANKED (padlocked)
    const state = !perm ? '' : build[k] > (bank[k] || 0) ? ' loose' : ' banked';
    return `<div class="slot ${ABILITIES[k].kind}${state}" data-key="${k}" title="${ABILITIES[k].label}">${iconFor(k)}` +
      (build[k] > 1 ? `<b>${build[k]}</b>` : '') + '</div>';
  };
  function setAbilities(build, bank = {}) {
    if (!strip) return;
    const held = Object.keys(ABILITIES).filter((k) => build[k] > 0);
    const key = held.map((k) => `${k}${build[k]}/${bank[k] || 0}`).join(',');
    if (key === stripKey) return;
    stripKey = key;
    for (const k in timerSeen) delete timerSeen[k];      // the slots were rebuilt: write the timers again
    strip.innerHTML = held.filter((k) => ABILITIES[k].kind === 'temp').map((k) => slotHtml(build, bank, k)).join('');
    if (ups) {
      ups.innerHTML = held.filter((k) => ABILITIES[k].kind === 'perm').map((k) => slotHtml(build, bank, k)).join('');
      ups.classList.toggle('empty', !ups.children.length);
    }
  }

  /** HUD option 1: the upgrades show for a few seconds at the start of a room, then go. */
  let peekTimer = 0;
  function peekUpgrades(ms = 3500) {
    if (!ups) return;
    ups.classList.add('peek');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => ups.classList.remove('peek'), ms);
  }

  /** Confetti over the whole screen, for a cleared level. DOM bits with CSS animation; removed after. */
  function celebrate() {
    const host = document.getElementById('confetti');
    if (!host) return;
    const colours = ['#ff7a1a', '#ffd84a', '#5fb24a', '#d6242c', '#4aa8ff', '#fff8e1'];
    let html = '';
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 100, d = Math.random() * 0.6, dur = 1.8 + Math.random() * 1.6, r = Math.random() * 720 - 360;
      html += `<i style="left:${x}%;background:${colours[i % colours.length]};animation-delay:${d.toFixed(2)}s;animation-duration:${dur.toFixed(2)}s;--r:${r.toFixed(0)}deg"></i>`;
    }
    host.innerHTML = html;
    host.classList.remove('go'); void host.offsetWidth; host.classList.add('go');
    setTimeout(() => { host.innerHTML = ''; host.classList.remove('go'); }, 4200);
  }

  /**
   * The turtle allies' timers, on their slots: a dark wedge grows as an active ally's time
   * runs out, and shrinks over his break. Cheap: only a CSS variable and a class change.
   */
  // Called every frame, so it writes only what CHANGED: a custom property rewritten each frame restyles
  // and repaints the slot (a conic gradient) sixty times a second for a change nobody can see.
  function setAllyTimers(allies) {
    if (!strip) return;
    for (const a of allies) {
      const left = Math.max(0, Math.min(1, a.timer / (a.duration || 1)));
      const cover = Math.round((a.present ? 1 - left : left) * 100) / 100;      // 1% steps
      const tag = cover + (a.present ? 'p' : 'a');
      if (timerSeen[a.key] === tag) continue;
      const el = strip.querySelector(`.slot[data-key="${a.key}"]`);
      if (!el) continue;
      timerSeen[a.key] = tag;
      el.style.setProperty('--cover', cover.toFixed(2));
      el.classList.toggle('away', !a.present);
    }
  }

  return { setRooms, setLeft, say, hideBanner, flash, celebrate, setAbilities, setAllyTimers, peekUpgrades };
}
