import { PLAY_AREA_LEFT_FRAC, PLAY_AREA_RIGHT_FRAC, ITEM_EDGE_MARGIN_FRAC } from './constants.js';

// Stage / difficulty-ramp definitions (build doc §5.2, §8, §12).
//
// 8 in-game stages (2026-08-06, up from the original MVP's 3 -- the future
// tuning pass the old comment here deferred). Rooftop -> Fire Escape ->
// Alley -> Subway -> Sewer -> Neon Street -> Warehouse Rooftop -> Docks,
// escalating from the doc's original rooftop/fire-escape/alley example
// order into a "descent into the city" arc that ends on the Docks as a
// finale set piece.
//
// All pacing numbers (fall speed, spawn interval, item-mix odds, thresholds)
// are DIRECTIONAL per §12 -- the source report could only loosely infer
// tempo from a sparse low-quality sample. Skewed conservative/slow on
// purpose, and tune-able here in one place once there's real on-device board
// feel to test against.
//
// fallSpeedFrac is expressed as "fractions of canvas height per second" so
// travel time (and therefore how much reaction time a falling item gives)
// stays consistent across canvas sizes.
//
// groundYFrac is PER STAGE, not global (2026-07-22) -- each background was
// painted at a different implied camera depth (the rooftop floor is a big
// close-up plane; the fire-escape deck recedes behind a railing close to
// camera; the alley recedes into a corridor), so one fixed ground line
// can't sit right against all three. PLAYER_HEIGHT_FRAC (constants.js), by
// contrast, is deliberately NOT per-stage -- Michelangelo is the same
// character at the same size no matter what level he's standing in;
// per-stage feedback about how he reads against a background is feedback
// on that background (groundYFrac, or the art itself), never a reason to
// resize him.
// TEMP (2026-08-06): every advanceScore below is a low testing value (50,
// 100, 150...) so all 8 stages -- especially the 5 new ones -- can be
// reached quickly for a playtest pass, instead of grinding real score.
// Each real production value is noted inline next to its temp value.
// Revert before shipping: restore each advanceScore to its noted real value.
// Per-stage play-area override (2026-08-06). A few backgrounds have real
// floor obstructions -- a railing's perspective corner, a raised curb, a
// pillar base -- sitting in the outer edges of the default 0.08-0.92 play
// area (found by compositing the player sprite against these backgrounds
// at the actual edges, not just center, after live screenshots showed him
// appearing to stand on the obstruction rather than the floor there).
// Narrowing how close the player -- and therefore items, which must stay
// reachable -- can get to those specific stages' edges keeps everyone
// clear of it, without touching groundYFrac or the art itself. Stages
// that omit these two fields use the global default from constants.js.
// Deliberately just two numbers per affected stage, not a scale/offset
// transform system -- see systems using this: entities/player.js (movement
// clamp), entities/fallingItem.js (magnet-pull clamp), systems/spawner.js
// (spawn x-range), core/main.js (forced-bomb edge target).
export function getPlayAreaBounds(stage) {
  const left = stage.playAreaLeftFrac ?? PLAY_AREA_LEFT_FRAC;
  const right = stage.playAreaRightFrac ?? PLAY_AREA_RIGHT_FRAC;
  return {
    left,
    right,
    itemLeft: left + ITEM_EDGE_MARGIN_FRAC,
    itemRight: right - ITEM_EDGE_MARGIN_FRAC,
  };
}

