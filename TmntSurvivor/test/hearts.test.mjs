// Dropped hearts: how often, and the fact that they do not come to you.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { killEnemy, updateHearts, HEART } = await import('../src/systems/horde.js');

const world = () => ({
  player: { x: 0, y: 0 }, playerRadius: 42,
  gems: [], hearts: [], kills: 0,
});

test('a kill always drops a gem and sometimes a heart', () => {
  const w = world();
  for (let i = 0; i < 1000; i++) killEnemy(w, { x: 0, y: 0, alive: true }, () => 0.99);
  assert.equal(w.gems.length, 1000);
  assert.equal(w.hearts.length, 0, 'an unlucky roll drops nothing');

  const w2 = world();
  for (let i = 0; i < 1000; i++) killEnemy(w2, { x: 0, y: 0, alive: true }, () => 0);
  assert.equal(w2.hearts.length, 1000, 'a lucky roll always drops');
});

test('the drop is rare enough to be an event', () => {
  assert.ok(HEART.dropChance > 0 && HEART.dropChance <= 0.15);
});

test('A HEART DOES NOT COME TO YOU -- you have to walk to it', () => {
  // The whole design of hearts: gems are a reward, a heart is a decision.
  // Magnetising them would make them gems in a different colour.
  const w = world();
  w.hearts.push({ x: 300, y: 0, alive: true });
  const before = { ...w.hearts[0] };
  let healed = 0;
  for (let i = 0; i < 120; i++) updateHearts(w, () => healed++);
  assert.deepEqual({ x: w.hearts[0].x, y: w.hearts[0].y }, { x: before.x, y: before.y },
    'it must not drift toward the player');
  assert.equal(healed, 0, 'and must not be collected at a distance');
});

test('walking onto one collects it, once', () => {
  const w = world();
  w.hearts.push({ x: 20, y: 0, alive: true });
  let healed = 0;
  updateHearts(w, () => healed++);
  updateHearts(w, () => healed++);
  assert.equal(healed, 1);
  assert.equal(w.hearts[0].alive, false);
});
