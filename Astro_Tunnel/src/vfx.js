import * as THREE from 'three';

// A fixed-size, round-robin pool of additive-blended points. Reused for the
// engine trail (continuous emission) and one-shot bursts (gem pickup,
// crash) so there's exactly one particle implementation in the codebase —
// cheap enough for a mobile WebView since it's a single draw call per pool
// regardless of how many particles are alive.
export class ParticlePool {
  constructor(scene, count, size = 0.12) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.baseColors = new Array(count).fill(null);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, color, life) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const i3 = i * 3;
    this.positions[i3] = x;
    this.positions[i3 + 1] = y;
    this.positions[i3 + 2] = z;
    this.velocities[i3] = vx;
    this.velocities[i3 + 1] = vy;
    this.velocities[i3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseColors[i] = color;
  }

  update(dtSeconds) {
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.colors[i3] = 0;
        this.colors[i3 + 1] = 0;
        this.colors[i3 + 2] = 0;
        continue;
      }
      this.life[i] -= dtSeconds;
      this.positions[i3] += this.velocities[i3] * dtSeconds;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dtSeconds;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dtSeconds;

      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const c = this.baseColors[i];
      this.colors[i3] = c.r * t;
      this.colors[i3 + 1] = c.g * t;
      this.colors[i3 + 2] = c.b * t;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// Spherical one-shot burst — gem pickups and crashes both use this, just
// with different color/count/speed.
export function spawnBurst(pool, x, y, z, color, count, speed, life) {
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const s = speed * (0.5 + Math.random() * 0.5);
    const vx = Math.sin(phi) * Math.cos(theta) * s;
    const vy = Math.sin(phi) * Math.sin(theta) * s;
    const vz = Math.cos(phi) * s;
    pool.spawn(x, y, z, vx, vy, vz, color, life * (0.7 + Math.random() * 0.3));
  }
}
