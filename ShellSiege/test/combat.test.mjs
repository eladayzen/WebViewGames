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

// ---- SPLIT SHOT MUST HIT -----------------------------------------------------------
// Elad: aimed at an enemy, the two blades split to either side of it and mostly missed.
test('SPLIT SHOT ALWAYS HAS A BLADE ON THE AIM LINE: two blades at one enemy do not both miss it', () => {
  for (const n of [2, 3, 4]) {
    const w = createWorld();
    crate(w, 600, 0, { radius: 40 });
    updateFiring(w, gun({ projectiles: n }), 1);
    const angles = w.bullets.map((b) => Math.atan2(b.vy, b.vx));
    assert.ok(angles.some((a) => Math.abs(a) < 1e-9), `${n} blades and none dead on`);
  }
});

test('SPLIT SHOT AT A CROWD SENDS EACH BLADE AT A DIFFERENT ENEMY', () => {
  const w = createWorld();
  const a = crate(w, 400, 0), b = crate(w, 0, 500), c = crate(w, -700, 0);
  updateFiring(w, gun({ projectiles: 3 }), 1);
  const aim = (t) => Math.atan2(t.y - w.player.y, t.x - w.player.x);
  const got = w.bullets.map((x) => Math.atan2(x.vy, x.vx));
  for (const t of [a, b, c]) assert.ok(got.some((g) => Math.abs(g - aim(t)) < 1e-9), 'an enemy got no blade');
});

test('IN PLAY: two blades at one enemy at long range hit it, every time', () => {
  for (const dist of [300, 600, 850]) {
    const w = createWorld();
    const t = crate(w, dist, 0, { radius: 40, hp: 1000, maxHp: 1000 });
    updateFiring(w, gun({ projectiles: 2 }), 1);
    for (let i = 0; i < 120; i++) updateBullets(w, 1 / 60);
    assert.ok(t.hp < 1000, `missed at ${dist}px`);
  }
});

// ---- THE QUIVER AND THE STARS ---------------------------------------------------------
test('A DAGGER IS NOT THROWN WHILE THE QUIVER IS EMPTY, and the second one needs the unlock', () => {
  const w = createWorld(); crate(w, 300, 0);
  updateFiring(w, gun({ quiver: 1 }), 1);
  updateFiring(w, gun({ quiver: 1 }), 1);
  assert.equal(w.bullets.filter((b) => b.alive).length, 1, 'a second dagger left with one in the air');
  const w2 = createWorld(); crate(w2, 300, 0);
  updateFiring(w2, gun({ quiver: 2 }), 1);
  updateFiring(w2, gun({ quiver: 2 }), 1);
  assert.equal(w2.bullets.filter((b) => b.alive).length, 2);
  updateFiring(w2, gun({ quiver: 2 }), 1);
  assert.equal(w2.bullets.filter((b) => b.alive).length, 2, 'a third dagger left');
});

test('STARS FIRE ON THEIR OWN CLOCK, FLY WITHOUT RETURNING, AND DO NOT BLOCK THE DAGGER', () => {
  const w = createWorld(); crate(w, 300, 0);
  const st = gun({ quiver: 1, stars: { intervalS: 1, count: 3, damage: 5, rangePx: 900 } });
  updateFiring(w, st, 0.01);
  const stars = w.bullets.filter((b) => b.kind === 'star'), daggers = w.bullets.filter((b) => b.kind === 'dagger');
  assert.equal(stars.length, 3);
  assert.equal(daggers.length, 1, 'stars blocked the dagger');
  assert.ok(stars.every((b) => !b.returns && b.damage === 5));
  updateFiring(w, st, 0.5);
  assert.equal(w.bullets.filter((b) => b.kind === 'star').length, 3, 'stars fired before their interval');
});

test('WALLS STOP PROJECTILES: a star dies on one, a dagger bounces home, and an edge does too', () => {
  const w = createWorld();
  w.obstacles = [{ kind: 'rect', x: w.player.x + 300, y: w.player.y, hw: 40, hh: 300, tall: true }];
  const star = { x: w.player.x + 200, y: w.player.y, vx: 900, vy: 0, alive: true, pierce: 0, damage: 5, lifeS: 3, hit: new Set(), kind: 'star', returns: false, mode: 'out', t: 0 };
  const dag = { x: w.player.x + 200, y: w.player.y + 50, vx: 900, vy: 0, alive: true, pierce: 0, damage: 5, lifeS: 3, hit: new Set(), kind: 'dagger', returns: true, returnSpeedPxS: 1500, bow: 0, side: 1, mode: 'out', t: 0 };
  w.bullets.push(star, dag);
  for (let i = 0; i < 30; i++) updateBullets(w, 1 / 60);
  assert.equal(star.alive, false, 'a star flew through a wall');
  assert.equal(dag.mode, 'back', 'a dagger went through a wall');
  const w2 = createWorld();
  const edge = { x: 5, y: 1800, vx: -900, vy: 0, alive: true, pierce: 0, damage: 5, lifeS: 3, hit: new Set(), kind: 'star', returns: false, mode: 'out', t: 0 };
  w2.bullets.push(edge);
  for (let i = 0; i < 10; i++) updateBullets(w2, 1 / 60);
  assert.equal(edge.alive, false, 'a star left the arena');
});

// ---- enemy projectiles (Elad, 25 Nov) ----
import { DEV, nearestTarget as nearestT } from '../src/systems/combat.js';
test('A DAGGER CUTS AN ENEMY PROJECTILE IT TOUCHES AND FLIES ON THROUGH IT', async () => {
  const { createWorld } = await import('../src/core/world.js');
  const { updateBullets } = await import('../src/systems/combat.js');
  const w = createWorld();
  w.foeShots.push({ x: 500, y: 500, r: 20, alive: true, vx: 0, vy: 0, lifeS: 9, damage: 1 });
  w.bullets.push({ x: 440, y: 500, vx: 1500, vy: 0, alive: true, pierce: 0, damage: 10, lifeS: 2, hit: new Set(), kind: 'dagger', returns: true, mode: 'out', t: 0, bow: 0, side: 1, returnSpeedPxS: 1500 });
  let cut = 0;
  for (let i = 0; i < 12; i++) updateBullets(w, 1 / 60, () => {}, () => cut++);
  assert.equal(cut, 1);
  assert.equal(w.foeShots[0].alive, false);
  assert.equal(w.bullets[0].mode, 'out', 'the blade must carry on, not bounce');
  assert.ok(w.bullets[0].x > 540);
});

test('THE AUTO-AIM IGNORES ENEMY PROJECTILES BY DEFAULT, and picks them when the dev option is on', async () => {
  const { createWorld } = await import('../src/core/world.js');
  const w = createWorld();
  w.targets.length = 0;
  w.foeShots.push({ x: w.player.x + 200, y: w.player.y, r: 20, alive: true });
  DEV.aimShots = false;
  assert.equal(nearestT(w, 900), null);
  DEV.aimShots = true;
  assert.ok(nearestT(w, 900));
  DEV.aimShots = false;
});
