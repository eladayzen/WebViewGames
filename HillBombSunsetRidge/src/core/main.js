// Hill Bomb: Sunset Ridge — RENDER LAB
//
// This is the POC from the build doc (§2, §10), reshaped into a comparison
// harness. It runs the real carve/speed model and the real camera on a
// deliberately basic environment, and lets the RIDER LAYER be swapped live.
//
// It exists to settle one question before any art gets committed (build doc
// §12): a flat sprite billboard always faces the camera, so when the camera
// swings around a trick, does the sprite still read -- or does it look like a
// card spinning in place? Mode A vs Mode B answers that by eye in seconds.
//
// Secondary questions it also answers: does an UNRIGGED 3D character (all Kolbo
// gives us -- verified skins:0/animations:0) carry a skate game on whole-body
// transforms alone; and does a PBR character read better lit or unlit against
// flat illustrated surroundings.

import * as THREE from 'three';
import {
  GRADE_ACCEL, DRAG, CARVE_SCRUB, TUCK_BONUS, TUCK_DWELL, START_SPEED,
  LATERAL_SPEED, TURN_LOSS, SPEED_REF, ROAD_HALF_WIDTH,
  AIR_DURATION, AIR_HEIGHT,
  SKY_TOP, SKY_BOTTOM, FOG_COLOR, FOG_NEAR, FOG_FAR, FOV_BASE,
} from '../data/constants.js';
import { initInput, readInput, forcePop } from '../input/input.js';
import { createRoad, toWorld, centerline } from '../road/road.js';
import { createRider } from '../entities/rider.js';
import { createCameraRig } from '../camera/cameraRig.js';
import { createLobby } from '../ui/lobby.js';

// --- renderer / scene -------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(FOV_BASE, window.innerWidth / window.innerHeight, 0.1, 900);

// Sky as a big vertical-gradient backdrop. fog:false so it stays visible at
// distance, the way a skybox is conventionally exempted from scene fog
// (HalfShellHustle does the same for its skyline matte).
{
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + SKY_TOP.toString(16).padStart(6, '0'));
  g.addColorStop(1, '#' + SKY_BOTTOM.toString(16).padStart(6, '0'));
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}

// Lights exist for the 'lit' toggle only; unlit materials ignore them.
scene.add(new THREE.HemisphereLight(0xffe0b0, 0x6a5a44, 2.1));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
sun.position.set(-30, 60, 20);
scene.add(sun);

// --- world ------------------------------------------------------------------
const road = createRoad(scene);
const rider = createRider(scene, camera);
const rig = createCameraRig(camera);

// --- run state --------------------------------------------------------------
const state = {
  s: 0, // distance down the road
  u: 0, // lateral offset from centerline
  speed: START_SPEED,
  carve: 0,
  neutralTime: 0,
  tucking: 0,
  airActive: false,
  airT: 0,
};

let swingScale = 1;
let running = false;
let autoTrick = false;
let autoTrickTimer = 0;

const _pos = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function reset() {
  state.s = 0;
  state.u = 0;
  state.speed = START_SPEED;
  state.carve = 0;
  state.neutralTime = 0;
  state.tucking = 0;
  state.airActive = false;
  state.airT = 0;
  autoTrickTimer = 0;
  rig.reset();
}

