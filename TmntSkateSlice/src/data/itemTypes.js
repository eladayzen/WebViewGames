// Falling-item type definitions (build doc §6). All item types share one
// "falling item" behavior (spawn/fall/strike-band/cleanup) in
// entities/fallingItem.js -- only sprite key, kind tag, and on-strike
// effect differ here, so item variety is a data addition, not new logic.
//
// Pizza box variants (2026-07-30, progression update): the 3 colored pizza
// slices keep id: 'pizza' and kind: 'good' -- identical to plain pizza for
// all existing catch/combo/fallback-render logic -- and differ ONLY by a
// `boxColor` tag (which color's collection box they feed) and their sprite.
// Keeping id: 'pizza' is deliberate: render.js's drawItemFallback branches
// on type.id, and its else-branch draws the BOMB shape -- a box variant
// with any other id would render as a bomb placeholder (and briefly break
// STYLE.md's amber-is-bomb-only rule) before its real art loads.

export const ITEM_TYPES = {
  PIZZA: { id: 'pizza', sprite: 'pizza_slice', kind: 'good' },
  PIZZA_BLUE: { id: 'pizza', sprite: 'pizza_slice_blue', kind: 'good', boxColor: 'blue' },
  PIZZA_PURPLE: { id: 'pizza', sprite: 'pizza_slice_purple', kind: 'good', boxColor: 'purple' },
  PIZZA_RED: { id: 'pizza', sprite: 'pizza_slice_red', kind: 'good', boxColor: 'red' },
  OOZE: { id: 'ooze', sprite: 'ooze_canister', kind: 'power-up' },
  BOMB: { id: 'bomb', sprite: 'bomb', kind: 'hazard' },
};

const PIZZA_VARIANT_BY_COLOR = {
  blue: ITEM_TYPES.PIZZA_BLUE,
  purple: ITEM_TYPES.PIZZA_PURPLE,
  red: ITEM_TYPES.PIZZA_RED,
};

import { BOX_COLORS } from './boxColors.js';
import { getEffectiveSpawnWeight } from '../systems/boxes.js';

// Picks a weighted item type given the current stage's odds and the live
// box state. Cumulative-threshold roll: bomb -> ooze -> each box-colored
// pizza (weighted by its current effective spawn weight, which is boosted
// while that color's box is active -- see systems/boxes.js) -> plain pizza
// as the implicit remainder (always the most common drop).
export function rollItemType(stage, boxes) {
  const r = Math.random();
  let acc = stage.bombChance;
  if (r < acc) return ITEM_TYPES.BOMB;
  acc += stage.oozeChance;
  if (r < acc) return ITEM_TYPES.OOZE;
  for (const c of BOX_COLORS) {
    acc += getEffectiveSpawnWeight(boxes, c.id);
    if (r < acc) return PIZZA_VARIANT_BY_COLOR[c.id];
  }
  return ITEM_TYPES.PIZZA;
}
