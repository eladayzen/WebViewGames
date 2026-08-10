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
//
// CAP FIX (Amit: "I don't see it in the upper side... not stretched enough"):
// a finite open-ended cylinder has a hard rim. With the camera sitting exactly
// on the cylinder's own axis (recentred every frame), the rim's elevation angle
// from camera is atan(topClearance / RADIUS) -- with the original 430-radius,
// 160-clearance cylinder that's only ~20 degrees, well inside the ~29-33 degree
// half-FOV this camera actually uses. So the TOP of the viewport was punching
// past the rim into empty background even looking dead level, which read as a
// hard cutoff, not a stretch problem. Two changes fix it together:
//   1. More headroom (bigger clearance) so ordinary framing stays inside it.
//   2. A CAP disc above (and below) the rim, coloured from the painting's own
//      edge pixels, so even extreme pitches (a launch, a steep dive) blend into
//      a continuation of the painting's own colour instead of hitting a void.
//      This is the "stretch it in a different way" fix: rather than stretching
//      the finite image further (which just smears the towers), the parts
//      beyond the image become solid colour sampled FROM the image, which is
//      how the human eye already reads a hazy, cloud-softened horizon.

import * as THREE from 'three';
import skyUrl from '../assets/world/sky_panorama.jpg?url';

const RADIUS = 430;
const HEIGHT = 900; // the finite, textured body
const TOP_CLEARANCE = 500; // world units above the camera to the body's top rim
const BOTTOM_CLEARANCE = HEIGHT - TOP_CLEARANCE;
const VERTICAL_OFFSET = TOP_CLEARANCE - HEIGHT / 2;

/** Average colour of a thin strip near one edge of an image, as a hex int. */
function edgeColour(img, fromTop) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = 4;
  const ctx = c.getContext('2d');
  const srcY = fromTop ? 0 : img.height - 4;
  ctx.drawImage(img, 0, srcY, img.width, 4, 0, 0, img.width, 4);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
}

function makeCap(radius, colour) {
  // Slightly domed rather than perfectly flat, so it doesn't read as a hard
  // disc if a steep-enough pitch ever grazes its own rim.
  const geo = new THREE.SphereGeometry(radius, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const mat = new THREE.MeshBasicMaterial({
    color: colour, side: THREE.BackSide, fog: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export function createSky(scene) {
  const tex = new THREE.TextureLoader().load(skyUrl, (loaded) => {
    // Colour the caps from the painting's own edges once it's actually decoded,
    // rather than guessing a constant -- if the art changes, this follows it.
    const img = loaded.image;
    capTop = edgeColour(img, true);
    capBot = edgeColour(img, false);
    topCap.material.color.setHex(capTop).multiply(mat.color);
    botCap.material.color.setHex(capBot).multiply(mat.color);
  });
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

  // Placeholder colours (the painting's own sky-lilac / horizon-peach) until
  // the real edge samples land in the onLoad callback above.
  //
  // makeCap's geometry is the sphere's NORTH hemisphere by construction: it
  // bulges toward +Y with its open equator facing -Y. That's already the right
  // shape for the TOP cap (bulges up and away, opens downward toward the
  // camera below it) with no rotation needed. The BOTTOM cap needs the mirror
  // image -- bulging down and away, opening upward -- which is this same
  // geometry flipped 180 degrees.
  const topCap = makeCap(RADIUS, 0xc3b2dc);
  const botCap = makeCap(RADIUS, 0xf7d3bf);
  botCap.rotation.x = Math.PI;
  scene.add(topCap, botCap);

  // Cap colours are sampled from the painting's own edges once it decodes. The
  // tint multiplies on top, so they have to be remembered rather than read back
  // off the material -- reading back would compound the tint every time one was
  // applied and the sky would march toward black over a few runs.
  let capTop = 0xffffff;
  let capBot = 0xffffff;

  return {
    mesh,

    /**
     * Tint the painted panorama for a theme.
     *
     * MULTIPLY, do not replace. The matte is a real painting with towers and
     * cloud banks in it; swapping in a flat gradient would throw away the only
     * piece of actual art in the sky, whereas a tint keeps its structure and
     * moves the time of day.
     */
    setTint(hex) {
      mat.color.setHex(hex);
      const t = new THREE.Color(hex);
      topCap.material.color.setHex(capTop).multiply(t);
      botCap.material.color.setHex(capBot).multiply(t);
    },

    /** Keep everything centred on the camera so it behaves as infinitely far. */
    update(cameraPos) {
      mesh.position.set(cameraPos.x, cameraPos.y + VERTICAL_OFFSET, cameraPos.z);
      topCap.position.set(cameraPos.x, cameraPos.y + TOP_CLEARANCE, cameraPos.z);
      botCap.position.set(cameraPos.x, cameraPos.y - BOTTOM_CLEARANCE, cameraPos.z);
    },
  };
}
