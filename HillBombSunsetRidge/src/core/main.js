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
  AIR_DURATION, AIR_HEIGHT, AIR_DURATION_HIGH, AIR_HEIGHT_HIGH, HIGH_JUMP_CHANCE,
  AIR_DURATION_BACKFLIP, AIR_HEIGHT_BACKFLIP,
  AIR_DURATION_HOP, AIR_HEIGHT_HOP, GRIND_MAX_CROSS_RATIO,
  TRICK_LAND_SETTLE_DURATION,
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
  airTrick: null, // null | 'backflip' | 'spin' -- set once at launch, read by rider.js
  airHeight: AIR_HEIGHT, // per-jump, since regular and high jumps differ
  airDuration: AIR_DURATION,
  grind: null, // the prop being ground, if any
  grindTime: 0,
  grindPoints: 0,
  // How much of the current/last grind's rail-height offset is applied right
  // now, 0..1 -- eased toward 1 while grinding (the "very small jump" onto the
  // rail) and toward 0 once it ends (a physical settle back to the surface,
  // NOT a launched air arc). grindLiftHeight is the target rail's own height,
  // captured once on entry so the fraction still has something sensible to
  // multiply against while it eases back down after grind exits.
  grindLift: 0,
  grindLiftHeight: 0,
  trickLandT: 0, // counts down after a TRICK (backflip/spin) landing, for the settle wobble
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
  state.airTrick = null;
  state.airHeight = AIR_HEIGHT;
  state.airDuration = AIR_DURATION;
  state.grind = null;
  state.grindTime = 0;
  state.grindPoints = 0;
  state.grindLift = 0;
  state.grindLiftHeight = 0;
  state.trickLandT = 0;
  autoTrickTimer = 0;
  rig.reset();
  props.reset();
  scoring.reset();
  props.update(0);
}

/**
 * Start one air event -- ollie, grind-exit, or ramp launch all funnel through
 * here so the high-jump roll lives in exactly one place.
 *
 * Two jump types (Amit, direct): a REGULAR jump (what launches already did,
 * just much less altitude than before) and a rarer HIGH JUMP with a procedural
 * whole-body backflip or spin, since there are no baked animations for either
 * trick. Which one happens is a placeholder random roll for now -- "random
 * between them, it doesn't matter how, we'll have real triggers or pickups for
 * that later" -- so HIGH_JUMP_CHANCE is the one thing to swap out for a real
 * trigger (a held input, a specific ramp, a pickup) when one exists.
 */
