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
import { recordTeamRun } from '../systems/teamBoard.js';
import { identityFor } from '../data/avatars.js';
import { seatIdentity, refreshRoster } from '../systems/roster.js';

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
 * ONE LINE PER CHILD: their name, their pod's colour, and what they were part
 * of.
 *
 * WHAT THIS IS CAREFUL NOT TO BE. It is not a split of the score and it is not
 * a ranking. The numbers are deliberately NOT sorted, NOT totalled and NOT
 * compared -- seats appear in seat order, always, so the same child is always
 * on the same line and nobody is ever shown as the winner. Co-op shares one
 * score and one pool of hearts precisely so that two siblings are on the same
 * side; a result screen that quietly declared one of them better would undo
 * that in the last five seconds of the run.
 *
 * It is also an approximation, and knowing why matters before anyone tunes it:
 * only cannon kills carry a true firer. Bombs, punches and the beam are
 * credited to the nearest pod -- see popMonster in systems/play.js. Close
 * together, that is near enough a coin toss. Which is the other reason these
 * are never ranked.
 */
function renderCoopPlayers(el, pods) {
  if (!el) return;
  el.innerHTML = '';
  const isCoop = !!(pods && pods.length > 1);
  // The card cannot scroll (see style.css), so a co-op screen two rows taller
  // has to take that space out of the board rather than off the bottom of the
  // phone. A class on <body> is how the stylesheet is told which it is.
  if (typeof document !== 'undefined') document.body.classList.toggle('is-coop', isCoop);
  if (!isCoop) {
    el.classList.add('hidden');
    return;
  }
  for (const pod of pods) {
    const id = seatIdentity(pod.slot);
    const row = document.createElement('div');
    row.className = 'coop-player';

    const dot = document.createElement('span');
    dot.className = 'coop-dot';
    // The pod's own colour, so a child can match the row to the ship they were
    // flying. seatIdentity falls back to POD.seatTints for exactly this.
    dot.style.background = id.color;
    dot.textContent = id.initial;

    const name = document.createElement('span');
    name.className = 'coop-name';
    name.textContent = id.name;

    const did = document.createElement('span');
    did.className = 'coop-did';
    // "popped" and "coins", not "points": points would read as a score, and a
    // score invites the comparison this screen is built to avoid.
    did.textContent = `${pod.popped} popped · ${pod.coins} coins`;

    row.append(dot, name, did);
    el.appendChild(row);
  }
  el.classList.remove('hidden');
}

/** The team board. Same <ol> as the family board, different rows. */
function renderTeamRows(ol, rows) {
  ol.innerHTML = '';
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = 'board-row' + (r.isRun ? ' is-you' : '');

    const rank = document.createElement('span');
    rank.className = 'board-rank';
    rank.textContent = r.rank;

    const dot = document.createElement('span');
    dot.className = 'board-dot board-dot-team';
    // Two pods, one row: the glyph says "a team" rather than naming one child.
    dot.textContent = '\u25C6';

    const name = document.createElement('span');
    name.className = 'board-name';
    // The names as they were WHEN THAT RUN WAS PLAYED, stored with the row.
    // Re-deriving them from today's roster would relabel old runs with whoever
    // happens to be connected now -- and the roster index shifts anyway
    // (BAL-597 item 6), so stored names are the only ones that stay true.
    name.textContent = r.names && r.names.length ? r.names.join(' + ') : `${r.seats} players`;

    const score = document.createElement('span');
    score.className = 'board-score';
    score.textContent = r.score;

    li.append(rank, dot, name, score);
    ol.appendChild(li);
  }
}

/**
 * A co-op ending: the two children, then the team board.
 *
 * THE RUN IS NOT SUBMITTED TO THE FAMILY BOARD. The reasoning is in
 * systems/teamBoard.js and it is the substance of this whole feature, not an
 * implementation detail -- the short version is that the SDK can only attribute
 * a score to one profile, and a team score filed under one child's name is both
 * a false record and the end of that board as a solo ranking.
 */
async function renderCoop(score, pods, level, { wrap, title, rows, note, players }) {
  // ONE LAST ASK FOR THE NAMES, BOUNDED.
  //
  // The names are normally already cached: systems/roster.js polls for them
  // during the run precisely so this screen is right the first time it paints.
  // But a run can end before the host has answered, and the names stored with a
  // team run are PERMANENT -- an old row cannot be relabelled later, because the
  // roster index shifts and there is no stable seat id to re-key on (BAL-597
  // item 6). So an unnamed seat is worth a short wait here and nowhere else.
  //
  // Raced against a timer rather than simply awaited: the bridge's own request
  // timeout is five seconds, and a result screen with a five-second hole in it
  // would be a far worse bug than "PLAYER 2".
  if (pods.some((p) => !seatIdentity(p.slot).named)) {
    await Promise.race([
      refreshRoster(),
      new Promise((r) => setTimeout(r, 400)),
    ]);
  }
  renderCoopPlayers(players, pods);

  const popped = pods.reduce((n, p) => n + (p.popped || 0), 0);
  const board = await recordTeamRun({
    score, popped, level, seats: pods.length,
    names: pods.map((p) => seatIdentity(p.slot).name),
  });

  if (title) title.textContent = 'BEST TEAM RUNS';
  if (note) {
    // Said plainly, because the alternative is a child wondering why a good run
    // is not on the board they know.
    note.textContent = board.stored
      ? 'Playing together has its own board.'
      : 'Playing together has its own board — this one is not saved.';
    note.classList.remove('hidden');
  }
  renderTeamRows(rows, board.rows);
  if (wrap) wrap.classList.remove('hidden');
}

