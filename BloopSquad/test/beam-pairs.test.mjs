// THE BEAM TAKES TURNS.
//
// The ultimate joins two pods with a line that burns whatever lies across it.
// It used to be `const [a, b] = alive` -- the first two seats, every time. On
// two boards that is the only pair there is. On three or four it meant the
// same two children owned the best thing in the game for the whole run while
// the others watched. Elad, 19 Oct, once 3- and 4-board runs started landing.
//
// What is under test is the FAIRNESS of the order, not just that it changes:
//   * every pair happens once before any happens twice;
//   * every seat appears the same number of times in a full cycle;
//   * on four seats the turn changes hands completely every OTHER time, which
//     is the most K4 allows -- each pair has exactly one pair it is disjoint
//     from -- and nobody is in three turns running;
//   * two seats still behave exactly as they always did.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { beamPair, updateBeamCharge } = await import('../src/systems/play.js');

/** Just enough world for the pair queue. */
function world(seats) {
  return {
    players: Array.from({ length: seats }, (_, slot) => ({ slot, alive: true, x: slot * 10, y: 0 })),
    beamPairIdx: 0, beamCharge: 0, beamActiveT: 0, beamUses: 0,
  };
}

/** Fire the ultimate and let it burn out, which is what passes the turn. */
function fireAndFinish(w) {
  w.beamCharge = 1e9;
  updateBeamCharge(w, 0);           // lights
  while (w.beamActiveT > 0) updateBeamCharge(w, 60);
}

/** The seats the beam joins, for the next n activations. */
function turns(w, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(beamPair(w).map((p) => p.slot).sort((x, y) => x - y).join('-'));
    fireAndFinish(w);
  }
  return out;
}

test('TWO SEATS: always the same pair, exactly as before', () => {
  assert.deepEqual(turns(world(2), 4), ['0-1', '0-1', '0-1', '0-1']);
});

test('THREE SEATS: all three pairs before any repeats, then it cycles', () => {
  const t = turns(world(3), 6);
  assert.deepEqual(new Set(t.slice(0, 3)).size, 3, 'every pair once first');
  assert.deepEqual(t.slice(0, 3), t.slice(3, 6), 'and then the same round again');
  // Each seat sits out exactly one turn in three.
  for (const slot of [0, 1, 2]) {
    assert.equal(t.slice(0, 3).filter((p) => p.split('-').includes(String(slot))).length, 2);
  }
});

test('FOUR SEATS: six pairs, each once, and the handover ALTERNATES', () => {
  const t = turns(world(4), 6);
  assert.equal(new Set(t).size, 6, 'all six pairs before any repeat');
  // Every seat is in exactly three of the six.
  for (const slot of [0, 1, 2, 3]) {
    assert.equal(t.filter((p) => p.split('-').includes(String(slot))).length, 3);
  }
  // A COMPLETE HANDOVER EVERY OTHER TURN, the wrap included. Six in a row is
  // not available: each of K4's six pairs is disjoint from exactly one other,
  // so disjoint transitions cannot be chained.
  const shares = t.map((p, i) => {
    const a = p.split('-');
    const b = t[(i + 1) % t.length].split('-');
    return a.some((s) => b.includes(s));
  });
  assert.deepEqual(shares, [false, true, false, true, false, true],
    'handover, overlap, handover, ... all the way round');
});

test('FOUR SEATS: no child is in three turns running', () => {
  const t = turns(world(4), 12);
  for (let i = 2; i < t.length; i++) {
    for (const slot of ['0', '1', '2', '3']) {
      const inAll = [t[i - 2], t[i - 1], t[i]].every((p) => p.split('-').includes(slot));
      assert.equal(inAll, false, `seat ${slot} held the beam for turns ${i - 2}..${i}`);
    }
  }
});

test('NEVER THE SAME PAIR TWICE RUNNING, on any table size', () => {
  for (const seats of [3, 4]) {
    const t = turns(world(seats), 12);
    for (let i = 1; i < t.length; i++) assert.notEqual(t[i], t[i - 1], `${seats} seats, turn ${i}`);
  }
});

test('the pair is FIXED while the beam is burning', () => {
  const w = world(4);
  w.beamCharge = 1e9;
  updateBeamCharge(w, 0);
  const during = beamPair(w).map((p) => p.slot).join('-');
  updateBeamCharge(w, 0.016);
  assert.ok(w.beamActiveT > 0, 'still burning');
  assert.equal(beamPair(w).map((p) => p.slot).join('-'), during, 'it must not switch mid-beam');
});

test('A BOARD DROPPING MID-RUN does not break the queue', () => {
  const w = world(4);
  fireAndFinish(w); fireAndFinish(w); fireAndFinish(w);   // cursor is 3
  w.players.length = 3;                                    // one child steps off
  const pair = beamPair(w);
  assert.ok(pair, 'there is still a beam');
  for (const p of pair) assert.ok(p.slot < 3, 'and it only joins seats that exist');
  // ...and it still takes turns at the new table size.
  const after = turns(w, 3);
  assert.equal(new Set(after).size, 3, 'three seats, three pairs, no repeat');
});

test('ONE SEAT, or none alive: there is no beam', () => {
  assert.equal(beamPair(world(1)), null);
  const w = world(3);
  for (const p of w.players) p.alive = false;              // the hearts ran out
  assert.equal(beamPair(w), null);
});
