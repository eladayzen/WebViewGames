// Everything that shoots or gets shot: the particle pool, the enemy drones of the dogfight (hold the reticle on one
// and the machine gun opens up, hold longer and a missile launches by itself), and the run phase's ninja stars,
// stick/kick melee and Foot Clan soldiers.
import * as THREE from 'three';
import { clamp, mulberry32, damp } from './util.js';
import { THROW_RELEASE } from './rider.js';

const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Vector3();
const ink = new THREE.MeshBasicMaterial({ color: 0x101214, side: THREE.BackSide });

// ───────────────────────── particles ─────────────────────────
export class Particles {
  constructor(scene, max = 900) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.life0 = new Float32Array(max); this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; attribute vec4 aCol; varying vec4 vCol; uniform float uScale;
        void main(){ vCol=aCol; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uScale/(-mv.z),0.0,160.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vCol; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vCol.rgb, vCol.a*a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
    this.geo = g;
  }
  /** normal blending isn't supported by the single pool: everything glows (fine for sparks/dust at low alpha) */
  emit(p, v, rgb, life, size, grav = 0, alpha = 1) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.base[i * 4] = rgb[0]; this.base[i * 4 + 1] = rgb[1]; this.base[i * 4 + 2] = rgb[2]; this.base[i * 4 + 3] = alpha;
    this.life[i] = this.life0[i] = life; this.size[i] = size; this.grav[i] = grav;
  }
  burst(p, n, speed, rgb, life, size, grav = 0) {
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.emit(p, _v, rgb, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.n;) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {   // swap-remove
        const l = --this.n;
        if (i !== l) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[l * 3 + k]; this.vel[i * 3 + k] = this.vel[l * 3 + k]; }
          for (let k = 0; k < 4; k++) this.base[i * 4 + k] = this.base[l * 4 + k];
          this.life[i] = this.life[l]; this.life0[i] = this.life0[l]; this.size[i] = this.size[l]; this.grav[i] = this.grav[l];
        }
        this.col[l * 4 + 3] = 0; this.size[l] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.life0[i];
      this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2]; this.col[i * 4 + 3] = this.base[i * 4 + 3] * k;
      i++;
    }
    for (let i = this.n; i < this.max; i++) { this.size[i] = 0; }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(this.n, 1));
  }
  clear() { this.n = 0; for (let i = 0; i < this.max; i++) this.size[i] = 0; }
}

// ───────────────────────── models ─────────────────────────
const inked = (mesh, k = 1.08) => { const g = new THREE.Group(); g.add(mesh); const o = new THREE.Mesh(mesh.geometry, ink); o.scale.copy(mesh.scale).multiplyScalar(k); o.position.copy(mesh.position); o.rotation.copy(mesh.rotation); g.add(o); return g; };

export function makeDrone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshLambertMaterial({ color: 0x4a4d63, emissive: 0x14162a, flatShading: true })); body.scale.set(1.5, 0.62, 1.5);
  g.add(inked(body, 1.06));
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff3b4a })); band.rotation.x = Math.PI / 2; g.add(band);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5a3c })); eye.position.set(0, 0.1, 1.25); g.add(eye);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); foot.visible = false; g.add(foot);
  const rotors = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: 0x2c2f44 })); arm.position.set(sx * 1.9, 0.15, 0.2); g.add(arm);
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 14), new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.4, depthWrite: false })); rot.position.set(sx * 2.6, 0.3, 0.2); g.add(rot); rotors.push(rot);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xb3262e })); fin.position.set(0, 0.7, 1.0); g.add(fin);
  g.userData = { rotors, body, eye, band };
  g.scale.setScalar(2.1);
  return g;
}

