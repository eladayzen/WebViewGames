// Light, sky and air — and the arc the run travels through them.
//
// A single descent moves from the void between portals to a red shift. That is
// not decoration: it is the only way a two-and-a-half minute run on one slope
// gets a sense of having gone somewhere. Every module that draws anything reads
// its colours from here, so the whole world turns together and nothing has its
// own idea of where the light is.
//
// Values are held once, interpolated once, and copied into every bound uniform
// set each frame. Modules never store their own colours.
//
// DIMENSION X, NOT A MOUNTAIN. The table below is a rewrite of carve's alpine
// hours into an alien sky — a violet void, a portal cracking the horizon,
// a xenon noon, an ion storm, a dying red star. What it is NOT is a rewrite of
// the structure those hours were solved into. Three things carried over
// unchanged, on purpose, and each would cost real legibility to undo:
//
//   THE SUN DIRECTIONS. They rake ACROSS the slope rather than down the fall
//   line. Head-on, the light sat in frame for the entire run, blew the haze out
//   toward its own colour and flattened the terrain into a wash — and once the
//   ground started self-shadowing, all that backlight bought was a large dark
//   area with no shape in it. Raking, every roller and bank throws a shadow
//   along the piste. Which dimension the light comes from does not change that.
//
//   THE GROUND IS NEARLY NEUTRAL. The temptation to make the surface itself
//   alien-violet is exactly the mistake carve already made and backed out of:
//   colour baked into the albedo survives at every brightness, so the
//   highlights and the shadows share a hue and the frame loses its light. The
//   alien belongs in the LIGHT. The ground is also what the trail, the rider's
//   shadow and the gates are read against, and none of them have anywhere else
//   to be seen, so it stays low-saturation and even.
//
//   What did NOT carry over is how BRIGHT it is. Carve's albedo was ~0.9,
//   because snow is ~0.9, and at these exposures that clipped: a frame of
//   blown-out white takes no hue from the light at all, which is why the first
//   two passes here came back as a ski slope with a coloured sky over it
//   however far the key was rotated. This ground is 0.40 to 0.55 — rock and
//   dust, not snow. That is what gives the light somewhere to land, and it is
//   the single change that stops the screenshots looking alpine.
//
//   THE PACING. The five `at` fractions and the fog/sparkle/cloud/bloom/exposure
//   numbers are carve's, because they are about how fast the world turns and how
//   far ahead it can be read at speed, not about what colour it is.
//
// Every stop here lands inside the six bands `moodmetrics.mjs` measures, which
// carve's own shipped table did not — it sat outside them at 11 of 25 points.
// Those bands are not a style; they are the difference between a sky and a dark
// wall hung across the valley. `node moodmetrics.mjs` is how a change to this
// file gets checked before anyone looks at it.
//
// THE KEY AND THE FILL ARE OPPOSED IN HUE AT EVERY STOP, 128 to 172 degrees
// apart. This is the one thing the first pass at this table got wrong and the
// screenshots caught: five stops all landed inside the five luminance bands and
// all five came back as a single flat colour, because a magenta key over a
// magenta fill paints the lit faces and the shadowed faces the same hue at two
// brightnesses, and a slope with no hue difference across it has no form in it.
// Carve's three stops that read put a warm key against a cold fill — 169, 176
// and 131 degrees — and its two that do not are at 4 and 0. So the fill here is
// always the key's opposite, which also happens to be what the place looks
// like: green light under a violet void, a magenta portal throwing teal
// shadows, a red star over a cold sky.

import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const C = (hex) => new THREE.Color(hex);

/**
 * The five stops. `at` is the fraction of the run where this mood is fully
 * reached; the mixer lerps between neighbours, so the light never steps.
 */
