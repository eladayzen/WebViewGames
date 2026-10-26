// The roster is read from the HOST's shape, not from our own shim's.
//
// WHY THIS FILE EXISTS. Bloop Squad lost its multiplayer roster for weeks to a
// one-word mismatch: the app injects its OWN `window.GoBalance` as the first
// script in <head>, and that object is not the shim `gbSdk.js` installs when
// the global is absent. In the host's real SDK `getPlayers()` is the function
// and `players` is an ARRAY; the shim has `players` as a function. Bloop Squad
// read `players()`, the check was false on every device, and every seat
// silently fell back to "PLAYER 1" from the day it was written.
//
// This game ships two-player, so that is directly on its path. The tests below
// pin the real shape: `getPlayers()` is what gets called, an array-valued
// `players` is never invoked, and the single-board fallback still works for an
// older app build that publishes only `__gbSensor`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BoboHost } from '../src/shared/bobo-host/host.js';

// The browser adapter IS console.debug; keep a game's outbound traffic out of
// the test output.
console.debug = () => {};

/** A pipeline that is HONEST ABOUT ITS UNITS and does nothing else.
 *
 *  `_pushControl` converts a lean RATIO into a gravity vector before the
 *  pipeline ever sees it, so recording `push()`'s arguments and comparing them
 *  to the ratio the host was handed compares two different things -- which is
 *  how the first draft of this file produced four red tests against correct
 *  code. The stub therefore inverts that conversion and exposes `control` in
 *  the same units the game reads, with no dead zone, gamma or EMA in the way:
 *  this file is about the protocol, not about the filter.
 */
const D2R = Math.PI / 180;
function stubFactory() {
  const made = [];
  const factory = (cfg) => {
    const p = {
      cfg, pushes: [], maxAngleDeg: cfg.maxAngleDeg,
      control: { x: 0, y: 0 }, raw: { x: 0, y: 0 },
      calibrationProgress: 1, streaming: true,
      push(gx, gy, gz, t) {
        const max = this.maxAngleDeg || 12;
        const ax = Math.asin(Math.max(-1, Math.min(1, gy))) / D2R;
        const ay = Math.asin(Math.max(-1, Math.min(1, -gx))) / D2R;
        const cy = (ax / max) * (cfg.ySign ?? -1);
        const cx = (ay / max) * (cfg.xSign ?? 1);
        this.pushes.push([round(cx), round(cy)]);
        this.control = { x: round(cx), y: round(cy) };
      },
      recenter() {}, setMaxAngle(d) { this.maxAngleDeg = d; }, reset() {},
    };
    made.push(p);
    return p;
  };
  factory.made = made;
  return factory;
}
// The round trip through asin/sin is lossy in the last couple of bits.
const round = (n) => Math.round(n * 1e6) / 1e6;

/** A window that looks like the Unity WebView: `Unity.call` is what selects the
 *  gobalance adapter. No addEventListener, so the dev keyboard stays out. */
function gbWindow(extra = {}) {
  return { Unity: { call() {} }, ...extra };
}

function mk(win, players = { min: 1, max: 2 }) {
  const pipeline = stubFactory();
  const host = new BoboHost({ id: 'dimensiondrift', version: '0.0.0', players, pipeline, window: win });
  return { host, pipeline };
}

test('the gobalance adapter is what a Unity WebView selects', () => {
  const { host } = mk(gbWindow());
  assert.equal(host.transport, 'gobalance');
});

test('getPlayers() is the function that gets called, and it fills both seats', () => {
  let calls = 0;
  const win = gbWindow({
    GoBalance: {
      getPlayers() {
        calls++;
        return [
          { index: 0, name: 'ADA', color: '#ff0000', isMain: true, x: 0.5, y: 0.1 },
          { index: 1, name: 'BEN', color: '#00ffaa', isMain: false, x: -0.4, y: 0.2 },
        ];
      },
    },
  });
  const { host, pipeline } = mk(win);

  host.input(0);

  assert.ok(calls > 0, 'getPlayers() was never called');
  assert.deepEqual(host.input(0), { x: 0.5, y: 0.1 }, 'seat 0 got seat 0 lean');
  assert.deepEqual(host.input(1), { x: -0.4, y: 0.2 }, 'seat 1 got seat 1 lean');
  assert.equal(host.live(0), true);
  assert.equal(host.live(1), true);
});

test('the roster carries identity, not just numbers', () => {
  const win = gbWindow({
    GoBalance: {
      getPlayers: () => [
        { index: 0, name: 'ADA', color: '#ff0000', isMain: true, x: 0, y: 0 },
        { index: 1, name: 'BEN', color: '#00ffaa', isMain: false, x: 0, y: 0 },
      ],
    },
  });
  const { host } = mk(win);
  host.input(0);
  assert.deepEqual(host.roster.map((p) => [p.slot, p.name, p.isMain]),
    [[0, 'ADA', true], [1, 'BEN', false]]);
});

test('an ARRAY-valued `players` is never called as a function', () => {
  // This is the exact shape of the real host object. If anything in the chain
  // regresses to `GoBalance.players()`, this throws rather than silently
  // leaving both seats on the fallback.
  const players = [{ index: 0, x: 0.3, y: 0 }];
  Object.defineProperty(players, 'call', {
    value: () => { throw new Error('players was invoked as a function'); },
  });
  const win = gbWindow({
    GoBalance: { players, getPlayers: () => players },
    __gbSensor: { x: 0.9, y: 0.9 },
  });
  const { host, pipeline } = mk(win);
  host.input(0);
  // It read the roster, not the single-board fallback -- 0.3, not 0.9.
  assert.deepEqual(host.input(0), { x: 0.3, y: 0 });
});

test('__gbSensor still drives seat 0 when the app is too old to have a roster', () => {
  const win = gbWindow({ __gbSensor: { x: -0.25, y: 0.75 } });
  const { host, pipeline } = mk(win);
  host.input(0);
  assert.deepEqual(host.input(0), { x: -0.25, y: 0.75 });
  assert.equal(host.live(0), true);
});

test('a garbage sensor reading is ignored rather than centring the board', () => {
  const win = gbWindow({ __gbSensor: { x: NaN, y: undefined } });
  const { host, pipeline } = mk(win);
  host.input(0);
  // A rejected reading must leave the slot alone, not centre it: a dropped
  // sensor holding the last vector is the contract, and a pushed zero would
  // flatten the board mid-turn. Either no pipeline was built at all, or it
  // was never pushed.
  assert.equal(pipeline.made[0]?.pushes.length ?? 0, 0, 'NaN was pushed through as a lean');
});

test('exit leaves over the SDK bridge as nav:back', () => {
  const sent = [];
  const win = gbWindow({ Unity: { call: (s) => sent.push(s) } });
  const { host } = mk(win);
  host.exit?.();
  assert.ok(sent.includes('nav:back'), `sent ${JSON.stringify(sent)}`);
});
