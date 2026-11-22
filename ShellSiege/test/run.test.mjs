// THE RUN. The shape of a level, played with no browser: intro, fight,
// cleared, roll, next room -- and the one thing a level must never do, which
// is stall. The old choice screen needed a player's lean to proceed, so a
// whole level could not be tested unattended. This one can, and one of these
// tests does exactly that.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { ABILITIES } from '../src/core/abilities.js';
import { take } from '../src/core/abilities.js';
import {
  RUN, createRun, stepRun, restartLevel, nextLevel, frozen,
} from '../src/core/run.js';
import { roomBudget } from '../src/core/rooms.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const picks = (b) => Object.values(b).reduce((a, n) => a + n, 0);

/**
 * Play a run with a perfect player until `done(events)` or a hard cap.
 * Everything alive dies the frame after it arrives.
 */
function play(run, w, { until, rng = seeded(1), cap = 60 * 60 } = {}) {
  const log = [];
  const dt = 1 / 30;
  for (let i = 0; i < cap; i++) {
    for (const e of stepRun(run, w, dt, rng)) { log.push(e.type); }
    if (run.phase === 'fight') for (const f of w.foes) f.alive = false;
    if (until(run, log)) return log;
  }
  throw new Error('run never reached its goal; last phase ' + run.phase + ' log ' + log.join());
}

test('A ROOM GOES INTRO, FIGHT, CLEARED, THEN A ROLL, THEN THE NEXT ROOM', () => {
  const w = createWorld();
  const run = createRun({ rng: seeded(1) });
  assert.equal(run.phase, 'intro');
  assert.equal(run.roomIdx, 0);
  const log = play(run, w, { until: (r, l) => l.includes('roomStart') });
  assert.deepEqual(log, ['fight', 'cleared', 'rollStart', 'rollDone', 'roomStart']);
  assert.equal(run.roomIdx, 1);
  assert.equal(run.phase, 'intro');
});

test('NOBODY SPAWNS DURING THE INTRO BANNER', () => {
  const w = createWorld();
  const run = createRun({ rng: seeded(1) });
  for (let t = 0; t < RUN.bannerS - 0.1; t += 1 / 30) stepRun(run, w, 1 / 30, seeded(1));
  assert.equal(run.phase, 'intro');
  assert.equal(w.foes.length, 0);
});

test('CLEARING A ROOM HEALS A SHARE OF MAX HEALTH, and never past it', () => {
  const w = createWorld();
  w.maxHp = 100; w.hp = 10;
  const run = createRun({ rng: seeded(1) });
  play(run, w, { until: (r, l) => l.includes('cleared') });
  assert.equal(w.hp, 10 + Math.round(100 * RUN.healFrac));

  const w2 = createWorld();
  w2.maxHp = 100; w2.hp = 95;
  const r2 = createRun({ rng: seeded(1) });
  play(r2, w2, { until: (r, l) => l.includes('cleared') });
  assert.equal(w2.hp, 100);
});

test('THE ROLL GRANTS EXACTLY ONE ABILITY, and only once the box has finished', () => {
  const w = createWorld();
  const run = createRun({ rng: seeded(1) });
  assert.equal(picks(w.build), 0);
  play(run, w, { until: (r, l) => l.includes('rollStart') });
  assert.equal(picks(w.build), 0, 'granted before the reveal');
  assert.ok(frozen(run), 'the world must hold still while the box is open');
  play(run, w, { until: (r, l) => l.includes('rollDone') });
  assert.equal(picks(w.build), 1);
  assert.ok(!frozen(run));
});

test('THE WORLD IS ONLY FROZEN WHILE THE BOX IS OPEN', () => {
  const w = createWorld();
  const run = createRun({ rng: seeded(1) });
  for (const phase of ['intro', 'fight', 'cleared']) {
    run.phase = phase;
    assert.equal(frozen(run), false, phase);
  }
  run.phase = 'roll';
  assert.equal(frozen(run), true);
  run.phase = 'won';
  assert.equal(frozen(run), false, 'a won level must not freeze the screen');
});

test('THE LAST ROOM IS NOT FOLLOWED BY A ROLL -- the level is won', () => {
  const w = createWorld();
  const run = createRun({ room: 99, rng: seeded(1) });   // clamps to the last room
  assert.equal(run.roomIdx, run.rooms - 1);
  const log = play(run, w, { until: (r) => r.phase === 'won' });
  assert.ok(log.includes('won'));
  assert.ok(!log.includes('rollStart'), 'a roll after the last room has nowhere to go');
  assert.equal(picks(w.build), 0);
});

