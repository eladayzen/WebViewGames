// The sewer: an endless winding pipe, and the frame math everything else rides on.
//
// Every object in the game lives in TUBE coordinates (s, θ): s is distance down
// the pipe, θ is the angle around its wall with θ = 0 at the floor and
// +π/2 on the right wall (looking downstream). `frameAt(s)` turns that into
// world space. Nothing else in the game needs to know the pipe bends.
import * as THREE from 'three';

export const R = 6;                 // pipe radius, metres
const SEG_LEN = 30;                 // metres per recycled tube segment
const SEG_COUNT = 10;               // 300 m of pipe alive at once (fog eats the far end; OPEN TOP's thinner haze needs the extra 60 m)
const RADIAL = 40;
const RINGS = 18;
const TAU = Math.PI * 2;
const RAIL_RINGS = 24;
const ARM_RINGS = 90;
const RAIL_GAUGE = 0.15;            // rad either side of the floor line (~0.9 m)
const RAIL_W = 0.07, RAIL_H = 0.07;   // metres — low, sunk into the floor (Elad: "pops out too much")

// ── the centerline ───────────────────────────────────────────────────────────
// Sums of slow sines: sweeping bends left/right and a constant downhill grade
// with swells, so the pipe always reads as a DESCENT.
export function centerAt(s, out = new THREE.Vector3(), armFork = null, armSide = 0) {
  const x = 15 * Math.sin(s * 0.0105) + 6 * Math.sin(s * 0.0263 + 1.3);
  const y = -0.11 * s + 4.5 * Math.sin(s * 0.0171 + 0.5);
  out.set(x, y, -s);
  // Y-junctions: past a decided fork the pipe has jogged sideways into its arm
  for (const fk of FORKS) {
    if (s <= fk.s) continue;
    const side = fk === armFork ? armSide : fk.side;
    if (side) out.add(armOffset(fk, side, s - fk.s, _off));
  }
  return out;
}

// ── Y-junctions ──────────────────────────────────────────────────────────────
// Elad 2026-11-16: "Y junction mechanic - where my location right half/left
// half detirmines which way i go" (as in Wagon Rampage). At every world border
// the pipe splits in two arms, each into a different world. Each arm jogs
// FORK_SPREAD metres sideways over FORK_LEN; until the rider commits, the
// track past the split is not built and two preview arms stand in for it.
// Kinds (Elad 2026-11-17: sewers only; "falling down - instead of a hole,
// should look like climbing up"):
//   'y'     left/right split, arms side -1 / +1, both in the texture you came from
//   'climb' a ramp rises out of the floor into a pipe above: side +1 = ride onto
//           the ramp (centre of the floor) and climb, side -1 = stay down
//   'rise'  a full-width climb: the pipe itself ramps up, no choice
export const FORKS = [];
export const FORK_LEN = 80, FORK_SPREAD = 9.5, FORK_ARM = 150, FORK_QUIET = 95;
export const CLIMB = 14, CLIMB_LEN = 42, RAMP_HALF = 0.6;
const _off = new THREE.Vector3();
const ease01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
export function forkSpread(d) { return FORK_SPREAD * ease01(d / FORK_LEN); }
function armOffset(fk, side, d, out) {
  out.set(0, 0, 0);
  if (fk.kind === 'y') return out.copy(fk.lat).multiplyScalar(side * forkSpread(d));
  return side > 0 ? out.set(0, CLIMB * ease01(d / CLIMB_LEN), 0) : out;     // climb / rise
}
// The river is always there (Elad). Through a Y it splits: each arm starts with
// its own half of the river and widens to a full one, so the two never overlap.
// Up a climb ramp it starts a few metres in, clear of the river below.
const RIVER_SPLIT = 30;
export function riverBand(s, fk = null, side = 0) {
  let c = slimeAngle(s), hw = slimeHalfWidth(s);
  if (!fk) {
    for (const x of FORKS) if (x.side && s >= x.s && s < x.s + RIVER_SPLIT + 5) { fk = x; side = x.side; break; }
  }
  if (fk && side) {
    const d = s - fk.s;
    if (fk.kind === 'y' && d >= 0 && d < RIVER_SPLIT) {
      const t = ease01(d / RIVER_SPLIT);
      c += side * hw * (1 - t) / 2; hw *= (1 + t) / 2;
    } else if (fk.kind === 'climb' && side > 0 && d >= 0 && d < 4) hw = 0;
  }
  return [c, hw];
}
/** The fork whose junction region (or approach) contains s, if any. */
export function forkNear(s, before = 0, after = FORK_QUIET) {
  for (const fk of FORKS) if (s > fk.s - before && s < fk.s + after) return fk;
  return null;
}
export function pendingFork(s) {
  for (const fk of FORKS) if (!fk.side && fk.s > s - 1) return fk;
  return null;
}
// rivers / rails dry out through a junction (each arm starts dry)
function forkFade(s) {
  for (const fk of FORKS) {
    const d = s - fk.s;
    if (d < -40 || d > FORK_QUIET + 25) continue;
    if (d < -15) return (-15 - d) / 25;
    if (d > FORK_QUIET) return (d - FORK_QUIET) / 25;
    return 0;
  }
  return 1;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Tangent T, right Rt, wall-up U (toward the ceiling) at distance s. */
export function frameAt(s, f = { C: new THREE.Vector3(), T: new THREE.Vector3(), Rt: new THREE.Vector3(), U: new THREE.Vector3() }) {
  centerAt(s, f.C);
  centerAt(s + 0.5, _a); centerAt(s - 0.5, _b);
  f.T.subVectors(_a, _b).normalize();
  f.Rt.crossVectors(f.T, WORLD_UP).normalize();
  f.U.crossVectors(f.Rt, f.T).normalize();
  return f;
}

/** Unit vector from the axis to the wall at angle θ (θ=0 floor, +π/2 right wall). */
export function wallDir(f, theta, out = new THREE.Vector3()) {
  return out.copy(f.U).multiplyScalar(-Math.cos(theta)).addScaledVector(f.Rt, Math.sin(theta));
}

/** World point at (s, θ) and distance `r` from the axis. */
export function pointAt(s, theta, r, out = new THREE.Vector3(), f = frameAt(s)) {
  return out.copy(f.C).addScaledVector(wallDir(f, theta, _a), r);
}

/**
 * Orientation for something standing on the wall at (s, θ): +Y points to the
 * pipe axis (its "up"), -Z points downstream.
 */
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
export function wallQuat(f, theta, out = new THREE.Quaternion()) {
  wallDir(f, theta, _y).negate();               // up = toward axis
  _z.copy(f.T).negate();                        // three's forward is -Z
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

// ── the slime river ──────────────────────────────────────────────────────────
// A band of ooze that snakes around the floor and up the walls. Its angle is a
// function of s, so gameplay (am I in it?) and rendering read the same curve.
export function slimeAngle(s) {
  // Gravity always brings the rider back to θ=0, so the river lives there too
  // (Elad): it only sways a little around the floor, never climbs the walls.
  return 0.18 * Math.sin(s * 0.019) + 0.08 * Math.sin(s * 0.051 + 2.0);
}
export function slimeHalfWidth(s) {
  // ×3 wider (Elad, 2026-11-11) — the river is now the main floor feature;
  // then 20% narrower (Elad, 2026-11-15). Rendering and the "in sewage" check both read this.
  return featureAt(s, 'river') * 0.8 * 3 * (0.27 + 0.07 * Math.sin(s * 0.047 + 1.1));
}
// ── floor water ──────────────────────────────────────────────────────────────
// Pools of runoff lying in the very bottom of the pipe (gravity puts water at
// θ = 0, unlike the slime, which climbs). They come in stretches: every 55 m
// cell has a pool with some probability, 18–40 m long, swelling in from
// nothing at each end. Returns the half-width in radians, 0 = dry.
const WATER_CELL = 55;
// Pools are switched OFF for now (Elad: "disable the pool thing") — kept for
// later. Flip to true to bring them back; rendering and splashes follow this.
export const WATER_POOLS = false;
export function waterHalfWidth(s) {
  if (!WATER_POOLS) return 0;
  const cell = Math.floor(s / WATER_CELL);
  if (cell < 1) return 0;
  const h = hash(cell * 7.31 + 3.1);
  if (h > 0.7) return 0;
  const start = cell * WATER_CELL + 4 + hash(cell + 0.5) * 8;
  const len = 18 + hash(cell * 1.7) * 22;
  const t = (s - start) / len;
  if (t <= 0 || t >= 1) return 0;
  const taper = Math.sin(Math.PI * t);                 // swells in, swells out
  // ×3 wider than the first pass (Elad): most of the lower half of the pipe
  return 3 * (0.5 + 0.22 * hash(cell * 3.3)) * Math.pow(taper, 0.45);
}
export function waterAngle(s) {
  return 0.06 * Math.sin(s * 0.09);                      // a lazy wobble
}

export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}

// ── a wall-hugging patch shader (slime, graffiti) ────────────────────────────
// Soft edges across the band, scrolling map, manual fog, optional glow pulse.
function patchMaterial(map, { scroll = 0, tint = new THREE.Color(1, 1, 1), alpha = 1, glow = 0, edge = 0.18 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // band winding faces away from the axis; draw both
    uniforms: {
      map: { value: map },
      uScroll: { value: 0 },
      uTint: { value: tint },
      uAlpha: { value: alpha },
      uGlow: { value: glow },
      uEdge: { value: edge },
      uTime: { value: 0 },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 1 },
      fogFar: { value: 100 },
    },
    vertexShader: /* glsl */`
      attribute float across;
      varying vec2 vUv; varying float vAcross; varying float vDepth;
      void main(){
        vUv = uv; vAcross = across;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float uScroll; uniform vec3 uTint; uniform float uAlpha;
      uniform float uGlow; uniform float uEdge; uniform float uTime;
      uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv; varying float vAcross; varying float vDepth;
      void main(){
        vec2 uv = vUv + vec2(0.0, uScroll);
        vec3 c = texture2D(map, uv).rgb * uTint;
        // a second, slower layer for slime depth
        if (uGlow > 0.0) {
          vec3 c2 = texture2D(map, vUv*0.6 + vec2(0.31, uScroll*0.55)).rgb;
          c = mix(c, c2 * uTint, 0.35) * (1.0 + uGlow * (0.25 + 0.15*sin(uTime*3.0 + vUv.y*0.7)));
        }
        float e = smoothstep(0.0, uEdge, vAcross) * smoothstep(0.0, uEdge, 1.0 - vAcross);
        float f = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(c, fogColor, f), e * uAlpha);
      }`,
  });
}

