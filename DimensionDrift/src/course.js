// The course: slalom gates on the beat, and kickers on the big hits.
//
// THE PROBLEM THIS SOLVES. Every other music game in this app drives the world
// from the audio clock — position is a function of track time, so a hazard
// charted on a beat necessarily arrives on that beat. That trick is unavailable
// here, because speed is the entire game: if the mountain moved past at a rate
// the music dictated, carving across the fall line would cost nothing and the
// central decision would evaporate.
//
// So the dependency is inverted. The rider's speed is genuinely their own, and
// gates are placed PREDICTIVELY: about four seconds before a chosen beat lands,
// the course asks where the rider will be by then and puts the gate there. Over
// a four second horizon a rider's pace varies by maybe fifteen percent, which
// lands the gate within a couple of metres — a fraction of a beat. Gates fall on
// the music, and nothing about the physics had to be faked to get there.
//
// Kickers are different: the terrain has to contain them, and terrain is built
// hundreds of metres ahead of the rider, long before a prediction would be worth
// anything. They are placed once at boot from a reference run down the mountain,
// so they land near their musical accent rather than exactly on it. For a jump,
// near is indistinguishable from exact.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLitMaterial } from './lit.js';
import { HALF, meshHeight } from './mountain.js';
import { TUNE } from './rider.js';
import { mulberry32, range, clamp } from './rng.js';

const GATE_POOL = 12;
// Half the opening. Widened after hardware: this is a body leaning on a board
// through a third of a second of smoothing, not a thumbstick, and a nine metre
// gate at 90 km/h is still a real ask.
const GATE_HALF = 4.5;
/**
 * A boost gate's half width. WIDER THAN A SLALOM GATE, because it is a reward
 * rather than a test: the slalom asks whether you can hold a line, and a boost
 * gate asks only whether you wanted it. A reward you can miss by 20 cm is a
 * second test wearing a different colour.
 */
const BOOST_HALF = 6.4;
// Was 3.5 s -- about 80 m, and the difference was REPORTED: "the gates appear
// as I am closer to them while the motes are presented much before." The motes
// are planted with the terrain bands hundreds of metres out; gates at 80 m pop
// into an empty hill. Eleven seconds is ~240 m at chill's pace -- inside
// VISIBLE_AHEAD and the haze, so they emerge like the trees do, there "from
// the start". (The race already ran its own 9 s lead for the same reason.)
// Safe now that gates are planted once and never chase a prediction: a long
// lead costs spacing accuracy at spawn, not ten seconds of visible drift.
const SPAWN_LEAD = 11;          // seconds of warning a gate is placed with
/** Exported so a mode that raises `Course.spawnLead` can put it back. */
export const SPAWN_LEAD_DEFAULT = SPAWN_LEAD;
const DESPAWN_BEHIND = 25;      // metres past the rider before a gate is recycled
const VISIBLE_AHEAD = 280;      // gates further than this are inside the fog anyway
// Only a backstop against two gates landing on top of each other after a bad
// prediction. It MUST stay below the tightest legitimate spacing — four beats at
// the slowest survivable pace, about 22 m — or it silently pushes gates late and
// the error accumulates across every tight passage in the run.
const MIN_GATE_GAP = 14;

// LOCK_LEAD / CORRECT_RATE / LAT_RATE are gone with the per-frame gate
// refinement loop (see the note in update): gates are planted once and stand
// still. The spawn-time predictor below is all the prediction carve keeps.

const LEAD_IN_SEC = 5.0;        // no gates until the rider is up to speed

/**
 * The fraction of its speed a competent rider spends going down the mountain
 * rather than across it. Used by the reference run to integrate a pace, and by
 * the course to read a predicted DESCENT rate back as a speed along the board —
 * which is the quantity `maxSwing` wants.
 */
const REF_TRAVERSE = 0.86;
/** Edge fraction a gate's width is sized against — a committed but not maximal turn. */
const SWING_EDGE = 0.80;
/**
 * Amplitude as a fraction of the achievable swing. HALF, because consecutive
 * gates alternate sides and the distance actually demanded between two of them
 * is the sum of their amplitudes — with a third held back as margin.
 */
const AMP_FRAC = 0.34;
/** Below this a gate is not a slalom, it is a marker on the racing line. */
const AMP_MIN = 3.0;

/**
 * A competent run down the mountain, integrated once at boot.
 *
 * Used for three things that all need to know where a rider will be before one
 * exists: where to cut the kickers, how wide the gates at a given moment can
 * afford to be, and what a good score is worth.
 */
export class ReferenceRun {
  constructor(terrain, durationSec) {
    this.terrain = terrain;
    this.dt = 0.05;
    this.p = [0];
    this.v = [12];
    // The integrator's live state, kept so the table can be GROWN rather than
    // rebuilt. An endless descent asks for reference times without bound, and
    // re-integrating from p=0 on every lap is both wasteful and — because the
    // table is the definition of "where a competent rider is at time t" — the
    // one thing that must never give two different answers for the same t.
    this._p = 0;
    this._v = 12;
    this.totalDistance = 0;
    this.extendTo(durationSec);
  }

  /**
   * Integrate forward until the table covers `seconds`, and no further.
   *
   * Called from `pAt`/`vAt`, so no caller has to remember to do it. The length
   * check in front is a single comparison; the loop only ever runs on the frame
   * a new lap is planned, which is once every few minutes.
   */
  extendTo(seconds) {
    const want = Math.ceil(Math.max(0, seconds) / this.dt) + 2;
    if (want <= this.p.length) return;
    // A competent rider is not pointing straight down the hill: they hold an
    // edge and give up some of the fall line for control. These two numbers are
    // what "competent" means here.
    const TRAVERSE = REF_TRAVERSE;
    const AVG_EDGE = 0.45;
    const terrain = this.terrain;
    let p = this._p;
    let v = this._v;
    for (let i = this.p.length; i < want; i++) {
      const slope = terrain.slopeAt(p) * TRAVERSE;
      const sec = Math.sqrt(1 + slope * slope);
      let a = TUNE.gravity * slope / sec;
      a -= TUNE.drag * v * v;
      a -= TUNE.baseFric * v;
      a -= TUNE.edgeFric * AVG_EDGE * v;
      v = clamp(v + a * this.dt, TUNE.minSpeed, TUNE.maxSpeed);
      p += v * TRAVERSE * this.dt;
      this.p.push(p);
      this.v.push(v);
    }
    this._p = p;
    this._v = v;
    this.totalDistance = p;
  }

  pAt(t) {
    this.extendTo(t + 1);
    const i = clamp(Math.floor(t / this.dt), 0, this.p.length - 1);
    return this.p[i];
  }

  vAt(t) {
    this.extendTo(t + 1);
    const i = clamp(Math.floor(t / this.dt), 0, this.v.length - 1);
    return this.v[i];
  }
}

