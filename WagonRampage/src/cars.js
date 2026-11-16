import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pointAt, yawAt, frameAt, GLOW } from './world.js';

// Car kinds. Lengths are what the car reads as on screen; Meshy exports every model 1.9 long
// with its nose on -X, so each is rescaled to its length and turned to face -Z.
export const KINDS = {
  wagon: { file: 'wagon', length: 4.9, mass: 2.2 },
  racer: { file: 'foot_racer', length: 4.3, mass: 1.0, hp: 60, tint: 0x7a4fd0, score: 100 },
  truck: { file: 'foot_truck', length: 6.8, mass: 3.4, hp: 210, tint: 0x5b4a78, score: 300 },
};

const loader = new GLTFLoader();
const _v = new THREE.Vector3(), _T = new THREE.Vector3(), _R = new THREE.Vector3();

export async function loadCarModels() {
  const out = {};
  await Promise.all(Object.entries(KINDS).map(async ([kind, k]) => {
    const g = await loader.loadAsync(`/models/${k.file}.glb`);
    const model = g.scene;
    model.rotation.y = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(model);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    const sc = k.length / size.z;
    model.scale.setScalar(sc);
    holder.updateMatrixWorld(true);
    box.setFromObject(holder);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
    holder.updateMatrixWorld(true);
    box.setFromObject(holder);
    const dims = box.getSize(new THREE.Vector3());
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.material.side = THREE.FrontSide;
      }
    });
    // roof height at the centre, for the emblem decal
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(holder, true)[0];
    out[kind] = { holder, dims, roofY: hit ? hit.point.y : dims.y };
  }));
  return out;
}

// Roof emblem: the Foot Clan symbol (Elad's file, ~/Documents/3d/icon), painted straight onto
// the roof. On the roof because the camera is above and behind:
// side livery never reads.
let emblemTex = null;
function emblemTexture() {
  if (emblemTex) return emblemTex;
  emblemTex = new THREE.TextureLoader().load('/ui/foot.png');
  emblemTex.colorSpace = THREE.SRGBColorSpace;
  emblemTex.anisotropy = 4;
  return emblemTex;
}

// body roll (radians). max 0.225 = the old roll at full sideways speed, which every lean hit.
// turn: share from how hard you're steering now; held: extra that builds over ~1.5 s of holding.
export const ROLL = { max: 0.225, vuFull: 12.5, turn: 0.09, held: 0.08, holdRate: 0.7, spring: 30, damp: 9 };

