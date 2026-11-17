import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pointAt, yawAt, frameAt, GLOW } from './world.js';

// Car kinds. Lengths are what the car reads as on screen; Meshy exports every model 1.9 long
// with its nose on -X, so each is rescaled to its length and turned to face -Z.
// Foot car look, live from the dev panel (main.js applyLook writes it): body tint per kind,
// PBR roughness/metalness, and a constant self-glow so they read against the night
export const FOOT_LOOK = {
  tint: { racer: new THREE.Color(0x7a4fd0), truck: new THREE.Color(0x5b4a78) },
  rough: 0.6, metal: 0, glow: new THREE.Color(0x000000), stripe: 1,
  rim: { value: new THREE.Color(0xb46cff).multiplyScalar(1.6) },   // fresnel edge glow (shared uniform)
};
// Foot paint: standard PBR plus a glowing fresnel rim, so the cars' outlines read at night
function addRim(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = FOOT_LOOK.rim;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uRim * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.2);');
  };
  m.customProgramCacheKey = () => 'footRim';
}

export const KINDS = {
  wagon: { file: 'wagon', length: 4.9, mass: 2.2 },
  racer: { file: 'foot_racer', length: 4.3, mass: 1.0, hp: 120, tint: 0x7a4fd0, score: 100 },
  truck: { file: 'foot_truck', length: 6.8, mass: 3.4, hp: 210, tint: 0x5b4a78, score: 300 },
};

const loader = new GLTFLoader();
const _v = new THREE.Vector3(), _T = new THREE.Vector3(), _R = new THREE.Vector3();

// The Meshy cars are single meshes, so their wheels can't turn. Each gets spinning covers:
// a treaded tyre plus a spoked rim, sitting over the model's own wheel. Positions come from the
// tyre contact patches (the only vertices touching the ground); radii from a circle fit of each
// model's tyre outline (tools/wheel-probe.mjs). A contact patch longer than ~1.2 m is a double
// axle (the truck's rear) and gets two wheels.
const WHEEL_R = { wagon: 0.55, racer: 0.57, truck: 0.74 };
const WHEEL_W = { wagon: 0.4, racer: 0.38, truck: 0.46 };
function findWheels(holder, r) {
  const inv = new THREE.Matrix4(), v = new THREE.Vector3(), pts = [];
  holder.updateMatrixWorld(true); inv.copy(holder.matrixWorld).invert();
  holder.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position, m = inv.clone().multiply(o.matrixWorld);
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m); if (v.y < 0.06) pts.push([v.x, v.z]); }
  });
  const out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const q = pts.filter(([x, z]) => Math.sign(x) === sx && Math.sign(z) === sz);
    if (!q.length) continue;
    const zs = q.map((p) => p[1]), z0 = Math.min(...zs), z1 = Math.max(...zs), xo = Math.max(...q.map((p) => Math.abs(p[0])));
    const half = Math.sqrt(2 * r * 0.06);   // contact half-length of a tyre of radius r at 6 cm
    const zc = z1 - z0 > 1.2 ? [z0 + half, z1 - half] : [(z0 + z1) / 2];
    for (const z of zc) out.push({ sx, x: sx * xo, z, r });
  }
  return out;
}
let wheelTex = null;
function wheelTextures() {
  if (wheelTex) return wheelTex;
  const tread = document.createElement('canvas'); tread.width = 256; tread.height = 32;
  let x = tread.getContext('2d');
  x.fillStyle = '#15151a'; x.fillRect(0, 0, 256, 32);
  x.fillStyle = '#3a3a44';
  for (let i = 0; i < 16; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 7, 16); x.lineTo(i * 16, 32); x.lineTo(i * 16 + 4, 32); x.lineTo(i * 16 + 11, 16); x.lineTo(i * 16 + 4, 0); x.fill(); }
  const rim = document.createElement('canvas'); rim.width = rim.height = 128;
  x = rim.getContext('2d');
  x.fillStyle = '#121216'; x.beginPath(); x.arc(64, 64, 64, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#8d93a0'; x.beginPath(); x.arc(64, 64, 42, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#2a2c33';
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, 38, a, a + 0.62); x.fill(); }
  x.fillStyle = '#c4c9d4'; x.beginPath(); x.arc(64, 64, 12, 0, Math.PI * 2); x.fill();
  const t1 = new THREE.CanvasTexture(tread), t2 = new THREE.CanvasTexture(rim);
  t1.colorSpace = t2.colorSpace = THREE.SRGBColorSpace; t1.wrapS = THREE.RepeatWrapping;
  wheelTex = { tread: t1, rim: t2 };
  return wheelTex;
}

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
    out[kind] = { holder, dims, roofY: hit ? hit.point.y : dims.y, wheels: findWheels(holder, WHEEL_R[kind]) };
  }));
  return out;
}

