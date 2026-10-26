// The trench.
//
// This is the game's one indispensable visual. A snowboard game without a line
// cut into the snow behind the board is a car with no tyre marks — the whole
// claim of the genre is that you left a mark, and everything else on screen is
// in service of that.
//
// It also does real work as a readout. The trench narrows to a knife line under
// a clean, fully engaged carve and smears wide the moment the board starts to
// skid, so the player can see the difference between the two without ever being
// told there is one.
//
// The line persists for around two hundred metres. The chase camera looks down
// the hill, so the trail directly behind the board is mostly out of frame — what
// you actually see is the arc of the turn BEFORE last, swinging past on the
// inside as you come back across it. Keeping only the nearest few metres, as the
// first version did, threw away the one view that shows what carving is.
//
// Three things about the SHAPE of the ribbon, because they are what a reader
// coming to this file needs before any of the shading makes sense:
//
//   * The newest sample is LIVE. It is rewritten at the board's position every
//     frame and only frozen once it is a full step behind, so the cut always
//     reaches the board. Frozen on a fixed 0.85 m grid instead, the tip stood
//     still while the rider ran on and then jumped forward — fourteen times a
//     second at riding speed, in the one part of the frame the player is looking
//     at.
//   * A break is TWO DEAD SAMPLES, not a shortened one. See _breakRibbon.
//   * Every procedural in the shader is band-limited by its own screen
//     footprint, not by distance. See cellf.

import * as THREE from 'three';
import { meshHeight, sunVisibility } from './mountain.js';

// A hash that survives the far end of the mountain.
//
// This was `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123)`, and for the
// first few hundred metres of the run it was fine. There is no finish line: the
// run ends when the music does, so z reaches several thousand metres, and at
// fifteen cells a metre the cell index reaches tens of thousands and the dot
// product lands near 1e6 — where a 32-bit float's spacing is an EIGHTH OF A
// RADIAN. sin() of an argument quantised to eighths of a radian has about fifty
// distinct outputs in a whole turn, so from partway down the hill the entire
// trench was being drawn out of a fifty-entry lookup table. That is exactly what
// a blind reviewer saw and called "repeated identical white clumps": not a
// texture that happens to look repetitive, a texture with fifty values in it.
//
// Hoskins' bit-mixing hash instead, on coordinates folded to a bounded range
// first. Nothing in it grows with world position, so the last metre of the run
// hashes as well as the first. The fold is at 4096 cells — 630 m at the coarse
// octave, far past anything one frame can hold — and it is done in floats that
// are still exact integers at that magnitude, so it costs no precision of its
// own.
const HASH_GLSL = /* glsl */ `
float h21s(vec2 p) {
  p -= floor(p * (1.0 / 4096.0)) * 4096.0;
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise with the WIDTH of the transition between cells as a parameter.
//
// e = 1 is ordinary smooth value noise. e -> 0 is a hard cell grid: every cell a
// flat plateau of its own random value with a step at the boundary. The knob
// exists because the right answer is not a property of the snow, it is a
// property of how big the cell lands ON SCREEN — a hard-edged cell is snow
// granulation at three pixels and Minecraft at thirty, and the same 15 cm cell
// is both of those at different points in the same frame.
float cellv(vec2 p, float e) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = clamp((f - 0.5) / e + 0.5, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(h21s(i), h21s(i + vec2(1.0, 0.0)), u.x),
             mix(h21s(i + vec2(0.0, 1.0)), h21s(i + vec2(1.0, 1.0)), u.x), u.y);
}

float n21s(vec2 p) { return cellv(p, 1.0); }
`;

// Long enough to see the shape of the last few turns, not just the metre behind
// the board. At 0.85 m a sample this is a bit under two hundred metres of line —
// on any turn tighter than a gentle traverse, the arcs you cut swing into frame
// beside you, which is the whole point of carving.
const CAPACITY = 220;       // samples kept
const STEP = 0.85;          // metres between samples
// A quarter of a metre. Far more than a real trench lip, and deliberately so:
// at twenty metres it is invisible as an offset, while being decisive about the
// depth test on hardware with less precision than a desktop. A trail that is
// physically accurate and never drawn is worth nothing.
//
// The lift is the ONLY depth bias this mesh gets. It used to also carry
// polygonOffset(-8,-8), and the slope-scaled term of that offset — at the
// grazing angles a chase camera always sees a ground ribbon at — pulled the
// trail METRES toward the camera on real GPUs: the line showed through every
// kicker face and valley-wall bump between it and the lens, and the snow it
// punched through read as transparent. The QA software rasteriser's offset
// arithmetic never reproduced it; the player's AMD did, on every single ramp.
const LIFT = 0.25;
// The berm's crest, ABOVE the lift — never below it. A board does not delete the
// snow it cuts, it throws it sideways, and the ridge it piles up is the half of
// the trench that carries the read: a dark slot alone is a stain, a dark slot
// with a bright ridge beside it is displaced material. Thirteen centimetres is
// small enough that the parallax between floor and crest stays under half a
// metre at the distances the chase camera holds, and large enough that the
// crest catches the light at a visibly different angle from the floor.
//
// It is added to LIFT rather than subtracted from it, so the outer rim of the
// ribbon has MORE depth bias than the inner, not less. Nothing here reduces the
// margin the depth test already had.
const BERM = 0.13;
/**
 * A flat scale on the swath's half-width.
 *
 * Applied as a multiplier rather than by editing the three terms, so the widths
 * they encode -- 0.74 flat, plus 0.26 as the edge comes off, plus 0.85 of the
 * slip -- stay readable as the measurements they are and the RATIO between a
 * carve, a flat run and a skid is untouched.
 */
const TRAIL_WIDTH = 0.70;
// ── KEEPING THE BOARD ON TOP ──────────────────────────────────────────────
// Measured: the board rides 0.072 m above the snow. The ribbon floor sits at
// LIFT (0.25) and the shadow at the same. So both were a clear 18 cm ABOVE the
// board, and the depth test buried its tail in them — correctly, because the
// board really was underneath. Nothing here was a sorting bug; the geometry
// was simply stacked the wrong way round.
//
// LIFT cannot just come down: the note above it is a scar, and a quarter metre
// is what keeps the trail off the snow on hardware with a shallow depth buffer.
// But that argument is about the FAR end of the trail. Depth precision is at
// its best near the camera, and the metre of ribbon under the board is the
// closest geometry in the frame — so this is the one place the bias can be
// spent, and it is spent only there.
//
// DUCK is removed from the lift at the head and ramped back to zero over
// DUCK_SAMPLES, putting the ribbon floor at 0.03 under the board and returning
// it to the full 0.25 about three metres back. The crest is unaffected in the
// only way that matters: it rides the outer rim, 0.7 m out, and the board is
// 0.125 m wide — they never overlap.
const DUCK = 0.22;
const DUCK_SAMPLES = 4;
// The shadow gets a flat small lift instead of a ramp. It is drawn AROUND the
// rider and nowhere else, so all of it is in the near field all of the time and
// none of it ever needs the far-field bias.
const SH_LIFT = 0.03;
// Where the cut floor ends and the displaced snow begins, as a fraction of the
// half-width.
//
// Re-measured off the reference rather than inherited. Along the bottom rows of
// ref/reference.png the disturbed swath is about 235 px wide and the DARK CUT
// inside it is about 135 of them — the slot is the bigger half of the mark, not
// a third of it, and the rubble either side is a narrower band than the cut it
// came out of. The previous 0.34 put the geometric shoulder a third of the way
// out and the shader's dark band at a seventh, so seven eighths of the ribbon
// was displaced snow: a bright strip with a hairline down the middle, which is
// what the last two rounds actually rendered and what "not good enough" was
// looking at.
const FLOOR_V = 0.46;
// Vertices across the ribbon: outer rim, crest shoulder, and their mirrors.
const LANES = [-1, -FLOOR_V, FLOOR_V, 1];
const VPS = LANES.length;   // vertices per sample
// How far the board may travel without cutting anything before the ribbon has
// to be CUT rather than stretched, and the clearance that says it really left
// the snow rather than skimmed a roller.
//
// A duration test lived here before — airTime > 0.22 s — and a duration is the
// wrong quantity twice over: it is frame-rate dependent, and what the player
// sees is a length of hillside, not a length of time. 1.8 m is two sample steps
// of ground the board never touched, which is the point where a bridging quad
// stops being indistinguishable from the ribbon's own discretisation. Both
// conditions have to hold: a fast rider clears 1.8 m in under a tenth of a
// second, so distance alone would dash the line over every roller.
const AIR_GAP = 1.8;
const AIR_LIFT = 0.12;
// And a hard backstop for teleports — a QA seek, a respawn, anything that moves
// the rider without moving it through the world. Nothing legitimate covers this
// much ground between two frames.
const JUMP_CUT = 12.0;
// The arc length down the cut drives the chatter, and a run has no finish line —
// it ends when the music does, so it reaches several thousand metres. A varying
// that large has a float32 spacing coarse enough to quantise a six-centimetre
// feature into visible steps by the bottom of the hill. So the whole ribbon is
// REBASED by a round 4096 m at once — every live sample and the accumulator
// together — which shifts nothing relative to anything else. The chatter
// frequencies are whole numbers per metre, so 4096 m is a whole number of cells
// and the rebase is invisible; keep them that way.
const ARC_WRAP = 4096;

