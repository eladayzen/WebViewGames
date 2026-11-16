import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { World, HW, LANES, DECIDE_AT, path, pointAt, frameAt, yawAt, refl } from './world.js';
import { Car, KINDS, loadCarModels } from './cars.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

// ── Tuning ───────────────────────────────────────────────────────────────────
const MISSION = { time: 90, target: 12, stars: [12, 20, 28] };
const SPEED = { start: 36, top: 47, rampTime: 60 };   // m/s — a chase, not a cruise
const LAT = { max: 12.5, accel: 55 };        // player sideways speed (m/s) and response
const RAM = { base: 6, perSpeed: 5.2, grindDps: 30, wallPerSpeed: 6, rearPerSpeed: 4 };
const COMBO_WINDOW = 4.5;
const ORB_EVERY = 11;                         // seconds between Raph pickups

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ── Renderer / scene ─────────────────────────────────────────────────────────
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(1.5, window.devicePixelRatio || 1);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// everything that should appear in the wet-road mirror lives under `stage`
const stage = new THREE.Group();
scene.add(stage);

// Night sky: deep blue overhead, a sodium-purple city glow at the horizon. Symmetric in |y|
// so its reflection in the wet road matches.
const HORIZON = new THREE.Color(0x4a58c8), ZENITH = new THREE.Color(0x070b30), BAND = new THREE.Color(0xd060d8);
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { cH: { value: HORIZON }, cZ: { value: ZENITH }, cB: { value: BAND } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }',
  fragmentShader: 'uniform vec3 cH; uniform vec3 cZ; uniform vec3 cB; varying vec3 vD; void main(){ float y = abs(vD.y); float h = pow(clamp(y*1.8, 0.0, 1.0), 0.55); vec3 c = mix(cH, cZ, h) + cB * exp(-y * 14.0) * 0.55; gl_FragColor = vec4(c, 1.0); }',
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
vec3 skyC = mix(${v3(HORIZON)}, ${v3(ZENITH)}, pow(clamp(fy * 1.8, 0.0, 1.0), 0.55)) + ${v3(BAND)} * exp(-fy * 14.0) * 0.55;
gl_FragColor.rgb = mix( gl_FragColor.rgb, skyC, fogFactor );
#endif`;
}
scene.add(new THREE.HemisphereLight(0x8090ff, 0x2a1838, 1.05));
// moonlight: the one shadow-caster, cool and low so cars sit on the road
const sun = new THREE.DirectionalLight(0x90a8ff, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
// real warm light from the nearest street lamps (pooled, re-hung every frame)
const lampLights = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffb060, 42, 36, 1.4); scene.add(l); return l; });
// neon spill from the shopfronts: magenta / cyan / amber pools fixed along the street (every
// 34 m, alternating sides) so the cars and the wet road pick up colour as they pass
const NEON_COLS = [0xff2fc8, 0x26c4ff, 0xff7a1e, 0x8a4dff];
const neonLights = Array.from({ length: 3 }, () => { const l = new THREE.PointLight(0xffffff, 70, 30, 1.5); scene.add(l); return l; });
// the wagon's headlights
const head = new THREE.SpotLight(0xfff0d8, 160, 55, 0.55, 0.7, 1.3);
scene.add(head, head.target);
// (no scene.environment: a PMREM room env here turned every lit surface fog-coloured —
// measured 2026-11-15, buildings and cars vanished; the lamps and neon light the cars instead)

