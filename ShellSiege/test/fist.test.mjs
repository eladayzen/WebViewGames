// The fist derives its flexion axis from the skeleton each frame, so the fake
// rig here has to be a real little hand -- parented, with real offsets -- and
// not a bag of loose Object3Ds. That is not test ceremony: the bug this
// replaced was exactly an axis that was assumed instead of measured, and a
// fake with no geometry cannot catch that class of mistake at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeFist, fingerBoneCount, CURL } from '../src/render/fist.js';

/**
 * A right hand at the origin: fingers run along +Y, the knuckles are spread
 * along +X, and the thumb sits on the +Z side -- so +Z is the palm.
 */
function fakeHand(side = 'Right', fingers = ['Thumb', 'Index', 'Middle']) {
  const bones = {};
  const root = new THREE.Object3D();
  const hand = new THREE.Bone();
  hand.name = `mixamorig${side}Hand`;
  root.add(hand);
  bones[hand.name] = hand;

  const across = { Thumb: 1.2, Index: 0.5, Middle: 0, Ring: -0.5, Pinky: -1 };
  for (const f of fingers) {
    let parent = hand;
    for (let i = 1; i <= 3; i++) {
      const b = new THREE.Bone();
      b.name = `mixamorig${side}Hand${f}${i}`;
      // The first phalanx steps out to its knuckle; the rest run straight on.
      b.position.set(i === 1 ? across[f] : 0, 1, i === 1 && f === 'Thumb' ? 0.6 : 0);
      parent.add(b);
      parent = b;
      bones[b.name] = b;
    }
  }
  root.updateMatrixWorld(true);
  return { bones, root, hand };
}

/**
 * Accumulated flexion at the last phalanx, in degrees: the angle between the
 * hand's "straight out" direction and the direction the last bone points.
 *
 * NOT the tip's POSITION, which was the first thing tried and is a trap. The
 * last bone in a Mixamo finger has no end effector, so its own position can
 * only ever reach about 60 degrees off straight however hard the knuckles
 * close -- the far half of the finger is the bone's own length, which that
 * measurement cannot see. A threshold set against the position metric either
 * fails a correct fist or passes a flat hand, depending which way it is wrong.
 */
function curlDeg(bones, side = 'Right') {
  const hand = bones[`mixamorig${side}Hand`];
  const last = bones[`mixamorig${side}HandMiddle3`];
  hand.updateWorldMatrix(true, true);
  const along = (o) => new THREE.Vector3(0, 1, 0)
    .applyMatrix4(new THREE.Matrix4().extractRotation(o.matrixWorld)).normalize();
  return (along(hand).angleTo(along(last)) * 180) / Math.PI;
}

test('a rig with no finger bones gets null, not a thrower', () => {
  assert.equal(makeFist({}, 'Right'), null);
});

test('a hand with only one finger chain gets null, because the axis is underdetermined', () => {
  // Two knuckles are what give "across the hand" a direction. One cannot.
  const { bones } = fakeHand('Right', ['Index']);
  assert.equal(makeFist(bones, 'Right'), null);
});

test('only the bones that exist are curled', () => {
  // This glb carries three fingers, not five.
  const { bones } = fakeHand();
  assert.equal(fingerBoneCount(bones, 'Right'), 9);
  assert.equal(fingerBoneCount(bones, 'Left'), 0);
  assert.ok(makeFist(bones, 'Right'));
  assert.equal(makeFist(bones, 'Left'), null);
});

test('THE FINGERS ACTUALLY CLOSE -- the whole point, and the thing that silently failed', () => {
  const { bones } = fakeHand();
  const before = curlDeg(bones);
  makeFist(bones, 'Right')(1);
  const after = curlDeg(bones);
  assert.ok(before < 5, `hand did not start flat: ${before.toFixed(1)} deg`);
  // The last phalanx carries all three joints' rotation -- 55 + 80 + 52, so
  // about 187 degrees. The version this replaced reached 17, because the
  // phalanges turned against each other; a loose "it moved" assertion would
  // have passed that, which is why this threshold is near the real answer.
  assert.ok(after > 170, `last phalanx only reached ${after.toFixed(1)} deg`);
});

test('and they close toward the PALM, not backwards over the knuckles', () => {
  const { bones } = fakeHand();
  makeFist(bones, 'Right')(1);
  const hand = bones.mixamorigRightHand;
  hand.updateWorldMatrix(true, true);
  const tip = bones.mixamorigRightHandMiddle3.getWorldPosition(new THREE.Vector3());
  hand.worldToLocal(tip);
  // The thumb marks the palm at +Z in this fake, so a closing hand has to take
  // its fingertips to positive Z. Negative Z is a hand bent backwards.
  assert.ok(tip.z > 0, `fingertip went to z=${tip.z.toFixed(2)} -- bent backwards`);
});

test('it works the same on a left hand', () => {
  const { bones } = fakeHand('Left');
  const before = curlDeg(bones, 'Left');
  makeFist(bones, 'Left')(1);
  assert.ok(curlDeg(bones, 'Left') - before > 170);
});

test('calling it every frame does not wind the fingers off', () => {
  // The real loop re-applies the clip to the bones first, so the guarantee
  // needed is that one application from a given start is deterministic.
  const { bones } = fakeHand();
  const close = makeFist(bones, 'Right');
  const b = bones.mixamorigRightHandMiddle2;
  close(1);
  const once = b.quaternion.clone();
  b.quaternion.identity();   // what the mixer does at the top of each frame
  bones.mixamorigRightHand.updateMatrixWorld(true);
  close(1);
  assert.ok(once.angleTo(b.quaternion) < 1e-6);
});

test('amount 0 leaves the clip pose untouched', () => {
  const { bones } = fakeHand();
  makeFist(bones, 'Right')(0);
  assert.ok(bones.mixamorigRightHandIndex1.quaternion.angleTo(new THREE.Quaternion()) < 1e-9);
});

test('half closed is between open and closed', () => {
  const { bones } = fakeHand();
  makeFist(bones, 'Right')(0.5);
  const half = curlDeg(bones);
  // Half of 187.
  assert.ok(half > 80 && half < 105, `half curl landed at ${half.toFixed(1)} deg`);
});

test('the thumb takes far less curl than the fingers', () => {
  // A thumb given the fingers' 80 degrees drives straight through them.
  assert.ok(Math.max(...CURL.Thumb) < Math.min(...CURL.Middle));
});

test('CURLING TWICE CURLS FURTHER -- the oscillation regression', () => {
  // The version that re-derived its axis from the live skeleton each call read
  // a palm normal off a hand it had already half-closed, so the axis could
  // flip: on the real rig one application added 21 degrees and the next took
  // 35 away. Nothing about that looks like a bug from the outside -- the hand
  // moves, it just never closes. Applying twice without resetting is the
  // cheapest way to catch an axis that does not hold still.
  const { bones } = fakeHand();
  const close = makeFist(bones, 'Right');
  // 0.4 twice, not 1.0 twice: a full curl is about 187 degrees, so two of them
  // pass 360 and `angleTo` -- which only ever reports 0..180 -- wraps round to
  // a small number that looks exactly like the bug being tested for.
  close(0.4);
  const once = curlDeg(bones);
  close(0.4);
  const twice = curlDeg(bones);
  assert.ok(twice > once + 30, `second curl did not add: ${once.toFixed(1)} -> ${twice.toFixed(1)}`);
});
