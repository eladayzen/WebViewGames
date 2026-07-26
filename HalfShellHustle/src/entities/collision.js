// Lane-index + z-distance overlap check (build doc §5.3, §9.3, as amended by
// direct POC-playtest feedback -- no jump-obstacle, no jump state to check)
// -- no physics engine, matching this pipeline's established lane/angle-based
// collision technique (CarRacer/src/main.js's traffic check).

import { OBSTACLE_COLLISION_HALF_Z, PLAYER_Z } from '../data/constants.js';

export function checkObstacleHit(player, slot) {
  if (!slot.active) return false;
  if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) return false;
  return slot.lane === player.laneIndex;
}
