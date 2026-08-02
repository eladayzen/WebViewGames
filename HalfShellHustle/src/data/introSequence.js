// Run-start onboarding pacing -- direct feedback: the old plain spawn-delay
// setup left 5-10+ real seconds of dead time before the player had anything
// to react to (obstacles/enemies spawn far upstream at SPAWN_Z, which alone
// takes ~13s of pure scroll-in travel at the ramp's starting speed, on top of their
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
// from). This one is a raw z rather than an arrival time like the
// INTRO_SEED_* lists below, so the speed ramp shifts when it lands: -26
// arrives ~2.6s in at the starting speed (it was ~1.6s at the old fixed 16).
// Still readable as "it's arriving" rather than an instant ambush, and if
// anything the extra beat helps -- but it's why this number no longer matches
// its own old comment.
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
//
// 1.5 -> 1.8 to stop the FIRST attempt being wasted. The intro wall sets
// lastEnemySpawnTime = 0 and the enemy spawner fires at 1.0s, so a 1.5s
// obstacle attempt was only 0.5s behind it -- inside
// MIN_ENEMY_OBSTACLE_GAP_SEC (0.6), hence rejected, and the retry 1.6s later
// landed 0.1s after the NEXT enemy and was rejected too. First obstacle
// actually spawned at 4.7s. At 1.8 the gap is 0.8s and it fires immediately.
// (Pre-existing, not caused by the speed ramp -- but the ramp's longer travel
// time turned a ~3.9s hole into a ~7.7s one, which is what surfaced it.)
export const INTRO_OBSTACLE_DELAY_SEC = 1.8;

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
// each to a spawn z via systems/speed.js's distanceTraveledBy(t) -- the
// integral of the speed ramp, NOT t * a fixed speed. That's what makes these
// authored times still mean exactly what they say now that the world starts
// slower and accelerates.
//
// HARD CEILING ~13.1s: a seed is placed at -distanceTraveledBy(t), and the
// world only covers 140 units (SPAWN_Z) in the first ~13.1s at the ramp's
// starting speed. Author a seed later than that and it spawns FURTHER out
// than the live pipeline's own horizon. So this list can't be extended
// indefinitely to cover a late-arriving spawner -- that has to be fixed on
// the spawner's first-delay instead (which is exactly why
// PLATFORM_FIRST_SPAWN_DELAY_SEC had to drop to 0).
export const INTRO_SEED_ENABLED = true;

// Obstacle and enemy arrivals are deliberately interleaved so no pair lands
// within data/spawnConfig.js's MIN_ENEMY_OBSTACLE_GAP_SEC (0.6s) of each
// other -- that rule is enforced at SPAWN time for live spawns, which can't
// help here (every seed spawns at t=0), so the spacing has to be baked into
// these lists by hand instead. Check BOTH lists together when editing either.
//
// Extended out to ~13s for the speed ramp: the slower start pushes every
// spawner's first live arrival later (obstacles from ~10.3s to ~14.7s), so
// the seeds have to cover more of the opening than they used to or a hole
// opens up right where the seeded intro hands off.
//
// THINNED 6 -> 3 -> 2, and the first one pushed 4.2 -> 5.2 -> 5.8s. Direct
// feedback, twice: the opening was too punishing, then still "a bit too much
// of those" after the first pass.
//
// THIS LIST IS THE WHOLE PROBLEM, AND THE EASE-IN DIAL CANNOT TOUCH IT. The
// live spawner's very first obstacle doesn't reach the player until ~14.7s, so
// everything before that is exactly these entries -- measured: turning
// data/spawnConfig.js's EASE_IN_* dial off entirely changes the count in the
// player's first 15 seconds by zero. Any complaint about how the game OPENS is
// answered here; that dial only shapes what comes after. Worth knowing before
// reaching for the dial again.
//
// Two obstacles in the opening ~13s, 5.4s apart -- roughly a third of the
// settled rate. The opening stays busy, just not lethal: the 3-wide enemy wall
// (~2.6s), four more enemies, four coin clusters and a platform all still land
// in that same stretch. Sparser hazards, same amount to do.
export const INTRO_SEED_OBSTACLE_ARRIVALS = [5.8, 11.2];
// NOT thinned, unlike the obstacles above -- deliberately. Enemies are
// rewarding to hit, so they're what keeps the (now much sparser) opening
// interesting rather than empty. Same reasoning as the ease-in dial applying to
// obstacles only. The 3-wide wall at ~2.6s still lands before all of these.
//
// Re-spaced only to keep every cross-pair with the obstacle list above at least
// MIN_ENEMY_OBSTACLE_GAP_SEC (0.6s) apart -- that rule is enforced at SPAWN
// time for live spawns, which can't help here (every seed spawns at t=0), so it
// has to be checked by hand. Closest cross-pair now is 6.6 against the 5.8
// obstacle: 0.8s. (Checked by simulation, not by eye -- see the commit.)
export const INTRO_SEED_ENEMY_ARRIVALS = [3.0, 6.6, 10.0, 12.8];
// One platform on the way in from the very first frame -- direct feedback:
// platforms were barely showing up at all early (one arrival at ~10s, then
// nothing until ~22s). core/main.js passes an explicit lane for each entry,
// since spawnPlatform otherwise picks at random with no mutual exclusion and
// two seeds could stack in the same lane.
export const INTRO_SEED_PLATFORM_ARRIVALS = [6.8];
// Direct feedback: "let's have some coins there in the start." Coins used to
// be the worst offender -- they never got the old close-spawn treatment, so
// their 9s first-delay plus the full travel meant the first coin reached the
// player at ~17.8s.
export const INTRO_SEED_COIN_ARRIVALS = [3.4, 6.4, 9.4, 12.4];
