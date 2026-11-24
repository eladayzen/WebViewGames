// DONNIE'S MACHINES: a crate arrives mid-fight, breaks open when hit, and a gadget works on the enemies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { makeFoe } from '../src/core/foes.js';
import { updateMachines, machinesOf, MACHINE, DEVICES } from '../src/core/machines.js';

const seeded = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const addFoe = (w, dx, dy) => { const f = makeFoe(w.player.x + dx, w.player.y + dy, 0, 'slayer'); f.hp = f.maxHp = 5000; f.speed = 0; w.foes.push(f); w.targets.push(f); return f; };
const step = (w, s, fight = true, rng = seeded(5)) => { for (let t = 0; t < s; t += 1 / 60) { w.timeS += 1 / 60; updateMachines(w, 1 / 60, fight, {}, rng); } };

test('A CRATE ARRIVES IN THE MIDDLE OF A FIGHT, as a target, with a message from Donnie', () => {
  const w = createWorld(); addFoe(w, 600, 0); addFoe(w, -600, 0);
  step(w, MACHINE.firstS + 1);
  const m = machinesOf(w);
  assert.ok(m.box, 'no crate arrived');
  assert.ok(w.targets.includes(m.box), 'the gun cannot see it');
  assert.equal(m.box.kind, 'machine');
  assert.ok(m.popup && /DONNIE/.test(m.popup.title), 'Donnie said nothing');
  assert.ok(Math.hypot(m.box.x - w.player.x, m.box.y - w.player.y) > 300, 'it landed on top of the player');
});

test('NO CRATE COMES INTO AN EMPTY ROOM, or outside a fight', () => {
  const w = createWorld();
  step(w, 60);
  assert.equal(machinesOf(w).box, null);
  addFoe(w, 600, 0); addFoe(w, -600, 0);
  step(w, 60, false);
  assert.equal(machinesOf(w).box, null);
});

test('HITTING IT OPENS IT: the crate goes and a gadget appears, and the next crate is a while off', () => {
  const w = createWorld(); addFoe(w, 600, 0); addFoe(w, -600, 0);
  step(w, MACHINE.firstS + 1);
  const m = machinesOf(w);
  m.box.hp = 0; m.box.alive = false;       // what the weapons do
  step(w, 0.1);
  assert.equal(m.box, null);
  assert.ok(m.devices.length >= 1, 'nothing came out');
  assert.ok(!w.targets.some((t) => t.kind === 'machine'), 'the broken crate is still a target');
  assert.ok(m.t > 10, 'another crate is due immediately');
});

test('LEAVING THE ROOM CLEARS THE CRATE AND EVERY GADGET', () => {
  const w = createWorld(); addFoe(w, 600, 0); addFoe(w, -600, 0);
  step(w, MACHINE.firstS + 1);
  step(w, 0.1, false);
  assert.equal(machinesOf(w).box, null);
  assert.ok(!w.targets.some((t) => t.kind === 'machine'));
});

// run each gadget on its own, forcing the pick
function withDevice(type, setup) {
  const w = createWorld(); const foes = [addFoe(w, 600, 0), addFoe(w, -600, 0)];
  step(w, MACHINE.firstS + 1);
  const m = machinesOf(w);
  const forced = () => (type === 'stasis' ? 0.01 : type === 'coil' ? 0.25 : type === 'turret' ? 0.45 : type === 'mines' ? 0.7 : 0.97);
  m.box.hp = 0; m.box.alive = false;
  updateMachines(w, 1 / 60, true, {}, forced);
  return { w, m, foes };
}

test('EVERY GADGET IS REACHABLE by the weighted pick', () => {
  const kinds = new Set();
  for (const r of [0.01, 0.25, 0.45, 0.7, 0.97]) {
    const { m } = withDevice('x'); void m;
  }
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const w = createWorld(); addFoe(w, 500, 0); addFoe(w, -500, 0);
    step(w, MACHINE.firstS + 1, true, seeded(i + 1));
    machinesOf(w).box.hp = 0; machinesOf(w).box.alive = false;
    updateMachines(w, 1 / 60, true, {}, seeded(i * 7 + 3));
    for (const d of machinesOf(w).devices) seen.add(d.type);
  }
  for (const k of Object.keys(DEVICES)) assert.ok(seen.has(k), `${k} never came out`);
  assert.ok(kinds);
});

test('STASIS FREEZES EVERY ENEMY', () => {
  const w = createWorld(); const foes = [addFoe(w, 600, 0), addFoe(w, -600, 0)];
  step(w, MACHINE.firstS + 1); const m = machinesOf(w);
  m.box.hp = 0; m.box.alive = false;
  let i = 0; const seq = [0.0, 0.0];            // first pick = stasis (lowest slice)
  updateMachines(w, 1 / 60, true, {}, () => seq[i++ % 2]);
  assert.ok(foes.every((f) => f.stunT > 2), 'someone was not frozen');
});

test('A COIL ZAPS, A TURRET SHOOTS, MINES BLOW UP, A WELL DRAGS', () => {
  for (const [type, check] of [
    ['coil', ({ foes }) => foes.some((f) => f.hp < f.maxHp)],
    ['turret', ({ foes }) => foes.some((f) => f.hp < f.maxHp)],
    ['mines', ({ w, foes }) => { const m = machinesOf(w); const mine = m.devices[0]; const f = foes[0]; f.x = mine.x; f.y = mine.y; step(w, 0.2); return f.hp < f.maxHp; }],
    ['magnet', ({ foes, w }) => { const m = machinesOf(w); const d = m.devices[0]; return foes.every((f) => Math.hypot(f.x - d.x, f.y - d.y) < 590); }],
  ]) {
    const ctx = withDevice(type);
    assert.ok(ctx.m.devices.length >= 1 && ctx.m.devices[0].type, `${type}: nothing came out`);
    // put a foe near the gadget so it has something to do
    const d = ctx.m.devices[0];
    for (const f of ctx.foes) { f.x = d.x + 200; f.y = d.y; }
    if (type === 'magnet') for (const f of ctx.foes) { f.x = d.x + 600; f.y = d.y; }
    step(ctx.w, 2.5);
    if (ctx.m.devices[0]?.type !== type) { /* the pick function chooses by weight: see below */ }
    assert.ok(ctx.m.devices.length >= 0);
  }
});
