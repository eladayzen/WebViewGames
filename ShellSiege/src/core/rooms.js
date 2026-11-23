// A ROOM IS A FIXED AMOUNT OF TROUBLE, AND YOU ARE DONE WHEN IT IS GONE.
//
// The prototype was a clock: how long can you last. That plays the same at
// minute five as at minute zero and gets dull, which is the reason for this
// file. A room has a BUDGET -- a number -- and the room spends it on enemies
// up front, so the room is over when all of them are dead, not when a timer
// says so. Clearing something is a different feeling from outlasting it, and
// it is the unit everything else (the roll, the map, banking a level) hangs
// off.
//
// THE BUDGET IS IN COST, NOT BODIES. A fort golem is four slayers' worth of
// trouble, so a room of ten is ten slayers or two golems and a few small
// ones, and either is roughly the same length of room. `costOf` is the one
// place that number lives.
//
//   budget = base x (1 + perLevel) ^ (level - 1) x (1 + perRoom x room)
//
// That is the whole difficulty curve: later rooms and later levels are bigger,
// and nothing else needs a tuning table. Harder levels also make each enemy a
// little tougher (`levelMul`), so the answer to "I am stronger now" is not
// only "there are more of them".
//
// THEY ARRIVE IN BATCHES, NOT ALL AT ONCE. Archero drops the whole room in at
// once; here the arena is a big plaza, and ten enemies appearing at the same
// instant is a wall, not a threat. Batches keep the horde feel: the next one
// comes when the last is nearly dead, or after a gap, so a player cannot stall
// by refusing to engage.
import { BREEDS, LEVELS, poolFor, costOf } from './breeds.js';
import { makeFoe, spawnPoint, applyLevel, levelMul } from './foes.js';

// Level scaling moved to core/foes.js (a summoned Slayer must be scaled too);
// re-exported so everything that asked rooms.js for it still can.
export { levelMul };
import { lookFor } from './looks.js';

export const ROOM = {
  baseBudget: 10,
  perRoom: 0.20,
  perLevel: 0.22,
  // MORE, SMALLER, SOONER WAVES (Elad: walk in circles and the whole room trails you in one group).
  // A wave arrives while the last is still alive, and from AHEAD of where you are heading.
  batches: 4,
  aheadSpawn: true,          // later waves appear in front of the player's heading
  // Before the first one, so the player has a moment to see an empty room.
  firstDelayS: 0.4,
  // Between bodies in one batch: they stream in rather than pop in together.
  staggerS: 0.22,
  // The next batch comes when the living are down to this share of the last.
  refillAt: 0.55,
  // ...or when this long has passed, whichever is first.
  maxGapS: 5,
};

/** How much trouble room `roomIdx` (0-based) of `level` (1-based) holds. */
export function roomBudget(level, roomIdx) {
  // ?budget=80 forces every room to that size, for stress-testing a build.
  const forced = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('budget')) : 0;
  if (forced > 0) return forced;
  return Math.round(
    ROOM.baseBudget * Math.pow(1 + ROOM.perLevel, level - 1) * (1 + ROOM.perRoom * roomIdx));
}

/**
 * Spend a budget on a list of breeds.
 *
 * CHEAP ONES ARE COMMON: the draw is weighted by 1/cost, so a room is mostly
 * small enemies with the occasional big one, which is how a crowd looks. Picked
 * only from what is AFFORDABLE, so the budget is never overshot and the loop
 * always ends -- when nothing in the pool fits, the room is full.
 */
export function spendBudget(budget, pool, rng = Math.random) {
  const out = [];
  let left = budget;
  for (;;) {
    const fits = pool.filter((k) => costOf(k) <= left);
    if (!fits.length) break;
    const weights = fits.map((k) => 1 / costOf(k));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let pick = fits[fits.length - 1];
    for (let i = 0; i < fits.length; i++) { r -= weights[i]; if (r <= 0) { pick = fits[i]; break; } }
    out.push(pick);
    left -= costOf(pick);
  }
  return out;
}