test('A WHOLE LEVEL PLAYS OUT UNATTENDED, with one roll between each pair of rooms', () => {
  const w = createWorld();
  const run = createRun({ rng: seeded(3) });
  const log = play(run, w, { until: (r) => r.phase === 'won', rng: seeded(3) });
  assert.equal(log.filter((e) => e === 'cleared').length, run.rooms, 'a room was skipped');
  assert.equal(log.filter((e) => e === 'rollDone').length, run.rooms - 1);
  assert.equal(picks(w.build), run.rooms - 1);
  assert.equal(log.at(-1), 'won');
});

test('WITH EVERYTHING MAXED THE RUN WALKS PAST THE ROLL instead of waiting on an empty box', () => {
  const w = createWorld();
  for (const k of Object.keys(ABILITIES)) for (let i = 0; i < ABILITIES[k].max; i++) take(w.build, k);
  const run = createRun({ rng: seeded(1) });
  const log = play(run, w, { until: (r, l) => l.includes('roomStart') });
  assert.deepEqual(log, ['fight', 'cleared', 'rollStart', 'rollDone', 'roomStart']);
  assert.equal(run.phase, 'intro');
});

test('DYING SENDS YOU TO ROOM ONE OF THE SAME LEVEL, and leaves the build alone', () => {
  const w = createWorld();
  const run = createRun({ level: 2, room: 3, rng: seeded(1) });
  take(w.build, 'rapid'); take(w.build, 'hearts');
  const before = JSON.stringify(w.build);
  const again = restartLevel(run, seeded(1));
  assert.equal(again.level, 2, 'you do not drop a level');
  assert.equal(again.roomIdx, 0);
  assert.equal(again.phase, 'intro');
  assert.equal(JSON.stringify(w.build), before, 'permanent stats must survive a death');
});

test('WINNING A LEVEL STARTS THE NEXT ONE AT ROOM ONE, bigger', () => {
  const run = createRun({ level: 1, rng: seeded(1) });
  const next = nextLevel(run, seeded(1));
  assert.equal(next.level, 2);
  assert.equal(next.roomIdx, 0);
  assert.ok(next.room.budget > run.room.budget);
  assert.equal(next.room.budget, roomBudget(2, 0));
});

test('?room= STARTS PARTWAY IN, clamped to a room that exists', () => {
  assert.equal(createRun({ room: 2, rng: seeded(1) }).roomIdx, 2);
  assert.equal(createRun({ room: -4, rng: seeded(1) }).roomIdx, 0);
  const r = createRun({ room: 500, rng: seeded(1) });
  assert.equal(r.roomIdx, r.rooms - 1);
});

// ---- THE FREE START POWER ---------------------------------------------------------
import { beginStartRoll } from '../src/core/run.js';

test('THE START ROLL GRANTS AN ABILITY AND THEN STARTS THE SAME ROOM, not the next', async () => {
  const { createWorld } = await import('../src/core/world.js');
  const { ABILITIES } = await import('../src/core/abilities.js');
  const w = createWorld();
  const run = createRun({ level: 1, room: 0, rng: () => 0.2 });
  const ev = beginStartRoll(run, w, () => 0.2);
  assert.equal(ev[0].type, 'rollStart');
  assert.equal(run.phase, 'roll');
  const key = run.roll.key;
  const before = w.build[key];
  let done = false;
  for (let t = 0; t < 4 && !done; t += 1 / 60) done = stepRun(run, w, 1 / 60, () => 0.2).some((e) => e.type === 'rollDone');
  assert.ok(done, 'the roll never finished');
  assert.equal(w.build[key], before + 1, 'the rolled ability was not granted');
  assert.equal(run.roomIdx, 0, 'the start roll advanced the room');
  assert.equal(run.phase, 'intro');
  assert.ok(key in ABILITIES);
});

test('with everything maxed there is NO start roll and no empty box', async () => {
  const { createWorld } = await import('../src/core/world.js');
  const { ABILITIES } = await import('../src/core/abilities.js');
  const w = createWorld();
  for (const k of Object.keys(ABILITIES)) w.build[k] = ABILITIES[k].max;
  const run = createRun({ level: 1, room: 0 });
  assert.deepEqual(beginStartRoll(run, w), []);
  assert.equal(run.phase, 'intro');
});