export function makeFoot(rnd = Math.random) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: 0x3a3340, emissive: 0x100c14, flatShading: true });
  const red = new THREE.MeshLambertMaterial({ color: 0xc02a32, emissive: 0x3a0a0c });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9b38a, emissive: 0x2a1c10 });
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(inked(m, 1.1)); return m; };
  mk(new THREE.BoxGeometry(0.62, 0.78, 0.36), cloth, 0, 1.15, 0);
  mk(new THREE.BoxGeometry(0.66, 0.16, 0.4), red, 0, 0.82, 0);
  mk(new THREE.SphereGeometry(0.24, 10, 8), skin, 0, 1.78, 0);
  mk(new THREE.BoxGeometry(0.5, 0.14, 0.46), red, 0, 1.84, 0);
  const legs = [mk(new THREE.BoxGeometry(0.24, 0.75, 0.26), cloth, -0.17, 0.4, 0), mk(new THREE.BoxGeometry(0.24, 0.75, 0.26), cloth, 0.17, 0.4, 0)];
  const arms = [mk(new THREE.BoxGeometry(0.2, 0.62, 0.22), cloth, -0.42, 1.2, 0), mk(new THREE.BoxGeometry(0.2, 0.62, 0.22), cloth, 0.42, 1.2, 0)];
  const blade = mk(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshLambertMaterial({ color: 0xd8dde6, emissive: 0x3a3e46 }), 0.52, 1.0, -0.4);
  g.userData = { legs, arms, blade };
  return g;
}

function makeStar(glow) {
  const sh = new THREE.Shape(); const P = 4, rOut = 0.55, rIn = 0.13;
  for (let k = 0; k < P * 2; k++) { const a = (k / (P * 2)) * Math.PI * 2, r = k % 2 ? rIn : rOut; if (k === 0) sh.moveTo(Math.sin(a) * r, Math.cos(a) * r); else sh.lineTo(Math.sin(a) * r, Math.cos(a) * r); }
  sh.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.055, 0, Math.PI * 2, true); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025);
  const star = new THREE.Group();
  star.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xdfe6ee, emissive: 0x6a727c })));
  const o = new THREE.Mesh(geo, ink); o.scale.set(1.14, 1.14, 1.6); star.add(o);
  const spin = new THREE.Group(); spin.add(star);
  const g = new THREE.Group(); g.add(spin);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 })); gl.scale.set(1.6, 1.6, 1); g.add(gl);
  g.scale.setScalar(1.4); g.visible = false;
  return { g, spin, on: false };
}

// ───────────────────────── the manager ─────────────────────────
export const GUN = { rate: 14, dmg: 1.5, range: [10, 160], lockR: 0.11, armAt: 1.5, missileCD: 2.4, missileSpeed: 110, missileDmg: 70 };
export const DRONE_HP = 150;       // a fight is a fight now: gun alone takes ~7 s of held lock, the missile takes a bite out of it

