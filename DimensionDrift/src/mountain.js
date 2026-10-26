// The mountain: one analytic height field, and a chunked ribbon mesh that draws it.
//
// Terrain and physics must never disagree — a rider floating a hand's width above
// the snow, or a kicker the board passes straight through, is instantly fatal to
// the illusion. So there is exactly ONE definition of the surface, `Terrain.height`,
// and both the mesh generator and the rider call it. Nothing is baked, nothing is
// sampled from a texture, and there is no separate collision representation.
//
// AXES. The rider descends toward -Z, so `p = -z` is distance travelled down the
// mountain and grows through a run. The bowl is described in `u = x - centerX(z)`,
// the lateral offset from the corridor's meandering centre line. Every module in
// the game speaks (p, u) for gameplay and (x, y, z) for rendering.

import * as THREE from 'three';
import { clamp, smoothstep, fbm, vnoise } from './rng.js';

/**
 * Half-width of the rideable bowl, metres. Gates live well inside this.
 *
 * Sized against the camera, not against realism. A portrait viewport gives only
 * about forty degrees horizontally, so a corridor much wider than this simply
 * runs off both edges of the frame and the banked walls — the whole reason the
 * cross-section is a parabola — never become visible enough to ride.
 */
export const HALF = 32;

/**
 * Where travel STOPS. The bowl's gradient beyond the rim is a nudge toward
 * home, not a wall — a rider holding a full edge out-carves it and ends up a
 * hundred metres out on featureless flats (Elad's 2026-10-14 screenshot, P2 in
 * split-screen). The rideable world ends here, hard, a little up the valley
 * side so hitting it reads as the slope refusing you rather than as glass.
 */
export const EDGE_MAX = HALF * 1.4;

/** How far ahead terrain exists. Beyond this the height fog has closed anyway. */
export const VIEW = 560;

/** Metres of descent per mesh chunk. */
export const CHUNK = 70;

const ROWS = 26;                 // z samples per chunk (~2.7 m)
const COL_START = 2.0;           // lateral sample spacing at the centre line
const COL_GROWTH = 1.085;        // geometric widening outward
const COL_LIMIT = 260;           // lateral reach of the mesh

// Descent profile. slope(p) = S0 + S1*sin(p/L1) + S2*sin(p/L2 + PH); the mountain
// steepens and eases so that speed has somewhere to come from and somewhere to go.
const S0 = 0.30;
const S1 = 0.075;
const L1 = 260;
const S2 = 0.05;
const L2 = 95;
const PH = 1.7;

/**
 * The descent profile, for anyone who needs to reproduce `baseHeight` outside
 * this file — currently `lit.js`, which has to gate its direct light by the same
 * altitude-above-the-fall-line the snow does, or every solid object in the scene
 * stands in a different sun from the ground it stands on.
 *
 * Exported rather than copied: two independent lists of these six numbers would
 * drift the first time the mountain's shape was tuned, and the symptom would be
 * trees lighting up at a slightly different point on the hill from the snow.
 */
export const FALL_PROFILE = { S0, S1, L1, S2, L2, PH };

// Corridor meander.
const A1 = 34;
const M1 = 220;
const A2 = 15;
const M2 = 88;

const LANDING = 46;              // metres of landing behind a kicker's lip
const BOWL = 9.0;                // rise at the edge of the piste, metres
// Valley-wall coefficient. Dropped from 26: at 260 m lateral — the mesh's reach
// — the walls topped 110 m and, because height fog THINS with altitude, they
// loomed clear out of the haze as two enormous untextured sheets while the floor
// of the valley was hazed away. A gentler valley reads as a mountain; a steeper
// one read as scenery flats either side of the stage.
const WALL = 15;

/**
 * ── HOW CLOSE THE VALLEY IS, AS A FUNCTION OF HOW FAR DOWN IT YOU ARE ───────
 *
 * Asked for as "change the close geometry -- maybe having some curved close
 * valley, and then a turn to a more open one like we see now".
 *
 * The knob that does this is NOT the wall's height, which is what every
 * previous attempt reached for. It is the wall's ONSET: how far out from the
 * centre line the ground stops being a bowl and starts being a valley side. At
 * an onset of 1.5 half-widths the sides are 48 m away and the place reads as an
 * open face; at 1.02 they begin at the rim itself and the same corridor reads
 * as a gorge. The rideable width never changes.
 *
 * WHICH IS THE WHOLE POINT. The onset floor is 1.0 and not lower, so the walls
 * can never come inside `HALF` -- the corridor is exactly as wide and exactly
 * as rideable in a gorge as on an open face, and nothing tuned against HALF
 * (gate amplitude, the off-piste test, the rivals' lanes, the finish banner)
 * has to know this exists. It is a change to what the mountain LOOKS like from
 * inside a corridor that is not moving.
 *
 * The wavelength is long -- about 2.7 km, so a 2400 m race rides roughly one
 * open-to-closed-to-open breath of it, and a gorge lasts long enough to be a
 * stretch of mountain rather than a passing feature.
 *
 * `VALLEY_SCALE` is what a place turns up or down; 0 leaves the mountain
 * exactly as it was before any of this.
 */
const GORGE_WAVE = 430;
const ONSET_OPEN = 1.55;
const ONSET_TIGHT = 1.02;
const WALL_OPEN = 0.85;
const WALL_TIGHT = 1.55;
/** Extra meander where it is tight: a close valley that runs straight is a
 *  corridor, and a curved one is a place. */
const MEANDER_TIGHT = 1.45;
export let VALLEY_SCALE = 0;
export function setValleyScale(v) { VALLEY_SCALE = v; }

/** 0 open, 1 closed in, at distance p. */
function gorgeAt(p) {
  if (VALLEY_SCALE <= 0) return 0;
  return VALLEY_SCALE * (0.5 + 0.5 * Math.sin(p / GORGE_WAVE));
}

/**
 * The surface, as pure maths. No three.js, no state beyond the seed and the
 * kicker list — so it is cheap to call from the physics step every frame and
 * safe to call from anywhere.
 */
export class Terrain {
  constructor(seed) {
    this.seed = seed | 0;
    /** @type {{p:number, u:number, h:number, len:number, w:number}[]} sorted by p */
    this.kickers = [];
  }

  /** Kickers must be known before the terrain around them is meshed. */
  setKickers(list) {
    this.kickers = [...list].sort((a, b) => a.p - b.p);
  }

  /** Height of the corridor centre line's x at a given z. */
  centerX(z) {
    const p = -z;
    // Curvier where the valley is tight. The corridor MOVES, it does not
    // narrow, so this costs the rider nothing -- `u` is measured from this line
    // and every gate, tree and rival is placed against it.
    const m = 1 + (MEANDER_TIGHT - 1) * gorgeAt(p);
    return (A1 * Math.sin(p / M1) + A2 * Math.sin(p / M2 + 2.3)) * m;
  }

  /** Local pitch of the mountain, rise/run, at distance p. Always positive. */
  slopeAt(p) {
    return S0 + S1 * Math.sin(p / L1) + S2 * Math.sin(p / L2 + PH);
  }

  /**
   * Height of the fall line at p — the analytic integral of -slope(p), so the
   * descent is exactly consistent with `slopeAt` rather than approximately.
   */
  baseHeight(p) {
    return -(S0 * p - S1 * L1 * Math.cos(p / L1) - S2 * L2 * Math.cos(p / L2 + PH))
      - (S1 * L1 * 1 + S2 * L2 * 1); // constant chosen only to start the run near y=0
  }

  /**
   * The bowl. A parabola through the piste — so gravity always leans on you to
   * return to the centre line, and carving up the wall is a real trade of speed
   * for height — then valley walls beyond it.
   */
  crossSection(u, p) {
    const t = Math.abs(u) / HALF;
    // The parabola must STOP AT THE RIM. Uncapped it kept growing as u² all the
    // way to the mesh edge — at 260 m lateral that is six hundred metres of
    // snow either side of the course, a canyon whose far face filled the sky.
    // The "wall across the sky", the rocks and trees "floating" high in the
    // frame, and the unreadable dark valley every time a rider drifted wide all
    // traced back to this one term; every previous fix tuned WALL, which tops
    // out at thirty metres and was never the cliff.
    const tc = Math.min(t, 1);
    let h = BOWL * tc * tc;
    // …but it cannot go FLAT out there either. The parabola's lateral gradient
    // is the force that leans a wide rider back toward the course, and with it
    // gone entirely the autopilot — and any player who drifted past the rim —
    // just kept sailing outward over the relief noise until the off-piste
    // wipeout took them. A linear continuation keeps a constant, gentle push
    // toward home: real valley sides, not a canyon and not a plain.
    if (t > 1) h += BOWL * 0.8 * (t - 1);
    // The onset walks in and out along the valley -- see `gorgeAt`. It is
    // clamped at 1.0 from below by construction, so a wall can sit AT the rim
    // and never inside it.
    const gg = gorgeAt(p);
    const onset = ONSET_OPEN + (ONSET_TIGHT - ONSET_OPEN) * gg;
    if (t > onset) {
      const w = (t - onset) / 1.5;
      const flare = (WALL_OPEN + (WALL_TIGHT - WALL_OPEN) * gg)
        * (1 + 0.35 * Math.sin(p / 180));
      // SATURATING, not polynomial. The mesh reaches 260 m either side, which is
      // eight times the bowl's half width — a w*w*(1+w) wall put the outermost
      // column three and a half kilometres in the air, hung rocks in the sky and
      // spent the whole frame budget on a handful of enormous triangles. Beyond
      // the rim the ground now rolls over into a ridge and stops climbing, which
      // is also what a valley actually does.
      h += WALL * flare * (1 - Math.exp(-w * w * 1.6)) * 2.2;
    }
    return h;
  }

