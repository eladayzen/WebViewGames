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
 * A branch whorl: the one shape in this file that had to be got right, twice.
 *
 * `lit.js` grants snow on `smoothstep(0.45, 0.92, N.y)`, so a surface only takes
 * a full load at N.y >= 0.92 — a slope no steeper than about 23°. The old tree
 * was three cones whose flanks sit at N.y 0.37–0.50, which is why `snowCap: 0.85`
 * was a no-op: ninety-seven percent of every tree received exactly zero snow and
 * our forest was bare in a frame whose reference is visibly laden.
 *
 * The obvious fix — a flat ring at each tier — fails for this game specifically.
 * A horizontal disc has no vertical extent, and the trees that matter stand on
 * the valley WALLS, which the chase camera sees close to edge-on; the shelves
 * would have collapsed to a hairline exactly where they were needed. So a whorl
 * is a closed lens: an upper cone that can take a load sitting on a lower cone
 * whose normals point down and therefore stay near-black.
 *
 * That much survives. What did not is the assumption that a whorl's load may be
 * AXISYMMETRIC. Build the upper cone as a surface of revolution at a uniform
 * N.y and every tier frosts right the way round, so every horizontal row of
 * pixels through the tree is either all snow or all body — and a column of rows
 * alternating 100% white and 0% white is not a laden conifer, it is a pagoda.
 * That is exactly what shipped last round: nine white-rimmed discs on a mast.
 *
 * The reference measures the other way. Per-row bright fraction down one of its
 * specimens runs 0.16 / 0.24 / 0.23 / 0.12 / 0.17 / 0.11 / 0.13 / 0.19 / 0.03 /
 * 0.06 / 0.13 — never a full row, never an empty one, and never twice the same.
 * Snow on a real conifer sits on individual branches, so any row across the tree
 * cuts some laden branches and some bare ones. The load has to be broken up in
 * AZIMUTH, not just in height, and it has to sit at the branch TIPS: the old
 * build put the highest N.y at the cone apex, which is the axis, so the bright
 * pooled into a filled disc around the trunk — the white ring the reviewer saw.
 *
 * So the whorl is authored per arm now. Each of a whorl's `seg` faces is one
 * branch, with its own reach, its own droop and its own snow, and the normal is
 * set outright at both ends of it rather than being whatever the cone's slope
 * happens to give.
 */
// A tier is TALL — half again as tall as its own radius, and three times that at
// the crown. This is the other half of the pagoda and it took longer to see than
// the load did. A whorl is a lens: its widest point is the rim, and above and
// below the rim it closes to a point, so shallow lenses stacked at a pitch near
// their own radius pinch the outline to nothing between every pair of them.
// That is the stair-stepping; and at the crown, where the radii get small and
// the pitch does not, it opened into daylight and the top of the tree came apart
// into a spike, a tuft and a mass with sky between them. A tier 0.8 m tall at a
// pitch of 0.4 keeps two or three tiers of cover at every height, so the outline
// is a continuous taper with the rims scalloping its edge. The normals are
// authored, so a steep tier is lit exactly as a flat one would be: this is a
// silhouette decision and it changes nothing about the snow.
const WHORL_UP = 0.55;                  // upper cone height / radius
const WHORL_DOWN = 1.20;                // lower cone height / radius
const WHORL_TILT = 0.20;                // radians of build-time lean, max
// Measured, not guessed. Per-row bright fraction down one tree, same method on
// both images: the reference runs 0.16/0.24/0.23/0.12/0.17/0.11/0.13/0.19/0.03/
// 0.06/0.13, mean 0.14. The pagoda ran 0.11/0.30/0.00/0.49/0.68/0.51/0.16/0.00/
// 0.00/0.00/0.00 — the zeroes and the 0.68 next to each other ARE the stripes,
// and no amount of tone tuning fixes a row that is either all snow or none.
// These trees run 0.02/0.06/0.26/0.09/0.13/0.21/0.12/0.27/0.25/0.24/0.20.
const LOADED = 0.30;                    // arms per whorl that take a full load
const TIP_NY = [0.94, 0.995];           // aim of a laden arm's rim normal
// An unladen arm points DOWN, and that is not a detail. `lit.js` shades ambient
// as mix(ground, sky, N.y * 0.5 + 0.5), so a normal aimed level takes half the
// sky — and a tree whose bare arms sit at N.y 0.2-0.5 comes out a pale grey
// ghost with no snow on it at all, which is what the first tall-tier build was.
// The shallow whorls it replaced had been dark for the wrong reason: most of
// what you saw of them was the DOWNWARD shell, and the tall ones show their
// upper flanks instead. Aim the bare arms below the horizon and the darkness is
// stated rather than incidental. It measures: tree bodies land at 0.40-0.51 of
// the snow beside them against the reference's 0.38.
const BARE_NY = [-0.54, 0.00];          // aim of an unladen arm's rim normal
// The other end of each arm, where it meets the axis — the inner edge on a flat
// tier, the top on a crown one. Both are aimed below the gate, a laden arm only
// just: the load is a fleck at the branch END and the inside of every tier stays
// body-coloured, which is the difference between snow on a tree and a tree made
// of snow. Aiming a laden arm's whole length at the gate was tried and it is
// what turned the crown into a white party hat.
const LOAD_CORE = [0.30, 0.54];
const BARE_CORE = [-0.68, -0.12];
//
// Nine tiers is 78 triangles, against the pagoda's 88 for nine shallow ones and
// its separate spire, and it covers the tree far better. 86 all in with the
// trunk, down from 98.
//
// `up` overrides WHORL_UP, and the top two entries are the CROWN, drawn out past
// their own radius so the tree comes to a point. The leader was a separate part
// for two builds and both were wrong. A spire has no skirt of its own, so it sat
// in a gap above the crown as a detached white needle — one to two pixels wide
// with the brightest value in the frame in it, on top of every tree on the wall.
// Built as a whorl it gets the underside that ties it to the tier below and the
// build-time lean, and it has to be THIN: the reference's leader is under a
// tenth of the tree's width, and the crown is the one part of a tree silhouetted
// against open snow rather than against the rest of the tree, so it is the part
// that gets judged on its own.
//
// `load` overrides the die roll. Everywhere else the load is drawn at random and
// averaged over forty arms, but the crown is four faces that a player sees
// individually on all 1440 instances — and this geometry is built ONCE and
// shared, so "a third of arms on average" is no protection at all when the one
// draw that happens comes up all ones. Alternating is stated outright.
const WHORLS = [
  { r: 1.50, y: 0.55, seg: 5 },
  { r: 1.47, y: 0.98, seg: 5 },
  { r: 1.40, y: 1.38, seg: 5 },
  { r: 1.28, y: 1.78, seg: 4 },
  { r: 1.12, y: 2.16, seg: 4 },
  { r: 0.94, y: 2.52, seg: 4 },
  { r: 0.74, y: 2.86, seg: 4 },
  { r: 0.52, y: 3.18, seg: 4, up: 1.15 },
  { r: 0.28, y: 3.56, seg: 4, up: 2.90, load: [1, 0, 1, 0] },
];

