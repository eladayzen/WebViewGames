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
  GRADE_ACCEL, DRAG, CARVE_SCRUB, TUCK_BONUS, TUCK_SMOOTH, START_SPEED,
  BRAKE_DRAG, BRAKE_SMOOTH, BRAKE_MIN_SPEED, BRAKE_SPARK_RATE, GROUND_CTRL_RELEASE, GROUND_CTRL_LETGO,
  TAIL_LOAD_RATE, TAIL_LOAD_DECAY, TAIL_LOAD_BOOST,
  SPEED_REF, CARVE_CURVE, CARVE_SMOOTH,
  THETA_MAX, THETA_GRAVITY, THETA_CARVE_TORQUE, THETA_DAMP, HEIGHT_EXCHANGE,
  TROUGH_RADIUS,
  AIR_DURATION, AIR_HEIGHT, SPIN_MIN_HEIGHT,
  AIR_HEIGHT_BASE, AIR_SPEED_FLOOR, AIR_SPEED_GAIN, BACKFLIP_MIN_HEIGHT,
  AIR_HEIGHT_MAX, AIR_TIME_K, AIR_DURATION_MIN, AIR_DURATION_MAX, SPIN_720_HEIGHT,
  GRAB_MIN_HEIGHT, GRAB_ENABLED,
  AIR_DURATION_HOP, AIR_HEIGHT_HOP, GRIND_MAX_CROSS_RATIO, GRIND_SPARK_RATE,
  GRIND_EXIT_FALL_G,
  LAND_SETTLE_DURATION, LAND_SETTLE_PEAK, LAND_K_FLOOR, LAND_K_GAIN,
  LAND_DURATION_FLOOR, LAND_DURATION_GAIN,
  LAND_AMOUNT_BACKFLIP, LAND_AMOUNT_SPIN, LAND_AMOUNT_GRIND,
  LAND_AMOUNT_HOP, LAND_AMOUNT_PLAIN,
  SKY_TOP, SKY_BOTTOM, FOG_COLOR, FOG_NEAR, FOG_FAR, FOV_BASE,
} from '../data/constants.js';
import { initInput, readInput, forcePop } from '../input/input.js';
import { createTrough, toWorld, surfaceUp, heightAt, frameAt, makeFrame, radiusAt } from '../world/trough.js';
import { createRider } from '../entities/rider.js';
import { createCameraRig } from '../camera/cameraRig.js';
import { createLobby } from '../ui/lobby.js';
import { initSettingsPanel, isPanelOpen, FEEL } from '../ui/settingsPanel.js';
import { createSky } from '../world/sky.js';
import { createProps } from '../entities/props.js';
import { createSparks } from '../entities/sparks.js';
import { createSpeedLines } from '../entities/speedLines.js';
import { createScoring } from '../systems/scoring.js';
import { createHud } from '../ui/hud.js';
import { CONTROLS, setControlPreset } from '../data/controlPresets.js';
import { createEvents, RIDE_EVENTS as EV } from './events.js';
import { createModeHost, getMode } from '../modes/mode.js';
// Importing a mode module is what REGISTERS it -- and the registry is what the
// lobby builds its buttons from. So this list is the single place that decides
// which modes exist; there is no second list to keep in sync. Order here is the
// order they appear on the front door.
import '../modes/freeride.js';
import { setPendingMission } from '../modes/missions.js';
import { MISSIONS } from '../data/missions.js';
import { createProgress } from '../systems/progress.js';
import { createModeSelect } from '../ui/modeSelect.js';
import { createMissionSelect } from '../ui/missionSelect.js';
import { createObjectives } from '../ui/objectives.js';
import { getCourse, DEFAULT_COURSE } from '../data/courses.js';

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
const sparks = createSparks(scene);
const speedLines = createSpeedLines(scene);
const scoring = createScoring();
const hud = createHud();
const rider = createRider(scene, camera);
const rig = createCameraRig(camera);
// The controller reports what happened; game modes listen. Nothing downstream
// of this line may reach back into the simulation -- see core/events.js.
const events = createEvents();
const objectivesUi = createObjectives();
// Stars and unlocks. Local today, account data in the shipped product -- the
// whole point of it being a module is that swapping the backing store touches
// only that file (see systems/progress.js).
const progress = createProgress(MISSIONS.map((m) => m.id));

// The mode is handed a read-only view of the ride and a way to END it, and
// nothing else. Everything it wants to know arrives through `events`.
const modes = createModeHost({
  events,
  scoring,
  hud,
  getState: () => ({ s: state.s, speed: state.speed, airborne: state.airActive }),
  progress,
  endRun: (reason, card) => showGameOver(reason, card),
});

