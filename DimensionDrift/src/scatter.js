// Everything standing on the mountain: forest, rock, and the poles that mark the
// edge of the piste.
//
// All three are instanced and recycled in bands the same way the terrain chunks
// are, so a run of any length costs a fixed number of draw calls and a fixed
// amount of memory. Placement is a pure function of the band index and the seed:
// a band that scrolls off and comes back would be rebuilt identically, and
// nothing has to be remembered.
//
// The trees inside the piste are the game's only unfair-feeling hazard, so they
// are placed with a deliberate bias toward the outside of the bowl — the punish
// for over-carving into the wall, never something that appears on the racing
// line without warning.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLitMaterial } from './lit.js';
import { HALF, VIEW, meshHeight } from './mountain.js';
import { mulberry32, range, clamp } from './rng.js';

export const BAND = 40;                 // metres of descent per placement band
const TREES_PER_BAND = 90;
/**
 * How many tree slots each band ALLOCATES, as opposed to how many it uses.
 *
 * A place sets the live density (`treesPerBand`) and this is the ceiling it may
 * ask for. They have to be separate numbers: instances live in fixed per-band
 * slots -- `slot * TREES_CAP + i` -- so the stride is baked into every index
 * and cannot move once the pool exists. Sized for the densest place rather than
 * the default one; the spare slots cost a 64-byte matrix each and are scaled to
 * nothing by `hide`.
 */
const TREES_CAP = 240;
// Two ABSOLUTE per-band counts that the band total must not carry with it.
// Tripling the forest is a look change; tripling the number of trees a rider can
// hit, or the number standing in the recovery margin just beyond the rim, is a
// difficulty change. Both are held at what forty trees a band used to deliver.
const INSIDE_TREES = 2.4;               // trees standing inside the piste, per band
const MARGIN_TREES = 2.6;               // trees in the recovery margin, per band
const ROCKS_PER_BAND = 7;
const POLE_SPACING = 10;
const TREELINE = 88;                    // metres of rise above the centre line

const TREE_R = 0.75;                    // collision radius, metres

/**
 * OBSTACLE TREES — the race's blockers, and off by default.
 *
 * The scatter keeps trees out of the racing line on purpose: "Gates reach 0.55
 * of the half width, so anything closer in than about 0.8 is not a hazard the
 * racing line can be expected to dodge — it is one it is aimed straight at."
 * That is exactly right for a descent scored on a clock, where being stopped
 * dead is a charge against the only resource you have.
 *
 * A race is the case that inverts it. There is no clock to charge, the cost of
 * hitting one is ground lost to four riders who did not, and a course with
 * nothing to avoid is a throttle test. So the race turns this on and gets trees
 * it IS aimed at.
 *
 * `OBSTACLES_PER_BAND` AT 40 m A BAND, and it is fractional on purpose: 1.5
 * means one in every band plus a second in half of them, which is a rhythm
 * rather than a metronome. A whole number here reads as a pattern — a rider
 * learns "one per band" in about fifteen seconds and stops looking.
 *
 * It has been raised twice: one per 120 m, then one per 40 m, now 1.5 per 40 m.
 * At racing speed that is about one a second, which is no longer a decision
 * every few seconds but the texture of the course — a line to hold rather than
 * a series of dodges.
 *
 * `OBSTACLE_U` keeps them inside the line the gates use (gates reach 15.4 m)
 * so they are genuinely in the way, and `OBSTACLE_CLEAR` is the room a gate
 * demands around itself — see `Course.isBlocked`.
 */
const OBSTACLES_PER_BAND = 1.5;
const OBSTACLE_U = 15;
const OBSTACLE_CLEAR = 3.2;
const ROCK_R = 1.35;
const RIDER_R = 0.55;

const INSIDE_P = INSIDE_TREES / TREES_PER_BAND;
const MARGIN_P = MARGIN_TREES / (TREES_PER_BAND * (1 - INSIDE_P));

