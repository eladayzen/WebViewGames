// FLOATING ISLANDS — the thing in the distance that says this is not a mountain.
//
// ── WHY THEY ARE WORTH A MODULE ────────────────────────────────────────────
//
// The re-theme has spent its whole life fighting one problem: every surface in
// frame could be recoloured and the SHAPES still read alpine. A violet conifer
// is a conifer. A magenta sky over a groomed piste is a ski resort at sunset.
// The ground shader's rewrite is one half of the answer and this is the other,
// because an island hanging in the air is the one element in the picture that
// cannot be explained by any mountain: it is not a colour change, it is a
// statement about the physics of the place, and the eye takes it in the first
// frame without being told.
//
// It is also, deliberately, the CHEAPEST possible version of that statement —
// two draw calls, no per-frame work beyond a band check, and not one line of it
// touches anything the rider can collide with.
//
// ── TWO POOLS, AND WHY NOT ONE ─────────────────────────────────────────────
//
// SLABS are the subject: 26 to 90 m across, 110 to 240 m above the fall line,
// and 180 to 760 m out to either side. They are what the reference art has.
//
// CHUNKS are the thing that makes the slabs believable: 3 to 11 m, closer in
// and lower down, scattered between the slabs and the ground. A single size
// class of floating object reads as a backdrop plate however well it is drawn,
// because every one of them sits at the same apparent scale and the eye gets no
// depth cue from the set. A field with two size classes in it has a near and a
// far, and the near ones travel past the far ones as the rider descends, which
// is parallax — the only thing that actually proves an object is in the world
// and not painted on the sky.
//
// That is the same argument `range.js` makes for having three depth planes
// rather than one skyline, arrived at from the other end.
//
// ── NOT CAMERA-RELATIVE, UNLIKE THE RANGE ──────────────────────────────────
//
// `range.js` pins its rings to the camera, so the skyline never approaches: at
// a kilometre that is right, because a mountain a kilometre away does not
// visibly move in two and a half minutes of descent.
//
// These do move. A slab at 300 m passes the rider in about twelve seconds at
// race speed, and watching one go by is most of what they are for. So they are
// placed in WORLD space and recycled in bands the way the scatter, the drift
// lines and the drones are — a pure function of (band index, seed), so a run
// re-ridden from the same seed meets the same islands in the same places and
// nothing has to be remembered.
//
// ── AND THEY DO NOT MOVE ON THEIR OWN ──────────────────────────────────────
//
// The obvious embellishment is a slow bob, and it was costed and dropped. At
// the distances these live at, a believable 2 m of travel is under one pixel —
// it would buy nothing visible in exchange for rewriting every instance matrix
// every frame, which is the only per-frame cost this file could possibly have.
// `update` is a band check and an early return. Rotation was dropped for a
// different reason: a spinning island reads as machinery, not as geology.
//
// ── DIFFICULTY IS UNTOUCHED, AND THAT IS LOAD-BEARING ──────────────────────
//
// Nothing here has a collider, nothing is in `scatter.js`'s obstacle list, and
// the nearest a slab may come to the centre line is 180 m of lateral offset —
// nine times the half width of the bowl, so none of them is ever overhead and
// none of them is ever reachable. This file can be deleted and the game plays
// identically. That is the same rule `combat.js` holds itself to and for the
// same reason: a look change that quietly moves the balance is two changes
// wearing one commit message.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLitMaterial } from './lit.js';
import { mulberry32, range } from './rng.js';

// ── PLACEMENT ───────────────────────────────────────────────────────────────

