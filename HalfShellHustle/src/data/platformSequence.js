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
// do. Blank/plain-white (box) / black (kill barrier) / blue (ramp)
// placeholder material for now; real illustrated PNGs (matching this game's
// other sprites) are the next pass once the shapes themselves read right.

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

// Spawn pacing -- own timer, like every other spawner in this game. Lane is
// picked at random per spawn (entities/platform.js's spawnPlatform).
// First delay pulled in from 10 -> 7 (direct feedback: platforms should
// also be something to engage with soon after run start, same as the
// intro wall and the obstacle/enemy ramp-up window -- data/
// introSequence.js's INTRO_RAMP_UP_DURATION_SEC/INTRO_RAMP_UP_SPAWN_Z cover
// the close-spawn half of that, this just makes sure the first attempt
// actually falls inside that window instead of firing after it's closed).
export const PLATFORM_FIRST_DELAY_SEC = 7;
export const PLATFORM_INTERVAL_SEC = 6;

// Type mix -- direct feedback's "switch," since the kill-type's jump is
// harder to time on a lean-board than a swipe and should stay a rare spice,
// not the main way up. Off falls back to every spawn being a ramp.
// DISABLED until further notice (direct feedback, trying an all-ramp pass:
// every box gets a ramp on both sides instead) -- PLATFORM_KILL_TYPE_CHANCE
// is left as-is, just inert while this is false.
export const PLATFORM_KILL_TYPE_ENABLED = false;
export const PLATFORM_KILL_TYPE_CHANCE = 0.35;

// Falling off a platform edge (walking off the end, or stepping sideways
// into a lower/empty lane) -- direct feedback: this used to be a smoothstep
// eased over distance, which read as a translate/elevator-ride down, not a
// fall. Real gravity now (entities/player.js integrates this over TIME, not
// distance): a fall from the full PLATFORM_HEIGHT takes ~0.6s to land,
// matching JUMP_DURATION's (0.5s) order of magnitude so the two motions
// feel like they belong to the same character.
export const PLATFORM_FALL_GRAVITY = 20; // world units/sec^2
