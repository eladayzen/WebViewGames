// OPEN SKY mode.  No path, no centreline: the glider is free left/right.  Ships and islands are generated ahead of
// him as he flies; when he nears one, a guide ("path") grows over it and softly lifts/lowers him to skim its top --
// steer away and it lets go.  Big portal rings drop him into the next sky level, which is generated on the fly.
import * as THREE from 'three';
import { makeCarrier, makeIsland, GLOW } from './world.js';
import { mulberry32, clamp, smoothstep } from './util.js';

export const THEMES = [
  { name: 'SUNSET',  stops: ['#6f78dc', '#b894dc', '#f0b0cf', '#f8d3c8', '#fbe4cf'], fog: 0xe9c3d8, hemi: [0xfff0e8, 0x8a6a7a], sun: 0xffe2c0 },
  { name: 'DAWN',    stops: ['#3f95d6', '#74c6e4', '#b8e6dc', '#f6edc6', '#fff4d8'], fog: 0xdcf0ec, hemi: [0xf2fbff, 0x7a9a9a], sun: 0xfff2cc },
  { name: 'DUSK',    stops: ['#3a2a70', '#86409a', '#d2587f', '#f4977a', '#ffcf9f'], fog: 0xe6a4a6, hemi: [0xffe0d8, 0x7a4a6a], sun: 0xffb890 },
  { name: 'MIDNIGHT', stops: ['#0d1135', '#1e2868', '#3b4b9e', '#7a78c6', '#c4a6da'], fog: 0x6e70b4, hemi: [0xc8d0ff, 0x3a3a6a], sun: 0x9fb0ff },
];

const GUIDE_MAT = () => new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
export const PORTAL_R = 11;

