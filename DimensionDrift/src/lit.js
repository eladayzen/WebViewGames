// One lighting model for every solid object that is not the snow.
//
// The rider, the trees, the rocks and the gates all have to sit in the same air
// as the mountain — same sun, same ambient split, same height fog — or they read
// as stickers on a photograph. Rather than four shaders that drift apart, there
// is one, parameterised by colour, and `Mood` writes the light into all of them.

import * as THREE from 'three';
import { FALL_PROFILE } from './mountain.js';

// three.js resolves #include before the GLSL preprocessor runs, and defines
// USE_SKINNING from `object.isSkinnedMesh` for any material — ShaderMaterial
// included — so the stock skinning chunks work here without the renderer needing
// to know this is a hand-written shader. The bone texture and bind matrices are
// bound by setOptional, which reads them straight off the object.
const LIT_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying float vAlt;
uniform vec4 uFallA;   // S0, S1, L1, S2
uniform vec2 uFallB;   // L2, PH

/**
 * Height of the fall line at p, identical to Terrain.baseHeight. Two cosines in
 * a vertex shader, against the alternative of a linearisation that drifts tens
 * of metres over the view distance and would put the treeline's sunrise in a
 * different place from the snow's.
 */
float fallLine(float p) {
  float S0 = uFallA.x, S1 = uFallA.y, L1 = uFallA.z, S2 = uFallA.w;
  float L2 = uFallB.x, PH = uFallB.y;
  return -(S0 * p - S1 * L1 * cos(p / L1) - S2 * L2 * cos(p / L2 + PH))
         - (S1 * L1 + S2 * L2);
}
#ifdef USE_INSTANCING
attribute vec3 aTint;
#endif
#ifdef LIT_GARMENT
attribute float aGarment;
varying float vGarment;
#endif
#include <common>
#include <skinning_pars_vertex>
void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>

  #ifdef USE_INSTANCING
    vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
    vColor = aTint;
  #else
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    vNormal = normalize(mat3(modelMatrix) * objectNormal);
    vColor = vec3(1.0);
  #endif
  #ifdef LIT_GARMENT
    vGarment = aGarment;
  #endif
  vUv = uv;
  vWorld = wp.xyz;
  vAlt = wp.y - fallLine(-wp.z);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const LIT_FRAG = /* glsl */ `
precision highp float;

uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uSkyColor;
uniform vec3  uGroundColor;
uniform vec3  uFogColor;
uniform vec3  uFogSunColor;
uniform vec3  uCamPos;
uniform vec3  uBase;
uniform vec3  uSnowColor;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
uniform float uWrap;
uniform float uGloss;
uniform float uSpecular;
uniform float uEmissive;
uniform float uSnowCap;
uniform float uSunFloor;
uniform float uSunFlat;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying float vAlt;

#ifdef LIT_MAP
uniform sampler2D uMap;
uniform float uMapTint;
#endif
#ifdef LIT_GARMENT
uniform vec3 uProfile;
uniform float uProfileMix;
varying float vGarment;
#endif

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(uSunDir);

  vec3 albedo = uBase * vColor;
  #ifdef LIT_MAP
    // uMapTint pulls the texture toward white before it multiplies the base:
    // at 1.0 the map paints fully (the original look), at 0.0 it is ignored and
    // the base colour stands alone. The rivals run this low so their jersey
    // colour leads and the character's own texture survives only as shading --
    // "tinted texture, strong". Default 1.0, so every other textured material
    // is untouched.
    vec3 texCol = texture2D(uMap, vUv).rgb;
    albedo *= mix(vec3(1.0), texCol, uMapTint);
    #ifdef LIT_GARMENT
      // The garment texels swap hue to the profile colour and keep the
      // texture's own shading as luminance -- the rivals' jersey recolour,
      // applied per vertex instead of per material. vGarment interpolates
      // across the seam triangles, which is a feature: the edge between cap
      // and face fades over a texel instead of stair-stepping.
      float texLum = dot(texCol, vec3(0.299, 0.587, 0.114));
      albedo = mix(albedo, uProfile * (0.3 + 0.9 * texLum), vGarment * uProfileMix);
    #endif
  #endif
  // Snow settles on upward faces. One line, and suddenly the trees belong here.
  albedo = mix(albedo, uSnowColor, smoothstep(0.45, 0.92, N.y) * uSnowCap);

  // THE SAME SUN AS THE SNOW. The mountain gates its direct light by altitude
  // above the fall line, so at first light the valley floor is lit by the sky
  // dome alone and only the high ground takes a beam. Everything drawn through
  // THIS shader stands on that snow — trees, rocks, gates, marker poles — and
  // while the gate lived only in the snow shader they were lit by a sun the
  // ground did not have. Dark objects hid it; a pale marker board blazed white
  // against a pre-sunrise hillside and read as a hole in the world.
  float wrap = clamp((dot(N, L) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  float sunHi = smoothstep(uSunFloor - 30.0, uSunFloor + 30.0, vAlt);
  float dome = 0.5 + 0.5 * N.y;
  float d2 = dome * dome;
  float d4 = d2 * d2;
  float d8 = d4 * d4;
  // AND THE PRE-DAWN KEY HAS A DIRECTION. dome is a function of N.y alone, so
  // below the sun floor it could not tell which way a face pointed — not just in
  // azimuth, but in any lateral tilt at all. Everything standing on the snow was
  // lit flat, and nothing appeared to cast anything. The snow shader now biases
  // its below-floor term toward the sun's azimuth; this is the same expression,
  // and the three constants must track it. pisteN uses FALL_PROFILE.S0, which
  // this shader already carries as uFallA.x in its vertex stage.
  vec3 pisteN = normalize(vec3(0.0, 1.0, -0.30));
  vec3 preL   = normalize(vec3(L.x * 1.6, 1.0, L.z * 1.6));
  float pre   = max(0.0, (dot(N, preL) + 0.48) / (dot(pisteN, preL) + 0.48));
  vec3 direct = uSunColor * mix(uSunFlat * d8 * d8 * pre, wrap, sunHi);
  vec3 ambient = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5);

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uGloss) * uSpecular;

  vec3 col = albedo * (direct + ambient) + uSunColor * spec + albedo * uEmissive;

  float dist = length(vWorld - uCamPos);
  float dy = vWorld.y - uCamPos.y;
  float t = uFogFalloff * dy;
  float k = abs(t) < 1e-4 ? 1.0 : (1.0 - exp(-t)) / t;
  // THE SAME AIR AS THE SNOW. mountain.js and both of trail.js's shaders carry a
  // * 0.5 on the mood's density; this one did not, so every tree, rock, gate,
  // marker pole and the rider itself hazed at twice the optical density of the
  // ground they stand on. The whole point of this file is that solid objects
  // "sit in the same air as the mountain" — and the one line that decides that
  // was the one line that disagreed.
  float f = uFogDensity * 0.5 * exp(-uFogFalloff * (uCamPos.y - uFogBase)) * dist * k;
  float fog = 1.0 - exp(-max(f, 0.0));
  float toSun = pow(max(dot(-V, L), 0.0), 5.0);

  gl_FragColor = vec4(mix(col, mix(uFogColor, uFogSunColor, toSun), clamp(fog, 0.0, 1.0)), 1.0);
}
`;