/**
 * The widest lateral swing a rider can link inside `seconds`.
 *
 * A real linked turn is three phases, not one arc: turn in to a traverse angle,
 * hold it, turn out again. Modelling it as a single arc let the maths reach for
 * traverse angles of eighty-six degrees — past the heading clamp the board now
 * enforces, and far past anything a rider would use, because at that angle the
 * rate of descent has collapsed and you have stopped going down the mountain.
 * Gates sized against that were simply not reachable, whatever the controller.
 *
 * The turning phases contribute 2R(1 - cos PHI) between them; whatever time is
 * left is spent traversing at v*sin(PHI).
 */
const PHI = 0.75;   // radians — about 43 degrees, the steepest USEFUL traverse

export function maxSwing(v, seconds, edgeFrac = 0.8) {
  const omega = edgeFrac * (TUNE.turnBase + v * TUNE.turnV);
  if (omega <= 1e-4) return 0;
  const R = v / omega;
  const turnTime = 2 * PHI / omega;
  if (seconds <= turnTime) {
    const phi = Math.min(PHI, (omega * seconds) / 2);
    return 2 * R * (1 - Math.cos(phi));
  }
  return 2 * R * (1 - Math.cos(PHI)) + v * Math.sin(PHI) * (seconds - turnTime);
}

/** Normalised energy of the track at a time, in [0,1]. */
function energyCurve(grid) {
  const e = grid.energy ?? [];
  let max = 1e-6;
  for (const v of e) max = Math.max(max, v);
  const hop = grid.energyHopSec || 0.25;
  return (t) => {
    if (!e.length) return 0.5;
    const i = clamp(Math.round(t / hop), 0, e.length - 1);
    return e[i] / max;
  };
}

/**
 * Choose which beats get a gate, and how far off the centre line each one sits.
 *
 * The spacing comes from the music's own energy: quiet passages get long, wide
 * giant-slalom turns, the drops get a tight rhythmic slalom. Because the spacing
 * is measured in beats, the resulting cadence of turns is the track's cadence —
 * the player ends up carving in time without ever being asked to.
 */
const SUBDIVISIONS = [2, 4, 8, 16];
const MIN_SWING = 9;            // metres between two gates, below which they overlap
/**
 * The shortest interval two gates may ever be apart, in seconds, AFTER the snap.
 *
 * The comment below names two seconds as what a body leaning on a board through
 * a third of a second of smoothing needs to express a direction change, and then
 * floored the snap at 1.6 — a fifth of a beat under its own stated requirement,
 * which at 172 BPM would have snapped four beats to 1.4 s and kept it. The floor
 * doubles the subdivision rather than trimming it, so a gate still lands on a
 * beat whatever this is set to. At 110 BPM nothing in this track reaches it.
 */
const MIN_GATE_SEC = 2.05;

/** Nearest musical subdivision to a target gap, floored at MIN_GATE_SEC. */
function chooseSpacing(beatSec, targetSec) {
  let best = SUBDIVISIONS[0];
  for (const n of SUBDIVISIONS) {
    if (Math.abs(n * beatSec - targetSec) < Math.abs(best * beatSec - targetSec)) best = n;
  }
  while (best * beatSec < MIN_GATE_SEC && best < 32) best *= 2;
  return best;
}

/**
 * Plan one lap of the slalom.
 *
 * `opts` is what makes the course endless. The beat grid is 171 s long and the
 * descent is not, so the music repeats and the plan is re-cut per lap against
 * the SAME beats at a later absolute time:
 *
 *   - `tOffset`  seconds to add to every beat — lap index times the lap length.
 *   - `startSide` which way the first gate of this lap leans. Consecutive gates
 *     alternate sides and the swing between them is what a slalom IS, so a lap
 *     that restarts on the side the previous one ended asks the rider to stay
 *     put across the seam. The caller passes the negation of the last side.
 *   - `leadIn`   seconds of the lap to leave empty. Five on the first lap, while
 *     the rider is still getting up to speed from a standstill; ZERO on every
 *     lap after it, where a five-second hole would be a gap in a course the
 *     rider is already riding at 90 km/h.
 *
 * Everything the reference run is asked is asked in ABSOLUTE time, so lap two's
 * gates are sized against lap two's speed on lap two's stretch of mountain.
 * Durations are read off the beat array as differences and stay lap-local. That
 * is the whole reason the laps are not copies of each other: the music repeats,
 * the mountain under it does not.
 */
export function planGates(grid, reference, seed, opts = {}) {
  const tOffset = opts.tOffset ?? 0;
  const leadIn = opts.leadIn ?? LEAD_IN_SEC;
  const beats = grid.beats;
  const beatSec = 60 / (grid.bpm || 128);
  const energy = energyCurve(grid);
  const rand = mulberry32(seed ^ 0x9a71);
  const out = [];
  let side = opts.startSide ?? (rand() < 0.5 ? -1 : 1);

  let i = beats.findIndex((b) => b >= leadIn);
  if (i < 0) i = 0;
  // Start on a bar line so the slalom's phase agrees with the music's.
  const bpb = grid.beatsPerBar || 4;
  const down = grid.downbeatIndex || 0;
  while ((i - down) % bpb !== 0 && i < beats.length - 1) i++;

  while (i < beats.length - 1) {
    const t = beats[i] + tOffset;
    const e = energy(beats[i]);
    // Spacing is chosen in SECONDS and then snapped to a musical subdivision,
    // not fixed at a beat count. A body leaning on a board through a pipeline
    // with a third of a second of smoothing needs about two seconds to express a
    // direction change, whatever the tempo — picking "every four beats" would
    // give a comfortable slalom at 112 BPM and an unridable one at 172.
    const chosen = chooseSpacing(beatSec, e > 0.68 ? 2.1 : 3.4);
    // A DURATION, so it is read off the beat array lap-locally. `t` carries the
    // lap offset and subtracting it here would make every gap on lap two come
    // out as minus one lap length.
    const secondsFor = (n) => Math.max(0.4, beats[Math.min(beats.length - 1, i + n)] - beats[i]);

    // HALF the swing, because consecutive gates alternate sides: the distance
    // actually demanded of the rider between two gates is 2*amp. Sizing amp as
    // the whole swing asked for twice what the turn model can deliver, and the
    // autopilot duly made almost exactly half of them.
    let spacing = chosen;
    let seconds = secondsFor(spacing);
    const ampAt = (s) => clamp(maxSwing(reference.vAt(t), s, SWING_EDGE) * AMP_FRAC, AMP_MIN, HALF * 0.48);
    let amp = ampAt(seconds);
    // Two floors, both of which widen the spacing by DOUBLING it, so whatever
    // comes out is still a musical subdivision and the gate still lands on a beat.
    //
    // A gate pair only means something if the swing between them is wider than
    // the opening itself. Where the achievable swing is too small — a slow, flat
    // stretch, or simply a brisk tempo — widen the spacing rather than placing a
    // slalom the racing line can drive straight through, which is what tight
    // gates had become once the board was given a realistic turn radius.
    //
    // And the snapped interval itself has to clear MIN_GATE_SEC: `chooseSpacing`
    // floors the SNAP against the nominal beat, but the grid is tracked rather
    // than fixed, so a stretch where the tracker ran fast can still come back
    // under it. This tests the beats that were actually measured.
    while ((amp * 2 < MIN_SWING || seconds < MIN_GATE_SEC) && spacing < 32) {
      spacing *= 2;
      seconds = secondsFor(spacing);
      amp = ampAt(seconds);
    }
    out.push({ t, beat: i, side, u: side * amp, spacing });
    side = -side;
    i = Math.min(beats.length - 1, i + spacing);
  }
  return out;
}

