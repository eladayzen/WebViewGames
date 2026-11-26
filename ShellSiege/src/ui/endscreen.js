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
import { sheetHtml, flyAndBurn } from './sheet.js';

const slot = (k, count, spent, cls = '', style = '') =>
  `<div class="slot ${ABILITIES[k].kind}${spent ? ' spent' : ''}${cls ? ' ' + cls : ''}" title="${ABILITIES[k].label}"${style ? ` style="${style}"` : ''}>${iconFor(k)}` +
  (count > 1 ? `<b>${count}</b>` : '') + '</div>';

/** THE BANK, drawn as a pizza-box safe. Lid open -> shuts -> padlock snaps on. No words. */
const LOCK = '<svg class="padlock" viewBox="0 0 60 64" aria-hidden="true">' +
  '<path d="M16 28v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#14210f" stroke-width="10" stroke-linecap="round"/>' +
  '<path d="M16 28v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#c9d3dc" stroke-width="5" stroke-linecap="round"/>' +
  '<rect x="6" y="26" width="48" height="34" rx="8" fill="#ffd84a" stroke="#14210f" stroke-width="4"/>' +
  '<circle cx="30" cy="40" r="5" fill="#14210f"/><rect x="28" y="42" width="4" height="10" rx="2" fill="#14210f"/></svg>';

// THE LEVEL-CLEAR MEDAL (Elad, 25 Nov): a medal with three horizontal lines fanning out from each side, like a pair of military wings.
const WING = (dir) => [0, 1, 2].map((i) => {
  const y = 34 + i * 13, len = 74 - i * 17, x0 = dir < 0 ? 80 : 140, x1 = x0 + dir * len, y1 = y - 7;
  return `<path d="M${x0} ${y}L${x1} ${y1}" stroke="#14210f" stroke-width="11" stroke-linecap="round"/><path d="M${x0} ${y}L${x1} ${y1}" stroke="#ffd84a" stroke-width="5.5" stroke-linecap="round"/>`;
}).join('');
const WINGS = (dir) => '<svg class="wings ' + (dir < 0 ? 'l' : 'r') + '" viewBox="0 0 92 40" aria-hidden="true">' + [0, 1, 2].map((i) => {
  const y = 12 + i * 11, len = 84 - i * 18, x0 = dir < 0 ? 90 : 2, x1 = x0 + dir * len, y1 = y - 6;
  return `<path d="M${x0} ${y}L${x1} ${y1}" stroke="#14210f" stroke-width="10" stroke-linecap="round"/><path d="M${x0} ${y}L${x1} ${y1}" stroke="#ffd84a" stroke-width="5" stroke-linecap="round"/>`;
}).join('') + '</svg>';

export const MASK = '<svg class="map-turtle" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/><path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/><ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/></svg>';

/**
 * Fill the end screen.
 * @param kind   'dead' | 'won'
 * @param o      { build, level, rooms }   `level` is the one you are ON; a win starts the next
 */