// post: bloom on everything bright (windows, neon, lamps, fire), then tone map
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.6, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// grade: punchier saturation and contrast, cool shadows, vignette, and a speed blur that
// streaks only the screen edges (the centre - the wagon and the targets - stays sharp)
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uAspect: { value: 1.78 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed; uniform float uAspect; varying vec2 vUv;
void main(){
  vec2 d = vUv - vec2(0.5, 0.42);
  float r = length(d * vec2(uAspect, 1.0)) / uAspect * 1.6;
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float b = uSpeed * smoothstep(0.5, 1.1, r) * 0.025;
  if (b > 0.0005) { for (int i = 1; i <= 5; i++) c += texture2D(tDiffuse, vUv - d * b * float(i)).rgb; c /= 6.0; }
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.25);
  c = (c - 0.5) * 1.07 + 0.5;
  c += vec3(-0.012, 0.0, 0.035) * (1.0 - l);
  c *= mix(1.0, 0.6, smoothstep(0.55, 1.25, r));
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
function render() {
  if (world && !window.__noRefl) renderReflection();
  composer.render();
}

// ── Game state ───────────────────────────────────────────────────────────────
const G = {
  state: 'loading', time: 0, left: MISSION.time, score: 0, wrecks: 0,
  combo: 1, comboT: 0, bestCombo: 1, paused: false, timeScale: 1, hitStop: 0,
  shake: 0, orbT: 4, power: null, strike: null, knockT: 0, cleared: false, hp: 100, hurtV: 0, slowT: 0,
};
let world, fx, player, models, leo, raphTop;
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
  for (const k of ['raph', 'leo', 'mike', 'donnie']) { headTex[k] = await tl.loadAsync(`/ui/${k}.png`); headTex[k].colorSpace = THREE.SRGBColorSpace; }
  world = new World(stage, tex);
  fx = new FX(stage);
  models = await loadCarModels();
  player = new Car('wagon', models.wagon, stage);
  for (let i = 0; i < 5; i++) enemies.push(new Car('racer', models.racer, stage));
  for (let i = 0; i < 2; i++) enemies.push(new Car('truck', models.truck, stage));
  ({ leo, raphTop } = await loadHeroes());
  buildBuffProps();
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
  // Raph: a touch smaller so he fits on the roof; the three clips Elad tagged THROW
  // (Sewer Shred attacks #4, #7, #8). [start, release, end] in clip seconds — release is the
  // forearm's peak speed, measured from the clip data.
  const R = make(2.2, null);
  R.holder.position.set(0, models.wagon.roofY - 0.05, 0.5);
  player.group.add(R.holder);
  R.hand = R.model.getObjectByName('mixamorigRightHand');
  R.throws = [['a8', 0.0, 0.3, 0.75], ['a7', 0.35, 0.87, 1.35], ['a4', 0.7, 1.22, 1.7]].map(([k, a, rel, b]) => {
    const act = R.mixer.clipAction(THREE.AnimationClip.parse(throws[k]));
    act.setLoop(THREE.LoopOnce); act.clampWhenFinished = true;
    return { act, a, rel, b };
  });
  R.ride = R.mixer.clipAction(THREE.AnimationClip.parse(clips.ride));
  return { leo: L, raphTop: R };
}

function startRun() {
  Object.assign(G, { state: 'countdown', time: 0, left: MISSION.time, score: 0, wrecks: 0, combo: 1, comboT: 0, bestCombo: 1,
    timeScale: 1, hitStop: 0, shake: 0, orbT: 4, power: null, strike: null, knockT: 0, cleared: false, countT: 3.2, spawnT: 0, hp: SHELL_MAX, hurtV: 0, slowT: 0 });
  for (const list of [shots, waves, bolts, zaps]) { for (const x of list) stage.remove(x.m || x.mesh); list.length = 0; }
  endBuff();
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
  if (touching) ai.fireT = Math.max(ai.fireT, 1.4);
  const canFire = G.state === 'play' && ai.mode !== 'flee' && rel > 10 && rel < 70;
  e.charge = canFire && ai.fireT < 0.7 ? 1 - ai.fireT / 0.7 : 0;
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
      hitEnemy(e, (RAM.base + vc * RAM.perSpeed) * (G.strike ? 1 : 1), _p, toE);
      G.shake = Math.max(G.shake, Math.min(0.6, vc * 0.05));
      e.ai.mode = 'cruise'; e.ai.t = rand(0.8, 1.6);
    } else {
      knocked(vc);
    }
  }
  // grinding: holding the lean into a car keeps tearing it up
  if (G.leanNow * toE > 0.3 && e.alive) {
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
    hitEnemy(e, RAM.base + vc * RAM.rearPerSpeed, _p, 0);
    G.shake = Math.max(G.shake, 0.3);
  } else if (!wagonBehind && vc > 2) knocked(vc * 0.7);
}