// --- lobby ------------------------------------------------------------------
const lobby = createLobby(
  (config) => {
    rider.setMode(config.mode);
    const lit = config.lighting === 'lit';
    rider.setLit(lit);
    road.setLit(lit);
    swingScale = config.swing === 'full' ? 1 : config.swing === 'half' ? 0.45 : 0;
    autoTrick = config.autotrick === 'on';
    renderer.setPixelRatio(
      config.texres === '1024' ? Math.min(window.devicePixelRatio, 2)
        : config.texres === '512' ? 1 : 0.6,
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
  },
  () => {
    running = true;
    reset();
  },
);

// --- HUD --------------------------------------------------------------------
const speedReadout = document.getElementById('speed-readout');
const perfReadout = document.getElementById('perf-readout');
let fpsAccum = 0;
let fpsFrames = 0;
let fpsTimer = 0;

// --- loop -------------------------------------------------------------------
initInput();
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());

  if (running && !lobby.isOpen()) {
    const { carve, pop } = readInput();
    state.carve = carve;

    // Auto-trick keeps a hands-free loop running so the camera swing can be
    // watched repeatedly without holding an input.
    if (autoTrick) {
      autoTrickTimer -= dt;
      if (autoTrickTimer <= 0 && !state.airActive) {
        forcePop();
        autoTrickTimer = 3.2;
      }
    }

    // --- trick window ---
    if (pop && !state.airActive) {
      state.airActive = true;
      state.airT = 0;
    }
    if (state.airActive) {
      state.airT += dt / AIR_DURATION;
      if (state.airT >= 1) {
        state.airActive = false;
        state.airT = 0;
        rig.onLand();
      }
    }

    // --- speed model (build doc §5.1) ---
    // Speed comes from DOING NOTHING: holding the board neutral means a
    // straight line, an automatic tuck, and acceleration. There is no forward
    // lean anywhere in this design -- that axis is physically hard on the board
    // (build doc §0), so the restful posture is the fast/risky one instead.
    const absCarve = Math.abs(state.carve);
    if (absCarve < 0.12) state.neutralTime += dt;
    else state.neutralTime = 0;
    const wantTuck = state.neutralTime > TUCK_DWELL ? 1 : 0;
    state.tucking += (wantTuck - state.tucking) * Math.min(1, dt * 4);

    const accel =
      GRADE_ACCEL
      + TUCK_BONUS * state.tucking
      - DRAG * state.speed * state.speed
      - CARVE_SCRUB * absCarve * state.speed;
    state.speed = Math.max(2, state.speed + accel * dt);

    state.s += state.speed * dt;

    // --- lateral motion: turn authority drops as speed rises ---
    const speedN = Math.min(1, state.speed / SPEED_REF);
    const authority = 1 - TURN_LOSS * speedN;
    state.u += state.carve * LATERAL_SPEED * authority * dt;
    state.u = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, state.u));

    road.update(state.s);
  }

  // --- place the rider ---
  toWorld(state.s, state.u, _pos);
  if (state.airActive) {
    _pos.y += Math.sin(state.airT * Math.PI) * AIR_HEIGHT;
  }

  // Yaw from the local road tangent so the rider faces down-road through curves.
  centerline(state.s - 1, _a);
  centerline(state.s + 1, _b);
  const yaw = Math.atan2(_a.x - _b.x, _a.z - _b.z);

  const view = {
    pos: _pos,
    yaw,
    carve: state.carve,
    speed: state.speed,
    tucking: state.tucking,
    airActive: state.airActive,
    airT: state.airT,
    swing: swingScale,
  };

  rider.update(view, dt);
  rig.update(view, dt);

  renderer.render(scene, camera);

  // --- HUD ---
  fpsAccum += dt;
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer > 0.25) {
    const fps = fpsFrames / fpsAccum;
    perfReadout.textContent = `${fps.toFixed(0)} fps · ${(state.speed).toFixed(0)} u/s`;
    fpsAccum = 0;
    fpsFrames = 0;
    fpsTimer = 0;
  }
  speedReadout.textContent = `${Math.round(state.speed * 2.6)} km/h`;
}

// Debug handle for the render lab. Lets a console (or an automated check) read
// live state and poke at bones without adding UI -- e.g. verifying that skeletal
// animation is genuinely advancing rather than the mesh being frozen.
window.__lab = { scene, camera, rider, state, THREE };

// Road needs one build before the first frame so nothing pops in.
road.update(0);
rider.ready.then(() => {
  if (!rider.modelAvailable) {
    document.querySelector('[data-mode="model"] small').textContent =
      'FAILED TO LOAD — check src/assets/rider.glb';
  }
  const rigNote = document.querySelector('[data-mode="rigged"] small');
  if (rigNote) {
    rigNote.textContent = rider.rigAvailable
      ? `Mixamo rig + re-applied PBR maps. Clips: ${rider.clipNames.join(', ')}.`
      : 'FAILED TO LOAD — check src/assets/rig/';
  }
});
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