/**
 * Bank the run and paint a board into the given elements.
 *
 * Resolves either way: a failed submit or an absent SDK must never stop the
 * screen appearing. Outside the app there is no board at all and the section
 * stays hidden -- which is also how the game stays playable at a plain URL.
 */
async function bankAndRender(score, els, pods, level) {
  const { wrap, title, rows, note, players } = els;

  // CO-OP TAKES A DIFFERENT ROUTE ENTIRELY: its own board, and no submitScore.
  // Branched here, before the family board is even looked at, so there is no
  // path on which a team run reaches `submitRun`.
  if (pods && pods.length > 1) {
    await renderCoop(score, pods, level, els);
    return;
  }
  renderCoopPlayers(players, null);
  if (note) note.classList.add('hidden');

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

/**
 * Render fake rows, for layout checking only.
 *
 * The board is the ONE element that never appears outside the app -- there is no
 * SDK at a dev URL, so `scoreboardAvailable()` is false and the section stays
 * hidden. That means every screenshot of these screens so far has been of the
 * SHORT version, and the tall one -- the only one that can overflow a phone --
 * had never been looked at. Hence a hook.
 */
export function fakeBoard(doc, n = 8, pods = null) {
  // CO-OP HAS ITS OWN VERSION OF THIS PROBLEM, and a worse one: the team board
  // additionally needs a SAVED BLOB, so even inside the app a first co-op run
  // shows a board of exactly one row. `?rows=` with `?players=2` is the only
  // way to see the tall version of the screen that two children will actually
  // produce after an evening of playing.
  if (pods && pods.length > 1) {
    const names = ['Noa', 'Amit', 'Yuval', 'Alexandra-Rose'];
    // Seeded only when the real pods are empty, which is every use of this hook
    // -- it is meant to be opened on a fresh page, not after a run. Uneven on
    // purpose: two identical lines would hide a layout that cannot take two
    // different ones.
    const shown = pods.every((p) => !p.popped)
      ? pods.map((p, i) => ({ ...p, popped: 148 - i * 37, coins: 96 - i * 29 }))
      : pods;
    const team = Array.from({ length: n }, (_, i) => ({
      rank: i + 1,
      score: 6400 - i * 520,
      seats: 2,
      // Varied per row, and one of them deliberately long: the rows are the
      // only place two names share a line, so they are where a name too long
      // for the card shows up.
      names: pods.map((p) => names[(p.slot + i) % names.length]),
      at: i,
      isRun: i === 2,
    }));
    for (const [wrapId, titleId, rowsId, noteId, playersId] of [
      ['scoreboard', 'scoreboard-title', 'scoreboard-rows', 'scoreboard-note', 'coop-players'],
      ['quit-scoreboard', 'quit-scoreboard-title', 'quit-scoreboard-rows',
       'quit-scoreboard-note', 'quit-coop-players'],
    ]) {
      const wrap = doc.getElementById(wrapId);
      const rowsEl = doc.getElementById(rowsId);
      if (!wrap || !rowsEl) continue;
      renderCoopPlayers(doc.getElementById(playersId), shown);
      doc.getElementById(titleId).textContent = 'BEST TEAM RUNS';
      const note = doc.getElementById(noteId);
      if (note) { note.textContent = 'Playing together has its own board.'; note.classList.remove('hidden'); }
      renderTeamRows(rowsEl, team);
      wrap.classList.remove('hidden');
    }
    return;
  }

  const rows = Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    name: ['Noa', 'Amit', 'Yuval', 'Daniel', 'Maya', 'Eitan', 'Tamar', 'Omer'][i % 8],
    score: 4200 - i * 430,
    profileId: 'p' + i,
    avatarIndex: i,
    isYou: i === 3,
  }));
  for (const [wrapId, titleId, rowsId] of [
    ['scoreboard', 'scoreboard-title', 'scoreboard-rows'],
    ['quit-scoreboard', 'quit-scoreboard-title', 'quit-scoreboard-rows'],
  ]) {
    const wrap = doc.getElementById(wrapId);
    const rowsEl = doc.getElementById(rowsId);
    if (!wrap || !rowsEl) continue;
    doc.getElementById(titleId).textContent = 'BEST RUNS';
    renderRows(rowsEl, { top: rows.slice(0, 5), window: rows.slice(5) }, null);
    wrap.classList.remove('hidden');
  }
}

export function createEndings(doc, {
  getScore, getStatsLine, restart, leave, onStay,
  // The pods as they stood when the run ended, and the level reached. Passed as
  // getters rather than values: createEndings is built once at boot, when a
  // run may still be one player -- the seat count can grow mid-run, because the
  // app publishes its roster after the page has loaded.
  getPods = () => [], getLevel = () => 1,
}) {
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
      note: els('scoreboard-note'), players: els('coop-players'),
    }, getPods(), getLevel());
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
      rows: els('quit-scoreboard-rows'), note: els('quit-scoreboard-note'),
      players: els('quit-coop-players'),
    }, getPods(), getLevel());
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
  // Dying and stopping leave the player in the same position, so the death
  // screen offers the same way out as the quit screen does.
  els('gameover-quit')?.addEventListener('click', (e) => { e.stopPropagation(); leave(); });
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
