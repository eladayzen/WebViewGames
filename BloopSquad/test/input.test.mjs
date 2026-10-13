// What "correct" means for multi-board input, written down before the game
// grows a second player.
//
// The three failures this is here to catch, in the order they would hurt:
//
//   1. A single-player run changes behaviour. The overwhelming majority of runs
//      are one child on one board; a two-player feature that costs them
//      anything has lost before it starts.
//   2. An older app build publishes __gbSensor and no __gbPlayers, and input
//      DISAPPEARS instead of degrading to one player -- on exactly the devices
//      nobody tests on.
//   3. Two players share one control. Opposite leans at the same moment is what
//      two people actually do, and it is the case a shared key set gets wrong.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// The module reads a global `window`; give it one before importing.
globalThis.window = { addEventListener() {} };

const {
  readInput, setPlayerCount, resetInput, slotLive, slotDropped,
} = await import('../src/input/input.js');
const { PLAYER } = await import('../src/data/tuning.js');

function reset() {
  delete window.__gbPlayers;
  delete window.__gbSensor;
  resetInput();
  setPlayerCount(1);
}

test('one player: the single global still drives slot 0', () => {
  reset();
  window.__gbSensor = { x: 0.5, y: 0.5 };
  const r = readInput(1 / 60);
  assert.equal(r.source, 'board');
  assert.ok(r.x > 0, 'lateral passes through');
  // y is negated exactly once: board forward is positive, screen y grows down.
  assert.ok(r.y < 0, 'vertical is negated');
  assert.equal(slotLive(0), true);
});

test('one player: no board at all falls back to the keyboard', () => {
  reset();
  const r = readInput(1 / 60);
  assert.equal(r.source, 'keyboard');
  assert.equal(slotLive(0), false, 'a keyboard slot is not a live board');
});

test('OLD APP BUILD: __gbPlayers absent degrades to one player, not to nothing', () => {
  reset();
  setPlayerCount(2);
  window.__gbSensor = { x: 0.6, y: 0 };
  const p0 = readInput(1 / 60, 0);
  assert.equal(p0.source, 'board', 'slot 0 still reads the single global');
  assert.ok(p0.x > 0);
  // Slot 1 has no board behind it and must NOT read the main board's lean --
  // two pods driven by one child is worse than one pod.
  const p1 = readInput(1 / 60, 1);
  assert.equal(p1.source, 'keyboard');
  assert.equal(slotLive(1), false);
});

test('two boards: the slots are independent, including opposite leans', () => {
  reset();
  setPlayerCount(2);
  window.__gbPlayers = [[0.8, 0], [-0.8, 0]];
  const a = readInput(1 / 60, 0);
  const b = readInput(1 / 60, 1);
  assert.equal(a.source, 'board');
  assert.equal(b.source, 'board');
  assert.ok(a.x > 0 && b.x < 0, 'opposite leans stay opposite');
  assert.equal(slotLive(0), true);
  assert.equal(slotLive(1), true);
});

test('a four-board session feeding a two-player game cannot reach slot 2', () => {
  reset();
  setPlayerCount(2);
  window.__gbPlayers = [[0.5, 0], [0.5, 0], [0.9, 0], [0.9, 0]];
  const third = readInput(1 / 60, 2);
  assert.equal(third.source, 'keyboard', 'slot 2 was never asked for');
  assert.equal(slotLive(2), false);
});

test('a slot that exists but reads zero is live, and is not "dropped"', () => {
  reset();
  setPlayerCount(2);
  window.__gbPlayers = [[0, 0], [0, 0]];
  readInput(1 / 60, 1);
  assert.equal(slotLive(1), true, 'a board reading zero is still a board');
  assert.equal(slotDropped(1), false, 'standing still is not a disconnection');
});

test('DROPPED BOARD: pegged and bit-identical reads as dropped', () => {
  reset();
  setPlayerCount(2);
  // A disconnected board yields a constant full deflection -- same float,
  // every frame, forever.
  window.__gbPlayers = [[0, 0], [1, 0]];
  const dt = 1 / 60;
  let t = 0;
  while (t < PLAYER.droppedBoardS + 0.2) { readInput(dt, 1); t += dt; }
  assert.equal(slotDropped(1), true);
  // ...and slot 0, which nobody stepped off, is unaffected.
  assert.equal(slotDropped(0), false);
});

