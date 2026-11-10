// The movement model, without a browser.
//
// Prototype 1 is about FEEL, which no test can judge -- so these cover only
// the things that would make the feel test meaningless if they were wrong:
// that the deadzone does what it says, that facing does not twitch when the
// player stops, and that the camera is actually on the player.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { createWorld, updateWorld, __setSpeedSource, WORLD } = await import('../src/core/world.js');
const { readInput, initInput, __setKeys, TUNING } = await import('../src/systems/input.js');

__setSpeedSource(() => 500);
initInput();

test('the deadzone swallows a small lean and rescales what is past it', () => {
  globalThis.window.__gbSensor = { x: TUNING.deadzoneX * 0.9, y: 0 };
  assert.equal(readInput(0.016).x, 0, 'inside the deadzone is not movement');
  globalThis.window.__gbSensor = { x: 1, y: 1 };
  const full = readInput(0.016);
  assert.equal(full.x, 1, 'a full lean still reaches full speed');
  // MAGNITUDE, not sign. The board's y is negated on the way in (it reports
  // lean-forward as positive, the screen points positive down) -- so a full
  // lean reads as -1 here, and that is correct. Direction is axes.test.mjs's
  // job; this test is about the deadzone rescale reaching the full range.
  assert.equal(Math.abs(full.y), 1, 'on both axes');
});

test('THE TWO AXES HAVE DIFFERENT DEADZONES, which is the point of the prototype', () => {
  // Forward/back is the harder lean, so it starts with a wider deadzone --
  // Bloop Squad's shipped values. If these are ever equal, someone has
  // flattened the thing this prototype exists to measure.
  assert.ok(TUNING.deadzoneY > TUNING.deadzoneX);
});

test('the camera sits on the player', () => {
  globalThis.window.__gbSensor = { x: 1, y: 0 };
  const w = createWorld();
  for (let i = 0; i < 30; i++) updateWorld(w, readInput(1 / 60), 1 / 60);
  assert.ok(w.player.x > WORLD.width / 2, 'the player moved');
  assert.equal(w.camera.x, w.player.x);
  assert.equal(w.camera.y, w.player.y);
});

test('FACING DOES NOT TWITCH WHEN THE PLAYER STOPS', () => {
  const w = createWorld();
  globalThis.window.__gbSensor = { x: 0, y: -1 };          // walking up
  for (let i = 0; i < 20; i++) updateWorld(w, readInput(1 / 60), 1 / 60);
  const facingWhileWalking = w.player.facing;
  globalThis.window.__gbSensor = { x: 0, y: 0 };            // let go
  for (let i = 0; i < 20; i++) updateWorld(w, readInput(1 / 60), 1 / 60);
  assert.equal(w.player.facing, facingWhileWalking,
    'standing still must not snap the character back to facing right');
});

test('the world is bounded -- you can be cornered', () => {
  const w = createWorld();
  // y is +1 because the board's y is negated on the way in -- leaning BACK is
  // what drives the player toward the top of the world. See axes.test.mjs.
  globalThis.window.__gbSensor = { x: -1, y: 1 };
  for (let i = 0; i < 2000; i++) updateWorld(w, readInput(1 / 60), 1 / 60);
  assert.equal(w.player.x, 0);
  assert.equal(w.player.y, 0);
});

test('with no board at all, the keyboard stands in', () => {
  delete globalThis.window.__gbSensor;
  delete globalThis.window.__gbPlayers;
  __setKeys(['ArrowRight']);
  let out = { x: 0 };
  for (let i = 0; i < 60; i++) out = readInput(1 / 60);
  assert.equal(out.source, 'keyboard');
  assert.ok(out.x > 0.9, 'and ramps up to a full lean');
});
