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
  SPEED_REF, CARVE_CURVE, CARVE_SMOOTH,
  THETA_MAX, THETA_GRAVITY, THETA_CARVE_TORQUE, THETA_DAMP, HEIGHT_EXCHANGE,
  TROUGH_RADIUS,
  AIR_DURATION, AIR_HEIGHT,
  SKY_TOP, SKY_BOTTOM, FOG_COLOR, FOG_NEAR, FOG_FAR, FOV_BASE,
} from '../data/constants.js';
import { initInput, readInput, forcePop } from '../input/input.js';
import { createTrough, toWorld, surfaceUp, heightAt, frameAt, makeFrame, radiusAt } from '../world/trough.js';
import { createRider } from '../entities/rider.js';
import { createCameraRig } from '../camera/cameraRig.js';
import { createLobby } from '../ui/lobby.js';
import { createSky } from '../world/sky.js';
import { createProps } from '../entities/props.js';
import { createScoring } from '../systems/scoring.js';
import { createHud } from '../ui/hud.js';
import { CONTROLS, setControlPreset } from '../data/controlPresets.js';

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
const trough = createTrough(scene);
const sky = createSky(scene);
const props = createProps(scene);
const scoring = createScoring();
const hud = createHud();
const rider = createRider(scene, camera);
const rig = createCameraRig(camera);

// --- run state --------------------------------------------------------------
const state = {
  s: 0, // distance down the trough
  theta: 0, // angle around the cross-section; 0 = the floor, +-THETA_MAX = the lip
  thetaVel: 0,
  height: 0, // R*(1-cos theta) -- how far up the wall, drives speed exchange
  speed: START_SPEED,
  carve: 0,
  neutralTime: 0,
  tucking: 0,
  airActive: false,
  airT: 0,
  airPower: 1,
  airPoints: 0,
  grind: null, // the prop being ground, if any
  grindTime: 0,
  grindPoints: 0,
};

let swingScale = 1;
let running = false;
let autoTrick = false;
let autoTrickTimer = 0;

const _pos = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _frame = makeFrame();

function reset() {
  state.s = 0;
  state.theta = 0;
  state.thetaVel = 0;
  state.height = 0;
  state.speed = START_SPEED;
  state.carve = 0;
  state.neutralTime = 0;
  state.tucking = 0;
  state.airActive = false;
  state.airT = 0;
  state.airPower = 1;
  state.airPoints = 0;
  state.grind = null;
  state.grindTime = 0;
  state.grindPoints = 0;
  autoTrickTimer = 0;
  rig.reset();
  props.reset();
  scoring.reset();
  props.update(0);
}

