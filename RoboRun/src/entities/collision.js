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
// Also jump-aware for jumpable obstacle types (data/obstacleTypes.js --
// currently both 'medium' and 'low'): cleared if player.airHeight
// (entities/player.js's jump-arc height, independent of elevationY) plus a
// small grace margin (JUMP_CLEAR_GRACE_HEIGHT) reaches the type's own
// jumpClearHeight at the contact instant. Direct feedback: a jump that
// "technically" barely touched an obstacle, especially coming down out of
// the fall phase, should still be forgiven -- the grace margin is that
// forgiveness, applied uniformly rather than only on the way down, since
// there's no meaningful difference between "barely grazed it on the way up"
// and "barely grazed it on the way down" from the player's perspective.
// A non-jumpable type has jumpable: false, so this stays a no-op for it --
// zero behavior change from the original elevation-only check.

import { OBSTACLE_COLLISION_HALF_Z, PLAYER_Z, JUMP_CLEAR_GRACE_HEIGHT } from '../data/constants.js';

const ELEVATION_MATCH_THRESHOLD = 0.3;

export function checkObstacleHit(player, slot) {
  if (!slot.active) return false;
  if (Math.abs(slot.z - PLAYER_Z) > OBSTACLE_COLLISION_HALF_Z) return false;
  if (slot.lane !== player.laneIndex) return false;
  if (slot.type.jumpable && player.airHeight + JUMP_CLEAR_GRACE_HEIGHT >= slot.type.jumpClearHeight) return false;
  return player.elevationY < ELEVATION_MATCH_THRESHOLD;
}
