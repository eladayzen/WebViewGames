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
uniform vec3  uZenith;
uniform vec3  uHorizon;
uniform float uFogSky;
uniform vec3  uCamPos;
uniform vec3  uBase;
uniform vec3  uSnowColor;
uniform float uFogDensity;
uniform float uFogMul;
uniform float uFogFalloff;
uniform float uFogBase;
uniform float uWrap;
uniform float uGloss;
uniform float uSpecular;
uniform float uEmissive;
uniform vec3  uLampColor;
uniform float uLampStrength;
uniform float uLampRange;
uniform vec3  uLampAim;
uniform float uLampLead;
uniform float uRimStrength;
uniform float uFill;
uniform vec3  uRimColor;
/**
 * ── STATIC LIGHTS ────────────────────────────────────────────────────────
 * xyz is the position, w is the range. w == 0 means the slot is empty, which
 * is how a scene with fewer than four lights costs nothing but the branch.
 */
uniform vec4  uPtPos[4];
uniform vec3  uPtCol[4];
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

/**
 * ── THE AIR TAKES THE SKY'S OWN COLOUR ────────────────────────────────────
 *
 * The sky dome is a gradient from uZenith to uHorizon in the view ray's
 * elevation, and the air in front of it was a FLAT colour. Those two can only
 * agree in one direction, so everywhere else the horizon was a seam -- distant
 * ground dissolving into one colour while the sky above it was another. It
 * reads as a wall across the frame, which is exactly what it is.
 *
 * Recomputing the dome's formula here, from the same two uniforms and the same
 * rate, means the air and the sky behind it cannot drift apart by
 * construction. Borrowed from the WagonRampage prototype, which patches the
 * three.js fog chunks to do the same thing -- this file has its own fog, so it
 * copies the formula instead.
 */
