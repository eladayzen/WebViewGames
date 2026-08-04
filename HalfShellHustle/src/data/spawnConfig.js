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

// ========================================================================
// THE "HOW EASY IS THE START" DIAL (systems/difficulty.js)
// ========================================================================
// Direct feedback: "the game starts really hard on the start, so you have to
// move a lot of things, and you can find yourself losing lives really fast...
// We need to create some kind of value to control how easy it is on the start.
// I'm NOT talking about speed, I'm talking about placement of game objects."
//
// So this is a spacing ramp, entirely independent of the speed ramp in
// data/constants.js. Obstacles start further apart and close up to their
// normal interval over EASE_IN_DURATION_SEC. Two dials, and they are the first
// thing to reach for if the opening still feels harsh (or gets boring):
//
//   MULTIPLIER 1.0 = off (obstacles at their authored rate from frame one)
//   MULTIPLIER 2.0 = the opening has HALF as many obstacles per second
//   DURATION       = how long that takes to wear off, in seconds of PLAYER
//                    experience (not spawn time -- see systems/difficulty.js)
//
// APPLIES TO OBSTACLES ONLY, on purpose. They're the only thing that costs a
// life now (kill barriers are off, see PLATFORM_KILL_TYPE_ENABLED below).
// Enemies are rewarding to hit, coins are pure upside, platforms are terrain --
// thinning those out would make the opening EMPTY rather than kind, which is
// the opposite of the ask ("we need difficulty but we need interest as well").
// Hazards get sparser; everything worth chasing stays exactly as dense.
//
// The hand-authored opening in data/introSequence.js is spaced to match this
// curve -- if you change these numbers a lot, re-check that its seeded arrival
// times still line up, since those are placed by hand rather than by this ramp.
// 35 -> 60 ("use less of it in the first minute... then gradually pick up the
// pace"). The MULTIPLIER was already delivering the requested ~50% cut at the
// instant a run starts -- x2.1 spacing is 52% fewer obstacles per second -- so
// it is deliberately unchanged. What was wrong was how fast that cut decayed:
// over a 35s ramp it was already down to a 35% cut by 15s and gone entirely by
// 35s, which is why the early game still read as busy despite the dial. Now
// half the obstacles at t=0, still ~30% fewer at the 40s mark, normal at 60s.
export const EASE_IN_DURATION_SEC = 60;
export const EASE_IN_HAZARD_SPACING_MULTIPLIER = 2.1;

// The same easing, re-armed at the start of every LEVEL after the first, but
// over a much shorter window -- direct feedback asked for "a grace of like 10
// to 20 seconds to pick up to maximum pace" on entering a new level. Shorter
// than the run-start ramp above on purpose: a player entering level 2 is warmed
// up and mid-run, and only needs a moment to re-read the road, not the full
// on-boarding a cold start gets.
//
// Note this is measured in seconds since THAT LEVEL began, not since the run
// began -- see systems/difficulty.js. Without that distinction the ramp would
// already be long expired by level 2, since the run clock keeps counting.
export const LEVEL_RESTART_EASE_IN_DURATION_SEC = 15;

// --- Obstacles (entities/obstacles.js) ---
export const OBSTACLE_FIRST_SPAWN_DELAY_SEC = 3; // grace period to read the scene before the first obstacle
// Main obstacle-density/difficulty knob (both medium AND low spawn off this
// one timer -- LOW_OBSTACLE_SPAWN_CHANCE below only controls the MIX
// between them, not the overall rate). Still subject to
// MIN_ENEMY_OBSTACLE_GAP_SEC, so the effective average interval is a bit
// higher than this in practice.
//
// This is now the SETTLED rate, not the whole story: the ease-in dial at the
// top of this file stretches it for the opening stretch of a run (x2.1 at the
// very start, i.e. ~3.4s apart, easing to this value by 60s in).
//
// 1.6 -> 1.9, direct feedback: "space out mainly the blockers... especially
// barcades closer to each other" -- makes the gameplay easier without
// touching speed, which is exactly the ask (this dial is pure placement, see
// EASE_IN_* above). ~19% more time between blockers at the settled rate.
export const OBSTACLE_SPAWN_INTERVAL_SEC = 1.9;

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
// at the same fixed SPAWN_Z and scroll at the same speed as each other, so any
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
// -- re-check this same math any time either spawn interval changes again.
//
// 0.6 -> 0.9, direct feedback: "space out more enemies from obstacles."
// Against the current OBSTACLE_SPAWN_INTERVAL_SEC (1.9) and
// ENEMY_SPAWN_INTERVAL_SEC (2.0) that leaves a ~1.0s/1.9s obstacle window and
// a ~1.1s/2.0s enemy window (~53-55%) -- comfortably above the ~0.1s choke
// point above, similar margin to the ~1.0s/1.6s pair that was called healthy
// there. Raising this ALSO required nudging data/introSequence.js's
// INTRO_SEED_ENEMY_ARRIVALS (its 6.6 -> 6.9): that file's seeds are checked
// by hand against this exact constant since MIN_ENEMY_OBSTACLE_GAP_SEC can't
// enforce itself at t=0 the way it does for live spawns -- see that file's
// own comment.
//
// SPEED-RAMP CAVEAT: this is a gap in SECONDS enforced at spawn time, and it
// is no longer preserved exactly for the entity's whole lifetime the way the
// section header above claims. Both entities still hold a FIXED z-separation
// forever (that part is untouched -- everything scrolls at one speed), but the
// seconds that separation represents shrinks as the world speeds up: at
// SPEED_START a spawn gap laid down here delivers ~11% less by the time it
// reaches the player, and exactly this value again once the ramp tops out.
// Deliberately NOT "fixed" by converting to a distance gap against
// SPEED_MAX -- see MIN_ENEMY_OBSTACLE_GAP_SEC's git history for why that
// re-creates the exact choke described above at the start of a run.
export const MIN_ENEMY_OBSTACLE_GAP_SEC = 0.9; // -> ~9.1 world units at SPEED_START, ~13.0 at SPEED_MAX