// --- run state --------------------------------------------------------------
const state = {
  s: 0, // distance down the trough
  sPrev: 0, // last frame's s -- the ramp-lip crossing test needs the interval
  theta: 0, // angle around the cross-section; 0 = the floor, +-THETA_MAX = the lip
  thetaVel: 0,
  height: 0, // R*(1-cos theta) -- how far up the wall, drives speed exchange
  speed: START_SPEED,
  carve: 0,
  neutralTime: 0,
  tucking: 0,
  braking: 0,
  tailLoad: 0, // stored tail compression, spent on the next launch
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
  grindFallVel: 0, // downward speed of the drop off a rail, in lift-fraction/s
  // Which way the board swings side-on for the boardslide. Locked in at entry
  // from the direction the rider was already drifting, so the twist continues
  // his momentum instead of snapping against it; +1 if he arrived dead straight.
  grindYawSign: 1,
  spinDir: 1, // which way a spin rotates -- set from lateral drift at takeoff
  spinTurns: 1, // whole revolutions this spin does -- see SPIN_720_HEIGHT
  // Height of the launch ramp deck the rider is standing on right now.
  rampLift: 0,
  // Landing absorb. landT counts down from LAND_SETTLE_DURATION; landAmount is
  // how hard THIS landing hit (see the LAND_AMOUNT_* table). Kept apart so the
  // envelope shape is one piece of code and only its scale varies by trick.
  landT: 0,
  landAmount: 0,
  landDuration: LAND_SETTLE_DURATION,
  // A grind exit isn't an air, so there's no airT to watch for touchdown --
  // this flags that the rider is still settling off a rail, and the absorb
  // fires when grindLift has actually decayed back to the surface.
  grindLanding: false,
};

// What separates a HUGE AIR from an ordinary one, in launch points. Defined
// once because the on-screen popup and the missions mode's objective must agree
// -- a mission asking for something the banner never calls by that name is a
// mission the player cannot tell they are making progress on.
const HUGE_AIR_POINTS = 250;

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
// Scratch for the grind spark emission -- own pool, not shared with the
// placement vectors above, which are still live when these are used.
const _spark = new THREE.Vector3();
const _sparkBack = new THREE.Vector3();

/**
 * The landing absorb as a single 0..1 signal: how compressed the rider is right
 * now. Zero when not landing, peaking shortly after touchdown, back to zero as
 * he pushes upright again.
 *
 * Shaped asymmetrically on purpose. A symmetric curve reads as a gentle bob;
 * an impact is a fast squash followed by a slower recovery, so the peak sits
 * early (LAND_SETTLE_PEAK) and the ride back up takes the rest of the window.
 * Both halves are smoothstepped so there's no corner at the peak.
 */
function landPose() {
  if (state.landT <= 0) return 0;
  const p = 1 - state.landT / state.landDuration; // 0 at touchdown -> 1 at end
  const x = p < LAND_SETTLE_PEAK
    ? p / LAND_SETTLE_PEAK
    : 1 - (p - LAND_SETTLE_PEAK) / (1 - LAND_SETTLE_PEAK);
  // Map the trick's strength into the crouch scale's MONOTONIC band rather
  // than using it as a raw 0..1 multiplier -- see the dead-zone measurements in
  // constants.js. The envelope then rides that scale from neutral up to it and
  // back, so the returned value peaks at kPeak (which is >1 by design: it is a
  // multiplier on the LAND_*_BEND pair, not a fraction of it).
  const kPeak = LAND_K_FLOOR + state.landAmount * LAND_K_GAIN;
  return kPeak * x * x * (3 - 2 * x); // smoothstep
}

/**
 * The same envelope, but scaled by the RAW impact rather than the leg-crouch
 * scale. The spine curl uses this so heavy and light landings actually differ:
 * the legs saturate, the torso doesn't.
 */
function landCurl() {
  if (state.landT <= 0) return 0;
  const p = 1 - state.landT / state.landDuration;
  const x = p < LAND_SETTLE_PEAK
    ? p / LAND_SETTLE_PEAK
    : 1 - (p - LAND_SETTLE_PEAK) / (1 - LAND_SETTLE_PEAK);
  return state.landAmount * x * x * (3 - 2 * x);
}

/**
 * The landing envelope's SHAPE alone, 0..1, with no trick-strength scaling.
 *
 * landPose() and landCurl() are both scaled by how hard the landing was, which
 * is right for the crouch and the spine curl -- a backflip should land heavier
 * than an ollie. It is wrong for the arms: Amit wants high hands on EVERY
 * landing, and scaling by amount made a plain jump raise them by 0.07 against
 * a backflip's much larger lift. So the arms read the bare shape.
 */
function landEnv() {
  if (state.landT <= 0) return 0;
  const p = 1 - state.landT / state.landDuration;
  const x = p < LAND_SETTLE_PEAK
    ? p / LAND_SETTLE_PEAK
    : 1 - (p - LAND_SETTLE_PEAK) / (1 - LAND_SETTLE_PEAK);
  return x * x * (3 - 2 * x);
}

/** Begin a landing absorb of the given strength (0..1). */
function beginLanding(amount) {
  state.landAmount = amount;
  // Heavier landings take longer to recover from, which is the other half of
  // telling them apart once the leg fold has saturated.
  state.landDuration = LAND_SETTLE_DURATION * (LAND_DURATION_FLOOR + amount * LAND_DURATION_GAIN);
  state.landT = state.landDuration;
}

function reset() {
  state.s = 0;
  state.sPrev = 0;
  state.theta = 0;
  state.thetaVel = 0;
  state.height = 0;
  state.speed = START_SPEED;
  state.carve = 0;
  state.neutralTime = 0;
  state.tucking = 0;
  state.braking = 0;
  state.tailLoad = 0;
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
  state.grindFallVel = 0;
  state.spinDir = 1;
  state.spinTurns = 1;
  state.rampLift = 0;
  state.landT = 0;
  state.landAmount = 0;
  state.landDuration = LAND_SETTLE_DURATION;
  state.grindLanding = false;
  autoTrickTimer = 0;
  rig.reset();
  props.reset();
  scoring.reset();
  hud.reset(); // the score readout counts UP, so a new run must start it at zero
  props.update(0);
}

