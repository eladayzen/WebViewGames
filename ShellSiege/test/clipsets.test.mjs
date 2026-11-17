// THE SWITCHES: which idle, which gait. A bad name must never be a blank screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { WALK_SETS, IDLES, pickWalkSet, pickIdle, clipsOf, CLIP_ALIAS, shippedClips } =
  await import('../src/core/clipsets.js');

const have = existsSync('public/models/clips.json')
  ? new Set(Object.keys(JSON.parse(readFileSync('public/models/clips.json', 'utf8'))))
  : null;

test('THE CLIPS THE DEFAULTS NEED ARE ACTUALLY SHIPPED', () => {
  // The extractor trims to these; everything else needs `--all`. If this ever
  // fails the character loses a limb's motion with nothing logged.
  if (!have) return;
  const missing = shippedClips().filter((c) => !have.has(c));
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('EVERY CLIP A SET NAMES EITHER SHIPS OR HAS A STAND-IN', () => {
  // The real invariant now that the build is trimmed. A name that neither
  // ships nor aliases resolves to an undefined action, which is the silent
  // frozen-limb failure.
  if (!have) return;
  const orphans = [];
  for (const [name, set] of Object.entries(WALK_SETS)) {
    for (const idle of Object.values(IDLES)) {
      for (const c of clipsOf(set, idle)) {
        if (!have.has(c) && !have.has(CLIP_ALIAS[c])) orphans.push(`${name}/${idle}: ${c}`);
      }
    }
  }
  assert.deepEqual(orphans, [], orphans.join('\n'));
});

test('no set aliases two of its own slots onto one clip', () => {
  // Two directions sharing one action means two layer weights written to the
  // same object every frame, and the second one wins at random.
  const resolve = (c) => (have && have.has(c) ? c : CLIP_ALIAS[c] || c);
  for (const [name, set] of Object.entries(WALK_SETS)) {
    const got = ['f', 'b', 'l', 'r'].map((k) => resolve(set[k]));
    assert.equal(new Set(got).size, 4, `${name} collapses to ${got.join(', ')}`);
  }
});

test('every alias points at something that really ships', () => {
  if (!have) return;
  for (const [from, to] of Object.entries(CLIP_ALIAS)) {
    assert.ok(have.has(to), `${from} stands in with ${to}, which is not shipped either`);
  }
});

test('AN UNKNOWN NAME FALLS BACK rather than breaking the rig', () => {
  assert.equal(pickWalkSet('nonsense'), WALK_SETS.crouch);
  assert.equal(pickWalkSet(null), WALK_SETS.crouch);
  assert.equal(pickWalkSet(undefined), WALK_SETS.crouch);
  assert.equal(pickIdle('nonsense'), IDLES.a);
  assert.equal(pickIdle(null), IDLES.a);
});

test('ONLY THE CROUCH SET IS A NATIVE FOUR-WAY SET, and it says so', () => {
  // The others borrow its sideways clips. Marked in the data so the readme and
  // the code cannot drift apart about which gait is really being auditioned.
  assert.equal(WALK_SETS.crouch.native4, true);
  for (const [name, set] of Object.entries(WALK_SETS)) {
    if (name === 'crouch') continue;
    assert.equal(set.native4, false, name);
    assert.equal(set.l, WALK_SETS.crouch.l, `${name} borrows the sideways clips`);
    assert.equal(set.r, WALK_SETS.crouch.r, name);
  }
});

test('every set fills all four slots', () => {
  for (const [name, set] of Object.entries(WALK_SETS)) {
    for (const k of ['f', 'b', 'l', 'r']) {
      assert.ok(typeof set[k] === 'string' && set[k], `${name}.${k}`);
    }
  }
});

test('the two idles are different clips', () => {
  assert.notEqual(IDLES.a, IDLES.b);
});

test('each set has its own forward gait -- that is the point of switching', () => {
  const fs = Object.values(WALK_SETS).map((s) => s.f);
  assert.equal(new Set(fs).size, fs.length, fs.join(' '));
});
