// Lane-index + z-distance overlap check (build doc §5.3, §9.3, as amended by
// direct POC-playtest feedback -- no jump-obstacle, no jump state to check)
// -- no physics engine, matching this pipeline's established lane/angle-based
// collision technique (CarRacer/src/main.js's traffic check).
//
// Elevation-aware (entities/laneClimb.js's per-lane height system):
// obstacles/enemies never elevate themselves (they always spawn at street
// level), so this only needs to check the PLAYER's own current elevation
// (already resolved once per frame in entities/player.js's updatePlayer,
// trusted directly here rather than re-derived) -- climbed up above
// ELEVATION_MATCH_THRESHOLD and a ground-level hazard passes underneath
// harmlessly instead of hitting him, which is the actual payoff of
// climbing over something rather than dodging it sideways.

import { OBSTACLE_COLLISION_HALF_Z, PLAYER_Z } from '../data/constants.js';

const ELEVATION_MATCH_THRESHOLD = 0.3;

export function checkObstacleHit(player, slot) {
  if (!slot.active) return false;
  if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) return false;
  if (slot.lane !== player.laneIndex) return false;
  return player.elevationY < ELEVATION_MATCH_THRESHOLD;
}
