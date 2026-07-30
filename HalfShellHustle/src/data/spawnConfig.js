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
// 7 -> 4 so this spawner's first arrival (delay + the ~8.75s far-travel =
// ~12.75s) picks up right where data/introSequence.js's seeded platform
// stops (~6.8s + one 6s interval), instead of leaving the 11.6s platform
// gap direct feedback ran into.
export const PLATFORM_FIRST_SPAWN_DELAY_SEC = 4;
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
// platform's WHOLE footprint (ramps AND the solid deck box in between) in
// the same lane -- forced onto a ramp while also dodging/fighting
// something doesn't work visually or as a fair dodge, and the deck is
// opaque (a street-level sprite spawned inside it would render invisibly
// hidden behind it). This pads BOTH ends of the whole span with extra room
// beyond its own length, so there's real space to react/dodge around the
// whole platform, not a razor-thin gap right at its edge -- see
// entities/platform.js's isPlatformFootprintBlocked for how it's applied.
// Raised from 5 per direct feedback -- still "a bit difficult" to get onto
// a ramp when an obstacle landed close by in the same lane just ahead of
// it; 10 (~0.625s reaction room at FORWARD_SPEED=16) roughly matches
// MIN_ENEMY_OBSTACLE_GAP_SEC's own reaction-time scale above.
export const PLATFORM_FOOTPRINT_EXCLUSION_BUFFER = 10; // world units, each side

// --- Enemies on platform decks (entities/enemy.js's spawnEnemy, entities/
// platform.js's findDeckPlacements) -- direct feedback: enemies should
// sometimes actually stand on top of an elevated deck, not just avoid
// platforms entirely. ---
// How close (world z) a deck's placement window is allowed to get before
// it's no longer offered -- keeps an enemy from popping up mid-journey
// instead of being visible arriving from a distance like everything else.
// Naturally excludes ramp-up-window platforms (their deck already starts
// too close), see entities/platform.js's findDeckPlacements comment.
export const PLATFORM_DECK_PLACEMENT_MAX_Z = -50;
// Chance a given eligible platform ends up with one deck-placed enemy
// (capped at exactly one per platform regardless of this value -- see
// findDeckPlacements' deckEnemyPlaced flag).
export const ENEMY_ON_PLATFORM_CHANCE = 0.5;

// --- Coin collectibles (entities/coins.js) -- direct feedback: a second,
// purely-POSITIVE thing to chase alongside enemies, arranged in shapes
// (rows / jump-arcs / ramp trails) rather than scattered singles. ---
//
// Pool sizing, derived the same way entities/obstacles.js documents its
// own: travel time is (DESPAWN_Z - SPAWN_Z) / FORWARD_SPEED =
// (12 - -140) / 16 = 9.5s, so ~ceil(9.5 / COIN_CLUSTER_SPAWN_INTERVAL_SEC)
// clusters are in flight at once, x the largest cluster size. At 3s and 5
// coins that's ~25, so 30 leaves headroom for a spawn landing just before
// an old cluster clears. NOTE this number has TWO moving inputs (the
// interval AND the max cluster size) -- re-derive if either changes, or
// clusters start getting silently skipped for lack of free slots.
export const COIN_POOL_SIZE = 30;

// Was 9, on the theory that coins should arrive after the crowded intro --
// which backfired badly: coins never got the old close-spawn treatment, so
// 9s of delay PLUS the full ~8.75s far-travel meant the first coin didn't
// reach the player until ~17.8s (direct feedback: "currently none gold
// coins" in the opening stretch). Now near-zero, since
// data/introSequence.js seeds the opening coins directly and this just
// needs to continue their cadence: 0.7 + 8.75 = ~9.45s first arrival,
// right after the last seeded cluster at ~6.4s + one 3s interval.
export const COIN_FIRST_SPAWN_DELAY_SEC = 0.7;
// One CLUSTER per interval (3-5 coins), not one coin.
export const COIN_CLUSTER_SPAWN_INTERVAL_SEC = 3;

// Deliberately NO data/introSequence.js ramp-up close-spawn treatment for
// coins (unlike obstacles/enemies/platforms): that exists to close an
// empty-pipeline FAIRNESS gap at run start, and a collectible has no
// fairness stake -- missing coins that never spawned costs the player
// nothing.

// Pattern mix -- must sum to <= 1, remainder falls through to ramp-climb.
// Row is weighted highest on purpose: it's the readable "run through this"
// teacher that establishes what a coin even is. The arc only makes sense
// once that's understood, and ramp-climb needs an eligible platform to
// exist (it falls back to a row when none does, see spawnCoinCluster).
export const COIN_PATTERN_ROW_WEIGHT = 0.5;
export const COIN_PATTERN_ARC_WEIGHT = 0.25;
// remainder (0.25) -> ramp climb

