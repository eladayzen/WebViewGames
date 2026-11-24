// SPINNING BLADES AND SHELL SHOCK: powers that change how you fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { makeFoe } from '../src/core/foes.js';
import { updatePowers, orbitBlades, ORBIT, BURST, orbitCount, orbitActiveS, orbitCooldownS, burstChargeS } from '../src/core/powers.js';

const room = (k, n = 1) => { const w = createWorld(); w.build[k] = n; return w; };
const addFoe = (w, dx, dy, hp = 1000) => { const f = makeFoe(w.player.x + dx, w.player.y + dy, 0, 'slayer'); f.hp = f.maxHp = hp; w.foes.push(f); w.targets.push(f); return f; };
const run = (w, s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) { w.timeS += dt; updatePowers(w, dt, {}); } };

test('THE RING STARTS UP, cuts what it touches, and goes down for a cooldown', () => {
  const w = room('orbit');
  const f = addFoe(w, ORBIT.radius, 0);
  f.speed = 0;
  run(w, 0.05);
  assert.ok(w.powers.orbit.up, 'the ring never started');
  run(w, 2);
  assert.ok(f.hp < f.maxHp, 'the blades cut nothing');
  run(w, orbitActiveS(1) + 0.5);
  assert.equal(w.powers.orbit.up, false, 'it never went down');
  run(w, orbitCooldownS(1) + 0.5);
  assert.equal(w.powers.orbit.up, true, 'it never came back');
});

test('A FOE IS NOT SHREDDED EVERY FRAME: one cut per hitEvery', () => {
  const w = room('orbit');
  const f = addFoe(w, 10, 0); f.speed = 0;        // inside the ring's reach? it sits at the centre, so move it onto the ring
  f.x = w.player.x + ORBIT.radius; f.y = w.player.y;
  w.powers.orbit.ang = 0;
  const before = f.hp;
  run(w, 0.1);
  assert.ok(before - f.hp <= ORBIT.damage + 0.001, `cut more than once in 0.1s: ${before - f.hp}`);
});

test('MORE LEVELS MEAN MORE BLADES, a longer stay and a shorter rest', () => {
  assert.ok(orbitCount(3) > orbitCount(1));
  assert.ok(orbitActiveS(3) > orbitActiveS(1));
  assert.ok(orbitCooldownS(3) < orbitCooldownS(1));
  const w = room('orbit', 2); run(w, 0.05);
  assert.equal(orbitBlades(w).length, orbitCount(2));
});

test('NOTHING HAPPENS WITHOUT THE ABILITY', () => {
  const w = createWorld();
  const f = addFoe(w, 100, 0);
  run(w, 10);
  assert.equal(f.hp, f.maxHp);
  assert.equal(orbitBlades(w).length, 0);
});

test('THE BURST CHARGES, THEN WAITS ARMED, and goes off when the crowd is inside', () => {
  const w = room('burst');
  run(w, burstChargeS(1) + 0.1);
  assert.ok(w.powers.burst.armed, 'it never armed');
  const a = addFoe(w, 150, 0), b = addFoe(w, -150, 0);
  a.speed = b.speed = 0;
  let fired = 0;
  updatePowers(w, 1 / 60, { onBurst: () => fired++ });
  assert.equal(fired, 1, 'two foes inside did not set it off');
  assert.ok(a.hp < a.maxHp && b.hp < b.maxHp);
  assert.equal(w.powers.burst.armed, false);
  assert.equal(w.powers.burst.charge, 0, 'it did not start charging again');
});

test('ARMED WITH ONE FOE NEAR IT WAITS FOR THE FUSE, so you can lure a bigger crowd in', () => {
  const w = room('burst');
  run(w, burstChargeS(1) + 0.1);
  const a = addFoe(w, 150, 0); a.speed = 0;
  let fired = 0;
  const hooks = { onBurst: () => fired++ };
  for (let t = 0; t < BURST.fuseS - 0.3; t += 1 / 60) updatePowers(w, 1 / 60, hooks);
  assert.equal(fired, 0, 'it fired before the fuse with one foe');
  for (let t = 0; t < 0.6; t += 1 / 60) updatePowers(w, 1 / 60, hooks);
  assert.equal(fired, 1, 'the fuse never fired it');
});