// A slab band is long and the ring reaches far past the terrain's own VIEW of
// 560 m. That is the point: "in the distance" is the brief, and an island that
// pops into existence at the same range the ground does is an island that
// arrives with the ground. At 1440 m the haze has most of it (see FOG_MUL) and
// what is left is a silhouette resolving out of the air, which is how the
// reference's far ones read.
// MEASURED OFF THE FIRST CAPTURE, not guessed. The first numbers put three
// slabs in frame at 26-90 m and they read as dark flakes: individually too
// small to show a keel, and collectively too sparse to be a feature of the
// place rather than three objects that happen to be up there. The brief is
// "super dramatic — and in the distance, floating islands", and three flakes
// is not a sky with islands in it.
//
// So the band is shorter (170 m, from 220), the count per band has a FLOOR of
// one rather than zero — a band that rolled a zero left visible gaps in the
// field — and the size range moved up and widened to 44-165 m. The widening
// matters more than the raise: a set whose members are all within a factor of
// three of each other reads as one size class seen at one distance, which is
// the same depth-cue argument the two pools exist for, applied inside a pool.
const SLAB_BAND = 170;
const SLAB_VIEW = 1440;
const SLAB_PER_BAND = [1, 3];           // inclusive count drawn per band
/**
 * 110 TO 420 m, UP FROM 44 TO 165.
 *
 * "Those triangle islands don't look good enough and they are too small. They
 * should be like mountains that I can see the lower side of."
 *
 * The size is half of that note and the geometry is the other half. At 165 m
 * seen from six hundred away an island subtends about the angle a drone does
 * at forty — it reads as debris rather than as landscape, and no amount of
 * modelling on the underside survives being eight pixels tall. 420 m at the
 * same range is a MOUNTAIN with a root whose shape can be read.
 *
 * The spread is also wider, nearly four to one, for the reason the pools exist
 * at all: a set whose members are all within a factor of three of each other
 * reads as one size class at one distance and gives the eye no depth to take.
 */
const SLAB_SIZE = [110, 420];           // metres across
const SLAB_RISE = [140, 340];           // metres above the fall line
/**
 * AND WHERE THEY SIT WHEN THERE IS NO GROUND IN THE WAY.
 *
 * Normally everything is overhead because normally there is a mountain below
 * — an island at -140 m would be buried in it. With the terrain hidden (the
 * sky POC, see `_setGroundHidden` in main.js) that constraint is gone, and
 * putting slabs BELOW the rider is the single change that makes the mode read
 * as flight: the eye takes altitude from parallax underneath, and with
 * everything above, the lower half of the frame was an empty wash.
 */
const SLAB_RISE_SKY = [-240, 320];
const CHUNK_RISE_SKY = [-140, 170];

/**
 * ── AND A WORLD FAR BELOW ──────────────────────────────────────────────────
 *
 * "Now that I see so much of it, more of it should be interesting — we should
 * have environment far below us."
 *
 * A third pool, and it is a third pool rather than a wider spread on the slabs
 * for one reason: DISTANCE IS WHAT MAKES DEPTH READ. A slab at -240 m is near
 * enough to compete with the ground the rider is on. These sit four to eleven
 * hundred metres down and are the size of the thing they stand in for — a
 * landscape, not an object. From up here they are a floor a long way away,
 * which is the only honest way to say "high".
 *
 * They are also the one pool nearly always BELOW the horizon, so on the holo
 * level the field is drawn over them — and because that surface is additive
 * with depthWrite off, they show through it. That is why this is worth having
 * there specifically: a translucent floor with nothing under it is a
 * translucent floor over a void.
 */
