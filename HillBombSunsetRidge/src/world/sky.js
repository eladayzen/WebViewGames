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
import forestUrl from '../assets/world/sky_forest.jpg?url';
import iceUrl from '../assets/world/sky_ice.jpg?url';
import dunesUrl from '../assets/world/sky_dunes.jpg?url';
import spiresUrl from '../assets/world/sky_spires.jpg?url';
import stormUrl from '../assets/world/sky_storm.jpg?url';

/**
 * A MATTE'S OWN FOG COLOUR.
 *
 * Amit: "there's a colour that is affecting how the level looks at its first
 * point, before the level vanishes from my eyes -- take a medium-dark colour
 * from every matte painting and assign it to that level's fog colour."
 *
 * Fog is the colour distant ground fades INTO, so it is literally the join
 * between the playfield and the painting behind it. It had been pinned to one
 * blue for every level since the sky went flat, which meant six different
 * paintings all had the same hill dissolving into the same colour in front of
 * them -- the ground reached the horizon and stopped being part of the picture.
 *
 * Each value below is measured off its own painting rather than picked by eye:
 * the mean of the medium-dark band (a 14-point percentile window) of the
 * painting's LOWER HALF, which is the haze the ground actually meets -- taking
 * the whole image would drag in the dark sky above it.
 *
 * The window then walks until the sample lands between 0.17 and 0.30 luminance.
 * Too dark ends the world in a black band hanging under a lit sky; too light
 * washes the distant ground out and costs the rider the contrast it needs on a
 * dim board-mounted screen. Four of the six landed in range on the first
 * window. The forest had to walk up -- its pines are near-black, so its honest
 * medium-dark was 0.12. The storm walks all the way down and STILL does not
 * make the ceiling: its painting has no dark pixels below the horizon at all,
 * so it sits at 0.34. That is correct rather than a miss -- fog has to dissolve
 * the ground into the sky actually behind it, and forcing a bright painting to
 * fade to a dark colour would recreate the very band the floor rule exists to
 * prevent.
 */
/**
 * The mattes a terrain can name, by key. A terrain with no `sky` gets the plain
 * gradient, which is still the right answer for a level whose painting has not
 * been made yet -- better a clean ramp than the wrong place behind the hill.
 */
