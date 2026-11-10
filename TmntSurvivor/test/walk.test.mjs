// THE WALK CYCLE RUNS AT ONE SPEED, AND ONLY WHILE WALKING.
//
// Two rules, and the file exists because the obvious implementation of
// either one breaks the other.
//
// Gate it on nothing and a time-driven cycle keeps walking while the player
// stands still -- a character moonwalking on the spot is the most obvious
// tell that a walk cycle was bolted onto a game that did not have one.
//
// Pace it by DISTANCE instead, which is how this started, and the cadence
// becomes a function of speed. On a balance board speed is analogue and
// nobody holds a lean steady, so the legs crawl, sprint and crawl again
// several times a second. Elad, 1 Nov: "the walking animation is changing
// speed - it should not." It reads as a frame rate problem, not as a walk.
//
// So: a clock that only ticks while moving, running at one fixed rate.

import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWalk, setFrame, FRAMES } from '../src/systems/sprites.js';

const BASE = 0.5;
const fake = () => ({
  scale: { x: BASE },
  __baseScale: BASE,
  __frames: Array.from({ length: FRAMES }, (_, i) => ({ id: i })),
  __f: 0,
  y: 0,
  texture: null,
  __walkT: 0,
});

/** Walk for `seconds`, and report how many frames the cycle advanced. */
function framesOver(s, seconds, moving = true, dt = 1 / 60) {
  const before = advanceWalk(s, false, 0);
  for (let t = 0; t < seconds; t += dt) advanceWalk(s, moving, dt);
  return advanceWalk(s, false, 0) - before;
}

test('STANDING STILL DOES NOT ADVANCE THE CYCLE', () => {
  const s = fake();
  assert.equal(framesOver(s, 3, false), 0, 'three seconds still, no moonwalk');
});

test('THE CADENCE DOES NOT CHANGE WITH SPEED -- the whole point', () => {
  // Two turtles, same wall-clock, wildly different speeds. advanceWalk is
  // not given a speed at all, which is what guarantees it: the only thing
  // that can vary the cycle is TIME, and they share that.
  const slow = fake();
  const fast = fake();
  const a = framesOver(slow, 2, true, 1 / 60);
  const b = framesOver(fast, 2, true, 1 / 30);   // half the frame rate, same 2s
  assert.equal(a, b, 'same seconds walked, same frames advanced');
});

test('a frame rate drop does not change the cadence either', () => {
  const smooth = fake();
  const stuttery = fake();
  const a = framesOver(smooth, 1.5, true, 1 / 120);
  const b = framesOver(stuttery, 1.5, true, 1 / 20);
  assert.equal(a, b, 'the cycle is paced by seconds, not by frames rendered');
});

test('walking advances it, and a full cycle returns to the start', () => {
  const s = fake();
  setFrame(s, advanceWalk(s, false, 0), 0);
  const first = s.texture;
  // Walk until the frame index has advanced by exactly one full cycle.
  const start = advanceWalk(s, false, 0);
  let guard = 0;
  while (advanceWalk(s, true, 1 / 60) - start < FRAMES && guard++ < 100000) { /* walk */ }
  assert.ok(guard < 100000, 'the cycle never came back around');
  setFrame(s, advanceWalk(s, false, 0), 0);
  assert.equal(s.texture, first, 'one full cycle lands on the same frame');
});

test('STOPPING AND STARTING RESUMES, it does not restart', () => {
  // A turtle that snapped back to frame 0 every time the player paused on a
  // lean would stutter constantly -- stopping is not a new walk.
  const s = fake();
  framesOver(s, 0.3);
  const mid = advanceWalk(s, false, 0);
  framesOver(s, 2, false);                       // a long pause
  assert.equal(advanceWalk(s, false, 0), mid, 'the clock held where it was');
  framesOver(s, 0.3);
  assert.ok(advanceWalk(s, false, 0) > mid, 'and carried on from there');
});