function beginAir(power, points, forcedTrick) {
  const trick = forcedTrick !== undefined
    ? forcedTrick
    : (Math.random() < HIGH_JUMP_CHANCE ? (Math.random() < 0.5 ? 'backflip' : 'spin') : null);
  state.airActive = true;
  state.airT = 0;
  state.airPower = power;
  state.airPoints = points;
  state.airTrick = trick;

  // Duration is BAKED here rather than multiplied by airPower each frame.
  //
  // A TRICK's air time is its own authored value, deliberately independent of
  // which ramp launched it: because rotation is locked 1:1 to air time, letting
  // a big ramp's power stretch the duration also silently slowed the flip. The
  // backflip was authored at 0.55s but measured 665-841ms in play for exactly
  // that reason. Tricks should feel the same every time you see them.
  //
  // An ORDINARY jump still scales with ramp power -- a bigger kicker giving a
  // longer air is correct, and there's no rotation riding on its timing.
  if (trick === 'backflip') {
    state.airHeight = AIR_HEIGHT_BACKFLIP;
    state.airDuration = AIR_DURATION_BACKFLIP;
  } else if (trick === 'spin') {
    state.airHeight = AIR_HEIGHT_HIGH;
    state.airDuration = AIR_DURATION_HIGH;
  } else if (trick === 'hop') {
    state.airHeight = AIR_HEIGHT_HOP;
    state.airDuration = AIR_DURATION_HOP;
  } else {
    state.airHeight = AIR_HEIGHT;
    state.airDuration = AIR_DURATION * power;
  }
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

    // --- air / landing ---------------------------------------------------
    // THIS ENTIRE SECTION (air/landing, grinding, and the props.update/probe
    // calls below) was accidentally deleted during the road->trough migration
    // -- a python find/replace anchored on this comment's text replaced
    // everything from here through "score / wobble" with the new theta
    // pendulum, silently dropping the interaction logic that used to live
    // here. Nothing has collided with anything since that commit: props were
    // spawned once at reset() (covering only s=0..SPAWN_AHEAD) and never
    // updated again, and probe() was never called at all. Restored below,
    // ported from (s, u) to (s, theta).
    if (pop && !state.airActive && !state.grind) {
      beginAir(0.72, 40); // a bare ollie: much smaller than a ramp launch
    }
    if (state.airActive) {
      state.airT += dt / state.airDuration; // power is already baked in by beginAir
      if (state.airT >= 1) {
        state.airActive = false;
        state.airT = 0;
        rig.onLand();
        scoring.land();
        // Landing clean pays out whatever the launch was worth. Deliberately
        // NO landing skill-check (build doc §5.5) -- the skill is choosing
        // where and when to launch, not a timed press.
        if (state.airPoints > 0) {
          scoring.award(state.airPoints, state.airPoints >= 250 ? 'HUGE AIR' : 'AIR');
          state.airPoints = 0;
        }
        // A trick's rotation is synced 1:1 to airT, so it lands exactly as it
        // completes (rider.js). This is the extra beat right after: a brief
        // absorb-and-recover wobble, ordinary jumps don't get.
        if (state.airTrick) state.trickLandT = TRICK_LAND_SETTLE_DURATION;
        state.airTrick = null;
      }
    }
    if (state.trickLandT > 0) state.trickLandT = Math.max(0, state.trickLandT - dt);

    // --- grinding ----------------------------------------------------------
    if (state.grind) {
      const g = state.grind;
      const half = g.def.size.l / 2;
      // Locked to the rail's line while on it -- that's what a grind IS.
      state.theta += (g.theta - state.theta) * Math.min(1, dt * 12);
      state.thetaVel = 0;
      state.grindTime += dt;
      state.grindPoints += g.def.grind.pointsPerSecond * dt;
      if (state.s > g.s + half) {
        scoring.award(Math.round(state.grindPoints), g.def.label);
        g.spent = true;
        state.grind = null;
        state.grindPoints = 0;
        state.grindTime = 0;
        // NO exit hop, per Amit direct: "for now, don't do a jump at all, just
        // straight-on physical fall back to the road." grindLift (below) eases
        // back to 0 on its own now that state.grind is null -- a settle, not a
        // launched arc -- and the ordinary theta pendulum (already running
        // whenever !state.grind) pulls the rider back toward the floor under
        // the same gravity as normal riding.
      }
    }

    // Rail-height lift: eased, not snapped, toward 1 while grinding and back to
    // 0 once the grind ends. This is BOTH asks at once -- rising quickly reads
    // as "a very small jump" onto the rail, and easing back down on exit reads
    // as a physical settle rather than a launched hop.
    {
      const liftTarget = state.grind ? 1 : 0;
      const liftRate = state.grind ? (1 / 0.14) : (1 / 0.22); // mount faster than settle
      state.grindLift += (liftTarget - state.grindLift) * Math.min(1, dt * liftRate);
    }

    // --- prop interaction ----------------------------------------------
    // props.update() is what actually spawns new patterns as the rider
    // advances (build doc §6) -- without this call every frame, the world
    // stops generating past the first SPAWN_AHEAD stretch, which is exactly
    // the "I see stuff at the start, then nothing" symptom.
    props.update(state.s);
    if (!state.grind) {
      const hit = props.probe(state.s, state.theta, state.airActive);
      if (hit) {
        if (hit.def.kind === 'launch') {
          // Ramps and banks auto-launch on contact -- no button, no tap. This
          // is the "hit something that isn't a cone and my player automatically
          // does something cool" behaviour: kickers/banks are the "something
          // cool happens" case, cones/potholes/barriers are the "that hurts"
          // case, and the two are told apart by kind, not by a player input.
          beginAir(hit.def.launch.power, hit.def.launch.points);
          hit.spent = true;
          hud.banner(hit.def.label);
        } else if (hit.def.kind === 'grind') {
          // APPROACH ANGLE GATE. Gliding a rail/ledge only makes sense if you
          // arrive roughly along it; snapping into a grind while cutting hard
          // across it reads as the obstacle magnetically grabbing you. So:
          // measure the crossing angle and, if it's too steep, flip sideways
          // OVER the obstacle instead of grinding it.
          //
          // lateral speed = |thetaVel| * local radius (angular rate around the
          // trough converted to world units); over forward speed that ratio is
          // tan(approach angle).
          const lateralSpeed = Math.abs(state.thetaVel) * radiusAt(state.s);
          const crossRatio = lateralSpeed / Math.max(1, state.speed);
          if (crossRatio > GRIND_MAX_CROSS_RATIO) {
            beginAir(1.0, 90, 'hop');
            hit.spent = true; // don't re-trigger on the next frame's overlap
            hud.banner('HOP OVER');
          } else {
            state.grind = hit;
            state.grindPoints = 0;
            state.grindTime = 0;
            state.airActive = false;
            state.airT = 0;
            // The rail's own mesh sits at y=h in buildRail (props.js) -- that's
            // how high its bar actually is off the trough surface. Without this,
            // the rider stood at plain surface height while the rail bar
            // rendered up around waist/pelvis height: "stuck between the
            // skateboard and the boy's pelvis." Lifting the rider by the SAME h
            // puts the board on top of the bar instead of the bar passing
            // through the rider.
            state.grindLiftHeight = hit.def.size.h;
            hud.banner(hit.def.label);
          }
        } else if (hit.def.kind === 'hazard') {
          scoring.hit(hit.def.hazard.wobble, hit.def.label);
          state.speed *= 1 - hit.def.hazard.scrub;
          hit.spent = true;
        }
      }
    }

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
    _pos.addScaledVector(_up, Math.sin(state.airT * Math.PI) * state.airHeight);
  }
  if (state.grindLift > 0.001) {
    // Lifts the rider onto TOP of the rail/ledge bar (see the grind-entry
    // comment above for why) -- eased by grindLift, so mounting and settling
    // off both move smoothly rather than snapping.
    surfaceUp(state.s, state.theta, _up);
    _pos.addScaledVector(_up, state.grindLift * state.grindLiftHeight);
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
    airTrick: state.airTrick,
    trickLandT: state.trickLandT,
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