/**
 * Cut kickers into the mountain at strong downbeats, spaced so they never crowd
 * the slalom. Positions come from the reference run because the terrain that
 * contains them is built long before the rider gets near.
 */
/**
 * Cut one lap's kickers.
 *
 * Lap-aware for the same reasons `planGates` is, plus one of its own: `lastP`
 * carries in from the previous lap. The 250 m spacing is what stops two ramps
 * crowding each other, and a lap that starts its own count at minus infinity
 * would happily cut its first kicker twenty metres past the last one of the lap
 * before — the one place in the course where two jumps could overlap.
 *
 * `minT` is the first lap's 14-second lead-in, and zero thereafter.
 */
export function planKickers(grid, reference, seed, opts = {}) {
  const tOffset = opts.tOffset ?? 0;
  // Metres to add to every kicker's p. The reference run always starts from
  // zero, so a mode that drops the rider somewhere else on the mountain has to
  // carry its kickers with it — see `Game._courseOffset`. Gates need no
  // equivalent: `Course` predicts them from the rider's ACTUAL p, so they
  // follow wherever the rider is.
  const pOffset = opts.pOffset ?? 0;
  const minT = opts.minT ?? 14;
  /**
   * WHAT ACTUALLY SETS THE DENSITY, exposed because a place wants to move it.
   *
   * `minT` is a START cutoff -- it skips beats in the first N seconds -- and
   * was mistaken for a spacing when places were first wired up, which is why
   * three places with minT 7, 14 and 30 all produced exactly 17 kickers. The
   * spacing is this, and the energy gate below it: a kicker needs 250 m of
   * clear run since the last one AND a beat the track is actually leaning on.
   */
  const minGap = opts.minGap ?? 250;
  const energyMin = opts.energyMin ?? 0.55;
  const beats = grid.beats;
  const energy = energyCurve(grid);
  const rand = mulberry32(seed ^ 0x4d21);
  // HOW OFTEN A JUMP MAY BE CONSIDERED, in beats. One bar by default, which is
  // the musical unit a kicker reads against -- but it is also a CEILING on how
  // many there can ever be, and that ceiling binds before the spacing does: at
  // a 110 m gap the count stopped at 17, which is simply every downbeat the
  // energy gate allows. A place wanting real airtime has to be allowed to
  // consider the half bar.
  const step = Math.max(1, Math.round((grid.beatsPerBar || 4) * (opts.everyBars ?? 1)));
  const bpb = grid.beatsPerBar || 4;
  const out = [];
  let lastP = opts.lastP ?? -1e9;

  for (let i = grid.downbeatIndex || 0; i < beats.length; i += step) {
    const t = beats[i] + tOffset;
    if (beats[i] < minT) continue;
    if (energy(beats[i]) < energyMin) continue;
    const p = reference.pAt(t) + pOffset;
    if (p - lastP < minGap) continue;
    lastP = p;
    out.push({
      p,
      t,
      u: range(rand, -11, 11),
      h: range(rand, 2.6, 3.6),
      // SHORT. The run-up's lip slope is 2h/len, and the mountain itself drops
      // at ~0.3 — at the old 24-30 m the two nearly cancelled and the "ramp"
      // was a horizontal shelf: from the chase camera it foreshortened to a
      // couple of pixels and the player saw only the bright landing sheet
      // beyond it ("you only see its back side"). A real kicker run-up is
      // short and steep; at 11-14 m the face clears the base slope by
      // 0.2-0.35 and stands up into the frame — and the pop is real.
      len: range(rand, 11, 14),
      // Nine metres, not twenty. With the old width and its falloff the ramp
      // spanned forty metres of a sixty-four metre piste — a wall across the
      // course that could not be gone round, which is exactly how it read.
      w: 9,
    });
  }
  return out;
}

// ── Gate rendering ──────────────────────────────────────────────────────────

// Real slalom poles stand about 1.8 m out of the snow. At 3.1 m they towered
// over a rider passing an arm's length away and owned the frame.
const POLE_H = 2.2;
/**
 * Metres of pole below the drawn snow, and metres the painted ground mark rides
 * above it.
 *
 * Both are sized against a KNOWN residual in `meshHeight`, not against z-fighting.
 * That function measures the column fraction from the centre line of the row it
 * starts from, but each mesh row's columns are offset by ITS OWN centreX — the
 * quads are parallelograms sheared by up to 0.9 m per row — so its answer drifts
 * from the triangles actually drawn by a median of 0.00 m but a p95 of 0.07 and a
 * worst case of 0.29 m where a gate can sit. (Off the piste, where the columns
 * are twenty metres apart, it will be much larger; the trees are planted with the
 * same call. That is `mountain.js`'s to fix, not this file's.)
 *
 * So: sink the pole far enough that the residual can never lift its base clear of
 * the snow, since a floating pole reads instantly and a slightly deep one is what
 * a planted pole looks like. It leaves 2.0 m proud, which is the 1.8 m a real
 * slalom pole stands anyway. The mark is lifted only enough to clear the residual
 * most of the time: half a metre of guaranteed clearance would buy an unclipped
 * mark at the price of it hovering, and a hovering mark is the exact artefact a
 * reviewer picked out of the frame unprompted.
 */
const POLE_SINK = 0.20;
const LINE_LIFT = 0.10;
/** Spans across the opening in the ground mark. The mesh's own columns are 2-3.5 m
 *  apart out where gates sit, so nine spans over nine metres over-samples it. */
const LINE_SEGS = 8;

