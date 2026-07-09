import * as THREE from 'three';
import { LANE_X, DESPAWN_Z } from './constants.js';
import { createCarModel, updateHover } from './car-model.js';
import { createRibbonTrail } from './vfx.js';

const POOL_SIZE = 7;
// Kept visually distinct from the player's blue/orange so it's always
// obvious which car is yours at a glance.
const BODY_COLORS = [0xffe14d, 0x39ff8f, 0xff3fb0, 0xb453ff, 0xff5c3f];
const ACCENT_COLOR = 0xffffff;

const trailAnchorPos = new THREE.Vector3();

export function createTrafficField(scene) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const bodyColor = BODY_COLORS[i % BODY_COLORS.length];
    const mesh = createCarModel({ bodyColor, accentColor: ACCENT_COLOR, detailed: false });
    mesh.visible = false;
    scene.add(mesh);
    // Short, color-matched trail -- same element the player uses, just
    // shorter, so a car reads as "approaching" as you close the distance.
    const trail = createRibbonTrail(scene, { color: bodyColor, width: 0.6, opacity: 0.45, maxPoints: 10 });
    pool.push({ mesh, trail, active: false, laneIndex: 1, z: 0, speed: 0, nearMissChecked: false });
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
  slot.trail.reset();
  return slot;
}

export function updateTrafficField(field, dt, playerSpeed) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    const closingSpeed = playerSpeed - slot.speed;
    slot.z += closingSpeed * dt;
    slot.mesh.position.z = slot.z;
    updateHover(slot.mesh, dt);
    slot.mesh.userData.trailAnchor.getWorldPosition(trailAnchorPos);
    slot.trail.update(trailAnchorPos.x, trailAnchorPos.y, trailAnchorPos.z, dt, closingSpeed);
    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.mesh.visible = false;
      slot.trail.reset();
    }
  }
}

export function isLaneBlocked(field, laneIndex, zRange) {
  return field.pool.some(
    (s) => s.active && s.laneIndex === laneIndex && s.z > zRange[0] && s.z < zRange[1]
  );
}
