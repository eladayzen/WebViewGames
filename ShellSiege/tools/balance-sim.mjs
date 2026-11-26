// BALANCE SIM. Plays whole runs through the REAL core (rooms, foes, combat, allies,
// roll, run) with a bot standing in for a player, and prints where runs die.
//
//   node tools/balance-sim.mjs [--runs=60] [--levels=3] [--skill=0.6]
//
// The bot is a kiter: it walks away from whatever is close, drifts back toward the
// middle when nothing is, and the auto-aim does the shooting. `skill` is the share
// of time it is paying attention; the rest of the time it wanders, which is what a
// child on a board does. It is a ruler, not a player: use it to compare one tuning
// with another, not to predict a real death rate.
import { createWorld, updateWorld, ARENA } from '../src/core/world.js';
import { updateFoes, updateFoeShots, PLAYER_HP, LEVEL_SCALE } from '../src/core/foes.js';
import { updateFiring, updateBullets } from '../src/systems/combat.js';
import { updateAllies, updatePizzas } from '../src/core/allies.js';
import { stats, clearTemp } from '../src/core/abilities.js';
import { ROOM } from '../src/core/rooms.js';
import { createRun, stepRun, restartLevel, nextLevel, beginStartRoll } from '../src/core/run.js';

const arg = (k, d) => { const m = process.argv.find((a) => a.startsWith(`--${k}=`)); return m ? Number(m.split('=')[1]) : d; };
const RUNS = arg('runs', 60), LEVELS = arg('levels', 3), SKILL = arg('skill', 0.6), DT = 1 / 30, CAP_S = 500, TURN = arg('turn', 3), REACH = arg('reach', 0.75);

// tuning overrides, so a sweep needs no edits: --hp= --dmg= --bud= --room=
if (process.argv.some((a) => a.startsWith('--hp='))) LEVEL_SCALE.hpPerLevel = arg('hp', 0);
if (process.argv.some((a) => a.startsWith('--dmg='))) LEVEL_SCALE.dmgPerLevel = arg('dmg', 0);
if (process.argv.some((a) => a.startsWith('--bud='))) ROOM.perLevel = arg('bud', 0);
if (process.argv.includes('--early=0')) ROOM.early = {};
if (process.argv.some((a) => a.startsWith('--room='))) ROOM.perRoom = arg('room', 0);

function rngOf(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function syncMaxHp(w, full) {
  const m = Math.max(1, Math.round(PLAYER_HP * stats(w.build).maxHpMul));
  if (m !== w.maxHp) { const g = m - w.maxHp; w.maxHp = m; w.hp = full ? m : Math.min(m, w.hp + Math.max(0, g)); }
  else if (full) w.hp = m;
}

function steer(w, bot, rng) {
  bot.t -= DT;
  if (bot.t <= 0) { bot.t = 0.4; bot.attentive = rng() < SKILL; bot.wander = rng() * Math.PI * 2; }
  const p = w.player;
  if (!bot.attentive) { bot.x += (Math.cos(bot.wander) * 0.4 - bot.x) * Math.min(1, DT * TURN); bot.y += (Math.sin(bot.wander) * 0.4 - bot.y) * Math.min(1, DT * TURN); return { x: bot.x, y: bot.y }; }
  let ax = 0, ay = 0;
  for (const f of w.foes) {
    if (!f.alive) continue;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
    const near = Math.max(0, 1 - d / 650);
    ax += (dx / d) * near * near; ay += (dy / d) * near * near;
  }
  for (const s of w.foeShots || []) {
    if (s.alive === false) continue;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d < 380) { ax += (-dy / d) * 1.2; ay += (dx / d) * 1.2; }
  }
  const cx = ARENA.width / 2 - p.x, cy = ARENA.height / 2 - p.y, cd = Math.hypot(cx, cy) || 1;
  const wall = Math.max(0, cd / 1700);
  ax += (cx / cd) * wall * 0.9; ay += (cy / cd) * wall * 0.9;
  const m = Math.hypot(ax, ay);
  const want = m < 0.05 ? { x: 0, y: 0 } : { x: ax / Math.max(1, m), y: ay / Math.max(1, m) };
  // A BOARD IS NOT A STICK: the lean builds and fades over about a third of a second,
  // so the bot cannot turn on a coin the way a perfect kiter would.
  const k = Math.min(1, DT * TURN);
  bot.x += (want.x - bot.x) * k; bot.y += (want.y - bot.y) * k;
  return { x: bot.x * REACH, y: bot.y * REACH };
}

