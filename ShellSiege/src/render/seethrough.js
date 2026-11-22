// A GIANT THAT IS HIDING SOMETHING BECOMES SEE-THROUGH.
//
// Elad, 22 Nov, after seeing the giants in play: "decrease the size of the
// giants, slow them down, and maybe try that whenever they are hiding something
// (blocking the view) they become 70% opacity."
//
// The camera is pitched down 50 degrees and never turns, so a tall body hides
// whatever stands behind it on the screen -- the player included, which is the
// one thing that must never be lost. Cutting the size helps; this is the rest.
//
// WHAT COUNTS AS HIDING SOMETHING. A giant is hiding a THING when
//   1. the thing's centre lands inside the giant's box as drawn on the screen, and
//   2. the giant is nearer the camera than the thing is.
// "Things" are the player, every other living enemy, and every orb in the air.
// Both tests use the REAL camera's projection, so the rule stays correct if the
// camera angle ever changes, and it fades only for a real overlap -- a giant
// standing beside the player does not go ghostly for nothing.
//
// THE BOX IS SHRUNK a little (SEE.inset) because a bounding box is bigger than
// the body inside it; fading for a thing that is merely near a giant's silhouette
// would make the effect read as flicker rather than as "you can see through it".
//
// IT FADES, IT DOES NOT SNAP. A giant stepping in front of the player must not
// pop; opacity moves toward its target exponentially (SEE.rate), which is quick
// enough to be useful and slow enough to read as a fade.
//
// ONLY BREEDS MARKED `seeThrough` IN core/breeds.js. It is data, not a size
// threshold buried here, so which enemies do it is a design choice in one place.
import * as THREE from 'three';
import { u } from './units.js';
import { BREEDS } from '../core/breeds.js';

export const SEE = {
  alpha: 0.7,       // how opaque a giant is while it is hiding something (Elad's number)
  rate: 9,          // per second: how fast opacity moves toward its target
  inset: 0.12,      // the fraction of the box's width and height ignored at each edge
  bodyY: 0.8,       // height of the player's centre, in scene units
  shotY: 0.7,       // height of an orb in flight
};

/** Move `cur` toward `target`, exponentially, frame-rate independent. */
export function stepAlpha(cur, target, dt) {
  const k = 1 - Math.exp(-SEE.rate * dt);
  return cur + (target - cur) * k;
}

/** Is the NDC point (x, y) inside the rectangle, after shrinking it by `inset` of its size per side? */
export function insideRect(r, x, y, inset = SEE.inset) {
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  return x >= r.x0 + w * inset && x <= r.x1 - w * inset && y >= r.y0 + h * inset && y <= r.y1 - h * inset;
}

export function createSeeThrough(camera) {
  const v = new THREE.Vector3();

  /** The giant's bounding box (its footprint, floor to head) as a rectangle in screen (NDC) space. */
  function screenRect(f, height) {
    const R = u(f.radius);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, height]) {
      v.set(u(f.x) + sx * R, y, u(f.y) + sz * R).project(camera);
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
      if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
    }
    return { x0, x1, y0, y1 };
  }

  // DEPTH IS MEASURED ALONG THE GROUND, not in 3D. The camera is high, so a tall
  // body's centre is nearer to it in 3D than a small thing standing a little in
  // front of it on the floor -- which would wrongly call that thing "behind".
  const dist = (x, _y, z) => Math.hypot(camera.position.x - x, camera.position.z - z);

  /**
   * For every seeThrough foe: the opacity it WANTS this frame (SEE.alpha or 1).
   * @returns Map(foe -> target opacity). Foes not in the map are fully opaque.
   */
  function update(foes, player, shots) {
    camera.updateMatrixWorld();
    const out = new Map();
    for (const g of foes) {
      const breed = BREEDS[g.breed];
      if (!g.alive || !breed || !breed.seeThrough) continue;
      const rect = screenRect(g, breed.height);
      const gDist = dist(u(g.x), 0, u(g.y));

      // Is anything standing behind this giant, as seen from the camera?
      const hides = (x, y, z) => {
        const d = dist(x, y, z);
        v.set(x, y, z).project(camera);
        return d > gDist && insideRect(rect, v.x, v.y);
      };
      let hidden = hides(u(player.x), SEE.bodyY, u(player.y));
      for (let i = 0; !hidden && i < foes.length; i++) {
        const o = foes[i];
        if (o === g || !o.alive) continue;
        hidden = hides(u(o.x), (BREEDS[o.breed]?.height ?? 2) * 0.5, u(o.y));
      }
      for (let i = 0; !hidden && shots && i < shots.length; i++) {
        if (shots[i].alive) hidden = hides(u(shots[i].x), SEE.shotY, u(shots[i].y));
      }
      out.set(g, hidden ? SEE.alpha : 1);
    }
    return out;
  }

  return { update };
}