export class OpenWorld {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.structs = []; this.rings = []; this.portal = null;
    this.rnd = mulberry32(777); this.level = 0; this.frontZ = 0; this.sinceRing = 0;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x66ffe6, transparent: true, opacity: 0.9 });
  }

  /** wipe everything and start a fresh sky level around the player (px, py, pz) */
  reset(level, px, py, pz) {
    for (const st of this.structs) this._free(st.group);
    for (const r of this.rings) this._free(r.mesh);
    if (this.portal) this._free(this.portal.group);
    this.structs = []; this.rings = []; this.portal = null;
    this.level = level; this.rnd = mulberry32(777 + level * 131);
    this.frontZ = pz - 230; this.lvStart = pz; this.sinceRing = 0;
  }
  _free(o) { this.group.remove(o); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); }
  dispose() { this.reset(0, 0, 0, 0); this.scene.remove(this.group); }

  portalDist() { return 900 + Math.min(this.level, 4) * 120; }

  /** keep the sky populated ahead of the player; drop what is behind */
  fill(px, py, pz) {
    const r = this.rnd;
    const slope = -0.02;
    while (this.frontZ > pz - 760) {
      const gap = 85 + r() * 85;
      this.frontZ -= gap;
      const z = this.frontZ, dist = pz - z, yBase = py + slope * dist;
      const ship = r() < 0.42;
      const ext = ship ? 11 + r() * 12 : 17 + r() * 28;
      const len = ship ? 90 + r() * 90 : ext * 2;
      const x = px + (r() * 2 - 1) * 250;
      const top = yBase - (14 + r() * 42);
      const st = ship ? { kind: 'ship', hx: ext, hl: len / 2 } : { kind: 'island', r: ext, hl: ext };
      Object.assign(st, { x, y: top, z, ext, len });
      const g = ship ? makeCarrier(st.hx, st.hl, r) : makeIsland(st.r, r);
      g.position.set(x, top, z); if (!ship) g.rotation.y = r() * 6;
      this.group.add(g); st.group = g;
      // the guide that grows over it when the player closes in
      const gm = GUIDE_MAT();
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, len + 40), gm);
      strip.position.set(x, top + 7, z); this.group.add(strip); st.guide = strip; st.gm = gm;
      this.structs.push(st);
      // little boost rings between them
      if (r() < 0.6) this._ring(px + (r() * 2 - 1) * 110, yBase + (r() - 0.55) * 14, z + gap * 0.5);
    }
    if (!this.portal && pz < this.lvStart - this.portalDist()) this._portal(px + (r() * 2 - 1) * 70, py + slope * 650 - 6, pz - 650);
    // cull behind
    for (let i = this.structs.length - 1; i >= 0; i--) { const st = this.structs[i]; if (st.z - st.hl > pz + 160) { this._free(st.group); this._free(st.guide); this.structs.splice(i, 1); } }
    for (let i = this.rings.length - 1; i >= 0; i--) if (this.rings[i].z > pz + 120) { this._free(this.rings[i].mesh); this.rings.splice(i, 1); }
  }

  _ring(x, y, z) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.34, 6, 30), this.ringMat);
    m.position.set(x, y, z); this.group.add(m); this.rings.push({ x, y, z, mesh: m, got: false, r: 5.4 });
  }

  _portal(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R, 0.9, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffb04a }));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R * 0.82, 0.35, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff4fd8 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PORTAL_R * 0.8, 36), new THREE.MeshBasicMaterial({ color: 0xff8be8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa8e8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    halo.scale.set(PORTAL_R * 7, PORTAL_R * 7, 1);
    g.add(ring, ring2, disc, halo);
    this.group.add(g); this.portal = { x, y, z, group: g, ring, ring2, got: false };
  }

  update(dt, t, p) {
    if (this.portal) { this.portal.ring2.rotation.z += dt * 1.6; this.portal.ring.rotation.z -= dt * 0.5; }
    for (const st of this.structs) {
      const ud = st.group.userData;
      if (ud.rotors) for (const rt of ud.rotors) rt.rotation.y += dt * 11;
      if (ud.thrusters) for (const th of ud.thrusters) th.material.opacity = 0.85 + Math.sin(t * 17 + th.position.x) * 0.08;
    }
    for (const rg of this.rings) if (!rg.got) rg.mesh.rotation.z += dt * 0.8;
  }

  /** the soft path: how strongly the structure under/near (x, z) pulls the glider, and the height it wants */
  guide(x, y, z, out) {
    let best = null, bw = 0;
    for (const st of this.structs) {
      const ahead = z - (st.z + st.hl);                        // >0: before it, <0: over/after it (z decreases)
      const behind = (st.z - st.hl) - z;                       // >0: already past its far end
      if (behind > 40 || ahead > 170) continue;
      const wa = ahead > 0 ? 1 - smoothstep(25, 170, ahead) : 1 - smoothstep(0, 40, Math.max(0, behind));
      const dx = Math.abs(x - st.x), wl = 1 - smoothstep(st.ext * 0.9, st.ext + 70, dx);
      const target = st.y + 7;
      if (Math.abs(y - target) > 110) continue;
      const w = wa * wl;
      if (w > bw) { bw = w; best = st; }
    }
    for (const st of this.structs) { const on = st === best ? bw : 0; st.gm.opacity += (on * 0.55 - st.gm.opacity) * 0.15; st.guide.visible = st.gm.opacity > 0.01; }
    out.w = bw; out.st = best; out.y = best ? best.y + 7 : 0; out.x = best ? best.x : 0;
    return out;
  }

  surface(x, y, z, out) {
    let best = -Infinity, edge = false;
    for (const st of this.structs) {
      let ed;
      if (st.kind === 'ship') { const dx = Math.abs(x - st.x), dz = Math.abs(z - st.z); if (dx > st.hx || dz > st.hl) continue; ed = st.hx - dx < 4 || st.hl - dz < 6; }
      else { const dx = x - st.x, dz = z - st.z, d2 = dx * dx + dz * dz, r = st.r * 0.9; if (d2 > r * r) continue; ed = r - Math.sqrt(d2) < 4; }
      if (st.y <= y + 1.5 && st.y > best) { best = st.y; edge = ed; }
    }
    out.top = best; out.edge = edge; return out;
  }
}
