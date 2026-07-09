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
// many particles are alive. Every burst/trail effect in the game reuses
// this single primitive instead of ad-hoc particle code per effect.
export class ParticlePool {
  constructor(scene, count, size) {
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
      size, map: getDotTexture(), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, colorHex, {
    count = 1, speed = 4, spread = 0.15, life = 0.5, upBias = 0, gravity = 3,
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
      // Bias the random cone toward (dirX, dirY, dirZ) when given, else emit
      // in all directions (dirY defaults the cone around +Y).
      if (dirX || dirY || dirZ) {
        vx += dirX; vy += dirY; vz += dirZ;
      }
      const len = Math.hypot(vx, vy, vz) || 1;
      const s = speed * (0.5 + Math.random() * 0.5);
      this.velocities[i * 3 + 0] = (vx / len) * s;
      this.velocities[i * 3 + 1] = (vy / len) * s + upBias;
      this.velocities[i * 3 + 2] = (vz / len) * s;

      this.positions[i * 3 + 0] = x + (Math.random() - 0.5) * spread;
      this.positions[i * 3 + 1] = y + (Math.random() - 0.5) * spread;
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

// --- Presets -----------------------------------------------------------

export function spawnCoinBurst(pool, x, y, z) {
  pool.spawn(x, y, z, 0x9ff5ff, { count: 16, speed: 5, life: 0.4, gravity: 1, dirSpread: Math.PI });
  pool.spawn(x, y, z, 0xffe98a, { count: 8, speed: 3, life: 0.5, gravity: 1, dirSpread: Math.PI });
}

export function spawnCrashBurst(pool, x, y, z) {
  pool.spawn(x, y, z, 0xff5a3f, { count: 26, speed: 9, life: 0.6, gravity: 4, spread: 0.4, dirSpread: Math.PI });
  pool.spawn(x, y, z, 0xffb347, { count: 14, speed: 6, life: 0.7, gravity: 4, spread: 0.4, dirSpread: Math.PI });
}

const TRAIL_COLOR = 0x5fe0ff;
let trailAccum = 0;
export function emitTrail(pool, x, y, z, dt) {
  trailAccum += dt;
  const interval = 1 / 40; // ~40 particles/sec while moving
  while (trailAccum >= interval) {
    trailAccum -= interval;
    pool.spawn(x, y, z, TRAIL_COLOR, {
      count: 1, speed: 0.6, life: 0.35, gravity: 0.5, spread: 0.25,
      dirX: 0, dirY: 0.3, dirZ: 1, dirSpread: 0.6,
    });
  }
}

// --- Ribbon trail ----------------------------------------------------
// A tapered glowing swoosh tracing an anchor's actual recent path (curves
// through lane changes), not a static decal. The world scrolls past a
// fixed-Z player here, so a raw position history would just sit in place;
// instead each sample carries an "age", and its rendered Z is pushed back
// by age * speed each frame -- reconstructing how far the world has
// scrolled past that moment, so the tail stretches behind the craft and
// lengthens with speed exactly like the pylons/streaks do.

export function createRibbonTrail(scene, {
  maxPoints = 22, width = 0.55, color = 0x5fe0ff, sampleInterval = 0.02, opacity = 1,
} = {}) {
  const positions = new Float32Array(maxPoints * 2 * 3);
  const colors = new Float32Array(maxPoints * 2 * 3);
  const indices = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const history = [];
  const rendered = [];
  const baseColor = new THREE.Color(color);
  let sampleTimer = 0;

  function update(x, y, z, dt, speed) {
    sampleTimer += dt;
    for (const h of history) h.age += dt;
    if (sampleTimer >= sampleInterval) {
      sampleTimer = 0;
      history.push({ x, y, z, age: 0 });
      if (history.length > maxPoints) history.shift();
    }

    const count = history.length;
    if (count < 2) {
      geometry.setDrawRange(0, 0);
      return;
    }

    for (let i = 0; i < count; i++) {
      const h = history[i];
      const r = rendered[i] || (rendered[i] = {});
      r.x = h.x;
      r.y = h.y;
      r.z = h.z + h.age * speed;
    }

    for (let i = 0; i < count; i++) {
      const p = rendered[i];
      const next = rendered[Math.min(i + 1, count - 1)];
      const prev = rendered[Math.max(i - 1, 0)];
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const wx = -dz;
      const wz = dx;
      const t = i / (count - 1); // 0 = oldest/tail (tapered, faded), 1 = newest/head
      const halfW = width * 0.5 * t;

      const li = i * 2, ri = i * 2 + 1;
      positions[li * 3 + 0] = p.x + wx * halfW;
      positions[li * 3 + 1] = p.y;
      positions[li * 3 + 2] = p.z + wz * halfW;
      positions[ri * 3 + 0] = p.x - wx * halfW;
      positions[ri * 3 + 1] = p.y;
      positions[ri * 3 + 2] = p.z - wz * halfW;

      const alpha = t * opacity;
      colors[li * 3 + 0] = baseColor.r * alpha;
      colors[li * 3 + 1] = baseColor.g * alpha;
      colors[li * 3 + 2] = baseColor.b * alpha;
      colors[ri * 3 + 0] = baseColor.r * alpha;
      colors[ri * 3 + 1] = baseColor.g * alpha;
      colors[ri * 3 + 2] = baseColor.b * alpha;
    }

    geometry.setDrawRange(0, (count - 1) * 6);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  function reset() {
    history.length = 0;
    geometry.setDrawRange(0, 0);
  }

  return { update, reset };
}

// --- Speed streaks -------------------------------------------------------
// Thin glowing lines rushing past close to the car, length tied to current
// speed -- a near-camera speed cue distinct from the pylons' background
// laser-grid (which scrolls at a fixed rate regardless of player speed).
// Sparse and intermittent by design: each slot fires once, then sits idle
// for a random gap before firing again, rather than all slots streaming
// continuously.

const STREAK_COUNT = 5; // ~70% fewer than the original constant stream
const STREAK_SPAWN_Z = -20;
const STREAK_DESPAWN_Z = 9;
const STREAK_X_RANGE = 5.5;
const STREAK_Y_MIN = 0.3;
const STREAK_Y_MAX = 4.2;
const STREAK_BASE_LENGTH = 1.2;
const STREAK_LENGTH_PER_SPEED = 0.1;
const STREAK_SPEED_MULT = 3.2;
const STREAK_GAP_MIN = 0.8; // seconds idle between a slot's appearances
const STREAK_GAP_MAX = 2.6;
const STREAK_COLORS = [0x6ff0ff, 0xff6ff0, 0xffffff];

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
      wait: Math.random() * STREAK_GAP_MAX, // stagger initial appearances
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
const color = new THREE.Color();

function applyStreakTransform(mesh, index, slot, length) {
  dummy.position.set(slot.x, slot.y, slot.z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, slot.active ? length : 0); // scaled to zero while idle -- invisible, no draw cost beyond the matrix write
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  color.setHex(STREAK_COLORS[slot.colorIdx]);
  mesh.setColorAt(index, color);
}

export function createSpeedStreaks(scene) {
  const geometry = new THREE.BoxGeometry(0.035, 0.035, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
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
