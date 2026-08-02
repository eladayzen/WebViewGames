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
//
// COMPLETION REWARDS (2026-08-02): completing a box now auto-grants a booster
// (and the top box an extra life) -- see `reward` below and rollBoxReward().
// `reward.boosters` is a weighted pick of exactly ONE effect (weights are
// relative, not percentages); `reward.grantLife` adds a heart on top. The
// effects map to the same grant logic as the falling shield/wave/magnet
// pickups in core/main.js ('wave' is the "blow up" that clears every bomb).
// Higher tiers unlock more/better options and the top tier a life -- a real
// escalating payoff for the rarer, harder boxes.
export const BOX_COLORS = [
  {
    id: 'regular',
    label: 'Pizza',
    hex: '#E8A23C',
    requiredCount: 8,
    timerSec: 120,
    bonusScore: 100,
    // Common box: magnet or shield, 2:1 (~66% magnet / ~33% shield).
    reward: { boosters: [['magnet', 2], ['shield', 1]], grantLife: false },
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
    // Shield or "blow up" (wave), 50/50.
    reward: { boosters: [['shield', 1], ['wave', 1]], grantLife: false },
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
    // One of shield / wave / magnet, roughly even.
    reward: { boosters: [['shield', 1], ['wave', 1], ['magnet', 1]], grantLife: false },
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
    // Top box: one of the three boosters AND an extra life.
    reward: { boosters: [['shield', 1], ['wave', 1], ['magnet', 1]], grantLife: true },
  },
];

// The subset that spawns as its own glowing pizza variant (blue/purple/red).
// Regular is excluded -- it's fed by plain pizza (the spawn remainder).
export const SPAWNABLE_BOX_COLORS = BOX_COLORS.filter((c) => c.baseSpawnWeight != null);

export const BOX_COLOR_BY_ID = Object.fromEntries(BOX_COLORS.map((c) => [c.id, c]));

// Roll a completion reward for the given box color: weighted-pick one booster
// effect from its table, plus whether it also grants a life. Called by
// core/main.js the frame a box completes; main.js does the actual granting.
export function rollBoxReward(colorId) {
  const cfg = BOX_COLOR_BY_ID[colorId];
  const table = (cfg && cfg.reward && cfg.reward.boosters) || [];
  const grantLife = !!(cfg && cfg.reward && cfg.reward.grantLife);
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  let effect = table.length ? table[0][0] : null;
  for (const [eff, w] of table) {
    r -= w;
    if (r < 0) { effect = eff; break; }
  }
  return { effect, grantLife };
}
