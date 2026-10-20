// FOUR SEATS, FOUR KEYBOARDS -- at a desk, where there are no boards.
//
// The desktop fallback used to read `slot === 0 ? arrows : WASD`, so seats 2,
// 3 and 4 all answered to the same four keys and moved as one. Nobody noticed
// while two boards was the most anyone ran. Elad hit it the first time he
// opened a four-player dev URL, 20 Oct, and could not tell whether it was the
// link, the game or the build -- which is the real cost of it.
//
// None of this runs on a device: every seat reads its own board through
// window.__gbPlayers and never reaches the keyboard path. What is under test
// is that a person at a keyboard can drive what the game can actually do.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
globalThis.window = {
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  removeEventListener() {},
};
globalThis.document = { addEventListener() {}, removeEventListener() {} };

const { initInput, readInput, setPlayerCount } = await import('../src/input/input.js');
initInput();

const press = (code) => listeners.keydown.forEach((fn) => fn({ code }));
const release = (code) => (listeners.keyup || []).forEach((fn) => fn({ code }));

/** Run a seat long enough for the ramp to pass the deadzone, and report its x. */
function xOf(slot) {
  let out = 0;
  for (let i = 0; i < 40; i++) out = readInput(1 / 60, slot).x;
  return out;
}

/** Which seats move when this key is held, out of `seats`. */
function movedBy(code, seats) {
  setPlayerCount(seats);
  press(code);
  const moved = [];
  for (let slot = 0; slot < seats; slot++) if (Math.abs(xOf(slot)) > 0.01) moved.push(slot);
  release(code);
  for (let slot = 0; slot < seats; slot++) for (let i = 0; i < 60; i++) readInput(1 / 60, slot);
  return moved;
}

test('EACH SEAT HAS ITS OWN KEY, and no key moves two pods', () => {
  for (const [code, slot] of [['ArrowLeft', 0], ['KeyA', 1], ['KeyJ', 2], ['Numpad4', 3]]) {
    assert.deepEqual(movedBy(code, 4), [slot], `${code} must move only seat ${slot + 1}`);
  }
});

test('THE OLD BUG: WASD no longer drives seats 2, 3 and 4 together', () => {
  assert.deepEqual(movedBy('KeyA', 4), [1]);
  assert.deepEqual(movedBy('KeyA', 3), [1]);
});

test('right and left are opposite, on every seat', () => {
  setPlayerCount(4);
  for (const [l, r, slot] of [['ArrowLeft', 'ArrowRight', 0], ['KeyA', 'KeyD', 1],
                              ['KeyJ', 'KeyL', 2], ['Numpad4', 'Numpad6', 3]]) {
    press(l); const left = xOf(slot); release(l);
    for (let i = 0; i < 60; i++) readInput(1 / 60, slot);
    press(r); const right = xOf(slot); release(r);
    for (let i = 0; i < 60; i++) readInput(1 / 60, slot);
    assert.ok(left < 0 && right > 0, `seat ${slot + 1}: ${left} then ${right}`);
  }
});

test('SINGLE PLAYER IS UNCHANGED: arrows and WASD are the same control', () => {
  setPlayerCount(1);
  for (const code of ['ArrowLeft', 'KeyA']) {
    press(code);
    assert.ok(xOf(0) < 0, `${code} still steers the one pod`);
    release(code);
    for (let i = 0; i < 60; i++) readInput(1 / 60, 0);
  }
});

test('numpad down is accepted on both 2 and 5', () => {
  setPlayerCount(4);
  for (const code of ['Numpad2', 'Numpad5']) {
    press(code);
    let y = 0;
    for (let i = 0; i < 40; i++) y = readInput(1 / 60, 3).y;
    assert.ok(y > 0, `${code} should push seat 4 down`);
    release(code);
    for (let i = 0; i < 60; i++) readInput(1 / 60, 3);
  }
});
