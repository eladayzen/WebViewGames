// THE LOBBY: the first screen. No title (the name is not settled -- see core/brand.js).
//
//   LEFT   the STORY, as three comic panels: the machines take the plaza; Raph holds the line while
//          Donnie sends gadgets; clear the rooms and finish the level to keep what you won.
//   RIGHT  WHERE YOU ARE: the LEVEL road (done levels with medals, this one with the turtle, the next
//          ones locked), the ROOM trail of this level (a pizza per room, the turtle on the current
//          one, a crown on the boss), what you hold, and the buttons.
//
// Only DOM; resolves with 'continue' or 'new'.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { doorIcon } from './doors.js';

const MASK = '<svg class="map-turtle" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/><path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/><ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/></svg>';
const MEDAL = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#ffd84a" stroke="#14210f" stroke-width="4"/><path d="M24 11l4 9 10 1-7.5 6.8 2.2 9.7L24 32l-8.7 5.5 2.2-9.7L10 21l10-1z" fill="#ff7a1a" stroke="#14210f" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const LOCK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#14210f" stroke-width="7" stroke-linecap="round"/><path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#9aa6b2" stroke-width="3.5" stroke-linecap="round"/><rect x="9" y="21" width="30" height="21" rx="6" fill="#8d96a0" stroke="#14210f" stroke-width="3.5"/><circle cx="24" cy="31" r="3.5" fill="#14210f"/></svg>';

// A foot-machine: a dark helmet with two red eyes. Three of them make the first panel.
const BOT = '<g><path d="M8 40V22a14 14 0 0 1 28 0v18z" fill="#2c313a" stroke="#14210f" stroke-width="3"/><rect x="12" y="20" width="20" height="7" rx="3" fill="#14210f"/><circle cx="18" cy="23.5" r="2.4" fill="#ff3b30"/><circle cx="26" cy="23.5" r="2.4" fill="#ff3b30"/><path d="M14 8l4 7M30 8l-4 7" stroke="#14210f" stroke-width="3" stroke-linecap="round"/></g>';

const PANELS = [
  { art: `<svg viewBox="0 0 150 70" aria-hidden="true"><g transform="translate(4 8) scale(.9)">${BOT}</g><g transform="translate(52 2) scale(1.05)">${BOT}</g><g transform="translate(104 8) scale(.9)">${BOT}</g></svg>`, cap: 'THE FOOT MACHINES TAKE THE PLAZA' },
  { art: `<div class="pn-duo">${MASK}<img src="tex/donnie_head.png" alt=""></div>`, cap: 'RAPH HOLDS THE LINE. DONNIE SENDS GADGETS' },
  { art: `<div class="pn-trail">${doorIcon('done')}${doorIcon('done')}${doorIcon('here')}${doorIcon('boss')}</div>`, cap: 'CLEAR THE ROOMS. FINISH THE LEVEL. KEEP WHAT YOU WON' },
];

const slot = (k, n, extra = '') =>
  `<div class="slot ${ABILITIES[k].kind}${extra}" title="${ABILITIES[k].label}">${iconFor(k)}${n > 1 ? `<b>${n}</b>` : ''}</div>`;

/**
 * @param run   null, or { level, room, build, rooms }  (room is 0-based)
 * @param bank  the permanent abilities already banked, as counts
 * @param unlocked  the furthest level reached: a NEW RUN asks which of 1..unlocked to start at
 * @returns Promise<{ choice: 'continue' | 'new', level }>
 */
