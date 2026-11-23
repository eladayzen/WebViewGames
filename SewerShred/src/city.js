// OPEN TOP city (Elad 2026-11-22): "cut the pipe in half … use some matte
// painting … classic city … something moving fast for the illusion of speed,
// and in the background big far-away assets of the city and sky."
//
// Three depths, each moving at its own rate:
//   1. SKY + far skyline: one painted panorama on a huge arc that rides WITH the
//      camera (infinitely far: it never gets closer, it only pans as the pipe bends).
//   2. BUILDINGS: individual painted towers (a 4-up atlas) stood beside the trench
//      20–110 m out, recycled as you pass — they slide by slowly and fog into the
//      painted skyline, which is what sells the distance.
//   3. STREETLIGHTS on the rims every 18 m, alternating sides — close, so they
//      whip past. That is the speed read the ceiling lamps gave in the closed pipe.
import * as THREE from 'three';
import { R, frameAt, pointAt } from './track.js';

// atlas rects in px of the 1024×596 city_bldg.png: x, y, w, h
const BLDG = [[0, 0, 245, 596], [248, 123, 255, 473], [507, 121, 215, 476], [725, 238, 296, 359]];
const ATLAS_W = 1024, ATLAS_H = 596;
const N_BLDG = 44, N_LIGHT = 16;
const LIGHT_SPACING = 18;
const AHEAD = 250;                 // metres of city kept in front (fog eats the rest)
const SKY_R = 330;

