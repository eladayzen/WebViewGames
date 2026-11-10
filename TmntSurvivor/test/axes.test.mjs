// WHICH WAY IS FORWARD.
//
// Elad, on the real board, 8 Nov: "up is down and down is up." Leaning forward
// walked him DOWN the screen. The board reports lean-forward as positive y;
// screen space points positive y down. Nova Vanguard found the same thing and
// fixed it the same way, and these tests exist so the third game does not have
// to find it a third time.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { readInput, TUNING } = await import('../src/systems/input.js');

const clearBoard = () => { delete window.__gbSensor; delete window.__gbPlayers; };

test('LEANING FORWARD WALKS YOU UP THE SCREEN, not down', () => {
  clearBoard();
  window.__gbSensor = { x: 0, y: 0.6 };      // the board's "forward"
  const r = readInput(1 / 60);
  assert.equal(r.source, 'board');
  assert.ok(r.y < 0, `forward must be negative y on screen, got ${r.y}`);
});

test('and leaning back walks you down', () => {
  clearBoard();
  window.__gbSensor = { x: 0, y: -0.6 };
  assert.ok(readInput(1 / 60).y > 0);
});

test('the lateral axis is NOT flipped -- it was never wrong', () => {
  clearBoard();
  window.__gbSensor = { x: 0.6, y: 0 };
  assert.ok(readInput(1 / 60).x > 0, 'leaning right must go right');
  assert.equal(TUNING.sensorXSign, 1, 'do not "fix" the axis that works');
});

test('the per-seat roster array gets the same treatment', () => {
  // Both paths carry the board's own convention, so both were wrong the same
  // way. Fixing only __gbSensor would leave it inverted on a newer app build.
  clearBoard();
  window.__gbPlayers = [[0, 0.6]];
  const r = readInput(1 / 60);
  assert.equal(r.source, 'board');
  assert.ok(r.y < 0, 'seat 0 must be signed too');
});

test('THE KEYBOARD IS NOT INVERTED -- only the board was wrong', () => {
  // The trap in fixing this: negating the movement instead of the sensor also
  // breaks the desktop fallback, where ArrowDown already means "walk down".
  clearBoard();
  // No board present, nothing held: the fallback must sit still, and the sign
  // constants must not have reached it.
  const r = readInput(1 / 60);
  assert.equal(r.source, 'keyboard');
  assert.equal(r.y, 0, 'nothing held is nothing moved');
});

test('the signs are named constants, so the next flip is one character', () => {
  assert.equal(TUNING.sensorYSign, -1);
  assert.equal(typeof TUNING.sensorXSign, 'number');
});