export function showLobby({ run, bank = {}, unlocked = 1 }) {
  const root = document.getElementById('lobby');
  if (!root) return Promise.resolve({ choice: run ? 'continue' : 'new', level: 1 });
  const keys = Object.keys(ABILITIES);

  const panels = PANELS.map((p, i) => `<div class="story-panel p${i + 1}"><div class="pn-art">${p.art}</div><div class="pn-cap">${p.cap}</div></div>`).join('');

  // the road of levels: the ones behind you, this one, and two more locked ahead
  const level = run ? run.level : unlocked;          // with no run in progress, the furthest level reached is where you stand
  const shown = Math.max(4, level + 2);
  let road = '';
  for (let l = 1; l <= shown; l++) {
    const state = l < level ? 'done' : l === level ? 'here' : 'locked';
    road += `<div class="lv ${state}"><div class="lv-ico">${state === 'done' ? MEDAL : state === 'locked' ? LOCK : MASK}</div><b>${l}</b></div>`;
  }

  // the rooms of this level
  let rooms = '';
  const nRooms = run ? run.rooms : 5;
  for (let i = 0; i < nRooms; i++) {
    const boss = i === nRooms - 1, here = run && i === run.room, done = run && i < run.room;
    rooms += `<div class="rm${here ? ' here' : ''}${boss ? ' boss' : ''}">${here ? MASK : ''}${doorIcon(boss && !done ? 'boss' : done ? 'done' : here ? 'here' : 'todo')}${boss ? '' : ''}</div>`;
  }

  const held = run ? keys.filter((k) => run.build[k] > 0).map((k) => slot(k, run.build[k])) : keys.filter((k) => bank[k] > 0).map((k) => slot(k, bank[k], ' banked'));
  const buttons = run
    ? '<button id="lobby-continue" type="button">CONTINUE</button><button id="lobby-new" type="button" class="alt">NEW RUN</button>'
    : '<button id="lobby-continue" type="button">PLAY</button>';

  root.innerHTML =
    `<div class="lobby-card"><div class="lobby-story">${panels}</div>` +
    `<div class="lobby-progress"><div class="lobby-tag">LEVELS</div><div class="lobby-road">${road}</div><div class="lobby-tag">ROOMS</div><div class="lobby-rooms">${rooms}</div>` +
    `<div class="lobby-held">${held.join('')}</div><div class="lobby-buttons">${buttons}</div></div></div>`;
  root.classList.remove('hidden');
  document.body.classList.add('in-lobby');         // lifts the corner X above the lobby: from here it leaves the game
  return new Promise((resolve) => {
    const done = (v) => { root.classList.add('hidden'); root.innerHTML = ''; document.body.classList.remove('in-lobby'); resolve(v); };
    const main = root.innerHTML;
    // WHICH LEVEL? Every level you have reached is a button; a few more are shown locked, so there is
    // always something ahead. Shown when a new run is chosen and there is more than level 1 to choose.
    const pickLevel = () => {
      const total = unlocked + 3;
      let nodes = '';
      for (let l = 1; l <= total; l++) {
        const open = l <= unlocked, cur = l === unlocked;
        nodes += `<button type="button" class="lv-btn ${open ? 'open' : 'locked'}${cur ? ' newest' : ''}" data-level="${l}" ${open ? '' : 'disabled'}>` +
          `<div class="lv-ico">${open ? (cur ? MASK : MEDAL) : LOCK}</div><b>${l}</b></button>`;
      }
      root.innerHTML = `<div class="lobby-card pick"><div class="lobby-progress"><div class="lobby-tag big">START AT LEVEL</div>` +
        `<div class="lobby-levels">${nodes}</div><div class="lobby-buttons"><button id="lobby-back" type="button" class="alt">BACK</button></div></div></div>`;
      root.querySelectorAll('.lv-btn.open').forEach((b) => b.addEventListener('click', () => done({ choice: 'new', level: Number(b.dataset.level) })));
      root.querySelector('#lobby-back').addEventListener('click', () => { root.innerHTML = main; wire(); });
    };
    const startNew = () => (unlocked > 1 ? pickLevel() : done({ choice: 'new', level: 1 }));
    function wire() {
      root.querySelector('#lobby-continue').addEventListener('click', () => (run ? done({ choice: 'continue', level: run.level }) : startNew()));
      root.querySelector('#lobby-new')?.addEventListener('click', startNew);
    }
    wire();
  });
}
