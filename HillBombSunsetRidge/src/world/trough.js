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
  TROUGH_RADIUS, THETA_MAX, TROUGH_ROLL_AMOUNT, TROUGH_ROLL_WAVELENGTH,
  FUNNEL_SPACING, FUNNEL_WIDTH, FUNNEL_TIGHTNESS,
  TROUGH_COLOR, TROUGH_FLOOR_COLOR, LIP_COLOR,
  GUIDE_THETAS, GUIDE_COLOR,
} from '../data/constants.js';

// Resolution across the U. The concept art reads as a smooth continuous
// ribbon, so the cross-section needs enough segments not to facet visibly --
// especially through a funnel throat, where the curvature tightens.
const CROSS_SEGMENTS = 30;

// --- the spline -------------------------------------------------------------

/** Centreline position at distance s. This is the trough FLOOR, not its axis. */
export function centre(s, out = new THREE.Vector3()) {
  const x = Math.sin(s * 0.0031) * 26 + Math.sin(s * 0.00097) * 44;
  return out.set(x, -s * GRADE, -s);
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
  const phase = (s % FUNNEL_SPACING) / FUNNEL_SPACING;
  // One smooth well per cycle: 0 at the edges, 1 at the throat.
  const pinch = Math.max(0, Math.cos((phase - 0.5) * Math.PI * 2 / FUNNEL_WIDTH));
  return TROUGH_RADIUS * (1 - (1 - FUNNEL_TIGHTNESS) * pinch * pinch);
}

/** Roll of the cross-section frame about the tangent, in radians. */
export function rollAt(s) {
  return Math.sin(s / TROUGH_ROLL_WAVELENGTH) * TROUGH_ROLL_AMOUNT;
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
    radius: TROUGH_RADIUS,
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
  constructor(thetaFrom, thetaTo, colour, radialInset = 0) {
    this.thetaFrom = thetaFrom;
    this.thetaTo = thetaTo;
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

export function createTrough(scene) {
  const group = new THREE.Group();

  // The ridable surface, plus a floor stripe so the fast line reads clearly, and
  // a lip band past THETA_MAX that marks where the wall stops being ridable.
  const centreLine = new TroughSurface(-0.035, 0.035, TROUGH_FLOOR_COLOR, 0.06);
  centreLine.dashed = true;

  const surfaces = [
    new TroughSurface(-THETA_MAX, THETA_MAX, TROUGH_COLOR),
    centreLine,
    // The lip must be a VALUE break, not just a different hue -- at luminance 60
    // against a wall at 61 it was invisible, which is a large part of why the
    // trough was hard to read at all.
    new TroughSurface(THETA_MAX, THETA_MAX + 0.20, LIP_COLOR),
    new TroughSurface(-THETA_MAX - 0.20, -THETA_MAX, LIP_COLOR),
  ];
  // Guide stripes up both walls -- the only way to read curvature and speed off
  // an otherwise flat-coloured surface.
  for (const t of GUIDE_THETAS) {
    for (const sign of [-1, 1]) {
      surfaces.push(new TroughSurface(
        sign * (t - 0.018), sign * (t + 0.018), GUIDE_COLOR, 0.05,
      ));
    }
  }
  surfaces.forEach((s) => group.add(s.mesh));

  scene.add(group);

  return {
    group,
    update(riderS) {
      surfaces.forEach((s) => s.update(riderS));
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