export const CITY_FOG = { color: 0xb4c8d8, near: 40, far: 245 };   // the haze in the painting's skyline
export const CITY_HEMI = [0xfff6e6, 0x8a96a0];
const DAY_FOG = { ...CITY_FOG }, DAY_HEMI = [...CITY_HEMI];
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const rand = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class City {
  constructor(scene, tex) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.f = frameAt(0);

    // ── 1. sky ── a 220° arc centred on -Z (the pipe always runs roughly -Z)
    tex.sky.colorSpace = THREE.SRGBColorSpace;
    tex.sky.wrapS = THREE.RepeatWrapping; tex.sky.repeat.x = -1; tex.sky.offset.x = 1;   // seen from inside: un-mirror
    const arc = (220 * Math.PI) / 180;
    const skyH = (SKY_R * arc) / (2048 / 869);          // keep the painting's aspect
    const skyGeo = new THREE.CylinderGeometry(SKY_R, SKY_R, skyH, 48, 1, true, Math.PI - arc / 2, arc);
    skyGeo.translate(0, skyH / 2, 0);                   // base at y = 0
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    // ── 2. buildings ──
    tex.bldg.colorSpace = THREE.SRGBColorSpace;
    tex.bldg.anisotropy = 4;
    const bMat = new THREE.MeshBasicMaterial({ map: tex.bldg, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xe8ecf0 });
    this.bMat = bMat;
    this.bGeos = BLDG.map(([x, y, w, h]) => {
      const g = new THREE.PlaneGeometry(w / h, 1);       // 1 m tall, true aspect; scaled per building
      g.translate(0, 0.5, 0);                            // origin at its base
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (x + uv.getX(i) * w) / ATLAS_W, 1 - (y + (1 - uv.getY(i)) * h) / ATLAS_H);
      }
      return g;
    });
    this.bldgs = [];
    for (let i = 0; i < N_BLDG; i++) {
      const m = new THREE.Mesh(this.bGeos[0], bMat);
      m.userData.s = -1e9;
      this.group.add(m);
      this.bldgs.push(m);
    }

    // ── 3. rim streetlights ── NYC green pole, arm reaching over the trench
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c4a3c });
    const ink = new THREE.MeshBasicMaterial({ color: 0x101214, side: THREE.BackSide });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
    const pole = new THREE.CylinderGeometry(0.09, 0.14, 7, 8).translate(0, 3.5, 0);
    const arm = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6).rotateZ(Math.PI / 2).translate(1.0, 7, 0);
    const head = new THREE.BoxGeometry(0.7, 0.22, 0.4).translate(2.0, 6.85, 0);
    const bulb = new THREE.BoxGeometry(0.5, 0.06, 0.28).translate(2.0, 6.72, 0);
    this.lights = [];
    for (let i = 0; i < N_LIGHT; i++) {
      const g = new THREE.Group();
      for (const geo of [pole, arm, head]) {
        g.add(new THREE.Mesh(geo, poleMat));
        const o = new THREE.Mesh(geo, ink); o.scale.setScalar(1.08); g.add(o);
      }
      g.add(new THREE.Mesh(bulb, bulbMat));
      // a pool of light under the lamp, only at night (setNight)
      const glow = new THREE.Sprite(this.glowMat ||= new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      glow.position.set(2.0, 6.5, 0); glow.scale.set(6, 6, 1); glow.visible = false; g.add(glow);
      g.userData.glow = glow;
      g.userData.s = -1e9;
      this.group.add(g);
      this.lights.push(g);
    }
    this._m = new THREE.Matrix4(); this._x = new THREE.Vector3(); this._z = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.reset();
  }

  setOn(on) { this.group.visible = !!on; }

  /** NIGHT CITY (Elad 2026-11-23: "a different hour of day — twilight or night"): the
   *  same painting and towers tinted to dusk, a darker fog/light, the streetlights lit.
   *  Mutates CITY_FOG / CITY_HEMI, which main reads when it switches the city on. */
  setNight(on) {
    this.night = !!on;
    this.sky.material.color.setHex(on ? 0x8a76c4 : 0xffffff);
    this.bMat.color.setHex(on ? 0x6e6aa4 : 0xe8ecf0);
    // the ride stays lit (Elad: "lower half too dark"): the dusk lives in the sky,
    // the towers and a far-off fog; the trench keeps a near-day light, cooled a touch
    Object.assign(CITY_FOG, on ? { color: 0x4a4280, near: 70, far: 260 } : DAY_FOG);
    CITY_HEMI[0] = on ? 0xf6f0ff : DAY_HEMI[0]; CITY_HEMI[1] = on ? 0x8c88b8 : DAY_HEMI[1];
    for (const l of this.lights) l.userData.glow.visible = this.night;
  }
  get on() { return this.group.visible; }

  reset() {
    this.nextB = -20; this.nextL = 4; this.lightSide = 1;
    for (const b of this.bldgs) b.userData.s = -1e9;
    for (const l of this.lights) { l.userData.s = -1e9; l.visible = false; }
  }

  update(playerS, camera) {
    if (!this.group.visible) return;
    // the sky rides with the camera, base well under the rims
    this.sky.position.set(camera.position.x, camera.position.y - 70, camera.position.z);

    // buildings: oldest one behind you moves to the front
    while (this.nextB < playerS + AHEAD) {
      const b = this.bldgs.reduce((a, c) => (a.userData.s < c.userData.s ? a : c));
      if (b.userData.s > playerS - 15) break;
      const s = this.nextB, r1 = rand(s), r2 = rand(s + 1.7), r3 = rand(s + 3.1);
      const side = r1 < 0.5 ? -1 : 1;
      const out = R + 38 + r2 * 120;                     // well back from the trench: the sky has to show
      const f = frameAt(s, this.f);
      const kind = Math.floor(r3 * BLDG.length);
      b.geometry = this.bGeos[kind];
      const h = (kind === 3 ? 30 : 45) + rand(s + 5.3) * 35 + out * 0.35;   // farther = taller, so they still clear the rim
      b.scale.setScalar(h);
      b.position.copy(f.C).addScaledVector(f.Rt, side * out);
      b.position.y = f.C.y - 18;                          // feet hidden down behind the trench wall
      b.userData.s = s;
      b.visible = true;
      this.nextB += 8 + rand(s + 7.7) * 10;
    }
    // face the camera (yaw only), so they never go edge-on as they pass
    for (const b of this.bldgs) b.rotation.y = Math.atan2(camera.position.x - b.position.x, camera.position.z - b.position.z);

    // streetlights on alternating rims
    while (this.nextL < playerS + 200) {
      const l = this.lights.reduce((a, c) => (a.userData.s < c.userData.s ? a : c));
      if (l.userData.s > playerS - 10) break;
      const s = this.nextL, side = (this.lightSide = -this.lightSide);
      const f = frameAt(s, this.f);
      pointAt(s, side * Math.PI / 2, R + 0.15, l.position, f);
      // local +Y = up (frame U), +X = the arm, reaching in toward the axis
      this._x.copy(f.Rt).multiplyScalar(-side);
      this._z.crossVectors(this._x, f.U).normalize();
      this._m.makeBasis(this._x, f.U, this._z);
      l.quaternion.setFromRotationMatrix(this._m);
      l.userData.s = s; l.visible = true;
      this.nextL += LIGHT_SPACING;
    }
  }
}
