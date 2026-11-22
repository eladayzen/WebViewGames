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

export function createRollUi() {
  const root = document.getElementById('roll-overlay');
  const icon = root?.querySelector('.roll-icon');
  const label = root?.querySelector('.roll-label');
  const blurb = root?.querySelector('.roll-blurb');

  function open(roll) {
    const a = ABILITIES[roll.key];
    if (!root || !a) return;
    if (icon) icon.innerHTML = iconFor(roll.key);
    if (label) label.textContent = a.label;
    if (blurb) blurb.textContent = a.blurb;
    root.dataset.phase = roll.phase;
    root.classList.remove('hidden');
  }

  /** Called every frame; cheap -- a dataset write only when the phase changed. */
  function update(roll) {
    if (root && root.dataset.phase !== roll.phase) root.dataset.phase = roll.phase;
  }

  function close() {
    if (!root) return;
    root.classList.add('hidden');
    root.dataset.phase = '';
  }

  return { open, update, close };
}
