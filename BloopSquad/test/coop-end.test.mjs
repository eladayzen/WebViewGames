// What the END of a two-player run has to get right.
//
// The three claims this file exists to hold, in the order they would hurt:
//
//   1. A TEAM RUN IS NEVER SUBMITTED TO THE FAMILY BOARD. This is the whole
//      feature. `submitScore` takes one number and files it under the ONE
//      signed-in profile, so a two-player score submitted there is both a false
//      record for the child it lands on and permanent damage to the board: a
//      team run outscores a solo run every time, so the solo board would become
//      unwinnable solo, forever, with no way to withdraw the entries.
//   2. A ONE-PLAYER RUN IS COMPLETELY UNCHANGED -- same submit, same board, no
//      co-op markup. Most runs are one child; a two-player feature that costs
//      them anything has lost before it starts.
//   3. The team board MERGES into the save blob rather than replacing it. The
//      game stores nothing else today, which is exactly why a blind overwrite
//      would go unnoticed until the day it does.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── A DOM small enough to read, big enough for these screens ────────────────
function makeEl(id) {
  const el = {
    id, textContent: '', className: '', children: [],
    style: {},
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
  const doc = {
    body: makeEl('body'),
    getElementById: (id) => {
      if (!byId.has(id)) byId.set(id, makeEl(id));
      return byId.get(id);
    },
    createElement: () => makeEl(''),
  };
  return doc;
}

function pods(n) {
  return Array.from({ length: n }, (_, i) => ({
    slot: i, popped: 10 + i, coins: 5 + i, points: 100 + i, alive: true,
  }));
}

/** A host SDK that records what the game asked of it. */
function installHost({ blob = null } = {}) {
  const calls = { submitted: [], saved: [] };
  globalThis.window = {
    GoBalance: {
      submitScore: (v) => { calls.submitted.push(v); return Promise.resolve(true); },
      getScoreboard: () => Promise.resolve({ complete: true, entries: [
        { name: 'Noa', score: 900, profileId: 'p1', avatarIndex: 0 },
        { name: 'You', score: 400, profileId: 'p2', avatarIndex: 1, isYou: true },
      ] }),
      load: () => Promise.resolve(blob),
      save: (b) => { calls.saved.push(b); return Promise.resolve(true); },
      players: () => Promise.resolve([
        { index: 0, name: 'Noa', color: '#36c09e', isMain: true },
        { index: 1, name: 'Yuval', color: '#fee44f' },
      ]),
    },
  };
  globalThis.document = makeDoc();
  return calls;
}

const load = async () => {
  const m = await import('../src/ui/endings.js?' + Math.random());
  return m;
};

test('CO-OP NEVER SUBMITS TO THE FAMILY BOARD', async () => {
  const calls = installHost();
  const { createEndings } = await load();
  const e = createEndings(document, {
    getScore: () => 5000, getStatsLine: () => '5000 points',
    restart() {}, leave() {}, onStay() {},
    getPods: () => pods(2), getLevel: () => 7,
  });
  e.showDeath();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls.submitted, [], 'a two-player run must not reach submitScore');
  // ...and it is not merely dropped: it went to the team board instead.
  assert.equal(calls.saved.length, 1, 'the team run was banked somewhere');
  assert.equal(calls.saved[0].coopRuns[0].score, 5000);
  assert.deepEqual(calls.saved[0].coopRuns[0].names, ['Noa', 'Yuval']);
});

test('ONE PLAYER IS UNCHANGED: it still submits, and shows no co-op markup', async () => {
  const calls = installHost();
  const { createEndings } = await load();
  const e = createEndings(document, {
    getScore: () => 400, getStatsLine: () => '400 points',
    restart() {}, leave() {}, onStay() {},
    getPods: () => pods(1), getLevel: () => 3,
  });
  e.showDeath();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls.submitted, [400], 'a solo run still goes to the family board');
  assert.equal(calls.saved.length, 0, 'and writes no team board');
  assert.ok(document.getElementById('coop-players')._classes.has('hidden'));
  assert.ok(document.getElementById('scoreboard-note')._classes.has('hidden'));
  assert.equal(document.body._classes.has('is-coop'), false);
});

test('the team board MERGES into the save blob, never replaces it', async () => {
  const calls = installHost({ blob: { somethingElse: { keep: 1 }, coopRuns: [{ score: 9000, at: 1 }] } });
  const { createEndings } = await load();
  const e = createEndings(document, {
    getScore: () => 100, getStatsLine: () => '',
    restart() {}, leave() {}, onStay() {},
    getPods: () => pods(2), getLevel: () => 1,
  });
  e.showDeath();
  await new Promise((r) => setTimeout(r, 0));
  const saved = calls.saved[0];
  assert.deepEqual(saved.somethingElse, { keep: 1 }, 'another key in the blob survives');
  // Ranked descending, and the older better run keeps the top row.
  assert.equal(saved.coopRuns.length, 2);
  assert.equal(saved.coopRuns[0].score, 9000);
  assert.equal(saved.coopRuns[1].score, 100);
  // The stored rows carry no `rank`: it is positional and recomputed on read,
  // so storing it would go stale the first time a better run is added.
  assert.ok(!('rank' in saved.coopRuns[0]));
});

test('no SDK at all: the screen still renders and nothing throws', async () => {
  globalThis.window = {};
  globalThis.document = makeDoc();
  const { createEndings } = await load();
  const e = createEndings(document, {
    getScore: () => 1200, getStatsLine: () => '',
    restart() {}, leave() {}, onStay() {},
    getPods: () => pods(2), getLevel: () => 2,
  });
  e.showDeath();
  await new Promise((r) => setTimeout(r, 0));
  // The run is ranked against an empty board rather than vanishing -- which is
  // what makes this screen reviewable in a browser, where there is no SDK.
  const note = document.getElementById('scoreboard-note');
  assert.match(note.textContent, /not saved/, 'and says so, rather than implying it was kept');
  assert.equal(document.getElementById('scoreboard')._classes.has('hidden'), false);
});
