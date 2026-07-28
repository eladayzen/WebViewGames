// Single, easily-editable home for every "how often / how much" spawn-
// pacing knob in the game -- direct feedback: these used to be scattered
// across data/constants.js, data/platformSequence.js, and
// data/obstacleTypes.js, which made them hard to find and play with as a
// set. Every value here is read at spawn time; edit + save (Vite hot-
// reloads), or just start a new run, to see the effect -- nothing here
// needs a rebuild.
//
// What does NOT live here: shape/size/physics numbers that aren't about
// spawn frequency (PLATFORM_HEIGHT, JUMP_HEIGHT, obstacle jumpClearHeight,
// etc. stay in their own data files, next to the geometry/collision code
// that uses them) -- this file is specifically the "how often does X
// happen" dial set, not a catch-all.

// --- Obstacles (entities/obstacles.js) ---
export const OBSTACLE_FIRST_SPAWN_DELAY_SEC = 3; // grace period to read the scene before the first obstacle
// Main obstacle-density/difficulty knob (both medium AND low spawn off this
// one timer -- LOW_OBSTACLE_SPAWN_CHANCE below only controls the MIX
// between them, not the overall rate). Still subject to
// MIN_ENEMY_OBSTACLE_GAP_SEC, so the effective average interval is a bit
// higher than this in practice.
export const OBSTACLE_SPAWN_INTERVAL_SEC = 1.6;

// DISABLED until further notice (direct feedback: "remove it completely,
// we don't need it for now") -- entities/obstacles.js's resolveRandomType
// always returns 'medium' while this is false, so 'low' never spawns. The
// type/data itself (data/obstacleTypes.js) stays intact for a later
// re-enable, only this spawn switch flips off.
export const LOW_OBSTACLE_ENABLED = false;
// Type mix -- a deliberate difficulty knob (a miss ends the run), not just
// "show variety" like data/enemyTypes.js's uniform random pick. Inert while
// LOW_OBSTACLE_ENABLED is false.
export const LOW_OBSTACLE_SPAWN_CHANCE = 0.3;

// --- Foot Soldier enemies (entities/enemy.js) ---
// Own pace/offset from the obstacle spawner so the two don't always land in
// the same window during this first-pass tuning.
export const ENEMY_FIRST_SPAWN_DELAY_SEC = 4.5;
// TEMPORARY demo density bump (direct feedback: "just for demonstration,
// add twice as much enemies") -- normal value is 2.8. Revert once the demo
// pass is done, this is not a locked-in balance call either way.
export const ENEMY_SPAWN_INTERVAL_SEC = 2.0;

// --- Cross-spawner spacing (locked-in gameplay rule, direct feedback): the
// GoBalance lean-board controller reacts slower than a phone swipe, so an
// enemy spawned too close to an obstacle baits the player into approaching
// (enemies are safe/rewarding) right as an obstacle arrives with no time
// left to lane-change away from it. Obstacles/enemies/platforms all spawn
// at the same fixed SPAWN_Z and scroll at the same FORWARD_SPEED, so any
// gap enforced once at spawn time (core/main.js) holds for the entity's
// entire lifetime, never just near the player -- same reasoning behind
// every knob in this section. ---
//
// MUST stay comfortably below BOTH OBSTACLE_SPAWN_INTERVAL_SEC and
// ENEMY_SPAWN_INTERVAL_SEC, or the denser of the two spawners chokes the
// other out almost entirely: each spawn attempt only succeeds in the
// "open window" (its own interval minus this gap), so once this gap gets
// close to an interval, that window shrinks toward zero. Concretely hit
// this: when OBSTACLE_SPAWN_INTERVAL_SEC dropped to 1.6 (the "much more
// obstacles" difficulty pass) this was still 1.5, leaving enemies only a
// ~0.1s window out of every 1.6s obstacle cycle to spawn in -- they
// effectively stopped appearing past the intro (direct feedback: "I just
// have obstacles and platforms... most of the run I don't see any
// enemies"). Pulled down to restore a healthy window on both sides
// (~1.0s/1.6s for obstacles, ~1.4s/2.0s for enemies) -- re-check this same
// math any time either spawn interval changes again.
export const MIN_ENEMY_OBSTACLE_GAP_SEC = 0.6; // -> 9.6 world units at FORWARD_SPEED=16

// --- Elevated platforms (entities/platform.js, data/platformSequence.js) ---
// First delay pulled in so platforms are also something to engage with
// soon after run start, same as the intro wall and the obstacle/enemy
// ramp-up window (data/introSequence.js).
export const PLATFORM_FIRST_SPAWN_DELAY_SEC = 7;
export const PLATFORM_SPAWN_INTERVAL_SEC = 6;

// Type mix -- since the kill-type's jump is harder to time on a lean-board
// than a swipe and should stay a rare spice, not the main way up. Off falls
// back to every spawn being a ramp. DISABLED until further notice (direct
// feedback, trying an all-ramp pass: every box gets a ramp on both sides
// instead) -- PLATFORM_KILL_TYPE_CHANCE is left as-is, just inert while
// this is false.
export const PLATFORM_KILL_TYPE_ENABLED = false;
export const PLATFORM_KILL_TYPE_CHANCE = 0.35;

// Direct feedback: obstacles/enemies must never spawn overlapping an active
// platform's RAMP section (entry or exit) in the same lane -- being forced
// to climb a ramp while also having to dodge/kill something positioned on
// top of an incline doesn't work, visually or as a fair dodge. This pads
// BOTH ends of a ramp span with extra room beyond its own length, so
// there's real space to react/dodge around the whole platform, not a
// razor-thin gap right at the ramp's edge -- see entities/platform.js's
// isRampZoneBlocked for how it's applied.
export const PLATFORM_RAMP_EXCLUSION_BUFFER = 5; // world units, each side
