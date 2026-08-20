// The TROUGH -- a vast half-pipe the whole run happens inside.
//
// Replaces the flat road entirely. The rider is tracked as (s, theta):
//   s     -- distance down the trough
//   theta -- angle around the U-shaped cross-section, 0 at the FLOOR
//
//   position(s, θ) = centre(s)
//                  + right(s) * R(s) * sin(θ)
//                  + up(s)    * R(s) * (1 − cos(θ))
//
// so θ=0 sits exactly on the centreline and the walls climb away either side.
//
// The (right, up) pair is a frame carried along the spline that can ROLL about
// the tangent. That single degree of freedom is what buys the impossible
// geometry later for free:
//   roll(s) varying   => corkscrew
//   R(s) varying      => funnel / bowl
//   θ-range varying   => floorless gaps, splits
// None of those need special-case code; they're all just these functions.
//
// Lineage: this is Astro_Tunnel's TubeGeometry/centreline technique (see
// WEB_MINIGAME_TECH_RETROSPECTIVE.md) applied to a HALF tube. The repo has
// shipped this shape before -- it isn't new ground.

import * as THREE from 'three';
import {
  SEG_LEN, SEGMENTS_AHEAD, SEGMENTS_BEHIND, GRADE,
  THETA_MAX,
  TROUGH_COLOR, TROUGH_FLOOR_COLOR, LIP_COLOR,
  GUIDE_STRIPES, GUIDE_COLOR,
} from '../data/constants.js';
// The cross-section is TERRAIN's now, not a constant -- see data/terrain.js.
// Read through the object every call; caching a field off it is what would make
// the mesh and the physics disagree about where the wall is.
import { TERRAIN } from '../data/terrain.js';

// Resolution across the U. The concept art reads as a smooth continuous
// ribbon, so the cross-section needs enough segments not to facet visibly --
// especially through a funnel throat, where the curvature tightens.
const CROSS_SEGMENTS = 30;

// --- the spline -------------------------------------------------------------

/**
 * HOW FAR THE HILL HAS FALLEN by distance s. Metres of descent, positive down.
 *
 * This used to be `s * GRADE` -- one constant, so the hill was a perfectly
 * even ramp from top to bottom and the only way to leave the ground was to hit
 * something someone had placed on it. Amit: "the road itself is dropping down
 * and you're flying like you're jumping down."
 *
 * So the grade is a PROFILE now: a steady descent plus a smooth step down every
 * `dropSpacing`, each one losing `dropDepth` over a window of `dropWidth`. A
 * smoothstep rather than a straight ramp because the interesting part is the
 * LIP -- the curvature where the ground starts falling away is what throws you,
 * and a linear ramp has all of its curvature in two infinitely sharp corners.
 *
 * The half-pipe sets dropDepth 0, which makes the whole second term vanish and
 * leaves `GRADE * s` exactly. That is not an approximation: `n` and `sm` still
 * evaluate, they are just multiplied by zero, so the old hill is bit-identical.
 */
export function elevAt(s) {
  const d = TERRAIN.dropDepth;
  if (d === 0) return GRADE * s;
  const sp = TERRAIN.dropSpacing;
  const w = TERRAIN.dropWidth;
  const n = Math.floor(s / sp);
  const phase = (s - n * sp) / sp;
  const t = Math.min(1, Math.max(0, (phase - (0.5 - w / 2)) / w));
  const sm = t * t * (3 - 2 * t); // smoothstep: flat lip, steep middle, flat run-out
  return GRADE * s + d * (n + sm);
}

/**
 * Local steepness, d(elevation)/ds. The tangent the rider flies off at, and the
 * thing that decides how hard the grade pulls them down it.
 *
 * Analytic rather than sampled: this is read every frame, and a finite
 * difference across a smoothstep's corner would report a slope the surface
 * never actually has.
 */
export function slopeAt(s) {
  const d = TERRAIN.dropDepth;
  if (d === 0) return GRADE;
  const sp = TERRAIN.dropSpacing;
  const w = TERRAIN.dropWidth;
  const phase = (s - Math.floor(s / sp) * sp) / sp;
  const t = (phase - (0.5 - w / 2)) / w;
  if (t <= 0 || t >= 1) return GRADE;
  // d(sm)/dt = 6t(1-t), and dt/ds = 1/(w*sp)
  return GRADE + d * (6 * t * (1 - t)) / (w * sp);
}

