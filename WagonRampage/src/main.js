import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { World, HW, FAC, LANES, DECIDE_AT, path, pointAt, frameAt, yawAt, refl } from './world.js';
import { Car, KINDS, FOOT_LOOK, loadCarModels } from './cars.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { devPanelWanted, loadSavedLook, buildDevPanel } from './devpanel.js';

// ── Tuning ───────────────────────────────────────────────────────────────────
const MISSION = { time: 90, target: 12, stars: [12, 20, 28] };
const SPEED = { start: 36, top: 47, rampTime: 60 };   // m/s — a chase, not a cruise
const LAT = { max: 12.5, accel: 55 };        // player sideways speed (m/s) and response
const RAM = { base: 6, perSpeed: 5.2, grindDps: 30, wallPerSpeed: 6, rearPerSpeed: 4 };
const COMBO_WINDOW = 4.5;
const ORB_EVERY = 11;                         // seconds between Raph pickups

const $ = (id) => document.getElementById(id);

// ── Look: every tunable render value in one place (the dev panel edits these live) ────
const LOOK_DEFAULTS = {
  exposure: 1.2, saturation: 1.1, contrast: 1.05, vignette: 0.35, speedBlur: 1,
  bloomStrength: 0.6, bloomRadius: 0.55, bloomThreshold: 0.92,
  sunIntensity: 2.4, sunColor: '#aab8ff', sunAzimuth: -60, sunElevation: 50,
  hemiIntensity: 0.9, hemiSky: '#8890d0', hemiGround: '#241a2c',
  lampLight: 34, lampPool: 0.38, neonLight: 44, windows: 1.15, neonSigns: 1.3, underglow: 0.7, fogDensity: 0.0052,
  roadWet: 0.8, roadDark: 0.34, fresnelBase: 0.05, fresnelEdge: 0.5, dampSheen: 0.28, walkWet: 0.2,
  raphHeight: 2.64, hatchRadius: 0.8, hatchZ: 0.5,
  shake: 1, hitStop: 1,
  footRacer: '#7a4fd0', footTruck: '#5b4a78', footRough: 0.6, footMetal: 0, footGlow: '#000000', footStripes: 1,
};
// named looks the dev panel can flip between; Custom 1 = Elad's tuning, 2026-11-16
const LOOK_PRESETS = {
  Default: LOOK_DEFAULTS,
  'Custom 1': {
    exposure: 2.12, saturation: 1.08, contrast: 0.96, vignette: 0.8, speedBlur: 1,
    bloomStrength: 1, bloomRadius: 1, bloomThreshold: 1.23,
    sunIntensity: 3.95, sunColor: '#000000', sunAzimuth: -60, sunElevation: 50,
    hemiIntensity: 0.9, hemiSky: '#ffffff', hemiGround: '#755e87',
    lampLight: 57, lampPool: 0.44, neonLight: 44, windows: 0.37, neonSigns: 0.33, underglow: 0.49, fogDensity: 0.0036,
    roadWet: 1.14, roadDark: 0.14, fresnelBase: 0.165, fresnelEdge: 0.93, dampSheen: 0.22, walkWet: 0.16,
    raphHeight: 2.64, hatchRadius: 0.8, hatchZ: 0.5,
  },
};
const LOOK = { ...LOOK_DEFAULTS };
const DEV = devPanelWanted();
if (DEV) loadSavedLook(LOOK);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ── Renderer / scene ─────────────────────────────────────────────────────────
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(1.5, window.devicePixelRatio || 1);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LOOK.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// everything that should appear in the wet-road mirror lives under `stage`
const stage = new THREE.Group();
scene.add(stage);

// Night sky: deep blue overhead, a sodium-purple city glow at the horizon. Symmetric in |y|
// so its reflection in the wet road matches.
const HORIZON = new THREE.Color(0x3a4580), ZENITH = new THREE.Color(0x080b22), BAND = new THREE.Color(0x9a5aa8);
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { cH: { value: HORIZON }, cZ: { value: ZENITH }, cB: { value: BAND } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }',
  fragmentShader: 'uniform vec3 cH; uniform vec3 cZ; uniform vec3 cB; varying vec3 vD; void main(){ float y = abs(vD.y); float h = pow(clamp(y*1.8, 0.0, 1.0), 0.55); vec3 c = mix(cH, cZ, h) + cB * exp(-y * 14.0) * 0.3; gl_FragColor = vec4(c, 1.0); }',
}));
sky.renderOrder = -1;
scene.add(sky);
scene.fog = new THREE.FogExp2(0x33408a, 0.0052);
scene.background = new THREE.Color(0x33408a);
const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 1100);
{
  const v3 = (c) => `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogDir;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogDepth = - mvPosition.z;\nvFogDir = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor;\nvarying float vFogDepth;\nvarying vec3 vFogDir;\nuniform float fogDensity;\n#endif';
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
float fy = abs(normalize(vFogDir).y);
vec3 skyC = mix(${v3(HORIZON)}, ${v3(ZENITH)}, pow(clamp(fy * 1.8, 0.0, 1.0), 0.55)) + ${v3(BAND)} * exp(-fy * 14.0) * 0.3;
gl_FragColor.rgb = mix( gl_FragColor.rgb, skyC, fogFactor );
#endif`;
}
const hemi = new THREE.HemisphereLight(0x8890d0, 0x241a2c, 0.9);
scene.add(hemi);
// moonlight: the one shadow-caster, cool and low so cars sit on the road
const sun = new THREE.DirectionalLight(0x90a8ff, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
// real warm light from the nearest street lamps (pooled, re-hung every frame)
const lampLights = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffb878, 24, 32, 1.5); scene.add(l); return l; });
// neon spill from the shopfronts: magenta / cyan / amber pools fixed along the street (every
// 34 m, alternating sides) so the cars and the wet road pick up colour as they pass
const NEON_COLS = [0xd860b0, 0x60a8d8, 0xd89050, 0x9070d0];
const neonLights = Array.from({ length: 3 }, () => { const l = new THREE.PointLight(0xffffff, 26, 26, 1.6); scene.add(l); return l; });
// the wagon's headlights
const head = new THREE.SpotLight(0xfff0d8, 160, 55, 0.55, 0.7, 1.3);
scene.add(head, head.target);
// (no scene.environment: a PMREM room env here turned every lit surface fog-coloured —
// measured 2026-11-15, buildings and cars vanished; the lamps and neon light the cars instead)

// post: bloom on everything bright (windows, neon, lamps, fire), then tone map
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// grade: punchier saturation and contrast, cool shadows, vignette, and a speed blur that
// streaks only the screen edges (the centre - the wagon and the targets - stays sharp)
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uAspect: { value: 1.78 }, uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: 0.4 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed; uniform float uAspect; uniform float uSat; uniform float uCon; uniform float uVig; varying vec2 vUv;
void main(){
  vec2 d = vUv - vec2(0.5, 0.42);
  float r = length(d * vec2(uAspect, 1.0)) / uAspect * 1.6;
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float b = uSpeed * smoothstep(0.5, 1.1, r) * 0.025;
  if (b > 0.0005) { for (int i = 1; i <= 5; i++) c += texture2D(tDiffuse, vUv - d * b * float(i)).rgb; c /= 6.0; }
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uCon + 0.5;
  c += vec3(-0.006, 0.0, 0.015) * (1.0 - l);
  c *= mix(1.0, 1.0 - uVig, smoothstep(0.55, 1.25, r));
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`,
});
composer.addPass(grade);
// the wet-road mirror, rendered at half resolution
const reflRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
refl.tRefl.value = reflRT.texture;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  reflRT.setSize(Math.round(w * DPR / 2), Math.round(h * DPR / 2));
  refl.uRes.value.set(w * DPR, h * DPR);
  camera.aspect = w / h;
  grade.uniforms.uAspect.value = w / h;
  // portrait phones need a wider view to keep both curbs on screen
  camera.fov = w < h ? 68 : 52;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Mirror the stage in y=0 and render it from the same camera: sampled at the same screen
// position by the road shader, that is exactly the planar reflection. Ground meshes are
// hidden (they are the mirror), shadows aren't re-rendered.
function renderReflection() {
  stage.scale.y = -1;
  world.setGroundVisible(false);
  for (const c of [player, ...enemies]) c.glow.visible = false;
  renderer.shadowMap.autoUpdate = false;
  // the mirror renders without fog: rendering it WITH fog left every lit mesh fully fogged in
  // the main pass that follows (measured — buildings and cars vanished into the haze)
  const fog = scene.fog; scene.fog = null;
  renderer.setRenderTarget(reflRT);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.fog = fog;
  renderer.shadowMap.autoUpdate = true;
  for (const c of [player, ...enemies]) c.glow.visible = c.alive || c === player;
  world.setGroundVisible(true);
  stage.scale.y = 1;
}
// turtle-head icons (pickups, back doors) live on their own layer and are drawn after the whole
// post chain, straight to the screen: no lights, fog, tone mapping, grade or bloom — the PNG as is
const ICON_LAYER = 1;
function iconOnly(o) { o.layers.set(ICON_LAYER); o.renderOrder = 10; o.material.toneMapped = false; o.material.fog = false; return o; }
function render() {
  if (world && !window.__noRefl) renderReflection();
  composer.render();
  const bg = scene.background, fog = scene.fog;
  scene.background = null; scene.fog = null;
  camera.layers.set(ICON_LAYER);
  renderer.autoClear = false;
  renderer.setRenderTarget(null);
  renderer.clearDepth();
  renderer.render(scene, camera);
  renderer.autoClear = true;
  camera.layers.set(0);
  scene.background = bg; scene.fog = fog;
}

const sunOff = new THREE.Vector3(-22, 40, 12);
function applyLook() {
  const L = LOOK;
  renderer.toneMappingExposure = L.exposure;
  grade.uniforms.uSat.value = L.saturation; grade.uniforms.uCon.value = L.contrast; grade.uniforms.uVig.value = L.vignette;
  bloom.strength = L.bloomStrength; bloom.radius = L.bloomRadius; bloom.threshold = L.bloomThreshold;
  sun.intensity = L.sunIntensity; sun.color.set(L.sunColor);
  const az = THREE.MathUtils.degToRad(L.sunAzimuth), el = THREE.MathUtils.degToRad(L.sunElevation);
  sunOff.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(48);
  hemi.intensity = L.hemiIntensity; hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGround);
  for (const l of lampLights) l.intensity = L.lampLight;
  for (const l of neonLights) l.intensity = L.neonLight;
  scene.fog.density = L.fogDensity;
  refl.uF0.value = L.fresnelBase; refl.uF1.value = L.fresnelEdge; refl.uSheen.value = L.dampSheen;
  if (world) {
    world.mat.road.userData.wet.uWet.value = L.roadWet; world.mat.road.userData.wet.uDark.value = L.roadDark;
    world.mat.walk.userData.wet.uWet.value = L.walkWet;
    world.mat.pool.opacity = L.lampPool;
    world.setGlow(L.windows, L.neonSigns);
  }
  if (player) for (const c of [player, ...enemies]) c.glow.material.opacity = (c === player ? 0.5 : 0.75) * L.underglow;
  FOOT_LOOK.tint.racer.set(L.footRacer); FOOT_LOOK.tint.truck.set(L.footTruck);
  FOOT_LOOK.rough = L.footRough; FOOT_LOOK.metal = L.footMetal; FOOT_LOOK.glow.set(L.footGlow); FOOT_LOOK.stripe = L.footStripes;
  for (const e of enemies) e.applyLook();
  if (raphTop) {
    raphTop.model.scale.setScalar(L.raphHeight / raphTop.tall);
    raphTop.hatch.scale.set(L.hatchRadius, 1, L.hatchRadius);
    raphTop.hatch.position.set(0, models.wagon.roofY - 0.12, L.hatchZ);
    for (const H of [raphTop, mikeTop, donTop]) {
      if (!H) continue;
      if (H !== raphTop) H.model.scale.setScalar(L.raphHeight / H.tall);
      H.baseY = models.wagon.roofY + 0.08;
      H.holder.position.set(0, H.baseY, L.hatchZ);
    }
  }
}

// ── Game state ───────────────────────────────────────────────────────────────
const G = {
  state: 'loading', time: 0, left: MISSION.time, score: 0, wrecks: 0,
  combo: 1, comboT: 0, bestCombo: 1, paused: false, timeScale: 1, hitStop: 0,
  shake: 0, orbT: 4, power: null, strike: null, knockT: 0, cleared: false, hp: 100, hurtV: 0, slowT: 0,
};
let world, fx, player, models, leo, raphTop, mikeTop, donTop;
const enemies = [];
const orbs = [];
const headTex = {};
const audio = new Audio();
const input = new Input(canvas);

// ── Boot ─────────────────────────────────────────────────────────────────────
(async function boot() {
  const tl = new THREE.TextureLoader();
  const tex = {};
  await Promise.all(['asphalt', 'sidewalk', 'brick_n', 'brick_glow', 'office_n', 'office_glow', 'shops_n', 'shops_glow', 'neon', 'brick2_n', 'brick2_glow', 'office2_n', 'office2_glow', 'shops2_n', 'shops2_glow'].map(async (n) => {
    tex[n] = await tl.loadAsync(`/tex/${n}.jpg`);
    tex[n].colorSpace = THREE.SRGBColorSpace;
  }));
  for (const k of ['raph', 'leo', 'mike', 'donnie', 'saws', 'shield', 'nitro', 'harpoon']) { headTex[k] = await tl.loadAsync(`/ui/${k}.png`); headTex[k].colorSpace = THREE.SRGBColorSpace; }
  world = new World(stage, tex);
  fx = new FX(stage);
  models = await loadCarModels();
  player = new Car('wagon', models.wagon, stage);
  for (let i = 0; i < 5; i++) enemies.push(new Car('racer', models.racer, stage));
  for (let i = 0; i < 2; i++) enemies.push(new Car('truck', models.truck, stage));
  ({ leo, raphTop, mikeTop, donTop } = await loadHeroes());
  buildBuffProps();
  applyLook();
  if (DEV) buildDevPanel(LOOK, LOOK_PRESETS, applyLook, G);
  $('loading').classList.add('hidden');
  startRun();
  requestAnimationFrame(loop);
})();

// One turtle model, two instances: Leo (the same mesh, red wraps recoloured blue) who leaps
// car to car, and Raph who stands on the wagon roof throwing sais.
async function loadHeroes() {
  const g = await new GLTFLoader().loadAsync('/models/raphael.glb');
  const clips = await (await fetch('/models/clips.json')).json();
  const throws = await (await fetch('/models/throws.json')).json();
  const leoTex = await new THREE.TextureLoader().loadAsync('/models/leo_tex.jpg');
  leoTex.colorSpace = THREE.SRGBColorSpace; leoTex.flipY = false;
  const box = new THREE.Box3().setFromObject(g.scene);
  const tall = box.max.y - box.min.y;
  const make = (height, tex) => {
    const model = cloneSkinned(g.scene);
    model.scale.setScalar(height / tall);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      if (tex) { o.material = o.material.clone(); o.material.map = tex; }
    });
    const holder = new THREE.Group(); holder.add(model); holder.visible = false;
    const mixer = new THREE.AnimationMixer(model);
    return { holder, model, mixer };
  };
  // Leo: hero-sized next to the cars, it's his big moment
  const L = make(3.2, leoTex);
  stage.add(L.holder);
  L.flip = L.mixer.clipAction(THREE.AnimationClip.parse(clips.flip));
  L.flip.setLoop(THREE.LoopOnce); L.flip.clampWhenFinished = true;
  // twin glowing katanas, one per hand bone so they follow every frame of the flip. The blade
  // leaves the fist on the thumb side: thumb direction with the finger direction taken out.
  L.holder.updateMatrixWorld(true);
  const V3 = THREE.Vector3;
  L.tips = [];
  for (const side of ['Left', 'Right']) {
    const hand = L.model.getObjectByName(`mixamorig${side}Hand`);
    const f = L.model.getObjectByName(`mixamorig${side}HandMiddle1`).position.clone().normalize();
    const t = L.model.getObjectByName(`mixamorig${side}HandThumb1`).position.clone();
    const axis = t.sub(f.clone().multiplyScalar(t.dot(f))).normalize();
    const k = buildKatana();
    const ws = hand.getWorldScale(new V3());
    k.scale.setScalar(1 / ws.x);
    k.quaternion.setFromUnitVectors(new V3(0, 1, 0), axis);
    k.position.copy(L.model.getObjectByName(`mixamorig${side}HandMiddle1`).position).multiplyScalar(0.55);
    hand.add(k);
    const tip = new THREE.Object3D(); tip.position.y = 1.3; k.add(tip); L.tips.push(tip);
  }
  // Raph: a touch smaller so he fits on the roof; the three clips Elad tagged THROW
  // (Sewer Shred attacks #4, #7, #8). [start, release, end] in clip seconds — release is the
  // forearm's peak speed, measured from the clip data.
  const R = make(1, null);
  R.tall = tall;
  R.holder.position.set(0, models.wagon.roofY - 0.05, 0.5);
  player.body.add(R.holder);   // on the body, so he rolls with the wagon
  R.hand = R.model.getObjectByName('mixamorigRightHand');
  R.throws = [['a8', 0.0, 0.3, 0.75], ['a7', 0.35, 0.87, 1.35], ['a4', 0.7, 1.22, 1.7]].map(([k, a, rel, b]) => {
    const act = R.mixer.clipAction(THREE.AnimationClip.parse(throws[k]));
    act.setLoop(THREE.LoopOnce); act.clampWhenFinished = true;
    return { act, a, rel, b };
  });
  R.ride = R.mixer.clipAction(THREE.AnimationClip.parse(clips.ride));
  // each throw twists his body: measure where his chest points at the release frame (shoulder
  // line, in the holder's frame) so he can be turned by target-minus-twist and actually face
  // the car when the sai leaves his hand (measured 90-170 degrees off without this)
  const V = THREE.Vector3, Ls = new V(), Rs = new V();
  const sL = R.model.getObjectByName('mixamorigLeftShoulder'), sR = R.model.getObjectByName('mixamorigRightShoulder');
  for (const t of R.throws) {
    R.mixer.stopAllAction();
    t.act.reset().play(); t.act.time = t.rel; R.mixer.update(0);
    R.holder.updateMatrixWorld(true);
    R.holder.worldToLocal(sL.getWorldPosition(Ls)); R.holder.worldToLocal(sR.getWorldPosition(Rs));
    const f = new V(0, 1, 0).cross(Rs.sub(Ls));
    t.face = Math.atan2(f.x, f.z);
  }
  R.mixer.stopAllAction();
  // a turret-style hatch ring under his feet hides the open sunroof he's standing in
  const hatch = new THREE.Group();
  const green = new THREE.MeshLambertMaterial({ color: 0x46692a });
  const rim = new THREE.MeshLambertMaterial({ color: 0x2b2f22 });
  // green sides, a black unlit top: under the lid it reads as a hole into the van
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.06, 0.22, 24), [green, new THREE.MeshBasicMaterial({ color: 0x050407 }), green]); deck.position.y = 0.11; hatch.add(deck);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 32), rim); ring.rotation.x = Math.PI / 2; ring.position.y = 0.22; hatch.add(ring);
  // yellow lid in two halves that slide apart when a turtle comes up
  const yellow = new THREE.MeshLambertMaterial({ color: 0xc99a12, emissive: 0x140e00 });   // toned down from 0xf2c21a
  hatch.userData.lid = [0, 1].map((i) => {
    const half = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.94, 0.07, 24, 1, false, i * Math.PI, Math.PI), yellow);
    half.position.y = 0.27;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 1.88), rim); seam.position.x = 0; half.add(seam);
    hatch.add(half);
    return half;
  });
  hatch.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  player.body.add(hatch);   // always up: the roof's turret ring, manned during a power
  R.hatch = hatch;
  // Mikey and Donnie: the same rig recoloured (tools/recolor-turtle.py), each frozen in one
  // pose found by tools/pose-probe.mjs, and stood in the hatch like Raph
  const texOf = async (n) => { const t = await new THREE.TextureLoader().loadAsync(`/models/${n}_tex.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return t; };
  const [mikeTex, donTex] = await Promise.all([texOf('mike'), texOf('donnie')]);
  const all = { ...clips, ...throws };
  const posed = (tex, [clip, t]) => {
    const H = make(1, tex); H.tall = tall;
    player.body.add(H.holder);
    const act = H.mixer.clipAction(THREE.AnimationClip.parse(all[clip]));
    act.play(); act.time = t; act.paused = true; H.mixer.update(0);
    H.model.updateMatrixWorld(true);
    // bone positions in the model's own (unscaled) frame, so props parented to it stay put at any height
    H.at = (n) => H.model.worldToLocal(H.model.getObjectByName('mixamorig' + n).getWorldPosition(new V()));
    const f = new V(0, 1, 0).cross(H.at('RightShoulder').sub(H.at('LeftShoulder')));
    H.face = Math.atan2(f.x, f.z);
    H.unit = tall / 2.64;   // one metre (at the default 2.64 m height) in model units
    return H;
  };
  const M = posed(mikeTex, MIKE_POSE);
  M.cannon = buildPizzaCannon();
  // bazooka-style on his right shoulder: from the chase camera his shell hid it in his hands
  M.cannon.scale.setScalar(M.unit * 1.25);
  const sh = M.at('RightShoulder'), out = sh.clone().sub(M.at('LeftShoulder')).setY(0).normalize();
  M.cannon.position.copy(sh).addScaledVector(out, 0.22 * M.unit).add(new V(0, 0.32 * M.unit, 0));
  M.cannon.rotation.y = M.face;
  M.model.add(M.cannon);
  const D = posed(donTex, DON_POSE);
  D.device = buildEmitter();
  D.device.scale.setScalar(D.unit);
  D.device.position.copy(D.at(DON_POSE[2]));
  D.model.add(D.device);
  return { leo: L, raphTop: R, mikeTop: M, donTop: D };
}

