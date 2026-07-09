import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LANE_X, DESPAWN_Z } from './constants.js';

const POOL_SIZE = 24;
const COIN_COLOR = 0xffcf3f;

function createGlowTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(colorHex);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.55, `rgba(${rgb},0.35)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

let glowTexture = null;
let blockGeometry = null;
let blockMaterial = null;

// Glossy glowing neon block, not a flat gold disc -- reads against the
// dark void the way the reference's note-blocks do. One shared geometry,
// material, and glow texture across the whole pool.
function createCoinMesh() {
  if (!blockGeometry) blockGeometry = new RoundedBoxGeometry(0.55, 0.55, 0.55, 2, 0.14);
  if (!blockMaterial) {
    blockMaterial = new THREE.MeshStandardMaterial({
      color: COIN_COLOR, roughness: 0.2, metalness: 0.25,
      emissive: 0xaa7a10, emissiveIntensity: 0.7,
    });
  }
  if (!glowTexture) glowTexture = createGlowTexture(COIN_COLOR);

  const group = new THREE.Group();
  const block = new THREE.Mesh(blockGeometry, blockMaterial);
  group.add(block);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  glow.scale.set(1.7, 1.7, 1);
  group.add(glow);

  group.userData.block = block;
  return group;
}

export function createCoinField(scene) {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const mesh = createCoinMesh();
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
    slot.mesh.userData.block.rotation.y += dt * 2.4;
    if (slot.z > DESPAWN_Z) {
      slot.active = false;
      slot.mesh.visible = false;
    }
  }
}
