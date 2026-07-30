// Run-start onboarding pacing -- direct feedback: the old plain spawn-delay
// setup left 5-10+ real seconds of dead time before the player had anything
// to react to (obstacles/enemies spawn far upstream at SPAWN_Z, which alone
// takes ~9s of pure scroll-in travel at FORWARD_SPEED=16, on top of their
// own first-spawn delay timer). Replaced with an immediate, unmissable
// "enemy wall" teaching moment instead of silence: one enemy in EVERY lane,
// spawned close enough to reach fast, so "killing an enemy is safe/good, not
// something to dodge" is the very first thing a run teaches -- learned by
// doing, zero on-screen instructions needed.
//
// A single flat list of values, not something to come back and ask for each
// time -- edit these directly, core/main.js just reads them.

import { LANE_X } from './constants.js';

// Toggle the whole onboarding wall on/off -- ON by default. Off falls back
// to the old plain delayed-spawn behavior (data/spawnConfig.js's
// OBSTACLE_FIRST_SPAWN_DELAY_SEC / ENEMY_FIRST_SPAWN_DELAY_SEC).
export const INTRO_WALL_ENABLED = true;

// One enemy per lane -- tied to the actual lane count so it can never spawn
// more enemies than there are lanes to put them in.
export const INTRO_WALL_ENEMY_COUNT = LANE_X.length;

// How far upstream the wall spawns -- deliberately much closer than the
// normal SPAWN_Z (-140, which is where the old ~9s dead-travel-time came
// from). world units / FORWARD_SPEED (16) = seconds until it reaches the
// player, i.e. -26 -> ~1.6s -- enough to be readable as "it's arriving",
// not an instant ambush, but nowhere near the old 5-10s wait.
export const INTRO_WALL_SPAWN_Z = -26;

// After the wall, normal enemy spawning (entities/enemy.js's spawnEnemy,
// random lane/type again) resumes this long after the wall itself spawned.
// Every spawner's first-delay below is now tuned so its FIRST arrival
// (delay + the full ~8.75s far-travel) lands right where the pre-seeded
// entities stop arriving -- see INTRO_SEED_* below.
export const INTRO_NORMAL_ENEMY_DELAY_SEC = 1.0;

// Obstacles don't start until this long after run start. Was 6 (a
// deliberate "these are safe to tackle" window so the enemy wall's lesson
// landed before anything dangerous); the seeded obstacles below now cover
// that stretch instead, and they're placed to arrive AFTER the wall, so the
// teaching order is preserved without a dead gap.
export const INTRO_OBSTACLE_DELAY_SEC = 1.5;

// --- Pre-seeded pipeline -----------------------------------------------
// Replaces the previous "ramp-up window" approach, which spawned things at
// a much closer z (-50) for the run's first 12s. That had two bugs, and
// direct feedback hit both:
//
//   1. POP-IN. z=-50 is only ~55 units from the camera, and street.js's fog
//      doesn't even begin until 70 -- so anything spawned there appeared at
//      full opacity, mid-screen, out of nothing. Worst for platforms, which
//      are ~50 units long: entryStartZ=-50 put the far end of that same
//      structure at z=0, i.e. it materialized with its exit ramp already at
//      the player's feet.
//   2. IT DIDN'T EVEN FIX THE EMPTY START. Travel from -50 is 3.1s but from
//      -140 is 8.75s, so the moment the window closed every spawner went
//      quiet for the 5.6s difference. Measured arrival gaps were 7.2s
//      (obstacles), 7.6s (enemies) and 11.6s (platforms) -- the burst
//      arrived early, then the run went emptier than before, later.
//
// So: nothing is ever spawned close anymore (every spawner uses the far
// SPAWN_Z, always -- no pop-in possible), and the run's opening is filled
// by PRE-PLACING entities already in flight at t=0 instead. Direct
// feedback's own framing: things should either arrive from far away, or
// already be there when the game starts. This is the second option, and
// nothing can pop in because there is no "before" for it to appear out of.
//
// Values are ARRIVAL TIMES (seconds after run start); core/main.js converts
// each to a spawn z via -t * FORWARD_SPEED. Easier to reason about than raw
// z, since the whole point is controlling when the player meets each thing.
export const INTRO_SEED_ENABLED = true;

// Obstacle and enemy arrivals are deliberately interleaved so no pair lands
// within data/spawnConfig.js's MIN_ENEMY_OBSTACLE_GAP_SEC (0.6s) of each
// other -- that rule is enforced at SPAWN time for live spawns, which can't
// help here (every seed spawns at t=0), so the spacing has to be baked into
// these lists by hand instead.
export const INTRO_SEED_OBSTACLE_ARRIVALS = [4.2, 6.0, 7.8, 9.6];
// A few more than the pure interval would give -- direct feedback asked for
// "a bit more enemies in that first part." The 3-wide wall at ~1.6s lands
// before all of these.
export const INTRO_SEED_ENEMY_ARRIVALS = [3.0, 5.0, 8.6];
// One platform on the way in from the very first frame -- direct feedback:
// platforms were barely showing up at all early (one arrival at ~10s, then
// nothing until ~22s).
export const INTRO_SEED_PLATFORM_ARRIVALS = [6.8];
// Direct feedback: "let's have some coins there in the start." Coins used to
// be the worst offender -- they never got the old close-spawn treatment, so
// their 9s first-delay plus the full 8.75s travel meant the first coin
// reached the player at ~17.8s.
export const INTRO_SEED_COIN_ARRIVALS = [3.4, 6.4];
