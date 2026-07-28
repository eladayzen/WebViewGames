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
// to the old plain delayed-spawn behavior (constants.js's
// FIRST_SPAWN_DELAY_SEC / ENEMY_FIRST_SPAWN_DELAY_SEC).
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
export const INTRO_NORMAL_ENEMY_DELAY_SEC = 2;

// Obstacles don't start until this long after run start -- a pure
// "these are safe to tackle" window before the first real dodge-or-die
// hazard shows up, so the wall's lesson lands before it's complicated by
// anything dangerous. 4 -> 6 per direct feedback.
export const INTRO_OBSTACLE_DELAY_SEC = 6;

// Direct feedback: even with the wall itself arriving fast, everything
// AFTER it (normal-paced enemies/obstacles) was still spawning at the far
// SPAWN_Z (-140) -- so the wall cleared in ~2s, then the player waited
// another 5-10s for the first normal spawn to finish that ~9s trip in,
// since nothing else was yet in flight to fill the gap. During this
// window (measured from run start), obstacle/enemy spawns use
// RAMP_UP_SPAWN_Z instead of the normal far SPAWN_Z -- same spawn timers/
// cadence as always, just close enough to arrive quickly, so the pipe
// fills immediately instead of sitting empty for one full far-travel time.
export const INTRO_RAMP_UP_DURATION_SEC = 12;
export const INTRO_RAMP_UP_SPAWN_Z = -50; // ~3.1s to arrive at FORWARD_SPEED=16, vs SPAWN_Z's ~8.75s
