// WHAT YOU GET, DECIDED BY LUCK, REVEALED IN UNDER TWO SECONDS.
//
// This replaces the lean-and-hold choice screen. Elad's reasoning, 22 Nov:
// choosing with a balance board "is not as fun" as choosing with a regular
// input, and what he wants instead is the moment of "what will I get this
// time" -- over fast, a payoff, "wow, new ability". Two seconds, tops.
//
// SO THERE IS NO INPUT AT ALL. The roll runs by itself, which also means the
// run can never stall waiting for a lean, and a whole level can be played
// unattended in a test.
//
// NO CHOICE MEANS A BAD ROLL IS THE GAME'S FAULT, not the player's, and the
// game has to guard against that:
//
//   - A MAXED ABILITY IS NEVER ROLLED. A reveal of something that does
//     nothing is the single worst outcome here.
//   - REPEATS ARE LESS LIKELY, NOT FORBIDDEN. Each copy already owned scales an
//     ability's weight down, so the roll leans toward what you do NOT have yet
//     -- the thing that feels like finding something -- without ever hiding a
//     good ability from someone who wants a second one.
//
// THE RESULT IS FIXED THE MOMENT THE ROLL IS CREATED. The animation is a
// playback, not a draw: if it were the other way round a dropped frame could
// show the player one ability and grant them another.
import { ABILITIES, offerable } from './abilities.js';

export const ROLL = {
  // The box shakes. This is the "what will it be" -- the anticipation.
  spinS: 1.0,
  // ...and the answer stays on screen long enough to read.
  holdS: 1.0,        // 0.8 -> 1.0: a permanent find flies into Raphael's sheet and burns in during it (total stays at the 2 s ceiling)
  // Each copy already owned multiplies the weight by this.
  repeatFalloff: 0.65,
  // How many different game-changing powers a run is guaranteed before the stat upgrades start.
  earlyBig: 2,
};

/** How long the whole thing takes. Elad's ceiling is two seconds. */
export const rollDurationS = () => ROLL.spinS + ROLL.holdS;

/** The weight of every ability that could still be rolled, for this build. */
export const ALLY_KEYS = ['leo', 'mikey', 'donnie'];
/** A run goes at most this many cleared rooms before a turtle joins (Elad, 24 Nov). */
export const ALLY_BY_ROOM = 1;      // 0-based: the roll after the SECOND room is guaranteed to be a turtle

export function rollWeights(build, ctx = {}) {
  const out = {};
  // THE FIRST TURTLE ARRIVES WITHIN TWO ROOMS. Until one is held, turtles are far more likely, and the roll
  // after the second room can only be a turtle.
  const hasAlly = ALLY_KEYS.some((k) => build[k] > 0);
  const lackAlly = !hasAlly && offerable(build).some((k) => ALLY_KEYS.includes(k));
  if (lackAlly && (ctx.room ?? 0) >= ALLY_BY_ROOM) {
    for (const k of offerable(build).filter((k) => ALLY_KEYS.includes(k))) out[k] = ABILITIES[k].weight ?? 1;
    return out;
  }
  const allyBoost = lackAlly ? 4 : 1;
  // THE FIRST POWERS ARE GAME-CHANGERS (Elad: "too boring too quick"). Until the build holds EARLY_BIG
  // different ones (allies, shield, stars, twin daggers, pierce), only those are rolled -- the free start
  // roll and the first room's roll both change how the run plays, and the stat upgrades come after.
  const bigHeld = Object.keys(ABILITIES).filter((k) => ABILITIES[k].big && build[k] > 0).length;
  if (bigHeld < ROLL.earlyBig) {
    const bigs = offerable(build).filter((k) => ABILITIES[k].big);
    if (bigs.length) {
      for (const k of bigs) out[k] = (ABILITIES[k].weight ?? 1) * Math.pow(ROLL.repeatFalloff, build[k]) * (ALLY_KEYS.includes(k) ? allyBoost : 1);
      return out;
    }
  }
  for (const k of offerable(build)) {
    out[k] = (ABILITIES[k].weight ?? 1) * Math.pow(ROLL.repeatFalloff, build[k]) * (ALLY_KEYS.includes(k) ? allyBoost : 1);
  }
  // HALF THE ROLLS ARE PERMANENT, HALF TEMPORARY (Elad: a run held 8 permanent and 1 temporary). The
  // weights are rescaled so each kind carries 50% of the total, however many of each there are.
  const sum = { perm: 0, temp: 0 };
  for (const k of Object.keys(out)) sum[ABILITIES[k].kind] += out[k];
  if (sum.perm > 0 && sum.temp > 0) for (const k of Object.keys(out)) out[k] *= 0.5 / sum[ABILITIES[k].kind];
  return out;
}

/** One ability key, or null when every ability is maxed out. */
export function rollAbility(build, rng = Math.random, ctx = {}) {
  const w = rollWeights(build, ctx);
  const keys = Object.keys(w);
  if (!keys.length) return null;
  let r = rng() * keys.reduce((a, k) => a + w[k], 0);
  for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

/**
 * A roll in progress. With nothing left to give it is born `done`, so the run
 * skips straight past it instead of showing an empty box.
 */
export function createRoll(build, rng = Math.random, ctx = {}) {
  const key = rollAbility(build, rng, ctx);
  return { key, t: 0, phase: key ? 'spin' : 'done', done: !key };
}

/** Advance by a frame. Returns true on the frame the roll finishes. */
export function updateRoll(roll, dt) {
  if (roll.done) return false;
  roll.t += dt;
  if (roll.t >= ROLL.spinS + ROLL.holdS) {
    roll.phase = 'done';
    roll.done = true;
    return true;
  }
  roll.phase = roll.t >= ROLL.spinS ? 'reveal' : 'spin';
  return false;
}
