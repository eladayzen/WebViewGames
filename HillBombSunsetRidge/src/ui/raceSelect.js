// THE RACE LOBBY -- six tracks as a grid, not as a list.
//
// Amit: "the UI needs to be completely different, this should be something
// else. Like six squares, three by three... try to make it look pretty with
// text and some colour representing that environment."
//
// The mission list is a LADDER and looks like one: numbered rows, read top to
// bottom, one of them next. That is right for missions, where the order is the
// content and where you are in it is the question. A race lobby answers a
// different question -- WHICH TRACK do I want -- and six tracks compared
// side by side is a picker, not a queue. Same six hills, but the shape of the
// screen now says "choose" rather than "continue".
//
// EVERY TILE IS MADE OF THE HILL IT LEADS TO. The background is that terrain's
// actual matte painting and the accent is its actual palette -- both read out of
// the same registries the game renders from, never copied here. So a tile is a
// genuine preview rather than a decoration that has to be maintained alongside
// the thing it depicts: recolour a hill or repaint its sky and its tile follows
// in the same commit.
//
// That also answers "do we have to make a thumbnail?" -- no. A rendered
// screenshot would be six more files to ship, six more things to regenerate
// every time a hill changes, and it would still show less than the sky does:
// the matte IS the thing that distinguishes these places at a glance, which is
// exactly why each one got its own.

import { RACES } from '../data/races.js';
import { TERRAIN_PRESETS } from '../data/terrain.js';
import { SKIES } from '../world/sky.js';
import { getTheme } from '../data/themes.js';

const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, '0')}`;

/** The art a race's hill is made of: its sky image and its palette. */
function look(race) {
  const terrain = TERRAIN_PRESETS[race.terrain] || {};
  const sky = terrain.sky ? SKIES[terrain.sky] : null;
  const theme = getTheme(terrain.theme);
  return {
    image: sky ? (typeof sky === 'string' ? sky : sky.url) : null,
    // The lip colour is the loudest value break on the hill and the one thing a
    // player actually remembers a level by, so it is what the tile is keyed on.
    accent: hex(theme.lip),
    deep: hex(theme.trough),
  };
}

/**
 * @param {object} progress the shared progress store
 * @param {(id: string) => void} onPick
 * @param {number} track which ladder this is, for the unlock rule
 */
export function createRaceSelect(progress, onPick, track = 2) {
  const el = document.getElementById('race-select');
  const gridEl = document.getElementById('race-grid');
  const closeEl = document.getElementById('race-back');
  if (!el || !gridEl) {
    // The lobby is markup-driven; without it, fail to a no-op rather than
    // taking the boot down.
    return { isOpen: () => false, open() {}, close() {} };
  }

  /** Selection index, for the two-key path -- see the keydown handler. */
  let selected = 0;
  let tiles = [];

  function stars(n) {
    return [0, 1, 2]
      .map((i) => `<span class="rs-star${i < n ? ' earned' : ''}">&#9733;</span>`)
      .join('');
  }

  function render() {
    gridEl.innerHTML = '';
    tiles = [];
    RACES.forEach((race, i) => {
      const unlocked = progress.isUnlocked(race.id);
      const l = look(race);
      const tile = document.createElement('button');
      tile.className = 'rs-tile' + (unlocked ? '' : ' locked');
      tile.disabled = !unlocked;
      tile.style.setProperty('--rs-accent', l.accent);
      tile.style.setProperty('--rs-deep', l.deep);
      if (l.image) tile.style.setProperty('--rs-image', `url(${l.image})`);
      tile.innerHTML = unlocked
        ? `<span class="rs-art"></span>
           <span class="rs-num">${String(i + 1).padStart(2, '0')}</span>
           <span class="rs-body">
             <b>${race.name}</b>
             <small>${race.brief}</small>
           </span>
           <span class="rs-stars">${stars(progress.stars(race.id))}</span>`
        // A locked tile keeps its art but loses its brief -- knowing there is a
        // SWITCHBACK ahead is the hook; spoiling what it asks for is not. The
        // art staying visible is the point of the grid: you can see the places
        // you have not earned yet.
        : `<span class="rs-art"></span>
           <span class="rs-num">${String(i + 1).padStart(2, '0')}</span>
           <span class="rs-body">
             <b>${race.name}</b>
             <small>Finish 3rd or better previous run to unlock</small>
           </span>
           <span class="rs-lock">&#128274;</span>`;
      if (unlocked) tile.addEventListener('click', () => choose(race.id));
      gridEl.appendChild(tile);
      tiles.push({ el: tile, id: race.id, unlocked });
    });
    // Start on the furthest race that is actually playable -- the one the player
    // is most likely to want, and never a locked tile.
    const lastOpen = tiles.map((t, i) => (t.unlocked ? i : -1)).filter((i) => i >= 0).pop();
    selected = lastOpen == null ? 0 : lastOpen;
    refreshSelection();
  }

  function refreshSelection() {
    tiles.forEach((t, i) => t.el.classList.toggle('rs-sel', i === selected));
  }

  function choose(id) {
    el.classList.add('hidden');
    onPick(id);
  }

  if (closeEl) closeEl.addEventListener('click', () => el.classList.add('hidden'));

  /**
   * ENTER MOVES, SPACE PICKS -- the same two keys and the same division of
   * labour as the settings panel, because on the board they are the only inputs
   * the host forwards. A grid could justify four-way arrow navigation on a
   * desktop, but a second scheme that only works in a browser is a second thing
   * to keep in step for no gain where it matters.
   *
   * Enter skips locked tiles rather than stopping on them: a selection you
   * cannot act on is a dead press, and with five of six locked at the start
   * that would be most of them.
   */
  window.addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden')) return;
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    if (e.code === 'Enter') {
      for (let n = 0; n < tiles.length; n++) {
        selected = (selected + 1) % tiles.length;
        if (tiles[selected].unlocked) break;
      }
      refreshSelection();
      return;
    }
    const t = tiles[selected];
    if (t && t.unlocked) choose(t.id);
  });

  return {
    isOpen: () => !el.classList.contains('hidden'),
    open() {
      render();
      el.classList.remove('hidden');
    },
    close() { el.classList.add('hidden'); },
  };
}
