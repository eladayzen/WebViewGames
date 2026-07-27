// Per-enemy-type visual/animation tuning (direct feedback: sizing/shadow/
// breathing must be DATA, not hardcoded constants in entities/enemy.js --
// more enemy types are coming: a sword-holder, a jackal/club variant,
// bigger "rock steady" monsters, each with their own scale/shadow/
// animation/poof color, and eventually a different reward resource per
// type. entities/enemy.js reads everything about how a spawned enemy
// looks/animates from here; adding a new type is a data addition, matching
// this project's established obstacle/theme data-driven pattern (build doc
// §6's "keep all lane-blocker types driven by one shared behavior... only
// sprite/size differing" principle, applied to this new entity kind too).

import { FOOT_SOLDIER_TEXTURE } from './envArt.js';

export const ENEMY_TYPES = {
  footSoldier: {
    texture: FOOT_SOLDIER_TEXTURE,
    // Height-first sizing (not width-first like the barricade) -- this
    // pose's wide stance + raised club gives a very different bounding-box
    // aspect than a plain standing pose would.
    height: 2.3,
    // Shadow sized to THIS type's actual stance, not a flat multiple of the
    // player's own (narrow running-stride) shadow -- direct feedback:
    // "clearly touching both legs of the sprite," which this wide
    // fighting stance needs a much wider oval for.
    shadowWidth: 1.9,
    shadowDepth: 0.95,
    // Procedural idle breathing (Y-scale only, see entities/enemy.js) --
    // 1 -> 1.18 and back over a 2s cycle (1s up, 1s down).
    breatheAmplitude: 0.18,
    breathePeriod: 2.0,
    // Kill-poof particle color family (systems/vfx.js's spawnEnemyPoof) --
    // matches this type's purple armor accent.
    poofColors: [0x9b6fd1, 0xc79bf0, 0x6a4a94],
  },
};

export const DEFAULT_ENEMY_TYPE = 'footSoldier';
