import * as THREE from 'three';
import { LANE_X, DESPAWN_Z } from './constants.js';
import { createCarModel, updateHover } from './car-model.js';
import { createRibbonTrail, createTrailEmitter } from './vfx.js';

const POOL_SIZE = 7;
// Kept visually distinct from the player's orange so it's always obvious
// which car is yours at a glance. The imported car body no longer takes a
// color tint (see car-model.js -- tinting washed out the real livery
// texture), so per-car identity now lives entirely in the glow accents,
// meaning this same hue needs to drive both accentColor and the trail, not
// a separate body tint.
const ACCENT_COLORS = [0xffe14d, 0x39ff8f, 0xff3fb0, 0xb453ff, 0xff5c3f];

const trailAnchorPos = new THREE.Vector3();

export function createTrafficField(scene, burstPool) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const hue = ACCENT_COLORS[i % ACCENT_COLORS.length];
    // Same detailed hoverboard model as the player, just recolored -- was
    // previously a plainer variant, which is part of why they read flat.
    const mesh = createCarModel({ bodyColor: hue, accentColor: hue, detailed: true });
    mesh.visible = false;
    scene.add(mesh);
    // Color-matched trail -- same element the player uses. Linear taper so
    // opacity ramps smoothly down to zero along its length, 4x the earlier
    // short length.
    const trail = createRibbonTrail(scene, {
      color: hue, width: 0.6, opacity: 0.5, maxPoints: 24,
    });
    // Lighter particle rate than the player's own trail -- up to 7 of these
    // can be on screen together, and each has its own independent
    // accumulator (createTrailEmitter is a factory, not shared state), so
    // they don't couple with each other or with the player's.
    const trailParticles = createTrailEmitter(burstPool, { color: hue, rate: 16 });
    pool.push({
      mesh, trail, trailParticles,
      active: false, laneIndex: 1, z: 0, speed: 0, nearMissChecked: false,
    });
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
    slot.trailParticles.emit(trailAnchorPos.x, trailAnchorPos.y, trailAnchorPos.z, dt);
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