// ── AND THE NUMBERS ARE SET BY WHAT THE CAMERA CAN SEE, NOT BY TASTE ───────
//
// The first cut put these 420 to 1150 m down and up to 2600 m out, which is
// exactly what "far below" sounds like and is invisible. Measured against the
// live rig: the nearest one sat 616 m under the camera at 932 m total, which
// is 41 degrees below the horizontal — and the frame reaches 38. Every one of
// the thirteen in front of the rider was under the bottom edge.
//
// There is also a HARD CEILING nobody can tune past: the camera's far plane is
// 1500 m, so a band further out than that is geometry built to be clipped.
//
// What a near-horizontal camera can actually show below itself is not straight
// down, it is FORWARD AND DOWN — the view out of an aircraft window. So the
// depth came up to 280-680 m and the ring was cut to the far plane, which puts
// the nearest at about 20 degrees under the horizon: low in frame, receding,
// and there.
const DEEP_BAND = 240;
const DEEP_VIEW = 1480;
const DEEP_PER_BAND = [1, 2];
const DEEP_SIZE = [420, 1250];
const DEEP_RISE = [-680, -280];
const DEEP_OUT = [0, 900];
// 260, up from 180. At 180 m out and 120 m up, the nearest slab subtends a
// wide enough angle that the camera sees it from almost directly underneath —
// all keel and no plate, which is the one view of an island that reads as a
// dark triangle rather than as ground.
// 240 TO 1000, and the NEAR end is the half that matters. Pushing the minimum
// out to 380 at the same time as tripling the size cancelled the size: a 420 m
// island at 900 m away subtends what a 165 m one did at 350. "They should be
// like mountains" is a statement about how much of the FRAME one fills, and
// that is distance as much as metres. The near ones now pass close enough to
// be looked up at.
const SLAB_OUT = [240, 1000];           // metres of lateral offset from the centre line

// Chunks are small, so there is no point carrying them to a kilometre — they
// are under a pixel long before the haze would have taken them. A shorter ring
// with more per band puts the whole budget where they can actually be seen.
const CHUNK_BAND = 90;
const CHUNK_VIEW = 620;
const CHUNK_PER_BAND = [2, 5];
const CHUNK_SIZE = [3.0, 11.0];
const CHUNK_RISE = [26, 150];
const CHUNK_OUT = [70, 420];

// HOW MUCH OF THE HOUR'S HAZE THEY STAND IN.
//
// `lit.js` fogs everything at the mood's own density, which is right for things
// standing on the ground: a tree at 400 m SHOULD be nearly gone. These are two
// to three times further out than anything else this shader draws, and at the
// ion storm's 0.0112 the honest number erases them completely — a feature that
// exists at two stops out of five is a feature nobody will believe is there.
//
// 0.34 is the fraction that keeps a slab readable at a kilometre through the
// thickest air in the table while still letting it recede: at the void's 0.0030
// a slab at 1440 m sits at 0.48 fog and at the storm's 0.0112 it is 0.87 —
// present, and clearly a long way off. Physically this is a cheat, and the
// honest reading of it is that a thing a kilometre up is looking through less
// of the valley's dust than a thing a kilometre along the valley floor, which
// happens to be true.
const FOG_MUL = 0.34;

/**
 * ONE FLOATING MOUNTAIN.
 *
 * ── WHAT THIS REPLACED, AND WHY IT DID NOT WORK ────────────────────────────
 *
 * The first version was an irregular plate with ONE off-centre keel hanging
 * under it, and in the frame it read as a flat dark triangle. Three reasons,
 * and only the third is obvious in hindsight:
 *
 *   EVERY ISLAND IS SEEN FROM BELOW. They sit above the rider, so the part
 *   facing the camera is almost always the underside — and the underside was
 *   a cone. A cone presents the same silhouette from every bearing, so thirty
 *   of them in a frame was one shape thirty times.
 *
 *   THE TOP WAS FLAT. The plate had no relief at all, which was defensible
 *   while the top was rarely visible and indefensible once the ground stopped
 *   being drawn and the eye had time to look.
 *
 *   AND THEY WERE TOO SMALL. 44 to 165 m reads as debris at the distances
 *   they live at. "They should be like mountains that I can see the lower side
 *   of" is a statement about SCALE as much as about shape.
 *
 * ── WHAT IT IS NOW ─────────────────────────────────────────────────────────
 *
 * A proper landmass: a summit with ridges running off it, a rim, and a ROOT —
 * the torn-out underside, which is the half that actually gets looked at.
 *
 * THE ROOT IS TRILOBED, not conical, and that is the whole fix. Its depth
 * varies around the circle on three lobes with jitter on top, so the island
 * has three descending spurs of different lengths meeting at a ragged point.
 * From any bearing one spur is long, one is short and one is behind: the
 * silhouette is different every time, which is what a cone could never be.
 *
 * Built at radius 1 and scaled per instance, FLAT SHADED by leaving it
 * non-indexed so every triangle takes its own normal — the look the range and
 * the spires already have, and the reason an eleven-sided mountain reads as
 * rock rather than as a low-poly placeholder.
 */