/**
 * How sharply the steepness is CHANGING, d^2(elevation)/ds^2.
 *
 * This is the launch test. Positive means the ground is tipping away from under
 * you -- a crest -- and v^2 times this is the downward acceleration you would
 * need to stay glued to it. Past what gravity can supply, you are already in
 * the air, and that is the whole trigger: no volumes, no markers, no authoring
 * per drop. Ride the same lip slowly and you simply roll down it.
 */
export function curvatureAt(s) {
  const d = TERRAIN.dropDepth;
  if (d === 0) return 0;
  const sp = TERRAIN.dropSpacing;
  const w = TERRAIN.dropWidth;
  const phase = (s - Math.floor(s / sp) * sp) / sp;
  const t = (phase - (0.5 - w / 2)) / w;
  if (t <= 0 || t >= 1) return 0;
  // d2(sm)/dt2 = 6 - 12t, over (w*sp)^2
  return d * (6 - 12 * t) / (w * sp * w * sp);
}

/** Centreline position at distance s. This is the trough FLOOR, not its axis. */
export function centre(s, out = new THREE.Vector3()) {
  const x = Math.sin(s * 0.0031) * 26 + Math.sin(s * 0.00097) * 44;
  return out.set(x, -elevAt(s), -s);
}

/**
 * Trough radius at s. THIS is the funnel.
 *
 * The moment in concept-01 where the channel narrows into a throat and flares
 * open again is not painted and not a separate model -- it is this one function
 * returning a smaller number for a stretch of s. Everything else follows
 * automatically: the surface mesh, the rider's position, the height/speed
 * exchange and prop placement all read the radius from here, so they cannot
 * disagree about where the wall is.
 *
 * That is the general answer to "how does the art touch the playfield": for
 * anything that connects, it doesn't -- the geometry is generated from the same
 * spline, so the join is exact by construction.
 */
export function radiusAt(s) {
  const phase = (s % TERRAIN.funnelSpacing) / TERRAIN.funnelSpacing;
  // One smooth well per cycle: 0 at the edges, 1 at the throat.
  const pinch = Math.max(0, Math.cos((phase - 0.5) * Math.PI * 2 / TERRAIN.funnelWidth));
  return TERRAIN.radius * (1 - (1 - TERRAIN.funnelTightness) * pinch * pinch);
}

/** Roll of the cross-section frame about the tangent, in radians. */
export function rollAt(s) {
  return Math.sin(s / TERRAIN.rollWavelength) * TERRAIN.rollAmount;
}

// Scratch pools kept strictly per-function. Sharing these is what caused the
// ribbon-collapse bug in the old road.js -- one function's `out` was another's
// temporary. Never reuse across call boundaries.
const _fA = new THREE.Vector3();
const _fB = new THREE.Vector3();
const _fT = new THREE.Vector3();
const _fR0 = new THREE.Vector3();
const _fU0 = new THREE.Vector3();
const _WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Orthonormal frame at s, rolled about the tangent.
 * @returns {{tangent:THREE.Vector3, right:THREE.Vector3, up:THREE.Vector3, radius:number}}
 * Vectors are freshly written into the supplied holder each call.
 */
export function frameAt(s, holder) {
  const f = holder;
  centre(s - 1, _fA);
  centre(s + 1, _fB);
  f.tangent.subVectors(_fB, _fA).normalize();

  _fR0.crossVectors(f.tangent, _WORLD_UP).normalize();
  _fU0.crossVectors(_fR0, f.tangent).normalize();

  const roll = rollAt(s);
  const c = Math.cos(roll);
  const sn = Math.sin(roll);
  f.right.copy(_fR0).multiplyScalar(c).addScaledVector(_fU0, sn);
  f.up.copy(_fU0).multiplyScalar(c).addScaledVector(_fR0, -sn);
  f.radius = radiusAt(s);
  return f;
}

export function makeFrame() {
  return {
    tangent: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    radius: TERRAIN.radius,
  };
}

const _twFrame = makeFrame();

/** World position of the trough surface at (s, θ). */
export function toWorld(s, theta, out = new THREE.Vector3()) {
  const f = frameAt(s, _twFrame);
  centre(s, out);
  out.addScaledVector(f.right, f.radius * Math.sin(theta));
  out.addScaledVector(f.up, f.radius * (1 - Math.cos(theta)));
  return out;
}

const _suFrame = makeFrame();

/**
 * Surface "up" at (s, θ) -- the inward normal, pointing from the surface toward
 * the tube's axis. This is what the rider stands on, and what the camera treats
 * as up, so a corkscrew rotates the WORLD rather than the rider (the readability
 * mitigation in the plan).
 */
