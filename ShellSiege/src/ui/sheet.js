// RAPHAEL'S CHARACTER SHEET: his portrait, the permanent abilities he has, and what they add up to.
//
// Elad, 24 Nov: the permanent upgrades are what becomes part of HIM, so the level-complete screen shows
// them flying into his sheet and being BURNED in, and the same sheet is shown (compact) at the end of
// every room. This file only builds the markup and plays the flight; the facts come in as arguments.
import { ABILITIES, stats } from '../core/abilities.js';
import { iconFor } from './icons.js';

export const RAPH_FACE = '<svg class="sheet-face" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/>' +
  '<path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/>' +
  '<ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/>' +
  '<circle cx="17" cy="23.5" r="1.8" fill="#14210f"/><circle cx="31" cy="23.5" r="1.8" fill="#14210f"/></svg>';

const permKeys = (build) => Object.keys(ABILITIES).filter((k) => ABILITIES[k].kind === 'perm' && (build[k] > 0 || (!ABILITIES[k].locked && ABILITIES[k].max > 0)));

/** The stat rows: label, the text, and a 0..1 fill for the bar (against what a maxed build reaches). */
const STAT_DEFS = [
  ['THROW',  (st) => 0.30 / st.fireIntervalS, (v) => `x${v.toFixed(1)}`, 1, 2.3],
  ['DAMAGE', (st) => st.damage,               (v) => String(Math.round(v)), 13, 36],
  ['REACH',  (st) => st.rangePx,              (v) => (Math.round(v / 76) / 10) + 'm', 760, 1520],
  ['HEALTH', (st) => st.maxHpMul,             (v) => `x${v.toFixed(2)}`, 1, 2.25],
];
export function statRows(build) {
  const st = stats(build);
  return STAT_DEFS.map(([label, get, fmt, lo, hi]) => {
    const v = get(st);
    return { label, text: fmt(v), pct: Math.max(0.04, Math.min(1, (v - lo) / (hi - lo))) };
  });
}
export const statLines = (build) => statRows(build).map((r) => [r.label, r.text]);

/**
 * The sheet's markup, in the style of a casual RPG character screen: a banner, a portrait in a gold ring
 * with his level, sockets for the permanent abilities, and stat bars.
 *
 * `build` is what he will have AFTER. `incoming` is { key: howMany } already counted in `build` but not yet
 * burned in: those sockets start EMPTY and the stat bars start at their value WITHOUT them, then rise.
 */
export function sheetHtml({ build, bank = {}, incoming = {}, compact = false, title = true, showEmpty = true }) {
  const inc = Array.isArray(incoming) ? Object.fromEntries(incoming.map((k) => [k, 1])) : incoming;
  const keys = permKeys(build).filter((k) => showEmpty || build[k] > 0);
  const slots = keys.map((k) => {
    const n = build[k] || 0;
    if (!n) return `<div class="slot perm none" data-key="${k}" title="${ABILITIES[k].label}">${iconFor(k)}</div>`;
    const state = inc[k] ? ' incoming' : n > (bank[k] || 0) ? ' loose' : ' banked';
    return `<div class="slot perm${state}" data-key="${k}" title="${ABILITIES[k].label}">${iconFor(k)}${n > 1 ? `<b>${n}</b>` : ''}</div>`;
  }).join('');
  const before = { ...build };
  for (const k of Object.keys(inc)) before[k] = Math.max(0, (before[k] || 0) - inc[k]);
  const from = statRows(before), to = statRows(build);
  const rows = to.map((r, i) =>
    `<li data-to="${r.pct.toFixed(3)}" data-text="${r.text}"><i>${r.label}</i><span class="bar"><u style="width:${(from[i].pct * 100).toFixed(1)}%"></u></span><b>${from[i].text}</b></li>`).join('');
  const lvOf = (b) => permKeys(b).reduce((n, k) => n + (b[k] || 0), 0);
  const level = lvOf(build), levelBefore = lvOf(before);
  return `<div class="sheet${compact ? ' compact' : ''}">` +
    (title ? '<div class="sheet-title"><span>RAPHAEL UPGRADE</span></div>' : '') +
    `<div class="sheet-body"><div class="sheet-portrait"><div class="ring">${RAPH_FACE}<em class="lv" data-to="${level}">LV <b>${levelBefore}</b></em></div><span>RAPHAEL</span></div>` +
    `<div class="sheet-main"><div class="sheet-slots">${slots}</div><div class="sheet-cap"><span>PERMANENT ABILITIES</span></div></div>` +
    `<ul class="sheet-stats">${rows}</ul></div></div>`;
}

