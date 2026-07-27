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
    // Swirl (optional, default 0 -- unused by dust/streaks): an angular
    // rate (rad/sec) each particle orbits around its own (centerX,centerZ)
    // on top of its normal outward velocity, see spawn()'s `swirl` option
    // and update()'s orbit step below.
    this.swirl = new Float32Array(count);
    this.centerX = new Float32Array(count);
    this.centerZ = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size, map: getDotTexture(), vertexColors: true, transparent: true, opacity,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true, fog: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    // depthTest off (above) means this always draws over solid geometry --
    // a high renderOrder makes sure it draws dead last among transparent
    // objects too (player sprite, obstacles, speed streaks are all default
    // renderOrder 0), so the dust is guaranteed on top of everything, not
    // just whatever happened to be behind it by distance.
    this.points.renderOrder = 999;
    scene.add(this.points);
  }

  spawn(x, y, z, colorHex, {
    count = 1, speed = 2, spread = 0.15, life = 0.4, upBias = 0, gravity = 2,
    dirX = 0, dirY = 0, dirZ = 0, dirSpread = Math.PI, warmup = 0, swirl = 0,
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

      // swirl != 0 -> this particle orbits (x,z) [the spawn call's own
      // origin, before the per-particle `spread` jitter above] on top of
      // its outward velocity, see update()'s orbit step. A tiny per-
      // particle rate variance keeps a many-particle burst from rotating
      // as one perfectly rigid disc.
      this.swirl[i] = swirl ? swirl * (0.85 + Math.random() * 0.3) : 0;
      this.centerX[i] = x;
      this.centerZ[i] = z;

      // Pre-warm: fast-forward the particle's OWN motion (position/velocity)
      // by `warmup` seconds right at spawn, without touching life -- so a
      // puff that's only ever seen for a couple of rendered frames still
      // reads as an already-expanded cluster instead of a tight dot on its
      // very first frame, while its fade timing is untouched.
      if (warmup > 0) {
        this.velocities[i * 3 + 1] -= this.gravity[i] * warmup;
        this.positions[i * 3 + 0] += this.velocities[i * 3 + 0] * warmup;
        this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * warmup;
        this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * warmup;
      }
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

      // Orbit step: rotate (x,z) around this particle's own (centerX,
      // centerZ) by swirl*dt radians, ON TOP of the outward drift just
      // applied above -- combining outward expansion with rotation curves
      // each particle's path into a spiral instead of a straight radial
      // line (a no-op when swirl is 0, the default for every other effect).
      if (this.swirl[i] !== 0) {
        const dx = this.positions[i * 3 + 0] - this.centerX[i];
        const dz = this.positions[i * 3 + 2] - this.centerZ[i];
        const angle = this.swirl[i] * dt;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.positions[i * 3 + 0] = this.centerX[i] + dx * cos - dz * sin;
        this.positions[i * 3 + 2] = this.centerZ[i] + dx * sin + dz * cos;
      }

      this.colors[i * 3 + 0] = this.baseColors[i * 3 + 0] * t;
      this.colors[i * 3 + 1] = this.baseColors[i * 3 + 1] * t;
      this.colors[i * 3 + 2] = this.baseColors[i * 3 + 2] * t;
    }
    if (anyAlive) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  // Carries every live particle along with the world scroll (same per-frame
  // z += speed*dt the street/buildings use, street.js's updateStreet) --
  // this is what actually moves a puff toward the camera and out of frame,
  // NOT the particle's own local velocity (that stays a small in-place puff:
  // upward drift + gravity). A puff marks a fixed point on the ground; it's
  // the world scrolling past that point, exactly like every other ground
  // decoration, that should carry it away.
  //
  // fanRate (optional): direct feedback -- the road's own lane-divider
  // lines read as splaying wider apart the closer they get to camera (plain
  // perspective on two lines far enough apart to notice), but a dust
  // puff's own particles are too close together and too short-lived for
  // that natural perspective spread to read at all. So it's faked
  // explicitly here: each particle keeps drifting further toward whichever
  // side (left/right of its own spawn point) its initial local velocity
  // already sent it, scaled by how much scroll progress (proximity to
  // camera) it's made -- same divergent-fan look as the lines, sold on
  // purpose instead of relying on unnoticeable real perspective.
  scrollZ(dz, fanRate = 0) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.positions[i * 3 + 2] += dz;
      if (fanRate) {
        this.positions[i * 3 + 0] += Math.sign(this.velocities[i * 3 + 0]) * fanRate * dz;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Small gray dust puff, fired once per foot-contact frame (main.js) at the
// planted foot's position -- a small local kick (upward + gravity), NOT
// aimed toward the camera itself. The puff marks a fixed point on the
// ground; ParticlePool.scrollZ (called every frame in main.js, same as
// street.js's building scroll) is what carries it toward the camera and out
// of frame, exactly like every other ground decoration.
//
// warmup: at this game's frame-hold pace a puff is only actually on screen
// for a couple of rendered frames before the next contact frame overwrites
// it, not long enough to watch it grow from a tight dot into a puff shape --
// so it's spawned already `warmup` seconds into its own expansion (see
// ParticlePool.spawn) and reads as an already-formed puff immediately.
export function spawnDustPuff(pool, x, y, z) {
  pool.spawn(x, y, z, 0x7d7a75, {
    count: 16, speed: 2.1, life: 0.4, gravity: 1.4, spread: 0.22,
    dirY: 1, dirSpread: 1.0, upBias: 1.3, warmup: 0.07,
  });
  pool.spawn(x, y, z, 0x8f8c86, {
    count: 8, speed: 1.5, life: 0.32, gravity: 1.1, spread: 0.16,
    dirY: 1, dirSpread: 0.8, upBias: 1.0, warmup: 0.07,
  });
}

// --- Enemy dissolve poof -----------------------------------------------
// Ninja "poof of smoke" on an enemy kill (entities/enemy.js), direct
// feedback's bigger/purple/swirling pass: instead of one burst from the
// sprite's single center point, origins are scattered across a grid
// spanning the sprite's actual on-screen footprint (width x height passed
// in by the caller) -- so it reads as the WHOLE silhouette dissolving, not
// a burst that happens to be standing where he was. Each origin's burst
// also orbits outward (ParticlePool's `swirl` option) rather than flying
// in straight radial lines, plus one big central burst for extra punch.
// Color comes from the killed enemy's own type (data/enemyTypes.js's
// poofColors), so a future differently-colored enemy type poofs its own
// color instead of a hardcoded one here.
const POOF_GRID_COLS = 4;
const POOF_GRID_ROWS = 5;
const POOF_SWIRL_RATE = 7; // rad/sec

export function spawnEnemyPoof(pool, x, y, z, width, height, colors) {
  for (let row = 0; row < POOF_GRID_ROWS; row++) {
    for (let col = 0; col < POOF_GRID_COLS; col++) {
      const ox = x + (col / (POOF_GRID_COLS - 1) - 0.5) * width;
      const oy = y - height / 2 + (row / (POOF_GRID_ROWS - 1)) * height;
      const color = colors[(row * POOF_GRID_COLS + col) % colors.length];
      pool.spawn(ox, oy, z, color, {
        count: 7, speed: 3.8, life: 0.6, gravity: 0.35, spread: 0.14,
        dirSpread: Math.PI, upBias: 0.35, warmup: 0.04,
        swirl: POOF_SWIRL_RATE * (Math.random() < 0.5 ? -1 : 1),
      });
    }
  }
  // Central punch burst, biggest/brightest of the set.
  pool.spawn(x, y, z, colors[0], {
    count: 40, speed: 5, life: 0.65, gravity: 0.4, spread: 0.45,
    dirSpread: Math.PI, upBias: 0.6, warmup: 0.05, swirl: POOF_SWIRL_RATE,
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
