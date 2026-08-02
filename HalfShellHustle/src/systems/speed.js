// World scroll speed over time -- direct feedback: the old fixed speed
// becomes the MAXIMUM (minus 10%), and a run now starts 30% below that and
// ramps up, so a new player eases into the loop instead of being dropped
// into it at full pace.
//
// Everything in the world scrolls at ONE speed per frame (core/main.js reads
// speedAt(gameTime) once and passes it to every pool). That single-global-
// speed property is load-bearing, not incidental: entities/platform.js and
// data/spawnConfig.js both document spacing rules that only hold because any
// two active entities keep a FIXED z-separation forever. Give any pool its
// own multiplier and those rules break.
//
// The ramp is linear in time, which makes both integrals below closed-form --
// no per-frame accumulator, so "how far have we scrolled by time t" has
// exactly one answer that spawn-placement math and the HUD agree on.

import { SPEED_START, SPEED_MAX, SPEED_RAMP_DURATION_SEC } from '../data/constants.js';

const DELTA_V = SPEED_MAX - SPEED_START;
// Acceleration/2, the quadratic coefficient shared by both integrals below.
// Zero when the ramp is disabled (start === max, a flat-speed A/B test) or
// the duration is zero -- both branches below special-case that rather than
// dividing by it.
const RAMP_A = SPEED_RAMP_DURATION_SEC > 0 ? DELTA_V / (2 * SPEED_RAMP_DURATION_SEC) : 0;
// Distance covered by the moment the ramp tops out -- the boundary between
// each function's quadratic and linear branch.
const RAMP_DISTANCE = SPEED_START * SPEED_RAMP_DURATION_SEC
  + (DELTA_V * SPEED_RAMP_DURATION_SEC) / 2;

// Scroll speed (world units/sec) at `t` seconds into the run.
export function speedAt(t) {
  if (t >= SPEED_RAMP_DURATION_SEC) return SPEED_MAX;
  return SPEED_START + DELTA_V * (t / SPEED_RAMP_DURATION_SEC);
}

// Total world distance scrolled from run start through `t` -- the integral of
// speedAt. Used for BOTH the HUD distance readout and every "place this so it
// arrives at time X" calculation (core/main.js's seedPipeline), so those can
// never disagree.
export function distanceTraveledBy(t) {
  if (t >= SPEED_RAMP_DURATION_SEC) {
    return RAMP_DISTANCE + SPEED_MAX * (t - SPEED_RAMP_DURATION_SEC);
  }
  return SPEED_START * t + (DELTA_V * t * t) / (2 * SPEED_RAMP_DURATION_SEC);
}

// The speed the world will be scrolling at once a total of `distance` has
// been covered since run start.
//
// This is the closed-form solution of the quadratic in distanceTraveledBy,
// and it falls out remarkably cleanly: the discriminant IS the speed, so
// there's no need to solve for a time and then evaluate speedAt at it --
// sqrt(v0^2 + 4a*D) equals speedAt(timeToTravel(D)) exactly (verified
// numerically across the ramp). The clamp is load-bearing: that identity
// only holds INSIDE the ramp, and past RAMP_DISTANCE the sqrt keeps growing
// while the real speed is pinned at SPEED_MAX.
//
// entities/coins.js needs this to lay a jump-arc coin cluster out against the
// speed the player will actually have when he reaches it, rather than the
// speed at the moment it spawned -- see buildArc.
export function speedAfterTraveling(distance) {
  if (RAMP_A === 0 || distance >= RAMP_DISTANCE) return SPEED_MAX;
  return Math.min(Math.sqrt(SPEED_START * SPEED_START + 4 * RAMP_A * distance), SPEED_MAX);
}

// Inverse of distanceTraveledBy: how many seconds into the run the world will
// have scrolled `distance` units. Solving the same quadratic falls out of the
// function above almost for free -- t = (v(D) - v0) / 2a -- so this reuses that
// root rather than repeating the sqrt, and the two can never disagree.
//
// systems/difficulty.js needs this to convert "spawning something now" into
// "the player meets it at time X". Those are ~13 seconds apart at the start of
// a run, which is the whole reason it exists: an easing curve keyed on spawn
// time would already be over by the time any of it reached the player.
export function timeToTravel(distance) {
  if (distance <= 0) return 0;
  if (RAMP_A === 0) return distance / SPEED_MAX;
  if (distance >= RAMP_DISTANCE) {
    return SPEED_RAMP_DURATION_SEC + (distance - RAMP_DISTANCE) / SPEED_MAX;
  }
  return (speedAfterTraveling(distance) - SPEED_START) / (2 * RAMP_A);
}