// ── water: refracts the plates under it ──────────────────────────────────────
// The band carries the wall's own UVs, so instead of a flat sheet the shader
// re-samples the wall texture with a wobbling offset (the plates swim under the
// surface), tints it murky teal, lays the flowing water texture over it and
// adds drifting caustic glints. Edges fade into the real wall seamlessly
// because underneath is the same texture. No render target needed.
function waterMaterial(map, wallMap, { under = new THREE.Vector3(0.42, 0.62, 0.66), surf = new THREE.Vector3(0.8, 1.0, 1.05), surfMix = 0.42, caustic = new THREE.Vector3(0.55, 0.95, 1.0), rim = new THREE.Vector3(0.6, 0.9, 1.0) } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      map: { value: map }, wallMap: { value: wallMap },
      uScroll: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0.96 }, uEdge: { value: 0.16 },
      uUnder: { value: under }, uSurf: { value: surf }, uSurfMix: { value: surfMix }, uCaustic: { value: caustic }, uRim: { value: rim },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 100 },
    },
    vertexShader: /* glsl */`
      attribute float across;
      varying vec2 vUv; varying float vAcross; varying float vDepth;
      void main(){
        vUv = uv; vAcross = across;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform sampler2D wallMap;
      uniform float uScroll; uniform float uTime; uniform float uAlpha; uniform float uEdge;
      uniform vec3 uUnder; uniform vec3 uSurf; uniform float uSurfMix; uniform vec3 uCaustic; uniform vec3 uRim;
      uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv; varying float vAcross; varying float vDepth;
      void main(){
        vec2 p = vUv;
        // two crossing wave trains → refraction offset
        // gentle: small amplitude, slow drift (Elad: "much smaller/slower")
        vec2 off = vec2(
          sin(p.y * 7.0 + uTime * 0.9) + sin(p.x * 5.0 + p.y * 2.0 - uTime * 0.7),
          cos(p.x * 6.0 + uTime * 0.8) + sin(p.y * 4.0 - uTime * 0.5)) * 0.006;
        vec3 under = texture2D(wallMap, p + off).rgb * uUnder;
        vec2 wuv = p * vec2(0.6, 0.45) + vec2(0.0, uScroll) + off * 1.5;
        vec3 surf = texture2D(map, wuv).rgb;
        vec3 c = mix(under, surf * uSurf, uSurfMix);
        // caustic glints: a second water sample, sharpened to bright threads
        float ca = texture2D(map, p * vec2(0.9, 0.7) + vec2(uTime * 0.04, uScroll * 0.6) - off).b;
        c += uCaustic * pow(ca, 4.0) * 0.55;
        float e = smoothstep(0.0, uEdge, vAcross) * smoothstep(0.0, uEdge, 1.0 - vAcross);
        // a bright wet line where the water meets the plates
        float rimLine = smoothstep(uEdge * 0.4, uEdge * 0.9, vAcross) * (1.0 - smoothstep(uEdge * 0.9, uEdge * 1.6, vAcross))
                      + smoothstep(uEdge * 0.4, uEdge * 0.9, 1.0 - vAcross) * (1.0 - smoothstep(uEdge * 0.9, uEdge * 1.6, 1.0 - vAcross));
        c += uRim * rimLine * 0.25;
        float f = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(c, fogColor, f), e * uAlpha);
      }`,
  });
}