/**
 * Start one air event -- ollie, grind-exit, or ramp launch all funnel through
 * here so the trick decision lives in exactly one place.
 *
 * THE HEIGHT DECIDES THE TRICK, not the other way round. Amit: "the height of
 * the jump needs to be calculated based on the action movement of the boy, and
 * if it hits a minimum threshold then enable doing a backflip."
 *
 * So: work out how much air this launch actually earned (ramp strength x how
 * fast the rider was going), and only if it clears BACKFLIP_MIN_HEIGHT is a
 * flip possible. That inverts the old model, where a random roll picked a trick
 * and the trick then dictated a fixed height -- meaning a feeble ollie could
 * produce the same towering backflip as a full-speed hit on the big kicker.
 *
 * Right now every qualifying jump flips, per "for now every time you can do a
 * backflip do a backflip". The random/conditional layer he mentioned wanting
 * later goes exactly here, gated behind the same `canFlip` check.
 */
function beginAir(power, points, forcedTrick, launchLabel) {
  // How much air this launch earned. Speed never contributes zero -- a crawling
  // rider still gets some pop, just never enough to reach the flip threshold.
  const speedFactor = AIR_SPEED_FLOOR
    + AIR_SPEED_GAIN * Math.min(1.2, state.speed / SPEED_REF);
  // A loaded tail pops higher. This is what makes the brake a setup move rather
  // than only a way to slow down: compress into the lip and the jump is bigger.
  const loadBoost = 1 + state.tailLoad * TAIL_LOAD_BOOST;
  const earnedHeight = AIR_HEIGHT_BASE * power * power * speedFactor * loadBoost;

  // THE TRAJECTORY DECIDES THE TRICK, and nothing else does.
  //
  // Amit: "whatever height you reached, whatever the trajectory is when you jump
  // -- that's what determines what stunt you're going to do." So this is a
  // straight ladder on the one number the launch actually produced. Speed and
  // ramp shape feed the height; the height picks the trick; no other input gets
  // a vote.
  //
  // The bands are set against what each launcher can actually reach, at
  // AIR_HEIGHT_BASE 1.40 * power^2 * speedFactor (0.45..1.11) * loadBoost (1..1.22):
  //
  //     kicker    power 1.0    0.63 .. 1.90     plain, or a spin if hit well
  //     bank      power 1.2    0.91 .. 2.73     plain when slow, else spin
  //     bigKicker power 1.42   1.27 .. 3.83     spin (360, or 720 above 2.6)
  //     barrel    power 1.9    2.27 .. 6.73     flip ONLY if carrying speed
  //
  // The full ladder, by height: nothing under 1.6, a 360 to 2.6, a 720 to 4.4,
  // a backflip above that. A GRAB tier sits below the spin at 0.95 but is
  // switched off -- the ladder is right, the pose is not yet. See GRAB_ENABLED.
  //
  // Note the bands OVERLAP on purpose. Which trick you get is not a property of
  // the ramp you hit -- it is a property of how you hit it, which is the only
  // version of this that rewards the approach.
  //
  // That is the whole point of the change. Every ramp on the course used to
  // clear the old 2.2 bar, so a backflip came out of a knee-high kicker -- the
  // rotation was never earned. Now the ordinary ramps spin, and the flip belongs
  // to the one launcher tall enough to justify it, and only when hit fast.
  //
  // THE WHOLE SCALE CAME DOWN with the bar. A first pass put the flip at 6.8,
  // which worked but launched the rider ~7.6 units up -- far too high to read as
  // a skateboard trick. The binding constraint was the tail-load boost pushing a
  // loaded big kicker to 6.19, so the bar had to clear that; trimming the boost
  // and the base height lets the bar sit at 4.4 with a typical flip around 5.0.
  // The barrel needs a speedFactor of ~0.87 to clear it -- about 23 u/s -- so
  // carving the approach away still leaves you spinning.
  const trick = forcedTrick !== undefined
    ? forcedTrick
    : earnedHeight >= BACKFLIP_MIN_HEIGHT ? 'backflip'
      : earnedHeight >= SPIN_MIN_HEIGHT ? 'spin'
        : (GRAB_ENABLED && earnedHeight >= GRAB_MIN_HEIGHT) ? 'grab'
          : null;
  // Spin the way he was already going -- rotating against your own drift reads
  // as the animation fighting the physics.
  if (trick === 'spin') {
    state.spinDir = Math.sign(state.thetaVel) || 1;
    // Rotation from the same height that chose the trick. A bank scrape turns
    // once; a full-speed big kicker turns twice.
    state.spinTurns = earnedHeight >= SPIN_720_HEIGHT ? 2 : 1;
  }

  state.airActive = true;
  state.airT = 0;
  // Spent, not retained -- otherwise one well-timed compression would boost
  // every launch for the rest of the run.
  state.tailLoad = 0;
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
  if (trick === 'hop') {
    // The hop-over is a fixed, deliberate save move: it has to clear a
    // 0.52-0.62 rail by a believable margin regardless of how fast you hit it.
    // The only launch whose height is NOT earned, and so the only one whose air
    // time is still authored.
    state.airHeight = AIR_HEIGHT_HOP;
    state.airDuration = AIR_DURATION_HOP;
  } else {
    // EVERY other launch: the earned height is the jump, and the hang time
    // follows from it. One rule for the plain jump, the spin and the flip alike
    // -- a trick no longer changes the arc it happens inside, it just decides
    // what the rider does up there. See AIR_TIME_K in constants.js.
    state.airHeight = Math.min(earnedHeight, AIR_HEIGHT_MAX);
    state.airDuration = Math.max(AIR_DURATION_MIN,
      Math.min(AIR_DURATION_MAX, AIR_TIME_K * Math.sqrt(state.airHeight)));
  }

  // Reported AFTER height and duration are settled, so a listener sees the
  // finished jump rather than a half-decided one.
  events.emit(EV.LAUNCH, {
    launcher: launchLabel, power, height: state.airHeight, trick,
  });
  if (trick === 'hop') events.emit(EV.HOP, { label: launchLabel });
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
  // The lab lobby no longer starts runs -- the mode front door does. Closing
  // the lab mid-run must not restart the run underneath it, and closing it at
  // boot must not skip the mode choice.
  () => {},
);

