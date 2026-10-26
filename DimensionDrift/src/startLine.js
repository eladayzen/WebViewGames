// THE START LINE — where the run began, painted on the snow.
//
// A different object from `finishLine.js` on purpose, and the difference is the
// point. The finish is a seven-metre BANNER in the air, because a goal you
// cannot see coming is not a goal and it has to be legible at 150 m. A start
// line has the opposite job: it is under the board at the instant it matters,
// it is never approached, and two seconds later it is scenery. Giving it posts
// and a banner would put a second chequered gantry on the mountain that the
// player meets while looking for the first one — the exact confusion the finish
// line's own note is written to avoid.
//
// So it is PAINT. A chequered strip laid on the snow, spanning the same ridable
// width the finish does, carrying the same black-and-white scheme that nothing
// else on this mountain uses. Same language, no structure, no possible mistake
// about which of the two you are looking at.
//
// PLANTED AGAINST `meshHeight` like everything else that touches the ground:
// the bowl is a parabola nine metres deep at the rim, so a flat strip would be
// buried at the centre and floating at the edges.

import * as THREE from 'three';
import { HALF, meshHeight } from './mountain.js';

/** Metres either side of the centre line — matched to the finish line's span. */
const SPAN = HALF * 1.05;
/** How deep the painted band is, down the fall line. */
const DEPTH = 0.9;
/**
 * Squares across. Odd, so a square sits on the centre line.
 *
 * SIZED FOR THE RACE'S CAMERA, which is the whole reason this is not the 21 the
 * finish line uses. The finish is read at 150 m, where 3.2 m squares are the
 * right grain. The start line is read from four metres back and two metres up,
 * and at that range a 3.2 m square is WIDER THAN THE FRAME: the first attempt
 * put one light square across the whole screen and it read as a white slab
 * rather than as a chequered line. 75 across the same span gives 0.9 m squares,
 * which match the band's depth -- actually square, and several of them visible
 * at once from where the rider is standing.
 */
const SQUARES = 75;
/**
 * Clear of the snow by a hair.
 *
 * The trail ribbon's own lift is a quarter of a metre and is a depth bias
 * rather than a real height (see `trail.js`). This needs nothing like that: it
 * is only ever seen from a few metres away, at the start, which is the part of
 * the depth buffer with precision to spare. Six centimetres also puts it UNDER
 * the board's 0.072 m, so the rider stands on the line rather than in it.
 */
const LIFT = 0.06;

export function createStartLine(scene) {
  // Vertex colours rather than a texture, for the reasons the finish line
  // gives: 21 quads is cheaper than a texture fetch per pixel, it cannot blur
  // at distance, and there is no asset to ship or to fail to load.
  const w = (SPAN * 2) / SQUARES;
  const pos = [];
  const col = [];
  for (let i = 0; i < SQUARES; i++) {
    const x0 = -SPAN + i * w;
    const x1 = x0 + w;
    // Two triangles, WOUND TO FACE UP. Worth stating, because getting it
    // backwards costs an hour: a quad laid in the XZ plane with the obvious
    // vertex order has its normal pointing at the ground, and `MeshBasicMaterial`
    // culls back faces by default, so the strip is in the scene, visible, at the
    // right height, and draws nothing at all. Raising it two metres to see what
    // was hiding it is what proved it was never a depth problem.
    pos.push(x0, 0, -DEPTH / 2, x0, 0, DEPTH / 2, x1, 0, -DEPTH / 2);
    pos.push(x1, 0, -DEPTH / 2, x0, 0, DEPTH / 2, x1, 0, DEPTH / 2);
    const v = i % 2 ? 0.06 : 0.95;
    for (let k = 0; k < 6; k++) col.push(v, v, v);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true,
    // Unlit on purpose. The chequer's whole job is to be read as a flat marking
    // rather than as an object with a form, and shading it would hand it a
    // roundness the snow underneath already has.
    transparent: true,
    opacity: 0.85,
    // It is paint: it must not occlude the board, the spray or the trail that
    // are all about to be drawn over it.
    depthWrite: false,
  }));
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  return {
    mesh,

    /**
     * @param {import('./mountain.js').Terrain} terrain
     * @param {number} p distance down the mountain where the line sits
     */
    place(terrain, p) {
      const z = -p;
      const cx = terrain.centerX(z);
      mesh.position.set(cx, 0, z);
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        a.setY(i, meshHeight(terrain, cx + a.getX(i), z + a.getZ(i)) + LIFT);
      }
      a.needsUpdate = true;
      mesh.visible = true;
    },

    hide() { mesh.visible = false; },

    dispose() {
      geo.dispose();
      mesh.material.dispose();
      scene.remove(mesh);
    },
  };
}
