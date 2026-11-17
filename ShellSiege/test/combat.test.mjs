// THE GUN, ported. Survivor's own tests, pointed at crates instead of ninjas.
//
// These are not new assertions -- they are the ones that were already earning
// their keep in TMNT Survivor, kept because the port is exactly the moment a
// working system quietly stops working.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.location = { search: '' };

const { createWorld } = await import('../src/core/world.js');
const { updateFiring, updateBullets } = await import('../src/systems/combat.js');
const { createTargets, updateTargets, CRATE } = await import('../src/systems/targets.js');

const gun = (over = {}) => ({
  fireIntervalS: 0.5, projectiles: 1, pierce: 0, damage: 10, rangePx: 900, ...over,
});

function crate(w, dx, dy, over = {}) {
  const t = {
    x: w.player.x + dx, y: w.player.y + dy, radius: 46,
    hp: 30, maxHp: 30, hitT: 0, alive: true, deadAtS: -Infinity, spin: 0,
    home: { x: w.player.x + dx, y: w.player.y + dy }, ...over,
  };
  w.targets.push(t);
  return t;
}

test('SHOTS SPAWN AT THE HAND, not at the player', () => {
  const w = createWorld();
  w.muzzle = { x: w.player.x + 60, y: w.player.y - 20 };
  crate(w, 400, 0);
  updateFiring(w, gun(), 1);
  assert.equal(w.bullets.length, 1);
  assert.equal(w.bullets[0].x, w.muzzle.x);
  assert.equal(w.bullets[0].y, w.muzzle.y);
});

test('and they are AIMED from the hand too, not merely spawned there', () => {
  // Spawning at the hand while aiming along the centre-to-target line makes a
  // shot visibly miss what it was pointed at, worst at close range.
  const w = createWorld();
  w.muzzle = { x: w.player.x, y: w.player.y - 100 };
  const t = crate(w, 100, 0);
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  assert.ok(b.vy > 0, 'the star angles down toward the crate from the hand');
  const ang = Math.atan2(t.y - w.muzzle.y, t.x - w.muzzle.x);
  assert.ok(Math.abs(Math.atan2(b.vy, b.vx) - ang) < 1e-9);
});

test('WITH NO MUZZLE PUBLISHED the player stands in, and nothing crashes', () => {
  // Every headless test and the first frame of a run are in this state.
  const w = createWorld();
  assert.equal(w.muzzle, null, 'premise: a fresh world has no muzzle yet');
  crate(w, 300, 0);
  updateFiring(w, gun(), 1);
  assert.equal(w.bullets[0].x, w.player.x);
});

test('A VOLLEY ALL LEAVES THE SAME HAND', () => {
  // Three stars appearing at three points in mid-air is not one throw.
  const w = createWorld();
  w.muzzle = { x: w.player.x + 60, y: w.player.y - 20 };
  crate(w, 400, 0);
  updateFiring(w, gun({ projectiles: 3 }), 1);
  assert.equal(w.bullets.length, 3);
  for (const b of w.bullets) {
    assert.equal(b.x, w.muzzle.x);
    assert.equal(b.y, w.muzzle.y);
  }
  assert.equal(new Set(w.bullets.map((b) => Math.atan2(b.vy, b.vx))).size, 3, 'while still fanning out');
});

test('IT SHOOTS THE NEAREST CRATE, which is the only rule a player can predict', () => {
  const w = createWorld();
  crate(w, 600, 0);
  const near = crate(w, 0, 150);
  updateFiring(w, gun(), 1);
  const b = w.bullets[0];
  assert.ok(Math.abs(b.vy) > Math.abs(b.vx), 'aimed at the close one, not the first one');
  assert.ok(b.vy > 0);
  assert.equal(near.alive, true);
});

test('out of range it holds its fire rather than throwing at nothing', () => {
  const w = createWorld();
  crate(w, 1200, 0);
  updateFiring(w, gun({ rangePx: 620 }), 1);
  assert.equal(w.bullets.length, 0);
});

test('A STAR CANNOT HIT THE SAME CRATE TWICE on its way through', () => {
  const w = createWorld();
  const t = crate(w, 100, 0, { hp: 1000, maxHp: 1000 });
  w.bullets.push({
    x: t.x - 10, y: t.y, vx: 100, vy: 0, alive: true,
    pierce: 5, damage: 10, lifeS: 9, hit: new Set(),
  });
  for (let i = 0; i < 20; i++) updateBullets(w, 1 / 60);
  assert.equal(t.hp, 990, 'ten damage, once, however many frames it sat inside');
});

test('a broken crate STANDS BACK UP, so the range never runs dry', () => {
  const w = createWorld();
  w.targets = createTargets(1, 14);
  const t = w.targets[0];
  t.alive = false;
  t.deadAtS = 0;
  w.timeS = CRATE.respawnS - 0.01;
  updateTargets(w, 0.016);
  assert.equal(t.alive, false, 'not before its time');
  w.timeS = CRATE.respawnS + 0.01;
  updateTargets(w, 0.016);
  assert.equal(t.alive, true);
  assert.equal(t.hp, t.maxHp, 'and at full health, not at the health it died on');
});

test('THE RANGE IS LAID OUT AROUND THE PLAYER, not scattered into the corners', () => {
  const w = createWorld();
  const ts = createTargets(7, 14);
  // 14 explicitly, NOT CRATE.count: the default is 0 now that the Foot Clan
  // exists, and asserting against the default would make this test pass by
  // comparing nothing to nothing.
  assert.equal(ts.length, 14);
  for (const t of ts) {
    const d = Math.hypot(t.x - w.player.x, t.y - w.player.y);
    assert.ok(d >= CRATE.minR - 1 && d <= CRATE.maxR + 1, `crate at ${d.toFixed(0)}px`);
  }
});

test('the same seed lays out the same range, so a reload is comparable', () => {
  const a = createTargets(42, 14).map((t) => [t.x, t.y]);
  const b = createTargets(42, 14).map((t) => [t.x, t.y]);
  assert.deepEqual(a, b);
});

test('THE KILL IS ALREADY RESOLVED WHEN onHit IS CALLED', () => {
  // This was wrong for a while and nothing failed. onHit fired before the
  // hp check, so a caller asking "did that kill it?" always got false, which
  // silently disabled the kill counter, the XP feeding the level-up screen,
  // and the death burst. None of them throw when they never run.
  const w = createWorld();
  const t = { kind: 'foe', x: 100, y: 0, radius: 40, hp: 5, maxHp: 5, alive: true, hitT: 0, deadAtS: -Infinity };
  w.targets = [t];
  w.bullets = [{
    x: 100, y: 0, dx: 1, dy: 0, speed: 0, t: 0, mode: 'out', alive: true,
    lifeS: 1, ageS: 0, damage: 10, pierce: 0, returns: false, hit: new Set(),
  }];
  let aliveInsideCallback = null;
  updateBullets(w, 1 / 60, (e) => { aliveInsideCallback = e.alive; });
  assert.equal(aliveInsideCallback, false, 'onHit saw the target still alive');
  assert.equal(t.alive, false);
});
