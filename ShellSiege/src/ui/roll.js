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

  function open(roll, { black = false, build = null, bank = {} } = {}) {
    const a = ABILITIES[roll.key];
    if (!root || !a) return;
    if (icon) icon.innerHTML = iconFor(roll.key);
    if (label) label.textContent = a.label;
    if (blurb) blurb.textContent = a.blurb;
    const rib = root.querySelector('.roll-ribbon');
    if (rib) rib.textContent = a.kind === 'perm' ? 'PERMANENT' : 'THIS LEVEL';
    // RAPHAEL'S SHEET, shown at the end of every room. A permanent find is already counted on it, but empty,
    // until the card flies in at the reveal.
    pending = null;
    if (sheetEl && build) {
      const perm = a.kind === 'perm';
      const shown = perm ? { ...build, [roll.key]: (build[roll.key] || 0) + 1 } : build;
      sheetEl.innerHTML = sheetHtml({ build: shown, bank, incoming: perm ? [roll.key] : [], compact: true, title: true, showEmpty: false });
      sheetEl.hidden = false;
      if (perm) pending = roll.key;
    } else if (sheetEl) sheetEl.hidden = true;
    root.dataset.phase = roll.phase;
    root.classList.toggle('over-black', black);
    root.classList.remove('hidden');
  }

  /** Called every frame; cheap -- a dataset write only when the phase changed. */
  function update(roll) {
    if (root && root.dataset.phase !== roll.phase) {
      root.dataset.phase = roll.phase;
      if (roll.phase === 'reveal' && pending) {
        const k = pending; pending = null;
        flyAndBurn(root.querySelector('.roll-icon svg'), sheetEl, k, { delay: 250, duration: 600 });
      }
    }
  }

  function close() {
    if (!root) return;
    root.classList.add('hidden');
    root.dataset.phase = '';
    pending = null;
  }

  return { open, update, close };
}
