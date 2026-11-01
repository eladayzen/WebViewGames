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

// The ground shader. It used to be the snow shader, and the measurement table
// in the middle of it is the reason the rewrite kept so much of it.
//
// WHAT CHANGED AND WHAT DID NOT. "The texture of the floor is going to have to
// change" is the whole brief, and the floor is the largest surface in every
// frame: the palette, the spires, the drones and the far range were all
// fighting a groomed white piste, and losing, because a comb of groomer passes
// says ski slope louder than any amount of violet says anything else.
//
// But only the TEXTURE was wrong. Everything below the albedo block — the
// altitude-gated beam, the sky-dome exponent normalised on the piste, the
// directional pre-dawn key, the height fog, the facet normals, the screen
// footprint table — is about how a long slope is lit and how far ahead it can
// be read at speed. None of that is a statement about snow, and four of those
// five were solved against measurements that are still the measurements. So
// the surface was replaced and the lighting was retuned in two places where it
// made a claim about the MATERIAL (see the wrap and the shadow floor), and
// nothing else below the albedo moved.
//
// What the surface is now, in order of how much it matters:
//
//  1. STRATA. Bedding planes, a function of world y alone, folded by a slow
//     lateral noise and creased so they have edges. This is the term that does
//     the most work, because it is the only one that is not a feature OF the
//     surface: the bands run level around a spur and pick up at the same
//     height across a gully, which says the landform was cut out of layered
//     rock. No tangent-plane texture can say that at any quality.
//  2. JOINTING. The crack set a face breaks along — the sastrugi's fetch,
//     coarsened to block scale and creased, so the normal breaks instead of
//     rolling. Rounded swells are a drift; this is not.
//  3. THE TRACK, which is what replaced the corduroy. The groomer lines were
//     drawing the ridable corridor, and that job has to survive the look
//     change. Three non-periodic channels do it — the facets smooth, the
//     jointing and the scree damp, the albedo lifts — so the track is the
//     SMOOTH thing in a broken frame rather than the striped thing in a plain
//     one. That is a larger contrast than the comb and it does not stop
//     resolving at distance.
//  4. SELF-SHADOWING. `aShade` is marched through the height field on the CPU
//     when a chunk is built, so it costs nothing per pixel. With a key this
//     low it is the single biggest thing separating ground from a gradient,
//     and it got MORE important rather than less: the shadow floor dropped
//     from 0.26 to 0.15 when the surface stopped being translucent.
//  5. SCREE. The granulation, with a deeper pit — snow scatters light into its
//     own pits and rock does not — and the same two-octave, two-depth,
//     rotated-lattice construction, which was never about snow either.
//  6. HEIGHT FOG with directional inscatter, so valleys fill with haze, ridges
//     emerge from it, and looking toward the sun glows.
//
//     MEASURE THE CAMERA BEFORE YOU RETUNE ANY THRESHOLD IN HERE. Every
//     distance constant this shader has ever carried was set against a camera
//     nobody had measured. Probed on the canonical frame (tools ride to
//     p = 300 and freeze): the chase camera sits 8.68 m above the drawn
//     ground, pitched 7.2 deg down, 61.7 deg vertical fov on a 1320x800 frame.
//     What the thresholds need is not the camera but what it implies — the
//     world footprint of a pixel, which runs
//
//         screen row     ground dist     metres/px in x     metres/px in z
//              780           27.7 m           0.038              0.098
//              700           39.6 m           0.063              0.207
//              660           50.0 m           0.086              0.309
//              600           80.4 m           0.154              0.665
//              580          101.9 m           0.275              1.665
//
//     — note the z column, five to seventeen times the x. That table is why
//     every band limit here is `resolves()` on the world size of the feature
//     and both footprints, and why nothing fades on camDist. N.V on the piste
//     runs 0.22 at the top of the visible ground to 0.63 at the bottom edge,
//     which is where the graze band below is placed. The strata are the one
//     term this table does not bound, because their period is vertical; see
//     band1 and mppY.
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

