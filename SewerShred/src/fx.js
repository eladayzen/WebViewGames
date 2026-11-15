// Juice: particles (sparks, slime spray, splinters, pizza crumbs), streaks that
// sell speed, crate debris, and the camera's shake / punch / hit-stop.
import * as THREE from 'three';
import { makeGlowTexture } from './track.js';

const MAX = 900;

export class Particles {
  /** additive: glowing sparks/spray. false = normal blending, for dark matter (sewage) that additive would erase. */
  constructor(scene, { additive = true } = {}) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.max = new Float32Array(MAX);
    this.grav = new Float32Array(MAX * 3);
    this.drag = new Float32Array(MAX);
    this.s0 = new Float32Array(MAX);
    this.cursor = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: makeGlowTexture() }, uScale: { value: 400 } },
      vertexShader: /* glsl */`
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vC; varying float vA;
        uniform float uScale;
        void main(){
          vC = color; vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.mat = mat;
  }

  emit(p, v, color, { size = 0.3, life = 0.6, grav = null, drag = 1.5 } = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % MAX;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.grav[i * 3] = grav ? grav.x : 0; this.grav[i * 3 + 1] = grav ? grav.y : 0; this.grav[i * 3 + 2] = grav ? grav.z : 0;
    this.s0[i] = size; this.size[i] = size;
    this.life[i] = life; this.max[i] = life; this.drag[i] = drag;
  }

  /** A spray: n particles from p, around direction dir with spread. */
  burst(p, dir, n, color, { speed = 6, spread = 1, size = 0.3, life = 0.6, grav = null, drag = 1.5, jitter = 0.3 } = {}) {
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * spread).add(dir).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      c.copy(color).offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * jitter * 0.4);
      this.emit(p, v, c, { size: size * (0.6 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.7), grav, drag });
    }
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      const j = i * 3;
      this.vel[j] = this.vel[j] * k + this.grav[j] * dt;
      this.vel[j + 1] = this.vel[j + 1] * k + this.grav[j + 1] * dt;
      this.vel[j + 2] = this.vel[j + 2] * k + this.grav[j + 2] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, t * 2.2);
      this.size[i] = this.s0[i] * (0.4 + 0.6 * t);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); }
}

/** Splinters: real little boxes that tumble, for crate smashes. */
export class Debris {
  constructor(scene, tex) {
    this.n = 48;
    const geo = new THREE.BoxGeometry(0.42, 0.12, 0.12);
    const mat = new THREE.MeshLambertMaterial({ map: tex.crate, emissive: 0x150d05 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.n);
    this.mesh.frustumCulled = false;
    this.items = Array.from({ length: this.n }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), g: new THREE.Vector3(), s: 1 }));
    this.cursor = 0;
    this.m = new THREE.Matrix4();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, this.zero);
    scene.add(this.mesh);
    this._e = new THREE.Euler();
    this._dq = new THREE.Quaternion();
  }

  explode(p, up, fwd, count = 12, power = 1) {
    for (let k = 0; k < count; k++) {
      const it = this.items[this.cursor]; this.cursor = (this.cursor + 1) % this.n;
      it.life = 1.4;
      it.p.copy(p).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2));
      it.v.copy(up).multiplyScalar((4 + Math.random() * 6) * power)
        .addScaledVector(fwd, (6 + Math.random() * 10) * power)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(9 * power));
      it.g.copy(up).multiplyScalar(-22);
      it.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(22);
      it.q.random();
      it.s = 0.6 + Math.random() * 1.2;
    }
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      it.life -= dt;
      it.v.addScaledVector(it.g, dt);
      it.p.addScaledVector(it.v, dt);
      this._dq.setFromEuler(this._e.set(it.w.x * dt, it.w.y * dt, it.w.z * dt));
      it.q.multiply(this._dq);
      const s = it.life > 0 ? it.s * Math.min(1, it.life * 3) : 0;
      this.m.compose(it.p, it.q, new THREE.Vector3(s, s, s));
      this.mesh.setMatrixAt(i, it.life > 0 ? this.m : this.zero);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { for (const it of this.items) it.life = 0; }
}

/**
 * The board against the floor: two glowing wheel tracks laid on the wall
 * behind the rear wheels (fading ribbons), and a contact glow under the deck.
 * Cool cyan on water, hot orange on dry plates.
 */
export class BoardTrail {
  constructor(scene, glowTex) {
    this.N = 48;                         // points per track
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0.7, 0.95, 1.0) } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * (0.6 + vA), vA); }',
    });
    this.tracks = [0, 1].map(() => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(this.N * 2 * 3);
      const alpha = new Float32Array(this.N * 2);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
      const idx = [];
      for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      return { pts: [], pos, alpha, geo };
    });
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    this.glow.scale.set(2.4, 2.4, 1);
    scene.add(this.glow);
    this._v = new THREE.Vector3();
  }

  /** wheels: [left, right] world points; up: toward the pipe axis; side: board-lateral world dir */
  update(dt, wheels, up, side, speed, active, hot) {
    // dry = orange spark ribbons; wet = a pale scum wake in the sewage (was cyan water)
    this.mat.uniforms.uColor.value.setRGB(hot ? 1.0 : 0.42, hot ? 0.62 : 0.48, hot ? 0.3 : 0.36);
    const w = 0.05 + Math.min(1, speed / 30) * 0.05;   // ribbon half-width
    for (let k = 0; k < 2; k++) {
      const tr = this.tracks[k];
      if (active) {
        tr.pts.unshift({ p: wheels[k].clone().addScaledVector(up, 0.03), s: side.clone(), age: 0 });
        if (tr.pts.length > this.N) tr.pts.length = this.N;
      }
      for (const pt of tr.pts) pt.age += dt;
      while (tr.pts.length && tr.pts[tr.pts.length - 1].age > 0.6) tr.pts.pop();
      for (let i = 0; i < this.N; i++) {
        const pt = tr.pts[Math.min(i, tr.pts.length - 1)];
        if (!pt) { tr.alpha[i * 2] = tr.alpha[i * 2 + 1] = 0; continue; }
        const a = i < tr.pts.length ? Math.max(0, 1 - pt.age / 0.6) * (1 - i / this.N) : 0;
        this._v.copy(pt.p).addScaledVector(pt.s, -w); tr.pos[i * 6] = this._v.x; tr.pos[i * 6 + 1] = this._v.y; tr.pos[i * 6 + 2] = this._v.z;
        this._v.copy(pt.p).addScaledVector(pt.s, w); tr.pos[i * 6 + 3] = this._v.x; tr.pos[i * 6 + 4] = this._v.y; tr.pos[i * 6 + 5] = this._v.z;
        tr.alpha[i * 2] = tr.alpha[i * 2 + 1] = a * 0.85;
      }
      tr.geo.attributes.position.needsUpdate = tr.geo.attributes.alpha.needsUpdate = true;
    }
    // contact glow on the wall right under the deck
    this.glow.visible = active;
    if (active) {
      this.glow.position.copy(wheels[0]).add(wheels[1]).multiplyScalar(0.5).addScaledVector(up, 0.12);
      this.glow.material.color.set(hot ? 0xffa050 : 0x6f7a5c);
      this.glow.material.opacity = 0.35 + Math.min(1, speed / 30) * 0.3;
    }
  }

  clear() { for (const tr of this.tracks) tr.pts.length = 0; }
}

/** Speed streaks: thin additive lines hugging the wall, rushing past. */
export class Streaks {
  constructor(scene) {
    this.n = 70;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xcfffe0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.items = Array.from({ length: this.n }, () => ({ ds: Math.random() * 60, th: Math.random() * Math.PI * 2, r: 0 }));
  }

  update(playerS, speed, frameAt, pointAt, R, intensity) {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      it.ds -= speed * 0.016 * 1.4;
      if (it.ds < -6) { it.ds = 20 + Math.random() * 50; it.th = Math.random() * Math.PI * 2; it.r = R - 0.4 - Math.random() * 2.2; }
      const s = playerS + it.ds;
      const len = 1.5 + speed * 0.12;
      pointAt(s, it.th, it.r || R - 1, a);
      pointAt(s + len, it.th, it.r || R - 1, b);
      this.pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = intensity;
  }
}

