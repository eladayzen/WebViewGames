// Pizza-box collection tracks (progression update, 2026-07-30; revised per
// playtest feedback). Each box is filled by catching pizza slices "of" that
// box and completed for a flat bonus before its timer runs out.
//
// REGULAR is the bread-and-butter box, filled by ordinary gold pizza (the
// common drop) so the core catch loop is rewarding on its own. BLUE/PURPLE/
// RED are rarer, higher-value variant boxes filled by the matching
// glowing-slice variants (see render.js -- the variant slices are the SAME
// pizza art with a colored outer glow, NOT recolored sprites). Colors avoid
// green (ooze-reserved per STYLE.md) and amber/yellow (bomb-only).
//
// Only the 3 colored variants spawn as distinct falling items, so only they
// carry baseSpawnWeight/activeSpawnWeight (base = chance while the box is
// inactive; active = boosted chance while it's running, so committing to a
// box improves the odds of finishing in time -- see rollItemType). REGULAR
// has no spawn weights: it's fed by plain pizza, which is the spawn
// remainder. All numbers are first-pass/directional -- tune against feel.
export const BOX_COLORS = [
  {
    id: 'regular',
    label: 'Pizza',
    hex: '#E8A23C',
    requiredCount: 8,
    timerSec: 120,
    bonusScore: 100,
  },
  {
    id: 'blue',
    label: 'Blue',
    hex: '#3B8FE8',
    requiredCount: 8,
    timerSec: 60,
    bonusScore: 150,
    baseSpawnWeight: 0.05,
    activeSpawnWeight: 0.16,
  },
  {
    id: 'purple',
    label: 'Purple',
    hex: '#9B5DE5',
    requiredCount: 8,
    timerSec: 60,
    bonusScore: 220,
    baseSpawnWeight: 0.035,
    activeSpawnWeight: 0.13,
  },
  {
    id: 'red',
    label: 'Red',
    hex: '#E5325B',
    requiredCount: 8,
    timerSec: 60,
    bonusScore: 320,
    baseSpawnWeight: 0.02,
    activeSpawnWeight: 0.10,
  },
];

// The subset that spawns as its own glowing pizza variant (blue/purple/red).
// Regular is excluded -- it's fed by plain pizza (the spawn remainder).
export const SPAWNABLE_BOX_COLORS = BOX_COLORS.filter((c) => c.baseSpawnWeight != null);

export const BOX_COLOR_BY_ID = Object.fromEntries(BOX_COLORS.map((c) => [c.id, c]));
