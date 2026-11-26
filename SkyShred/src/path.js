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
export const DS = 2;               // table step, metres
export const LAT_MAX = 15;         // how far either side of the centreline the glider may go

// kind: dive | rings | spread | target | fight | skim | land.   slope < 0 = downhill.  scen = how much scenery.
// Leg 0 is the tutorial: a long free dive, then rings, then a long empty-ish spread, then ONE target in clear sky.
const LEG0 = [
  { kind: 'dive',   len: 320, slope: -0.17, scen: 'sparse', hint: 'LEAN LEFT / RIGHT TO STEER' },
  { kind: 'rings',  len: 440, slope: -0.06, scen: 'sparse', rings: { gap: 44, amp: 9, r: 5.4 }, hint: 'FLY THROUGH THE RINGS' },
  { kind: 'spread', len: 300, slope: -0.05, scen: 'sparse2' },
  { kind: 'target', len: 330, slope: -0.04, scen: 'none', hint: 'TARGET AHEAD - KEEP IT IN YOUR SIGHTS' },
  { kind: 'fight',  len: 220, slope: -0.05, scen: 'dense', rings: { gap: 80, amp: 10, r: 4.8 } },
  { kind: 'skim',   len: 190, slope: -0.12, scen: 'sparse', hint: 'SKIM THE DECK!' },
  { kind: 'land',   len: 150, slope: -0.05, scen: 'sparse', hint: 'LAND ON THE SHIP' },
];
const LEGN = [
  { kind: 'dive',  len: 110, slope: -0.16, scen: 'sparse' },
  { kind: 'fight', len: 230, slope: -0.05, scen: 'dense', rings: { gap: 70, amp: 10, r: 4.8 } },
  { kind: 'skim',  len: 170, slope: -0.12, scen: 'sparse', hint: 'SKIM THE DECK!' },
  { kind: 'fight', len: 230, slope: -0.05, scen: 'dense', rings: { gap: 70, amp: 10, r: 4.8 } },
  { kind: 'land',  len: 140, slope: -0.05, scen: 'sparse', hint: 'LAND ON THE SHIP' },
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
    for (const sec of (this.tutorial ? LEG0 : LEGN)) { this.sections.push({ ...sec, s0, s1: s0 + sec.len }); s0 += sec.len; }
    this.L = s0;                                   // touchdown at s = L
    this.sMin = -80; this.sMax = this.L + 100;
    const n = Math.round((this.sMax - this.sMin) / DS) + 1;
    this.n = n;
    this.py = new Float32Array(n);                 // path altitude
    this.xc = new Float32Array(n);                 // path lateral centre
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = this.sMin + i * DS;
      if (s > 0) y += this._slopeAt(s) * DS;
      this.py[i] = y;
      this.xc[i] = this._xcRaw(s);
    }
    // where the next leg's deck is: the landing ship's origin in this leg's frame
    this.O = { x: this.center(this.L), y: this.pathYAt(this.L), z: this.zAt(this.L) + LAND_Z };
    this._planRings();
    this._planStructs();
  }

  _secAt(s) {
    for (const sec of this.sections) if (s < sec.s1) return sec;
    return this.sections[this.sections.length - 1];
  }
  _slopeAt(s) {
    const secs = this.sections;
    let k = secs[0].slope;
    for (let i = 0; i < secs.length - 1; i++) k = lerp(k, secs[i + 1].slope, smoothstep(secs[i].s1 - 25, secs[i].s1 + 25, s));
    return k;
  }
  _xcRaw(s) {
    if (s <= 0) return 0;
    const a = this.tutorial ? 260 : 0, b = this.tutorial ? 760 : 140;
    let f = smoothstep(a, b, s);
    // calm where a ship sits under the path, and dead straight into the landing so the deck is lined up
    let calm = 1;
    for (const sec of this.sections) if (sec.kind === 'skim') calm *= 1 - 0.85 * smoothstep(sec.s0 - 40, sec.s0 + 10, s) * (1 - smoothstep(sec.s1 - 10, sec.s1 + 40, s));
    const se = Math.min(s, this.L - 150);
    const raw = this.amp1 * Math.sin(se / 200 + this.phi) + this.amp2 * Math.sin(se / 61 + this.psi) - this.amp1 * Math.sin(this.phi);
    return f * calm * raw;
  }

  _i(s) { return clamp((s - this.sMin) / DS, 0, this.n - 1.001); }
  _lerpTab(tab, s) { const f = this._i(s), i = Math.floor(f), t = f - i; return tab[i] * (1 - t) + tab[i + 1] * t; }
  center(s) { return this._lerpTab(this.xc, s); }
  pathYAt(s) { return this._lerpTab(this.py, s); }
  /** descent per metre along the path, positive = diving */
  descent(s) { return -(this.pathYAt(s + 4) - this.pathYAt(s - 4)) / 8; }
  dxds(s) { return (this.center(s + 4) - this.center(s - 4)) / 8; }
  zAt(s) { return -DECK_LEN - s; }
  sectionAt(s) { return this._secAt(s); }
  pointAt(s, lat, out) { out.x = this.center(s) + lat; out.y = this.pathYAt(s); out.z = this.zAt(s); return out; }

  _planRings() {
    this.ringPlan = [];
    let i = 0;
    for (const sec of this.sections) {
      if (!sec.rings) continue;
      for (let s = sec.s0 + 50; s < sec.s1 - 30; s += sec.rings.gap, i++) {
        const k = this.tutorial && sec.kind === 'rings' ? Math.min(1, 0.25 + (s - sec.s0) / 220) : 1;
        this.ringPlan.push({ s, lat: Math.sin(i * 1.35 + this.phi) * sec.rings.amp * k, r: sec.rings.r });
      }
    }
  }

  /** Flying ships and floating islands. Their tops are what the glider can skim and what the floor clamp rides on. */
  _planStructs() {
    const rnd = mulberry32(this.seed + 31);
    const out = [];
    const clearZones = this.sections.filter((s) => s.scen === 'none').map((s) => [s.s0 - 280, s.s1 + 40]);
    const blocked = (s) => clearZones.some(([a, b]) => s >= a && s <= b);
    // a big carrier right under the path in each skim section: you skim its deck
    for (const sec of this.sections) {
      if (sec.kind !== 'skim') continue;
      const sA = sec.s0 + 25, sB = sec.s1 - 15, h0 = 6.5;
      const yA = this.pathYAt(sA) - h0, yB = this.pathYAt(sB) - h0;
      const zA = this.zAt(sA), zB = this.zAt(sB);
      out.push({ kind: 'ship', skim: true, x: this.center((sA + sB) / 2), z: (zA + zB) / 2, hx: 27, hl: (sB - sA) / 2 + 22,
        ty0: (yA + yB) / 2, kz: (yA - yB) / (zA - zB), tz0: (zA + zB) / 2, top: (z) => 0 });
    }
    const gapOf = { dense: 80, sparse: 135, sparse2: 190, none: 1e9 };
    for (let s = -120; s < this.L + 160; s += 0) {
      const sec = this._secAt(clamp(s, 0, this.L));
      const gap = gapOf[sec.scen] || 135;
      s += gap * (0.6 + rnd() * 0.8);
      if (blocked(s) || sec.scen === 'none') continue;
      const ship = rnd() < 0.42, side = rnd() > 0.5 ? 1 : -1;
      const ext = ship ? 11 + rnd() * 12 : 17 + rnd() * 30;
      const sy = clamp(s, 0, this.L);
      const lat = side * (ext + 46 + rnd() * (sec.scen === 'dense' ? 55 : 110));
      const y = this.pathYAt(sy) + (rnd() - 0.74) * 78;
      const st = ship ? { kind: 'ship', hx: ext, hl: 40 + rnd() * 52, kz: 0 } : { kind: 'island', r: ext };
      Object.assign(st, { x: this.center(sy) + lat, z: this.zAt(s), ty0: y, tz0: this.zAt(s), seed: Math.floor(rnd() * 1e6) });
      out.push(st);
    }
    // a few huge ones far off, for scale and depth
    for (let i = 0; i < 9; i++) {
      const s = rnd() * (this.L + 200) - 80;
      if (blocked(s)) continue;
      const sy = clamp(s, 0, this.L), side = i % 2 ? 1 : -1, ship = rnd() < 0.5;
      const lat = side * (240 + rnd() * 260);
      const st = ship ? { kind: 'ship', hx: 24 + rnd() * 16, hl: 90 + rnd() * 60, kz: 0 } : { kind: 'island', r: 46 + rnd() * 50 };
      Object.assign(st, { x: this.center(sy) + lat, z: this.zAt(s), ty0: this.pathYAt(sy) - 40 - rnd() * 150, tz0: this.zAt(s), seed: Math.floor(rnd() * 1e6), far: true });
      out.push(st);
    }
    // the landing ship (the next leg's deck): rear at z = O.z + DECK_BACK, front at O.z - DECK_LEN
    const O = this.O;
    out.push({ kind: 'ship', landing: true, x: O.x, z: O.z + (DECK_BACK - DECK_LEN) / 2, hx: DECK_W / 2, hl: (DECK_BACK + DECK_LEN) / 2, ty0: O.y, tz0: O.z, kz: 0 });
    for (const st of out) if (st.kind === 'ship') { const { ty0, tz0, kz } = st; st.top = (z) => ty0 + kz * (z - tz0); }
    this.structs = out;
  }

  /** The highest deck / island top at or below y (+1.5 slack) under (x, z): out.top = -Infinity when there is none. */
  surface(x, y, z, out) {
    let best = -Infinity, edge = false;
    for (const st of this.structs) {
      let top, ed;
      if (st.kind === 'ship') {
        const dx = Math.abs(x - st.x), dz = Math.abs(z - st.z);
        if (dx > st.hx || dz > st.hl) continue;
        top = st.top(z); ed = st.hx - dx < 4 || st.hl - dz < 6;
      } else {
        const dx = x - st.x, dz = z - st.z, d2 = dx * dx + dz * dz, r = st.r * 0.9;
        if (d2 > r * r) continue;
        top = st.ty0; ed = r - Math.sqrt(d2) < 4;
      }
      if (top <= y + 1.5 && top > best) { best = top; edge = ed; }
    }
    out.top = best; out.edge = edge;
    return out;
  }
}
