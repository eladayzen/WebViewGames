// Lane-index + z-distance overlap check (build doc §5.3, §9.3, as amended by
// direct POC-playtest feedback -- no jump-obstacle, no jump state to check)
// -- no physics engine, matching this pipeline's established lane/angle-based
// collision technique (CarRacer/src/main.js's traffic check).
//
// Elevation-aware (entities/platform.js's height system): a lane+z overlap
// alone isn't enough once the player and an obstacle can be at different
// heights at the same (x, z) -- specifically, a jump-type platform entry
// the player DIDN'T jump for leaves them grounded while that stretch's
// deck (and anything spawned on it) is elevated overhead. Comparing the
// player's own elevation against the obstacle's world/deck elevation and
// requiring them to be close catches that case; on a ramp-type stretch (or
// with the whole platform system disabled) both elevations are always
// equal or near-equal by construction, so this is a no-op there.

import { OBSTACLE_COLLISION_HALF_Z, PLAYER_Z } from '../data/constants.js';
import { getPlayerElevationAt, getWorldElevationAt } from './platform.js';

const ELEVATION_MATCH_THRESHOLD = 0.3;

export function checkObstacleHit(player, slot, platformField) {
  if (!slot.active) return false;
  if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) return false;
  if (slot.lane !== player.laneIndex) return false;
  const playerElevation = getPlayerElevationAt(platformField, PLAYER_Z);
  const obstacleElevation = getWorldElevationAt(platformField, slot.z);
  return Math.abs(playerElevation - obstacleElevation) < ELEVATION_MATCH_THRESHOLD;
}
