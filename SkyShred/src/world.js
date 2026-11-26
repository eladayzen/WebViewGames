// Scenery for one leg -- all of it sky: giant flying carriers, floating base islands, the start / landing hover deck,
// boost rings.  Clouds are a separate persistent field (Clouds) so they survive the deck-to-deck re-base.
import * as THREE from 'three';
import { DECK_LEN, DECK_BACK, DECK_W, LAND_Z } from './path.js';
import { mulberry32, clamp, smoothstep } from './util.js';

export function makeSkyTexture(stops = ['#6f78dc', '#b894dc', '#f0b0cf', '#f8d3c8', '#fbe4cf']) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  [0, 0.34, 0.58, 0.78, 1].forEach((p, i) => gr.addColorStop(p, stops[i]));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const GLOW = glowTexture();

function cloudTexture(seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'); const rnd = mulberry32(seed);
  const puff = (x, y, r, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.55, `rgba(255,246,250,${a * 0.65})`); gr.addColorStop(1, 'rgba(255,240,248,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let i = 0; i < 9; i++) { const k = i / 8; puff(30 + k * 196 + (rnd() - 0.5) * 20, 74 - Math.sin(k * Math.PI) * 18 + (rnd() - 0.5) * 12, 22 + Math.sin(k * Math.PI) * 24 + rnd() * 8, 0.85); }
  for (let i = 0; i < 5; i++) puff(70 + rnd() * 120, 52 + rnd() * 10, 26 + rnd() * 14, 0.7);
  // a soft shaded belly
  const gr = g.createLinearGradient(0, 60, 0, 112); gr.addColorStop(0, 'rgba(210,170,215,0)'); gr.addColorStop(1, 'rgba(210,170,215,0.28)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function deckTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#464b66'; g.fillRect(0, 0, 256, 1024);
  g.strokeStyle = '#2c3048'; g.lineWidth = 3;
  for (let y = 0; y <= 1024; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let x = 0; x <= 256; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  g.fillStyle = '#5b6182'; for (let y = 0; y < 1024; y += 128) for (let x = 0; x < 256; x += 128) g.fillRect(x + 8, y + 8, 112, 112);
  g.fillStyle = '#b3262e'; g.fillRect(104, 0, 48, 1024);                        // Foot Clan red stripe
  g.fillStyle = '#ffd24a'; for (let y = 40; y < 1024; y += 128) { g.beginPath(); g.moveTo(128, y); g.lineTo(150, y + 34); g.lineTo(128, y + 24); g.lineTo(106, y + 34); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function hazardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#16171d'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#ffcf33';
  for (let x = -32; x < 288; x += 48) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 24, 32); g.lineTo(x + 56, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const B = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const MAT = {
  hull: L(0x2b2e44), hull2: L(0x1f2133), steel: L(0x3a3d58), steel2: L(0x565b7a), crate: L(0x7b4d36), red: L(0xb3262e),
  cyan: B(0x5ff2ff), lampRed: B(0xff4b4b), lampGreen: B(0x6dff8a), win: B(0x9ff0ff),
  rock: L(0x8a4a56), rock2: L(0xa65a58), grass: L(0x9aa65f), grass2: L(0x7f9a58), sand: L(0xd8b985), white: L(0xe8d9c2), roof: L(0xc4413b),
  rotor: new THREE.MeshBasicMaterial({ color: 0xc9d2ee, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  glowCyan: new THREE.SpriteMaterial({ map: GLOW, color: 0x6fd8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  glowRed: new THREE.SpriteMaterial({ map: GLOW, color: 0xff4040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
};
const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
const glowAt = (parent, x, y, z, size, mat = MAT.glowCyan) => { const s = new THREE.Sprite(mat); s.scale.set(size, size, 1); s.position.set(x, y, z); parent.add(s); return s; };

// ── the hover deck: where a leg starts (and where the previous one lands) ──
export function buildHoverDeck({ pad = false } = {}) {
  const ship = new THREE.Group();
  const W = DECK_W, Zf = -DECK_LEN, Zb = DECK_BACK, len = Zb - Zf, zc = (Zb + Zf) / 2;
  const tex = deckTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(W / 15, len / 60);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 2.2, len), [
    L(0x2c2f44), L(0x2c2f44), new THREE.MeshLambertMaterial({ map: tex }), L(0x1b1d2b), L(0x2c2f44), L(0x2c2f44),
  ]);
  top.position.set(0, -1.1, zc); ship.add(top);
  box(W - 5, 3.2, len - 10, MAT.hull2, 0, -3.8, zc + 2, ship);
  box(W - 9, 3, len - 30, MAT.hull, 0, -6.6, zc + 4, ship);
  for (const sx of [-1, 1]) {
    box(0.28, 0.16, len, MAT.cyan, sx * (W / 2 - 0.2), 0.08, zc, ship);
    box(0.4, 0.7, len, MAT.steel, sx * (W / 2 - 0.2), 0.3, zc, ship);
    for (let z = Zf + 6; z < Zb - 3; z += 12) {
      box(0.5, 1.7, 0.5, L(0x2c2f44), sx * (W / 2 - 0.2), 0.8, z, ship);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), MAT.lampRed); lamp.position.set(sx * (W / 2 - 0.2), 1.75, z); ship.add(lamp);
    }
  }
  const hz = hazardTexture(); hz.wrapS = THREE.RepeatWrapping; hz.repeat.set(5, 1);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 1.4), new THREE.MeshBasicMaterial({ map: hz })); lip.position.set(0, 0.07, Zf + 0.8); ship.add(lip);
  for (const [x, z] of [[-5.2, -52], [5.4, -66], [-5.0, -78], [4.8, -40]]) { const cr = box(1.9, 1.7, 1.9, MAT.crate, x, 0.85, z, ship); cr.rotation.y = x * 0.2; }
  const thr = [];
  for (const [x, z] of [[-4, Zb - 6], [4, Zb - 6], [-4, zc], [4, zc], [-4, Zf + 10], [4, Zf + 10]]) thr.push(glowAt(ship, x, -8.6, z, 8));
  ship.userData.thrusters = thr;
  if (pad) {
    // touchdown marking where the glider lands
    const pz = -LAND_Z;
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.2, 6, 40), MAT.cyan); r1.rotation.x = Math.PI / 2; r1.position.set(0, 0.08, pz); ship.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.16, 6, 32), B(0xffd24a)); r2.rotation.x = Math.PI / 2; r2.position.set(0, 0.08, pz); ship.add(r2);
    const beam = new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const x of [-6.6, 6.6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 120, 10, 1, true), beam); b.position.set(x, 60, pz); ship.add(b); }
    glowAt(ship, 0, 22, pz, 30, new THREE.SpriteMaterial({ map: GLOW, color: 0xffe28a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  }
  return ship;
}

// ── a giant flying carrier (Avengers-helicarrier energy): top deck at y = 0, long axis along Z ──
export function makeCarrier(hx, hl, rnd, low = false) {
  const g = new THREE.Group(), W = hx * 2, Ln = hl * 2;
  const tex = deckTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, W / 15), Ln / 60);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 2.4, Ln), [L(0x2c2f44), L(0x2c2f44), new THREE.MeshLambertMaterial({ map: tex }), L(0x1b1d2b), L(0x2c2f44), L(0x2c2f44)]);
  slab.position.y = -1.2; g.add(slab);
  box(W * 0.8, 6, Ln * 0.92, MAT.hull2, 0, -5.4, 0, g);
  box(W * 0.52, 5, Ln * 0.72, MAT.hull, 0, -10.9, Ln * 0.05, g);
  box(W * 0.26, 4, Ln * 0.5, MAT.steel, 0, -15, Ln * 0.08, g);
  for (const sx of [-1, 1]) {
    box(0.5, 0.2, Ln, MAT.cyan, sx * (hx - 0.3), 0.08, 0, g);
    box(0.5, 0.2, Ln * 0.85, MAT.cyan, sx * W * 0.4, -3.2, 0, g);
  }
  // bridge tower toward the rear
  const bz = hl * 0.55;
  if (!low) {
  box(W * 0.42, 9, 15, MAT.hull, 0, 4.5, bz, g);
  box(W * 0.43, 1.1, 15.2, MAT.win, 0, 7.2, bz, g);
  box(W * 0.28, 5, 9, MAT.steel, 0, 11.5, bz, g);
  box(W * 0.29, 0.9, 9.2, MAT.win, 0, 12.2, bz, g);
  box(0.5, 9, 0.5, MAT.steel2, W * 0.08, 18, bz, g);
  glowAt(g, W * 0.08, 22.8, bz, 5, MAT.glowRed);
  // Foot Clan banner
  box(0.5, 7, 4.5, MAT.red, -W * 0.22, 6, bz + 3, g).rotation.z = 0;
  }
  // hangars + crates along the deck
  for (let i = 0; i < Math.max(2, Math.round(hl / 18)); i++) {
    const z = -hl * 0.8 + rnd() * hl * 1.0, x = (rnd() - 0.5) * (W * 0.55);
    if (Math.abs(z - bz) < 14) continue;
    if (low) { box(1.6, 0.5, 1.6, MAT.steel2, x, 0.25, z, g); continue; }
    if (rnd() < 0.5) box(4 + rnd() * 4, 2.6, 5 + rnd() * 4, MAT.steel, x, 1.3, z, g); else box(2.2, 2, 2.2, MAT.crate, x, 1, z, g);
  }
  // outrigger rotors, four of them, spinning
  g.userData.rotors = [];
  for (const sx of [-1, 1]) for (const sz of [-0.62, 0.5]) {
    const ox = sx * (hx + 9), oz = sz * hl;
    box(10, 1.2, 3, MAT.steel, sx * (hx + 3), -1.2, oz, g);
    box(2.6, 2.2, 2.6, MAT.hull, ox, -0.4, oz, g);
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.2, 24), MAT.rotor); rot.position.set(ox, 1.0, oz); g.add(rot);
    const blade = box(19, 0.18, 1.1, MAT.steel2, ox, 1.1, oz, g); g.userData.rotors.push(blade);
    const blade2 = box(1.1, 0.18, 19, MAT.steel2, ox, 1.1, oz, g); g.userData.rotors.push(blade2);
  }
  // thrusters under the hull
  g.userData.thrusters = [];
  for (const z of [-0.7, -0.25, 0.25, 0.7]) for (const sx of [-1, 1]) g.userData.thrusters.push(glowAt(g, sx * hx * 0.4, -17, z * hl, 17));
  // nav lights
  for (const z of [-0.95, 0, 0.95]) { glowAt(g, -hx + 0.4, 1.4, z * hl, 3.4, MAT.glowRed); box(0.9, 0.9, 0.9, MAT.lampGreen, hx - 0.4, 0.5, z * hl, g); }
  return g;
}