function knocked(vc) {
  if (G.knockT > 0) return;
  G.knockT = 0.6;
  player.vs = Math.max(SPEED.start * 0.7, player.vs - vc * 0.8);
  player.flash = 0.6; player.bounce = 0.5;
  G.shake = Math.max(G.shake, 0.55);
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
  if (dmg > 14) G.hitStop = Math.max(G.hitStop, 0.045);
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
  G.hitStop = Math.max(G.hitStop, big ? 0.12 : 0.08);
  G.shake = Math.max(G.shake, big ? 1 : 0.7);
  flash(0.35);
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

function walls(c, dt) {
  const lim = HW - c.W / 2 - 0.1;
  if (Math.abs(c.u) <= lim) return;
  const side = Math.sign(c.u);
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
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex[kind], color: new THREE.Color(1.25, 1.25, 1.25) }));
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
      if (BUFFS[o.kind]) startBuff(o.kind);
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
        fx.sparks(_p, _n.set(0, 0, 0), 24, 1.4);
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
const BUFFS = { raph: { name: 'SAI STORM', dur: 8 }, mike: { name: 'PIZZA CANNON', dur: 8 }, donnie: { name: 'ELECTRO FIELD', dur: 7 } };
const BUFF_RING = { raph: new THREE.Color(1.6, 0.18, 0.12), mike: new THREE.Color(1.6, 0.6, 0.08), donnie: new THREE.Color(0.8, 0.4, 1.8) };
const FIELD_R = 12;
const bolts = [];   // pizzas in flight
const zaps = [];    // lightning arcs, a frame or two each
let turret = null, field = null, buffIcon = null;
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
  // Mikey's cannon, bolted to the roof
  turret = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2c38 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xff8a1e, emissive: 0x401a00 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 14), dark); base.position.y = 0.15; turret.add(base);
  const head = new THREE.Group(); head.position.y = 0.55; turret.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.55, 1), orange));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.6, 12), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.05, -0.95); head.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.08, 8, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.3) }));
  muzzle.position.set(0, 0.05, -1.75); head.add(muzzle);
  turret.userData.head = head;
  turret.position.set(0, models.wagon.roofY - 0.05, 0.3);
  turret.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  turret.visible = false;
  player.body.add(turret);
  // Donnie's field: a rim-lit dome around the wagon plus a ring on the road
  field = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float rim = pow(1.0 - abs(dot(vN, vV)), 2.5); float band = smoothstep(0.92, 1.0, sin(vP.y * 18.0 - uT * 9.0) * 0.5 + 0.5); float a = rim * 0.5 + band * 0.08; gl_FragColor = vec4(vec3(0.75, 0.45, 1.6) * a, a); }',
  }));
  // the visible shell sits inside the camera's distance (seen from inside it washed the screen out)
  dome.scale.set(7, 4.2, 7);
  field.add(dome); field.userData.dome = dome;
  const ring = new THREE.Mesh(new THREE.RingGeometry(FIELD_R - 0.35, FIELD_R, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 3.2), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; field.add(ring);
  field.visible = false;
  stage.add(field);
  // his head above the tail while it runs
  // on the back doors: the turtle's head inside a ring that drains with the time left
  buffIcon = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: headTex.mike }, uP: { value: 1 }, uCol: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float uP; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 d = vUv - 0.5; float r = length(d);
  vec4 c = vec4(0.0);
  if (r < 0.37) { c = texture2D(map, (d / 0.74) + 0.5); }
  else if (r < 0.49) {
    float a = fract(atan(d.x, d.y) / 6.2831853 + 1.0);
    float on = step(a, uP);
    c = vec4(mix(vec3(0.03, 0.03, 0.05), uCol, on), 0.9);
    c.a *= smoothstep(0.49, 0.475, r) * smoothstep(0.37, 0.385, r);
  }
  gl_FragColor = c;
}`,
  }));
  buffIcon.position.set(0, player.H * 0.58, player.L / 2 + 0.06);
  buffIcon.renderOrder = 2;
  buffIcon.visible = false;
  player.group.add(buffIcon);
  pizzaMat = new THREE.MeshBasicMaterial({ map: pizzaTexture(), color: new THREE.Color(1.5, 1.4, 1.3) });
  pizzaGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.14, 18);
  zapMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.75, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

function startBuff(kind) {
  const b = BUFFS[kind];
  G.buff = { kind, t: b.dur, dur: b.dur, fireT: 0.15 };
  turret.visible = kind === 'mike';
  field.visible = kind === 'donnie';
  raphTop.holder.visible = kind === 'raph';
  if (kind === 'raph') { raphTop.cur = -1; raphTop.next = 0; raphTop.ride.reset().play(); }
  buffIcon.material.uniforms.map.value = headTex[kind];
  buffIcon.material.uniforms.uCol.value.copy(BUFF_RING[kind]);
  buffIcon.visible = true;
  banner({ raph: 'SAI STORM!', mike: 'PIZZA TIME!', donnie: 'ELECTRO FIELD!' }[kind], kind);
  audio.raph();
  G.powersUsed = (G.powersUsed || 0) + 1;
}
function endBuff() {
  G.buff = null;
  if (turret) { turret.visible = false; field.visible = false; buffIcon.visible = false; raphTop.holder.visible = false; raphTop.mixer.stopAllAction(); }
}

// one lightning arc: a jagged cross-shaped ribbon (two strips) so it reads from any angle
function makeZap(a, b) {
  const N = 9, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, j = i === 0 || i === N ? 0 : 1;
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(_n.set((Math.random() - 0.5) * 1.4 * j, (Math.random() - 0.5) * 1.2 * j, (Math.random() - 0.5) * 1.4 * j)));
  }
  const pos = [], idx = [];
  for (const [ox, oy] of [[0, 0.2], [0.2, 0]]) {
    const k0 = pos.length / 3;
    pts.forEach((p) => pos.push(p.x - ox, p.y - oy, p.z, p.x + ox, p.y + oy, p.z));
    for (let i = 0; i < N; i++) { const k = k0 + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, zapMat); m.frustumCulled = false;
  stage.add(m);
  zaps.push({ m, life: 0.16 });
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
    if (tgt) {
      const lp = player.group.worldToLocal(_c.copy(tgt.group.position));
      const want = Math.atan2(lp.x - R.holder.position.x, lp.z - R.holder.position.z) + Math.PI;
      let dy = want - R.holder.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      R.holder.rotation.y += dy * Math.min(1, dt * 12);
    }
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
    const head = turret.userData.head;
    let want = 0;
    if (tgt) {
      const lp = player.body.worldToLocal(_c.copy(tgt.group.position));
      want = Math.atan2(-lp.x, -lp.z);
    }
    head.rotation.y += (want - head.rotation.y) * Math.min(1, dt * 14);
    head.position.y = 0.55 + Math.max(0, B.fireT - 0.3) * 0.6;   // recoil kick
    if (tgt && B.fireT <= 0) {
      B.fireT = 0.42;
      const m = new THREE.Mesh(pizzaGeo, pizzaMat);
      head.updateMatrixWorld();
      m.position.set(0, 0.05, -1.8).applyMatrix4(head.matrixWorld);
      stage.add(m);
      frameAt(player.s, _T, _R);
      const v = new THREE.Vector3().copy(_T).multiplyScalar(player.vs + 20); v.y = 9;
      bolts.push({ m, v, target: tgt, t: 0, dmg: 20, splash: 8, label: "PIZZA'D!", trail: 0xff9a2a, spin: 'flat' });
      fx.add.emit(m.position, _n.set(0, 0, 0), new THREE.Color(0xffb040), 2.2, 0.1, { grow: 0.5 });
      audio.scrape();
    }
  } else if (B.kind === 'donnie') {
    field.position.copy(player.group.position);
    field.userData.dome.material.uniforms.uT.value = G.time;
    field.userData.dome.scale.y = 4.2 + Math.sin(G.time * 30) * 0.15;
    // zap up to two of the nearest cars inside the field, every 0.2 s
    if (B.fireT <= 0) {
      B.fireT = 0.2;
      const near = foot.filter((e) => Math.hypot(rel(e), e.u - player.u) < FIELD_R + e.L / 2).sort((a, b) => Math.hypot(rel(a), a.u - player.u) - Math.hypot(rel(b), b.u - player.u)).slice(0, 2);
      for (const e of near) {
        _p.copy(e.group.position).setY(1.2);
        makeZap(player.group.position.clone().setY(player.H + 0.6), _p.clone());
        fx.sparks(_p, _n.set(0, 0, 0), 10, 0.8);
        hitEnemy(e, 13, _p, Math.sign(e.u - player.u) || 1, 'ZAPPED!');
        e.vu += Math.sign(e.u - player.u || 1) * 4;
      }
      if (near.length) audio.scrape();
    }
    // the field fries shuriken before they reach the shell
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (Math.hypot(s.s - player.s, s.u - player.u) < FIELD_R) {
        makeZap(player.group.position.clone().setY(player.H + 0.6), s.m.position.clone());
        fx.sparks(s.m.position, _n.set(0, 0, 0), 8, 0.6);
        stage.remove(s.m); shots.splice(i, 1);
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
  bolts.push({ m, v, target: tgt, t: 0, dmg: 28, splash: 12, label: 'SAI!', trail: 0xff3b2e, spin: 'sai' });
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
    d.v.lerp(to.normalize().multiplyScalar(Math.max(65, player.vs + 30)), Math.min(1, dt * (2.5 + d.t * 10)));
    d.m.position.addScaledVector(d.v, dt);
    if (d.spin === 'flat') { d.m.rotation.y += dt * 20; d.m.rotation.z = 0.35; }
    else { d.m.lookAt(_l.copy(d.m.position).add(d.v)); d.m.rotateX(d.t * 40); }
    if (Math.random() < dt * 50) fx.add.emit(d.m.position, _n.set(0, 0, 0), new THREE.Color(d.trail), 0.5, 0.22, { grow: -0.6 });
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
const shotGeo = new THREE.OctahedronGeometry(0.75, 0); shotGeo.scale(1, 0.25, 1);
const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 0.5, 3.2) });
function fireShot(e) {
  const m = new THREE.Mesh(shotGeo, shotMat);
  stage.add(m);
  const s = e.s - e.L / 2 - 0.5, closing = 24;
  const t = Math.max(0.4, (s - player.s) / closing);
  G.shotsFired = (G.shotsFired || 0) + 1;
  shots.push({ m, s, u: e.u, vs: player.vs - closing, vu: clamp((player.u - e.u) / t, -9, 9), dmg: e.kind === 'truck' ? 14 : 9, from: e, life: 0 });
  audio.scrape();
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const b = shots[i];
    b.life += dt;
    b.s += b.vs * dt; b.u += b.vu * dt;
    pointAt(b.s, b.u, b.m.position).setY(1.15);
    b.m.rotation.y += dt * 18;
    if (Math.random() < dt * 40) fx.add.emit(b.m.position, _n.set(0, 0.5, 0), new THREE.Color(0xff4ad2), 0.5, 0.25, { grow: -0.5 });
    let gone = false;
    if (Math.abs(b.s - player.s) < player.L / 2 + 0.4 && Math.abs(b.u - player.u) < player.W / 2 + 0.4 && G.state === 'play') {
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
  if (G.state !== 'play') return;
  G.hp = Math.max(0, G.hp - dmg);
  player.flash = 1; player.bounce = 0.5;
  G.shake = Math.max(G.shake, 0.6);
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
    if (k >= 1) {
      if (e.alive) wreckEnemy(e, st.side, st.i === 0 ? 'KATANA!' : st.i === 1 ? 'DOUBLE CUT!' : 'TRIPLE CUT!', true);
      flash(0.3);
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
  grade.uniforms.uSpeed.value = G.state === 'play' ? 0.35 + sp * 0.65 : 0;
  camera.fov += (baseFov + sp * 12 - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  $('speedlines').style.opacity = G.state === 'play' ? (0.04 + sp * 0.18).toFixed(2) : 0;
  if (G.state === 'play') G.shake = Math.max(G.shake, 0.05 + sp * 0.05);
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
  if (G.shake > 0) camera.position.add(_n.set((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake));
  camera.lookAt(camLook);
  // sun and its shadow box ride along with the wagon
  sun.position.copy(player.group.position).add(_n.set(-22, 40, 12));
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
  if (G.hitStop > 0) { G.hitStop -= realDt; updateCamera(realDt); fx.update(realDt * 0.15); render(); return; }
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
  const cruise = SPEED.start + (SPEED.top - SPEED.start) * clamp(G.time / SPEED.rampTime, 0, 1);
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
        enemyAI(e, dt);
        e.s += e.vs * dt; e.u += e.vu * dt;
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
  if (player.wreck) player.stepWreck(dt); else player.place(dt);
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
  updateShots(dt); updateWaves(dt); updateBuff(dt);
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
window.__game = { G, get player() { return player; }, enemies, orbs, camera, waves, bolts, zaps, shots, startBuff, get leo() { return leo; }, get raphTop() { return raphTop; }, sky, scene, stage, renderer, composer, get world() { return world; } };