/**
 * ── THE FOREST IS CRYSTAL ───────────────────────────────────────────────────
 *
 * What stood here was a laden conifer, and it was the single most alpine object
 * in the frame: ninety a band, on both walls, in every shot. The palette could
 * not touch it. A violet sky over a stand of snowy pines is a ski slope at
 * dusk, which is what the first Dimension X captures came back as.
 *
 * THE IDENTIFIERS STILL SAY TREE, deliberately. `trees`, `treesPerBand`,
 * `TREE_R`, `kind: 'tree'` and the race's obstacle set are the game's word for
 * "the standing thing that blocks you", and they are read by `places.js`,
 * `modes/race.js`, the collision list and the HUD. Renaming the concept is a
 * refactor across five files that changes no pixel; changing the species is
 * this function. Only the builder is renamed, so a reader who greps for `tree`
 * still finds every placement rule where it has always been.
 *
 * NOTHING ABOUT DIFFICULTY MOVED. `TREE_R` is still 0.75 m, the density, the
 * clumping, the reach, the inside-piste and margin counts and the race's
 * blockers are all untouched — a spire stands exactly where a conifer stood and
 * costs exactly the same to hit. The one honest difference is that the conifer
 * overhung its own collision radius two to one (a 1.5 m bottom whorl around a
 * 0.75 m hit circle), so its outer branches were scenery you rode through. The
 * spire's cluster spans about 1.05 m, so what looks solid very nearly is.
 *
 * NO SNOW. `matTree` carried `snowCap: 0.80`, which mixes a surface toward the
 * GROUND colour on upward-facing normals — one line, and it is half of why the
 * forest read as snowy whatever shape it was. It is 0 here, and the ninety
 * lines of solved constants that aimed every branch normal at that gate
 * (LOADED, TIP_NY, BARE_NY, LOAD_CORE, BARE_CORE, the per-arm authoring) are
 * gone with it rather than left to mislead. They were real findings and they
 * are still in carve, which still has snow to put on them.
 */
const SPIRE_SINK = 0.55;                // metres of shard below the origin

/**
 * The cluster: one leader and five lesser shards around it, each `lean`
 * radians out from vertical at bearing `az` and standing `off` metres from the
 * axis. Heights fall off fast on purpose — six shards of a similar size is a
 * bundle of sticks, and the silhouette that reads at speed is one spike with a
 * broken skirt at its foot, which is also what the conifer's outline was.
 */
const SHARDS = [
  { r: 0.58, h: 3.40, seg: 5, az: 0.00, off: 0.00, lean: 0.05 },
  { r: 0.43, h: 2.05, seg: 5, az: 1.30, off: 0.52, lean: 0.30 },
  { r: 0.37, h: 1.52, seg: 4, az: 2.90, off: 0.64, lean: 0.38 },
  { r: 0.31, h: 1.08, seg: 4, az: 4.40, off: 0.60, lean: 0.44 },
  { r: 0.25, h: 0.74, seg: 4, az: 5.50, off: 0.72, lean: 0.52 },
  { r: 0.20, h: 0.52, seg: 4, az: 0.70, off: 0.80, lean: 0.60 },
];

/**
 * One shard: a faceted shaft that tapers to a point.
 *
 * THE CROSS-SECTION IS NOT A REGULAR POLYGON. A `seg`-sided prism of equal
 * radii is a traffic cone however sharply it tapers — the eye reads the even
 * spacing before it reads anything else. Each bearing gets its own radius
 * multiplier, held in `k` so the shaft and the point above it agree at the seam
 * they share: one face wide and its neighbour narrow is what makes the facets
 * catch the light at different angles, which is the whole reason a crystal
 * looks like one.
 *
 * Open-ended, both parts. The bottom is below the ground and the top is the
 * apex, so no cap is ever seen and every cap is a triangle fan nobody draws.
 */
function shard(rBase, h, seg, rand) {
  const rTip = rBase * range(rand, 0.10, 0.26);
  const hTip = rBase * range(rand, 1.7, 3.2);
  const shaft = new THREE.CylinderGeometry(rTip, rBase, h, seg, 1, true).toNonIndexed();
  const point = new THREE.ConeGeometry(rTip, hTip, seg, 1, true).toNonIndexed();
  shaft.translate(0, h * 0.5, 0);
  point.translate(0, h + hTip * 0.5, 0);
  const k = [];
  for (let i = 0; i < seg; i++) k.push(range(rand, 0.70, 1.28));
  for (const g of [shaft, point]) {
    const p = g.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v);
      const z = p.getZ(v);
      // The apex sits on the axis and has no bearing to look up.
      if (Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) continue;
      const i = ((Math.round((Math.atan2(z, x) / (Math.PI * 2)) * seg) % seg) + seg) % seg;
      p.setXYZ(v, x * k[i], p.getY(v), z * k[i]);
    }
  }
  return [shaft, point];
}