// ── a floating base island: top at y = 0 ──
export function makeIsland(r, rnd) {
  const g = new THREE.Group();
  const top = new THREE.CylinderGeometry(r, r * 0.93, 2.6, 10, 1);
  const pos = top.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); if (Math.hypot(x, z) > 0.1) { const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.08; pos.setX(i, x * k); pos.setZ(i, z * k); } }
  top.translate(0, -1.3, 0);
  g.add(new THREE.Mesh(top, [MAT.rock2, rnd() < 0.5 ? MAT.grass : MAT.grass2, MAT.rock]));
  const body = new THREE.ConeGeometry(r * 0.93, r * (1.0 + rnd() * 0.7), 9, 3).rotateX(Math.PI);
  const bp = body.attributes.position, bh = r * 1.0;
  for (let i = 0; i < bp.count; i++) { const k = 1 + (Math.sin(i * 78.233) * 12345.678 % 1) * 0.22; bp.setX(i, bp.getX(i) * k); bp.setZ(i, bp.getZ(i) * k); bp.setY(i, bp.getY(i) + (Math.sin(i * 3.1) * 0.5) * 2); }
  body.computeBoundingBox(); body.translate(0, -2.6 - body.boundingBox.max.y, 0);
  g.add(new THREE.Mesh(body, MAT.rock));
  const bb = body.boundingBox, tipY = -2.6 + bb.min.y - bb.max.y;
  const crystal = new THREE.Mesh(new THREE.ConeGeometry(r * 0.1, r * 0.45, 5).rotateX(Math.PI), B(0x7ff0ff)); crystal.position.y = tipY - r * 0.1; g.add(crystal);
  glowAt(g, 0, tipY - r * 0.2, 0, r * 1.2);
  // trees
  const nTrees = Math.round(r / 3.2);
  for (let i = 0; i < nTrees; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r * 0.78, h = 2.4 + rnd() * 3.6;
    const t = new THREE.Mesh(new THREE.ConeGeometry(h * 0.36, h, 5), L(new THREE.Color().setHSL(0.22 + rnd() * 0.08, 0.42, 0.34 + rnd() * 0.1)));
    t.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); g.add(t);
  }
  // a little Foot Clan outpost
  if (r > 20 || rnd() < 0.5) {
    const ox = (rnd() - 0.5) * r * 0.5, oz = (rnd() - 0.5) * r * 0.5;
    box(8, 4.2, 7, MAT.hull, ox, 2.1, oz, g); box(8.2, 0.9, 7.2, MAT.win, ox, 3.2, oz, g); box(8.8, 0.6, 7.8, MAT.steel2, ox, 4.5, oz, g);
    box(0.4, 8, 0.4, MAT.steel2, ox + 2.5, 8, oz, g); glowAt(g, ox + 2.5, 12.4, oz, 4.5, MAT.glowRed);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.0, 10, 1, true).rotateX(Math.PI * 0.8), MAT.steel2); dish.position.set(ox - 2, 5.6, oz + 1); g.add(dish);
    box(1.4, 8.0, 1.4, MAT.red, ox - 5.2, 4, oz - 3.6, g).scale.set(0.4, 1, 3.2);
  }
  for (let i = 0; i < Math.round(r / 9); i++) { const a = rnd() * 6.28, d = r * (0.3 + rnd() * 0.5), s = 1 + rnd() * 2.2; const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), MAT.steel2); rk.position.set(Math.cos(a) * d, s * 0.4, Math.sin(a) * d); rk.rotation.set(rnd(), rnd(), rnd()); g.add(rk); }
  return g;
}

