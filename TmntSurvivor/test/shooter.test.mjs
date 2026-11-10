// THE SHOOTER, and the two numbers it was balanced against.
//
// Every grunt walks straight at the player, so the only threat is the field
// closing and the only answer is to keep moving. The shooter inverts that:
// it stops at a distance and throws, so backing off -- the answer to
// everything else -- walks you into its fire.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateHorde, updateEnemyShots, killEnemy, SHOOTER, SHOT, ENEMY, HEART,
} from '../src/systems/horde.js';
import { SURVIVAL } from '../src/systems/survival.js';
import { createWorld } from '../src/core/world.js';

// A CONSTANT, not a sequence. The first version of these tests fed an
// ordered list and asserted which draw was the kind roll -- which bakes the
// ORDER rng is consumed in into the test, so moving one line in updateHorde
// breaks tests that have nothing to do with it. A constant below the share
// makes every spawn a shooter and a constant above it makes every spawn a
// grunt, whatever order the draws happen in.
const always = (v) => () => v;

function world() {
  const w = createWorld();
  w.lives = SURVIVAL.maxLives;
  return w;
}

// ── the two numbers that are one number ─────────────────────────────────────

test('THE LIFE POOL AND THE DROP RATE ARE ONE DECISION', () => {
  // Moved together twice on 2026-11-01, in opposite directions: first cut
  // (40% off the pool, 70% off the drops), then part-way back on Elad's
  // call after playing the cut -- the pool doubled, the drop up 30%.
  //
  // THIS TEST IS MEANT TO GO RED WHEN SOMEONE TUNES ONE OF THEM. That is
  // the job: either number alone moves difficulty the wrong way, and the
  // red line is what makes the next person read the comment on the other
  // one before they ship half a change. Update both values here, together,
  // and only after changing both sources.
  assert.equal(SURVIVAL.maxLives, 14, 'pool: 12 -> 7 -> 14');
  assert.ok(Math.abs(HEART.dropChance - 0.0273) < 1e-9, 'drop: 0.07 -> 0.021 -> +30%');
});

test('a kill leaves a heart only on a roll under the drop chance', () => {
  const w = world();
  const e = { x: 10, y: 20, alive: true };
  killEnemy(w, e, () => 0.9);                 // well above 0.0273
  assert.equal(w.hearts.length, 0);
  killEnemy(w, { x: 1, y: 2, alive: true }, () => 0.001);
  assert.equal(w.hearts.length, 1);
});

// ── the type ────────────────────────────────────────────────────────────────

test('shooters are a minority of the horde', () => {
  assert.ok(SHOOTER.share > 0 && SHOOTER.share < 0.5, 'a minority');
  assert.ok(Math.abs(SHOOTER.share - 0.15) < 1e-9, '15% as specified');
});

test('the spawn roll decides the kind', () => {
  const w = world();
  updateHorde(w, 0, always(SHOOTER.share / 2));
  assert.ok(w.enemies.length > 0, 'nothing spawned');
  assert.ok(w.enemies.every((e) => e.kind === 'shooter'), 'all rolls under the share');

  const w2 = world();
  updateHorde(w2, 0, always(Math.min(0.99, SHOOTER.share + 0.5)));
  assert.ok(w2.enemies.every((e) => e.kind === 'grunt'), 'all rolls over the share');
});

test('a spawned shooter gets a staggered cooldown and a jittered standoff', () => {
  // A wave that spawns together must not then fire together: a volley
  // landing on one frame is unreadable, and a ring locked to one exact
  // radius reads as a drawn circle rather than a crowd.
  const w = world();
  let k = 0;
  const varied = () => { k = (k * 9301 + 49297) % 233280; return (k / 233280) * SHOOTER.share; };
  updateHorde(w, 0, varied);
  const shooters = w.enemies.filter((e) => e.kind === 'shooter');
  assert.ok(shooters.length >= 4, `only ${shooters.length} shooters`);
  assert.ok(new Set(shooters.map((e) => e.fireT)).size > 1, 'cooldowns not staggered');
  assert.ok(new Set(shooters.map((e) => e.standoff)).size > 1, 'standoffs not jittered');
  for (const e of shooters) {
    assert.ok(e.fireT >= 0 && e.fireT <= SHOOTER.cooldownS, 'cooldown in range');
    assert.ok(Math.abs(e.standoff - SHOOTER.standoffPx) <= SHOOTER.standoffSlackPx + 1,
              'standoff within its slack');
  }
});

test('A SHOOTER CLOSES TO ITS STANDOFF AND COMES NO CLOSER', () => {
  const w = world();
  const e = {
    x: w.player.x + 3000, y: w.player.y, alive: true, hitT: 0,
    kind: 'shooter', hp: 10, fireT: 999, standoff: SHOOTER.standoffPx,
  };
  w.enemies.push(e);
  // Long enough to actually cover the distance. The first version of this
  // test ran a flat ten seconds and read an enemy still in transit as a
  // failure of the standoff, so the budget is DERIVED from the walk speed
  // instead -- which also survives core/pace.js scaling that speed.
  const frames = Math.ceil(((3000 - SHOOTER.standoffPx) / ENEMY.speedPxS) * 60) + 120;
  for (let i = 0; i < frames; i++) updateHorde(w, 1 / 60, () => 0.99);
  const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
  assert.ok(Math.abs(d - SHOOTER.standoffPx) < 30,
            `settled at ${Math.round(d)}, wanted ~${SHOOTER.standoffPx}`);
});