  /**
   * Rolling relief. Deliberately near-flat on the groomed piste and violent off
   * it: the racing line has to stay readable at 90 km/h, while everything the
   * player is not riding on should look like an actual mountain.
   */
  relief(x, z, u) {
    const t = Math.abs(u) / HALF;
    const off = smoothstep(0.78, 1.7, t);
    let h = fbm(x * 0.0072, z * 0.0072, 3, this.seed) * (2.0 + 17 * off);
    h += fbm(x * 0.030, z * 0.030, 2, this.seed + 77) * (0.5 + 3.0 * off);
    // Gentle transverse rollers on the piste — free air off every one of them
    // if you are carrying speed, and a rhythm to the terrain even where the
    // course has not placed anything.
    const p = -z;
    h += Math.sin(p * 0.052) * Math.cos(u * 0.019) * 1.0 * (1 - off);
    return h;
  }

  /**
   * Kicker ramps.
   *
   * The run-up rises as the SQUARE of its length, so the steepest part — and
   * therefore all of the pop — is at the lip; a smoothstep would flatten out
   * exactly where the kick should be.
   *
   * Behind the lip the ground falls through the base slope into a shallow
   * landing scoop and eases back. The first version simply dropped from full
   * height to zero over eight metres, which at three and a half metres tall is a
   * forty degree face standing across the piste — it rendered as a wall, because
   * it WAS one.
   */
  kickerAt(p, u) {
    const k = this.kickers;
    if (k.length === 0) return 0;
    // Binary search to the first kicker that could still be in range.
    let lo = 0;
    let hi = k.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (k[mid].p + 12 < p) lo = mid + 1;
      else hi = mid;
    }
    let h = 0;
    for (let i = lo; i < k.length; i++) {
      const kk = k[i];
      const a = p - kk.p;              // 0 at the lip, negative on the run-up
      if (a < -kk.len) break;          // sorted: everything after is further away
      if (a > LANDING) continue;
      // CROWNED across, not flat-topped. The old profile held full height for
      // nearly half the width and then fell off over a couple of metres — from
      // the chase camera that rendered as a glowing flat pancake with steep cut
      // sides, which is exactly the "weird wall" it kept being called. A crown
      // also keeps the side slopes under thirty degrees, so the mesh columns
      // can actually follow them.
      const lat = 1 - smoothstep(0, 1, Math.abs(u - kk.u) / kk.w);
      if (lat <= 0) continue;
      let prof;
      if (a <= 0) {
        const s = (a + kk.len) / kk.len; // 0 at the foot, 1 at the lip
        prof = s * s;
      } else {
        // The knuckle drop, and NOTHING below grade. The old scoop subtracted a
        // sine that dug a metre-deep trench forty metres long behind every lip
        // — a dark gash outlining the jump instead of a landing. 0.26 of the
        // landing (~12 m for a 3 m lip, about a 25° face with the base slope)
        // is the sharpest this can go and still read as snow, not a wall.
        const s = a / LANDING;
        prof = 1 - smoothstep(0, 0.26, s);
      }
      h += kk.h * prof * lat;
    }
    return h;
  }

  /**
   * 0..1 band along each kicker's lip crest — the dye line. Resorts paint the
   * lip of every park feature blue because flat light erases all shading on
   * built snow; the paint is the one cue that survives it. Ours exists for
   * exactly the same reason.
   */
  lipAt(p, u) {
    const k = this.kickers;
    let best = 0;
    for (let i = 0; i < k.length; i++) {
      const kk = k[i];
      const a = Math.abs(p - kk.p);
      // Wider than it looks: mesh rows are ~2.7 m apart, and a band narrower
      // than the sampling simply fell between the vertices and never rendered.
      if (a > 4.5) continue;
      const lat = 1 - smoothstep(0, 1, Math.abs(u - kk.u) / kk.w);
      if (lat <= 0) continue;
      const band = (1 - Math.min(1, a / 4.2)) * lat;
      if (band > best) best = band;
    }
    return best;
  }

  /** THE surface. Everything else in the game is downstream of this one number. */
  height(x, z) {
    const p = -z;
    const u = x - this.centerX(z);
    return this.baseHeight(p) + this.crossSection(u, p) + this.relief(x, z, u) + this.kickerAt(p, u);
  }

  /** ∂h/∂x and ∂h/∂z by forward difference. eps is ~half a mesh cell. */
  gradient(x, z, out = { gx: 0, gz: 0 }) {
    const e = 0.9;
    const h0 = this.height(x, z);
    out.gx = (this.height(x + e, z) - h0) / e;
    out.gz = (this.height(x, z + e) - h0) / e;
    return out;
  }

  /** Lateral offset from the centre line for a world x at a given z. */
  offsetOf(x, z) {
    return x - this.centerX(z);
  }

  /** World x for a lateral offset u at a given z. */
  xAt(u, z) {
    return this.centerX(z) + u;
  }
}

// ── Mesh ────────────────────────────────────────────────────────────────────

/** Lateral sample offsets: dense on the piste, geometric outward. */
function buildColumns() {
  const half = [];
  let step = COL_START;
  let u = 0;
  while (u < COL_LIMIT) {
    u += step;
    half.push(u);
    step *= COL_GROWTH;
  }
  const cols = [];
  for (let i = half.length - 1; i >= 0; i--) cols.push(-half[i]);
  cols.push(0);
  for (let i = 0; i < half.length; i++) cols.push(half[i]);
  return cols;
}

const COLS = buildColumns();
const ROW_STEP = CHUNK / ROWS;

/**
 * Height of the surface AS DRAWN, rather than as defined.
 *
 * Off the piste the mesh columns are up to twenty metres apart while the relief
 * has real amplitude, so the tessellated surface sits well below the analytic one
 * over any convex ground. Anything placed at `terrain.height` out there — a tree,
 * a rock — is left standing in mid-air above the triangles actually drawn.
 *
 * This solves the TRIANGLE, not a bilinear patch. Bilinear differs from the drawn
 * surface by `a * t * (h11 - h10 - h01 + h00)`, and on a twenty-metre cell with
 * metres of twist in it that term is metres tall on its own — which is why the
 * first version of this still left trees hanging.
 */
export function meshHeight(terrain, x, z) {
  const p = -z;
  const rp0 = Math.floor(p / ROW_STEP) * ROW_STEP;
  const rp1 = rp0 + ROW_STEP;
  const t = clamp((p - rp0) / ROW_STEP, 0, 1);

  const z0 = -rp0;
  const z1 = -rp1;
  const cx0 = terrain.centerX(z0);
  const cx1 = terrain.centerX(z1);
  // THE QUADS ARE PARALLELOGRAMS, NOT RECTANGLES. Every row plants its columns
  // about its OWN centre line, and the corridor meanders by up to 0.87 m from one
  // row to the next, so a quad's far edge is offset in x from its near edge by
  // that much. Measuring the column fraction from the near row's centre line
  // alone therefore got it wrong by (shear / column width), which is worst
  // exactly where the columns are widest: measured against the drawn triangles,
  // 0.18 m of height error at u = 23 where gates stand, and 0.51 m at u = 40.
  // Shearing the datum by the same t the rows are interpolated at makes the
  // parametrisation exact — 3 mm worst case, which is float noise.
  //
  // This is the same class of fault as planting scenery on the analytic surface
  // instead of the drawn one (which is what this function exists to prevent), one
  // order of magnitude down: everything downstream — trees, rocks, poles, gates,
  // the trail — was absorbing it in its own fudge margin.
  const u = x - (cx0 + t * (cx1 - cx0));

  const last = COLS.length - 1;
  let lo;
  if (u <= COLS[0]) lo = 0;
  else if (u >= COLS[last]) lo = last - 1;
  else {
    let a = 0;
    let b = last;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (COLS[m] <= u) a = m; else b = m;
    }
    lo = a;
  }
  const cA = COLS[lo];
  const cB = COLS[lo + 1];
  const a = clamp((u - cA) / (cB - cA), 0, 1);

  const h00 = terrain.height(cx0 + cA, z0);
  const h10 = terrain.height(cx0 + cB, z0);
  const h01 = terrain.height(cx1 + cA, z1);
  const h11 = terrain.height(cx1 + cB, z1);

  // The index buffer splits every quad along the diagonal running from
  // (a = 1, t = 0) to (a = 0, t = 1); a + t <= 1 is the near-side triangle.
  if (a + t <= 1) return h00 + a * (h10 - h00) + t * (h01 - h00);
  return h11 + (1 - a) * (h01 - h11) + (1 - t) * (h10 - h11);
}