/**
 * ONE pole and its panel, built about its own base at the origin.
 *
 * The two poles of a gate used to be a single merged mesh planted at the height
 * of the gate's CENTRE. That is only correct on flat ground. The piste is a
 * banked parabola: at u = 18 the surface climbs 0.31 m per lateral metre, so
 * across a nine metre opening the two poles stand up to 2.8 m apart in height —
 * and out at the clamp (u = 23) it is 3.6 m. Planting both at the middle sinks
 * the uphill pole and most of its flag into the snow and hangs the downhill one
 * in the air, which is exactly what "flags are inside the terrain" describes.
 *
 * Each pole is now its own mesh, planted against `meshHeight` at its own x —
 * the surface AS DRAWN, not as defined; the tessellated mesh sags below the
 * analytic surface between columns, and the same lesson already cost this
 * project a forest standing in mid-air.
 *
 * They stay PLUMB rather than standing normal to the snow. A real slalom pole is
 * drilled and stands close to vertical, and the piste's edge markers in
 * `scatter.js` are plumb for the same reason; more to the point, a pole tilted
 * with a 17° pitch leans away from a chase camera that is already looking down
 * the hill, turning its panel edge-on exactly when the rider needs to read it.
 * Verticals against a sloping white field are the strongest silhouette this
 * scene can offer, and legibility at 150 m is the whole job of the flag.
 */
/**
 * A TIME GATE'S pole: tall and bare. "high poles with no flags, and the mark on
 * the floor completely different ... they feel too close for two things that do
 * something completely different." The flag is merged into the slalom pole's
 * geometry, so no-flag means its own geometry, not a hidden child -- and the
 * height difference is built in rather than scaled, so the pole keeps a sane
 * thickness. Side-agnostic: with no inboard flag there is no handedness.
 */
function buildTimePoleGeometry() {
  // Twice the slalom pole's girth -- "not visible enough ... and thicker". A
  // bare pole has no flag doing its waving, so the pole itself carries the
  // whole silhouette.
  const pole = new THREE.CylinderGeometry(0.10, 0.13, POLE_H * 1.9, 8, 1);
  pole.translate(0, (POLE_H * 1.9) / 2, 0);
  return pole;
}

function buildPoleGeometry(side) {
  const pole = new THREE.CylinderGeometry(0.042, 0.055, POLE_H, 6, 1);
  pole.translate(0, POLE_H / 2, 0);
  // A panel hanging inboard of the pole, angled to face up the hill. Inboard is
  // always the DOWNHILL side laterally, so the panel can never meet the bank.
  const flag = new THREE.BoxGeometry(0.50, 0.44, 0.03);
  flag.translate(-side * 0.27, 1.90, 0);
  return mergeGeometries([pole, flag], false);
}