function buildSpireGeometry(rand) {
  const parts = [];
  for (const s of SHARDS) {
    // Jittered once, at build time. Every spire shares this geometry, so this
    // buys an irregular cluster rather than per-instance variety — that comes
    // from the instance scale and tint, exactly as it did for the conifer.
    const rBase = s.r * range(rand, 0.86, 1.14);
    const h = s.h * range(rand, 0.88, 1.12);
    const az = s.az + range(rand, -0.45, 0.45);
    for (const g of shard(rBase, h, s.seg, rand)) {
      // Lean first, then swing to the bearing, then step out along it: the
      // whole cluster splays AWAY from the axis rather than all one way.
      g.rotateZ(range(rand, 0.5, 1) * s.lean);
      g.rotateY(-az);
      parts.push(g.translate(Math.cos(az) * s.off, -SPIRE_SINK, Math.sin(az) * s.off));
    }
  }
  const g = mergeGeometries(parts, false);
  // FLAT, not smooth. The merged shards arrive with the normals of a surface of
  // revolution, which rounds each facet off and gives the cluster a waxy look;
  // recomputing them per triangle is what makes the faces read as faces.
  g.computeVertexNormals();
  return g;
}

function buildRockGeometry(rand) {
  const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const pos = g.attributes.position.array;
  // Jitter per unique vertex position so shared corners stay welded, then flat
  // shade — a rock wants facets, not a smooth ball.
  const seen = new Map();
  for (let i = 0; i < pos.length; i += 3) {
    const key = `${pos[i].toFixed(3)},${pos[i + 1].toFixed(3)},${pos[i + 2].toFixed(3)}`;
    let j = seen.get(key);
    if (!j) {
      j = [range(rand, 0.62, 1.30), range(rand, 0.5, 0.95), range(rand, 0.62, 1.30)];
      seen.set(key, j);
    }
    pos[i] *= j[0];
    pos[i + 1] *= j[1];
    pos[i + 2] *= j[2];
  }
  g.computeVertexNormals();
  return g;
}

function buildPoleGeometry() {
  const parts = [];
  // Shorter than they were, so that three times as many of them read as a run of
  // marking rather than as a row of objects — but NOT thinner. The reference's
  // markers are a one-to-two pixel line and ours were taken there first; at that
  // width the post chain's chromatic aberration was the only thing left of them,
  // and a piste edge marked in green dashes is worse than one marked in orange.
  const shaft = new THREE.CylinderGeometry(0.068, 0.084, 1.86, 5, 1, true);
  shaft.translate(0, 0.93, 0);
  parts.push(shaft);
  // Closed, and it stays closed: the top disc is the only N.y = 1 surface on the
  // pole, and it is what makes the tip read brighter than the shaft — in snow
  // rather than in pigment, which is how the reference does it.
  const cap = new THREE.CylinderGeometry(0.088, 0.088, 0.30, 5, 1);
  cap.translate(0, 1.72, 0);
  parts.push(cap);
  return mergeGeometries(parts, false);
}

class InstancePool {
  constructor(geometry, material, capacity, scene) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    geometry.setAttribute('aTint', this.tint);
    this.capacity = capacity;
    this.count = 0;
    scene.add(this.mesh);
  }

  hide(i) {
    // Scale to nothing rather than shrinking the draw count: instances live in
    // fixed per-band slots, so the used set is not contiguous.
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, m);
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

