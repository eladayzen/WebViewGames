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

// SCRAP-BOT SKIN, POC: this pool's art was swapped from a standing Foot
// Clan grunt, eventually landing on a standing energy-core pylon prop (see
// envArt.js's own note for the full round-by-round why -- short version,
// this hero doesn't fight, and it took two art misses to find a design
// that reads as "big standing prize" without either looking like a small
// item or clashing with the robot's own modern/sci-fi identity). Keys/
// exports/mechanic are unchanged throughout; only the numbers below that
// described a STANDING PERSON's proportions needed correcting for the new
// prop, since the old values would otherwise render/shadow/animate it as
// if it were still person-sized and alive:
//   - height 2.3 (roughly the player's own height) -> 2.6 (taller still).
//   - shadowWidth/shadowDepth were tuned per-variant to each grunt's own
//     fighting STANCE (footSoldier's wide two-legged brace vs. the
//     tighter-legged weapon variants). All 4 pylons share one identical
//     shape now, so one shared footprint replaces all four numbers.
//   - breatheAmplitude 0.14 was a living guard's idle inhale/exhale
//     (entities/enemy.js scales the sprite's Y by this every
//     breathePeriod) -- left running on an inanimate prop it would read as
//     the thing visibly growing and shrinking, which is exactly the "still
//     alive" cue that's wrong here. Zeroed, not retuned smaller -- a
//     static prop should just sit still.
//
// Round 2, direct request ("bigger, tall, floating... so the robot does
// not block the view"): the 1.3-tall waist-high box from round 1 sat right
// behind the player's own on-screen silhouette for most of its approach,
// same problem a ground-level prop always has from this over-the-shoulder
// camera. Grew HEIGHT past the player's own ~2.28 (SPRITE_WIDTH *
// PLAYER_FRAME_ASPECT) and added a FLOAT_HEIGHT lifting the prop bodily off
// the ground -- entities/enemy.js adds this to the sprite's rendered
// position.y only, deliberately NOT to slot.elevationY (the value
// checkEnemyHit actually compares against the player's own elevationY), so
// bumping into it at normal street level keeps working exactly like before
// regardless of this constant's value. Shadow position is separately
// anchored to ground/elevationY and never touched by it either.
//
// Round 3, direct feedback again (see envArt.js for the full context: the
// character swapped again, chest -> energy pylon): "It was good that the
// enemies were taller... standing on the floor" -- floating was the wrong
// call, not just the chest art. FLOAT_HEIGHT zeroed rather than deleted
// (the mechanism entities/enemy.js reads it through stays available if a
// future type ever wants it again). Shadow footprint narrowed to match the
// pylon's own silhouette -- a slim vertical tower on a modest base plate,
// not the old grunt's wide two-legged fighting stance or the chest's
// squarish box.
//
// Round 4, direct request: "twice the height." Texture aspect is exactly
// square (envArt.js's declared 2028x2028 -- the base plate's own width
// happens to span the same extent as the tower's full height in the source
// art), so entities/enemy.js's `width = type.height / type.texture.aspect`
// means on-screen WIDTH doubles right along with height automatically --
// the whole prop scales up uniformly, not just taller.
//
// Round 5, direct feedback: "not touching the edges of the element."
// Measured the actual foot_soldier_0.png alpha footprint directly -- the
// base plate spans ~55% of the full (square) texture width, so at
// PYLON_HEIGHT=5.2 that's a real ~2.86-unit-wide plate, well past the
// 1.8 the shadow was still set to (a leftover guess from round 2, never
// re-measured after round 4 doubled the whole prop). Widened past that
// measured 2.86 rather than just up to it, same reasoning as
// data/obstacleTypes.js's barricade fix right next to this same feedback:
// the shared shadow texture is a radial gradient whose bright core fades
// out before it reaches the actual edge of its own plane, so matching the
// real footprint exactly would still visually fall short of it.
const PYLON_HEIGHT = 5.2;
const PYLON_FLOAT_HEIGHT = 0;
const PYLON_SHADOW_WIDTH = 3.6;
const PYLON_SHADOW_DEPTH = 2;
const PYLON_BREATHE_AMPLITUDE = 0;
const PYLON_BREATHE_PERIOD = 3.6; // irrelevant at amplitude 0, kept rather than deleted

export const ENEMY_TYPES = {
  footSoldier: {
    texture: FOOT_SOLDIER_TEXTURE,
    height: PYLON_HEIGHT,
    floatHeight: PYLON_FLOAT_HEIGHT,
    shadowWidth: PYLON_SHADOW_WIDTH,
    shadowDepth: PYLON_SHADOW_DEPTH,
    breatheAmplitude: PYLON_BREATHE_AMPLITUDE,
    breathePeriod: PYLON_BREATHE_PERIOD,
    // Kill-poof particle color family (systems/vfx.js's spawnEnemyPoof) --
    // matches this variant's purple core glow.
    poofColors: [0x9b6fd1, 0xc79bf0, 0x6a4a94],
  },
  // Color variants -- same pylon shape/lineage as footSoldier (one batch
  // generation call, see envArt.js), each with a different core-glow color
  // for a real feeling of variety, not just a reused prop.
  footSoldierSword: {
    texture: FOOT_SOLDIER_SWORD_TEXTURE,
    height: PYLON_HEIGHT,
    floatHeight: PYLON_FLOAT_HEIGHT,
    shadowWidth: PYLON_SHADOW_WIDTH,
    shadowDepth: PYLON_SHADOW_DEPTH,
    breatheAmplitude: PYLON_BREATHE_AMPLITUDE,
    breathePeriod: PYLON_BREATHE_PERIOD,
    poofColors: [0xd15f5f, 0xf0a0a0, 0x943a3a], // red, matches its core glow
  },
  footSoldierNunchaku: {
    texture: FOOT_SOLDIER_NUNCHAKU_TEXTURE,
    height: PYLON_HEIGHT,
    floatHeight: PYLON_FLOAT_HEIGHT,
    shadowWidth: PYLON_SHADOW_WIDTH,
    shadowDepth: PYLON_SHADOW_DEPTH,
    breatheAmplitude: PYLON_BREATHE_AMPLITUDE,
    breathePeriod: PYLON_BREATHE_PERIOD,
    poofColors: [0x5fb86a, 0xa0e0a8, 0x3a7a42], // green, matches its core glow
  },
  footSoldierStaff: {
    texture: FOOT_SOLDIER_STAFF_TEXTURE,
    height: PYLON_HEIGHT,
    floatHeight: PYLON_FLOAT_HEIGHT,
    shadowWidth: PYLON_SHADOW_WIDTH,
    shadowDepth: PYLON_SHADOW_DEPTH,
    breatheAmplitude: PYLON_BREATHE_AMPLITUDE,
    breathePeriod: PYLON_BREATHE_PERIOD,
    poofColors: [0x4fb8b0, 0x9de3de, 0x2f7d78], // teal, matches its core glow
  },
};

export const DEFAULT_ENEMY_TYPE = 'footSoldier';
