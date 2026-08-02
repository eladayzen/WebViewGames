// Stage / difficulty-ramp definitions (build doc §5.2, §8, §12).
//
// 3 in-game stages for this MVP build (3 is an explicitly acceptable floor
// per §5.2; 5 is the ceiling for a future tuning pass -- not added here to
// keep the art budget and pacing-tuning surface reasonable for a first
// ship). Rooftop -> Fire Escape -> Alley, exactly the example order the doc
// gives.
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
export const STAGES = [
  {
    id: 'rooftop',
    name: 'Rooftop',
    bannerLabel: 'STAGE 1',
    bg: 'bg_rooftop',
    groundYFrac: 0.87,
    fallSpeedFrac: 0.16,
    spawnIntervalSec: 1.4,
    bombChance: 0.20,
    // Highest power-up rate of any stage ON PURPOSE (raised 0.12 -> 0.16,
    // 2026-08-02): the early game should hand out the most help (now
    // shield-dominated -- see powerUps.js) so a new player survives the
    // learning curve; later stages lower this as skill ramps up.
    powerUpChance: 0.16,
    // pizzaChance is implicit: 1 - bombChance - powerUpChance - box-variant weights
    // Level advancement is now SCORE-ONLY (2026-08-02): advanceTimeSec is
    // Infinity so a level changes at exactly its score threshold, never on a
    // timer. Cumulative thresholds grow by a rising increment ("in between"
    // linear and exponential -- arithmetic increments, quadratic total):
    //   L1->L2 1000 (+1000) | L2->L3 3000 (+2000) | L3->L4 6000 (+3000)
    //   | L4->L5 10000 (+4000) | ...
    // Only 2 transitions exist today (3 stages); the rest is the pattern for
    // any future stages.
    advanceScore: 1000,
    advanceTimeSec: Infinity,
  },
  {
    id: 'fire-escape',
    name: 'Fire Escape',
    bannerLabel: 'STAGE 2',
    bg: 'bg_fire_escape',
    groundYFrac: 0.85,
    fallSpeedFrac: 0.21,
    spawnIntervalSec: 1.15,
    bombChance: 0.28,
    powerUpChance: 0.13,
    advanceScore: 3000, // cumulative (+2000 over L1->L2's 1000), see stage 1 note
    advanceTimeSec: Infinity, // score-only advancement
  },
  {
    id: 'alley',
    name: 'Alley',
    bannerLabel: 'STAGE 3',
    bg: 'bg_alley',
    groundYFrac: 0.87,
    fallSpeedFrac: 0.26,
    spawnIntervalSec: 0.95,
    bombChance: 0.35,
    powerUpChance: 0.14,
    // Last stage: holds here. Denser late-game ramping beyond this is
    // explicitly Post-MVP scope (§2, §10) -- not built here.
    advanceScore: Infinity,
    advanceTimeSec: Infinity,
  },
];