// Leo's katana, in metres along +y from the middle of the grip: wrapped hilt, gold guard, and
// a blade that glows blue (HDR colour, so the bloom picks it up) inside a soft additive halo
let katanaParts = null;
function buildKatana() {
  if (!katanaParts) {
    const blade = new THREE.BoxGeometry(0.05, 1.05, 0.016); blade.translate(0, 0.72, 0);
    const tip = new THREE.ConeGeometry(0.035, 0.12, 4); tip.translate(0, 1.3, 0); tip.scale(1, 1, 0.32);
    const halo = new THREE.BoxGeometry(0.16, 1.2, 0.16); halo.translate(0, 0.75, 0);
    katanaParts = {
      hilt: new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8),
      guard: new THREE.CylinderGeometry(0.08, 0.08, 0.025, 12).translate(0, 0.18, 0),
      blade: mergeGeometries([blade, tip]), halo,
      hiltMat: new THREE.MeshLambertMaterial({ color: 0x1d2440 }),
      guardMat: new THREE.MeshLambertMaterial({ color: 0xc9a23a, emissive: 0x2a1c00 }),
      bladeMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.4, 4.2) }),
      haloMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.4, 1.0), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
  }
  const P = katanaParts, g = new THREE.Group();
  g.add(new THREE.Mesh(P.hilt, P.hiltMat), new THREE.Mesh(P.guard, P.guardMat), new THREE.Mesh(P.blade, P.bladeMat), new THREE.Mesh(P.halo, P.haloMat));
  g.traverse((o) => { o.frustumCulled = false; });
  return g;
}
// Mikey's pose holds both hands in front of his chest; Donnie's raises one hand overhead
const MIKE_POSE = ['spin', 7.0];
const DON_POSE = ['a7', 0.7, 'RightHand'];
function pizzaBoxTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#e9dcc0'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#b4382a'; x.lineWidth = 6; x.strokeRect(8, 8, 112, 112);
  x.fillStyle = '#c9281c'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('PIZZA', 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Mikey's pizza gatling (+z forward): spinning three-barrel cluster with a flared muzzle, a
// side magazine of stacked pizza boxes feeding a chute, glowing stripe, top sight with a red
// dot and a green shell-style back cap. userData.spin is the barrel cluster (spun while firing).
function buildPizzaCannon() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f38 });
  const steel = new THREE.MeshLambertMaterial({ color: 0x8e95a3 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xff8a1e, emissive: 0x3a1600 });
  const green = new THREE.MeshLambertMaterial({ color: 0x3f7a2a, emissive: 0x0a1a05 });
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.2) });
  const cyl = (r0, r1, h, m, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.rotation.x = Math.PI / 2; return o; };
  // receiver body
  const body = cyl(0.24, 0.27, 0.8, orange, 8); body.position.z = -0.05; g.add(body);
  const stripe = cyl(0.275, 0.275, 0.06, hot, 8); stripe.position.z = 0.12; g.add(stripe);
  const stripe2 = stripe.clone(); stripe2.position.z = -0.25; g.add(stripe2);
  // green shell cap on the back
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), green);
  cap.rotation.x = -Math.PI / 2; cap.position.z = -0.45; g.add(cap);
  // spinning barrel cluster
  const spin = new THREE.Group(); spin.position.z = 0.35; g.add(spin);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const tube = cyl(0.065, 0.065, 0.85, steel, 10); tube.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.42); spin.add(tube);
    const bore = cyl(0.045, 0.045, 0.02, hot, 10); bore.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.86); spin.add(bore);
  }
  for (const z of [0.12, 0.62]) { const clamp = cyl(0.23, 0.23, 0.07, dark, 12); clamp.position.z = z; spin.add(clamp); }
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.18, 16, 1, true), dark);
  bell.material = new THREE.MeshLambertMaterial({ color: 0x2c2f38, side: THREE.DoubleSide });
  bell.rotation.x = Math.PI / 2; bell.position.z = 0.83; spin.add(bell);
  // side magazine: three pizza boxes and a chute into the receiver
  const boxTex = new THREE.MeshLambertMaterial({ map: pizzaBoxTexture() });
  const boxMats = [dark, dark, boxTex, dark, dark, dark];
  for (let i = 0; i < 3; i++) {
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), boxMats);
    bx.position.set(0.48, -0.12 + i * 0.09, -0.05); bx.rotation.y = (i - 1) * 0.08; g.add(bx);
  }
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), dark); chute.position.set(0.27, 0, -0.05); g.add(chute);
  // top sight with a red dot, and a grip
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.45), dark); rail.position.set(0, 0.29, 0); g.add(rail);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), dark); sight.position.set(0, 0.37, 0.1); g.add(sight);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.15) })); dot.position.set(0, 0.37, 0.16); g.add(dot);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.14), dark); grip.position.set(0, -0.3, -0.1); grip.rotation.x = 0.25; g.add(grip);
  const tip = new THREE.Object3D(); tip.position.z = 1.3; g.add(tip);
  g.userData.tip = tip; g.userData.spin = spin; g.userData.hot = hot;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Donnie's EMP emitter: a rod with a coil and a glowing orb on top (+y from the hand)
function buildEmitter() {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x8a8f9c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2c34 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 8), metal); rod.position.y = 0.2; g.add(rod);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.16), dark); body.position.y = 0.05; g.add(body);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 0.6) })); led.position.set(0, 0.08, 0.09); g.add(led);
  for (const y of [0.42, 0.5]) { const coil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), metal); coil.rotation.x = Math.PI / 2; coil.position.y = y; g.add(coil); }
  const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.6, 2.6) });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), orbMat); orb.position.y = 0.68; g.add(orb);
  g.userData.orb = orb;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// turn a roof turtle so his chest (pose twist taken out) points at a car
function aimHero(H, tgt, face, dt, rate = 20) {
  const lp = H.holder.parent.worldToLocal(_c.copy(tgt.group.position));
  const want = Math.atan2(lp.x - H.holder.position.x, lp.z - H.holder.position.z) - face;
  let dy = want - H.holder.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  H.holder.rotation.y += dy * Math.min(1, dt * rate);
}

function startRun() {
  Object.assign(G, { state: 'countdown', time: 0, left: MISSION.time, score: 0, wrecks: 0, combo: 1, comboT: 0, bestCombo: 1,
    timeScale: 1, hitStop: 0, shake: 0, orbT: 4, power: null, strike: null, knockT: 0, cleared: false, countT: 3.2, spawnT: 0, hp: SHELL_MAX, hurtV: 0, slowT: 0 });
  for (const list of [shots, waves, bolts, zaps]) { for (const x of list) stage.remove(x.m || x.mesh); list.length = 0; }
  endBuff();
  endGadget();
  resetHatch();
  world.reset();
  player.reset();
  Object.assign(player, { s: 0, u: 0, vs: SPEED.start, alive: true, active: true });
  player.group.visible = true;
  for (const e of enemies) e.reset();
  for (const o of orbs) stage.remove(o.mesh);
  orbs.length = 0;
  leo.holder.visible = false;
  world.update(0);
  // open with three Foot cars already around the wagon — straight into the action
  spawnEnemy('racer', 18, -1.8); spawnEnemy('racer', 34, 5.4); spawnEnemy('truck', 52, -5.4);
  $('gameover-overlay').classList.add('hidden');
  $('target').textContent = MISSION.target;
  updateHud();
}

// ── Enemies ──────────────────────────────────────────────────────────────────
function spawnEnemy(kind, rel, lane) {
  const e = enemies.find((c) => c.kind === kind && !c.active);
  if (!e) return null;
  e.reset();
  e.active = true; e.alive = true; e.group.visible = true;
  e.s = player.s + rel;
  e.u = lane ?? LANES[Math.floor(Math.random() * LANES.length)];
  e.vs = player.vs + (rel < 0 ? 9 : -10);
  e.ai = { mode: 'cruise', lane: e.u, rel: rel < 0 ? rand(4, 14) : rand(6, 22), t: rand(1.5, 3), aggr: kind === 'truck' ? 0.45 : 0.7, fireT: rand(2.5, 4.5) };
  return e;
}

function director(dt) {
  G.spawnT -= dt;
  const live = enemies.filter((e) => e.active && e.alive).length;
  const want = Math.min(6, 4 + Math.floor(G.time / 20));
  if (live < want && G.spawnT <= 0) {
    const truckLive = enemies.filter((e) => e.active && e.alive && e.kind === 'truck').length;
    const kind = truckLive < 1 + (G.time > 40 ? 1 : 0) && Math.random() < 0.35 ? 'truck' : 'racer';
    const behind = Math.random() < 0.55;
    // pick a lane that isn't occupied near the spawn point
    const J = path.junction;
    const rel = behind || (J && player.s + 75 > J.s - 12) ? -34 : 75;
    const free = LANES.filter((l) => !enemies.some((o) => o.active && o.alive && Math.abs(o.s - (player.s + rel)) < 12 && Math.abs(o.u - l) < 2.5));
    if (free.length) spawnEnemy(kind, rel, free[Math.floor(Math.random() * free.length)]);
    G.spawnT = 1.1;
  }
}

