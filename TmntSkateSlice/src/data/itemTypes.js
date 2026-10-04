// Falling-item type definitions (build doc §6). All item types share one
// "falling item" behavior (spawn/fall/strike-band/cleanup) in
// entities/fallingItem.js -- only sprite key, kind tag, and on-strike
// effect differ here, so item variety is a data addition, not new logic.
//
// Pizza + box variants (progression update, 2026-07-30, revised per
// playtest): ALL pizza uses the SAME sprite ('pizza_slice') -- the box
// variants are distinguished purely by a colored outer GLOW at render time
// (see render.js drawItems), not recolored art, which read poorly. Each
// pizza carries a `boxColor` tag naming which collection box it feeds:
// plain pizza feeds the 'regular' box, the 3 colored variants feed theirs.
// id stays 'pizza' on all of them so drawItemFallback's pizza branch (and
// all catch/combo logic) treats them identically.

// Per-catch score (2026-08-06): flat, tiered by box color -- NOT combo-
// multiplied (the combo/hot-streak multiplier is disabled for now, see
// systems/scoring.js's registerPizzaHit). Same rarity order as
// data/boxColors.js (regular -> blue -> purple -> red), evenly spaced
// 10/20/30/40 so a rarer catch is always worth visibly more on its own.
export const ITEM_TYPES = {
  PIZZA: { id: 'pizza', sprite: 'pizza_slice', kind: 'good', boxColor: 'regular', score: 10 },
  PIZZA_BLUE: { id: 'pizza', sprite: 'pizza_slice', kind: 'good', boxColor: 'blue', score: 20 },
  PIZZA_PURPLE: { id: 'pizza', sprite: 'pizza_slice', kind: 'good', boxColor: 'purple', score: 30 },
  PIZZA_RED: { id: 'pizza', sprite: 'pizza_slice', kind: 'good', boxColor: 'red', score: 40 },
  BOMB: { id: 'bomb', sprite: 'bomb', kind: 'hazard' },
  // Extra-life heart -- its own kind so the catch handler grants a life rather
  // than scoring/feeding a box. Not part of rollItemType's weighted mix; it's
  // dropped on a paced schedule (systems/heartDrop.js), ~once per level from
  // level 2 on.
  HEART: { id: 'heart', sprite: 'heart', kind: 'life' },
};

const PIZZA_VARIANT_BY_COLOR = {
  blue: ITEM_TYPES.PIZZA_BLUE,
  purple: ITEM_TYPES.PIZZA_PURPLE,
  red: ITEM_TYPES.PIZZA_RED,
};

import { SPAWNABLE_BOX_COLORS } from './boxColors.js';
import { getEffectiveSpawnWeight } from '../systems/boxes.js';
import { pickPowerUp } from './powerUps.js';

// Picks a weighted item type given the current stage's odds and the live
// box state. Cumulative-threshold roll: bomb -> ooze -> each SPAWNABLE box
// variant (blue/purple/red, weighted by its current effective spawn weight,
// boosted while that color's box is active -- see systems/boxes.js) -> plain
// pizza as the implicit remainder (always the most common drop, feeds the
// 'regular' box).
export function rollItemType(stage, boxes) {
  const r = Math.random();
  let acc = stage.bombChance;
  if (r < acc) return ITEM_TYPES.BOMB;
  acc += stage.powerUpChance;
  if (r < acc) return pickPowerUp();
  for (const c of SPAWNABLE_BOX_COLORS) {
    acc += getEffectiveSpawnWeight(boxes, c.id);
    if (r < acc) return PIZZA_VARIANT_BY_COLOR[c.id];
  }
  return ITEM_TYPES.PIZZA;
}
