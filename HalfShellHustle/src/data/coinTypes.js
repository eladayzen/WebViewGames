// Per-coin-type payout/appearance tuning, data-driven -- matches this
// project's data/enemyTypes.js / data/obstacleTypes.js convention:
// entities/coins.js reads everything about a spawned coin's look/value from
// here.
//
// Direct feedback: coins "will give a different amount of coins, but other
// than that they are pretty much the same as enemies" -- so the only real
// axis between types is `value` (plus a color to telegraph it). A type is
// picked once per CLUSTER, never per coin (entities/coins.js's
// resolveClusterType) -- a row with mixed values reads as noise, a whole
// cyan row reads as a treat worth chasing.
//
// Both types share one cached grayscale glow texture (entities/coins.js's
// getCoinTexture), tinted per type via material.color -- so adding a type
// is a data addition here, no new art needed.

// World-space diameter of the sprite. Deliberately small relative to the
// player (~2.1 wide) and enemies (2.3 tall) -- direct feedback: "they will
// be smaller."
const COMMON_SIZE = 0.72;

export const COIN_TYPES = {
  common: {
    value: 1,
    // Warm gold. The tint multiplies the grayscale glow texture, so this is
    // the coin's brightest body tone, not a flat fill -- see
    // entities/coins.js's createCoinTexture for the brightness ramp.
    color: 0xffc93f,
    size: COMMON_SIZE,
  },
  // Worth 5 coins, rarer (COIN_BONUS_TYPE_CHANCE in data/spawnConfig.js),
  // and a cold cyan rather than a brighter gold -- a hue shift reads at a
  // distance where a brightness shift wouldn't, especially against
  // street.js's pale sky.
  bonus: {
    value: 5,
    color: 0x6fe3ff,
    size: COMMON_SIZE * 1.2,
  },
};

export const DEFAULT_COIN_TYPE = 'common';
