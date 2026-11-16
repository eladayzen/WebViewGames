import * as THREE from 'three';

// Pooled particles: one additive pool (sparks, fire, flashes) and one alpha pool (smoke,
// dust). Each is a single Points draw call with per-particle size/colour/alpha.
const VS = `
attribute float size; attribute vec4 col;
varying vec4 vCol;
void main() {
  vCol = col;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (420.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying vec4 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
}`;

class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3);
    this.c = new Float32Array(n * 4); this.sz = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grow = new Float32Array(n); this.drag = new Float32Array(n); this.grav = new Float32Array(n);
    this.base = new Float32Array(n * 3); this.a0 = new Float32Array(n); this.s0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('col', new THREE.BufferAttribute(this.c, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.sz, 1));
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  emit(pos, vel, color, size, life, { grow = 0, drag = 0, grav = 0, alpha = 1 } = {}) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.p.set([pos.x, pos.y, pos.z], i * 3); this.v.set([vel.x, vel.y, vel.z], i * 3);
    this.base.set([color.r, color.g, color.b], i * 3);
    this.s0[i] = size; this.a0[i] = alpha; this.life[i] = this.max[i] = life;
    this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.c[i * 4 + 3] = 0; this.sz[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= dr; this.v[i * 3 + 1] = this.v[i * 3 + 1] * dr - this.grav[i] * dt; this.v[i * 3 + 2] *= dr;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < 0.02) { this.p[i * 3 + 1] = 0.02; this.v[i * 3 + 1] *= -0.4; }
      this.sz[i] = this.s0[i] * (1 + this.grow[i] * (1 - k));
      this.c[i * 4] = this.base[i * 3]; this.c[i * 4 + 1] = this.base[i * 3 + 1]; this.c[i * 4 + 2] = this.base[i * 3 + 2];
      this.c[i * 4 + 3] = this.a0[i] * k;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = g.attributes.col.needsUpdate = g.attributes.size.needsUpdate = true;
  }
}