export const STAGES = [
  {
    id: 'rooftop',
    name: 'Rooftop',
    bannerLabel: 'STAGE 1',
    bg: 'bg_rooftop',
    groundYFrac: 0.87,
    fallSpeedFrac: 0.16,
    spawnIntervalSec: 1.4,
    bombChance: 0.24, // a bit more, not a lot (2026-08-05, was 0.20) -- see systems/bombPresence.js for the separate "never too long without one" floor
    // Highest power-up rate of any stage ON PURPOSE (raised 0.12 -> 0.16,
    // 2026-08-02): the early game should hand out the most help (now
    // shield-dominated -- see powerUps.js) so a new player survives the
    // learning curve; later stages lower this as skill ramps up.
    powerUpChance: 0.16,
    // pizzaChance is implicit: 1 - bombChance - powerUpChance - box-variant weights
    // Level advancement is SCORE-ONLY (2026-08-02): advanceTimeSec is Infinity
    // so a level changes at exactly its score threshold, never on a timer.
    // Cumulative thresholds; the per-level increment grows by 500 from L3 on:
    //   L1->L2 500 | L2->L3 3000 | L3->L4 4500 (+1500) | L4->L5 6500 (+2000)
    //   | L5->L6 9000 (+2500) | ... (+500 each level)
    // Only 2 transitions exist today (3 stages); the rest is the pattern for
    // any future stages.
    advanceScore: 50, // TEMP testing value (2026-08-06, spiced up), real value: 500
    advanceTimeSec: Infinity,
  },
  {
    id: 'fire-escape',
    name: 'Fire Escape',
    bannerLabel: 'STAGE 2',
    bg: 'bg_fire_escape',
    groundYFrac: 0.85,
    // Railing's perspective corner crosses the floor line past this point
    // on both sides -- verified clear via sprite composite (2026-08-06).
    playAreaLeftFrac: 0.14,
    playAreaRightFrac: 0.86,
    fallSpeedFrac: 0.21,
    spawnIntervalSec: 1.15,
    bombChance: 0.32, // a bit more, not a lot (2026-08-05, was 0.28)
    powerUpChance: 0.13,
    advanceScore: 100, // TEMP testing value (2026-08-06, spiced up), real value: 3000
    advanceTimeSec: Infinity, // score-only advancement
  },
  {
    id: 'alley',
    name: 'Alley',
    bannerLabel: 'STAGE 3',
    bg: 'bg_alley',
    groundYFrac: 0.87,
    // Raised loading-dock curb crosses the floor line past this point on
    // both sides -- verified clear via sprite composite (2026-08-06). A
    // pre-existing issue (this stage predates the 5 new ones), only found
    // once a live screenshot sweep checked the edges, not just center.
    playAreaLeftFrac: 0.13,
    playAreaRightFrac: 0.85,
    fallSpeedFrac: 0.26,
    spawnIntervalSec: 0.95,
    bombChance: 0.39, // a bit more, not a lot (2026-08-05, was 0.35)
    powerUpChance: 0.14,
    // No longer the last stage (2026-08-06) -- advances at the L3->L4
    // threshold the original comment already reserved for this (4500,
    // +1500 over L2->L3's 2500 -- the "+500 per level from L3 on" pattern).
    advanceScore: 200, // TEMP testing value (2026-08-06, spiced up), real value: 4500
    advanceTimeSec: Infinity,
  },
  {
    id: 'subway',
    name: 'Subway',
    bannerLabel: 'STAGE 4',
    bg: 'bg_subway',
    // Tuned the same way as fire-escape/alley (2026-08-06): the sprite's
    // feet were test-composited onto the actual background art at several
    // candidate values before picking this one, specifically to avoid
    // repeating the fire-escape "standing on a fence" ambiguity.
    groundYFrac: 0.86,
    // Flanking pillar bases sit deep into both edges -- needed a bigger
    // margin than fire-escape/alley to fully clear their raised plinths,
    // verified via sprite composite (2026-08-06).
    playAreaLeftFrac: 0.24,
    playAreaRightFrac: 0.76,
    fallSpeedFrac: 0.30,
    spawnIntervalSec: 0.82,
    bombChance: 0.42,
    powerUpChance: 0.13,
    advanceScore: 400, // TEMP testing value (2026-08-06, spiced up), real value: 6500
    advanceTimeSec: Infinity,
  },
  {
    id: 'sewer',
    name: 'Sewer',
    bannerLabel: 'STAGE 5',
    bg: 'bg_sewer',
    groundYFrac: 0.86,
    fallSpeedFrac: 0.33,
    spawnIntervalSec: 0.72,
    bombChance: 0.45,
    powerUpChance: 0.12,
    advanceScore: 600, // TEMP testing value (2026-08-06, spiced up), real value: 9000
    advanceTimeSec: Infinity,
  },
  {
    id: 'neon-street',
    name: 'Neon Street',
    bannerLabel: 'STAGE 6',
    bg: 'bg_neon_street',
    groundYFrac: 0.89,
    fallSpeedFrac: 0.36,
    spawnIntervalSec: 0.64,
    bombChance: 0.47,
    powerUpChance: 0.12,
    advanceScore: 800, // TEMP testing value (2026-08-06, spiced up), real value: 12000
    advanceTimeSec: Infinity,
  },
  {
    id: 'warehouse',
    name: 'Warehouse Rooftop',
    bannerLabel: 'STAGE 7',
    bg: 'bg_warehouse',
    groundYFrac: 0.89,
    fallSpeedFrac: 0.38,
    spawnIntervalSec: 0.58,
    bombChance: 0.49,
    powerUpChance: 0.11,
    advanceScore: 1000, // TEMP testing value (2026-08-06, spiced up), real value: 15500
    advanceTimeSec: Infinity,
  },
  {
    id: 'docks',
    name: 'Docks',
    bannerLabel: 'STAGE 8',
    bg: 'bg_docks',
    groundYFrac: 0.83,
    fallSpeedFrac: 0.40,
    spawnIntervalSec: 0.52,
    bombChance: 0.50,
    powerUpChance: 0.11,
    // Last stage: holds here, same as the old alley finale. Denser
    // late-game ramping beyond this is still Post-MVP scope (§2, §10).
    advanceScore: Infinity,
    advanceTimeSec: Infinity,
  },
];
