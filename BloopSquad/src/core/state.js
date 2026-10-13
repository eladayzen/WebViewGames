// The whole run, in one object. Flat typed arrays would be the next step if the
// POC ever needed them; at 26 monsters and 220 bullets, plain objects with an
// `alive` flag are honest and readable.

import { PLAYER, MONSTERS, HUD, COOP, coop, DESIGN_W, DESIGN_H } from '../data/tuning.js';

export const GameState = { BOOT: 'boot', RUNNING: 'running', FAILED: 'failed' };

/**
 * The pods, one per seat.
 *
 * Seat 0 starts in the middle because that is where a single player has always
 * started and a one-player run must be unchanged. Two pods start apart, far
 * enough that neither child begins the run already overlapping the other --
 * two identical shapes on top of each other is how a six-year-old loses track
 * of which one is theirs in the first second.
 */
export function makePods(n) {
  const count = Math.max(1, Math.min(4, n | 0));
  const spread = count === 1 ? 0 : PLAYER.coopSpreadPx;
  return Array.from({ length: count }, (_, i) => ({
    slot: i,
    // Centred for one, evenly spaced either side of centre for more.
    x: PLAYER.startX + (i - (count - 1) / 2) * spread,
    y: PLAYER.startY,
    invulnT: 0,
    alive: true,
    fireT: 0,
    lean: 0,        // -1..1, for the pod's tilt

    // WHAT THIS SEAT DID. Per-pod, alongside the shared w.stats, and only ever
    // read by the end screen -- nothing in the simulation branches on it.
    //
    // It exists because co-op has one score and two children, and a team result
    // that says only "4200 points" tells neither of them what they did. These
    // are a CONTRIBUTION, not a ranking: they are never compared on screen, and
    // the board stores the team's total, not a split of it. Two siblings being
    // handed a verdict on which of them was better is the exact thing a shared
    // score was chosen to avoid.
    popped: 0,
    coins: 0,
    points: 0,
    // Vestigial: nothing writes or reads it any more. The dropped-board guard
    // that used to zero this seat's input fired on a child simply HOLDING a
    // lean -- see the note at the top of updatePod in systems/play.js -- and
    // was removed. Kept as a field only so a future hardware-driven version has
    // an obvious home.
    dropped: false,
  }));
}

export function createWorld(seats = 1) {
  const count = Math.max(1, Math.min(4, seats | 0));
  return {
    state: GameState.BOOT,
    time: 0,
    paused: false,

    // ONE POD PER BOARD. Index 0 is always the phone's own board, which is why
    // a one-player run is just this array with a single entry and no special
    // case anywhere downstream.
    //
    // CO-OP, NOT VERSUS: one field, one camera, one score, and HEARTS ARE
    // SHARED (see `hearts` below). Per-player lives would mean the first child
    // to run out sits and watches their sibling play, which for a six-year-old
    // is the whole game ending early while appearing not to. Nobody is ever
    // eliminated; the run ends for both or for neither.
    players: makePods(count),

    // THE TEAM'S HEARTS, deliberately on the world and not on a pod. See above.
    //
    // NAMED `lives`, NOT `hearts`, because `hearts` below is already the array
    // of heart PICKUPS on the field. Two different things with one obvious
    // name: the count the HUD draws, and the collectables lying around. The
    // first draft used `hearts` for both and the object literal silently kept
    // only the last one, which would have deleted the pickups entirely.
    lives: coop(COOP.hearts, count),

    // THE ULTIMATE. `beamCharge` fills with the points of everything popped;
    // at COOP.beam.chargePoints it empties and `beamActiveT` starts running.
    beamCharge: 0,
    beamActiveT: 0,
    // How many ultimates this run has spent; each costs 1.2x the last.
    beamUses: 0,

    // The rescued squad, and the pod's recent path they follow along. The
    // history is sampled every frame and read at a delay per member, which is
    // what makes them trace the player's exact route rather than chase it --
    // a chase produces a clump on every turn, a delay produces a line.
    squad: [],
    trail: [],
    blasts: [],      // expanding rings from detonations

    // XP and levels: WITHIN THIS RUN ONLY. Nothing is saved and nothing is
    // granted -- a level is a number, a colour and a noise. See tuning.js XP.
    xp: 0,
    level: 1,
    levelPopup: null,

    bullets: [],
    monsters: [],
    coins: [],
    hearts: [],      // heart pickups; see popMonster / updateHearts
    toyPickups: [],
    // EVERY ACTIVE TOY, not one. Each instance carries its own timers and its
    // own state, which is the whole of what lets them cooperate -- see
    // createToyInstance. `lastToyDropT` is world bookkeeping and never belonged
    // to a toy in the first place.
    toys: [],
    lastToyDropT: -99,
    // When each toy family last produced a present. Drives the rotation that
    // stops a run handing out four shooters and no bombs -- see pickToyKind.
    familyLastDropT: { shooter: -99, bomb: -99, close: -99 },
    pops: [],         // confetti bursts, purely cosmetic

    camera: { x: 0, y: 0, starOffset: 0 },

    // The debug contract. Read by the collision code and the renderer every
    // frame; written only by the dev panel. Lives on the world rather than in a
    // module so resetWorld clears it -- a flag that survived a restart would be
    // the worst possible kind of bug to chase.
    debug: { invincible: false },

    // The warm-up: an empty field for the first few seconds of every run, so
    // the first thing a child does is find out what the pod does. resetWorld
    // rebuilds from here, so R gets the same grace as a cold start.
    spawnT: MONSTERS.warmUpS,
    lastHeartT: -99,
    stats: {
      score: 0,
      coins: 0,
      popped: 0,
      // THE POC'S REAL OUTPUT. Feel is judged standing up; these are what the
      // session takes away in writing.
      contacts: 0,       // times something touched the pod
      nearMisses: 0,     // passed within a whisker without touching
      worstReactionS: 99, // shortest time any monster gave from entering to reaching the pod's row
      passes: 0,          // monsters that crossed the pod's row at all
      toysUsed: 0,
      // Seeded from HUD.showStats so that flag actually governs the readout.
      // The dev panel flips this directly at runtime.
      showStatsOff: !HUD.showStats,
    },
  };
}

