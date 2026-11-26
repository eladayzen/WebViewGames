// OPEN SKY mode, fully open: the glider has a free HEADING (left/right turns him, he can circle forever).  The sky is an
// endless, deterministic grid of cells -- each may hold a flying ship or island and a boost ring -- streamed in around
// him, so circling back returns to the same islands.  When he nears one, a guide ("path") grows over it and softly lifts /
// lowers him to skim its top; steer away and it lets go.  Big portal rings drop him into the next sky level.
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
const CELL = 240, LOAD_R = 840, UNLOAD_R = 1080;
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export { wrapPi };

export class OpenWorld {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.structs = []; this.rings = []; this.portal = null; this.cells = new Map(); this.queue = [];
    this.level = 0; this.lvStartS = 0;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x66ffe6, transparent: true, opacity: 0.9 });
  }

  /** wipe everything and start a fresh sky level */
  reset(level) {
    for (const st of this.structs) { this._free(st.group); this._free(st.guide); }
    for (const r of this.rings) this._free(r.mesh);
    if (this.portal) this._free(this.portal.group);
    this.structs = []; this.rings = []; this.portal = null; this.cells.clear(); this.queue = [];
    this.level = level; this.ci = null; this.cj = null;
  }
  _free(o) { this.group.remove(o); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); }
  dispose() { this.reset(0); this.scene.remove(this.group); }
  portalDist() { return 900 + Math.min(this.level, 4) * 120; }

  _cellRnd(i, j) { return mulberry32(((i * 73856093) ^ (j * 19349663) ^ (this.level * 83492791) ^ 0x5bd1e995) >>> 0); }

  /** which cells should exist around (px, pz): queue the missing ones, drop the far ones */
  stream(px, pz, fx, fz) {
    const ci = Math.floor(px / CELL), cj = Math.floor(pz / CELL);
    if (ci !== this.ci || cj !== this.cj) {
      this.ci = ci; this.cj = cj;
      const n = Math.ceil(LOAD_R / CELL) + 1;
      for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) {
        const key = i + ',' + j;
        if (this.cells.has(key)) continue;
        const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL, d = Math.hypot(cx - px, cz - pz);
        if (d > LOAD_R) continue;
        this.cells.set(key, { structs: [], rings: [] });
        this.queue.push({ key, i, j, d });
      }
    }
    // build one cell per frame, nearest-and-ahead first
    if (this.queue.length) {
      let bi = 0, bs = 1e9;
      for (let k = 0; k < this.queue.length; k++) {
        const q = this.queue[k], cx = (q.i + 0.5) * CELL - px, cz = (q.j + 0.5) * CELL - pz;
        const sc = Math.hypot(cx, cz) - (cx * fx + cz * fz) * 0.4;
        if (sc < bs) { bs = sc; bi = k; }
      }
      const q = this.queue.splice(bi, 1)[0]; this._build(q);
    }
    // unload far cells
    if (this._unT === undefined || this._unT++ > 40) {
      this._unT = 0;
      for (const [key, c] of this.cells) {
        const [i, j] = key.split(',').map(Number), cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
        if (Math.hypot(cx - px, cz - pz) > UNLOAD_R) { this._dropCell(c); this.cells.delete(key); }
      }
    }
  }
  _dropCell(c) {
    for (const st of c.structs) { this._free(st.group); this._free(st.guide); this.structs.splice(this.structs.indexOf(st), 1); }
    for (const r of c.rings) { this._free(r.mesh); this.rings.splice(this.rings.indexOf(r), 1); }
  }

  _build({ key, i, j }) {
    const cell = this.cells.get(key); if (!cell) return;
    const r = this._cellRnd(i, j);
    if (r() < 0.72) {
      const ship = r() < 0.42;
      const ext = ship ? 11 + r() * 12 : 17 + r() * 28;
      const len = ship ? 90 + r() * 90 : ext * 2;
      const x = (i + 0.2 + r() * 0.6) * CELL, z = (j + 0.2 + r() * 0.6) * CELL, top = -(14 + r() * 56), yaw = r() * 6.28;
      const st = ship ? { kind: 'ship', hx: ext, hl: len / 2 } : { kind: 'island', r: ext, hl: ext };
      Object.assign(st, { x, y: top, z, ext, len, yaw });
      const g = ship ? makeCarrier(st.hx, st.hl, r) : makeIsland(st.r, r);
      g.position.set(x, top, z); g.rotation.y = yaw;
      this.group.add(g); st.group = g;
      const gm = GUIDE_MAT();
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, len + 40), gm);
      strip.position.set(x, top + 7, z); strip.rotation.y = yaw; this.group.add(strip); st.guide = strip; st.gm = gm;
      this.structs.push(st); cell.structs.push(st);
    }
    if (r() < 0.55) {
      const x = (i + 0.1 + r() * 0.8) * CELL, z = (j + 0.1 + r() * 0.8) * CELL, y = -26 + r() * 34;
      const m = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.34, 6, 30), this.ringMat);
      m.position.set(x, y, z); this.group.add(m);
      const rg = { x, y, z, mesh: m, got: false, r: 5.4 };
      this.rings.push(rg); cell.rings.push(rg);
    }
  }

  /** a portal appears ahead of the player once he has flown far enough in this level */
  spawnPortal(px, py, pz, fx, fz) {
    const d = 620, x = px + fx * d, z = pz + fz * d, y = py - 4;
    const g = new THREE.Group(); g.position.set(x, y, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R, 0.9, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffb04a }));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R * 0.82, 0.35, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff4fd8 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PORTAL_R * 0.8, 36), new THREE.MeshBasicMaterial({ color: 0xff8be8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa8e8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    halo.scale.set(PORTAL_R * 7, PORTAL_R * 7, 1);
    const face = new THREE.Group(); face.add(ring, ring2, disc); g.add(face, halo);
    this.group.add(g); this.portal = { x, y, z, group: g, face, ring, ring2, got: false };
  }

  update(dt, t, p) {
    if (this.portal) { this.portal.ring2.rotation.z += dt * 1.6; this.portal.ring.rotation.z -= dt * 0.5; this.portal.face.rotation.y = Math.atan2(p.x - this.portal.x, p.z - this.portal.z); }
    for (const st of this.structs) {
      const ud = st.group.userData;
      if (ud.rotors) for (const rt of ud.rotors) rt.rotation.y += dt * 11;
      if (ud.thrusters) for (const th of ud.thrusters) th.material.opacity = 0.85 + Math.sin(t * 17 + th.position.x) * 0.08;
    }
    for (const rg of this.rings) { if (!rg.got) rg.mesh.rotation.y = Math.atan2(p.x - rg.x, p.z - rg.z); }
  }

  /** distance from (x, z) to a structure's footprint (0 when over it), in its own rotated frame */
  _dist(st, x, z) {
    const dx = x - st.x, dz = z - st.z;
    if (st.kind === 'ship') {
      const c = Math.cos(st.yaw), s = Math.sin(st.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
      return Math.hypot(Math.max(Math.abs(lx) - st.hx, 0), Math.max(Math.abs(lz) - st.hl, 0));
    }
    return Math.max(Math.hypot(dx, dz) - st.r * 0.9, 0);
  }

  /** the soft path: which nearby ship / island is pulling the glider, how hard, and the height it wants */
  guide(x, y, z, fx, fz, out) {
    let best = null, bw = 0, bd = 0;
    for (const st of this.structs) {
      const d = this._dist(st, x, z);
      if (d > 80) continue;
      const target = st.y + 7;
      if (Math.abs(y - target) > 110) continue;
      let wf = 1;
      if (d > 1) { const dx = st.x - x, dz = st.z - z, l = Math.hypot(dx, dz) || 1; wf = smoothstep(-0.2, 0.55, (dx * fx + dz * fz) / l); }
      const w = (1 - smoothstep(4, 75, d)) * wf;
      if (w > bw) { bw = w; best = st; bd = d; }
    }
    for (const st of this.structs) { const on = st === best ? bw : 0; st.gm.opacity += (on * 0.55 - st.gm.opacity) * 0.15; st.guide.visible = st.gm.opacity > 0.01; }
    out.w = bw; out.st = best; out.d = bd; out.y = best ? best.y + 7 : 0; out.x = best ? best.x : 0; out.z = best ? best.z : 0;
    return out;
  }

  surface(x, y, z, out) {
    let best = -Infinity, edge = false;
    for (const st of this.structs) {
      if (Math.abs(x - st.x) > st.ext + st.hl + 2 || Math.abs(z - st.z) > st.ext + st.hl + 2) continue;
      let ed;
      if (st.kind === 'ship') {
        const dx = x - st.x, dz = z - st.z, c = Math.cos(st.yaw), s = Math.sin(st.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) > st.hx || Math.abs(lz) > st.hl) continue; ed = st.hx - Math.abs(lx) < 4 || st.hl - Math.abs(lz) < 6;
      } else { const dx = x - st.x, dz = z - st.z, d2 = dx * dx + dz * dz, r = st.r * 0.9; if (d2 > r * r) continue; ed = r - Math.sqrt(d2) < 4; }
      if (st.y <= y + 1.5 && st.y > best) { best = st.y; edge = ed; }
    }
    out.top = best; out.edge = edge; return out;
  }
}
