// Do real profile names reach the screen, AND the saved row, AND the board?
//
// Asked on 18 Oct, because the device still showed "Player 1 / Player 2" and
// nobody could say whether the names were being saved and not shown, or never
// captured at all. Reading the code answers it; this file proves it and keeps
// proving it.
//
// The chain, end to end:
//
//   roster (what the app told us)
//     -> the two rows at the top of the result screen   [shown]
//     -> the `names` stored with the team run           [saved]
//     -> the team board, rendered from STORED names     [shown again, later]
//
// The last link is the one worth guarding. A board that re-derived names from
// today's roster would relabel old runs with whoever happens to be connected
// now, and the roster index shifts between runs, so there is nothing to re-key
// an old row against. Stored names are the only ones that stay true.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeEl(id) {
  const el = {
    id, textContent: '', className: '', children: [], style: {},
    _classes: new Set(),
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      toggle: (c, on) => (on ? el._classes.add(c) : el._classes.delete(c)),
      contains: (c) => el._classes.has(c),
    },
    set innerHTML(_) { el.children.length = 0; },
    get innerHTML() { return ''; },
    appendChild: (c) => { el.children.push(c); return c; },
    append: (...cs) => el.children.push(...cs),
    addEventListener() {},
  };
  return el;
}

function makeDoc() {
  const byId = new Map();
  return {
    body: makeEl('body'),
    getElementById: (id) => {
      if (!byId.has(id)) byId.set(id, makeEl(id));
      return byId.get(id);
    },
    createElement: () => makeEl(''),
  };
}

/** Every bit of text under an element, in document order. */
function textOf(el) {
  const out = [];
  const walk = (n) => {
    if (n.textContent) out.push(String(n.textContent));
    (n.children || []).forEach(walk);
  };
  (el.children || []).forEach(walk);
  return out;
}

const pods = [
  { slot: 0, popped: 17, coins: 4, points: 170, alive: true },
  { slot: 1, popped: 14, coins: 6, points: 110, alive: true },
];

/**
 * @param roster what the bridge publishes for this run
 *
 * The roster cache in systems/roster.js is module-level and lives as long as
 * the PAGE does, which is one game launch — so it is deliberately not reset by
 * re-importing endings.js. Each test clears it by hand, both for isolation and
 * because writing it down is the only record of how long a cached name lives.
 */
async function installHost(roster, blob = null) {
  const saved = [];
  globalThis.window = {
    addEventListener() {},
    GoBalance: {
      submitScore: () => Promise.resolve(true),
      getScoreboard: () => Promise.resolve({ complete: true, entries: [] }),
      load: () => Promise.resolve(blob),
      save: (b) => { saved.push(b); return Promise.resolve(true); },
      players: () => Promise.resolve(roster),
    },
  };
  globalThis.document = makeDoc();
  const { __setRoster } = await import('../src/systems/roster.js');
  __setRoster(null);
  return saved;
}

async function playACoopRun() {
  // Cache-busted so each test gets a fresh roster cache as well as a fresh DOM.
  const { createEndings } = await import('../src/ui/endings.js?' + Math.random());
  const e = createEndings(document, {
    getScore: () => 280, getStatsLine: () => '280 points',
    restart() {}, leave() {}, onStay() {},
    getPods: () => pods, getLevel: () => 4,
  });
  e.showDeath();
  // Long enough for the bounded roster wait and the save to settle.
  await new Promise((r) => setTimeout(r, 500));
}

test('REAL PROFILE NAMES reach the screen, the saved row and the board', async () => {
  // Exactly what the bridge sends from gobalance 724e279c onwards.
  const saved = await installHost([
    { index: 0, name: 'Ada', color: '#ff5577', isMain: true },
    { index: 1, name: 'Ben', color: '#55ddff' },
  ]);
  await playACoopRun();

  // SHOWN: the two per-player rows at the top of the card.
  const top = textOf(document.getElementById('coop-players'));
  assert.ok(top.includes('Ada'), 'seat 0 shows its profile name');
  assert.ok(top.includes('Ben'), 'seat 1 shows its profile name');
  assert.ok(!top.some((t) => /^PLAYER \d+$/.test(t)), 'no fallback label anywhere');

  // SAVED: stored with the run, not derived at read time.
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].coopRuns[0].names, ['Ada', 'Ben']);

  // SHOWN AGAIN: the board row is built from those stored names.
  assert.ok(textOf(document.getElementById('scoreboard-rows')).includes('Ada + Ben'));
});

test('AN OLD ROW KEEPS ITS OLD NAMES when a later run has real ones', async () => {
  // The rows saved before the app sent names. They must never be relabelled.
  const saved = await installHost(
    [{ index: 0, name: 'Ada', isMain: true }, { index: 1, name: 'Ben' }],
    { coopRuns: [{ score: 9000, popped: 50, level: 6, seats: 2, names: ['PLAYER 1', 'PLAYER 2'], at: 1 }] },
  );
  await playACoopRun();

  const board = textOf(document.getElementById('scoreboard-rows'));
  assert.ok(board.includes('PLAYER 1 + PLAYER 2'), 'the old row is untouched on screen');
  assert.ok(board.includes('Ada + Ben'), 'the new row carries the real names');

  const old = saved[0].coopRuns.find((r) => r.score === 9000);
  assert.deepEqual(old.names, ['PLAYER 1', 'PLAYER 2'], 'and on disk too');
});

test("A SEAT WITH NO PROFILE shows the app's own label, and saves it", async () => {
  // What is still seen if nobody picks a profile for the second board. Not a
  // bug in the game: "Player 2" is what the app calls that seat.
  const saved = await installHost([
    { index: 0, name: 'Ada', isMain: true },
    { index: 1, name: 'Player 2' },
  ]);
  await playACoopRun();

  assert.deepEqual(saved[0].coopRuns[0].names, ['Ada', 'Player 2']);

  // The two badges must still differ, or the rows are unreadable side by side.
  const { seatIdentity } = await import('../src/systems/roster.js');
  assert.notEqual(seatIdentity(0).initial, seatIdentity(1).initial);
});
