// DONNIE'S MACHINES, drawn (core/machines.js): the closed crate that teleports in (a beam, then the crate
// pops into being), its health bar, the burst when it breaks, and each gadget that comes out of it.
import * as THREE from 'three';
import { u } from './units.js';
import { glowTexture } from './stage.js';
import { MACHINE, DEVICES } from '../core/machines.js';
import { CAM } from './view.js';

const MAX_DEV = 8;
const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };

export function createMachines(scene, { crate: crateTex, head: headTex } = {}) {
  const add = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false };
  const lam = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });

  // --- the crate: the project's ORIGINAL crate (same box, same painted texture as the training crates),
  // a little bigger, with Donnie's head in a circle floating on top so it reads as his.
  if (crateTex) crateTex.colorSpace = THREE.SRGBColorSpace;
  const crate = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ map: crateTex || null, color: 0xffffff });
  const crateBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMat);
  const CRATE_S = u(MACHINE.radius) * 2.3;
  crateBox.scale.setScalar(CRATE_S); crateBox.position.y = CRATE_S / 2;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(190,130,255,1)', 'rgba(120,60,220,0)'), ...add }));
  glow.position.y = CRATE_S * 0.5; glow.scale.setScalar(CRATE_S * 2.4);
  // the badge: a circle with a purple rim, Donnie's head cut to it
  const badgeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#14210f'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = '#6b2fa8'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(64, 64, 48, 0, 7); g.clip();
    g.fillStyle = '#cfa8ff'; g.fillRect(0, 0, 128, 128);
    const img = headTex && headTex.image;
    if (img) g.drawImage(img, 16, 16, 96, 96);
    g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  // the badge lies FLAT on the lid like a sticker (a plane facing up), not floating
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(CRATE_S * 0.78, CRATE_S * 0.78),
    new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  decal.rotation.x = -Math.PI / 2;
  // turned about the vertical so the head stands upright on SCREEN, whatever angle the camera looks from
  const decalG = new THREE.Group(); decalG.rotation.y = Math.PI / 2 - CAM.yaw; decalG.position.y = CRATE_S + 0.012; decalG.add(decal);
  crate.add(crateBox, glow, decalG);
  crate.visible = false; scene.add(crate);

  // beam + ring for the teleport-in and the break
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xc9a0ff, side: THREE.DoubleSide, ...add });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 9, 20, 1, true), beamMat); beam.position.y = 4.5; beam.visible = false; scene.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe6d0ff, side: THREE.DoubleSide, ...add });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; scene.add(ring);

  // hp bar: back plate and fill, camera-facing sprites (the same trick as the foes')
  const hpBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x14081f, depthTest: false, transparent: true, opacity: 0.6, fog: false }));
  const hpFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd9a8ff, depthTest: false, transparent: true, opacity: 0.95, fog: false }));
  hpBack.renderOrder = 50; hpFill.renderOrder = 51; hpBack.visible = hpFill.visible = false;
  const HP_W = 1.9, HP_H = 0.17;
  hpBack.scale.set(HP_W + 0.06, HP_H + 0.06, 1); scene.add(hpBack, hpFill);

  // --- gadgets: each pooled slot holds every look, toggled by type
  const devs = Array.from({ length: MAX_DEV }, () => {
    const g = new THREE.Group();
    const coil = new THREE.Group();
    coil.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.7, 10), lam(0x4a4f5a, 0x111418)), 0, 0.85, 0));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff })); orb.position.y = 1.9; coil.add(orb);
    const turret = new THREE.Group();
    turret.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), lam(0x4a4f5a, 0x111418)), 0, 0.25, 0));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 8), lam(0xffd84a, 0x553f00)); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.65, 0.5); turret.add(barrel);
    const turretHead = new THREE.Group(); turretHead.add(barrel); turret.add(turretHead);
    const mine = new THREE.Group();
    mine.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.22, 14), lam(0x2c2f38, 0x0a0b0e)), 0, 0.11, 0));
    const mineLed = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3030 })); mineLed.position.y = 0.3; mine.add(mineLed);
    const well = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: 0x1a0830 })); core.position.y = 0.9; well.add(core);
    const wring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xb06bff, side: THREE.DoubleSide, ...add })); wring.rotation.x = -Math.PI / 2; wring.position.y = 0.06; well.add(wring);
    g.add(coil, turret, mine, well);
    g.visible = false; scene.add(g);
    return { g, coil, orb, turret, turretHead, mine, mineLed, well, wring };
  });

  // brief effects: the break burst, stasis ring, mine blast
  const fxRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, ...add }));
  fxRing.rotation.x = -Math.PI / 2; fxRing.visible = false; scene.add(fxRing);
  const fxFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,240,200,1)', 'rgba(255,140,40,0)'), ...add }));
  fxFlash.visible = false; scene.add(fxFlash);

  // a progress bar over every gadget that runs for a while: it drains to show when it will vanish
  const TB_W = 1.2, TB_H = 0.14;
  const timers = devs.map(() => {
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x14081f, depthTest: false, transparent: true, opacity: 0.6, fog: false }));
    const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffc23c, depthTest: false, transparent: true, opacity: 0.95, fog: false }));
    back.renderOrder = 50; fill.renderOrder = 51; back.visible = fill.visible = false;
    back.scale.set(TB_W + 0.06, TB_H + 0.06, 1); scene.add(back, fill);
    return { back, fill };
  });

  // the crate breaks into planks: pooled shards with gravity, a bounce, and a fade
  const shardGeo = new THREE.BoxGeometry(0.75, 0.2, 0.34);
  const shardMat = new THREE.MeshLambertMaterial({ map: crateTex || null, color: 0xffffff, transparent: true });
  const shards = Array.from({ length: 18 }, () => { const m = new THREE.Mesh(shardGeo, shardMat.clone()); m.visible = false; scene.add(m); return { m, vx: 0, vy: 0, vz: 0, sx: 0, sz: 0, life: 0 }; });
  let lastBreak = 0, lastT = 0;
  function breakApart(x, z) {
    shards.forEach((s, i) => {
      const a = (i / shards.length) * Math.PI * 2 + Math.random() * 0.6, sp = 2.5 + Math.random() * 4;
      s.m.position.set(x, 0.5 + Math.random() * 0.8, z); s.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.m.scale.setScalar(0.8 + Math.random() * 0.9);
      s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.vy = 3 + Math.random() * 4;
      s.sx = (Math.random() - 0.5) * 14; s.sz = (Math.random() - 0.5) * 14; s.life = 2.0 + Math.random() * 0.6; s.m.visible = true; s.m.material.opacity = 1;
    });
  }

  // turret darts: a bright streak that flies from the muzzle to the target, and a flash at the muzzle
  const dartMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,200,1)', 'rgba(255,170,40,0)'), ...add });
  const darts = Array.from({ length: 8 }, () => { const sp = new THREE.Sprite(dartMat.clone()); sp.visible = false; scene.add(sp); return sp; });
  const trails = Array.from({ length: 8 }, () => { const sp = new THREE.Sprite(dartMat.clone()); sp.visible = false; scene.add(sp); return sp; });

  function sync(w, timeS) {
    const m = w.mach;
    const dtS = Math.min(0.05, Math.max(0, timeS - lastT)); lastT = timeS;
    for (const f of (m && m.fx) || []) if (f.type === 'break' && f.id > lastBreak) { lastBreak = f.id; breakApart(u(f.x), u(f.y)); }
    for (const s of shards) {
      if (!s.m.visible) continue;
      s.life -= dtS; if (s.life <= 0) { s.m.visible = false; continue; }
      s.vy -= 16 * dtS; s.m.position.x += s.vx * dtS; s.m.position.z += s.vz * dtS; s.m.position.y += s.vy * dtS;
      if (s.m.position.y < 0.08) { s.m.position.y = 0.08; s.vy *= -0.35; s.vx *= 0.6; s.vz *= 0.6; s.sx *= 0.6; s.sz *= 0.6; }
      s.m.rotation.x += s.sx * dtS; s.m.rotation.z += s.sz * dtS;
      s.m.material.opacity = Math.min(1, s.life / 0.5);
    }
    const sh = (m && m.shots) || [];
    darts.forEach((sp, i) => {
      const s = sh[i], tr = trails[i];
      sp.visible = tr.visible = !!s;
      if (!s) return;
      const k = 1 - s.t / s.dur;
      const x = s.x0 + (s.x1 - s.x0) * k, y = s.y0 + (s.y1 - s.y0) * k;
      sp.position.set(u(x), 0.9, u(y)); sp.scale.setScalar(0.75);
      const kb = Math.max(0, k - 0.25);
      tr.position.set(u(s.x0 + (s.x1 - s.x0) * kb), 0.9, u(s.y0 + (s.y1 - s.y0) * kb)); tr.scale.setScalar(0.45); tr.material.opacity = 0.6;
    });
    const box = m && m.box;
    crate.visible = beam.visible = ring.visible = hpBack.visible = hpFill.visible = !!box;
    if (box) {
      const age = Math.max(0, timeS - box.bornAtS);
      const pop = Math.min(1, Math.max(0, (age - 0.25) / 0.3));
      const k = 1 + 0.5 * Math.sin(pop * Math.PI) * (1 - pop);                    // overshoot as it lands
      const hit = box.hitT > 0 ? Math.min(1, box.hitT / 0.14) : 0;
      crate.position.set(u(box.x), 0, u(box.y));
      crate.scale.setScalar(Math.max(0.01, pop * k * (1 + 0.1 * hit)));
      crate.rotation.y = hit ? Math.sin(timeS * 90) * 0.08 : 0;
      bodyMat.emissive.setRGB(hit * 0.8, hit * 0.7, hit * 0.7);
      glow.material.opacity = 0.5 + 0.2 * Math.sin(timeS * 4);
      const bf = Math.max(0, 1 - age / 0.7);
      beam.position.set(u(box.x), 4.5, u(box.y)); beam.visible = bf > 0; beam.scale.set(bf * 0.9 + 0.1, 1, bf * 0.9 + 0.1); beamMat.opacity = 0.55 * bf;
      ring.visible = age < 0.8; ring.position.set(u(box.x), 0.06, u(box.y)); ring.scale.setScalar(0.4 + 2.6 * Math.min(1, age / 0.8)); ringMat.opacity = Math.max(0, 1 - age / 0.8);
      const frac = Math.max(0.001, box.hp / box.maxHp);
      const bx = u(box.x), by = (CRATE_S + 0.55) * crate.scale.y, bz = u(box.y);          // ALWAYS above the crate
      hpBack.position.set(bx, by, bz); hpFill.position.set(bx, by, bz);
      hpFill.scale.set(HP_W * frac, HP_H, 1); hpFill.center.set(0.5 / frac, 0.5);
    }
    const list = (m && m.devices) || [];
    devs.forEach((s, i) => {
      const d = list[i];
      s.g.visible = !!d;
      const tm = timers[i], showBar = !!d && d.lifeS >= 2.5;
      tm.back.visible = tm.fill.visible = showBar;
      if (!d) return;
      s.coil.visible = d.type === 'coil'; s.turret.visible = d.type === 'turret'; s.mine.visible = d.type === 'mines'; s.well.visible = d.type === 'magnet';
      s.g.position.set(u(d.x), 0, u(d.y));
      const out = Math.min(1, d.age / 0.4), bounce = out < 1 ? 1 + 0.4 * Math.sin(out * Math.PI) * (1 - out) : 1;     // pops out of the crate
      s.g.scale.setScalar(Math.max(0.01, out * bounce));
      const last = d.lifeS - d.age < 1.2 ? (Math.sin(timeS * 30) > 0 ? 1 : 0.35) : 1;                               // flickers when nearly done
      if (showBar) {
        const left = Math.max(0.001, 1 - d.age / d.lifeS), top = d.type === 'coil' ? 2.9 : d.type === 'turret' ? 1.7 : d.type === 'magnet' ? 2.0 : 0.9;
        const px = u(d.x), pz = u(d.y);
        tm.back.position.set(px, top, pz); tm.fill.position.set(px, top, pz);
        tm.fill.scale.set(TB_W * left, TB_H, 1); tm.fill.center.set(0.5 / left, 0.5);
        tm.fill.material.color.setHex(left < 0.25 ? 0xff5a3c : 0xffc23c);
      }
      if (d.type === 'coil') s.orb.scale.setScalar((1 + 0.25 * Math.sin(timeS * 14)) * last);
      if (d.type === 'turret') s.turretHead.rotation.y = -(d.aim ?? 0) + Math.PI / 2;
      if (d.type === 'mines') s.mineLed.visible = Math.sin(timeS * 8 + i) > -0.2;
      if (d.type === 'magnet') { const r = (timeS * 1.4) % 1; s.wring.scale.setScalar(u(DEVICES.magnet.radius) * (1 - r)); s.wring.material.opacity = 0.8 * (1 - r * 0.6); }
    });
    // one-shot effects (the first live one is drawn)
    const e = m && m.fx && m.fx[0];
    fxRing.visible = fxFlash.visible = !!e;
    if (e) {
      const dur = e.type === 'break' ? 0.6 : e.type === 'stasis' ? 0.8 : 0.5, k = 1 - e.t / dur;
      const R = e.type === 'stasis' ? 9 : e.type === 'boom' ? u(e.r || 230) : 3;
      fxRing.position.set(u(e.x), 0.07, u(e.y)); fxRing.scale.setScalar(Math.max(0.05, R * k));
      fxRing.material.color.setHex(e.type === 'stasis' ? 0x9fe8ff : e.type === 'boom' ? 0xffb340 : 0xe6c0ff);
      fxRing.material.opacity = 1 - k;
      fxFlash.position.set(u(e.x), 0.9, u(e.y)); fxFlash.scale.setScalar(R * 0.9 * (0.3 + k)); fxFlash.material.opacity = (1 - k) * 0.9;
    }
  }
  return { sync };
}
