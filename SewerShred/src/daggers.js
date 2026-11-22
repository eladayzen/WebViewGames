// SAI STORM — a timed power-up (Elad 2026-11-18): "use the quick throwing
// animation to throw daggers which hit and bounce back … an ability unlocked
// for a period of time, in which you throw daggers at enemies ahead of you even
// if you don't hit them on your path."
//
// While it's on, Raph picks the nearest Foot Soldier ahead (anywhere in the
// 180, not just his line), plays the overhand throw on his upper body, and the
// sai leaves his HAND on the clip's measured release frame. Out: a straight,
// spinning dart that tracks its target. On the hit (or out of range) it TURNS:
// the way back is a quadratic Bezier from where it turned to his hand, rebuilt
// every frame because he moves; the control point bows sideways by a share of
// the distance, alternating sides, so a short return is a flick and a long one a
// wide sweep. Reaching the hand = caught. The return is a fresh throw: it can
// knock down anyone it passes. (Recipe from the Bloop Squad session's sai.)
import * as THREE from 'three';
import { THROW_RELEASE } from './player.js';

export const SAI = {
  dur: 10,            // s the power-up lasts
  every: 0.62,        // s between throws
  range: [5, 24],     // metres ahead a target may be (was 46 — Elad 2026-11-22: "range too big")
  speed: 62,          // m/s out (the rider does ~15)
  backSpeed: 40,      // m/s back — slower: it's the part you watch
  bow: 0.32,          // return curve depth, × distance
  life: 0.6,          // s out before it turns on its own (≈ the range at full speed)
  hitR: 1.3,          // metres
};

