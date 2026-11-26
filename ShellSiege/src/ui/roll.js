// THE ROLL, drawn: a quick PIZZA WHEEL (or, every other box, a pick between two cards).
//
// All of the behaviour -- what was rolled, how long each part takes -- is in core/roll.js. This file puts the result on
// screen. The wheel has eight slices of different abilities; it spins for ROLL.spinS and stops with the rolled one under the
// pointer, then the result panel and Raphael's sheet show what it gave.
import { ABILITIES, offerable } from '../core/abilities.js';
import { ROLL } from '../core/roll.js';
import { iconFor } from './icons.js';
import { sheetHtml, flyAndBurn } from './sheet.js';


const SLICES = 8;

export function createRollUi() {
  const root = document.getElementById('roll-overlay');
  const wheelBox = root?.querySelector('.roll-wheelbox');
  const spinEl = root?.querySelector('.wheel-spin');
  const icon = root?.querySelector('.rr-icon');
  const label = root?.querySelector('.rr-label');
  const blurb = root?.querySelector('.rr-blurb');
  const ribbon = root?.querySelector('.rr-ribbon');
  const invEl = document.getElementById('roll-inv');
  let beatTimer = 0;
  const choiceEl = document.getElementById('roll-choice');
  let pending = null;            // the permanent key waiting to fly into the sheet at the reveal
  let ctx = { build: null, bank: {} };
  let cur = null;                // the roll waiting for a pick
  let hover = -1, dwell = 0, armedAt = 0, picked = false, winSlice = -1;
  const api = { onPick: null };

  /** Put a chosen (or rolled) ability on the result panel and on Raphael's sheet. */
  function fill(key, build, bank) {
    const a = ABILITIES[key];
    if (icon) icon.innerHTML = iconFor(key);
    if (label) label.textContent = a.label;
    if (blurb) blurb.textContent = a.blurb;
    if (ribbon) { ribbon.textContent = a.kind === 'perm' ? 'PERMANENT' : 'THIS LEVEL'; ribbon.dataset.kind = a.kind; }
    pending = null;
    if (invEl && build) { invEl.innerHTML = invHtml(build, key); invEl.classList.remove('on'); pending = key; }
  }

  /** EVERYTHING HELD IN THE RUN (after this pick): the abilities, then Raphael's upgrades. The new one starts as an empty socket. */
  function invHtml(build, key) {
    const after = { ...build, [key]: (build[key] || 0) + 1 };
    const group = (kind, title) => {
      const keys = Object.keys(ABILITIES).filter((k) => ABILITIES[k].kind === kind && after[k] > 0);
      if (!keys.length) return '';
      return `<div class="inv-g ${kind}"><i>${title}</i><div class="sheet-slots">` + keys.map((k) =>
        `<div class="slot ${kind}${k === key ? ' incoming' : ''}" data-key="${k}" title="${ABILITIES[k].label}">${iconFor(k)}${after[k] > 1 ? `<b>${after[k]}</b>` : ''}</div>`).join('') + '</div></div>';
    };
    return group('temp', 'ABILITIES') + group('perm', 'RAPHAEL');
  }

  /**
   * THE LAST BEAT: 2.5 s after the card appears it shrinks into a small icon, the list of everything held fades in at the bottom, and the
   * icon flies to its place there. `cardEl` is the card that is leaving, `svg` its icon.
   */
  function flyBeat(cardEl, svg, key) {
    if (!svg || !invEl) return;
    invEl.classList.add('on');
    const r = svg.getBoundingClientRect(), sz = 62;
    // the icon becomes a little cream socket (like the ones in the list) so it reads against the black
    const clone = document.createElement('div');
    clone.className = `slot ${ABILITIES[key].kind}`;
    clone.innerHTML = svg.outerHTML;
    Object.assign(clone.style, { position: 'fixed', left: (r.left + r.width / 2 - sz / 2) + 'px', top: (r.top + r.height / 2 - sz / 2) + 'px', width: sz + 'px', height: sz + 'px', padding: '9px', margin: '0', zIndex: '60', pointerEvents: 'none' });
    clone.firstChild.style.cssText = 'width:100%;height:100%';
    document.body.appendChild(clone);
    cardEl?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.35)', opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => flyAndBurn(clone, invEl, key, { delay: 0, duration: 615, onDone: () => clone.remove() }), 380);
  }

  /** The wheel: the winner on a random slice, the others filled with different abilities. */
  function buildWheel(key, build) {
    if (!spinEl) return;
    const pool = offerable(build || {}).filter((k) => k !== key && !ABILITIES[k].locked);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    winSlice = Math.floor(Math.random() * SLICES);
    const keys = [];
    for (let i = 0; i < SLICES; i++) keys.push(i === winSlice ? key : (pool.length ? pool[i % pool.length] : key));
    const step = 360 / SLICES;
    spinEl.innerHTML = keys.map((k, i) => `<div class="wslice" data-i="${i}" style="--a:${(i * step + step / 2).toFixed(1)}deg"><span>${iconFor(k)}</span></div>`).join('');
    // the slice colours: cheese and tomato, alternating, drawn as one conic gradient
    const cols = ['#ffe48a', '#ffc65a'];
    spinEl.style.background = `conic-gradient(${keys.map((_, i) => `${cols[i % 2]} ${i * step}deg ${(i + 1) * step}deg`).join(',')})`;
    spinEl.style.transform = 'rotate(0deg)';
    // spin: a few turns, ending with the winner's slice under the pointer at the top (slice centres are clockwise from the top)
    const end = 360 * 3 - (winSlice * step + step / 2);
    spinEl.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${end}deg)` }], { duration: ROLL.spinS * 1000, easing: 'cubic-bezier(.12,.7,.15,1)', fill: 'forwards' });
  }

  const cardHtml = (k, i) => {
    const a = ABILITIES[k];
    return `<button type="button" class="choice-card ${a.kind}" data-i="${i}"><span class="choice-icon">${iconFor(k)}</span>` +
      `<b>${a.label}</b><em>${a.blurb}</em><i class="choice-rib">${a.kind === 'perm' ? 'PERMANENT' : 'THIS LEVEL'}</i><u class="choice-dwell"></u></button>`;
  };
  // BETWEEN THE TWO CARDS: a ? with a left and a right arrow (lean that way, or tap a card)
  const ARROW = (dir) => `<svg class="arr ${dir}" viewBox="0 0 32 32" aria-hidden="true"><path d="${dir === 'l' ? 'M24 4 8 16l16 12z' : 'M8 4l16 12L8 28z'}" fill="currentColor" stroke="#14210f" stroke-width="3" stroke-linejoin="round"/></svg>`;
  const MID = `<div class="choice-mid">${ARROW('l')}<b>?</b>${ARROW('r')}</div>`;

  function pick(i) {
    if (!cur || cur.key) return;
    const k = cur.choices[i === 1 ? 1 : 0];
    cur = null; hover = -1; dwell = 0; picked = true;
    // the other card goes away and the chosen one is left centred; no wheel, no box
    choiceEl?.querySelectorAll('.choice-card').forEach((c, n) => c.classList.add(n === i ? 'chosen' : 'dropped'));
    choiceEl?.classList.add('after');
    api.onPick?.(i);
    fill(k, ctx.build, ctx.bank);
    root.dataset.phase = 'picked';
    clearTimeout(beatTimer);
    beatTimer = setTimeout(() => { const c = choiceEl?.querySelector('.choice-card.chosen'); flyBeat(c, c?.querySelector('.choice-icon svg'), k); pending = null; }, 2500);
  }

  function open(roll, { black = false, build = null, bank = {} } = {}) {
    if (!root) return;
    ctx = { build, bank };
    pending = null; picked = false; clearTimeout(beatTimer);
    root.querySelector('.roll-result')?.getAnimations().forEach((a) => a.cancel());      // the card is reused: forget last time's shrink
    root.classList.toggle('over-black', black);
    choiceEl?.classList.remove('after');
    if (roll.choices && !roll.key) {
      cur = roll; hover = -1; dwell = 0; armedAt = performance.now() + 450;       // not tappable for a moment: no accidental pick
      if (choiceEl) { choiceEl.innerHTML = cardHtml(roll.choices[0], 0) + MID + cardHtml(roll.choices[1], 1); choiceEl.hidden = false; }
      if (invEl) { invEl.innerHTML = ''; invEl.classList.remove('on'); }
      root.dataset.phase = 'choose';
      root.classList.remove('hidden');
      return;
    }
    if (choiceEl) choiceEl.hidden = true;
    fill(roll.key, build, bank);
    buildWheel(roll.key, build);
    root.dataset.phase = roll.phase;               // 'spin'
    root.classList.remove('hidden');
  }

  choiceEl?.addEventListener('click', (e) => {
    const c = e.target.closest('.choice-card');
    if (c && performance.now() >= armedAt) pick(Number(c.dataset.i));
  });
  addEventListener('keydown', (e) => {
    if (!cur || performance.now() < armedAt) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') setHover(0);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') setHover(1);
    else if ((e.code === 'Enter' || e.code === 'Space') && hover >= 0) pick(hover);
  });
  function setHover(i) {
    if (i === hover) return;
    hover = i; dwell = 0;
    choiceEl?.querySelectorAll('.choice-card').forEach((c, n) => { c.classList.toggle('hover', n === i); c.style.setProperty('--dwell', '0'); });
    choiceEl?.classList.toggle('lean-l', i === 0); choiceEl?.classList.toggle('lean-r', i === 1);
  }

  /** Every frame. While a pick waits, LEANING highlights a card and HOLDING the lean for a second picks it. */
  function update(roll, lean = null, dt = 0) {
    if (!root) return;
    if (cur && roll === cur && !roll.key) {
      if (lean && performance.now() >= armedAt) {
        const side = lean.x < -0.55 ? 0 : lean.x > 0.55 ? 1 : -1;
        if (side >= 0) {
          if (side !== hover) setHover(side);
          dwell += dt;
          const c = choiceEl?.querySelectorAll('.choice-card')[side];
          if (c) c.style.setProperty('--dwell', String(Math.min(1, dwell / 1.0)));
          if (dwell >= 1.0) pick(side);
        } else if (hover >= 0 && dwell > 0) { dwell = 0; choiceEl?.querySelectorAll('.choice-card').forEach((c) => c.style.setProperty('--dwell', '0')); }
      }
      return;
    }
    if (picked) return;                       // a pick runs on its own timer
    if (root.dataset.phase !== roll.phase) {
      root.dataset.phase = roll.phase;
      if (roll.phase === 'reveal') {
        const k = pending;
        clearTimeout(beatTimer);
        beatTimer = setTimeout(() => { const card = root.querySelector('.roll-result'); flyBeat(card, card?.querySelector('.rr-icon svg'), k); pending = null; }, 2500);
      }
    }
  }

  function close() {
    if (!root) return;
    cur = null; picked = false; clearTimeout(beatTimer); if (choiceEl) choiceEl.hidden = true;
    document.querySelectorAll('body > .slot[style*="fixed"]').forEach((n) => n.remove());
    root.classList.add('hidden');
    root.dataset.phase = '';
    pending = null;
  }

  api.open = open; api.update = update; api.close = close;
  return api;
}
