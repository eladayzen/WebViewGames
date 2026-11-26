// The flight path of one leg, in a leg-local frame: the start deck top is y = 0, the deck runs along -Z and its front
// edge is at z = -DECK_LEN.  The glide is parameterised by s (metres past the edge), z = -DECK_LEN - s.
//
// There is NO ground any more -- the world is open sky.  The PATH sets altitude (a table of y over s), speed comes
// from its slope, and flying close to a flying ship / island underneath is the bonus ("skim").  Nothing can hurt you:
// a hard floor sits 1.7 m over any deck or island top you are above.
//
// The landing deck of leg N is the START deck of leg N+1 (same ship, re-based), so a leg ends on a ship and the next
// one starts running on that very ship.
import { clamp, lerp, smoothstep, mulberry32 } from './util.js';

export const DECK_LEN = 90;        // start deck: front edge at z = -DECK_LEN, rear at z = +DECK_BACK
export const DECK_BACK = 9;
export const DECK_W = 15;
export const LAND_Z = 8;           // the touchdown point sits this far in front of the landing deck's rear section
export const CHASE_FEATURE = false;   // pilots on your tail + the loop power-up: paused for now (code kept)
export const DS = 2;               // table step, metres
export const LAT_MAX = 30;         // how far either side of the centreline the glider may go (a soft edge, see main.js)

// kind: dive | rings | fight | drop | skim | raid | chase.   slope < 0 = downhill.   turn = how far (radians, + = right) the
// path swings over the section: a raid can sweep a full 180 around a base.  Every leg's turns add up to zero, so the next
// leg takes over heading straight ahead.  scen = scenery to the sides: peaceful islands only -- enemy ships exist only as
// raid targets, never as background.
const DROP = { kind: 'drop', slope: -0.33, scen: 'sparse', rings: { gap: 30, amp: 8, r: 5.6 } };
const LEG0 = [
  { kind: 'dive',  len: 170, slope: -0.17, scen: 'sparse', hint: 'LEAN LEFT / RIGHT TO STEER' },
  { kind: 'rings', len: 360, slope: -0.11, scen: 'sparse', rings: { gap: 40, amp: 9, r: 5.4 }, turn: 0.5, hint: 'FLY THROUGH THE RINGS' },
  { ...DROP, len: 150, hint: 'DROP!' },
  { kind: 'fight', len: 300, slope: -0.09, scen: 'sparse', cap: 1, one: true, turn: -0.5, hint: 'ENEMY AHEAD - HOLD HIM IN YOUR SIGHTS' },
  { ...DROP, len: 140, hint: 'DROP!' },
  { kind: 'raid',  len: 300, slope: -0.08, scen: 'sparse', ships: 1, turn: 0.9, hint: 'A FOOT CLAN SHIP - LINE UP AND SHOOT THE TARGETS ON ITS DECK' },
  { ...DROP, len: 140, hint: 'DROP!' },
  { kind: 'raid',  len: 430, slope: -0.08, scen: 'sparse', ships: 3, turn: -Math.PI, hint: 'A BASE! SWING AROUND IT - TAKE OUT THE CORES' },
  { kind: 'fight', len: 400, slope: -0.10, scen: 'sparse', cap: 2, turn: Math.PI - 0.9, hint: 'THEY RUN - FOLLOW THE BIG TURN AND DOGFIGHT' },
  { ...DROP, len: 170 },
];
const LEG_A = [
  { ...DROP, len: 130 },
  { kind: 'skim',  len: 170, slope: -0.12, scen: 'sparse', hint: 'SKIM THE DECK - SHOOT THE CARGO' },
  { kind: 'fight', len: 320, slope: -0.09, scen: 'sparse', turn: 0.8, rings: { gap: 80, amp: 10, r: 4.8 } },
  { kind: 'raid',  len: 440, slope: -0.08, scen: 'sparse', ships: 3, turn: -1.6, hint: 'RAID THE BASE' },
  { kind: 'fight', len: 380, slope: -0.10, scen: 'sparse', cap: 2, turn: 0.8 },
  { ...DROP, len: 160 },
];
const LEG_B = [
  { ...DROP, len: 130 },
  { kind: 'raid',  len: 460, slope: -0.08, scen: 'sparse', ships: 4, turn: 2.4, hint: 'RAID THE FLEET' },
  { kind: 'fight', len: 300, slope: -0.09, scen: 'sparse', turn: -1.2, rings: { gap: 80, amp: 10, r: 4.8 } },
  { kind: 'fight', len: 380, slope: -0.10, scen: 'sparse', cap: 2, turn: -1.2 },
  { ...DROP, len: 150 },
  { kind: 'fight', len: 240, slope: -0.09, scen: 'sparse' },
];