const LINE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uFade;
varying vec2 vUv;
void main() {
  // Soft at both ends so the marker sits in the snow rather than on it.
  float a = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));
  a *= 1.0 - abs(vUv.y * 2.0 - 1.0);
  gl_FragColor = vec4(uColor, a * uFade * 0.42);
}
`;

/**
 * A pennant for the top of a boost gate's pole.
 *
 * WHY THIS AND NOT A CROSSBAR AGAIN. The bar failed twice and the reason was
 * never that a gate should not be marked -- it was that a marker SPANNING nine
 * metres of banked mountain is a large object, and a large object competes with
 * the trees and wins. A pennant is 0.8 m, sits on the pole it belongs to, and
 * spans nothing, so it can be bright without being furniture.
 *
 * It is also a SILHOUETTE cue rather than a colour one, which is the thing that
 * was actually missing: "much clearer different graphics for the original gates
 * and the booster gates". Colour tells you which gate this is once you can
 * resolve its hue; a shape on the skyline tells you from as far as you can see
 * the pole at all.
 */
function buildPennantGeometry() {
  const g = new THREE.PlaneGeometry(0.82, 0.5);
  // Hung off one side of the pole and standing up, so the pair splay outward
  // from the gate and read as two flags rather than one blob.
  g.translate(0.41, 0, 0);
  return g;
}

class Gate {
  constructor(scene, geos, mats) {
    /** Left and right pole, each planted at its own height. */
    this.poles = geos.map((g) => {
      const m = new THREE.Mesh(g, mats.blue);
      m.frustumCulled = false;
      m.visible = false;
      scene.add(m);
      return m;
    });
    // NO CROSSBAR. A bar across the top was tried twice -- first thick and
    // level, then thin and following the slope -- and both read as scaffolding
    // rather than as a gate. The lesson is that the poles were never the
    // problem: what makes a boost gate legible is that it is a DIFFERENT
    // COLOUR and 1.85x the size, not that it has a lintel. Anything spanning
    // nine metres of banked mountain is a large object competing with the
    // trees, and it was winning.
    // The ground mark is a RIBBON that follows the drawn mesh, not a flat quad.
    // Laid flat it was clipped by the snow over its whole uphill half (the slope
    // drops 0.33 m across its 1.1 m of length) and buried to one side by metres
    // wherever the gate sat on the bank. Its vertices are rewritten in world
    // space every time the gate moves, so the geometry cannot be shared.
    const lineGeo = new THREE.PlaneGeometry(GATE_HALF * 2, 1.1, LINE_SEGS, 1);
    lineGeo.rotateX(-Math.PI / 2);
    /** The lateral/downhill offset of each ribbon vertex from the gate centre. */
    this.lineOff = new Float32Array(lineGeo.attributes.position.count * 2);
    const lp = lineGeo.attributes.position.array;
    for (let i = 0; i < this.lineOff.length / 2; i++) {
      this.lineOff[i * 2] = lp[i * 3];
      this.lineOff[i * 2 + 1] = lp[i * 3 + 2];
    }
    this.line = new THREE.Mesh(lineGeo, new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthWrite: false,
      // Painted on the snow, not glowing above it. Additive blending against a
      // sunlit white field blows straight out to a neon bar and reads as a light
      // source rather than as course marking.
      // Warm and pale, not cyan. The reference paints its on-snow gate mark at
      // RGB(211,166,199) — a dyed patch a quarter brighter than the snow around
      // it. Ours was a neon bar at 1.43x, which a blind reviewer read as "an
      // untextured flat cyan ramp polygon" and "a floating magenta streak".
      uniforms: { uColor: { value: new THREE.Color(0xff9db4) }, uFade: { value: 1 } },
    }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.line.renderOrder = 3;
    scene.add(this.line);

    // BOOST GATES ONLY, and hidden the rest of the time. Two-sided because a
    // flag seen from behind is still a flag, and a gate is approached from one
    // side and left from the other.
    const pennantGeo = buildPennantGeometry();
    this.pennants = [0, 1].map((i) => {
      const m = new THREE.Mesh(pennantGeo, mats.boost);
      m.scale.x = i ? -1 : 1;   // splayed outward, away from the gate's mouth
      m.frustumCulled = false;
      m.visible = false;
      scene.add(m);
      return m;
    });

    this.active = false;
    this.data = null;
    this.isBoost = false;
    // The flagged slalom geometries, so a pooled gate re-dressed from time back
    // to slalom gets its flags back.
    this.classicGeos = [this.poles[0].geometry, this.poles[1].geometry];
  }

  setVisible(v) {
    this.poles[0].visible = v;
    this.poles[1].visible = v;
    this.line.visible = v;
    this.pennants[0].visible = v && this.isBoost;
    this.pennants[1].visible = v && this.isBoost;
  }

  setMaterial(m) {
    this.poles[0].material = m;
    this.poles[1].material = m;
  }
}

export class Course {
  constructor(terrain, scene, mood, gatePlan) {
    this.terrain = terrain;
    this.plan = gatePlan;
    this.planIdx = 0;
    this.kickers = terrain.kickers ?? [];

    // DARKER than the snow, not brighter. The reference's panels sit at 0.18 of
    // the luminance of the snow beside them; ours sat at 1.41, which is the
    // whole of the "toy" read — a saturated blue rectangle glowing off a white
    // field is a HUD element, not course furniture. The emissive term was doing
    // most of that work and there is nothing on a slalom gate that emits light.
    //
    // Legibility survives the change because contrast does: a deep crimson panel
    // against near-white snow is a stronger signal at 150 m than a bright blue
    // one, which competes with the sky and the lit snow rather than standing
    // against them.
    //
    // `wrap` is up from 0.3 to 0.85, and that is the whole reason these are
    // readable at all. The panel is hung facing UP the hill and the sun is down
    // it, so the only face a rider ever sees is the shadowed one: at the old
    // wrap, killing the emissive took the panels from 1.41x the snow beside them
    // to 0.03x — from a glowing toy to a black rectangle, which is not the same
    // thing as sitting in the scene. A flag is a thin sheet of cloth and does
    // carry light through, so a wide wrap is the honest term for it.
    this.matBlue = makeLitMaterial(mood, { color: 0x24457f, wrap: 0.85, gloss: 26, specular: 0.22, emissive: 0 });
    this.matRed = makeLitMaterial(mood, { color: 0xa8183c, wrap: 0.85, gloss: 26, specular: 0.22, emissive: 0 });
    // The ONE material on the course that emits. Every argument in the note
    // above is about a gate being course furniture rather than a HUD element —
    // and a boost gate is not furniture, it is an offer. It has to read as
    // something switched on from 150 m out, through haze, against snow.
    // Emissive 1.0: the brightest thing on the mountain, deliberately. Every
    // other object here takes the mood's sun so it sits IN the scene, and this
    // one has the opposite job — it must read the same at first light, at
    // bluebird and through a squall, from as far away as the fog allows.
    // STRONG PURPLE, H271 -- and the hue is the whole choice, because measuring
    // the old cyan showed it was never winning on brightness. Its luminance
    // contrast against the backgrounds a gate is actually seen against ran
    // 1.35:1 to 5.65:1, which is nothing; it read because H191 is complementary
    // to the orange horizon bands.
    //
    // So a purple has to survive the two mood stops that are THEMSELVES purple:
    // first light's horizon is dusty rose at H295 and alpenglow's zenith is
    // H255. That rules out most of the family. A magenta-purple (0xc026d3)
    // lands 0 degrees off the first light horizon and disappears into it, and
    // the deep royals (0x7c3aed, 0x6d28d9) sit 10-12 degrees off the alpenglow
    // zenith while being dark enough (luminance 0.10-0.13) to lose on both
    // counts at once.
    //
    // AND IT HAS TO SURVIVE BLOOM, which is what the first attempt missed.
    // The material is emissive at 1.0 and goes through the bloom pass, which
    // lifts every channel toward white. 0xa855f7 carries R168 against B247, so
    // the red came up with the blue and the gate washed out to PINK on screen
    // however purple the swatch looked. Holding the hue through bloom is a
    // question of the red channel staying low: R/B is 0.68 there and 0.50 here.
    //
    // 0x6d28d9 is that, and it reads as violet at 200 m with the bloom on it.
    // Against snow -- which is what a gate on the piste is actually seen
    // against, far more often than sky -- a dark purple has MORE luminance
    // contrast than the cyan did, not less: 5.4:1 against day snow.
    this.matBoost = makeLitMaterial(mood, { color: 0x6d28d9, wrap: 0.85, gloss: 40, specular: 0.5, emissive: 1.0 });
    // THE TIME GATE WEARS THE MOTE'S COLOUR. First cut was amber and "not
    // visible enough"; Elad's fix is better than visibility -- "same color as
    // the motes": motes pay time and these gates pay time, so the two things
    // that pay the same currency share one colour, and a player who has
    // chased one mote already knows what the gate is for. NOT the mote's pale
    // body (0xbcdcf4) -- a screenshot showed those poles white-on-white, the
    // rivals' camouflage lesson all over again -- but the mote's SATURATED
    // cyan, the colour of its plume and its callout, which is what a player
    // actually remembers a mote being. Emissive 0.9: reads from 150 m, still
    // under the boost's 1.0 jackpot.
    // LIME, with the motes -- one currency, one colour (see pickups.js for the
    // whole audition). Emissive 1.4: the gates carry the glow the way the hot
    // candidates showed tall poles can, still a different language from the
    // boost's violet.
    this.matTime = makeLitMaterial(mood, { color: 0xc8ff3a, wrap: 0.85, gloss: 70, specular: 0.55, emissive: 1.4 });
    this.materials = [this.matBlue, this.matRed, this.matBoost, this.matTime];
    this.timeGeo = buildTimePoleGeometry();
    // Set per run by the mode: chill's plain gates are TIME gates and dress
    // differently; the race's plain gates keep the slalom look.
    this.timeGates = false;

    // One geometry per SIDE, shared by every gate in the pool: the panel hangs
    // inboard, so the left and right poles are not the same object.
    const geos = [buildPoleGeometry(-1), buildPoleGeometry(1)];

    this.gates = [];
    for (let i = 0; i < GATE_POOL; i++) {
      this.gates.push(new Gate(scene, geos,
        { blue: this.matBlue, red: this.matRed, boost: this.matBoost }));
    }

    this.pRate = 16;
    this.pRateFast = 16;
    this.pAccel = 0;
    this.lastPlacedP = -1e9;
    /**
     * No gate is placed beyond this p. Infinity unless a mode sets it.
     *
     * Gates are placed PREDICTIVELY, three and a half seconds ahead of the
     * rider, so a finite course keeps spawning them past its own finish line —
     * furniture for a race that is already over, and a boost gate in particular
     * reads as an instruction to keep going.
     */
    this.limitP = Infinity;
    /** Scales how far from the centre line a gate may be placed. See `ampMax`. */
    this.gateAmp = 1;
    /**
     * Optional `(p, u) => boolean`. A gate is not placed where this says
     * something is in the way — set by the race, which plants trees ON the
     * racing line and would otherwise put a boost gate behind one. A gate you
     * cannot take is worse than no gate: it reads as the course cheating.
     */
    this.isBlocked = null;
    /**
     * Seconds of warning a gate is placed with. `SPAWN_LEAD` unless a mode
     * raises it.
     *
     * 3.5 s is right for the slalom, where it is "enough warning to set up a
     * turn" and a short horizon keeps the prediction honest. It is wrong for
     * the race: at 110 km/h it puts a gate on the hill 60 to 90 m out, which
     * with the race's own camera sitting 4 m behind the rider reads as the gate
     * APPEARING rather than approaching — reported twice from play.
     *
     * Raising it costs nothing in accuracy. A gate is re-solved every frame
     * while it is unlocked and only freezes about a second out, so a longer
     * lead is more refinement rather than a worse guess — that is the whole
     * design of the predictor. `VISIBLE_AHEAD` (280 m) still caps how far out
     * anything is actually drawn.
     */
    this.spawnLead = SPAWN_LEAD;
    // The previous gate as it finally settled: its beat, its p and its offset.
    // Mutated in place rather than replaced — this is touched every frame.
    this.lastPlaced = { valid: false, p: 0, t: 0, u: 0 };
    this.live = [];
    this.stats = { passed: 0, missed: 0 };
  }

  reset(p) {
    this.planIdx = 0;
    this.pRate = 16;
    this.pRateFast = 16;
    this.pAccel = 0;
    this.lastPlacedP = p - 1e5;
    this.lastPlaced.valid = false;
    this.live.length = 0;
    this.stats.passed = 0;
    this.stats.missed = 0;
    for (const g of this.gates) {
      g.active = false;
      g.data = null;
      g.setVisible(false);
    }
  }

  /**
   * Which descent rate to trust for a prediction `lead` seconds out. Far ahead,
   * the long average — the rider's pace swings by a quarter through every turn
   * and none of that swing survives four seconds. Close in, the current rate,
   * because by then the swing IS the answer.
   */
  _rateFor(lead) {
    const k = clamp(lead / 2.5, 0, 1);
    return this.pRateFast + (this.pRate - this.pRateFast) * k;
  }

  /** Is this stretch of hill spoken for by a kicker's run-up or landing? */
  _nearKicker(p) {
    for (const k of this.kickers) {
      if (p > k.p - (k.len + 14) && p < k.p + 72) return true;
      if (k.p - 90 > p) break;                 // sorted by p
    }
    return false;
  }

  _free() {
    return this.gates.find((g) => !g.active) ?? null;
  }

  /**
   * How far off the centre line this gate may sit, given the pace the rider is
   * predicted to ACTUALLY arrive at.
   *
   * `planGates` sizes every amplitude against `reference.vAt(t)` — a competent
   * run integrated at boot. The gate is then placed where the real rider will
   * be, and those two riders are not the same person. A player at 0.8 of the
   * reference pace covers 60 m between two beats where the reference covers 75,
   * and `maxSwing` falls with speed roughly as fast: measured over this track,
   * ten of twenty-seven gate transitions then demand more lateral metres than
   * the turn model can physically deliver, and at 0.65 of the pace twenty-one of
   * them do. That is what "checkpoints sometimes too near to the previous
   * checkpoint" is from the seat — the gate is not near in metres, it is near
   * relative to the swing it asks for.
   *
   * So the plan's amplitude becomes a CEILING and the same expression is
   * re-evaluated against the predicted pace. Nothing about the rhythm moves: the
   * gate keeps its beat, its side and its spacing, and only how far across the
   * piste it sits responds to how fast the rider is actually going.
   *
   * Sized as HALF the swing, exactly as the planner does, because consecutive
   * gates alternate sides and the distance demanded between two of them is the
   * sum of their amplitudes.
   *
   * The `left` term only bites on the gate where the pace CHANGED: its
   * predecessor is already placed, sized against a swing that no longer exists,
   * so half a budget each is too much and what remains of the budget is taken
   * instead. Note the floor at half the steady amplitude. Solving
   * `amp = budget - prevAmp` outright looks tighter and is a reflection, not a
   * contraction — it settles into a permanent wide/narrow alternation rather than
   * converging — and that floor is what turns it back into something that reaches
   * the steady state within two gates.
   */
  _ampFor(d) {
    if (d.prevP == null) return d.ampMax;
    const v = clamp((d.p - d.prevP) / d.dtPrev / REF_TRAVERSE, TUNE.minSpeed, TUNE.maxSpeed);
    const steady = maxSwing(v, d.dtPrev, SWING_EDGE) * AMP_FRAC;
    const left = Math.max(steady * 0.5, steady * 2 - Math.abs(d.prevU));
    return clamp(Math.min(steady, left), AMP_MIN, d.ampMax);
  }

  _place(entry, p) {
    const g = this._free();
    if (!g) return;
    const boost = entry.kind === 'boost';
    const red = entry.side > 0;
    // A boost gate takes its own colour and keeps it whichever side it is on:
    // the red/blue pair means "which way does this one send you", and a gate
    // that sends you nowhere should not be answering that question. Cyan is
    // HillBomb's choice for the same object and for the same reason — it is the
    // one hue nothing else on the course uses.
    const timed = this.timeGates && !boost;
    // A time gate swaps GEOMETRY, not just colour: tall bare poles against the
    // slalom's flagged ones, so the silhouette answers before the hue does.
    for (let i = 0; i < 2; i++) {
      g.poles[i].geometry = timed ? this.timeGeo : g.classicGeos[i];
    }
    g.setMaterial(boost ? this.matBoost : timed ? this.matTime
      : (red ? this.matRed : this.matBlue));
    // And the floor mark changes name with it: the mote-callout cyan for time
    // (saturated, because the pale ice of the poles would vanish ON snow), the
    // reference's dyed pink for everything else -- and thicker, "including on
    // the floor": wider and longer than a slalom mark, under the boost's.
    g.line.material.uniforms.uColor.value.set(timed ? 0xd6ff5a : 0xff9db4);
    // A BOOST GATE IS BIGGER THAN A SLALOM GATE, not just a different colour.
    // At 2.2 m it was the same silhouette as the thing it is not, read late,
    // and in a mode where it is the only furniture on the hill that matters
    // "which colour was that one" is the wrong question to be asking at 60 m.
    // Scaled rather than given its own geometry, so the pole, the flag and the
    // sink into the snow all stay in proportion.
    for (const pole of g.poles) pole.scale.setScalar(boost ? 1.85 : 1);
    g.isBoost = boost;
    // A WIDER, DEEPER PAINT on the snow for a boost gate. The ribbon already
    // follows the terrain, so scaling it costs nothing and gives the second
    // read -- the pennants say it from the skyline, this says it from the line
    // you are riding, where the poles are out of frame.
    g.line.scale.set(boost ? 1.5 : timed ? 1.35 : 1, 1, boost ? 2.2 : timed ? 1.8 : 1);
    // The two marks stay the same LUMINANCE and differ only in hue: the side
    // readout is worth keeping, but it was being carried by brightness, and one
    // of the pair had to be the loudest thing in the frame for that to work.
    g.line.material.uniforms.uColor.value.set(
      boost ? 0xa78bfa : (red ? 0xff9db4 : 0xd6a6dc));
    g.setVisible(true);
    g.active = true;
    const prev = this.lastPlaced.valid ? this.lastPlaced : null;
    const d = {
      p,
      u: 0,
      side: entry.side,
      // The plan's amplitude, as a ceiling this gate may never exceed.
      // HOW FAR ACROSS THE PISTE THIS GATE MAY SIT, and therefore how wide the
      // slalom is. `gateAmp` is the place's: at 0.5 the gates sit near the
      // centre and the run is a tight rhythmic weave; at 1.3 they reach for the
      // rim and every one is a full traverse. It is the layout of the boosters,
      // which density cannot touch -- twice as many gates in the same narrow
      // band is the same course, faster.
      ampMax: Math.min(Math.abs(entry.u), HALF * 0.72 * this.gateAmp),
      // The previous gate is locked and passed by the time this one is placed —
      // it is a beat behind and a second in the past — so its p is final and
      // this stays a fixed reference for the whole of this gate's life.
      prevP: prev ? prev.p : null,
      prevU: prev ? prev.u : 0,
      dtPrev: prev ? entry.t - prev.t : 0,
      red, boost, half: boost ? BOOST_HALF : GATE_HALF,
      passed: false, locked: false, t: entry.t,
      minP: this.lastPlacedP + MIN_GATE_GAP,
      x: 0, z: 0,
    };
    if (!(d.dtPrev > 0.4)) d.prevP = null;
    d.u = d.side * this._ampFor(d);
    // Nothing behind a tree. Tried on the other side before giving up, because
    // a gate's side is the slalom's rhythm and losing one to an obstacle is a
    // worse trade than taking it a beat early on the wrong foot.
    if (this.isBlocked?.(p, d.u)) {
      const flipped = -d.side * Math.abs(d.u);
      if (this.isBlocked(p, flipped)) {
        g.active = false;
        g.setVisible(false);
        return;
      }
      d.u = flipped;
    }
    g.data = d;
    this._reposition(g);
    this.live.push(g);
    this.lastPlacedP = p;
    this._remember(d);
  }

  /** Record a gate as the one the NEXT gate will be sized against. */
  _remember(d) {
    const L = this.lastPlaced;
    L.valid = true;
    L.p = d.p;
    L.t = d.t;
    L.u = d.u;
  }

  /**
   * Put a gate's meshes where its `p` and `u` say it belongs.
   *
   * Everything is planted against `meshHeight` — the surface AS DRAWN — and each
   * pole against its own x. The gate spans nine metres of a banked parabola, so
   * one height for the pair is wrong by up to three and a half metres of it.
   */
  _reposition(g) {
    const d = g.data;
    d.z = -d.p;
    d.x = this.terrain.xAt(d.u, d.z);
    for (let i = 0; i < 2; i++) {
      const px = d.x + (i ? d.half : -d.half);
      g.poles[i].position.set(px, meshHeight(this.terrain, px, d.z) - POLE_SINK, d.z);
    }
    // The mark's own vertices carry the terrain, but the MESH still sits at the
    // gate: a transparent object is depth-sorted by where its transform puts it,
    // and a ribbon built in world space with its transform left at the origin
    // sorts every gate in the run as if it were at the start of it.
    if (g.isBoost) {
      // At the top of each pole, on the pole's own height, so a gate on a bank
      // carries one flag higher than the other exactly as its poles do.
      const lift = POLE_H * 1.85 * 0.88;
      for (let i = 0; i < 2; i++) {
        const pp = g.poles[i].position;
        g.pennants[i].position.set(pp.x, pp.y + lift, pp.z);
      }
    }

    const yc = meshHeight(this.terrain, d.x, d.z);
    g.line.position.set(d.x, yc, d.z);
    const off = g.lineOff;
    const attr = g.line.geometry.attributes.position;
    const pos = attr.array;
    for (let i = 0, o = 0; o < pos.length; i++, o += 3) {
      const lx = off[i * 2];
      const lz = off[i * 2 + 1];
      pos[o + 1] = meshHeight(this.terrain, d.x + lx, d.z + lz) + LINE_LIFT - yc;
    }
    attr.needsUpdate = true;
  }

  /**
   * @param {number} dt
   * @param {number} t track time, seconds
   * @param {import('./rider.js').Rider} rider
   * @param {number} prevP the rider's p at the start of this frame
   * @param {number} prevX the rider's world x at the start of this frame
   * @param {?{rider:object, prevP:number, prevX:number}} [two] PLAYER TWO, in
   *   a two-player race. The course is one piece of geography that both
   *   humans ride, so it is updated ONCE and asked about both of them --
   *   calling this twice would spawn, despawn and count everything twice.
   *   Every returned event carries `who` (0 or 1) to say whose it is.
   * @returns {{type:string, who:number, gate:object}[]}
   */
  update(dt, t, rider, prevP, prevX, two = null) {
    const p = rider.p;
    // THE TRAILING RIDER OWNS THE RECYCLING. A gate is removed once it is
    // behind the player, which with two players means behind the player who
    // is STILL COMING -- keyed to player one alone, a boost gate vanished out
    // of player two's half the instant player one passed it, while player two
    // was still riding at it (BAL-594). Same rule the mountain and the
    // scatter already follow.
    const tailP = two ? Math.min(p, two.rider.p) : p;

    // Pace, smoothed hard: the predictor is aiming seconds out, so it wants the
    // rider's average rate of descent, not the instantaneous one that swings by a
    // third through every turn.
    const inst = (p - prevP) / Math.max(dt, 1e-4);
    if (Number.isFinite(inst)) {
      const before = this.pRate;
      // Tau covers more than one full slalom cycle (about 1.9 s at this tempo),
      // or the average still swings with the rider's own traversing.
      this.pRate += (clamp(inst, 3, 42) - this.pRate) * (1 - Math.exp(-dt / 3.0));
      // An exponential average always lags a rider who is still accelerating,
      // and the opening of a run is nothing but acceleration. Carrying a second
      // derivative removes that systematic bias instead of trading it against
      // the noise rejection the smoothing is there for.
      const a = (this.pRate - before) / Math.max(dt, 1e-4);
      this.pAccel += (clamp(a, -2.5, 2.5) - this.pAccel) * (1 - Math.exp(-dt / 1.0));
      // A second, barely-smoothed rate for short horizons. Over the last second
      // before a gate the rider's CURRENT rate of descent predicts far better
      // than a three second average that is still carrying the last turn.
      this.pRateFast += (clamp(inst, 3, 42) - this.pRateFast) * (1 - Math.exp(-dt / 0.4));
    }

    // Spawn everything whose beat is now inside the warning horizon.
    while (this.planIdx < this.plan.length) {
      const entry = this.plan[this.planIdx];
      const lead = entry.t - t;
      if (lead > this.spawnLead) break;
      this.planIdx++;
      if (lead < 0.6) continue;                    // missed the window (a stall or a seek)
      let target = p + this._rateFor(lead) * lead + 0.5 * this.pAccel * lead * lead;
      if (target - this.lastPlacedP < MIN_GATE_GAP) target = this.lastPlacedP + MIN_GATE_GAP;
      if (target - p > VISIBLE_AHEAD) continue;
      // Nothing past the end of a finite course. See `limitP`.
      if (target > this.limitP) continue;
      // Never hang a gate over a jump. The run-up and the landing belong to the
      // kicker: asking for a slalom gate a second after touching down is both
      // unfair and unpredictable — the speed lost on impact is exactly what the
      // pace predictor cannot see coming, and those gates were the only ones
      // landing badly off their beat.
      if (this._nearKicker(target)) continue;
      this._place(entry, target);
    }

    // ── GATES DO NOT MOVE ─────────────────────────────────────────────────
    //
    // There used to be a per-frame refinement loop here: every unlocked gate
    // chased a continuously revised beat prediction at 7 m/s down the hill and
    // 2.5 m/s laterally, freezing only a second before the rider arrived. That
    // predictor-chaser was inherited from a TIME-LOCKED game (the motorcycle
    // runner, where a hazard must meet the rider exactly on its beat), and
    // Elad cut it from carve on sight of the symptom: "the gates feel like
    // their location is a little bit floaty, relative to the trees, until you
    // get right up close." The trees never move; the gates did; the eye
    // noticed.
    //
    // carve does not need the appointment kept. A gate here is GEOGRAPHY --
    // the prediction still runs ONCE, at spawn (see the placement above), to
    // size the gap and the swing against the rider's current pace, and then
    // the gate is planted like a tree and stands still. The finish-line rule
    // survives intact because placement already tests `target > limitP`; it
    // was this loop that used to walk gates through it.

    // Crossings.
    const events = [];
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      const d = g.data;
      this._cross(d, events, 0, dt, t, rider, prevP, prevX);
      if (two) this._cross(d, events, 1, dt, t, two.rider, two.prevP, two.prevX);
      // The ground marker rises out of the haze rather than appearing, and stays
      // readable right up to the gate — it is what the line is aimed at.
      //
      // NEAREST OF THE TWO. One gate, one uFade, two cameras: the mark cannot
      // be hazed in one half and clear in the other without per-half uniforms,
      // so it resolves for whichever rider is closest. The error is in the
      // generous direction -- a gate that is already readable stays readable --
      // and with the riders inside a few hundred metres of each other it is
      // barely a shade.
      const ahead = d.p - p;
      const nearest = two ? Math.min(ahead, d.p - two.rider.p) : ahead;
      const near = clamp((200 - nearest) / 110, 0.08, 1);
      if (d.flash > 0) d.flash = Math.max(0, d.flash - dt * 2.6);
      // A passed gate sits at 0.2 and the flare rides on top, so the moment of
      // passing is the brightest the mark ever gets rather than the dimmest.
      // A boost gate's ground mark is brighter too — it is the part visible
      // first, rising out of the haze before the poles resolve.
      //
      // DIM ONLY WHEN BOTH ARE THROUGH. A single `passed` flag meant player
      // one's pass faded the mark to 0.2 for a player two who had not reached
      // it yet -- the gate went dull in his half while he was still aiming at
      // it.
      const spent = two ? (d.passed && d.passed2) : d.passed;
      const lit = spent ? 0.2 + d.flash * 1.6 : (d.boost ? 1.7 : 1);
      g.line.material.uniforms.uFade.value = near * lit;

      if (d.p - tailP < -DESPAWN_BEHIND) {
        g.active = false;
        g.setVisible(false);
        this.live.splice(i, 1);
      }
    }
    return events;
  }

  /**
   * Did THIS rider just cross this gate, and what did it cost or pay them?
   *
   * One player's crossing state cannot be the gate's crossing state. `passed`
   * belongs to player one and `passed2` to player two, and they are genuinely
   * independent: the same gate can be cleanly taken by one and missed by the
   * other, which is most of what a 1v1 race IS.
   *
   * `stats` and the per-gate diagnostics (`clean`, `uAt`, `hitT`) stay player
   * one's alone. They feed the results panel and the predictor measurements,
   * both of which are about the main player's run; player two's outcome rides
   * on the returned event, where the caller can decide what it is worth.
   */
  _cross(d, events, who, dt, t, rider, prevP, prevX) {
    const key = who === 0 ? 'passed' : 'passed2';
    if (d[key] || !(prevP < d.p && rider.p >= d.p)) return;
    // Interpolate the rider's lateral position at the exact crossing: at
    // 25 m/s a frame covers most of a metre, and the opening is only four
    // wide, so testing at the frame boundary would quietly steal passes.
    const k = (d.p - prevP) / Math.max(rider.p - prevP, 1e-6);
    const xc = prevX + (rider.x - prevX) * k;
    const uc = this.terrain.offsetOf(xc, -d.p);
    const inside = Math.abs(uc - d.u) <= d.half;
    d[key] = true;
    if (who === 0) {
      d.clean = inside;
      d.uAt = uc;
      // Interpolated, not sampled: at a low frame rate the frame boundary
      // alone would contribute more error than the predictor does, and this
      // number exists to measure the predictor.
      d.hitT = t - (1 - k) * dt;
      if (!d.boost) this.stats[inside ? 'passed' : 'missed']++;
    }
    // THE GATE ITSELF ANSWERS. Passing one used to dim its mark to 0.2 on
    // the same frame it was cleared, so the only acknowledgement at the gate
    // was that it stopped being visible — every other cue (a ring on the
    // progress bar, a short burst) was somewhere other than where the player
    // was looking. It flares first and fades after, which costs one float.
    //
    // THE FLARE IS THE GATE'S, NOT A PLAYER'S: one piece of geography, seen
    // in both halves, so it answers whoever rides through it.
    if (inside) d.flash = 1;
    events.push({
      type: d.boost ? (inside ? 'boost' : 'boostMiss') : (inside ? 'gate' : 'miss'),
      timed: this.timeGates && !d.boost,
      who,
      gate: d,
    });
  }

  /** A flawless run: every planned gate cleanly passed. */
  static par(plan) {
    return plan.length;
  }
}
