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
    // True while this seat's board looks stepped-off or dropped. The pod stops
    // rather than ploughing, because a disconnected board reads as a CONSTANT
    // FULL LEAN and would otherwise fly into a wall and stay there.
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
