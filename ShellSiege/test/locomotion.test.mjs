// THE FOUR-WAY BLEND, and in particular WHICH SIDE IS THE CHARACTER'S RIGHT.
//
// Left and right swapped is the same shape of bug as the inverted forward
// axis this project already shipped once: everything still moves, nothing
// throws, and the character moonwalks. The test that matters therefore does
// not ask core/locomotion.js what right means -- it derives the model's right
// vector from the YAW FORMULA THE RIG ACTUALLY USES (render/rig.js: three.js
// `rotation.y = atan2(cos facing, sin facing)` on a mesh authored facing +Z)
// and demands the blend agree with it.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { localHeading, blendWeights, blendedStride, cadenceHz } =
  await import('../src/core/locomotion.js');

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/**
 * The model's own right, in sim ground coordinates, for a body facing `F`.
 * Derived from the rig's yaw, not from the blend's assumptions.
 */
function modelRight(F) {
  const phi = Math.atan2(Math.cos(F), Math.sin(F));   // render/rig.js place()
  // A mesh authored facing +Z has its right hand at local -X (right = fwd x up).
  // Rotating (x, z) about +Y by phi: (x cos + z sin, -x sin + z cos).
  const lx = -1, lz = 0;
  return { x: lx * Math.cos(phi) + lz * Math.sin(phi), y: -lx * Math.sin(phi) + lz * Math.cos(phi) };
}

for (const deg of [0, 37, 90, 185, 300]) {
  const F = (deg * Math.PI) / 180;

  test(`STRAFING TO HIS RIGHT IS +90 DEGREES of local heading, facing ${deg}`, () => {
    const r = modelRight(F);
    const moveAngle = Math.atan2(r.y, r.x);
    assert.ok(close(localHeading(moveAngle, F), Math.PI / 2, 1e-9));
  });

  test(`and the RIGHT clip is the one that gets the weight, facing ${deg}`, () => {
    const r = modelRight(F);
    const w = blendWeights(localHeading(Math.atan2(r.y, r.x), F));
    assert.ok(close(w.r, 1), `right got ${w.r}, left got ${w.l}`);
    assert.equal(w.l, 0);
  });

  test(`walking the way he faces is pure FORWARD, facing ${deg}`, () => {
    const w = blendWeights(localHeading(F, F));
    assert.ok(close(w.f, 1), `forward got ${w.f}`);
    assert.equal(w.b, 0);
  });

  test(`backing away from what he is aiming at is pure BACK, facing ${deg}`, () => {
    const w = blendWeights(localHeading(F + Math.PI, F));
    assert.ok(close(w.b, 1), `back got ${w.b}`);
    assert.equal(w.f, 0);
  });
}

test('THE WEIGHTS ALWAYS SUM TO ONE, at every heading', () => {
  // A blend that sums to less than one drags the pose toward the bind pose --
  // the character half-dissolves into a T, which is unmistakable and is
  // exactly what naive vector normalisation does on the diagonals.
  for (let a = -Math.PI; a <= Math.PI; a += 0.013) {
    const w = blendWeights(a);
    assert.ok(close(w.f + w.b + w.l + w.r, 1, 1e-12), `at ${a}: ${w.f + w.b + w.l + w.r}`);
  }
});

test('A DIAGONAL IS HALF AND HALF of two clips, never four', () => {
  const w = blendWeights(Math.PI / 4);
  assert.ok(close(w.f, 0.5) && close(w.r, 0.5), JSON.stringify(w));
  assert.equal(w.b, 0);
  assert.equal(w.l, 0);
});

test('opposite clips are NEVER both on -- a left and a right at once is a shuffle', () => {
  for (let a = -Math.PI; a <= Math.PI; a += 0.017) {
    const w = blendWeights(a);
    assert.ok(w.f === 0 || w.b === 0, `f ${w.f} b ${w.b} at ${a}`);
    assert.ok(w.l === 0 || w.r === 0, `l ${w.l} r ${w.r} at ${a}`);
  }
});

test('THE FEET MATCH THE GROUND: one second of cycles covers one second of travel', () => {
  // The whole point of measuring stride. If this drifts, he skates.
  const stride = { f: 1.6, b: 1.3, l: 1.35, r: 1.28 };
  for (const [angle, speed] of [[0, 3.64], [Math.PI / 2, 2.0], [Math.PI, 3.0], [-0.8, 1.1]]) {
    const w = blendWeights(angle);
    const s = blendedStride(w, stride);
    const hz = cadenceHz(speed, s);
    assert.ok(close(hz * s, speed, 1e-9), `covered ${hz * s} travelling ${speed}`);
  }
});

test('an IN-PLACE clip does not divide by zero', () => {
  // `idle` measures 0.21 femurs of stride and a genuinely in-place clip would
  // measure 0. Infinity here would set action.time to NaN and freeze the pose.
  assert.equal(cadenceHz(3.6, 0), 0);
  assert.equal(cadenceHz(3.6, -1), 0);
  assert.ok(Number.isFinite(cadenceHz(3.6, 0.0001) * 0 + cadenceHz(3.6, 1)));
});

test('local heading is always folded into (-PI, PI]', () => {
  for (let a = -20; a < 20; a += 0.37) {
    const h = localHeading(a, 0.4);
    assert.ok(h > -Math.PI - 1e-9 && h <= Math.PI + 1e-9, `${h}`);
  }
});
