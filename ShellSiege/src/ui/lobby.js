// THE LOBBY, v2 (PRD_v2.md): FOUR SAVE SLOTS, and the level flythrough.
//
//   showSlots     the slot list, most recently played first. Each slot card shows the level reached (a floor "island" in the level's tier
//                 colour), the skills held, and where the run will resume. NEW GAME takes the first free slot; when all four are full it
//                 asks you to delete one (a small x on each card, tapped twice). Resolves { slot, isNew }.
//   levelTravel   the island strip. First new game: it opens on the far levels (the potential) and slides back to level 1. After a level
//                 clear: it opens on the level you cleared (starred) and slides on to the next. Resolves when it has been read.
//
// A flow layout (grid rows sized from the height left, like the roll screen), so nothing is stacked over anything else on a short phone.
// Only DOM. No new art: the islands are the floor paintings the rooms already use.
import { ABILITIES } from '../core/abilities.js';
import { iconFor } from './icons.js';
import { lookFor, THEMES } from '../core/looks.js';
import { orderedSlots, SLOT_COUNT } from '../systems/save.js';

const MASK = '<svg class="map-turtle" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#5fb24a" stroke="#14210f" stroke-width="3.5"/><path d="M4 17c6-4 34-4 40 0l-1 12c-6 4-32 4-38 0z" fill="#d6242c" stroke="#14210f" stroke-width="3"/><ellipse cx="16" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/><ellipse cx="32" cy="23" rx="5.2" ry="4.2" fill="#fff" stroke="#14210f" stroke-width="2"/></svg>';
const STAR = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3l6.2 13.4 14.6 1.6-10.9 9.9 3 14.4L24 34.9 11.1 42.3l3-14.4L3.2 18l14.6-1.6z" fill="#ffd84a" stroke="#14210f" stroke-width="3.5" stroke-linejoin="round"/></svg>';

// A name and a colour per level, hotter as you go. Past the list the last one repeats with a numeral.
const TIERS = [
  { name: 'ROOKIE', hue: '#5fd06a' }, { name: 'SCRAPPER', hue: '#8fd13a' }, { name: 'BRAWLER', hue: '#ffc83a' }, { name: 'VETERAN', hue: '#ff9a2a' },
  { name: 'NINJA', hue: '#ff5a3a' }, { name: 'MASTER', hue: '#ff3a7a' }, { name: 'LEGEND', hue: '#c04aff' },
];
const tier = (l) => TIERS[Math.min(l, TIERS.length) - 1];
const tierName = (l) => (l > TIERS.length ? `${TIERS[TIERS.length - 1].name} ${['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(9, l - TIERS.length)]}` : tier(l).name);
const floorOf = (level, i = 0) => `tex/floor_${THEMES[lookFor(level, i).theme].floor}.webp`;
const PERM = Object.keys(ABILITIES).filter((k) => ABILITIES[k].kind === 'perm' && !ABILITIES[k].locked);

const openRoot = (root) => { root.classList.remove('hidden'); document.body.classList.add('in-lobby'); };      // in-lobby lifts the corner X above it
const closeRoot = (root) => { root.classList.add('hidden'); root.innerHTML = ''; document.body.classList.remove('in-lobby'); };

/** One island: the floor painting of the level, its number and tier. `locked` greys it with a "?". */
const island = (l, { locked = false, star = false } = {}) =>
  `<div class="lt-isle${locked ? ' locked' : ''}" data-l="${l}" style="--hue:${tier(l).hue}">` +
  `<div class="lt-art" style="background-image:url(${floorOf(l, 0)})">${locked ? '<em>?</em>' : ''}${star ? `<span class="lt-star">${STAR}</span>` : ''}</div>` +
  `<div class="lt-lbl"><small>LEVEL</small><b>${l}</b></div><div class="lt-name">${locked ? '? ? ?' : tierName(l)}</div></div>`;

/**
 * @param slots    the four slots from loadSlots() (null = empty)
 * @param onDelete (i) => void, called when a slot is deleted
 * @param midGame  true when opened from the X during play (only the title differs)
 * @returns Promise<{ slot: number, isNew: boolean }>
 */
