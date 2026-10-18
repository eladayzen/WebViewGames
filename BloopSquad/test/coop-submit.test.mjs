// Submitting a co-op run to the platform, and — far more importantly — NOT
// submitting it to the wrong place.
//
// The failure this file exists to prevent, stated plainly:
//
//   An older app build's `submitScore` takes one argument and ignores the
//   second. Pass it `(score, {mode:'coop'})` and it does not throw, does not
//   warn, and files a two-player score on the one signed-in child's SOLO
//   board. A team run outscores a solo run every time and scores cannot be
//   withdrawn, so that child's own board is ruined permanently — on exactly
//   the devices still running the old build, which are the ones nobody tests.
//
// Hence: no probing, no arity sniffing, no optimism. The host says yes
// explicitly or the run stays in the save blob. Most of the tests below are
// different ways of saying "the host did not say yes", because that is the
// case that has to hold.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const mod = '../src/systems/teamBoard.js';

/** A host SDK that records every submitScore call. */
function hostWith(extra = {}) {
  const calls = [];
  globalThis.window = {
    GoBalance: {
      load: () => Promise.resolve(null),
      save: () => {},
      submitScore: (...args) => { calls.push(args); return Promise.resolve(true); },
      ...extra,
    },
  };
  return calls;
}

const RUN = { score: 280, popped: 31, level: 4, seats: 2, names: ['ADA', 'BEN'] };

test('NO CAPABILITY FLAG: submitScore is never called at all', async () => {
  const calls = hostWith();                      // an old host: no flag
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);
  assert.equal(calls.length, 0, 'an un-advertised host must never be handed a co-op score');
  assert.equal(res.submitted, false);
  // ...and the run is still ranked locally, so the player loses nothing.
  assert.equal(res.rows.length, 1);
  assert.equal(res.placed.score, 280);
});

test('A TRUTHY-BUT-NOT-TRUE FLAG IS NOT A YES', async () => {
  const calls = hostWith({ capabilities: { scoreModes: 1 } });
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);
  assert.equal(calls.length, 0, 'only a literal true counts, not a truthy value');
  assert.equal(res.submitted, false);
});

test('a host with capabilities but no scoreModes is still a no', async () => {
  const calls = hostWith({ capabilities: { somethingElse: true } });
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);
  assert.equal(calls.length, 0);
  assert.equal(res.submitted, false);
});

test('CAPABILITY PRESENT: submits once, with mode and seats and no identities', async () => {
  const calls = hostWith({ capabilities: { scoreModes: true } });
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);

  assert.equal(calls.length, 1, 'exactly one submission per run');
  const [value, opts] = calls[0];
  assert.equal(value, 280, 'the banked score, rounded');
  assert.equal(opts.mode, 'coop');
  assert.equal(opts.seats, 2);
  // The game must NOT invent identities: the roster it gets carries no profile
  // id, so anything here would be a guess. The bridge resolves who played.
  assert.equal('players' in opts, false, 'the game never sends identities');
  assert.equal(res.submitted, true);
});

test('the OLD flag spelling is not a yes either', async () => {
  // `supportsScoreModes` was the other name considered on BAL-605 before
  // `capabilities.scoreModes` was settled on. A build that still sets only the
  // rejected spelling has not made the promise this file needs.
  const calls = hostWith({ supportsScoreModes: true });
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);
  assert.equal(calls.length, 0);
  assert.equal(res.submitted, false);
});

test('a submit that REJECTS still produces a result screen', async () => {
  globalThis.window = {
    GoBalance: {
      load: () => Promise.resolve(null),
      save: () => {},
      capabilities: { scoreModes: true },
      submitScore: () => Promise.reject(new Error('offline')),
    },
  };
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);
  assert.equal(res.submitted, false, 'reported, not thrown');
  assert.equal(res.placed.score, 280, 'the local board is unaffected');
});

test('a submit that THROWS SYNCHRONOUSLY is also contained', async () => {
  globalThis.window = {
    GoBalance: {
      load: () => Promise.resolve(null),
      save: () => {},
      capabilities: { scoreModes: true },
      submitScore: () => { throw new Error('bridge down'); },
    },
  };
  const { recordTeamRun } = await import(mod);
  const res = await recordTeamRun(RUN);
  assert.equal(res.submitted, false);
  assert.equal(res.rows.length, 1);
});

test('NO SDK AT ALL (a plain dev URL): ranked locally, nothing submitted', async () => {
  globalThis.window = {};
  const { recordTeamRun, coopSubmitAvailable } = await import(mod);
  assert.equal(coopSubmitAvailable(), false);
  const res = await recordTeamRun(RUN);
  assert.equal(res.submitted, false);
  assert.equal(res.stored, false);
  assert.equal(res.placed.score, 280, 'the screen is still reviewable in a browser');
});

test('the blob is still merged, not replaced, when submitting is on', async () => {
  let saved = null;
  globalThis.window = {
    GoBalance: {
      load: () => Promise.resolve({ settings: { sfx: false }, coopRuns: [] }),
      save: (b) => { saved = b; },
      capabilities: { scoreModes: true },
      submitScore: () => Promise.resolve(true),
    },
  };
  const { recordTeamRun } = await import(mod);
  await recordTeamRun(RUN);
  assert.deepEqual(saved.settings, { sfx: false }, 'the rest of the blob survives');
  assert.equal(saved.coopRuns.length, 1);
  // Stored rows carry no rank: it is derived, and a stale one would be a lie.
  assert.equal('rank' in saved.coopRuns[0], false);
});
