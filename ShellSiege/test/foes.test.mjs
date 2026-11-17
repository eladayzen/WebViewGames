// The Foot Clan exists to answer one board question -- can a player SEE a
// swing coming and step out of it -- so the tests are about the telegraph and
// about the two arrays staying one truth, not about pathing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ARENA } from '../src/core/world.js';
import { FOE, makeFoe, spawnPoint, maybeSpawn, updateFoes, hurtPlayer } from '../src/core/foes.js';

function worldWithFoe(dx, dy) {
  const w = createWorld();
  const f = makeFoe(w.player.x + dx, w.player.y + dy, 0);
  w.foes.push(f);
  w.targets.push(f);
  return { w, f };
}

/** Step the sim in small slices, the way the frame loop does. */
function run(w, seconds, dt = 1 / 60, onStrike) {
  for (let t = 0; t < seconds; t += dt) {
    w.timeS += dt;
    updateFoes(w, dt, onStrike);
  }
}

test('a foe walks AT the player and stops at its reach', () => {
  const { w, f } = worldWithFoe(900, 0);
  run(w, 6);
  const d = Math.hypot(f.x - w.player.x, f.y - w.player.y);
  assert.ok(d <= FOE.reach + 1, `stopped at ${d.toFixed(0)}px, reach is ${FOE.reach}`);
});

test('IT TELEGRAPHS BEFORE IT HITS -- the whole experiment', () => {
  const { w } = worldWithFoe(FOE.reach - 5, 0);
  // Step just short of the windup: it must have committed to a swing and NOT
  // yet taken anything. An enemy that damages on contact cannot be dodged, and
  // cannot tell us whether the board is responsive enough to dodge with.
  run(w, FOE.windupS - 0.05);
  assert.equal(w.foes[0].state, 'windup');
  assert.equal(w.hp, w.maxHp, 'damage landed before the telegraph finished');
});

test('and then it does hit', () => {
  const { w } = worldWithFoe(FOE.reach - 5, 0);
  let struck = 0;
  run(w, FOE.windupS + 0.1, 1 / 60, () => struck++);
  assert.equal(struck, 1);
  assert.equal(w.hp, w.maxHp - FOE.damage);
});

test('STEPPING OUT OF REACH DURING THE WINDUP IS A DODGE', () => {
  const { w, f } = worldWithFoe(FOE.reach - 5, 0);
  run(w, FOE.windupS - 0.08);
  assert.equal(f.state, 'windup');
  // The player walks away mid-swing. The strike re-measures on the release
  // frame, so this has to miss -- if it does not, the telegraph is decoration.
  w.player.x -= FOE.reach + FOE.strikeSlack + 60;
  run(w, 0.2);
  assert.equal(w.hp, w.maxHp, 'the swing connected from out of range');
});

test('but a near miss still lands, so one pixel is not the difference', () => {
  const { w } = worldWithFoe(FOE.reach - 5, 0);
  run(w, FOE.windupS - 0.08);
  w.player.x -= FOE.strikeSlack - 10;     // drifted, but only just
  run(w, 0.2);
  assert.equal(w.hp, w.maxHp - FOE.damage);
});

test('it does not swing forever -- there is a recovery before the next one', () => {
  const { w } = worldWithFoe(FOE.reach - 5, 0);
  let struck = 0;
  run(w, FOE.windupS + 0.05, 1 / 60, () => struck++);
  assert.equal(struck, 1);
  run(w, FOE.recoverS - 0.1, 1 / 60, () => struck++);
  assert.equal(struck, 1, 'a second hit landed inside the recovery');
});

test('running out of health ends the run exactly once', () => {
  const w = createWorld();
  for (let i = 0; i < 50; i++) hurtPlayer(w, 10);
  assert.equal(w.hp, 0);
  assert.equal(w.dead, true);
  const at = w.diedAtS;
  hurtPlayer(w, 10);
  assert.equal(w.diedAtS, at, 'death time moved after the player was already dead');
});