// ── sewage: thick, opaque sludge ─────────────────────────────────────────────
// BAL-646 (team playtest): the river must read as sewage at a glance - opaque,
// thick. Kolbo sludge painted as an edit of the patina wall texture, so it shares
// the walls' brushwork (tex/sewage.jpg, scum streaks run along the flow) scrolls slowly, heaves a little, a second
// coarse sample breaks the tiling, the brightest scum catches a greasy sheen and
// the banks darken into a wet crust. Alpha is 1 everywhere but a thin feathered
// edge. Its colour is calmed to one murky hue (uBase/uSat/uContrast).
function sewageMaterial(map, { tint = new THREE.Vector3(1.0, 1.0, 1.0) } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      map: { value: map }, uScroll: { value: 0 }, uTime: { value: 0 }, uEdge: { value: 0.05 }, uTint: { value: tint },
      // the painted art (same brushwork as the walls) is already calm, so keep most of
      // its own colour and contrast; uBase only pulls it a little toward one olive hue
      // look test: lighter olive-brown, mostly one flat cartoon hue (ref '55')
      // the Kolbo toon tile (tex/sewage_toon.jpg) is the look: keep its own colour 1:1
      uBase: { value: new THREE.Vector3(0.2717, 0.2465, 0.0892) }, uSat: { value: 1.0 }, uContrast: { value: 1.0 },
      // linear mean luminance of tex/sewage.jpg (measured: 0.0661)
      uMid: { value: 0.2368 },   // linear mean luminance of tex/sewage_toon.jpg (measured)
      // Elad: "a bit less opacity" - the plates just show through
      uAlpha: { value: 0.72 },   // look test: a bit see-through (Elad 2026-11-16)
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 100 },
    },
    vertexShader: /* glsl */`
      attribute float across;
      varying vec2 vUv; varying float vAcross; varying float vDepth;
      void main(){
        vUv = uv; vAcross = across;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float uScroll; uniform float uTime; uniform float uEdge; uniform vec3 uTint;
      uniform vec3 uBase; uniform float uSat; uniform float uContrast; uniform float uAlpha; uniform float uMid;
      uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv; varying float vAcross; varying float vDepth;
      void main(){
        vec2 p = vUv;
        // thick fluid: a slow, heavy heave, nothing like the water ripple
        vec2 heave = vec2(sin(p.y * 3.0 + uTime * 1.1), cos(p.x * 4.0 + p.y * 1.3 - uTime * 0.9)) * 0.012;   // look test: livelier
        vec3 c = texture2D(map, p * vec2(0.55, 0.42) + vec2(0.0, uScroll * 0.56) + heave)   /* look test: bigger ripples */.rgb * uTint;
        // Normalise around the texture's own average (uMid: its LINEAR mean luminance,
        // since sRGB maps are sampled linear) so uBase alone sets the brightness, then
        // keep uContrast of its light-dark and uSat of its own colour on top of the
        // one sludge hue. Swapping the texture only means re-measuring uMid.
        float l = dot(c, vec3(0.3, 0.59, 0.11)) / uMid;
        // froth can be 4x the average; cap it so the streaks stay paint, not glare
        float lc = min(mix(1.0, l, uContrast), 1.9);
        vec3 art = c / uMid * dot(uBase, vec3(0.3, 0.59, 0.11)) * (lc / max(l, 0.05));
        c = mix(uBase * lc, art, uSat);
        // coarse second sample, slower, so the tile never lines up (gentle)
        vec3 c2 = texture2D(map, p * vec2(0.31, 0.21) + vec2(0.37, uScroll * 0.55)).rgb;
        c *= 0.9 + 0.2 * dot(c2, vec3(0.333));
        // a faint greasy sheen on the brightest scum
        c += vec3(0.7, 0.76, 0.62) * pow(max(lc - 1.0, 0.0), 2.0) * 0.05;
        // banks: a dark wet crust, then a short feather into the plates
        float d = min(vAcross, 1.0 - vAcross);
        c *= mix(0.7, 1.0, smoothstep(uEdge * 0.6, uEdge * 3.0, d));
        float a = smoothstep(0.0, uEdge, d) * uAlpha;
        float f = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(c, fogColor, f), a);
      }`,
  });
}

// ── environment zones ────────────────────────────────────────────────────────
// The pipe changes character every area (ZONE_LEN = the sewers' area length) so it never reads as one
// texture tiled forever. Each zone: its wall art, how many tiles around the
// circumference, a wall tint, and the fog/ambient colour the scene eases to.
// Boundaries are segment-aligned and hidden behind a big junction ring.
export const ZONE_LEN = 300;
// Rust-iron family first (Elad: the curved red iron is the direction; the
// others had tiles too small). Fewer tiles around = bigger panels. The brick /
// cave / subway / original-iron zones are parked in ZONES_PARKED.
// Patina family (Elad: "the dark one with green — start with that"; its
// saturation/grade is the target). Every zone shares Copper Deep's teal grade.
const PATINA_GRADE = { tint: 0xffffff, fog: 0x4a5860, hemi: [0xf2f6f6, 0x6e7876] };   // look test: light grade
// ── worlds ───────────────────────────────────────────────────────────────────
// Elad 2026-11-16: "devide them to groups of worlds. a world can show a few
// different pipe areas." Each world has its own floor features (river,
// waterfalls, rails, trains), its own area length and how many areas one
// visit shows; every visit ends at a Y-junction into the next. WORLDS_PLAN.md.
// stage1: the pinned "stage 1" grade, [saturation kept, lift].
// The older textures (brick, iron vault, cave, rust, station tile) were too
// noisy (Elad) — parked, and so is HAZARD LINE (its stripes smear); the sewers
// are the three calm patina areas.
const SUBWAY_GRADE = { fog: 0x544f48, hemi: [0xfaf4ea, 0x777068] };
export const WORLDS = [
  { key: 'sewers', name: 'THE SEWERS', river: 1, falls: 1, rails: 0, trains: 0, areaLen: 300, perVisit: 3, areas: [
    // the concrete tiles here too (Elad: "lets use the subway textures for the sewers as
    // well. current sewers are not good"); the patina redraws (clean_*.jpg) are parked.
    // Tints keep the areas apart.
    { key: 'concrete_grey', name: 'STORM DRAIN',  around: 8, tint: 0xffffff, fog: 0x4a5860, hemi: [0xf2f6f6, 0x6e7876] },
    { key: 'concrete_warm', name: 'OLD MAINLINE', around: 8, tint: 0xf4f0ea, fog: 0x544f48, hemi: [0xfaf4ea, 0x777068] },
    { key: 'concrete_grey', name: 'SLIME WORKS',  around: 8, tint: 0xecf6ec, fog: 0x4e6058, hemi: [0xf4fbf2, 0x74847a] },
  ] },
  // TRAINING 2 (Elad 2026-11-22): "a wooden self-made training course, like the turtles built".
  // Same pipe, lined with plywood planks; no river, no water outlets. Only levels pick it.
  // TRAINING (Elad 2026-11-22 → 11-23): "a wooden self-made training course, like the
  // turtles built" — picked look: wood where you ride, the sewer's grey concrete above
  // the 180 seams, no river. "Break the long planks … mix some garbage-playground
  // textures — a scavenger-like, amateur-built DIY training area": the floor is cut
  // into staggered panels, and some panels are scrap (patches: a 2×2 atlas of tin /
  // painted door / taped cardboard / red plate). Only levels pick this world.
  { key: 'dojo', name: 'THE DOJO COURSE', river: 0, falls: 0, rails: 0, trains: 0, areaLen: 300, perVisit: 3, areas: [
    { key: 'wood_planks', upper: 'concrete_grey', upperAround: 8, patches: 'scrap_atlas', name: 'DOJO COURSE', around: 2, tint: 0xfff8ee, fog: 0x4a5860, hemi: [0xfff6ea, 0x7a7466] },
  ] },
  // (the subway / trains world is saved for a later "underground mines" level — Elad
  //  2026-11-17; trains.js is kept, no world turns it on)
];
// flat list: zone index = position here; each carries its world
export const ZONES = WORLDS.flatMap((w, wi) => w.areas.map((a) => ({ tint: 0xffffff, ...a, world: wi })));
const ZONE_BASE = WORLDS.map((w, wi) => WORLDS.slice(0, wi).reduce((n, x) => n + x.areas.length, 0));
let startWorld = 0;
export function setStartWorld(i) { startWorld = ((i % WORLDS.length) + WORLDS.length) % WORLDS.length; }
export function getStartWorld() { return startWorld; }
// Visits: { w, start }. Visit 0 = the start world from s 0; each later one is
// picked at the Y-junction where the previous one ends.
const visits = [];
export function resetVisits() { visits.length = 0; visits.push({ w: startWorld, start: 0, a0: 0 }); FORKS.length = 0; }
export function visitLen(wi) { return WORLDS[wi].areaLen * WORLDS[wi].perVisit; }
export function addVisit(wi, start, a0 = 0) { visits.push({ w: wi, start, a0 }); }
/** Where the current last visit ends: the next Y-junction. */
export function nextVisitEnd() { const v = visits[visits.length - 1]; return v.start + visitLen(v.w); }
export function visitCount() { return visits.length; }
export function visitWorld(i) { return visits[i].w; }
function visitAt(s) {
  let i = 0;
  while (i + 1 < visits.length && s >= visits[i + 1].start) i++;
  return i;
}
/** Zone of AREA `a` of visit v, if v is in world wi. */
export function zoneOf(v, wi, a = 0) {
  let lap = 0;
  for (let i = 0; i < v && i < visits.length; i++) if (visits[i].w === wi) lap++;
  const W = WORLDS[wi];
  return ZONE_BASE[wi] + (lap * W.perVisit + a) % W.areas.length;
}
export function zoneIndex(s) {
  const v = visitAt(s), V = visits[v], W = WORLDS[V.w];
  const a = Math.min(W.perVisit - 1, Math.floor(Math.max(0, s - V.start) / W.areaLen));
  return zoneOf(v, V.w, a + (V.a0 || 0));
}
/** Area borders inside visits (not the world borders, which are junctions), after s. */
export function areaBordersAfter(s, n) {
  const out = [];
  for (let v = visitAt(s); v < visits.length && out.length < n; v++) {
    const V = visits[v], W = WORLDS[V.w];
    for (let k = 1; k < W.perVisit && out.length < n; k++) {
      const b = V.start + k * W.areaLen;
      if (b > s) out.push(b);
    }
  }
  return out;
}
export function worldAt(s) { return WORLDS[ZONES[zoneIndex(s)].world]; }
// A world feature (river / falls / rails / trains) at s, 0..1. Worlds only
// change at a Y-junction, and forkFade dries everything out through those.
export function featureAt(s, key) {
  // OPEN TOP is not a sewer (Elad 2026-11-22): no river, no water outlets
  if (OPEN_TOP.value && (key === 'river' || key === 'falls')) return 0;
  return worldAt(s)[key] * (key === 'falls' || key === 'river' ? 1 : forkFade(s));
}
export const ZONES_PARKED = ['rust_red', 'rust_ember'];   // too red / lava-like (Elad)