export const MOODS = [
  {
    at: 0.0,
    label: 'void',
    uSunDir: V(0.86, 0.13, -0.50),
    // Bioluminescent green, under a violet void: the key and the fill 128
    // degrees apart, which is the whole reason this stop has a lit side and a
    // shadowed side rather than one brightness of lavender.
    uSunColor: C(0x95f4ac),      // cold alien green; with no portal open the glow IS the light
    uSkyColor: C(0x6a4aa1),      // key:fill 7.0 — the ratio the whole table is solved at
    uGroundColor: C(0x805eb6),   // bounce off the surface, carrying the violet back up
    uSnowColor: C(0xabadb8),     // near-neutral, S 0.14: the colour is the light, not the ground
    uRockColor: C(0x3c4943),     // alien basalt, off the ground's hue or it reads as dark ground
    // The haze the distance dissolves INTO, so it sits at 0.86 of the horizon's
    // own luminance — the measured ratio that keeps the far range reading as
    // distance. Below ~0.7 it stops being distance and becomes a dark wall.
    uFogColor: C(0x8667bb),
    uFogSunColor: C(0x9ad8b0),   // the lit side of the haze takes the glow's green
    uZenith: C(0x5738a3),        // 1.50 stops under the horizon: dark, but not a banding void
    uHorizon: C(0x906fc9),
uFogDensity: 0.0030,
    uSparkle: 0.10,
    uCloud: 0.30,
    bloom: 0.50,
    exposure: 1.7,
  },
  {
    // A portal opens somewhere off the side of the course and floods the
    // horizon magenta. This is the stop that replaces sunrise and it does the
    // same job: the first time in the run that the light has a colour of its
    // own and the shadows get a direction you can name.
    at: 0.18,
    label: 'portal rise',
    uSunDir: V(0.81, 0.20, -0.55),
    uSunColor: C(0xff6ad0),      // the portal itself, and it is the only light left
    uSkyColor: C(0x124852),      // teal, 130 degrees off the key: every shadow goes cold
    uGroundColor: C(0x1d5863),
    uSnowColor: C(0xada8b0),
    uRockColor: C(0x2a3f42),
    uFogColor: C(0xc86bb8),
    uFogSunColor: C(0xffb0e4),
    uZenith: C(0x7437bd),
    uHorizon: C(0xf65cb9),
uFogDensity: 0.0062,
    uSparkle: 1.15,
    uCloud: 0.38,
    bloom: 0.78,
    exposure: 1.52,
  },
  {
    // Noon, for whatever a dimension with no sun calls noon: the sky itself is
    // the source and it is electric. The brightest, flattest-fogged stop, and
    // the one where the course can be read furthest ahead — which is why it is
    // the one the fastest line is usually found in.
    at: 0.46,
    label: 'high xenon',
    uSunDir: V(0.64, 0.44, -0.63),
    // KEY:FILL IS 4.3 HERE, NOT 7, and the key is properly acid rather than a
    // white with a cast on it. At 7 and near-white this stop came back as grey
    // — the brightest stop in the ring was also the one with the least colour
    // in it, which is backwards. Dropping the ratio lets the blue fill reach
    // the shadowed faces instead of leaving them a darker grey.
    uSunColor: C(0xdcff8a),      // acid, and the brightest key in the ring
    uSkyColor: C(0x2177fd),      // 139 degrees off: the shadows are the cold blue of the sky
    uGroundColor: C(0x3686d2),
    uSnowColor: C(0xc1c5bc),
    uRockColor: C(0x2f3a30),
    uFogColor: C(0x74d3af),
    uFogSunColor: C(0xeaffc8),
    uZenith: C(0x2495ff),
    uHorizon: C(0x7be2b6),
uFogDensity: 0.0048,
    uSparkle: 1.7,
    uCloud: 0.22,
    bloom: 0.70,
    exposure: 0.81,
  },
  {
    // The squall's replacement. Charged particulate, not snow: the colour drains
    // out of everything, the fog triples and the run becomes about how far ahead
    // you can see. Key to fill falls to 3 to 1 — still directional, but this is
    // the one stop where the light is deliberately close to flat, because that
    // is what the weather is.
    at: 0.68,
    label: 'ion storm',
    uSunDir: V(0.71, 0.30, -0.64),
    uSunColor: C(0xcbd7aa),      // what is left of the xenon through the particulate
    uSkyColor: C(0x708199),      // 139 degrees off, but only 3:1 — opposed and nearly as bright
    uGroundColor: C(0x62748c),
    uSnowColor: C(0xb1b4ab),
    uRockColor: C(0x353a31),
    uFogColor: C(0x98a696),
    uFogSunColor: C(0xdfe6cc),
    uZenith: C(0x607185),
    uHorizon: C(0xa4b298),
uFogDensity: 0.0112,
    uSparkle: 0.5,
    uCloud: 0.85,
    bloom: 0.55,
    exposure: 1.06,
  },
  {
    // 0.88, NOT 1.0. The arc is a ring (see `setProgress`) and a final stop
    // sitting exactly on the end of the cycle leaves the wrap back to the void
    // a span of zero — the red would cut to the dark on one frame. Pulling the
    // red shift in to 0.88 hands the last twelve per cent of the cycle, about
    // twenty seconds at this track length, to the fall between them.
    at: 0.88,
    label: 'red shift',
    uSunDir: V(0.89, 0.10, -0.45),
    uSunColor: C(0xff5a44),      // a star falling off the red end, 172 degrees from the fill
    uSkyColor: C(0x194a5a),
    uGroundColor: C(0x225b6d),
    uSnowColor: C(0xc1afab),     // the warmest the ground gets, and still S 0.23
    uRockColor: C(0x3d2c30),
    uFogColor: C(0xc16b51),
    uFogSunColor: C(0xff9a78),
    uZenith: C(0x5f36c6),
    uHorizon: C(0xef5a35),
uFogDensity: 0.0078,
    uSparkle: 1.0,
    uCloud: 0.40,
    bloom: 0.95,
    exposure: 2.6,
  },
];

