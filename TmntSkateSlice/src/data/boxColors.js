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
// COMPLETION REWARDS (2026-08-02, revised): completing a box auto-grants
// pickups scaled by box difficulty -- `reward.boosterCount` DISTINCT boosters
// (magnet / shield / 'wave' blow-up), plus `reward.grantLife` for a heart.
// Regular gives 1, Blue 2, Purple all 3, Red an extra life ONLY (no pickups).
// rollBoxReward picks the distinct set (pickDistinctBoosters); main.js grants
// them + fires the celebration. Same grant path as the falling pickups and the
// bomb-kill set.
//
// TIMER REFILL (2026-08-04): every catch that ADDS to an already-active box
// (not just the first one that starts it) also tops the timer back up by
// `timerBonusSec`, capped at the box's own `timerSec` -- committing to a box
// and actively feeding it keeps its clock topped up, rather than only ever
// draining. See systems/boxes.js's registerBoxCatch.
import { pickDistinctBoosters } from './powerUps.js';

export const BOX_COLORS = [
  {
    id: 'regular',
    label: 'Pizza',
    hex: '#E8A23C',
    requiredCount: 8,
    timerSec: 78, // 50% faster (2026-08-04, was 156) -- now matches the other 3 boxes' timer
    timerBonusSec: 8, // added back to the timer per catch (~10% of timerSec), capped at timerSec
    bonusScore: 100,
    // Common box: 1 random pickup (any of magnet/shield/blow-up, never life).
    reward: { boosterCount: 1, grantLife: false },
  },
  {
    id: 'blue',
    label: 'Blue',
    hex: '#3B8FE8',
    requiredCount: 8,
    timerSec: 78, // +30% for easier completion (2026-08-02), was 60
    timerBonusSec: 8, // added back to the timer per catch (~10% of timerSec), capped at timerSec
    bonusScore: 150,
    baseSpawnWeight: 0.05,
    activeSpawnWeight: 0.16,
    // 2 different pickups.
    reward: { boosterCount: 2, grantLife: false },
  },
  {
    id: 'purple',
    label: 'Purple',
    hex: '#9B5DE5',
    requiredCount: 8,
    timerSec: 78, // +30% for easier completion (2026-08-02), was 60
    timerBonusSec: 8, // added back to the timer per catch (~10% of timerSec), capped at timerSec
    bonusScore: 220,
    baseSpawnWeight: 0.035,
    activeSpawnWeight: 0.13,
    // All 3 different pickups.
    reward: { boosterCount: 3, grantLife: false },
  },
  {
    id: 'red',
    label: 'Red',
    hex: '#E5325B',
    requiredCount: 8,
    timerSec: 78, // +30% for easier completion (2026-08-02), was 60
    timerBonusSec: 8, // added back to the timer per catch (~10% of timerSec), capped at timerSec
    bonusScore: 320,
    baseSpawnWeight: 0.02,
    activeSpawnWeight: 0.10,
    // Top box: an extra life ONLY (no pickups).
    reward: { boosterCount: 0, grantLife: true },
  },
];

// The subset that spawns as its own glowing pizza variant (blue/purple/red).
// Regular is excluded -- it's fed by plain pizza (the spawn remainder).
export const SPAWNABLE_BOX_COLORS = BOX_COLORS.filter((c) => c.baseSpawnWeight != null);

export const BOX_COLOR_BY_ID = Object.fromEntries(BOX_COLORS.map((c) => [c.id, c]));

// Roll a completion reward for the given box color: a set of DISTINCT booster
// effects (count per box) plus whether it also grants a life. Called by
// core/main.js the frame a box completes; main.js does the actual granting.
export function rollBoxReward(colorId) {
  const cfg = BOX_COLOR_BY_ID[colorId];
  const count = (cfg && cfg.reward && cfg.reward.boosterCount) || 0;
  const grantLife = !!(cfg && cfg.reward && cfg.reward.grantLife);
  return { effects: pickDistinctBoosters(count), grantLife };
}