function buildIslandGeometry(seed, sides) {
  const rnd = mulberry32(seed);
  const S = sides;
  const pos = [];
  const push = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // Per-sector character, generated once so the whole island agrees with
  // itself: how far the rim reaches, how high the ground stands, how deep the
  // root hangs.
  const rim = [];
  const crest = [];
  const root = [];
  const lobe = rnd() * Math.PI * 2;
  for (let s = 0; s < S; s++) {
    const a = (s / S) * Math.PI * 2;
    rim.push(range(rnd, 0.74, 1.0));
    crest.push(range(rnd, 0.55, 1.0));
    // THREE LOBES. A root whose depth is constant is a cone; one that varies
    // smoothly on three lobes is a mountain with spurs, and the jitter stops
    // the three from being identical.
    root.push((0.42 + 0.58 * (0.5 + 0.5 * Math.cos(3 * a + lobe))) * range(rnd, 0.72, 1.12));
  }

  const PEAK = range(rnd, 0.34, 0.62);     // how far the summit stands over the rim
  const DEEP = range(rnd, 1.5, 2.6);       // how far the root hangs under it
  const at = (s, r, y) => {
    const a = ((s % S) / S) * Math.PI * 2;
    return V(Math.cos(a) * r, y, Math.sin(a) * r);
  };

  // ── the top: an apex, two rings of ground, and the rim ───────────────────
  const apex = V(range(rnd, -0.12, 0.12), PEAK, range(rnd, -0.12, 0.12));
  const TOP_R = [0.0, 0.42, 0.78, 1.0];
  const topY = (s, t) => (t === 0 ? PEAK : PEAK * crest[s % S] * (1 - TOP_R[t]) ** 1.5);
  for (let s = 0; s < S; s++) {
    const r1 = TOP_R[1] * rim[s];
    const r1b = TOP_R[1] * rim[(s + 1) % S];
    push(apex, at(s, r1, topY(s, 1)), at(s + 1, r1b, topY(s + 1, 1)));
    for (let t = 1; t < 3; t++) {
      const ra = TOP_R[t] * rim[s];
      const rb = TOP_R[t + 1] * rim[s];
      const rc = TOP_R[t] * rim[(s + 1) % S];
      const rd = TOP_R[t + 1] * rim[(s + 1) % S];
      const A = at(s, ra, topY(s, t));
      const B = at(s, rb, topY(s, t + 1));
      const C = at(s + 1, rc, topY(s + 1, t));
      const D = at(s + 1, rd, topY(s + 1, t + 1));
      push(A, B, D);
      push(A, D, C);
    }
  }

  // ── the root: four rings down to a ragged tip ────────────────────────────
  // The rings pull in fast at first and slowly after, which is what gives the
  // overhang under the rim — the part that catches the key and tells the eye
  // this is a solid that was torn out of something.
  const DN_R = [1.0, 0.86, 0.58, 0.30, 0.10];
  const dnY = (s, b) => -DEEP * root[s % S] * (DN_R[0] - DN_R[b]) ** 1.15;
  for (let s = 0; s < S; s++) {
    for (let b = 0; b < 4; b++) {
      const A = at(s, DN_R[b] * rim[s], dnY(s, b));
      const B = at(s, DN_R[b + 1] * rim[s], dnY(s, b + 1));
      const C = at(s + 1, DN_R[b] * rim[(s + 1) % S], dnY(s + 1, b));
      const D = at(s + 1, DN_R[b + 1] * rim[(s + 1) % S], dnY(s + 1, b + 1));
      push(A, B, D);
      push(A, D, C);
    }
  }
  // The tip. OFF AXIS, so the three spurs do not meet in a point that reads as
  // the apex of a cone.
  let deepest = 0;
  for (let s = 0; s < S; s++) deepest = Math.max(deepest, DEEP * root[s]);
  const tip = V(range(rnd, -0.14, 0.14), -deepest * 1.12, range(rnd, -0.14, 0.14));
  for (let s = 0; s < S; s++) {
    push(at(s, DN_R[4] * rim[s], dnY(s, 4)), tip,
      at(s + 1, DN_R[4] * rim[(s + 1) % S], dnY(s + 1, 4)));
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export class Islands {
  /**
   * @param {object} terrain the Terrain, for `baseHeight` and `centerX`
   * @param {THREE.Scene} scene
   * @param {import('./mood.js').Mood} mood
   */
  constructor(terrain, scene, mood, seed = 1) {
    this.terrain = terrain;
    this.scene = scene;
    this.seed = (seed ^ 0x51f3a2) >>> 0;
    this.enabled = true;

    // DARKER THAN THE GROUND IT IS TORN FROM, and that is not an aesthetic
    // choice — it is the only way a thing in the sky reads as solid.
    //
    // Everything else this shader draws is seen against the ground, which is
    // mid-value rock. These are seen against the SKY, which at every stop in
    // `mood.js` is the brightest thing in the frame. A slab painted the
    // ground's own colour would sit at roughly the sky's luminance and
    // dissolve into it; painted dark, it is a silhouette with a lit top edge,
    // which is what the reference shows and what reads at a kilometre.
    //
    // snowCap 0 for `scatter.js`'s reason: uSnowCap mixes upward faces toward
    // the GROUND colour, and a frosted cap is half of why the forest read
    // alpine whatever shape it was given.
    //
    // wrap 0.16, close to the ground shader's own 0.12 — these are made of the
    // same rock and a wide wrap would give them a soft terminator the ground
    // no longer has, which is exactly the mismatch `lit.js` exists to prevent.
    this.mat = makeLitMaterial(mood, {
      color: 0x241a33, wrap: 0.16, gloss: 28, specular: 0.22, emissive: 0.05, snowCap: 0,
    });
    this.mat.uniforms.uFogMul.value = FOG_MUL;
    // ── THE DEEP LAYER IS LIT DIFFERENTLY, BECAUSE IT IS SEEN DIFFERENTLY ──
    //
    // Everything above uses `mat`, which is nearly black on purpose: slabs and
    // chunks sit ABOVE the rider, so they are read as silhouettes against the
    // brightest thing in the frame, and a mid-tone one would dissolve into the
    // sky at every stop in the arc.
    //
    // The deep layer is the opposite case in every respect. It is below, so it
    // is seen from ABOVE against haze rather than against sky; the camera
    // looks down at its TOP, where the key actually lands; and it is standing
    // in for landscape rather than for an object. Drawn with the same material
    // it came back as a flat black plate under the floor — measured on the
    // first capture, and the single thing wrong with it.
    //
    // So: a mid tone that takes the light, and `snowCap` back ON, which is the
    // one place in this file it belongs. uSnowCap mixes upward faces toward
    // the GROUND colour, and these are the only islands whose upward faces are
    // visible — it is what makes their tops read as ground rather than as the
    // lid of a box.
    this.matDeep = makeLitMaterial(mood, {
      color: 0x4a4668, wrap: 0.30, gloss: 24, specular: 0.18, emissive: 0.03,
      snowCap: 0.55,
    });
    // HAZED HARDER THAN THE REST, at nearly twice FOG_MUL. They are the
    // furthest thing in the world that is not the far range, and distance is
    // the only thing that says how far down they are — a crisp landmass at
    // eight hundred metres reads as a nearby object at a strange angle.
    this.matDeep.uniforms.uFogMul.value = FOG_MUL * 1.9;
    /** Append to main's `litMaterials` so the shared sun, fog and camera reach it. */
    this.materials = [this.mat, this.matDeep];

    this.slabBands = Math.ceil(SLAB_VIEW / SLAB_BAND) + 2;
    this.chunkBands = Math.ceil(CHUNK_VIEW / CHUNK_BAND) + 2;
    this.deepBands = Math.ceil(DEEP_VIEW / DEEP_BAND) + 2;
    this.slabs = this._pool(buildIslandGeometry(this.seed, 9),
      this.slabBands, SLAB_PER_BAND[1]);
    this.chunks = this._pool(buildIslandGeometry(this.seed ^ 0x9e37, 7),
      this.chunkBands, CHUNK_PER_BAND[1]);
    // ITS OWN GEOMETRY, with more sides. A landmass a kilometre across seen
    // against the sky shows its silhouette and almost nothing else, so the one
    // thing worth spending triangles on down there is the outline.
    this.deep = this._pool(buildIslandGeometry(this.seed ^ 0x51ab, 13),
      this.deepBands, DEEP_PER_BAND[1], this.matDeep);

    this.slabBase = NaN;
    this.chunkBase = NaN;
    this.deepBase = NaN;
    /** Whether islands may sit below the fall line. See SLAB_RISE_SKY. */
    this.below = false;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  _pool(geo, slots, perBand, material = this.mat) {
    const capacity = slots * perBand;
    const mesh = new THREE.InstancedMesh(geo, material, capacity);
    // Every instance is placed hundreds of metres off the piste and the mesh's
    // own bounding sphere is a unit ball at the origin, so three.js's cull test
    // is meaningless here and would reject the whole pool.
    mesh.frustumCulled = false;
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    // `aTint` is a REQUIRED attribute under USE_INSTANCING in lit.js — without
    // it the vertex stage reads garbage and the pool renders black.
    geo.setAttribute('aTint', tint);
    this.scene.add(mesh);
    return { mesh, geo, tint, capacity, slots };
  }

  /**
   * Fill one band's slots. Pure in (band, seed): the same band rebuilt later in
   * the run comes back identical, which is what makes recycling invisible.
   */
  _buildBand(pool, band, cfg, perBand) {
    const rnd = mulberry32((this.seed ^ Math.imul(band + 10007, 0x9e3779b1)) >>> 0);
    const slot = ((band % pool.slots) + pool.slots) % pool.slots;
    const n = Math.round(range(rnd, perBand[0], perBand[1]));
    for (let i = 0; i < perBand[1]; i++) {
      const idx = slot * perBand[1] + i;
      if (i >= n) {
        this._hide(pool, idx);
        continue;
      }
      const p = band * cfg.band + range(rnd, 0, cfg.band);
      const size = range(rnd, cfg.size[0], cfg.size[1]);
      const side = rnd() < 0.5 ? -1 : 1;
      const out = range(rnd, cfg.out[0], cfg.out[1]) * side;
      this._p.set(this.terrain.centerX(-p) + out,
        this.terrain.baseHeight(p) + range(rnd, cfg.rise[0], cfg.rise[1]),
        -p);
      // Yaw only. A tilted island is a falling island, and these are not
      // falling; the lean already lives in the keel's off-centre tip.
      this._e.set(0, range(rnd, 0, Math.PI * 2), 0);
      this._q.setFromEuler(this._e);
      // NEARLY UNIFORM, and the history here is worth keeping because the
      // same mistake was made twice.
      //
      // The first cut squashed y to 0.42-0.70 on the argument that real
      // islands are wide and thin. That is true of the PLATE and false of the
      // solid: scaling y squashes the ROOT, which is the entire silhouette
      // from below and the only part the camera ever sees. The result was flat
      // dark shards with nothing hanging off them.
      //
      // It was relaxed to 0.70-1.0, which was still a flattening — the root is
      // now two and a half radii deep and carries ridges, and taking a third
      // off it takes the ridges with it. 0.88-1.12 is variation: some of these
      // are tall and some are squat, and none of them is crushed.
      this._s.set(size, size * range(rnd, 0.88, 1.12), size * range(rnd, 0.84, 1.0));
      this._m.compose(this._p, this._q, this._s);
      pool.mesh.setMatrixAt(idx, this._m);
      // A narrow tonal spread, not a colour one. The vocabulary rule in
      // `places.js` applies here as much as anywhere: these are scenery, and
      // scenery that takes a hue of its own starts competing with the things
      // that mean something. +-9% of value and nothing else.
      const t = range(rnd, 0.91, 1.09);
      pool.tint.setXYZ(idx, t, t, t);
    }
  }

  _hide(pool, idx) {
    this._m.makeScale(0, 0, 0);
    pool.mesh.setMatrixAt(idx, this._m);
  }

  _ring(pool, baseKey, p, cfg, perBand) {
    const want = Math.floor(p / cfg.band) - 1;
    const base = this[baseKey];
    if (want === base) return;
    if (!(want - base >= 0) || want - base >= pool.slots || want < base) {
      for (let i = 0; i < pool.slots; i++) this._buildBand(pool, want + i, cfg, perBand);
    } else {
      for (let k = base; k < want; k++) this._buildBand(pool, k + pool.slots, cfg, perBand);
    }
    this[baseKey] = want;
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.tint.needsUpdate = true;
  }

  setEnabled(v) {
    this.enabled = v;
    this.slabs.mesh.visible = v;
    this.chunks.mesh.visible = v;
    this.deep.mesh.visible = v && this.below;
  }

  /** One band check per pool, and an early return on every frame but the few. */
  update(p) {
    if (!this.enabled) return;
    this._ring(this.slabs, 'slabBase', p,
      { band: SLAB_BAND, size: SLAB_SIZE, out: SLAB_OUT,
        rise: this.below ? SLAB_RISE_SKY : SLAB_RISE }, SLAB_PER_BAND);
    this._ring(this.chunks, 'chunkBase', p,
      { band: CHUNK_BAND, size: CHUNK_SIZE, out: CHUNK_OUT,
        rise: this.below ? CHUNK_RISE_SKY : CHUNK_RISE }, CHUNK_PER_BAND);
    // ONLY WHERE THERE IS NO SOLID GROUND. On a normal run the mountain fills
    // everything under the rider, so a landmass at -800 m is a kilometre of
    // geometry nobody can see — and the shallowest of them would poke up
    // through the valley floor on the steeps.
    if (this.below) {
      this._ring(this.deep, 'deepBase', p,
        { band: DEEP_BAND, size: DEEP_SIZE, out: DEEP_OUT, rise: DEEP_RISE },
        DEEP_PER_BAND);
    }
  }

  /**
   * Allow islands under the rider, for a mode that does not draw the ground.
   *
   * The caller must `reset` after this: a band bakes its rise when it is
   * built, so the stretch already on the hill keeps the old spread until it
   * recycles — which is a hundred metres of the player's first impression.
   */
  setBelow(v) {
    this.below = !!v;
    this.deep.mesh.visible = this.enabled && this.below;
  }

  /** A seek jumps `p`; force both rings rather than scrolling to the new place. */
  reset(p) {
    this.slabBase = NaN;
    this.chunkBase = NaN;
    this.deepBase = NaN;
    this.update(p);
  }

  dispose() {
    for (const pool of [this.slabs, this.chunks, this.deep]) {
      this.scene.remove(pool.mesh);
      pool.mesh.dispose();
      pool.geo.dispose();
    }
    this.mat.dispose();
    this.matDeep.dispose();
  }
}
