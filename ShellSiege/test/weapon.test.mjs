// THE SAI: fast out, bounce, arc home, caught.
//
// A returning weapon has one failure mode that no screenshot catches and that
// quietly ruins a run: it never comes home. The bullet list fills with blades
// orbiting a player who has walked away, and the only symptom is the frame
// rate. So the tests here are mostly about the weapon ENDING.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { createWorld } = await import('../src/core/world.js');
const { updateFiring, updateBullets } = await import('../src/systems/combat.js');
const { WEAPONS, arcPoint } = await import('../src/core/weapon.js');

const gun = (over = {}) => ({
  fireIntervalS: 0.5, projectiles: 1, pierce: 0, damage: 10, rangePx: 900,
  weapon: WEAPONS.sai, ...over,
});

function crate(w, dx, dy, over = {}) {
  const t = {
    x: w.player.x + dx, y: w.player.y + dy, radius: 46,
    hp: 30, maxHp: 30, hitT: 0, alive: true, deadAtS: -Infinity, spin: 0, ...over,
  };
  w.targets.push(t);
  return t;
}

/** Run the sim until a predicate holds, or give up. Returns frames taken. */
function run(w, frames, fn) {
  for (let i = 0; i < frames; i++) {
    w.timeS += 1 / 60;
    updateBullets(w, 1 / 60);
    if (fn && fn(i)) return i;
  }
  return -1;
}

test('THE SAI FLIES FASTER THAN THE STAR -- they are different abilities', () => {
  assert.ok(WEAPONS.sai.speedMul > WEAPONS.star.speedMul * 1.5,
    `sai ${WEAPONS.sai.speedMul} vs star ${WEAPONS.star.speedMul}`);
});

test('IT BOUNCES INSTEAD OF DYING when it bites something', () => {
  const w = createWorld();
  crate(w, 300, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  assert.equal(b.mode, 'out');
  run(w, 200, () => b.mode === 'back');
  assert.equal(b.mode, 'back', 'it turned round');
  assert.equal(b.alive, true, 'and is still in the air, not spent');
});

test('AND IT COMES HOME, rather than orbiting forever', () => {
  // The one that matters. A weapon that never ends leaks a bullet per shot.
  const w = createWorld();
  crate(w, 300, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  const at = run(w, 600, () => !b.alive);
  assert.ok(at > 0, 'the sai never finished its return');
  assert.ok(b.t >= 1, 'it ended by being caught, not by expiring');
});

test('it comes back EVEN IF IT HITS NOTHING', () => {
  // A thrown weapon that simply vanishes at the end of its range reads as a
  // bug, and it is also a weapon the player has silently lost.
  const w = createWorld();
  updateFiring(w, gun({ rangePx: 300 }), 1);
  const b = w.bullets[0];
  assert.equal(w.bullets.length, 0, 'nothing in range means nothing thrown');
  crate(w, 2000, 0);                       // far away, out of reach
  updateFiring(w, gun({ rangePx: 2500 }), 1);
  const c = w.bullets[0];
  c.lifeS = 0.001;                         // fast-forward to the end of its reach
  run(w, 5);
  assert.equal(c.mode, 'back', 'it turned for home at the end of its range');
  assert.ok(run(w, 600, () => !c.alive) > 0, 'and got there');
});

test('THE RETURN LANDS ON THE PLAYER, wherever he has walked to', () => {
  const w = createWorld();
  crate(w, 300, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  run(w, 200, () => b.mode === 'back');
  // He walks away while it is coming back. The curve is rebuilt every frame
  // against where he is NOW, so it must still find him.
  let last = Infinity;
  for (let i = 0; i < 600 && b.alive; i++) {
    w.player.x += 4;
    w.player.y -= 3;
    w.timeS += 1 / 60;
    updateBullets(w, 1 / 60);
    if (b.alive) last = Math.hypot(b.x - w.player.x, b.y - w.player.y);
  }
  assert.equal(b.alive, false, 'it was caught');
  assert.ok(last < 140, `it finished ${last.toFixed(0)}px from a moving player`);
});

test('THE RETURN CAN CUT -- it is a blade, not a pickup', () => {
  const w = createWorld();
  const near = crate(w, 120, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  run(w, 200, () => b.mode === 'back');
  const hpAtTurn = near.hp;
  run(w, 600, () => !b.alive);
  assert.ok(near.hp < hpAtTurn, 'it hit something again on the way home');
});

test('and it cannot hit the SAME thing twice without turning round', () => {
  const w = createWorld();
  const t = crate(w, 300, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  run(w, 200, () => b.mode === 'back');
  assert.equal(t.hp, 990, 'exactly one bite on the way out');
});

test('PIERCE STILL WORKS, and the turn happens at the end of the line', () => {
  const w = createWorld();
  const a = crate(w, 150, 0, { hp: 1000, maxHp: 1000 });
  const c = crate(w, 300, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun({ pierce: 1 }), 1);
  const b = w.bullets[0];
  run(w, 300, () => b.mode === 'back');
  assert.equal(a.hp, 990);
  assert.equal(c.hp, 990, 'it went through the first and bit the second');
});

test('THE STAR IS UNCHANGED -- it is kept, not replaced', () => {
  const w = createWorld();
  const t = crate(w, 300, 0, { hp: 1000, maxHp: 1000 });
  updateFiring(w, gun({ weapon: WEAPONS.star }), 1);
  const b = w.bullets[0];
  assert.equal(b.returns, false);
  run(w, 400, () => !b.alive);
  assert.equal(b.alive, false);
  assert.equal(b.mode, 'out', 'a star never turns round');
});

// --- the arc ---------------------------------------------------------------

test('the arc STARTS AND ENDS exactly where it is told', () => {
  // A curve that misses its endpoints makes the weapon teleport on the frame
  // it turns and again on the frame it is caught.
  const a = arcPoint(10, 20, 300, -40, 0, 0.4, 1);
  assert.ok(Math.abs(a.x - 10) < 1e-9 && Math.abs(a.y - 20) < 1e-9);
  const b = arcPoint(10, 20, 300, -40, 1, 0.4, 1);
  assert.ok(Math.abs(b.x - 300) < 1e-9 && Math.abs(b.y + 40) < 1e-9);
});

test('IT ACTUALLY BOWS, rather than retracing the throw', () => {
  // A straight return reads as the throw played backwards, which is the one
  // shape the eye refuses to accept as "coming back".
  const mid = arcPoint(0, 0, 400, 0, 0.5, 0.38, 1);
  assert.ok(Math.abs(mid.y) > 50, `the midpoint only bowed ${mid.y.toFixed(1)}px`);
  const straight = arcPoint(0, 0, 400, 0, 0.5, 0, 1);
  assert.ok(Math.abs(straight.y) < 1e-9, 'and a zero bow is a straight line');
});

test('consecutive throws bow OPPOSITE ways', () => {
  const l = arcPoint(0, 0, 400, 0, 0.5, 0.38, 1);
  const r = arcPoint(0, 0, 400, 0, 0.5, 0.38, -1);
  assert.ok(l.y * r.y < 0, 'two sai in the air would trace the same line');
});

test('the bow scales with the distance home', () => {
  // So a short flick is a flick and a long return is a sweep, with no second
  // number to keep in step.
  const near = arcPoint(0, 0, 100, 0, 0.5, 0.38, 1);
  const far = arcPoint(0, 0, 800, 0, 0.5, 0.38, 1);
  assert.ok(Math.abs(far.y) > Math.abs(near.y) * 7);
});
