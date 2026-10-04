// The whole run, in one object. Flat typed arrays would be the next step if the
// POC ever needed them; at 26 monsters and 220 bullets, plain objects with an
// `alive` flag are honest and readable.

import { PLAYER, MONSTERS, DESIGN_W, DESIGN_H } from '../data/tuning.js';

export const GameState = { BOOT: 'boot', RUNNING: 'running', FAILED: 'failed' };

export function createWorld() {
  return {
    state: GameState.BOOT,
    time: 0,
    paused: false,

    player: {
      x: PLAYER.startX,
      y: PLAYER.startY,
      hearts: PLAYER.hearts,
      invulnT: 0,
      alive: true,
      fireT: 0,
      lean: 0,        // -1..1, for the pod's tilt
    },

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
    },
  };
}

export function resetWorld(w) {
  const fresh = createWorld();
  for (const k of Object.keys(fresh)) w[k] = fresh[k];
  w.state = GameState.RUNNING;
  return w;
}

export const WORLD_W = DESIGN_W;
export const WORLD_H = DESIGN_H;
