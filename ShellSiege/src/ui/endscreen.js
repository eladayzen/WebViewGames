// THE END-OF-RUN SCREEN: what happened to your build, and where you start next.
//
// Elad, 22 Nov, after the concept frame (art-candidates/ui-concepts/overrun-progression.png):
// the screen has to explain the roguelike in one look --
//
//   TEMPORARY  the turtle allies you hold. In colour while the run is alive (a won level keeps them);
//          grey only once you have died, because only then are they lost.
//   KEPT   the PERMANENT abilities, with how many of each. These stay.
//   ROLL   a closed box: you get a free new ability when you press GO AGAIN. The roll
//          itself happens after the press, over black (main.js), not here.
//   MAP    where the next run starts: the first room of this level (or the next level).
//
// Only the DOM; the facts come in as arguments so this stays dumb.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { doorIcon } from './doors.js';

const slot = (k, count, spent, cls = '', style = '') =>
  `<div class="slot ${ABILITIES[k].kind}${spent ? ' spent' : ''}${cls ? ' ' + cls : ''}" title="${ABILITIES[k].label}"${style ? ` style="${style}"` : ''}>${iconFor(k)}` +
  (count > 1 ? `<b>${count}</b>` : '') + '</div>';

/** THE BANK, drawn as a pizza-box safe. Lid open -> shuts -> padlock snaps on. No words. */
const LOCK = '<svg class="padlock" viewBox="0 0 60 64" aria-hidden="true">' +
  '<path d="M16 28v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#14210f" stroke-width="10" stroke-linecap="round"/>' +
  '<path d="M16 28v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#c9d3dc" stroke-width="5" stroke-linecap="round"/>' +
  '<rect x="6" y="26" width="48" height="34" rx="8" fill="#ffd84a" stroke="#14210f" stroke-width="4"/>' +
  '<circle cx="30" cy="40" r="5" fill="#14210f"/><rect x="28" y="42" width="4" height="10" rx="2" fill="#14210f"/></svg>';

const MEDAL = '<svg class="medal" viewBox="0 0 64 80" aria-hidden="true"><path d="M14 0h14l6 30H20zM50 0H36l-6 30h14z" fill="#d6242c" stroke="#14210f" stroke-width="3"/>' +
  '<circle cx="32" cy="50" r="24" fill="#ffd84a" stroke="#14210f" stroke-width="4"/><circle cx="32" cy="50" r="17" fill="#ffe98a" stroke="#14210f" stroke-width="2.5"/>' +
  '<path d="M32 36l4.5 9.5 10.5 1.5-7.6 7.3 1.8 10.4L32 59.6 22.8 65l1.8-10.4-7.6-7.3 10.5-1.5z" fill="#ff7a1a" stroke="#14210f" stroke-width="2.5" stroke-linejoin="round"/></svg>';

const MASK = '<svg class="map-turtle" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/><path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/><ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/></svg>';

/**
 * Fill the end screen.
 * @param kind   'dead' | 'won'
 * @param o      { build, level, rooms }   `level` is the one you are ON; a win starts the next
 */
export function renderEnd(kind, { build, bank = {}, oldBank = {}, loose = {}, keptPick = null, level, rooms }) {
  const keys = Object.keys(ABILITIES);
  const temp = keys.filter((k) => ABILITIES[k].kind === 'temp' && build[k] > 0);
  const won = kind === 'won';

  const title = document.getElementById('over-title');
  if (title) {
    if (!won) {
      title.classList.add('art');
      title.innerHTML = '<img src="tex/ui_title_overrun.png" alt="OVERRUN">';
    } else {
      title.classList.remove('art');
      title.innerHTML = MEDAL + '<span>LEVEL CLEAR</span>';
    }
    title.classList.toggle('big', won);
  }

  // THE VAULT: what you won this level flies into the box (all of it on a win; on a death only the
  // one kept pick does, the rest crumble), the lid shuts, the padlock snaps on, and the bank is
  // shown under the box. Timings are CSS variables so the sequence reads in order.
  const looseKeys = Object.keys(loose);
  const flying = won ? looseKeys : looseKeys.filter((k) => k === keptPick);
  const crumbling = won ? [] : looseKeys.filter((k) => k !== keptPick);
  const shutAt = (0.5 + flying.length * 0.3 + 0.7).toFixed(2);
  const looseHtml = looseKeys.map((k) => {
    const i = flying.indexOf(k), j = crumbling.indexOf(k);
    return slot(k, loose[k], false, i >= 0 ? 'fly' : 'crumble', `--d:${(i >= 0 ? 0.5 + i * 0.3 : 0.4 + j * 0.18).toFixed(2)}s`);
  }).join('');
  const bankKeys = keys.filter((k) => bank[k] > 0);
  const bankHtml = bankKeys.map((k) => slot(k, bank[k], false, 'banked' + ((bank[k] || 0) > (oldBank[k] || 0) ? ' fresh' : ''), `--d:${shutAt}s`)).join('');

  const panels = document.getElementById('over-panels');
  if (panels) {
    panels.className = won ? 'won' : 'dead';
    panels.innerHTML =
      `<section class="temp"><h3>TEMPORARY</h3><div class="slots">` +
        (temp.length ? temp.map((k) => slot(k, build[k], !won)).join('') : '<em>none</em>') +
      '</div></section>' +
      `<section class="vault ${kind}" style="--shut:${shutAt}s"><div class="vault-loose">${looseHtml}</div><div class="vault-box">${LOCK}<div class="vault-bank">${bankHtml}</div></div></section>`;
  }

  // the map: the first room of the level you start next, a trail of pizzas, the boss at the end
  const next = won ? level + 1 : level;
  const map = document.getElementById('over-map');
  if (map) {
    let nodes = '';
    for (let i = 0; i < rooms; i++) {
      const boss = i === rooms - 1;
      nodes += `<div class="node${i === 0 ? ' start' : ''}${boss ? ' boss' : ''}">` +
        (i === 0 ? `${MASK}<span class="flag">START</span>` : '') +
        doorIcon(boss ? 'boss' : i === 0 ? 'here' : 'todo') +
        (boss ? '<span class="crown">&#9813;</span>' : '') + '</div>';
    }
    map.innerHTML = `<div class="trail">${nodes}</div><div class="lvl">LEVEL ${next}</div>`;
  }
}
