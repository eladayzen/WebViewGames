// Light, sky and air — and the arc the run travels through them.
//
// A single descent moves from first light to alpenglow. That is not decoration:
// it is the only way a two-and-a-half minute run on one mountain gets a sense of
// having gone somewhere. Every module that draws anything reads its colours from
// here, so the whole world turns together and nothing has its own idea of where
// the sun is.
//
// Values are held once, interpolated once, and copied into every bound uniform
// set each frame. Modules never store their own colours.

import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const C = (hex) => new THREE.Color(hex);

/**
 * The five stops. `at` is the fraction of the run where this mood is fully
 * reached; the mixer lerps between neighbours, so the light never steps.
 *
 * THE SUN IS OFF TO THE SIDE, not down the fall line. Head-on it sat in frame
 * for the entire run, blew the haze out toward its own colour and flattened the
 * terrain into a wash — and once the snow started self-shadowing, all that
 * backlight bought was a large dark area with no shape in it. Raking across the
 * slope instead, every roller and bank throws a shadow along the piste, and the
 * flare only appears when the rider actually carves toward it.
 */
export const MOODS = [
  {
    at: 0.0,
    label: 'first light',
    // Cold and blue, but not murky: this is the player's first impression of the
    // mountain and it still has to read as snow rather than as a dark screen.
    //
    // SOLVED AGAINST THE REFERENCE ART, not dialled by eye. The old set put the
    // key and the fill at a luminance ratio of 0.96 to 1 — half the light on lit
    // snow was blue sky ambient and the other half a blue-lavender "sun" — so
    // the frame had no light direction in it and every surface came out the
    // same colour whichever way it faced. The measured target is nearer 7 to 1.
    //
    // The colour of the SNOW is not in the snow. Its albedo is ~0.9 and very
    // nearly neutral; all the blue belongs to the light. The old uSnowColor
    // baked blue into the albedo, where it survived at every brightness, which
    // is why the highlights and the shadows shared a hue.
    uSunDir: V(0.86, 0.13, -0.50),
    uSunColor: C(0xd0d6ff),      // cool blue-white: before sunrise the illuminant IS the sky
    uSkyColor: C(0x272d46),      // the fill has to stop competing with the key
    uGroundColor: C(0x494d60),   // bounce off snow, carrying the key's colour rather than pure blue
    uSnowColor: C(0xf7f9ff),     // near-neutral; measured lit snow in the reference is S 0.14
    uRockColor: C(0x4a4640),     // 2.4x the old value and off the snow's hue, or it reads as dark snow
    // The haze the distance dissolves INTO, so it has to sit near the sky's own
    // luminance or the far range stops being distance and becomes a dark wall
    // hung across the valley — which is exactly how it read at 0x42465e, and
    // what a blind reviewer called "a featureless dark purple-brown wall with
    // no ridgeline". Measured target: the reference's far range sits at 0.86 of
    // its horizon sky. This also feeds the terrain's distance fog, so the same
    // change buys the aerial perspective that was running backwards.
    uFogColor: C(0x515476),
    uFogSunColor: C(0x473847),   // the warm side of the range is rose, matching the sky band
    // 0x000a30 came from a measurement of the reference art that had read the
    // PNG's own 1-2 pixel dark border as sky. It put the zenith four times too
    // dark and made a third of the frame a near-black violet void that banded
    // on its way down. The reference's sky actually spans 1.09 stops from
    // zenith to horizon, not the 2.27 that value was solved against.
    uZenith: C(0x1f2349),
    uHorizon: C(0x736375),       // dusty rose, measured H295 S0.245, not the salmon it looks like
    uFogDensity: 0.0030,
    uSparkle: 0.10,              // scales with sun colour x exposure, both of which just went up
    uCloud: 0.30,
    bloom: 0.50,
    exposure: 1.7,
  },
  {
    at: 0.18,
    label: 'sunrise',
    uSunDir: V(0.81, 0.20, -0.55),
    uSunColor: C(0xffb26b),
    uSkyColor: C(0x5b7ec2),
    uGroundColor: C(0x364a75),
    uSnowColor: C(0xe6dfe2),
    uRockColor: C(0x241f24),
    uFogColor: C(0x8494bd),
    uFogSunColor: C(0xffb887),
    uZenith: C(0x2a4a86),
    uHorizon: C(0xf0a874),
    uFogDensity: 0.0062,
    uSparkle: 1.15,
    uCloud: 0.38,
    bloom: 0.78,
    exposure: 1.52,
  },
  {
    at: 0.46,
    label: 'bluebird',
    uSunDir: V(0.64, 0.44, -0.63),
    uSunColor: C(0xfff2dc),
    uSkyColor: C(0x7fb0f0),
    uGroundColor: C(0x4d6fa8),
    uSnowColor: C(0xf6f9ff),
    uRockColor: C(0x2b2b31),
    uFogColor: C(0xa8c4e6),
    uFogSunColor: C(0xffeccd),
    uZenith: C(0x1f5fc0),
    uHorizon: C(0xbcd9f5),
    uFogDensity: 0.0048,
    uSparkle: 1.7,
    uCloud: 0.22,
    bloom: 0.70,
    exposure: 0.81,
  },
  {
    at: 0.68,
    label: 'squall',
    uSunDir: V(0.71, 0.30, -0.64),
    uSunColor: C(0xb9c3d2),
    uSkyColor: C(0x7d8ba0),
    uGroundColor: C(0x59657a),
    uSnowColor: C(0xdfe6ef),
    uRockColor: C(0x2e3138),
    uFogColor: C(0x93a0b3),
    uFogSunColor: C(0xc2cbd8),
    uZenith: C(0x54607a),
    uHorizon: C(0x9aa6b8),
    uFogDensity: 0.0112,
    uSparkle: 0.5,
    uCloud: 0.85,
    bloom: 0.55,
    exposure: 1.06,
  },
  {
    // 0.88, NOT 1.0. The arc is a ring now (see `setProgress`) and a final stop
    // sitting exactly on the end of the cycle leaves the wrap back to first
    // light a span of zero — dusk would cut to dawn on one frame. Pulling
    // alpenglow in to 0.88 hands the last twelve per cent of the cycle, about
    // twenty seconds at this track length, to the night between them.
    at: 0.88,
    label: 'alpenglow',
    uSunDir: V(0.89, 0.10, -0.45),
    uSunColor: C(0xff8a5c),
    uSkyColor: C(0x6a63a8),
    uGroundColor: C(0x39355f),
    uSnowColor: C(0xf0c4c0),
    uRockColor: C(0x23191f),
    uFogColor: C(0x77689b),
    uFogSunColor: C(0xff9d6a),
    uZenith: C(0x241a4d),
    uHorizon: C(0xff9a70),
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
   * wraps alpenglow back into first light over `WRAP`, which is dusk falling
   * into the next dawn. Clamping instead — which is what this did while a run
   * was the length of one track — would park an endless run in alpenglow for as
   * long as the player survived, and the arc's whole job is to make a descent
   * feel like it went somewhere.
   *
   * The wrap is a lerp through the short way round, not through a night stop
   * that does not exist. Alpenglow's zenith is 0x241a4d and first light's is
   * 0x1f2349 — near neighbours, measured — so the sky barely moves across the
   * seam. The sun is the part that travels: 0xff8a5c to 0xd0d6ff, orange to
   * blue-white, which is the transition to watch when judging whether this
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