export function showSlots({ slots, onDelete = () => {}, midGame = false }) {
  const root = document.getElementById('lobby');
  if (!root) return Promise.resolve({ slot: 0, isNew: true });
  openRoot(root);
  return new Promise((resolve) => {
    const state = slots.slice();
    const render = () => {
      const list = orderedSlots(state);
      const free = state.findIndex((s) => !s);
      const full = free < 0;
      const cards = list.map(({ i, s }) => {
        const l = s.unlocked;
        const skills = PERM.map((k) => (s.perm[k] > 0
          ? `<div class="slot perm">${iconFor(k)}${s.perm[k] > 1 ? `<b>${s.perm[k]}</b>` : ''}</div>`
          : '<div class="slot empty"></div>')).join('');
        const where = s.run ? `ROOM ${s.run.room + 1}` : 'NEW LEVEL';
        return `<div class="sl-card" data-i="${i}" role="button" tabindex="0" style="--hue:${tier(l).hue}">` +
          `<button type="button" class="sl-del" data-i="${i}" aria-label="delete this game">&times;</button>` +
          `<div class="sl-art" style="background-image:url(${floorOf(l, 0)})"><div class="sl-lvl"><small>LEVEL</small><b>${l}</b></div></div>` +
          `<div class="sl-name">${tierName(l)}</div><div class="sl-where">${s.run ? MASK : ''}${where}</div>` +
          `<div class="sl-skills" title="permanent skills">${skills}</div></div>`;
      }).join('');
      root.innerHTML =
        `<div class="lb sl"><div class="lb-bg"></div>` +
        `<div class="lb-top"><span class="lb-best">${midGame ? 'YOUR GAMES' : 'CHOOSE YOUR GAME'}</span><span class="lb-hint ${full ? 'on' : ''}" id="sl-hint">${full ? 'ALL SLOTS FULL: DELETE ONE TO START NEW' : ''}</span></div>` +
        `<div class="sl-row">${cards}</div>` +
        `<div class="lb-buttons"><button id="sl-new" type="button"${full ? ' class="off"' : ''}>NEW GAME<small>${full ? 'no free slot' : `slot ${free + 1} of ${SLOT_COUNT}`}</small></button></div></div>`;
      root.querySelectorAll('.sl-card').forEach((c) => {
        c.addEventListener('click', (e) => { if (e.target.closest('.sl-del')) return; closeRoot(root); resolve({ slot: Number(c.dataset.i), isNew: false }); });
      });
      root.querySelectorAll('.sl-del').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!b.classList.contains('sure')) {      // the first tap asks, the second deletes
            b.classList.add('sure'); b.innerHTML = 'DELETE?';
            setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.innerHTML = '&times;'; } }, 2500);
            return;
          }
          const i = Number(b.dataset.i);
          state[i] = null; onDelete(i);
          if (!orderedSlots(state).length) { closeRoot(root); resolve({ slot: 0, isNew: true }); return; }      // nothing left: straight to a new game
          render();
        });
      });
      root.querySelector('#sl-new').addEventListener('click', () => { if (!full) { closeRoot(root); resolve({ slot: free, isNew: true }); } });
    };
    render();
  });
}

/**
 * THE LEVEL FLYTHROUGH. `from` -> `to`: the strip opens focused on `from` and slides to `to`. For a new game from = a far level (the
 * potential) and to = 1; after a clear from = the level just won (starred) and to = the next. Levels past `to` are shown locked.
 * Tap to skip.
 */
export function levelTravel({ from, to, star = false, holdMs = 900, slideMs = 2300, endMs = 1200 }) {
  const root = document.getElementById('lobby');
  if (!root) return Promise.resolve();
  openRoot(root);
  const top = Math.max(from, to) + 2;
  const isles = Array.from({ length: top }, (_, i) => island(i + 1, { locked: i + 1 > to, star: star && i + 1 === from })).join('');
  root.innerHTML = `<div class="lb lt"><div class="lb-bg"></div><div class="lb-top"><span class="lb-best" id="lt-title"></span></div>` +
    `<div class="lt-view"><div class="lt-strip" id="lt-strip">${isles}</div></div><div class="lb-top"><span class="lb-hint on">TAP TO SKIP</span></div></div>`;
  const strip = root.querySelector('#lt-strip'), view = root.querySelector('.lt-view');
  const centreOn = (l) => {
    const el = strip.querySelector(`.lt-isle[data-l="${l}"]`);
    return view.clientWidth / 2 - (el.offsetLeft + el.offsetWidth / 2);
  };
  const focus = (l) => {
    root.querySelectorAll('.lt-isle').forEach((e) => e.classList.toggle('on', Number(e.dataset.l) === l));
    const t = root.querySelector('#lt-title'); if (t) t.innerHTML = `LEVEL <b>${l}</b> &middot; ${tierName(l)}`;
    const bg = root.querySelector('.lb-bg'); if (bg) bg.style.backgroundImage = `url(${floorOf(l, 0)})`;
  };
  return new Promise((resolve) => {
    let finished = false;
    const timers = [];
    const done = () => { if (finished) return; finished = true; timers.forEach(clearTimeout); closeRoot(root); resolve(); };
    root.addEventListener('click', done, { once: true });
    strip.style.transition = 'none'; strip.style.transform = `translateX(${centreOn(from)}px)`; focus(from);
    void strip.offsetWidth;
    timers.push(setTimeout(() => {
      strip.style.transition = `transform ${slideMs}ms cubic-bezier(.5,0,.2,1)`;
      strip.style.transform = `translateX(${centreOn(to)}px)`;
      timers.push(setTimeout(() => focus(to), slideMs * 0.55));
    }, holdMs));
    timers.push(setTimeout(done, holdMs + slideMs + endMs));
  });
}
