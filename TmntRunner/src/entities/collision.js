import { isPlayerRisingAboveThreshold } from './player';
import { OBSTACLE_TYPES } from './obstacles';

// Lane-slot + z-distance check, not physics engine collision -- this is a
// rhythm-timing problem, per GDD §9.3 (no Havok/Cannon plugin).
const HIT_RADIUS_Z = 0.6;
const LANE_HIT_RADIUS_X = 0.9;

export function checkCollision(player, obstacleSlot) {
  if (!obstacleSlot.type) return false;

  const pos = obstacleSlot.getHitPosition();
  const dz = Math.abs(player.root.position.z - pos.z);
  if (dz > HIT_RADIUS_Z) return false;

  const dx = Math.abs(player.root.position.x - pos.x);
  if (dx > LANE_HIT_RADIUS_X) return false;

  if (obstacleSlot.type === OBSTACLE_TYPES.LOW) {
    return !isPlayerRisingAboveThreshold(player);
  }
  return true;
}
