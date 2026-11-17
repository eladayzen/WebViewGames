import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ── The street grid ──────────────────────────────────────────────────────────
// The route is a chain of pieces: straight streets, each ending at a T-junction where the
// player turns left or right (a 90° arc). A point on the route is (s, u): s = metres along
// it, u = metres right of its centre line. At heading h, forward is (sin h, 0, -cos h) and
// right is (cos h, 0, sin h); h = 0 faces -Z.
export const HW = 10.8;         // half-width of the drivable road: 6 lanes of 3.6 m
export const WALK = 6;          // sidewalk width
export const CURB = 0.16;
export const LANES = [-9, -5.4, -1.8, 1.8, 5.4, 9];
export const FAC = HW + WALK;   // building fronts
const DEPTH = 16;               // building depth
const RF = 150, FORK_ANG = 0.5; // Y-fork: each branch bends ~29° away on a 150 m radius
const FORK_ARC = RF * FORK_ANG;
const SEG = 24;                 // generation chunk (m)
const AHEAD = 380, BEHIND = 70;
const ARM = 200;                // how much of each branch is built before the choice
export const DECIDE_AT = 55;    // metres before the junction the choice locks in

function pose(p, d, u, out) {
  let x, z, h;
  if (p.type === 'arc') {
    const dd = Math.max(0, Math.min(p.len, d));
    h = p.h0 + p.turn * dd / p.R;
    const cx = p.x0 + Math.cos(p.h0) * p.turn * p.R, cz = p.z0 + Math.sin(p.h0) * p.turn * p.R;
    x = cx - Math.cos(h) * p.turn * p.R; z = cz - Math.sin(h) * p.turn * p.R;
    const over = d - p.len, under = d;
    if (over > 0) { x += Math.sin(h) * over; z -= Math.cos(h) * over; }
    if (under < 0) { x += Math.sin(p.h0) * under; z -= Math.cos(p.h0) * under; }
  } else {
    h = p.h0;
    x = p.x0 + Math.sin(h) * d; z = p.z0 - Math.cos(h) * d;
  }
  out.x = x + Math.cos(h) * u; out.z = z + Math.sin(h) * u; out.h = h;
  return out;
}

class Path {
  constructor() { this.reset(); }
  reset() { this.pieces = []; this.end = { x: 0, z: 0, h: 0, s: 0 }; this.junction = null; }
  push(p) {
    p.s0 = this.end.s; p.x0 = this.end.x; p.z0 = this.end.z; p.h0 = this.end.h;
    this.pieces.push(p);
    const e = pose(p, p.len, 0, {});
    this.end = { x: e.x, z: e.z, h: e.h, s: p.s0 + p.len };
    return p;
  }
  find(s) {
    const P = this.pieces;
    for (let i = P.length - 1; i > 0; i--) if (s >= P[i].s0) return P[i];
    return P[0];
  }
  prune(s) { while (this.pieces.length > 3 && this.pieces[1].s0 + this.pieces[1].len < s - 300) this.pieces.shift(); }
}
export const path = new Path();

const _o = {};
export function pointAt(s, u, out = new THREE.Vector3()) {
  const p = path.find(s);
  pose(p, s - p.s0, u, _o);
  return out.set(_o.x, 0, _o.z);
}
export function frameAt(s, T = new THREE.Vector3(), R = new THREE.Vector3()) {
  const p = path.find(s);
  pose(p, s - p.s0, 0, _o);
  T.set(Math.sin(_o.h), 0, -Math.cos(_o.h));
  R.set(Math.cos(_o.h), 0, Math.sin(_o.h));
  return { T, R };
}
// a point on one branch of a fork, `d` metres past the junction — for a car that went the
// other way from the route (April, when the wagon takes the wrong fork). Returns { x, z, h }.
export function forkPoint(J, turn, d, u, out = {}) {
  const [arc, line] = J.branch[turn];
  return d < arc.len ? pose(arc, d, u, out) : pose(line, d - arc.len, u, out);
}
export function yawAt(s) { const p = path.find(s); pose(p, s - p.s0, 0, _o); return -_o.h; }
const lpt = (p, d, u, out = new THREE.Vector3()) => { pose(p, d, u, _o); return out.set(_o.x, 0, _o.z); };
const lh = (p, d) => pose(p, d, 0, _o).h;