// Large-scale brightness variation: re-sample the wall's own map at 1/7 scale
// and modulate, so identical tiles don't line up into an obvious grid.
// The 180 edge (Elad 2026-11-18): the ride is the lower half (DIRECT 180 stops the
// rider at θ = ±90°). A heavy ink seam with a pale lip marks those two lines
// exactly, so the wall itself shows where the play ends, and everything above
// them is shaded down: that upper half is what a matte painting will replace.
// θ comes straight from the wall uv (u = θ / 2π · around, θ = 0 the floor).
const edgeGlsl = (around) => `
  {
    float th = mod(vMapUv.x * ${(TAU / around).toFixed(6)} + PI, PI2) - PI;
    float e = abs(th) - 1.5707963;                      // < 0 inside the 180
    diffuseColor.rgb *= mix(1.0, 0.5, smoothstep(0.0, 0.18, e));          // upper half
    diffuseColor.rgb *= mix(1.18, 1.0, smoothstep(-0.075, -0.045, e));    // pale lip inside the line
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.07), 1.0 - smoothstep(0.022, 0.032, abs(e + 0.012)));  // the ink seam
    if (uOpenTop > 0.5 && e > 0.02) discard;            // OPEN TOP: the pipe ends at its ink line
  }`;
// OPEN TOP (Elad 2026-11-22, a variation): the upper half of the pipe is cut
// away at the 180 seams and a city matte painting shows over the rims (city.js).
export const OPEN_TOP = { value: 0 };
const PANEL = 4;   // DIY floor cells per wall tile (around 2: ~4.7 m square)
function antiRepeat(mat, stage1 = null, around = 8, upper = null, patches = null) {
  const key = (stage1 ? 'antiRepeat-' + stage1.join('-') : 'antiRepeat') + '-a' + around + (upper ? '-up' + upper.around : '') + (patches ? '-patch' : '');
  mat.customProgramCacheKey = () => key;   // same closure source, several shaders
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uOpenTop = OPEN_TOP;
    sh.fragmentShader = 'uniform float uOpenTop;\n' + sh.fragmentShader;
    if (patches) {
      // DIY floor: PANEL × PANEL cells per tile, columns staggered along the pipe.
      // A wood cell re-samples the planks at its own offset (so they end at a joint,
      // never run for ever); ~1 in 4 cells is a scrap sheet from the atlas instead.
      // Every cell gets a dark joint line at its ends; scrap sheets all round.
      sh.uniforms.uPatch = { value: patches.map };
      sh.fragmentShader = 'uniform sampler2D uPatch;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        if (abs(mod(vMapUv.x * ${(TAU / around).toFixed(6)} + PI, PI2) - PI) < 1.5707963) {
          vec2 cuv = vMapUv * ${PANEL.toFixed(1)};
          float colI = floor(cuv.x);
          cuv.y += fract(sin(colI * 91.7) * 4375.85);            // stagger the joints
          vec2 cell = floor(cuv), f = fract(cuv);
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float h2 = fract(h * 7.131 + 0.37);
          vec2 dx = dFdx(vMapUv), dy = dFdy(vMapUv);
          vec3 c = diffuse * textureGrad(map, vMapUv + vec2(0.0, h2 * 3.0), dx, dy).rgb;
          float jointW = 0.014;
          float edge = min(f.y, 1.0 - f.y);
          if (h < ${patches.chance.toFixed(3)}) {
            float q = floor(h2 * 4.0);
            vec2 auv = (vec2(mod(q, 2.0), floor(q * 0.5)) + 0.03 + f * 0.94) * 0.5;
            c = textureGrad(uPatch, auv, dx * ${(PANEL * 0.47).toFixed(3)}, dy * ${(PANEL * 0.47).toFixed(3)}).rgb;
            edge = min(edge, min(f.x, 1.0 - f.x));
            jointW = 0.02;
          }
          c *= mix(0.25, 1.0, smoothstep(jointW * 0.5, jointW, edge));   // the joint / sheet edge
          c *= mix(0.82, 1.0, smoothstep(jointW, jointW * 3.0, edge));   // a soft shade beside it
          diffuseColor.rgb = c;
        }
        #endif`);
    }
    if (upper) {
      // above the 180 seams: the other wall art, square tiles at its own count around
      sh.uniforms.uUpper = { value: upper.map };
      sh.fragmentShader = 'uniform sampler2D uUpper;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        {
          float thU = mod(vMapUv.x * ${(TAU / around).toFixed(6)} + PI, PI2) - PI;
          vec4 upTex = texture2D(uUpper, vMapUv * ${(upper.around / around).toFixed(6)});
          float isUp = step(1.5707963, abs(thU));
          diffuseColor.rgb = mix(diffuseColor.rgb, ${upper.tint} * upTex.rgb, isUp);
        }
        #endif`);
    }
    // Y-junction cut: walls inside the other arm are discarded (clip > 0)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float clip;\nvarying float vClip;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClip = clip;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vClip;')
      .replace('#include <clipping_planes_fragment>', 'if (vClip > 0.0) discard;\n#include <clipping_planes_fragment>');
    if (stage1) {
      // pinned stage 1: 65% desaturate + lift. It was tuned at exposure 1.15;
      // the lift carries the 1.15/0.85 difference so it reads the same now.
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float macro = texture2D(map, vMapUv * 0.143 + vec2(0.37, 0.11)).g;
          float macro2 = texture2D(map, vMapUv.yx * 0.071 + vec2(0.7, 0.2)).r;
          diffuseColor.rgb *= 0.9 + 0.2 * macro + 0.12 * (macro2 - 0.5);
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, ${stage1[0].toFixed(3)}) * ${stage1[1].toFixed(3)} + 0.05;
          ${edgeGlsl(around)}
        #endif`);
      return;
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        float macro = texture2D(map, vMapUv * 0.143 + vec2(0.37, 0.11)).g;
        float macro2 = texture2D(map, vMapUv.yx * 0.071 + vec2(0.7, 0.2)).r;
        diffuseColor.rgb *= 0.94 + 0.1 * macro + 0.08 * (macro2 - 0.5);   // look test: gentle, the art is flat on purpose
        ${edgeGlsl(around)}
      #endif`);
  };
  return mat;
}