const _t = {};
export class LegWorld {
  constructor(leg, scene, adoptShip = null) {
    this.leg = leg; this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.rings = []; this.rotors = []; this.thrusters = []; this.cores = []; this.turrets = []; this.smalls = []; this.orbs = []; this.falling = [];
    // the start deck exists only for the very first leg; every later leg hands over in mid-air
    this.ship = null;
    if (!leg.air) { this.ship = adoptShip || buildHoverDeck({ pad: false }); this.group.add(this.ship); this.thrusters.push(...this.ship.userData.thrusters); }
    this._structs(); this._rings(); this._orbs();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  _structs() {
    const leg = this.leg;
    for (const st of leg.structs) {
      const rnd = mulberry32(st.seed || 7);
      let g;
      if (st.kind === 'ship') {
        g = makeCarrier(st.hx, st.hl, rnd, !!st.skim || !!st.raid);
        g.rotation.order = 'YXZ';
        g.position.set(st.x, st.ty0, st.z); g.rotation.y = st.yaw;
        if (st.kz) g.rotation.x = -Math.atan(st.kz);
        this.rotors.push(...g.userData.rotors); this.thrusters.push(...g.userData.thrusters);
        if (st.raid) this._raidKit(st, g, rnd);
        if (st.targets) this._deckTargets(st, g);
      } else {
        g = makeIsland(st.r, rnd);
        g.position.set(st.x, st.ty0, st.z); g.rotation.y = rnd() * 6;
      }
      st.group = g;
      this.group.add(g);
    }
  }

  /** a raided gunship: a reactor core on a pylon (the big target) and a few turrets */
  _raidKit(st, g, rnd) {
    box(2.2, 8.6, 2.2, MAT.steel2, 0, 4.3, 0, g); box(4.2, 0.6, 4.2, MAT.hull, 0, 8.7, 0, g);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), B(0xff6a4a)); core.position.set(0, 9.8, 0); g.add(core); st.coreMesh = core;
    glowAt(g, 0, 9.8, 0, 10, MAT.glowRed);
    this.cores.push({ pos: new THREE.Vector3(st.x, st.ty0 + 9.8, st.z), s: st.s, st });
    const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
    for (const [lx, lz] of [[-st.hx * 0.55, -st.hl * 0.5], [st.hx * 0.55, -st.hl * 0.1], [-st.hx * 0.5, st.hl * 0.4]]) {
      box(1.8, 1.0, 1.8, MAT.hull, lx, 0.5, lz, g); box(0.35, 0.35, 2.4, MAT.steel2, lx, 1.3, lz - 1.0, g);
      this.turrets.push({ pos: new THREE.Vector3(st.x + lx * c + lz * sn, st.ty0 + 1.4, st.z - lx * sn + lz * c), ship: st, s: st.s - lz, cd: 1 + rnd() * 2.5, tele: 0 });
    }
  }

  /** targets spread across a deck (cargo / AA nests): line up your lane position and shoot them */
  _deckTargets(st, g) {
    const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
    for (const t of st.targets) {
      const dx = t.x - st.x, dz = t.z - st.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      box(3.0, 0.5, 3.0, MAT.red, lx, 0.35, lz, g); box(1.6, 1.3, 1.6, MAT.crate, lx, 1.1, lz, g);
      this.smalls.push({ pos: new THREE.Vector3(t.x, t.y + 1.0, t.z), s: t.s, hp: t.hp, st });
    }
  }

  /** the core went down: the ship breaks away and falls out of the sky */
  sink(st) { st.dead = true; if (st.coreMesh) st.coreMesh.visible = false; this.falling.push({ st, t: 0 }); }

  _rings() {
    const leg = this.leg;
    const mat = new THREE.MeshBasicMaterial({ color: 0x66ffe6, transparent: true, opacity: 0.9 });
    for (const rp of leg.ringPlan) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(rp.r, 0.34, 6, 30), mat);
      leg.at(rp.s, rp.lat, _t); r.position.set(_t.x, leg.pathYAt(rp.s) + 0.2, _t.z); r.rotation.y = -leg.hdgAt(rp.s);
      this.group.add(r); this.rings.push({ s: rp.s, lat: rp.lat, mesh: r, got: false });
    }
  }

  /** loop power-ups: a gold ring-in-a-ring with a halo, floating on the path in the chase sections */
  _orbs() {
    const leg = this.leg;
    for (const o of leg.orbs) {
      const g = new THREE.Group();
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 8, 28), B(0xffd24a)), r2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.22, 8, 24), B(0xff8be8)); r2.rotation.y = Math.PI / 2;
      g.add(r1, r2, new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), B(0xffffff)));
      glowAt(g, 0, 0, 0, 12, new THREE.SpriteMaterial({ map: GLOW, color: 0xffd06a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
      leg.at(o.s, o.lat, _t); g.position.set(_t.x, leg.pathYAt(o.s) + 0.6, _t.z); g.rotation.y = -leg.hdgAt(o.s);
      this.group.add(g); this.orbs.push({ s: o.s, lat: o.lat, g, got: false });
    }
  }

  update(dt, t) {
    for (const th of this.thrusters) { const k = 1 + Math.sin(t * 17 + th.position.z * 0.7 + th.position.x) * 0.07; th.material.opacity = 0.85 + (k - 1) * 1.5; }
    for (let i = 0; i < this.rotors.length; i++) this.rotors[i].rotation.y += dt * 11;
    for (const o of this.orbs) if (!o.got) { o.g.rotation.y += dt * 2.4; o.g.rotation.z += dt * 1.1; }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.t += dt; const g = f.st.group;
      g.position.y -= (4 + f.t * 26) * dt; g.rotation.z += dt * 0.55 * (f.st.x > 0 ? 1 : -1); g.rotation.x += dt * 0.22;
      if (f.t > 3.2) { g.visible = false; this.falling.splice(i, 1); }
    }
  }
}

