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
// TELLING THEM APART IS THE POINT. The first pass made both types the same
// grayscale glow blob tinted gold vs cyan, and direct feedback was blunt about
// the result: "I don't know what's the difference between the gold and the blue
// coins." A colour swap asks the player to learn a legend. So they're now
// different OBJECTS -- one coin, versus a stack of coins with a gem on top --
// which reads as "that one's worth more" with nothing to learn, and survives
// being small, fogged, and glimpsed in peripheral vision.
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
  // Worth 5, and rarer (COIN_BONUS_TYPE_CHANCE in data/spawnConfig.js). Bigger
  // silhouette AND a different shape AND a green accent -- three independent
  // cues, so it still reads as the valuable one when it's small, heavily fogged
  // at spawn distance, or only half-seen.
  bonus: {
    value: 5,
    texture: COIN_BONUS_TEXTURE,
    width: COMMON_WIDTH * 1.24,
    // Emerald, matching the gem. Deliberately not the player's own olive green,
    // and clear of every other palette slot in play (barricade orange, enemy
    // purple, magnet blue, life pink).
    sparkleColor: 0x3fdc6b,
  },
};

export const DEFAULT_COIN_TYPE = 'common';
