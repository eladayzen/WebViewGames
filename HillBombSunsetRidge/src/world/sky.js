// The sky: a Kolbo matte painting on a cylinder that follows the camera.
//
// This is layer 1 of the three-layer answer to "how does the art touch the
// playfield" -- it DOESN'T. The panorama sits on a cylinder centred on the
// camera every frame, so it is effectively at infinity: it never moves relative
// to the viewer, never meets any geometry, and therefore has no join that can
// break. Everything that must actually connect to the trough is geometry
// generated from the same spline (see world/trough.js).
//
// Two details that matter:
//   - `fog: false`, the same exemption HalfShellHustle gives its skyline matte.
//     Fogging the backdrop toward the fog colour would wash the painting out and
//     defeat the point of painting it.
//   - `depthWrite: false` + render order -1, so the cylinder never occludes
//     anything regardless of how close its radius is to the far plane.
//
// The painting is horizontally tileable (the generated seam was healed by
// cross-fading a band from one edge over the other), so `RepeatWrapping` lets us
// spin it slowly without a visible join.

import * as THREE from 'three';
import skyUrl from '../assets/world/sky_panorama.jpg?url';

const RADIUS = 430;
const HEIGHT = 560;
// Horizon sits a little below eye level so the ground-side cloud bank reads as
// "far below", which is the whole point of a sky-city.
const VERTICAL_OFFSET = -120;

export function createSky(scene) {
  const tex = new THREE.TextureLoader().load(skyUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // ONE wrap, not two. Repeating twice shrank the towers and cloud banks into a
  // busy little band; the painting reads as scale and distance only when it's
  // stretched right out. Amit: "the matte paint isn't stretched enough".
  tex.repeat.set(1, 1);

  const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 48, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide, // we're inside it
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    mesh,
    /** Keep it centred on the camera so it behaves as if infinitely far away. */
    update(cameraPos) {
      mesh.position.set(cameraPos.x, cameraPos.y + VERTICAL_OFFSET, cameraPos.z);
    },
  };
}