// The same test for a feature that has ONE period rather than two. The strata
// are a function of world y alone, so there is no second axis for resolves()
// to take a min over, and the footprint that bounds them is the vertical one.
float band1(float cell, float m) {
  return smoothstep(1.0, 2.4, cell / m);
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
  // AND THE VERTICAL ONE, which the snow never needed: every texture it had
  // lived in the ground plane, so x and z bounded all of them. The strata do
  // not — they are cut in world y — and a bedding band is at its finest on
  // exactly the steep faces where the x and z footprints say it is coarse.
  float mppY = max(fwidth(vRel.y), 1e-4);

  // ── fracture regions ────────────────────────────────────────────────────
  // ROCK IS NOT ONE ROCK, and what varies across a face is how BROKEN it is:
  // slabs that have held together, and ground between them that has shattered
  // into blocks and shed its scree. This is the field that says which, and
  // like the wind field it replaced it pays for four things at once — the
  // jointing amplitude, the scree density, the strata contrast and a slow
  // tonal drift. One noise paying for four is the only reason any of it fits
  // in the budget, and that argument is unchanged by what the ground is made
  // of.
  //
  // NEARLY ISOTROPIC, where the wind field was stretched about 3:1 down the
  // fall line. Wind leaves lanes; fracture does not. A jointed face breaks
  // into blocks whose long axis is set by the joint set, not by the slope, so
  // the stretch that made drifts read as drifts makes shatter read as combing
  // — and combing down the fall line is the exact artefact this whole pass
  // exists to delete. 1.6:1 keeps a little grain without it.
  float region = n21s(vec2(vWorld.x * 0.026, vWorld.z * 0.0163))
               + 0.45 * n21s(vec2(vWorld.x * 0.115, vWorld.z * 0.072) + 9.0);
  // Centred on the field's own mean (0.725) so neither character dominates.
  float broken = smoothstep(0.58, 0.88, region);

  // Steepness, hoisted: the strata, the jointing and the exposed-rock mix all
  // read it. From the INTERPOLATED normal, not the faceted one — see the
  // albedo block for why that distinction cost a valley wall full of dither.
  float steep = 1.0 - clamp(Nv.y, 0.0, 1.0);

  // ── the track ───────────────────────────────────────────────────────────
  // THE PISTE IS A WORN SLAB, NOT A GROOMED ONE.
  //
  // What used to be here was corduroy: two cosines of groomer pass along the
  // fall line, at 2.42 m and 0.24 m, in the normal and in the albedo. They
  // were the single loudest statement in the frame that this is a ski slope.
  // Nobody has to recognise snow to recognise a comb, which is why three
  // rounds of recolouring never moved the first impression: the palette was
  // alien and the surface under it was still a piste a machine had driven up
  // and down.
  //
  // But they were doing a JOB, and deleting them without replacing it costs
  // real legibility — they drew the ridable corridor, and the corridor is the
  // only thing on this mountain the player is steering relative to. Three
  // channels take it over, and not one of them is periodic:
  //
  //   the facets blend back toward the smooth analytic normal here, exactly
  //   as they did for the groomed version;
  //   the jointing and the scree are damped on the track, so it is the smooth
  //   thing in a broken frame rather than the striped thing in a plain one;
  //   and the albedo lifts, which is what traffic does to a rock surface —
  //   it polishes it and it dusts it.
  //
  // That is a LARGER contrast than the comb ever was, because it is a
  // contrast of texture rather than of pattern, and unlike a comb it does not
  // have a distance at which it stops being resolvable and leaves the
  // corridor unmarked. The poles still mark the hard edge; this marks the
  // middle.
  float piste = (1.0 - smoothstep(0.88, 1.04, abs(vU) / uHalf)) * (1.0 - vKick * 0.65);

  // Faceting. Mesh columns are 2.0 m and rows 2.7 m, so a near-field facet is
  // fifty pixels of flat shading — and on rock that is not a compromise, it
  // is the look. It is the same cross-of-derivatives that made the snow read
  // as crystalline rather than as frosted glass, doing a job it is better
  // suited to. Off the piste it keeps full strength; on the track it is
  // blended back to 0.62, which is the one place a stack of two-metre shading
  // steps reads as tessellation instead of as bedrock.
  N = normalize(mix(Nv, N, mix(1.0, 0.62, piste)));

  // ── strata ──────────────────────────────────────────────────────────────
  // BEDDING PLANES, and this is the term that does most of the work.
  //
  // Every other texture in this shader perturbs a surface inside its own
  // tangent plane, which is what snow IS: ripples, grooves, pitting, all of
  // them features of the surface. Rock's signature is the opposite. It is a
  // stack of horizontal beds that the landform has been CUT OUT OF, so the
  // bands run level around a spur and pick up again at the same height on the
  // far side of a gully. Nothing in the tangent plane can fake that, because
  // the one thing it says is that the pattern does not belong to the surface.
  //
  // So this is a function of WORLD Y alone, warped laterally by a slow noise
  // so the beds are folded rather than spirit-levelled — dead-level banding
  // over a whole valley reads as a contour map.
  //
  // CREASED, not smooth. A plain noise in y swells like a sine and reads as a
  // vertical gradient; a bed is a plate, with a top and a bottom. abs() about
  // the noise's own middle puts an edge at every zero crossing and flips the
  // gradient's sign across it, so the ledges break instead of rolling.
  //
  // WEIGHTED BY STEEPNESS, which is physics and convenience in one line. On
  // near-level ground a horizontal bed lies nearly parallel to the surface,
  // so it stretches into an enormous low-frequency wash that no band limit
  // can help with — and near-level ground is precisely the track the player
  // rides. The walls get the strata. The piste stays clean, and so does the
  // one surface the trail, the rider's shadow and the gates are read against.
  //
  // THE BAND LIMIT IS IN Y, so resolves() is no use: it reads the x and z
  // footprints, and a bed's period is vertical. band1 takes the footprint
  // this shader does not otherwise measure.
  // THE FOLD HAS TO BE SMALL AGAINST THE BED, and the first cut had it four
  // times larger: 3.4 m of lateral warp on a 1.35 m bed is two and a half
  // whole bands of displacement, so the pattern stopped being a function of
  // height at all and became the warp noise itself, drawn as long raking
  // streaks down the fall line. Measured off the first capture — the left
  // wall came back combed diagonally, which is the corduroy artefact this
  // block was written to delete, arriving by a different route.
  //
  // 0.62 m is a little under half a bed: enough that no band is level across
  // a whole valley, not enough that any band stops being level locally. The
  // warp's own wavelength went UP as its amplitude came down (0.0145 to
  // 0.0062, so 69 m to 161 m), because a fold is a regional thing — beds that
  // undulate every few metres are not folded, they are wrinkled.
  float fold = n21s(vWorld.xz * 0.0062) * 0.62;
  vec3  bed  = n21sd(vec2((vWorld.y + fold) * 0.74, vWorld.x * 0.013 + 31.0));
  float bedK = band1(1.35, mppY) * smoothstep(0.10, 0.42, steep);
  float bedS = sign(bed.x - 0.5);
  float bedV = abs(bed.x - 0.5) * 2.0;
  // The steepest-ascent direction in the surface's own tangent plane: the way
  // a ledge sticks out of a wall. Degenerate on level ground, where bedK has
  // already gone to zero, so the epsilon never has to carry anything real.
  vec3 upT = vec3(0.0, 1.0, 0.0) - N * N.y;
  upT = upT / max(length(upT), 1e-3);
  // d(bedV)/dy, through the chain: the lattice gradient, the 0.74 scale, the
  // abs()'s sign flip and the x2 the crease was normalised by.
  N = normalize(N - upT * (bed.y * 0.74 * bedS * 2.0) * bedK * 0.42);

  // ── jointing ────────────────────────────────────────────────────────────
  // Where the snow had sastrugi, rock has the crack set a face breaks along.
  //
  // The fetch is the same shape and the same cost as the one it replaces —
  // one n21sd, value and analytic gradient out of the same four hashes — and
  // the only change is the one that matters: the value is CREASED, by the
  // same abs-and-sign the strata use. A smooth value noise tilted into the
  // normal gives rounded swells, and a rounded swell is a drift. Creased, the
  // normal breaks rather than rolls: straight-ish edges with flat-ish blocks
  // between them, which is what a jointed face is.
  //
  // COARSER than the sastrugi it replaces — 1.30 m by 3.44 m against 0.54 by
  // 2.41 — because a block is bigger than a ripple, and because the band the
  // frame measured short in is the ordered one above half a metre, not below
  // it. At the bottom of frame that is 34 px by 90 px.
  //
  // ROTATED, for the reason this file keeps rotating lattices: a lattice on
  // the world axes is, to a camera looking down the fall line, a lattice on
  // the screen's, and once its cells resolve it reads as weave. 32 degrees,
  // off both the fall line and the strata's fold.
  const vec2 JX = vec2(0.6525, 0.4078);   // across the joints, 1 / 1.30 m
  const vec2 JZ = vec2(-0.1540, 0.2464);  // along them,        1 / 3.44 m
  vec3  jnt = n21sd(vec2(dot(vWorld.xz, JX), dot(vWorld.xz, JZ)) + 17.0);
  float jk  = resolves(vec2(1.30, 3.44), mpp);
  float jS  = sign(jnt.x - 0.5);
  // Damped on the track, raised where the region field says the face has
  // shattered. A kicker is BUILT, so it keeps its own shape: vKick is already
  // in piste.
  float joint = jk * (1.0 - piste * 0.70) * (0.42 + 1.00 * broken);
  vec2  jg = (jnt.y * JX + jnt.z * JZ) * jS;
  // 0.95, not the 0.58 the sastrugi's amplitude was inherited at. A drift is a
  // soft thing and reads at a small tilt; a block face does not read at all
  // until the break is sharp enough to put its two sides in different light,
  // and the wrap is now 0.12, which means a tilt has to be real to cross a
  // terminator that tight. Measured on the first capture: at 0.58 the jointing
  // was invisible at every distance and the only texture in the frame was the
  // scree.
  N = normalize(N + vec3(-jg.x, 0.0, -jg.y) * joint * 0.95);

  // ── albedo ──────────────────────────────────────────────────────────────
  // EXPOSED ROCK FROM THE HILL, NOT FROM THE TESSELLATION. This used to
  // threshold the FACETED normal, which is constant across a triangle: the
  // dark rock therefore flipped whole-triangle at a time and salted the
  // valley walls with a hard stipple — dither, not scree. The interpolated
  // normal varies smoothly through a triangle, so the line now follows the
  // ground; two octaves of smooth noise break it into bands and tongues, and
  // the threshold is wide enough to be a transition rather than an edge.
  //
  // This survived the change of material unaltered, and it is worth saying
  // why, because every other block in here did not. uSnowColor and uRockColor
  // are carve's names for two tones the ground is mixed between — a pale one
  // on what lies flat and a dark one on what stands up — and on a mountain of
  // rock that is still exactly what the mix means: regolith and dust where
  // debris can rest, bare dark face where it cannot. The names are the only
  // part that is now wrong, and renaming a uniform that nine files read is a
  // mechanical change that does not belong in the middle of a look change.
  float rockN = 0.0;
  // GATED, and the gate is EXACT rather than a tolerance. grit tops out at
  // 0.37, so below steep = 0.075 the smoothstep's argument cannot reach 0.26
  // and this is identically zero however the noise falls. The piste runs at
  // steep = 0.04, so the two most expensive fetches in this shader were being
  // computed over the majority of the screen to produce a guaranteed zero.
  if (steep > 0.075) {
    float grit = n21s(vWorld.xz * 0.085) * 0.26 + n21s(vWorld.xz * 0.47 + 5.0) * 0.11;
    // A kicker is steep because it was BUILT, not because the face has been
    // stripped — without the mask its faces came out speckled like scree.
    rockN = smoothstep(0.26, 0.62, steep + grit - 0.185) * (1.0 - vKick);
  }
  float rock = rockN;
  vec3 albedo = mix(uSnowColor, uRockColor, rock);
  // THE BEDS IN THE ALBEDO AS WELL AS IN THE NORMAL, and at first light that
  // matters more than it should: below the sun floor the beam is replaced by
  // a sky-dome term that reads N.y and nothing else, so a ledge that exists
  // only as a normal tilt is worth almost nothing there. Albedo is the one
  // channel the strata have that does not go through that gate — the same
  // argument the corduroy used to make for itself, inherited by the term that
  // replaced it.
  //
  // Mineral banding is a real colour difference and not just a shadow, so
  // this is wider than the 3.4% the groomer troughs ran at.
  albedo *= 1.0 - bedK * 0.16 * (1.0 - bedV);
  // Rock is not one tone. The region field, which is already paid for, keeps
  // large expanses from reading as a single fill — and because the same field
  // drives the jointing and the scree, the change of colour and the change of
  // texture are one feature of the ground rather than two unrelated ones.
  // That is what makes a shattered patch read as shattered rather than as a
  // brightness wobble over an even surface.
  albedo *= 0.877 + 0.118 * (region - 0.725);
  // The joints DARKEN, and only the joints. The crease is where water sits,
  // where lichen grows and where the shadow of the block's own edge falls, so
  // this is one-sided like the scree pit below and for the same reason: a
  // symmetric term raises the variance and stays a wash. It is the value half
  // of a fetch whose gradient half already tilted the normal, so it is free.
  albedo *= 1.0 - 0.30 * jk * (0.4 + 0.9 * broken) * (1.0 - abs(jnt.x - 0.5) * 2.0);
  // ── scree ───────────────────────────────────────────────────────────────
  // The pitting of a broken surface, and the direct descendant of the
  // granulation this replaced — same lattices, same band limits, same
  // one-sided shape, retuned.
  //
  // THE SHAPE IS WHY IT SURVIVED THE MATERIAL CHANGE. The residual of a real
  // ground surface after a blur is skewed NEGATIVE: a lit ground carrying
  // dark speckle, which on snow is the micro-shadow between grains and on
  // rock is the micro-shadow between fragments. Same statistic, same cure —
  // only the bottom of the noise darkens, written about its own mean so it
  // does not shift the exposure the piste is calibrated to.
  //
  // DEEPER than snow's pitting, at 2.9:1 rather than 2.3:1, because that is
  // the one number the two materials genuinely disagree on: snow scatters
  // light into its own pits and rock does not.
  //
  // NOT A HARD CELL, and ROTATED on two different angles. Value noise is band
  // limited so it rolls off into the fade instead of folding, and a lattice
  // whose axes are the world's is also — under a camera looking down the fall
  // line — a lattice whose axes are the screen's. Both octaves rotate, and on
  // different angles, so they do not line up with each other either.
  const vec2 QX = vec2(2.7032, -1.8928);  // 30 cm across, -35 deg
  const vec2 QZ = vec2(0.7629,  1.0895);  // 92 cm along
  vec2  gq  = vec2(dot(vWorld.xz, QX), dot(vWorld.xz, QZ));
  float gk  = resolves(vec2(0.303, 0.752), mpp);
  float pit = max(0.0, 0.52 - n21s(gq + 61.0)) - 0.10;
  // Shattered ground is all fragment shadow; an intact slab is smooth and has
  // almost none. Damped on the track. Mean unchanged.
  // 0.72, back to the depth the snow ran at rather than the 0.96 the first cut
  // raised it to. The argument for deepening it was sound — rock does not
  // scatter light into its own pits the way snow does — and it is still true;
  // what the capture showed is that it was being made against the wrong
  // backdrop. On a near-white piste a 2.9:1 pit is a texture. On a mid-value
  // one it is most of the albedo's whole range, and the near field came out a
  // mat of speckle with the jointing and the strata underneath it.
  //
  // The depth rock genuinely has over snow is bought in the LIGHT instead, by
  // the wrap and the shadow floor, where it costs nothing in the near field
  // because neither of those is a per-pixel pattern.
  albedo *= 1.0 - 0.72 * (1.30 - 0.6 * broken) * (1.0 - piste * 0.45) * pit * gk;
  // AND A SECOND OCTAVE, 13 cm by 45 cm, which is the one that has to DIE.
  //
  // Rock at thirty metres does have pixel-scale detail; what it does not have
  // is the SAME pixel-scale detail at eighty. This octave is 3.4 px across at
  // the bottom of frame, 1.6 px at forty metres and gone by fifty — resolves()
  // cuts it exactly where it would begin to fold — while the octave above it
  // carries on to a hundred. Two terms retiring at different depths is what a
  // receding surface IS, and it is why the gradient can be steep near and
  // smooth far instead of one flat number at both.
  //
  // SYMMETRIC, where the octave above it is a pit, and that is deliberate.
  // The pit carries the residual's negative skew; stacking a second one-sided
  // term on it took the skew to twice as far the other side. One pit for the
  // skew and one symmetric octave for the variance lands both.
  const vec2 FX = vec2(6.9792, 3.2542);   // 13 cm across, +25 deg
  const vec2 FZ = vec2(-0.9298, 1.9938);  // 45 cm along
  vec2  gf = vec2(dot(vWorld.xz, FX), dot(vWorld.xz, FZ));
  float fk = resolves(vec2(0.130, 0.455), mpp);
  // 0.95, DOWN from the 1.55 the snow ran. That number was solved to put back
  // a per-pixel gradient that coarsening the octave above it had taken away,
  // against a surface whose other terms were a 3.4% groomer trough and a
  // 9% ripple drift — nothing else in the near field had any contrast in it.
  // This surface has jointing at nearly twice the tilt and strata on top, so
  // the same amplitude arrives on a frame that is already busy and reads as a
  // woven mat of speckle laid over the rock rather than as the rock's own
  // grain. Measured on the first capture, where it was the only thing visible
  // in the near field.
  albedo *= 1.0 + 0.95 * fk * (n21s(gf + 23.0) - 0.5);
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
  // ROCK DOES NOT WRAP, and this is the single line that buys the most drama
  // per character in the file.
  //
  // Snow is so forward-scattering that light carries far past the terminator,
  // and this shader's whole first paragraph used to be about that: the wrap
  // was the reason the surface read as snow at all. It had already been
  // tightened once, from the physically honest 0.62 down to 0.35, because
  // even real snow's wrap flattened the mountain into one pale band.
  //
  // Rock scatters almost nothing. At 0.12 the terminator is nearly where the
  // geometry says it is, so a bed, a joint and a facet each have a lit side
  // and a dark side instead of two brightnesses of the same grey — and the
  // whole reason to build strata and jointing in the first place is that
  // light takes sides across them. A wide wrap would have quietly deleted
  // both terms. This is not a taste setting; it is what makes the two blocks
  // above visible.
  float wrap = clamp((ndl + 0.12) / 1.12, 0.0, 1.0);
  // SHADOWED ROCK GOES FURTHER DOWN THAN SHADOWED SNOW, for the same reason.
  // Snow's shadows stay bright because light enters the surface and comes
  // back out of it somewhere else; rock's do not, and what is left in them is
  // the sky alone. 0.26 was the measured floor for a translucent surface and
  // it is simply wrong for an opaque one — it was lifting every cast shadow
  // on the mountain a quarter of the way back to full light.
  //
  // NOT TO ZERO. The ambient term below is still the sky dome, which is real
  // light arriving in a real shadow, and this multiplies the DIRECT term
  // only. 0.15 is a hard shadow with shape left in it; it was measured at
  // 0.14 once before, for snow, and called too dark — on rock it reads.
  float shade = mix(0.15, 1.0, max(vShade, vKick * 0.65));

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
  // CUT TO A THIRD, AND KEPT. The hump itself is the reason the ground reads
  // as rolling away under the camera rather than as a backdrop hung behind
  // it, and that is a property of the GEOMETRY and the camera, not of the
  // material — delete it and the piste goes back to being a flat ramp
  // whatever it is made of.
  //
  // What was material-specific is the AMPLITUDE. 0.205 is forward scattering
  // through a translucent surface, which rock does not do. What a dusty rock
  // surface does at a grazing angle is a weak backscatter off the dust lying
  // on it, which is the same shape an order of magnitude down. 0.068, and it
  // now reads as haze on the ground instead of as light coming through it.
  float sheen = graze * (0.35 + 0.65 * nh * nh * nh) * 0.068 * (1.0 - rock);

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
  // MICA, NOT ICE — a fifth of the amplitude, and only on broken ground.
  //
  // The term is kept rather than deleted, and the reasoning is the same shape
  // as the sheen's one block up. Everything above this line describes a sparse
  // point process whose cells are deliberately sub-pixel and whose footprint
  // gate was solved against a measured camera; all of that is about how to
  // draw scattered glints without them crawling, and it is as true of a
  // cleaved mineral face as it is of an ice crystal.
  //
  // What is NOT true of rock is the DENSITY. Every square centimetre of snow
  // catches the light; a crystal face in rock is a rare event on a fresh
  // break and absent on a weathered slab. So this runs at 0.21 of what it
  // did, and it is multiplied by the broken field, which already says where
  // the ground has shattered. An intact slab and the worn track get none.
  //
  // uSparkle itself is untouched — it is a mood field, it rides the arc from
  // 0.10 in the void to 1.7 at high xenon, and that arc is about how hard the
  // light is, which is a property of the hour and not of the ground.
  float sparkle = glint * lit * near * uSparkle * 0.21 * broken
                * (1.0 - rock) * (1.0 - piste * 0.8) * vShade;

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
// ── THE GROUND AS A HOLOGRAM ────────────────────────────────────────────────
//
// "Use the geometry of the plain close to me — not the one in the distance —
// but as a holographic energy field I can ride on."
//
// It is the SAME MESH, the same vertices, the same streaming ring and the same
// surface the rider is riding. Only the fragment stage is different, which is
// the whole reason this is a sensible thing to try: nothing about the
// simulation, the collision, the band placement or the camera's clearance has
// any idea it happened.
//
// FOUR THINGS MAKE IT READ AS A FIELD RATHER THAN AS A TEXTURE:
//
//  1. A GRID IN THE COURSE'S OWN COORDINATES, not in world x and z. The lines
//     run along `u` and along `p`, so they follow the piste as it meanders
//     instead of cutting across it — the grid belongs to the run rather than
//     to the world, which is what a projected field would do.
//  2. IT IS BRIGHTEST AT GRAZING ANGLES. A Fresnel term on the faceted normal,
//     so the surface is nearly invisible where you look straight down at it
//     and glows where it turns away. That is the single cue that separates "a
//     glowing plane" from "a volume of light you are looking through", and it
//     is why the far walls of the bowl light up while the piste under the
//     board stays clear.
//  3. IT ENDS. `uHoloFar` fades the whole thing out with distance, which is
//     the brief — the plain CLOSE TO ME and not the one in the distance. The
//     horizon is left to the far range and the sky.
//  4. IT MOVES. One slow scan travelling down the fall line. Without it the
//     grid is a decal; with it, it is being drawn by something.
//
// ADDITIVE AND depthWrite OFF, so the floating islands below show through it,
// which is both what a hologram does and what makes the altitude read.
const HOLO_FRAG = /* glsl */ `
precision highp float;

uniform vec3  uFogColor;
uniform float uFogDensity;
uniform vec3  uCamPos;
uniform vec3  uHoloColor;
uniform float uHoloFar;
uniform float uTime;
uniform float uExposure;

varying vec3  vWorld;
varying vec3  vRel;
varying vec3  vNormal;
varying float vU;
varying float vShade;
varying float vKick;
varying float vLip;
varying float vAlt;

// Distance to the nearest line of a grid of the given period, in the units the
// coordinate is measured in, BAND LIMITED by the screen footprint of that
// coordinate so the lines fade out rather than alias into moire when they get
// too close together to resolve.
float grid(float x, float period, float width, float fw) {
  float d = abs(fract(x / period - 0.5) - 0.5) * period;
  float w = max(width, fw * 1.5);
  float line = 1.0 - smoothstep(w, w * 2.2, d);
  // Below two pixels a period, the grid is no longer a grid.
  return line * smoothstep(1.0, 2.6, period / max(fw, 1e-4));
}

void main() {
  vec3 N = normalize(cross(dFdx(vRel), dFdy(vRel)));
  vec3 Nv = normalize(vNormal);
  if (dot(N, Nv) < 0.0) N = -N;
  vec3 V = normalize(-vRel);
  float camDist = length(vRel);

  // The course's own coordinates: across the piste, and down it.
  float u = vU;
  float p = -vWorld.z;
  float fwU = fwidth(u);
  float fwP = fwidth(p);

  float fine = max(grid(u, 2.0, 0.045, fwU), grid(p, 2.0, 0.045, fwP));
  float coarse = max(grid(u, 10.0, 0.10, fwU), grid(p, 10.0, 0.10, fwP));

  // GRAZING, not facing. See the header: this is the term that makes it a
  // field rather than a lit plane.
  float nv = clamp(dot(N, V), 0.0, 1.0);
  // 5.0, NOT 2.6, AND IT IS THE TERM THAT NEARLY SANK THIS. A Fresnel on a
  // long slope seen from a chase camera is near 1 over most of the FRAME: the
  // ground runs away to the horizon, so the great majority of pixels are at
  // grazing incidence. A gentle exponent therefore does not add a rim, it adds
  // a flat wash over three quarters of the screen — and on an additive surface
  // feeding a bloom pass that is a white band across the middle with the rider
  // lost inside it, which is exactly what the first two captures showed.
  float rim = pow(1.0 - nv, 5.0);

  // One slow scan down the fall line, and a second much slower one the other
  // way so the two never land together and the pattern has no visible loop.
  float scan = 0.5 + 0.5 * sin(p * 0.22 - uTime * 2.6);
  scan = pow(scan, 6.0) * 0.55
       + 0.25 * pow(0.5 + 0.5 * sin(p * 0.035 + uTime * 0.7), 3.0);

  // A FLOOR UNDER THE WHOLE SURFACE, so it is a volume and not just lines in
  // the dark — but a low one, because the thing being ridden has to stay
  // readable against the things standing on it.
  float body = 0.012 + 0.05 * rim;

  // ── EVERY WEIGHT HERE IS A THIRD OF WHAT IT WAS, AND THAT WAS MEASURED ──
  //
  // The first cut summed to well over 1 across the whole near field, and on an
  // ADDITIVE surface that does not read as "bright cyan" — it reads as WHITE,
  // because every channel clips to 1 together and the hue is the first thing
  // to go. The capture came back a blown white sheet with a grid faintly
  // visible in it, and the bowl's left wall was pure paper.
  //
  // It is additive AND the frame goes through bloom, so the budget is not 1,
  // it is well under it: anything over about 0.6 is already a bloom source and
  // comes back bigger than it was drawn. The sum below peaks near 0.75 on a
  // grid line seen edge-on and sits around 0.1 on the piste underfoot, which
  // is what leaves the board, the trail and the drones readable on top of it.
  float glow = body + fine * 0.13 + coarse * 0.34 + scan * 0.14 + rim * 0.07;
  // A HARD CEILING, and it is not a fudge — it is the only thing standing
  // between an additive surface and a bloom pass. Every term above is bounded
  // on its own and they still sum past 1 where a coarse line, a scan crest and
  // a grazing angle land together, which is a guaranteed event somewhere in
  // every frame. Clamping here costs nothing anywhere else and removes the
  // runaway by construction rather than by tuning.
  glow = min(glow, 0.52);

  // THE SELF-SHADOW STILL APPLIES, which is most of why this reads as terrain
  // at all rather than as a flat sheet with a grid on it. aShade is marched
  // through the height field on the CPU when a chunk is built, so a ridge
  // still throws its shadow down the piste — as a hole in the field.
  glow *= mix(0.45, 1.0, max(vShade, vKick * 0.6));

  // AND IT ENDS. The brief is the plain close to me, not the one in the
  // distance; past uHoloFar there is sky and the far range and nothing else.
  // The fade starts early — a quarter of the way out — because an additive
  // surface that is still at half strength when it stops is a visible EDGE,
  // and a hologram with a hard rim is a disc, not a field.
  glow *= 1.0 - smoothstep(uHoloFar * 0.15, uHoloFar, camDist);

  // ── DIVIDED BY THE HOUR'S OWN EXPOSURE ─────────────────────────────────
  //
  // This is additive, so it is added BEFORE tone mapping and then multiplied
  // by whatever exposure the mood is running. The arc spans 0.81 at high
  // xenon to 2.6 at the red shift — a factor of three — so a field tuned to
  // sit politely under the void came back at the bright stop as a sheet of
  // white with a bloom halo across the middle of the frame, which is what the
  // capture showed. Nothing else in this game has the problem because
  // everything else is multiplied by the light rather than added to it.
  //
  // Normalised against 1.2, near the middle of the arc, so the number below
  // means what it meant when it was tuned.
  glow *= clamp(1.2 / max(uExposure, 0.2), 0.35, 1.6);

  gl_FragColor = vec4(uHoloColor * glow, 1.0);
}
`;

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
    // THE HOLOGRAM SHARES THE VERTEX STAGE, which is not a saving so much as a
    // requirement: it needs `vU`, `vShade` and the camera-relative `vRel` that
    // the 16384 m blacks bug was fixed with, and a second copy of that vertex
    // shader is a second place for that fix to rot.
    this.holoMaterial = new THREE.ShaderMaterial({
      vertexShader: SNOW_VERT,
      fragmentShader: HOLO_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uFogColor: { value: new THREE.Color(0xa8c4e6) },
        uFogDensity: { value: 0.005 },
        uCamPos: { value: new THREE.Vector3() },
        uHoloColor: { value: new THREE.Color(0x35e0ff) },
        /** Metres at which the field has faded to nothing. */
        uHoloFar: { value: 130 },
        uTime: { value: 0 },
        /** The mood's own exposure, pushed per frame. See the note in the
         *  fragment shader — an additive surface has to know it. */
        uExposure: { value: 1.2 },
      },
    });
    mood.bind(this.holoMaterial.uniforms);
    this.mood = mood;

    this.baseIndex = 0;
    this.rebuildQueue = [];
    this.pending = null;
    /** @type {'solid'|'hidden'|'holo'} */
    this.style = 'solid';
    /**
     * Whether the ground is DRAWN. It is always there — the rider rides it,
     * the camera clears it, the drones hover over it and every band in the
     * game is still placed against it. This hides the triangles and nothing
     * else, which is exactly what a POC of "what if there were no ground"
     * should cost.
     */
    this.shown = true;
  }

  /**
   * Draw the ground, or do not.
   *
   * IT HAS TO BE A FLAG AND NOT A LOOP, because chunks are shown by the
   * streamer as they finish building (`_finish` sets `mesh.visible = true`)
   * and a one-off pass over the ring would be undone by the next slab that
   * came in off the rebuild queue — as a strip of mountain reappearing at the
   * fog line every few seconds.
   */
  setVisible(v) {
    this.setStyle(v ? 'solid' : 'hidden');
  }

  /**
   * How the ground is DRAWN. It is always there either way — see `shown`.
   *
   * A FLAG AND NOT JUST A LOOP, because chunks are shown and materialed by the
   * streamer as they finish building, and a one-off pass would be undone by
   * the next slab off the rebuild queue — as a strip of solid mountain
   * reappearing at the fog line every few seconds.
   */
  setStyle(style) {
    this.style = style;
    this.shown = style !== 'hidden';
    const mat = style === 'holo' ? this.holoMaterial : this.material;
    for (const c of this.chunks) {
      c.mesh.material = mat;
      c.mesh.visible = this.shown && c.p0 !== undefined;
    }
    this.spare.mesh.material = mat;
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
    job.chunk.mesh.material = this.style === 'holo' ? this.holoMaterial : this.material;
    job.chunk.mesh.visible = this.shown;
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

  update(p, camPos, dt = 0) {
    if (this.style === 'holo') {
      const u = this.holoMaterial.uniforms;
      u.uCamPos.value.copy(camPos);
      u.uTime.value += dt;
      u.uExposure.value = this.mood?.exposure ?? 1.2;
    }
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
