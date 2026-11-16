// Side junctions: every so often a smaller pipe joins the sewer high on the
// wall and pours a stream of water down into it (Elad 2026-11-16: "a small
// waterfall with water coming in, like a sewer small junction").
//
// Scenery only — no collision. The stub is real geometry wearing the painted
// pipe texture; the stream is a tube of the painted water texture, scrolled,
// that follows an actual gravity arc from the mouth's lip to wherever it meets
// the pipe wall, and the game puts foam on that landing point.
import * as THREE from 'three';
import { R, frameAt, pointAt, wallDir, wallQuat } from './track.js';

const POOL = 3;
const MOUTH_R = 1.15;      // inner radius of the side pipe
const STUB = 0.9;          // how far it sticks out of the wall
const AHEAD = 150;         // spawn distance in front of the rider
const GAP = [140, 260];    // metres between junctions
const FIRST = 120;
const G = 9.8;

export class Junctions {
  constructor(scene, tex) {
    this.scene = scene;
    const pipeTex = tex.pipe.clone();
    pipeTex.wrapS = pipeTex.wrapT = THREE.RepeatWrapping;
    pipeTex.repeat.set(3, 1);
    pipeTex.colorSpace = THREE.SRGBColorSpace;
    pipeTex.needsUpdate = true;
    this.stubMat = new THREE.MeshLambertMaterial({ map: pipeTex, color: 0x5d6b62, emissive: 0x070908, side: THREE.DoubleSide });
    this.rimMat = new THREE.MeshLambertMaterial({ map: pipeTex, color: 0x47524b, emissive: 0x050605 });
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0x050706 });
    const waterTex = tex.sewage.clone();   // same painted sludge as the river
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(2, 3);
    waterTex.colorSpace = THREE.SRGBColorSpace;
    waterTex.needsUpdate = true;
    this.waterTex = waterTex;
    this.waterMat = new THREE.MeshLambertMaterial({
      map: waterTex, color: 0xd6e8b0, emissive: 0x2a3420, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    });
    // a brighter, thinner core so the stream reads as moving water, not a pipe
    const coreTex = tex.sewage.clone();
    coreTex.wrapS = coreTex.wrapT = THREE.RepeatWrapping;
    coreTex.repeat.set(1, 5);
    coreTex.colorSpace = THREE.SRGBColorSpace;
    coreTex.needsUpdate = true;
    this.coreTex = coreTex;
    this.coreMat = new THREE.MeshBasicMaterial({
      map: coreTex, color: 0x8a9a6a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    });

    this.stubGeo = new THREE.CylinderGeometry(MOUTH_R, MOUTH_R, STUB + 0.3, 24, 1, true);
    this.rimGeo = new THREE.TorusGeometry(MOUTH_R + 0.06, 0.13, 8, 28);
    this.holeGeo = new THREE.CircleGeometry(MOUTH_R, 24);

    this.poolMat = new THREE.MeshBasicMaterial({ map: makeFoamTexture(), color: 0x9aa682, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    this.poolGeo = new THREE.CircleGeometry(1.9, 28);
    this.mistMat = new THREE.SpriteMaterial({ map: makeFoamTexture(), color: 0x6d7a58, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    this.items = [];
    for (let i = 0; i < POOL; i++) {
      const g = new THREE.Group();
      const stub = new THREE.Mesh(this.stubGeo, this.stubMat);
      stub.position.y = (STUB - 0.3) / 2;          // from 0.3 inside the wall to STUB out
      const rim = new THREE.Mesh(this.rimGeo, this.rimMat);
      rim.rotation.x = Math.PI / 2; rim.position.y = STUB;
      const hole = new THREE.Mesh(this.holeGeo, this.holeMat);
      hole.rotation.x = -Math.PI / 2; hole.position.y = 0.04;
      g.add(stub, rim, hole);
      g.visible = false;
      scene.add(g);
      const pool = new THREE.Mesh(this.poolGeo, this.poolMat); pool.visible = false; scene.add(pool);
      const mist = new THREE.Sprite(this.mistMat); mist.scale.setScalar(4.5); mist.visible = false; scene.add(mist);
      this.items.push({ pool, mist, group: g, stream: null, core: null, s: -1e9, theta: 0, land: new THREE.Vector3(), landUp: new THREE.Vector3(), on: false });
    }
    this.nextS = FIRST;
  }

  reset() {
    for (const it of this.items) { it.on = false; it.group.visible = it.pool.visible = it.mist.visible = false; this._dropStream(it); }
    this.nextS = FIRST;
  }

  /** Active junctions near the rider: [{ land, landUp, ds }] for splash FX. */
  update(dt, playerS) {
    this.waterTex.offset.y += dt * 1.6;
    this.coreTex.offset.y += dt * 2.6;
    while (this.nextS < playerS + AHEAD) {
      const free = this.items.find((it) => !it.on);
      if (free) this._place(free, this.nextS);
      this.nextS += GAP[0] + Math.random() * (GAP[1] - GAP[0]);
    }
    const out = [];
    for (const it of this.items) {
      if (!it.on) continue;
      const ds = it.s - playerS;
      if (ds < -25) { it.on = false; it.group.visible = it.pool.visible = it.mist.visible = false; this._dropStream(it); continue; }
      it.pool.rotation.z += dt * 0.8;
      const pulse = 1 + Math.sin(performance.now() * 0.009 + it.s) * 0.06;
      it.pool.scale.setScalar(pulse);
      out.push({ land: it.land, landUp: it.landUp, ds, s: it.s });
    }
    return out;
  }

  _place(it, s) {
    // high on either wall: 95°–125° from the floor, so it pours across the wall
    const side = Math.random() < 0.5 ? -1 : 1;
    const theta = side * (1.45 + Math.random() * 0.45);
    const f = frameAt(s);
    pointAt(s, theta, R - 0.02, it.group.position, f);
    wallQuat(f, theta, it.group.quaternion);
    it.group.visible = true;
    it.s = s; it.theta = theta; it.on = true;
    this._buildStream(it, f, theta);
  }

  _buildStream(it, f, theta) {
    this._dropStream(it);
    const inward = wallDir(f, theta, new THREE.Vector3()).negate();
    // start at the lip: just out of the mouth, on its lower edge
    const down = new THREE.Vector3(0, -1, 0);
    const lowEdge = down.clone().addScaledVector(inward, -down.dot(inward)).normalize();
    const p0 = it.group.position.clone().addScaledVector(inward, STUB + 0.05).addScaledVector(lowEdge, MOUTH_R * 0.55);
    const v0 = inward.clone().multiplyScalar(3.6);
    const pts = [p0.clone()];
    const p = new THREE.Vector3(), rel = new THREE.Vector3();
    for (let t = 0.04; t < 3; t += 0.04) {
      p.copy(p0).addScaledVector(v0, t).addScaledVector(down, 0.5 * G * t * t);
      rel.subVectors(p, f.C);
      rel.addScaledVector(f.T, -rel.dot(f.T));
      pts.push(p.clone());
      if (rel.length() >= R - 0.15) break;
    }
    it.land.copy(pts[pts.length - 1]);
    it.landUp.subVectors(f.C, it.land);
    it.landUp.addScaledVector(f.T, -it.landUp.dot(f.T)).normalize();   // toward the axis
    // foam pool on the wall where it lands, a mist puff just above it
    it.pool.position.copy(it.land).addScaledVector(it.landUp, 0.1);
    it.pool.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), it.landUp);
    it.pool.visible = true;
    it.mist.position.copy(it.land).addScaledVector(it.landUp, 1.2);
    it.mist.visible = true;
    const curve = new THREE.CatmullRomCurve3(pts);
    const n = Math.max(12, pts.length * 2);
    // the sheet spreads as it falls
    const geo = new THREE.TubeGeometry(curve, n, 0.6, 14, false);
    flare(geo, n, 14, 0.6, 1.25, curve);
    it.stream = new THREE.Mesh(geo, this.waterMat);
    const core = new THREE.TubeGeometry(curve, n, 0.32, 10, false);
    it.core = new THREE.Mesh(core, this.coreMat);
    it.stream.frustumCulled = it.core.frustumCulled = false;
    this.scene.add(it.stream, it.core);
  }

  _dropStream(it) {
    for (const k of ['stream', 'core']) {
      if (!it[k]) continue;
      this.scene.remove(it[k]); it[k].geometry.dispose(); it[k] = null;
    }
  }
}

// Widen a TubeGeometry from r0 at its start to r1 at its end by pushing each
// ring's vertices away from the curve.
function flare(geo, segs, radial, r0, r1, curve) {
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    const k = (r0 + (r1 - r0) * u * u) / r0;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

// Soft broken foam blob for the landing pool / mist (a mask, not a surface —
// the surfaces themselves wear the painted water texture).
function makeFoamTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * 44;
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 6 + Math.random() * 14;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