vec3 airSky(vec3 viewDir) {
  float elA = viewDir.y;
  float hA = exp2(-max(elA, 0.0) * 7.0);
  return mix(uZenith, uHorizon, hA);
}

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
  /**
   * ── THE FILL, AND WHY IT NEEDED A DIAL OF ITS OWN ──────────────────────
   *
   * This is a hemisphere term: ground colour below, sky colour above. Its
   * STRENGTH was whatever those two palette colours happened to be, which is
   * fine in daylight and ruinous at night -- the night palette makes both of
   * them very dark, so the fill vanishes exactly when it is the only thing
   * that could still describe a shape.
   *
   * The SewerShred prototype, same character and a far better read of it,
   * lights its scene with a HemisphereLight at intensity 3.2 and almost
   * nothing else. That is the whole difference: a big directionless fill that
   * makes form legible, with the key doing character rather than work.
   *
   * So the fill gets a multiplier the place can push hard without touching
   * the colours it is made of.
   */
  vec3 ambient = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5) * uFill;

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uGloss) * uSpecular;

  vec3 col = albedo * (direct + ambient) + uSunColor * spec + albedo * uEmissive;

  // ── SITE LIGHTS ─────────────────────────────────────────────────────────
  //
  // Four point lights, fed each frame with the nearest floodlight masts. This
  // renderer has no light list of its own -- everything is lit by one sun
  // direction -- so a dark level has exactly one thing lighting it and nothing
  // in the world can cast a pool of its own. These are that.
  //
  // Four is the whole budget, and it is chosen rather than guessed: the masts
  // stand in pairs along the banks, so four covers the pair you are passing
  // and the pair ahead, which is every mast that can measurably reach you.
  for (int i = 0; i < 4; i++) {
    float rng = uPtPos[i].w;
    if (rng <= 0.0) continue;
    vec3 d = uPtPos[i].xyz - vWorld;
    float dist2 = dot(d, d);
    float q = dist2 / (rng * rng);
    if (q > 1.0) continue;                    // outside its reach
    vec3 Lp = d * inversesqrt(max(dist2, 1e-6));
    // Wrapped like the sun term, so a mast lights the side of something and
    // not just the face pointing straight at it.
    float lam = max(0.0, (dot(N, Lp) + 0.25) / 1.25);
    // Smooth to zero at the edge of the range, or masts pop as they recycle.
    float fall = (1.0 - q) * (1.0 - q);
    col += albedo * uPtCol[i] * (lam * fall);
  }

  // ── THE LAMP ────────────────────────────────────────────────────────────
  //
  // A light at the camera. At night the sun term is nearly off, so without
  // this the rider is a silhouette on a dark floor and the one thing the
  // player must see is the one thing they cannot.
  //
  // It is at the CAMERA rather than on the board on purpose: a lamp attached
  // to a rider who leans swings its pool of light across the ground through
  // every turn, which reads as the world rocking. A camera lamp is steady,
  // and at this camera distance it still looks like it is coming off the
  // machine.
  //
  // Inverse-square, softened by the range so it does not blow out at contact.
  if (uLampStrength > 0.0) {
    // ── THE LAMP LEADS, IT DOES NOT SIT ON YOU ────────────────────────────
    //
    // Centred on the camera, half the pool was spent on ground that is already
    // BEHIND the player -- which they will never look at and cannot act on.
    // Pushing the source forward along the view direction puts the same light
    // where the rider is going, so the pool leads them down the course and a
    // hazard is lit a beat before it is reached.
    vec3 src = uCamPos + uLampAim * uLampLead;
    vec3 toL = src - vWorld;
    float d = length(toL);
    vec3 L = toL / max(d, 1e-4);
    float lam = max(0.0, dot(N, L));
    float q = d / uLampRange;
    float atten = 1.0 / (1.0 + q * q);
    col += albedo * uLampColor * (uLampStrength * lam * atten);
  }

  // ── RIM ─────────────────────────────────────────────────────────────────
  //
  // A cold edge where a surface turns away from the camera, tinted with the
  // sky. On a dark level the shapes that matter -- the rider, a soldier, a pod
  // -- are dark objects in front of dark ground, and the only thing separating
  // them is the hazard colours they happen to be standing near. A rim gives
  // every one of them an outline for free, which is what a backlight does on a
  // real set and is why night photography uses one.
  //
  // Squared, so it is an EDGE and not a wash: a linear fresnel lifts the whole
  // object and just makes the dark scene brighter again.
  if (uRimStrength > 0.0) {
    vec3 Vr = normalize(uCamPos - vWorld);
    float rim = 1.0 - max(0.0, dot(N, Vr));
    col += uRimColor * (uRimStrength * rim * rim);
  }

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
  // uFogMul is the ONE per-material escape from the mood's own density, and it
  // is 1.0 for everything that stands on the ground. The floating islands set
  // it, because they are drawn two to three times further out than anything
  // else here and the honest number erases them at the foggiest stops. See
  // FOG_MUL in islands.js for the full argument; the reason it lives on the
  // material rather than in the mood is that the mood's density is a property
  // of the AIR, which is shared, and this is a statement about one object's
  // path through it.
  float f = uFogDensity * uFogMul * 0.5
          * exp(-uFogFalloff * (uCamPos.y - uFogBase)) * dist * k;
  float fog = 1.0 - exp(-max(f, 0.0));
  float toSun = pow(max(dot(-V, L), 0.0), 5.0);

  vec3 air = mix(uFogColor, uFogSunColor, toSun);
  air = mix(air, airSky(normalize(vWorld - uCamPos)), uFogSky);
  gl_FragColor = vec4(mix(col, air, clamp(fog, 0.0, 1.0)), 1.0);
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
      uZenith: { value: new THREE.Color(0x5738a3) },
      uHorizon: { value: new THREE.Color(0x906fc9) },
      uFogSky: { value: 0 },
      uFogDensity: { value: 0.0056 },
      uFogMul: { value: 1 },
      uFogFalloff: { value: 0.012 },
      uFogBase: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBase: { value: new THREE.Color(color) },
      uWrap: { value: wrap },
      uGloss: { value: gloss },
      uSpecular: { value: specular },
      uEmissive: { value: emissive },
      uLampColor: { value: new THREE.Color(0xffffff) },
      uLampStrength: { value: 0 },
      uLampRange: { value: 34 },
      uLampAim: { value: new THREE.Vector3(0, 0, -1) },
      uLampLead: { value: 0 },
      uRimStrength: { value: 0 },
      uFill: { value: 1 },
      uRimColor: { value: new THREE.Color(0xffffff) },
      uPtPos: { value: [new THREE.Vector4(), new THREE.Vector4(),
        new THREE.Vector4(), new THREE.Vector4()] },
      uPtCol: { value: [new THREE.Color(), new THREE.Color(),
        new THREE.Color(), new THREE.Color()] },
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
export function updateLitCommon(materials, camPos, fogBase, sunFloor = 0, sunFlat = 1,
  lights = null, aim = null) {
  for (const m of materials) {
    if (!m) continue;
    m.uniforms.uCamPos.value.copy(camPos);
    m.uniforms.uFogBase.value = fogBase;
    m.uniforms.uSunFloor.value = sunFloor;
    m.uniforms.uSunFlat.value = sunFlat;
    if (lights && m.uniforms.uPtPos) writePointLights(m.uniforms, lights);
    // Where the lamp is pointed: the camera's own forward, handed in rather
    // than derived, so the ground shader and every lit material agree.
    if (aim && m.uniforms.uLampAim) m.uniforms.uLampAim.value.copy(aim);
  }
}

/**
 * Copy up to four site lights into a material's uniforms.
 *
 * Shared so the snow shader and every lit material are fed from one place --
 * two copies of this would be two ways for the ground and the things standing
 * on it to disagree about where the light is.
 *
 * @param {object} uniforms
 * @param {Array<{x:number,y:number,z:number,range:number,color:THREE.Color}>} lights
 */
export function writePointLights(uniforms, lights) {
  const pos = uniforms.uPtPos.value;
  const col = uniforms.uPtCol.value;
  for (let i = 0; i < 4; i++) {
    const l = lights[i];
    if (l) {
      pos[i].set(l.x, l.y, l.z, l.range);
      col[i].copy(l.color);
    } else {
      pos[i].w = 0;                            // empty slot; the shader skips it
    }
  }
}
