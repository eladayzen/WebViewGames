// Run-cycle energy VFX (experimental pass): foot-contact dust puffs and
// near-camera speed streaks. Both reuse the fixed-size pooled-particle /
// instanced-streak techniques proven in CarRacer/src/vfx.js (same LANE_WIDTH,
// so the streak geometry ranges below carry over at the same scale) --
// re-implemented here rather than imported since this project's obstacle/
// dust color needs and tuning are its own, not CarRacer's car-racing values.

import * as THREE from 'three';

function createDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
let dotTexture = null;
function getDotTexture() {
  if (!dotTexture) dotTexture = createDotTexture();
  return dotTexture;
}

// Fixed-size pooled particle system: one Points draw call regardless of how
// many particles are alive, reused for every burst this game needs.
export class ParticlePool {
  constructor(scene, count, size, opacity = 1) {
    this.count = count;
    this.cursor = 0;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.baseColors = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.gravity = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size, map: getDotTexture(), vertexColors: true, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, colorHex, {
    count = 1, speed = 2, spread = 0.15, life = 0.4, upBias = 0, gravity = 2,
    dirX = 0, dirY = 0, dirZ = 0, dirSpread = Math.PI,
  } = {}) {
    const c = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * dirSpread;
      const sinPhi = Math.sin(phi);
      let vx = sinPhi * Math.cos(theta);
      let vy = Math.cos(phi);
      let vz = sinPhi * Math.sin(theta);
      if (dirX || dirY || dirZ) {
        vx += dirX; vy += dirY; vz += dirZ;
      }
      const len = Math.hypot(vx, vy, vz) || 1;
      const s = speed * (0.5 + Math.random() * 0.5);
      this.velocities[i * 3 + 0] = (vx / len) * s;
      this.velocities[i * 3 + 1] = (vy / len) * s + upBias;
      this.velocities[i * 3 + 2] = (vz / len) * s;

      this.positions[i * 3 + 0] = x + (Math.random() - 0.5) * spread;
      this.positions[i * 3 + 1] = y + (Math.random() - 0.5) * spread * 0.3;
      this.positions[i * 3 + 2] = z + (Math.random() - 0.5) * spread;

      this.baseColors[i * 3 + 0] = c.r;
      this.baseColors[i * 3 + 1] = c.g;
      this.baseColors[i * 3 + 2] = c.b;

      this.gravity[i] = gravity;
      this.maxLife[i] = life;
      this.life[i] = life;
    }
  }

  update(dt) {
    let anyAlive = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      anyAlive = true;
      this.life[i] -= dt;
      const t = Math.max(this.life[i], 0) / this.maxLife[i];

      this.velocities[i * 3 + 1] -= this.gravity[i] * dt;
      this.positions[i * 3 + 0] += this.velocities[i * 3 + 0] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;

      this.colors[i * 3 + 0] = this.baseColors[i * 3 + 0] * t;
      this.colors[i * 3 + 1] = this.baseColors[i * 3 + 1] * t;
      this.colors[i * 3 + 2] = this.baseColors[i * 3 + 2] * t;
    }
    if (anyAlive) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}

// Small dusty-tan puff, fired once per foot-contact frame (main.js) at the
// planted foot's position -- biased toward +Z (dirZ), the same "toward
// camera" direction the street/buildings scroll in (street.js), since the
// dust marks a fixed point on the ground that the player's forward motion
// carries the camera past, not a puff that should just sit and hang in
// place. Short life so it reads as a quick kicked-up burst, not a lingering
// cloud.
export function spawnDustPuff(pool, x, y, z) {
  pool.spawn(x, y, z, 0xcdb68d, {
    count: 7, speed: 3.4, life: 0.2, gravity: 0.8, spread: 0.16,
    dirY: 0.35, dirZ: 1, dirSpread: 0.6,
  });
  pool.spawn(x, y, z, 0xfff6df, {
    count: 3, speed: 2.6, life: 0.16, gravity: 0.6, spread: 0.1,
    dirY: 0.3, dirZ: 1, dirSpread: 0.55,
  });
}

// --- Speed lines -----------------------------------------------------
// Thin bright streaks rushing past close to the player toward the camera,
// giving the run more velocity/energy -- same near-camera speed-cue
// technique as CarRacer's speed streaks (per-slot spawn/scroll/despawn/
// recycle, scaled to zero while idle so an idle slot costs nothing beyond
// the matrix write), retuned for this game's tighter 3-lane street and
// closer/lower camera.

const STREAK_COUNT = 6;
const STREAK_SPAWN_Z = -18;
const STREAK_DESPAWN_Z = 8;
const STREAK_X_RANGE = 4.2;
const STREAK_Y_MIN = 0.3;
const STREAK_Y_MAX = 3.4;
const STREAK_BASE_LENGTH = 1.0;
const STREAK_LENGTH_PER_SPEED = 0.06;
const STREAK_SPEED_MULT = 2.6;
const STREAK_GAP_MIN = 0.5;
const STREAK_GAP_MAX = 1.6;
const STREAK_COLORS = [0xffffff, 0xfff2c2, 0x9ff5ff];

function randomStreakGap() {
  return STREAK_GAP_MIN + Math.random() * (STREAK_GAP_MAX - STREAK_GAP_MIN);
}

function makeStreakSlots() {
  const slots = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    slots.push({
      x: 0, y: 0, z: STREAK_SPAWN_Z,
      colorIdx: Math.floor(Math.random() * STREAK_COLORS.length),
      active: false,
      wait: Math.random() * STREAK_GAP_MAX,
    });
  }
  return slots;
}

function activateStreak(slot) {
  slot.active = true;
  slot.x = (Math.random() - 0.5) * 2 * STREAK_X_RANGE;
  slot.y = STREAK_Y_MIN + Math.random() * (STREAK_Y_MAX - STREAK_Y_MIN);
  slot.z = STREAK_SPAWN_Z;
  slot.colorIdx = Math.floor(Math.random() * STREAK_COLORS.length);
}

const dummy = new THREE.Object3D();
const streakColor = new THREE.Color();

function applyStreakTransform(mesh, index, slot, length) {
  dummy.position.set(slot.x, slot.y, slot.z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, slot.active ? length : 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  streakColor.setHex(STREAK_COLORS[slot.colorIdx]);
  mesh.setColorAt(index, streakColor);
}

export function createSpeedStreaks(scene) {
  const geometry = new THREE.BoxGeometry(0.03, 0.03, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false });
  const mesh = new THREE.InstancedMesh(geometry, material, STREAK_COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const slots = makeStreakSlots();
  slots.forEach((slot, i) => applyStreakTransform(mesh, i, slot, STREAK_BASE_LENGTH));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  return { slots, mesh };
}

export function updateSpeedStreaks(field, dt, speed) {
  const { slots, mesh } = field;
  const length = STREAK_BASE_LENGTH + speed * STREAK_LENGTH_PER_SPEED;
  for (const slot of slots) {
    if (!slot.active) {
      slot.wait -= dt;
      if (slot.wait <= 0) activateStreak(slot);
      continue;
    }
    slot.z += speed * STREAK_SPEED_MULT * dt;
    if (slot.z > STREAK_DESPAWN_Z) {
      slot.active = false;
      slot.wait = randomStreakGap();
    }
  }
  slots.forEach((slot, i) => applyStreakTransform(mesh, i, slot, length));
  mesh.instanceMatrix.needsUpdate = true;
}