// --- lobby ------------------------------------------------------------------
const lobby = createLobby(
  (config) => {
    rider.setMode(config.mode);
    const lit = config.lighting === 'lit';
    rider.setLit(lit);
    trough.setLit(lit);
    swingScale = config.swing === 'full' ? 1 : config.swing === 'half' ? 0.45 : 0;
    autoTrick = config.autotrick === 'on';
    setControlPreset(config.controls);
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

    // SOFT tilt response (see constants.js). Two stages:
    //   1. shape it   -- |carve|^CARVE_CURVE, sign kept. Flattens the region
    //      around neutral so small involuntary stance wobble barely steers,
    //      while a committed lean still reaches full authority.
    //   2. ease it    -- exponential approach rather than applying instantly,
    //      which also smooths everything downstream, since the camera roll,
    //      the speed scrub and the body lean all read this same value.
    const shaped = Math.sign(carve) * Math.pow(Math.abs(carve), CARVE_CURVE);
    state.carve += (shaped - state.carve) * (1 - Math.exp(-CARVE_SMOOTH * dt));

    // Auto-trick keeps a hands-free loop running so the camera swing can be
    // watched repeatedly without holding an input.
    if (autoTrick) {
      autoTrickTimer -= dt;
      if (autoTrickTimer <= 0 && !state.airActive) {
        forcePop();
        autoTrickTimer = 3.2;
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
      - CONTROLS.carveScrub * absCarve * state.speed;
    state.speed = Math.max(2, state.speed + accel * dt);
    state.s += state.speed * dt;

    // --- theta: the pendulum around the trough (the core of the redesign) ---
    // Carve is a TORQUE driving the rider up the wall; gravity pulls back toward
    // the floor. Neutral input therefore settles in the trough, so the restful
    // posture stays the fast one -- the design's central inversion, preserved.
    //
    // Suspended while grinding: you're committed to the rail's line.
    if (!state.grind) {
      const R = radiusAt(state.s); // LOCAL radius -- gravity bites harder in a throat
      // CUSHIONED LIP, not a dead stop. Slamming theta to THETA_MAX and zeroing
      // the velocity is what read as "I just get blocked by the side". Instead
      // the wall stiffens as you approach the rim -- a transition steepening
      // toward vert, which is what a real half-pipe does -- so running out of
      // wall feels like the wall pushing back rather than hitting a barrier.
      const over = Math.abs(state.theta) - THETA_MAX * 0.82;
      const lipPush = over > 0
        ? -Math.sign(state.theta) * over * over * 46
        : 0;
      const thetaAcc =
        state.carve * CONTROLS.carveTorque
        - (THETA_GRAVITY / R) * Math.sin(state.theta)
        - CONTROLS.damp * state.thetaVel
        + lipPush;
      state.thetaVel += thetaAcc * dt;
      state.theta += state.thetaVel * dt;
      // Absolute backstop, well past where the cushion has already taken over.
      const hardLimit = THETA_MAX * 1.04;
      if (state.theta > hardLimit) { state.theta = hardLimit; state.thetaVel = Math.min(0, state.thetaVel); }
      if (state.theta < -hardLimit) { state.theta = -hardLimit; state.thetaVel = Math.max(0, state.thetaVel); }
    }

    // --- height <-> speed exchange -------------------------------------
    // Climbing the wall costs speed, dropping gives it back, exactly:
    //   v^2 -= 2*g*dh
    // Energy-based rather than a fudge, so pumping (dropping while already
    // descending) emerges on its own and wall-surfing is genuinely slow.
    const newHeight = heightAt(state.s, state.theta);
    const dh = newHeight - state.height;
    state.height = newHeight;
    const v2 = Math.max(4, state.speed * state.speed - 2 * CONTROLS.heightExchange * dh);
    state.speed = Math.sqrt(v2);

    // --- score / wobble -------------------------------------------------
    scoring.update(dt, state.speed, state.carve, !!state.grind);
    if (scoring.state.lastEvent) {
      const e = scoring.state.lastEvent;
      hud.popup(e.text, e.points);
      scoring.state.lastEvent = null;
    }
    if (scoring.state.dead) {
      hud.banner('WIPEOUT');
      reset();
    }

    trough.update(state.s);
  }

  // --- place the rider ---
  toWorld(state.s, state.theta, _pos);
  if (state.airActive) {
    // Air is along the SURFACE NORMAL now, not world-up -- so a launch off a
    // rolled section throws you away from the wall you left, which is what
    // makes a corkscrew readable rather than arbitrary.
    surfaceUp(state.s, state.theta, _up);
    _pos.addScaledVector(_up, Math.sin(state.airT * Math.PI) * AIR_HEIGHT);
  }

  // Forward is the trough's actual TANGENT, not a yaw-derived horizontal vector.
  // Mixing a world-horizontal forward with a rolled surface normal gives a
  // skewed basis -- which is exactly how the camera ended up outside the trough
  // looking in.
  const f = frameAt(state.s, _frame);
  _fwd.copy(f.tangent);
  surfaceUp(state.s, state.theta, _up);

  const view = {
    pos: _pos,
    carve: state.carve,
    speed: state.speed,
    tucking: state.tucking,
    airActive: state.airActive,
    airT: state.airT,
    swing: swingScale,
    theta: state.theta,
    surfaceUp: _up,
    forward: _fwd,
  };

  // Camera shake ramps with the wobble meter, so the fail state is FELT coming
  // for a couple of seconds rather than sprung (build doc §5.3's warning ramp).
  view.shake = Math.max(0, (scoring.state.wobble - 55) / 45);

  rider.update(view, dt);
  rig.update(view, dt);

  sky.update(camera.position);
  renderer.render(scene, camera);

  // --- HUD ---
  fpsAccum += dt;
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer > 0.25) {
    hud.fps(fpsFrames / fpsAccum, state.speed);
    fpsAccum = 0;
    fpsFrames = 0;
    fpsTimer = 0;
  }
  hud.update(dt, {
    speed: state.speed,
    score: scoring.state.score,
    wobble: scoring.state.wobble,
    chain: scoring.state.chain,
    chainTimer: scoring.state.chainTimer,
  });
}

// Debug handle for the render lab. Lets a console (or an automated check) read
// live state and poke at bones without adding UI -- e.g. verifying that skeletal
// animation is genuinely advancing rather than the mesh being frozen.
window.__lab = { scene, camera, rider, state, THREE };

// Road needs one build before the first frame so nothing pops in.
trough.update(0);
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