export const SKIES = {
  /**
   * A matte is either a url, or {url, repeat} where `repeat` is how many times
   * it wraps around the 360 degrees.
   *
   * HOW STRETCHED A PAINTING LOOKS IS PER-PAINTING. One wrap spreads a 2048px
   * image around the entire horizon, which is right for the sky-city -- Amit,
   * on an early build: "the matte paint isn't stretched enough", and repeating
   * it twice shrank its towers into a busy little band. But that is a property
   * of what is IN the painting, not a global truth: art with large, widely
   * spaced forms wants one wrap, and art with fine repeated detail looks
   * smeared at that scale and wants two.
   */
  /**
   * The original dusk sky-city. Held at ONE wrap for a long time -- Amit, on an
   * early build: "the matte paint isn't stretched enough" -- but one wrap also
   * means repeat.y of 0.5, i.e. the painting blown up to DOUBLE the cylinder
   * height with only its middle band visible. That was fine while it was the
   * only matte in the game; next to five paintings sitting at a quarter size it
   * became the one that looked wrong. Amit: "the only one which looks funny is
   * number one -- something about the size of the matte painting doesn't make
   * sense."
   *
   * So it joins the dunes at the gentler of the two tiers rather than the ice's.
   * Its towers are large, widely spaced forms and would turn into a busy little
   * band at 8. At 4 wraps its seam also sits 45 degrees off centre -- outside
   * the 26.6 degree half-FOV entirely, so it is never in front of the rider.
   */
  sunset: { url: skyUrl, repeat: 4, fog: 0x66327e },
  /**
   * A wild forest valley -- ranks of black pines falling into mist, ridgelines
   * stacking away to a mint horizon. Made for The Narrows, whose palette is
   * midnightPines, so the hill and the distance are the same world rather than
   * a green level standing in front of somebody else's sky.
   */
  forest: { url: forestUrl, repeat: 8, fog: 0x193133 },
  /**
   * The rest of the set, one per level. All five share the recipe the forest
   * one turned out to be built on, which is worth stating because it is what
   * makes them read rather than any individual subject:
   *
   *   layered silhouettes fading rank by rank into haze -- this is the depth
   *   a bright band at the horizon, trapped between a dark top and dark bottom
   *   no focal point, so turning never reveals it as a photo pinned behind
   *   a bottom edge of haze, never ground, so it cannot argue with the 3D
   *   a tight palette matching the level's own floor colour
   *   painterly and simplified, to sit with the game's flat unlit look
   *
   * Wild rather than realistic survives all of that intact, which is why the
   * dunes and the spires can be at impossible scale and still sit correctly
   * behind the hill.
   */
  // MUCH SMALLER, aspect held. 8 horizontal wraps against a fitted 2 puts the
  // painting at a quarter of its size in BOTH directions -- a band across the
  // middle of the sky rather than the whole sky. Amit: "don't worry if I will
  // see [the repeat] from the sides, I will tell you."
  ice: { url: iceUrl, repeat: 8, fog: 0x224466 },
  // 4 wraps (4 x 2 on the wall) -- half the reduction the ice got. The dunes
  // are broader forms than ice blocks, so they hold together at a larger size
  // where the ice needed the extra step down.
  dunes: { url: dunesUrl, repeat: 4, fog: 0x62301f },
  spires: { url: spiresUrl, repeat: 8, fog: 0x4d2e52 },
  storm: { url: stormUrl, repeat: 8, fog: 0x4a5960 },
};

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
/**
 * How many times a painting should wrap, so it is not distorted.
 *
 * `repeat.x` tiles horizontally but every copy still spans the FULL cylinder
 * height -- so raising it does not reduce stretch, it reverses it. Measured on
 * this cylinder (circumference 2702, height 900) against a 1.65:1 painting:
 *
 *     1 wrap    3.00:1 on the wall   stretched 1.8x WIDE
 *     2 wraps   1.50:1               squashed 1.1x tall
 *     3 wraps   1.00:1               squashed 1.6x tall
 *     5 wraps   0.60:1               squashed 2.7x tall
 *
 * Which is exactly what Amit saw: chasing "less stretched" past 2 was making
 * it worse in the other direction, and by 5 the painting was nearly three
 * times too narrow.
 *
 * The undistorted count is circumference / (aspect * height), and it is
 * ROUNDED because a fractional wrap puts a hard cut through the middle of the
 * image instead of at its edge. On this geometry that lands on 2 for anything
 * near 16:9, about a 10% error -- far below what the eye picks up, and the
 * right default for art nobody has an opinion about.
 */
function fitWraps(img) {
  if (!img || !img.width || !img.height) return 2;
  const circumference = 2 * Math.PI * RADIUS;
  const ideal = circumference / ((img.width / img.height) * HEIGHT);
  return Math.max(1, Math.round(ideal));
}

/**
 * SCALE THE PAINTING DOWN WITHOUT DISTORTING IT.
 *
 * Amit: "keep the aspect ratio but make it smaller -- much, much smaller."
 *
 * Wrapping it more times horizontally alone does not do that, it squashes the
 * image narrow, because every copy still spans the full cylinder HEIGHT. Both
 * axes have to scale together. So repeat.y rises with repeat.x, which shrinks
 * the painting into a horizontal BAND across the cylinder instead of covering
 * it top to bottom -- which is what "smaller" means on a curved surface.
 *
 * wrapT is ClampToEdge, so above and below that band the image's own top and
 * bottom rows stretch out to fill. That is why these paintings are authored
 * with plain sky along the top edge and open haze along the bottom: the clamp
 * then reads as sky continuing up and haze continuing down, rather than as the
 * picture stopping.
 *
 * offset.y = 0.5 - repeatY/2 centres the band, so the painting maps across the
 * middle of the cylinder and its horizon lands where the horizon belongs.
 *
 * Aspect is held exactly: repeatY = repeatX / fitted, since `fitted` is by
 * definition the horizontal count at which one wrap is undistorted.
 */
