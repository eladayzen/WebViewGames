// Score, trick chain, and the SPEED WOBBLE meter (build doc §5.3, §8).
//
// The whole tension curve lives here: speed is the score, and speed is also what
// kills you. Going fast fills the wobble meter; carving is both the brake and
// the thing that settles it. So the player is continuously trading points
// against survival, using only the axis the board is comfortable with.
//
// WOBBLE IS OFF BY DEFAULT. It is kept whole rather than deleted, because the
// question of whether a run should have a speed-based fail state is a MODE
// question, not a physics one: a mission on a hard clock does not need a second
// way to lose, but a survival mode would be nothing without one. So a mode opts
// in (`wobble: true` on its definition) and everything below simply idles when
// it is off -- the meter never fills, nothing ever dies, and the HUD bar hides
// itself. Nothing about how the board FEELS changes either way; the wobble
// meter never fed back into the physics.

import { SPEED_REF } from '../data/constants.js';

// Above this fraction of SPEED_REF the meter starts filling.
//
// This has to sit ABOVE the rider's natural coasting terminal speed, or "do
// nothing" kills you and the design inverts. Terminal without tucking is
// sqrt(GRADE_ACCEL/DRAG) ~= 30.8 (1.03x SPEED_REF); with the tuck bonus it's
// ~34.6 (1.15x). A threshold of 1.02 means an upright coast is sustainable
// indefinitely and ONLY the tuck -- holding a straight line, the deliberate
// risk -- pushes the meter up. First pass used 0.62, which every playable speed
// exceeded, so every run died in about 8 seconds no matter what the player did.
const WOBBLE_THRESHOLD = 1.02;
const WOBBLE_FILL_RATE = 90; // per second at full overspeed (max over ~= 0.13)
const WOBBLE_SELF_DRAIN = 5; // per second below the threshold
const WOBBLE_CARVE_DRAIN = 30; // per second at full carve
const WOBBLE_LAND_DRAIN = 12; // one-off on a clean landing
const CHAIN_WINDOW = 4.0; // seconds to keep a chain alive

export function createScoring() {
  const s = {
    score: 0,
    wobble: 0,
    topSpeed: 0, // fastest speed reached this run, for the game-over summary
    chain: 1,
    chainTimer: 0,
    dead: false,
    lastEvent: null, // { text, points } consumed by the HUD for popups
  };

  // Opt-in, per mode. Off means the meter is inert, not that it is absent.
  let wobbleEnabled = false;

  function bumpChain() {
    s.chain = Math.min(9, s.chain + 1);
    s.chainTimer = CHAIN_WINDOW;
  }

  return {
    state: s,

    /** @param {boolean} on -- called by the mode host when a run starts. */
    setWobbleEnabled(on) {
      wobbleEnabled = !!on;
      if (!on) {
        s.wobble = 0;
        s.dead = false;
      }
    },
    get wobbleEnabled() { return wobbleEnabled; },

    reset() {
      s.score = 0;
      s.wobble = 0;
      s.topSpeed = 0;
      s.chain = 1;
      s.chainTimer = 0;
      s.dead = false;
      s.lastEvent = null;
    },

    /** Award trick points, scaled by the live chain multiplier. */
    award(points, text) {
      const total = Math.round(points * s.chain);
      s.score += total;
      s.lastEvent = { text, points: total, chain: s.chain };
      bumpChain();
    },

    /** Clipping something: wobble spike, and the chain resets. */
    hit(wobble, text) {
      if (wobbleEnabled) s.wobble = Math.min(100, s.wobble + wobble);
      s.chain = 1;
      s.chainTimer = 0;
      s.lastEvent = { text, points: 0, chain: 1 };
    },

    /** A clean landing settles the board a little. */
    land() {
      if (wobbleEnabled) s.wobble = Math.max(0, s.wobble - WOBBLE_LAND_DRAIN);
    },

    update(dt, speed, carve, grinding) {
      if (s.dead) return;

      // Distance score, weighted by speed -- fast metres are worth more AND
      // arrive sooner, so speed compounds into score twice. The wobble meter is
      // the counterweight that stops that being a free lunch.
      s.score += speed * dt * 1.4;
      if (speed > s.topSpeed) s.topSpeed = speed;

      if (wobbleEnabled) {
        const over = speed / SPEED_REF - WOBBLE_THRESHOLD;
        if (over > 0) {
          s.wobble += over * WOBBLE_FILL_RATE * dt;
        } else {
          s.wobble -= WOBBLE_SELF_DRAIN * dt;
        }
        // Carving settles the board: physically what a real rider does, and
        // mechanically it makes the safe act and the slow act the same act.
        s.wobble -= Math.abs(carve) * WOBBLE_CARVE_DRAIN * dt;
        // A grind is a committed, balanced moment -- hold it and you steady up.
        if (grinding) s.wobble -= 8 * dt;

        s.wobble = Math.max(0, Math.min(100, s.wobble));
        if (s.wobble >= 100) s.dead = true;
      }

      if (s.chainTimer > 0) {
        s.chainTimer -= dt;
        if (s.chainTimer <= 0) s.chain = 1;
      }
    },
  };
}