// --- the front door ---------------------------------------------------------
// Only choice here is the mode. A mode with levels goes on to pick one; a mode
// without them starts immediately.
const modeSelect = createModeSelect((id) => {
  if (id === 'missions') missionSelect.open();
  else startRun(id);
});

// --- mission select ---------------------------------------------------------
// Shown after choosing MISSIONS, and again after every result.
const missionSelect = createMissionSelect(MISSIONS, progress, (missionId) => {
  setPendingMission(missionId);
  startRun('missions');
});

/** @param {string} id a registered mode id */
function startRun(id) {
  const def = getMode(id);
  // The course decides what may spawn -- hazards are absent from every course
  // today, which is how "no cones by default" is expressed as data rather than
  // as a hard-coded filter inside the spawner.
  const course = getCourse(def.course || DEFAULT_COURSE);
  props.setAllowedKinds(course.allowedKinds);
  // The speed-based fail state is opt-in per mode, and no mode wants it today.
  // Kept whole rather than deleted so a survival mode can switch it back on
  // with one flag -- see systems/scoring.js for why it is a mode question.
  scoring.setWobbleEnabled(!!def.wobble);
  hud.setWobbleVisible(!!def.wobble);
  running = true;
  reset();
  modes.start(id);
}

// Automation and quick iteration: ?gamemode=missions drops straight into a run.
// (`?mode=` is already taken by the rider render mode, hence the longer name.)
{
  const wanted = new URLSearchParams(location.search).get('gamemode');
  if (wanted) {
    modeSelect.close();
    startRun(wanted);
  }
}

// --- game over --------------------------------------------------------------
// Death used to banner "WIPEOUT" and call reset() on the same frame, so a run
// simply restarted under the player with no end at all -- and, just as
// importantly, the SDK's restart path had nothing to click. The host watches
// #gameover-overlay for the `hidden` class and only synth-clicks
// #restart-button while it's visible; on-device that click plus Space/Enter is
// the ENTIRE way out, since the WebView forwards no pointer.
let gameOver = false;
const gameoverEl = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('final-score');
const finalBreakdownEl = document.getElementById('final-breakdown');
const restartButton = document.getElementById('restart-button');

const goInnerEl = document.querySelector('.go-inner');
const goTitleEl = document.querySelector('.go-title');
const goSubtitleEl = document.getElementById('go-subtitle');
const goStarsEl = document.getElementById('go-stars');
const goRecapEl = document.getElementById('go-recap');

/**
 * @param {'wipeout'|'timeup'|'complete'} [reason]
 * @param {{tone?:string, title:string, subtitle?:string, detail?:string,
 *          stars?:number, rows?:Array}} [card] what the mode wants said.
 *
 * A mode ending a run for its own reasons owns the whole screen: the verdict,
 * its tone, the star rating and the objective recap. A wipeout is the ride's
 * own ending and falls back to the distance/speed summary.
 *
 * WHY THE SCORE SHRINKS. In a mission the score is not the result -- the list
 * is. Leaving a 68px score as the biggest thing on screen told the player the
 * opposite of what the mode is about, so a card carrying a recap gets the
 * `compact` treatment and the number drops to a footnote under it.
 */
function showGameOver(reason = 'wipeout', card = null) {
  if (gameOver) return; // the death flag stays set; only fire the screen once
  gameOver = true;
  const sc = scoring.state;
  const km = (state.s / 1000).toFixed(2);

  const tone = card ? (card.tone || 'fail') : 'fail';
  goInnerEl.classList.toggle('fail', tone === 'fail');
  goInnerEl.classList.toggle('success', tone === 'success');
  // The backdrop tints too, and reads its tone from the overlay rather than
  // from this child -- see the CSS note on why :has() is not used here.
  gameoverEl.classList.toggle('fail', tone === 'fail');

  goTitleEl.textContent = card ? card.title : 'WIPEOUT';
  goSubtitleEl.textContent = card && card.subtitle ? card.subtitle : '';

  // --- stars ---
  const stars = card && typeof card.stars === 'number' ? card.stars : null;
  goStarsEl.classList.toggle('hidden', stars === null);
  if (stars !== null) {
    [...goStarsEl.children].forEach((el, i) => {
      el.classList.toggle('earned', i < stars);
      // Staggered so they land one at a time -- three stars appearing together
      // is a state, three arriving in sequence is an event.
      el.style.animationDelay = `${0.12 + i * 0.16}s`;
    });
  }

  // --- objective recap ---
  const rows = card && card.rows ? card.rows : null;
  goRecapEl.classList.toggle('hidden', !rows);
  goRecapEl.innerHTML = '';
  if (rows) {
    for (const r of rows) {
      const li = document.createElement('li');
      li.className = r.done ? 'done' : 'missed';
      li.innerHTML = `<span>${r.label}</span><b>${r.text}</b>`;
      goRecapEl.appendChild(li);
    }
  }
  goInnerEl.classList.toggle('compact', !!rows);

  finalScoreEl.textContent = Math.round(sc.score).toLocaleString();
  finalBreakdownEl.textContent = card && card.detail
    ? card.detail
    : `${km} km ridden  \u00b7  top ${Math.round(sc.topSpeed * 2.6)} km/h`;

  // The button names the action, not the screen. After a failure the honest
  // word is RETRY -- you are doing the same mission again, not moving on.
  // Name the destination, not the mood: in missions this button opens the
  // mission list, so RETRY would be a lie -- you land on a screen, not a run.
  restartButton.textContent = modes.id === 'missions' ? 'CONTINUE'
    : tone === 'success' ? 'CONTINUE' : 'RETRY';

  gameoverEl.classList.remove('hidden');
  events.emit(EV.RUN_END, {
    reason, score: Math.round(sc.score), distance: state.s,
  });
}

