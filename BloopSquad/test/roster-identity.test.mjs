// Who a seat belongs to, as the result screen shows it.
//
// Written after the first real two-board device run (15 Oct), where both seats
// came back as "PLAYER 1" / "PLAYER 2". That turned out to be OUR fallback
// firing because the bridge was sending empty roster names — the app is fixing
// that to send profile names. But the fix brings a second case with it: when a
// seat has no profile picked, the app sends the SEAT LABEL ("Player 2") as a
// real name. Both seats then have a name, both names begin with P, and the two
// badges beside the two rows become identical — which is the single thing the
// badge exists to prevent.
//
// So the rule under test is: the badge shows a seat NUMBER whenever the name is
// a generic label, whichever side produced it, and a real name keeps its real
// initial.

import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };

const { seatIdentity, __setRoster } = await import('../src/systems/roster.js');

test('real profile names keep their own initials', () => {
  __setRoster([
    { index: 0, name: 'Ada', color: '#ff0000', isMain: true },
    { index: 1, name: 'Ben', color: '#00ff00' },
  ]);
  assert.equal(seatIdentity(0).name, 'Ada');
  assert.equal(seatIdentity(0).initial, 'A');
  assert.equal(seatIdentity(1).initial, 'B');
  assert.equal(seatIdentity(0).named, true);
});

test('TWO REAL NAMES SHARING A FIRST LETTER still both show it', () => {
  // Not our problem to solve: the colour dot already separates them, and
  // replacing a real initial with a digit would be worse than the collision.
  __setRoster([
    { index: 0, name: 'Sam', isMain: true },
    { index: 1, name: 'Sara' },
  ]);
  assert.equal(seatIdentity(0).initial, 'S');
  assert.equal(seatIdentity(1).initial, 'S');
});

test("THE APP'S OWN SEAT LABEL does not produce two P badges", () => {
  // What the bridge sends when a seat has no profile picked.
  __setRoster([
    { index: 0, name: 'Player 1', isMain: true },
    { index: 1, name: 'Player 2' },
  ]);
  assert.equal(seatIdentity(0).initial, '1');
  assert.equal(seatIdentity(1).initial, '2');
  assert.notEqual(seatIdentity(0).initial, seatIdentity(1).initial);
});

test('our own fallback, when the roster says nothing at all', () => {
  __setRoster(null);
  assert.equal(seatIdentity(0).name, 'PLAYER 1');
  assert.equal(seatIdentity(1).name, 'PLAYER 2');
  assert.equal(seatIdentity(0).initial, '1');
  assert.equal(seatIdentity(1).initial, '2');
  assert.equal(seatIdentity(0).named, false, 'still worth waiting a moment for');
});

test('label matching tolerates spacing and case', () => {
  __setRoster([
    { index: 0, name: 'PLAYER1', isMain: true },
    { index: 1, name: 'player  2' },
  ]);
  assert.equal(seatIdentity(0).initial, '1');
  assert.equal(seatIdentity(1).initial, '2');
});

test('a child actually called Player keeps their P', () => {
  // The match is narrow on purpose: "player" plus digits, nothing else.
  __setRoster([{ index: 0, name: 'Player', isMain: true }]);
  assert.equal(seatIdentity(0).initial, 'P');
  assert.equal(seatIdentity(0).named, true);
});

test('a mixed run: one named profile, one unpicked seat', () => {
  __setRoster([
    { index: 0, name: 'Ada', isMain: true },
    { index: 1, name: 'Player 2' },
  ]);
  assert.equal(seatIdentity(0).initial, 'A');
  assert.equal(seatIdentity(1).initial, '2');
  // The row still shows the app's label as given — it is what the app calls
  // that seat, and inventing something different would be worse.
  assert.equal(seatIdentity(1).name, 'Player 2');
});
