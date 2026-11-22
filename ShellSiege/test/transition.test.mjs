// THE MOMENT BETWEEN ROOMS. The screen must never show a frame of the wrong
// room, and the iris must never leave a corner of black behind -- both are
// continuity properties, so they are tested as such rather than by eye.

import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANS, irisOpen, slowFactor, irisRadiusPx } from '../src/core/transition.js';
import { RUN } from '../src/core/run.js';

const at = (phase, t) => irisOpen({ phase, t });

test('THE SCREEN IS FULLY OPEN WHILE YOU FIGHT, and fully black while the box is open', () => {
  assert.equal(at('fight', 0), 1);
  assert.equal(at('fight', 99), 1);
  assert.equal(at('roll', 0), 0);
  assert.equal(at('roll', 1.7), 0);
  assert.equal(at('won', 0), 0, 'a won level stays on black behind its card');
});

test('THE IRIS ONLY CLOSES AT THE END OF THE CLEARED HOLD', () => {
  const closeAt = RUN.clearHoldS - TRANS.closeS;
  assert.equal(at('cleared', 0), 1, 'closed the instant the room was cleared');
  assert.equal(at('cleared', closeAt - 0.01), 1, 'started closing before its time');
  assert.ok(at('cleared', closeAt + TRANS.closeS / 2) < 1);
  assert.ok(at('cleared', closeAt + TRANS.closeS / 2) > 0);
});

test('IT IS BLACK EXACTLY WHEN THE CLEARED HOLD ENDS, so the box starts on a closed screen', () => {
  assert.ok(Math.abs(at('cleared', RUN.clearHoldS)) < 1e-9, 'not yet black when the roll begins');
  assert.equal(at('cleared', RUN.clearHoldS + 5), 0, 'and it must not reopen if the hold runs long');
});

test('THE NEXT ROOM OPENS FROM BLACK, which is when its floor and layout are swapped in', () => {
  // main.js swaps the room on the `roomStart` event, on the frame the intro
  // begins. If the intro began even slightly open, the old room would be seen
  // changing into the new one.
  assert.equal(at('intro', 0), 0);
  assert.equal(at('intro', TRANS.openS), 1);
  assert.equal(at('intro', TRANS.openS * 3), 1, 'it must stay open once open');
});

test('NO JUMPS ACROSS THE BOUNDARIES between phases', () => {
  assert.ok(Math.abs(at('cleared', RUN.clearHoldS) - at('roll', 0)) < 1e-9, 'cleared -> roll');
  assert.equal(at('roll', 9) - at('intro', 0), 0, 'roll -> intro');
  assert.equal(at('intro', TRANS.openS) - at('fight', 0), 0, 'intro -> fight');
});

test('THE IRIS ONLY MOVES ONE WAY WITHIN EACH PHASE', () => {
  let prev = -1;
  for (let t = 0; t <= TRANS.openS; t += 0.01) { const v = at('intro', t); assert.ok(v >= prev - 1e-9); prev = v; }
  prev = 2;
  for (let t = 0; t <= RUN.clearHoldS; t += 0.01) { const v = at('cleared', t); assert.ok(v <= prev + 1e-9); prev = v; }
});

test('FULLY OPEN CLEARS EVERY CORNER, wherever the turtle is on screen', () => {
  const W = 1600, H = 900;
  for (const [cx, cy] of [[800, 450], [10, 10], [1590, 890], [800, 880], [20, 450]]) {
    const r = irisRadiusPx(1, cx, cy, W, H);
    for (const [px, py] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      assert.ok(Math.hypot(px - cx, py - cy) <= r + 1e-6, `corner ${px},${py} left black for a hole at ${cx},${cy}`);
    }
  }
  assert.equal(irisRadiusPx(0, 800, 450, W, H), 0, 'closed must be a point, not a hole');
  assert.ok(irisRadiusPx(0.5, 800, 450, W, H) < irisRadiusPx(1, 800, 450, W, H));
});

test('SLOW MOTION IS A FRACTION OF NORMAL, and only while it is running', () => {
  assert.equal(slowFactor(0), 1);
  assert.equal(slowFactor(-1), 1);
  assert.equal(slowFactor(0.3), TRANS.slowScale);
  assert.ok(TRANS.slowScale > 0 && TRANS.slowScale < 1);
  assert.ok(TRANS.slowS <= 1, 'slow motion that runs long stops being a beat and becomes a stall');
});