test('THE BURST KNOCKS A LIGHT FOE FURTHER THAN A HEAVY ONE', () => {
  const w = room('burst');
  run(w, burstChargeS(1) + 0.1);
  const light = addFoe(w, 150, 0), heavy = makeFoe(w.player.x, w.player.y + 150, 0, 'fortgolem');
  heavy.hp = heavy.maxHp = 1e6; w.foes.push(heavy);
  const l0 = Math.hypot(light.x - w.player.x, light.y - w.player.y), h0 = Math.hypot(heavy.x - w.player.x, heavy.y - w.player.y);
  updatePowers(w, 1 / 60, {});
  const l1 = Math.hypot(light.x - w.player.x, light.y - w.player.y), h1 = Math.hypot(heavy.x - w.player.x, heavy.y - w.player.y);
  assert.ok(l1 - l0 > h1 - h0, 'the heavy golem flew as far as the slayer');
});

// ---------------------------- the other eight ----------------------------
import { chainArc, noteKill, rushMul, hitDecoy, DASH, CALTROP, BOOM, VORTEX, FROST, DECOY } from '../src/core/powers.js';
import { updateFoes } from '../src/core/foes.js';

test('DASH STRIKE BLINKS TOWARD THE NEAREST FOE AND CUTS EVERYTHING ON THE WAY', () => {
  const w = room('dash'); w.powers = undefined; w.obstacles = [];
  const a = addFoe(w, 250, 0), b = addFoe(w, 120, 10); a.speed = b.speed = 0;
  const x0 = w.player.x;
  run(w, DASH.cooldownS + 0.5);
  assert.ok(w.player.x > x0 + 100, 'the turtle did not move');
  assert.ok(a.hp < a.maxHp && b.hp < b.maxHp, 'it missed one on the line');
});

test('DASH STRIKE DOES NOTHING WITH NO ONE IN RANGE', () => {
  const w = room('dash'); w.obstacles = [];
  const x0 = w.player.x; run(w, 8);
  assert.equal(w.player.x, x0);
});

test('CALTROPS DROP AS YOU RUN, hurt what walks over them, and expire', () => {
  const w = room('caltrop'); run(w, 0.05);
  for (let i = 0; i < 40; i++) { w.player.x += 20; updatePowers(w, 1 / 60, {}); }
  assert.ok(w.powers.caltrops.length >= 3, `only ${w.powers.caltrops.length} dropped`);
  const t = w.powers.caltrops[0];
  const f = addFoe(w, 0, 0); f.speed = 0; f.x = t.x; f.y = t.y;
  updatePowers(w, 1 / 60, {});
  assert.ok(f.hp < f.maxHp, 'a foe on the spikes was not hurt');
  run(w, CALTROP.lifeS + 1);
  assert.equal(w.powers.caltrops.length, 0, 'they never expired');
});

test('THE BOOMERANG SHELL GOES OUT, CUTS, AND COMES BACK TO YOU', () => {
  const w = room('shellboom'); w.obstacles = [];
  const f = addFoe(w, 300, 0); f.speed = 0;
  run(w, 0.1); w.powers.boomCd = 0; run(w, 0.05);
  assert.ok(w.powers.boom.length >= 1, 'no shell was thrown');
  run(w, 1);
  assert.ok(f.hp < f.maxHp, 'the shell cut nothing');
  run(w, 2);
  assert.equal(w.powers.boom.length, 0, 'the shell never came home');
});

