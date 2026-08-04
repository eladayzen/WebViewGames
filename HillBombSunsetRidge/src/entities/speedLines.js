// Speed lines -- streaks rushing past the camera, driven by actual speed.
//
// Amit: "at maximum, a lot of them. At minimum, none of them. Ramping up
// between" -- driven by THE SPEED WOBBLE METER, the same system the HUD bar and
// the camera shake already read.
//
// Driving it from raw instantaneous speed was too touchy: the game accelerates
// to terminal within a few seconds and then sits there, so the effect snapped
// from nothing to full almost immediately and stayed pinned. The wobble meter
// INTEGRATES instead of tracking -- it fills only while you're over the speed
// threshold, and drains when you carve, grind or slow down -- so it moves over
// seconds rather than frames and simply cannot snap.
//
// It also makes the effect mean something rather than just decorate: wobble is
// the fail meter, so a screen thick with streaks is the same signal as a full
// bar. At zero wobble there is literally nothing drawn.
//
// FIXED WORLD RADIUS, and this is the whole trick. A streak is a segment
// parallel to the view axis at a constant distance out from it, so its NEAR end
// projects further from the centre of frame than its FAR end -- that difference
// IS the streak, and it lengthens as the streak approaches. It's what makes the
// effect radiate.
//
// The first attempt parameterised by a constant ANGLE from the view axis
// instead, reasoning that this would keep the centre of frame clear. It renders
// nothing: a constant angle puts the head and tail on the SAME view ray, so
// both project to the same pixel and every streak collapses to a point. Caught
// by projecting a quad's corners and finding two of them at identical NDC
// (-0.020, 0.704) -- the geometry, alphas and draw range were all perfectly
// valid, the triangles were just edge-on to the camera.
//
// Keeping the rider clear is handled instead by FADING on screen angle: a
// streak is invisible while it's near the centre and fades up as it sweeps
// outward. That protects the middle of frame and doubles as the spawn-in, so
// streaks emerge from the vanishing point rather than popping into existence.
//
// Kept in world space and rebuilt each frame from the camera's matrix rather
// than parented to the camera: the camera is not added to the scene graph in
// this game, so children of it would never render.
//
// QUADS, NOT LINES. The first version used THREE.LineSegments and rendered
// nothing visible at all -- the geometry, alphas and draw range were all
// correct, but WebGL ignores `linewidth` on almost every platform, so every
// streak was a 1px hairline of near-white over a pale sand trough. Two
// triangles per streak gives real, controllable width. The width is scaled by
// distance (w = z * ANG_HALF_WIDTH) so a streak holds a CONSTANT thickness on
// screen as it rushes past, instead of ballooning as it approaches.

import * as THREE from 'three';
import { SPEEDLINE_MAX, SPEEDLINE_COLOR } from '../data/constants.js';

const Z_NEAR = 2.0; // recycle here -- closer than this the streak stretches wildly
const Z_FAR = 44;
const R_MIN = 2.5; // world units out from the view axis
const R_MAX = 9.0;
// Screen angle (radians from centre) over which a streak fades in. Below
// ANG_FADE_IN it is fully transparent, which is what keeps the rider -- who
// sits dead centre, much nearer the camera -- from being drawn over.
const ANG_FADE_IN = 0.28;
const ANG_FADE_FULL = 0.46;
// Half-width as an angle, so thickness stays constant on screen rather than
// ballooning as a streak approaches. ~3px on a frame this tall at 58 degrees
// works out near 0.004; a touch wider reads better against the pale trough.
const ANG_HALF_WIDTH = 0.0055;

const _v = new THREE.Vector3();