// ── the recycled tube ────────────────────────────────────────────────────────
export class Track {
  constructor(scene, tex) {
    this.scene = scene;
    this.segments = [];
    this.f = frameAt(0);

    tex.wall.wrapS = tex.wall.wrapT = THREE.RepeatWrapping;
    tex.wall.colorSpace = THREE.SRGBColorSpace;
    tex.wall.anisotropy = 4;
    tex.slime.wrapS = tex.slime.wrapT = THREE.RepeatWrapping;
    tex.slime.colorSpace = THREE.SRGBColorSpace;
    tex.graffiti.wrapS = tex.graffiti.wrapT = THREE.RepeatWrapping;
    tex.graffiti.colorSpace = THREE.SRGBColorSpace;
    tex.water.wrapS = tex.water.wrapT = THREE.RepeatWrapping;
    tex.water.colorSpace = THREE.SRGBColorSpace;

    this.zoneMats = ZONES.map((z) => {
      const m = tex[z.key];
      m.wrapS = m.wrapT = THREE.RepeatWrapping; m.colorSpace = THREE.SRGBColorSpace; m.anisotropy = 4;
      let up = null;
      if (z.upper) {
        const um = tex[z.upper];
        um.wrapS = um.wrapT = THREE.RepeatWrapping; um.colorSpace = THREE.SRGBColorSpace; um.anisotropy = 4;
        // the sewer half replaces the tinted wood outright: its own untinted grey
        up = { map: um, around: z.upperAround || 8, tint: 'vec3(1.0)' };
      }
      let pa = null;
      if (z.patches) {
        const pm = tex[z.patches];
        pm.colorSpace = THREE.SRGBColorSpace; pm.anisotropy = 4;
        pa = { map: pm, chance: 0.26 };
      }
      return antiRepeat(new THREE.MeshLambertMaterial({ map: m, color: z.tint, side: THREE.BackSide }), z.stage1, z.around, up, pa);
    });
    this.wallMat = this.zoneMats[0];
    // the river: same refracting treatment as the pools — plates swim under a
    // translucent green current — with the slime texture as its surface
    // river = the pool water shader, as is (Elad: "less disgusting"). The
    // slime look is kept in git history / the slime texture if we want it back.
    // BAL-646 reverses that: the river is now opaque sewage (sewageMaterial). The
    // refracting water look is still in waterMaterial if we ever want it back.
    tex.sewage.wrapS = tex.sewage.wrapT = THREE.RepeatWrapping;
    tex.sewage.colorSpace = THREE.SRGBColorSpace;
    tex.sewage.anisotropy = 4;
    this.slimeMat = sewageMaterial(tex.sewage);
    // opaque, so nothing to refract: every zone shares the one material
    this.riverMats = ZONES.map(() => this.slimeMat);
    this.grafMat = patchMaterial(tex.graffiti, { tint: new THREE.Color(0.85, 0.85, 0.85), alpha: 0.9, edge: 0.3 });
    this.waterMat = waterMaterial(tex.water, tex.wall);
    this.patchMats = [...new Set([this.slimeMat, ...this.riverMats, this.grafMat, this.waterMat])];

    // subway rails: just two low metal lines down the floor (no sleepers — Elad), only where
    // the world has rails (they sink into the floor across an area border)
    this.railMat = new THREE.MeshLambertMaterial({ vertexColors: true });

    // ceiling lamps: emissive caged bulbs + an additive glow card. They stream
    // past every 18 m, which is most of what makes speed legible.
    this.lamps = [];
    const lampGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const cageGeo = new THREE.TorusGeometry(0.36, 0.05, 6, 14);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe7a8 });
    const cageMat = new THREE.MeshLambertMaterial({ color: 0x3a403c });
    const glowTex = makeGlowTexture();
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(lampGeo, lampMat));
      const cage = new THREE.Mesh(cageGeo, cageMat); cage.rotation.x = Math.PI / 2; g.add(cage);
      const sp = new THREE.Sprite(glowMat); sp.scale.set(4.5, 4.5, 1); g.add(sp);
      g.userData.s = -1e9;
      scene.add(g);
      this.lamps.push(g);
    }
    this.lampSpacing = 18;

    // area borders: a flush pipe-joint flange (was a fat grey torus + yellow stripe,
    // Elad: "looks bad"). A shallow concrete band with ink edges and bolt heads,
    // open over the floor so the river runs straight through it.
    this.junctions = [];
    {
      const GAP = 1.05, LEN = 1.3, DEPTH = 0.16, rIn = R - DEPTH;
      const band = new THREE.CylinderGeometry(rIn, rIn, LEN, 64, 1, true, GAP, TAU - 2 * GAP).rotateX(Math.PI / 2);
      const lip = new THREE.CylinderGeometry(R, rIn, 0.001, 64, 1, true, GAP, TAU - 2 * GAP);   // a ring face
      const bandMat = new THREE.MeshLambertMaterial({ color: 0xa9adaa, emissive: 0x1a1c1c, side: THREE.BackSide });
      const ink = new THREE.MeshBasicMaterial({ color: 0x15171a });
      const edge = new THREE.TorusGeometry(rIn, 0.05, 5, 64, TAU - 2 * GAP);
      const boltGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8).rotateX(Math.PI / 2);
      const boltMat = new THREE.MeshLambertMaterial({ color: 0x6d7372 });
      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(band, bandMat));
        for (const z of [-LEN / 2, LEN / 2]) {
          // ink outline along both edges (torus arc starts at +X; turn it so the gap sits on the floor)
          const e = new THREE.Mesh(edge, ink);
          e.position.z = z; e.rotation.z = -Math.PI / 2 + GAP;
          g.add(e);
          const face = new THREE.Mesh(lip, bandMat); face.rotation.x = Math.PI / 2; face.position.z = z; g.add(face);
        }
        for (let k = 0; k < 14; k++) {
          const a = GAP + 0.12 + (k / 13) * (TAU - 2 * GAP - 0.24);
          // CylinderGeometry angle a -> (sin a, -cos a) after rotateX: floor is a = 0
          const b = new THREE.Mesh(boltGeo, boltMat);
          b.position.set(Math.sin(a) * (rIn - 0.02), -Math.cos(a) * (rIn - 0.02), 0);
          b.lookAt(0, 0, 0);
          g.add(b);
        }
        g.userData.s = -1e9;
        scene.add(g);
        this.junctions.push(g);
      }
    }

    // Y-junction preview arms (one per side), drawn until the rider commits
    this.arms = [-1, 1].map((side) => {
      const verts = (RADIAL + 1) * (ARM_RINGS + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
      geo.setAttribute('clip', new THREE.BufferAttribute(new Float32Array(verts), 1));
      geo.setIndex(gridIndex(RADIAL, ARM_RINGS));
      const m = new THREE.Mesh(geo, this.zoneMats[0]);
      m.frustumCulled = false; m.visible = false;
      m.userData.side = side;
      scene.add(m);
      return m;
    });

    this.dropChance = 0.6;
    // Y divider: ink crease lines + a hazard chevron on the nose
    {
      const ink = new THREE.MeshBasicMaterial({ color: 0x111316 });
      const group = new THREE.Group();
      const lines = [new THREE.Mesh(new THREE.BufferGeometry(), ink), new THREE.Mesh(new THREE.BufferGeometry(), ink)];
      lines.forEach((l) => (l.frustumCulled = false));
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g2 = c.getContext('2d');
      g2.fillStyle = '#111316'; g2.fillRect(0, 0, 256, 128);
      g2.fillStyle = '#ffc21e';
      for (let x = -128; x < 256; x += 64) { g2.beginPath(); g2.moveTo(x, 128); g2.lineTo(x + 32, 128); g2.lineTo(x + 32 + 64, 0); g2.lineTo(x + 64, 0); g2.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      group.add(lines[0], lines[1], sign);
      group.visible = false;
      scene.add(group);
      this.divider = { group, lines, sign, fork: null };
    }
    // river on the preview arms (each its own half at the split)
    this.armRivers = [-1, 1].map((side) => {
      const m = bandMesh(36, 60, this.slimeMat); m.renderOrder = 2; m.visible = false; m.userData.side = side;
      scene.add(m); return m;
    });
    for (let i = 0; i < SEG_COUNT; i++) this.segments.push(this._makeSegment());
    this.reset();
  }

  reset() {
    resetVisits();
    this.divider.group.visible = false; this.divider.fork = null;
    this.armRivers.forEach((r) => (r.visible = false));
    this.arms.forEach((a) => (a.visible = false));
    this.segments.forEach((seg, i) => this._build(seg, i * SEG_LEN - SEG_LEN));
    this.lamps.forEach((l) => (l.userData.s = -1e9));
    this.nextLampS = 6;
    this.junctions.forEach((j) => (j.userData.s = -1e9));
  }

  _makeSegment() {
    const g = new THREE.CylinderGeometry(1, 1, 1, RADIAL, RINGS, true); // replaced in _build
    const verts = (RADIAL + 1) * (RINGS + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
    geo.setAttribute('clip', new THREE.BufferAttribute(new Float32Array(verts).fill(-1), 1));
    geo.setIndex(gridIndex(RADIAL, RINGS));
    g.dispose();
    const wall = new THREE.Mesh(geo, this.zoneMats[0]);
    wall.frustumCulled = false;
    this.scene.add(wall);

    const SL_ACROSS = 36, SL_RINGS = 36;
    const slime = bandMesh(SL_ACROSS, SL_RINGS, this.slimeMat);
    slime.renderOrder = 2;
    this.scene.add(slime);

    const graf = bandMesh(8, 8, this.grafMat);
    graf.renderOrder = 1;
    graf.visible = false;   // look test: the dark-ground graffiti reads as a black blotch on light concrete
    this.scene.add(graf);

    // floor water sits just above the plates, under the slime where they cross
    const water = bandMesh(36, 36, this.waterMat);
    water.renderOrder = 1.5;
    this.scene.add(water);
    // rails: per ring, 2 rails x 3 faces x 2 edge points
    const rv = (RAIL_RINGS + 1) * 12;
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
    rgeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
    const col = new Float32Array(rv * 3);
    for (let j = 0; j <= RAIL_RINGS; j++) for (let e = 0; e < 12; e++) {
      const top = Math.floor(e / 2) % 3 === 1, c = top ? 0.62 : 0.34;
      col.set([c, c * 0.98, c * 0.95], (j * 12 + e) * 3);
    }
    rgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const ridx = [];
    for (let j = 0; j < RAIL_RINGS; j++) for (let st = 0; st < 6; st++) {
      const a = j * 12 + st * 2, b = a + 1, c = a + 12, d = c + 1;
      ridx.push(a, c, b, b, c, d);
    }
    rgeo.setIndex(ridx);
    const rails = new THREE.Mesh(rgeo, this.railMat);
    rails.frustumCulled = false;
    this.scene.add(rails);
    return { wall, slime, graf, water, rails, s0: 0 };
  }

  _buildRails(seg, s0) {
    const f = this.f;
    const on0 = featureAt(s0, 'rails'), on1 = featureAt(s0 + SEG_LEN, 'rails'), onM = featureAt(s0 + SEG_LEN / 2, 'rails');
    const any = on0 + on1 + onM > 0;
    seg.rails.visible = any;
    if (!any) return;
    const pos = seg.rails.geometry.attributes.position.array;
    const w = RAIL_W / R;
    let k = 0;
    const put = (th, inset) => {
      wallDir(f, th, _d);
      const r = R - inset;
      pos[k++] = f.C.x + _d.x * r; pos[k++] = f.C.y + _d.y * r; pos[k++] = f.C.z + _d.z * r;
    };
    for (let j = 0; j <= RAIL_RINGS; j++) {
      const s = s0 + (j / RAIL_RINGS) * SEG_LEN;
      frameAt(s, f);
      const h = RAIL_H * featureAt(s, 'rails') + 0.02;
      for (const g of [-RAIL_GAUGE, RAIL_GAUGE]) {
        put(g - w, -0.02); put(g - w, h);      // outer side
        put(g - w, h); put(g + w, h);          // top
        put(g + w, h); put(g + w, -0.02);      // inner side
      }
    }
    const g = seg.rails.geometry;
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }

  _build(seg, s0) {
    seg.s0 = s0;
    const f = this.f;
    // past an undecided Y-junction nothing is built yet: the preview arms stand in
    const hide = !!FORKS.find((fk) => !fk.side && s0 >= fk.s - 0.5);
    for (const k of ['wall', 'slime', 'water']) seg[k].visible = !hide;
    seg.hidden = hide;
    if (hide) { seg.rails.visible = false; return; }
    const pos = seg.wall.geometry.attributes.position.array;
    const nor = seg.wall.geometry.attributes.normal.array;
    const uv = seg.wall.geometry.attributes.uv.array;
    const d = new THREE.Vector3();
    const zi = zoneIndex(s0 + 1);
    const around = ZONES[zi].around;
    seg.wall.material = this.zoneMats[zi];
    seg.slime.material = this.riverMats[zi];
    const tile = (TAU * R) / around; // square tiles
    let k = 0, q = 0;
    for (let j = 0; j <= RINGS; j++) {
      const s = s0 + (j / RINGS) * SEG_LEN;
      frameAt(s, f);
      for (let i = 0; i <= RADIAL; i++) {
        const th = (i / RADIAL) * TAU;
        wallDir(f, th, d);
        pos[k] = f.C.x + d.x * R; pos[k + 1] = f.C.y + d.y * R; pos[k + 2] = f.C.z + d.z * R;
        nor[k] = -d.x; nor[k + 1] = -d.y; nor[k + 2] = -d.z;
        k += 3;
        uv[q++] = (i / RADIAL) * around;
        uv[q++] = s / tile;
      }
    }
    const g = seg.wall.geometry;
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
    g.computeBoundingSphere();
    // inside a decided junction: cut away the wall where it runs inside the other arm
    const fk = FORKS.find((x) => x.side && x.kind !== 'rise' && s0 + SEG_LEN > x.s && s0 < x.s + FORK_ARM);
    const clip = g.attributes.clip.array;
    if (fk) fillClip(clip, pos, s0, SEG_LEN, RINGS, RADIAL, fk, fk.side);
    else clip.fill(-1);
    g.attributes.clip.needsUpdate = true;

    this._buildRails(seg, s0);
    // slime band follows slimeAngle(s)
    fillBand(seg.slime, s0, SEG_LEN, R - 0.03, (s) => riverBand(s)[0], (s) => riverBand(s)[1] * 1.1, 3.2, f, false, 0, around);

    fillBand(seg.water, s0, SEG_LEN, R - 0.015, (s) => waterAngle(s), (s) => waterHalfWidth(s), 2.6, f, false, 0, around);

    // one graffiti panel on most segments, high on a wall
    const rnd = hash(s0);
    if (rnd < 0.7) {
      const side = rnd < 0.35 ? 1 : -1;
      const th = side * (1.3 + rnd * 0.8);
      const gs = s0 + 4 + rnd * 14;
      seg.graf.visible = false;   // look test (was true)
      fillBand(seg.graf, gs, 9, R - 0.02, () => th, () => 0.75, 9 / 1.0, f, true, rnd);
    } else seg.graf.visible = false;
  }

  /** OPEN TOP variation: cut the roof off. The walls show both faces (you can see
   *  a rim's outside across a bend); the ceiling lamps and roof collars go. */
  setOpenTop(on) {
    OPEN_TOP.value = on ? 1 : 0;
    this.openTop = !!on;
    for (const m of this.zoneMats) { m.side = on ? THREE.DoubleSide : THREE.BackSide; m.needsUpdate = true; }
    this.lamps.forEach((l) => (l.visible = !on));
    for (const seg of this.segments) this._build(seg, seg.s0);   // river in / out
  }

  /** dev: s of the next junction */
  forkS() { return nextVisitEnd(); }

  /** Commit the rider to one arm of fork fk (side -1 / +1; for a climb +1 = up the ramp). */
  decide(fk, side) {
    fk.side = side;
    const k = side > 0 ? 1 : 0;
    addVisit(fk.opts[k], fk.s, fk.a0[k]);
    // the road not taken keeps its preview (its cut is against the same curve the real arm now follows)
    const mine = this.arms.find((a) => a.userData.side === side);
    if (mine) mine.visible = false;
    const myRiver = this.armRivers.find((r) => r.userData.side === side);
    if (myRiver) myRiver.visible = false;
    for (const seg of this.segments) if (seg.s0 + SEG_LEN > fk.s - 0.5) this._build(seg, seg.s0);
    // lamps past the split were never hung (see update) — carry on after the quiet stretch
    this.nextLampS = Math.max(this.nextLampS, fk.s + FORK_QUIET);
  }

  _makeFork(b) {
    const v = visitCount();
    const zc = zoneIndex(b - 1), wi = ZONES[zc].world, W = WORLDS[wi];
    // both ways carry on in the texture you're coming from (Elad)
    let lap = 0;
    for (let i = 0; i < v; i++) if (visitWorld(i) === wi) lap++;
    const local = zc - ZONE_BASE[wi], n = W.areas.length;
    const a0 = (((local - lap * W.perVisit) % n) + n) % n;
    const f0 = frameAt(b);
    const lat = new THREE.Vector3(f0.Rt.x, 0, f0.Rt.z).normalize();
    const nk = this.nextKind;   // dev/test override: 'y' | 'climb' | 'rise'
    const kind = nk || (Math.random() < 0.5 ? 'y' : Math.random() < 0.65 ? 'climb' : 'rise');
    const fk = { s: b, kind, side: 0, visit: v, opts: [wi, wi], a0: [a0, a0], lat, ramp: RAMP_HALF };
    FORKS.push(fk);
    if (kind === 'rise') { this.decide(fk, 1); return fk; }
    for (const arm of this.arms) {
      const side = arm.userData.side;
      arm.material = this.zoneMats[zc];
      this._buildArm(arm, fk, side, ZONES[zc].around);
      arm.visible = true;
    }
    if (kind === 'y') this._buildDivider(fk);
    else this._buildRampEdges(fk);
    return fk;
  }

  // climb: ink lines along both edges of the ramp, so it reads as a thing
  _buildRampEdges(fk) {
    const dv = this.divider, f = this.f, p = new THREE.Vector3();
    for (const m of dv.lines) { m.geometry.dispose(); m.geometry = new THREE.BufferGeometry(); }
    [-1, 1].forEach((e, i) => {
      const pts = [];
      for (let d = 2; d <= CLIMB_LEN + 6; d += 1.5) {
        const sc = fk.s + d;
        armFrame(fk, 1, sc, f);
        wallDir(f, e * fk.ramp, p);
        pts.push(f.C.clone().addScaledVector(p, R - 0.05));
      }
      dv.lines[i].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.12, 6, false);
    });
    dv.sign.visible = false;
    dv.fork = fk; dv.group.visible = true;
  }

  // Y: ink lines along the two creases where the arms part (floor ridge and
  // ceiling), meeting at the divider's nose, plus a hazard chevron on the nose.
  _buildDivider(fk) {
    const dv = this.divider;
    for (const m of dv.lines) { m.geometry.dispose(); m.geometry = new THREE.BufferGeometry(); }
    const base = new THREE.Vector3(), f = this.f;
    const lo = [], hi = [];
    let nose = null;
    for (let d = 0.5; d < FORK_LEN; d += 1.5) {
      const D = forkSpread(d);
      if (D >= R - 0.05) { nose = d; break; }
      const sc = fk.s + d;
      frameAt(sc, f);
      centerAt(sc, base, fk, 0);
      const h = Math.sqrt(R * R - D * D);
      lo.push(base.clone().addScaledVector(f.U, -h + 0.05));
      hi.push(base.clone().addScaledVector(f.U, h - 0.05));
    }
    if (lo.length > 2) {
      dv.lines[0].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lo), lo.length * 2, 0.16, 6, false);
      dv.lines[1].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hi), hi.length * 2, 0.16, 6, false);
    }
    if (nose !== null) {
      const sc = fk.s + nose;
      frameAt(sc, f); centerAt(sc, base, fk, 0);
      dv.sign.position.copy(base);
      dv.sign.quaternion.copy(wallQuat(f, 0, new THREE.Quaternion()));
    }
    dv.sign.visible = true;
    dv.fork = fk;
    dv.group.visible = true;
  }

  _buildArm(arm, fk, side, around) {
    const g = arm.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv.array;
    const f = this.f, d = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const tile = (TAU * R) / around;
    let k = 0, q = 0;
    for (let j = 0; j <= ARM_RINGS; j++) {
      const s = fk.s + (j / ARM_RINGS) * FORK_ARM;
      centerAt(s, f.C, fk, side);
      centerAt(s + 0.5, a, fk, side); centerAt(s - 0.5, b, fk, side);
      f.T.subVectors(a, b).normalize();
      f.Rt.crossVectors(f.T, WORLD_UP).normalize();
      f.U.crossVectors(f.Rt, f.T).normalize();
      for (let i = 0; i <= RADIAL; i++) {
        const th = (i / RADIAL) * TAU;
        wallDir(f, th, d);
        pos[k] = f.C.x + d.x * R; pos[k + 1] = f.C.y + d.y * R; pos[k + 2] = f.C.z + d.z * R;
        nor[k] = -d.x; nor[k + 1] = -d.y; nor[k + 2] = -d.z;
        k += 3;
        uv[q++] = (i / RADIAL) * around; uv[q++] = s / tile;
      }
    }
    fillClip(g.attributes.clip.array, pos, fk.s, FORK_ARM, ARM_RINGS, RADIAL, fk, side);
    const rv = this.armRivers.find((r) => r.userData.side === side);
    fillBand(rv, fk.s, FORK_ARM, R - 0.03, (s) => riverBand(s, fk, side)[0], (s) => riverBand(s, fk, side)[1] * 1.1, 3.2, this.f, false, 0, around, (s, fr) => armFrame(fk, side, s, fr));
    rv.visible = true;
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = g.attributes.clip.needsUpdate = true;
    g.computeBoundingSphere();
  }

  update(playerS, dt, time, speed) {
    // Y-junctions at every world border, made before the track reaches them
    const nextB = nextVisitEnd();
    if (nextB < playerS + SEG_COUNT * SEG_LEN + 60 && !FORKS.find((fk) => fk.s === nextB)) this._makeFork(nextB);
    // the Y's divider lines go with the arms
    if (this.divider.fork && playerS > this.divider.fork.s + FORK_LEN + 20) { this.divider.group.visible = false; this.divider.fork = null; }
    for (const arm of this.arms) {
      const fk = FORKS[FORKS.length - 1];
      if (arm.visible && fk && playerS > fk.s + FORK_ARM) arm.visible = false;
      if (fk && playerS > fk.s + FORK_ARM) this.armRivers.forEach((r) => (r.visible = false));
    }
    // recycle segments that fell behind
    for (const seg of this.segments) {
      if (seg.s0 + SEG_LEN < playerS - 12) {
        const maxS = Math.max(...this.segments.map((x) => x.s0));
        this._build(seg, maxS + SEG_LEN);
      }
    }
    // collar rings at the next area borders (a world border is a Y-junction instead)
    const bs = areaBordersAfter(playerS - 10, 2);
    for (let i = 0; i < 2; i++) {
      const js = bs[i];
      const j = this.junctions[i];
      j.visible = js !== undefined && !this.openTop;
      if (js !== undefined && j.userData.s !== js) {
        j.userData.s = js;
        const jf = frameAt(js, this.f);
        j.position.copy(jf.C);
        wallQuat(jf, 0, j.quaternion);        // +Y up from the floor, so the open gap sits on the floor
      }
    }
    // lamps
    while (this.nextLampS < playerS + 230) {
      // no lamps through a junction (and none past one that isn't decided yet)
      const fk = forkNear(this.nextLampS, 10, FORK_QUIET);
      if (fk) { if (!fk.side) break; this.nextLampS = fk.s + FORK_QUIET; continue; }
      const l = this.lamps.reduce((a, b) => (a.userData.s < b.userData.s ? a : b));
      if (l.userData.s > playerS - 8) break;
      l.userData.s = this.nextLampS;
      pointAt(this.nextLampS, Math.PI, R - 0.45, l.position, frameAt(this.nextLampS, this.f));
      this.nextLampS += this.lampSpacing;
    }
    const sc = dt * (0.25 + speed * 0.008);
    // thick sludge drifts; it doesn't race (one shared material, so scroll it once)
    this.slimeMat.uniforms.uScroll.value -= sc * 1.1;   // look test: moves more (was 0.6)
    this.waterMat.uniforms.uScroll.value -= dt * 0.55;
    for (const m of this.patchMats) m.uniforms.uTime.value = time;
  }

  syncFog(fog) {
    for (const m of this.patchMats) {
      m.uniforms.fogColor.value.copy(fog.color);
      m.uniforms.fogNear.value = fog.near;
      m.uniforms.fogFar.value = fog.far;
    }
  }
}