function tiledBox(w, h, d, tileW, tileH, uOff = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uOff + uv.getX(i) * dims[f][0] / tileW, uv.getY(i) * dims[f][1] / tileH);
  }
  return g;
}

// ── Wet street: puddles carry a screen-space planar reflection rendered by main.js ──
export const refl = { tRefl: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
  uF0: { value: 0.06 }, uF1: { value: 0.5 }, uSheen: { value: 0.3 } };
// returns the material; its own wet/dark uniforms are on mat.userData.wet for the dev panel
function makeWet(mat, wet, dark) {
  const U = { uWet: { value: wet }, uDark: { value: dark } };
  mat.userData.wet = U;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tRefl = refl.tRefl; sh.uniforms.uRes = refl.uRes;
    sh.uniforms.uWet = U.uWet; sh.uniforms.uDark = U.uDark;
    sh.uniforms.uF0 = refl.uF0; sh.uniforms.uF1 = refl.uF1; sh.uniforms.uSheen = refl.uSheen;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; uniform sampler2D tRefl; uniform vec2 uRes; uniform float uWet; uniform float uDark; uniform float uF0; uniform float uF1; uniform float uSheen;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
{
  float pud = smoothstep(0.5, 0.72, vn(vWPos.xz * 0.11) * 0.65 + vn(vWPos.xz * 0.43) * 0.35);
  vec3 vd = normalize(vViewPosition);
  float fres = uF0 + uF1 * pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 4.0);
  vec2 jit = vec2((vn(vWPos.xz * 3.1) - 0.5) * mix(0.012, 0.004, pud), 0.0);
  vec2 uv0 = gl_FragCoord.xy / uRes + jit;
  float st = mix(0.05, 0.018, pud);
  vec3 rc = vec3(0.0); float ws = 0.0;
  float dz = h21(gl_FragCoord.xy);
  for (int i = 0; i < 8; i++) { float t = (float(i) + dz) / 8.0; float wt = 1.0 - t * 0.75; rc += texture2D(tRefl, uv0 + vec2((dz - 0.5) * 0.004, t * st)).rgb * wt; ws += wt; }
  rc /= ws;
  float w = uWet * mix(uSheen, 1.0, pud) * fres;
  gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - uDark * mix(0.55, 1.0, pud)) + rc * w;
}`);
  };
  return mat;
}

function glowTex(color, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function arrowTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(64, 8); x.lineTo(122, 96); x.lineTo(86, 96); x.lineTo(86, 248); x.lineTo(42, 248); x.lineTo(42, 96); x.lineTo(6, 96); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const GLOW = { warm: null, purple: null, green: null, blue: null };

export class World {
  constructor(stage, tex) {
    this.root = new THREE.Group();
    stage.add(this.root);
    const rep = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
    const hdr = (r, g, b) => new THREE.Color(r, g, b);
    GLOW.warm = glowTex('rgba(255,196,120,1)'); GLOW.purple = glowTex('rgba(170,90,255,1)'); GLOW.green = glowTex('rgba(120,255,110,1)'); GLOW.blue = glowTex('rgba(90,160,255,1)');
    const facade = (map, glow, em, tint = 0xffffff) => new THREE.MeshLambertMaterial({ map: rep(map), emissiveMap: rep(glow), emissive: em, color: tint });
    this.mat = {
      road: makeWet(new THREE.MeshLambertMaterial({ map: rep(tex.asphalt), color: 0x8a8ca8 }), 0.6, 0.3),
      walk: makeWet(new THREE.MeshLambertMaterial({ map: rep(tex.sidewalk), color: 0x9a96b0 }), 0.15, 0.12),
      curb: new THREE.MeshLambertMaterial({ color: 0x5a5666 }),
      white: new THREE.MeshLambertMaterial({ color: 0xe8e6de, emissive: 0x2a2a30 }),
      yellow: new THREE.MeshLambertMaterial({ color: 0xffc42e, emissive: 0x3a2a00 }),
      tower: facade(tex.office_n, tex.office_glow, hdr(1.1, 1.1, 1.2), 0x9aa0c0),
      roof: new THREE.MeshLambertMaterial({ color: 0x23202e }),
      cornice: new THREE.MeshLambertMaterial({ color: 0x4a4458 }),
      iron: new THREE.MeshLambertMaterial({ color: 0x1c1a22 }),
      wood: new THREE.MeshLambertMaterial({ color: 0x5a3f2e }),
      pole: new THREE.MeshLambertMaterial({ color: 0x1f2a26 }),
      lamp: new THREE.MeshBasicMaterial({ color: hdr(1.25, 1.05, 0.75) }),   // soft bulb: the light is the pool, not the glare
      manhole: new THREE.MeshLambertMaterial({ color: 0x2a2833 }),
      pool: new THREE.MeshBasicMaterial({ map: GLOW.warm, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }),
      arrow: new THREE.MeshBasicMaterial({ map: arrowTex(), transparent: true, depthWrite: false, color: hdr(0.85, 0.75, 0.22), polygonOffset: true, polygonOffsetFactor: -3 }),
    };
    // upper floors: four facades × colour casts, so neighbours rarely match
    const W = hdr(0.95, 0.85, 0.68), Wo = hdr(0.85, 0.85, 0.85), W2 = hdr(1.0, 0.9, 0.72), Wo2 = hdr(0.92, 0.9, 0.86);
    this.uppers = [
      { m: facade(tex.brick_n, tex.brick_glow, W), tw: 9, brick: true },
      { m: facade(tex.brick_n, tex.brick_glow, W, 0xc8b8ff), tw: 9, brick: true },
      { m: facade(tex.brick2_n, tex.brick2_glow, W2), tw: 9, brick: true },
      { m: facade(tex.brick2_n, tex.brick2_glow, W2, 0xa8d0c0), tw: 9, brick: true },
      { m: facade(tex.office_n, tex.office_glow, Wo), tw: 10 },
      { m: facade(tex.office_n, tex.office_glow, Wo, 0xd8c0a8), tw: 10 },
      { m: facade(tex.office2_n, tex.office2_glow, Wo2), tw: 10 },
      { m: facade(tex.office2_n, tex.office2_glow, Wo2, 0xb8c8ff), tw: 10 },
    ];
    this.grounds = [
      facade(tex.shops_n, tex.shops_glow, hdr(1.15, 1.15, 1.15)),
      facade(tex.shops2_n, tex.shops2_glow, hdr(1.3, 1.3, 1.3)),
    ];
    tex.neon.colorSpace = THREE.SRGBColorSpace;
    this.neonMats = [0, 1, 2, 3].map((i) => {
      const t = tex.neon.clone(); t.needsUpdate = true;
      t.repeat.set(0.5, 0.5); t.offset.set((i % 2) * 0.5, i < 2 ? 0.5 : 0);
      return new THREE.MeshBasicMaterial({ map: t, color: hdr(1.05, 1.05, 1.05), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    });
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x17141f }));
    this.base.rotation.x = -Math.PI / 2;
    this.root.add(this.base);
    this.reset();
  }

  // firstLen: metres of straight before the first fork (levels use it to pace their tutorial)
  reset(firstLen = 360) {
    if (this.chunks) for (const c of this.chunks) this._drop(c.group);
    if (this.previews) for (const pv of this.previews) this._drop(pv.group);
    this.chunks = [];     // { sEnd, group } — built parts of the route
    this.previews = [];   // { turn, J, sts, group } — both branches of a fork, built before the choice
    this.ground = [this.base];
    this.lamps = [];      // { s, pos, p, g }
    this.vents = [];      // steaming manholes { s, pos, p, g }
    this.gen = [];        // route generators still running
    this.jcount = 0; this.legs = 0;
    path.reset();
    this._street(firstLen, 11, { from: -80 });
  }
  _drop(g) {
    this.root.remove(g);
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    const inside = (o) => { let q = o; while (q) { if (q === g) return true; q = q.parent; } return false; };
    this.ground = this.ground.filter((m) => !inside(m));
    this.lamps = this.lamps.filter((l) => !inside(l.g));
    this.vents = this.vents.filter((l) => !inside(l.g));
  }
  setGroundVisible(v) { for (const m of this.ground) m.visible = v; }
  // dev-panel knobs: window glow and neon-sign brightness as multipliers on the authored values
  setGlow(windows, signs) {
    for (const m of [...this.uppers.map((u) => u.m), ...this.grounds, this.mat.tower]) {
      m.userData.em0 ??= m.emissive.clone();
      m.emissive.copy(m.userData.em0).multiplyScalar(windows);
    }
    for (const m of this.neonMats) m.color.setScalar(signs);
  }
  routeLamps() { return this.lamps.filter((l) => path.pieces.includes(l.p)); }
  routeVents() { return this.vents.filter((l) => path.pieces.includes(l.p)); }

  // generator state for one piece (straight or curved), in piece-local metres
  _genState(p, o = {}) {
    const from = o.from ?? 0;
    const inner = o.inner || 0;
    const cr = mulberry(p.seed * 7 + 9)();
    return {
      p, d: from, preview: !!o.preview, end: o.preview ? o.previewEnd : p.len,
      roadFrom: from, roadY: o.roadY || 0, paintFrom: o.paintFrom ?? from,
      inner, innerWalkFrom: o.innerWalkFrom ?? from, cur: [from, from], innerBFrom: o.innerBFrom ?? from,
      rng: [mulberry(p.seed * 7 + 1), mulberry(p.seed * 7 + 2)],
      // one pass-through cross street on longer straights
      cross: o.noCross || p.type !== 'line' || p.len < 220 ? null : 95 + cr * (p.len - 190),
      lastLeg: !!o.lastLeg,
    };
  }

  // Route plan: a straight, then alternately a forced gentle bend or a Y-fork (the only
  // place the player chooses — a 90° turn at chase speed looked bad).
  _street(len, seed, o = {}) {
    const p = path.push({ type: 'line', len, seed });
    const st = this._genState(p, o);
    this.gen.push(st);
    this.legs++;
    st.lastLeg = this.legs % 2 !== 0; // arrows only on streets that end in a fork
    if (this.legs % 2 === 0) {
      const r = mulberry(seed * 13 + 3);
      const turn = r() < 0.5 ? -1 : 1, R = 140 + r() * 70, ang = 0.32 + r() * 0.3;
      const b = path.push({ type: 'arc', len: R * ang, R, turn, seed: seed + 500 });
      this.gen.push(this._genState(b));
      this._street(220 + r() * 160, seed + 1);
    } else this._fork();
  }

  // Y-fork at the end of the route: both branches build now so the choice is visible.
  _fork() {
    const J = { s: path.end.s, x: path.end.x, z: path.end.z, h: path.end.h, id: ++this.jcount, decided: 0 };
    path.junction = J;
    J.branch = {};   // turn -> [arc, line]: where a car that takes that branch drives (forkPoint)
    const sep = (k) => RF * Math.acos(1 - k / RF); // arc distance where branches are k apart (each side)
    for (const turn of [-1, 1]) {
      const seed = 1000 + J.id * 4 + (turn > 0 ? 2 : 0);
      const arc = { type: 'arc', len: FORK_ARC, R: RF, turn, seed, x0: J.x, z0: J.z, h0: J.h, s0: J.s };
      const e = pose(arc, FORK_ARC, 0, {});
      const line = { type: 'line', len: ARM, seed: seed + 1, x0: e.x, z0: e.z, h0: e.h, s0: J.s + FORK_ARC };
      const lineInnerB = Math.max(0, ((2 * FAC + DEPTH) / 2 - RF * (1 - Math.cos(FORK_ANG))) / Math.sin(FORK_ANG));
      J.branch[turn] = [arc, line];
      const sts = [
        this._genState(arc, { preview: true, previewEnd: FORK_ARC, inner: -turn, paintFrom: sep(HW), innerWalkFrom: sep(FAC), innerBFrom: Infinity, roadY: turn > 0 ? 0.004 : 0, noCross: true }),
        this._genState(line, { preview: true, previewEnd: ARM, inner: -turn, innerBFrom: lineInnerB, noCross: true }),
      ];
      const group = new THREE.Group();
      this.root.add(group);
      this.previews.push({ turn, J, sts, group });
    }
  }

  // Lock in the branch. Its preview pieces become the route — same pieces, same generators,
  // same meshes — so nothing is rebuilt and nothing pops.
  decide(turn) {
    const J = path.junction;
    if (!J || J.decided) return;
    J.decided = turn;
    path.junction = null;
    const pv = this.previews.find((v) => v.J === J && v.turn === turn);
    this.previews = this.previews.filter((v) => v !== pv);
    const [as, ls] = pv.sts;
    path.push(as.p);
    ls.p.len = 240 + ((J.id * 97) % 170);
    path.push(ls.p);
    as.preview = false; as.end = as.p.len;
    ls.preview = false; ls.end = ls.p.len;
    this.chunks.push({ sEnd: ls.p.s0 + ls.d, group: pv.group });
    this.gen.push(as, ls);
    this.legs++;
    // what follows the branch: a bend then a street, or straight on to the next fork
    const r = mulberry(J.id * 31 + 7);
    const bend = r() < 0.5;
    ls.lastLeg = !bend;
    if (bend) {
      const t2 = r() < 0.5 ? -1 : 1, R = 150 + r() * 60, ang = 0.3 + r() * 0.25;
      const b = path.push({ type: 'arc', len: R * ang, R, turn: t2, seed: 3000 + J.id });
      this.gen.push(this._genState(b));
      this._street(200 + r() * 150, 4000 + J.id * 3);
    } else this._fork();
  }

  update(playerS) {
    pointAt(playerS, 0, this.base.position).setY(-0.04);
    let budget = 3; // chunks per frame: spread the work, no hitch at a fork
    for (const st of this.gen) {
      while (budget > 0 && st.d < st.end && st.p.s0 + st.d < playerS + AHEAD) {
        const g = new THREE.Group();
        this._chunk(st, g);
        this.root.add(g);
        this.chunks.push({ sEnd: st.p.s0 + Math.min(st.d, st.end), group: g });
        budget--;
      }
    }
    this.gen = this.gen.filter((st) => st.d < st.end);
    for (const pv of this.previews) {
      if (pv.J.s > playerS + AHEAD + 40) continue;
      for (const st of pv.sts) while (budget > 0 && st.d < st.end) { this._chunk(st, pv.group); budget--; }
    }
    this.chunks.sort((a, b) => a.sEnd - b.sEnd);
    while (this.chunks.length && this.chunks[0].sEnd < playerS - BEHIND) this._drop(this.chunks.shift().group);
    for (const pv of this.previews) if (pv.J.s < playerS - 280) { this._drop(pv.group); pv.dead = true; }
    this.previews = this.previews.filter((v) => !v.dead);
    path.prune(playerS);
  }

  // build [st.d, st.d + SEG) of a piece into group g
  _chunk(st, g) {
    const p = st.p, d0 = st.d, d1 = Math.min(d0 + SEG, st.end);
    st.d = d0 + SEG;
    const end = st.end;
    const clip = (a, b) => [Math.max(a, d0), Math.min(b, d1)];
    const strip = (pc, a, b, u0, u1, y0, y1, mat, vScale = 1, uScale = 1) => {
      if (b - a < 0.01) return;
      const N = Math.max(1, Math.ceil((b - a) / 6)), pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const d = a + ((b - a) * i) / N;
        const A = lpt(pc, d, u0), B = lpt(pc, d, u1);
        pos.push(A.x, y0, A.z, B.x, y1, B.z);
        uv.push(u0 / uScale, d / vScale, u1 / uScale, d / vScale);
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); this.ground.push(m);
    };
    const X = st.cross;
    // ranges [a,b) minus the cross street's mouth
    const minusCross = (a, b, half) => (X == null ? [[a, b]] : [[a, Math.min(b, X - half)], [Math.max(a, X + half), b]]);

    let [a, b] = clip(st.roadFrom, end);
    strip(p, a, b, -HW, HW, st.roadY, st.roadY, this.mat.road, 9, 9);
    for (const sg of [-1, 1]) {
      const from = sg === st.inner ? st.innerWalkFrom : st.roadFrom;
      for (const [ra, rb] of minusCross(from, end, HW)) {
        [a, b] = clip(ra, rb);
        if (sg < 0) { strip(p, a, b, -FAC, -HW, CURB, CURB, this.mat.walk, 3, 3); strip(p, a, b, -HW, -HW, CURB, 0, this.mat.curb); }
        else { strip(p, a, b, HW, FAC, CURB, CURB, this.mat.walk, 3, 3); strip(p, a, b, HW, HW, 0, CURB, this.mat.curb); }
      }
    }
    // paint: edge lines always; centre and lanes once a fork's two roads have separated
    const py = 0.012 + st.roadY;
    [a, b] = clip(st.roadFrom, end);
    if (st.inner !== 1) strip(p, a, b, HW - 0.45, HW - 0.25, py, py, this.mat.white);
    if (st.inner !== -1) strip(p, a, b, -HW + 0.25, -HW + 0.45, py, py, this.mat.white);
    [a, b] = clip(st.paintFrom, end);
    if (b > a) {
      strip(p, a, b, -0.26, -0.08, py, py, this.mat.yellow); strip(p, a, b, 0.08, 0.26, py, py, this.mat.yellow);
      for (const u of [-7.2, -3.6, 3.6, 7.2]) for (let d = Math.ceil(a / 9) * 9; d < b; d += 9) {
        const da = Math.max(d, a), db = Math.min(d + 4.5, b);
        if (db > da) strip(p, da, db, u - 0.08, u + 0.08, py, py, this.mat.white);
      }
    }
    // fork arrows on the approach: left half bears left, right half bears right
    if (st.lastLeg && !st.preview) for (const ad of [p.len - 120, p.len - 92]) if (ad >= d0 && ad < d1) {
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 9), this.mat.arrow);
        const q = lpt(p, ad, side * HW * 0.5);
        m.position.set(q.x, 0.03, q.z);
        m.rotation.order = 'YXZ';
        m.rotation.set(-Math.PI / 2, -lh(p, ad) - side * 0.55, 0);
        g.add(m); this.ground.push(m);
      }
    }
    // pass-through cross street: zebras either side, its own road, sidewalks, lamps, buildings
    if (X != null) {
      for (const [za, zb] of [[X - HW - 5.5, X - HW - 1.5], [X + HW + 1.5, X + HW + 5.5]]) {
        [a, b] = clip(za, zb);
        if (b > a) for (let u = -HW + 1; u < HW - 1; u += 1.6) strip(p, a, b, u, u + 0.8, 0.013, 0.013, this.mat.white);
      }
      if (X >= d0 && X < d1) this._crossStreet(st, X, g, strip);
    }
    // a steaming manhole now and then, between the lanes
    if (d1 - d0 > 12 && (Math.floor(d0 / SEG) * 7919) % 5 < 2) {
      const md = d0 + 6 + ((Math.floor(d0) * 31) % 12), mu = [-7.2, -3.6, 0, 3.6, 7.2][((Math.floor(d0) % 5) + 5) % 5];
      if (md < end - 4 && (X == null || Math.abs(md - X) > HW + 6)) {
        const q = lpt(p, md, mu);
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), this.mat.manhole);
        m.rotation.x = -Math.PI / 2; m.position.set(q.x, st.roadY + 0.02, q.z);
        g.add(m); this.ground.push(m);
        this.vents.push({ s: p.s0 + md, pos: new THREE.Vector3(q.x, 0.2, q.z), p, g });
      }
    }
    // one row of lamps zig-zagging across the street: left, right, left…
    const LS = 24;
    for (let d = Math.ceil(Math.max(d0, st.roadFrom + 6) / LS) * LS; d < Math.min(d1, end - 4); d += LS) {
      const sg = Math.round(d / LS) % 2 ? 1 : -1;
      if (sg === st.inner && d < st.innerWalkFrom + 4) continue;
      if (X != null && Math.abs(d - X) < HW + 2) continue;
      g.add(this._lamp(p, d, sg));
    }
    [-1, 1].forEach((sg) => {
      const ci = sg < 0 ? 0 : 1;
      if (sg === st.inner && st.cur[ci] < st.innerBFrom) st.cur[ci] = st.innerBFrom;
      while (st.cur[ci] < d1 && st.cur[ci] < end) {
        let lim = end;
        if (X != null) {
          const w0 = X - FAC - 0.5, w1 = X + FAC + 0.5;
          if (st.cur[ci] >= w0 && st.cur[ci] < w1) { st.cur[ci] = w1; continue; }
          if (st.cur[ci] < w0) lim = Math.min(end, w0);
        }
        const bl = this._building(p, st.cur[ci], sg, st.rng[ci], lim);
        st.cur[ci] = bl.next;
        if (bl.group) g.add(bl.group);
      }
    });
  }

  // a side street crossing the route at X: built out to 90 m each way
  _crossStreet(st, X, g, strip) {
    const p = st.p;
    const c = pose(p, X, 0, {});
    const r = mulberry(p.seed * 7 + 5);
    for (const side of [-1, 1]) {
      const q = { type: 'line', len: 90, x0: c.x, z0: c.z, h0: c.h + side * Math.PI / 2 };
      strip(q, HW, 90, -HW, HW, 0, 0, this.mat.road, 9, 9);
      strip(q, HW, 90, -FAC, -HW, CURB, CURB, this.mat.walk, 3, 3); strip(q, HW, 90, -HW, -HW, CURB, 0, this.mat.curb);
      strip(q, HW, 90, HW, FAC, CURB, CURB, this.mat.walk, 3, 3); strip(q, HW, 90, HW, HW, 0, CURB, this.mat.curb);
      strip(q, FAC + 2, 90, -0.26, -0.08, 0.012, 0.012, this.mat.yellow); strip(q, FAC + 2, 90, 0.08, 0.26, 0.012, 0.012, this.mat.yellow);
      for (const d of [32, 62]) { const l = this._lamp(q, d, side); g.add(l); }
      for (const sg of [-1, 1]) {
        let cur = FAC + DEPTH + 0.5;
        while (cur < 90) { const bl = this._building(q, cur, sg, r, 90); cur = bl.next; if (bl.group) g.add(bl.group); }
      }
    }
  }

  _lamp(p, d, side) {
    const g = new THREE.Group();
    const base = lpt(p, d, side * (HW + 0.9));
    g.position.set(base.x, CURB, base.z);
    g.rotation.y = -lh(p, d);
    // (the pole, arm and lamp head were removed so the wagon can use the sidewalk; the light
    // and its pool on the road stay)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), this.mat.pool);
    pool.rotation.x = -Math.PI / 2; pool.position.set(-side * 4.5, 0.03 - CURB, 0);
    g.add(pool); this.ground.push(pool);
    const lp = lpt(p, d, side * (HW - 1.3)); lp.y = 7;
    this.lamps.push({ s: p.s0 + d, pos: lp, p, g });
    return g;
  }

  // One building at local distance d on one side: packed tight, sometimes set back, now and
  // then a gap (alley / lot) so the frontage breathes. Every call draws from that side's
  // seeded rng in a fixed order, so a street always rebuilds identically.
  _building(p, d, sign, r, end) {
    let w = 9 + r() * 13;
    const gap = r() < 0.16 ? 5 + r() * 9 : 0.05;
    const setback = r() < 0.25 ? 1.5 + r() * 2.5 : 0;
    const floors = 2 + Math.floor(r() * 8);
    const U = this.uppers[Math.floor(r() * this.uppers.length)];
    const G = this.grounds[Math.floor(r() * this.grounds.length)];
    const uo = r(), fe = r(), fz = r(), wt = r(), wx = r(), wz = r(), nn = r(), nm = r(), ny = r(), nz = r(), tw0 = r(), tw1 = r(), tw2 = r();
    if (d + w > end) w = end - d;
    const next = d + w + gap;
    if (w < 4) return { next };
    const dm = d + w / 2;
    const ground = 4.4, up = floors * 3.5, top = ground + up;
    const g = new THREE.Group();
    const c = lpt(p, dm, sign * (FAC + setback + DEPTH / 2));
    g.position.set(c.x, 0, c.z);
    g.rotation.y = -lh(p, dm);
    const face = -sign * DEPTH / 2;
    const gb = new THREE.Mesh(tiledBox(DEPTH, ground, w, 16, ground, uo), G); gb.position.y = ground / 2;
    const ub = new THREE.Mesh(tiledBox(DEPTH, up, w, U.tw, 7, uo), U.m); ub.position.y = ground + up / 2;
    const cor = new THREE.Mesh(new THREE.BoxGeometry(DEPTH + 0.9, 0.7, w + 0.2), this.mat.cornice); cor.position.y = top + 0.2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(DEPTH, 0.4, w), this.mat.roof); roof.position.y = top + 0.6;
    g.add(gb, ub, cor, roof);
    if (U.brick && w > 9 && fe < 0.7) {
      const parts = [], ew = Math.min(6, w * 0.45), ez = (fz - 0.5) * (w - ew - 1);
      for (let f = 0; f < floors; f++) {
        const y = ground + 0.4 + f * 3.5;
        const plat = new THREE.BoxGeometry(1.1, 0.08, ew); plat.translate(face - sign * 0.55, y, ez); parts.push(plat);
        const rail = new THREE.BoxGeometry(0.05, 0.9, ew); rail.translate(face - sign * 1.08, y + 0.45, ez); parts.push(rail);
        const ladder = new THREE.BoxGeometry(0.06, 3.6, 0.5); ladder.rotateX(f % 2 ? 0.75 : -0.75); ladder.translate(face - sign * 0.6, y + 1.75, ez + (f % 2 ? 1 : -1) * ew * 0.22); parts.push(ladder);
      }
      g.add(new THREE.Mesh(mergeGeometries(parts), this.mat.iron));
    }
    if (wt < 0.35) {
      const t = new THREE.Group();
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 10), this.mat.wood); tank.position.y = 2.8;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.1, 10), this.mat.wood); cap.position.y = 4.55;
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 4, 1, true), this.mat.iron); legs.position.y = 0.8;
      t.add(tank, cap, legs);
      t.position.set((wx - 0.5) * (DEPTH - 4), top + 0.8, (wz - 0.5) * Math.max(0, w - 3));
      g.add(t);
    }
    if (nn < 0.5) {
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), this.neonMats[Math.floor(nm * 4)]);
      sgn.position.set(face - sign * 1.3, ground + 2 + ny * 2.5, (nz - 0.5) * Math.max(0, w - 2));
      g.add(sgn);
    }
    if (tw0 < 0.4) {
      const tw = 14 + tw1 * 14, th = 35 + tw2 * 55;
      const t = new THREE.Mesh(tiledBox(tw, th, Math.max(w, 12), 10, 7), this.mat.tower);
      t.position.set(sign * (DEPTH / 2 + 10 + tw / 2), th / 2, 0);
      g.add(t);
    }
    return { next, group: g };
  }
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t >>> 0) / 4294967296);
  };
}