const COLOR_KEYS = ['uSunColor', 'uSkyColor', 'uGroundColor', 'uSnowColor',
  'uRockColor', 'uFogColor', 'uFogSunColor', 'uZenith', 'uHorizon'];
const NUM_KEYS = ['uFogDensity', 'uSparkle', 'uCloud'];

export class Mood {
  constructor() {
    /** Multiplier on every fog uniform, owned by the place. 1 is the hour's own. */
    this.fogScale = 1;
    this.uSunDir = new THREE.Vector3();
    for (const k of COLOR_KEYS) this[k] = new THREE.Color();
    for (const k of NUM_KEYS) this[k] = 0;
    this.bloom = 0.7;
    this.exposure = 1;
    this.label = MOODS[0].label;
    this._bound = [];
    this.setProgress(0);
  }

  /** Register a uniform object; matching keys are refreshed every frame. */
  bind(uniforms) {
    this._bound.push(uniforms);
    this._push(uniforms);
  }

  _push(u) {
    if (u.uSunDir) u.uSunDir.value.copy(this.uSunDir);
    for (const k of COLOR_KEYS) if (u[k]) u[k].value.copy(this[k]);
    for (const k of NUM_KEYS) if (u[k]) u[k].value = this[k];
    // THE PLACE'S WEATHER, applied last so it multiplies the hour rather than
    // replacing it: a whiteout at dawn and a whiteout at noon are still dawn
    // and noon. Fog is the one thing that changes how far ahead the mountain
    // can be read, which is a different game at speed rather than a different
    // palette. See `places.js`.
    if (u.uFogDensity) u.uFogDensity.value = this.uFogDensity * this.fogScale;
  }

  /**
   * Jump straight to the mood for a cycle fraction in [0,1].
   *
   * THE ARC IS A RING. The descent is endless and the light cycles with the
   * track, so the last stop has to lead somewhere: past `at` 1.0 the mixer
   * wraps the red shift back into the void, which is the last light going out
   * before the next portal. Clamping instead — which is what this did while a
   * run was the length of one track — would park an endless run in the red
   * shift for as long as the player survived, and the arc's whole job is to
   * make a descent feel like it went somewhere.
   *
   * The wrap is a lerp through the short way round, not through a dark stop
   * that does not exist. The red shift's zenith is 0x5a43ad and the void's is
   * 0x4c448b — 0.28 stops apart, measured — so the sky barely moves across the
   * seam. The light is the part that travels: 0xff5a4a to 0xb9e6ff, a dying red
   * to a cold star, which is the transition to watch when judging whether this
   * needs a sixth stop between them.
   */
  setProgress(t) {
    const p = ((t % 1) + 1) % 1;
    const last = MOODS.length - 1;
    let a;
    let b;
    let k;
    if (p >= MOODS[last].at) {
      // Past the final stop: wrap round to the first.
      const span = Math.max(1e-6, 1 - MOODS[last].at + MOODS[0].at);
      a = MOODS[last];
      b = MOODS[0];
      k = Math.max(0, Math.min(1, (p - MOODS[last].at) / span));
    } else {
      let i = 0;
      while (i < MOODS.length - 2 && MOODS[i + 1].at < p) i++;
      a = MOODS[i];
      b = MOODS[i + 1] ?? a;
      const span = Math.max(1e-6, b.at - a.at);
      k = Math.max(0, Math.min(1, (p - a.at) / span));
    }

    this.uSunDir.copy(a.uSunDir).lerp(b.uSunDir, k).normalize();
    for (const key of COLOR_KEYS) this[key].copy(a[key]).lerp(b[key], k);
    for (const key of NUM_KEYS) this[key] = a[key] + (b[key] - a[key]) * k;
    this.bloom = a.bloom + (b.bloom - a.bloom) * k;
    this.exposure = a.exposure + (b.exposure - a.exposure) * k;
    this.label = k < 0.5 ? a.label : b.label;

    for (const u of this._bound) this._push(u);
  }
}
