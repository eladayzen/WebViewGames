// Lane-index + z-distance overlap check (build doc §5.3, §9.3, as amended by
// direct POC-playtest feedback) -- no physics engine, matching this
// pipeline's established lane/angle-based collision technique
// (CarRacer/src/main.js's traffic check).
//
// Elevation-aware (entities/platform.js's per-lane height system):
// obstacles never elevate themselves (they always spawn at street level),
// so this only needs to check the PLAYER's own current elevation (already
// resolved once per frame in entities/player.js's updatePlayer, trusted
// directly here rather than re-derived) -- climbed up above
// ELEVATION_MATCH_THRESHOLD and a ground-level hazard passes underneath
// harmlessly instead of hitting him.
//
// Also jump-aware for data/obstacleTypes.js's 'low' type only: cleared if
// player.airHeight (entities/player.js's jump-arc height, independent of
// elevationY) reaches the type's own jumpClearHeight at the contact
// instant. 'medium' has jumpable: false, so this is a no-op for it -- zero
// behavior change from the original elevation-only check.

import { OBSTACLE_COLLISION_HALF_Z, PLAYER_Z } from '../data/constants.js';

const ELEVATION_MATCH_THRESHOLD = 0.3;

export function checkObstacleHit(player, slot) {
  if (!slot.active) return false;
  if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) return false;
  if (slot.lane !== player.laneIndex) return false;
  if (slot.type.jumpable && player.airHeight >= slot.type.jumpClearHeight) return false;
  return player.elevationY < ELEVATION_MATCH_THRESHOLD;
}
