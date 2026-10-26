// The sky: gradient, sun, stars, cloud deck and the warm horizon band.
//
// THE FAR RANGE IS NO LONGER HERE. It was painted in this shader from the view
// direction for three rounds and failed three times, for one structural reason:
// a silhouette that is a function of azimuth alone has no surface under it, so
// nothing drawn below it can be lit. It is now real geometry in range.js, with
// real normals, and this file is ~300 ALU lighter for it — see the cost rule.
//
// The dome is parented to nothing and simply follows the camera each frame, with
// depth testing off and a render order that puts it first — so it is a
// background, and the terrain always wins the depth fight.
//
// THE COST RULE FOR THIS FILE. `depthTest:false` at renderOrder -1000 on a
// BackSide sphere means 100% overdraw: every instruction here is paid once per
// pixel of the screen, every frame, before anything else has drawn. It is the
// most expensive place in the renderer to be careless. So the one heavy block
// left — the cloud fbm — is behind an elevation guard, and the guard is on
// `d.y`, which is monotone in screen y, so a warp is never split by it.
// Roughly 60% of the frame is groomed snow that paints over all of this; those
// pixels now pay for a gradient and nothing else.

import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  // The dome is centred on the camera, so the local position IS the ray.
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;

uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uZenith;
uniform vec3  uHorizon;
uniform vec3  uFogColor;
uniform float uCloud;
uniform float uTime;

varying vec3 vDir;

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/**
 * The four corner hashes of a value-noise cell.
 *
 * Split out so n21 and n21d share it, and — the part that matters — so the
 * corner is always addressed as the integer lattice point, never as
 * "this cell's origin plus one". dot(i,K)+127.1 and dot(i+(1,0),K) differ in
 * the last ulp, and sin(x)*43758 turns one ulp at x~30000 into a completely
 * different hash, so the cheaper form would put a discontinuity on every cell
 * boundary.
 */
vec4 corners4(vec2 i) {
  return vec4(h21(i), h21(i + vec2(1.0, 0.0)),
              h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)));
}

float n21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec4 h = corners4(i);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}

