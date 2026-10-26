// The range on the far side of the valley — modelled, not painted.
//
// WHY THIS IS GEOMETRY NOW. Three rounds of painting it analytically in the sky's
// fragment shader failed for one structural reason: a silhouette that is a
// function of azimuth alone has no surface under it. `d(skyline)/d(azimuth)` is
// the crest's direction in PLAN; it says nothing about which way the wall beneath
// faces, so it can only ever produce vertical bands. Every attempt to invent 2-D
// structure on top of it — spots, dashes, level sets, sheared noise — read as
// print rather than as rock, because it WAS print: a texture with no normal.
//
// A normal is what the reference actually has. "One uniformly lit face and one
// uniformly shadowed face divided by a single hard arete" is not an effect to be
// imitated; it is the plain consequence of two planes meeting. So the range is
// three rings of low-polygon ridge, flat shaded, lit by the same uSunDir and
// hazed into the same uFogColor as everything else.
//
// The cost argument that once favoured painting has inverted. The sky is a
// BackSide dome at depthTest:false and 100% overdraw, so the ~300 ALU the range
// block cost there was paid on every pixel of the screen every frame. This is
// 27,648 static triangles in ONE draw call and one 1.9 MB buffer uploaded once,
// drawn LAST in the opaque pass so the terrain's depth has already rejected
// everything the near ground covers, with a ~45 ALU shader. Nothing here costs
// a frame anything on the CPU: `update` copies a vector.
//
// THE HEIGHT FIELD IS A MAX OF PYRAMIDS. Value-noise terrain is C1 everywhere and
// so has no aretes at all — every summit it can draw is a dome, which is the
// failure the painted version fought for three rounds. `h = max_p (H_p - max_j
// g_j (u_j . d))` is a maximum of linear functions, hence piecewise planar by
// construction: flat faces, straight aretes where two faces meet, straight
// couloirs where two peaks meet. Broad low-slope pyramids make the massifs and
// steep ones stand summits on top of them.

import * as THREE from 'three';
import { mulberry32, range as rr } from './rng.js';

const TAU = Math.PI * 2;

// ── periodic value noise ────────────────────────────────────────────────────
// rng.js's vnoise is not periodic, and a range built on it has a seam where
// azimuth wraps: a step in the crest, running the full height of the wall. The
// sky shader dodged the same problem by putting atan's branch cut behind the
// rider, but a crash camera does look back. Wrapping the lattice index in x
// costs one modulo at build time and makes the seam impossible instead of
// merely unlikely.

function h2i(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in [0,1), periodic in x with period `p` (an integer). */
function pnoise(x, y, p, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % p) + p) % p;
  const x1 = ((ix + 1) % p + p) % p;
  const a = h2i(x0, iy, seed);
  const b = h2i(x1, iy, seed);
  const c = h2i(x0, iy + 1, seed);
  const d = h2i(x1, iy + 1, seed);
  const lo = a + (b - a) * ux;
  return lo + (c + (d - c) * ux - lo) * uy;
}

