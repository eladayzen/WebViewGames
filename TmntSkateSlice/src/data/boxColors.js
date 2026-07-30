// Pizza-box collection color variants (Part 1 of the progression update,
// 2026-07-30). Each color is an independent "box" the player fills by
// catching matching-color pizza slices before its timer runs out, for a
// flat completion bonus. Data-only table (mirrors data/stages.js's
// per-entity convention) so rarity/timing/value tuning is a data edit, not
// a logic change -- the behavior lives in systems/boxes.js.
//
// Colors deliberately avoid green (reserved for the ooze power-up per
// STYLE.md's semantic-color rule) and amber/yellow (bomb-only). Rarity and
// bonus are graded so which color to chase is a real risk/reward call: blue
// is the common/low-value box, red the rare/high-value one. requiredCount
// is the same (8) for all three so the mental model ("I need 8") stays
// simple; the tension is rarity + the timer, not a moving target.
//
// baseSpawnWeight = spawn chance while the box is INACTIVE (a deliberately
// rare "opportunity" drop). activeSpawnWeight = the boosted chance while the
// box is running, so committing to a box measurably improves the odds of
// finishing it in time instead of being pure luck (see rollItemType in
// data/itemTypes.js, which reads the live box state). All numbers are
// first-pass/directional -- tune against real on-device feel.
export const BOX_COLORS = [
  {
    id: 'blue',
    label: 'Blue',
    sprite: 'pizza_slice_blue',
    hex: '#3B8FE8',
    requiredCount: 8,
    timerSec: 30,
    bonusScore: 150,
    baseSpawnWeight: 0.05,
    activeSpawnWeight: 0.16,
  },
  {
    id: 'purple',
    label: 'Purple',
    sprite: 'pizza_slice_purple',
    hex: '#9B5DE5',
    requiredCount: 8,
    timerSec: 30,
    bonusScore: 220,
    baseSpawnWeight: 0.035,
    activeSpawnWeight: 0.13,
  },
  {
    id: 'red',
    label: 'Red',
    sprite: 'pizza_slice_red',
    hex: '#E5325B',
    requiredCount: 8,
    timerSec: 30,
    bonusScore: 320,
    baseSpawnWeight: 0.02,
    activeSpawnWeight: 0.10,
  },
];

export const BOX_COLOR_BY_ID = Object.fromEntries(BOX_COLORS.map((c) => [c.id, c]));