export class Combat {
  constructor(scene, glowTex, cb) {
    this.scene = scene; this.cb = cb;
    this.particles = new Particles(scene);
    this.drones = []; this.tracers = []; this.missiles = []; this.foes = []; this.dead = []; this.stars = [];
    const trMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const trGeo = new THREE.BoxGeometry(0.16, 0.16, 5);
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(trGeo, trMat); m.visible = false; scene.add(m); this.tracers.push({ m, t: 0, dur: 0.1, a: new THREE.Vector3(), b: new THREE.Vector3(), on: false }); }
    for (let i = 0; i < 6; i++) { const s = makeStar(glowTex); scene.add(s.g); this.stars.push(s); }
    this.glowTex = glowTex;
    this.reset();
  }

  reset() {
    for (const d of this.drones) this.scene.remove(d.g);
    for (const f of this.foes) this.scene.remove(f.g);
    for (const d of this.dead) this.scene.remove(d.g);
    for (const m of this.missiles) this.scene.remove(m.g);
    this.drones.length = 0; this.foes.length = 0; this.dead.length = 0; this.missiles.length = 0;
    for (const t of this.tracers) { t.on = false; t.m.visible = false; }
    for (const s of this.stars) { s.on = false; s.g.visible = false; }
    this.particles.clear();
    this.lockT = 0; this.lockTarget = null; this.grace = 0; this.candidate = null; this.fireCD = 0; this.missCD = 0; this.armed = false;
    this.spawnCD = 0; this.starCD = 0.5; this.pendingStar = null; this.meleeCD = 0; this.pendingMelee = null;
    this.t = 0; this.kills = 0; this.escaped = 0;
  }

  // ── dogfight ──
  spawnDrone(leg, s, rnd, vd) {
    const g = makeDrone(); this.scene.add(g);
    this.drones.push({
      g, s, hp: DRONE_HP, maxhp: DRONE_HP, alive: true, vd: (vd || 24) + rnd() * 3.5, A: (7 + rnd() * 6) * (leg.wideA || 1), w: 0.4 + rnd() * 0.25, ph: rnd() * 6.28, yo: 0, flash: 0,
      lat: 0, cx: leg.spawnX ? leg.spawnX() : 0, s0: s, by: leg.droneBaseY ? leg.droneBaseY(s) : 0, AY: 8 + rnd() * 12, wy: 0.45 + rnd() * 0.5, py: rnd() * 6.28, pb: rnd() * 6.28, pos: g.position, sx: 0, sy: 0, on: false, dist: 0,
    });
  }

  /** a fixed target in the world (the reactor core of a raided hover ship) */
  addStatic(pos, hp, s, onKill, small = false) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(small ? 1.25 : 2.3, 1), new THREE.MeshLambertMaterial({ color: small ? 0xffc040 : 0xff5a4a, emissive: small ? 0x553a08 : 0x551010, flatShading: true }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: small ? 0xffc050 : 0xff6a4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); halo.scale.set(small ? 6 : 11, small ? 6 : 11, 1);
    g.add(body, halo); g.userData.body = body; g.userData.rotors = []; g.position.copy(pos); this.scene.add(g);
    this.drones.push({ g, static: true, s, hp, maxhp: hp, alive: true, vd: 0, flash: 0, lat: 0, pos: g.position, sx: 0, sy: 0, on: false, dist: 0, onKill, core: !small, small });
    return this.drones[this.drones.length - 1];
  }

  spawnDroneFree(c) {
    const g = makeDrone(); this.scene.add(g); const r = c.rnd;
    const ang = c.hdg + (r() - 0.5) * 0.9, dist = 150 + r() * 50;
    this.drones.push({
      g, free: true, x: c.pos.x + Math.sin(ang) * dist, z: c.pos.z - Math.cos(ang) * dist, hdg: c.hdg + (r() - 0.5) * 1.2, by: c.pos.y + (r() - 0.5) * 10,
      hp: DRONE_HP, maxhp: DRONE_HP, alive: true, vd: 24 + r() * 3.5, w: 0.55 + r() * 0.5, ph: r() * 6.28, AY: 8 + r() * 12, wy: 0.45 + r() * 0.5, py: r() * 6.28, pb: r() * 6.28,
      yo: 0, flash: 0, lat: 0, pos: g.position, sx: 0, sy: 0, on: false, dist: 0, s: 0,
    });
  }

  glideUpdate(dt, c) {
    // c: { leg, s, lat, pos, camera, W, H, time, rnd, fightOpen, auto }
    const { leg, camera, W, H } = c;
    this.t += dt;
    // spawning
    this.spawnCD -= dt;
    const alive = this.drones.filter((d) => d.alive && !d.static).length;
    if (c.fightOpen && alive < (c.cap || 3) && this.spawnCD <= 0) {
      if (leg.free) this.spawnDroneFree(c); else this.spawnDrone(leg, c.s + (c.spawnAhead || 105) + c.rnd() * 40, c.rnd, c.droneV);
      this.spawnCD = 1.6 + c.rnd() * 1.2;
    }
    // move + project
    let cand = null, candR = 1e9;
    const R = GUN.lockR * H;
    for (const d of this.drones) {
      if (!d.alive) continue;
      const tt = this.t * d.w + d.ph;
      if (d.static) { /* a raid core: fixed in the world */ }
      else if (d.free) {
        const sp = d.vd + 11 * Math.max(0, Math.sin(this.t * 0.8 + d.pb));
        const away = Math.atan2(d.x - c.pos.x, -(d.z - c.pos.z));
        d.hdg += (wrapPi(away - d.hdg) * 0.35 + 0.7 * Math.sin(tt * 1.1)) * dt;          // flees, and jinks left / right
        d.x += Math.sin(d.hdg) * sp * dt; d.z -= Math.cos(d.hdg) * sp * dt;
        const y = d.by + d.AY * Math.sin(this.t * d.wy + d.py) * (0.6 + 0.4 * Math.sin(this.t * 0.37 + d.pb));   // pulls up / pulls down
        d.g.position.set(d.x, y, d.z);
        d.g.rotation.y = Math.PI - d.hdg; d.g.rotation.z = -Math.sin(tt * 1.1) * 0.5;
      } else {
      d.s += (d.vd + (leg.evasive ? 11 : leg.burst || 0) * Math.max(0, Math.sin(this.t * 0.8 + d.pb))) * dt;   // bursts of speed when it jinks
      d.lat = d.A * Math.sin(tt) + 2.2 * Math.sin(tt * 2.3);
      const sc = clamp(d.s, 0, leg.L + 80);
      const y = leg.evasive ? d.by + leg.slopeY * (d.s - d.s0) + d.AY * Math.sin(this.t * d.wy + d.py) * (0.6 + 0.4 * Math.sin(this.t * 0.37 + d.pb)) : leg.pathYAt(sc) + 0.6;   // path mode: always at the height the reticle sees -- they only move left / right, the one axis you control   // evasive: pulls up / pulls down
      leg.at(sc, d.lat, _q); d.g.position.set(_q.x, y, _q.z);
      d.g.rotation.z = -Math.cos(tt) * d.A * d.w * 0.05;                 // banks into its weave
      d.g.rotation.y = Math.PI - leg.hdgAt(sc);
      }
      for (const r of d.g.userData.rotors || []) r.rotation.y += dt * 40;
      d.flash = Math.max(0, d.flash - dt * 6);
      d.g.userData.body.material.emissive.setRGB(0.08 + d.flash * 0.9, 0.09 + d.flash * 0.7, 0.16 + d.flash * 0.4);
      d.dist = d.g.position.distanceTo(c.pos);
      _v.copy(d.g.position).project(camera);
      d.on = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      d.sx = (_v.x * 0.5 + 0.5) * W; d.sy = (-_v.y * 0.5 + 0.5) * H;
      const r = Math.hypot(d.sx - W / 2, d.sy - H / 2);
      if (d.on && d.dist > GUN.range[0] && d.dist < GUN.range[1] && r < R && r < candR) { cand = d; candR = r; }
      if (d.static) { if (d.s < c.s - 8) { d.alive = false; this.scene.remove(d.g); } }
      else if (d.free) { if (d.dist > 400) { d.alive = false; this.scene.remove(d.g); this.escaped++; this.cb.escaped?.(); } }
      else if (d.s < c.s - 6) { d.alive = false; this.scene.remove(d.g); }                          // flew past
      else if (d.s > c.s + 190) { d.alive = false; this.scene.remove(d.g); this.escaped++; this.cb.escaped?.(); }
    }
    this.drones = this.drones.filter((d) => d.alive);
    this.candidate = cand;
    // lock
    if (cand) {
      if (cand !== this.lockTarget) { this.lockT *= 0.35; this.lockTarget = cand; }
      this.lockT += dt; this.grace = 0.3;
    } else {
      this.grace -= dt;
      if (this.grace <= 0) { this.lockT = Math.max(0, this.lockT - dt * 3); if (this.lockT === 0) this.lockTarget = null; }
    }
    this.armed = !!cand && this.lockT >= GUN.armAt * 0.8 && this.missCD <= 0;
    // gun
    this.fireCD -= dt; this.missCD -= dt;
    if (cand && this.lockT > 0.22) {
      while (this.fireCD <= 0) { this.fireCD += 1 / GUN.rate; this.shoot(c, cand); }
    }
    // missile launches itself on a long hold
    if (cand && this.lockT >= GUN.armAt && this.missCD <= 0) {
      this.launch(c, cand); this.missCD = GUN.missileCD; this.lockT = 0.55;
    }
    this.updateEffects(dt);
  }

  shoot(c, d) {
    const t = this.tracers.find((x) => !x.on); if (!t) return;
    t.on = true; t.t = 0; t.dur = clamp(d.dist / 330, 0.05, 0.4); t.m.visible = true;
    const side = (this._side = -(this._side || 1));
    t.a.set(c.pos.x + side * 0.7, c.pos.y - 0.2, c.pos.z - 1.5);
    t.b.copy(d.g.position).add(_v.set((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.2, 0));
    this.hit(d, GUN.dmg, false);
  }

  hit(d, dmg, big) {
    if (!d.alive) return;
    d.hp -= dmg; d.flash = 1;
    this.particles.burst(d.g.position, big ? 22 : 3, big ? 26 : 9, [1, 0.8, 0.35], 0.35, big ? 1.6 : 0.8);
    if (d.hp <= 0) {
      d.alive = false; this.kills++; d.onKill?.(d);
      this.scene.remove(d.g);
      this.particles.burst(d.g.position, 60, 34, [1, 0.55, 0.2], 0.9, 2.4);
      this.particles.burst(d.g.position, 26, 16, [1, 0.95, 0.7], 0.6, 3.6);
      if (!d.static) this.cb.kill?.(d.g.position.clone(), big);
      if (this.lockTarget === d) { this.lockTarget = null; this.lockT = 0; }
    }
  }

  launch(c, d) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0xe8ecf4, emissive: 0x555a66 })); body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 8), new THREE.MeshLambertMaterial({ color: 0xff3b3b, emissive: 0x551010 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -1.0;
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffa050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(3, 3, 1); gl.position.z = 0.9;
    g.add(body, tip, gl); g.position.set(c.pos.x + (Math.random() < 0.5 ? -1 : 1) * 1.1, c.pos.y - 0.4, c.pos.z - 1);
    this.scene.add(g);
    this.missiles.push({ g, d, v: new THREE.Vector3((c.fwd ? c.fwd.x : 0) * (c.speed || 30), -4, (c.fwd ? c.fwd.z : -1) * (c.speed || 30)), age: 0 });
    this.cb.missile?.();
  }

  updateEffects(dt) {
    for (const t of this.tracers) {
      if (!t.on) continue;
      t.t += dt; const k = t.t / t.dur;
      if (k >= 1) { t.on = false; t.m.visible = false; continue; }
      t.m.position.lerpVectors(t.a, t.b, k); t.m.lookAt(t.b);
    }
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]; m.age += dt;
      const tgt = m.d.alive ? m.d.g.position : null;
      if (tgt) {
        _w.subVectors(tgt, m.g.position); const dist = _w.length(); _w.normalize();
        const turn = clamp(dt * (3 + m.age * 5), 0, 1);
        m.v.lerp(_w.multiplyScalar(GUN.missileSpeed + m.age * 40), turn);
        if (dist < 3.8 + this.t * 0) { this.hit(m.d, GUN.missileDmg, true); this.cb.blast?.(m.g.position.clone()); this.scene.remove(m.g); this.missiles.splice(i, 1); continue; }
      }
      m.g.position.addScaledVector(m.v, dt); _q.copy(m.g.position).add(m.v); m.g.lookAt(_q);
      this.particles.emit(m.g.position, _v.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 6), [1, 0.7, 0.35], 0.5, 1.5, 0, 0.8);
      if (m.age > 4 || !tgt) { this.particles.burst(m.g.position, 12, 12, [1, 0.6, 0.3], 0.4, 1.4); this.scene.remove(m.g); this.missiles.splice(i, 1); }
    }
    this.particles.update(dt);
  }

  // ── run phase ──
  spawnFoes(rnd, zFrom, zTo, n) {
    for (let i = 0; i < n; i++) {
      const g = makeFoot(rnd); const x = (rnd() - 0.5) * 9, z = zFrom + (zTo - zFrom) * (i + rnd() * 0.7) / n;
      g.position.set(x, 0, z); g.rotation.y = 0; this.scene.add(g);
      this.foes.push({ g, x, z, hp: 1, alive: true, y: 0, vy: 0, vx: 0, vz: 0, spin: 0, life: 0, wake: 26 + rnd() * 10, ph: rnd() * 6 });
    }
  }

  runUpdate(dt, c) {
    // c: { rider, x, z, deckY, time, auto }
    this.t += dt;
    const { rider } = c;
    for (const f of this.foes) {
      if (f.alive) {
        const dz = c.z - f.z;                     // >0 = player is behind (further +z) the foe
        if (dz < f.wake && dz > -3) {            // wakes up and walks toward him
          f.z += 3.4 * dt; f.x += clamp((c.x - f.x), -1, 1) * 1.2 * dt;
        }
        f.g.position.set(f.x, c.deckY, f.z);
        f.g.rotation.y = Math.atan2(c.x - f.x, -(c.z - f.z)) * 0.0 + Math.PI * 0 + 0;
        const w = Math.sin(this.t * 7 + f.ph) * 0.5;
        f.g.userData.legs[0].rotation.x = w; f.g.userData.legs[1].rotation.x = -w;
        f.g.userData.arms[0].rotation.x = -w * 0.6;
      } else {
        f.life += dt; f.vy -= 32 * dt;
        f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt;
        f.g.position.set(f.x, c.deckY + f.y, f.z);
        f.g.rotation.x -= dt * 9; f.g.rotation.z += f.spin * dt;
        if (f.life > 1.1) { f.g.visible = false; }
      }
    }
    // throw ninja stars at the nearest foe ahead
    this.starCD -= dt;
    if (this.starCD <= 0 && !this.pendingStar && !rider.busy && !rider.throwing) {
      let best = null, bd = 1e9;
      for (const f of this.foes) {
        if (!f.alive || f.aimed) continue;
        const ds = c.z - f.z; if (ds < 6 || ds > 30) continue;
        if (ds < bd) { bd = ds; best = f; }
      }
      if (best && rider.playThrow()) { this.pendingStar = { f: best, at: THROW_RELEASE }; this.starCD = 0.62; best.aimed = true; }
    }
    if (this.pendingStar) {
      this.pendingStar.at -= dt;
      if (this.pendingStar.at <= 0) {
        const s = this.stars.find((x) => !x.on);
        if (s) { rider.handWorld(s.g.position); Object.assign(s, { on: true, f: this.pendingStar.f, age: 0 }); s.g.visible = true; this.cb.throw?.(); }
        this.pendingStar = null;
      }
    }
    for (const s of this.stars) {
      if (!s.on) continue;
      s.age += dt; s.spin.rotation.z -= dt * 30; s.spin.rotation.x = 0.55;
      const f = s.f;
      _v.set(f.x, c.deckY + 1.2 + f.y, f.z);
      _w.subVectors(_v, s.g.position); const dist = _w.length(), step = 62 * dt;
      if (dist <= Math.max(step, 0.8) || s.age > 0.9) {
        if (f.alive && dist < 2.4) this.knock(f, c, 1);
        s.on = false; s.g.visible = false; this.particles.burst(s.g.position, 6, 8, [1, 0.9, 0.6], 0.3, 0.8);
      } else { s.g.position.addScaledVector(_w, step / dist); s.g.lookAt(_v); }
      this.particles.emit(s.g.position, _q.set(0, 0, 0), [1, 0.75, 0.4], 0.18, 0.9, 0, 0.6);
    }
    // melee: anyone close enough in front gets the stick / kick
    this.meleeCD -= dt;
    if (this.meleeCD <= 0 && !rider.busy && !this.pendingMelee) {
      const near = this.foes.some((f) => f.alive && c.z - f.z < 3.1 && c.z - f.z > -0.8 && Math.abs(f.x - c.x) < 2.2);
      if (near && rider.playMelee()) { this.pendingMelee = 0.22; this.meleeCD = 0.55; }
    }
    if (this.pendingMelee !== null && this.pendingMelee !== undefined && this.pendingMelee !== false) {
      this.pendingMelee -= dt;
      if (this.pendingMelee <= 0) {
        this.pendingMelee = null; let hit = 0;
        for (const f of this.foes) if (f.alive && c.z - f.z < 3.8 && c.z - f.z > -1.2 && Math.abs(f.x - c.x) < 2.6) { this.knock(f, c, 2); hit++; }
        if (hit) this.cb.shake?.(0.3);
      }
    }
    this.particles.update(dt);
  }

  knock(f, c, kind) {
    f.alive = false; f.life = 0; f.y = 0; f.vy = 11 + Math.random() * 4; f.vx = (f.x - c.x) * 2 + (Math.random() - 0.5) * 6; f.vz = -12 - Math.random() * 6; f.spin = (Math.random() - 0.5) * 12;
    this.particles.burst(f.g.position, 14, 14, kind === 2 ? [1, 0.85, 0.4] : [0.95, 0.9, 0.8], 0.4, 1.4);
    this.cb.foeDown?.(kind, f.g.position.clone());
  }
}
