// THE SHIP IS THE COLOUR THE LOBBY SAID IT WAS.
//
// The app assigns every seat a colour when the boards pair -- red, teal,
// purple, orange, in that order -- and shows it to the child next to their
// name before the game launches. The pods used to be painted from a table of
// our own (gold, green, pink), so a child who had just been told "you are
// teal" flew a gold ship. Elad, 19 Oct: the spaceships should take the colour
// coming from the multiplayer.
//
// The four colours below are read off the app's own multiplayerPopup.prefab,
// not invented here.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { seatTint, __setRoster } = await import('../src/systems/roster.js');

/** MultiplayerManagerUI.playersColors, in order, as the bridge sends them. */
const LOBBY = ['#f65e5e', '#00c9d1', '#ca47fa', '#ff8c00'];

function seatRoster(n) {
  return Array.from({ length: n }, (_, i) => ({
    index: i, name: 'P' + (i + 1), color: LOBBY[i], isMain: i === 0,
  }));
}

test('FOUR SEATS take the four lobby colours, in the lobby order', () => {
  __setRoster(seatRoster(4));
  assert.equal(seatTint(0).hull, 0xf65e5e, 'seat 1 is red');
  assert.equal(seatTint(1).hull, 0x00c9d1, 'seat 2 is teal');
  assert.equal(seatTint(2).hull, 0xca47fa, 'seat 3 is purple');
  assert.equal(seatTint(3).hull, 0xff8c00, 'seat 4 is orange');
});

test('the thruster is the hull darkened, not a second lookup', () => {
  __setRoster(seatRoster(2));
  const { hull, flame } = seatTint(1);
  for (const shift of [16, 8, 0]) {
    const h = (hull >> shift) & 0xff;
    const f = (flame >> shift) & 0xff;
    assert.equal(f, Math.round(h * 0.85));
    assert.ok(f <= h, 'never brighter than the hull it belongs to');
  }
});

test('SINGLE PLAYER IS UNTOUCHED: no roster, no tint, the familiar ship', () => {
  // liveRoster returns nothing when multiplayer is false, so nothing is
  // cached and the renderer falls through to POD.seatTints as it always did.
  __setRoster(null);
  assert.equal(seatTint(0), null);
});

test('a seat the roster does not cover keeps its own tint', () => {
  __setRoster(seatRoster(2));
  assert.equal(seatTint(2), null, 'two boards paired, nothing to say about seat 3');
});

test('a malformed colour is declined rather than parsed into something', () => {
  for (const color of ['', 'red', '#12345', '#gggggg', null]) {
    __setRoster([{ index: 0, name: 'P1', color, isMain: true }]);
    assert.equal(seatTint(0), null, `refused: ${JSON.stringify(color)}`);
  }
});

test('black is a colour, and must not be mistaken for absent', () => {
  // 0x000000 is falsy as a number. The guard is on the STRING for this reason.
  __setRoster([{ index: 0, name: 'P1', color: '#000000', isMain: true }]);
  assert.deepEqual(seatTint(0), { hull: 0, flame: 0 });
});

test('THE WRITTEN-DOWN TABLE IS THE LOBBY TABLE, for the dev URL', async () => {
  // No bridge at a dev URL, so the pods are painted from POD.seatTints. It
  // used to be blue/gold/green/pink, so the game looked like one thing on a
  // desk and another on a device. Elad, 20 Oct, looking at a four-player dev
  // URL: "player one should use red color. player two teal".
  const { POD } = await import('../src/data/tuning.js');
  assert.deepEqual(POD.seatTints, LOBBY.map((h) => parseInt(h.slice(1), 16)));
});

test('the fallback and the live colour go through ONE thruster rule', async () => {
  const { thrusterFor } = await import('../src/systems/roster.js');
  __setRoster(seatRoster(4));
  for (let slot = 0; slot < 4; slot++) {
    assert.equal(seatTint(slot).flame, thrusterFor(seatTint(slot).hull),
      'a live seat and a written-down one must darken identically');
  }
});
