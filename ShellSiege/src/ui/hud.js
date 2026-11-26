// THE ROOM READOUT: dots, a count, and a banner.
//
// Everything here writes to the DOM ONLY WHEN THE VALUE CHANGED. The frame loop
// calls these sixty times a second and most frames nothing is different;
// rewriting innerHTML on every one of them would rebuild five elements for no
// reason and make the pulsing dot restart its animation each time.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { doorIcon } from './doors.js';

/** THE GENERAL BAD GUY (Elad, 25 Nov): one dark hooded mask with glaring red eyes, for "enemies left". */
const BADGUY = '<svg class="bad" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3c-9 0-16 7-16 17v10c0 4 2 7 5 9l4 6h14l4-6c3-2 5-5 5-9V20C40 10 33 3 24 3z" fill="#2b2f3b" stroke="#14210f" stroke-width="3"/>' +
  '<path d="M10 20c4-4 24-4 28 0l-1 8c-4 3-22 3-26 0z" fill="#12151c"/><path d="M13 22l9 3-1 3-9-2zM35 22l-9 3 1 3 9-2z" fill="#ff3b30"/><path d="M18 36h12M20 40h8" stroke="#8a93a6" stroke-width="2.2" stroke-linecap="round"/></svg>';

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
    if (t !== leftText) { leftText = t; left.innerHTML = t ? `${BADGUY}<b>${t}</b>` : ''; }
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
  const cdSeen = {};
  const ups = document.getElementById('upgrades');
  let upKey = '';
  const slotHtml = (build, bank, k) => {
    const perm = ABILITIES[k].kind === 'perm';
    // a permanent upgrade is LOOSE (dashed, wobbling) until the level is cleared, then BANKED (padlocked)
    const state = !perm ? '' : build[k] > (bank[k] || 0) ? ' loose' : ' banked';
    return `<div class="slot ${ABILITIES[k].kind}${state}" data-key="${k}" title="${ABILITIES[k].label}">${iconFor(k)}` +
      (build[k] > 1 ? `<b>${build[k]}</b>` : '') + '</div>';
  };
  function fitStrip() {
    if (!strip) return;
    strip.classList.remove('two');
    if (strip.scrollWidth > strip.clientWidth + 1) strip.classList.add('two');
  }
  addEventListener('resize', fitStrip);
  function setAbilities(build, bank = {}) {
    if (!strip) return;
    const held = Object.keys(ABILITIES).filter((k) => build[k] > 0);
    const key = held.map((k) => `${k}${build[k]}/${bank[k] || 0}`).join(',');
    if (key === stripKey) return;
    stripKey = key;
    for (const k in timerSeen) delete timerSeen[k];
    for (const k in cdSeen) delete cdSeen[k];      // the slots were rebuilt: write the timers again
    // THE STRIP (Elad, 25 Nov): the turtles in the middle, the weapon abilities split to either side of them; if that does
    // not fit on one line, the turtles are the upper line and the weapons the one below.
    const temp = held.filter((k) => ABILITIES[k].kind === 'temp');
    const turtles = ['leo', 'mikey', 'donnie'].filter((k) => temp.includes(k));
    const arms = temp.filter((k) => !turtles.includes(k));
    const half = Math.ceil(arms.length / 2);
    const row = (ks) => ks.map((k) => slotHtml(build, bank, k)).join('');
    strip.innerHTML = `<div class="abl">${row(arms.slice(0, half))}</div><div class="abt">${row(turtles)}</div><div class="abr">${row(arms.slice(half))}</div>`;
    strip.classList.remove('two');
    fitStrip();
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

  // COOLDOWN WHEELS on the weapon/effect slots: a dark sweep that shrinks to nothing when it is ready, a glow while it runs, and a
  // few words of rate (ninja stars: seconds between throws). Only writes what changed.
  function setCooldowns(cds) {
    if (!strip) return;
    for (const k of Object.keys(cds)) {
      const c = cds[k];
      const cover = Math.round(c.cover * 50) / 50;
      const tag = `${cover}|${c.on ? 1 : 0}|${c.label || ''}`;
      if (cdSeen[k] === tag) continue;
      const el = strip.querySelector(`.slot[data-key="${k}"]`);
      if (!el) continue;
      cdSeen[k] = tag;
      el.classList.add('cd');
      el.style.setProperty('--cover', cover.toFixed(2));
      el.classList.toggle('ready', cover === 0 && !c.on);
      el.classList.toggle('running', !!c.on);
      let lab = el.querySelector('.rate');
      if (c.label) { if (!lab) { lab = document.createElement('i'); lab.className = 'rate'; el.appendChild(lab); } lab.textContent = c.label; }
      else lab?.remove();
    }
  }

  return { setCooldowns, setRooms, setLeft, say, hideBanner, flash, celebrate, setAbilities, setAllyTimers, peekUpgrades };
}
