// The two ways a run ends, and the board they both show.
//
// THE RULE, from GOBALANCE_APP_INTEGRATION.md and not negotiable:
//
//   Every way a run can end, ends the same way: bank the score, then show the
//   board. No exceptions for the endings that feel like they don't count.
//
// This game has two -- died, and quit mid-run -- and they differ in exactly
// three things: the headline, whether a clock runs, and which screen's ids are
// used. Everything else is shared, which is why it lives in one file: two
// copies of "submit then fetch then render" is how one of them quietly stops
// submitting.
//
// THE SCORE COUNTS EVEN WHEN THE PLAYER QUIT. This was a direct instruction and
// it is the one most likely to be got wrong: a board that only records deaths
// punishes stopping, and teaches a child to stand still and die on purpose
// rather than press the button that means "I'm done". So the quit path submits
// on the way IN to the screen, not on the way out -- the player may leave to the
// lobby from there and the page is simply gone.
//
// WHY THE QUIT SCREEN HAS ITS OWN IDS: the host synth-clicks #restart-button
// whenever an element with the id #gameover-overlay is visible. A quit screen
// built out of those would fire a restart behind its own buttons.

import { submitRun, fetchBoard, resultSections, scoreboardAvailable } from '../systems/scoreboard.js';
import { identityFor } from '../data/avatars.js';

/** Render rows into an <ol>. Shared by both boards so they cannot diverge. */
function renderRows(ol, sections, justScored) {
  ol.innerHTML = '';
  const add = (row, isGap) => {
    const li = document.createElement('li');
    li.className = 'board-row' + (row.isYou ? ' is-you' : '') + (isGap ? ' is-gap' : '');

    const rank = document.createElement('span');
    rank.className = 'board-rank';
    // The row's TRUE rank in the full list, assigned once in scoreboard.js and
    // never recomputed here. A window showing rows 34-38 has to say 34-38; a
    // section renumbering itself 1..5 would quietly claim a top-five finish.
    rank.textContent = row.rank;

    // Identity is DERIVED, never mirrored from the app's art -- the page cannot
    // reach it, and a copy would go stale the day the app redraws an avatar.
    const id = identityFor(row);
    const dot = document.createElement('span');
    dot.className = 'board-dot';
    dot.style.background = id.color;
    dot.textContent = id.initial;

    const name = document.createElement('span');
    name.className = 'board-name';
    name.textContent = row.name || 'Player';

    const score = document.createElement('span');
    score.className = 'board-score';
    score.textContent = row.score;

    li.append(rank, dot, name, score);
    ol.appendChild(li);
  };

  sections.top.forEach((r) => add(r, false));
  // The window around the run just played, only when it is not already in the
  // leaders. Repeating one row twice on a short screen reads as a fault.
  if (sections.window.length) {
    const sep = document.createElement('li');
    sep.className = 'board-sep';
    sep.textContent = '···';
    ol.appendChild(sep);
    sections.window.forEach((r) => add(r, true));
  }
  void justScored;
}

/**
 * Bank the run and paint a board into the given elements.
 *
 * Resolves either way: a failed submit or an absent SDK must never stop the
 * screen appearing. Outside the app there is no board at all and the section
 * stays hidden -- which is also how the game stays playable at a plain URL.
 */
async function bankAndRender(score, { wrap, title, rows }) {
  if (!scoreboardAvailable()) {
    if (wrap) wrap.classList.add('hidden');
    return;
  }
  await submitRun(score);
  const board = await fetchBoard();
  if (!board.available || !board.rows.length) {
    if (wrap) wrap.classList.add('hidden');
    return;
  }
  // `complete: false` means only this device could be read -- offline, or nobody
  // signed in. Labelling that as the whole family would be a lie the player
  // cannot check.
  if (title) title.textContent = board.complete ? 'BEST RUNS' : 'BEST ON THIS DEVICE';
  renderRows(rows, resultSections(board.rows, score), score);
  if (wrap) wrap.classList.remove('hidden');
}

export function createEndings(doc, { getScore, getStatsLine, restart, leave, onStay }) {
  const els = (id) => doc.getElementById(id);

  const gameover = els('gameover-overlay');
  const confirm = els('confirm-overlay');
  const quit = els('quit-overlay');

  let confirmOpen = false;
  let quitOpen = false;

  /** DIED. The host's Space/Enter synth-click restarts from here, which is why
   *  this screen keeps the reserved ids and the quit screen does not. */
  function showDeath() {
    const stats = els('gameover-stats');
    if (stats) stats.textContent = getStatsLine();
    gameover.classList.remove('hidden');
    bankAndRender(getScore(), {
      wrap: els('scoreboard'), title: els('scoreboard-title'), rows: els('scoreboard-rows'),
    });
  }

  function hideDeath() {
    gameover.classList.add('hidden');
  }

  /** QUIT. Banked on the way IN: the player may leave to the lobby from this
   *  screen and the page is gone. No timer -- they chose to stop. */
  function showQuitBoard() {
    confirm.classList.add('hidden');
    confirmOpen = false;
    quitOpen = true;
    const stats = els('quit-stats');
    if (stats) stats.textContent = getStatsLine();
    quit.classList.remove('hidden');
    bankAndRender(getScore(), {
      wrap: els('quit-scoreboard'), title: els('quit-scoreboard-title'),
      rows: els('quit-scoreboard-rows'),
    });
  }

  function hideQuitBoard() {
    quit.classList.add('hidden');
    quitOpen = false;
  }

  function openConfirm() {
    confirm.classList.remove('hidden');
    confirmOpen = true;
  }

  function closeConfirm() {
    confirm.classList.add('hidden');
    confirmOpen = false;
  }

  els('confirm-stay')?.addEventListener('click', (e) => { e.stopPropagation(); onStay(); });
  els('confirm-quit')?.addEventListener('click', (e) => { e.stopPropagation(); showQuitBoard(); });
  els('quit-again')?.addEventListener('click', (e) => { e.stopPropagation(); hideQuitBoard(); restart(); });
  els('quit-leave')?.addEventListener('click', (e) => { e.stopPropagation(); leave(); });

  return {
    showDeath,
    showQuitBoard,
    hideDeath,
    openConfirm,
    closeConfirm,
    hideQuitBoard,
    isConfirmOpen: () => confirmOpen,
    isQuitOpen: () => quitOpen,
  };
}
