// Inside THE PORTAL (Elad 2026-11-24: "in the tunnel throw in tons of weird particles"):
// a field of glowing motes filling the pipe, each spiralling around the axis at its own
// radius and spin, in cosmic cyan / magenta / violet / gold, twinkling, some pulsing big —
// streaming past as you ride. One THREE.Points (one draw call), recycled ahead of the rider.
import * as THREE from 'three';
import { R, frameAt, wallDir } from './track.js';

const N = 2400;
const AHEAD = 105, BEHIND = 12;   // not so far that they pile into a white blob at the vanishing point
const COLS = [[0.3, 0.95, 1.0], [1.0, 0.3, 0.9], [0.6, 0.4, 1.0], [1.0, 0.85, 0.35], [0.4, 1.0, 0.6]];

export class WarpFX {
  constructor(scene, glowTex) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    this.size = new Float32Array(N);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex }, uScale: { value: 420 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC;
        uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * 1.05, t.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.pts = new THREE.Points(this.geo, this.mat);
    this.pts.frustumCulled = false;
    this.pts.visible = false;
    scene.add(this.pts);
    this.p = Array.from({ length: N }, () => ({}));
    this.f = frameAt(0);
    this.d = new THREE.Vector3();
  }

  _spawn(q, s0, playerS) {
    q.s = s0 ?? playerS + BEHIND + Math.random() * (AHEAD - BEHIND);
    q.th = Math.random() * Math.PI * 2;
    q.r = R * (0.15 + Math.random() * 0.78);          // anywhere in the pipe, not just the wall
    q.w = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 2.2);   // spin rad/s
    q.v = -(2 + Math.random() * 14);                   // drifts back toward you (adds to your speed)
    q.c = COLS[Math.floor(Math.random() * COLS.length)];
    q.base = 0.45 + Math.random() * Math.random() * 2.2;
    q.ph = Math.random() * 10;
    q.pulse = Math.random() < 0.12;
  }

  set on(v) {
    this.pts.visible = !!v;
    this.started = false;
  }
  get on() { return this.pts.visible; }

  update(dt, time, playerS) {
    if (!this.pts.visible) return;
    if (!this.started) { for (const q of this.p) this._spawn(q, null, playerS); this.started = true; }
    for (let i = 0; i < N; i++) {
      const q = this.p[i];
      q.s += q.v * dt; q.th += q.w * dt;
      if (q.s < playerS - BEHIND) this._spawn(q, playerS + AHEAD - Math.random() * 20, playerS);
      frameAt(q.s, this.f);
      wallDir(this.f, q.th, this.d);
      const k = i * 3;
      this.pos[k] = this.f.C.x + this.d.x * q.r; this.pos[k + 1] = this.f.C.y + this.d.y * q.r; this.pos[k + 2] = this.f.C.z + this.d.z * q.r;
      const tw = 0.55 + 0.45 * Math.sin(time * 6 + q.ph);
      this.col[k] = q.c[0] * tw; this.col[k + 1] = q.c[1] * tw; this.col[k + 2] = q.c[2] * tw;
      this.size[i] = q.base * (q.pulse ? 1.6 + Math.sin(time * 3 + q.ph) * 1.1 : 1);
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.color.needsUpdate = this.geo.attributes.size.needsUpdate = true;
  }
}
