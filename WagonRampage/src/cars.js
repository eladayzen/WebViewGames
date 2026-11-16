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
      const w = Math.min(proto.dims.x, proto.dims.z) * 0.31;
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(w, w),
        // lit like the paint around it, so it reads as painted on rather than a glowing sticker
        new THREE.MeshLambertMaterial({ map: emblemTexture(), color: 0xffffff, transparent: true, alphaTest: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      decal.rotation.x = -Math.PI / 2;
      decal.position.y = proto.roofY + 0.04;
      this.body.add(decal);
      this.decal = decal;
    }
    this.L = proto.dims.z; this.W = proto.dims.x; this.H = proto.dims.y;
    // night dressing: underglow (Foot purple / wagon green), headlights, tail lights
    const wagon = kind === 'wagon';
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2.3, this.L * 1.45), new THREE.MeshBasicMaterial({
      map: wagon ? GLOW.green : GLOW.purple, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: wagon ? 0.55 : 0.9 }));
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

  reset() {
    this.s = 0; this.u = 0; this.vs = 0; this.vu = 0;
    this.hp = this.maxHp = this.k.hp || 1;
    this.alive = true; this.active = false;
    this.flash = 0; this.charge = 0; this.tilt = 0; this.roll = 0; this.bounce = 0;
    this.wreck = null; this.ai = null; this.lastHitBy = 0;
    this.group.visible = false;
    if (this.glow) this.glow.visible = true;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    for (const m of this.mats) { m.emissive.setHex(0); m.color.setHex(this.k.tint || 0xffffff); }
    if (this.decal) this.decal.material.color.setHex(0xffffff);
  }

  // place on the street from (s, u) — yaw follows the road, plus a steer angle from lateral speed
  place(dt) {
    pointAt(this.s, this.u, this.group.position);
    const steer = Math.atan2(-this.vu, Math.max(4, this.vs)) * 0.9;
    this.group.rotation.set(0, yawAt(this.s) + steer, 0);
    // body roll into lateral moves, a little nose dip on hits
    this.roll += ((-this.vu * 0.018) - this.roll) * Math.min(1, dt * 8);
    this.bounce = Math.max(0, this.bounce - dt * 3);
    this.body.rotation.z = this.roll;
    this.body.position.y = Math.sin(this.bounce * 18) * this.bounce * 0.12;
    this.flash = Math.max(0, this.flash - dt * 6);
    const f = this.flash;
    // hit flash: a hot glow, not a white-out — the car has to stay readable through it
    const c = this.charge || 0, pulse = c > 0 ? c * (0.6 + 0.4 * Math.sin(performance.now() * 0.03)) : 0;
    for (const m of this.mats) m.emissive.setRGB(f * 0.42 + pulse * 0.9, f * 0.22 + pulse * 0.1, f * 0.12 + pulse * 1.3);
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
