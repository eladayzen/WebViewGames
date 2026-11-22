// THE ROLL. No input, so the things worth testing are the guard rails: it must
// never hand over something useless, it must lean toward what you lack, and it
// must be over inside Elad's two seconds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, createBuild, take } from '../src/core/abilities.js';
import { ROLL, rollWeights, rollAbility, createRoll, updateRoll, rollDurationS } from '../src/core/roll.js';

/** A deterministic rng, so a failure is reproducible rather than a story. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const maxOut = (b, k) => { for (let i = 0; i < ABILITIES[k].max; i++) take(b, k); return b; };

test('A MAXED ABILITY IS NEVER ROLLED', () => {
  // A reveal of something that does nothing is the worst outcome this has.
  const b = maxOut(createBuild(), 'pierce');
  const rng = seeded(3);
  for (let i = 0; i < 1000; i++) assert.notEqual(rollAbility(b, rng), 'pierce');
});

test('WITH EVERYTHING MAXED THE ROLL IS NULL, and a roll made then is born done', () => {
  const b = createBuild();
  for (const k of Object.keys(ABILITIES)) maxOut(b, k);
  assert.equal(rollAbility(b, seeded(1)), null);
  const r = createRoll(b, seeded(1));
  assert.equal(r.key, null);
  assert.equal(r.done, true, 'otherwise the run waits two seconds on an empty box');
});

test('EVERY ABILITY CAN COME UP -- no entry is dead weight', () => {
  const seen = new Set();
  const rng = seeded(11);
  for (let i = 0; i < 3000; i++) seen.add(rollAbility(createBuild(), rng));
  for (const k of Object.keys(ABILITIES)) assert.ok(seen.has(k), `${k} never rolled`);
});

test('OWNING COPIES MAKES AN ABILITY LESS LIKELY, but never impossible', () => {
  const fresh = rollWeights(createBuild());
  const b = createBuild();
  take(b, 'rapid'); take(b, 'rapid'); take(b, 'rapid');
  const owned = rollWeights(b);
  assert.ok(owned.rapid < fresh.rapid, 'a third copy is no more likely than the first');
  assert.ok(owned.rapid > 0, 'but it must still be possible');
  assert.equal(owned.damage, fresh.damage, 'and nothing else moved');
});

test('THE ROLL LEANS TOWARD WHAT YOU DO NOT HAVE', () => {
  // rapid and damage share a base weight, so any gap is the falloff alone.
  const b = createBuild();
  for (let i = 0; i < 4; i++) take(b, 'rapid');
  assert.equal(ABILITIES.rapid.weight, ABILITIES.damage.weight);
  const rng = seeded(21);
  let rapid = 0, damage = 0;
  for (let i = 0; i < 6000; i++) {
    const k = rollAbility(b, rng);
    if (k === 'rapid') rapid++;
    if (k === 'damage') damage++;
  }
  assert.ok(rapid < damage * 0.6, `rapid ${rapid} vs damage ${damage}: no real lean`);
});

test('THE RESULT IS FIXED AT CREATION -- the animation is a playback, not a draw', () => {
  const b = createBuild();
  const r = createRoll(b, seeded(5));
  const expected = rollAbility(b, seeded(5));
  assert.equal(r.key, expected);
  for (let i = 0; i < 200; i++) updateRoll(r, 1 / 60);
  assert.equal(r.key, expected, 'running the clock changed what was rolled');
});

test('IT IS OVER IN TWO SECONDS, which was Elad\'s ceiling', () => {
  assert.ok(rollDurationS() <= 2.0, `${rollDurationS()}s`);
  assert.ok(ROLL.spinS > 0 && ROLL.holdS > 0, 'a roll with no anticipation or no reveal is not one');
});

test('a roll goes spin -> reveal -> done, and reports finishing exactly once', () => {
  const r = createRoll(createBuild(), seeded(2));
  assert.equal(r.phase, 'spin');
  let finished = 0, sawReveal = false;
  for (let t = 0; t < 4; t += 1 / 60) {
    if (updateRoll(r, 1 / 60)) finished++;
    if (r.phase === 'reveal') sawReveal = true;
  }
  assert.equal(finished, 1, 'the run would take the ability twice, or never');
  assert.ok(sawReveal);
  assert.equal(r.phase, 'done');
  assert.equal(r.done, true);
  assert.equal(updateRoll(r, 1), false, 'a finished roll must stay finished');
});
