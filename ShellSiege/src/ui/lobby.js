// THE LOBBY (Elad, 25 Nov: "a better ux ui flow ... emphasising the difference between the levels, pulling players to reach higher ones").
//
//   SCREEN 1  THE LEVELS. A row of level cards you swipe or step through. The furthest level you have reached is chosen when you arrive.
//             Each card is its own place: a strip of that level's rooms (the real floors it uses), a tier name, a threat meter that
//             grows, and its colour heats up from cool green to hot red-purple. The levels ahead are shown LOCKED but tempting -- greyed
//             rooms with a "?", and the very next one pulses -- so there is always something to reach for.
//             Buttons: LOAD GAME (the run you left, if any) and NEW GAME (the chosen level, from its first room).
//   SCREEN 2  THE ROOM MAP of the chosen level: the dotted line of doors with the turtle on the one you start from. For LOAD GAME the
//             doors you reached are open to pick (you may restart from a middle room); every other start is the first room.
//
// A flow layout (grid rows sized from the height left), so nothing is stacked over anything else on a short phone screen.
// Only DOM; resolves with { choice: 'continue' | 'new', level, room }.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { doorIcon } from './doors.js';
import { lookFor, THEMES } from '../core/looks.js';
import { roomsIn } from '../core/breeds.js';

const MASK = '<svg class="map-turtle" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/><path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/><ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/></svg>';
const MEDAL = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#ffd84a" stroke="#14210f" stroke-width="4"/><path d="M24 11l4 9 10 1-7.5 6.8 2.2 9.7L24 32l-8.7 5.5 2.2-9.7L10 21l10-1z" fill="#ff7a1a" stroke="#14210f" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const LOCK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#14210f" stroke-width="7" stroke-linecap="round"/><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#9aa6b2" stroke-width="3.5" stroke-linecap="round"/><rect x="9" y="21" width="30" height="21" rx="6" fill="#8d96a0" stroke="#14210f" stroke-width="3.5"/><circle cx="24" cy="31" r="3.5" fill="#14210f"/></svg>';
const FLAME = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1c1 6 8 9 8 17a8 8 0 0 1-16 0c0-4 2-6 3-9 1 2 2 3 3 3 0-4-1-7 2-11z" fill="currentColor" stroke="#14210f" stroke-width="2" stroke-linejoin="round"/></svg>';

// THE TIERS: a name and a colour per level, hotter as you go. Past the list the last tier repeats with a numeral.
const TIERS = [
  { name: 'ROOKIE', hue: '#5fd06a' }, { name: 'SCRAPPER', hue: '#8fd13a' }, { name: 'BRAWLER', hue: '#ffc83a' }, { name: 'VETERAN', hue: '#ff9a2a' },
  { name: 'NINJA', hue: '#ff5a3a' }, { name: 'MASTER', hue: '#ff3a7a' }, { name: 'LEGEND', hue: '#c04aff' },
];
const tier = (l) => TIERS[Math.min(l, TIERS.length) - 1];
const tierName = (l) => (l > TIERS.length ? `${TIERS[TIERS.length - 1].name} ${['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(9, l - TIERS.length)]}` : tier(l).name);
const floorOf = (level, i) => `tex/floor_${THEMES[lookFor(level, i).theme].floor}.webp`;

const slot = (k, n, extra = '') =>
  `<div class="slot ${ABILITIES[k].kind}${extra}" title="${ABILITIES[k].label}">${iconFor(k)}${n > 1 ? `<b>${n}</b>` : ''}</div>`;

/**
 * @param run       null, or { level, room, build, rooms } (room is 0-based): the run you left
 * @param bank      the permanent abilities already banked, as counts
 * @param unlocked  the furthest level reached
 * @param midGame   true when opened from the X during play: LOAD GAME just resumes (no map)
 */
