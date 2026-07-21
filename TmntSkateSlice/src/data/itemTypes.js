// Falling-item type definitions (build doc §6). All three item types share
// one "falling item" behavior (spawn/fall/strike-band/cleanup) in
// entities/fallingItem.js -- only sprite key and on-strike effect differ
// here, so Post-MVP item variety (§2) is a data addition, not new logic.

export const ITEM_TYPES = {
  PIZZA: {
    id: 'pizza',
    sprite: 'pizza_slice',
    kind: 'good',
  },
  OOZE: {
    id: 'ooze',
    sprite: 'ooze_canister',
    kind: 'power-up',
  },
  BOMB: {
    id: 'bomb',
    sprite: 'bomb',
    kind: 'hazard',
  },
};

// Picks a weighted item type given the current stage's odds.
export function rollItemType(stage) {
  const r = Math.random();
  if (r < stage.bombChance) return ITEM_TYPES.BOMB;
  if (r < stage.bombChance + stage.oozeChance) return ITEM_TYPES.OOZE;
  return ITEM_TYPES.PIZZA;
}
