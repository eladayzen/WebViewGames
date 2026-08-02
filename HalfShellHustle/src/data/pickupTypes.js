// Special-ability pickups -- direct feedback: "I want us to build 2 pickups.
// One is magnating only the gold coins to you. And the second is pick up live."
//
// Both abilities already EXISTED as scaffolding with nothing to grant them:
// entities/player.js's grantMagnet (the coin pull in entities/coins.js's
// applyMagnetPull) and systems/lives.js's gainLife. So this file adds no new
// mechanics at all -- it's the falling-into-the-world half that was missing.
//
// Same data-driven shape as data/coinTypes.js / data/enemyTypes.js: everything
// entities/pickups.js needs to draw and resolve one is a row here.
//
// ART: real Kolbo-painted textures (data/envArt.js), in the same inked,
// cel-shaded language as the coins and the characters. This replaced a first
// pass that drew both icons procedurally onto a canvas with 2D path commands --
// direct feedback: "let's change the icons for the magnet and the life." Along
// with the hand-drawn art went the coloured glow halo those needed; see
// envArt.js for why it turned out to be worth less than the ink outline it sat
// behind.

import { PICKUP_MAGNET_TEXTURE, PICKUP_LIFE_TEXTURE } from './envArt.js';

// World-space WIDTH; height follows each texture's own aspect so neither icon
// is stretched. Roughly twice a common coin -- these are rare and run-changing,
// and should read as an event from a long way off rather than as "a slightly
// bigger coin".
const PICKUP_WIDTH = 1.5;

export const PICKUP_TYPES = {
  // Timed coin magnet. Duration is MAGNET_DURATION_SEC (data/constants.js).
  magnet: {
    effect: 'magnet',
    texture: PICKUP_MAGNET_TEXTURE,
    width: PICKUP_WIDTH,
    // Collect-burst tint only (systems/vfx.js's spawnCoinSparkle) -- never a
    // sprite tint, which would multiply and muddy the painted art. Cool blue
    // against the magnet's warm red, so the burst reads as "ability gained"
    // rather than as more of the same object.
    sparkleColor: 0x7fd8ff,
  },
  // One life back, up to LIVES_SOFTCAP. Deliberately the rarest thing in the
  // game (data/spawnConfig.js's PICKUP_LIFE_SPAWN_CHANCE, plus it only rolls at
  // all while the player is actually missing a life).
  life: {
    effect: 'life',
    texture: PICKUP_LIFE_TEXTURE,
    width: PICKUP_WIDTH * 0.94, // the heart reads bigger than the magnet at equal width
    sparkleColor: 0xff8fa3,
  },
};