export function createSpeedLines(scene) {
  // 6 vertices per streak: two triangles forming a screen-facing quad.
  const positions = new Float32Array(SPEEDLINE_MAX * 6 * 3);
  const alphas = new Float32Array(SPEEDLINE_MAX * 6);
  // Per-streak state, all in camera space.
  const ang = new Float32Array(SPEEDLINE_MAX); // around the view axis
  const rad = new Float32Array(SPEEDLINE_MAX); // constant distance FROM the axis
  const z = new Float32Array(SPEEDLINE_MAX); // distance in front of camera

  const respawn = (i, far) => {
    ang[i] = Math.random() * Math.PI * 2;
    // sqrt keeps the distribution even across the annulus instead of bunching
    // them all against the inner edge.
    rad[i] = R_MIN + (R_MAX - R_MIN) * Math.sqrt(Math.random());
    z[i] = far ? Z_NEAR + Math.random() * (Z_FAR - Z_NEAR) : Z_FAR;
  };
  for (let i = 0; i < SPEEDLINE_MAX; i++) respawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(SPEEDLINE_COLOR) } },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() { gl_FragColor = vec4(uColor, vAlpha); }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    // Screen-space effect in spirit: it should never be occluded by the trough
    // wall it happens to be passing through, and never punch a hole in
    // anything behind it.
    depthTest: false,
    depthWrite: false,
    fog: false,
  });

  const lines = new THREE.Mesh(geo, mat);
  lines.frustumCulled = false; // rebuilt around the camera every frame
  lines.renderOrder = 5;
  scene.add(lines);

  return {
    lines,
    /**
     * @param {number} wobble  the speed-wobble meter, 0..100
     * @param {number} speed   rider speed, world units/s -- drives how FAST the
     *   streaks travel, which still has to track real speed even though their
     *   DENSITY comes from the meter
     * @param {THREE.Camera} camera
     * @param {number} dt
     */
    update(wobble, speed, camera, dt) {
      const intensity = Math.max(0, Math.min(1, wobble / 100));
      if (intensity <= 0) {
        geo.setDrawRange(0, 0);
        return 0;
      }
      // Count ramps with speed -- this is the main "a lot of them / none of
      // them" lever. Squared so the low end stays genuinely sparse and the
      // build-up is felt near the top rather than being linear all the way.
      const active = Math.max(1, Math.round(SPEEDLINE_MAX * intensity * intensity));
      // Length and brightness ramp too, so streaks don't pop into existence at
      // full strength the instant the threshold is crossed.
      const len = 3.0 + intensity * 7.0;
      const travel = speed * 1.5;

      camera.updateMatrixWorld();
      const m = camera.matrixWorld;

      for (let i = 0; i < active; i++) {
        z[i] -= travel * dt;
        if (z[i] <= Z_NEAR) respawn(i, false);

        const ca = Math.cos(ang[i]);
        const sa = Math.sin(ang[i]);
        const zh = z[i];
        const zt = z[i] + len;
        // SAME radius at both ends -- the segment runs parallel to the view
        // axis, so the near end lands further out on screen than the far end.
        const rh = rad[i];
        const rt = rad[i];

        // The streak runs RADIALLY outward on screen, so its screen-space
        // perpendicular is the tangential direction -- that's the axis to
        // offset along to give the quad width.
        const px = -sa;
        const py = ca;
        const wh = zh * ANG_HALF_WIDTH;
        const wt = zt * ANG_HALF_WIDTH;

        // Fade by SCREEN ANGLE: invisible near the centre of frame, ramping up
        // as the streak sweeps outward. Keeps the rider and the road ahead
        // clear, and makes streaks emerge from the vanishing point instead of
        // appearing from nowhere.
        const screenAng = Math.atan(rh / zh);
        const fade = Math.max(0, Math.min(1,
          (screenAng - ANG_FADE_IN) / (ANG_FADE_FULL - ANG_FADE_IN)));
        const aHead = intensity * 0.42 * fade;

        const o = i * 18;
        const ao = i * 6;
        // Camera looks down -Z. Two triangles: head-left, head-right, tail-right
        // then head-left, tail-right, tail-left.
        const set = (k, cx, cy, cz, a) => {
          _v.set(cx, cy, cz).applyMatrix4(m);
          positions[o + k * 3] = _v.x;
          positions[o + k * 3 + 1] = _v.y;
          positions[o + k * 3 + 2] = _v.z;
          alphas[ao + k] = a;
        };
        const hlx = ca * rh + px * wh, hly = sa * rh + py * wh;
        const hrx = ca * rh - px * wh, hry = sa * rh - py * wh;
        const tlx = ca * rt + px * wt, tly = sa * rt + py * wt;
        const trx = ca * rt - px * wt, try_ = sa * rt - py * wt;
        set(0, hlx, hly, -zh, aHead);
        set(1, hrx, hry, -zh, aHead);
        set(2, trx, try_, -zt, 0);
        set(3, hlx, hly, -zh, aHead);
        set(4, trx, try_, -zt, 0);
        set(5, tlx, tly, -zt, 0);
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
      geo.setDrawRange(0, active * 6);
      return active;
    },
  };
}