export class Scatter {
  constructor(terrain, scene, mood, seed) {
    this.terrain = terrain;
    this.seed = seed;
    this.bands = Math.ceil(VIEW / BAND) + 2;

    // THE SPIRES. `snowCap: 0` is the point of this line: at 0.80 every upward
    // face mixed toward the GROUND colour, which frosts a crystal exactly the
    // way it frosted a conifer and is half of why the forest read as alpine
    // whatever shape it was.
    //
    // EMISSIVE 0.9, AND IT IS NOT A TYPO NEXT TO THE 0.10 SPECULAR IT REPLACED.
    // `lit.js` adds `albedo * uEmissive`, so the scalar is multiplied by a
    // colour, not by white: on an albedo this dark, 0.30 added two percent of
    // one and the first spires came back as black spikes. 0.9 lands the glow at
    // roughly the lit faces' own brightness, which is a stone with light inside
    // it rather than a lamp.
    //
    // It is flat across the whole material, so it cannot be put at the tips
    // only — the buried base lifts as much as the point. That is the ceiling on
    // it: much past 1 and ninety of these a band stop being scenery and start
    // competing with the gates, which are the things a player has to read.
    //
    // The flash is `specular` with a tight `gloss` lobe, up from the conifer's
    // 0.10/14. A facet catches the key for the moment the camera crosses it and
    // goes dark again, which is what says crystal at speed; a conifer wanted the
    // opposite and got a broad dull lobe.
    this.matTree = makeLitMaterial(mood, {
      color: 0x4c3a92, wrap: 0.30, gloss: 52, specular: 0.60, snowCap: 0, emissive: 0.9,
    });
    this.matRock = makeLitMaterial(mood, {
      color: 0x3a3a42, wrap: 0.4, gloss: 18, specular: 0.16, snowCap: 0.55,
    });
    // No orange. The reference frame contains 41 pixels total above R-B > 20 and
    // every one of them is a gate flag; its marker poles measure R-B of -20 to
    // -46, i.e. cooler than neutral. Ours were an invention, and an emissive one.
    this.matPole = makeLitMaterial(mood, {
      color: 0x39425c, wrap: 0.5, gloss: 30, specular: 0.20, snowCap: 0.90,
    });
    this.materials = [this.matTree, this.matRock, this.matPole];

    const rand = mulberry32(seed ^ 0x51ed);
    this.trees = new InstancePool(buildSpireGeometry(mulberry32(seed ^ 0x7ee3)), this.matTree,
      this.bands * TREES_CAP, scene);
    /**
     * LIVE DENSITY, set by the place. The forest is the thing that most changes
     * how a stretch of this mountain plays: it narrows the line you can hold,
     * and in the race it is what breaks a boost chain. See `places.js`.
     */
    this.treesPerBand = TREES_PER_BAND;
    /** Trees planted ON the racing line, per band. Race only. */
    this.obstaclesPerBand = OBSTACLES_PER_BAND;
    /**
     * ── LAYOUT, AS OPPOSED TO DENSITY ──────────────────────────────────────
     *
     * "We need the layout of the boosters and the trees to feel really
     * different in different levels." Density alone changes how MUCH forest
     * there is and leaves its character identical: the same even spatter,
     * thicker. These three change where it stands.
     *
     *   treeClump  0 is the even spatter this has always been; 1 pulls every
     *              tree toward one of four STANDS per band, so the forest
     *              arrives in thickets with real gaps between them and the
     *              line through it is something you can read ahead.
     *   treeReach  scales how far out the whole distribution sits. Under 1 the
     *              treeline crowds the corridor; over 1 it retreats and the
     *              same count reads as open country with woods on the edges.
     *   obstacleU  how wide across the racing line the race's blockers are
     *              scattered. Narrow means they sit where you want to ride.
     */
    this.treeClump = 0;
    this.treeReach = 1;
    this.obstacleU = OBSTACLE_U;
    /**
     * METRES EITHER SIDE OF THE CENTRE LINE KEPT CLEAR of blockers.
     *
     * Blockers were drawn uniformly across the whole band, centre included, and
     * at a high count that fills the middle: "too many trees in the middle, it
     * creates this one lane where I should just stay in it". A dense uniform
     * scatter does not read as a forest to pick a line through -- it reads as a
     * single gap, and once the player has found it there is no reason to leave.
     *
     * With a gap down the middle the same trees become two flanks with a road
     * between them, which is a shape rather than a mess. It only does its job
     * next to a wide `gateAmp`: the path is what you ride, and the gates either
     * side are the reason to keep crossing it.
     */
    this.obstacleGap = 0;
    this.rocks = new InstancePool(buildRockGeometry(rand), this.matRock,
      this.bands * ROCKS_PER_BAND, scene);
    this.poles = new InstancePool(buildPoleGeometry(), this.matPole,
      this.bands * Math.ceil(BAND / POLE_SPACING) * 2 + 8, scene);

    /** Race-only: trees planted ON the racing line. See OBSTACLES_PER_BAND. */
    this.obstacles = false;
    /** No obstacle tree before this p — the start line stays clear. */
    this.obstacleFromP = -Infinity;
    /** Per-band collider lists, indexed by band slot. */
    this.colliders = new Array(this.bands).fill(null).map(() => []);
    this.baseBand = -1e9;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /**
   * Metres of rise above the centre line if a tree could stand here, else -1.
   *
   * The old cut at 52 m stopped the forest a little over halfway up the wall,
   * and what carried on above it was `mountain.js` rock noise — texture standing
   * in for vegetation. A dark-cover census could not tell the difference; the
   * frame could. In the reference the speckle runs to the crest and it is trees
   * all the way, getting smaller.
   */
  _plantable(x, z) {
    const g = this.terrain.gradient(x, z);
    const steep = Math.hypot(g.gx, g.gz);
    if (steep > 1.05) return -1;                          // cliff
    const rise = this.terrain.height(x, z) - this.terrain.height(this.terrain.centerX(z), z);
    if (rise > TREELINE) return -1;
    return rise;
  }

  _buildBand(bandIdx) {
    const slot = ((bandIdx % this.bands) + this.bands) % this.bands;
    const rand = mulberry32((this.seed ^ (bandIdx * 0x9e3779b1)) >>> 0);
    const p0 = bandIdx * BAND;
    const list = [];

    // ── trees ───────────────────────────────────────────────────────────
    // THE BAND'S STANDS, drawn from their OWN generator rather than from
    // `rand`. Using the band's stream would shift every draw after it, so
    // turning clumping on would silently move the rocks and the obstacles too
    // -- and a band that scrolls off and returns has to be identical either
    // way. Keyed on the band index, so a stand is in the same place every time
    // that band is built.
    const clump = this.treeClump;
    let stands = null;
    if (clump > 0) {
      const sr = mulberry32(((bandIdx * 0x2545f491) ^ 0x9e37) >>> 0);
      stands = [];
      for (let k = 0; k < 4; k++) {
        stands.push({
          u: range(sr, HALF * 1.05, HALF * 2.9) * (sr() < 0.5 ? -1 : 1),
          p: p0 + sr() * BAND,
        });
      }
    }

    for (let i = 0; i < TREES_CAP; i++) {
      const gi = slot * TREES_CAP + i;
      // Everything past the live density is scaled to nothing rather than left
      // holding whatever the last place put there.
      if (i >= this.treesPerBand) { this.trees.hide(gi); continue; }
      let pz = p0 + rand() * BAND;
      // Most of the forest is off-piste; a handful stand inside the bowl, always
      // out toward the wall where an over-cooked turn would carry you.
      // Inside the piste only out near the rim. Gates reach 0.55 of the half
      // width, so anything closer in than about 0.8 is not a hazard the racing
      // line can be expected to dodge — it is one it is aimed straight at.
      const inside = rand() < INSIDE_P;
      // The first half-piste beyond the rim is a RECOVERY margin, kept nearly
      // clear: a rider fighting back from the wall arrives slow, with little
      // steering authority, and a dense treeline there turned one mistake into
      // three wipeouts in four seconds — an off-piste death sentence rather
      // than a scare. The real forest stands further out, where only a rider
      // who kept going deserves to meet it.
      //
      // Which is why this is a probability derived from an absolute count, not
      // the fixed 0.07 it used to be: tripling the band total while holding the
      // fraction would have tripled the population of the margin, and it is the
      // margin's EMPTINESS that the finding was about.
      //
      // Most of the rest is pulled in to 2.3 half-widths with only a quarter of
      // the tail running out to 3.4. At 412 px the portrait frustum is 30° wide,
      // and a tree 109 m off the centre line does not enter it until 407 m of
      // depth, by which point the fog has eaten it — which is why the shipping
      // aspect ratio had five times less scenery in it than the landscape one.
      let u = inside
        ? (rand() < 0.5 ? -1 : 1) * range(rand, HALF * 0.80, HALF * 0.97)
        : (rand() < 0.5 ? -1 : 1)
          * (rand() < MARGIN_P
            ? range(rand, HALF * 1.10, HALF * 1.5)
            : rand() < 0.25
              ? range(rand, HALF * 2.3, HALF * 3.4)
              : range(rand, HALF * 1.5, HALF * 2.3));
      // Reach scales the OFF-PISTE tree only. The handful standing inside the
      // bowl are placed against the rim on purpose -- they are the hazard a
      // wide turn meets -- and moving them is a gameplay change rather than a
      // layout one.
      if (!inside && this.treeReach !== 1) u *= this.treeReach;
      if (stands && !inside) {
        // Toward this tree's stand, and never across the centre line: a stand
        // on the left staying on the left is what makes it read as a wood
        // rather than as noise with a bias.
        const st = stands[i & 3];
        if (Math.sign(st.u) === Math.sign(u)) {
          u += (st.u - u) * clump;
          pz += (st.p - pz) * clump;
        }
        // Clumping must never push a tree onto the piste -- a thicket in the
        // corridor is not a layout, it is a wall.
        const lim = HALF * 1.02;
        if (Math.abs(u) < lim) u = Math.sign(u || 1) * lim;
      }
      const z = -pz;
      const x = this.terrain.xAt(u, z);
      const rise = this._plantable(x, z);
      if (rise < 0) { this.trees.hide(gi); continue; }

      // meshHeight, not terrain.height: off the piste the columns are metres
      // apart and the tessellated surface sags well below the analytic one, which
      // left trees standing in mid-air over every convex rise.
      const y = meshHeight(this.terrain, x, z);
      // Off the piste the size spread is 4.5x and thins with altitude, which is
      // the reference's distribution (6-53 px around a median of 12). Inside the
      // piste the old spread stands untouched: `scale` is also the collider
      // radius, and a rider's hazards are not a look decision.
      const scale = inside
        ? range(rand, 0.72, 1.55) * 0.9
        : range(rand, 0.40, 1.80) * (1 - 0.45 * clamp(rise / TREELINE, 0, 1));
      // Taller than it is wide, per instance. The silhouette read squat at 1.20
      // aspect against the reference's 1.65, and squareness is most of what made
      // a stand of these look like one shape repeated.
      const sy = scale * range(rand, 1.00, 1.20);
      const sxz = scale * range(rand, 0.72, 0.90);
      // Sunk in proportion, not by a fixed 0.45: the spread now reaches down to
      // 0.4 scale, and a flat 0.45 m buried the lowest whorl of every small tree.
      this._v.set(x, y - (0.20 + 0.28 * sy), z);
      this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      this._s.set(sxz * range(rand, 0.94, 1.06), sy, sxz * range(rand, 0.94, 1.06));
      this._m.compose(this._v, this._q, this._s);
      this.trees.mesh.setMatrixAt(gi, this._m);
      // HUE AS WELL AS BRIGHTNESS, which is the opposite of what the conifer
      // wanted. That tint varied only toward blue and never toward green,
      // because a saturated hue on a tree was the one thing the alpine
      // reference did not have. A crystal field is the case that inverts it:
      // one violet repeated ninety times a band is a bought asset placed
      // ninety times, and the cheapest cure is that no two neighbours are the
      // same stone. The swing runs violet to magenta to cold blue, which are
      // the hues the mood ring already travels through, so a stand lights
      // coherently at every stop instead of fighting one of them.
      const shade = range(rand, 0.55, 1.25);
      const warm = range(rand, 0.80, 1.30);          // toward magenta
      const cool = range(rand, 0.80, 1.30);          // toward cold blue
      this.trees.tint.setXYZ(gi, shade * warm, shade * range(rand, 0.84, 1.0), shade * cool);
      list.push({ x, z, r: TREE_R * scale + RIDER_R, kind: 'tree' });
    }

    // ── obstacle trees, on the line ──────────────────────────────────────
    // Placed from the band index so a band that scrolls off and comes back is
    // identical, exactly like everything else here — and so the race's course
    // is a property of WHERE on the mountain it is, which is what makes each
    // race a different one.
    // The fractional part is a coin flip, so the count is 1 or 2 per band and
    // averages `OBSTACLES_PER_BAND`. Drawn from the band's own `rand`, so a
    // band that scrolls off and comes back has the same trees in it.
    const nObs = this.obstacles && p0 >= this.obstacleFromP
      ? Math.floor(this.obstaclesPerBand) + (rand() < (this.obstaclesPerBand % 1) ? 1 : 0)
      : 0;
    for (let oi = 0; oi < nObs; oi++) {
      // The top of the LIVE set, not of the pool -- obstacles overwrite the
      // last few off-piste trees, and at a low density the pool's top slots are
      // hidden ones that nothing would see.
      const gi = slot * TREES_CAP + (this.treesPerBand - 1 - oi);
      const p = p0 + rand() * BAND;
      const z = -p;
      // In the band between the clear path and the outer limit, on a side
      // drawn independently -- so the two flanks fill at the same rate rather
      // than one getting every tree a coin flip happened to send it.
      const u = (rand() < 0.5 ? -1 : 1)
        * range(rand, this.obstacleGap, Math.max(this.obstacleGap + 1, this.obstacleU));
      const x = this.terrain.xAt(u, z);
      const y = meshHeight(this.terrain, x, z);
      // Full size and no smaller. A blocker has to read from a distance — the
      // whole reason it is a tree and not a boulder — and the inside-piste
      // spread tops out well below what the off-piste forest uses.
      const sy = range(rand, 1.35, 1.75);
      const sxz = range(rand, 0.86, 1.02);
      this._v.set(x, y - (0.20 + 0.28 * sy), z);
      this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      this._s.set(sxz, sy, sxz);
      this._m.compose(this._v, this._q, this._s);
      this.trees.mesh.setMatrixAt(gi, this._m);
      this.trees.tint.setXYZ(gi, 0.62, 0.72, 0.86);
      list.push({ x, z, r: TREE_R * sxz + RIDER_R, kind: 'tree', obstacle: true, u });
    }

    // ── rocks ───────────────────────────────────────────────────────────
    for (let i = 0; i < ROCKS_PER_BAND; i++) {
      const gi = slot * ROCKS_PER_BAND + i;
      const p = p0 + rand() * BAND;
      const z = -p;
      // NO BOULDER INSIDE THE BOWL. They used to spawn `inside` 12% of the
      // time between 0.74 and 0.95 of the half width — 23.7 to 30.4 m, within
      // the rideable 32 — and a boulder is a LOW obstacle: it does not break
      // the skyline the way a tree does, so it is read late or not at all, and
      // the gates only reach 17.6 m so nothing about the racing line teaches
      // you to expect one out there. Asked for directly: "clean the track from
      // low hight barriers - keep only the trees."
      //
      // They stay on the mountain, because the rock fields are half of what
      // makes the off-piste look like a mountain rather than a ski run. They
      // are simply beyond the rim now, where a rider who reaches them is
      // already in the trees and already knows it.
      const u = (rand() < 0.5 ? -1 : 1)
        * (rand() < 0.08
          ? range(rand, HALF * 1.1, HALF * 1.5)
          : range(rand, HALF * 1.5, HALF * 3.0));
      const inside = false;
      const x = this.terrain.xAt(u, z);
      if (this._plantable(x, z) < 0) { this.rocks.hide(gi); continue; }
      const y = meshHeight(this.terrain, x, z);
      const scale = range(rand, 0.85, 2.4) * (inside ? 0.75 : 1);
      this._v.set(x, y - scale * 0.42, z);
      this._q.setFromEuler(new THREE.Euler(rand() * 0.6, rand() * 6.28, rand() * 0.6));
      this._s.set(scale, scale * range(rand, 0.6, 1.0), scale);
      this._m.compose(this._v, this._q, this._s);
      this.rocks.mesh.setMatrixAt(gi, this._m);
      const shade = range(rand, 0.75, 1.25);
      this.rocks.tint.setXYZ(gi, shade, shade, shade * 1.06);
      list.push({ x, z, r: ROCK_R * scale * 0.7 + RIDER_R, kind: 'rock' });
    }

    // ── edge poles ──────────────────────────────────────────────────────
    const perBand = Math.ceil(BAND / POLE_SPACING);
    for (let i = 0; i < perBand; i++) {
      for (let side = 0; side < 2; side++) {
        const gi = (slot * perBand + i) * 2 + side;
        if (gi >= this.poles.capacity) continue;
        const p = p0 + i * POLE_SPACING;
        const z = -p;
        const u = (side ? 1 : -1) * HALF * 0.99;
        const x = this.terrain.xAt(u, z);
        const y = meshHeight(this.terrain, x, z);
        this._v.set(x, y - 0.15, z);
        this._q.identity();
        this._s.set(1, 1, 1);
        this._m.compose(this._v, this._q, this._s);
        this.poles.mesh.setMatrixAt(gi, this._m);
        this.poles.tint.setXYZ(gi, 1, 1, 1);
      }
    }

    this.colliders[slot] = list;
  }

  _flush() {
    for (const pool of [this.trees, this.rocks, this.poles]) {
      pool.mesh.instanceMatrix.needsUpdate = true;
      pool.tint.needsUpdate = true;
    }
  }

  /**
   * Is anything an obstacle sitting within `clear` metres of this spot?
   *
   * Used by `Course` before it commits a gate: a tree inside a gate's opening
   * makes the gate untakeable, and in a race the gate is the whole reward.
   * Only OBSTACLE trees are consulted — the forest out at the rim is not in
   * anybody's way and excluding a gate because of it would thin the course for
   * no reason.
   */
  /**
   * Walk the obstacle trees near a distance down the mountain.
   *
   * `blocksGate` answers "is this a bad place to PUT a gate" and is deliberately
   * generous about p -- 26 m either way -- because a gate is a thing you aim at
   * from a long way off. A rival needs two different questions from the same
   * data: "am I hitting this right now" and "is there one coming", and neither
   * of them wants a 52 m window. So the walk is shared and the tests are not.
   *
   * @param {(c:object, dp:number) => boolean} fn return true to stop.
   */
  eachObstacle(p, span, fn) {
    const first = Math.floor((p - span) / BAND) - 1;
    const last = Math.floor((p + span) / BAND) + 1;
    for (let b = first; b <= last; b++) {
      const list = this.colliders[((b % this.bands) + this.bands) % this.bands];
      if (!list) continue;
      for (const c of list) {
        if (!c.obstacle) continue;
        const dp = -c.z - p;
        if (dp < -span || dp > span) continue;
        if (fn(c, dp)) return true;
      }
    }
    return false;
  }

  /**
   * Is a rider at (p, u) inside an obstacle tree right now?
   *
   * The collider's own `r` already carries the rider's radius (see where the
   * trees are pushed), so this is the same test the player's collision uses
   * rather than a second opinion about how big a tree is.
   */
  hitObstacle(p, u) {
    let hit = null;
    this.eachObstacle(p, 4, (c, dp) => {
      if (Math.abs(dp) < c.r && Math.abs(c.u - u) < c.r) { hit = c; return true; }
      return false;
    });
    return hit;
  }

  /** Is the line at `u` blocked anywhere in the next `span` metres? */
  lineBlocked(p, u, span, clear) {
    return this.eachObstacle(p + span * 0.5, span * 0.5,
      (c) => Math.abs(c.u - u) < clear);
  }

  blocksGate(p, u, clear = OBSTACLE_CLEAR) {
    const first = Math.floor(p / BAND) - 1;
    for (let b = first; b <= first + 2; b++) {
      const list = this.colliders[((b % this.bands) + this.bands) % this.bands];
      if (!list) continue;
      for (const c of list) {
        if (!c.obstacle) continue;
        if (Math.abs(-c.z - p) > 26) continue;
        if (Math.abs(c.u - u) < clear) return true;
      }
    }
    return false;
  }

  reset(p) {
    const first = Math.floor(p / BAND) - 1;
    for (let i = 0; i < this.bands; i++) this._buildBand(first + i);
    this.baseBand = first;
    this._flush();
  }

  update(p) {
    const want = Math.floor(p / BAND) - 1;
    if (want === this.baseBand) return;
    if (want - this.baseBand >= this.bands || want < this.baseBand) {
      this.reset(p);
      return;
    }
    for (let k = this.baseBand; k < want; k++) this._buildBand(k + this.bands);
    this.baseBand = want;
    this._flush();
  }

  /**
   * Nearest thing the rider is inside, or null. Only the bands around the rider
   * are tested, so this stays a few dozen distance checks whatever the pool size.
   */
  hitTest(x, z) {
    const band = Math.floor(-z / BAND);
    for (let b = band - 1; b <= band + 1; b++) {
      const slot = ((b % this.bands) + this.bands) % this.bands;
      const list = this.colliders[slot];
      if (!list) continue;
      for (const c of list) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < c.r * c.r) return c;
      }
    }
    return null;
  }

  dispose() {
    this.trees.dispose();
    this.rocks.dispose();
    this.poles.dispose();
  }
}