export class Daggers {
  constructor(scene, glowTex) {
    this.scene = scene;
    const steel = new THREE.MeshLambertMaterial({ color: 0xdfe6ee, emissive: 0x4a525c });
    const grip = new THREE.MeshLambertMaterial({ color: 0xd9302a, emissive: 0x4a0d0a });
    const ink = new THREE.MeshBasicMaterial({ color: 0x101216, side: THREE.BackSide });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
    this.pool = [];
    for (let i = 0; i < 6; i++) {
      // a sai along local +Y: long centre blade, two curled side prongs, red grip
      const sai = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.0, 6), steel); blade.position.y = 0.55;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), steel); tip.position.y = 1.13;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 6), grip); hilt.position.y = -0.14;
      sai.add(blade, tip, hilt);
      for (const sgn of [-1, 1]) {
        const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 5), steel);
        prong.position.set(sgn * 0.13, 0.2, 0); prong.rotation.z = -sgn * 0.5;
        sai.add(prong);
      }
      // cartoon ink: a slightly fatter dark copy behind
      for (const m of [...sai.children]) { const o = new THREE.Mesh(m.geometry, ink); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.setScalar(1.35); sai.add(o); }
      const spin = new THREE.Group(); spin.add(sai); sai.position.y = -0.5;
      const g = new THREE.Group(); g.add(spin);
      const glow = new THREE.Sprite(glowMat); glow.scale.set(1.6, 1.6, 1); g.add(glow);
      g.scale.setScalar(1.5);
      g.visible = false;
      scene.add(g);
      this.pool.push({ g, spin, on: false });
    }
    this.side = 1;
    this.v = new THREE.Vector3(); this.h = new THREE.Vector3(); this.c = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.sw = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.t = 0; this.cool = 0; this.pending = null;
    for (const d of this.pool) { d.on = false; d.g.visible = false; }
  }

  get active() { return this.t > 0; }
  start() { this.t = SAI.dur; this.cool = 0.15; }
  /** 0..1 of the power-up left, for the HUD. */
  get left() { return Math.max(0, this.t / SAI.dur); }

  /**
   * obstacles: the field (its .list of foot soldiers); onHit(o, worldPos) knocks one down.
   * Returns 'throw' on the frame a sai leaves the hand (for the sound).
   */
  update(dt, player, obstacles, onHit, live = true) {
    let ev = null;
    if (this.t > 0) this.t = Math.max(0, this.t - dt);
    this.cool -= dt;
    // ── pick a target and start the throw ──
    if (live && this.t > 0 && this.cool <= 0 && !this.pending && !player.busy && !player.throwing) {
      const o = this._target(player, obstacles);
      if (o && player.playThrow()) { this.pending = { o, at: THROW_RELEASE }; this.cool = SAI.every; o.saiAimed = true; }
    }
    // ── release on the clip's measured frame ──
    if (this.pending) {
      this.pending.at -= dt;
      if (this.pending.at <= 0) {
        const d = this.pool.find((x) => !x.on);
        if (d) {
          player.handWorld(d.g.position);
          Object.assign(d, { on: true, back: false, o: this.pending.o, age: 0, hit: new Set(), side: (this.side = -this.side) });
          d.g.visible = true;
          ev = 'throw';
        }
        this.pending = null;
      }
    }
    // ── fly ──
    for (const d of this.pool) {
      if (!d.on) continue;
      d.age += dt;
      d.spin.rotation.x -= dt * 26;                       // end over end
      const p = d.g.position;
      if (!d.back) {
        const o = d.o;
        if (o && !o.done && !o.flying) this.tgt.copy(o.mesh.position).addScaledVector(this._up(o), 1.1);
        this.v.subVectors(this.tgt, p);
        const dist = this.v.length(), stepLen = SAI.speed * dt;
        if (dist <= Math.max(stepLen, 0.01)) p.copy(this.tgt); else p.addScaledVector(this.v, stepLen / dist);
        d.g.lookAt(this.tgt);
        if (this._hits(d, obstacles, onHit) || dist < 0.5 || d.age > SAI.life) { player.handWorld(this.h); this._turn(d); }
      } else {
        // the return: rebuilt every frame against where his hand is NOW
        player.handWorld(this.h);
        d.bt += dt / d.bdur;
        const u = Math.min(1, d.bt);
        const dist = d.from.distanceTo(this.h);
        this.c.addVectors(d.from, this.h).multiplyScalar(0.5);
        this.v.subVectors(this.h, d.from).normalize();
        const up = this._up(player);
        const sideways = this.sw.crossVectors(this.v, up).normalize();
        this.c.addScaledVector(sideways, d.side * SAI.bow * dist).addScaledVector(up, SAI.bow * 0.5 * dist);
        const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), cc = u * u;
        p.set(a * d.from.x + b * this.c.x + cc * this.h.x, a * d.from.y + b * this.c.y + cc * this.h.y, a * d.from.z + b * this.c.z + cc * this.h.z);
        this._hits(d, obstacles, onHit);
        if (u >= 1) { d.on = false; d.g.visible = false; }   // caught
      }
    }
    return ev;
  }

  _turn(d) {
    d.back = true; d.bt = 0;
    d.from = d.g.position.clone();
    d.hit = new Set();                                       // a fresh throw on the way back
    d.bdur = Math.max(0.16, d.from.distanceTo(this.h) / SAI.backSpeed);   // this.h = his hand, set by the caller
  }

  _hits(d, obstacles, onHit) {
    let any = false;
    for (const o of obstacles.list) {
      if (o.type !== 'foot' || o.done || o.flying || d.hit.has(o)) continue;
      if (o.mesh.position.distanceToSquared(d.g.position) > (SAI.hitR + 0.6) ** 2) {
        // body centre sits ~1 m off the wall
        this.tgt.copy(o.mesh.position).addScaledVector(this._up(o), 1.0);
        if (this.tgt.distanceToSquared(d.g.position) > SAI.hitR ** 2) continue;
      }
      d.hit.add(o); onHit(o, o.mesh.position.clone()); any = true;
    }
    return any;
  }

  _target(player, obstacles) {
    let best = null, bd = Infinity;
    for (const o of obstacles.list) {
      if (o.type !== 'foot' || o.done || o.flying || o.saiAimed) continue;
      const ds = o.s - player.s;
      if (ds < SAI.range[0] || ds > SAI.range[1]) continue;
      if (ds < bd) { bd = ds; best = o; }
    }
    return best;
  }

  // the wall's inward normal at {s, theta} (a soldier's or the rider's "up"); main sets upFn
  _up(o) { return this.upFn ? this.upFn(o) : this._up0; }
}
Daggers.prototype._up0 = new THREE.Vector3(0, 1, 0);
