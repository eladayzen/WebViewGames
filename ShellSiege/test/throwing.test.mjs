// THE UPPER-BODY WINDOW: when the throw owns the arms, and how much.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { THROW, THROW_SPAN, throwEnvelope, throwClipTime } =
  await import('../src/core/throwing.js');

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('WITH NO THROW PLAYING THE WALK OWNS EVERYTHING', () => {
  // The requirement, stated as arithmetic: the layer contributes `w x mask`
  // and the walk keeps `1 - w x mask`, so w = 0 means the walk drives every
  // bone at full strength. Outside the window w must be exactly zero -- not
  // nearly zero, or the arms sit permanently half-way into a throw pose.
  assert.equal(throwEnvelope(-1), 0);
  assert.equal(throwEnvelope(0), 0);
  assert.equal(throwEnvelope(THROW_SPAN), 0);
  assert.equal(throwEnvelope(THROW_SPAN + 5), 0);
  assert.equal(throwEnvelope(Infinity), 0);
});

test('IT REACHES FULL STRENGTH in the middle, so the throw actually reads', () => {
  let peak = 0;
  for (let t = 0; t <= THROW_SPAN; t += THROW_SPAN / 400) peak = Math.max(peak, throwEnvelope(t));
  assert.ok(close(peak, 1, 1e-6), `peaked at ${peak}`);
});

test('and never exceeds 1 -- the two layers must sum to exactly one', () => {
  for (let t = -0.5; t <= THROW_SPAN + 0.5; t += 0.004) {
    const w = throwEnvelope(t);
    assert.ok(w >= 0 && w <= 1, `w=${w} at ${t}`);
  }
});

test('THE ARMS LEAVE AND REJOIN THE WALK SMOOTHLY, with no step', () => {
  // A jump in the envelope is a visible pop at the shoulders, once per shot.
  let prev = throwEnvelope(-0.01);
  for (let t = -0.01; t <= THROW_SPAN + 0.01; t += 0.004) {
    const w = throwEnvelope(t);
    assert.ok(Math.abs(w - prev) < 0.1, `jumped ${prev} -> ${w} at ${t}`);
    prev = w;
  }
});

test('THE WINDOW FITS INSIDE ONE FIRING INTERVAL', () => {
  // Two throws overlapping on one pair of arms is a shuffle, not a second
  // throw. The base gun fires every 0.55s.
  assert.ok(THROW_SPAN < 0.55, `window is ${THROW_SPAN}s against a 0.55s interval`);
});

test('THE RELEASE LANDS EXACTLY ON THE SHOT', () => {
  // The whole reason the trigger is predictive. preS into the window, the clip
  // must be at the measured release frame -- that is the frame the star leaves.
  const release = 1.2, duration = 2.2;      // throw_slash, measured
  assert.ok(close(throwClipTime(THROW.preS, release, duration), release));
});

test('and the clip is clamped to its own length at both ends', () => {
  assert.equal(throwClipTime(-99, 1.2, 2.2), 0);
  assert.equal(throwClipTime(99, 1.2, 2.2), 2.2);
  // A clip whose release is earlier than the wind-up cannot start before zero.
  assert.equal(throwClipTime(0, 0.12, 1.0), 0, 'throw_horiz releases at 0.12s');
});

test('the window runs through the release, not up to it', () => {
  assert.ok(THROW.postS > 0, 'there is follow-through after the hand opens');
  assert.ok(THROW.preS > 0, 'and a wind-up before it');
});