/**
 * @param {import('./mood.js').Mood} mood
 * @param {object} opts base colour, wrap width, specular lobe, snow accumulation
 */
export function makeLitMaterial(mood, {
  color = 0xffffff, wrap = 0.35, gloss = 30, specular = 0.3,
  emissive = 0, snowCap = 0, side = THREE.FrontSide, map = null, mapTint = 1,
  garment = false,
} = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: LIT_VERT,
    fragmentShader: LIT_FRAG,
    side,
    defines: { ...(map ? { LIT_MAP: '' } : {}), ...(garment ? { LIT_GARMENT: '' } : {}) },
    uniforms: {
      ...(map ? { uMap: { value: map }, uMapTint: { value: mapTint } } : {}),
      ...(garment ? {
        uProfile: { value: new THREE.Color(0xffffff) },
        uProfileMix: { value: 0 },
      } : {}),
      uSunDir: { value: new THREE.Vector3(0.3, 0.2, -0.9) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSkyColor: { value: new THREE.Color(0x7fb0f0) },
      uGroundColor: { value: new THREE.Color(0x4d6fa8) },
      uSnowColor: { value: new THREE.Color(0xf6f9ff) },
      uFogColor: { value: new THREE.Color(0xa8c4e6) },
      uFogSunColor: { value: new THREE.Color(0xffeccd) },
      uFogDensity: { value: 0.0056 },
      uFogFalloff: { value: 0.012 },
      uFogBase: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBase: { value: new THREE.Color(color) },
      uWrap: { value: wrap },
      uGloss: { value: gloss },
      uSpecular: { value: specular },
      uEmissive: { value: emissive },
      uSnowCap: { value: snowCap },
      // Refreshed every frame by updateLitCommon from the mountain's own values,
      // so there is one sun in the scene and not two.
      uSunFloor: { value: 0 },
      uSunFlat: { value: 1 },
      uFallA: { value: new THREE.Vector4(
        FALL_PROFILE.S0, FALL_PROFILE.S1, FALL_PROFILE.L1, FALL_PROFILE.S2) },
      uFallB: { value: new THREE.Vector2(FALL_PROFILE.L2, FALL_PROFILE.PH) },
    },
  });
  mood.bind(mat.uniforms);
  return mat;
}

/** Every lit material shares these two per-frame values. */
export function updateLitCommon(materials, camPos, fogBase, sunFloor = 0, sunFlat = 1) {
  for (const m of materials) {
    if (!m) continue;
    m.uniforms.uCamPos.value.copy(camPos);
    m.uniforms.uFogBase.value = fogBase;
    m.uniforms.uSunFloor.value = sunFloor;
    m.uniforms.uSunFlat.value = sunFlat;
  }
}
