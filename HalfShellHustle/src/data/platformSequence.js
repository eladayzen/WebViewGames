// Per-lane elevated platform system (direct feedback's height mechanic,
// redefined from scratch after playtesting the first two passes): every
// platform occupies exactly ONE lane and is a real, solid, collidable
// object -- never a walk-through trigger volume. A box (the walkable deck)
// never appears bare -- it's always preceded by exactly one of two guards,
// so there is never a lane where the player can pass through/under a box:
//   - 'kill': a black barrier attached to the box's front face. Purely a
//     physical jump timing check (entities/platform.js's
//     checkPlatformKillBarrierHit) -- no separate trigger mechanic, same as
//     jumping any other obstacle. Airborne at contact -> cleared, and you're
//     now standing on the box; grounded at contact -> dead, "for now" (no
//     partial outcome).
//   - 'ramp': an incline. No jump needed -- it carries you up automatically,
//     there is no way to avoid rising, only ever "above it."
// Real 3D mesh geometry (see entities/platform.js), not billboard sprites --
// direct feedback: needs to read correctly (vertical wall vs ramp incline)
// from any viewing angle, which a camera-facing sprite structurally can't
// do. Box (crate wood) and ramp (hazard-striped diamond plate) now carry
// real Kolbo-illustrated art (data/envArt.js's PLATFORM_BOX_TEXTURE/
// PLATFORM_RAMP_TEXTURE) -- the kill barrier is still its flat black
// placeholder, unchanged, since it's disabled (PLATFORM_KILL_TYPE_ENABLED)
// and out of scope for this pass.

export const PLATFORM_ENABLED = true;

// World units the top surface sits above the street.
export const PLATFORM_HEIGHT = 3.5;

// Ramp-type incline length (world units) -- how far the rise is spread.
export const PLATFORM_RAMP_LENGTH = 10;

// How long (world units) the flat top surface spans, for both types --
// shorter than earlier full-width passes since these are now per-lane, one
// of potentially several simultaneous choices across the 3 lanes rather
// than one dominant full-street structure.
export const PLATFORM_DECK_LENGTH = 30;

// Spawn pacing (first delay, interval, kill-type mix chance) and the
// entities/obstacles.js|enemy.js ramp-exclusion buffer all moved to
// data/spawnConfig.js -- the single place for every spawn-frequency knob
// in the game. Lane is still picked at random per spawn
// (entities/platform.js's spawnPlatform); PLATFORM_HEIGHT/RAMP_LENGTH/
// DECK_LENGTH/FALL_GRAVITY below are shape/physics, not frequency, so they
// stay here next to the geometry/collision code that uses them.

// Falling off a platform edge (walking off the end, or stepping sideways
// into a lower/empty lane) -- direct feedback: this used to be a smoothstep
// eased over distance, which read as a translate/elevator-ride down, not a
// fall. Real gravity now (entities/player.js integrates this over TIME, not
// distance): a fall from the full PLATFORM_HEIGHT takes ~0.6s to land,
// matching the jump's own ~0.78s total airtime (constants.js's
// JUMP_RISE_DURATION/JUMP_HOLD_DURATION/JUMP_FALL_DURATION) in order of
// magnitude so the two motions feel like they belong to the same character.
export const PLATFORM_FALL_GRAVITY = 20; // world units/sec^2
