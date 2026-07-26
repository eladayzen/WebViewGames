// Pizza pickup behavior (§5.6, §6, §9.3) -- same pooled spawn/scroll/
// tolerance-window/recycle shape as entities/obstacles.js, kept as its own
// module (not the same class) because collect vs. hit have different
// consequences and idle animation (sparkle/bob), matching this repo's
// existing convention of separate obstacle/pickup entity files (see
// TmntRunner/src/entities).

import * as THREE from 'three';
import { tunnelCenterAt } from '../tunnel/spline.js';
import { isWithinTolerance } from './collision.js';
import { getTexture } from './textureLoader.js';
import { PICKUP_TYPES } from '../data/pickupTypes.js';
import { RING_RADIUS, PLAYER_ANGULAR_RADIUS, STRIKE_WINDOW, RECYCLE_MARGIN } from '../data/constants.js';

const POOL_SIZE = 10;
const BOB_AMPLITUDE = 0.12;
const BOB_SPEED = 3.4;

export function createPickupPool(scene) {
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
      bobPhase: Math.random() * Math.PI * 2,
      collected: false,
    });
  }
  return { slots };
}

export function spawnPickup(pool, typeKey, theta, z) {
  const slot = pool.slots.find((s) => !s.active);
  if (!slot) return null;
  const type = PICKUP_TYPES[typeKey];
  slot.active = true;
  slot.typeKey = typeKey;
  slot.theta = theta;
  slot.z = z;
  slot.toleranceRad = type.toleranceRad;
  slot.bobPhase = Math.random() * Math.PI * 2;
  slot.collected = false;
  const texture = getTexture(type.textureUrl);
  slot.mesh.visible = true;
  slot.mesh.scale.set(type.width, type.height, 1);
  slot.mesh.material.color.setHex(texture ? 0xffffff : type.color);
  slot.mesh.material.map = texture;
  slot.mesh.material.needsUpdate = true;
  return slot;
}

function placePickup(slot, elapsedSeconds) {
  const c = tunnelCenterAt(slot.z);
  const bob = Math.sin(elapsedSeconds * BOB_SPEED + slot.bobPhase) * BOB_AMPLITUDE;
  slot.mesh.position.set(
    c.x + Math.cos(slot.theta) * RING_RADIUS,
    c.y + Math.sin(slot.theta) * RING_RADIUS + bob,
    slot.z,
  );
}

export function updatePickups(pool, zDelta, elapsedSeconds, playerZ, playerTheta, callbacks) {
  for (const slot of pool.slots) {
    if (!slot.active) continue;
    slot.z += zDelta;
    placePickup(slot, elapsedSeconds);

    if (!slot.collected && Math.abs(slot.z - playerZ) < STRIKE_WINDOW) {
      const tolerance = slot.toleranceRad + PLAYER_ANGULAR_RADIUS;
      if (isWithinTolerance(playerTheta, slot.theta, tolerance)) {
        slot.collected = true;
        slot.active = false;
        slot.mesh.visible = false;
        callbacks.onCollect(slot);
      }
    }

    if (slot.active && slot.z > playerZ + RECYCLE_MARGIN) {
      // Missed, not collected -- simply exits, no penalty beyond the
      // multiplier's own decay (§5.6).
      slot.active = false;
      slot.mesh.visible = false;
    }
  }
}

export function deactivateAllPickups(pool) {
  for (const slot of pool.slots) {
    slot.active = false;
    slot.mesh.visible = false;
  }
}
