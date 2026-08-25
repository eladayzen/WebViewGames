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

/**
 * A VERTICAL GRADIENT, built from two colours.
 *
 * Replaces the painted panorama. Amit: "maybe for now we can remove the matte
 * painting and just use some gradient in the distance, and change the gradient
 * also -- maybe it could help the feel."
 *
 * The painting was doing a job -- towers and cloud banks give scale and say the
 * hill is somewhere -- but it was ONE painting behind every level, tinted, so
 * eight different mountains all sat in front of the same skyline. A gradient
 * has no content to repeat, so each theme's own sky colours read as a different
 * place instead of the same place at a different hour. It is also the thing
 * that makes a distant horizon feel far away: an untextured value ramp has no
 * detail to give the eye a sense of nearness.
 *
 * 2 x 256 rather than 1 x 256 because some drivers refuse to filter a
 * single-column texture cleanly, and the cost of the second column is nothing.
 */
function gradientTexture(topHex, botHex) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  const hex = (v) => '#' + v.toString(16).padStart(6, '0');
  grad.addColorStop(0, hex(topHex));
  grad.addColorStop(1, hex(botHex));
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function createSky(scene) {
  // The painted panorama is off. The loader and its edge-sampling are gone with
  // it rather than left dangling -- `skyUrl` stays imported and unused so that
  // bringing the matte back is one material swap, not an archaeology exercise.
  let tex = gradientTexture(0x160e47, 0x401a5f);

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
  let capTop = 0x160e47;
  let capBot = 0x401a5f;

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
      // The tint multiplied a PAINTING to move its time of day. Against a
      // gradient that is already built from the theme's own colours it would
      // only darken what setGradient just set, so it is a no-op now. Kept so
      // callers do not have to know which sky they are talking to.
      void hex;
    },

    /**
     * Paint the sky from a theme's two colours, and match the caps to its ends
     * so the dome has no visible seam where the cylinder stops.
     */
    setGradient(topHex, botHex) {
      capTop = topHex;
      capBot = botHex;
      const old = mat.map;
      mat.map = gradientTexture(topHex, botHex);
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      if (old) old.dispose();
      topCap.material.color.setHex(topHex);
      botCap.material.color.setHex(botHex);
    },

    /** Keep everything centred on the camera so it behaves as infinitely far. */
    update(cameraPos) {
      mesh.position.set(cameraPos.x, cameraPos.y + VERTICAL_OFFSET, cameraPos.z);
      topCap.position.set(cameraPos.x, cameraPos.y + TOP_CLEARANCE, cameraPos.z);
      botCap.position.set(cameraPos.x, cameraPos.y - BOTTOM_CLEARANCE, cameraPos.z);
    },
  };
}
