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
const SLAB_SIZE = [44, 165];            // metres across
const SLAB_RISE = [120, 290];           // metres above the fall line
// 260, up from 180. At 180 m out and 120 m up, the nearest slab subtends a
// wide enough angle that the camera sees it from almost directly underneath —
// all keel and no plate, which is the one view of an island that reads as a
// dark triangle rather than as ground.
const SLAB_OUT = [260, 820];            // metres of lateral offset from the centre line

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
 * One island, as a solid: an irregular plate with a keel under it.
 *
 * THE KEEL IS THE WHOLE SILHOUETTE. A floating disc is a UFO; a floating plate
 * with a broken taper hanging off the bottom of it is a piece of ground that
 * something tore out of the earth, and the difference is entirely in what you
 * see from below — which, since these all sit above the camera, is the only
 * part of them the player ever sees.
 *
 * Built at radius 1 and scaled per instance. FLAT SHADED, by leaving it
 * non-indexed and letting computeVertexNormals give every triangle its own
 * normal — the same look the range and the spires have, and the reason a
 * seven-sided plate reads as rock rather than as a low-poly placeholder.
 */
function buildIslandGeometry(seed, sides) {
  const rnd = mulberry32(seed);
  const r = [];
  for (let i = 0; i < sides; i++) r.push(range(rnd, 0.72, 1.0));
  const top = [];
  const rim = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    top.push(new THREE.Vector3(Math.cos(a) * r[i], range(rnd, -0.03, 0.06), Math.sin(a) * r[i]));
    // The rim sits slightly inside the plate and a little under it, so the top
    // edge is an overhang rather than a bevel. An overhang catches the key on
    // its upper face and leaves the one below it black, which is the read.
    rim.push(new THREE.Vector3(Math.cos(a) * r[i] * 0.88, -0.17, Math.sin(a) * r[i] * 0.88));
  }
  // The keel's tip is OFF CENTRE. A tip on the axis makes a cone, and a cone is
  // the one shape that looks identical from every bearing — thirty of them in a
  // frame and the set reads as a repeated prop. Leaning it buys a different
  // silhouette per island from the same geometry and the same draw call.
  const tip = new THREE.Vector3(range(rnd, -0.30, 0.30), -range(rnd, 1.5, 2.6),
    range(rnd, -0.30, 0.30));
  const centre = new THREE.Vector3(0, range(rnd, 0.02, 0.09), 0);

  const pos = [];
  const push = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    push(centre, top[i], top[j]);        // the plate
    push(top[i], rim[i], rim[j]);        // the overhang, two triangles
    push(top[i], rim[j], top[j]);
    push(rim[i], tip, rim[j]);           // the keel
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
    /** Append to main's `litMaterials` so the shared sun, fog and camera reach it. */
    this.materials = [this.mat];

    this.slabBands = Math.ceil(SLAB_VIEW / SLAB_BAND) + 2;
    this.chunkBands = Math.ceil(CHUNK_VIEW / CHUNK_BAND) + 2;
    this.slabs = this._pool(buildIslandGeometry(this.seed, 9),
      this.slabBands, SLAB_PER_BAND[1]);
    this.chunks = this._pool(buildIslandGeometry(this.seed ^ 0x9e37, 7),
      this.chunkBands, CHUNK_PER_BAND[1]);

    this.slabBase = NaN;
    this.chunkBase = NaN;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  _pool(geo, slots, perBand) {
    const capacity = slots * perBand;
    const mesh = new THREE.InstancedMesh(geo, this.mat, capacity);
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
      // NON-UNIFORM, but only a little — and the first cut had this backwards.
      // It squashed y to 0.42-0.70 on the argument that real islands are wide
      // and thin, which is true of the PLATE and false of the solid: the plate
      // is already thin by construction (the rim sits 0.17 under a top at 0),
      // and scaling y squashes the KEEL, which is the entire silhouette from
      // below and the only part the camera ever sees. The capture showed the
      // result exactly — flat dark shards with nothing hanging off them.
      //
      // So the keel got deeper in the geometry (1.5-2.6 radii, from 0.8-1.5)
      // and the squash is now a light 0.70-1.0, which is variation rather than
      // a flattening.
      this._s.set(size, size * range(rnd, 0.70, 1.0), size * range(rnd, 0.78, 1.0));
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
  }

  /** One band check per pool, and an early return on every frame but the few. */
  update(p) {
    if (!this.enabled) return;
    this._ring(this.slabs, 'slabBase', p,
      { band: SLAB_BAND, size: SLAB_SIZE, rise: SLAB_RISE, out: SLAB_OUT }, SLAB_PER_BAND);
    this._ring(this.chunks, 'chunkBase', p,
      { band: CHUNK_BAND, size: CHUNK_SIZE, rise: CHUNK_RISE, out: CHUNK_OUT }, CHUNK_PER_BAND);
  }

  /** A seek jumps `p`; force both rings rather than scrolling to the new place. */
  reset(p) {
    this.slabBase = NaN;
    this.chunkBase = NaN;
    this.update(p);
  }

  dispose() {
    for (const pool of [this.slabs, this.chunks]) {
      this.scene.remove(pool.mesh);
      pool.mesh.dispose();
      pool.geo.dispose();
    }
    this.mat.dispose();
  }
}