// ── clouds: a persistent field around the glider, recycled ahead as he flies, shifted on every deck re-base ──
export class Clouds {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.texs = [cloudTexture(11), cloudTexture(23), cloudTexture(37), cloudTexture(51)];
    this.items = [];
    this.rnd = mulberry32(2024);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.texs[i % 4], color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
      const sp = new THREE.Sprite(mat); this.group.add(sp);
      this.items.push({ sp, base: 0.3 + this.rnd() * 0.3 });
    }
  }
  _place(c, pos, spreadZ) {
    const r = this.rnd;
    const below = r() < 0.4;                                    // a sea of cloud under him, scattered cloud around him
    const k = below ? 120 + r() * 160 : 40 + r() * 90;
    const sc = below ? k * 1.3 : k;
    c.sp.scale.set(sc * 1.9, sc * 0.78, 1);
    let x = pos.x + (r() - 0.5) * (below ? 900 : 640), y = pos.y + (below ? -(150 + r() * 200) : (r() - 0.62) * 150), z = pos.z - 60 - r() * spreadZ;
    if (this.radial) { const a = r() * 6.28, d = 150 + r() * 520; x = pos.x + Math.sin(a) * d; z = pos.z + Math.cos(a) * d; }
    else if (!below && Math.abs(x - pos.x) < 34 && Math.abs(y - pos.y) < 16) x += (x < pos.x ? -1 : 1) * 60;   // keep the lane clear
    c.sp.position.set(x, y, z);
    c.below = below;
  }
  reset(pos) { for (const c of this.items) this._place(c, pos, 900); }
  shift(o) { for (const c of this.items) c.sp.position.sub(o); }
  update(pos, camPos) {
    for (const c of this.items) {
      const p = c.sp.position;
      const far = this.radial ? Math.hypot(p.x - pos.x, p.z - pos.z) > 760 : p.z > pos.z + 70 || Math.abs(p.x - pos.x) > 560;
      if (far || Math.abs(p.y - pos.y) > 420) this._place(c, pos, 380 + 520 * this.rnd());
      const d = p.distanceTo(camPos), fade = smoothstep(c.below ? 60 : 38, c.below ? 160 : 100, d);
      c.sp.material.opacity = c.base * fade;
    }
  }
}