test('a dead foe is removed from BOTH arrays, never one', () => {
  // They are the same objects seen two ways; one array outliving the other is
  // the failure this arrangement has to be protected from.
  const { w, f } = worldWithFoe(300, 0);
  f.alive = false;
  f.deadAtS = 0;
  w.timeS = FOE.corpseS + 1;
  updateFoes(w, 1 / 60);
  assert.equal(w.foes.length, 0);
  assert.equal(w.targets.includes(f), false);
});

test('a corpse is NOT culled while it is still playing its death', () => {
  const { w, f } = worldWithFoe(300, 0);
  f.alive = false;
  f.deadAtS = 0;
  w.timeS = FOE.corpseS * 0.5;
  updateFoes(w, 1 / 60);
  assert.equal(w.foes.length, 1);
});

test('they spawn OFF SCREEN, not on top of you', () => {
  const w = createWorld();
  for (let i = 0; i < 40; i++) {
    const p = spawnPoint(w.player.x, w.player.y, Math.random);
    const d = Math.hypot(p.x - w.player.x, p.y - w.player.y);
    // Half a 20-unit view is 1000 sim px; anything closer walks into frame
    // already on top of the player.
    assert.ok(d > 1000, `spawned ${d.toFixed(0)}px away`);
    assert.ok(p.x >= 0 && p.x <= ARENA.width && p.y >= 0 && p.y <= ARENA.height);
  }
});

test('a player jammed into a corner still gets enemies', () => {
  // Every ring angle clamps against a wall here, which is exactly the case the
  // naive version answers by spawning nothing and leaving the arena empty.
  const p = spawnPoint(FOE.radius + 10, FOE.radius + 10, () => 0.5);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  const d = Math.hypot(p.x - FOE.radius, p.y - FOE.radius);
  assert.ok(d > 1000, `corner spawn landed ${d.toFixed(0)}px away`);
});

test('the spawner respects the cap and the interval', () => {
  const w = createWorld();
  // Far more time than it needs, so only the cap can hold the number down.
  for (let i = 0; i < 2000; i++) { w.timeS += 0.05; maybeSpawn(w, 0.05); }
  assert.equal(w.foes.length, FOE.maxAlive);
  assert.equal(w.targets.length, FOE.maxAlive);
});

test('a new foe lands in targets so the gun can see it without being told', () => {
  // This is the reason the whole thing is small: aiming, pierce, the sai's
  // bounce and the hit flash all work on foes with no combat change at all.
  const w = createWorld();
  w.spawnT = FOE.spawnEveryS;
  const f = maybeSpawn(w, 0.016);
  assert.ok(f);
  assert.equal(w.targets.at(-1), f);
  assert.equal(typeof f.hp, 'number');
  assert.equal(typeof f.radius, 'number');
});

test('a crowd does not converge into one body', () => {
  const w = createWorld();
  for (let i = 0; i < 6; i++) {
    const f = makeFoe(w.player.x + 600 + i, w.player.y + i, 0);
    w.foes.push(f); w.targets.push(f);
  }
  run(w, 5);
  for (let i = 0; i < w.foes.length; i++) {
    for (let j = i + 1; j < w.foes.length; j++) {
      const d = Math.hypot(w.foes[i].x - w.foes[j].x, w.foes[i].y - w.foes[j].y);
      assert.ok(d > FOE.radius, `two foes ${d.toFixed(0)}px apart -- they merged`);
    }
  }
});

test('a dead foe stops walking and stops swinging', () => {
  const { w, f } = worldWithFoe(FOE.reach - 5, 0);
  f.alive = false;
  f.deadAtS = 0;
  let struck = 0;
  run(w, 1, 1 / 60, () => struck++);
  assert.equal(struck, 0);
  assert.equal(w.hp, w.maxHp);
});