const TRAIL_VERT = /* glsl */ `
attribute float aV;
attribute float aAge;
attribute float aSide;
attribute float aAlong;
attribute vec3 aCol;
varying float vV;
varying float vAge;
varying float vSide;
varying float vAlong;
varying vec3 vWorld;
varying vec3 vCol;
void main() {
  vV = aV;
  vAge = aAge;
  vSide = aSide;
  vAlong = aAlong;
  vWorld = position;
  vCol = aCol;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const TRAIL_FRAG = /* glsl */ `
precision highp float;
uniform vec3  uCamPos;
uniform vec3  uHead;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
varying float vV;
varying float vAge;
varying float vSide;
varying float vAlong;
varying vec3  vWorld;
varying vec3  vCol;
` + HASH_GLSL + `

// ── EVERY OCTAVE IS BAND-LIMITED, AND THAT IS NOT AN OPTIMISATION ────────────
//
// The player's report was that the trail SHIMMERS right behind the board. It
// did, and the cause was a rule in here that ran exactly backwards: the width of
// the transition between cells was set to be HARD when a cell was small on
// screen and SMOOTH when it was large. Snow granulation was the intent. But a
// hard step two or three pixels across is the one case a hard step cannot
// survive — its boundaries fall on different sides of the pixel centres every
// frame — so the whole field boiled. The near field was the worst of it, because
// a third octave at 3 cm was deliberately faded IN at 1.6 pixels a cell, which
// is under Nyquist by a factor of three, at full amplitude, right where the
// camera holds the trench.
//
// The rule below is the one a mip chain follows and it points the other way. The
// transition between two cells is never narrower than about a pixel and a half:
// a cell twenty pixels across keeps a crisp granular edge, because at that size
// a pixel and a half IS a crisp edge; a cell two pixels across has already
// melted into smooth value noise; and under a pixel the amplitude falls to the
// mean, because there is nothing there left to resolve. It costs one divide per
// octave and it is the difference between texture and static.
//
// Screen footprint, not distance. The two are not interchangeable — the same
// world point is two thirds the pixel size in portrait as in landscape, and
// portrait is what ships.
float cellf(vec2 q, float freq, float ppm, float off) {
  float px = ppm / freq;                       // pixels across one cell
  float e = clamp(1.6 / px, 0.05, 1.0);
  return mix(0.5, cellv(q * freq + off, e), smoothstep(0.9, 2.4, px));
}

/** The same fade, on plain smooth value noise — for terms that must never step. */
float noisef(vec2 q, float freq, float ppm, float off) {
  return mix(0.5, n21s(q * freq + off), smoothstep(0.9, 2.4, ppm / freq));
}

// ── THE NUMBERS BELOW ARE LINEAR, THE TARGETS THEY HIT ARE NOT ───────────────
//
// Everything measured off the reference is a ratio in the FINISHED frame, and
// the finished frame has been through an ACES curve and an sRGB encode. ACES is
// not a scale factor, so a multiplier here and a ratio on screen are two
// different quantities and the mapping between them has to be measured. The
// ribbon is painted flat at one known multiplier, captured, and divided by a
// capture of the same frozen frame with the trail HIDDEN — so the denominator is
// the snow that would have been there, pixel for pixel. Portrait, first light:
//
//   multiplier  0.08  0.12  0.18  0.26  0.40  0.60  0.85  1.0   1.4   2.0   2.8   3.8   5.0
//   on screen   0.10  0.17  0.25  0.34  0.49  0.67  0.85  0.90  1.11  1.30  1.43  1.55  1.63
//
// Three things in that table matter. It is very nearly linear below 1.0, so the
// dark half of the trench can be placed exactly and there is no reason to guess.
// It saturates hard above: 1.30x costs 2.0 and 1.55x costs 3.8, so a berm pushed
// past about 1.4x buys almost nothing and loses all its texture to the shoulder.
// And a multiplier of 1.0 lands at 0.90, not 1.0 — that ten per cent is the
// sheen the CPU bake leaves out, and every constant below is chosen against this
// table, so it is already paid for. Re-run the ramp if the mood's exposure or
// the snow's lighting moves; the shape of it is a property of the palette and
// not of this file.
//
// The targets, re-measured off ref/reference.png with fresh eyes rather than
// inherited, reading rows 600-780 of the near trench:
//
//     cut floor        0.33 - 0.47x the snow beside it (darker close, lifting
//                      with distance as the haze fills it in)
//     berm crest       1.30 - 1.40x, NOT the 1.55-1.75x the last round chased
//
// Both of the old targets were wrong in the same direction and the render shows
// it: too little contrast in the dark, far too much in the light, so the trench
// came out as a bright rubble strip with a hairline down it instead of a cut.
// The reference's mark is DARK. Its berms are only a little brighter than the
// piste and they are broken into lumps with shadow between them; what carries
// the read is the slot, not the shoulders.
//
// An inverse-tone-curve version of this — solve per pixel for the multiplier
// that lands on a given screen ratio — was written and thrown away. It is right
// in principle and it fails in practice: the answer depends on where the snow
// sits on the curve, and where the snow sits varies sample to sample with the
// terrain shadow, so on every unshadowed sample the target overshot white, the
// solve went asymptotic and the trench rendered as a plank of pure white. A
// plain multiplier degrades the way ACES degrades, which is gracefully.

