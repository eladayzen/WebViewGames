// Run-opening difficulty ramp, expressed purely as SPACING between hazards.
//
// Direct feedback: "the game starts really hard on the start, so you have to
// move a lot of things, and you can find yourself losing lives really fast...
// I'm not talking about speed, I'm talking about placement of game objects."
// So this is deliberately a separate axis from systems/speed.js: that ramp
// changes how long you have to react to ONE thing, this changes how many
// things there are to react to. They're tuned independently and neither reads
// the other.
//
// WHAT IT APPLIES TO: obstacles only -- the one thing in this game that costs
// a life (kill barriers are disabled, see PLATFORM_KILL_TYPE_ENABLED). Enemies
// are rewarding to hit, coins are pure upside, and platforms are the terrain;
// thinning any of those out would make the opening emptier rather than kinder,
// which is the opposite of the ask ("we need difficulty but we need interest
// as well"). Hazards get sparser; everything worth chasing stays put.
//
// KEYED ON ARRIVAL TIME, NOT SPAWN TIME. Everything spawns ~140 world units
// upstream, which at the run's starting speed is ~13 seconds of travel before
// the player ever sees it. An ease-in keyed on gameTime would therefore have
// fully expired by the time its first eased obstacle arrived -- the player
// would experience none of it. spawnArrivalTime() does that conversion, so the
// numbers in data/spawnConfig.js mean what they say: seconds of PLAYER
// experience, measured from the first thing he sees.

import { SPAWN_Z, PLAYER_Z } from '../data/constants.js';
import { distanceTraveledBy, timeToTravel } from './speed.js';
import { EASE_IN_DURATION_SEC, EASE_IN_HAZARD_SPACING_MULTIPLIER } from '../data/spawnConfig.js';

// How far a freshly-spawned entity has to travel before it reaches the player.
const SPAWN_TRAVEL_DISTANCE = Math.abs(SPAWN_Z - PLAYER_Z);

// When something spawned RIGHT NOW will actually reach the player. Not simply
// gameTime + a constant: the world is accelerating, so the same 140 units takes
// ~13.1s at the start of a run and ~9.7s once the speed ramp tops out.
export function spawnArrivalTime(gameTime) {
  return timeToTravel(distanceTraveledBy(gameTime) + SPAWN_TRAVEL_DISTANCE);
}

// Multiplier on the obstacle spawn interval for a hazard arriving at
// `arrivalSec`. Starts at EASE_IN_HAZARD_SPACING_MULTIPLIER and eases linearly
// to 1 (i.e. the authored interval, unchanged) at EASE_IN_DURATION_SEC.
//
// Linear on purpose: the player's sense of "it's getting busier" should track
// the number on the dial, and any curve here would make EASE_IN_DURATION_SEC
// mean something other than "when it's over". Clamped at both ends so a seed
// authored at a negative time, or a run that outlasts the ramp, both behave.
export function hazardSpacingMultiplierAt(arrivalSec) {
  if (EASE_IN_DURATION_SEC <= 0) return 1;
  const t = Math.min(1, Math.max(0, arrivalSec / EASE_IN_DURATION_SEC));
  return EASE_IN_HAZARD_SPACING_MULTIPLIER + (1 - EASE_IN_HAZARD_SPACING_MULTIPLIER) * t;
}
