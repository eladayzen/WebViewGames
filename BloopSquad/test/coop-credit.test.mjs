// WHO POPPED IT. The per-seat tallies behind the co-op result screen.
//
// These numbers are decoration -- nothing in the simulation branches on them --
// but they are decoration two children will read and argue about, so the two
// properties that make them fair are worth pinning:
//
//   1. The team total is UNAFFECTED. w.stats.score and w.stats.popped stay
//      exactly what they were in a one-player run; the per-seat figures are a
//      shadow of them, never a split that could fail to add up.
//   2. A kill with a known firer goes to that firer, not to whoever is standing
//      closest. Proximity is the FALLBACK for weapons that carry no owner, and
//      the two must not be confused -- a cannon kill credited by proximity
//      would hand a sibling's work to whoever drifted nearer.

import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };

const { createWorld } = await import('../src/core/state.js');
const { popMonster, award } = await import('../src/systems/play.js');
const { makeRng } = await import('../src/core/rng.js');

function monsterAt(x, y, points = 10) {
  return { alive: true, x, y, r: 30, hp: 0, maxHp: 10, points, coins: 0, hitT: 0 };
}

test('a kill with a known firer is credited to that firer, not to the nearest pod', () => {
  const w = createWorld(2);
  const rng = makeRng(1);
  w.players[0].x = 200;
  w.players[1].x = 1700;
  // The monster is right on top of seat 1 -- but seat 0 shot it.
  popMonster(w, monsterAt(1700, 300), rng, 0);
  assert.equal(w.players[0].popped, 1, 'the pod that fired gets it');
  assert.equal(w.players[1].popped, 0, 'standing next to it is not the same as killing it');
});

test('a kill with no firer falls back to the nearest pod', () => {
  const w = createWorld(2);
  const rng = makeRng(1);
  w.players[0].x = 200;
  w.players[1].x = 1700;
  // A bomb, a punch or the beam: nothing carries an owner, so proximity decides.
  popMonster(w, monsterAt(1690, 300), rng);
  assert.equal(w.players[1].popped, 1);
  assert.equal(w.players[0].popped, 0);
});

test('THE TEAM TOTAL IS UNAFFECTED by the per-seat shadow', () => {
  const w = createWorld(2);
  const rng = makeRng(1);
  popMonster(w, monsterAt(300, 300, 25), rng, 0);
  popMonster(w, monsterAt(1600, 300, 25), rng, 1);
  assert.equal(w.stats.popped, 2, 'the team popped two');
  assert.equal(w.stats.score, 50, 'and scored for both');
  // The shadow adds up here because both kills had a firer. It is NOT asserted
  // to add up in general: proximity-credited kills are a guess, and a test that
  // demanded they reconcile would be pinning an accuracy this does not claim.
  assert.equal(w.players[0].points + w.players[1].points, 50);
});

test('ONE PLAYER: every pop still lands on the only seat, and the totals are as they always were', () => {
  const w = createWorld(1);
  const rng = makeRng(1);
  popMonster(w, monsterAt(900, 300, 15), rng);
  assert.equal(w.stats.score, 15);
  assert.equal(w.stats.popped, 1);
  assert.equal(w.players[0].popped, 1);
  assert.equal(w.players[0].points, 15);
});

test('a dev grant credits nobody, and still moves the team score', () => {
  const w = createWorld(2);
  // main.js grantXp passes no slot: it is not a thing either child did.
  award(w, 500);
  assert.equal(w.stats.score, 500);
  assert.equal(w.players[0].points, 0);
  assert.equal(w.players[1].points, 0);
});