function restart() {
  if (!gameOver) return;
  gameOver = false;
  gameoverEl.classList.add('hidden');
  if (modes.id === 'missions') {
    // Back to the list, not straight into another run. Finishing a mission
    // should show what it unlocked, and it is the only place to choose a
    // different one -- a result screen that restarts in place gives the player
    // no way out except the back button.
    modes.stop();
    running = false;
    missionSelect.open();
    return;
  }
  reset();
  // Same mode again -- and a fresh instance of it, so counters and clocks start
  // clean rather than resuming a run that already ended.
  modes.restart();
}

restartButton.addEventListener('click', restart);
// Space/Enter restart too: they're the only keys the host forwards, and the
// settings panel deliberately stands down while this overlay is up so it can't
// swallow them.
window.addEventListener('keydown', (e) => {
  if (!gameOver) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    restart();
  }
});

// --- pause ------------------------------------------------------------------
// Freezes the simulation but keeps rendering, so the frozen frame stays on
// screen rather than going black. dt still advances the clock; the sim block
// below is simply skipped.
let paused = false;
{
  const pauseButton = document.getElementById('pause-button');
  const pausedBadge = document.getElementById('paused-badge');
  if (pauseButton) {
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      pauseButton.innerHTML = paused ? '&#9654;' : '&#9208;';
      if (pausedBadge) pausedBadge.classList.toggle('hidden', !paused);
    });
  }
}