/**
 * Aim a vertex normal at a chosen N.y, keeping the bearing it already had.
 *
 * Multiplying N.y and renormalising — which is what the pagoda did — cannot
 * reach a target, because how far a given multiplier moves N.y depends on the
 * cone's own slope. The snow gate is a smoothstep with a hard floor at 0.45 and
 * a hard ceiling at 0.92, so "which side of the gate is this arm on" has to be
 * something the geometry states outright rather than something it lands on.
 */
function aimY(nm, v, ny) {
  const s = Math.sqrt(Math.max(0, 1 - ny * ny));
  const hx = nm.getX(v);
  const hz = nm.getZ(v);
  const hl = Math.hypot(hx, hz) || 1;
  nm.setXYZ(v, (hx / hl) * s, ny, (hz / hl) * s);
}

/**
 * One whorl, as a pair of open cone shells sharing a rim.
 *
 * The rim is displaced per angle and BOTH shells get the identical displacement,
 * so the lens stays shut however far it is pushed around — and it is pushed a
 * long way now. `rj` is what breaks the silhouette: an arm at 0.66 and its
 * neighbour at 1.20 is nearly a two-to-one difference in reach, so the tier is a
 * star and not a disc. `yj` is what breaks the BAND: a rim that stays in one
 * plane draws its load as a level white line across the full width of the tree,
 * and dropping arms by up to a third of the radius makes that line weave through
 * the tiers above and below instead of separating them.
 *
 * `ConeGeometry` gives every face its own apex vertex (they share a position,
 * not an index), which is what makes per-arm normals possible at all: the apex
 * carries the arm inward and the rim carries it outward. Rim vertices are shared
 * between neighbours, so a laden arm bleeds into the two beside it and the load
 * comes out as a soft fleck rather than a hard facet.
 */