float fbm2(vec2 p) {
  return n21(p) * 0.55 + n21(p * 2.07 + 13.0) * 0.28 + n21(p * 4.13 + 41.0) * 0.17;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 L = normalize(uSunDir);
  float el = d.y;
  float cosA = dot(d, L);

  // ── gradient ────────────────────────────────────────────────────────────
  // The reference ramps 1.09 stops from zenith to horizon, 0.230 to 0.489 —
  // NOT the 2.27 this was solved against. That figure came from a measurement
  // that read the PNG's own 1-2 px dark border as sky, and exp2(-el*11.8) built
  // to match it put a third of the frame in a near-black violet void that
  // banded on the way down. uZenith is corrected in mood.js; 7.0 is the rate
  // that spends the remaining stop over the frame instead of over the first
  // hundred pixels. exp2 is a hair cheaper than pow, and the narrow warm band
  // still falls out of the gradient rather than needing a second term.
  float h = exp2(-max(el, 0.0) * 7.0);
  vec3 col = mix(uZenith, uHorizon, h);

  // Inscatter around the sun, well before the disc itself.
  col += uSunColor * pow(max(cosA, 0.0), 8.0) * 0.30;
  col += uSunColor * pow(max(cosA, 0.0), 200.0) * 1.30;

  // ── stars ───────────────────────────────────────────────────────────────
  // Before the clouds and the range, so both correctly occlude them. The cells
  // are laid out in a stereographic chart of the sky rather than in (az, el):
  // it is conformal, so cells stay square instead of smearing radially near the
  // horizon, and it costs a reciprocal instead of an atan.
  if (el > 0.02) {
    vec2  sp   = d.xz * (62.0 / (1.0 + el));
    vec2  ci   = floor(sp);
    float pres = h21(ci);
    float mag  = h21(ci + 19.7);
    vec2  cf   = fract(sp) - 0.5 - (vec2(fract(pres * 97.0), fract(mag * 61.0)) - 0.5) * 0.8;
    float m    = max(pres - 0.62, 0.0) * 2.63;              // ~38% of cells carry a star
    // mag^3, not mag^2, and 3.4x the gain. The count was already right — 308
    // per 100 kpx against the reference's 465, and the reference's is inflated
    // by its own film grain — but the brightest of ours reached 0.061 above the
    // sky against 0.222. An even carpet of faint dots is not a night sky; two
    // dozen bright ones over a faint carpet is. Cubing holds the median down
    // (0.023, the reference's own) while the gain frees the top of the tail.
    float s    = exp2(-dot(cf, cf) * 180.0) * m * mag * mag * mag;
    col += vec3(0.72, 0.78, 1.0) * s * 0.34 * smoothstep(0.02, 0.24, el);
  }

  // ── clouds ──────────────────────────────────────────────────────────────
  // Directions projected onto a flat deck, so the layer compresses toward the
  // horizon exactly the way a real overcast does. alpha carries a
  // smoothstep(0.0, 0.16, el), so below the horizon the whole block is provably
  // a no-op — hence the guard.
  if (el > 0.0) {
    float deck = max(el, 0.045);
    vec2 cuv = d.xz / deck * 0.055 + vec2(uTime * 0.0035, uTime * 0.0012);
    float c = fbm2(cuv);
    float cover = mix(0.74, 0.30, uCloud);
    float alpha = smoothstep(cover, cover + 0.22, c) * smoothstep(0.0, 0.16, el) * uCloud;
    // Low sun lights the undersides; that warm belly is most of the drama.
    vec3 cloudCol = mix(uHorizon * 0.55, uSunColor, pow(max(cosA, 0.0), 3.0) * 0.75 + 0.18);
    col = mix(col, cloudCol, clamp(alpha, 0.0, 1.0));
  }

  // ── the horizon band ────────────────────────────────────────────────────
  // Gone by el = 0.22 anyway, so the top of the frame skips it.
  if (el < 0.24) {
    // The reference's band core is DARKER than the sky above it (0.382 against
    // 0.428) — it is a hue shift at falling luminance, not a second brightening,
    // and the drop is what gives the skyline something to be silhouetted
    // against.
    //
    // THE BAND HAS TO KNOW WHERE THE SUN IS. Ours had no azimuthal term at all,
    // so it painted an even stripe right around the horizon and read as a stage
    // backdrop. The reference runs 1.6x brighter at the end of the skyline the
    // sun is about to rise behind — and puts its WARMEST point on the opposite
    // side, a Belt of Venus counter-glow. Two separate chromatic events with
    // positions, which is how a viewer knows the light's direction before a
    // single face is lit. Two mads and a pow each.
    float band = exp2(-max(el - 0.06, 0.0) * 40.0);
    col = mix(col, uHorizon * vec3(0.98, 0.68, 0.64),
              band * (0.30 + 0.42 * pow(max(cosA, 0.0), 1.5)));
    col = mix(col, uHorizon * vec3(1.12, 0.80, 0.98),
              band * 0.26 * max(-cosA, 0.0));
    // Below the horizon there is always either terrain or the far range's skirt,
    // so this one mix is pure insurance against a framing that finds neither —
    // and it puts the airlight, not the zenith, where the ground ought to be.
    col = mix(col, uFogColor * 1.30, smoothstep(0.02, -0.22, el) * 0.85);
  }

  // The sun itself, hot enough that bloom picks it up as a flare.
  float disc = smoothstep(0.99955, 0.99988, cosA);
  col += uSunColor * disc * 7.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  constructor(scene, mood) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.3, 0.2, -0.9) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uZenith: { value: new THREE.Color(0x1f5fc0) },
        uHorizon: { value: new THREE.Color(0xbcd9f5) },
        uFogColor: { value: new THREE.Color(0xa8c4e6) },
        uCloud: { value: 0.3 },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    mood.bind(this.material.uniforms);

    // 96x48 rather than 32x20. vDir is the interpolated vertex POSITION, which
    // traces a chord across each triangle rather than the arc, so the elevation
    // a fragment sees is slightly wrong in the middle of a face. Under the old
    // cubic gradient that was invisible; under an exp2 in el, which is much
    // steeper near the horizon, it showed as polygonal facets in the sky.
    // Four thousand vertices, drawn once a frame, is not a cost.
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 96, 48), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  update(time, camPos) {
    this.material.uniforms.uTime.value = time;
    this.mesh.position.copy(camPos);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