export class Car {
  constructor(kind, proto, scene) {
    this.kind = kind;
    this.k = KINDS[kind];
    this.group = new THREE.Group();     // placed on the street
    this.body = proto.holder.clone(true); // tilts and rolls inside it
    this.mats = [];
    this.body.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      if (this.k.tint) o.material.color.setHex(this.k.tint);
      o.material.emissive = new THREE.Color(0x000000);
      this.mats.push(o.material);
    });
    this.group.add(this.body);
    if (kind !== 'wagon') {
      // (the roof Foot emblem was taken off on request; emblemTexture() stays for reuse)
      this.buildTurret(proto);
    }
    this.L = proto.dims.z; this.W = proto.dims.x; this.H = proto.dims.y;
    // night dressing: underglow (Foot purple / wagon green), headlights, tail lights
    const wagon = kind === 'wagon';
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2.3, this.L * 1.45), new THREE.MeshBasicMaterial({
      map: wagon ? GLOW.green : GLOW.purple, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: wagon ? 0.35 : 0.5 }));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.05;
    this.group.add(this.glow);
    const lamp = (x, y, z, col, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); this.body.add(m); };
    const hy = this.H * (wagon ? 0.32 : 0.4);
    lamp(this.W * 0.3, hy, -this.L / 2 + 0.05, new THREE.Color(5, 4.6, 3.6), 0.13);
    lamp(-this.W * 0.3, hy, -this.L / 2 + 0.05, new THREE.Color(5, 4.6, 3.6), 0.13);
    lamp(this.W * 0.34, hy, this.L / 2 - 0.05, new THREE.Color(4, 0.25, 0.2), 0.1);
    lamp(-this.W * 0.34, hy, this.L / 2 - 0.05, new THREE.Color(4, 0.25, 0.2), 0.1);
    this.mass = this.k.mass;
    scene.add(this.group);
    this.reset();
  }

  // roof cannon at the back of the roof, barrel along +z (backwards, at the wagon). main.js
  // aims the head (yaw + pitch), shows the laser sight while it charges, and fires from .tip
  buildTurret(proto) {
    const sc = proto.dims.x / 2.2;
    const T = new THREE.Group();
    T.position.set(0, proto.roofY - 0.02, proto.dims.z * 0.18);
    T.scale.setScalar(sc);
    const gun = new THREE.MeshLambertMaterial({ color: 0x24232c });
    const plate = new THREE.MeshLambertMaterial({ color: 0x3d2160, emissive: 0x0d0418 });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 3.4) });
    const box = (w, h, d, m, x, y, z, rx = 0, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); return o; };
    // low base with a glowing purple ring
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.16, 6), gun); base.position.y = 0.08; T.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 6), glowMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; T.add(ring);
    const head = new THREE.Group(); head.position.y = 0.34; head.rotation.order = 'YXZ'; T.add(head);
    // armoured head: core, sloped front plate, side fins with glow strips, red sensor eye
    head.add(box(0.5, 0.26, 0.56, gun, 0, 0, -0.04));
    head.add(box(0.52, 0.06, 0.4, plate, 0, 0.13, 0.12, -0.45));
    for (const sx of [-1, 1]) {
      head.add(box(0.06, 0.3, 0.62, plate, sx * 0.29, 0.02, -0.02, 0, sx * 0.08));
      head.add(box(0.012, 0.04, 0.46, glowMat, sx * 0.325, 0.06, -0.02, 0, sx * 0.08));
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) }));
    eye.position.set(0.14, 0.17, 0.2); head.add(eye);
    // twin barrels with muzzle brakes; both muzzles heat up together
    const barrel = new THREE.Group(); head.add(barrel);
    const muzzleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.1, 0.5) });
    for (const x of [-0.11, 0.11]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.95, 8), gun);
      tube.rotation.x = Math.PI / 2; tube.position.set(x, 0, 0.62); barrel.add(tube);
      barrel.add(box(0.15, 0.1, 0.14, plate, x, 0, 1.08));
      const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.022, 6, 12), muzzleMat); muzzle.position.set(x, 0, 1.16); barrel.add(muzzle);
    }
    const tip = new THREE.Object3D(); tip.position.z = 1.22; barrel.add(tip);
    // laser sight: unit length along +z, stretched to the wagon each frame
    const laserGeo = new THREE.BoxGeometry(0.035, 0.035, 1); laserGeo.translate(0, 0, 0.5);
    const laser = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.3, 2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    laser.position.z = 1.22; laser.visible = false; laser.frustumCulled = false; barrel.add(laser);
    T.traverse((o) => { if (o.isMesh && o !== laser) o.castShadow = true; });
    this.body.add(T);
    this.turret = { root: T, head, barrel, tip, laser, muzzleMat, sc, recoil: 0 };
  }

  reset() {
    this.s = 0; this.u = 0; this.vs = 0; this.vu = 0;
    this.hp = this.maxHp = this.k.hp || 1;
    this.alive = true; this.active = false;
    this.flash = 0; this.charge = 0; this.tilt = 0; this.roll = 0; this.bounce = 0;
    this.rollV = 0; this.hold = 0; this.rollPush = 0;
    this.wreck = null; this.ai = null; this.lastHitBy = 0;
    this.group.visible = false;
    if (this.glow) this.glow.visible = true;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    for (const m of this.mats) { m.emissive.setHex(0); m.color.setHex(this.k.tint || 0xffffff); }
    if (this.decal) this.decal.material.color.setHex(0xffffff);
    if (this.turret) { this.turret.laser.visible = false; this.turret.recoil = 0; this.turret.head.rotation.set(0, 0, 0); }
  }

  // place on the street from (s, u) — yaw follows the road, plus a steer angle from lateral speed
  place(dt) {
    pointAt(this.s, this.u, this.group.position);
    const steer = Math.atan2(-this.vu, Math.max(4, this.vs)) * 0.9;
    this.group.rotation.set(0, yawAt(this.s) + steer, 0);
    // body roll into lateral moves, a little nose dip on hits
    // a sprung chassis: small moves barely lean it; the roll grows with how hard the turn is
    // (squared, so a nudge is ~nothing) and with how long it's held, plus whatever the game
    // adds (rollPush: shoving into a car). ROLL.max is the old always-on angle, now the ceiling.
    const turn = Math.max(-1, Math.min(1, this.vu / ROLL.vuFull));
    const hard = Math.sign(turn) * turn * turn;
    this.hold = (this.hold || 0) + (hard - (this.hold || 0)) * Math.min(1, dt * ROLL.holdRate);
    this.rollPush = (this.rollPush || 0) * Math.max(0, 1 - dt * 5);
    const want = Math.max(-ROLL.max, Math.min(ROLL.max, -(hard * ROLL.turn + this.hold * ROLL.held + this.rollPush)));
    this.rollV = (this.rollV || 0) + ((want - this.roll) * ROLL.spring - this.rollV * ROLL.damp) * dt;
    this.roll += this.rollV * dt;
    this.bounce = Math.max(0, this.bounce - dt * 3);
    this.body.rotation.z = this.roll;
    this.body.position.y = Math.sin(this.bounce * 18) * this.bounce * 0.12;
    this.flash = Math.max(0, this.flash - dt * 6);
    const f = this.flash;
    // hit flash: a hot glow, not a white-out — the car has to stay readable through it
    for (const m of this.mats) m.emissive.setRGB(f * 0.42, f * 0.22, f * 0.12);
    // the charge reads on the cannon now: muzzle heats up, barrel kicks back on the shot
    const T = this.turret;
    if (T) {
      const c = this.alive ? this.charge || 0 : 0;
      const hot = c * (0.75 + 0.25 * Math.sin(performance.now() * 0.04));
      T.muzzleMat.color.setRGB(0.6 + hot * 4, 0.1 + hot * 0.5, 0.5 + hot * 3);
      T.recoil = Math.max(0, T.recoil - dt * 4);
      T.barrel.position.z = -T.recoil * 0.35;
      if (!this.alive) T.laser.visible = false;
    }
  }

  // the car is out of the street's coordinate system and flying
  startWreck(kick) {
    frameAt(this.s, _T, _R);
    const p = this.group.position.clone();
    const v = new THREE.Vector3().addScaledVector(_T, this.vs * 0.8).addScaledVector(_R, this.vu + kick.u);
    v.y = kick.up;
    this.wreck = { p, v, av: new THREE.Vector3((Math.random() - 0.5) * kick.spin, (Math.random() - 0.5) * kick.spin * 0.6, (Math.random() - 0.5) * kick.spin), t: 0, landed: 0 };
    this.alive = false;
    this.glow.visible = false;
    for (const m of this.mats) m.color.multiplyScalar(0.35);
    if (this.decal) this.decal.material.color.setHex(0x444444);
  }

  stepWreck(dt) {
    const w = this.wreck;
    w.t += dt;
    w.v.y -= 24 * dt;
    w.p.addScaledVector(w.v, dt);
    if (w.p.y < 0) {
      w.p.y = 0;
      if (w.v.y < -3) { w.v.y *= -0.32; w.landed++; } else w.v.y = 0;
      w.v.x *= 0.7; w.v.z *= 0.7; w.av.multiplyScalar(0.6);
    }
    this.group.position.copy(w.p);
    this.group.rotation.x += w.av.x * dt;
    this.group.rotation.y += w.av.y * dt;
    this.group.rotation.z += w.av.z * dt;
    return w.t;
  }
}