function whorl(r, seg, rand, upK = WHORL_UP, load = null) {
  const hu = r * upK;
  const hd = r * WHORL_DOWN;
  const up = new THREE.ConeGeometry(r, hu, seg, 1, true);
  const dn = new THREE.ConeGeometry(r, hd, seg, 1, true);
  const rj = [];
  const yj = [];
  const ny = [];
  for (let i = 0; i < seg; i++) {
    // Reach, not width: an arm is a chord between two rim points, so at seg 5
    // one arm at 1.26 of nominal on the bottom tier came out as a flat blade
    // two metres long sticking out of the side of the tree. Enough spread to
    // interlock the tiers, not enough to grow a wing.
    rj.push(range(rand, 0.66, 1.20));
    yj.push(range(rand, -0.34, 0.12) * r);
    const wet = load ? load[i % load.length] : rand() < LOADED;
    ny.push(wet ? range(rand, ...TIP_NY) : range(rand, ...BARE_NY));
  }
  // A whorl with no laden arm at all is a one-in-five draw at seg 4, and a tree
  // with a bare tier in the middle of it reads as damage rather than as variety.
  if (!ny.some((t) => t >= TIP_NY[0])) ny[(rand() * seg) | 0] = range(rand, ...TIP_NY);
  // A cone's rim vertex and the apex vertex belonging to the same face carry the
  // same bearing, in the position of one and the normal of the other, so one
  // formula indexes both and an arm can be authored end to end.
  const arm = (ax, az) => ((Math.round((Math.atan2(az, ax) / (Math.PI * 2)) * seg) % seg) + seg) % seg;
  for (const [g, h, isUp] of [[up, hu, true], [dn, hd, false]]) {
    const p = g.attributes.position;
    const nm = g.attributes.normal;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v);
      const z = p.getZ(v);
      if (Math.abs(p.getY(v) + h * 0.5) > 1e-4) {
        // Apex. Only the upper shell's matters — the lower shell's normals all
        // point below the horizon and take nothing whatever they are aimed at.
        if (!isUp) continue;
        const k = arm(nm.getX(v), nm.getZ(v));
        aimY(nm, v, range(rand, ...(ny[k] >= TIP_NY[0] ? LOAD_CORE : BARE_CORE)));
        continue;
      }
      const k = arm(x, z);
      p.setXYZ(v, x * rj[k], p.getY(v) + yj[k], z * rj[k]);
      if (isUp) aimY(nm, v, ny[k]);
    }
  }
  up.translate(0, hu * 0.5, 0);
  dn.rotateX(Math.PI);
  dn.translate(0, -hd * 0.5, 0);
  return [up, dn];
}

function buildTreeGeometry(rand) {
  const parts = [];
  // Open ended, and it stops inside the leader. The whorls do not meet edge to
  // edge near the crown and the trunk showing through the gaps is what a conifer
  // looks like; what it must never do is stick out of the TOP, which is a dark
  // one-pixel aerial on every tree in the frame. Nothing ever sees the end caps.
  const trunk = new THREE.CylinderGeometry(0.05, 0.19, 3.9, 4, 1, true);
  trunk.translate(0, 1.95, 0);
  parts.push(trunk);
  for (const w of WHORLS) {
    // Jittered once, at build time. Every tree shares this geometry, so this
    // buys an irregular profile rather than per-tree variety — that comes from
    // the instance scale. The lean is safe: a laden arm is aimed at N.y 0.97,
    // 14° off vertical, and the snow gate does not begin to close until 23°.
    const r = w.r * range(rand, 0.84, 1.16);
    const y = w.y + range(rand, -0.06, 0.06);
    const tilt = range(rand, -WHORL_TILT, WHORL_TILT);
    const axis = rand() * Math.PI * 2;
    // Every tier gets its own clocking. Without it each whorl's arms sit at the
    // same bearings as the one below — seg is 4 or 5, so that is four or five
    // vertical ribs running the height of the tree, and a stack of stars that
    // line up reads as one solid stack all over again.
    const spin = rand() * Math.PI * 2;
    // One offset for the pair, or the two halves of the whorl come apart.
    const ox = w.r * range(rand, -0.06, 0.06);
    const oz = w.r * range(rand, -0.06, 0.06);
    for (const g of whorl(r, w.seg, rand, w.up ?? WHORL_UP, w.load ?? null)) {
      g.rotateY(spin);
      g.rotateY(axis);
      g.rotateX(tilt);
      g.rotateY(-axis);
      parts.push(g.translate(ox, y, oz));
    }
  }
  return mergeGeometries(parts, false);
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

    // Near-black, and barely green. The reference's conifers carry no pigment of
    // their own worth speaking of: their darkest pixels measure RGB(27,34,60),
    // which is the blue ambient and nothing else. A green that survives the light
    // is what made ours read as models standing in the snow.
    // snowCap 0.80, up from the 0.58 the pagoda needed. The cap is a ceiling on
    // how far ONE surface goes toward snow, not on how much of the tree is
    // laden, and the two were being confused: when every tier frosted right the
    // way round, the only way to stop a white tree was to stop the white, and
    // 0.58 is a tree whose brightest pixel is a grey. Now that the load is about
    // one arm in three and sits at their tips, holding it back reads as grubby
    // rather than as restrained — so the tips and the leader are allowed to reach
    // the parity with ground snow the reference gives them, and the tree stays
    // dark because most of it is aimed below the horizon. Measured against the
    // snow beside them our bodies come out at 0.40-0.51 and the reference's at
    // 0.38, which is what the body colour and the bare arms' aim are for.
    this.matTree = makeLitMaterial(mood, {
      color: 0x232c2f, wrap: 0.5, gloss: 14, specular: 0.10, snowCap: 0.80,
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
    this.trees = new InstancePool(buildTreeGeometry(mulberry32(seed ^ 0x7ee3)), this.matTree,
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
      // Varying toward BLUE, never toward green. The tint multiplies albedo
      // before the snow mix, and a green lift on a sunlit lower cone put a bright
      // green rim under every tier — the one saturated hue in a frame whose
      // reference has none.
      const shade = range(rand, 0.55, 1.25);
      this.trees.tint.setXYZ(gi, shade * range(rand, 0.86, 1.0), shade, shade * range(rand, 1.0, 1.14));
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
