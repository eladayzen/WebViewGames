// THE SPRITE MIRRORS, IT DOES NOT ROTATE.
//
// This is the rule the whole art direction rests on: the camera is to the
// side, so one drawing plus a horizontal flip covers every heading, and
// rotating a side view would lay the character on its back. The regression
// this guards is someone reaching for `sprite.rotation = facing` again
// because the game is played from above -- so the test asserts the sign of
// scale.x and nothing else.

import test from 'node:test';
import assert from 'node:assert/strict';
import { faceSprite } from '../src/systems/sprites.js';

const BASE = 0.48;
const fake = () => ({ scale: { x: BASE }, __baseScale: BASE });

const E = 0;                       // east
const W = Math.PI;                 // west
const N = -Math.PI / 2;            // north (screen y grows down)
const S = Math.PI / 2;             // south

test('heading east faces right, heading west faces left', () => {
  const a = fake(); faceSprite(a, E);
  assert.equal(a.scale.x, BASE);

  const b = fake(); faceSprite(b, W);
  assert.equal(b.scale.x, -BASE);
});

test('a flip never changes the size, only the sign', () => {
  const s = fake();
  faceSprite(s, W);
  faceSprite(s, E);
  assert.equal(Math.abs(s.scale.x), BASE);
});

test('the diagonals pick the side they lean toward', () => {
  const ne = fake(); faceSprite(ne, -Math.PI / 4);
  assert.equal(ne.scale.x, BASE, 'north-east is still east');

  const sw = fake(); faceSprite(sw, (3 * Math.PI) / 4);
  assert.equal(sw.scale.x, -BASE, 'south-west is still west');
});

test('STRAIGHT UP AND DOWN DO NOT FLIP', () => {
  // Neither is left or right, so snapping one way makes the character
  // flicker between mirrors as the angle jitters across the boundary while
  // the player walks straight up. The sign is left wherever it was.
  for (const vertical of [N, S]) {
    const facingLeft = fake();
    faceSprite(facingLeft, W);
    faceSprite(facingLeft, vertical);
    assert.equal(facingLeft.scale.x, -BASE, 'kept facing left');

    const facingRight = fake();
    faceSprite(facingRight, E);
    faceSprite(facingRight, vertical);
    assert.equal(facingRight.scale.x, BASE, 'kept facing right');
  }
});

// ── SHEETS ARE NOT ALL DRAWN THE SAME WAY ───────────────────────────────────
//
// Every turtle was generated facing right. The Foot came back facing LEFT --
// its walk strip was generated from the original static sprite, and the
// reference image won over the word "RIGHT" in the prompt. Nothing in the
// file says so, so code that assumed "unmirrored means facing right" pointed
// the entire horde away from the player. They walked at him backwards, and
// it survived several screenshots because a chasing enemy reads as a
// silhouette, not as a face.

import { pointAt, SOURCE_FACING, TURTLES } from '../src/systems/sprites.js';

const drawn = (dir) => ({ scale: { x: BASE }, __baseScale: BASE, __srcFacing: dir });

test('A LEFT-DRAWN SHEET FACES THE WAY IT IS ASKED TO', () => {
  const foot = drawn(-1);
  pointAt(foot, -1);
  assert.equal(foot.scale.x, BASE, 'already drawn facing left: do not mirror');
  pointAt(foot, 1);
  assert.equal(foot.scale.x, -BASE, 'wants right, drawn left: mirror');
});

test('a right-drawn sheet still behaves as before', () => {
  const turtle = drawn(1);
  pointAt(turtle, 1);
  assert.equal(turtle.scale.x, BASE);
  pointAt(turtle, -1);
  assert.equal(turtle.scale.x, -BASE);
});

test('the two kinds of sheet end up pointing the SAME way on screen', () => {
  // The actual bug: with both asked to face left, the turtle and the Foot
  // must end up looking at each other, not past each other.
  for (const want of [-1, 1]) {
    const turtle = drawn(1);
    const foot = drawn(-1);
    pointAt(turtle, want);
    pointAt(foot, want);
    // same requested direction, opposite source art, so opposite mirror
    assert.equal(Math.sign(turtle.scale.x), -Math.sign(foot.scale.x),
                 `want ${want}: the two sheets should mirror oppositely`);
  }
});

test('a sprite with no declared source facing is treated as right-drawn', () => {
  const legacy = { scale: { x: BASE }, __baseScale: BASE };
  pointAt(legacy, 1);
  assert.equal(legacy.scale.x, BASE);
});

test('faceSprite routes through the same rule', () => {
  const foot = drawn(-1);
  faceSprite(foot, Math.PI);                  // heading west
  assert.equal(foot.scale.x, BASE, 'left-drawn sheet heading west is unmirrored');
  faceSprite(foot, 0);                        // heading east
  assert.equal(foot.scale.x, -BASE);
});

test('THE FOOT SHEET IS DECLARED LEFT-DRAWN AND THE TURTLES ARE NOT', () => {
  // The tests above prove pointAt's arithmetic, which was never the bug:
  // they pass a __srcFacing straight in, so they stay green whether or not
  // the registry is right. THIS is the assertion that actually fails if
  // somebody drops the Foot entry, which is the mistake that shipped.
  assert.equal(SOURCE_FACING.foot, -1, 'the Foot art faces left');
  for (const t of TURTLES) {
    assert.ok(!(t in SOURCE_FACING),
              `${t} is drawn facing right and should not be listed`);
  }
});