/**
 * ROTATE THE PAINTING SO NO EDGE SITS DEAD AHEAD.
 *
 * Amit: "the split line is exactly ahead of me in the middle of the frame...
 * it needs to be as far away as possible from the center."
 *
 * That was not bad luck, it was arithmetic. The rider travels along -Z
 * (trough.js centre() returns z = -s), and THREE.CylinderGeometry starts its
 * u wrap at +Z -- so the direction you are looking is exactly u = 0.5. An
 * image edge falls wherever u*repeatX is a whole number, and at 8 wraps
 * 0.5*8 = 4 puts one precisely at the centre of the screen. Every even wrap
 * count does this. It is also why level 1 never showed it: at 1 wrap the
 * centre lands on 0.5, halfway through the image.
 *
 * So shift by whatever puts the forward direction at a HALF tile instead of a
 * whole one -- the furthest any point can be from an edge on a tiled wall.
 * At 8 wraps that is 22.5 degrees off-centre, at 4 it is 45.
 */
function seamOffset(wrapsX) {
  // want frac(0.5*wrapsX + offset) === 0.5
  const o = (0.5 - 0.5 * wrapsX) % 1;
  return o < 0 ? o + 1 : o;
}

function applyScale(tex, wrapsX, fitted) {
  const y = wrapsX / fitted;
  tex.repeat.set(wrapsX, y);
  tex.offset.set(seamOffset(wrapsX), 0.5 - y / 2);
}

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
  // Starts as a gradient; a terrain that names a matte swaps one in through
  // setPanorama below.
  let tex = gradientTexture(0x160e47, 0x401a5f);
  /** Cached by url, so revisiting a level does not re-decode its painting. */
  const mattes = new Map();

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
     * Hang a painted panorama, or pass null to fall back to the gradient.
     *
     * THE MATTE IS BACK, per level rather than globally. Amit: "let's bring
     * back the mat painting we had for the first level, and try to generate
     * something completely new for 3."
     *
     * It came off originally because ONE painting behind every level meant
     * eight different mountains all sat in front of the same skyline -- the
     * problem was never the painting, it was having a single one. A matte per
     * terrain is the version that was actually wanted: the towers and cloud
     * banks give scale and say the hill is somewhere, and now somewhere
     * different each time.
     *
     * Cap colours are sampled from the painting's own edges once it decodes, so
     * the dome closes on the art's own sky rather than on a guess -- and if the
     * art changes, they follow it.
     */
    setPanorama(entry) {
      // A matte is either a url string or {url, repeat}. TYPE-CHECK BEFORE
      // READING `repeat`: on a plain string, `entry.repeat` is not undefined --
      // it is String.prototype.repeat, the built-in method, which is truthy and
      // went straight into repeat.set() as the horizontal tile count. The
      // texture's repeat.x literally became a function, and every matte except
      // the one object-form entry rendered from a NaN scale.
      const obj = entry && typeof entry === 'object';
      const url = obj ? entry.url : entry;
      // An explicit repeat is an ART DIRECTION override; otherwise it is
      // derived from the image once it decodes -- see fitWraps.
      const forced = obj && typeof entry.repeat === 'number' ? entry.repeat : 0;
      if (!url) {
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        return;
      }
      const hit = mattes.get(url);
      if (hit) {
        applyScale(hit.tex, forced || hit.wraps, hit.wraps);
        mat.map = hit.tex;
        topCap.material.color.setHex(hit.top);
        botCap.material.color.setHex(hit.bot);
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        return;
      }
      const t = new THREE.TextureLoader().load(url, (loaded) => {
        const rec = {
          tex: t,
          wraps: fitWraps(loaded.image),
          top: edgeColour(loaded.image, true),
          bot: edgeColour(loaded.image, false),
        };
        applyScale(t, forced || rec.wraps, rec.wraps);
        mattes.set(url, rec);
        // Only apply if this matte is still the one wanted -- a fast level
        // change could otherwise land an old painting on the new hill.
        if (mat.map === t) {
          topCap.material.color.setHex(rec.top);
          botCap.material.color.setHex(rec.bot);
        }
      });
      t.colorSpace = THREE.SRGBColorSpace;
      /**
       * PLAIN repeat, NOT mirrored. Mirroring removes the seam by flipping
       * every other copy, but it buys that by making the horizon a palindrome
       * -- Amit tried it: "Oh, you mirrored it. Not good." The seam is dealt
       * with by seamOffset below and by healing the art itself.
       */
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      // Provisional until the image decodes and fitWraps can measure it.
      applyScale(t, forced || 2, 2);
      mat.map = t;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
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