export class Leg {
  constructor(index = 0) {
    this.index = index;
    this.seed = 1234 + index * 7919;
    const rnd = mulberry32(this.seed);
    this.phi = rnd() * 6.28; this.psi = rnd() * 6.28;
    this.amp1 = 20 + rnd() * 8; this.amp2 = 4 + rnd() * 3;
    this.tutorial = index === 0;
    this.sections = [];
    let s0 = 0;
    for (const sec of (this.tutorial ? LEG0 : index % 2 ? LEG_A : LEG_B)) { this.sections.push({ turn: 0, ...sec, s0, s1: s0 + sec.len }); s0 += sec.len; }
    this.L = s0;                                   // hand-over at s = L
    this.sMin = -80; this.sMax = this.L + 100;
    const n = Math.round((this.sMax - this.sMin) / DS) + 1;
    this.n = n;
    this.py = new Float32Array(n);                 // path altitude
    this.xc = new Float32Array(n);                 // sideways wander of the lane's centre
    this.hd = new Float32Array(n);                 // heading of the path (0 = straight ahead / -Z, + = right)
    this.px = new Float32Array(n); this.pz = new Float32Array(n);   // the path's centreline in the plane
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = this.sMin + i * DS;
      if (s > 0) y += this._slopeAt(s) * DS;
      this.py[i] = y;
      this.xc[i] = this._xcRaw(s);
    }
    this._integrateHeading();
    // the hand-over point: the next leg starts here, in mid-air (no landing); heading is 0 there, so a plain shift is enough
    const e = this.at(this.L, 0, {});
    this.O = { x: e.x, y: this.pathYAt(this.L), z: e.z + DECK_LEN };
    this.air = index > 0; this.jink = 0.5; this.burst = 5; this.wideA = 1.2;
    this._planRings();
    this._planStructs();
    this._planChase();
  }

  _secAt(s) {
    for (const sec of this.sections) if (s < sec.s1) return sec;
    return this.sections[this.sections.length - 1];
  }
  _blend(s, key, perM) {
    const secs = this.sections, v = (sec) => (perM ? sec[key] / sec.len : sec[key]);
    let k = v(secs[0]);
    for (let i = 0; i < secs.length - 1; i++) k = lerp(k, v(secs[i + 1]), smoothstep(secs[i].s1 - 30, secs[i].s1 + 30, s));
    return k;
  }
  _slopeAt(s) { return this._blend(s, 'slope', false); }
  _kappaAt(s) { return s > 0 ? this._blend(s, 'turn', true) : 0; }
  /** heading and centreline from the curvature of each section; a small correction near the end makes the heading end at exactly 0 */
  _integrateHeading() {
    const n = this.n, i0 = Math.round(-this.sMin / DS);
    const w = (s) => smoothstep(this.L - 150, this.L - 110, s) * (1 - smoothstep(this.L - 90, this.L - 60, s));
    let h = 0, wsum = 0;
    for (let i = i0; i < n; i++) { const s = this.sMin + i * DS; h += this._kappaAt(s) * DS; wsum += w(s) * DS; }
    const fix = wsum > 0 ? -h / wsum : 0;
    let hh = 0, x = 0, z = -DECK_LEN;
    for (let i = i0; i < n; i++) {
      const s = this.sMin + i * DS;
      hh += (this._kappaAt(s) + fix * w(s)) * DS;
      this.hd[i] = hh; this.px[i] = x; this.pz[i] = z;
      x += Math.sin(hh) * DS; z -= Math.cos(hh) * DS;
    }
    for (let i = 0; i < i0; i++) { const s = this.sMin + i * DS; this.hd[i] = 0; this.px[i] = 0; this.pz[i] = -DECK_LEN - s; }
  }
  _xcRaw(s) {
    if (s <= 0) return 0;
    const a = this.tutorial ? 260 : 0, b = this.tutorial ? 760 : 140;
    let f = smoothstep(a, b, s);
    // calm where a ship sits under the path, and dead straight into the hand-over
    let calm = 1;
    for (const sec of this.sections) if (sec.kind === 'skim' || sec.kind === 'raid') calm *= 1 - 0.85 * smoothstep(sec.s0 - 40, sec.s0 + 10, s) * (1 - smoothstep(sec.s1 - 10, sec.s1 + 40, s));
    const se = Math.min(s, this.L - 150);
    const raw = this.amp1 * Math.sin(se / 200 + this.phi) + this.amp2 * Math.sin(se / 61 + this.psi) - this.amp1 * Math.sin(this.phi);
    return f * calm * raw * 0.7;
  }

  _i(s) { return clamp((s - this.sMin) / DS, 0, this.n - 1.001); }
  _lerpTab(tab, s) { const f = this._i(s), i = Math.floor(f), t = f - i; return tab[i] * (1 - t) + tab[i + 1] * t; }
  center(s) { return this._lerpTab(this.xc, s); }          // the lane's sideways wander (along the path's right-hand normal)
  pathYAt(s) { return this._lerpTab(this.py, s); }
  hdgAt(s) { return this._lerpTab(this.hd, s); }
  /** descent per metre along the path, positive = diving */
  descent(s) { return -(this.pathYAt(s + 4) - this.pathYAt(s - 4)) / 8; }
  dxds(s) { return (this.center(s + 4) - this.center(s - 4)) / 8; }
  sectionAt(s) { return this._secAt(s); }
  /** world x, z of the point `lat` metres to the right of the lane centre at path distance s */
  at(s, lat, out) {
    const h = this.hdgAt(s), off = this.center(s) + lat;
    out.x = this._lerpTab(this.px, s) + off * Math.cos(h); out.z = this._lerpTab(this.pz, s) + off * Math.sin(h);
    return out;
  }
  pointAt(s, lat, out) { this.at(s, lat, out); out.y = this.pathYAt(s); return out; }
  /** lateral offset (in lane coordinates) of a world point, searching near path distance sHint */
  latOf(x, z, sHint) {
    let best = 1e18, bi = 0;
    const a = Math.floor(this._i(sHint - 30)), b = Math.min(this.n - 1, Math.floor(this._i(sHint + 320)));
    for (let i = a; i <= b; i++) { const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const h = this.hd[bi];
    return (x - this.px[bi]) * Math.cos(h) + (z - this.pz[bi]) * Math.sin(h) - this.xc[bi];
  }
  _nearPath(x, z, ext) {
    const r2 = (58 + ext) * (58 + ext);
    for (let i = 0; i < this.n; i += 4) { const dx = x - this.px[i], dz = z - this.pz[i]; if (dx * dx + dz * dz < r2) return true; }
    return false;
  }

  _planRings() {
    this.ringPlan = [];
    let i = 0;
    for (const sec of this.sections) {
      if (!sec.rings) continue;
      for (let s = sec.s0 + 50; s < sec.s1 - 30; s += sec.rings.gap, i++) {
        const k = this.tutorial && sec.kind === 'rings' ? Math.min(1, 0.25 + (s - sec.s0) / 220) : 1;
        this.ringPlan.push({ s, lat: Math.sin(i * 1.35 + this.phi) * sec.rings.amp * 1.9 * k, r: sec.rings.r });
      }
    }
  }

  /** Enemy ships exist only as raid / skim targets; the rest of the sky is peaceful islands. Tops are what the glider skims. */
  _planStructs() {
    const rnd = mulberry32(this.seed + 31);
    const out = [], tmp = {};
    this.raidShips = [];
    // a carrier right under the path in each skim section: skim its deck, shoot the cargo spread across it
    for (const sec of this.sections) {
      if (sec.kind !== 'skim') continue;
      const sA = sec.s0 + 25, sB = sec.s1 - 15, h0 = 6.5, sM = (sA + sB) / 2;
      const yA = this.pathYAt(sA) - h0, yB = this.pathYAt(sB) - h0;
      this.at(sM, 0, tmp);
      const st = { kind: 'ship', skim: true, x: tmp.x, z: tmp.z, hx: 42, hl: (sB - sA) / 2 + 22, yaw: -this.hdgAt(sM), ty0: (yA + yB) / 2, kz: (yA - yB) / (sB - sA), s: sM, targets: [] };
      for (let k = 0; k < 5; k++) {
        const sk = sA + 20 + k * (sB - sA - 40) / 4, lat = [-22, 14, -6, 24, -14][k];
        this.at(sk, lat, tmp);
        st.targets.push({ x: tmp.x, z: tmp.z, y: lerp(yA, yB, (sk - sA) / (sB - sA)) + 1.4, s: sk, hp: 45 });
      }
      out.push(st);
    }
    // the fleet to raid: gunships staggered across the lane, decks a little under the path. Each has a reactor core (big, in
    // the middle) plus smaller targets spread across the deck -- where you sit in the lane decides which you can line up.
    for (const sec of this.sections) {
      if (sec.kind !== 'raid') continue;
      const n = sec.ships || 4, lats = n === 1 ? [-7] : [-24, 20, -9, 27, -17];
      for (let k = 0; k < n; k++) {
        const sk = n === 1 ? sec.s0 + sec.len * 0.55 : sec.s0 + 70 + k * (sec.len - 130) / (n - 1), hl = 30 + rnd() * 9, hx = 10 + rnd() * 3.5;
        const top = this.pathYAt(sk) - (13 + rnd() * 3);
        this.at(sk, lats[k] * (0.85 + rnd() * 0.3), tmp);
        const yaw = -this.hdgAt(sk), c = Math.cos(yaw), sn = Math.sin(yaw);
        const st = { kind: 'ship', raid: true, x: tmp.x, z: tmp.z, hx, hl, ty0: top, kz: 0, yaw, s: sk, hp: 240, dead: false, seed: Math.floor(rnd() * 1e6), targets: [] };
        for (const [fx, fz] of [[-0.58, -0.5], [0.5, 0.0], [-0.25, 0.52]]) {
          const lx = fx * hx * 2 * 0.8 + (rnd() - 0.5) * 2, lz = fz * hl * 2 * 0.8;
          st.targets.push({ x: st.x + lx * c + lz * sn, z: st.z - lx * sn + lz * c, y: top + 1.6, s: sk - lz, hp: 55 });
        }
        out.push(st); this.raidShips.push(st);
      }
    }
    // peaceful islands to the sides
    const gapOf = { dense: 80, sparse: 135, sparse2: 190, none: 1e9 };
    for (let s = -120; s < this.L + 160; s += 0) {
      const sec = this._secAt(clamp(s, 0, this.L));
      s += (gapOf[sec.scen] || 135) * (0.6 + rnd() * 0.8);
      if (sec.scen === 'none') continue;
      const side = rnd() > 0.5 ? 1 : -1, ext = 17 + rnd() * 30, sy = clamp(s, 0, this.L);
      const lat = side * (ext + 68 + rnd() * 110);
      this.at(s, lat, tmp);
      if (this._nearPath(tmp.x, tmp.z, ext)) continue;
      out.push({ kind: 'island', r: ext, x: tmp.x, z: tmp.z, ty0: this.pathYAt(sy) + (rnd() - 0.74) * 78, yaw: 0, kz: 0, seed: Math.floor(rnd() * 1e6) });
    }
    // a few huge ones far off, for scale and depth
    for (let i = 0; i < 9; i++) {
      const s = rnd() * (this.L + 200) - 80, sy = clamp(s, 0, this.L), side = i % 2 ? 1 : -1;
      const ext = 46 + rnd() * 50;
      this.at(s, side * (240 + rnd() * 260), tmp);
      if (this._nearPath(tmp.x, tmp.z, ext)) continue;
      out.push({ kind: 'island', r: ext, x: tmp.x, z: tmp.z, ty0: this.pathYAt(sy) - 40 - rnd() * 150, yaw: 0, kz: 0, seed: Math.floor(rnd() * 1e6), far: true });
    }
    this.structs = out;
  }

  /** loop power-ups in each chase section, lined up on the path */
  _planChase() {
    this.orbs = [];
    if (!CHASE_FEATURE) return;          // dodging + loop power-ups are paused
    for (const sec of this.sections) {
      if (sec.kind !== 'chase') continue;
      for (const f of [0.3, 0.64]) this.orbs.push({ s: sec.s0 + sec.len * f, lat: f < 0.5 ? 11 : -11, got: false });
    }
  }

  /** The highest deck / island top at or below y (+1.5 slack) under (x, z): out.top = -Infinity when there is none. */
  surface(x, y, z, out) {
    let best = -Infinity, edge = false;
    for (const st of this.structs) {
      if (st.dead) continue;
      const dx = x - st.x, dz = z - st.z;
      let top, ed;
      if (st.kind === 'ship') {
        if (Math.abs(dx) > st.hx + st.hl || Math.abs(dz) > st.hx + st.hl) continue;
        const c = Math.cos(st.yaw), s = Math.sin(st.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) > st.hx || Math.abs(lz) > st.hl) continue;
        top = st.ty0 + st.kz * lz; ed = st.hx - Math.abs(lx) < 4 || st.hl - Math.abs(lz) < 6;
      } else {
        const d2 = dx * dx + dz * dz, r = st.r * 0.9;
        if (d2 > r * r) continue;
        top = st.ty0; ed = r - Math.sqrt(d2) < 4;
      }
      if (top <= y + 1.5 && top > best) { best = top; edge = ed; }
    }
    out.top = best; out.edge = edge;
    return out;
  }
}