// Live settings panel. Initialised AFTER the lobby on purpose: the lobby's
// onChange fires once during its own construction and writes the control
// preset, so a panel built earlier would have its stored preference silently
// overwritten on every boot.
initSettingsPanel({ openLab: () => lobby.open() });

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

  if (running && !paused && !gameOver && !lobby.isOpen() && !modeSelect.isOpen() && !missionSelect.isOpen() && !isPanelOpen()) {
    const { carve, tuck, brake, pop } = readInput();

    // SOFT tilt response (see constants.js). Two stages:
    //   1. shape it   -- |carve|^CARVE_CURVE, sign kept. Flattens the region
    //      around neutral so small involuntary stance wobble barely steers,
    //      while a committed lean still reaches full authority.
    //   2. ease it    -- exponential approach rather than applying instantly,
    //      which also smooths everything downstream, since the camera roll,
    //      the speed scrub and the body lean all read this same value.
    // Read through FEEL, not the constants directly, so the settings panel can
    // retune these mid-run -- the board is the only place either can be judged.
    const shaped = Math.sign(carve) * Math.pow(Math.abs(carve), FEEL.carveCurve);
    state.carve += (shaped - state.carve) * (1 - Math.exp(-FEEL.carveSmooth * dt));

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
    // The fore/aft axis is now a real control: lean FORWARD to tuck and gain
    // speed, lean BACK to drag the tail and slow down.
    //
    // This supersedes the old design where the tuck was emergent -- earned by
    // holding a straight line for TUCK_DWELL seconds. That existed because the
    // build doc ruled the fore/aft axis out as physically hard on the board, so
    // "doing nothing" had to be the fast posture. It is a direct input now, but
    // note the axis is still the hard one, and it is now load-bearing rather
    // than optional.
    //
    // BOTH ARE CONTINUOUS AND EASED. The input scales the effect and the effect
    // ramps in over ~0.3s, so speed arrives and bleeds smoothly instead of
    // switching between two states -- "gaining speed in a natural way, not
    // stepped".
    const absCarve = Math.abs(state.carve);

    // STATE PRIORITY. Tuck and brake are GROUND controls, and they yield
    // completely whenever a bigger state owns the rider: airborne, mid-grind,
    // or absorbing a landing. Amit: gliding, jumping and landing should each
    // take over completely rather than being something the tuck pose is mixed
    // into.
    //
    // Gating at the SOURCE rather than in the poses is what makes that true
    // everywhere at once -- `tucking` and `braking` drive the accel bonus, the
    // brake drag, the tail load, the tail sparks, the deck pitch AND the body
    // pose, so suppressing them here covers the physics as well as the look.
    // Suppressing only the poses would have left an airborne rider silently
    // still accelerating.
    const groundControl = !state.airActive && !state.grind && state.landT <= 0;
    const tuckTarget = groundControl ? tuck : 0;
    const brakeTarget = groundControl ? brake : 0;
    // Release faster than it engages, so handing over to a jump or a grind
    // reads as committing to that rather than as the tuck fading out.
    // Three distinct rates, because the three transitions mean different things:
    // engaging is a build, letting go should visibly end it, and being
    // overridden should look like the rider committing to the new state.
    const tuckRate = !groundControl ? GROUND_CTRL_RELEASE
      : (tuck > state.tucking ? TUCK_SMOOTH : GROUND_CTRL_LETGO);
    const brakeRate = !groundControl ? GROUND_CTRL_RELEASE
      : (brake > state.braking ? BRAKE_SMOOTH : GROUND_CTRL_LETGO);
    state.tucking += (tuckTarget - state.tucking) * (1 - Math.exp(-tuckRate * dt));
    state.braking += (brakeTarget - state.braking) * (1 - Math.exp(-brakeRate * dt));

    // TAIL LOAD: braking compresses the board, and the stored load boosts the
    // next launch (see beginAir). Charges while braking, bleeds once released,
    // so it has to be timed into a ramp rather than held indefinitely.
    if (state.braking > 0.05) {
      state.tailLoad = Math.min(1, state.tailLoad + state.braking * TAIL_LOAD_RATE * dt);
    } else {
      state.tailLoad = Math.max(0, state.tailLoad - TAIL_LOAD_DECAY * dt);
    }

    const accel =
      GRADE_ACCEL
      + TUCK_BONUS * state.tucking
      - DRAG * state.speed * state.speed
      - CONTROLS.carveScrub * absCarve * state.speed;
    state.speed = Math.max(2, state.speed + accel * dt);
    // Brake drag is PROPORTIONAL to speed, so it bites hard when you're flying
    // and can't yank a slow rider to a standstill; the floor stops it stalling
    // him entirely, since a dead stop is a fail state, not a brake.
    if (state.braking > 0.01 && state.speed > BRAKE_MIN_SPEED) {
      const shed = state.speed * BRAKE_DRAG * state.braking * dt;
      state.speed = Math.max(BRAKE_MIN_SPEED, state.speed - shed);
    }
    // Keep last frame's distance: the ramp-lip test in props.probe() needs the
    // INTERVAL the rider swept this frame, not just where they ended up, so a
    // fast pass over a short kicker can't skip the lip entirely.
    state.sPrev = state.s;
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
        // Captured BEFORE the reset below, because the LAND event further down
        // reports it and state.airPoints is zeroed here.
        const airPoints = state.airPoints;
        const landedTrick = state.airTrick;
        const landedSpinTurns = landedTrick === 'spin' ? state.spinTurns : 0;
        const huge = airPoints >= HUGE_AIR_POINTS;
        if (state.airPoints > 0) {
          const airLabel = landedSpinTurns ? `${landedSpinTurns * 360}`
            : landedTrick === 'grab' ? 'GRAB'
              : (huge ? 'HUGE AIR' : 'AIR');
          scoring.award(state.airPoints, airLabel);
          state.airPoints = 0;
        }
        // A trick's rotation is synced 1:1 to airT, so it lands exactly as it
        // completes (rider.js). This is the extra beat right after: a brief
        // absorb-and-recover wobble, ordinary jumps don't get.
        // ABSORB ON EVERY LANDING, not just tricks. Scale by what was just
        // pulled off -- a backflip lands hardest, a hop barely at all.
        beginLanding(landedTrick === 'backflip' ? LAND_AMOUNT_BACKFLIP
          : landedTrick === 'spin' ? LAND_AMOUNT_SPIN
          : landedTrick === 'hop' ? LAND_AMOUNT_HOP
          : LAND_AMOUNT_PLAIN);
        // A rotation only counts once it has actually been landed -- reporting
        // it at launch would credit a trick the rider never completed.
        if (landedTrick && landedTrick !== 'hop') {
          events.emit(EV.TRICK, {
            type: landedTrick, height: state.airHeight, turns: landedSpinTurns,
          });
        }
        // HEIGHT AND POINTS TRAVEL WITH THE LANDING. Without them a mode could
        // only ask "did you land", never "did you land something big" -- and the
        // missions mode was already asking exactly that, silently failing every
        // frame because the field it tested did not exist.
        events.emit(EV.LAND, {
          trick: landedTrick, amount: state.landAmount,
          height: state.airHeight, points: airPoints, huge,
        });
        state.airTrick = null;
      }
    }
    if (state.landT > 0) state.landT = Math.max(0, state.landT - dt);

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
        events.emit(EV.GRIND, {
          label: g.def.label, seconds: state.grindTime,
          points: Math.round(state.grindPoints),
        });
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
        //
        // The absorb can't fire here though -- he's still up at rail height and
        // hasn't touched anything yet. Flag it and let the check below trigger
        // when grindLift has actually decayed back down.
        state.grindLanding = true;
      }
    }

    // Rail-height lift: eased, not snapped, toward 1 while grinding and back to
    // 0 once the grind ends. This is BOTH asks at once -- rising quickly reads
    // as "a very small jump" onto the rail, and easing back down on exit reads
    // as a physical settle rather than a launched hop.
    {
      if (state.grind) {
        // Mounting is still an ease -- that's the "very small jump" up onto the
        // rail, and it should look assisted rather than ballistic.
        state.grindLift += (1 - state.grindLift) * Math.min(1, dt * (1 / 0.14));
        state.grindFallVel = 0;
      } else if (state.grindLift > 0) {
        // Coming off is a real DROP, not a decay. grindLift is a fraction of
        // the rail's height, so gravity has to be expressed in the same units
        // -- divide by that height, and the fall then takes the physically
        // correct sqrt(2h/g) regardless of how tall the rail was.
        const g = GRIND_EXIT_FALL_G / Math.max(0.2, state.grindLiftHeight);
        state.grindFallVel += g * dt;
        state.grindLift = Math.max(0, state.grindLift - state.grindFallVel * dt);
      }
      // TOUCHDOWN off a rail: fire the absorb when he actually reaches the
      // surface, not when the grind ended -- otherwise he crouches while still
      // in the air above it.
      if (state.grindLanding && state.grindLift <= 0) {
        state.grindLanding = false;
        beginLanding(LAND_AMOUNT_GRIND);
      }
    }

    // Ramp deck height. ASYMMETRIC on purpose: rising, it snaps to the exact
    // geometric height so the board tracks the ramp face with no lag or
    // sinking; falling, it eases, which is what carries the rider off the
    // takeoff smoothly instead of dropping them a ramp-height in one frame the
    // instant they go airborne. The ease-down is hidden under the air arc,
    // which is already climbing over the same moment.
    {
      const rampTarget = state.airActive || state.grind
        ? 0
        : props.rampHeightAt(state.s, state.theta);
      if (rampTarget >= state.rampLift) state.rampLift = rampTarget;
      else state.rampLift += (rampTarget - state.rampLift) * Math.min(1, dt * (1 / 0.16));
    }

    // --- prop interaction ----------------------------------------------
    // props.update() is what actually spawns new patterns as the rider
    // advances (build doc §6) -- without this call every frame, the world
    // stops generating past the first SPAWN_AHEAD stretch, which is exactly
    // the "I see stuff at the start, then nothing" symptom.
    props.update(state.s, dt);
    if (!state.grind) {
      // How high off the surface the rider actually is. The same three offsets
      // the render pass adds below -- air arc, ramp deck, rail top -- because a
      // pickup floating overhead has to be judged against where the rider IS,
      // not where their (s, theta) is. NOTE state.height is the TROUGH WALL's
      // height at this position, a different quantity entirely; using it here
      // was the first version of this line and it is always 0 at the bottom.
      const lift = (state.airActive ? Math.sin(state.airT * Math.PI) * state.airHeight : 0)
        + state.rampLift
        + state.grindLift * state.grindLiftHeight;
      const hit = props.probe(state.s, state.theta, state.airActive, state.sPrev, lift);
      if (hit) {
        if (hit.def.kind === 'launch') {
          // Ramps and banks auto-launch on contact -- no button, no tap. This
          // is the "hit something that isn't a cone and my player automatically
          // does something cool" behaviour: kickers/banks are the "something
          // cool happens" case, cones/potholes/barriers are the "that hurts"
          // case, and the two are told apart by kind, not by a player input.
          beginAir(hit.def.launch.power, hit.def.launch.points, undefined, hit.def.label);
          // Take off from the FULL lip height. The crossing test fires on the
          // first frame at or past the takeoff, which can be up to ~0.5 units
          // beyond it at speed -- by which point rampHeightAt() already reads
          // zero for a wedge (whose apex IS its far edge) and the ease-down has
          // begun, so the arc was starting ~0.2 below the lip. Pinning it here
          // means the jump always leaves from the top of the ramp, and the
          // existing ease handles the descent from there.
          state.rampLift = hit.def.size.h;
          hit.spent = true;
          hud.banner(hit.def.label);
        } else if (hit.def.kind === 'grind' && state.airActive && state.airTrick) {
          // MID-TRICK: leave it alone. Landing into a grind is normally a happy
          // accident, but interrupting a flip kills airActive instantly, which
          // zeroes the rotation and snaps a half-turned rider upright in one
          // frame (measured: caught at 3.43 rad -- a half rotation -- then gone).
          // That was rare while flips were a 35% roll; now that every qualifying
          // jump flips it would be constant. Let the flip finish; the rail is
          // still there to be caught on a later pass.
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
            beginAir(1.0, 90, 'hop', hit.def.label);
            // DELIBERATELY NOT `spent`. Hopping a rail must not consume it:
            // `spent` is permanent and drops the prop from probe() entirely, so
            // a rail you skipped over crosswise lost its collider for good and
            // could never be grinded on a later approach -- and rails are 14-28
            // units long while a hop only covers ~10-17, so landing back on the
            // same one is routine, not a corner case.
            //
            // The debounce that flag was standing in for is already handled,
            // and more precisely: the mid-trick branch above refuses grind
            // entry for as long as a trick is rotating, and airActive/airTrick
            // are cleared in the SAME frame on landing, so there is no gap
            // where a hop could re-trigger itself. Once he's down, a crosswise
            // approach hops again and an aligned one grinds -- which is the
            // whole point of the angle gate.
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
            // Swing the board side-on the way he was already drifting. Below a
            // small deadzone he arrived straight enough that either direction
            // is arbitrary, so keep whichever was used last rather than letting
            // near-zero noise pick a side.
            if (Math.abs(state.thetaVel) > 0.02) {
              state.grindYawSign = Math.sign(state.thetaVel);
            }
            hud.banner(hit.def.label);
          }
        } else if (hit.def.kind === 'pickup') {
          // Collected. Hidden rather than recycled immediately so the pool and
          // the recycle pass stay in charge of its lifetime -- `spent` already
          // means "no longer interactive" everywhere else in this file.
          events.emit(EV.PICKUP, { type: hit.def.pickup.type, points: hit.def.pickup.points });
          scoring.award(hit.def.pickup.points, hit.def.label);
          hit.mesh.visible = false;
          hit.spent = true;
        } else if (hit.def.kind === 'hazard') {
          events.emit(EV.HAZARD, { label: hit.def.label, wobble: hit.def.hazard.wobble });
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
    if (scoring.state.dead) showGameOver('wipeout');

    // The mode ticks LAST, after everything the ride reports this frame has
    // already been emitted -- so a mission that completes on this frame's
    // pickup ends now rather than a frame late, and its clock never runs on a
    // frame the rider was not actually riding (pause, lobby, game over all
    // skip this whole block).
    modes.update(dt);

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
  if (state.rampLift > 0.001) {
    // Stand the rider on the ramp deck. Added along the SURFACE NORMAL like
    // every other offset here, so a ramp sitting up the trough wall lifts the
    // rider away from that wall rather than straight up in world space.
    surfaceUp(state.s, state.theta, _up);
    _pos.addScaledVector(_up, state.rampLift);
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
    braking: state.braking,
    tailLoad: state.tailLoad,
    airActive: state.airActive,
    airT: state.airT,
    airTrick: state.airTrick,
    landPose: landPose(),
    landCurl: landCurl(),
    landEnv: landEnv(),
    swing: swingScale,
    theta: state.theta,
    surfaceUp: _up,
    forward: _fwd,
    // The boardslide pose rides the SAME eased 0..1 signal as the rail-height
    // lift, so the rider twists side-on exactly as he rises onto the rail and
    // unwinds as he settles back off it -- one motion, not two that have to be
    // kept in sync. `grinding` is the raw contact flag, which the push-clip
    // lockout needs separately: the pose is still unwinding for a moment after
    // contact ends, but the lockout's own tail starts counting from here.
    // Signed lateral drift in world units/s. The arm balance needs this as well
    // as carve, because the pendulum lets the two disagree -- carving one way
    // while still travelling the other is precisely when a rider is fighting to
    // stay over the board.
    lateral: state.thetaVel * radiusAt(state.s),
    wobble: scoring.state.wobble,
    grindPose: state.grindLift,
    grindYawSign: state.grindYawSign,
    spinDir: state.spinDir,
    spinTurns: state.spinTurns,
    grinding: !!state.grind,
  };

  // Camera shake ramps with the wobble meter, so the fail state is FELT coming
  // for a couple of seconds rather than sprung (build doc §5.3's warning ramp).
  // With wobble ON, shake is a DANGER read: it ramps as the meter approaches
  // the kill. With it off there is no danger to telegraph, so a much gentler
  // tremble comes off raw overspeed instead -- speed should still feel like
  // something, it just no longer means you are about to die.
  view.shake = scoring.wobbleEnabled
    ? Math.max(0, (scoring.state.wobble - 55) / 45)
    : Math.min(0.35, Math.max(0, (state.speed / SPEED_REF - 1.0) / 0.4));

  rider.update(view, dt);

  // GRIND SPARKS. Struck at the board's actual underside, which has to be read
  // AFTER rider.update() has placed it for this frame -- the deck's position is
  // derived from the animated foot bones plus the crouch compensation, so
  // anything sampled earlier would trail a frame behind the pose.
  //
  // Emission is gated on real contact (state.grind), not on the eased pose, so
  // the shower stops the instant the rider leaves the rail even though he's
  // still visibly untwisting for a moment afterwards. Sparks already in flight
  // finish their own lives, which is the tail that sells it.
  if (state.grind) {
    rider.contactPoint(_spark);
    _sparkBack.copy(_fwd).negate();
    sparks.emit(_spark, _sparkBack, _up, state.speed, GRIND_SPARK_RATE, dt);
  } else if (state.braking > 0.15 && !state.airActive && state.speed > BRAKE_MIN_SPEED + 1) {
    // TAIL DRAG sparks. Struck off the back edge of the deck rather than under
    // its middle, and at a lower rate than a grind -- this is friction against
    // a surface, not steel on steel. Gated on real speed too: scraping a tail
    // while barely moving should not throw sparks.
    rider.tailPoint(_spark);
    _sparkBack.copy(_fwd).negate();
    sparks.emit(_spark, _sparkBack, _up, state.speed,
      BRAKE_SPARK_RATE * state.braking, dt);
  }
  sparks.update(dt);

  rig.update(view, dt);

  // Speed lines last, AFTER the camera rig has moved this frame -- they're
  // built from the camera's matrix, so reading it a frame stale would leave
  // them lagging behind every turn.
  // Speed lines are a SPEED cue and are now fed as one. They used to read the
  // wobble meter, which happened to correlate with speed -- so with wobble off
  // they would have vanished entirely at exactly the moment the rider is
  // fastest. Zero below ~0.78x reference, full a little past the tuck terminal.
  speedLines.update(
    (state.speed / SPEED_REF - 0.78) / 0.42, state.speed, camera, paused ? 0 : dt,
  );

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
  objectivesUi.update(modes.panel());
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
window.__lab = { scene, camera, rider, state, THREE, sparks, props, renderer, radiusAt, speedLines, events, modes, startRun, scoring, progress, missionSelect };

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