function bandMesh(across, rings, mat) {
  const verts = (across + 1) * (rings + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
  const acr = new Float32Array(verts);
  geo.setAttribute('across', new THREE.BufferAttribute(acr, 1));
  geo.setIndex(gridIndex(across, rings));
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.across = across; m.userData.rings = rings;
  return m;
}

const _d = new THREE.Vector3();
function fillBand(mesh, s0, len, r, angFn, halfFn, vScale, f, panel = false, rnd = 0, wallUV = false, frameFn = frameAt) {
  // wallUV = the zone's tiles-around count (falsy = plain band UVs)
  const tile = (TAU * R) / (wallUV || 6);
  const { across, rings } = mesh.userData;
  const geo = mesh.geometry;
  const pos = geo.attributes.position.array, uv = geo.attributes.uv.array, ac = geo.attributes.across.array;
  let k = 0, q = 0, a = 0;
  for (let j = 0; j <= rings; j++) {
    const s = s0 + (j / rings) * len;
    frameFn(s, f);
    const c = angFn(s), hw = halfFn(s);
    for (let i = 0; i <= across; i++) {
      const t = i / across;
      const th = c + (t * 2 - 1) * hw;
      wallDir(f, th, _d);
      pos[k] = f.C.x + _d.x * r; pos[k + 1] = f.C.y + _d.y * r; pos[k + 2] = f.C.z + _d.z * r;
      k += 3;
      if (panel) {
        // one graffiti tile mapped over the panel, random quarter of the sheet
        const ox = rnd < 0.5 ? 0 : 0.5, oy = (rnd * 7) % 1 < 0.5 ? 0 : 0.5;
        uv[q++] = ox + t * 0.5; uv[q++] = oy + (j / rings) * 0.5;
      } else if (wallUV) {
        // the WALL's own mapping, so the water shader can refract the plates beneath it
        uv[q++] = (th / TAU) * wallUV; uv[q++] = s / tile;
      } else {
        uv[q++] = t * 1.2; uv[q++] = s / vScale;
      }
      ac[a++] = t;
    }
  }
  geo.attributes.position.needsUpdate = geo.attributes.uv.needsUpdate = geo.attributes.across.needsUpdate = true;
}

/** Frame of fork fk's arm `side` at s (as frameAt, but on that arm). */
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3();
function armFrame(fk, side, s, f) {
  centerAt(s, f.C, fk, side);
  centerAt(s + 0.5, _fa, fk, side); centerAt(s - 0.5, _fb, fk, side);
  f.T.subVectors(_fa, _fb).normalize();
  f.Rt.crossVectors(f.T, WORLD_UP).normalize();
  f.U.crossVectors(f.Rt, f.T).normalize();
  return f;
}

// Signed "how far inside the OTHER arm" for every vertex of a tube grid:
// > 0 = discard. The left arm yields where both coincide, so nothing z-fights.
const _oc = new THREE.Vector3(), _ot = new THREE.Vector3(), _ob = new THREE.Vector3(), _ov = new THREE.Vector3();
function fillClip(clip, pos, s0, len, rings, radial, fk, side) {
  // y: the left arm yields where they coincide. climb: the lower pipe always
  // draws; the climbing pipe draws outside it, plus its ramp (floor strip).
  const climb = fk.kind === 'climb';
  const bias = climb ? (side > 0 ? 0.01 : -0.04) : side < 0 ? 0.01 : -0.04;
  for (let j = 0; j <= rings; j++) {
    const s = s0 + (j / rings) * len;
    const inFork = s > fk.s - 0.01;
    if (inFork) {
      centerAt(s, _oc, fk, -side);
      centerAt(s + 0.5, _ot, fk, -side); centerAt(s - 0.5, _ob, fk, -side);
      _ot.sub(_ob).normalize();
    }
    for (let i = 0; i <= radial; i++) {
      const n = j * (radial + 1) + i;
      if (!inFork) { clip[n] = -1; continue; }
      _ov.set(pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2]).sub(_oc);
      _ov.addScaledVector(_ot, -_ov.dot(_ot));
      clip[n] = R - _ov.length() + bias;
      if (climb && side > 0) {
        const a = Math.abs(angleDiff((i / radial) * TAU, 0)), d = s - fk.s;
        if (a < fk.ramp && d > 2) clip[n] = Math.min(clip[n], a - fk.ramp);   // the ramp stays
      }
    }
  }
}

function gridIndex(cols, rows) {
  const idx = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return idx;
}

function hash(x) {
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