function playRun(seed) {
  const rng = rngOf(seed);
  const w = createWorld(); syncMaxHp(w, true);
  let run = createRun({ level: 1, rng });
  const rec = { deaths: [], roomsCleared: 0, levelsWon: 0, hpAtClear: [], roomT: [], timeS: 0, won: false };
  const bot = { t: 0, attentive: true, wander: 0, x: 0, y: 0 };
  const hooks = {};
  let clock = 0, roomStart = 0;
  beginStartRoll(run, w, rng);
  while (clock < CAP_S * LEVELS && rec.levelsWon < LEVELS) {
    clock += DT;
    if (run.phase === 'roll') { stepRun(run, w, DT, rng); syncMaxHp(w, false); continue; }
    if (run.phase === 'won') {
      rec.levelsWon++; { const q = stats(w.build); (rec.pow ||= []).push({ dps: q.damage * q.projectiles / q.fireIntervalS, hp: q.maxHpMul, picks: Object.values(w.build).reduce((a, b) => a + b, 0), allies: w.build.leo + w.build.donnie + w.build.mikey }); }
      const keep = w.build;
      Object.assign(w, createWorld()); w.build = keep; syncMaxHp(w, true);   // a won level KEEPS the build
      run = nextLevel(run, rng);
      continue;
    }
    updateWorld(w, steer(w, bot, rng), DT);
    const st = { ...stats(w.build) };
    w.speedMul = st.speedMul; syncMaxHp(w, false);
    updateFiring(w, st, DT);
    updateBullets(w, DT, () => {});
    updateAllies(w, DT, hooks); updatePizzas(w, DT, hooks);
    for (const e of stepRun(run, w, DT, rng)) if (e.type === 'cleared') { rec.roomsCleared++; rec.hpAtClear.push(w.hp / w.maxHp); rec.roomT.push(clock - roomStart); } else if (e.type === 'fight') roomStart = clock;
    updateFoes(w, DT, () => {});
    updateFoeShots(w, DT, () => {});
    if (w.dead) {
      rec.deaths.push({ level: run.level, room: run.roomIdx + 1 });
      const keep = clearTemp(w.build);
      Object.assign(w, createWorld()); w.build = keep; syncMaxHp(w, true);
      run = restartLevel(run, rng);
      beginStartRoll(run, w, rng);
    }
  }
  rec.timeS = clock;
  rec.won = rec.levelsWon >= LEVELS;
  return rec;
}

const recs = [];
for (let i = 0; i < RUNS; i++) recs.push(playRun(1000 + i * 7919));

const pct = (n) => `${Math.round((100 * n) / RUNS)}%`;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log(`\nBALANCE  runs=${RUNS} levels=${LEVELS} skill=${SKILL}`);
console.log(`  finished level ${LEVELS}: ${pct(recs.filter((r) => r.won).length)}   mean time ${mean(recs.map((r) => r.timeS)).toFixed(0)}s`);
const byRoom = {};
for (const r of recs) for (const d of r.deaths) { const k = `L${d.level} R${d.room}`; byRoom[k] = (byRoom[k] || 0) + 1; }
console.log('  deaths per run, by room:');
for (const k of Object.keys(byRoom).sort()) console.log(`    ${k.padEnd(6)} ${(byRoom[k] / RUNS).toFixed(2)}  ${'#'.repeat(Math.round((byRoom[k] / RUNS) * 20))}`);
console.log(`  total deaths per run ${mean(recs.map((r) => r.deaths.length)).toFixed(2)}   mean hp left on clearing a room ${(mean(recs.flatMap((r) => r.hpAtClear)) * 100).toFixed(0)}%   seconds to clear a room ${mean(recs.flatMap((r) => r.roomT)).toFixed(0)}`);

console.log('  player power when a level is won (mean):  level  dps  hpx  picks  turtle-levels');
for (let l = 0; l < LEVELS; l++) {
  const P = recs.map((r) => r.pow?.[l]).filter(Boolean);
  if (P.length) console.log(`    L${l + 1}   dps ${mean(P.map((p) => p.dps)).toFixed(0).padStart(4)}  hp x${mean(P.map((p) => p.hp)).toFixed(2)}  picks ${mean(P.map((p) => p.picks)).toFixed(1)}  turtles ${mean(P.map((p) => p.allies)).toFixed(1)}   foe hp mult x${(1 + 0.15 * l).toFixed(2)}  budget(r5) ${Math.round(10 * (1 + 0.35 * l) * 1.8)}`);
}

if (process.argv.includes('--row')) {
  const per = Array.from({ length: LEVELS }, (_, l) => recs.reduce((n, r) => n + r.deaths.filter((d) => d.level === l + 1).length, 0) / RUNS);
  console.log('ROW deaths/level: ' + per.map((v) => v.toFixed(1).padStart(4)).join(''));
}
