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

export const STAGES = [
  {
    id: 'rooftop',
    name: 'Rooftop',
    bannerLabel: 'STAGE 1',
    bg: 'bg_rooftop',
    fallSpeedFrac: 0.16,
    spawnIntervalSec: 1.4,
    bombChance: 0.20,
    oozeChance: 0.05,
    // pizzaChance is implicit: 1 - bombChance - oozeChance
    advanceScore: 150,
    advanceTimeSec: 45,
  },
  {
    id: 'fire-escape',
    name: 'Fire Escape',
    bannerLabel: 'STAGE 2',
    bg: 'bg_fire_escape',
    fallSpeedFrac: 0.21,
    spawnIntervalSec: 1.15,
    bombChance: 0.28,
    oozeChance: 0.06,
    advanceScore: 400,
    advanceTimeSec: 100,
  },
  {
    id: 'alley',
    name: 'Alley',
    bannerLabel: 'STAGE 3',
    bg: 'bg_alley',
    fallSpeedFrac: 0.26,
    spawnIntervalSec: 0.95,
    bombChance: 0.35,
    oozeChance: 0.07,
    // Last stage: holds here. Denser late-game ramping beyond this is
    // explicitly Post-MVP scope (§2, §10) -- not built here.
    advanceScore: Infinity,
    advanceTimeSec: Infinity,
  },
];