const SNOW_VERT = /* glsl */ `
attribute float aU;
attribute float aShade;
attribute float aKick;
attribute float aLip;
attribute float aAlt;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vU;
varying float vShade;
varying float vKick;
varying float vLip;
varying float vAlt;
uniform vec3 uCamPos;
varying vec3 vRel;
void main() {
  vWorld = position;
  // CAMERA-RELATIVE TWIN OF vWorld, for every term built from DERIVATIVES.
  // The geometry carries absolute world coordinates, and past |p| ~ 16384 the
  // float32 interpolator's step (4mm at 2^15) exceeds the fragment-to-fragment
  // differences dFdx/dFdy measure: the cross product cancels to garbage,
  // normalize(0) is undefined, and whole triangles render unlit black -- the
  // "blacks bug", measured as a dose-response on p (clean at 8k, 66% of the
  // ground pure black at 17.5k, 89% at 33k) after every host platform had been
  // exonerated. Subtracting the camera here is exact (both operands share
  // magnitude), the varying then interpolates numbers the size of the view
  // distance, and the derivatives come back. Pattern terms (wind, corduroy,
  // sparkle) stay on vWorld on purpose: their features are metres wide, so
  // millimetre quantisation cannot touch them, and rebasing them would make
  // the snow pattern swim with the camera.
  vRel = position - uCamPos;
  vNormal = normal;
  vU = aU;
  vShade = aShade;
  vKick = aKick;
  vLip = aLip;
  vAlt = aAlt;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// The snow shader. Four things, in order of how much they matter:
//
//  1. WRAPPED DIFFUSE. Snow is so forward-scattering that light wraps far past
//     the terminator. Shading it with plain N·L gives grey plastic; wrapping the
//     lobe is most of the reason this reads as snow at all.
//  2. SPARKLE. Individual ice crystals catching the sun, as a per-cell random
//     normal through a very tight specular lobe. Only a few pixels fire and they
//     scintillate as the camera moves — the detail the eye reads as "real snow".
//  3. CORDUROY. Groomer lines along the fall line, in two scales: a 2.42 m pass
//     band, which is what the eye actually reads as grooming at any distance, and
//     the 0.24 m tiller ridge as a whisper on top of it. Both applied to the
//     normal AND to the albedo, because at first light the altitude gate makes a
//     lateral normal tilt worth very little (see the light block).
//
//     MEASURE THE CAMERA BEFORE YOU RETUNE ANY THRESHOLD IN HERE. Every distance
//     constant this shader has ever carried was set against a camera nobody had
//     measured, and the file has claimed 2.4 m / 29.7 m, then "seven metres up
//     looking forty ahead", then 5.9 m / 13 m at 27° down. Probed on the
//     canonical frame (tools ride to p = 300 and freeze): the chase camera sits
//     8.68 m above the drawn snow, pitched 7.2° down, 61.7° vertical fov on a
//     1320x800 frame. What the thresholds actually need is not the camera but
//     what it implies — the world footprint of a pixel, which runs
//
//         screen row     ground dist     metres/px in x     metres/px in z
//              780           27.7 m           0.038              0.098
//              700           39.6 m           0.063              0.207
//              660           50.0 m           0.086              0.309
//              600           80.4 m           0.154              0.665
//              580          101.9 m           0.275              1.665
//
//     — note the z column, five to seventeen times the x. That table is why every
//     band limit here is now `resolves()` on the world size of the feature and
//     both footprints, and why nothing in this shader fades on camDist any more.
//     N·V on the piste runs 0.22 at the top of the visible snow to 0.63 at the
//     bottom edge, which is where the graze band below is placed.
//  4. SELF-SHADOWING. `aShade` is marched through the height field on the CPU
//     when a chunk is built, so it costs nothing per pixel. With a sun this low
//     it is the single biggest thing separating snow-covered ground from a white
//     gradient: ridges throw long shadows down the piste and the terrain reads as
//     terrain.
//  5. SASTRUGI. Wind-drifted ripples, 0.54 m across and 2.41 m long on a lattice
//     rotated 20° off the fall line, tilting the normal by the noise's own
//     analytic gradient and drifting the albedo by its value — one fetch, two
//     jobs — so untouched snow is not a flat white plane.
//  6. HEIGHT FOG with directional inscatter, so valleys fill with haze, ridges
//     emerge from it, and looking toward the sun glows.
const SNOW_FRAG = /* glsl */ `
precision highp float;

uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uSkyColor;
uniform vec3  uGroundColor;
uniform vec3  uSnowColor;
uniform vec3  uRockColor;
uniform vec3  uFogColor;
uniform vec3  uFogSunColor;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
uniform float uSparkle;
uniform float uHalf;
uniform vec3  uCamPos;
// Metres above the fall line at which the sun clears the range that rings this
// valley, and the wrapped-diffuse value level ground would take if it did. See
// the block comment on the light section, and _syncSun() below.
uniform float uSunFloor;
uniform float uSunFlat;

varying vec3  vWorld;
varying vec3  vRel;
varying vec3  vNormal;
varying float vU;
varying float vShade;
varying float vKick;
varying float vLip;
varying float vAlt;

// The hash the whole surface is built on, and the one thing a mountain this long
// breaks.
//
// fract(sin(dot(p, K))) is the standard construction, and hardware sin() reduces
// its argument as fract(x / 2pi) IN FP32 before it evaluates anything. Once
// dot(p, K) passes a million that reduction has four bits left. Measured on this
// renderer, by hashing 256 consecutive lattice cells:
//
//     lattice index         distinct values      what it is
//     iz =      0                145 / 256       any of these, at the gate
//     iz =   -308                150 / 256       the 9 m albedo drift, at 2.8 km
//     iz =  -5320                 27 / 256       the scratch lines, at 2.8 km
//     iz = -19600                  9 / 256       the granulation, at 2.8 km
//
// — and not merely few values but a repeating ORDER of them: at iz = -19600 the
// sequence starts 44, 234, 180, 234, 44. THAT is the repeating snow. It gets
// worse the further down the mountain you ride, which is exactly why it survived
// every still-frame comparison ever made against the reference art: the canonical
// shot is taken at p = 300, where the hash is still healthy.
//
// The previous round's fix wrapped z at 585 m for the granulation term, which
// buys the entropy back by repeating the entire texture instead: the albedo of a
// patch of piste correlates 0.78 with the patch 585 m below it, sharply — 0.78 at
// exactly 585 m and under 0.05 at 584 or 586 — and a run is 2.8 km, so the player
// rides through the same snow five times. That wrap is gone.
//
// Folding each coordinate into [0,1) BEFORE the dot fixes both at once. Each fold
// keeps twelve bits of its own axis, so the pair keeps twenty-four — more than
// fract(sin(x) * 43758.5) can express anyway, since that product is quantised to
// 1/256 in fp32 whatever you feed it. sin() never sees an argument above 440, and
// nothing repeats at any distance this game can reach. Measured: 3900 distinct
// values out of 65536, neighbour correlation below 0.01, IDENTICAL at p = 0 and
// at p = 5000. One multiply and one fract.
float h21s(vec2 p) {
  vec2 q = fract(p * vec2(0.1031, 0.11369));
  return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123);
}

float n21s(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21s(i), h21s(i + vec2(1.0, 0.0)), f.x),
             mix(h21s(i + vec2(0.0, 1.0)), h21s(i + vec2(1.0, 1.0)), f.x), f.y);
}

/**
 * Value noise AND its analytic gradient, out of the four corner hashes the value
 * already pays for. x = value, yz = d/dp.
 *
 * The sastrugi used to tilt the normal by finite difference: three separate n21s
 * fetches a third of a metre apart, twelve hashes to estimate one gradient. This
 * noise IS a bilinear patch under a smoothstep, so it can simply be
 * differentiated — four hashes, one fetch, and the answer is exact rather than
 * smeared over 0.35 m, which on a 0.4 m ripple was averaging away most of the
 * thing it was measuring. A third of the cost and a sharper ridge.
 */