function enemyAI(e, dt) {
  const ai = e.ai, rel = e.s - player.s, du = player.u - e.u;
  ai.t -= dt;
  if (e.hp < e.maxHp * 0.3 && ai.mode !== 'flee') { ai.mode = 'flee'; ai.rel = 95; ai.lane = e.u > 0 ? 9 : -9; }
  switch (ai.mode) {
    case 'cruise':
      if (ai.t <= 0) {
        const r = Math.random();
        if (r < ai.aggr) { ai.mode = 'stalk'; ai.t = 4.5; ai.side = Math.sign(-du) || 1; }
        else if (r < ai.aggr + 0.2 && rel > 3) { ai.mode = 'block'; ai.t = 3; }
        else { ai.lane = LANES[Math.floor(Math.random() * LANES.length)]; ai.rel = rand(3, 22); ai.t = rand(1.5, 3); }
      }
      break;
    case 'stalk': // come alongside the wagon, then swing into it
      ai.rel = 0.5;
      ai.lane = player.u + ai.side * (player.W / 2 + e.W / 2 + 1.6);
      if (Math.abs(rel) < 2.2 && Math.abs(Math.abs(du) - (player.W / 2 + e.W / 2 + 1.6)) < 1.2) { ai.mode = 'ram'; ai.t = 0.45; }
      if (ai.t <= 0) { ai.mode = 'cruise'; ai.t = rand(1, 2.5); }
      break;
    case 'ram':
      ai.lane = player.u;
      if (ai.t <= 0) { ai.mode = 'cruise'; ai.lane = e.u + (e.u > player.u ? 2.5 : -2.5); ai.t = rand(1.5, 3); }
      break;
    case 'block': // get in front of the wagon and sit in its lane
      ai.rel = 9; ai.lane = player.u;
      if (ai.t <= 0) { ai.mode = 'cruise'; ai.t = rand(1.5, 3); }
      break;
    case 'flee':
      ai.lane = Math.sin(G.time * 2 + e.s) * 7;
      break;
  }
  // shooting: only from ahead, never while pinned against the wagon, glow before each shot
  const touching = Math.abs(rel) < (e.L + player.L) / 2 + 3 && Math.abs(du) < (e.W + player.W) / 2 + 2.5;
  ai.fireT -= dt;
  if (e.emp > 0) {
    e.emp -= dt;
    if (Math.random() < dt * 8) {
      const a = e.group.position.clone().add(_n.set((Math.random() - 0.5) * e.W, 1.5 + Math.random() * 0.6, (Math.random() - 0.5) * e.L));
      const b = e.group.position.clone().add(_n.set((Math.random() - 0.5) * e.W, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * e.L));
      makeZap(a, b, 0.35, 0.07);
    }
  }
  if (touching) ai.fireT = Math.max(ai.fireT, 1.4);
  const canFire = G.state === 'play' && ai.mode !== 'flee' && rel > SHOT.minRel && rel < 70 && !(e.emp > 0);
  e.charge = canFire && ai.fireT < SHOT.charge ? 1 - ai.fireT / SHOT.charge : 0;
  aimTurret(e, dt);
  if (ai.fireT <= 0) { if (canFire) fireShot(e); ai.fireT = e.kind === 'truck' ? rand(3.5, 5.5) : rand(2.6, 4.6); }
  ai.lane = clamp(ai.lane, -HW + e.W / 2 + 0.2, HW - e.W / 2 - 0.2);
  // longitudinal: hold a spot relative to the wagon
  const heavy = e.kind === 'truck';
  const wantVs = player.vs + clamp((ai.rel - rel) * (heavy ? 0.8 : 1.3), -9, ai.mode === 'flee' ? 14 : 9);
  e.vs += clamp(wantVs - e.vs, -1, 1) * (heavy ? 9 : 16) * dt;
  // lateral: steer toward the chosen line; a ram is a hard swing
  const latMax = ai.mode === 'ram' ? (heavy ? 7 : 9.5) : (heavy ? 4 : 6.5);
  const wantVu = clamp((ai.lane - e.u) * 2.4, -latMax, latMax);
  e.vu += clamp(wantVu - e.vu, -1, 1) * (heavy ? 14 : 26) * dt;
  // don't drive into each other on purpose
  for (const o of enemies) {
    if (o === e || !o.active || !o.alive) continue;
    const ds = o.s - e.s, ou = o.u - e.u;
    if (Math.abs(ds) < (e.L + o.L) / 2 + 2 && Math.abs(ou) < (e.W + o.W) / 2 + 0.8) e.vu -= Math.sign(ou || 1) * 10 * dt;
  }
  if (ai.mode === 'flee' && rel > 70) retire(e);
  // nobody drives past a junction the wagon hasn't chosen yet
  if (path.junction && e.s > path.junction.s - 6) retire(e);
  if (rel < -70 || rel > 110) retire(e);
}

function retire(e) { e.active = false; e.group.visible = false; }

// ── Collisions in street space ───────────────────────────────────────────────
const _n = new THREE.Vector3(), _T = new THREE.Vector3(), _R = new THREE.Vector3(), _p = new THREE.Vector3();

function contactPoint(a, b, out) {
  return pointAt((a.s + b.s) / 2, (a.u + b.u) / 2, out).setY(0.9);
}

function collide(a, b, dt) {
  const ds = b.s - a.s, du = b.u - a.u;
  const os = (a.L + b.L) / 2 - Math.abs(ds), ou = (a.W + b.W) / 2 - Math.abs(du);
  if (os <= 0 || ou <= 0) return;
  const ia = 1 / a.mass, ib = 1 / b.mass, sum = ia + ib;
  if (ou < os * 0.9) {
    // side to side
    const n = Math.sign(du) || 1;
    a.u -= n * ou * ia / sum; b.u += n * ou * ib / sum;
    const vc = (a.vu - b.vu) * n;
    if (vc > 0) {
      const j = (1.35 * vc) / sum;
      a.vu -= n * j * ia; b.vu += n * j * ib;
    }
    onSideHit(a, b, n, Math.max(0, vc), dt);
  } else {
    // nose to tail
    const n = Math.sign(ds) || 1; // +1: b is ahead of a
    a.s -= n * os * ia / sum; b.s += n * os * ib / sum;
    const vc = (a.vs - b.vs) * n;
    if (vc > 0) {
      const j = (1.2 * vc) / sum;
      a.vs -= n * j * ia; b.vs += n * j * ib;
    }
    onRearHit(a, b, n, Math.max(0, vc));
  }
}

function onSideHit(a, b, n, vc, dt) {
  const isP = a === player || b === player;
  if (!isP) {
    // enemy into enemy: only counts if one of them was sent flying by the wagon
    if (vc > 7) {
      contactPoint(a, b, _p);
      hitEnemy(a, vc * 3, _p, null, 'PILE-UP!'); hitEnemy(b, vc * 3, _p, null, 'PILE-UP!');
    }
    return;
  }
  const e = a === player ? b : a;
  const toE = a === player ? n : -n;            // direction from wagon to enemy
  const pPush = player.vu * toE, ePush = -e.vu * toE;
  contactPoint(player, e, _p);
  if (vc > 1.5) {
    if (pPush >= ePush * 0.7) {
      hitEnemy(e, (RAM.base + vc * RAM.perSpeed) * (gadgetOn('nitro') ? NITRO.ram : 1), _p, toE, gadgetOn('nitro') ? 'NITRO RAM!' : undefined);
      G.shake = Math.max(G.shake, Math.min(0.22, vc * 0.015));
      e.ai.mode = 'cruise'; e.ai.t = rand(0.8, 1.6);
    } else {
      knocked(vc);
    }
  }
  // grinding: holding the lean into a car keeps tearing it up
  if (G.leanNow * toE > 0.3 && e.alive) {
    player.rollPush = toE * 0.08;   // shoving a car leans the body over
    e.hp -= RAM.grindDps * dt; e.flash = Math.max(e.flash, 0.35);
    G.grindT = (G.grindT || 0) - dt;
    if (G.grindT <= 0) { G.grindT = 0.07; fx.sparks(_p, _n.set(0, 0, 0), 4, 0.6); audio.scrape(); }
    if (e.hp <= 0) wreckEnemy(e, toE, 'GRINDED!');
  }
}

function onRearHit(a, b, n, vc) {
  const isP = a === player || b === player;
  if (!isP) return;
  const e = a === player ? b : a;
  const wagonBehind = (a === player && n > 0) || (b === player && n < 0);
  contactPoint(player, e, _p);
  if (wagonBehind && vc > 1) {
    hitEnemy(e, (RAM.base + vc * RAM.rearPerSpeed) * (gadgetOn('nitro') ? NITRO.ram : 1), _p, 0, gadgetOn('nitro') ? 'NITRO RAM!' : undefined);
    G.shake = Math.max(G.shake, 0.12);
  } else if (!wagonBehind && vc > 2) knocked(vc * 0.7);
}

function knocked(vc) {
  if (G.knockT > 0 || gadgetOn('shield') || gadgetOn('nitro')) return;
  G.knockT = 0.6;
  player.vs = Math.max(SPEED.start * 0.7, player.vs - vc * 0.8);
  player.flash = 0.6; player.bounce = 0.5;
  G.shake = Math.max(G.shake, 0.3);
  if (G.combo > 1 && vc > 4) { G.combo = 1; G.comboT = 0; }
  audio.thud();
  popupAt(player.group.position, 'OOF!', 'bad');
  hurt(Math.round(3 + vc * 0.3));
}

function hitEnemy(e, dmg, point, dir, label) {
  if (!e.alive) return;
  e.hp -= dmg; e.flash = 1; e.bounce = 0.6;
  fx.sparks(point, _n.set(0, 0, 0), Math.min(30, 8 + dmg * 0.6), 1 + dmg / 40);
  audio.crunch(dmg / 25);
  if (e.hp <= 0) wreckEnemy(e, dir ?? 0, label);
  else if (dmg > 12) popupAt(point, `-${Math.round(dmg)}`, '');
}

function wreckEnemy(e, dir, label = 'WRECKED!', big = false) {
  if (!e.alive) return;
  const side = typeof dir === 'number' && dir !== 0 ? dir : (e.u > player.u ? 1 : -1);
  e.startWreck({ u: side * (big ? 14 : 8), up: big ? 17 : 9 + Math.random() * 3, spin: big ? 16 : 9 });
  frameAt(e.s, _T, _R);
  const v = _n.copy(_T).multiplyScalar(e.vs * 0.6);
  _p.copy(e.group.position).setY(1);
  fx.explode(_p, v, e.k.tint);
  audio.boom();
  if (big) G.hitStop = Math.max(G.hitStop, 0.05);
  G.shake = Math.max(G.shake, big ? 0.45 : 0.25);
  flash(big ? 0.25 : 0.12);
  // combo: wrecks inside the window stack the multiplier
  G.combo = G.comboT > 0 ? G.combo + 1 : 1;
  G.comboT = COMBO_WINDOW;
  G.bestCombo = Math.max(G.bestCombo, G.combo);
  const pts = e.k.score * G.combo;
  G.score += pts; G.wrecks++;
  G.hp = Math.min(SHELL_MAX, G.hp + 4);
  popupAt(_p, `${label} +${pts}`, 'big');
  if (G.combo >= 2) popupAt(_p.clone().setY(4), `x${G.combo} COMBO`, '');
  if (!G.cleared && G.wrecks >= MISSION.target) { G.cleared = true; banner('TARGET SMASHED!'); }
}

// The wagon may drive up onto the sidewalks, to just short of the building fronts; Foot cars
// stay on the road. Pressing into the buildings scrapes: sparks and concrete dust at the
// contact point, a scrape sound, and some lost speed.
const WALK_GAP = 0.45;
const SCRAPE_HOT = new THREE.Color(3, 2.2, 1.1), SCRAPE_WARM = new THREE.Color(2.6, 1.2, 0.3), _v3s = new THREE.Vector3();   // how close the wagon's side gets to the building line
function scrape(c, side, dt) {
  G.scrapeT = (G.scrapeT || 0) - dt;
  if (G.scrapeT > 0) return;
  G.scrapeT = 0.02; G.scrapes = (G.scrapes || 0) + 1;
  // from the rear corner on the wall side: the chase camera sits behind and inboard of the
  // wagon, so anything in the gap along its flank is hidden by the van itself
  const along = -c.L / 2 + Math.random() * c.L * 0.35;
  // just outside the van's flank, in the gap before the wall (inside the body they were hidden)
  pointAt(c.s + along, c.u + side * (c.W / 2 + 0.15), _p).setY(0.5 + Math.random() * 1.5);
  frameAt(c.s, _T, _R);
  // sparks carry the wagon's speed, minus a little, so they stream back along its flank on screen
  _n.copy(_T).multiplyScalar(c.vs - (6 + Math.random() * 10)).addScaledVector(_R, -side * (1 + Math.random() * 3)); _n.y = 2 + Math.random() * 4;
  for (let k = 0; k < 5; k++) fx.add.emit(_p, _v3s.copy(_n).multiplyScalar(0.7 + Math.random() * 0.6), Math.random() < 0.5 ? SCRAPE_HOT : SCRAPE_WARM, 0.3 + Math.random() * 0.25, 0.35 + Math.random() * 0.3, { drag: 1.2, grav: 12 });
  if (Math.random() < 0.35) fx.alpha.emit(_p.setY(0.6 + Math.random()), _n.copy(_T).multiplyScalar(c.vs - 3).setY(0.8), new THREE.Color(0x8c8478), 0.6, 0.6, { grow: 2.2, drag: 2, alpha: 0.3 });
  if (Math.random() < 0.3) audio.scrape();
}
function walls(c, dt) {
  const isP = c === player;
  const lim = isP ? FAC - c.W / 2 - WALK_GAP : HW - c.W / 2 - 0.1;
  if (isP) {
    // up and over the curb: lift the body by the curb height across the car's width, bump on the edge
    const over = clamp((Math.abs(c.u) - (HW - c.W / 2)) / c.W, 0, 1);
    if ((over > 0.5) !== !!c.onWalk) { c.onWalk = over > 0.5; c.bounce = Math.max(c.bounce, 0.35); fx.dust(pointAt(c.s - c.L / 2, Math.sign(c.u) * HW, _p).setY(0.2)); }
    c.curbLift = over * 0.16;
  }
  if (Math.abs(c.u) < lim - 0.05) return;
  const side = Math.sign(c.u);
  if (isP && G.leanNow * side > 0.2) { scrape(c, side, dt); c.vs = Math.max(SPEED.start * 0.8, c.vs - dt * 6); }
  if (Math.abs(c.u) <= lim) return;
  c.u = side * lim;
  const into = c.vu * side;
  if (into > 0) {
    if (c !== player && into > 5 && c.alive) {
      pointAt(c.s, side * HW, _p).setY(0.6);
      hitEnemy(c, into * RAM.wallPerSpeed, _p, -side, 'WALLED!');
      if (c.alive) popupAt(_p, 'WALLED!', 'wall');
    } else if (c === player && into > 3) {
      pointAt(c.s, side * HW, _p).setY(0.6);
      fx.sparks(_p, _n.set(0, 0, 0), 6, 0.6);
    }
    c.vu = -c.vu * 0.3;
  }
}