// Roof emblem: the Foot Clan symbol (Elad's file, ~/Documents/3d/icon), painted straight onto
// the roof. On the roof because the camera is above and behind:
// side livery never reads.
let emblemTex = null;
function emblemTexture() {
  if (emblemTex) return emblemTex;
  emblemTex = new THREE.TextureLoader().load('/ui/foot.webp');
  emblemTex.colorSpace = THREE.SRGBColorSpace;
  emblemTex.anisotropy = 4;
  return emblemTex;
}

// body roll (radians). max 0.225 = the old roll at full sideways speed, which every lean hit.
// turn: share from how hard you're steering now; held: extra that builds over ~1.5 s of holding.
export const ROLL = { max: 0.225, vuFull: 12.5, turn: 0.09, held: 0.08, holdRate: 0.7, spring: 30, damp: 9 };

const _black = new THREE.Color(0, 0, 0);

export class Car {
  // opts.friendly: an ally on the Foot's model (April's van) — its own paint, no roof cannon,
  // blue underglow, and turn signals (this.signal = -1 / 0 / 1) so the player can follow it
  constructor(kind, proto, scene, opts = {}) {
    this.kind = kind;
    this.k = KINDS[kind];
    this.friendly = !!opts.friendly;
    this.paint = opts.paint ? new THREE.Color(opts.paint) : null;
    this.group = new THREE.Group();     // placed on the street
    this.body = proto.holder.clone(true); // tilts and rolls inside it
    this.mats = [];
    this.body.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      if (this.paint) o.material.color.copy(this.paint);
      else if (this.k.tint) o.material.color.setHex(this.k.tint);
      o.material.emissive = new THREE.Color(0x000000);
      if (kind !== 'wagon' && !this.friendly) addRim(o.material);
      this.mats.push(o.material);
    });
    this.group.add(this.body);
    if (kind !== 'wagon' && !this.friendly) {
      // (the roof Foot emblem was taken off on request; emblemTexture() stays for reuse)
      this.buildTurret(proto);
    }
    this.L = proto.dims.z; this.W = proto.dims.x; this.H = proto.dims.y;
    // night dressing: underglow (Foot purple / wagon green), headlights, tail lights
    const wagon = kind === 'wagon';
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2.3, this.L * 1.45), new THREE.MeshBasicMaterial({
      map: wagon ? GLOW.green : this.friendly ? GLOW.blue : GLOW.purple, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: wagon ? 0.35 : 0.5 }));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.05;
    this.group.add(this.glow);
    const lamp = (x, y, z, col, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); this.body.add(m); };
    const hy = this.H * (wagon ? 0.32 : 0.4);
    lamp(this.W * 0.3, hy, -this.L / 2 + 0.05, new THREE.Color(5, 4.6, 3.6), 0.13);
    lamp(-this.W * 0.3, hy, -this.L / 2 + 0.05, new THREE.Color(5, 4.6, 3.6), 0.13);
    lamp(this.W * 0.34, hy, this.L / 2 - 0.05, new THREE.Color(4, 0.25, 0.2), 0.1);
    lamp(-this.W * 0.34, hy, this.L / 2 - 0.05, new THREE.Color(4, 0.25, 0.2), 0.1);
    if (this.friendly) {
      // turn signals: big amber blinkers on both rear corners and both front corners
      this.blink = { [-1]: [], [1]: [] };
      const amber = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.12, 0) });
      for (const side of [-1, 1]) {
        const mat = amber();
        for (const z of [-this.L / 2 + 0.1, this.L / 2 - 0.1]) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat);
          m.position.set(side * this.W * 0.47, hy + 0.25, z); this.body.add(m);
        }
        this.blink[side].push(mat);
      }
      this.signal = 0;
    }
    // spinning wheel covers (see findWheels)
    this.wheels = [];
    const T = wheelTextures(), ww = WHEEL_W[kind] || 0.4;
    const tyreMat = new THREE.MeshLambertMaterial({ map: T.tread }), rimMat = new THREE.MeshLambertMaterial({ map: T.rim });
    for (const w of proto.wheels || []) {
      const g = new THREE.Group();
      g.position.set(w.x - w.sx * (ww / 2 - 0.03), w.r, w.z);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(w.r * 1.03, w.r * 1.03, ww, 24, 1, true), tyreMat);
      tyre.rotation.z = Math.PI / 2; g.add(tyre);
      for (const f of [-1, 1]) {   // a rim on both faces, so the inner side is closed too
        const disc = new THREE.Mesh(new THREE.CircleGeometry(w.r * 1.03, 24), rimMat);
        disc.position.x = f * ww / 2; disc.rotation.y = f * Math.PI / 2; g.add(disc);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.body.add(g); this.wheels.push({ g, r: w.r });
    }
    this.wheelA = 0;
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
    // same PBR paint as the body (tint / roughness / metalness from FOOT_LOOK, set in applyLook);
    // the armour plates a darker shade of it
    const gun = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const plate = new THREE.MeshStandardMaterial({ color: 0xffffff });
    gun.userData.shade = 1; plate.userData.shade = 0.55;
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 3.4) });
    this.tmats = [gun, plate];
    addRim(gun); addRim(plate);
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
    this.turret = { root: T, head, barrel, tip, laser, muzzleMat, glowMat, sc, recoil: 0 };
  }

  // body colour / roughness / metalness from FOOT_LOOK (Foot cars only), and the glow strips
  applyLook() {
    if (this.kind === 'wagon') { for (const m of this.mats) m.color.setHex(0xffffff); return; }
    if (this.friendly) { for (const m of this.mats) m.color.copy(this.paint).multiplyScalar(this.alive ? 1 : 0.35); return; }
    const t = this.paint || FOOT_LOOK.tint[this.kind];   // (the level-4 boss has its own paint)
    for (const m of this.mats) {
      if (this.alive) m.color.copy(t); else m.color.copy(t).multiplyScalar(0.35);
      if ('roughness' in m) { m.roughness = FOOT_LOOK.rough; m.metalness = FOOT_LOOK.metal; }
    }
    if (this.tmats) for (const m of this.tmats) {
      m.color.copy(t).multiplyScalar(m.userData.shade * (this.alive ? 1 : 0.35));
      m.roughness = FOOT_LOOK.rough; m.metalness = FOOT_LOOK.metal;
    }
    if (this.turret) this.turret.glowMat.color.setRGB(2.2 * FOOT_LOOK.stripe, 0.35 * FOOT_LOOK.stripe, 3.4 * FOOT_LOOK.stripe);
  }

  reset() {
    this.s = 0; this.u = 0; this.vs = 0; this.vu = 0;
    this.hp = this.maxHp = this.k.hp || 1;
    this.alive = true; this.active = false;
    this.flash = 0; this.charge = 0; this.tilt = 0; this.roll = 0; this.bounce = 0;
    this.rollV = 0; this.hold = 0; this.rollPush = 0;
    this.tether = false; this.emp = 0;
    this.wreck = null; this.ai = null; this.lastHitBy = 0;
    this.group.visible = false;
    if (this.glow) this.glow.visible = true;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.applyLook();
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
    // wheels roll with the car's speed, capped at ~2.5 turns/s: a true 10 turns/s at chase
    // speed strobes at 60 fps and reads as standing still
    if (this.wheels.length) {
      this.wheelA -= Math.min(this.vs / this.wheels[0].r, 16) * dt;
      for (const w of this.wheels) w.g.rotation.x = this.wheelA;
    }
    this.body.position.y = Math.sin(this.bounce * 18) * this.bounce * 0.12;
    this.flash = Math.max(0, this.flash - dt * 6);
    const f = this.flash;
    // hit flash: a hot glow, not a white-out — the car has to stay readable through it
    const foot = this.kind !== 'wagon' && !this.friendly, g = foot ? FOOT_LOOK.glow : _black;
    if (this.blink) {
      const on = Math.floor(performance.now() / 260) % 2 === 0;
      for (const side of [-1, 1]) for (const m of this.blink[side]) {
        const lit = this.signal === side && on;
        m.color.setRGB(lit ? 6 : 0.25, lit ? 3 : 0.12, 0);
      }
    }
    for (const m of this.mats) m.emissive.setRGB(g.r + f * 0.42, g.g + f * 0.22, g.b + f * 0.12);
    if (this.tmats) for (const m of this.tmats) m.emissive.setRGB(g.r + f * 0.42, g.g + f * 0.22, g.b + f * 0.12);   // same glow + hit flash as the body
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
    if (this.tmats) for (const m of this.tmats) m.color.multiplyScalar(0.35);
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
