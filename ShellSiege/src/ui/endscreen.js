// THE END-OF-RUN SCREEN: what happened to your build, and where you start next.
//
// Elad, 22 Nov, after the concept frame (art-candidates/ui-concepts/overrun-progression.png):
// the screen has to explain the roguelike in one look --
//
//   USED   the TEMPORARY abilities you had this run (the turtle allies), greyed out:
//          they are spent. Short copy, on purpose.
//   KEPT   the PERMANENT abilities, with how many of each. These stay.
//   ROLL   a closed box: you get a free new ability when you press GO AGAIN. The roll
//          itself happens after the press, over black (main.js), not here.
//   MAP    where the next run starts: the first room of this level (or the next level).
//
// Only the DOM; the facts come in as arguments so this stays dumb.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';

const slot = (k, count, spent) =>
  `<div class="slot ${ABILITIES[k].kind}${spent ? ' spent' : ''}" title="${ABILITIES[k].label}">${iconFor(k)}` +
  (count > 1 ? `<b>${count}</b>` : '') + '</div>';

const MASK = '<svg class="map-turtle" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/><path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/><ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/></svg>';

/**
 * Fill the end screen.
 * @param kind   'dead' | 'won'
 * @param o      { build, level, rooms }   `level` is the one you are ON; a win starts the next
 */
export function renderEnd(kind, { build, level, rooms }) {
  const keys = Object.keys(ABILITIES);
  const used = keys.filter((k) => ABILITIES[k].kind === 'temp' && build[k] > 0);
  const kept = keys.filter((k) => ABILITIES[k].kind === 'perm' && build[k] > 0);

  const title = document.getElementById('over-title');
  if (title) {
    if (kind === 'dead') {
      title.classList.add('art');
      title.innerHTML = '<img src="tex/ui_title_overrun.png" alt="OVERRUN">';
    } else {
      title.classList.remove('art');
      title.textContent = 'LEVEL CLEAR';
    }
  }

  const panels = document.getElementById('over-panels');
  if (panels) {
    panels.innerHTML =
      `<section><h3>${kind === 'dead' ? 'USED' : 'DONE'}</h3><div class="slots">` +
        (used.length ? used.map((k) => slot(k, build[k], true)).join('') : '<em>none</em>') +
      '</div></section>' +
      `<section class="kept"><h3>KEPT</h3><div class="slots">` +
        (kept.length ? kept.map((k) => slot(k, build[k], false)).join('') : '<em>nothing yet</em>') +
      '</div></section>' +
      '<section class="roll"><h3>ROLL</h3><div class="mystery"><img src="tex/loot_closed.webp" alt=""><b>?</b></div><p>FREE START POWER</p></section>';
  }

  // the map: the first room of the level you start next, a trail of pizzas, the boss at the end
  const next = kind === 'won' ? level + 1 : level;
  const map = document.getElementById('over-map');
  if (map) {
    let nodes = '';
    for (let i = 0; i < rooms; i++) {
      const boss = i === rooms - 1;
      nodes += `<div class="node${i === 0 ? ' start' : ''}${boss ? ' boss' : ''}">` +
        (i === 0 ? `${MASK}<span class="flag">START</span>` : '') +
        `<img src="tex/ui_pizza_${i === 0 ? 'full' : 'dim'}.png" alt="">` +
        (boss ? '<span class="crown">&#9813;</span>' : '') + '</div>';
    }
    map.innerHTML = `<div class="trail">${nodes}</div><div class="lvl">LEVEL ${next}</div>`;
  }
}