// ── Turtle pickups ───────────────────────────────────────────────────────────
// One orb per brother. Holding one, it fires itself the moment its trick would land —
// the board only leans, so there is no button.
const TURTLES = {
  raph: { name: 'RAPH', color: 0xff3b2e, hdr: [4, 0.6, 0.4] },
  leo: { name: 'LEO', color: 0x3b8bff, hdr: [0.5, 1.5, 4.5] },
  mike: { name: 'MIKEY', color: 0xff9a1e, hdr: [4.5, 1.9, 0.3] },
  donnie: { name: 'DONNIE', color: 0xa45cff, hdr: [2.6, 0.9, 4.5] },
  saws: { name: 'SAWS', color: 0xffa21e, hdr: [4.2, 2.4, 0.6] },
  shield: { name: 'SHIELD', color: 0x4fb6ff, hdr: [0.8, 2.4, 4.4] },
  nitro: { name: 'NITRO', color: 0x3f8cff, hdr: [0.6, 1.6, 4.6] },
  harpoon: { name: 'HARPOON', color: 0x2fd6b4, hdr: [0.5, 3.6, 2.8] },
};
const orbGeo = new THREE.IcosahedronGeometry(0.9, 1);
const orbMats = Object.fromEntries(Object.entries(TURTLES).map(([k, t]) => [k, new THREE.MeshBasicMaterial({ color: new THREE.Color(...t.hdr) })]));
const haloMats = Object.fromEntries(Object.entries(TURTLES).map(([k, t]) => [k, new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })]));
let lastOrb = 'raph';
function spawnOrb() {
  const J = path.junction;
  const s = J ? Math.min(player.s + 140, J.s - 20) : player.s + 140, u = LANES[Math.floor(Math.random() * LANES.length)];
  if (s < player.s + 40) return;
  const kinds = Object.keys(TURTLES).filter((k) => k !== lastOrb);
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  lastOrb = kind;
  const mesh = new THREE.Group();
  const core = iconOnly(new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex[kind], transparent: true })));
  core.scale.setScalar(2.6); mesh.add(core);
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 12), haloMats[kind]));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.9, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -1.45; mesh.add(ring);
  pointAt(s, u, mesh.position).setY(1.6);
  stage.add(mesh);
  orbs.push({ s, u, mesh, core, kind });
}

function updateOrbs(dt) {
  G.orbT -= dt;
  if (G.orbT <= 0 && !G.power && !G.strike && orbs.length < 1) { spawnOrb(); G.orbT = ORB_EVERY; }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.core.scale.setScalar(2.6 + Math.sin(G.time * 6) * 0.15);
    o.mesh.position.y = 1.6 + Math.sin(G.time * 4) * 0.25;
    if (Math.abs(o.s - player.s) < 3 && Math.abs(o.u - player.u) < 2.6) {
      G.orbsTaken = (G.orbsTaken || 0) + 1;
      fx.pickupBurst(o.mesh.position, TURTLES[o.kind].color);
      audio.pickup();
      if (GADGETS[o.kind]) startGadget(o.kind);
      else if (BUFFS[o.kind]) startBuff(o.kind);
      else { G.power = o.kind; G.powerAt = G.time; popupAt(o.mesh.position, `${TURTLES[o.kind].name} READY!`, 'big'); }
      stage.remove(o.mesh); orbs.splice(i, 1);
    } else if (o.s < player.s - 20) { stage.remove(o.mesh); orbs.splice(i, 1); G.orbT = 3; }
  }
}

const liveFoot = () => enemies.filter((e) => e.active && e.alive);
// Leo is the one instant power: held until it's worth it — 2+ Foot cars in reach (or one, if
// he's been waiting 6 s) — then he leaps to the toughest car first and chains through up to 3.
function tryPower() {
  if (!G.power || G.strike) return;
  if (G.power !== 'leo') { G.power = null; return; }
  const rel = (e) => e.s - player.s;
  const reach = liveFoot().filter((e) => rel(e) > -4 && rel(e) < 60).sort((a, b) => b.hp - a.hp);
  const waited = G.time - (G.powerAt || 0) > 6;
  if (reach.length < 2 && !(waited && reach.length)) return;
  const hops = reach.slice(0, 3);
  G.strikes = (G.strikes || 0) + 1;
  G.strike = { t: 0, total: 0, hops, i: 0, ts: hops[0].s, tu: hops[0].u, from: player.group.position.clone().setY(player.H + 0.2), side: hops[0].u >= player.u ? 1 : -1, back: false };
  leo.holder.visible = true;
  leo.flip.reset(); leo.flip.time = 1.45; leo.flip.timeScale = 1.25; leo.flip.play();
  $('popups').replaceChildren();
  banner('LEO!', 'leo');
  audio.raph();
  G.powersUsed = (G.powersUsed || 0) + 1;
  G.power = null;
}

// expanding shockwaves (Leo forward crescent, Mikey ring), hitting each car once as they pass
const waves = [];
function makeWave(kind, color, r0, r1, dmg, label, push) {
  const geo = kind === 'fwd' ? new THREE.RingGeometry(0.86, 1, 48, 1, Math.PI * 0.18, Math.PI * 0.64) : new THREE.RingGeometry(0.8, 1, 64);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.rotation.order = 'YXZ';
  stage.add(mesh);
  return { kind, mesh, r: r0, r1, dmg, label, push, hit: new Set(), color, s: player.s, u: player.u };
}
function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.r += dt * (w.kind === 'fwd' ? 95 : 55);
    w.s += player.vs * dt;
    pointAt(w.s, w.u, w.mesh.position).setY(w.kind === 'fwd' ? 1.4 : 0.8);
    w.mesh.rotation.set(-Math.PI / 2, yawAt(w.s), 0);
    w.mesh.scale.setScalar(w.r);
    w.mesh.material.opacity = clamp(1 - w.r / w.r1, 0, 1) + 0.15;
    for (const e of liveFoot()) {
      if (w.hit.has(e)) continue;
      const ds = e.s - w.s, du = e.u - w.u, dist = Math.hypot(ds, du);
      const inArc = w.kind === 'ring' || (ds > 0 && Math.abs(du) < ds * 1.6 + 4);
      if (inArc && dist < w.r) {
        w.hit.add(e);
        _p.copy(e.group.position).setY(1);
        if (w.push) e.vu += Math.sign(du || 1) * w.push;
        if (w.emp) e.emp = Math.max(e.emp || 0, w.emp);
        else fx.sparks(_p, _n.set(0, 0, 0), 24, 1.4);
        hitEnemy(e, w.dmg, _p, Math.sign(du || 1), w.label);
      }
    }
    if (w.r >= w.r1) { stage.remove(w.mesh); w.mesh.geometry.dispose(); waves.splice(i, 1); }
  }
}

