import * as THREE from 'three';
import { LANE_X, DESPAWN_Z } from './constants.js';
import { createToonMaterial } from './toon.js';

const POOL_SIZE = 24;

export function createCoinField(scene) {
  const pool = [];
  const geometry = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16);
  const material = createToonMaterial(0xffd23f, { emissive: 0x7a5200, emissiveIntensity: 0.4 });
  for (let i = 0; i < POOL_SIZE; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, active: false, laneIndex: 1, z: 0 });
  }
  return { pool };
}

export function spawnCoin(field, laneIndex, z) {
  const slot = field.pool.find((s) => !s.active);
  if (!slot) return null;
  slot.active = true;
  slot.laneIndex = laneIndex;
  slot.z = z;
  slot.mesh.visible = true;
  slot.mesh.position.set(LANE_X[laneIndex], 0.9, z);
  return slot;
}

export function updateCoinField(field, dt, playerSpeed) {
  for (const slot of field.pool) {
    if (!slot.active) continue;
    slot.z += playerSpeed * dt;
    slot.mesh.position.z = slot.z;
    slot.mesh.rotation.z += dt * 3;
    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.mesh.visible = false;
    }
  }
}
