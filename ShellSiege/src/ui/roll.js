// THE ROLL, drawn.
//
// All of the behaviour -- what was rolled, how long each part takes -- is in
// core/roll.js. This file only puts the result on screen and hands the current
// phase to the CSS, which does the shaking and the lid.
//
// THE ANSWER IS WRITTEN INTO THE CARD BEFORE THE REVEAL, hidden, rather than
// at the moment of the reveal. The card is already fully formed when the lid
// comes off, so a slow frame cannot show a half-filled card for a moment: the
// only thing that changes is whether it is visible.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { sheetHtml, flyAndBurn } from './sheet.js';

export function createRollUi() {
  const root = document.getElementById('roll-overlay');
  const icon = root?.querySelector('.roll-icon');
  const label = root?.querySelector('.roll-label');
  const blurb = root?.querySelector('.roll-blurb');

  // THE BOX IS REAL ART NOW (tex/loot_closed.webp, tex/loot_open.webp), cut from
  // a matched pair so the swap from one to the other happens in place. Set here,
  // once, with the same relative URLs the other textures use -- an absolute
  // path would work in a browser and fail inside the app's WebView.
  const closed = root?.querySelector('.roll-box.closed');
  const open_ = root?.querySelector('.roll-box.open');
  if (closed) closed.src = 'tex/loot_closed.webp';
  if (open_) open_.src = 'tex/loot_open.webp';

  const sheetEl = document.getElementById('roll-sheet');
  let pending = null;       // the permanent key waiting to fly into the sheet at the reveal

  const choiceEl = document.getElementById('roll-choice');
  const titleEl = root?.querySelector('.roll-title');
  let ctx = { build: null, bank: {} };
  let cur = null;                // the roll waiting for a pick
  let hover = -1, dwell = 0, armedAt = 0;
  const api = { onPick: null };

  /** Put a chosen (or rolled) ability on the card and on Raphael's sheet. */
  function fill(key, build, bank) {
    const a = ABILITIES[key];
    if (icon) icon.innerHTML = iconFor(key);
    if (label) label.textContent = a.label;
    if (blurb) blurb.textContent = a.blurb;
    const rib = root.querySelector('.roll-ribbon');
    if (rib) rib.textContent = a.kind === 'perm' ? 'PERMANENT' : 'THIS LEVEL';
    // RAPHAEL'S SHEET, shown at the end of every room. A permanent find is already counted on it, but empty,
    // until the card flies in at the reveal.
    pending = null;
    if (sheetEl && build) {
      const perm = a.kind === 'perm';
      const shown = perm ? { ...build, [key]: (build[key] || 0) + 1 } : build;
      sheetEl.innerHTML = sheetHtml({ build: shown, bank, incoming: perm ? [key] : [], compact: true, title: true, showEmpty: false });
      sheetEl.hidden = false;
      if (perm) pending = key;
    } else if (sheetEl) sheetEl.hidden = true;
  }

  const cardHtml = (k, i) => {
    const a = ABILITIES[k];
    return `<button type="button" class="choice-card ${a.kind}" data-i="${i}"><span class="choice-icon">${iconFor(k)}</span>` +
      `<b>${a.label}</b><em>${a.blurb}</em><i class="choice-rib">${a.kind === 'perm' ? 'PERMANENT' : 'THIS LEVEL'}</i><u class="choice-dwell"></u></button>`;
  };

  function pick(i) {
    if (!cur || cur.key) return;
    const k = cur.choices[i === 1 ? 1 : 0];
    const r = cur;
    cur = null; hover = -1; dwell = 0;
    if (choiceEl) { choiceEl.querySelectorAll('.choice-card').forEach((c, n) => c.classList.add(n === i ? 'picked' : 'dropped')); }
    api.onPick?.(i);                 // the run moves on to the reveal with that ability
    setTimeout(() => { if (choiceEl) choiceEl.hidden = true; }, 380);
    fill(k, ctx.build, ctx.bank);
    root.dataset.phase = r.phase;
    if (pending) { const pk = pending; pending = null; flyAndBurn(root.querySelector('.roll-icon svg'), sheetEl, pk, { delay: 600, duration: 900 }); }
  }

  function open(roll, { black = false, build = null, bank = {} } = {}) {
    if (!root) return;
    ctx = { build, bank };
    pending = null;
    root.classList.toggle('over-black', black);
    if (roll.choices && !roll.key) {
      // A PICK BETWEEN TWO: the box waits, two cards stand in its place
      cur = roll; hover = -1; dwell = 0; armedAt = performance.now() + 450;       // not tappable for a moment: no accidental pick
      if (titleEl) titleEl.textContent = 'CHOOSE ONE';
      if (choiceEl) { choiceEl.innerHTML = roll.choices.map(cardHtml).join(''); choiceEl.hidden = false; }
      if (sheetEl && build) { sheetEl.innerHTML = sheetHtml({ build, bank, compact: true, title: true, showEmpty: false }); sheetEl.hidden = false; }
      root.dataset.phase = 'choose';
      root.classList.remove('hidden');
      return;
    }
    if (titleEl) titleEl.textContent = 'NEW POWER';
    if (choiceEl) choiceEl.hidden = true;
    fill(roll.key, build, bank);
    root.dataset.phase = roll.phase;
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
  }

  /**
   * Called every frame. While a pick is waiting, LEANING left or right (the board) highlights that card and
   * HOLDING the lean for a second picks it; a tap on a card picks at once.
   */
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
    if (root.dataset.phase !== roll.phase) {
      root.dataset.phase = roll.phase;
      if (roll.phase === 'reveal' && pending) {
        const k = pending; pending = null;
        flyAndBurn(root.querySelector('.roll-icon svg'), sheetEl, k, { delay: 350, duration: 900 });
      }
    }
  }

  function close() {
    if (!root) return;
    cur = null; if (choiceEl) choiceEl.hidden = true;
    root.classList.add('hidden');
    root.dataset.phase = '';
    pending = null;
  }

  api.open = open; api.update = update; api.close = close;
  return api;
}
