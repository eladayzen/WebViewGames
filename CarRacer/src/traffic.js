import { LANE_X, DESPAWN_Z } from './constants.js';
import { createCarModel, spinWheels } from './car-model.js';

const POOL_SIZE = 12;
// Kept visually distinct from the player's blue/orange so it's always
// obvious which car is yours at a glance.
const BODY_COLORS = [0xd94f4f, 0xe0a838, 0x4fae5c, 0xd94fbf, 0xd9d9d9];
const ACCENT_COLOR = 0xffffff;

export function createTrafficField(scene) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const mesh = createCarModel({
      bodyColor: BODY_COLORS[i % BODY_COLORS.length],
      accentColor: ACCENT_COLOR,
      detailed: false,
    });
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, active: false, laneIndex: 1, z: 0, speed: 0, nearMissChecked: false });
  }
  return { pool };
}

export function spawnTraffic(field, laneIndex, z, speed) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return null;
  slot.active = true;
  slot.laneIndex = laneIndex;
  slot.z = z;
  slot.speed = speed;
  slot.nearMissChecked = false;
  slot.mesh.visible = true;
  slot.mesh.position.x = LANE_X[laneIndex];
  slot.mesh.position.z = z;
  return slot;
}

export function updateTrafficField(field, dt, playerSpeed) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    const closingSpeed = playerSpeed - slot.speed;
    slot.z += closingSpeed * dt;
    slot.mesh.position.z = slot.z;
    spinWheels(slot.mesh, slot.speed, dt);
    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.mesh.visible = false;
    }
  }
}

export function isLaneBlocked(field, laneIndex, zRange) {
  return field.pool.some(
    (s) => s.active && s.laneIndex === laneIndex && s.z > zRange[0] && s.z < zRange[1]
  );
}