// --- Elevated platforms (entities/platform.js, data/platformSequence.js) ---
// 4 -> 0, forced by the speed ramp. Travel from SPAWN_Z at the run's starting
// speed takes ~13.1s (vs ~8.75s before), so a 4s delay pushed the first live
// platform's arrival to ~16.7s. That is PAST the ~13.1s ceiling on what
// data/introSequence.js's pre-seeding can reach (a seed authored later than
// that would have to spawn beyond SPAWN_Z), so unlike every other spawner
// this hole could not be closed with more seeds -- it had to move here. At 0
// the first live platform arrives ~13.1s, exactly one interval after the
// seeded one, which is the cadence. Leaving this at 4 would have re-opened
// the same 11.6s platform gap introSequence.js documents fighting.
export const PLATFORM_FIRST_SPAWN_DELAY_SEC = 0;
// 6 -> 7.5, direct feedback: "too much ramps mainly in the middle are making
// it harder for the player to make decisions so we need to space them out a
// bit." Fewer ramps overall means fewer moments where a ramp decision and a
// lane-dodge decision have to be made at once -- see also the CENTER_LANE
// weighting in spawnPlatform's random-lane branch below, which targets the
// "mainly in the middle" half of the same complaint directly.
export const PLATFORM_SPAWN_INTERVAL_SEC = 7.5;

// Minimum clear z between two platforms IN THE SAME LANE, on top of their own
// 50-unit length. Enforced in entities/platform.js's spawnPlatform, which
// previously had no overlap check at all -- it took the first free pool slot
// and placed it, so nothing stopped two platforms interpenetrating.
//
// That went unnoticed for a long time because ordinary spawning never collides:
// at 6s intervals platforms are 60-86 units apart depending on speed,
// comfortably clear of 50. It only surfaced once a SEEDED platform and a live
// one could coexist at a level restart (see the delay below) -- which is
// exactly why the guard belongs here rather than trusting the arithmetic to
// stay lucky.
export const PLATFORM_MIN_SAME_LANE_GAP = 12; // world units

// PLATFORM_FIRST_SPAWN_DELAY_SEC is 0 for a RUN start (see its note above --
// forced by the seeding horizon). A LEVEL restart has the opposite problem:
// speed carries over, so the world is near SPEED_MAX and the 7.6s platform seed
// lands at z=-109 instead of the -71 the same seed reaches from a standing
// start -- right on top of the live platform a 0s delay fires at z=-140.
// Measured: a 19-unit interpenetration on a level-2 transition.
//
// 3s clears it with room to spare (the seed has scrolled on to -66 by then, a
// 24-unit gap) and still puts the first live platform one comfortable interval
// behind the seeded one.
export const LEVEL_RESTART_PLATFORM_FIRST_DELAY_SEC = 3;

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
// it; 10 (~1.0s reaction room at SPEED_START, ~0.7s at SPEED_MAX) roughly matches
// MIN_ENEMY_OBSTACLE_GAP_SEC's own reaction-time scale above.
export const PLATFORM_FOOTPRINT_EXCLUSION_BUFFER = 10; // world units, each side