// The groove REPAINTS the snow it cut through: aCol is the same wrap/ambient/
// shadow lighting the snow shader computes, baked per sample on the CPU, and
// the groove is that colour darkened. Nothing here depends on what is already
// in the framebuffer. Both blend-dependent versions failed: the constant-
// colour overlay glowed white through every terrain shadow it crossed, and
// MultiplyBlending silently degraded to no blending at all on the SwiftShader
// QA stack — an effect that renders differently per GPU is untestable.
//
// Which puts the whole tone of this mesh at the mercy of one CPU function, and
// that function had drifted six-fold. See _litSnow().
void main() {
  float a = abs(vV);
  // Which shoulder faces the sun. Baked per sample as dot(sun, rider.right) and
  // signed by the side of the ribbon, so it swaps ends as the rider carves
  // across the light instead of being fixed to left or right.
  //
  // Ramped across the centreline rather than a hard sign(). The band positions
  // below are jittered by up to a fifth of the half-width, so the wall term —
  // the one that takes the light in opposite senses on the two sides — reaches
  // the centre on a fair number of pixels, and a hard flip there drew a seam
  // straight down the middle of the cut.
  float side = clamp(vSide * clamp(vV / 0.14, -1.0, 1.0), -1.0, 1.0);

  float dist = length(vWorld - uCamPos);
  // The cell grid is ROTATED off the world axes. Aligned, its cells came out as
  // a run of square kerbstones down each side of the trench — the trail runs
  // very near the z axis, so every cell edge was parallel to the trench edge and
  // the berm read as masonry. Thirty degrees is enough that no cell boundary
  // ever agrees with the ribbon.
  mat2 rot = mat2(0.866, -0.500, 0.500, 0.866);
  vec2 q = rot * vWorld.xz;

  // How big a metre of ground is HERE, in pixels. Measured off the screen
  // derivative rather than off dist, because it is screen size that decides
  // every fade below and distance is only a proxy for it — a proxy that is
  // wrong by a factor of two between the landscape frames and portrait, and
  // wrong again the moment the speed gain widens the lens mid-run.
  vec2 dwx = dFdx(vWorld.xz);
  vec2 dwy = dFdy(vWorld.xz);
  float ppm = inversesqrt(max(max(dot(dwx, dwx), dot(dwy, dwy)), 1e-12));

  // Snow comes off an edge in LUMPS: 15 cm chunks, 7 cm grit, 3 cm granules,
  // and smooth crumb under all of them. World-space, so they are nailed to the
  // ground and do not swim along the ribbon as the camera moves — the one thing
  // that would give away that this is a painted strip and not material lying on
  // the hill. Each one dissolves on its own schedule, when its own cells reach
  // the size of a pixel, so nothing on this mesh is ever drawn at a frequency
  // the screen cannot hold.
  float chunk = cellf(q,  6.5, ppm, 11.3);
  float grit  = cellf(q, 15.0, ppm, 57.1);
  float fine  = cellf(q, 34.0, ppm,  7.9);
  float crumb = noisef(q, 21.0, ppm, 3.7);
  float wander = noisef(q, 2.9, ppm, 41.0);

  // ── chatter ─────────────────────────────────────────────────────────────
  //
  // The signature mark of a carved trench, and the thing the reference has that
  // no version of this file has ever drawn. Blow up ref/reference.png at the
  // bottom of the frame and the wall of the cut is not a surface, it is a run of
  // ridges ACROSS the track a few centimetres apart, left by a steel edge
  // chattering as it bites. The old term ran the other way — value noise
  // stretched ten to one DOWN the hill — which draws streaks ALONG the cut, and
  // streaks along a cut read as tarmac.
  //
  // In track space, off the arc length baked per sample, so it follows the curve
  // of a turn instead of the world axes. A world-space version puts the ridges
  // square to z, and in the middle of a hard carve the board is not going that
  // way.
  // Six centimetres between ridges along the track, and a cell 90 cm wide
  // ACROSS it — so the comb is not a ruled grating running the full width of the
  // cut, it breaks into segments the way a real edge does when the board loads
  // and unloads. Purely along-track it came out as a smooth rake, and a rake is
  // a texture, not a mark.
  //
  // Both frequencies are WHOLE NUMBERS per metre, and that is load-bearing: the
  // CPU rebases the arc length by a round 4096 m when it gets large (see
  // ARC_WRAP), and a whole number of cells per metre is what makes that rebase
  // land on a cell boundary and change nothing at all on screen.
  float chpx = ppm / 16.0;
  float chatter = mix(0.5, cellv(vec2(vAlong * 16.0, vWorld.x * 1.1), clamp(1.6 / chpx, 0.06, 1.0)),
                      smoothstep(0.9, 2.4, chpx));
  // A second, slower beat under it: the edge does not chatter at one frequency.
  float chatt2 = mix(0.5, n21s(vec2(vAlong * 4.0, 0.0)),
                     smoothstep(0.9, 2.4, ppm / 4.0));

  // Biased LOW. Flat noise put half the berm at full brightness and it came out
  // as soap suds; snow thrown off an edge is mostly mid-tone rubble with the
  // occasional lump catching the sun square on. The fine octave rides as a
  // multiplier rather than a summand, so close up the crest breaks into granules
  // instead of into soft blobs. Neutral at fine = 0.5.
  float lump = pow(mix(crumb, mix(chunk, grit, 0.35), 0.70) * (0.72 + 0.56 * fine), 1.45);

  // ── cross-section ───────────────────────────────────────────────────────
  //
  // Measured along a WANDERING axis. Every band below is a function of the
  // distance across the ribbon alone, so with a straight measure the trench gets
  // straight parallel edges and a blunt square end. Displacing the measure
  // itself makes every boundary at once ragged — the floor's edge, the wall, the
  // inside of the berm and its crest, all breaking on the same lumps, because in
  // the snow they are all the same edge. The chatter is in here too, which is
  // what puts the transverse serration into the WALL rather than painting it on
  // as a stripe.
  float aw = a + (wander - 0.5) * 0.26
               + (chunk - 0.5) * 0.15
               + (chatter - 0.5) * 0.09
               + (fine - 0.5) * 0.07;

  // Analytic edge width. Every smoothstep below is a step in aw, and by the top
  // of the frame the whole ribbon is two pixels wide — so a band 0.16 wide in aw
  // is a tenth of a pixel and rasterises into a dashed line. Widening each edge
  // by its own screen footprint turns that into a dimmer continuous band, which
  // is what a sub-pixel feature should be. Off a, not off aw: the noise in aw
  // has derivative spikes at cell boundaries and those are not screen size.
  float bw = clamp(fwidth(a) * 1.1, 0.0, 0.26);

  // ── the section is a PARTITION, not three bands added together ──────────
  //
  // Floor, then a short hard wall, then the berm — as two crossfades, so the
  // three tones always sum to exactly one whatever the widening above does to
  // the boundaries. Summed instead, the bands overlapped: near the top of the
  // frame bw grows to a quarter of the half-width, floor and wall and crest all
  // fired on the same pixel and their multipliers ADDED, and the far end of the
  // ribbon measured 2.9x the snow — a bright wire running up the hill, which is
  // the opposite of the thing it is drawing. A blend cannot do that; the answer
  // is bounded by the brightest of the three by construction.
  //
  // The dark part of a carve track is the BIGGER part of it — 135 px of dark
  // inside a 235 px swath at the bottom of the reference. The version before
  // this had the floor ending at 0.15 of the half-width and the crest running
  // from 0.26 out to 1.06, so seven eighths of the mark was displaced snow and
  // the cut was a hairline in the middle of a bright strip.
  float toWall  = smoothstep(0.20 - bw, 0.42 + bw, aw);
  float toCrest = smoothstep(0.46 - bw, 0.66 + bw, aw);

  // FLOOR: 0.30 landed at 0.38x on screen, inside the reference's measured
  // 0.31x-0.47x — and it still read as too dark when actually ridden. The
  // measurement is not wrong; it is answering a different question. In the
  // reference the trench is one element among many in a still. Here it runs from
  // the board to the bottom edge, dead centre, under the eye, for the whole run
  // — a long dark line down the middle of a bright field, and at that length the
  // same ratio carries far more weight than it does in a photograph. 0.375 lands
  // near 0.50x, at the top of the reference's range rather than the middle.
  //
  // A board at speed does not plane a floor, it skips down one, so the base tone
  // is chattered across the cut and crumbled along it. Every one of these terms
  // is exactly neutral at 0.5, and every one of them fades to 0.5 when its own
  // cells reach the size of a pixel — so the far trench is a clean tone, only
  // the near one is granular, and nothing in it can boil.
  float floorTone = 0.450
      + (chatter - 0.5) * 0.090
      + (chatt2  - 0.5) * 0.055
      + (crumb   - 0.5) * 0.040
      + (chunk   - 0.5) * 0.035
      + (fine    - 0.5) * 0.045
      // Loose snow knocked back INTO the cut. SPARSE — one cell in eight — and
      // bright out of all proportion to the floor it sits on, because a lump of
      // broken snow in a shadowed slot is the one thing down there still facing
      // the sky. Dense, it read as gravel. Peaks near 0.9x, which is where the
      // reference's brightest in-slot lumps sit.
      + smoothstep(0.86, 0.98, grit) * 0.45 * (0.55 + 0.90 * fine);

  // WALL. The inner walls take the light in the OPPOSITE sense to the berms
  // above them, and getting that backwards was most of why the cut read as a
  // slot rather than a V. A shoulder's outer face and the wall on its inside
  // look opposite ways: where the berm crest is blazing, the wall beneath it is
  // in its own shadow, and across the cut the far wall is tilted straight into
  // the sun and comes out at very nearly the brightness of the open snow. One
  // bright wall and one black one is what says "cut" — two grey ones say
  // "trough".
  //
  // And the wall is where the chatter lives: the ridges catch the light square
  // on and the troughs between them do not, which is the whole reason the
  // reference's cut looks cut rather than melted. The shade side lands at 0.21
  // total, a shade under the floor; the sun side runs 1.0 to 2.1, which is
  // 0.90x to 1.32x on screen.
  float wallTone = 0.300 + (0.55 - 0.62 * side) * (0.45 + 1.10 * chatter);

  // BERMS. Only a little brighter than the piste on average, with the brightest
  // lumps at 1.3-1.4x and the shadow between them dropping well under it — which
  // is what the reference's rubble bands measure, and nothing like the solid
  // 1.6x pipe this used to draw. The read does not come from the berms being
  // bright, it comes from them being BROKEN beside something dark.
  //
  // The low end of the lump factor is NEGATIVE: the gap between two lumps of
  // thrown snow is not dimmer displaced snow, it is a hole with shadow in it,
  // and on the shade side it is the darkest thing in the frame. Clamped at the
  // top, because lump can reach 1.5 when every octave peaks at once and an
  // unbounded crest puts a handful of pixels a full stop past everything else —
  // which the bloom then finds and turns into a string of lamps down the hill.
  //
  // The lump factor's FLOOR is what decides whether a berm reads at all. At the
  // first attempt it sat on zero, so the berm's average came out at 0.95x — the
  // brightest cells reached 1.4x and every cell between them was piste-coloured,
  // and at portrait scale, where the whole swath is twenty-five pixels, that
  // averages back into the snow and the sun-side berm disappeared entirely. It
  // is a band of broken snow standing proud of the surface: the gaps between the
  // lumps are darker than the lumps, not darker than the piste.
  float lumpLo = 0.20 + 0.10 * side;
  float crestTone = 0.300
      + (1.75 + 0.30 * side) * clamp(lumpLo + 1.05 * lump, lumpLo, 1.25);

  float cut = mix(mix(floorTone, wallTone, toWall), crestTone, toCrest);
  vec3 col = vCol * max(cut, 0.05);

  // Fade the tail off over its last quarter rather than linearly, so the line
  // stays crisp for most of its length and then dissolves.
  float life = smoothstep(0.0, 0.28, vAge);
  // The swath does not end on a ruled line. Each cell of thrown snow ends
  // where it ends, and a few land clear of the rest — which is the difference
  // between a cut with crumb around it and a rectangular slot milled into the
  // hill.
  float rim = 0.66 + 0.24 * chunk + 0.12 * fine;
  // The ribbon's own silhouette, antialiased. This was a hard cut, on a
  // transparent mesh, on a ragged boundary — so the outline crawled a pixel in
  // and out every frame all the way down the line, which is the second half of
  // what the player was seeing as jitter. The floor keeps a near-hard edge close
  // up where the ribbon is hundreds of pixels wide; the cap stops the far end
  // dissolving, where the honest answer would be to fade the whole thing out and
  // the reference's trench is still going strong at the top of the frame.
  float rw = clamp(fwidth(a) * 1.4, 0.045, 0.34);
  // THE RIBBON DOES NOT BEGIN ON A RULED LINE EITHER.
  //
  // The tail already dissolves over its last quarter, but the HEAD was a hard
  // cut: the newest sample is a straight quad edge across the full width, sat
  // directly under the board, so the trench started with a drawn line at right
  // angles to the travel. Reported as "really clear straight lines starting the
  // curve and the interaction with the board".
  //
  // Faded over the first metre and a bit out of the rider's own position rather
  // than by age -- the head sample is ALWAYS the newest, so age cannot tell
  // "at the board" from "just behind it", but distance can, and it is the
  // distance that the eye is objecting to.
  float head = smoothstep(0.35, 1.6, length(vWorld.xz - uHead.xz));
  float alpha = life * head * (1.0 - smoothstep(rim - rw, rim, aw));
  if (alpha <= 0.004) discard;

  float dy = vWorld.y - uCamPos.y;
  float t = uFogFalloff * dy;
  float k = abs(t) < 1e-4 ? 1.0 : (1.0 - exp(-t)) / t;
  // HALVED, exactly as the snow shader halves it. The two were out of step: the
  // ground under the trench faded at half this rate, so the trench dissolved
  // twice as fast as the snow it is cut into and was a third gone by mid-frame.
  // The reference's trench holds the same floor and the same berm at every row
  // from the rider to the bottom edge, which is what a cut in the ground does —
  // it is not a puff of spray hanging in the air.
  float f = uFogDensity * 0.5 * exp(-uFogFalloff * (uCamPos.y - uFogBase)) * dist * k;
  alpha *= exp(-max(f, 0.0));

  gl_FragColor = vec4(col, alpha);
}
`;

// ── the rider's shadow ───────────────────────────────────────────────────────
//
// Without one the rider floats, and no amount of work on the snow fixes it: a
// figure with nothing under it is a sprite pasted on a photograph. In the
// reference it is not a subtle touch either — it is the strongest dark shape in
// the near field, a hard streak measuring 0.40x the snow around it, raking away
// to the lower left and roughly four times the rider's own height long.
//
// It is the same problem this file already solves for the trench: put a decal on
// terrain that rolls, without z-fighting a depth buffer whose near and far
// planes are 1 and 1500. So it is solved the same way — a ribbon of vertices
// each pinned to `meshHeight` and raised by the SAME `LIFT` the trench uses.
// Nothing here reduces that bias or invents a second one; a feature on this mesh
// once failed to render at all on device and the margin that fixed it is not
// something to spend twice.
//
// What it is NOT: a shadow map, a stencil volume, or a darkening baked into the
// newest trail samples. The last of those was the tempting one and it is wrong
// on the geometry — the sun is 60 degrees off the fall line, so the shadow lies
// ACROSS the slope while the trail lies along it, and the two only coincide in
// the middle of a hard carve.
const SH_SEG = 8;               // rows along the shadow
const SH_LANES = [-1, 0, 1];    // left rim, spine, right rim
const SH_VPS = SH_LANES.length;
// The caster, as one number. A snowboarder in a riding crouch is about a metre
// and a half to the top of the helmet; the shadow is that over the tangent of
// the sun's elevation.
const SH_HEIGHT = 1.50;
// Elevation floor. At alpenglow the sun is at 5.7 degrees and still falling in
// the mixer's interpolation; without a clamp the shadow length goes to infinity
// as the elevation goes to zero.
const SH_MIN_TAN = 0.105;
// And a hard cap, which at first light is what actually binds.
//
// Measured off the reference rather than derived: its shadow spans about 3.6 m
// of lateral ground for a rider whose trench is 1.9 m wide at the same row, so
// the caster's own height over the tangent puts the sun there near 21 degrees.
// The mood's `uSunDir` is at 7.45, which is an art value picked for the sky and
// the terrain shading, and taken literally it gives a shadow eight times the
// rider's height — which was built, captured and thrown away. It is not a
// contact shadow at that length, it is a hairline scratch across the piste: a
// flat strip seen from a chase camera is foreshortened across its width and not
// along its length, so eight metres of length against half a metre of width
// arrives on screen as two hundred pixels by three. The reference's shadow is
// about nine to one and it reads as a body. This is capped to match it, and
// below the cap — bluebird, where the sun is at 26 degrees — the honest length
// is shorter than the cap anyway and the cap does nothing.
const SH_MAX_LEN = 5.5;
// Started slightly on the SUN side of the board rather than exactly under it.
// The whole ribbon rides a quarter metre above the snow, which at the chase
// camera's 24-degree depression shifts everything on it about half a metre
// toward the lens — harmless for a trench that is 200 m long and fatal for a
// contact patch, which has one job and it is to touch the board. Half a metre of
// overhang costs nothing and guarantees the overlap.
const SH_BACK = 0.45;
// The darkening at the core, as a fraction of whatever the snow under it turns
// out to be.
//
// This mesh emits BLACK and varies only its alpha, so the blend is a plain
// multiply on the framebuffer and the number below is the shadow's ratio to the
// snow, directly and exactly. That is not the obvious way to do it here — the
// trench beside it paints an absolute colour, a CPU bake of the snow shader's
// own lighting, for the reasons the long note further up sets out — and the
// first version of this shadow followed suit and came out INVISIBLE. Not faint:
// invisible, ratio 1.00 measured along every row of it. The snow's lighting was
// being re-solved in the same session by another hand, the CPU bake and the
// shader had drifted about six-fold apart, and the "darkened snow colour" the
// shadow was painting landed on snow that was already exactly that dark.
//
// A multiply cannot fail that way. It does not need to know what the snow is
// worth, only that the shadow is a fixed fraction of it — which is the one thing
// about a shadow that stays true whatever the sun is doing. The trench cannot be
// written this way: it has to go BRIGHTER than the snow as well as darker and no
// blend mode does both, which is the whole reason for the bake. A shadow only
// ever goes darker.
//
// 0.86 puts the core at 0.14x the snow around it in linear terms, which the tone
// curve lands near 0.4x on screen — the reference's shadow reads 63 against snow
// at 160. It has to be pushed that far because the shadow lies FLAT and the
// chase camera looks along it: a strip 0.8 m wide arrives as two or three
// pixels, and two or three pixels have to be decisively dark or the piste's own
// corduroy simply swallows them. Measured at 0.49x linear it did exactly that.
const SH_ALPHA = 0.72;

const SHADOW_VERT = /* glsl */ `
attribute float aV;
attribute float aT;
varying float vV;
varying float vT;
varying vec3 vWorld;
void main() {
  vV = aV;
  vT = aT;
  vWorld = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHADOW_FRAG = /* glsl */ `
precision highp float;
uniform vec3  uCamPos;
uniform float uStrength;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
varying float vV;
varying float vT;
varying vec3  vWorld;
` + HASH_GLSL + `
void main() {
  float a = abs(vV);
  // The snow it lands on is broken and the sun is not a point. Both show up as
  // the same thing — an edge that is neither straight nor sharp — and both grow
  // toward the tip: at eleven metres from the caster the penumbra of a half-
  // degree sun is already a tenth of a metre, which is most of the shadow's
  // width by then. So the contact patch is crisp and the far end is a smudge,
  // which is exactly what the reference does.
  a += (n21s(vWorld.xz * 3.7) - 0.5) * 0.18 * (0.30 + vT);
  // WAS 0.30 AT THE CONTACT END, and that is what made this read as a decal
  // rather than as a shadow. 0.30 of a half-width is a firm edge, and the near
  // rows are the WIDEST ones -- the contact width reaches 0.88 when the sun
  // rakes the board side-on, so the strip is 1.76 m across there. A shape that
  // wide with a firm
  // edge and a straight end is a sprite, and it was called one.
  //
  // The reasoning for a crisp contact patch is still right -- a shadow IS
  // sharpest where the caster meets the ground -- but "sharp" here was being
  // spent on the widest part of the strip rather than on the board's own
  // footprint, and the penumbra of a real sun over a metre of board is not
  // nothing.
  float soft = 0.55 + 0.45 * vT;
  // A flat strip seen from a chase camera is compressed across its width, and in
  // the low inspection framing it lands under two pixels thick. Left to the
  // rasteriser that came out as a dashed line — some pixel centres inside the
  // strip, some not — which reads as a row of dots and not as a shadow. Widening
  // the falloff to the ribbon's own screen footprint turns those dots into a
  // continuous line that is dimmer instead of broken, which is what a sub-pixel
  // shadow should be.
  float w = max(soft, fwidth(vV) * 1.4);
  float core = 1.0 - smoothstep(1.0 - w, 1.0, a);
  // Darkest at the board and gone by the head. The reference's shadow does not
  // taper gently, it holds and then stops, so the fade is squeezed into the last
  // third.
  // AND IT DOES NOT BEGIN ON A RULED LINE. The far end already stops over its
  // last third; the near end had nothing, so the first row -- 0.45 m behind the
  // contact point, at full alpha, straight across the full width -- was a drawn
  // line with aliasing crawling along it. The same fault the trench's head had,
  // in the same frame, for the same reason: a strip that starts abruptly.
  float along = (0.84 + 0.16 * (1.0 - smoothstep(0.0, 0.22, vT)))
              * (1.0 - smoothstep(0.68, 1.0, vT))
              * smoothstep(0.0, 0.09, vT);
  float alpha = uStrength * core * along;
  if (alpha <= 0.004) discard;

  float dist = length(vWorld - uCamPos);
  float dy = vWorld.y - uCamPos.y;
  float t = uFogFalloff * dy;
  float k = abs(t) < 1e-4 ? 1.0 : (1.0 - exp(-t)) / t;
  float f = uFogDensity * 0.5 * exp(-uFogFalloff * (uCamPos.y - uFogBase)) * dist * k;
  alpha *= exp(-max(f, 0.0));

  // Black, so the blend is a multiply and the alpha IS the ratio to the snow.
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

export class Trail {
  constructor(scene, mood) {
    this.samples = [];
    this.lastX = 0;
    this.lastZ = 0;
    this.mood = mood;
    this._scene = scene;
    // The newest sample is LIVE: rewritten at the board's position every frame
    // until it is a full step from the last frozen one, then frozen in place and
    // a new live one started behind the board. Without it the ribbon's tip stood
    // still while the rider ran on, so the gap between board and trail grew from
    // nothing to 0.85 m and snapped back — at riding speed, fourteen times a
    // second. That sawtooth, an arm's length in front of the player's eye, is
    // most of "it is jittery next to the rider".
    this._live = false;
    // Ground covered without cutting anything, and the clearance while doing it.
    this._gapDist = 0;
    this._gapLift = 0;
    this._prevX = 0;
    this._prevZ = 0;
    this._have = false;
    // Arc length down the cut, in metres, for the transverse chatter.
    this._along = 0;
    this._snowTries = 0;

    this.position = new Float32Array(CAPACITY * VPS * 3);
    this.aV = new Float32Array(CAPACITY * VPS);
    this.aAge = new Float32Array(CAPACITY * VPS);
    this.aSide = new Float32Array(CAPACITY * VPS);
    this.aAlong = new Float32Array(CAPACITY * VPS);
    this.aCol = new Float32Array(CAPACITY * VPS * 3);
    this._grad = { gx: 0, gz: 0 };
    this._shGrad = { gx: 0, gz: 0 };

    // Four vertices across, not two. The two extra lanes sit at the floor's
    // edge, so the berm is a raised strip of its own with real parallax against
    // the floor instead of a bright band painted onto one flat quad. 880
    // vertices and 1314 triangles for the whole line — the cost is nothing and
    // it is the difference between snow lying on the hill and a decal.
    //
    // aV never changes, so it is written once here rather than re-uploaded
    // every frame along with everything else.
    for (let i = 0; i < CAPACITY; i++) {
      for (let k = 0; k < VPS; k++) this.aV[i * VPS + k] = LANES[k];
    }

    // Wound so the ribbon FACES UP. Lanes run left to right across the travel
    // direction, and (heading × right) points into the ground — the first
    // winding put the front face down and the camera, always above the snow,
    // saw only the culled back. The trail was never once visible; every colour
    // and lift tweak before this was tuning an unrendered mesh.
    const index = new Uint16Array((CAPACITY - 1) * (VPS - 1) * 6);
    for (let i = 0, o = 0; i < CAPACITY - 1; i++) {
      for (let k = 0; k < VPS - 1; k++) {
        const a0 = i * VPS + k;
        const a1 = a0 + 1;
        const b0 = a0 + VPS;
        const b1 = b0 + 1;
        index[o++] = a0; index[o++] = a1; index[o++] = b0;
        index[o++] = a1; index[o++] = b1; index[o++] = b0;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    this.geometry.setAttribute('aV', new THREE.BufferAttribute(this.aV, 1));
    this.geometry.setAttribute('aAge', new THREE.BufferAttribute(this.aAge, 1));
    this.geometry.setAttribute('aSide', new THREE.BufferAttribute(this.aSide, 1));
    this.geometry.setAttribute('aAlong', new THREE.BufferAttribute(this.aAlong, 1));
    this.geometry.setAttribute('aCol', new THREE.BufferAttribute(this.aCol, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCamPos: { value: new THREE.Vector3() },
        /** The rider, so the ribbon can fade in under the board. */
        uHead: { value: new THREE.Vector3() },
        uFogDensity: { value: 0.0056 },
        uFogFalloff: { value: 0.012 },
        uFogBase: { value: 0 },
      },
    });
    mood.bind(this.material.uniforms);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);

    // ── shadow ────────────────────────────────────────────────────────────
    // Twenty-seven vertices and thirty-two triangles, rebuilt whole every frame.
    // Nine rows over six metres is a row every three quarters of a metre — a
    // little tighter than the trail's 0.85 m, because the shadow is a straight
    // line drawn across the slope rather than a track that already follows the
    // ground, and a roller between two rows would put the ribbon into the snow.
    this.shPos = new Float32Array((SH_SEG + 1) * SH_VPS * 3);
    const shV = new Float32Array((SH_SEG + 1) * SH_VPS);
    this.shT = new Float32Array((SH_SEG + 1) * SH_VPS);
    for (let i = 0; i <= SH_SEG; i++) {
      for (let k = 0; k < SH_VPS; k++) shV[i * SH_VPS + k] = SH_LANES[k];
    }
    const shIndex = new Uint16Array(SH_SEG * (SH_VPS - 1) * 6);
    for (let i = 0, o = 0; i < SH_SEG; i++) {
      for (let k = 0; k < SH_VPS - 1; k++) {
        const a0 = i * SH_VPS + k;
        const a1 = a0 + 1;
        const b0 = a0 + SH_VPS;
        const b1 = b0 + 1;
        shIndex[o++] = a0; shIndex[o++] = a1; shIndex[o++] = b0;
        shIndex[o++] = a1; shIndex[o++] = b1; shIndex[o++] = b0;
      }
    }
    this.shGeometry = new THREE.BufferGeometry();
    this.shGeometry.setAttribute('position', new THREE.BufferAttribute(this.shPos, 3));
    this.shGeometry.setAttribute('aV', new THREE.BufferAttribute(shV, 1));
    this.shGeometry.setAttribute('aT', new THREE.BufferAttribute(this.shT, 1));
    this.shGeometry.setIndex(new THREE.BufferAttribute(shIndex, 1));
    this.shGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.shMaterial = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCamPos: { value: new THREE.Vector3() },
        uStrength: { value: 0 },
        uFogDensity: { value: 0.0056 },
        uFogFalloff: { value: 0.012 },
        uFogBase: { value: 0 },
      },
    });
    mood.bind(this.shMaterial.uniforms);

    this.shMesh = new THREE.Mesh(this.shGeometry, this.shMaterial);
    this.shMesh.frustumCulled = false;
    // UNDER the trench, over the snow. The two overlap only in the metre either
    // side of the board, and where they do the trench has to win: a cut in the
    // snow is a change of surface and the shadow is a change of light on one, so
    // painting the shadow's flat tone over the berm would delete it.
    // ── THE SHADOW DRAWS OVER THE TRAIL ────────────────────────────────
    // It used to be 1 against the trail's 2, so the trail painted over it.
    // Both of these are transparent with `depthWrite: false`, which means
    // neither leaves anything in the depth buffer for the other to test
    // against -- between the two of them the render order IS the answer, and
    // it was the wrong way round. The board's own shadow was underneath the
    // spray it throws, which is what made half the snowboard disappear into it.
    //
    // Above the trail (2), and still below anything opaque: the board writes
    // depth, so where the board is in front the shadow is still rejected. The
    // stack ends up board, then shadow, then trail, which is the order they
    // exist in.
    this.shMesh.renderOrder = 3;
    this.shMesh.visible = false;
    scene.add(this.shMesh);
  }

  clear() {
    this.samples.length = 0;
    this._live = false;
    this._gapDist = 0;
    this._gapLift = 0;
    this._have = false;
    this._along = 0;
    this.aAge.fill(0);
    this.geometry.attributes.aAge.needsUpdate = true;
    this.shMesh.visible = false;
  }

  /**
   * The snow shader's own light gate, borrowed rather than copied.
   *
   * `MountainMesh` derives two numbers every frame — where the sun currently
   * clears the range ringing the valley (uSunFloor, as metres above the fall
   * line) and what a level piste would take if the beam did reach it (uSunFlat)
   * — and they are the difference between "first light" and "mid-morning" for
   * every pixel of snow on screen. They are computed from `uSunDir`, which this
   * file also has, but from two constants that live in `mountain.js` and are not
   * exported; mirroring them here is exactly how the previous bake drifted
   * six-fold out of step with the surface it is painted on. So they are read off
   * the live material instead, found once by the pair of uniforms only the snow
   * shader carries, and the answer can never disagree with the ground.
   */
  _snowUniforms() {
    if (this._snowU) return this._snowU;
    // Bounded. The mountain is built before the trail and its chunks are in the
    // scene by the first frame, so this finds it immediately in practice — but a
    // full scene traverse every frame for ever is not a cost to leave lying
    // around if it ever stops finding one. Four seconds of trying, then the
    // shader's own ungated behaviour, which is what bluebird and squall run
    // anyway.
    if (this._snowTries > 240) return null;
    this._snowTries++;
    let found = null;
    this._scene.traverse((o) => {
      const u = o.material && o.material.uniforms;
      if (!found && u && u.uSunFlat && u.uSunFloor && u.uSparkle) found = u;
    });
    if (found) this._snowU = found;
    return found;
  }

  /**
   * The snow shader's lighting, in miniature, for one point.
   *
   * THIS FUNCTION IS THE TRENCH'S ENTIRE TONE. The mesh paints an absolute
   * colour rather than blending with the framebuffer, so every ratio the shader
   * claims to hit — floor at a third of the snow, crest at 1.35x — is a ratio
   * against whatever comes out of here. When this drifts, the whole trench
   * drifts with it, and nothing in the shader can tell.
   *
   * It had drifted, badly. The snow gained an ALTITUDE GATE on direct light:
   * `first light` now means the sun is up on the summits and has not reached the
   * valley, so the floor of the run takes no beam at all and is lit by the sky
   * dome alone — irradiance `uSunFlat * dome^16` instead of `pow(wrap, 1.25)`.
   * This bake kept handing out the full beam, which at the canonical frame is
   * about six times what the ground beside it receives. Everything downstream
   * inherited that: the floor of the cut came out BRIGHTER than the piste and
   * the berms went off the top of the tone curve, so the mark read as a strip of
   * white rubble with a hairline down the middle instead of as a cut.
   *
   * So the gate is not re-derived here, it is READ (see `_snowUniforms`), and
   * the fallback when the material cannot be found is `sunHi = 1`, which is the
   * shader's own behaviour for the whole of bluebird and squall.
   *
   * What is deliberately left out is the sheen — a grazing term the snow adds on
   * top of albedo, worth up to about 0.2 of the sun colour where the piste peaks.
   * It is a function of the view direction, so honouring it would mean rebaking
   * every sample in the ribbon every time the camera moved. The trench therefore
   * sits a few per cent under the snow at the bottom of the frame and dead on it
   * everywhere else, and the cut constants are calibrated against the surface as
   * it actually renders, not against this function in isolation.
   *
   * @param {number} vis marched sun visibility at (x, z), computed once a frame
   */
  _litSnow(x, z, terrain, vis, out) {
    const m = this.mood;
    const g = terrain.gradient(x, z, this._grad);
    const inv = 1 / Math.sqrt(g.gx * g.gx + g.gz * g.gz + 1);
    const ny = inv;
    const L = m.uSunDir;
    // N·L with N = (-gx, 1, -gz) / |...|.
    const ndl = (-g.gx * L.x + L.y - g.gz * L.z) * inv;
    // Wrap width and shadow floor are the snow shader's, not this file's own.
    const wrap = Math.min(1, Math.max(0, (ndl + 0.35) / 1.35));
    const shade = 0.26 + 0.74 * vis;
    const dome = 0.5 + 0.5 * ny;
    const d2 = dome * dome;
    const d4 = d2 * d2;
    const d8 = d4 * d4;
    const sky16 = d8 * d8;
    const u = this._snowUniforms();
    let sunHi = 1;
    let flat = 1;
    if (u) {
      // smoothstep(uSunFloor - 30, uSunFloor + 30, altitude above the fall line)
      const alt = terrain.height(x, z) - terrain.baseHeight(-z);
      const t = Math.min(1, Math.max(0, (alt - (u.uSunFloor.value - 30)) / 60));
      sunHi = t * t * (3 - 2 * t);
      flat = u.uSunFlat.value;
    }
    const irr = (1 - sunHi) * flat * sky16 + sunHi * Math.pow(wrap, 1.25);
    const direct = irr * shade;
    const hemi = ny * 0.5 + 0.5;
    const sun = m.uSunColor;
    const sky = m.uSkyColor;
    const ground = m.uGroundColor;
    const snow = m.uSnowColor;
    out[0] = snow.r * (sun.r * direct + ground.r + (sky.r - ground.r) * hemi);
    out[1] = snow.g * (sun.g * direct + ground.g + (sky.g - ground.g) * hemi);
    out[2] = snow.b * (sun.b * direct + ground.b + (sky.b - ground.b) * hemi);
    return out;
  }

  /**
   * Lay the rider's cast shadow on the snow.
   *
   * A ribbon from under the board, along the sun's horizontal bearing REVERSED,
   * one rider-height over the tangent of the sun's elevation long. That is the
   * whole model: no shadow map, no second camera, no depth pass. It is right for
   * the one caster that matters, and the one caster that matters is the only
   * thing on screen the player is looking at.
   *
   * Everything about it moves with the mood, because everything about it is
   * derived from `uSunDir`: it swings round the rider as the sun climbs through
   * the run and it shortens from eleven metres at first light to three at
   * bluebird, without a constant anywhere that says which way "lower left" is.
   *
   * @param {import('./rider.js').Rider} rider
   * @param {number} ground terrain height under the board
   * @param {number} vis marched sun visibility there — shared with the bake, so
   *   the two never disagree and the march is walked once a frame, not twice
   */
  _shadow(rider, terrain, ground, vis) {
    const L = this.mood.uSunDir;
    const horiz = Math.hypot(L.x, L.z) || 1e-6;
    // AWAY from the sun, on the ground plane.
    const dx = -L.x / horiz;
    const dz = -L.z / horiz;
    const tanEl = Math.max(L.y / horiz, SH_MIN_TAN);
    const px = -dz;
    const pz = dx;

    // In the air the shadow detaches and runs off downwind of the sun, which is
    // the oldest height cue in the medium and costs one subtraction. It also
    // spreads and weakens, because a caster ten metres off the deck against a
    // half-degree sun has a penumbra as wide as it is.
    const air = Math.max(0, rider.y - ground);
    const sx = rider.x + dx * (air / tanEl);
    const sz = rider.z + dz * (air / tanEl);
    const len = Math.min(SH_HEIGHT / tanEl, SH_MAX_LEN);

    // The contact patch is the board's own footprint measured ACROSS the shadow,
    // so it is wide when the sun rakes the board side-on and narrow when it
    // looks down its length — and it swaps between the two as the rider carves,
    // for the cost of two dot products a frame.
    const hh = Math.hypot(rider.heading.x, rider.heading.z) || 1;
    const rh = Math.hypot(rider.right.x, rider.right.z) || 1;
    const bl = Math.abs((rider.heading.x * px + rider.heading.z * pz) / hh);
    const bw = Math.abs((rider.right.x * px + rider.right.z * pz) / rh);
    const w0 = 0.16 + 0.72 * bl + 0.20 * bw;

    // meshHeight is 2.5 microseconds a call — four height-field evaluations
    // and a binary search over the column table — so twenty-seven of them a
    // frame is real money on a phone. The SPINE is sampled properly, nine times
    // down the length where the ground genuinely rolls; the two rims sit at most
    // half a metre either side of it and take the local cross-slope instead, one
    // gradient for the whole ribbon. Over that distance the gap between the true
    // surface and its tangent plane is millimetres, against a lift of a quarter
    // of a metre. Nine calls, not twenty-seven.
    const g = terrain.gradient(rider.x, rider.z, this._shGrad);
    const perpSlope = g.gx * px + g.gz * pz;

    const span = len + SH_BACK;
    for (let i = 0; i <= SH_SEG; i++) {
      const s = (i / SH_SEG) * span - SH_BACK;
      const t = Math.min(1, Math.max(0, s / len));
      // Board, then legs, then a torso that is barely wider, then a head. The
      // silhouette of a crouched rider is very nearly a bar, and drawing it as a
      // long taper is what makes a bad shadow look like a comet.
      const body = 0.44 - 0.22 * t;
      const k = Math.min(1, t / 0.14);
      const w = w0 * (1 - k) + body * k + air * 0.05;
      const cx = sx + dx * s;
      const cz = sz + dz * s;
      const cy = meshHeight(terrain, cx, cz) + SH_LIFT;
      for (let j = 0; j < SH_VPS; j++) {
        const v = SH_LANES[j];
        const o = (i * SH_VPS + j) * 3;
        this.shPos[o] = cx + px * w * v;
        this.shPos[o + 1] = cy + perpSlope * w * v;
        this.shPos[o + 2] = cz + pz * w * v;
        this.shT[i * SH_VPS + j] = t;
      }
    }

    // Less direct light here, less shadow — but never none. The same marched
    // terrain shadow the trench's colour bake uses, so the rider's cast shadow
    // weakens on exactly the pixel where the snow around it goes into a ridge's
    // shade. It does not vanish there, and the floor is deliberate: with the
    // long 250 m terrain shadows now in the march, a good part of the piste sits
    // at a visibility of a quarter — the canonical vista frame measures 0.24 —
    // and a rider who loses their shadow at every shadow boundary starts
    // floating again on half the run. What survives at the floor is a contact
    // patch: blocked SKY, which is there whether or not the sun is, and which
    // the snow shader's own 0.24 floor on the same term is the mirror of.
    const fade = 1 / (1 + air * 0.16);
    const u = this.shMaterial.uniforms;
    u.uStrength.value = SH_ALPHA * (0.72 + 0.28 * vis) * fade;
    // These two are pushed onto the trail's material from main.js, which knows
    // nothing about a second mesh. Copied rather than re-derived, so the shadow
    // can never disagree with the trench about where the camera is.
    u.uCamPos.value.copy(this.material.uniforms.uCamPos.value);
    u.uFogBase.value = this.material.uniforms.uFogBase.value;
    this.shGeometry.attributes.position.needsUpdate = true;
    this.shGeometry.attributes.aT.needsUpdate = true;
    this.shMesh.visible = u.uStrength.value > 0.01;
  }

  /**
   * Write one sample of ribbon at the board's current position.
   *
   * Reused rather than allocated: the LIVE tip is rewritten in place every
   * frame, so a fresh Float32Array per frame would be sixty allocations a
   * second for nothing.
   */
  _writeSample(s, rider, terrain, vis) {
    // A committed carve cuts a narrow groove; a skid smears one. Board scale,
    // not road scale: at the old 0.45 + 0.55 the "groove" ran two metres wide
    // behind a straight-running 25 cm board.
    //
    // But this is the whole DISTURBED swath, not just the slot — the slot is the
    // middle of it and the rest is what came out. The ragged rim keeps about
    // 0.8 of the half-width, so these land near 1.4 m across for a committed
    // carve and 1.9 m for a board running flat, which is what the reference
    // measures. The readout is stronger than it was, not weaker: a locked edge
    // cuts a swath three quarters the width of a flat one and under half a
    // skid's.
    const edge = Math.abs(rider.edge);
    // NARROWED BY 30%. The widths below were measured off reference footage of
    // a real carve and they are honest about a DISTURBED SWATH -- the slot plus
    // everything thrown out of it. On this camera that read as a road: too wide
    // for the board standing on it, and wide enough that the crest was arriving
    // where the board is rather than out at the rim. Asked for directly. The
    // shape of the falloff is untouched, so a locked edge still cuts a narrower
    // swath than a flat board and a skid is still the widest of the three.
    const w = (0.74 + (1 - edge) * 0.26 + Math.abs(rider.slip) * 0.85) * TRAIL_WIDTH;
    const rx = rider.right.x;
    const rz = rider.right.z;
    // Which way the sun lies across the board. Baked, because the shader has no
    // sun and the answer is the same for every pixel of a sample.
    const L = this.mood.uSunDir;
    const sl = Math.hypot(L.x, L.z) || 1;
    s.side = (L.x * rx + L.z * rz) / sl;
    const p = s.p;
    for (let k = 0; k < VPS; k++) {
      const v = LANES[k];
      const px = rider.x + rx * w * v;
      const pz = rider.z + rz * w * v;
      p[k * 3] = px;
      p[k * 3 + 2] = pz;
      // The outer rim carries the crest, so it rides BERM higher than the
      // floor — and therefore higher above the snow than the lift alone.
      p[k * 3 + 1] = meshHeight(terrain, px, pz) + LIFT
        + BERM * Math.max(0, (Math.abs(v) - FLOOR_V) / (1 - FLOOR_V));
    }
    this._litSnow(rider.x, rider.z, terrain, vis, s.col);
    return s;
  }

  /** A blank sample, ready for `_writeSample`. */
  _blank(age) {
    return { age, side: 0, along: this._along, p: new Float32Array(VPS * 3), col: [1, 1, 1] };
  }

  /** Stop tracking the board with the newest sample and leave it where it is. */
  _freeze() {
    this._live = false;
    if (this._along > ARC_WRAP) {
      this._along -= ARC_WRAP;
      for (const s of this.samples) s.along -= ARC_WRAP;
    }
    const t = this.samples[this.samples.length - 1];
    if (!t) return;
    // The two inner lanes are symmetric about the board, so their mean is the
    // point the sample was laid from, whatever the swath width was.
    const a = (VPS >> 1) - 1;
    const b = VPS >> 1;
    this.lastX = (t.p[a * 3] + t.p[b * 3]) * 0.5;
    this.lastZ = (t.p[a * 3 + 2] + t.p[b * 3 + 2]) * 0.5;
    this._along = t.along;
  }

  /**
   * End the ribbon here and start it again there, with NOTHING drawn between.
   *
   * The ribbon is one strip of quads over a fixed index buffer, so a stretch of
   * it cannot simply be skipped — every consecutive pair of samples is a quad
   * whether anything happened between them or not. What CAN be done is to make
   * one chosen quad contribute no pixels, and the alpha already has the hook:
   * `life` is smoothstep(0, 0.28, age), so a quad carrying age 0 at BOTH ends is
   * zero across its whole interior and is discarded — exactly, with no
   * interpolation left to get wrong.
   *
   * So a break is two dead samples: one on top of the last live sample, one on
   * the first of the new run. The quad between the two dead ones spans the gap
   * and draws nothing; the quads either side of them are degenerate, because
   * each dead sample shares its position with its live neighbour. Two slots out
   * of two hundred and twenty per flight.
   *
   * What was here before instead pulled the last sample's age down to 0.02 and
   * left it at that. That kills one END of the bridging quad and leaves the
   * other at full opacity, so on landing a wedge of trail faded in across the
   * whole thirty metres the rider had just flown over — trail laid where the
   * board had never been, appearing all at once at the moment of touchdown.
   * That is exactly what the player reported.
   */
  _breakRibbon(rider, terrain, vis) {
    const n = this.samples.length;
    if (!n) return;
    const prev = this.samples[n - 1];
    const tail = this._blank(0);
    tail.p.set(prev.p);
    tail.side = prev.side;
    tail.col[0] = prev.col[0];
    tail.col[1] = prev.col[1];
    tail.col[2] = prev.col[2];
    tail.along = prev.along;
    this.samples.push(tail);
    // The far side of the gap, at the board. Its age is 0 too, so the quad
    // between the two is dead at both ends; the new run then fades up over its
    // first step, which is a landing settling rather than an edge switched on.
    const head = this._blank(0);
    this._writeSample(head, rider, terrain, vis);
    head.along = this._along;
    this.samples.push(head);
  }

  /** @param {import('./rider.js').Rider} rider */
  update(dt, rider, terrain) {
    for (const s of this.samples) s.age -= dt * 0.105;
    while (this.samples.length && this.samples[0].age <= 0) this.samples.shift();

    // One march of the height field a frame, shared by the colour bake and the
    // cast shadow. Both used to walk it separately, for the same point.
    const ground = terrain.height(rider.x, rider.z);
    const vis = sunVisibility(terrain, rider.x, rider.z, ground, this.mood.uSunDir);

    if (!this._have) { this._prevX = rider.x; this._prevZ = rider.z; this._have = true; }
    const stepped = Math.hypot(rider.x - this._prevX, rider.z - this._prevZ);
    this._prevX = rider.x;
    this._prevZ = rider.z;

    const down = !rider.airborne && rider.crashTimer <= 0;
    if (!down) {
      // Nothing is being cut. Freeze the tip where the board left the snow and
      // start counting the ground it covers without touching it.
      if (this._live) this._freeze();
      this._gapDist += stepped;
      this._gapLift = Math.max(this._gapLift, rider.y - ground);
      // A crash is not a cut either, whatever the board's clearance says.
      if (rider.crashTimer > 0) this._gapLift = Math.max(this._gapLift, AIR_LIFT * 2);
    } else if (this.samples.length === 0) {
      this._along = 0;
      this.samples.push(this._writeSample(this._blank(1), rider, terrain, vis));
      this.lastX = rider.x;
      this.lastZ = rider.z;
      this._live = true;
      this._gapDist = 0;
      this._gapLift = 0;
    } else {
      const moved = Math.hypot(rider.x - this.lastX, rider.z - this.lastZ);
      // Two independent reasons the ribbon may not be continued from where it
      // stopped: the board was genuinely off the snow for a stretch of hill, or
      // it was MOVED rather than driven — a QA seek, a respawn, anything that
      // relocates the rider without taking them through the world. Either would
      // otherwise be drawn as one straight quad over ground nobody rode.
      const flew = this._gapDist > AIR_GAP && this._gapLift > AIR_LIFT;
      if (flew || stepped > JUMP_CUT) {
        this._along += Math.max(this._gapDist, stepped);
        this._breakRibbon(rider, terrain, vis);
        this.lastX = rider.x;
        this.lastZ = rider.z;
        this._live = false;
      } else if (this._live) {
        // The tip tracks the board. This is the whole of the fix for the trail
        // jittering next to the rider: the ribbon reaches the board on every
        // frame now, instead of standing still for a step and then jumping
        // 0.85 m forward — a sawtooth that ran at fourteen hertz at riding
        // speed, an arm's length in front of the player's eye.
        const tip = this.samples[this.samples.length - 1];
        this._writeSample(tip, rider, terrain, vis);
        tip.age = 1;
        tip.along = this._along + moved;
        if (moved >= STEP) this._freeze();
      } else {
        const s = this._writeSample(this._blank(1), rider, terrain, vis);
        s.along = this._along + moved;
        this.samples.push(s);
        this._live = true;
      }
      this._gapDist = 0;
      this._gapLift = 0;
    }
    while (this.samples.length > CAPACITY) this.samples.shift();

    // Every frame, not every 0.85 m: the trench is laid down and left alone, the
    // shadow moves with the rider.
    this._shadow(rider, terrain, ground, vis);
    this.material.uniforms.uHead.value.set(rider.x, rider.y, rider.z);

    const n = this.samples.length;
    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      const o = i * VPS * 3;
      const j = i * VPS;
      this.position.set(s.p, o);
      // Applied HERE rather than in `_writeSample`, because a sample's `p` is
      // its frozen world position — the trail is laid down and left alone, and
      // baking the duck in would leave a permanent dip three metres behind the
      // rider for the rest of the run. Done on upload, the dip travels with the
      // board and every sample settles to its true height once it is past.
      const back = n - 1 - i;
      if (back < DUCK_SAMPLES) {
        const drop = DUCK * (1 - back / DUCK_SAMPLES);
        for (let k = 0; k < VPS; k++) this.position[o + k * 3 + 1] = s.p[k * 3 + 1] - drop;
      }
      for (let k = 0; k < VPS; k++) {
        this.aAge[j + k] = s.age;
        this.aSide[j + k] = s.side;
        this.aAlong[j + k] = s.along;
        this.aCol[o + k * 3] = s.col[0];
        this.aCol[o + k * 3 + 1] = s.col[1];
        this.aCol[o + k * 3 + 2] = s.col[2];
      }
    }
    // Everything past the live samples is outside the draw range, so it needs
    // no clearing — the ages beyond it were the only thing keeping stale
    // vertices from being drawn, and setDrawRange already does that job.
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aAge.needsUpdate = true;
    this.geometry.attributes.aSide.needsUpdate = true;
    this.geometry.attributes.aAlong.needsUpdate = true;
    this.geometry.attributes.aCol.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, n - 1) * (VPS - 1) * 6);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.shGeometry.dispose();
    this.shMaterial.dispose();
  }
}
