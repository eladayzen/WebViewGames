// Shared "scrolling obstacle" behavior (§5.5, §6, §9.3): spawn at
// (theta, distanceDownTunnel), scroll toward the camera, theta-tolerance-
// window collision, recycle -- pooled (create once, reposition on recycle),
// not create/dispose per obstacle. Only sprite/size/spin differ per type
// (data/obstacleTypes.js), so adding a new obstacle type is a data change.

import * as THREE from 'three';
import { tunnelCenterAt } from '../tunnel/spline.js';
import { isWithinTolerance } from './collision.js';
import { getTexture } from './textureLoader.js';
import { OBSTACLE_TYPES } from '../data/obstacleTypes.js';
import { RING_RADIUS, PLAYER_ANGULAR_RADIUS, STRIKE_WINDOW, RECYCLE_MARGIN } from '../data/constants.js';

const POOL_SIZE = 28;

export function createObstaclePool(scene) {
  const slots = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const material = new THREE.SpriteMaterial({ transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    slots.push({
      mesh: sprite,
      active: false,
      typeKey: null,
      theta: 0,
      z: 0,
      toleranceRad: 0,
      spin: false,
      spinSpeed: 0,
      hitConsumed: false,
    });
  }
  return { slots };
}

export function spawnObstacle(pool, typeKey, theta, z) {
  const slot = pool.slots.find((s) => !s.active);
  if (!slot) return null; // pool exhausted -- shouldn't happen at these densities
  const type = OBSTACLE_TYPES[typeKey];
  slot.active = true;
  slot.typeKey = typeKey;
  slot.theta = theta;
  slot.z = z;
  slot.toleranceRad = type.toleranceRad;
  slot.spin = type.spin;
  slot.spinSpeed = type.spinSpeed || 0;
  slot.hitConsumed = false;
  const texture = getTexture(type.textureUrl);
  slot.mesh.visible = true;
  slot.mesh.scale.set(type.width, type.height, 1);
  // With a real sprite texture, color must stay white so the art's own
  // colors show unmodified (material.color multiplies the map) -- the
  // placeholder flat color only applies while textureUrl is still null.
  slot.mesh.material.color.setHex(texture ? 0xffffff : type.color);
  slot.mesh.material.map = texture;
  slot.mesh.material.rotation = 0;
  slot.mesh.material.needsUpdate = true;
  return slot;
}

function placeObstacle(slot) {
  const c = tunnelCenterAt(slot.z);
  slot.mesh.position.set(
    c.x + Math.cos(slot.theta) * RING_RADIUS,
    c.y + Math.sin(slot.theta) * RING_RADIUS,
    slot.z,
  );
}

// dtSeconds only used for spin animation; zDelta is the same per-frame
// forward-scroll amount everything else in the tunnel moves by.
export function updateObstacles(pool, zDelta, dtSeconds, playerZ, playerTheta, callbacks) {
  for (const slot of pool.slots) {
    if (!slot.active) continue;
    slot.z += zDelta;
    placeObstacle(slot);

    if (slot.spin) {
      slot.mesh.material.rotation += slot.spinSpeed * dtSeconds;
    }

    if (!slot.hitConsumed && Math.abs(slot.z - playerZ) < STRIKE_WINDOW) {
      const tolerance = slot.toleranceRad + PLAYER_ANGULAR_RADIUS;
      if (isWithinTolerance(playerTheta, slot.theta, tolerance)) {
        slot.hitConsumed = true;
        callbacks.onHit(slot);
      }
    }

    if (slot.z > playerZ + RECYCLE_MARGIN) {
      slot.active = false;
      slot.mesh.visible = false;
    }
  }
}

export function activeObstacleCount(pool) {
  let n = 0;
  for (const slot of pool.slots) if (slot.active) n += 1;
  return n;
}

export function deactivateAllObstacles(pool) {
  for (const slot of pool.slots) {
    slot.active = false;
    slot.mesh.visible = false;
  }
}