// Direct feedback: barricades landing at the same z as an active ramp in a
// NEIGHBORING lane force a ramp decision (jump or not) and a lane-dodge
// decision into the same instant -- "especially barcades... closer to...
// ramps." PLATFORM_FOOTPRINT_EXCLUSION_BUFFER above only keeps obstacles out
// of a platform's OWN lane; this is a lighter CROSS-LANE check on top of it
// (entities/obstacles.js's spawnObstacle), deliberately smaller than that one
// -- that buffer has to guarantee zero visual overlap, this one only needs to
// buy a beat of separation. LIVE spawns only (see spawnObstacle) -- NOT
// applied to data/introSequence.js's seeds, which are hand-placed and
// hand-checked against each other already (see that file's own comments);
// running this same check against them would silently thin an
// already-carefully-tuned list rather than just space out ordinary play.
export const OBSTACLE_PLATFORM_CROSS_LANE_BUFFER = 6; // world units, each side

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
// own: travel time is (DESPAWN_Z - SPAWN_Z) / speed =
// 152 / speed, i.e. ~15.0s at SPEED_START, so ~ceil(15.0 / COIN_CLUSTER_SPAWN_INTERVAL_SEC)
// clusters are in flight at once, x the largest cluster size. At 3s and 5
// coins that's ~25, so 30 leaves headroom for a spawn landing just before
// an old cluster clears. NOTE this number has TWO moving inputs (the
// interval AND the max cluster size) -- re-derive if either changes, or
// clusters start getting silently skipped for lack of free slots.
// 30 -> 40 for the speed ramp: the SLOWER start is the sizing case, since a
// slot stays occupied longer the slower the world scrolls (~15.0s at
// SPEED_START vs ~10.6s at SPEED_MAX). reserveAndPlace is all-or-nothing, so
// falling short doesn't drop one coin -- it silently drops a whole cluster.
export const COIN_POOL_SIZE = 40;

// Was 9, on the theory that coins should arrive after the crowded intro --
// which backfired badly: coins never got the old close-spawn treatment, so
// 9s of delay PLUS the full far-travel meant the first coin didn't reach the
// player until ~17.8s (direct feedback: "currently none gold coins" in the
// opening stretch). Now near-zero, since data/introSequence.js seeds the
// opening coins directly and this just continues their cadence -- at the
// ramp's starting speed 0.7 + ~13.0s travel = ~13.7s first live arrival,
// picking up after the last seeded cluster (12.4s).
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
// 0.72 -> 0.93 with the move to real painted art. That dip was tuned to make a
// soft radial GLOW breathe, where fading is the whole effect; on a solid inked
// coin the same dip reads as the sprite going semi-transparent and flickering.
// The scale swell above now carries the "alive" cue on its own, and this is
// just a faint sheen on top.
export const COIN_PULSE_OPACITY_MIN = 0.93; // dimmest point of the cycle
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

// --- Ability pickups (entities/pickups.js, data/pickupTypes.js) ---
// Direct feedback: two pickups -- a coin magnet, and an extra life that is
// "very, very... not common."
//
// ONE ATTEMPT every PICKUP_SPAWN_INTERVAL_SEC, which then rolls for what (if
// anything) it produces. Structuring it as attempt-then-roll rather than two
// independent spawners is what keeps the two from ever landing on top of each
// other, and makes the rarity read directly off these numbers.
//
// Roll order per attempt: LIFE first (it's the rare prize and shouldn't lose
// its slot to the common one), then MAGNET, then nothing.
export const PICKUP_POOL_SIZE = 4;
export const PICKUP_FIRST_SPAWN_DELAY_SEC = 10;
export const PICKUP_SPAWN_INTERVAL_SEC = 11;

// Chance an attempt yields a magnet -> roughly one every 24s of a run.
export const PICKUP_MAGNET_SPAWN_CHANCE = 0.45;

// Chance an attempt yields an extra life. Reads low because it IS low, but the
// real rarity is stronger than this number alone: a life only rolls at all when
// the player has actually LOST one (core/main.js checks before offering it), so
// a clean run never sees a single heart. Combined, that's roughly one heart per
// ~2 minutes of DAMAGED play -- and none at full health, where it would be a
// dead pickup that teaches the player these are worthless.
export const PICKUP_LIFE_SPAWN_CHANCE = 0.09;

// Chest height, like coins -- deliberately collectible on foot with no jump.
// A rare pickup that also demands jump timing would be cruel; the difficulty
// of a pickup should be GETTING TO ITS LANE, nothing more.
export const PICKUP_BASE_HEIGHT = 1.2;
export const PICKUP_REACH_GRACE = 0.5; // more forgiving than a coin's 0.35 -- these are rare
// Same job as COIN_OBSTACLE_CLEARANCE, and larger for the same reason it's
// larger than nothing: a rare pickup is the strongest lane magnet in the game,
// so baiting the player into an obstacle with one would be the worst version of
// that trap.
export const PICKUP_OBSTACLE_CLEARANCE = 13; // world units, each side

// Cosmetic (entities/pickups.js). Pulses harder and faster than a coin because
// it has to win attention against a screen that may already have a five-coin
// row on it.
export const PICKUP_PULSE_PERIOD = 0.85; // seconds
export const PICKUP_PULSE_SCALE_AMPLITUDE = 0.26; // fraction of size added at peak
// A gentle ROCK, not the continuous roll this used to be (0.9 rad/sec). That
// spin was fine on the abstract canvas-drawn icons, but the hand-drawn art
// replacing them is recognisable objects with an obvious up -- a horseshoe
// magnet and a heart tumbling end over end read as broken, not lively. An
// oscillating tilt keeps the "alive" cue and always returns to upright.
export const PICKUP_ROCK_RADIANS = 0.16; // peak tilt either side of upright
