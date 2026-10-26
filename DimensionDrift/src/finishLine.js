// THE FINISH LINE — the first thing on this mountain that has an end.
//
// Not course furniture. Gates are spawned predictively a few seconds ahead and
// recycled behind the rider; the finish line is one object at one known distance
// that has to exist from the moment the race starts, because A GOAL YOU CANNOT
// SEE COMING IS NOT A GOAL. So it owns itself: place it, and it stays until the
// mode takes it away. The same split HillBomb's `finishLine.js` makes, and for
// the same reason.
//
// IT IS DELIBERATELY NOT IN ANY OTHER OBJECT'S COLOUR. The slalom gates are
// crimson and deep blue, the kicker lips carry a painted dye line, the motes are
// amber, the rider is red. A finish line mistaken for a gate at 150 m is worse
// than none at all, so this is chequered black and white — the one scheme
// nothing else on the mountain uses, and the one every viewer already reads as
// "finish" without being told.
//
// IT SPANS THE WHOLE RIDABLE WIDTH rather than sitting on the racing line. A
// race is won by crossing it anywhere, and a banner the width of a gate would
// say the opposite.
//
// PLANTED AGAINST `meshHeight`, NOT `terrain.height` — the same rule the gates
// and the scenery follow. Off the centre line the mesh columns are metres apart
// and the tessellated surface sags below the analytic one, so anything placed at
// the analytic height floats over every convex rise.

import * as THREE from 'three';
import { HALF, meshHeight } from './mountain.js';

/** Metres either side of the centre line. Wider than the bowl's rim. */
const SPAN = HALF * 1.05;
/** Height of the banner above the snow. */
const POST_H = 7.0;
const BANNER_H = 2.6;
/** Squares across the banner. Odd, so a square sits on the centre line. */
const SQUARES = 21;

export function createFinishLine(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // The banner is one strip of geometry with a chequer baked into VERTEX
  // COLOURS rather than a texture: 21 quads is cheaper than a texture fetch per
  // pixel, it cannot blur at distance, and it needs no asset to ship or to fail
  // to load.
  const w = (SPAN * 2) / SQUARES;
  const pos = [];
  const col = [];
  // WHICH VERTICES ARE THE TOP EDGE, recorded at build time. Reading it back off
  // `position.y` works exactly once: `place` rewrites those y values to follow
  // the terrain, so the second placement would read the lifted heights and
  // decide every vertex was a top one.
  const isTop = [];
  for (let i = 0; i < SQUARES; i++) {
    const x0 = -SPAN + i * w;
    const x1 = x0 + w;
    const dark = i % 2 === 0;
    const c = dark ? [0.06, 0.07, 0.10] : [0.97, 0.98, 1.0];
    // two triangles per square
    pos.push(x0, 0, 0, x1, 0, 0, x1, BANNER_H, 0);
    pos.push(x0, 0, 0, x1, BANNER_H, 0, x0, BANNER_H, 0);
    isTop.push(0, 0, 1, 0, 1, 1);
    for (let k = 0; k < 6; k++) col.push(c[0], c[1], c[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const banner = new THREE.Mesh(
    geo,
    // UNLIT and double-sided on purpose. Every other solid object takes the
    // mood's sun so it sits in the scene; this one must read identically at
    // first light and in a squall, because it is the only object on the
    // mountain whose job is to be recognised rather than to belong.
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
  );
  banner.frustumCulled = false;
  group.add(banner);

  const postGeo = new THREE.CylinderGeometry(0.22, 0.22, POST_H, 8);
  const postMat = new THREE.MeshBasicMaterial({ color: 0xf2f5ff, toneMapped: false });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(sx * SPAN, POST_H * 0.5, 0);
    post.frustumCulled = false;
    group.add(post);
  }

  return {
    group,

    /**
     * @param {import('./mountain.js').Terrain} terrain
     * @param {number} p distance down the mountain where the line sits
     *
     * The banner follows the TERRAIN across its span rather than hanging flat:
     * the bowl is a parabola nine metres deep at the rim, so a flat banner
     * would be buried at the centre and floating at the edges.
     */
    place(terrain, p) {
      const z = -p;
      const cx = terrain.centerX(z);
      group.position.set(cx, 0, z);
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const base = meshHeight(terrain, cx + a.getX(i), z);
        a.setY(i, base + POST_H - (isTop[i] ? 0 : BANNER_H));
      }
      a.needsUpdate = true;
      for (const child of group.children) {
        if (child.geometry === postGeo) {
          child.position.y = meshHeight(terrain, cx + child.position.x, z) + POST_H * 0.5;
        }
      }
      group.visible = true;
    },

    hide() { group.visible = false; },

    dispose() {
      geo.dispose();
      postGeo.dispose();
      postMat.dispose();
      banner.material.dispose();
      scene.remove(group);
    },
  };
}