test('it backs off if the player walks into it', () => {
  const w = world();
  const e = {
    x: w.player.x + 60, y: w.player.y, alive: true, hitT: 0,
    kind: 'shooter', hp: 10, fireT: 999, standoff: SHOOTER.standoffPx,
  };
  w.enemies.push(e);
  const before = e.x - w.player.x;
  for (let i = 0; i < 60; i++) updateHorde(w, 1 / 60, always(0.99));
  assert.ok(e.x - w.player.x > before, 'it should have retreated');
});

test('a grunt does not stand off, it closes all the way', () => {
  const w = world();
  const e = {
    x: w.player.x + 1200, y: w.player.y, alive: true, hitT: 0,
    kind: 'grunt', hp: 10, fireT: 0, standoff: 0,
  };
  w.enemies.push(e);
  for (let i = 0; i < 600; i++) updateHorde(w, 1 / 60, always(0.99));
  const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
  assert.ok(d < ENEMY.radius + w.playerRadius + 5, `grunt stopped at ${Math.round(d)}`);
});

// ── the projectile ──────────────────────────────────────────────────────────

test('A SHOT IS 20% FASTER THAN THE ENEMY WALKS', () => {
  assert.ok(Math.abs(SHOT.speedPxS - ENEMY.speedPxS * 1.2) < 1e-9);
});

test('a shooter in range throws, and only on its cooldown', () => {
  const w = world();
  w.enemies.push({
    x: w.player.x + SHOOTER.standoffPx, y: w.player.y, alive: true, hitT: 0,
    kind: 'shooter', hp: 10, fireT: 0.05, standoff: SHOOTER.standoffPx,
  });
  updateHorde(w, 1 / 60, () => 0.99);
  assert.equal(w.enemyShots.length, 0, 'not yet');
  updateHorde(w, 0.1, () => 0.99);
  assert.equal(w.enemyShots.length, 1, 'cooldown elapsed');
  updateHorde(w, SHOOTER.cooldownS * 0.5, () => 0.99);
  assert.equal(w.enemyShots.length, 1, 'half a cooldown later, still one');
});

test('THE PLAYER CANNOT SHOOT A SHOT DOWN', () => {
  // Nothing tests enemy fire against the player's bullets, and nothing
  // should. The only thing that ends one is reaching the player or running
  // out of range -- so a field full of the player's own fire changes nothing.
  const w = world();
  w.enemyShots.push({
    x: w.player.x + 900, y: w.player.y, vx: -SHOT.speedPxS, vy: 0,
    travelled: 0, alive: true,
  });
  for (let i = 0; i < 40; i++) {
    w.bullets.push({ x: w.player.x + 900, y: w.player.y, alive: true });
  }
  updateEnemyShots(w, 1 / 60);
  assert.equal(w.enemyShots[0].alive, true, 'the player\'s fire did nothing');
});

test('a shot that reaches the player lands, once', () => {
  const w = world();
  w.enemyShots.push({
    x: w.player.x + 40, y: w.player.y, vx: -SHOT.speedPxS, vy: 0,
    travelled: 0, alive: true,
  });
  updateEnemyShots(w, 1 / 60);
  assert.equal(w.contact, true, 'it set contact');
  assert.equal(w.enemyShots[0].alive, false, 'and consumed itself');

  // and nothing further happens to it on later frames
  w.contact = false;
  updateEnemyShots(w, 1 / 60);
  assert.equal(w.contact, false, 'a dead shot cannot hit again');
});

test('a dodged shot expires instead of flying for ever', () => {
  // Not a kill -- a bound. ~13 shooters throwing every few seconds would
  // otherwise fill the field with projectiles nothing can remove.
  const w = world();
  w.enemyShots.push({
    x: w.player.x, y: w.player.y - 4000, vx: 0, vy: -SHOT.speedPxS,
    travelled: 0, alive: true,
  });
  for (let i = 0; i < 60 * 60; i++) {
    updateEnemyShots(w, 1 / 60);
    if (!w.enemyShots[0].alive) break;
  }
  assert.equal(w.enemyShots[0].alive, false, 'it never expired');
  assert.equal(w.contact, false, 'and it never hit anything on the way');
});

test('a shot damages through the same path as a touch', () => {
  // It sets w.contact rather than taking a life itself, so the i-frames and
  // the cost of a hit stay decided in exactly one place.
  const w = world();
  w.enemyShots.push({
    x: w.player.x, y: w.player.y, vx: 0, vy: 0, travelled: 0, alive: true,
  });
  const before = w.lives;
  updateEnemyShots(w, 1 / 60);
  assert.equal(w.lives, before, 'updateEnemyShots must not touch lives itself');
  assert.equal(w.contact, true);
});
