// WHAT THE POWERS LOOK LIKE (core/powers.js): the ring of spinning blades, and the Shell Shock
// ring on the floor -- a thin outline that fills while it charges, pulses when armed, and flashes
// outward when it goes off. Flat on the ground like the enemy warnings, so it never hides a body.
import * as THREE from 'three';
import { u } from './units.js';
import { glowTexture } from './stage.js';
import { ORBIT, orbitBlades, burstRadius, CALTROP, VORTEX } from '../core/powers.js';

const MAX_BLADES = 6;

export function createPowers(scene) {
  const add = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false };

  // --- blades: a bright steel kite with a glowing edge, lying flat and spinning on its own axis
  const bladeGeo = new THREE.ShapeGeometry((() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.55); s.lineTo(0.2, 0); s.lineTo(0, -0.35); s.lineTo(-0.2, 0); s.closePath();
    return s;
  })());
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0xdff3ff, side: THREE.DoubleSide, fog: false });
  const edgeMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(140,220,255,1)', 'rgba(60,160,255,0)'), ...add });
  const blades = [];
  for (let i = 0; i < MAX_BLADES; i++) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(bladeGeo, bladeMat);
    m.rotation.x = -Math.PI / 2;
    const halo = new THREE.Sprite(edgeMat);
    halo.scale.setScalar(1.6);
    g.add(m, halo);
    g.scale.setScalar(u(ORBIT.bladeR) * 1.7);
    g.visible = false;
    scene.add(g);
    blades.push(g);
  }
  // the faint track the blades run on
  const track = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64),
    new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  track.rotation.x = -Math.PI / 2; track.position.y = 0.05; track.visible = false;
  scene.add(track);

  // --- shell shock
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.048; fill.visible = false;
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), rimMat);
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.052; rim.visible = false;
  const boom = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color: 0xfff1b0, ...add, side: THREE.DoubleSide }));
  boom.rotation.x = -Math.PI / 2; boom.position.y = 0.06; boom.visible = false;
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,240,180,1)', 'rgba(255,150,40,0)'), ...add }));
  flash.visible = false;
  scene.add(fill, rim, boom, flash);

  // --- the eight others: pooled, flat on the floor or small meshes
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); return m; };
  const spikeGeo = new THREE.ConeGeometry(0.2, 0.62, 6), spikeMat = new THREE.MeshBasicMaterial({ color: 0xff5a2c, fog: false });
  const discGeo = new THREE.CircleGeometry(0.62, 20), discMat = new THREE.MeshBasicMaterial({ color: 0x1a0d08, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  const rimGeo = new THREE.RingGeometry(0.56, 0.64, 24), rimMat2 = new THREE.MeshBasicMaterial({ color: 0xffc23c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const caltrops = Array.from({ length: 14 }, () => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(discGeo, discMat); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.012;
    const rim = new THREE.Mesh(rimGeo, rimMat2); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.016;
    g.add(disc, rim);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(spikeGeo, spikeMat); const a = i * 1.57 + 0.4; c.position.set(Math.cos(a) * 0.26, 0.3, Math.sin(a) * 0.26); c.rotation.z = Math.cos(a) * 0.45; c.rotation.x = -Math.sin(a) * 0.45; g.add(c); }
    const mid = new THREE.Mesh(spikeGeo, spikeMat); mid.position.y = 0.34; mid.scale.set(1.2, 1.2, 1.2); g.add(mid);
    g.visible = false; scene.add(g); return g;
  });
  // THE BOOMERANG (disabled for now, core/abilities.js): small, and a real boomerang shape -- a flat chevron
  const boomShape = new THREE.Shape();
  boomShape.moveTo(-0.34, 0.16); boomShape.lineTo(0, -0.04); boomShape.lineTo(0.34, 0.16); boomShape.lineTo(0.3, 0.26); boomShape.lineTo(0, 0.12); boomShape.lineTo(-0.3, 0.26); boomShape.closePath();
  const boomGeo = new THREE.ExtrudeGeometry(boomShape, { depth: 0.05, bevelEnabled: false });
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xffa43a, fog: false });
  const shells = Array.from({ length: 3 }, () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boomGeo, shellMat);
    body.rotation.x = Math.PI / 2;
    g.add(body); g.visible = false; scene.add(g); return g;
  });
  const arcMat = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, depthTest: false, fog: false });
  const arcs = Array.from({ length: 10 }, () => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    const l = new THREE.Line(g, arcMat); l.visible = false; l.frustumCulled = false; l.renderOrder = 60; scene.add(l); return l;
  });
  const trailMesh = mk(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xaaf0ff, ...add, side: THREE.DoubleSide }));
  trailMesh.rotation.x = -Math.PI / 2;
  const vortexRing = mk(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xb06bff, ...add, side: THREE.DoubleSide }));
  vortexRing.rotation.x = -Math.PI / 2;
  const frostRing = mk(new THREE.RingGeometry(0.88, 1, 64), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, ...add, side: THREE.DoubleSide }));
  frostRing.rotation.x = -Math.PI / 2;
  const rushGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,60,1)', 'rgba(255,90,20,0)'), ...add }));
  rushGlow.visible = false; scene.add(rushGlow);

  function syncOthers(w, timeS) {
    const P = w.powers || {};
    const px = u(w.player.x), pz = u(w.player.y);
    const ct = P.caltrops || [];
    caltrops.forEach((g, i) => { const t = ct[i]; g.visible = !!t; if (t) { g.position.set(u(t.x), 0.02, u(t.y)); g.scale.setScalar(u(CALTROP.radius) * 1.6); } });
    const bm = P.boom || [];
    shells.forEach((g, i) => { const b = bm[i]; g.visible = !!b; if (b) { g.position.set(u(b.x), 0.9, u(b.y)); g.rotation.y = timeS * 18; g.scale.setScalar(1); } });
    const ar = P.arcs || [];
    arcs.forEach((l, i) => {
      const a = ar[i]; l.visible = !!a;
      if (!a) return;
      const pos = l.geometry.attributes.position, jit = () => (Math.random() - 0.5) * 0.5;
      const x0 = u(a.x0), z0 = u(a.y0), x1 = u(a.x1), z1 = u(a.y1);
      pos.setXYZ(0, x0, 1.1, z0); pos.setXYZ(1, x0 + (x1 - x0) * 0.33 + jit(), 1.3, z0 + (z1 - z0) * 0.33 + jit());
      pos.setXYZ(2, x0 + (x1 - x0) * 0.66 + jit(), 1.0, z0 + (z1 - z0) * 0.66 + jit()); pos.setXYZ(3, x1, 1.1, z1);
      pos.needsUpdate = true; arcMat.opacity = 0.95;
    });
    const tr = P.dash && P.dash.trail;
    trailMesh.visible = !!tr;
    if (tr) {
      const x0 = u(tr.x0), z0 = u(tr.y0), x1 = u(tr.x1), z1 = u(tr.y1), len = Math.hypot(x1 - x0, z1 - z0) || 0.01;
      trailMesh.position.set((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
      trailMesh.rotation.z = -Math.atan2(z1 - z0, x1 - x0) + Math.PI / 2 * 0;
      trailMesh.scale.set(len, 1.1, 1); trailMesh.material.opacity = tr.t / 0.3;
    }
    const v = P.vortex;
    vortexRing.visible = !!(v && v.up);
    if (vortexRing.visible) {
      const k = (timeS * 1.6) % 1;
      vortexRing.position.set(px, 0.055, pz); vortexRing.scale.setScalar(u(VORTEX.radius) * (1 - k * 0.85)); vortexRing.material.opacity = 0.7 * (1 - k * 0.5);
    }
    const fr = P.frost;
    frostRing.visible = !!(fr && fr.ringT > 0);
    if (frostRing.visible) {
      const k = 1 - fr.ringT / 0.5;
      frostRing.position.set(px, 0.06, pz); frostRing.scale.setScalar(Math.max(0.05, u(fr.R || 420) * k)); frostRing.material.opacity = 0.9 * (1 - k);
    }
    const ru = P.rush;
    rushGlow.visible = !!(ru && ru.n > 0 && !w.dead);
    if (rushGlow.visible) { rushGlow.position.set(px, 0.9, pz); rushGlow.scale.setScalar(2.2 + ru.n * 0.5 + 0.2 * Math.sin(timeS * 14)); rushGlow.material.opacity = 0.25 + ru.n * 0.08; }
  }

  /** `w` is the world; `timeS` the sim clock. */
  function sync(w, timeS) {
    syncOthers(w, timeS);
    const px = u(w.player.x), pz = u(w.player.y);
    const bl = orbitBlades(w);
    for (let i = 0; i < MAX_BLADES; i++) {
      const b = blades[i];
      if (i < bl.length) {
        b.visible = true;
        b.position.set(u(bl[i].x), 0.95, u(bl[i].y));
        b.children[0].rotation.z = timeS * 12 + i;
      } else b.visible = false;
    }
    const o = w.powers?.orbit;
    track.visible = bl.length > 0;
    if (track.visible) {
      track.position.set(px, 0.05, pz); track.scale.setScalar(u(ORBIT.radius));
      // fades out over the last second so the blades going away is not a surprise
      track.material.opacity = 0.18 * Math.min(1, Math.max(0, o.t) / 1);
    }

    const b = w.powers?.burst;
    const lvl = w.build.burst || 0;
    const R = u(burstRadius(Math.max(1, lvl)));
    const on = lvl > 0 && !w.dead;
    fill.visible = rim.visible = on;
    if (on) {
      fill.position.set(px, 0.048, pz); rim.position.set(px, 0.052, pz);
      rim.scale.setScalar(R);
      fill.scale.setScalar(Math.max(0.02, R * b.charge));
      const pulse = b.armed ? 0.5 + 0.5 * Math.sin(timeS * 16) : 0;
      fillMat.opacity = b.armed ? 0.28 + 0.2 * pulse : 0.14;
      rimMat.opacity = b.armed ? 0.7 + 0.3 * pulse : 0.3 + 0.3 * b.charge;
      rimMat.color.setHex(b.armed ? 0xff5a3c : 0xffd36a);
    }
    const f = b ? b.flashT / 0.45 : 0;
    boom.visible = flash.visible = f > 0;
    if (f > 0) {
      const k = 1 - f, Rm = u(b.firedR || 330);
      boom.position.set(px, 0.06, pz); boom.scale.setScalar(Math.max(0.05, Rm * (0.3 + 0.7 * k)));
      boom.material.opacity = f;
      flash.position.set(px, 0.9, pz); flash.scale.setScalar(Rm * 1.6 * (0.4 + k)); flash.material.opacity = f * 0.9;
    }
  }
  return { sync };
}