export function showLobby({ run, bank = {}, unlocked = 1, midGame = false }) {
  const root = document.getElementById('lobby');
  if (!root) return Promise.resolve({ choice: run ? 'continue' : 'new', level: 1, room: 0 });
  const shown = unlocked + 3;                                   // always some locked levels ahead
  let selected = unlocked;                                      // the last unlocked level is chosen by default

  const card = (l) => {
    const open = l <= unlocked, best = l === unlocked, next = l === unlocked + 1;
    const n = roomsIn(l - 1);
    const strip = Array.from({ length: n }, (_, i) => `<i style="background-image:url(${floorOf(l, i)})"></i>`).join('');
    const threat = Array.from({ length: 5 }, (_, i) => `<span class="${i < Math.min(5, Math.ceil(l * 0.8)) ? 'on' : ''}">${FLAME}</span>`).join('');
    const status = !open ? `<span class="st lock">${LOCK}${next ? 'CLEAR LEVEL ' + (l - 1) + ' TO OPEN' : 'LOCKED'}</span>`
      : best ? '<span class="st here">' + MASK + 'YOUR FRONTIER</span>' : '<span class="st done">' + MEDAL + 'CLEARED</span>';
    return `<button type="button" class="lb-card ${open ? 'open' : 'locked'}${best ? ' best' : ''}${next ? ' next' : ''}" data-l="${l}" style="--hue:${tier(l).hue}">` +
      `<div class="lb-num"><small>LEVEL</small><b>${l}</b></div>` +
      `<div class="lb-strip">${strip}${open ? '' : '<em>?</em>'}</div>` +
      `<div class="lb-name">${open ? tierName(l) : '? ? ?'}</div>` +
      `<div class="lb-threat" title="threat">${threat}</div>${status}</button>`;
  };

  const main = () => {
    const cards = Array.from({ length: shown }, (_, i) => card(i + 1)).join('');
    const cont = run ? `<button id="lb-load" type="button" class="alt">${midGame ? 'CONTINUE' : 'LOAD GAME'}<small>LEVEL ${run.level} · ROOM ${run.room + 1}</small></button>` : '';
    root.innerHTML =
      `<div class="lb"><div class="lb-bg"></div>` +
      `<div class="lb-top"><span class="lb-best">${MEDAL}BEST LEVEL <b>${unlocked}</b></span><span class="lb-hint" id="lb-hint"></span></div>` +
      `<div class="lb-row"><button type="button" class="lb-arrow l" aria-label="previous level">&#9664;</button><div class="lb-cards" id="lb-cards">${cards}</div><button type="button" class="lb-arrow r" aria-label="next level">&#9654;</button></div>` +
      `<div class="lb-buttons">${cont}<button id="lb-new" type="button">NEW GAME</button></div></div>`;
  };

  root.classList.remove('hidden');
  document.body.classList.add('in-lobby');         // lifts the corner X above the lobby: from here it leaves the game
  return new Promise((resolve) => {
    const done = (v) => { root.classList.add('hidden'); root.innerHTML = ''; document.body.classList.remove('in-lobby'); resolve(v); };

    // ---- SCREEN 2: the room map of a level ----
    const mapScreen = (level, mode) => {
      const n = roomsIn(level - 1);
      const reach = mode === 'load' ? Math.min(n - 1, run.room) : 0;        // the furthest door you may start from
      let start = reach;
      const doors = Array.from({ length: n }, (_, i) => {
        const boss = i === n - 1;
        return `<button type="button" class="lb-door${i <= reach ? ' pick' : ''}" data-i="${i}" ${i <= reach && reach > 0 ? '' : 'tabindex="-1"'}>` +
          `${doorIcon(i < reach ? 'done' : boss ? 'boss' : i === reach ? 'here' : 'todo')}${boss ? '<span class="crown">&#9813;</span>' : ''}<i>${i + 1}</i></button>`;
      }).join('');
      const held = mode === 'load' ? Object.keys(ABILITIES).filter((k) => run.build[k] > 0).map((k) => slot(k, run.build[k])) : Object.keys(ABILITIES).filter((k) => bank[k] > 0).map((k) => slot(k, bank[k], ' banked'));
      root.innerHTML =
        `<div class="lb map" style="--hue:${tier(level).hue}"><div class="lb-bg" style="background-image:url(${floorOf(level, 0)})"></div>` +
        `<div class="lb-top"><span class="lb-best">LEVEL <b>${level}</b> · ${tierName(level)}</span></div>` +
        `<div class="lb-mapwrap"><div class="trail">${doors}<div class="runner" style="--p:${n > 1 ? start / (n - 1) : 0}">${MASK}</div></div>` +
        `<div class="lb-startline" id="lb-startline"></div></div>` +
        `<div class="lb-held">${held.join('')}</div>` +
        `<div class="lb-buttons"><button id="lb-back" type="button" class="alt">BACK</button><button id="lb-go" type="button">GO</button></div></div>`;
      const label = () => { root.querySelector('#lb-startline').textContent = start === 0 ? `START FROM ROOM 1` : `RESUME FROM ROOM ${start + 1}`; };
      label();
      root.querySelectorAll('.lb-door.pick').forEach((d) => d.addEventListener('click', () => {
        if (reach === 0) return;
        start = Number(d.dataset.i); label();
        root.querySelector('.runner').style.setProperty('--p', String(n > 1 ? start / (n - 1) : 0));
      }));
      root.querySelector('#lb-back').addEventListener('click', () => { main(); wire(); });
      root.querySelector('#lb-go').addEventListener('click', () => done(mode === 'load' ? { choice: 'continue', level, room: start } : { choice: 'new', level, room: 0 }));
    };

    // ---- SCREEN 1 wiring ----
    function wire() {
      const rowEl = root.querySelector('#lb-cards');
      const bg = root.querySelector('.lb-bg');
      const hint = root.querySelector('#lb-hint');
      const pick = (l, smooth = true) => {
        selected = Math.max(1, Math.min(shown, l));
        root.querySelectorAll('.lb-card').forEach((c) => c.classList.toggle('sel', Number(c.dataset.l) === selected));
        const c = rowEl.querySelector(`.lb-card[data-l="${selected}"]`);
        c?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', inline: 'center', block: 'nearest' });
        bg.style.backgroundImage = `url(${floorOf(selected, 0)})`;
        root.firstElementChild.style.setProperty('--hue', tier(selected).hue);
        const open = selected <= unlocked;
        const ne = root.querySelector('#lb-new'); ne.disabled = !open;
        hint.textContent = open ? '' : selected === unlocked + 1 ? `CLEAR LEVEL ${unlocked} TO UNLOCK` : 'REACH HIGHER TO UNLOCK';
        hint.classList.toggle('on', !open);
      };
      rowEl.addEventListener('click', (e) => { const c = e.target.closest('.lb-card'); if (c) pick(Number(c.dataset.l)); });
      root.querySelector('.lb-arrow.l').addEventListener('click', () => pick(selected - 1));
      root.querySelector('.lb-arrow.r').addEventListener('click', () => pick(selected + 1));
      root.querySelector('#lb-new').addEventListener('click', () => { if (selected <= unlocked) mapScreen(selected, 'new'); });
      root.querySelector('#lb-load')?.addEventListener('click', () => (midGame ? done({ choice: 'continue', level: run.level, room: run.room }) : mapScreen(run.level, 'load')));
      pick(selected, false);
      requestAnimationFrame(() => pick(selected, false));       // once laid out, so the chosen card is really centred
    }
    main(); wire();
  });
}
