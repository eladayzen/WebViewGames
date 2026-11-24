// THE PICK (Elad, 24 Nov): every OTHER box is a choice between two different abilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuild } from '../src/core/abilities.js';
import { createWorld } from '../src/core/world.js';
import { createChoice, pickChoice, updateRoll, ROLL } from '../src/core/roll.js';
import { createRun, stepRun } from '../src/core/run.js';

const seeded = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

test('A CHOICE OFFERS TWO DIFFERENT ABILITIES, and waits for the player', () => {
  const b = createBuild();
  for (let i = 0; i < 50; i++) {
    const c = createChoice(b, seeded(i + 1), { room: 5 });
    assert.equal(c.phase, 'choose');
    assert.equal(c.choices.length, 2);
    assert.notEqual(c.choices[0], c.choices[1]);
  }
  const c = createChoice(b, seeded(3), { room: 5 });
  for (let i = 0; i < 600; i++) assert.equal(updateRoll(c, 1 / 60), false);     // ten seconds: still waiting
  assert.equal(c.phase, 'choose');
});

test('PICKING GOES ON TO THE REVEAL WITH THE CHOSEN ABILITY, then finishes', () => {
  const c = createChoice(createBuild(), seeded(9), { room: 5 });
  const want = c.choices[1];
  assert.equal(pickChoice(c, 1), want);
  assert.equal(c.key, want);
  let done = false;
  for (let t = 0; t < ROLL.spinS + ROLL.holdS + 0.5 && !done; t += 1 / 60) done = updateRoll(c, 1 / 60);
  assert.ok(done);
});

test('ONLY EVERY OTHER ROOM-END BOX IS A PICK in alt mode, and none in off mode', () => {
  const kinds = (choice) => {
    const w = createWorld(); const run = createRun({ choice, rng: seeded(2) });
    const out = [];
    for (let guard = 0; guard < 60 * 400 && out.length < 4; guard++) {
      for (const e of stepRun(run, w, 1 / 30, seeded(4))) {
        if (e.type === 'rollStart') { out.push(!!e.roll.choices); if (e.roll.choices) pickChoice(e.roll, 0); }
      }
      for (const f of w.foes) f.alive = false;
    }
    return out;
  };
  const alt = kinds('alt');
  assert.deepEqual(alt.slice(0, 2), [false, true]);
  assert.ok(kinds('off').every((x) => x === false));
});
