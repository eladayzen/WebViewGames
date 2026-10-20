// THE SHAPE THE APP ACTUALLY PUBLISHES THE ROSTER IN.
//
// Written on 18 Oct, from a photograph of a real two-board run that still read
// "PLAYER 1 + PLAYER 2" three days after the app started sending profile names.
//
// The bug was ours and it was one word. systems/roster.js asked
// `typeof GoBalance.players === 'function'` before reading anything, because
// that is the shape systems/gbSdk.js installs. But gbSdk.js installs its shim
// ONLY when `window.GoBalance` is absent, and inside the app it never is: the
// host serves its own SDK and injects it as the first script in <head>. There,
// `players` is an ARRAY and `getPlayers()` is the function. So the guard was
// false on every device, the roster was never read once, and every seat fell
// back to its number -- which is exactly what both the name AND the colour on
// that screenshot were.
//
// Two shapes, both real, both tested here. Nothing in this file mocks a shape
// that does not exist somewhere in the stack -- that is what let the bug live.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { seatIdentity, refreshRoster, __setRoster } = await import('../src/systems/roster.js');

/** The app's own SDK, as GoBalanceWebSdk.txt builds it. */
function hostSdk(players, multiplayer = true) {
  const api = {
    multiplayer,
    players,
    getPlayers: () => api.players,
    load: () => Promise.resolve(null),
    save: () => {},
  };
  globalThis.window = { GoBalance: api, addEventListener() {} };
  return api;
}

test('THE HOST SDK ARRAY IS READ: names and colours reach the seats', async () => {
  __setRoster(null);
  hostSdk([
    { index: 0, name: 'Noa', color: '#ff5577', isMain: true, x: 0, y: 0 },
    { index: 1, name: 'Itai', color: '#55ddff', isMain: false, x: 0, y: 0 },
  ]);
  await refreshRoster();

  assert.equal(seatIdentity(0).name, 'Noa');
  assert.equal(seatIdentity(1).name, 'Itai');
  assert.equal(seatIdentity(0).color, '#ff5577', "the lobby's colour, not the pod tint");
  assert.equal(seatIdentity(1).initial, 'I');
  assert.equal(seatIdentity(0).named, true);
});

test('getPlayers() IS PREFERRED, and its return value is what gets read', async () => {
  __setRoster(null);
  const api = hostSdk([{ index: 0, name: 'stale', isMain: true }]);
  // getPlayers() returns the live array; the host mutates it in place on a
  // roster change rather than replacing it, so a stale reference must not win.
  api.players.length = 0;
  api.players.push({ index: 0, name: 'Noa', isMain: true }, { index: 1, name: 'Itai' });
  await refreshRoster();
  assert.equal(seatIdentity(1).name, 'Itai');
});

test("THE SDK'S ONE-SEAT PLACEHOLDER IS NOT AN ANSWER", async () => {
  __setRoster(null);
  // What `GoBalance.players` holds before the host has replied. `#ffffff` is a
  // real colour and would paint seat 0's dot white, so it must not be cached.
  hostSdk([{ index: 0, name: '', color: '#ffffff', isMain: true, x: 0, y: 0 }], false);
  const got = await refreshRoster();

  assert.equal(got, null, 'multiplayer is still false: no roster has arrived');
  // Seat 0 falls back to POD.seatTints, which IS the lobby's red -- not to the
  // placeholder's #ffffff, which is the whole point of the gate.
  assert.equal(seatIdentity(0).color, '#f65e5e', 'the written-down lobby colour, not white');
  assert.equal(seatIdentity(0).name, 'PLAYER 1');
  assert.equal(seatIdentity(0).named, false, 'so the end screen still waits for it');
});

test('a single-player roster is ignored for the same reason', async () => {
  __setRoster(null);
  hostSdk([{ index: 0, name: 'Noa', color: '#ff5577', isMain: true }], false);
  assert.equal(await refreshRoster(), null);
});

test('THE gbSdk.js SHIM SHAPE still works: players() as a function', async () => {
  __setRoster(null);
  // Installed only where the host SDK is absent, which is the one place this
  // file's old guard was right. It has no `multiplayer` flag.
  globalThis.window = {
    addEventListener() {},
    GoBalance: {
      players: () => Promise.resolve({
        multiplayer: true,
        players: [{ index: 0, name: 'Noa', isMain: true }, { index: 1, name: 'Itai' }],
      }),
    },
  };
  await refreshRoster();
  assert.equal(seatIdentity(0).name, 'Noa');
  assert.equal(seatIdentity(1).name, 'Itai');
});

test('a host that throws out of getPlayers is survived', async () => {
  __setRoster(null);
  globalThis.window = {
    addEventListener() {},
    GoBalance: { multiplayer: true, getPlayers() { throw new Error('bridge down'); } },
  };
  assert.equal(await refreshRoster(), null);
  assert.equal(seatIdentity(0).name, 'PLAYER 1');
});

test('NO SDK AT ALL: the dev URL is unchanged', async () => {
  __setRoster(null);
  globalThis.window = { addEventListener() {} };
  assert.equal(await refreshRoster(), null);
  assert.equal(seatIdentity(1).name, 'PLAYER 2');
  assert.equal(seatIdentity(1).initial, '2');
});
