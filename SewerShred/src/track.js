// The sewer: an endless winding pipe, and the frame math everything else rides on.
//
// Every object in the game lives in TUBE coordinates (s, θ): s is distance down
// the pipe, θ is the angle around its wall with θ = 0 at the floor and
// +π/2 on the right wall (looking downstream). `frameAt(s)` turns that into
// world space. Nothing else in the game needs to know the pipe bends.
import * as THREE from 'three';

export const R = 6;                 // pipe radius, metres
const SEG_LEN = 30;                 // metres per recycled tube segment
const SEG_COUNT = 8;                // 240 m of pipe alive at once (fog eats the far end)
const RADIAL = 40;
const RINGS = 18;
const TAU = Math.PI * 2;

// ── the centerline ───────────────────────────────────────────────────────────
// Sums of slow sines: sweeping bends left/right and a constant downhill grade
// with swells, so the pipe always reads as a DESCENT.
export function centerAt(s, out = new THREE.Vector3()) {
  const x = 15 * Math.sin(s * 0.0105) + 6 * Math.sin(s * 0.0263 + 1.3);
  const y = -0.11 * s + 4.5 * Math.sin(s * 0.0171 + 0.5);
  return out.set(x, y, -s);
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
  // ×3 wider (Elad, 2026-11-11) — the river is now the main floor feature
  return 3 * (0.27 + 0.07 * Math.sin(s * 0.047 + 1.1));
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

// ── environment zones ────────────────────────────────────────────────────────
// The pipe changes character every ZONE_LEN metres so it never reads as one
// texture tiled forever. Each zone: its wall art, how many tiles around the
// circumference, a wall tint, and the fog/ambient colour the scene eases to.
// Boundaries are segment-aligned and hidden behind a big junction ring.
export const ZONE_LEN = 300;
// Rust-iron family first (Elad: the curved red iron is the direction; the
// others had tiles too small). Fewer tiles around = bigger panels. The brick /
// cave / subway / original-iron zones are parked in ZONES_PARKED.
// Patina family (Elad: "the dark one with green — start with that"; its
// saturation/grade is the target). Every zone shares Copper Deep's teal grade.
const PATINA_GRADE = { tint: 0xc8d4cc, fog: 0x0c1a18, hemi: [0xbff5e6, 0x22302c] };
export const ZONES = [
  { key: 'rust_patina', name: 'COPPER DEEP',   around: 3, ...PATINA_GRADE },
  { key: 'pat_a',       name: 'VERDIGRIS RUN', around: 3, ...PATINA_GRADE },
  { key: 'rust_hazard', name: 'HAZARD LINE',   around: 3, ...PATINA_GRADE, tint: 0xc4cac0 },
  { key: 'pat_c',       name: 'THE HONEYCOMB', around: 4, ...PATINA_GRADE },
];
// parked: too red / lava-like (Elad) and the small-tile first pass
export const ZONES_PARKED = ['rust', 'rust_red', 'rust_ember', 'brick', 'cave', 'wall', 'tile'];
export function zoneIndex(s) {
  return ((Math.floor(Math.max(0, s) / ZONE_LEN) % ZONES.length) + ZONES.length) % ZONES.length;
}

// Large-scale brightness variation: re-sample the wall's own map at 1/7 scale
// and modulate, so identical tiles don't line up into an obvious grid.
function antiRepeat(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        float macro = texture2D(map, vMapUv * 0.143 + vec2(0.37, 0.11)).g;
        float macro2 = texture2D(map, vMapUv.yx * 0.071 + vec2(0.7, 0.2)).r;
        diffuseColor.rgb *= 0.62 + 0.55 * macro + 0.25 * (macro2 - 0.5);
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
      return antiRepeat(new THREE.MeshLambertMaterial({ map: m, color: z.tint, side: THREE.BackSide }));
    });
    this.wallMat = this.zoneMats[0];
    // the river: same refracting treatment as the pools — plates swim under a
    // translucent green current — with the slime texture as its surface
    // river = the pool water shader, as is (Elad: "less disgusting"). The
    // slime look is kept in git history / the slime texture if we want it back.
    this.slimeMat = waterMaterial(tex.water, tex.wall);
    // one river material per zone so the plates it refracts are that zone's wall
    this.riverMats = ZONES.map((z) => waterMaterial(tex.water, tex[z.key]));
    this.grafMat = patchMaterial(tex.graffiti, { tint: new THREE.Color(0.85, 0.85, 0.85), alpha: 0.9, edge: 0.3 });
    this.waterMat = waterMaterial(tex.water, tex.wall);
    this.patchMats = [...new Set([this.slimeMat, ...this.riverMats, this.grafMat, this.waterMat])];

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

    // junction rings: a fat bolted collar where one zone's pipe meets the next
    this.junctions = [];
    const collarMat = new THREE.MeshLambertMaterial({ color: 0x5b6266, emissive: 0x0c0e10 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffb21e });
    const boltMat = new THREE.MeshLambertMaterial({ color: 0x9aa3a8 });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.15, 0.55, 10, 48), collarMat));
      const st = new THREE.Mesh(new THREE.TorusGeometry(R - 0.62, 0.08, 6, 48), stripeMat); g.add(st);
      const boltGeo = new THREE.SphereGeometry(0.16, 6, 4);
      for (let k = 0; k < 16; k++) {
        const b = new THREE.Mesh(boltGeo, boltMat);
        const a = (k / 16) * TAU;
        b.position.set(Math.cos(a) * (R - 0.75), Math.sin(a) * (R - 0.75), 0.42);
        g.add(b);
      }
      g.userData.s = -1e9;
      scene.add(g);
      this.junctions.push(g);
    }

    for (let i = 0; i < SEG_COUNT; i++) this.segments.push(this._makeSegment());
    this.reset();
  }

  reset() {
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
    this.scene.add(graf);

    // floor water sits just above the plates, under the slime where they cross
    const water = bandMesh(36, 36, this.waterMat);
    water.renderOrder = 1.5;
    this.scene.add(water);
    return { wall, slime, graf, water, s0: 0 };
  }

  _build(seg, s0) {
    seg.s0 = s0;
    const f = this.f;
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

    // slime band follows slimeAngle(s)
    fillBand(seg.slime, s0, SEG_LEN, R - 0.03, (s) => slimeAngle(s), (s) => slimeHalfWidth(s) * 1.1, 3.2, f, false, 0, around);

    fillBand(seg.water, s0, SEG_LEN, R - 0.015, (s) => waterAngle(s), (s) => waterHalfWidth(s), 2.6, f, false, 0, around);

    // one graffiti panel on most segments, high on a wall
    const rnd = hash(s0);
    if (rnd < 0.7) {
      const side = rnd < 0.35 ? 1 : -1;
      const th = side * (1.3 + rnd * 0.8);
      const gs = s0 + 4 + rnd * 14;
      seg.graf.visible = true;
      fillBand(seg.graf, gs, 9, R - 0.02, () => th, () => 0.75, 9 / 1.0, f, true, rnd);
    } else seg.graf.visible = false;
  }

  update(playerS, dt, time, speed) {
    // recycle segments that fell behind
    for (const seg of this.segments) {
      if (seg.s0 + SEG_LEN < playerS - 12) {
        const maxS = Math.max(...this.segments.map((x) => x.s0));
        this._build(seg, maxS + SEG_LEN);
      }
    }
    // junction rings at the next zone boundaries
    const nb = Math.ceil((playerS - 10) / ZONE_LEN) * ZONE_LEN;
    for (let i = 0; i < 2; i++) {
      const js = Math.max(ZONE_LEN, nb + i * ZONE_LEN);
      const j = this.junctions[i];
      if (j.userData.s !== js) {
        j.userData.s = js;
        const jf = frameAt(js, this.f);
        j.position.copy(jf.C);
        j.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), jf.T.clone().negate());
      }
    }
    // lamps
    while (this.nextLampS < playerS + 230) {
      const l = this.lamps.reduce((a, b) => (a.userData.s < b.userData.s ? a : b));
      if (l.userData.s > playerS - 8) break;
      l.userData.s = this.nextLampS;
      pointAt(this.nextLampS, Math.PI, R - 0.45, l.position, frameAt(this.nextLampS, this.f));
      this.nextLampS += this.lampSpacing;
    }
    const sc = dt * (0.25 + speed * 0.008);
    for (const m of this.riverMats) m.uniforms.uScroll.value -= sc;
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
function fillBand(mesh, s0, len, r, angFn, halfFn, vScale, f, panel = false, rnd = 0, wallUV = false) {
  // wallUV = the zone's tiles-around count (falsy = plain band UVs)
  const tile = (TAU * R) / (wallUV || 6);
  const { across, rings } = mesh.userData;
  const geo = mesh.geometry;
  const pos = geo.attributes.position.array, uv = geo.attributes.uv.array, ac = geo.attributes.across.array;
  let k = 0, q = 0, a = 0;
  for (let j = 0; j <= rings; j++) {
    const s = s0 + (j / rings) * len;
    frameAt(s, f);
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
