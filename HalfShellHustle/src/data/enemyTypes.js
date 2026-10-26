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

import {
  FOOT_SOLDIER_TEXTURE, FOOT_SOLDIER_SWORD_TEXTURE, FOOT_SOLDIER_NUNCHAKU_TEXTURE, FOOT_SOLDIER_STAFF_TEXTURE,
} from './envArt.js';

// All four grunt variants share the same height (same tier, same-lineage
// art, see envArt.js) -- only their weapon/stance/accent-color/poof-color
// differ. A future bigger/tougher monster type would get its own height
// here rather than sharing this constant.
const GRUNT_HEIGHT = 2.3;
const GRUNT_BREATHE_AMPLITUDE = 0.14;
const GRUNT_BREATHE_PERIOD = 3.6;

export const ENEMY_TYPES = {
  footSoldier: {
    texture: FOOT_SOLDIER_TEXTURE,
    height: GRUNT_HEIGHT,
    // Shadow sized to THIS type's actual stance, not a flat multiple of the
    // player's own (narrow running-stride) shadow -- direct feedback:
    // "clearly touching both legs of the sprite," which this wide
    // fighting stance needs a much wider oval for.
    shadowWidth: 1.9,
    shadowDepth: 0.95,
    breatheAmplitude: GRUNT_BREATHE_AMPLITUDE,
    breathePeriod: GRUNT_BREATHE_PERIOD,
    // Kill-poof particle color family (systems/vfx.js's spawnEnemyPoof) --
    // matches this type's purple armor accent.
    poofColors: [0x9b6fd1, 0xc79bf0, 0x6a4a94],
  },
  // Weapon/color variants -- direct feedback: "really clear that it's a
  // different stand pose, holding different weapons... feeling of variety."
  // Narrower stances than footSoldier's wide club fight, so shadowWidth is
  // scaled down from it rather than reused -- footSoldier's 1.9 would read
  // oversized under these tighter-legged poses.
  footSoldierSword: {
    texture: FOOT_SOLDIER_SWORD_TEXTURE,
    height: GRUNT_HEIGHT,
    shadowWidth: 1.15,
    shadowDepth: 0.75,
    breatheAmplitude: GRUNT_BREATHE_AMPLITUDE,
    breathePeriod: GRUNT_BREATHE_PERIOD,
    poofColors: [0xd15f5f, 0xf0a0a0, 0x943a3a], // red, matches his armor accent
  },
  footSoldierNunchaku: {
    texture: FOOT_SOLDIER_NUNCHAKU_TEXTURE,
    height: GRUNT_HEIGHT,
    shadowWidth: 1.25,
    shadowDepth: 0.8,
    breatheAmplitude: GRUNT_BREATHE_AMPLITUDE,
    breathePeriod: GRUNT_BREATHE_PERIOD,
    poofColors: [0x5fb86a, 0xa0e0a8, 0x3a7a42], // green, matches his armor accent
  },
  footSoldierStaff: {
    texture: FOOT_SOLDIER_STAFF_TEXTURE,
    height: GRUNT_HEIGHT,
    shadowWidth: 1.35,
    shadowDepth: 0.85,
    breatheAmplitude: GRUNT_BREATHE_AMPLITUDE,
    breathePeriod: GRUNT_BREATHE_PERIOD,
    poofColors: [0x4fb8b0, 0x9de3de, 0x2f7d78], // teal, matches his armor accent
  },
};

export const DEFAULT_ENEMY_TYPE = 'footSoldier';
