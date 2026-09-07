// The whole run, in one object. Flat typed arrays would be the next step if the
// POC ever needed them; at 26 monsters and 220 bullets, plain objects with an
// `alive` flag are honest and readable.

import { PLAYER, DESIGN_W, DESIGN_H } from '../data/tuning.js';
import { createToyState } from '../systems/toys.js';

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

    bullets: [],
    monsters: [],
    coins: [],
    toyPickups: [],
    toy: createToyState(),
    pops: [],         // confetti bursts, purely cosmetic

    camera: { x: 0, y: 0, starOffset: 0 },

    spawnT: 0,
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