export function resetWorld(w) {
  // SAME SEAT COUNT ACROSS A RESTART. PLAY AGAIN with two children standing on
  // two boards must not quietly drop one of them.
  const fresh = createWorld(w.players ? w.players.length : 1);
  for (const k of Object.keys(fresh)) w[k] = fresh[k];
  w.state = GameState.RUNNING;
  return w;
}

export const WORLD_W = DESIGN_W;
export const WORLD_H = DESIGN_H;

/** The pod nearest a point. What every pickup magnet homes to in co-op. */
export function nearestPod(w, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of w.players) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return { pod: best || w.players[0], d: bestD };
}

/**
 * Grow or shrink the pod array to `n` seats, keeping the pods that already
 * exist exactly as they are.
 *
 * THE HOST IS SLOWER THAN BOOT. The bridge publishes its first roster a frame
 * or two after the page loads, so a run starts as one player and becomes two
 * when the app says so. Rebuilding the array wholesale would teleport player
 * one back to the centre mid-run, so existing pods are left untouched and only
 * the difference is added.
 */
export function resizePods(w, n) {
  const count = Math.max(1, Math.min(4, n | 0));
  if (count === w.players.length) return false;
  if (count < w.players.length) {
    w.players.length = count;
    return true;
  }
  const before = w.players.length;
  const fresh = makePods(count);
  for (let i = before; i < count; i++) {
    const pod = fresh[i];
    // Placed relative to the pod that is already flying, not to the centre --
    // a seat arriving mid-run must not land on top of player one, and player
    // one may be anywhere by then.
    const anchor = w.players[0];
    const side = (i % 2 === 1) ? 1 : -1;
    pod.x = Math.max(PLAYER.clampMarginX,
            Math.min(DESIGN_W - PLAYER.clampMarginX,
                     anchor.x + side * PLAYER.coopSpreadPx * Math.ceil(i / 2)));
    pod.y = anchor.y;
    w.players.push(pod);
  }
  // THE HEART POOL GROWS WITH THE TABLE. A run that started as one player and
  // became two would otherwise keep five hearts for two children. Only the
  // DIFFERENCE in the maximum is granted, so hearts already lost stay lost.
  const gain = coop(COOP.hearts, count) - coop(COOP.hearts, before);
  if (gain > 0) w.lives = Math.min(coop(COOP.hearts, count), w.lives + gain);
  return true;
}