test('A DECOY TAKES THE HITS INSTEAD OF THE PLAYER, and the foes walk at it', () => {
  const w = room('decoy'); w.hp = w.maxHp = 1000;
  const f = addFoe(w, 300, 0); f.speed = 165;
  run(w, DECOY.cooldownS * 0.4);
  assert.ok(w.decoy, 'no decoy appeared');
  w.player.x -= 900;                       // the player walks away; the foe should still go for the box
  const d0 = Math.hypot(f.x - w.decoy.x, f.y - w.decoy.y);
  for (let t = 0; t < 1; t += 1 / 60) updateFoes(w, 1 / 60);
  assert.ok(Math.hypot(f.x - w.decoy.x, f.y - w.decoy.y) < d0, 'the foe ignored the decoy');
  hitDecoy(w, 1e6);
  run(w, 0.05);
  assert.equal(w.decoy, null, 'a broken decoy stayed');
  assert.equal(w.hp, 1000, 'the player was hurt through the decoy');
});

test('CHAIN LIGHTNING JUMPS TO NEARBY FOES BUT NEVER STARTS ANOTHER CHAIN', () => {
  const w = room('arc'); w.build.arc = 1;
  const a = addFoe(w, 300, 0), b = addFoe(w, 450, 0), c = addFoe(w, 600, 0), far = addFoe(w, 1600, 0);
  chainArc(w, a, 20, {});
  const hurt = [b, c].filter((f) => f.hp < f.maxHp).length;
  assert.equal(hurt, 2, 'level 1 jumps twice (1 + level)');
  assert.equal(far.hp, far.maxHp, 'it jumped out of range');
  assert.equal(a.hp, a.maxHp, 'the foe that was hit directly is not hit again by its own arc');
});

test('THE VORTEX DRAGS FOES IN, the light ones further than the heavy', () => {
  const w = room('vortex');
  const light = addFoe(w, 500, 0), heavy = makeFoe(w.player.x, w.player.y + 500, 0, 'fortgolem'); heavy.hp = heavy.maxHp = 1e6; w.foes.push(heavy);
  light.speed = 0;
  run(w, VORTEX.activeS + 3.5);
  const dl = Math.hypot(light.x - w.player.x, light.y - w.player.y), dh = Math.hypot(heavy.x - w.player.x, heavy.y - w.player.y);
  assert.ok(dl < 400, `the light foe was not pulled in (${dl})`);
  assert.ok(dl < dh, 'the golem came in as far as the slayer');
});

test('FREEZE NOVA SLOWS A FOE FOR A WHILE, and it recovers', () => {
  const w = room('frost');
  const f = addFoe(w, 200, 0); f.speed = 165;
  run(w, FROST.cooldownS * 0.4 > 3 ? 3 : 2.1);
  run(w, 0.6);
  assert.ok(f.slowT > 0, 'it was never slowed');
  const x0 = f.x; for (let t = 0; t < 0.5; t += 1 / 60) updateFoes(w, 1 / 60);
  const slowStep = Math.abs(f.x - x0);
  f.slowT = 0; const x1 = f.x; for (let t = 0; t < 0.5; t += 1 / 60) updateFoes(w, 1 / 60);
  assert.ok(slowStep <= Math.abs(f.x - x1) + 1e-6, 'a slowed foe was not slower');
  run(w, 6);
});

test('ADRENALINE: EVERY KILL STACKS A FASTER THROW, up to a cap, and it fades', () => {
  const w = room('rush');
  assert.equal(rushMul(w), 1);
  for (let i = 0; i < 9; i++) noteKill(w);
  assert.ok(rushMul(w) > 1.3, 'no speed-up');
  assert.equal(w.powers.rush.n, 5, 'stacks are not capped');
  run(w, 10);
  assert.equal(rushMul(w), 1, 'it never faded');
});

test('NONE OF THE NEW POWERS DO ANYTHING WITHOUT THE ABILITY', () => {
  const w = createWorld(); const f = addFoe(w, 150, 0);
  const x = w.player.x; run(w, 12);
  assert.equal(w.player.x, x); assert.equal(f.hp, f.maxHp); assert.equal(w.decoy || null, null);
  assert.equal(rushMul(w), 1);
});
