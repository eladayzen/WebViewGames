// Enemy fire: red bolts that actually hit (shield damage), the pilots that get on your tail after a raid, and the
// deck turrets of the hover ships you are raiding.  Bolts fly in WORLD space and are aimed at where the glider will be if
// he keeps going straight -- so the way to dodge is to swing sideways after they fire, which is all the controls there are.
import * as THREE from 'three';
import { makeDrone } from './combat.js';
import { clamp } from './util.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
export const HIT_R = 2.5;

export class EnemyFire {
  constructor(scene, glowTex) {
    this.scene = scene; this.glow = glowTex;
    this.bolts = [];
    const geo = new THREE.BoxGeometry(0.34, 0.34, 5.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const gmat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff3a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(geo, mat); const g = new THREE.Sprite(gmat); g.scale.set(3.4, 3.4, 1); m.add(g); m.visible = false; scene.add(m);
      this.bolts.push({ m, on: false, v: new THREE.Vector3(), life: 0, dmg: 9 });
    }
    this.pursuers = []; this.turrets = []; this.warn = 0;
  }

  reset() {
    for (const b of this.bolts) { b.on = false; b.m.visible = false; }
    for (const p of this.pursuers) this.scene.remove(p.g);
    this.pursuers.length = 0; this.turrets.length = 0; this.warn = 0;
  }

  /** shoot a bolt from `from` toward where `target` will be (lead 0.7 of its velocity), at absolute speed `speed` */
  fire(from, target, vel, speed, dmg = 9, spreadX = 0) {
    const b = this.bolts.find((x) => !x.on); if (!b) return;
    _a.copy(target); _a.x += spreadX;
    const t0 = from.distanceTo(_a) / speed;
    _a.addScaledVector(vel, t0 * 0.7);
    b.v.subVectors(_a, from).normalize().multiplyScalar(speed);
    b.m.position.copy(from); _b.copy(from).add(b.v); b.m.lookAt(_b);
    b.on = true; b.life = 3.2; b.dmg = dmg; b.m.visible = true;
  }

  /** move the bolts, test them against the glider; onHit(bolt) for each that connects */
  update(dt, pos, onHit) {
    for (const b of this.bolts) {
      if (!b.on) continue;
      b.life -= dt;
      _a.copy(b.m.position); _b.copy(_a).addScaledVector(b.v, dt);
      // swept sphere: closest point on the segment a->b to the glider
      _c.subVectors(_b, _a); const l2 = _c.lengthSq() || 1e-6;
      const t = clamp(_d.subVectors(pos, _a).dot(_c) / l2, 0, 1);
      _c.multiplyScalar(t).add(_a);
      if (_c.distanceTo(pos) < HIT_R) { b.on = false; b.m.visible = false; onHit(b); continue; }
      b.m.position.copy(_b);
      if (b.life <= 0) { b.on = false; b.m.visible = false; }
    }
  }

  // ── pilots on your tail ──
  spawnPursuers(n, rnd) {
    for (let i = 0; i < n; i++) {
      const g = makeDrone(); g.scale.setScalar(2.5);
      g.userData.band.material.color.setHex(0xffb020); g.userData.body.material.color.setHex(0x7a2430); g.userData.body.material.emissive.setHex(0x3a0c14);
      this.scene.add(g);
      this.pursuers.push({ g, gap: 46 + i * 9, off: i === 0 ? -1 : 1, ph: rnd() * 6, lat: 0, cd: 1.1 + i * 0.9 + rnd(), tele: 0, burst: 0, bcd: 0 });
    }
  }
  /** c: { leg, s, lat, pos, vel, t, onFire } */
  updatePursuers(dt, c) {
    this.warn = Math.max(0, this.warn - dt * 2.5);
    for (const p of this.pursuers) {
      const ps = c.s - (p.gap + 8 * Math.sin(c.t * 0.9 + p.ph));
      const wantLat = c.lat * 0.55 + p.off * 8 * Math.sin(c.t * 1.3 + p.ph);
      p.lat += (wantLat - p.lat) * Math.min(1, dt * 1.8);
      const sc = clamp(ps, c.leg.sMin, c.leg.L);
      c.leg.at(sc, p.lat, _a); p.g.position.set(_a.x, c.leg.pathYAt(sc) + 1.6, _a.z);
      p.g.rotation.y = Math.PI - c.leg.hdgAt(sc); p.g.rotation.z = -(wantLat - p.lat) * 0.06;
      for (const r of p.g.userData.rotors) r.rotation.y += dt * 40;
      p.cd -= dt;
      if (p.tele > 0) {
        p.tele -= dt; this.warn = Math.max(this.warn, 1);
        p.g.userData.band.material.color.setHex(Math.sin(c.t * 40) > 0 ? 0xff2020 : 0xffffff);
        if (p.tele <= 0) { p.burst = 3; p.bcd = 0; p.g.userData.band.material.color.setHex(0xffb020); }
      } else if (p.burst > 0) {
        p.bcd -= dt;
        if (p.bcd <= 0) { p.bcd = 0.11; const k = 3 - p.burst; this.fire(p.g.position, c.pos, c.vel, 150, 9, (k - 1) * 2.8); p.burst--; c.onFire?.(p.g.position); if (p.burst === 0) p.cd = 1.7 + Math.random() * 1.2; }
      } else if (p.cd <= 0) p.tele = 0.6;
    }
  }
  clearPursuers() { for (const p of this.pursuers) this.scene.remove(p.g); this.pursuers.length = 0; }

  // ── deck turrets of the hover ships being raided ──
  /** c: { s, pos, vel, onFire(posWorld) } */
  updateTurrets(dt, c) {
    for (const t of this.turrets) {
      if (t.ship.dead) continue;
      const ahead = t.s - c.s;                      // turret is ahead of the glider by this many metres
      if (ahead > 185 || ahead < -4) continue;
      t.cd -= dt;
      if (t.tele > 0) { t.tele -= dt; if (t.tele <= 0) { this.fire(t.pos, c.pos, c.vel, 118, 8); c.onFire?.(t.pos); t.cd = 2.4 + Math.random() * 1.8; } }
      else if (t.cd <= 0) t.tele = 0.45;
    }
  }
}