// Flying chunks for wrecks: one InstancedMesh of little dark boxes.
class Debris {
  constructor(scene, n = 80) {
    this.n = n; this.i = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.items = Array.from({ length: n }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), av: new THREE.Vector3(), s: 1 }));
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.sv = new THREE.Vector3();
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, new THREE.Color(0x222222)); }
    scene.add(this.mesh);
  }
  burst(pos, base, count, color) {
    for (let k = 0; k < count; k++) {
      const it = this.items[this.i]; const idx = this.i; this.i = (this.i + 1) % this.n;
      it.life = 1.6 + Math.random() * 0.8;
      it.p.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.2, (Math.random() - 0.5) * 2));
      it.v.copy(base).add(new THREE.Vector3((Math.random() - 0.5) * 16, 6 + Math.random() * 10, (Math.random() - 0.5) * 16));
      it.av.set(Math.random() * 14, Math.random() * 14, Math.random() * 14);
      it.s = 0.18 + Math.random() * 0.4;
      this.mesh.setColorAt(idx, new THREE.Color(Math.random() < 0.5 ? color : 0x1d1b22));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      it.life -= dt;
      it.v.y -= 24 * dt; it.p.addScaledVector(it.v, dt);
      if (it.p.y < it.s / 2) { it.p.y = it.s / 2; it.v.y *= -0.35; it.v.x *= 0.7; it.v.z *= 0.7; it.av.multiplyScalar(0.7); }
      it.r.x += it.av.x * dt; it.r.y += it.av.y * dt; it.r.z += it.av.z * dt;
      const s = it.life > 0 ? it.s * Math.min(1, it.life * 2) : 0;
      this.mesh.setMatrixAt(i, this.m.compose(it.p, this.q.setFromEuler(it.r), this.sv.set(s, s, s)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const C = (h) => new THREE.Color(h);
const rnd = (a) => (Math.random() - 0.5) * a;
const _p = new THREE.Vector3(), _v = new THREE.Vector3();

export class FX {
  constructor(scene) {
    this.add = new Pool(scene, 1400, true);
    this.alpha = new Pool(scene, 700, false);
    this.debris = new Debris(scene);
  }
  update(dt) { this.add.update(dt); this.alpha.update(dt); this.debris.update(dt); }

  sparks(pos, dir, n = 18, power = 1) {
    for (let i = 0; i < n; i++) {
      _v.set(dir.x * 6 + rnd(9), 2 + Math.random() * 6, dir.z * 6 + rnd(9)).multiplyScalar(power);
      this.add.emit(pos, _v, C(Math.random() < 0.6 ? 0xffd27a : 0xff8a2a), 0.22 + Math.random() * 0.2, 0.35 + Math.random() * 0.35, { drag: 2, grav: 18 });
    }
    this.add.emit(pos, _v.set(0, 0, 0), C(0xfff2c0), 3.2 * power, 0.12, { grow: 0.6 });
  }
  smoke(pos, dark = 0.3, size = 1.4) {
    _v.set(rnd(1.2), 2.2 + Math.random() * 1.5, rnd(1.2));
    const c = new THREE.Color().setRGB(dark, dark * 0.95, dark * 1.05);
    this.alpha.emit(pos, _v, c, size, 1.2 + Math.random() * 0.6, { grow: 2.2, drag: 1.2, alpha: 0.55 });
  }
  // pale mist kicked off the wet road by the wheels
  spray(pos) {
    _v.set(rnd(1.6), 0.8 + Math.random() * 1.2, rnd(1.6));
    this.alpha.emit(pos, _v, C(0x9aa6d0), 0.7, 0.45, { grow: 3, drag: 3, alpha: 0.28 });
  }
  // manhole steam: slow, tall, lit pale blue by the night
  steam(pos) {
    _v.set(rnd(0.5), 1.6 + Math.random() * 1.2, rnd(0.5));
    this.alpha.emit(pos, _v, C(0xb4b8d8), 1.4, 2.2 + Math.random(), { grow: 2.4, drag: 0.4, alpha: 0.42 });
  }
  fire(pos) {
    _v.set(rnd(1.5), 2.5 + Math.random() * 2, rnd(1.5));
    this.add.emit(pos, _v, C(Math.random() < 0.5 ? 0xff7a1a : 0xffc23a), 0.9 + Math.random() * 0.6, 0.35 + Math.random() * 0.2, { grow: -0.5, drag: 1 });
  }
  dust(pos) {
    _v.set(rnd(2), 0.6 + Math.random(), rnd(2));
    this.alpha.emit(pos, _v, C(0x8c8478), 0.9, 0.7, { grow: 2, drag: 2, alpha: 0.35 });
  }
  explode(pos, carVel, tint) {
    this.add.emit(pos, _v.set(0, 0, 0), C(0xfff4d0), 16, 0.16, { grow: 1 });
    for (let i = 0; i < 60; i++) {
      _v.set(rnd(22), 4 + Math.random() * 14, rnd(22)).add(carVel);
      this.add.emit(pos, _v, C([0xffe08a, 0xff9a2a, 0xff5a1a][i % 3]), 0.8 + Math.random() * 1.4, 0.45 + Math.random() * 0.5, { grow: 0.8, drag: 2.5, grav: 4 });
    }
    for (let i = 0; i < 26; i++) {
      _p.copy(pos).add(_v.set(rnd(3), Math.random() * 2, rnd(3)));
      _v.set(rnd(6), 3 + Math.random() * 5, rnd(6)).addScaledVector(carVel, 0.4);
      this.alpha.emit(_p, _v, C(0x2a2630), 2 + Math.random() * 1.5, 1.6 + Math.random(), { grow: 2.5, drag: 1.5, alpha: 0.7 });
    }
    this.sparks(pos, _v.set(0, 0, 0), 30, 1.6);
    this.debris.burst(pos, carVel.clone().multiplyScalar(0.5), 16, tint);
  }
  pickupBurst(pos, color) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      _v.set(Math.cos(a) * 9, 3 + Math.random() * 4, Math.sin(a) * 9);
      this.add.emit(pos, _v, C(color), 0.5, 0.5, { drag: 3 });
    }
  }
}
