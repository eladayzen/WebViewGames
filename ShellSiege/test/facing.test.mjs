// WHERE THE BODY POINTS. Short way round, eased, and never snapping east.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { wrapPi, stepAngle, desiredFacing, AIM_RANGE_MUL } = await import('../src/core/facing.js');

const D = (deg) => (deg * Math.PI) / 180;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('HE TURNS THE SHORT WAY across the +/-180 seam', () => {
  // The single most common bug in angle code: 179 to -179 is two degrees, but
  // a naive lerp spins him 358 the other way. On screen that is the character
  // whipping all the way around to look at something beside him.
  const out = stepAngle(D(179), D(-179), 1, D(90));
  assert.ok(out > D(179) - 1e-9 || out < D(-179) + 1e-9 || close(Math.abs(wrapPi(out - D(179))), D(2)),
    `went to ${(out * 180 / Math.PI).toFixed(1)}deg`);
  assert.ok(Math.abs(wrapPi(out - D(179))) <= D(2) + 1e-9, 'moved at most the two degrees needed');
});

test('and he turns at the RATE, not instantly', () => {
  // 170 rather than 180: at exactly opposite, both ways round are the same
  // distance and which one he picks is arbitrary, so it is not a fact worth
  // freezing into a test.
  const out = stepAngle(0, D(170), 0.1, D(90));   // 9 degrees of budget
  assert.ok(close(out, D(9)), `${(out * 180 / Math.PI).toFixed(2)}deg`);
});

test('turning to EXACTLY OPPOSITE still only spends the budget', () => {
  const out = stepAngle(0, D(180), 0.1, D(90));
  assert.ok(close(Math.abs(out), D(9)), `${(out * 180 / Math.PI).toFixed(2)}deg`);
});

test('but lands EXACTLY on the target once it is within reach', () => {
  // Without this he hunts around the target by a fraction of a degree forever,
  // which the blend turns into a permanent twitch.
  const out = stepAngle(0, D(3), 0.1, D(90));
  assert.ok(close(out, D(3)));
});

test('STANDING STILL WITH NOTHING IN RANGE HOLDS THE FACING', () => {
  // Recomputing from a zero travel vector snaps him to east every time the
  // player stops leaning, which reads as a twitch rather than as standing.
  const p = { x: 100, y: 100, facing: D(123) };
  assert.equal(desiredFacing(p, null, false, D(45)), D(45));
});

test('with nothing in range he faces the way he WALKS', () => {
  const p = { x: 100, y: 100, facing: D(123) };
  assert.equal(desiredFacing(p, null, true, D(45)), D(123));
});

test('A TARGET BEATS THE WALK -- he aims at it while strafing', () => {
  // This is the whole reason the four-way walk set exists.
  const p = { x: 100, y: 100, facing: D(90) };
  const want = desiredFacing(p, { x: 200, y: 100 }, true, 0);
  assert.ok(close(want, 0), `${(want * 180 / Math.PI).toFixed(1)}deg`);
});

test('wrapPi folds anything into (-PI, PI]', () => {
  for (let a = -30; a < 30; a += 0.41) {
    const w = wrapPi(a);
    assert.ok(w > -Math.PI - 1e-9 && w <= Math.PI + 1e-9, `${a} -> ${w}`);
    assert.ok(close(Math.cos(w), Math.cos(a), 1e-9) && close(Math.sin(w), Math.sin(a), 1e-9));
  }
});

test('THE AIM REACHES FURTHER THAN THE GUN, so the body does not flip-flop', () => {
  // Measured on the real thing: a crate at 721px against a 620px gun range had
  // the body snapping 150 degrees between "aim at it" and "face where I walk"
  // as it crossed the boundary. The aim radius has to be the larger of the two
  // or that edge is a permanent twitch.
  assert.ok(AIM_RANGE_MUL > 1, `aim multiplier is ${AIM_RANGE_MUL}`);
  const gun = 620;
  assert.ok(gun * AIM_RANGE_MUL >= 721, 'the measured case is inside the aim radius');
});