/** Raise the stat bars to their final values, with a pop on the ones that changed. */
function riseStats(root) {
  root.querySelectorAll('.sheet-stats li').forEach((li) => {
    const u = li.querySelector('u'), b = li.querySelector('b');
    const to = parseFloat(li.dataset.to) * 100, was = parseFloat(u.style.width);
    if (Math.abs(to - was) < 0.2) return;
    u.style.width = to.toFixed(1) + '%';
    b.textContent = li.dataset.text;
    li.classList.remove('up'); void li.offsetWidth; li.classList.add('up');
  });
  const lv = root.querySelector('.lv');
  if (lv && lv.dataset.to) { lv.querySelector('b').textContent = lv.dataset.to; lv.classList.remove('up'); void lv.offsetWidth; lv.classList.add('up'); }
}

/** A burst of sparks, a shockwave, a "+1" and a shake: the moment an upgrade is branded onto him. */
export function burnInto(slot, { rise = true } = {}) {
  slot.classList.remove('incoming');
  slot.classList.add('burn');
  for (let i = 0; i < 4; i++) {
    const f = document.createElement('i');
    f.className = 'flame';
    f.style.setProperty('--x', `${14 + i * 24}%`);
    f.style.setProperty('--d', `${i * 0.08}s`);
    slot.appendChild(f);
  }
  for (let i = 0; i < 9; i++) {
    const sp = document.createElement('i');
    sp.className = 'ember';
    const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.5, dist = 34 + Math.random() * 30;
    sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`); sp.style.setProperty('--dy', `${Math.sin(ang) * dist - 10}px`);
    slot.appendChild(sp);
  }
  const wave = document.createElement('i'); wave.className = 'shock'; slot.appendChild(wave);
  const plus = document.createElement('i'); plus.className = 'plus'; plus.textContent = 'BANKED'; slot.appendChild(plus);
  const sheet = slot.closest('.sheet');
  if (sheet) { sheet.classList.remove('thump'); void sheet.offsetWidth; sheet.classList.add('thump'); }
  if (rise && sheet) setTimeout(() => riseStats(sheet), 540);
  setTimeout(() => {
    slot.classList.remove('burn'); slot.classList.add('banked');
    slot.querySelectorAll('.flame,.ember,.shock,.plus').forEach((f) => f.remove());
  }, 1930);
}

/**
 * Fly `from` (an element) into the sheet's slot for `key`, then burn it in. Returns false when either is
 * missing, so a caller can simply burn in place.
 */
export function flyAndBurn(from, root, key, { delay = 0, duration = 650, onDone } = {}) {
  const target = root?.querySelector(`.sheet-slots .slot[data-key="${key}"]`);
  if (!from || !target || !from.animate) { if (target) burnInto(target); onDone?.(); return !!target; }
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const k = b.width / Math.max(1, a.width);
  if (getComputedStyle(from).position === 'static') from.style.position = 'relative';
  from.style.zIndex = '60';
  const anim = from.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 },
    { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 34}px) scale(1.25) rotate(-10deg)`, offset: 0.4 },
    { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(0deg)`, offset: 1 },
  ], { duration, delay, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'both' });
  anim.onfinish = () => { from.style.visibility = 'hidden'; burnInto(target); onDone?.(); };
  return true;
}