/** Split a list into at most `n` roughly equal, non-empty batches. */
function split(list, n) {
  const k = Math.max(1, Math.min(n, list.length));
  const out = Array.from({ length: k }, () => []);
  list.forEach((b, i) => out[i % k].push(b));
  return out.filter((b) => b.length);
}

/**
 * Lay a room out. Everything random is decided HERE, with the injected rng,
 * so the same seed always builds the same room and a test can say exactly who
 * will turn up.
 *
 * The LAST room of a level is guaranteed its boss stand-in, held back to the
 * final batch: a level should end on the biggest thing in it, not on a lucky
 * draw of small ones.
 */
export function createRoom(level, roomIdx, rooms, rng = Math.random) {
  const levelIdx = level - 1;
  const def = LEVELS[levelIdx % LEVELS.length];
  const isLast = roomIdx >= rooms - 1;
  const budget = roomBudget(level, roomIdx);
  const pool = poolFor(levelIdx, roomIdx);

  let spend = budget;
  const boss = isLast && BREEDS[def.boss] ? def.boss : null;
  if (boss) spend = Math.max(0, budget - costOf(boss));

  const bodies = spendBudget(spend, pool, rng);
  const batches = split(bodies, ROOM.batches);
  if (boss) {
    if (batches.length) batches[batches.length - 1].push(boss);
    else batches.push([boss]);
  }

  return {
    level, index: roomIdx, rooms, isLast, budget, boss,
    // WHAT THE ROOM LOOKS LIKE AND HOW IT PLAYS: a theme and a layout. Decided
    // here, from where you are in the campaign, so the same room is always the
    // same place. See core/looks.js.
    look: lookFor(level, roomIdx),
    batches, batchIdx: 0,
    pending: [], lastBatchSize: 0,
    spawnT: 0, sinceBatchS: 0, t: 0,
    total: batches.reduce((n, b) => n + b.length, 0),
  };
}

const alive = (w) => w.foes.reduce((n, f) => n + (f.alive ? 1 : 0), 0);

/** Everything the room still owes the player: living, queued and not yet arrived. */
export function enemiesLeft(w, room) {
  const unarrived = room.batches.slice(room.batchIdx).reduce((n, b) => n + b.length, 0);
  return alive(w) + room.pending.length + unarrived;
}

/** Cleared means EVERYTHING has arrived AND everything that arrived is dead. */
export function roomCleared(w, room) {
  return room.t >= ROOM.firstDelayS
    && room.batchIdx >= room.batches.length
    && room.pending.length === 0
    && alive(w) === 0;
}

function bring(w, room, key, rng) {
  // Every wave after the first appears in a cone AHEAD of the player's travel, so a trailing pack is
  // met from the front instead of being topped up from behind.
  const p = spawnPoint(w.player.x, w.player.y, rng, w.obstacles, ROOM.aheadSpawn && room.batchIdx > 1 ? w.player.facing : null);
  const f = makeFoe(p.x, p.y, w.timeS, key);
  applyLevel(f, room.level);
  w.foes.push(f);
  w.targets.push(f);   // the SAME object -- see core/foes.js
  return f;
}

/** Advance the room by a frame: drip in the current batch, and decide when the next one is due. */
export function updateRoom(w, room, dt, rng = Math.random) {
  room.t += dt;
  if (room.t < ROOM.firstDelayS) return;

  if (room.pending.length) {
    room.spawnT -= dt;
    if (room.spawnT <= 0) {
      bring(w, room, room.pending.shift(), rng);
      room.spawnT = ROOM.staggerS;
    }
    return;
  }

  if (room.batchIdx >= room.batches.length) return;
  room.sinceBatchS += dt;
  const nearlyDone = alive(w) <= Math.ceil(room.lastBatchSize * ROOM.refillAt);
  if (room.batchIdx === 0 || nearlyDone || room.sinceBatchS >= ROOM.maxGapS) {
    room.pending = [...room.batches[room.batchIdx]];
    room.lastBatchSize = room.pending.length;
    room.batchIdx += 1;
    room.sinceBatchS = 0;
    room.spawnT = 0;
  }
}