/** Three octaves of pnoise in [-1,1]; `p` is the base period in cells per turn. */
function pfbm(t, y, p, seed) {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 3; i++) {
    const f = 1 << i;
    sum += (pnoise(t * p * f, y * 2.03 ** i + i * 31.7, p * f, seed + i * 1013) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * The three depth planes, camera-relative. The camera sits at the centre of the
 * rings and they follow it exactly, so every number here can be read as an
 * elevation ANGLE by dividing by the radius — which is how they were chosen.
 *
 * The farthest plane carries the biggest, broadest peaks and the nearest is a
 * low busy ridge in front of them. That is the reference's composition and the
 * only arrangement in which three silhouettes ever overlap; making the near
 * layer the tallest hides the other two completely.
 *
 * The rings OVERLAP in radius rather than abutting. Two annuli that merely touch
 * leave a wedge of sky visible past the near one's outer rim wherever the far
 * one's surface has not yet risen; overlapping puts the far layer's low inner
 * apron behind the near layer's body, where it cannot show.
 */
// THE MASSIF COUNT IS SET BY OVERLAP, not by taste. A massif of height h and
// flank slope g has a plan radius h/g; if the ring's spacing 2*pi*rMid/N exceeds
// twice that, the layer falls to its base between them and the skyline lies flat
// on the horizon for twenty degrees at a stretch. The first cut of this file did
// exactly that, and a flat horizon reads as the sea. `floor` is the second
// guard: a continuous undulation, periodic around the ring, that no arrangement
// of peaks can fall below.
const LAYERS = [
  { // far: broad massifs, crest around 7-10 degrees
    r0: 1000, r1: 1300, rows: 6, baseY: -45, apron: 0,
    massifs: 16, mH: [128, 204], mG: [0.50, 0.74],
    summits: 15, sH: [178, 268], sG: [0.72, 1.15],
    floor: [42, 152], floorP: 20, detail: 0.008, rowPow: 1.0, pkU: [0.38, 0.78],
  },
  { // mid
    r0: 830, r1: 1110, rows: 6, baseY: -30, apron: 0,
    massifs: 20, mH: [77, 128], mG: [0.55, 0.82],
    summits: 19, sH: [112, 175], sG: [0.80, 1.30],
    floor: [24, 98], floorP: 26, detail: 0.009, rowPow: 1.0, pkU: [0.38, 0.78],
  },
  { // near: a low busy ridge, and the valley's far side under it
    r0: 720, r1: 1010, rows: 12, baseY: -52, apron: 165, apronP: 9,
    massifs: 32, mH: [50, 92], mG: [0.60, 0.92],
    summits: 26, sH: [76, 132], sG: [0.86, 1.40],
    // pkU keeps peaks OFF the apron. A pyramid standing on ground that already
    // falls away toward the viewer is seen almost edge-on, and its lit face
    // comes out as a bright sliver a few pixels wide and a hundred tall — a
    // scratch on the frame. Past u = 0.54 the ring is level again.
    floor: [14, 64], floorP: 34, detail: 0.006, rowPow: 1.5, pkU: [0.54, 0.80],
  },
];

/**
 * ── OTHER RANGES ────────────────────────────────────────────────────────────
 *
 * "The mountains in the background are the ones worth playing with - try 2 more
 * completely different far aways, one sharp mountain."
 *
 * They are data, not art. The range is a MAX OF PYRAMIDS -- that is the whole
 * trick of this file, and the reason it has aretes at all where value noise
 * would only ever give domes -- so a different skyline is a different table of
 * how many pyramids, how tall and how steep.
 *
 * The two knobs that actually decide the character:
 *
 *   sG / mG   the pyramid's GRADIENT, and therefore how sharp it is. Under 0.5
 *             is a shoulder you could walk up; over 2 is a spire.
 *   sH / mH   its height. Spread wide and the skyline is busy; spread narrow
 *             and the summits agree with each other, which is what makes a
 *             range read as one massif rather than as a crowd.
 *
 * Counts matter less than either. Sixteen gentle massifs and sixteen steep ones
 * are completely different mountains; sixteen and twenty-four are the same
 * mountain twice.
 */
const RANGE_PROFILES = {
  /** What this game has always had: broad rolling massifs with crests on them. */
  ridges: LAYERS,

  /**
   * SHARP. Few summits, twice to three times the height, and gradients from
   * 1.9 to 3.2 where the default tops out at 1.15 -- so they leave the floor
   * almost vertically and meet in a point rather than a crest.
   *
   * The massifs underneath are deliberately CUT DOWN, not removed. A spire
   * standing on nothing reads as a shard floating in haze; standing on a low
   * broad base it reads as the top of a mountain whose bulk the fog has eaten,
   * which is what a real one looks like from twenty kilometres.
   */
  spires: [
    {
      r0: 1000, r1: 1300, rows: 6, baseY: -45, apron: 0,
      massifs: 9, mH: [70, 118], mG: [0.42, 0.60],
      summits: 8, sH: [330, 520], sG: [2.10, 3.30],
      floor: [42, 152], floorP: 20, detail: 0.008, rowPow: 1.0, pkU: [0.38, 0.78],
    },
    {
      r0: 830, r1: 1110, rows: 6, baseY: -30, apron: 0,
      massifs: 11, mH: [48, 84], mG: [0.46, 0.66],
      summits: 10, sH: [210, 340], sG: [1.90, 3.00],
      floor: [24, 98], floorP: 26, detail: 0.009, rowPow: 1.0, pkU: [0.38, 0.78],
    },
    {
      r0: 720, r1: 1010, rows: 12, baseY: -52, apron: 165, apronP: 9,
      massifs: 16, mH: [34, 62], mG: [0.52, 0.74],
      summits: 12, sH: [120, 205], sG: [1.60, 2.60],
      floor: [14, 64], floorP: 34, detail: 0.006, rowPow: 1.5, pkU: [0.54, 0.80],
    },
  ],

  /**
   * THE OPPOSITE. Many low bluffs at gradients under a third, with their
   * heights held in a NARROW band so the tops line up -- a long flat horizon
   * with shoulders in it rather than peaks, the far side of a wide basin.
   *
   * Almost no summits: a summit is the thing that makes a skyline jagged, and
   * the whole point of this one is that it is not.
   */
  bluffs: [
    {
      r0: 1000, r1: 1300, rows: 6, baseY: -45, apron: 0,
      massifs: 30, mH: [96, 124], mG: [0.20, 0.30],
      summits: 3, sH: [128, 150], sG: [0.30, 0.42],
      floor: [42, 152], floorP: 20, detail: 0.008, rowPow: 1.0, pkU: [0.38, 0.78],
    },
    {
      r0: 830, r1: 1110, rows: 6, baseY: -30, apron: 0,
      massifs: 34, mH: [58, 78], mG: [0.22, 0.32],
      summits: 3, sH: [80, 96], sG: [0.32, 0.44],
      floor: [24, 98], floorP: 26, detail: 0.009, rowPow: 1.0, pkU: [0.38, 0.78],
    },
    {
      r0: 720, r1: 1010, rows: 12, baseY: -52, apron: 165, apronP: 9,
      massifs: 40, mH: [34, 48], mG: [0.24, 0.34],
      summits: 4, sH: [50, 64], sG: [0.34, 0.46],
      floor: [14, 64], floorP: 34, detail: 0.006, rowPow: 1.5, pkU: [0.54, 0.80],
    },
  ],
};

const COLS = 576;          // 0.625 deg per column — about ten pixels on a phone
const SKIRT_DROP = 1.25;   // skirt bottom, as a multiple of r0: elevation -51 deg

/**
 * One pyramid. `dirs` are the outward plan directions of its faces and `slopes`
 * their steepness, so the peak is the intersection of `k` half-spaces: exactly
 * `k` flat triangular faces meeting the apex, and `k` aretes running down from
 * it. Four or five faces, randomly rotated, means most peaks present two faces
 * to a viewer inside the ring with an arete between them — which is the thing
 * the painted version could not express at all.
 */
function makePeak(rand, th, r, h, g) {
  const k = rand() < 0.45 ? 4 : 5;
  const rot = rand() * TAU;
  let gMin = 1e9;
  const cs = new Float32Array(k);
  const sn = new Float32Array(k);
  for (let j = 0; j < k; j++) {
    // Jittered by up to a third of a sector: enough that no two peaks share a
    // profile, not so much that a face turns concave and the pyramid unfolds.
    const a = rot + (j + rr(rand, -0.3, 0.3)) * TAU / k;
    const gj = g * rr(rand, 0.72, 1.34);
    cs[j] = Math.cos(a) * gj;
    sn[j] = Math.sin(a) * gj;
    if (gj < gMin) gMin = gj;
  }
  // How far out this pyramid still stands above zero, along its shallowest
  // face. Measured rather than bounded: a loose bound that cuts a cone a few
  // metres early leaves a step in the height field, and a step in a height
  // field is a vertical seam running the height of the wall.
  return { th, r, h, cs, sn, k, reach: h / gMin };
}

/** Signed angular difference, folded into (-pi, pi]. */
function dth(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function buildLayer(cfg, seed) {
  const rand = mulberry32(seed);
  const rMid = (cfg.r0 + cfg.r1) * 0.5;
  const span = cfg.r1 - cfg.r0;
  const peaks = [];

  // Massifs first, evenly spread and then jittered, so the ring has no bald arc.
  // Radii sit inside the taper at BOTH rims — see `height`.
  for (let i = 0; i < cfg.massifs; i++) {
    const th = (i + rr(rand, -0.34, 0.34)) * TAU / cfg.massifs;
    const r = cfg.r0 + span * rr(rand, cfg.pkU[0], cfg.pkU[1] - 0.02);
    peaks.push(makePeak(rand, th, r, rr(rand, cfg.mH[0], cfg.mH[1]),
      rr(rand, cfg.mG[0], cfg.mG[1])));
  }
  const nMassif = peaks.length;
  // Summits crown the massifs rather than standing alone in the plain: a sharp
  // cone on flat ground is a spike, and a row of spikes is a saw blade.
  for (let i = 0; i < cfg.summits; i++) {
    const m = peaks[Math.floor(rand() * nMassif) % nMassif];
    const h = rr(rand, cfg.sH[0], cfg.sH[1]);
    const g = rr(rand, cfg.sG[0], cfg.sG[1]);
    // Offset by up to about half the massif's own plan radius.
    const off = (m.h / cfg.mG[0]) * 0.5;
    const th = m.th + rr(rand, -off, off) / rMid;
    const r = Math.min(cfg.r0 + span * cfg.pkU[1],
      Math.max(cfg.r0 + span * cfg.pkU[0], m.r + rr(rand, -off, off)));
    peaks.push(makePeak(rand, th, r, h, g));
  }

  // NO SPURS ON THE APRON. Small steep peaks were planted there to give the
  // band under the crest something to be, and they came out as bright vertical
  // slivers: a surface seen at grazing incidence stretches everything on it
  // vertically, so the narrower the feature the more it reads as a scratch. It
  // is the curtain failure of the painted version arriving as geometry, and the
  // lesson is that below the crest only SILHOUETTES read. Depth there is carried
  // by the crest lines of the rings in front and by haze, and by nothing else.

  const nseed = (seed * 7919) & 0x7fffffff;
  const dseed = (seed * 104729) & 0x7fffffff;
  const detail = cfg.detail * cfg.sH[1];
  const fLo = cfg.floor[0];
  const fSpan = cfg.floor[1] - cfg.floor[0];
  // Cells per turn for the fine octave: an integer, so the lattice closes.
  const dP = Math.max(8, Math.round(TAU * rMid / 150));
  const sm = (x) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };

  /** Height above baseY at (azimuth, radius). */
  const height = (th, r) => {
    const t01 = th / TAU;
    // THE FLOOR IS RIDGED AND TWO-DIMENSIONAL. Smooth 1-D noise in azimuth has
    // no crease anywhere and does not vary with radius, so wherever no peak beat
    // it the crest was a horizontal line at constant elevation — twenty degrees
    // of dead flat skyline with a step at each end, which reads as a table
    // mountain. Folding it puts a crease where the noise crosses its mean, and
    // letting it move with r stops the crest lying along a circle.
    const fv = 1.0 - Math.abs(pfbm(t01, r / 260, cfg.floorP, nseed));
    let h = fLo + fSpan * fv * fv;
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const ds = dth(th, p.th) * rMid;
      const dt = r - p.r;
      if (Math.abs(ds) > p.reach) continue;      // cannot reach here: skip the max
      let m = -1e9;
      for (let j = 0; j < p.k; j++) {
        const v = p.cs[j] * ds + p.sn[j] * dt;
        if (v > m) m = v;
      }
      const v = p.h - m;
      if (v > h) h = v;
    }

    const u = (r - cfg.r0) / span;
    // TAPER AT BOTH RIMS. The inner one keeps the ring from ending in a cliff.
    // The outer one is what stops it ending in a MESA: a strip whose surface is
    // still rising when the geometry runs out puts its own rim on the skyline,
    // and because the rim is a circle of near-constant height wherever no peak
    // beats it, that reads as a flat-topped table mountain. The first cut of
    // this file drew two of them side by side. Ridges have two sides.
    // The inner taper is narrow when an apron already carries the descent.
    const t = sm(u / (cfg.apron > 0 ? 0.14 : 0.22)) * (1.0 - 0.85 * sm((u - 0.84) / 0.16));
    // A gentle undulation across the flat faces, at a wavelength of a hundred
    // and fifty metres — about eight columns. It has to be LONG, and it has to
    // fade out with the taper: seen from the centre of the ring the radial
    // direction is foreshortened to nothing, so anything varying quickly in
    // azimuth paints vertical stripes, which is the curtain artefact of the
    // painted version arriving as geometry.
    h += pfbm(t01, r / 150, dP, dseed) * detail * t;
    // The valley's far side: the near ring does not stop at its own foot, it
    // keeps descending toward the viewer. Without it everything below the near
    // crest is the vertical skirt, and the chase camera — which pitches nearly
    // thirty degrees down — sees almost nothing else.
    //
    // ITS DEPTH VARIES WITH AZIMUTH, and that is not decoration. A drop that is
    // constant around the ring makes every row of the apron a circle at constant
    // radius AND constant height, which from the centre is a circle at constant
    // ELEVATION — a dead flat horizontal line across the whole frame, one per
    // row, with a flat-shaded terrace between. The first cut drew three of them
    // and they read as the far shore of a lake. Once the depth undulates the
    // rows are no longer iso-elevation and the same triangles read as spurs.
    if (cfg.apron > 0) {
      const d = cfg.apron * (0.55 + 0.95 * (0.5 + 0.5 * pfbm(t01, 9.7, cfg.apronP, nseed + 7)));
      return h * t - d * (1 - sm(u / 0.45));
    }
    return h * t;
  };

  return { cfg, height };
}

/**
 * Flat-shaded, non-indexed, one buffer for all three rings.
 *
 * Non-indexed with per-triangle normals rather than indexed with a derivative
 * normal in the shader. `cross(dFdx(P), dFdy(P))` is free in memory but it is
 * evaluated per 2x2 quad, and the far rows of these strips are viewed so nearly
 * edge-on that many of their triangles are sub-pixel — where a quad straddles
 * three triangles the derivative is meaningless and the wall comes out in
 * speckle. 1.6 MB of static vertex buffer buys a normal that is exactly the
 * plane's, everywhere.
 */
function buildGeometry(seed, layers_ = LAYERS) {
  const layers = layers_.map((c, i) => buildLayer(c, seed + i * 977));

  let tris = 0;
  for (const L of layers) tris += COLS * (L.cfg.rows - 1) * 2 + COLS * 2;
  const pos = new Float32Array(tris * 9);
  const nor = new Float32Array(tris * 9);
  let o = 0;

  const ax = new Float32Array(3);
  const ay = new Float32Array(3);
  const az = new Float32Array(3);
  const push = (x0, y0, z0, x1, y1, z1, x2, y2, z2) => {
    ax[0] = x1 - x0; ax[1] = y1 - y0; ax[2] = z1 - z0;
    ay[0] = x2 - x0; ay[1] = y2 - y0; ay[2] = z2 - z0;
    az[0] = ax[1] * ay[2] - ax[2] * ay[1];
    az[1] = ax[2] * ay[0] - ax[0] * ay[2];
    az[2] = ax[0] * ay[1] - ax[1] * ay[0];
    const inv = 1 / (Math.hypot(az[0], az[1], az[2]) || 1);
    az[0] *= inv; az[1] *= inv; az[2] *= inv;
    pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = z0;
    pos[o + 3] = x1; pos[o + 4] = y1; pos[o + 5] = z1;
    pos[o + 6] = x2; pos[o + 7] = y2; pos[o + 8] = z2;
    for (let v = 0; v < 3; v++) {
      nor[o + v * 3] = az[0]; nor[o + v * 3 + 1] = az[1]; nor[o + v * 3 + 2] = az[2];
    }
    o += 9;
  };

  // theta = 0 points down -Z, the direction the run travels, matching the
  // azimuth convention the sky shader used before this file existed.
  const S = new Float32Array(COLS + 1);
  const C = new Float32Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) {
    const th = i * TAU / COLS;
    S[i] = Math.sin(th);
    C[i] = -Math.cos(th);
  }

  for (const L of layers) {
    const { r0, r1, rows, baseY } = L.cfg;
    // Rows are NOT evenly spaced in radius where a layer has an apron. The
    // apron falls two hundred metres over the first sixth of the strip, which
    // is a quarter of the frame's height, while the outer rows are so
    // foreshortened they cover a few pixels between them. An exponent puts the
    // samples where the screen is.
    const R = new Float32Array(rows);
    for (let j = 0; j < rows; j++) R[j] = r0 + (r1 - r0) * (j / (rows - 1)) ** L.cfg.rowPow;
    // One column of heights carried forward, so every height is evaluated once.
    let prev = new Float32Array(rows);
    for (let j = 0; j < rows; j++) prev[j] = baseY + L.height(0, R[j]);
    for (let i = 0; i < COLS; i++) {
      const th = (i + 1) * TAU / COLS;
      const cur = new Float32Array(rows);
      for (let j = 0; j < rows; j++) cur[j] = baseY + L.height(th, R[j]);
      for (let j = 0; j < rows - 1; j++) {
        const ra = R[j];
        const rb = R[j + 1];
        // Winding: (i,j) -> (i+1,j) -> (i,j+1) has its normal on +Y. Checked by
        // hand at theta = 0 rather than trusted; the last time a winding in this
        // project was assumed, two thirds of every chunk was backface culled.
        const x00 = S[i] * ra, z00 = C[i] * ra;
        const x10 = S[i + 1] * ra, z10 = C[i + 1] * ra;
        const x01 = S[i] * rb, z01 = C[i] * rb;
        const x11 = S[i + 1] * rb, z11 = C[i + 1] * rb;
        push(x00, prev[j], z00, x10, cur[j], z10, x01, prev[j + 1], z01);
        push(x10, cur[j], z10, x11, cur[j + 1], z11, x01, prev[j + 1], z01);
      }
      // The skirt: a vertical wall dropped from the inner rim. It exists so that
      // no framing the game can adopt — and the crash camera can adopt several —
      // ever finds sky under the range. It is below the haze gradient's floor,
      // so it renders as flat airlight and costs nothing to look at.
      const yb = -SKIRT_DROP * r0;
      const xa = S[i] * r0, za = C[i] * r0;
      const xb = S[i + 1] * r0, zb = C[i + 1] * r0;
      push(xa, prev[0], za, xa, yb, za, xb, cur[0], zb);
      push(xb, cur[0], zb, xa, yb, za, xb, yb, zb);
      prev = cur;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1400);
  return geo;
}

const RANGE_VERT = /* glsl */ `
varying vec3 vP;
varying vec3 vN;
void main() {
  // The mesh is translated to the camera and never rotated, so the local
  // position IS the camera-relative ray and the normal is already world space.
  vP = position;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RANGE_FRAG = /* glsl */ `
precision highp float;

uniform vec3  uSunDir;
uniform vec3  uFogColor;
uniform vec3  uFogSunColor;
uniform float uFogDensity;
// ── EXPOSED ROCK ──────────────────────────────────────────────────────────
// The snow term below already knows where rock BELONGS -- it falls out of the
// face normal, so it lands where the geology puts it rather than where a noise
// field does. What it never did was give rock a COLOUR: it only fed a
// brightness multiplier, so a rock face was a darker white and the whole range
// was one material. These three give it a hue and a snow line.
uniform vec3  uRockTint;   // multiplicative and luminance-neutral, so it shifts hue and not exposure
uniform float uRockAmt;    // 0 is the all-snow range this has always been
uniform float uSnowLine;   // metres above the eye; above this it is white whatever the face does

varying vec3 vP;
varying vec3 vN;

const vec3 W = vec3(0.299, 0.587, 0.114);

void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uSunDir);
  float dist = length(vP);
  vec3  V = vP / dist;          // outward view ray
  float el = V.y;

  // The airlight this piece of range is seen through — the same two colours the
  // terrain fogs into, so the seam where a ridge meets the near ground is a
  // continuation and not a join.
  float facing = max(dot(V, L), 0.0);
  vec3  air = mix(uFogColor, uFogSunColor, facing * facing * 0.65);
  // The deepest air in the frame reads LIGHTER than the sky above it, not
  // darker — it is the longest sight line and so the most scattered light in
  // the picture. Without this the whole region below the crest, which the chase
  // camera spends most of its frame on, is one flat dark plate.
  air *= 1.0 + 0.26 * smoothstep(0.04, -0.26, el);

  // A hard terminator. The faces are planar, so this puts the whole of one face
  // on one side of it and the whole of the next on the other, with the split
  // exactly on the arete between them. That is the reference's structure, and it
  // is bought here by the normal rather than invented.
  float lit  = smoothstep(-0.03, 0.19, dot(N, L));
  float up   = 0.5 + 0.5 * N.y;
  // Snow does not sit on a fifty-degree face. The rock therefore lands where the
  // geology puts it instead of where a noise field does, which is the whole
  // difference between texture and pattern.
  float snow = smoothstep(0.50, 0.80, N.y);

  // 3.0:1 between a face turned into the sun and one turned away, measured off
  // the reference within a single peak; the sky/ground split and the rock are
  // second-order on top of it.
  float shade = mix(0.52, 1.34, lit) * mix(0.84, 1.08, up) * mix(0.76, 1.0, snow);

  // The sun's own hue on the lit faces, renormalised to the airlight's
  // luminance so it TINTS and does not brighten. uFogSunColor swings from a dark
  // rose at first light to a hot orange at alpenglow, and a straight mix() would
  // darken the lit faces at one end of the run and blow them out at the other.
  vec3 warm = uFogSunColor * (dot(air, W) / max(dot(uFogSunColor, W), 1e-4));
  vec3 tone = mix(air, warm, lit * 0.45) * shade;

  // ROCK ON THE LOW STEEP FACES, and nowhere else.
  //
  // Two gates multiplied, and both are needed. One minus snow is the face being
  // too steep to hold snow; low is being below the snow line. Either alone is
  // wrong -- steepness alone browns the summits, which is where the snow most
  // obviously IS, and elevation alone browns the valley floors flat.
  //
  // BEFORE the aerial compression below, so the rock fades into the airlight
  // with distance exactly as everything else does. Applied after it, the far
  // layers would keep their colour while losing their contrast, which is the
  // one thing aerial perspective never does.
  if (uRockAmt > 0.001) {
    float low = 1.0 - smoothstep(uSnowLine - 70.0, uSnowLine + 70.0, vP.y);
    float rock = (1.0 - snow) * low * uRockAmt;
    // DARKER AS WELL AS WARMER, and the first attempt at this failed for want
    // of the darker half. A hue-only tint is washed straight out by the aerial
    // compression below -- at a kilometre through haze a warm grey and a cool
    // one converge on the same fog colour -- and the range came back looking
    // exactly as white as before.
    //
    // What actually separates rock from snow at distance is ALBEDO: snow is
    // around 0.85 and rock nearer 0.25, so rock is most of a stop darker before
    // any question of colour. Darkening it is what survives the compression,
    // and the warmth is then legible on top of it.
    tone = mix(tone, tone * uRockTint * 0.62, rock);
  }

  // Aerial perspective as CONTRAST COMPRESSION toward the airlight, which is
  // what it physically is. Measured off the reference the layers retain roughly
  // 1.00 / 0.45 / 0.37 of their contrast with depth, and they straddle the sky's
  // luminance rather than sitting entirely above or below it — which falls out
  // of compressing toward the airlight instead of shifting the plates apart.
  //
  // Distance drives it, not a per-layer constant: the mesh is camera-locked so
  // length(vP) is exact, the compression is then continuous across a layer
  // instead of stepping at its rim, and the whole range thins out on its own
  // when the squall's fog density triples.
  float k = 0.0016 + uFogDensity * 0.35;
  float c = exp(-max(dist - 660.0, 0.0) * k);
  // Haze pools in the valleys: the feet of the range dissolve, the crests stay
  // crisp. This is also what makes the skirt invisible.
  //
  // THE RAMP IS TWENTY-FIVE DEGREES WIDE, not five. At smoothstep(-0.055, 0.045)
  // the contrast fell from full to a quarter over seventy pixels and drew a hard
  // horizontal line straight across the frame — a shoreline. Aerial perspective
  // has no edge in it; this is the one place in the file where a soft gradient
  // is the correct answer.
  c *= mix(0.26, 1.0, smoothstep(-0.30, 0.10, el));

  gl_FragColor = vec4(mix(air, tone, c), 1.0);
}
`;

export class FarRange {
  constructor(scene, mood, seed = 1) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: RANGE_VERT,
      fragmentShader: RANGE_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.3, 0.2, -0.9) },
        uFogColor: { value: new THREE.Color(0xa8c4e6) },
        uFogSunColor: { value: new THREE.Color(0xffeccd) },
        uFogDensity: { value: 0.005 },
        /**
         * A warm grey-brown, normalised so its luminance is 1 -- it tints and
         * does not darken. The same trick the `warm` term above uses, and for
         * the same reason: a straight mix would make the rock read as shadow at
         * one hour and as paint at another.
         */
        uRockTint: { value: new THREE.Vector3(1.46, 0.92, 0.58) },
        uRockAmt: { value: 0 },
        uSnowLine: { value: 60 },
      },
      side: THREE.FrontSide,
    });
    mood.bind(this.material.uniforms);

    /**
     * One geometry per profile, built the FIRST time a place asks for it and
     * kept after. Building all three at load would spend the cost of two
     * skylines nobody may look at; rebuilding on every trip through the lobby
     * would spend it again and again. The one hitch it does cost lands during
     * the countdown, where the loading screen and the numbers already are.
     */
    this._geoms = new Map();
    this._seed = seed;
    this.mesh = new THREE.Mesh(this._geomFor('ridges'), this.material);
    this.mesh.frustumCulled = false;
    // LAST in the opaque pass, not first. Everything here is farther than the
    // terrain's 560 m reach, so by the time it draws the depth buffer already
    // holds the near ground and rejects the two thirds of these triangles it
    // covers — which is most of the fill this file costs, never paid.
    this.mesh.renderOrder = 900;
    /** 1 the full range, 0 bare sky. See `setPresence`. */
    this.presence = 1;
    scene.add(this.mesh);
  }

  _geomFor(name) {
    let g = this._geoms.get(name);
    if (!g) {
      g = buildGeometry(this._seed, RANGE_PROFILES[name] ?? LAYERS);
      this._geoms.set(name, g);
    }
    return g;
  }

  /**
   * How much bare rock the low faces show, and where the snow line sits.
   * @param {number} amt 0 all snow, 1 fully exposed
   * @param {number} [line] metres above the eye
   */
  setRock(amt, line = 60) {
    this.material.uniforms.uRockAmt.value = amt;
    this.material.uniforms.uSnowLine.value = line;
  }

  /** Which skyline this place has. See `RANGE_PROFILES`. */
  setProfile(name) {
    const g = this._geomFor(name in RANGE_PROFILES ? name : 'ridges');
    if (this.mesh.geometry !== g) this.mesh.geometry = g;
  }

  /**
   * ── HOW MUCH OF THE RANGE THE PLACE HAS ─────────────────────────────────
   *
   * "The easiest thing to change is the far away view - for example don't show
   * the additional mountains, just the sky." Correct, and it is the single
   * biggest change available for the least work: this is ONE merged mesh, so it
   * can be sunk or taken away wholesale.
   *
   * SUNK RATHER THAN SWITCHED, between the extremes. Dropping the range leaves
   * only its highest summits breaking the horizon, which reads as standing ABOVE
   * the massifs rather than as a mountain range having been deleted -- and the
   * fog still has something to grade into. Only at the bottom of the scale does
   * it go entirely, leaving bare sky where the peaks were.
   *
   * 1 is the range this game has always had. 0 is sky.
   */
  setPresence(k) {
    this.presence = k;
    this.mesh.visible = k > 0.02;
  }

  /** Follows the camera exactly, like the sky dome: a backdrop has no parallax. */
  update(camPos) {
    this.mesh.position.copy(camPos);
    // The layers reach about 270 m above the eye at their summits, so 300 is
    // enough to put every one of them under the horizon.
    if (this.presence < 1) this.mesh.position.y -= (1 - this.presence) * 300;
  }

  dispose() {
    for (const g of this._geoms.values()) g.dispose();
    this.material.dispose();
  }
}
