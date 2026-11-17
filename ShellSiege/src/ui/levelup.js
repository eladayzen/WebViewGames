// THE CHOICE SCREEN, drawn.
//
// All the behaviour is in core/levelup.js, which is pure and knows nothing
// about the DOM. This file only paints what that module decided: which card
// is being pointed at, and how far the hold has filled.
//
// THE FILL IS THE WHOLE INTERFACE. There is no button and no confirm. A
// player leans, the card they are leaning at starts filling, and it is taken
// when it completes. Standing back up empties it. Because the fill is
// visible, the rule teaches itself -- nobody has to be told that a bar
// filling up means "keep doing that", and nobody has to be told how to stop.
import { ABILITIES } from '../core/abilities.js';
import { holdProgress } from '../core/levelup.js';

export function createLevelUpUi() {
  const root = document.getElementById('levelup-overlay');
  const title = document.getElementById('lv-level');
  const cards = [...document.querySelectorAll('.lv-card')];

  function open(choice, level) {
    if (title) title.textContent = String(level);
    cards.forEach((card, i) => {
      const key = choice.options[i];
      // Late in a run there can be fewer options than cards. An empty slot is
      // hidden rather than left blank: core/levelup.js already refuses to
      // fill a hold over a slot with nothing behind it, and a visible empty
      // card would invite the player to try.
      card.classList.toggle('hidden', !key);
      if (!key) return;
      const a = ABILITIES[key];
      card.querySelector('.lv-label').textContent = a.label;
      card.querySelector('.lv-blurb').textContent = a.blurb;
      card.querySelector('.lv-fill').style.width = '0%';
      card.classList.remove('active');
    });
    root?.classList.remove('hidden');
  }

  function update(choice) {
    const p = holdProgress(choice);
    cards.forEach((card, i) => {
      const on = choice.zone === i && !!choice.options[i];
      card.classList.toggle('active', on);
      card.querySelector('.lv-fill').style.width = on ? `${p * 100}%` : '0%';
    });
  }

  function close() { root?.classList.add('hidden'); }

  return { open, update, close };
}