// ── Timed powers: Mikey's pizza cannon, Donnie's electro field ────────────────
// These switch on the moment they're picked up and run for a few seconds, with the turtle's
// head and a draining ring on screen and on the wagon's back doors (the TDCars2 CombatBuffHUD /
// rear-icon pattern).
const BUFFS = { raph: { name: 'SAI STORM', dur: 8 }, mike: { name: 'PIZZA CANNON', dur: 8 }, donnie: { name: 'EMP PULSE', dur: 7 } };
// the gadget slot: van add-ons that run alongside a turtle's power, not instead of it
const GADGETS = { saws: { name: 'SAW BLADES', dur: 8 }, shield: { name: 'RIOT SHIELD', dur: 8 }, nitro: { name: 'NITRO', dur: 5 }, harpoon: { name: 'HARPOON', dur: 9 } };
const BUFF_RING = { raph: new THREE.Color(1, 0.12, 0.08), mike: new THREE.Color(1, 0.42, 0.05), donnie: new THREE.Color(0.48, 0.24, 1), saws: new THREE.Color(1, 0.62, 0.1), shield: new THREE.Color(0.3, 0.7, 1), nitro: new THREE.Color(0.25, 0.55, 1), harpoon: new THREE.Color(0.2, 0.85, 0.7) };   // drawn unlit to the screen, so 0..1
const FIELD_R = 12;
const EMP_R = 26, EMP_T = 3.5;   // pulse reach (m) and how long a hit car can't shoot (s)
const bolts = [];   // pizzas in flight
const zaps = [];    // lightning arcs, a frame or two each
let buffIcon = null, gadgetIcon = null;
function pizzaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c97a2a'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffd34a'; x.beginPath(); x.arc(64, 64, 50, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#d8281c';
  for (const [a, r] of [[0.3, 28], [1.6, 30], [2.9, 26], [4.2, 30], [5.4, 24], [0, 0]]) { x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 9, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let pizzaMat = null, pizzaGeo = null, zapMat = null;
function buildBuffProps() {
  // his head above the tail while it runs
  // on the back doors: the turtle's head inside a ring that drains with the time left
  buffIcon = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: headTex.mike }, uP: { value: 0 }, uCol: { value: new THREE.Color() }, uOn: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float uP; uniform vec3 uCol; uniform float uOn; varying vec2 vUv;
void main(){
  vec2 d = vUv - 0.5; float r = length(d);
  vec4 c = vec4(0.0);
  if (r < 0.37) { c = uOn > 0.5 ? texture2D(map, (d / 0.74) + 0.5) : vec4(0.02, 0.02, 0.03, smoothstep(0.37, 0.355, r)); }
  else if (r < 0.49) {
    float a = fract(atan(d.x, d.y) / 6.2831853 + 1.0);
    float on = step(a, uP);
    c = vec4(mix(vec3(0.03, 0.03, 0.05), uCol, on), 0.9);   // idle: the same dark track as the drained part
    c.a *= smoothstep(0.49, 0.475, r) * smoothstep(0.37, 0.385, r);
  }
  gl_FragColor = linearToOutputTexel(c);
}`,
  }));
  buffIcon.position.set(0, player.H * 0.46, player.L / 2 + 0.06);
  iconOnly(buffIcon);   // always on the doors: empty until a power is running
  player.body.add(buffIcon);
  gadgetIcon = buffIcon.clone(); gadgetIcon.material = buffIcon.material.clone();
  iconOnly(gadgetIcon); gadgetIcon.visible = false; player.body.add(gadgetIcon);
  buildSaws(); buildShield(); buildNitro(); buildHarpoon();
  pizzaMat = new THREE.MeshBasicMaterial({ map: pizzaTexture(), color: new THREE.Color(1.5, 1.4, 1.3) });
  pizzaGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.14, 18);
  zapMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.6, 1.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

function startBuff(kind) {
  const b = BUFFS[kind];
  G.buff = { kind, t: b.dur, dur: b.dur, fireT: 0.15 };

  if (kind === 'raph') { raphTop.cur = -1; raphTop.next = 0; raphTop.ride.reset().play(); }
  buffIcon.material.uniforms.map.value = headTex[kind];
  buffIcon.material.uniforms.uCol.value.copy(BUFF_RING[kind]);
  buffIcon.material.uniforms.uOn.value = 1;
  banner({ raph: 'SAI STORM!', mike: 'PIZZA TIME!', donnie: 'EMP PULSE!' }[kind], kind);
  audio.raph();
  G.powersUsed = (G.powersUsed || 0) + 1;
}
// ── Gadget slot ─────────────────────────────────────────────────────────────
function startGadget(kind) {
  const d = GADGETS[kind];
  G.gadget = { kind, t: d.dur, dur: d.dur };
  gadgetIcon.material.uniforms.map.value = headTex[kind];
  gadgetIcon.material.uniforms.uCol.value.copy(BUFF_RING[kind]);
  gadgetIcon.material.uniforms.uOn.value = 1;
  banner(d.name + '!', kind);
  audio.raph();
  G.powersUsed = (G.powersUsed || 0) + 1;
}
function endGadget() {
  if (harp.target) releaseHarpoon();
  G.gadget = null;
  if (gadgetIcon) { gadgetIcon.material.uniforms.uOn.value = 0; gadgetIcon.material.uniforms.uP.value = 0; }
}
function updateGadget(dt) {
  const D = G.gadget;
  if (!D) return;
  D.t -= dt;
  gadgetIcon.material.uniforms.uP.value = clamp(D.t / D.dur, 0, 1);
  if (D.kind === 'saws' && saws.ext > 0.97) sawCut(dt);
  if (D.kind === 'nitro') nitroBurn(dt);
  if (D.t <= 0) endGadget();
}
// the back-door roundel splits in two while a gadget runs: turtle left, gadget right
let iconSplit = 0;
function updateIcons(dt) {
  if (!buffIcon) return;
  iconSplit = clamp(iconSplit + (G.gadget ? dt : -dt) * 5, 0, 1);
  const k = iconSplit * iconSplit * (3 - 2 * iconSplit);
  buffIcon.position.x = -0.46 * k; buffIcon.scale.setScalar(1 - 0.24 * k);
  gadgetIcon.visible = k > 0.01;
  gadgetIcon.position.x = 0.46 * k; gadgetIcon.scale.setScalar(Math.max(0.01, 0.76 * k));
}

// SAW BLADES: on each side a steel deck slides out from under the chassis (bolted to the van's
// underside), then the blade swings up from lying flat on it and spins up; the blades cut
// whatever is alongside (SAW.dps) and glow hot while they do. Going away is the same, reversed.
const SAW = { r: 0.85, out: 1.15, y: 0.95, deckY: 0.32, dps: 150, push: 9, spin: 38 };
const saws = { side: [], ext: 0, lastExt: 0, cut: [0, 0], spinV: 0 };
function buildSaws() {
  const teeth = 20, R0 = SAW.r * 0.86, R1 = SAW.r;
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = i / teeth * Math.PI * 2, a1 = (i + 0.62) / teeth * Math.PI * 2;
    if (i === 0) sh.moveTo(Math.cos(a0) * R0, Math.sin(a0) * R0); else sh.lineTo(Math.cos(a0) * R0, Math.sin(a0) * R0);
    sh.lineTo(Math.cos(a1) * R1, Math.sin(a1) * R1);
  }
  sh.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true); sh.holes.push(hole);
  const bladeGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); bladeGeo.translate(0, 0, -0.02);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.35, roughness: 0.35, emissive: 0x2a2d34 });   // full metal went black at night (nothing to reflect)
  const dark = new THREE.MeshStandardMaterial({ color: 0x34373f, metalness: 0.4, roughness: 0.55 });
  const hazard = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 16;
    const x = c.getContext('2d'); x.fillStyle = '#1c1c20'; x.fillRect(0, 0, 128, 16); x.fillStyle = '#e0a21a';
    for (let i = -16; i < 144; i += 16) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 8, 0); x.lineTo(i + 14, 0); x.lineTo(i + 6, 16); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshLambertMaterial({ map: t });
  })();
  const reach = player.W / 2 + SAW.out;
  for (const side of [-1, 1]) {
    const root = new THREE.Group(); root.position.z = 0.2; player.body.add(root);
    // the deck: a plate whose inner end stays bolted under the chassis; it slides out along x
    const deck = new THREE.Group(); deck.position.y = SAW.deckY; root.add(deck);
    const plateGeo = new THREE.BoxGeometry(reach + 0.3, 0.09, 0.95); plateGeo.translate((reach + 0.3) / 2 - 0.3, 0, 0);
    const plate = new THREE.Mesh(plateGeo, dark); plate.scale.x = side; deck.add(plate);
    const edgeGeo = new THREE.BoxGeometry(0.06, 0.12, 0.97); edgeGeo.translate(reach - 0.03, 0, 0);
    const edge = new THREE.Mesh(edgeGeo, hazard); edge.scale.x = side; deck.add(edge);
    for (const z of [-0.36, 0.36]) {   // rails under the van that the deck runs on
      const railGeo = new THREE.BoxGeometry(reach, 0.06, 0.08); railGeo.translate(reach / 2 - 0.4, -0.07, z);
      const rail = new THREE.Mesh(railGeo, dark); rail.scale.x = side; deck.add(rail);
    }
    // the blade mount at the deck's outer end: a pivot that swings the blade up from flat
    const pivot = new THREE.Group(); pivot.position.set(side * (reach - 0.25), 0.05, 0); deck.add(pivot);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.22), dark); post.geometry.translate(0, 0.5, 0); pivot.add(post);
    const head = new THREE.Group(); pivot.add(head);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 12), dark); hub.rotation.z = Math.PI / 2; head.add(hub);
    const tilt = new THREE.Group(); tilt.rotation.y = side * 0.45; head.add(tilt);   // angled so the chase camera sees the blade's face
    const spin = new THREE.Group(); spin.rotation.y = Math.PI / 2; tilt.add(spin);
    const blade = new THREE.Mesh(bladeGeo, steel); blade.castShadow = true; spin.add(blade);
    for (let k = 0; k < 6; k++) {   // slots, so the spin reads
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), dark);
      const a = k / 6 * Math.PI * 2; slot.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0); slot.rotation.z = a; spin.add(slot);
    }
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(SAW.r * 0.93, 0.07, 6, 40), rimMat));
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.visible = false;
    saws.side.push({ s: side, root, deck, pivot, post, head, spin, rimMat });
  }
}
const SAW_HOT = new THREE.Color(3.2, 1.7, 0.5), SAW_WHITE = new THREE.Color(3, 2.6, 1.8);
function sawSparks(at, side, n = 4) {
  frameAt(player.s, _T, _R);
  for (let k = 0; k < n; k++) {
    _n.copy(_T).multiplyScalar(player.vs - (6 + Math.random() * 12)).addScaledVector(_R, side * (1 + Math.random() * 4)); _n.y = 2 + Math.random() * 6;
    fx.add.emit(at, _n, k % 2 ? SAW_HOT : SAW_WHITE, 0.25 + Math.random() * 0.25, 0.3 + Math.random() * 0.3, { drag: 1.2, grav: 14 });
  }
}
// deploy: 0..0.45 the deck slides out, 0.45..0.85 the blade swings up, 0.85..1 it locks and spins
// up (spark burst on lock). Retract runs the same timeline backwards.
const SAW_TIME = 0.75;
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const backOut = (x) => { x = clamp(x, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function updateSaws(dt) {
  if (!saws.side.length) return;
  const on = !!(G.gadget && G.gadget.kind === 'saws');
  saws.lastExt = saws.ext;
  saws.ext = clamp(saws.ext + (on ? dt : -dt) / SAW_TIME, 0, 1);
  const x = saws.ext;
  const slide = ease(x / 0.45), swing = backOut((x - 0.45) / 0.4), lock = ease((x - 0.85) / 0.15);
  saws.spinV += ((on ? SAW.spin * lock : 0) - saws.spinV) * Math.min(1, dt * (on ? 5 : 2));
  const reach = player.W / 2 + SAW.out;
  for (let i = 0; i < 2; i++) {
    const S = saws.side[i];
    S.root.visible = x > 0.001;
    // from fully under the chassis to fully out
    S.deck.position.x = -S.s * (1 - slide) * (reach - 0.35);
    // the blade lies flat on the deck, then swings up past vertical and settles (backOut)
    S.pivot.rotation.z = -S.s * (1 - swing) * Math.PI / 2;
    S.post.scale.y = Math.max(0.01, SAW.y - SAW.deckY - 0.05);
    S.head.position.y = SAW.y - SAW.deckY - 0.05;
    S.spin.rotation.z -= dt * saws.spinV * S.s;
    saws.cut[i] = Math.max(0, saws.cut[i] - dt);
    const h = Math.min(1, saws.cut[i] * 4);
    S.rimMat.color.setRGB(2.6 * h + 0.3 * lock, 1.1 * h + 0.14 * lock, 0.25 * h);
  }
  // sparks from under the van while the decks run on their rails, a burst as the blades lock
  if (x > 0 && x < 0.45 && x !== saws.lastExt && Math.random() < dt * 40)
    for (const S of saws.side) { pointAt(player.s, player.u + S.s * player.W * 0.45, _p).setY(0.25); sawSparks(_p, S.s, 2); }
  if (saws.lastExt < 0.85 && x >= 0.85) {
    for (const S of saws.side) { pointAt(player.s, player.u + S.s * reach, _p).setY(SAW.y); sawSparks(_p, S.s, 14); }
    audio.scrape(); G.shake = Math.max(G.shake, 0.12);
  }
}
// side-swipe and grind: anything alongside inside the blades' reach is cut hard
function sawCut(dt) {
  const reach = player.W / 2 + SAW.out + SAW.r * 0.6;
  for (const e of liveFoot()) {
    const ds = e.s - player.s, du = e.u - player.u;
    if (Math.abs(ds) > e.L / 2 + SAW.r || Math.abs(du) > reach + e.W / 2 || Math.abs(du) < 0.5) continue;
    const side = Math.sign(du);
    e.hp -= SAW.dps * dt; e.flash = Math.max(e.flash, 0.6);
    e.vu += side * SAW.push * dt;
    saws.cut[side > 0 ? 1 : 0] = 0.25;
    if (Math.random() < dt * 40) {
      pointAt(player.s + clamp(ds, -SAW.r, SAW.r), player.u + side * (player.W / 2 + SAW.out), _p).setY(SAW.y);
      sawSparks(_p, side);
    }
    if (Math.random() < dt * 6) audio.scrape();
    if (e.hp <= 0) wreckEnemy(e, side, 'SAWED!');
  }
  // dragged along the buildings: a shower of sparks off that blade
  const wallSide = Math.sign(player.u);
  if (Math.abs(player.u) > FAC - player.W / 2 - WALK_GAP - 0.1 && Math.random() < dt * 50) {
    pointAt(player.s, player.u + wallSide * (player.W / 2 + SAW.out), _p).setY(SAW.y);
    sawSparks(_p, wallSide); saws.cut[wallSide > 0 ? 1 : 0] = 0.25;
  }
}

const gadgetOn = (k) => !!(G.gadget && G.gadget.kind === k);

// RIOT SHIELD: eight armour plates rise out of the road around the van, one after another;
// while they're up the wagon takes no damage and Foot shells bounce back at whoever fired.
const shield = { plates: [], ext: 0, glow: null };
function buildShield() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a7488, metalness: 0.5, roughness: 0.4, emissive: 0x0c1c34 });
  shield.glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const ax = player.W / 2 + 0.45, az = player.L / 2 + 0.5;
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * Math.PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * ax, 0, Math.cos(a) * az);
    g.rotation.y = a;
    const tilt = new THREE.Group(); tilt.rotation.x = -0.22; g.add(tilt);   // leaning in at the top
    // a low armour skirt (tall slabs hid the whole van from the chase camera), glowing top edge
    const plate = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 1.5 : 1.9, 1.2, 0.1), steel); plate.position.y = 0.6; tilt.add(plate);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 1.5 : 1.9, 0.12, 0.14), shield.glow); edge.position.y = 1.24; tilt.add(edge);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.14), steel); rib.position.set(0, 0.6, 0.04); tilt.add(rib);
    g.traverse((o) => { if (o.isMesh && o.material === steel) o.castShadow = true; });
    g.visible = false;
    player.group.add(g);   // on the group, not the rolling body: the plates stand on the road
    shield.plates.push(g);
  }
}
function updateShield(dt) {
  if (!shield.plates.length) return;
  const on = gadgetOn('shield');
  shield.ext = clamp(shield.ext + (on ? dt : -dt) * 2.2, 0, 1);
  shield.plates.forEach((g, i) => {
    const k = backOut((shield.ext * 1.6 - i * 0.075));   // one after another, each overshooting a touch
    g.visible = shield.ext > 0.001 && k > 0.001;
    g.position.y = -1.9 * (1 - k);
  });
  shield.flash = Math.max(0, (shield.flash || 0) - dt * 4);
  const f = 0.6 + Math.sin(G.time * 6) * 0.15 + shield.flash * 2;
  shield.glow.color.setRGB(0.3 * f, 0.9 * f, 2.2 * f);
}
// a Foot shell meets the shield: it turns round and flies back at the car that fired it
function bounceShot(b) {
  const tgt = b.from && b.from.alive && b.from.active ? b.from : liveFoot().sort((x, y) => Math.abs(x.s - player.s) - Math.abs(y.s - player.s))[0];
  shield.flash = 1;
  fx.add.emit(b.m.position, _n.set(0, 0, 0), new THREE.Color(0.8, 1.8, 3.2), 2.2, 0.12, { grow: 1 });
  fx.sparks(b.m.position, _n.set(0, 0, 0), 10, 0.8);
  audio.scrape();
  if (!tgt) { stage.remove(b.m); return; }
  G.bounced = (G.bounced || 0) + 1;
  bolts.push({ m: b.m, v: new THREE.Vector3(), target: tgt, t: 0, dmg: 45, splash: 10, label: 'BOUNCED!', trail: 0x6fc8ff, spin: 'sai', straight: true });
}

// NITRO: two exhaust pipes slide out of the back with blue flames; the wagon surges, its rams
// hit NITRO.ram times as hard, shunts can't knock it back, and the flames torch anything close behind.
const NITRO = { boost: 16, ram: 3, burnDps: 70 };
const nitro = { ext: 0, pipes: [], flames: [], flameMat: null };
function buildNitro() {
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd6, metalness: 0.7, roughness: 0.25, emissive: 0x202228 });
  nitro.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.4, 3.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.8, 3.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const x of [-0.55, 0.55]) {
    const g = new THREE.Group(); g.position.set(x, 0.42, player.L / 2 - 0.3); player.body.add(g);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.9, 12), chrome); pipe.rotation.x = Math.PI / 2; pipe.position.z = 0.15; g.add(pipe);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 14), chrome); lip.position.z = 0.6; g.add(lip);
    const flame = new THREE.Group(); flame.position.z = 0.62; g.add(flame);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 12, 1, true), nitro.flameMat); outer.rotation.x = Math.PI / 2; outer.position.z = 0.8; flame.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 10, 1, true), core); inner.rotation.x = Math.PI / 2; inner.position.z = 0.4; flame.add(inner);
    g.visible = false;
    nitro.pipes.push(g); nitro.flames.push(flame);
  }
}
function updateNitro(dt) {
  if (!nitro.pipes.length) return;
  const on = gadgetOn('nitro');
  nitro.ext = clamp(nitro.ext + (on ? dt * 3 : -dt * 1.5), 0, 1);
  const out = ease(nitro.ext * 2), fire = ease(nitro.ext * 2 - 1);
  nitro.pipes.forEach((g, i) => {
    g.visible = nitro.ext > 0.001;
    g.position.z = player.L / 2 - 0.75 + out * 0.45;
    const fl = nitro.flames[i];
    fl.visible = fire > 0.02;
    fl.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, fire * (0.75 + Math.random() * 0.5));
    if (fire > 0.3 && Math.random() < dt * 60) {
      fl.getWorldPosition(_p);
      frameAt(player.s, _T, _R);
      fx.add.emit(_p, _n.copy(_T).multiplyScalar(player.vs - 25 - Math.random() * 10).add(_v3s.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)),
        Math.random() < 0.5 ? new THREE.Color(0.6, 1.3, 3.4) : new THREE.Color(2, 2.4, 3.4), 0.3 + Math.random() * 0.3, 0.18, { grow: -0.5, drag: 2 });
    }
  });
  if (on && fire > 0.5) G.shake = Math.max(G.shake, 0.05);
}
// the flames torch anything close behind the van
function nitroBurn(dt) {
  if (nitro.ext < 0.6) return;
  for (const e of liveFoot()) {
    const ds = e.s - player.s, du = e.u - player.u;
    if (ds > -player.L / 2 || ds < -player.L / 2 - 4 - e.L / 2 || Math.abs(du) > 2.4) continue;
    e.hp -= NITRO.burnDps * dt; e.flash = Math.max(e.flash, 0.5);
    if (Math.random() < dt * 20) fx.fire(_p.copy(e.group.position).setY(1.2));
    if (e.hp <= 0) wreckEnemy(e, Math.sign(du) || 1, 'TORCHED!');
  }
}

// HARPOON: a launcher rises on the front of the roof, fires a harpoon at a Foot car ahead and
// reels it onto a cable. The hooked car swings like a pendulum behind the van's lateral moves —
// lean and it flails into other cars and the buildings. When it wrecks the harpoon re-fires.
const HARP = { range: 45, speed: 80, rope: 7.5, k: 5, damp: 1.4, fling: 2.6, dps: 10, hit: 32, slam: 30 };
const harp = { ext: 0, mode: 'idle', target: null, t: 0, theta: 0, omega: 0, len: 0, cool: 0 };
function buildHarpoon() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.5, roughness: 0.5 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x23a88e, metalness: 0.3, roughness: 0.5, emissive: 0x05221c });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.6, roughness: 0.3, emissive: 0x22252a });
  const mount = new THREE.Group(); mount.position.set(0.55, models.wagon.roofY - 0.05, -player.L * 0.32); player.body.add(mount);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.16, 12), dark); base.position.y = 0.08; mount.add(base);
  const yaw = new THREE.Group(); yaw.position.y = 0.2; mount.add(yaw);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.6), teal); body.position.y = 0.15; yaw.add(body);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 10), dark); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.2, -0.45); yaw.add(tube);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 14), steel); reel.rotation.z = Math.PI / 2; reel.position.set(0, 0.18, 0.22); yaw.add(reel);
  const tip = new THREE.Object3D(); tip.position.set(0, 0.2, -0.95); yaw.add(tip);
  // the harpoon itself (flies, then sits in the hooked car) and its cable
  const head = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), steel); shaft.rotation.x = Math.PI / 2; head.add(shaft);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), steel); point.rotation.x = -Math.PI / 2; point.position.z = -0.55; head.add(point);
  head.visible = false; stage.add(head);
  const cableGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6); cableGeo.translate(0, 0.5, 0); cableGeo.rotateX(Math.PI / 2);
  const cable = new THREE.Mesh(cableGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 1.3) }));
  cable.visible = false; cable.frustumCulled = false; stage.add(cable);
  mount.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  mount.visible = false;
  Object.assign(harp, { mount, yaw, tip, head, cable, reel });
}
function releaseHarpoon() {
  const e = harp.target;
  if (e) { e.tether = false; if (e.ai) { e.ai.mode = 'cruise'; e.ai.t = 1; } }
  harp.target = null; harp.mode = 'idle'; harp.head.visible = false; harp.cable.visible = false; harp.cool = 0.35;
}
const _hA = new THREE.Vector3(), _hB = new THREE.Vector3();
function updateHarpoon(dt) {
  if (!harp.mount) return;
  const on = gadgetOn('harpoon');
  harp.ext = clamp(harp.ext + (on ? dt : -dt) * 3, 0, 1);
  harp.mount.visible = harp.ext > 0.001;
  harp.mount.scale.setScalar(Math.max(0.01, backOut(harp.ext)));
  if (!on && harp.target) releaseHarpoon();
  harp.cool = Math.max(0, harp.cool - dt);
  if (harp.target && (!harp.target.alive || !harp.target.active)) releaseHarpoon();
  // aim: at the hooked car, or the next one in range
  let aim = harp.target;
  if (!aim && on) aim = liveFoot().filter((e) => e.s - player.s > 4 && e.s - player.s < HARP.range).sort((a, b) => (a.s - player.s) - (b.s - player.s))[0];
  if (aim) {
    const lp = harp.yaw.parent.worldToLocal(_c.copy(aim.group.position));
    let dy = Math.atan2(-lp.x, -lp.z) - harp.yaw.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    harp.yaw.rotation.y += dy * Math.min(1, dt * 12);
  }
  harp.tip.getWorldPosition(_hA);
  if (harp.mode === 'idle' && on && harp.ext > 0.95 && aim && harp.cool <= 0) {
    harp.mode = 'fly'; harp.target = aim; harp.t = 0;
    harp.head.position.copy(_hA); harp.head.visible = true; harp.cable.visible = true;
    fx.add.emit(_hA, _n.set(0, 0, 0), new THREE.Color(0.6, 2.6, 2.2), 1.2, 0.1, { grow: 0.8 });
    audio.scrape();
  }
  if (harp.mode === 'fly') {
    const e = harp.target;
    _hB.copy(e.group.position).setY(1.2);
    const to = _c.copy(_hB).sub(harp.head.position), d = to.length();
    harp.head.lookAt(_l.copy(harp.head.position).sub(to));
    harp.head.position.addScaledVector(to.normalize(), Math.min(d, (HARP.speed + player.vs) * dt));
    if (d < 0.6) {
      // hooked: the car is taken off its AI and hung on the cable where it is
      harp.mode = 'hold'; e.tether = true;
      const ds = e.s - player.s, du = e.u - player.u;
      harp.len = Math.hypot(ds, du); harp.theta = Math.atan2(du, ds); harp.omega = 0;
      popupAt(_hB, 'HOOKED!', 'big'); fx.sparks(_hB, _n.set(0, 0, 0), 14, 1);
      G.hooks = (G.hooks || 0) + 1;
    }
  }
  if (harp.mode === 'hold') {
    _hB.copy(harp.target.group.position).setY(1.2);
    harp.head.position.copy(_hB);
  }
  if (harp.cable.visible) {
    harp.cable.position.copy(_hA);
    const len = _hA.distanceTo(harp.head.position);
    harp.cable.lookAt(harp.head.position); harp.cable.scale.set(1, 1, len);
  }
  harp.reel.rotation.x += dt * (harp.mode === 'hold' ? 6 : harp.mode === 'fly' ? -25 : 0);
}
// the hooked car on its cable: a pendulum hung ahead of the van that swings opposite to the
// van's sideways motion (lean right, it swings left), reeled in to HARP.rope. It smashes into
// whatever it meets — other Foot cars and the road edge.
function tetherStep(e, dt) {
  harp.len += (HARP.rope - harp.len) * Math.min(1, dt * 2);
  const alpha = -HARP.k * Math.sin(harp.theta) - HARP.damp * harp.omega - (player.vu / harp.len) * HARP.fling;
  harp.omega += alpha * dt;
  harp.theta = clamp(harp.theta + harp.omega * dt, -1.5, 1.5);
  const u0 = e.u;
  e.s = player.s + Math.cos(harp.theta) * harp.len;
  e.u = player.u + Math.sin(harp.theta) * harp.len;
  e.vs = player.vs; e.vu = (e.u - u0) / Math.max(dt, 1e-4);
  e.charge = 0; if (e.turret) e.turret.laser.visible = false;   // a hooked car can't aim
  e.hp -= HARP.dps * dt; e.flash = Math.max(e.flash, 0.2);
  e.flailT = Math.max(0, (e.flailT || 0) - dt);
  if (e.flailT <= 0) {
    for (const o of liveFoot()) {
      if (o === e || Math.abs(o.s - e.s) > (o.L + e.L) / 2 + 0.3 || Math.abs(o.u - e.u) > (o.W + e.W) / 2 + 0.3) continue;
      contactPoint(e, o, _p);
      hitEnemy(o, HARP.hit + Math.abs(e.vu) * 3, _p, Math.sign(o.u - e.u) || 1, 'FLAILED!');
      hitEnemy(e, HARP.hit * 0.5, _p, 0, 'FLAILED!');
      fx.sparks(_p, _n.set(0, 0, 0), 18, 1.2); G.shake = Math.max(G.shake, 0.2);
      e.flailT = 0.35; harp.omega *= -0.4;
      break;
    }
    if (e.flailT <= 0 && Math.abs(e.u) > HW - e.W / 2 - 0.05) {
      pointAt(e.s, Math.sign(e.u) * HW, _p).setY(0.8);
      hitEnemy(e, HARP.slam, _p, -Math.sign(e.u), 'SLAMMED!');
      fx.sparks(_p, _n.set(0, 0, 0), 18, 1.2); G.shake = Math.max(G.shake, 0.2);
      e.flailT = 0.35; harp.omega *= -0.5;
    }
  }
  if (e.hp <= 0) wreckEnemy(e, Math.sign(e.u - player.u) || 1, 'FLAILED!');
}

// the hatch: lid slides open, the turtle rises out of the van; when the power ends he sinks back
// and the lid closes. A new power while someone's up swaps them through the hatch.
const HATCH = { slide: 0.8, sink: 2.4, openRate: 5, riseRate: 3.5 };
const hatchS = { open: 0, rise: 0, who: null };
function resetHatch() {
  Object.assign(hatchS, { open: 0, rise: 0, who: null });
  for (const H of [raphTop, mikeTop, donTop]) if (H) H.holder.visible = false;
  if (raphTop) { raphTop.mixer.stopAllAction(); updateHatch(0); }
}
function updateHatch(dt) {
  if (!raphTop) return;
  const want = G.buff ? { raph: raphTop, mike: mikeTop, donnie: donTop }[G.buff.kind] : null;
  const h = hatchS;
  if (h.who && h.who !== want) {
    h.rise = Math.max(0, h.rise - dt * HATCH.riseRate);
    if (h.rise === 0) { h.who.holder.visible = false; if (h.who === raphTop) raphTop.mixer.stopAllAction(); h.who = null; }
  } else if (!h.who && want) h.who = want;
  const leoOut = !!G.strike;
  if (leoOut && !h.who) h.open = Math.min(1, h.open + dt * HATCH.openRate * 1.6);
  else if (h.who && h.who === want) {
    h.open = Math.min(1, h.open + dt * HATCH.openRate);
    if (h.open > 0.8) h.rise = Math.min(1, h.rise + dt * HATCH.riseRate);
  } else if (!h.who) h.open = Math.max(0, h.open - dt * HATCH.openRate);
  const [a, b] = raphTop.hatch.userData.lid;
  const e = h.open * h.open * (3 - 2 * h.open);
  a.position.x = e * HATCH.slide; b.position.x = -e * HATCH.slide;
  if (h.who) {
    const r = h.rise * h.rise * (3 - 2 * h.rise);
    h.who.holder.visible = h.rise > 0.01;
    h.who.holder.position.y = h.who.baseY - (1 - r) * HATCH.sink;
  }
}
function endBuff() {
  G.buff = null;
  if (buffIcon) { buffIcon.material.uniforms.uOn.value = 0; buffIcon.material.uniforms.uP.value = 0; }
}

// one lightning arc: a jagged cross-shaped ribbon (two strips) so it reads from any angle
function makeZap(a, b, amp = 1, w = 0.2, life = 0.16) {
  const N = 9, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, j = i === 0 || i === N ? 0 : 1;
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(_n.set((Math.random() - 0.5) * 1.4 * j * amp, (Math.random() - 0.5) * 1.2 * j * amp, (Math.random() - 0.5) * 1.4 * j * amp)));
  }
  const pos = [], idx = [];
  for (const [ox, oy] of [[0, w], [w, 0]]) {
    const k0 = pos.length / 3;
    pts.forEach((p) => pos.push(p.x - ox, p.y - oy, p.z, p.x + ox, p.y + oy, p.z));
    for (let i = 0; i < N; i++) { const k = k0 + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, zapMat); m.frustumCulled = false;
  stage.add(m);
  zaps.push({ m, life });
}

function updateBuff(dt) {
  for (let i = zaps.length - 1; i >= 0; i--) { zaps[i].life -= dt; if (zaps[i].life <= 0) { stage.remove(zaps[i].m); zaps[i].m.geometry.dispose(); zaps.splice(i, 1); } }
  updateBolts(dt);
  const B = G.buff;
  if (!B) return;
  B.t -= dt; B.fireT -= dt;
  buffIcon.material.uniforms.uP.value = clamp(B.t / B.dur, 0, 1);
  const foot = liveFoot(), rel = (e) => e.s - player.s;
  if (B.kind === 'raph') {
    // Raph on the roof: face the nearest Foot car, run through the three throws, and let a
    // sai fly at each one's release frame
    const R = raphTop;
    R.mixer.update(dt * 1.5);
    const tgt = foot.filter((e) => rel(e) > -8 && rel(e) < 80).sort((a, b) => Math.hypot(rel(a), a.u - player.u) - Math.hypot(rel(b), b.u - player.u))[0];
    if (tgt) aimHero(R, tgt, R.cur >= 0 ? R.throws[R.cur].face : R.throws[R.next].face, dt);
    const cur = R.cur >= 0 ? R.throws[R.cur] : null;
    if (cur && !R.released && cur.act.time >= cur.rel) {
      R.released = true;
      if (tgt) {
        R.hand.getWorldPosition(_p);
        throwSai(_p, tgt);
      }
    }
    if ((!cur || cur.act.time >= cur.b) && tgt) {
      const nx = R.throws[R.next];
      nx.act.reset(); nx.act.time = nx.a; nx.act.setEffectiveWeight(1).fadeIn(0.08).play();
      if (cur) cur.act.fadeOut(0.08); else R.ride.fadeOut(0.08);
      R.cur = R.next; R.next = (R.next + 1) % R.throws.length; R.released = false;
    }
  } else if (B.kind === 'mike') {
    // aim at the nearest Foot car ahead and lob a pizza every 0.42 s
    const tgt = foot.filter((e) => rel(e) > -6 && rel(e) < 90).sort((a, b) => Math.abs(rel(a)) + Math.abs(a.u - player.u) * 0.5 - Math.abs(rel(b)) - Math.abs(b.u - player.u) * 0.5)[0];
    const M = mikeTop;
    if (tgt) aimHero(M, tgt, M.face, dt, 14);
    // recoil: he rocks back along the barrel after each shot
    const kick = Math.max(0, B.fireT - 0.3) * 0.9;
    // barrels spin up while there's something to shoot, and the stripes run hot after each shot
    M.spinV = (M.spinV || 0) + ((tgt ? 26 : 4) - (M.spinV || 0)) * Math.min(1, dt * 3);
    M.cannon.userData.spin.rotation.z += M.spinV * dt;
    const heat = 1 + Math.max(0, B.fireT - 0.2) * 3;
    M.cannon.userData.hot.color.setRGB(2.4 * heat, 1.1 * heat, 0.2 * heat);
    M.model.position.set(-Math.sin(M.face) * kick, Math.sin(G.time * 6) * 0.02, -Math.cos(M.face) * kick);
    if (tgt && B.fireT <= 0) {
      B.fireT = 0.42;
      const m = new THREE.Mesh(pizzaGeo, pizzaMat);
      M.holder.updateMatrixWorld(true);
      M.cannon.userData.tip.getWorldPosition(m.position);
      stage.add(m);
      frameAt(player.s, _T, _R);
      const v = new THREE.Vector3().copy(_T).multiplyScalar(player.vs + 20); v.y = 6;
      bolts.push({ m, v, target: tgt, t: 0, dmg: 20, splash: 8, label: "PIZZA'D!", trail: 0xff9a2a, spin: 'flat' });
      fx.add.emit(m.position, _n.set(0, 0, 0), new THREE.Color(0xffb040), 1.6, 0.1, { grow: 0.5 });
      audio.scrape();
    }
  } else if (B.kind === 'donnie') {
    const D = donTop;
    D.model.position.y = Math.sin(G.time * 5) * 0.02;
    const tgt = foot.filter((e) => rel(e) > -6 && rel(e) < 60).sort((a, b) => Math.abs(rel(a)) - Math.abs(rel(b)))[0];
    if (tgt) aimHero(D, tgt, D.face, dt, 6);
    B.pulseT = (B.pulseT ?? 0.2) - dt;
    const orb = D.device.userData.orb, glow = Math.max(0, B.pulseT - 0.75) * 4;   // flashes as it fires
    orb.scale.setScalar(1 + glow * 1.4 + Math.sin(G.time * 20) * 0.08);
    D.holder.updateMatrixWorld(true);
    const src = orb.getWorldPosition(new THREE.Vector3());
    if (B.pulseT <= 0) {
      B.pulseT = 1;
      // the pulse is lightning: forked bolts from the orb into every car in reach (two strands
      // each, so it reads as a branching discharge), which stuns them; nothing in reach and it
      // earths itself into the road around the van
      const inReach = foot.filter((e) => rel(e) > -1 && Math.hypot(rel(e), e.u - player.u) < EMP_R).sort((a, b) => Math.abs(rel(a)) - Math.abs(rel(b))).slice(0, 4);
      for (const e of inReach) {
        _p.copy(e.group.position).setY(1.3);
        const hitAt = _p.clone();
        const jag = clamp(src.distanceTo(hitAt) / 14, 0.4, 1.3);   // zigzag scaled to the bolt's length
        makeZap(src, hitAt, jag, 0.05, 0.2);
        makeZap(src, hitAt.clone().add(_n.set((Math.random() - 0.5) * e.W, 0.4, (Math.random() - 0.5) * e.L * 0.6)), jag * 0.7, 0.03, 0.16);
        fx.sparks(hitAt, _n.set(0, 0, 0), 14, 0.9);
        fx.add.emit(hitAt, _n.set(0, 0, 0), new THREE.Color(1.0, 0.7, 2.6), 1.6, 0.14, { grow: 0.8 });
        e.emp = Math.max(e.emp || 0, EMP_T);
        hitEnemy(e, 6, hitAt, Math.sign(e.u - player.u) || 1, 'EMP!');
      }
      if (!inReach.length) for (let k = 0; k < 3; k++) {
        const to = pointAt(player.s + 3 + Math.random() * 5, player.u + (Math.random() - 0.5) * 8, new THREE.Vector3()).setY(0.05);
        makeZap(src, to, 0.5, 0.035, 0.16);
        fx.sparks(to, _n.set(0, 0, 0), 5, 0.5);
      }
      fx.add.emit(src, _n.set(0, 0, 0), new THREE.Color(1.1, 0.7, 2.6), 1.4, 0.12, { grow: 1 });
      audio.scrape();
    }
    // the device crackles the whole time it's up
    if (Math.random() < dt * 16) {
      const to = src.clone().add(_n.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.3) * 1.2, (Math.random() - 0.5) * 1.6));
      makeZap(src, to, 0.35, 0.025, 0.08);
    }
    // the pulse fries shuriken before they reach the shell
    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      if (Math.hypot(sh.s - player.s, sh.u - player.u) < FIELD_R) {
        makeZap(src, sh.m.position.clone());
        fx.sparks(sh.m.position, _n.set(0, 0, 0), 8, 0.6);
        stage.remove(sh.m); shots.splice(i, 1);
      }
    }
  }
  if (B.t <= 0) endBuff();
}

// Raph's sai: a steel blade with a red-hot trail, explodes on contact (his original
// "explosive daggers" from the TDCars2 CombatRun plan)
let saiGeo = null, saiMat = null;
function throwSai(from, tgt) {
  if (!saiGeo) {
    const blade = new THREE.CylinderGeometry(0.05, 0.09, 1.3, 6); blade.translate(0, 0.45, 0);
    const guard = new THREE.BoxGeometry(0.62, 0.08, 0.08); guard.translate(0, -0.2, 0);
    const grip = new THREE.CylinderGeometry(0.07, 0.07, 0.42, 6); grip.translate(0, -0.42, 0);
    saiGeo = mergeGeometries([blade, guard, grip]); saiGeo.rotateX(Math.PI / 2);
    saiMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 2.0) });
  }
  const m = new THREE.Mesh(saiGeo, saiMat);
  m.position.copy(from);
  stage.add(m);
  frameAt(player.s, _T, _R);
  const v = new THREE.Vector3().copy(_T).multiplyScalar(player.vs + 25); v.y = 5;
  bolts.push({ m, v, target: tgt, t: 0, dmg: 28, splash: 12, label: 'SAI!', trail: 0xff3b2e, spin: 'sai', straight: true });
  audio.scrape();
}

// pizzas and sais: arc off the roof, then home in hard
function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const d = bolts[i];
    d.t += dt;
    if (!d.target.alive || !d.target.active) {
      const alt = liveFoot().sort((a, b) => a.group.position.distanceTo(d.m.position) - b.group.position.distanceTo(d.m.position))[0];
      if (alt) d.target = alt; else { stage.remove(d.m); bolts.splice(i, 1); continue; }
    }
    const to = _c.copy(d.target.group.position).setY(1).sub(d.m.position);
    const dist = to.length();
    if (d.straight) d.v.copy(to.normalize()).multiplyScalar(Math.max(80, player.vs + 35));   // sai: a straight line (130 was too fast to see)
    else d.v.lerp(to.normalize().multiplyScalar(Math.max(65, player.vs + 30)), Math.min(1, dt * (2.5 + d.t * 10)));
    d.m.position.addScaledVector(d.v, dt);
    if (d.spin === 'flat') { d.m.rotation.y += dt * 20; d.m.rotation.z = 0.35; }
    else { d.m.lookAt(_l.copy(d.m.position).add(d.v)); d.m.rotateX(d.t * 40); }
    if (d.straight) for (let k = 0; k < 3; k++) fx.add.emit(_c.copy(d.m.position).addScaledVector(d.v, -dt * k / 3), _n.set(0, 0, 0), new THREE.Color(d.trail), 0.55, 0.3, { grow: -0.7 });
    else if (Math.random() < dt * 50) fx.add.emit(d.m.position, _n.set(0, 0, 0), new THREE.Color(d.trail), 0.5, 0.22, { grow: -0.6 });
    if (dist < 1.9 || d.t > 3) {
      _p.copy(d.m.position);
      fx.sparks(_p, _n.set(0, 0, 0), 18, 1.2);
      for (let k = 0; k < 6; k++) fx.fire(_p);
      if (d.target.alive) hitEnemy(d.target, d.dmg, _p, 0, d.label);
      // a little splash on anyone parked next to it
      for (const e of liveFoot()) if (e !== d.target && e.group.position.distanceTo(_p) < 5) hitEnemy(e, d.splash, e.group.position.clone().setY(1), 0, d.label);
      if (d.spin !== 'flat') fx.add.emit(_p, _n.set(0, 0, 0), new THREE.Color(1.6, 0.5, 0.3), 5, 0.14, { grow: 0.8 });
      stage.remove(d.m); bolts.splice(i, 1);
    }
  }
}

// ── Foot fire and the wagon's shell ──────────────────────────────────────────
// Foot cars that get ahead lob glowing shuriken back at the wagon. A car you're touching
// can't aim — staying on them is the safe place. Each shot is telegraphed by a purple glow.
const SHELL_MAX = 100;
const shots = [];
// Each Foot car has a roof cannon. It tracks the wagon all the time; for the last SHOT.charge
// seconds before a shot the muzzle heats up and a laser sight locks on, then a glowing shell
// flies through the air at where the wagon WAS when it fired — lean out of the line to dodge.
const SHOT = { charge: 0.9, closing: 64, minRel: 14, hitY: 1.5, arc: 0.8 };
// a shell is a pair of small glowing balls, one from each barrel, each in a soft round glow
const shotGeo = new THREE.SphereGeometry(0.1, 10, 8);
const roundGlow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 0.7, 3.4) });
const haloMat = new THREE.SpriteMaterial({ map: roundGlow, color: new THREE.Color(2.2, 0.25, 1.6), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
function aimTurret(e, dt) {
  const T = e.turret;
  if (!T || !e.alive) return;
  const to = T.root.worldToLocal(_c.copy(player.group.position).setY(SHOT.hitY));
  to.y -= T.head.position.y;
  const yaw = Math.atan2(to.x, to.z), pitch = Math.atan2(-to.y, Math.hypot(to.x, to.z));
  let dy = yaw - T.head.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  T.head.rotation.y += dy * Math.min(1, dt * 8);
  T.head.rotation.x += (pitch - T.head.rotation.x) * Math.min(1, dt * 8);
  // laser sight while charging, reaching the wagon
  const c = e.charge;
  T.laser.visible = c > 0.02;
  if (T.laser.visible) {
    T.tip.getWorldPosition(_p);
    T.laser.scale.set(1 + c, 1 + c, _p.distanceTo(player.group.position) / T.sc);
    T.laser.material.opacity = 0.15 + c * 0.75;
  }
}
function fireShot(e) {
  const T = e.turret;
  const m = new THREE.Group();
  for (const x of [-0.13, 0.13]) {
    const ball = new THREE.Mesh(shotGeo, shotMat); ball.position.x = x; m.add(ball);
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(0.7); ball.add(halo);
  }
  stage.add(m);
  T.tip.getWorldPosition(m.position);
  const y0 = m.position.y;
  // flight in road coordinates (so it rides along with the chase), aimed at the wagon's
  // position at the moment of firing; height goes from the muzzle to hull height with a lift
  const s = e.s - e.L * 0.18 - 1.4 * T.sc;
  const t = Math.max(0.25, (s - player.s) / SHOT.closing);
  G.shotsFired = (G.shotsFired || 0) + 1;
  shots.push({ m, s, u: e.u, vs: player.vs - SHOT.closing, vu: clamp((player.u - e.u) / t, -14, 14), T: t, y0, dmg: e.kind === 'truck' ? 14 : 9, from: e, life: 0 });
  T.recoil = 1; T.laser.visible = false;
  fx.add.emit(m.position, _n.set(0, 0, 0), new THREE.Color(2.6, 0.5, 2), 2.2, 0.12, { grow: 0.8 });
  fx.sparks(m.position, _n.set(0, 0, 0), 8, 0.6);
  audio.scrape();
}
const _sv = new THREE.Vector3();
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const b = shots[i];
    b.life += dt;
    b.s += b.vs * dt; b.u += b.vu * dt;
    const k = clamp(b.life / b.T, 0, 1.4);
    _sv.copy(b.m.position);
    pointAt(b.s, b.u, b.m.position).setY(b.y0 + (SHOT.hitY - b.y0) * k + Math.sin(Math.min(1, k) * Math.PI) * SHOT.arc);
    if (b.life > dt) b.m.lookAt(_sv.subVectors(b.m.position, _sv).add(b.m.position));   // nose along its motion
    if (Math.random() < dt * 60) fx.add.emit(b.m.position, _n.set(0, 0, 0), new THREE.Color(0xff4ad2), 0.4, 0.18, { grow: -0.5 });
    let gone = false;
    if (gadgetOn('shield') && shield.ext > 0.8 && Math.abs(b.s - player.s) < player.L / 2 + 1.2 && Math.abs(b.u - player.u) < player.W / 2 + 1.2) {
      bounceShot(b); shots.splice(i, 1); continue;
    }
    if (Math.abs(b.s - player.s) < player.L / 2 + 0.4 && Math.abs(b.u - player.u) < player.W / 2 + 0.4 && G.state === 'play') {
      fx.add.emit(b.m.position, _n.set(0, 0, 0), new THREE.Color(2.6, 0.6, 2), 3, 0.18, { grow: 1 });
      G.shotsHit = (G.shotsHit || 0) + 1;
      hurt(b.dmg, b.m.position); gone = true;
    } else {
      // friendly fire: another Foot car in the way takes it
      for (const e of liveFoot()) if (e !== b.from && Math.abs(b.s - e.s) < e.L / 2 && Math.abs(b.u - e.u) < e.W / 2) {
        hitEnemy(e, 22, b.m.position, 0, 'FRIENDLY FIRE!'); gone = true; break;
      }
    }
    if (gone || b.s < player.s - 15 || b.life > 4 || Math.abs(b.u) > HW + 2) { stage.remove(b.m); shots.splice(i, 1); }
  }
}
function hurt(dmg, at) {
  if (G.state !== 'play' || G.god || gadgetOn('shield')) return;
  G.hp = Math.max(0, G.hp - dmg);
  player.flash = 1; player.bounce = 0.5;
  G.shake = Math.max(G.shake, 0.35);
  G.hurtV = 0.8;
  fx.sparks(_p.copy(at || player.group.position).setY(1.2), _n.set(0, 0, 0), 16, 1);
  popupAt(player.group.position.clone().setY(2.5), `-${dmg}`, 'bad');
  audio.thud();
  if (G.hp <= 0) {
    player.startWreck({ u: 0, up: 11, spin: 7 });
    fx.explode(player.group.position.clone().setY(1), _n.set(0, 0, 0), 0x6fd04a);
    audio.boom(); flash(0.9);
    endRun('WAGON WRECKED!');
  }
}

const STRIKE = { fly: 0.5, back: 0.6 };
// Leo's flight: blue light streams off both katana tips, and a few motes shed off his body.
// Lifetimes are in game time, which crawls at 0.12x while he's out, so they linger as trails.
const _lt = new THREE.Vector3();
const LEO_BLUE = new THREE.Color(0.35, 0.8, 1.7), LEO_WHITE = new THREE.Color(0.9, 1.1, 1.5);
function leoTrail(realDt) {
  const n = Math.max(1, Math.round(realDt * 120));
  for (const tip of leo.tips) {
    tip.getWorldPosition(_lt);
    for (let i = 0; i < n; i++) fx.add.emit(_lt, _n.set(0, 0, 0), i % 3 ? LEO_BLUE : LEO_WHITE, 0.14, 0.045, { grow: -0.8 });
  }
  if (Math.random() < realDt * 40) {
    leo.model.getObjectByName('mixamorigSpine2').getWorldPosition(_lt);
    _lt.add(_n.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2));
    fx.add.emit(_lt, _n.set((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), LEO_BLUE, 0.08 + Math.random() * 0.08, 0.07, { drag: 2 });
  }
}
// the cut: two crossed crescents of light facing the camera that snap open and fade, a hard
// white streak through them, and a spray of blue sparks. Real time, so it reads in the slow-mo.
const slashes = [];
let slashGeo = null, streakGeo = null;
function slashAt(pos, n) {
  if (!slashGeo) {
    slashGeo = new THREE.RingGeometry(0.82, 1, 40, 1, Math.PI * 0.1, Math.PI * 0.8);
    streakGeo = new THREE.PlaneGeometry(1, 0.06);
  }
  const base = (n % 2 ? -1 : 1) * 0.6 + (Math.random() - 0.5) * 0.4;
  const parts = [
    { geo: slashGeo, rot: base, col: new THREE.Color(0.55, 1.1, 2.2), s0: 1.0, s1: 3.0 },
    { geo: slashGeo, rot: base + Math.PI * 0.55, col: new THREE.Color(0.4, 0.85, 1.9), s0: 0.8, s1: 2.5 },
    { geo: streakGeo, rot: base + Math.PI * 0.27, col: new THREE.Color(1.3, 1.5, 1.9), s0: 2.5, s1: 6.5, thin: true },
  ];
  for (const P of parts) {
    const m = new THREE.Mesh(P.geo, new THREE.MeshBasicMaterial({ color: P.col, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.copy(pos); m.renderOrder = 5;
    stage.add(m);
    slashes.push({ m, t: 0, life: P.thin ? 0.16 : 0.3, ...P });
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 10;
    fx.add.emit(pos, _n.set(Math.cos(a) * sp, Math.random() * 6, Math.sin(a) * sp), i % 3 ? LEO_BLUE : LEO_WHITE, 0.1 + Math.random() * 0.1, 0.06 + Math.random() * 0.05, { drag: 3 });
  }
  fx.add.emit(pos, _n.set(0, 0, 0), LEO_WHITE, 1.0, 0.025, { grow: 1.2 });
}
function updateSlashes(realDt) {
  for (let i = slashes.length - 1; i >= 0; i--) {
    const S = slashes[i];
    S.t += realDt;
    const k = S.t / S.life;
    if (k >= 1) { stage.remove(S.m); S.m.material.dispose(); slashes.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - Math.min(1, k * 2.2), 3);   // snaps open, then holds while it fades
    S.m.quaternion.copy(camera.quaternion);
    S.m.rotateZ(S.rot);
    const near = clamp(S.m.getWorldPosition(_lt).distanceTo(camera.position) / 12, 0.35, 1);
    if (S.thin) S.m.scale.set((S.s0 + (S.s1 - S.s0) * e) * near, 1 + k * 2, 1);
    else S.m.scale.setScalar((S.s0 + (S.s1 - S.s0) * e) * near);
    S.m.material.opacity = 1 - k * k;
  }
}
function updateStrike(realDt) {
  const st = G.strike;
  st.t += realDt; st.total += realDt;
  leo.mixer.update(realDt);
  // the world crawls while Leo is in the air, and comes back up to speed as he returns
  G.timeScale = st.back ? 0.12 + clamp(st.t / STRIKE.back, 0, 1) * 0.88 : 0.12;
  if (!st.back) {
    let e = st.hops[st.i];
    // a target that died under him (someone else's hit) hands over to the next one
    while (e && !e.alive && st.t < 0.05) { st.i++; e = st.hops[st.i]; }
    if (!e) { st.back = true; st.t = 0; st.from = leo.holder.position.clone(); return; }
    if (e.alive) { st.ts = e.s; st.tu = e.u; st.side = e.u >= player.u ? 1 : -1; }
    const to = e.group.position.clone().setY(e.alive ? e.H + 0.1 : e.group.position.y + 1);
    const k = Math.min(1, st.t / STRIKE.fly);
    leo.holder.position.lerpVectors(st.from, to, k).setY(THREE.MathUtils.lerp(st.from.y, to.y, k) + Math.sin(k * Math.PI) * 3);
    leo.holder.lookAt(to.x, leo.holder.position.y, to.z);
    leo.holder.rotateY(Math.PI);
    leoTrail(realDt);
    if (k >= 1) {
      slashAt(to.clone().setY(to.y + 0.6), st.i);
      if (e.alive) wreckEnemy(e, st.side, st.i === 0 ? 'KATANA!' : st.i === 1 ? 'DOUBLE CUT!' : 'TRIPLE CUT!', true);
      fx.pickupBurst(to, TURTLES.leo.color);
      st.i++; st.t = 0; st.from = to.clone();
      if (st.i >= st.hops.length) st.back = true;
      else { leo.flip.reset(); leo.flip.time = 1.45; leo.flip.timeScale = 1.6; leo.flip.play(); }
    }
  } else {
    // back to the wagon's roof, then gone
    const k = clamp(st.t / STRIKE.back, 0, 1);
    const home = player.group.position.clone().setY(player.H + 0.2);
    leo.holder.position.lerpVectors(st.from, home, k).setY(THREE.MathUtils.lerp(st.from.y, home.y, k) + Math.sin(k * Math.PI) * 2);
    leoTrail(realDt);
    if (k >= 1) { G.strike = null; G.timeScale = 1; leo.holder.visible = false; fx.pickupBurst(player.group.position.clone().setY(2), 0x5aa8ff); }
  }
}

// ── Camera ───────────────────────────────────────────────────────────────────
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), _c = new THREE.Vector3(), _l = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  frameAt(player.s, _T, _R);
  const portrait = window.innerWidth < window.innerHeight;
  // low and tight behind the wagon, looking well down the street: speed reads from the road
  const back = portrait ? 12.5 : 10.5, up = portrait ? 9 : 7.4;
  pointAt(player.s - back, player.u * 0.7, _c).setY(up);
  pointAt(player.s + 34, player.u * 0.8, _l).setY(portrait ? 0 : 0.6);
  // the faster we go, the wider the lens
  const sp = clamp((player.vs - SPEED.start * 0.8) / (SPEED.top - SPEED.start * 0.8), 0, 1);
  const baseFov = portrait ? 74 : 60;
  grade.uniforms.uSpeed.value = G.state === 'play' ? (0.35 + sp * 0.65) * LOOK.speedBlur : 0;
  camera.fov += (baseFov + sp * 12 - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  $('speedlines').style.opacity = G.state === 'play' ? (0.04 + sp * 0.18).toFixed(2) : 0;
  if (G.strike) {
    // cut to a low chase angle that holds both the wagon and Leo's current target —
    // kept inside the street canyon so it never ends up in a shopfront
    const st = G.strike, k = clamp(st.total / 0.15, 0, 1) * (st.back ? clamp((STRIKE.back - st.t) / 0.3, 0, 1) : 1);
    // chase Leo himself: a few metres behind and to the side of him, looking past him at
    // the car he's about to land on
    // (in street coordinates, always behind BOTH Leo and the car he's going for, so a hop
    // to a car behind him never swings the camera round)
    const hp = leo.holder.position;
    const rel = _n.copy(hp).sub(player.group.position);
    const leoS = player.s + rel.dot(_T), leoU = player.u + rel.dot(_R);
    const tS = st.back ? player.s : st.ts, tU = st.back ? player.u : st.tu;
    const cp = pointAt(Math.min(leoS, tS) - 9, clamp((leoU + tU) / 2 - st.side * 2.5, -7, 7), _p);
    cp.y = Math.max(3.6, hp.y + 2);
    const lp = pointAt((leoS + tS) / 2 + 3, (leoU + tU) / 2, new THREE.Vector3()).setY(Math.max(1.2, hp.y * 0.6));
    _c.lerp(cp, k); _l.lerp(lp, k);
  }
  if (!camInit) { camPos.copy(_c); camLook.copy(_l); camInit = true; }
  // stiff follow: at chase speed a soft lerp leaves the camera 7+ m behind and the wagon tiny
  const f = Math.min(1, dt * (G.strike ? 6 : 16));
  camPos.lerp(_c, f); camLook.lerp(_l, f);
  camera.position.copy(camPos);
  const sk = G.shake * LOOK.shake;
  if (sk > 0) camera.position.add(_n.set((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk));
  camera.lookAt(camLook);
  // sun and its shadow box ride along with the wagon
  sun.position.copy(player.group.position).add(sunOff);
  sun.target.position.copy(player.group.position);
  sky.position.copy(camera.position);
  // hang the pooled point lights on the lamps just ahead of the wagon
  const near = world.routeLamps().filter((l) => l.s > player.s - 12).sort((a, b) => a.s - b.s);
  lampLights.forEach((l, i) => { const lp = near[i]; l.visible = !!lp; if (lp) l.position.copy(lp.pos); });
  const k0 = Math.floor((player.s - 6) / 34);
  neonLights.forEach((l, i) => {
    const k = k0 + i, side = (k & 1) ? 1 : -1;
    pointAt(k * 34 + 17, side * (HW + 3.5), l.position).setY(4.5);
    l.color.setHex(NEON_COLS[((k % 4) + 4) % 4]);
  });
  // headlights: from the wagon's nose, aimed down the street
  pointAt(player.s + player.L / 2, player.u, head.position).setY(1.1);
  pointAt(player.s + 22, player.u + player.vu * 0.4, head.target.position).setY(0);
}

// ── HUD helpers ──────────────────────────────────────────────────────────────
const _sp = new THREE.Vector3();
function popupAt(world, text, cls) {
  _sp.copy(world).project(camera);
  if (_sp.z > 1) return;
  const d = document.createElement('div');
  d.className = 'popup ' + (cls || '');
  d.textContent = text;
  d.style.left = ((_sp.x + 1) / 2 * window.innerWidth) + 'px';
  d.style.top = ((1 - _sp.y) / 2 * window.innerHeight) + 'px';
  $('popups').appendChild(d);
  setTimeout(() => d.remove(), 950);
}
function banner(text, cls = '') {
  const b = $('banner');
  b.className = ''; void b.offsetWidth;
  b.textContent = text; b.className = 'show ' + cls;
}
let flashV = 0;
function flash(v) { flashV = Math.max(flashV, v); }
function updateHud() {
  $('timer').textContent = Math.ceil(G.left);
  $('timer').classList.toggle('low', G.left < 10);
  $('wrecks').textContent = G.wrecks;
  $('score').textContent = G.score;
  $('combo-wrap').classList.toggle('on', G.combo > 1 && G.comboT > 0);
  $('combo').textContent = 'x' + G.combo;
  $('combo-bar').firstElementChild.style.transform = `scaleX(${clamp(G.comboT / COMBO_WINDOW, 0, 1)})`;
  const slot = $('raph-slot');
  slot.classList.toggle('ready', !!G.power);
  slot.dataset.t = G.power || '';
  slot.lastElementChild.textContent = G.power ? TURTLES[G.power].name : 'POWER';
  // timed power: head + a ring that drains with the time left
  const gf = $('gadget');
  gf.classList.toggle('on', !!G.gadget);
  if (G.gadget) {
    gf.dataset.t = G.gadget.kind;
    gf.querySelector('img').src = `/ui/${G.gadget.kind}.png`;
    gf.querySelector('.fg').style.strokeDashoffset = (289 * (1 - G.gadget.t / G.gadget.dur)).toFixed(1);
    gf.querySelector('b').textContent = GADGETS[G.gadget.kind].name;
    gf.querySelector('i').textContent = Math.max(0, G.gadget.t).toFixed(1) + 's';
  }
  const bf = $('buff');
  bf.classList.toggle('on', !!G.buff);
  if (G.buff) {
    bf.dataset.t = G.buff.kind;
    bf.querySelector('img').src = `/ui/${G.buff.kind}.png`;
    bf.querySelector('.fg').style.strokeDashoffset = (289 * (1 - G.buff.t / G.buff.dur)).toFixed(1);
    bf.querySelector('b').textContent = BUFFS[G.buff.kind].name;
    bf.querySelector('i').textContent = Math.max(0, G.buff.t).toFixed(1) + 's';
  }
  $('shell').firstElementChild.style.transform = `scaleX(${G.hp / SHELL_MAX})`;
  $('shell').classList.toggle('low', G.hp < 35);
  G.hurtV = Math.max(0, G.hurtV - 0.04);
  $('hurt').style.opacity = G.hurtV.toFixed(2);
}

// ── Main loop ────────────────────────────────────────────────────────────────
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.paused || !player) { render(); return; }
  if (G.hitStop > 0 && LOOK.hitStop <= 0) G.hitStop = 0;
  if (G.hitStop > 0) { G.hitStop -= realDt / Math.max(0.05, LOOK.hitStop); updateCamera(realDt); fx.update(realDt * 0.15); render(); return; }
  if (G.strike) updateStrike(realDt);
  else if (G.slowT > 0) { G.slowT -= realDt; G.timeScale = G.slowT > 0.25 ? 0.3 : 0.3 + (0.25 - Math.max(0, G.slowT)) / 0.25 * 0.7; if (G.slowT <= 0) G.timeScale = 1; }
  const dt = realDt * G.timeScale;
  step(dt, realDt);
  render();
}

function step(dt, realDt) {
  G.time += dt;
  const lean = G.state === 'play' ? autoLean() ?? input.read(realDt) : 0;
  G.leanNow = lean;

  if (G.state === 'countdown') {
    const before = Math.ceil(G.countT);
    G.countT -= realDt;
    const n = Math.ceil(G.countT);
    if (n !== before && n > 0) audio.beep(false);
    $('countdown').textContent = G.countT > 0 ? n : '';
    if (G.countT <= 0) { G.state = 'play'; audio.beep(true); banner('WRECK THE FOOT!'); }
  }
  if (G.state === 'play') {
    G.left -= dt;
    if (G.left <= 0) { G.left = 0; endRun(); }
  }

  // wagon: auto-throttle along the street, lean steers across it
  const cruise = SPEED.start + (SPEED.top - SPEED.start) * clamp(G.time / SPEED.rampTime, 0, 1) + NITRO.boost * nitro.ext;
  player.vs += (cruise - player.vs) * Math.min(1, dt * 1.2);
  const wantVu = lean * LAT.max;
  player.vu += clamp(wantVu - player.vu, -LAT.accel * dt, LAT.accel * dt);
  player.s += player.vs * dt;
  player.u += player.vu * dt;
  G.knockT = Math.max(0, G.knockT - dt);

  if (G.state === 'countdown') for (const e of enemies) if (e.active) { e.vs = player.vs; e.s += e.vs * dt; }
  if (G.state === 'play' || G.state === 'over') {
    if (G.state === 'play') director(dt);
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.alive) {
        if (e.tether) tetherStep(e, dt);
        else { enemyAI(e, dt); e.s += e.vs * dt; e.u += e.vu * dt; }
      }
    }
  }
  // collisions: wagon vs Foot, Foot vs Foot
  const live = enemies.filter((e) => e.active && e.alive);
  for (const e of live) collide(player, e, dt);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) collide(live[i], live[j], dt);
  walls(player, dt);
  for (const e of live) walls(e, dt);
  // the wagon holds its pace: a shunt can check it, but never fling it forward or stop it dead
  player.vs = clamp(player.vs, cruise * 0.72, cruise * 1.08);

  // place everything
  if (player.wreck) player.stepWreck(dt); else { player.place(dt); player.group.position.y += player.curbLift || 0; }
  for (const e of enemies) {
    if (!e.active) continue;
    if (e.alive) {
      e.place(dt);
      // damage tells: smoke under half health, fire under a quarter
      const hpk = e.hp / e.maxHp;
      if (hpk < 0.55 && Math.random() < dt * (hpk < 0.3 ? 30 : 14)) fx.smoke(_p.copy(e.group.position).setY(e.H), hpk < 0.3 ? 0.12 : 0.35);
      if (hpk < 0.3 && Math.random() < dt * 30) fx.fire(_p.copy(e.group.position).setY(e.H * 0.8));
    } else if (e.wreck) {
      const t = e.stepWreck(dt);
      if (Math.random() < dt * 40) fx.fire(_p.copy(e.group.position).setY(e.group.position.y + 0.8));
      if (Math.random() < dt * 25) fx.smoke(_p.copy(e.group.position).setY(e.group.position.y + 1.2), 0.1, 2);
      if (t > 2.6 || e.group.position.distanceTo(player.group.position) > 120) retire(e);
    }
  }
  if (Math.abs(player.vu) > 4 && Math.random() < dt * 20) fx.dust(pointAt(player.s - player.L / 2, player.u - Math.sign(player.vu) * player.W / 2, _p).setY(0.2));

  if (G.state === 'play') { updateOrbs(dt); tryPower(); }
  updateShots(dt); updateWaves(dt); updateBuff(dt); updateHatch(realDt); updateSlashes(realDt); updateSaws(dt); updateShield(dt); updateNitro(dt); updateHarpoon(dt); updateGadget(dt); updateIcons(realDt);
  if (G.hp < 40 && G.state === 'play' && Math.random() < dt * 18) fx.smoke(_p.copy(player.group.position).setY(player.H), 0.15);
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 1; }

  junctionChoice();
  world.update(player.s);
  if (G.state === 'play' && Math.random() < dt * 26) {
    const side = Math.random() < 0.5 ? -1 : 1;
    fx.spray(pointAt(player.s - player.L * 0.42, player.u + side * player.W * 0.42, _p).setY(0.25));
  }
  for (const v of world.routeVents()) {
    if (v.s < player.s - 15 || v.s > player.s + 150) continue;
    if (Math.random() < dt * 9) fx.steam(v.pos);
  }
  fx.update(dt);
  G.shake = Math.max(0, G.shake - realDt * 2.2);
  flashV = Math.max(0, flashV - realDt * 3);
  $('flash').style.opacity = flashV.toFixed(2);
  audio.engine(player.vs, G.state === 'play');
  updateCamera(realDt);
  updateHud();
}

// ── Junctions: pick a side of the road before the T and the wagon takes that turn ──
function junctionChoice() {
  const J = path.junction, el = $('turn');
  if (!J) return;
  const to = J.s - player.s;
  if (to < DECIDE_AT) {
    const turn = player.u < 0 ? -1 : 1;
    world.decide(turn);
    el.className = 'show locked ' + (turn < 0 ? 'l' : 'r');
    setTimeout(() => { el.className = ''; }, 900);
    audio.beep(true);
    return;
  }
  if (!el.classList.contains('locked')) el.className = to < 230 && G.state === 'play' ? 'show ' + (player.u < 0 ? 'l' : 'r') : '';
}

function endRun(reason) {
  if (G.state === 'over') return;
  G.state = 'over';
  audio.over();
  const stars = MISSION.stars.filter((s) => G.wrecks >= s).length;
  $('over-title').textContent = reason || (G.wrecks >= MISSION.target ? 'STREET CLEARED!' : 'THEY GOT AWAY…');
  $('over-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'dim'}">★</span>`).join('');
  $('over-wrecks').textContent = G.wrecks;
  $('over-score').textContent = G.score;
  $('over-combo').textContent = 'x' + G.bestCombo;
  setTimeout(() => $('gameover-overlay').classList.remove('hidden'), 700);
}

