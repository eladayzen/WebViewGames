// THE BONE MASK: which half of the body the throw is allowed to move.
//
// The failure this guards against is not a crash. A mis-masked rig still
// animates -- it just walks with one leg, or throws with its hips, or quietly
// freezes a limb in the bind pose. All three look like a different bug, and
// none of them show up as an error anywhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { maskFor, boneOf, bucketize, bonesIn, sliceClip, MASK_RULES } =
  await import('../src/render/mask.js');

const CLIPS = 'public/models/clips.json';

test('EVERY BONE IN THE SHIPPED CLIPS IS CLASSIFIED', () => {
  // The rule that makes the rest safe. An unclassified bone is dropped from
  // every bucket, so it never animates at all -- a limb frozen in the bind
  // pose, with nothing logged. Asserting against the real clip data means a
  // re-rig or a new clip that introduces a bone has to come here first.
  if (!existsSync(CLIPS)) return;      // extractor has not been run
  const data = JSON.parse(readFileSync(CLIPS, 'utf8'));
  const unclaimed = [...bonesIn(data)].filter((b) => maskFor(b) === null);
  assert.deepEqual(unclaimed, [], `bones no rule claims:\n${unclaimed.join('\n')}`);
});

test('THE LEGS AND HIPS ARE THE WALK\'S, outright', () => {
  // If any of these ever picks up a non-zero mask, the throw starts moving the
  // legs and the character throws with his feet.
  for (const b of [
    'mixamorigHips',
    'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
    'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase',
  ]) {
    assert.equal(maskFor(b), 0, b);
  }
});

test('THE ARMS AND HEAD ARE THE THROW\'S, outright', () => {
  for (const b of [
    'mixamorigNeck', 'mixamorigHead',
    'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
    'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
    'mixamorigRightHandThumb1', 'mixamorigLeftHandPinky3', 'mixamorigRightHandIndex2',
  ]) {
    assert.equal(maskFor(b), 1, b);
  }
});

test('the SPINE IS GRADED, so the waist is not a hard line', () => {
  const s = maskFor('mixamorigSpine');
  const s1 = maskFor('mixamorigSpine1');
  const s2 = maskFor('mixamorigSpine2');
  assert.ok(s > 0 && s < 1, `Spine ${s}`);
  assert.ok(s < s1 && s1 < s2, `${s} ${s1} ${s2} must climb toward the arms`);
  assert.equal(s2, 1);
});

test('BUCKETS PARTITION THE BONES -- none lost, none counted twice', () => {
  const bones = ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
    'mixamorigLeftLeg', 'mixamorigRightHand', 'mixamorigHead'];
  const buckets = bucketize(bones);
  const seen = [];
  for (const b of buckets) seen.push(...b.bones);
  assert.equal(seen.length, bones.length, 'a bone landed in two buckets or none');
  assert.deepEqual([...seen].sort(), [...bones].sort());
});

test('buckets come back in ascending mask order', () => {
  const b = bucketize(['mixamorigHead', 'mixamorigHips', 'mixamorigSpine1', 'mixamorigSpine']);
  assert.deepEqual(b.map((x) => x.m), [0, 0.5, 0.75, 1]);
});

test('A SLICE CARRIES ONLY ITS OWN TRACKS', () => {
  const json = {
    uuid: 'abc', name: 'walk_f', duration: 1, tracks: [
      { name: 'mixamorigHips.position' },
      { name: 'mixamorigLeftLeg.quaternion' },
      { name: 'mixamorigRightHand.quaternion' },
    ],
  };
  const lower = sliceClip(json, new Set(['mixamorigHips', 'mixamorigLeftLeg']), 0);
  assert.deepEqual(lower.tracks.map((t) => t.name),
    ['mixamorigHips.position', 'mixamorigLeftLeg.quaternion']);
  assert.equal(lower.duration, 1, 'duration survives the slice');
});

test('EVERY SLICE GETS ITS OWN UUID -- the mixer caches actions by it', () => {
  // Four slices sharing their parent's uuid all resolve to the SAME action, so
  // three of the four layers silently do nothing and the mask appears to be
  // ignored. Nothing throws; the character simply throws with his whole body.
  const json = { uuid: 'abc', name: 'walk_f', duration: 1, tracks: [] };
  const ids = [0, 1, 2, 3].map((i) => sliceClip(json, new Set(), i).uuid);
  assert.equal(new Set(ids).size, 4, ids.join(' '));
  assert.ok(ids.every((id) => id !== 'abc'), 'and none of them reuses the parent uuid');
});

test('boneOf strips the property off a track name', () => {
  assert.equal(boneOf('mixamorigSpine.quaternion'), 'mixamorigSpine');
  assert.equal(boneOf('mixamorigHips.position'), 'mixamorigHips');
  assert.equal(boneOf('mixamorigHips'), 'mixamorigHips');
});

test('the rules are ordered so a specific one wins over a general one', () => {
  // `mixamorigLeftHand` must not be swallowed by a rule meant for the legs,
  // and `Spine1` must not be caught by the bare `Spine` rule.
  assert.equal(maskFor('mixamorigSpine1'), 0.75);
  assert.equal(maskFor('mixamorigLeftHandRing2'), 1);
  assert.ok(MASK_RULES.length > 0);
});
