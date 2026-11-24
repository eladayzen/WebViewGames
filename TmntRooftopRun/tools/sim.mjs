// Headless fairness + pace check: the bot plays N seeds for S seconds each.
//   node tools/sim.mjs [seeds=20] [secs=240]
// It must lose 0 lives; jumps/s says how busy the run is.
import { createWorld } from '../src/game/world.js';
import { createRunner, botWantsTap } from '../src/game/runner.js';

const N = +(process.argv[2] || 20), S = +(process.argv[3] || 240), HIGH = process.argv[4] === 'high', dt = 1 / 60;
let hearts = 0, lost = 0, rolls = 0, jumps = 0, kos = 0, pizzas = 0, dist = 0, falls = 0, hits = 0;
for (let seed = 1; seed <= N; seed++) {
  const world = createWorld(seed);
  const run = createRunner(world);
  for (let t = 0; t < S; t += dt) run.frame(dt, botWantsTap(run, world, HIGH), true, false);
  const p = run.p;
  lost += p.falls + p.hits; falls += p.falls; hits += p.hits;
  jumps += p.jumps; hearts += p.hearts; rolls += p.rolls; kos += p.kos; pizzas += p.pizzas; dist += p.dist;
  if (p.falls + p.hits) console.log(`seed ${seed}: falls ${p.falls} hits ${p.hits}`);
}
const T = N * S;
console.log(`${N} seeds x ${S}s: lives lost ${lost} (falls ${falls}, hits ${hits}) | jumps/s ${(jumps / T).toFixed(2)} | hearts/min ${(hearts / T * 60).toFixed(2)} | rolls/min ${(rolls / T * 60).toFixed(1)} | ` +
  `KOs/min ${(kos / T * 60).toFixed(1)} | pizza/min ${(pizzas / T * 60).toFixed(1)} | avg speed ${(dist / T).toFixed(1)} m/s`);