// Row shape.
export const COIN_ROW_MIN = 3;
export const COIN_ROW_MAX = 5;
export const COIN_ROW_SPACING = 2.5; // world units between coins along z

// Jump-arc shape -- fractions of the player's TOTAL airtime to sample his
// real arc at (entities/player.js's sampleJumpArc). Deliberately NOT evenly
// spaced: the jump's rise is ease-out-quad and its fall ease-in-cubic, so
// nearly all of the arc's visible SHAPE lives in the first ~0.1s and last
// ~0.15s -- evenly-spaced samples come back 1.76/2.40/2.40/2.31/1.69, i.e.
// a flat row at chest height, not an arc at all (measured, not guessed).
// These endpoint-weighted fractions give 0.88/1.98/2.40/1.88/0.87 instead,
// which actually reads as an arc, and the resulting uneven z-spacing
// (bunched at the ends) is a bonus: it telegraphs takeoff/landing.
export const COIN_ARC_SAMPLE_FRACTIONS = [0.07, 0.2, 0.5, 0.8, 0.93];

// Ramp-climb shape -- coins spread along one wedge of an active platform
// (entities/platform.js's findActiveRampSpans). Needs no jump at all: a
// player on a ramp is carried up by it, so these are a pure reward for
// choosing the platform lane.
export const COIN_RAMP_COUNT = 4;
export const COIN_RAMP_MARGIN = 1.5; // world units inset from each end of the wedge

// Height above WHATEVER SURFACE IS UNDER THE COIN (street, deck, or ramp
// slope -- entities/coins.js re-queries this live every frame, so one
// number works everywhere). Roughly chest height, so a plain row is
// collectible just by running through it.
//
// Also the arc pattern's baseline, which is what makes a jump matter: at
// 1.1 a grounded player's own body span already reaches ~2.16, so arc
// coins at 1.1+0.88..1.1+2.40 = 1.98..3.50 leave the three middle coins
// jump-only while the two endpoints stay collectible on foot (a nice
// consolation prize). Drop this to 0 and a grounded player sweeps 4 of the
// 5 arc coins without jumping, making the whole pattern pointless --
// measured, not hypothetical.
export const COIN_BASE_HEIGHT = 1.1;

// Vertical slack on the "is the coin within the player's body span?"
// reach test (entities/coins.js's collectCoins) -- forgiveness on both the
// feet and head ends, same spirit as JUMP_CLEAR_GRACE_HEIGHT.
export const COIN_REACH_GRACE = 0.35;

// Chance a cluster is the high-value 'bonus' type (data/coinTypes.js)
// rather than 'common'. Per cluster, not per coin.
export const COIN_BONUS_TYPE_CHANCE = 0.18;

// Cosmetic pulse (entities/coins.js) -- sells "glowing" on an otherwise
// static sprite. Same cosine swell technique as entities/enemy.js's
// breathing, but the PHASE is stepped per coin index within a cluster
// rather than randomized (enemy.js randomizes so a pool doesn't breathe in
// lockstep; for coins in a line, a phase offset instead produces a
// travelling wave down the chain, reading as one connected trail).
export const COIN_PULSE_PERIOD = 1.1; // seconds
export const COIN_PULSE_SCALE_AMPLITUDE = 0.16; // fraction of size added at peak
export const COIN_PULSE_OPACITY_MIN = 0.72; // dimmest point of the cycle
export const COIN_PULSE_PHASE_STEP = 0.16; // seconds of phase offset per coin index

// Lane-scoped obstacle clearance: a coin cluster must not spawn in a lane
// that already has an obstacle within this many world units of the
// cluster's own z-span. This is the SAME trap MIN_ENEMY_OBSTACLE_GAP_SEC
// above exists to prevent -- something rewarding baiting the player into a
// lane right as an obstacle arrives there with no reaction time left -- and
// a coin row is a STRONGER lane magnet than an enemy, by design.
//
// Deliberately NOT folded into MIN_ENEMY_OBSTACLE_GAP_SEC's shared
// time-gap rule: that file's own warning above applies (a third
// participant shrinks every spawner's open window, exactly what choked
// enemies out when the obstacle interval dropped to 1.6). A lane-scoped
// position check at coin-spawn time affects nothing but the coin cluster.
//
// No equivalent constraint against ENEMIES -- bumping into one while
// collecting coins is also a reward, so that overlap is welcome.
export const COIN_OBSTACLE_CLEARANCE = 11; // world units, each side of the cluster span