export function surfaceUp(s, theta, out = new THREE.Vector3()) {
  const f = frameAt(s, _suFrame);
  return out.copy(f.up).multiplyScalar(Math.cos(theta))
    .addScaledVector(f.right, -Math.sin(theta))
    .normalize();
}

/** Height of the surface at θ above the trough floor -- drives speed exchange. */
export function heightAt(s, theta) {
  return radiusAt(s) * (1 - Math.cos(theta));
}

// --- the mesh ---------------------------------------------------------------

/**
 * A rolling window of trough surface, rebuilt in place each frame. Same approach
 * as the old road ribbon (a few thousand verts, no allocation per frame), just
 * two-dimensional across the cross-section instead of a flat strip.
 */
class TroughSurface {
  /**
   * @param {(w:number) => [number, number]} band  the theta range this strip
   *   covers, as a function of the CURRENT rim angle. A function rather than two
   *   numbers because the cross-section is per-course now: the lip band and the
   *   guide stripes have to move when the face gets shallower, and a strip that
   *   kept its construction-time angles would leave the lip painted out in
   *   space past the edge of a wider, flatter hill.
   */
  constructor(band, colour, radialInset = 0) {
    this.band = band;
    this.thetaFrom = 0;
    this.thetaTo = 0;
    this.inset = radialInset;
    this.rows = SEGMENTS_AHEAD + SEGMENTS_BEHIND;
    this.cols = CROSS_SEGMENTS;

    const vertCount = (this.rows + 1) * (this.cols + 1);
    this.positions = new Float32Array(vertCount * 3);
    this.uvs = new Float32Array(vertCount * 2);
    this.colors = new Float32Array(vertCount * 3);
    this.dashed = false; // set on the floor stripe
    const idx = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = r * (this.cols + 1) + c;
        const b = a + 1;
        const d = a + (this.cols + 1);
        const e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setIndex(idx);

    // Unlit, and DOUBLE-SIDED on purpose: the frame's handedness flips as the
    // trough rolls, so a single-sided surface silently vanishes through a
    // corkscrew. (The flat road learned this the hard way.)
    // vertexColors carries the cross-section SHADING. Without it every surface
    // sat in a 60-78 luminance band -- wall 61, lip 60 -- so the trough read as
    // one flat beige field with no perceptible curvature or edge. This is not
    // real lighting (materials stay unlit, per the art direction); it is painted
    // shading baked per-vertex, which is exactly what the concept art does.
    this.material = new THREE.MeshBasicMaterial({
      color: colour, side: THREE.DoubleSide, vertexColors: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;

    this._frame = makeFrame();
    this._p = new THREE.Vector3();
    this.applyTerrain();
  }

  /** Re-read the band from the live terrain. Cheap; no geometry is rebuilt. */
  applyTerrain() {
    const [from, to] = this.band(TERRAIN.thetaMax);
    this.thetaFrom = from;
    this.thetaTo = to;
  }

  update(riderS) {
    const pos = this.positions;
    const uv = this.uvs;
    const col = this.colors;
    const s0 = Math.floor(riderS / SEG_LEN) * SEG_LEN - SEGMENTS_BEHIND * SEG_LEN;

    for (let r = 0; r <= this.rows; r++) {
      const s = s0 + r * SEG_LEN;
      const f = frameAt(s, this._frame);
      centre(s, this._p);
      // inset > 0 moves the strip TOWARD the axis, i.e. in front of the main
        // surface as seen from inside. Negative buries it behind and it never
        // renders -- which is exactly what happened to every marking.
        const R = f.radius - this.inset;
      for (let c = 0; c <= this.cols; c++) {
        const t = c / this.cols;
        const theta = this.thetaFrom + (this.thetaTo - this.thetaFrom) * t;
        const i = (r * (this.cols + 1) + c);
        const o = i * 3;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        pos[o] = this._p.x + f.right.x * R * sinT + f.up.x * R * (1 - cosT);
        pos[o + 1] = this._p.y + f.right.y * R * sinT + f.up.y * R * (1 - cosT);
        pos[o + 2] = this._p.z + f.right.z * R * sinT + f.up.z * R * (1 - cosT);
        // UVs: v runs along the trough so a tiled texture repeats down its
        // length; u wraps across the cross-section.
        uv[i * 2] = t;
        uv[i * 2 + 1] = s / 24;

        // Shading: darken up the walls, and darken one side more than the other
        // so the channel has a lit side and a shadow side like concept-02.
        let shade = 1 - 0.42 * (1 - cosT) - 0.13 * sinT;
        if (this.dashed) {
          // The floor centre line is dashed, which is what actually lets the eye
          // read speed. A solid stripe gives no motion cue at all.
          const dash = (s % 26) < 13 ? 1 : 0;
          shade *= dash ? 1 : 0.0;
        }
        shade = Math.max(0.15, Math.min(1.25, shade));
        col[o] = shade; col[o + 1] = shade; col[o + 2] = shade;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

/**
 * THE EDGE BARRIER -- a wall standing on the lip, for terrains that end rather
 * than curl over (see LIP_WALL in data/terrain.js).
 *
 * It is a separate class rather than another TroughSurface because it is not a
 * band of the cross-section: every other strip in this file is generated by
 * sweeping theta and reading the circle, and this one leaves the circle at the
 * rim and goes straight up. Bolting an "extrude" flag onto TroughSurface would
 * have put a branch in the one loop that runs for every vertex of every surface
 * every frame, to serve a case that shares none of its maths.
 *
 * IT STANDS ALONG THE FRAME'S UP, not along the surface normal. At a 53deg rim
 * the inward normal is tilted 53deg off vertical, so extruding along it would
 * lean the barrier out over the track like an overhang -- correct as a
 * continuation of the transition, and completely wrong as a thing that reads
 * "you cannot go past here". Standing it up in the trough's own frame keeps it
 * perpendicular to the ground the rider is on, through roll and all.
 */
/** Angular gap between where the rider stops and where the barrier stands. */
const WALL_CLEARANCE = 0.035;

class EdgeWall {
  constructor(sign) {
    this.sign = sign;
    this.rows = SEGMENTS_AHEAD + SEGMENTS_BEHIND;
    // Three rows up the face: base, mid, cap. Enough to carry a vertical
    // gradient (dark at the foot, bright at the top) so the wall reads as a
    // surface catching light rather than as a flat slab of colour.
    this.cols = 2;

    const vertCount = (this.rows + 1) * (this.cols + 1);
    this.positions = new Float32Array(vertCount * 3);
    this.uvs = new Float32Array(vertCount * 2);
    this.colors = new Float32Array(vertCount * 3);
    const idx = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = r * (this.cols + 1) + c;
        const b = a + 1;
        const d = a + (this.cols + 1);
        const e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setIndex(idx);
    this.material = new THREE.MeshBasicMaterial({
      color: LIP_COLOR, side: THREE.DoubleSide, vertexColors: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.role = 'lip'; // themed with the coping it stands on

    this._frame = makeFrame();
    this._p = new THREE.Vector3();
  }

  update(riderS) {
    // A terrain with no wall renders nothing at all, rather than a zero-height
    // strip -- a degenerate surface still costs a draw call and still z-fights
    // with the lip it is sitting exactly on top of.
    const H = TERRAIN.wallHeight;
    this.mesh.visible = H > 0;
    if (!this.mesh.visible) return;

    const pos = this.positions;
    const uv = this.uvs;
    const col = this.colors;
    const s0 = Math.floor(riderS / SEG_LEN) * SEG_LEN - SEGMENTS_BEHIND * SEG_LEN;
    // STANDS JUST OUTSIDE THE RIM, not on it. The rider can now reach thetaMax
    // exactly -- that is the entire point of the wall mode -- and a barrier
    // planted on that same angle would have the rider's body halfway through it
    // every time they lean all the way over. The offset is angular so it holds
    // through the funnel: 0.035 rad is about 1.6 units of clearance at the open
    // face's radius, which clears the board and reads as the wall sitting on the
    // lip band rather than floating off it.
    const theta = this.sign * (TERRAIN.thetaMax + WALL_CLEARANCE);
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    for (let r = 0; r <= this.rows; r++) {
      const s = s0 + r * SEG_LEN;
      const f = frameAt(s, this._frame);
      centre(s, this._p);
      const R = f.radius;
      // The foot of the wall: the rim point of the cross-section at this s.
      const fx = this._p.x + f.right.x * R * sinT + f.up.x * R * (1 - cosT);
      const fy = this._p.y + f.right.y * R * sinT + f.up.y * R * (1 - cosT);
      const fz = this._p.z + f.right.z * R * sinT + f.up.z * R * (1 - cosT);
      for (let c = 0; c <= this.cols; c++) {
        const t = c / this.cols;
        const i = r * (this.cols + 1) + c;
        const o = i * 3;
        pos[o] = fx + f.up.x * H * t;
        pos[o + 1] = fy + f.up.y * H * t;
        pos[o + 2] = fz + f.up.z * H * t;
        uv[i * 2] = t;
        uv[i * 2 + 1] = s / 24;
        // Dark at the foot, bright at the cap, plus a hard bright band at the
        // very top. The band is the part that actually communicates: a line
        // running the length of the hill at a constant height is readable from
        // far up the course, where the wall's own face is nearly edge-on.
        let shade = 0.34 + 0.5 * t * t;
        if (c === this.cols) shade = 1.25;
        col[o] = shade; col[o + 1] = shade; col[o + 2] = shade;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  /** Nothing cached -- the band is read fresh from TERRAIN every update(). */
  applyTerrain() {}
}

export function createTrough(scene) {
  const group = new THREE.Group();

  // The ridable surface, plus a floor stripe so the fast line reads clearly, and
  // a lip band past THETA_MAX that marks where the wall stops being ridable.
  // The centre line is an absolute angular width, not a fraction of the rim: it
  // is a painted stripe of a fixed physical size, and a wider hill should not
  // come with a wider stripe down the middle of it.
  const centreLine = new TroughSurface((w) => [-0.035 * (THETA_MAX / w), 0.035 * (THETA_MAX / w)],
    TROUGH_FLOOR_COLOR, 0.06);
  centreLine.role = 'floorLine';
  centreLine.dashed = true;

  const surfaces = [
    Object.assign(new TroughSurface((w) => [-w, w], TROUGH_COLOR), { role: 'trough' }),
    centreLine,
    // The lip must be a VALUE break, not just a different hue -- at luminance 60
    // against a wall at 61 it was invisible, which is a large part of why the
    // trough was hard to read at all.
    Object.assign(new TroughSurface((w) => [w, w + 0.20], LIP_COLOR), { role: 'lip' }),
    Object.assign(new TroughSurface((w) => [-w - 0.20, -w], LIP_COLOR), { role: 'lip' }),
  ];
  // Guide stripes up both walls -- the only way to read curvature and speed off
  // an otherwise flat-coloured surface.
  //
  // Placed as FRACTIONS of the rim angle, derived from the authored angles
  // rather than restated, so the half-pipe keeps the exact spacing Amit signed
  // off ("it really helps read and understand where you are on the field") and a
  // shallower face gets the same four stripes graded across whatever width it
  // has -- instead of the outermost pair falling off the edge of the hill.
  for (const { theta, halfWidth } of GUIDE_STRIPES) {
    const f = theta / THETA_MAX;
    const hw = halfWidth / THETA_MAX;
    for (const sign of [-1, 1]) {
      surfaces.push(Object.assign(new TroughSurface(
        (w) => [sign * (f - hw) * w, sign * (f + hw) * w], GUIDE_COLOR, 0.05,
      ), { role: 'guide' }));
    }
  }
  // The edge barriers, one per side. They join `surfaces` so they are updated,
  // themed and terrain-refreshed by exactly the same three loops as everything
  // else -- a wall that needed its own update call is a wall someone forgets to
  // update. They render nothing on a terrain with wallHeight 0, which is every
  // terrain but the open face.
  surfaces.push(new EdgeWall(1), new EdgeWall(-1));

  surfaces.forEach((s) => group.add(s.mesh));

  scene.add(group);

  return {
    group,
    update(riderS) {
      surfaces.forEach((s) => s.update(riderS));
    },

    /**
     * Re-read the cross-section after a terrain change. Called from startRun,
     * once per run -- the geometry is regenerated from the spline every frame
     * anyway, so this only has to move the band angles and the next update()
     * draws the new hill.
     */
    applyTerrain() {
      surfaces.forEach((s) => s.applyTerrain());
    },
    /**
     * Recolour the world for a theme. By ROLE, not by index -- the surfaces
     * array is built in several loops and an index-based mapping would silently
     * attach the wrong colour the first time one was added.
     *
     * The vertex colours are left alone on purpose: they carry the painted
     * cross-section shading that makes the trough read as curved rather than as
     * one flat field, and they multiply whatever base colour is set here.
     */
    setTheme(theme) {
      for (const s of surfaces) {
        const c = theme[s.role];
        if (c !== undefined) s.material.color.setHex(c);
      }
    },

    setLit(lit) {
      surfaces.forEach((s) => {
        const color = s.material.color.getHex();
        s.material.dispose();
        s.material = lit
          ? new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
          : new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        s.mesh.material = s.material;
      });
    },
  };
}
