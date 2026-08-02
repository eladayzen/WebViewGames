// Per-coin-type payout/appearance tuning, data-driven -- matches this
// project's data/enemyTypes.js / data/obstacleTypes.js convention:
// entities/coins.js reads everything about a spawned coin's look/value from
// here, and each type carries its own real texture exactly the way
// data/obstacleTypes.js's barricade does.
//
// A type is picked once per CLUSTER, never per coin (entities/coins.js's
// resolveClusterType) -- a row with mixed values reads as noise, a whole row of
// one thing reads as a treat worth chasing.
//
// TELLING THEM APART. The first pass made both types the same grayscale glow
// blob tinted gold vs cyan, and direct feedback was blunt: "I don't know what's
// the difference between the gold and the blue coins." A second pass made the
// bonus a stack of coins topped with a gem, which was rejected in favour of
// something simpler -- "let's just take the exact same gold and do it like in a
// gem style render." So the bonus is now literally the same coin, cut from
// translucent crystal instead of struck from gold.
//
// That first gem pass kept the crystal gold, which was a mistake and was called
// out as one: "the blue coins need to look more different than the gold coins...
// the base needs to be like blue or green or pink." With a shared silhouette AND
// a shared colour family, the only cues left were material and size, and neither
// survives distance. So the crystal is now vivid sapphire while the RIM stays
// gold -- unmistakably different, still obviously the same currency.
//
// Colour separation now does the heavy lifting, so `width` below is ordinary
// emphasis rather than the load-bearing cue it briefly had to be.
//
// The old grayscale-glow-plus-material.color trick is gone for a second reason
// too: material.color MULTIPLIES the whole texture, so tinting real painted art
// would only muddy it. Both textures are used untinted (see entities/coins.js).

import { COIN_COMMON_TEXTURE, COIN_BONUS_TEXTURE } from './envArt.js';

// World-space WIDTH of the sprite; the height comes from the art's own aspect
// so neither type is stretched. Deliberately small relative to the player (~2.1
// wide) and enemies (2.3 tall) -- direct feedback: "they will be smaller."
// Nudged up from the 0.72 the glow blobs used, because a soft glow faded out
// well before its quad's edge while painted art fills the whole quad -- keeping
// the old number would have read as the coins getting smaller.
const COMMON_WIDTH = 0.85;

export const COIN_TYPES = {
  common: {
    value: 1,
    texture: COIN_COMMON_TEXTURE,
    width: COMMON_WIDTH,
    // Collect-sparkle tint ONLY (systems/vfx.js's spawnCoinSparkle) -- no
    // longer a sprite tint. Sampled from the art's own gold so the burst reads
    // as coming off the coin itself.
    sparkleColor: 0xffc93f,
  },
  // Worth 5, and rarer (COIN_BONUS_TYPE_CHANCE in data/spawnConfig.js).
  // Same coin, cut from sapphire crystal with the gold rim kept.
  bonus: {
    value: 5,
    texture: COIN_BONUS_TEXTURE,
    width: COMMON_WIDTH * 1.32,
    // Bright aqua, matching the crystal rather than the rim -- the burst should
    // say "that was the blue one", which is the whole point of the recolour.
    sparkleColor: 0x5fe0ff,
  },
};

export const DEFAULT_COIN_TYPE = 'common';