test('a HELD full lean is not a dropped board, because a human jitters', () => {
  reset();
  setPlayerCount(2);
  const dt = 1 / 60;
  let t = 0;
  let n = 0;
  while (t < PLAYER.droppedBoardS + 0.5) {
    // Full lean, held hard, with the sub-percent noise a real body produces.
    window.__gbPlayers = [[0, 0], [1 - (n % 3) * 0.0005, 0]];
    readInput(dt, 1);
    t += dt; n++;
  }
  assert.equal(slotDropped(1), false, 'pegged but moving is a player, not a fault');
});

// ── THE DESKTOP TWO-PLAYER PATH ─────────────────────────────────────────────
//
// This is the one that matters for reviewing the feature before any hardware
// exists: two people, one keyboard, no boards, no calibration. Arrows and WASD
// are the SAME control in single player and must stay that way -- splitting
// them unconditionally would quietly take WASD away from every existing game.

test('keyboard: one player keeps WASD as an alias for the arrows', async () => {
  reset();
  const handlers = {};
  window.addEventListener = (ev, fn) => { handlers[ev] = fn; };
  const { initInput } = await import('../src/input/input.js');
  initInput();

  handlers.keydown({ code: 'KeyD' });            // WASD, single player
  let r = { x: 0 };
  for (let i = 0; i < 60; i++) r = readInput(1 / 60, 0);
  assert.ok(r.x > 0.5, 'D still drives player 1 when there is only one player');
  handlers.keyup({ code: 'KeyD' });
});

test('keyboard: two players split the arrows from WASD, independently', async () => {
  reset();
  const handlers = {};
  window.addEventListener = (ev, fn) => { handlers[ev] = fn; };
  const { initInput } = await import('../src/input/input.js');
  initInput();
  setPlayerCount(2);

  // Opposite directions at the same moment: what two people actually do, and
  // the case a shared key set gets wrong.
  handlers.keydown({ code: 'ArrowRight' });   // player 1 goes right
  handlers.keydown({ code: 'KeyA' });         // player 2 goes left
  let p0, p1;
  for (let i = 0; i < 60; i++) {
    p0 = readInput(1 / 60, 0);
    p1 = readInput(1 / 60, 1);
  }
  assert.ok(p0.x > 0.5, 'arrows drive player 1');
  assert.ok(p1.x < -0.5, 'WASD drives player 2, the other way');

  // And player 2's keys must NOT also move player 1.
  handlers.keyup({ code: 'ArrowRight' });
  for (let i = 0; i < 60; i++) p0 = readInput(1 / 60, 0);
  assert.ok(Math.abs(p0.x) < 0.05, 'player 1 stops when only player 2 is holding a key');
});

// ── A HELD LEAN IS NOT A DISCONNECTION ──────────────────────────────────────
//
// The Editor's simulated seats ease to exactly 1.0 and then stay there, so the
// dropped-board detector fired on a child simply holding a direction and the
// pod stopped dead. Amit, within minutes of first playing it in Unity: "when I
// move both players at the same time, sometimes one of them stops". This pins
// the behaviour that matters -- the pod keeps moving -- rather than the
// detector, which is still allowed to have an opinion.

test('a pod holding a steady full lean keeps moving', async () => {
  reset();
  setPlayerCount(2);
  const { updatePod } = await import('../src/systems/play.js');
  const { createWorld } = await import('../src/core/state.js');
  const w = createWorld(2);
  // Both seats pegged and perfectly still, exactly as the Editor sends them.
  window.__gbPlayers = [[1, 0], [-1, 0]];
  const dt = 1 / 60;
  const startX = w.players.map((p) => p.x);
  for (let i = 0; i < 60 * 3; i++) {
    for (const p of w.players) updatePod(w, p, readInput(dt, p.slot), dt);
  }
  // Three seconds of held lean: both must have travelled, in opposite
  // directions, however the detector feels about it.
  assert.ok(w.players[0].x > startX[0] + 50, 'seat 0 kept moving right');
  assert.ok(w.players[1].x < startX[1] - 50, 'seat 1 kept moving left');
});

test('the beam survives a held lean too', async () => {
  reset();
  setPlayerCount(2);
  const { tether } = await import('../src/systems/play.js');
  const { createWorld, GameState } = await import('../src/core/state.js');
  const w = createWorld(2);
  w.state = GameState.RUNNING;
  w.beamActiveT = 5;
  window.__gbPlayers = [[1, 0], [1, 0]];
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 3; i++) readInput(dt, 0), readInput(dt, 1);
  const b = tether(w);
  assert.ok(b, 'the tether still exists after 3s of held lean');
  assert.equal(b.live, true);
});