vec3 n21sd(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  vec2 dw = 6.0 * f * (1.0 - f);
  float a = h21s(i);
  float b = h21s(i + vec2(1.0, 0.0));
  float c = h21s(i + vec2(0.0, 1.0));
  float d = h21s(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = a - b - c + d;
  return vec3(a + k1 * w.x + k2 * w.y + k3 * w.x * w.y,
              (k1 + k3 * w.y) * dw.x,
              (k2 + k3 * w.x) * dw.y);
}

/**
 * How much of a world-space feature survives being sampled at this pixel: 1
 * while its smaller on-screen dimension spans more than 2.4 px, 0 once it is
 * under one and would fold rather than average.
 *
 * 2.4 and not 3: value noise carries very little energy above its own cell
 * frequency, so it is already soft by the time a cell is two pixels wide, and a
 * gate that shuts at three throws away the last octave of real detail. Cutting
 * at three cost the foreground half its per-pixel gradient (6.9 down to 3.5,
 * against the reference's 7.0) — the same fault as the fwidth fades this
 * replaced, in the opposite direction.
 *
 * THIS IS THE DIFFERENCE BETWEEN A SURFACE AND STATIC, and it replaces a family
 * of hand-tuned DISTANCE fades. A distance fade holds a term at roughly constant
 * SCREEN frequency, which is exactly how a world-space texture stops reading as
 * ground and starts reading as an overlay on the image: measured on the
 * canonical frame, per-pixel gradient by depth band ran 6.9 / 6.8 / 5.4 near to
 * far where the reference art runs 7.0 / 4.0 / 2.2. Ours barely receded.
 *
 * cell is the feature's world size on each axis, m the metres of world one
 * pixel covers on each axis. BOTH axes are watched, and that matters more than
 * it looks: the chase camera sits 8.7 m up and looks 7 degrees down, so a pixel
 * at the bottom of frame is 3.8 cm across in x and 9.8 cm in z, and by eighty
 * metres it is 15 cm and 66 cm. Watching x alone — which the granulation used to
 * do, on the stated theory that a crushed axis averages rather than folds — has
 * it backwards: foreshortening packs MORE cells into a pixel down the fall line,
 * so z folds first, every time.
 */
float resolves(vec2 cell, vec2 m) {
  return smoothstep(1.0, 2.4, min(cell.x / m.x, cell.y / m.y));
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

void main() {
  // FACETED, the whole direction of the look. The smooth analytic normals
  // shaded every slope as one continuous pale gradient, and a big smooth pale
  // surface against a pale sky reads as frosted glass — days were spent
  // hunting 'see-through mountains' in the mesh when the translucency was the
  // SHADING. Per-face normals from screen-space derivatives turn every
  // triangle into one distinct light-catching facet: crystalline, solid,
  // unmistakably ground. The interpolated normal survives only as a reference
  // to keep the facets pointing out of the hill.
  vec3 Nv = normalize(vNormal);
  // vRel, NOT vWorld, everywhere a derivative or a camera difference is taken
  // -- see the vertex shader for the full account of the 16384m cliff.
  vec3 N = normalize(cross(dFdx(vRel), dFdy(vRel)));
  if (dot(N, Nv) < 0.0) N = -N;
  vec3 V = normalize(-vRel);
  vec3 L = normalize(uSunDir);
  // ONE distance. It used to be measured four separate times in one shader.
  float camDist = length(vRel);
  // THE SCREEN FOOTPRINT OF THE WORLD, in metres per pixel on each axis,
  // measured once and handed to every band limit in this shader. See resolves().
  // The old distance fades and the two stray fwidth() tests are all gone; every
  // term now states the world size of the thing it draws and is cut off at the
  // point that size stops being resolvable, which is the only way a texture
  // shrinks with distance the way the ground it sits on does.
  vec2 mpp = max(vec2(fwidth(vRel.x), fwidth(vRel.z)), 1e-4);

  // ── wind regions ────────────────────────────────────────────────────────
  // SNOW IS NOT STATIONARY, and ours was. The reference's piste changes character
  // across a single frame — soft drifted patches, scoured lanes with the pack
  // showing through, bands of wind crust — while this shader applied one
  // statistical mix to every square metre of a 2.8 km mountain. That is the other
  // half of the repetition complaint and the harder half: no patch recurs, but no
  // patch is distinguishable from any other either, so the surface reads as
  // wallpaper however good the wallpaper is.
  //
  // Two octaves, stretched about 3:1 down the fall line, because wind leaves
  // LANES and not blobs. These are the same two fetches that used to buy nothing
  // but a brightness wash; they now also decide how much granule shadow and how
  // much ripple the snow carries here, and jitter the groomer's phase. One noise
  // paying for four things is the only reason this fits in the budget.
  //
  // Hoisted ABOVE the corduroy, which now reads it.
  float wind = n21s(vec2(vWorld.x * 0.030, vWorld.z * 0.0105))
             + 0.45 * n21s(vec2(vWorld.x * 0.13, vWorld.z * 0.045) + 9.0);
  // Centred on the field's own mean (0.725) so neither character dominates.
  float scour = smoothstep(0.58, 0.88, wind);

  // ── corduroy ────────────────────────────────────────────────────────────
  // Only on the groomed piste, and only where it is still resolvable.
  //
  // TWO SCALES, and the COARSE one is the point. The previous round cut this to
  // a single 0.24 m ridge at a 0.045 tilt because two blind reviewers had called
  // the old 0.9 m / 5.5 m pair "brushed denim" — but that was an amplitude fault
  // (0.42 and 0.20 tilt, swinging ndl by ±0.335 and driving every trough to zero
  // direct light), and the cure removed the SCALE along with the amplitude. What
  // was left is a 6 px cosine at the bottom of frame and nothing above 40 m: a
  // fine texture where the reference has a broad ordered one. Measured on a
  // matched patch of foreground piste, the reference carries 70% of its variance
  // below 0.06 cyc/px and 9% above 0.15; we carried 44% and 27%. Ordered
  // structure turned down 14x, disordered noise left at 10x.
  //
  // So: a 2.42 m PASS band, which is a groomer's width and projects to 63 px at
  // the bottom of frame and 9 px at a hundred metres — squarely the band we are
  // short in — carrying most of the amplitude, plus the 0.24 m tiller ridge as a
  // whisper on top of it. The pass band's phase is jittered by the wind field so
  // it is not a perfect comb; the reference's autocorrelation has no periodic
  // bump in it, and real passes are neither parallel nor evenly spaced.
  //
  // Corduroy DAMPED on a kicker, not erased. At full strength the groomer
  // lines fanned into giant converging bands across the curved face — the
  // "weird wall". Fully masked, the face became a featureless patch that
  // camouflaged into the piste behind it and read as a hole instead. A third
  // of the texture keeps the surface legible as snow without the banding.
  float piste = (1.0 - smoothstep(0.88, 1.04, abs(vU) / uHalf)) * (1.0 - vKick * 0.65);

  // Faceting on the piste. Mesh columns are 2.0 m and rows 2.7 m, so a near-field
  // facet is fifty pixels of flat shading; off the piste that is exactly right
  // (it is what makes the walls read as crystalline ground rather than frosted
  // glass, and it measures within 15% of the reference). On a groomed surface it
  // is a stack of shading steps no groomer ever left, so it is blended back
  // toward the smooth analytic normal there — but only to 0.62, not the 0.45 it
  // was. Two-metre facets are ordered structure in exactly the band the frame is
  // missing, and the kicker, which keeps more of them, is the one patch of snow
  // in the frame a critic picked out as looking RIGHT.
  N = normalize(mix(Nv, N, mix(1.0, 0.62, piste)));

  // Band limits stated as what they are: the lateral period of each cosine
  // against the width of a pixel. The old test faded the ridges out at 2.9 px
  // per period — well before they alias — which is the fwidth-holds-it-at-
  // constant-screen-frequency trap this whole file just walked out of.
  float passF  = piste * smoothstep(1.0, 2.4, 2.417 / mpp.x);
  float ridgeF = piste * smoothstep(1.0, 2.4, 0.242 / mpp.x);
  // The grooves run along the fall line, so they tilt the normal laterally only.
  vec3 lateral = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
  float pass  = cos(vU * 2.60 + wind * 1.6);
  float ridge = cos(vU * 26.0);
  N = normalize(N + lateral * (pass * passF * 0.085 + ridge * ridgeF * 0.075));

  // ── sastrugi ────────────────────────────────────────────────────────────
  // Wind-drifted ripples, tilted into the normal by the noise's own gradient.
  //
  // ON the piste, and now at seven tenths rather than the 0.38 it was. The
  // kicker, where this term already ran at 0.78, is measurably the best-looking
  // snow in the frame; the piste, where it was throttled, is the worst. That is
  // not a coincidence and it is the cheapest correction available.
  //
  // COARSER TOO: 0.54 m across the ridges and 2.41 m along, up from 0.36 x 1.6.
  // At the bottom of frame that is 14 px by 63 px instead of 9 by 42 — the same
  // move from the fine band into the ordered one the corduroy just made — and
  // the along-ridge axis now lands where the reference's variance actually is.
  //
  // Scoured ground ripples and drifted ground does not, so the amplitude rides
  // the region field; written so its mean is unchanged.
  //
  // ROTATED, and that is not a detail. A single octave of value noise on a
  // lattice aligned to the world axes reads as WOVEN: the foreground came out a
  // regular mat of same-sized blobs, which is what "repeating" looks like at
  // arm's length. Non-square cells were not enough on their own, because the
  // camera foreshortens z and hands them back square. Ridges running 20° off the
  // fall line cannot square up under any foreshortening, because the lattice no
  // longer lines up with the axis the perspective compresses.
  const vec2 SX = vec2(1.729, 0.627);    // across the ridges, 1 / 0.544 m
  const vec2 SZ = vec2(0.1408, -0.3904); // along them, 1 / 2.41 m
  // Fetched UNCONDITIONALLY now: the value half of it (n.x) pays for an albedo
  // drift below on the same rotated lattice, which is a free metre-scale term in
  // the band the frame is short in, and the branch that used to guard it was
  // taken over essentially the whole near field anyway.
  vec3 sast = n21sd(vec2(dot(vWorld.xz, SX), dot(vWorld.xz, SZ)) + 17.0);
  float sastK = resolves(vec2(0.544, 2.410), mpp);
  float wild = 1.0 - piste * 0.30;
  float detail = wild * sastK * 0.3 * (0.5 + 1.0 * scour);
  // Chain rule back to world x/z: the gradient in lattice space times the same
  // matrix, transposed. Two multiply-adds.
  vec2 g = sast.y * SX + sast.z * SZ;
  N = normalize(N + vec3(-g.x, 0.0, -g.y) * detail * 0.55);

  // ── albedo ──────────────────────────────────────────────────────────────
  // ROCK FROM THE HILL, NOT FROM THE TESSELLATION. This used to threshold the
  // FACETED normal, which is constant across a triangle: rock therefore flipped
  // whole-triangle at a time and salted the valley walls with a hard black-and-
  // white stipple — dither, not scree. grit made it worse, a per-cell coin flip
  // on a 1.43 m cubic lattice that pushed neighbouring facets across the
  // threshold at random. The interpolated normal varies smoothly through a
  // triangle, so the snow line now follows the ground; two octaves of smooth
  // noise break it into bands and tongues of exposed face, and the threshold is
  // wide enough to be a transition rather than an edge.
  float steep = 1.0 - clamp(Nv.y, 0.0, 1.0);
  float rock = 0.0;
  // GATED, and the gate is EXACT rather than a tolerance. grit tops out at 0.37,
  // so below steep = 0.075 the smoothstep's argument cannot reach 0.26 and rock is
  // identically zero however the noise falls — there is no threshold to creep
  // across and no seam to find. The piste runs at steep = 0.04, so the two most
  // expensive fetches in this shader were being computed for the majority of the
  // screen to produce a guaranteed zero. It is coherent branching too: rock lives
  // on the valley walls, which are large contiguous regions of the frame, not
  // scattered pixels.
  if (steep > 0.075) {
    float grit = n21s(vWorld.xz * 0.085) * 0.26 + n21s(vWorld.xz * 0.47 + 5.0) * 0.11;
    // A kicker is steep because it was BUILT, not because rock pokes through it —
    // without the mask its faces came out speckled grey like scree.
    rock = smoothstep(0.26, 0.62, steep + grit - 0.185) * (1.0 - vKick);
  }
  vec3 albedo = mix(uSnowColor, uRockColor, rock);
  // A low sun barely picks a groove out of the normal alone, so the corduroy
  // also darkens in the troughs. Mostly on the PASS band, which is the scale
  // that has to carry: a tilt term is worth very little at first light, because
  // below the sun floor the beam is replaced by a sky-dome term that reads N.y
  // and nothing else, and a groove tilts the normal sideways. Albedo is the only
  // channel the grooming has down there that does not go through that gate.
  albedo *= 1.0 - passF  * 0.034 * (0.5 - 0.5 * pass)
                - ridgeF * 0.032 * (0.5 - 0.5 * ridge);
  // Snow is not one colour. A slow drift keeps large expanses from reading as a
  // single flat fill. It used to run at 0.16/0.08 — 25% linear peak to peak, on
  // 62 m and 9 m cells, which on its own exceeded the reference's ENTIRE surface
  // texture budget and read as blotchy brightness wander rather than as snow.
  // It is now the region field above, stretched into lanes rather than round
  // blobs — so the brightness wander and the change of texture are the same
  // feature of the snow instead of two unrelated ones, which is what makes a
  // drift read as a drift. Two fetches saved.
  //
  // Widened from 8.6% peak to peak to 15%. Cutting it to 8.6% was right when the
  // frame's problem was too much mid-band energy; the frame's problem now is the
  // opposite, and this is the coarsest albedo term in the shader.
  albedo *= 0.877 + 0.103 * (wind - 0.725);
  // DRIFT, on the sastrugi's own rotated lattice — 0.54 m by 2.41 m, which is
  // 14 px by 63 px at the bottom of frame. This is free: the value half of a
  // fetch already paid for above, whose gradient half tilts the normal. It is the
  // one term that puts contrast at the ripple's own scale into the ALBEDO rather
  // than into the normal, and at first light that matters more than it should —
  // see the corduroy note above and the light block below.
  albedo *= 1.0 + 0.09 * sastK * (0.6 + 0.8 * scour) * (sast.x - 0.5);
  // GRANULATION — the pitting of a snow surface, and the term this whole round
  // was called for.
  //
  // It used to sample a 5.6 cm x 9 cm lattice. Measured on the canonical frame,
  // that cell is 1.45 px across at the BOTTOM of the screen, 0.9 px at forty
  // metres and 0.65 px at fifty, and the band limit — which watched x only and
  // triggered at one whole lattice unit per pixel — held it at FULL amplitude
  // through all of that. A term that is sub-Nyquist over its entire visible
  // extent cannot be a texture; it can only be static, which is exactly what an
  // unprompted reviewer called it. It swung albedo from x1.21 down to x0.115: a
  // 8.6:1 salt-and-pepper on a surface whose whole business is being smooth.
  //
  // Now 30 cm x 75 cm, which is 8 px square at the bottom of frame, 3.5 px at
  // fifty metres and gone by a hundred — a thing that recedes — and the swing is
  // 2.3:1. It sits deliberately between the two bands the spectral comparison
  // measures: coarser than the 0.33 m that reads as dirt, finer than the 0.8 m
  // the large forms live in. Snow pitting seen from thirty metres is genuinely
  // that size.
  //
  // The SHAPE is the other half, and it is unchanged. The reference's residual
  // after a k=12 blur is skewed about -0.5: a bright ground carrying DARK speckle,
  // which is the micro-shadow between grains and drift pits. So this is a PIT,
  // not a wobble — only the bottom of the noise darkens — and it is written about
  // its own mean so it does not shift the exposure the piste is calibrated to. A
  // symmetric term, however fine, only raises the variance and stays a wash: it
  // moves the residual's std and not its skew.
  //
  // NOT A HARD CELL. An early cut hashed the lattice directly and at a few pixels
  // a cell the eye read the LATTICE and not the snow. Value noise is band limited,
  // so it rolls off into the fade instead of folding.
  //
  // The 585 m wrap that used to be here is GONE — see h21s. It was buying the
  // hash's entropy back by repeating the whole surface every 585 m, five times a
  // run, measured at 0.78 autocorrelation. h21s now holds its entropy to 5 km on
  // its own and this coordinate is the plain world position again.
  //
  // The scratch lines that used to sit between this and the drift are gone. They
  // were an 11 cm x 53 cm ridged noise at ±32% albedo with no band limit at all —
  // 2.9 px at the bottom of frame, 1.3 px at fifty metres — so they were a second
  // helping of the same static, doing the same job as the granulation one octave
  // up. Deleting them pays for the second corduroy scale and the drift above.
  //
  // ROTATED, both octaves, and on DIFFERENT angles. floor()-free value noise is
  // still sampled on a lattice, and a lattice whose axes are the world's x and z
  // is also, under a camera looking down the fall line, a lattice whose axes are
  // the screen's — so once its cells become resolvable it stops reading as snow
  // and starts reading as a woven grid of little rectangles. That is what the
  // near piste came out as at bluebird, where the beam is real and every albedo
  // term shows three times as hard as it does at first light: a visible mat of
  // 8 px boxes. The sastrugi already solved this for itself two blocks up; the
  // granulation had to as well. -35 degrees for the coarse octave and +25 for the
  // fine, so the two do not line up with each other either. Four dot products.
  const vec2 QX = vec2(2.7032, -1.8928);  // 30 cm across, -35 deg
  const vec2 QZ = vec2(0.7629,  1.0895);  // 92 cm along
  vec2 gq = vec2(dot(vWorld.xz, QX), dot(vWorld.xz, QZ));
  float gk = resolves(vec2(0.303, 0.752), mpp);
  float pit = max(0.0, 0.52 - n21s(gq + 61.0)) - 0.10;
  // Loose drifted snow is all granule shadow; wind crust is glazed and has almost
  // none. Mean unchanged, so the exposure the piste is calibrated to does not move.
  albedo *= 1.0 - 0.72 * (1.30 - 0.6 * scour) * pit * gk;
  // AND A SECOND OCTAVE, 13 cm by 33 cm, which is the one that has to DIE.
  //
  // Coarsening the granulation fixed the static and then went straight past the
  // target: with nothing left below 30 cm the foreground's per-pixel gradient
  // fell from 6.9 to 3.5 against the reference's 7.0, and the share of variance
  // above 0.15 cyc/px went from 27% to 1.2% against its 9.3%. Snow at thirty
  // metres does have pixel-scale detail; what it does not have is the SAME
  // pixel-scale detail at eighty.
  //
  // So this octave is 3.4 px across at the bottom of frame, 1.6 px at forty
  // metres and gone by fifty — resolves() cuts it exactly where it would begin to
  // fold — while the octave above it carries on to a hundred. Two terms retiring
  // at different depths is what a receding surface IS, and it is why the gradient
  // can be steep near and smooth far instead of one flat number at both.
  //
  // STRETCHED 3.5:1 down the fall line, not 2.5:1: the binding constraint on a
  // fine cell is always the z footprint, which is 2.5 to 5 times the x one
  // everywhere in frame, so widening the cell along the axis the camera crushes
  // buys depth for nothing in the direction the eye reads detail — the lateral
  // one. It is a balance and not a free lunch: at 6:1 the whole foreground came
  // out combed, a fibrous mat of long streaks that reads as brushed fur rather
  // than as snow, because the sastrugi above is already anisotropic in nearly the
  // same direction and the two stacked.
  // SYMMETRIC, where the octave above it is a pit, and that is deliberate. The
  // pit shape is what carries the residual's negative skew — bright snow with
  // dark specks in it, which is what the reference measures at about -0.5 — and
  // stacking a second one-sided term on top of it took the skew to -1.25, twice
  // as far the other side. One pit for the skew and one symmetric octave for the
  // variance lands both.
  const vec2 FX = vec2(6.9792, 3.2542);   // 13 cm across, +25 deg
  const vec2 FZ = vec2(-0.9298, 1.9938);  // 45 cm along
  vec2 gf = vec2(dot(vWorld.xz, FX), dot(vWorld.xz, FZ));
  float fk = resolves(vec2(0.130, 0.455), mpp);
  albedo *= 1.0 + 1.55 * fk * (n21s(gf + 23.0) - 0.5);

  // ── light ───────────────────────────────────────────────────────────────
  //
  // THE SUN HAS TO CLEAR THE RANGE BEFORE IT REACHES YOU. "first light" means
  // the sun is up on the summits and has not yet arrived in the valley: the
  // near field takes NO direct beam and is lit by the sky dome alone. We were
  // instead raking a 7.5-degree key straight across the floor, so the left wall
  // — the one face standing square to it — took about five times the piste's
  // irradiance and became the brightest object on screen by 40%. Measured: that
  // wall sat at code 208, std 10.5 over a 30-value span, so far up the ACES
  // shoulder that the tone curve ate every bit of texture this shader computes
  // for it, and desaturated it to R-B -21 in a frame whose every other pixel is
  // at -31. A blank wall in the corner opposite the rider, holding the eye.
  //
  // So the beam is gated by ALTITUDE ABOVE THE FALL LINE (vAlt, baked per
  // vertex). uSunFloor is where the sun currently clears the surrounding
  // range; it descends through the run as the sun climbs, so the sun physically
  // arrives in the valley somewhere around "sunrise" and the whole thing is a
  // real event in the arc rather than a switch.
  //
  // Below the floor the light is NOT removed, it is REDISTRIBUTED: the same
  // energy that would have arrived as a beam arrives as sky instead, weighted
  // by how much sky the surface can see. That is precisely the reference's
  // mechanism — flat piste sees the whole hemisphere and is the brightest thing
  // in the frame, steep flanks see half and go mid, faces turned into the
  // valley go near-black — and it is why its R-B holds at -0.19 across three
  // and a half stops: one illuminant, tone doing all the work.
  float ndl = dot(N, L);
  // The sun in this game is always DOWN the hill, and a kicker's run-up faces
  // UP it — so the one face the player ever approaches sat fully behind the
  // terminator, a shadowed void against bright piste. Lift built features
  // toward the lit side — but only PART way: lifted flat to the piste's own
  // brightness the face camouflaged into the slope behind it and the crown
  // read as a carpet hovering over a hole. The face needs to keep a little of
  // its true incidence so its curvature — and therefore its solidity — reads.
  ndl = mix(ndl, 0.30, vKick * 0.35);
  // A tighter wrap than real snow. The physically honest 0.62 scattered light
  // so far past the terminator that every facet and every slope change shaded
  // to nearly the same value — the whole mountain compressed into one pale
  // band and read as glass. Solidity needs light that takes sides.
  float wrap = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
  // Shadowed snow keeps a little direct light: it is translucent, and terrain
  // shadow edges in real snow are soft and blue rather than hard and black.
  // Shadowed snow is much darker than lit snow but never dark: it is lit by the
  // whole sky and by light scattering through the snow itself. At 0.14 the
  // shadows swallowed all the shape they were added to reveal.
  float shade = mix(0.26, 1.0, max(vShade, vKick * 0.65));

  // Is there a beam here at all? One mad and one smoothstep, in the hottest
  // shader in the game.
  float sunHi = smoothstep(uSunFloor - 30.0, uSunFloor + 30.0, vAlt);
  // How much of the dome this surface sees. The exponent is not a fudge for
  // (1+N.y)/2: that is the open-field answer, and this is a VALLEY — a steeper
  // face is deeper in the V, so a larger share of what it can see is the far
  // wall rather than sky, and the sky term has to fall much faster than the
  // cosine does. Solved against the reference's own tonal ladder: piste 0.592,
  // left ridge 0.356, right slope 0.167.
  //
  // uSunFlat carries the normalisation, so THE PISTE IS THE REFERENCE and this
  // curve is unity there by construction. That matters: the first cut of this
  // normalised against horizontal ground, and the piste is a seventeen degree
  // slope, so ^13 took a quarter of its light off before anything else got a
  // vote and the whole frame came out a third dark. Nothing about the piste —
  // the one region already measuring within 3% of the reference — may move.
  float dome = 0.5 + 0.5 * N.y;
  float d2 = dome * dome;
  float d4 = d2 * d2;
  float d8 = d4 * d4;
  float sky = d8 * d8;                         // ^16
  // AND IT HAS TO POINT SOMEWHERE. dome is a function of N.y alone: it has no
  // azimuth in it, so under the gate every face the same distance from vertical
  // came out the same brightness whichever way it faced. A blind reviewer ranked
  // that first among everything left wrong with the frame — "every surface at the
  // same ambient value, nothing casts anything" — and it is also why the whole
  // near field went soft: the corduroy, the sastrugi and the facets are all
  // NORMAL perturbations, and a lateral tilt moves N.y only in second order, so
  // below the floor the gate was quietly deleting most of the surface texture
  // this shader computes. Measured on the canonical frame, the left valley wall
  // stood at 1.19x the right where the reference art has 2.23x, and not one pixel
  // in the frame reached code 200 where the reference puts 0.41% of them.
  //
  // Pre-dawn light is soft. It is not directionless. It comes from the bright
  // patch of sky above where the sun is about to rise, so the key here is the
  // sun's own AZIMUTH lifted to 32 degrees — high enough that there is no
  // terminator anywhere in the frame — through a wrap wide enough (0.48) that
  // nothing it touches ever goes to black. Those two numbers were solved against
  // the reference's own left-to-right wall ratio: 0.62 got the frame from 1.32 to
  // 1.72 against its 2.35, and 0.48 closes most of the rest. The sun-facing wall
  // gains only 15% over the piste even at the limit, and the sky-dome exponent
  // holds it at a tenth of the piste's direct, so there is no route back to the
  // blown-out wall the gate was introduced to kill.
  //
  // NORMALISED ON THE PISTE, exactly as uSunFlat is, and for the same reason: the
  // piste is the one region already measuring within 3% of the reference and
  // nothing about it may move. Dividing by the same expression evaluated at the
  // piste's own normal makes this identically 1.0 there by construction, whatever
  // the sun does over the run, so the gate's exposure calibration is untouched
  // and only the DISTRIBUTION changes.
  //
  // src/lit.js mirrors this gate for trees, rocks, poles and gates. It needs the
  // same three lines around its own uSunFlat * d8 * d8, or the scenery stands
  // in a flatter light than the ground it stands on.
  vec3 pisteN = normalize(vec3(0.0, 1.0, -0.30));   // S0; the groomed fall line
  vec3 preL = normalize(vec3(L.x * 1.6, 1.0, L.z * 1.6));
  float pre = max(0.0, (dot(N, preL) + 0.48) / (dot(pisteN, preL) + 0.48));
  // A KICKER KEEPS ITS FACE. The sun in this game is always down the hill and a
  // run-up faces up it, so the one surface the player ever approaches is the one
  // this term darkens hardest — and the wrap path above already lifts vKick for
  // exactly that reason, but the wrap path only runs ABOVE the sun floor, so
  // below it the lift was not there. Measured on a matched pair, the directional
  // key took the frame's pixels above code 200 from 0.50% to 0.06% against the
  // reference's 0.38%, and every one of them was on a kicker face. Built snow is
  // freshly pushed and scatters like new powder anyway.
  pre = mix(pre, 1.0, vKick * 0.5);
  float irr = mix(uSunFlat * sky * pre, pow(wrap, 1.25), sunHi);
  vec3 direct = uSunColor * irr * mix(1.0, 0.55, rock) * shade;

  // Hemispheric ambient: sky above, bounced snow-light below. On an open slope
  // the bounce term is not subtle — it is why shadowed snow stays bright blue
  // rather than going black.
  vec3 ambient = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5);

  vec3 H = normalize(L + V);
  // SHEEN IS A GRAZING TERM, NOT A HIGHLIGHT. The old pow(dot(N,H), 46.0) is a
  // twelve-degree half-angle spot; work the numbers for this game's geometry and
  // dot(N,H) never exceeds ~0.55 on the piste, so 0.55^46 is zero and the term
  // never fired at all. Even at exponent 12 it is 8e-4. It was dead code.
  //
  // What the reference actually shows is a piste that PEAKS in brightness two
  // thirds down the frame and falls 45 levels — 163 to 121 — to the bottom edge.
  // That is forward scattering through the surface, which depends on the VIEW
  // angle, not on the half-vector, so the grazing factor drives it and the
  // half-vector survives only as a broad "and roughly toward the sun" weight.
  // Masked off rock, which does not do this.
  //
  // AND IT IS A HUMP, NOT A RAMP. pow(1 - N·V, 4) is monotone: it peaks at the
  // horizon and falls all the way to the bottom of frame, so the piste came out a
  // single ramp — 154 at the horizon to 126 at the bottom edge, exactly backwards
  // — and that fall to the bottom edge is the whole reason the reference's ground
  // reads as rolling away under the camera instead of as a backdrop hung behind
  // it. A parabola in a remapped N·V puts the peak where the reference's is and
  // costs less than the pow it replaces.
  //
  // The band is placed in N·V, not in screen y, because the shader has no screen
  // y — and it works out the same, since on a slope seen from a chase camera N·V
  // is monotone down the frame. Measured on this rig: N·V runs 0.22 at the top of
  // the visible piste to 0.63 at the bottom edge, so the peak belongs at 0.38.
  // The first attempt shaped pow(1-N·V, 4) with an exponential and peaked at 0.13,
  // which is off the TOP of the frame — the arch stayed a ramp, unchanged.
  float nv = max(dot(N, V), 0.0);
  float gt = clamp((nv - 0.06) * (1.0 / 0.60), 0.0, 1.0);
  float graze = 4.0 * gt * (1.0 - gt);
  graze *= graze;
  float nh = max(dot(N, H), 0.0);
  float sheen = graze * (0.35 + 0.65 * nh * nh * nh) * 0.205 * (1.0 - rock);

  // ── sparkle ─────────────────────────────────────────────────────────────
  // BAND LIMITED, but NOT COARSENED — coarsening was tried and it is worse than
  // the fault. floor(vWorld * 24.0) is a 4.2 cm lattice, half a pixel across at
  // the bottom of frame and a fifth of one at fifty metres, feeding a pow(.,220)
  // lobe and then a bloom threshold. At first light uSparkle is 0.10 and it
  // hides; at bluebird it is 1.7, and a sub-pixel hard cell under a lobe that
  // tight scintillates on every camera twitch — the one artefact a still frame
  // can never show. The obvious cure, taking the lattice to 16.7 cm so that a
  // cell is six pixels and can be resolved, turned the whole near piste at
  // bluebird into a woven grid of bright and dark rectangles: floor() of a world
  // position IS an axis-aligned lattice, and any RESOLVABLE version of it reads
  // as one. That is the granulation's own NOT A HARD CELL note, one term over.
  //
  // A sparkle is not a texture, it is a sparse point process — lit fires on 38%
  // of cells and the lobe kills nearly all of those, so a pixel is averaging a
  // handful of independent points and sub-pixel cells are exactly right. What is
  // not right is running it out to where a pixel averages hundreds of them, which
  // is where the crawl lives. So the cell size stays and the FOOTPRINT gates it,
  // measured on area — sqrt of the cells landing in one pixel — rather than on
  // distance, because the fall-line axis is foreshortened five times harder than
  // the lateral one. The old 30-190 m fade stays on top of it.
  vec3 cell = floor(vWorld * 24.0);
  vec3 jitter = hash33(cell) * 2.0 - 1.0;
  vec3 Ns = normalize(N + jitter * 0.62);
  float glint = pow(max(dot(Ns, H), 0.0), 220.0);
  float lit = step(0.62, hash13(cell + 7.3));
  float near = (1.0 - smoothstep(30.0, 190.0, camDist))
             * smoothstep(0.25, 0.70, sqrt((0.042 / mpp.x) * (0.042 / mpp.y)));
  float sparkle = glint * lit * near * uSparkle * (1.0 - rock) * vShade;

  vec3 col = albedo * (direct + ambient) + uSunColor * (sheen + sparkle);

  // The dye line across every lip. Applied AFTER lighting: mixed into the
  // albedo it was multiplied by whatever grey the mood was serving and
  // vanished into the blue snowfield it exists to stand out from. Real dye is
  // saturated enough to read in any light; only a trace of the sun's level
  // scales it so night does not glow.
  // Against three-stops-darker snow this had to shout to be seen at all. Now
  // that the piste is near-white the same colour reads as a flat cyan polygon
  // pasted over the hill — a blind reviewer picked it out as an artefact
  // without knowing what it was for. Desaturated toward the snow and cut to a
  // third of the coverage, it goes back to being a dye line on snow, which is
  // faint in every photograph of a real one.
  float dyeLum = dot(uSunColor, vec3(0.333)) * 0.5 + 0.35;
  // Shaped so the band CORE saturates: raw vLip interpolates from one bright
  // row down to zero and averaged out to a tint too faint to notice.
  col = mix(col, vec3(0.42, 0.56, 0.88) * dyeLum, smoothstep(0.10, 0.50, vLip) * 0.28);

  // ── height fog ──────────────────────────────────────────────────────────
  // Closed form of the integral of an exponentially height-decaying density
  // along the view ray, so haze pools correctly in the valley instead of being
  // a flat distance blend.
  float dy = vWorld.y - uCamPos.y;
  float t = uFogFalloff * dy;
  float k = abs(t) < 1e-4 ? 1.0 : (1.0 - exp(-t)) / t;
  // Halved against the mood's own number: at full strength the walls lifted
  // toward sky colour a hundred metres out and the mountain lost its body.
  float f = uFogDensity * 0.5 * exp(-uFogFalloff * (uCamPos.y - uFogBase)) * camDist * k;
  float fog = 1.0 - exp(-max(f, 0.0));

  float toSun = pow(max(dot(-V, L), 0.0), 5.0);
  vec3 fogCol = mix(uFogColor, uFogSunColor, toSun);

  gl_FragColor = vec4(mix(col, fogCol, clamp(fog, 0.0, 1.0)), 1.0);
}
`;

// The groomed piste, as a normal — a slope of S0, which is what the shader's
// sky-dome term is normalised against so that the run you ride is the unit of
// exposure and everything else is measured as darker than it.
const PISTE_NY = 1 / Math.sqrt(1 + S0 * S0);
const PISTE_NZ = S0 * PISTE_NY;
/** (0.5 + 0.5 * PISTE_NY) ^ 16 — must track the exponent in SNOW_FRAG. */
const PISTE_DOME = Math.pow(0.5 + 0.5 * PISTE_NY, 16);

/** Mesh rows built per frame. Three frames to a chunk, and one chunk every ~3 s. */
const ROWS_PER_FRAME = 10;

/**
 * Distances along the sun ray sampled when marching for terrain shadow.
 *
 * The first six are the near march. At 7.5° elevation a shadow runs 7.65x the
 * caster's height, so a valley rim thirty metres up throws it two hundred and
 * fifty metres and the near march cannot see the landform that organises the
 * whole lower frame — the broad ridge shadows the reference has spilling across
 * its piste.
 *
 * The tail is DEEPER THAN 68 m AND SOFTER. Marched with the same rules the tail
 * put the piste 100% hard-shadowed at every point tested, which is not band
 * structure, it is one flat dark field with the bands erased; and it left the
 * blown-out left wall at 0.93 visibility, because that wall faces the sunrise
 * across an empty valley and there is genuinely nothing between it and the sun.
 * (That wall is item 1's problem, not this one's — see the light block.) So a
 * hit beyond 68 m attenuates to SHADOW_FAR_FLOOR rather than to zero: a distant
 * ridge's penumbra is tens of metres wide by the time it lands, and the near
 * march keeps its own contrast on top.
 */
const SHADOW_STEPS = [2.5, 6, 13, 24, 42, 68, 110, 170, 250];
/** Steps past this index are the coarse tail. */
const SHADOW_NEAR = 6;
/** Deepest a far occluder alone may take a point. */
const SHADOW_FAR_FLOOR = 0.35;
/** Penumbra scale saturates here, or the tail greys out the entire mountain. */
const SHADOW_SOFT_CAP = 68;

/**
 * How much sun reaches a point, by marching the height field toward it.
 * Exported: the trail bakes the same lighting as the snow it cuts through,
 * and a groove that ignores the terrain shadow it crosses glows in the dark.
 */
export function sunVisibility(terrain, x, z, h, sun) {
  const horiz = Math.hypot(sun.x, sun.z) || 1e-6;
  const dx = sun.x / horiz;
  const dz = sun.z / horiz;
  const tanEl = sun.y / horiz;
  let vis = 1;
  for (let i = 0; i < SHADOW_STEPS.length; i++) {
    const d = SHADOW_STEPS[i];
    const rayY = h + tanEl * d;
    const th = terrain.height(x + dx * d, z + dz * d);
    const floor = i < SHADOW_NEAR ? 0 : SHADOW_FAR_FLOOR;
    if (th >= rayY) {
      if (floor < vis) vis = floor;
      // Only the near march can end the walk: a far hit still leaves the point
      // reachable by the shallow rays the tail is too coarse to resolve.
      if (vis <= 0) return 0;
      continue;
    }
    // Soft edge: the closer the terrain comes to the ray, the more of the sun
    // disc it occludes. A binary test gives shadow edges like torn paper.
    const gap = floor + (1 - floor) * (rayY - th) / (Math.min(d, SHADOW_SOFT_CAP) * 0.30);
    if (gap < vis) vis = gap;
  }
  return vis < 0 ? 0 : vis > 1 ? 1 : vis;
}

/**
 * A ring of terrain chunks that recycles as the rider descends.
 *
 * Chunks are built INCREMENTALLY, a slice of rows per frame, and the mesh is
 * hidden until its last row lands. Each vertex now also marches the height field
 * toward the sun for a shadow term, which tripled the cost of a rebuild — doing
 * that in one frame was a dropped frame every three seconds, and a recycled
 * chunk appears at the far edge of the view where the fog has closed anyway, so
 * nobody can see it arrive in pieces.
 */
export class MountainMesh {
  constructor(terrain, scene, mood) {
    this.terrain = terrain;
    this.cols = buildColumns();
    this.count = Math.ceil(VIEW / CHUNK) + 2;

    this.material = new THREE.ShaderMaterial({
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      uniforms: {
        // MOODS[0], `first light`. Overwritten by mood.bind() below, so this
        // never renders in the game — but the old default (0.3, 0.24, -0.92)
        // put the sun 18° off the fall line, which flattens every fall-line
        // feature in the shader to nothing. A trap for anyone who builds a mesh
        // without a mood; keep it in step with mood.js.
        uSunDir: { value: new THREE.Vector3(0.86, 0.13, -0.50).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.86, 0.66) },
        uSkyColor: { value: new THREE.Color(0.42, 0.56, 0.86) },
        uGroundColor: { value: new THREE.Color(0.24, 0.30, 0.44) },
        uSnowColor: { value: new THREE.Color(0.90, 0.94, 1.0) },
        uRockColor: { value: new THREE.Color(0.20, 0.20, 0.24) },
        uFogColor: { value: new THREE.Color(0.62, 0.72, 0.88) },
        uFogSunColor: { value: new THREE.Color(1.0, 0.82, 0.62) },
        uFogDensity: { value: 0.0072 },
        uFogFalloff: { value: 0.012 },
        uFogBase: { value: 0 },
        uSparkle: { value: 1.0 },
        uHalf: { value: HALF },
        uCamPos: { value: new THREE.Vector3() },
        // Both derived from uSunDir every frame by _syncSun(), so mood.js needs
        // to know nothing about either. See the note there.
        uSunFloor: { value: 0 },
        uSunFlat: { value: 0 },
      },
    });
    if (mood) mood.bind(this.material.uniforms);
    this._syncSun();

    this.chunks = [];
    for (let i = 0; i < this.count; i++) {
      const chunk = this._makeChunk();
      this.chunks.push(chunk);
      scene.add(chunk.mesh);
    }
    // The SPARE. Recycled chunks used to be rebuilt in place — hidden, filled
    // over a few frames, then shown — which meant that for those frames the
    // world had a seventy-metre slab missing. It sat at the fogged far edge and
    // was USUALLY invisible, but 'usually invisible' is a transient hole in the
    // mountain waiting for the right camera height to expose it. Rebuilds now
    // land in this off-stage geometry, and only a COMPLETE chunk is ever
    // swapped into the ring: no frame ever renders a hidden or half-built slab.
    this.spare = this._makeChunk();
    this.spare.mesh.visible = false;
    scene.add(this.spare.mesh);
    this.baseIndex = 0;
    this.rebuildQueue = [];
    this.pending = null;
  }

  _makeChunk() {
    const nc = this.cols.length;
    const nr = ROWS + 1;
    const verts = nc * nr;

    const position = new Float32Array(verts * 3);
    const normal = new Float32Array(verts * 3);
    const aU = new Float32Array(verts);
    const aShade = new Float32Array(verts);
    const aKick = new Float32Array(verts);
    const aLip = new Float32Array(verts);
    const aAlt = new Float32Array(verts);

    const index = new Uint32Array(ROWS * (nc - 1) * 6);
    let o = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < nc - 1; c++) {
        const i0 = r * nc + c;
        const i1 = i0 + 1;
        const i2 = i0 + nc;
        const i3 = i2 + 1;
        // WINDING. Columns run +x with c, rows run -z with r, so (i0, i2, i1) is
        // CLOCKWISE seen from above — the whole height field was wound inside
        // out, its front faces pointing down into the rock. With the default
        // FrontSide material that backface-culled two thirds of every chunk: the
        // piste directly ahead vanished, gates and trees floated over fog, and a
        // kicker showed only its landing, never the face you ride up. The mesh
        // was never see-through; it was mostly not being drawn. Months of
        // shading work — faceting, wrap, bloom threshold, fog — went into
        // chasing it.
        // The DIAGONAL is unchanged (i1–i2). meshHeight() solves that exact
        // triangle to plant scenery, and flipping it would put the trees back in
        // the air.
        index[o++] = i0; index[o++] = i1; index[o++] = i2;
        index[o++] = i1; index[o++] = i3; index[o++] = i2;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    g.setAttribute('aShade', new THREE.BufferAttribute(aShade, 1));
    g.setAttribute('aKick', new THREE.BufferAttribute(aKick, 1));
    g.setAttribute('aLip', new THREE.BufferAttribute(aLip, 1));
    g.setAttribute('aAlt', new THREE.BufferAttribute(aAlt, 1));
    g.setIndex(new THREE.BufferAttribute(index, 1));

    const mesh = new THREE.Mesh(g, this.material);
    mesh.frustumCulled = false;
    return { mesh, geometry: g, p0: -1e9 };
  }

  /**
   * The sun sits between five and twenty degrees above the horizon for the whole
   * run, so shadows are long and this is the difference between snow-covered
   * terrain and a white gradient. Done here rather than with a shadow map: the
   * geometry is an analytic function that can simply be asked, and the answer is
   * baked into a vertex attribute that costs nothing per pixel.
   */
  _sunVisibility(x, z, h, sun) {
    return sunVisibility(this.terrain, x, z, h, sun);
  }

  /** Fill rows [r0, r1) of a chunk. Returns true when the chunk is complete. */
  _buildRows(job, r0, r1) {
    const t = this.terrain;
    const cols = this.cols;
    const nc = cols.length;
    const dz = CHUNK / ROWS;
    const attrs = job.chunk.geometry.attributes;
    const pos = attrs.position.array;
    const nrm = attrs.normal.array;
    const us = attrs.aU.array;
    const sh = attrs.aShade.array;
    const kck = attrs.aKick.array;
    const lp = attrs.aLip.array;
    const alt = attrs.aAlt.array;

    const e = 0.9;
    for (let r = r0; r < r1; r++) {
      const p = job.p0 + r * dz;
      const z = -p;
      const cx = t.centerX(z);
      // The datum the sun floor is measured against. It MUST be the fall line at
      // this row and not world y: the run descends about a metre in three, so
      // over the five hundred metres the mesh reaches, absolute height falls a
      // hundred and seventy — an altitude gate on world y would light the near
      // walls and shadow the distant summits, which is the fault upside down.
      const base = t.baseHeight(p);
      let i = r * nc;
      for (let c = 0; c < nc; c++) {
        const u = cols[c];
        const x = cx + u;
        const h = t.height(x, z);
        // Forward differences rather than mesh-derived normals: identical at
        // chunk seams, so no lighting discontinuity where two chunks meet.
        const gx = (t.height(x + e, z) - h) / e;
        const gz = (t.height(x, z + e) - h) / e;
        const inv = 1 / Math.sqrt(gx * gx + gz * gz + 1);

        const o = i * 3;
        pos[o] = x; pos[o + 1] = h; pos[o + 2] = z;
        nrm[o] = -gx * inv; nrm[o + 1] = inv; nrm[o + 2] = -gz * inv;
        us[i] = u;
        sh[i] = this._sunVisibility(x, z, h, job.sun);
        // How much of this vertex is built kicker rather than mountain: full
        // treatment once the ramp is waist-high, feathering to nothing at its
        // skirt so the grooming/lighting change has no visible seam.
        kck[i] = Math.min(1, t.kickerAt(p, u) / 1.2);
        lp[i] = t.lipAt(p, u);
        alt[i] = h - base;
        i++;
      }
    }
    return r1 > ROWS;
  }

  _finish(job) {
    const attrs = job.chunk.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.normal.needsUpdate = true;
    attrs.aU.needsUpdate = true;
    attrs.aShade.needsUpdate = true;
    attrs.aKick.needsUpdate = true;
    attrs.aLip.needsUpdate = true;
    attrs.aAlt.needsUpdate = true;
    job.chunk.geometry.computeBoundingSphere();
    job.chunk.p0 = job.p0;
    job.chunk.mesh.visible = true;
  }

  _buildNow(chunk, p0) {
    const job = { chunk, p0, sun: this.material.uniforms.uSunDir.value.clone() };
    this._buildRows(job, 0, ROWS + 1);
    this._finish(job);
  }

  /**
   * Rebuild everything, e.g. after a seek or a restart.
   *
   * The slot MUST be derived from the chunk index the same way update() derives
   * it. Filling the array in order instead put chunk `first + i` in slot `i`,
   * which only agrees with `idx % count` when `first` happens to be a multiple of
   * the ring size — it is not. Every recycle after a reset then landed in the
   * wrong slot, overwriting a chunk still in view and leaving a hole in the
   * mountain with the sky showing through it.
   */
  reset(p) {
    const first = Math.floor(p / CHUNK) - 1;
    const n = this.chunks.length;
    for (let i = 0; i < n; i++) {
      const idx = first + i;
      this._buildNow(this.chunks[((idx % n) + n) % n], idx * CHUNK);
    }
    this.baseIndex = first;
    this.rebuildQueue.length = 0;
    this.pending = null;
    this.spare.mesh.visible = false;
  }

  /**
   * The two numbers behind the altitude gate on direct light, derived from the
   * sun direction the mood already publishes — so the whole effect rides the
   * existing arc and `mood.js`, which this module does not own, needs no new
   * key. The mood mixer lerps uSunDir between stops, so both of these move
   * continuously; nothing here steps.
   *
   * uSunFloor is where the sun clears the range ringing this valley, as metres
   * above the fall line: a summit ring RELIEF metres up and DIST metres away is
   * cleared at altitude y once tan(elevation) > (RELIEF - y) / DIST. The two
   * constants are chosen so that at `first light` (7.5°) the floor stands above
   * everything the mesh contains — genuinely pre-sunrise, no lit face anywhere
   * in the near field — falls to about fifteen metres at `sunrise`, so the beam
   * reaches the ridges and the upper walls but not yet the piste, and is far
   * below the valley floor for the whole of `bluebird` and `squall`, where the
   * gate saturates at 1 and the shader is exactly what it was before. At
   * `alpenglow` the sun drops back to 5.7° and the floor climbs again, which is
   * what alpenglow is: the valley in shadow, lit by a red sky.
   *
   * uSunFlat is the wrapped-diffuse value LEVEL ground would take if the beam
   * did reach it — the energy the sky path hands out below the floor, so the
   * piste's exposure is the same whether the sun has arrived or not.
   */
  _syncSun() {
    const RELIEF = 169;   // metres of summit ring above the valley floor
    const DIST = 753;     // how far off it stands
    const s = this.material.uniforms.uSunDir.value;
    const horiz = Math.hypot(s.x, s.z) || 1e-6;
    const u = this.material.uniforms;
    u.uSunFloor.value = RELIEF - DIST * (s.y / horiz);
    // Normalised against a piste at the MEAN pitch, not against the pitch under
    // the rider. slopeAt() swings ±0.125 on a ninety-five metre period, which at
    // riding speed is a cycle every four seconds — normalising against it pumped
    // the exposure of the entire frame several times a second.
    const ndl = PISTE_NY * s.y - PISTE_NZ * s.z;
    const wrap = clamp((ndl + 0.35) / 1.35, 0, 1);
    u.uSunFlat.value = Math.pow(wrap, 1.25) / PISTE_DOME;
  }

  update(p, camPos) {
    this.material.uniforms.uCamPos.value.copy(camPos);
    this.material.uniforms.uFogBase.value = this.terrain.baseHeight(p) - 40;
    this._syncSun();

    const want = Math.floor(p / CHUNK) - 1;
    if (want !== this.baseIndex) {
      // Queue the chunks that fell behind rather than rebuilding them all now.
      for (let k = this.baseIndex; k < want; k++) {
        this.rebuildQueue.push(k + this.chunks.length);
      }
      this.baseIndex = want;
      if (this.rebuildQueue.length > this.chunks.length) {
        // Teleported (a seek, or a very long stall): start clean.
        this.reset(p);
        return;
      }
    }
    if (!this.pending && this.rebuildQueue.length) {
      const idx = this.rebuildQueue.shift();
      const n = this.chunks.length;
      this.pending = {
        chunk: this.spare,
        slot: ((idx % n) + n) % n,
        p0: idx * CHUNK,
        row: 0,
        // The sun moves with the mood, and a chunk keeps the shadows it was born
        // with. Chunks recycle every few seconds while the mood takes minutes, so
        // the lag between neighbours is far below anything visible.
        sun: this.material.uniforms.uSunDir.value.clone(),
      };
    }
    if (this.pending) {
      const j = this.pending;
      const next = Math.min(ROWS + 1, j.row + ROWS_PER_FRAME);
      const done = this._buildRows(j, j.row, next);
      j.row = next;
      if (done) {
        // Atomic swap: the finished spare joins the ring, the chunk it replaces
        // (a slab already far behind the camera) leaves the stage and becomes
        // the next spare. At no point is a visible slot empty.
        this._finish(j);
        const old = this.chunks[j.slot];
        this.chunks[j.slot] = j.chunk;
        old.mesh.visible = false;
        this.spare = old;
        this.pending = null;
      }
    }
  }

  dispose() {
    for (const c of this.chunks) c.geometry.dispose();
    this.spare.geometry.dispose();
    this.material.dispose();
  }
}

/** Shared helper: the fraction of the bowl half-width a lateral offset sits at. */
export function bowlT(u) {
  return clamp(Math.abs(u) / HALF, 0, 2);
}

export { vnoise };
