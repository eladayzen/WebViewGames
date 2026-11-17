// WHICH WAY IS RIGHT, when the camera is turned 45 degrees.
//
// The trap this closes: core/axes.js could be internally consistent and still
// be wrong, because "screen right" is a fact about WHERE THE CAMERA IS, not
// about the rotation formula. So these tests never check the formula against
// itself. They place a camera exactly the way render/view.js places it, build
// its basis vectors from that POSITION, and demand that the lean mapping
// agrees with them.
//
// Get this wrong and the game is not subtly off: leaning right walks you
// diagonally, which on a balance board -- already fighting a deadzone and half
// a second of body weight -- is unplayable rather than annoying.

import test from 'node:test';
import assert from 'node:assert/strict';

const { screenToWorld } = await import('../src/core/axes.js');

/** The camera basis, derived from render/view.js's placement and nothing else. */
function cameraBasis(yaw, pitch = (50 * Math.PI) / 180, dist = 17.1) {
  const ch = Math.cos(pitch) * dist;
  // Camera sits at target + this. (render/view.js place())
  const cam = { x: Math.cos(yaw) * ch, y: Math.sin(pitch) * dist, z: Math.sin(yaw) * ch };
  // Forward, flattened onto the ground: the direction the view travels.
  const f = { x: -cam.x, z: -cam.z };
  const fl = Math.hypot(f.x, f.z);
  const fwd = { x: f.x / fl, z: f.z / fl };
  // right = forward x up, with up = +Y.
  const right = { x: -fwd.z, z: fwd.x };
  return { fwd, right, cam };
}

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

for (const deg of [0, 30, 45, 90, 135, 200, 315]) {
  const yaw = (deg * Math.PI) / 180;
  const { fwd, right } = cameraBasis(yaw);

  test(`LEANING RIGHT WALKS SCREEN-RIGHT at yaw ${deg}`, () => {
    const m = screenToWorld({ x: 1, y: 0 }, yaw);
    assert.ok(close(m.x, right.x), `x: ${m.x} vs ${right.x}`);
    assert.ok(close(m.y, right.z), `y: ${m.y} vs ${right.z}`);
  });

  test(`LEANING FORWARD WALKS AWAY FROM THE CAMERA at yaw ${deg}`, () => {
    // The sim's +y is DOWN the screen -- systems/input.js has already flipped
    // the board's forward-is-positive convention, so lean-forward and ArrowUp
    // both arrive here as input.y = -1. Walking "up the screen" is walking
    // INTO the scene, which is along the camera's forward vector.
    //
    // This is the assertion that was wrong the first time, in exactly the
    // direction the code was wrong, so it passed. It is now stated the only
    // way that cannot be satisfied by an inverted mapping: by distance from
    // where the camera actually is.
    const m = screenToWorld({ x: 0, y: -1 }, yaw);
    assert.ok(close(m.x, fwd.x), `x: ${m.x} vs ${fwd.x}`);
    assert.ok(close(m.y, fwd.z), `y: ${m.y} vs ${fwd.z}`);
  });

  test(`and leaning BACK walks toward it, at yaw ${deg}`, () => {
    const back = screenToWorld({ x: 0, y: 1 }, yaw);
    assert.ok(close(back.x, -fwd.x));
    assert.ok(close(back.y, -fwd.z));
  });
}

for (const deg of [0, 45, 137, 265]) {
  const yaw = (deg * Math.PI) / 180;
  const { cam } = cameraBasis(yaw);

  test(`FORWARD GETS FURTHER FROM THE CAMERA, measured, at yaw ${deg}`, () => {
    // The check that cannot be fooled by a sign error: take the camera's real
    // position, step the player one unit forward, and demand the gap grew.
    // An inverted axis makes this number go DOWN, whatever the formula says.
    const d0 = Math.hypot(cam.x, cam.y, cam.z);
    const f = screenToWorld({ x: 0, y: -1 }, yaw);
    const d1 = Math.hypot(cam.x - f.x, cam.y, cam.z - f.y);
    assert.ok(d1 > d0 + 0.5, `forward moved the player from ${d0.toFixed(2)} to ${d1.toFixed(2)} from the camera`);

    const b = screenToWorld({ x: 0, y: 1 }, yaw);
    const d2 = Math.hypot(cam.x - b.x, cam.y, cam.z - b.y);
    assert.ok(d2 < d0 - 0.5, `back moved the player from ${d0.toFixed(2)} to ${d2.toFixed(2)} from the camera`);
  });
}

test('THE LEAN IS NEVER SCALED -- a full lean is a full walk in any direction', () => {
  // A rotation that quietly changed length would make the player faster on the
  // diagonals, which is the oldest bug in top-down movement.
  const yaw = Math.PI / 4;
  for (const a of [0, 0.3, 1.1, 2.2, 3.9, 5.5]) {
    const m = screenToWorld({ x: Math.cos(a), y: Math.sin(a) }, yaw);
    assert.ok(close(Math.hypot(m.x, m.y), 1, 1e-12), `at ${a}: ${Math.hypot(m.x, m.y)}`);
  }
});

test('STANDING STILL GOES NOWHERE, at every camera angle', () => {
  for (const deg of [0, 45, 123]) {
    const m = screenToWorld({ x: 0, y: 0 }, (deg * Math.PI) / 180);
    // `===` rather than assert.equal: a rotation through certain angles lands
    // on NEGATIVE zero, which assert.equal rejects because it compares with
    // Object.is. -0 is zero -- it moves the player exactly nowhere, which is
    // the thing being asserted -- so the test was wrong, not the mapping.
    assert.ok(m.x === 0, `x moved: ${m.x}`);
    assert.ok(m.y === 0, `y moved: ${m.y}`);
  }
});

test('RIGHT AND FORWARD STAY PERPENDICULAR -- the mapping is a rotation, not a shear', () => {
  const yaw = Math.PI / 4;
  const r = screenToWorld({ x: 1, y: 0 }, yaw);
  const f = screenToWorld({ x: 0, y: 1 }, yaw);
  assert.ok(close(r.x * f.x + r.y * f.y, 0, 1e-12));
});

test('at the shipped 45 degrees, leaning right moves +x and -y in sim space', () => {
  // Spelled out as literal numbers so a future camera change has to come and
  // argue with this line rather than silently passing a derived check.
  const m = screenToWorld({ x: 1, y: 0 }, Math.PI / 4);
  assert.ok(m.x > 0.7 && m.x < 0.71, `got ${m.x}`);
  assert.ok(m.y < -0.7 && m.y > -0.71, `got ${m.y}`);
  // And forward is the OTHER diagonal, both components NEGATIVE: the camera
  // stands at +x/+z of the player, so walking away from it is walking toward
  // the origin. Written as literals on purpose -- this is the exact pair of
  // signs that was inverted, and a derived check is what let it through.
  const f = screenToWorld({ x: 0, y: -1 }, Math.PI / 4);
  assert.ok(f.x < -0.7 && f.x > -0.71, `got ${f.x}`);
  assert.ok(f.y < -0.7 && f.y > -0.71, `got ${f.y}`);
});