export function renderEnd(kind, { build, bank = {}, oldBank = {}, loose = {}, keptPick = null, level, rooms, progress = null }) {
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
      title.innerHTML = WINGS(-1) + `<span>LEVEL ${level} CLEAR</span>` + WINGS(1);      // three lines each side of the words, like military wings
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
  let play = null;
  if (panels) {
    // BOTH ENDINGS USE RAPHAEL'S SHEET (Elad, 24 Nov): full screen, the new permanent finds in a tray, flying
    // into the sheet and being burned in. On a LEVEL CLEAR every one of them goes in. On OVERRUN only the one
    // kept pick does; the rest shatter in the tray.
    const card = document.querySelector('.over-card');
    card?.classList.add('sheetmode');
    card?.classList.toggle('intro', won);        // a level clear opens on the MAP alone; the sheet comes in later
    card?.classList.toggle('dead', !won);
    document.getElementById('gameover-overlay')?.classList.add('sheetmode');
    const permLoose = looseKeys.filter((k) => ABILITIES[k].kind === 'perm');
    const flyKeys = won ? permLoose : permLoose.filter((k) => k === keptPick);
    const lostKeys = won ? [] : permLoose.filter((k) => k !== keptPick);
    const after = { ...build };                               // what the sheet will show: the BANK for perms
    for (const k of keys) if (ABILITIES[k].kind === 'perm') after[k] = bank[k] || 0;
    const incoming = {};
    for (const k of flyKeys) incoming[k] = Math.max(1, (after[k] || 0) - (oldBank[k] || 0));
    const trayItem = (k, cls) => slot(k, loose[k], false, `tray-item ${cls}`).replace('class="slot', `data-key="${k}" class="slot`);
    const tray = flyKeys.map((k) => trayItem(k, 'to-fly')).concat(lostKeys.map((k) => trayItem(k, 'to-lose'))).join('');
    const embers = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--t:${(3 + (i % 5)).toFixed(1)}s;--d:${((i * 0.37) % 3).toFixed(2)}s"></i>`).join('');
    // OVERRUN EXPLAINS WHAT YOU HAD AND WHAT YOU LOST: the temporary abilities (they end with the run) and the
    // permanent finds that were not the one kept, greyed and struck through, beside what you keep.
    const lostSlots = [...temp.map((k) => slot(k, build[k], true)), ...lostKeys.map((k) => slot(k, loose[k], true))].join('');
    const keptN = flyKeys.reduce((n, k) => n + (incoming[k] || 1), 0);
    const lostN = temp.length + lostKeys.length;
    const lostHtml = won ? '' : `<div class="lost-strip"><div class="lost-line"><b class="keep">KEPT ${keptN}</b><span>permanent upgrade${keptN === 1 ? '' : 's'} (only the best find is kept)</span></div>` +
      (lostN ? `<div class="lost-line"><b class="gone">LOST ${lostN}</b><div class="slots">${lostSlots}</div></div>` : '') + '</div>';
    panels.className = (won ? 'won' : 'dead') + ' sheeted';
    panels.innerHTML =
      `<div class="embers" aria-hidden="true">${embers}</div>` +
      `<div class="won-stage">${permLoose.length ? `<div class="tray"><div class="tray-cap">${won ? 'NEW' : 'FOUND'}</div><div class="tray-items">${tray}</div></div>` : ''}` +
      sheetHtml({ build: after, bank: oldBank, incoming, showEmpty: true }) + '</div>' +
      lostHtml;
    play = () => {
      const root = panels;
      let t = 0;
      flyKeys.forEach((k, i) => {
        const el = root.querySelector(`.tray-item[data-key="${k}"]`);
        flyAndBurn(el, root, k, { delay: 1230 + i * 1310, duration: 1000 });
        t = 1230 + (i + 1) * 1310;
      });
      if (permLoose.length) setTimeout(() => root.querySelector('.tray')?.classList.add('spent'), Math.max(t, 1230 + 1310) + 920);
      // the ones that are NOT kept: shake, go grey and fall apart
      lostKeys.forEach((k, i) => {
        const el = root.querySelector(`.tray-item[data-key="${k}"]`);
        el?.animate([{ transform: 'none', filter: 'none', opacity: 1 }, { transform: 'translateX(4px) rotate(5deg)', filter: 'grayscale(1)', opacity: 1, offset: 0.4 },
          { transform: 'translateY(46px) rotate(28deg) scale(.5)', filter: 'grayscale(1)', opacity: 0 }], { duration: 770, delay: 920 + i * 270, easing: 'ease-in', fill: 'forwards' });
      });
    };
  }

  // the map. ON A LEVEL CLEAR it opens CENTRED and alone: this level's doors, the turtle walking from the pre-last door to the last,
  // a celebration, then it moves aside, becomes the preview of the next level, and the sheet comes in (Elad, 25 Nov).
  // ON OVERRUN the turtle stands where the run ended (Elad, 25 Nov): between the doors, how far through the level he got.
  const next = won ? level + 1 : level;
  const map = document.getElementById('over-map');
  let mapPlay = null;
  const doors = (stateOf, startFlag) => Array.from({ length: rooms }, (_, i) => {
    const boss = i === rooms - 1;
    return `<div class="node${i === 0 && startFlag ? ' start' : ''}${boss ? ' boss' : ''}" data-i="${i}">` +
      (i === 0 && startFlag ? `${MASK}<span class="flag">START</span>` : '') + doorIcon(stateOf(i, boss)) + (boss ? '<span class="crown">&#9813;</span>' : '') + '</div>';
  }).join('');
  if (map && won) {
    const p0 = rooms > 2 ? (rooms - 2) / (rooms - 1) : 0;
    const clearedDoors = doors((i, boss) => (boss ? 'boss' : 'done'), false);
    const preview = `<div class="trail">${doors((i, boss) => (boss ? 'boss' : i === 0 ? 'here' : 'todo'), true)}</div><div class="lvl">LEVEL ${next}</div>`;
    map.innerHTML = `<div class="trail">${clearedDoors}<div class="runner" style="--p:${p0}">${MASK}</div></div><div class="lvl">LEVEL ${level}</div>`;
    const sheetPlay = play;
    play = (cb = {}) => {
      const card = document.querySelector('.over-card');
      const cr = card.getBoundingClientRect(), mr = map.getBoundingClientRect();
      map.style.transition = 'none';
      map.style.transform = `translateY(${(cr.top + cr.height / 2 - (mr.top + mr.height / 2)).toFixed(1)}px) scale(1.3)`;
      void map.offsetWidth; map.style.transition = '';
      const at = (ms, fn) => setTimeout(() => { if (card.classList.contains('intro') || ms > 4000) fn(); }, ms);
      // 1. the turtle walks the last stretch, from the pre-last door to the boss door
      at(460, () => map.querySelector('.runner')?.style.setProperty('--p', '1'));
      // 2. he arrives: the last door opens, the medal drops in, the celebration
      at(1620, () => {
        const boss = map.querySelector(`.node[data-i="${rooms - 1}"]`);
        if (boss) { boss.firstElementChild.outerHTML = doorIcon('done'); boss.classList.add('arrived'); }
        card.classList.add('celebrate'); cb.celebrate?.();
      });
      // 3. the map clears the way to its place, and the sheet comes in
      at(3620, () => { card.classList.remove('intro'); map.style.transform = ''; });
      // 4. the map becomes the preview of the next level, and the upgrades go in one at a time
      at(4400, () => { map.innerHTML = preview; sheetPlay?.(); });
    };
  } else if (map) {
    const t = progress ? Math.max(0, Math.min(rooms - 1, progress.t)) : 0;
    const at = Math.floor(t + 1e-6);
    const marker = progress
      ? `<div class="runner" style="--p:0">${MASK}<span class="runner-tag">${Math.round((t - Math.floor(t)) * 100)}% of room ${Math.floor(t) + 1}</span></div>` : '';
    map.innerHTML = `<div class="trail">${doors((i, boss) => (progress ? (i < at ? 'done' : i === at ? 'here' : boss ? 'boss' : 'todo') : (boss ? 'boss' : 'todo')), false)}${marker}</div><div class="lvl">LEVEL ${next}</div>`;
    if (marker) mapPlay = () => setTimeout(() => map.querySelector('.runner')?.style.setProperty('--p', String(rooms > 1 ? t / (rooms - 1) : 0)), 900);
  }
  if (mapPlay) { const inner = play; play = () => { inner?.(); mapPlay(); }; }
  return play;
}

/**
 * GO AGAIN AFTER OVERRUN (Elad, 25 Nov): everything fades but the progression map; the turtle slides all the way back to the
 * first door and "LEVEL X, ROOM 1" appears. Resolves when it has been on screen long enough to read; the caller then starts the run.
 */
export function playRewind(level) {
  const card = document.querySelector('.over-card');
  const map = document.getElementById('over-map');
  if (!card || !map) return Promise.resolve();
  card.classList.add('rewinding');
  const tag = map.querySelector('.runner-tag'); if (tag) tag.textContent = 'back to the start';
  map.querySelector('.runner')?.style.setProperty('--p', '0');
  const t = document.createElement('div');
  t.className = 'rewind-text';
  t.innerHTML = `<span>LEVEL ${level}</span><b>ROOM 1</b>`;
  map.appendChild(t);
  return new Promise((r) => setTimeout(r, 3200));
}