// ── Buttons ──────────────────────────────────────────────────────────────────
$('restart-button').addEventListener('click', () => { audio.start(); startRun(); });
function setPaused(p) {
  if (G.state === 'over' || G.state === 'loading') return;
  G.paused = p;
  $('pause-overlay').classList.toggle('hidden', !p);
  audio.setPaused(p);
}
$('pause-btn').addEventListener('click', () => setPaused(!G.paused));
$('resume-button').addEventListener('click', () => setPaused(false));
const muteBtn = $('mute-btn');
muteBtn.classList.toggle('muted', audio.muted);
muteBtn.addEventListener('click', () => { audio.setMuted(!audio.muted); muteBtn.classList.toggle('muted', audio.muted); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') setPaused(!G.paused);
  if (e.code === 'KeyM') { audio.setMuted(!audio.muted); muteBtn.classList.toggle('muted', audio.muted); }
  // dev hotkeys: summon a power without its pickup. Leo is back-dated past his 6 s wait so he
  // goes as soon as there's any car in reach.
  if (DEV && G.state === 'play') {
    const kind = { KeyZ: 'leo', KeyX: 'raph', KeyC: 'mike', KeyV: 'donnie', KeyB: 'saws', KeyG: 'shield', KeyN: 'nitro', KeyH: 'harpoon' }[e.code];
    if (kind === 'leo') { G.power = 'leo'; G.powerAt = G.time - 10; popupAt(player.group.position.clone().setY(2.5), 'LEO READY!', 'big'); }
    else if (kind && GADGETS[kind]) startGadget(kind);
    else if (kind) startBuff(kind);
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') setPaused(true); });

// ── Test hooks (headless drive scripts) ──────────────────────────────────────
// ?auto=1 turns on a simple autopilot that hunts the nearest Foot car.
const AUTO = new URLSearchParams(location.search).has('auto');
function autoLean() {
  if (!AUTO && !window.__autopilot) return null;
  let best = null, bd = 1e9;
  for (const e of enemies) {
    if (!e.active || !e.alive) continue;
    const rel = e.s - player.s;
    if (rel < -6 || rel > 30) continue;
    const d = Math.abs(rel) + Math.abs(e.u - player.u) * 0.5;
    if (d < bd) { bd = d; best = e; }
  }
  const o = orbs[0];
  if (o && o.s - player.s < 60 && o.s > player.s) return clamp((o.u - player.u) * 0.6, -1, 1);
  if (!best) return clamp(-player.u * 0.3, -1, 1);
  const du = best.u - player.u;
  return Math.abs(best.s - player.s) < 6 ? Math.sign(du) : clamp(du * 0.5, -1, 1);
}
window.__game = { G, get player() { return player; }, enemies, orbs, camera, waves, bolts, zaps, shots, startBuff, get leo() { return leo; }, get raphTop() { return raphTop; }, hatchS, get fx() { return fx; }, saws, updateSaws, startGadget, get mikeTop() { return mikeTop; }, get donTop() { return donTop; }, sky, scene, stage, renderer, composer, get world() { return world; } };
