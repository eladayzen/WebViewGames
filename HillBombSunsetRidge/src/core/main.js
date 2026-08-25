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
  GRADE, GRADE_ACCEL, DRAG, CARVE_SCRUB, TUCK_BONUS, TUCK_SMOOTH, START_SPEED, FUNNEL_SPACING,
  ROLL_GAIN, ROLL_MAX, ROLL_BRAKE_LOSS, MIN_SPEED,
  NATURAL_TOP_SPEED, SHAKE_SPAN, SHAKE_MAX,
  BRAKE_DRAG, BRAKE_SMOOTH, BRAKE_MIN_SPEED, BRAKE_SPARK_RATE, GROUND_CTRL_RELEASE, GROUND_CTRL_LETGO,
  TAIL_LOAD_RATE, TAIL_LOAD_DECAY, TAIL_LOAD_BOOST,
  SPEED_REF, CARVE_CURVE, CARVE_SMOOTH,
  AIR_DURATION, AIR_HEIGHT, SPIN_MIN_HEIGHT,
  AIR_HEIGHT_BASE, AIR_SPEED_FLOOR, AIR_SPEED_GAIN, BACKFLIP_MIN_HEIGHT,
  AIR_HEIGHT_MAX, AIR_TIME_K, AIR_DURATION_MIN, AIR_DURATION_MAX, SPIN_720_HEIGHT,
  AIR_G, HOVER_IN_RATE, HOVER_OUT_RATE, HOVER_FULL_LIFT,
  BOOST_RAMP,
  GRAB_MIN_HEIGHT, GRAB_ENABLED,
  AIR_DURATION_HOP, AIR_HEIGHT_HOP, GRIND_SPARK_RATE,
  GRIND_EASE_REF, GRIND_SNAP_RATE, GRIND_EASE_RATE,
  GRIND_EXIT_FALL_G,
  LAND_SETTLE_DURATION, LAND_SETTLE_PEAK, LAND_K_FLOOR, LAND_K_GAIN,
  LAND_DURATION_FLOOR, LAND_DURATION_GAIN,
  LAND_AMOUNT_BACKFLIP, LAND_AMOUNT_SPIN, LAND_AMOUNT_GRIND,
  LAND_AMOUNT_HOP, LAND_AMOUNT_PLAIN,
  SKY_TOP, SKY_BOTTOM, FOG_COLOR, FOG_NEAR, FOG_FAR, FOV_BASE,
  SKY_BLUE_TOP, SKY_BLUE_BOTTOM,
} from '../data/constants.js';
import { initInput, readInput, forcePop, setStance, getStance } from '../input/input.js';
import {
  createTrough, toWorld, surfaceUp, heightAt, frameAt, makeFrame, radiusAt,
  elevAt, slopeAt, curvatureAt, dropLipsBetween, routeSlopeAt,
} from '../world/trough.js';
import { createRider } from '../entities/rider.js';
import { createCameraRig } from '../camera/cameraRig.js';
import { createLobby } from '../ui/lobby.js';
import { initSettingsPanel, isPanelOpen, FEEL } from '../ui/settingsPanel.js';
import { createSky } from '../world/sky.js';
import { createProps } from '../entities/props.js';
import { createRivals } from '../entities/rivals.js';
import { createFinishLine } from '../entities/finishLine.js';
import { createSparks } from '../entities/sparks.js';
import { createSpeedLines } from '../entities/speedLines.js';
import { createScoring } from '../systems/scoring.js';
import { createHud } from '../ui/hud.js';
import { CONTROLS, setControlPreset } from '../data/controlPresets.js';
import { TERRAIN, setTerrain, DEFAULT_TERRAIN, LIP_CUSHION, LIP_WALL } from '../data/terrain.js';
import { createEvents, RIDE_EVENTS as EV } from './events.js';
import { createModeHost, getMode } from '../modes/mode.js';
// Importing a mode module is what REGISTERS it -- and the registry is what the
// lobby builds its buttons from. So this list is the single place that decides
// which modes exist; there is no second list to keep in sync. Order here is the
// order they appear on the front door.
import '../modes/freeride.js';
import { setPendingMission } from '../modes/missions.js';
import '../modes/rivals.js';
import '../modes/speedRace.js';
// ORDER IS LOBBY ORDER. The two ORIGINAL modes register first, then the open
// face's -- so the front door reads as two games rather than an interleaving.
import '../modes/faceMissions.js';
import '../modes/openFace.js';
import { MISSIONS } from '../data/missions.js';
import { createProgress } from '../systems/progress.js';
import { createModeSelect } from '../ui/modeSelect.js';
import { createMissionSelect } from '../ui/missionSelect.js';
import { createObjectives } from '../ui/objectives.js';
import { createBriefing } from '../ui/briefing.js';
import { getCourse, DEFAULT_COURSE } from '../data/courses.js';
import { pickRandomTheme, getTheme, DEFAULT_THEME } from '../data/themes.js';

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
// A baked canvas gradient, so a theme change has to REDRAW it rather than
// recolour it -- hence a function rather than an inline block.
let skyGradientTex = null;
function makeSkyGradient(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
  g.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // The previous one is not referenced by anything else once it is replaced,
  // and a run picks a new theme every time -- without this the GPU accumulates
  // one texture per run for the whole session.
  if (skyGradientTex) skyGradientTex.dispose();
  skyGradientTex = tex;
  return tex;
}
scene.background = makeSkyGradient(SKY_TOP, SKY_BOTTOM);

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
// After the rider: the AI field clones the player's rig, so it needs one.
const rivals = createRivals(scene, rider);
const finishLine = createFinishLine(scene);
// The controller reports what happened; game modes listen. Nothing downstream
// of this line may reach back into the simulation -- see core/events.js.
const events = createEvents();
const objectivesUi = createObjectives();
const briefing = createBriefing();
// Stars and unlocks. Local today, account data in the shipped product -- the
// whole point of it being a module is that swapping the backing store touches
// only that file (see systems/progress.js).
// TWO LADDERS. The ridge's original twenty and the open face's eight are
// separate progressions with separate front doors -- the face's first mission is
// open from the start rather than sitting behind twenty ridge missions. Stars
// and scores stay in one store; only the unlock rule is per-track.
const RIDGE_MISSIONS = MISSIONS.filter((m) => !m.course);
const FACE_MISSIONS = MISSIONS.filter((m) => m.course);
const progress = createProgress([
  RIDGE_MISSIONS.map((m) => m.id),
  FACE_MISSIONS.map((m) => m.id),
]);

// The mode is handed a read-only view of the ride and a way to END it, and
// nothing else. Everything it wants to know arrives through `events`.
const modes = createModeHost({
  events,
  scoring,
  hud,
  getState: () => ({ s: state.s, speed: state.speed, airborne: state.airActive }),
  progress,
  // The AI field. Handed to the mode rather than owned by it, so its lifetime
  // is the run's and nothing survives into free ride.
  rivals,
  finishLine,
  endRun: (reason, card) => showGameOver(reason, card),
});

// --- run state --------------------------------------------------------------
const state = {
  s: 0, // distance down the trough
  sPrev: 0, // last frame's s -- the ramp-lip crossing test needs the interval
  theta: 0, // angle around the cross-section; 0 = the floor, +-TERRAIN.thetaMax = the lip
  thetaVel: 0,
  // Ballistic flight. airY is the rider's actual world height while airborne
  // and airVel its rate of change -- the whole of the air, with no arc, no
  // authored flight time and no reference to the ground they took off from.
  airY: 0, airVel: 0, airFresh: false,
  // False from the moment a drop throws the rider until the ground stops
  // curving away -- so one lip cannot launch them twice. See the launch test.
  dropArmed: true,
  // Seconds left of the post-barrier recovery drag, and how hard it bites.
  wallSlowT: 0, wallSlowFactor: 1,
  // How much of the no-trick HOVER pose is showing, 0..1. Eased rather than
  // boolean so a brief ollie barely registers it and a long drop reaches it in
  // full -- the pose scales with how much of a hang there actually was, with no
  // threshold to tune and nothing to snap.
  airHold: 0,
  // Pinned against the edge barrier this frame, on a terrain that has one.
  // Read by the sparks so scraping the wall is something you can SEE costing
  // you, rather than a number quietly draining in the corner.
  onWall: false,
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
  boostT: 0, // seconds left on a boost pad's burst
  boostFloor: 0, // speed held for that burst -- see the boost pickup
  roll: 0, // rolling-momentum bonus to terminal speed -- see ROLL_GAIN
  boostDuration: 1, // the boost's full length, for the HUD timer
  // Seconds left face-down after hitting a wall. While this is above zero the
  // rider has no control at all -- see the wall branch in the prop interaction.
  tripT: 0,
  airFrom: null, // the ramp this air launched from, excluded from ramp collision
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
  grindEase: 0, // how crosswise the catch was, decaying -- see GRIND_EASE_REF
};

// What separates a HUGE AIR from an ordinary one, in launch points. Defined
// once because the on-screen popup and the missions mode's objective must agree
// -- a mission asking for something the banner never calls by that name is a
// mission the player cannot tell they are making progress on.
const HUGE_AIR_POINTS = 250;

let swingScale = 1;
// Where this run begins on the hill -- 0 for fixed courses. See startRun().
let runStartS = 0;
let running = false;
let paused = false;
/**
 * Pause state lives across runs unless something clears it, and nothing did:
 * quitting while paused left the flag set, so the NEXT run opened frozen with
 * the paused badge up and the board doing nothing -- which reads as the game
 * being broken rather than as a pause. Every entry to and exit from a run now
 * goes through here.
 */
function setPaused(next) {
  paused = next;
  const pauseButton = document.getElementById('pause-button');
  const pausedBadge = document.getElementById('paused-badge');
  if (pauseButton) pauseButton.innerHTML = paused ? '&#9654;' : '&#9208;';
  if (pausedBadge) pausedBadge.classList.toggle('hidden', !paused);
}
{
  const pauseButton = document.getElementById('pause-button');
  if (pauseButton) pauseButton.addEventListener('click', () => setPaused(!paused));
}

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
  state.s = runStartS;
  state.sPrev = 0;
  state.theta = 0;
  state.thetaVel = 0;
  state.onWall = false;
  state.airHold = 0;
  state.dropArmed = true;
  state.wallSlowT = 0;
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
  state.boostT = 0;
  state.boostFloor = 0;
  state.roll = 0;
  state.boostDuration = 1;
  state.tripT = 0;
  state.airFrom = null;
  state.rampLift = 0;
  state.landT = 0;
  state.landAmount = 0;
  state.landDuration = LAND_SETTLE_DURATION;
  state.grindLanding = false;
  state.grindEase = 0;
  autoTrickTimer = 0;
  rig.reset();
  props.reset(runStartS);
  scoring.reset();
  hud.reset(); // the score readout counts UP, so a new run must start it at zero
  // The RUN'S start, not 0. A varying course begins hundreds of metres down the
  // hill, and seeding the spawner at 0 populated nothing at all -- the world was
  // empty until the game loop's first update happened to cover for it.
  props.update(runStartS);
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
const _groundProbe = new THREE.Vector3();

/** World Y of the actual riding surface under (s, theta), right now. */
function groundYAt(s, theta) {
  return toWorld(s, theta, _groundProbe).y;
}

/**
 * How far above the ground the rider actually is, in world units.
 *
 * One subtraction now, where it used to be an arc plus a separately-tracked
 * "the ground fell away" term. The rider HAS a world height while airborne
 * (state.airY) and the ground HAS one, so the gap between them is the only
 * definition needed -- and every height test in the game reads the same number
 * the renderer draws.
 */
function airLift() {
  if (!state.airActive) return 0;
  return Math.max(0, state.airY - groundYAt(state.s, state.theta));
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.pop=true] whether the launch imparts UPWARD velocity.
 *   False for terrain drops: the ground curving away is not a ramp, and it must
 *   not shove the rider skyward. All the air comes from the hill leaving.
 */
/**
 * The highest the rider will actually get above the GROUND on this launch, in
 * world units -- the ramp's arc and the hill's shape taken together.
 *
 * WHY THE TRICK LADDER NEEDS THIS. Amit: "if I'm going into a really serious
 * drop, or even more important a ramp and then a drop, that's classical for a
 * backflip. And I don't see those any more." He is describing the biggest air
 * the game can produce -- a launcher planted on the lip of a drop, so the ramp
 * throws you and then the hill is not there when you come down -- and it was
 * being called a spin, because the ladder read the RAMP alone. A bigKicker tops
 * out at 3.82 earned height against a 4.4 flip bar, so no combination of ramp
 * and terrain could ever reach it.
 *
 * The flight never needed this: it is ballistic and finds the ground itself. It
 * is the DECISION that was blind, picking a trick at takeoff from half the
 * information about the jump it was picking for.
 *
 * TWO WRONG VERSIONS CAME FIRST, and both are instructive. Measuring the raw
 * ground fall below the launch line credited a 3.5-unit drop with 3.4 units of
 * air and flipped the smallest kicker in the game. Subtracting the rider's fall
 * but ignoring the ramp's upward velocity did the reverse -- over the 14m to the
 * bottom of that drop a free-falling rider descends 6 units, so a 3.5-unit drop
 * scored zero assist. Neither is the question being asked. The question is how
 * far above the hill the rider actually gets, which needs both halves of the
 * trajectory: vUp*t - 0.5*g*t^2 for the arc, plus however far the ground has
 * fallen away underneath it.
 *
 * Returns popHeight unchanged on any terrain without drops, so the half-pipe's
 * ladder is bit-for-bit what it was.
 */
function peakAirAbove(s, v, vUp, popHeight) {
  if (!TERRAIN.dropCycle || TERRAIN.dropCycle.length === 0) return popHeight;
  const elev0 = elevAt(s);
  const slope0 = slopeAt(s);
  // A generous flight's worth of hill -- longer than any real flight, since
  // overestimating only finds a drop the rider never reaches, and drops are far
  // enough apart that a second one is never inside the window.
  const span = Math.max(24, v * 1.5);
  let best = popHeight;
  for (let d = 1; d <= span; d += 1) {
    const t = d / v;
    const arc = vUp * t - 0.5 * AIR_G * t * t;         // height above the launch line
    const fell = elevAt(s + d) - (elev0 + slope0 * d); // how far the hill dropped from it
    const air = arc + fell;
    if (air > best) best = air;
  }
  return best;
}

function beginAir(power, points, forcedTrick, launchLabel, opts = {}) {
  // How much air this launch earned. Speed never contributes zero -- a crawling
  // rider still gets some pop, just never enough to reach the flip threshold.
  const speedFactor = AIR_SPEED_FLOOR
    + AIR_SPEED_GAIN * Math.min(1.2, state.speed / SPEED_REF);
  // A loaded tail pops higher. This is what makes the brake a setup move rather
  // than only a way to slow down: compress into the lip and the jump is bigger.
  const loadBoost = 1 + state.tailLoad * TAIL_LOAD_BOOST;
  const popHeight = AIR_HEIGHT_BASE * power * power * speedFactor * loadBoost;
  // THE JUMP IS THE RAMP PLUS THE HILL. A launch taken at the lip of a drop is
  // genuinely a bigger jump than the same launch on flat ground, and the ladder
  // has to see the whole of it or the best setup in the game reads as a small
  // one. Zero everywhere without drops, so the half-pipe's ladder is untouched.
  //
  // Left out of the flight itself on purpose -- that is ballistic and finds the
  // ground on its own. This only informs the CHOICE of trick, and the score.
  const earnedHeight = opts.pop === false
    ? popHeight
    : peakAirAbove(state.s, state.speed,
        Math.sqrt(2 * AIR_G * Math.min(popHeight, AIR_HEIGHT_MAX)), popHeight);

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
  // THE TRAJECTORY THE RIDER LEFT ON. Once airborne they follow the line they
  // were already travelling, and the ground does whatever the ground does --
  // which on a hill with drops in it means the ground can fall away underneath.
  // Recorded at launch because it must NOT be re-read from the surface later:
  // reading the current surface every frame is precisely the bug that welds the
  // rider to the road and makes a drop produce no air at all.
  //
  // On a constant grade the tangent IS the surface, so this changes nothing on
  // the half-pipe -- see the identity check in the elevation regression.
  // --- the launch, as a VELOCITY rather than a shape -------------------
  //
  // The rider is already falling at the rate the hill descends: the surface
  // drops by slopeAt per unit travelled, and s advances at `speed`, so their
  // current vertical rate is -speed*slope. A ramp ADDS to that; it does not
  // replace it, which is why a jump taken on steep ground carries the descent
  // into the flight instead of pausing it.
  const descending = state.speed * slopeAt(state.s);
  // NO POP ON A DROP. A lip you fly off because the ground curved away gives no
  // upward impulse at all -- there is nothing to push against. The hang comes
  // entirely from continuing on your line while the hill drops out from under
  // you, which is the difference between "the terrain threw me" (wrong, and
  // what the scripted arc did) and "the terrain left" (right).
  // popHeight, NOT earnedHeight: the terrain's contribution is something the
  // hill does by falling away, and adding it here would throw the rider upward
  // for air the ground is about to give them anyway -- counting it twice, and
  // reintroducing exactly the shove that pop:false exists to prevent.
  const pop = opts.pop === false ? 0 : Math.sqrt(2 * AIR_G * Math.min(popHeight, AIR_HEIGHT_MAX));
  state.airVel = pop - descending;
  state.airY = groundYAt(state.s, state.theta);
  // LAUNCHED THIS FRAME, so the flight must not integrate yet. s has already
  // advanced by the time a launch is decided, so integrating here would drop
  // airY by a full dt while the ground is still sampled at the s it was set
  // from -- the rider is instantly "below" a surface that has not moved yet,
  // and touchdown fires on frame one. Fatal for a pop:false drop, where airY
  // starts exactly ON the ground with airVel already negative: measured, every
  // drop launch ended on the frame it began and no drop gave any air at all.
  state.airFresh = true;
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
    // PARKED. Nothing calls this any more -- its only caller was the grind
    // approach-angle gate, which is gone (see the grind branch below). Kept
    // whole rather than deleted: the pose, height and landing weight behind it
    // are tuned, and it is the obvious basis for a deliberate hop on an input
    // if one is ever wanted. Reachable by passing 'hop' to beginAir().
    //
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
  // The two mission buttons open a list rather than starting a run; everything
  // else drops straight in.
  if (id === 'missions') missionSelect.open();
  else if (id === 'faceMissions') faceSelect.open();
  else startRun(id);
});

/** Whichever mission list is currently up, or null. */
function openSelect() {
  if (missionSelect.isOpen()) return missionSelect;
  if (faceSelect.isOpen()) return faceSelect;
  return null;
}

// --- mission select ---------------------------------------------------------
// Shown after choosing MISSIONS, and again after every result.
const missionSelect = createMissionSelect(RIDGE_MISSIONS, progress, (missionId) => {
  setPendingMission(missionId);
  startRun('missions');
});

// The face's own list, behind its own lobby button. Same component, same
// progress store, same star records -- it differs only in which missions it
// shows and which mode id the run is started under.
const faceSelect = createMissionSelect(FACE_MISSIONS, progress, (missionId) => {
  setPendingMission(missionId);
  startRun('faceMissions');
}, 1); // track 1 -- the face's own ladder

// --- theme ------------------------------------------------------------------
//
// ONE PLACE APPLIES A PALETTE. Every consumer was handed its colours as import
// constants at construction time, which is fine for a game with one look and
// useless for one with five -- so each now takes a setTheme() and this is the
// only caller. Adding a themed system means adding a line here, not threading a
// palette through the call graph.
let activeTheme = getTheme(DEFAULT_THEME);

function applyTheme(theme) {
  activeTheme = theme;
  // ONE SKY FOR NOW -- see SKY_BLUE_TOP. The theme still owns the ground, the
  // markings and the rider's rim; it just no longer owns the sky, so that eight
  // hill shapes can be judged against a constant.
  //
  // Fog takes the HORIZON colour rather than the theme's: fog fades distant
  // ground toward its own colour, and a dark fog under a bright sky ends the
  // world in a dark band floating in mid-air instead of a horizon.
  scene.fog.color.setHex(SKY_BLUE_BOTTOM);
  // The background is a baked canvas gradient, so it has to be redrawn rather
  // than recoloured.
  scene.background = makeSkyGradient(SKY_BLUE_TOP, SKY_BLUE_BOTTOM);
  sky.setGradient(SKY_BLUE_TOP, SKY_BLUE_BOTTOM);
  trough.setTheme(theme);
  speedLines.setTheme(theme);
  rider.setTheme(theme);
}

/** @param {string} id a registered mode id */
function startRun(id) {
  const def = getMode(id);
  // The course decides what may spawn -- hazards are absent from every course
  // today, which is how "no cones by default" is expressed as data rather than
  // as a hard-coded filter inside the spawner.
  // A mode may defer the choice to whatever it is about to run -- missions do,
  // because one progression now spans two hills.
  const course = getCourse(
    (def.courseFor && def.courseFor()) || def.course || DEFAULT_COURSE);
  // THE SHAPE OF THE HILL, before anything is placed on it. Terrain has to land
  // first: prop placement is expressed in angles out to the rim, and the trough
  // mesh, the pendulum and the collision arithmetic all read the cross-section
  // live -- so a course that changed the ground after spawning would scatter its
  // props against the previous hill's width.
  // THE MISSION MAY NAME ITS OWN HILL. A course says which world you are in;
  // within a world each level is free to be a different mountain, which is the
  // whole point of the face's variants. Falls back to the course's.
  const wantTerrain = (def.terrainFor && def.terrainFor()) || course.terrain;
  setTerrain(wantTerrain || DEFAULT_TERRAIN);
  trough.applyTerrain();
  // CONTENT IS THE MISSION'S TO DECIDE, falling back to the course.
  //
  // Amit, on the face's ladder: "first mission should be only ramps, and you
  // should not have glides at all on the screen -- and of course blockers. Then
  // the next mission should be glides, then pickups. But in the first two we
  // shouldn't have pickups at all." That is a statement about what SPAWNS, not
  // about what is counted: a mission teaching ramps with rails lying around is
  // not teaching ramps.
  const content = (def.contentFor && def.contentFor()) || null;
  props.setAllowedKinds(content ? content.kinds : course.allowedKinds);
  props.setContent(content ? (content.without || null) : null,
    content ? !!content.rareAlways : false,
    content ? (content.feature || null) : null);
  // How much of the authored layout this course actually wants on the ground.
  props.setDensity(course.density);
  // ROUTE VARIATION. One seed decides the whole run's layout, and the biggest
  // thing it moves is where on the hill you START: the trough's funnels and
  // roll are functions of absolute distance, so a different starting distance
  // is a different road, not just different props on the same road. Multiplied
  // by the funnel period so consecutive runs land in genuinely different
  // stretches rather than a few metres apart.
  const seed = course.variation ? Math.random() : 0;
  runStartS = course.variation ? Math.floor(seed * 5 * FUNNEL_SPACING) : 0;
  props.setVariation(!!course.variation, seed);
  // The speed-based fail state is opt-in per mode, and no mode wants it today.
  // Kept whole rather than deleted so a survival mode can switch it back on
  // with one flag -- see systems/scoring.js for why it is a mode question.
  scoring.setWobbleEnabled(!!def.wobble);
  hud.setWobbleVisible(!!def.wobble);
  // Modes opt OUT of the score readout; everything shows it by default.
  hud.setScoreVisible(def.showsScore !== false);
  // The big top-centre boost timer: opt-in, for the modes raced against rivals.
  hud.setBoostBarVisible(!!def.showsBoostBar);
  // A FRESH LOOK EVERY RUN. The point is that the hill does not feel like the
  // same hill twice; picking here rather than per-mode means free ride, missions
  // and the race all get it for free.
  // A LEVEL'S OWN COLOUR, when it has one. Random per run was right while every
  // hill was the same shape -- it was the only thing making two runs look
  // different at all. Now that the hills genuinely differ, a fixed palette per
  // level is worth more: it is how you recognise where you are before you have
  // read a word of the HUD.
  applyTheme(TERRAIN.theme ? getTheme(TERRAIN.theme) : pickRandomTheme());
  running = true;
  setPaused(false);
  reset();
  modes.start(id);
  // BRIEF FIRST, RIDE SECOND. The loop is gated on the briefing below, so the
  // hill genuinely does not move until the card has landed -- a freeze frame
  // rather than a card floating over a run already in progress.
  const brief = modes.briefing();
  if (brief) briefing.show(brief);
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
  // Name the destination, not the mood. This button goes to the mode lobby, so
  // RETRY would be a lie -- you land on a screen, not another run.
  restartButton.textContent = 'CONTINUE';

  gameoverEl.classList.remove('hidden');
  events.emit(EV.RUN_END, {
    reason, score: Math.round(sc.score), distance: state.s,
  });
}

// --- navigation -------------------------------------------------------------
//
// ONE STACK, ONE RULE: back goes up a level, and finishing a run goes up a
// level. The levels are
//
//     SDK games list
//       -> pick a mode
//            -> pick a mission        (missions only)
//                 -> the run
//
// so a mission returns to the mission list and everything else returns to the
// mode lobby, and the back button at the top calls the host's nav:back. Writing
// it as a stack rather than as a per-screen rule is what stops the two ways OUT
// of a run -- finishing it and quitting it -- drifting apart, which they had:
// results went to the mode lobby while the back button did nothing at all.

/** The screen above a run, which depends on whether the mode has levels. */
function leaveRun() {
  // Read the mode BEFORE tearing it down. The host happens to keep its `def`
  // after stop() so `modes.id` would still answer, but relying on that makes
  // this correct by accident.
  // Which list to return to -- the one whose button was pressed, not "missions"
  // by name. Getting this wrong strands the player on the wrong ladder.
  const wasMissions = modes.id === 'missions' || modes.id === 'faceMissions';
  const returnSelect = modes.id === 'faceMissions' ? faceSelect : missionSelect;
  briefing.cancel();
  modes.stop();
  running = false;
  setPaused(false);
  if (wasMissions) returnSelect.open();
  else modeSelect.open();
}

function restart() {
  if (!gameOver) return;
  gameOver = false;
  gameoverEl.classList.add('hidden');
  leaveRun();
}

// --- quit confirm -----------------------------------------------------------
const confirmEl = document.getElementById('confirm-overlay');
function isConfirmOpen() { return !confirmEl.classList.contains('hidden'); }
document.getElementById('confirm-no').addEventListener('click', () => {
  confirmEl.classList.add('hidden');
});
document.getElementById('confirm-yes').addEventListener('click', () => {
  confirmEl.classList.add('hidden');
  leaveRun();
});

/**
 * The back button. Its meaning is positional, which is why it cannot stay an
 * inline onclick in the markup: only the game knows which screen is above.
 */
window.__gbBack = () => {
  if (isConfirmOpen()) {                       // already asking -- treat as "no"
    confirmEl.classList.add('hidden');
  } else if (openSelect()) {                   // either mission list -> lobby
    openSelect().close();
    modeSelect.open();
  } else if (modeSelect.isOpen()) {            // top of OUR stack -> leave the game
    if (window.Unity) window.Unity.call('nav:back');
  } else if (gameOver) {                       // results -> up a level
    restart();
  } else if (running) {                        // mid-run -> ask first
    confirmEl.classList.remove('hidden');
  } else if (window.Unity) {
    window.Unity.call('nav:back');
  }
};

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

  if (running && !paused && !gameOver && !lobby.isOpen() && !modeSelect.isOpen() && !openSelect()
      && !isConfirmOpen() && !briefing.isOpen() && !isPanelOpen()) {
    let { carve, tuck, brake, pop } = readInput();
    // NO CONTROL WHILE DOWN. Steering out of a crash before the rider has got
    // up would make the wall a speed penalty rather than a crash -- the cost is
    // the seconds, not the speed. Input is dropped rather than the loop being
    // frozen, so the world keeps moving past you and the rivals keep going.
    if (state.tripT > 0) {
      state.tripT = Math.max(0, state.tripT - dt);
      carve = 0; tuck = 0; brake = 0; pop = false;
    }

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

    // ROLLING MOMENTUM. Ride clean and the ceiling creeps up; brake and it drops
    // away several times faster. Applied as a bonus to the GRADE rather than as
    // a push, so drag still bounds the result -- it moves terminal speed, it
    // cannot run away.
    if (state.braking > 0.01) {
      state.roll = Math.max(0, state.roll - ROLL_BRAKE_LOSS * state.braking * dt);
    } else if (!state.airActive) {
      state.roll = Math.min(ROLL_MAX, state.roll + ROLL_GAIN * dt);
    }

    // STEEPER GROUND PULLS HARDER. The hill has a shape now (world/trough.js),
    // so the pull down it cannot be one number any more. Deliberately NOT
    // proportional: GRADE_ACCEL and DRAG are tuned values in tuned units rather
    // than a real gravity, and scaling the pull by the full 7.7x of a drop's
    // steepness puts terminal at 74 u/s on a hill balanced for 27. The gain is
    // the fraction of that we actually take -- see dropAccelGain.
    const steepness = slopeAt(state.s) / GRADE;
    let gradePull = GRADE_ACCEL * (1 + TERRAIN.dropAccelGain * (steepness - 1));
    // RECOVERY DRAG after a barrier. Applied to the GRADE rather than as extra
    // drag so it cannot stall the rider outright -- it only slows how fast the
    // hill hands the speed back.
    if (state.wallSlowT > 0) {
      state.wallSlowT = Math.max(0, state.wallSlowT - dt);
      gradePull *= state.wallSlowFactor;
    }

    const accel =
      gradePull
      + TUCK_BONUS * state.tucking
      + state.roll
      - DRAG * state.speed * state.speed
      - CONTROLS.carveScrub * absCarve * state.speed;
    // MIN_SPEED, not 2. Being dragged to walking pace by carving left the rider
    // with nothing to steer with -- the pendulum needs speed to carve at all --
    // so a bad line put you in a state the controller could not recover from.
    state.speed = Math.max(MIN_SPEED, state.speed + accel * dt);
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
      const rim = TERRAIN.thetaMax; // per-course now -- see data/terrain.js
      // THE CUSHION IS PER-TERRAIN. On the pipe the wall stiffens toward the rim
      // so running out of road pushes back; on the open face there is no
      // push-back at all and the whole width rides the same, with a hard
      // barrier at the edge instead. See LIP_CUSHION / LIP_WALL.
      const over = Math.abs(state.theta) - rim * 0.82;
      const lipPush = (TERRAIN.lipMode === LIP_CUSHION && over > 0)
        ? -Math.sign(state.theta) * over * over * 46
        : 0;
      const thetaAcc =
        state.carve * CONTROLS.carveTorque * TERRAIN.carveScale
        - (TERRAIN.thetaGravity / R) * Math.sin(state.theta)
        - CONTROLS.damp * TERRAIN.dampScale * state.thetaVel
        + lipPush;
      state.thetaVel += thetaAcc * dt;
      state.theta += state.thetaVel * dt;

      // --- WORLD STEER: the lane stops carrying the rider ------------------
      //
      // Amit: "why should the player and the controller care about the lane?
      // The lane is for building the world. In the snowboard game the lane was
      // not affecting the player at all."
      //
      // Position is stored as (s, theta) -- an angle off a centreline that
      // BENDS -- so holding theta means being swept sideways with the road.
      // Measured hands-off, that is 38.8 units of lateral travel in nine
      // seconds on Switchback, with the rider's lane never changing and the
      // camera tracking the road to within 1.4 degrees. Nothing was steering
      // them; the road was carrying them.
      //
      // The road's lateral rate is speed * d(centre.x)/ds. The rider's own
      // offset from the centreline is R*sin(theta), which changes at R*cos(theta)
      // per radian -- so cancelling one with the other is a division. Neutral
      // input then means a straight line in the WORLD, and following a bend
      // becomes something the player does rather than something done to them.
      //
      // A SCALE, not a switch: 0 is the old behaviour exactly, so the half-pipe
      // and everything tuned on it are untouched, and a route that turns out to
      // demand too much steering can be dialled back rather than re-authored.
      if (TERRAIN.worldSteer > 0) {
        const R2 = radiusAt(state.s);
        // cos(theta) goes to zero at the rim of a deep hill, and the correction
        // divides by it -- so it is floored. Past that angle the surface is too
        // steep for a lateral cancellation to mean much anyway.
        const lean = Math.max(0.35, Math.cos(state.theta));
        const correction = -(state.speed * routeSlopeAt(state.s)) / (R2 * lean);
        state.theta += correction * TERRAIN.worldSteer * dt;
      }

      // Where the world ends. In CUSHION mode this is a backstop well past the
      // point the soft push has already taken over, and reaching it is a bug
      // you never see. In WALL mode it is the wall itself -- the rider arrives
      // here often and on purpose, so it has to behave like a surface rather
      // than like a clamp: stop the outward motion, do NOT bounce, and charge
      // for leaning on it.
      const wall = TERRAIN.lipMode === LIP_WALL;
      const hardLimit = wall ? rim : rim * 1.04;
      if (Math.abs(state.theta) >= hardLimit) {
        const dir = Math.sign(state.theta);
        state.theta = dir * hardLimit;
        // Kill only the OUTWARD half of the velocity. Zeroing it outright would
        // make the wall sticky -- you would have to build speed from a dead stop
        // to peel off it -- and reflecting it would bounce you back across the
        // hill you were deliberately holding a line on.
        if (dir > 0) state.thetaVel = Math.min(0, state.thetaVel);
        else state.thetaVel = Math.max(0, state.thetaVel);
        // Scraping costs. This is the only thing left standing between "no
        // speed cost anywhere on the face" and "hold full lean and park".
        if (wall && TERRAIN.wallScrub > 0) {
          state.speed = Math.max(MIN_SPEED, state.speed - TERRAIN.wallScrub * dt);
          state.onWall = true;
        }
      } else {
        state.onWall = false;
      }
    }

    // --- height <-> speed exchange -------------------------------------
    // Climbing the wall costs speed, dropping gives it back, exactly:
    //   v^2 -= 2*g*dh
    // Energy-based rather than a fudge, so pumping (dropping while already
    // descending) emerges on its own and wall-surfing is genuinely slow.
    const newHeight = heightAt(state.s, state.theta);
    const dh = newHeight - state.height;
    state.height = newHeight;
    // heightScale is what decides whether a WIDE hill is actually usable. On the
    // open face the whole point is that you can be anywhere across it; at the
    // pipe's full exchange rate the centreline would still be the only fast
    // line and the extra width would just be scenery you cannot afford to use.
    const v2 = Math.max(4, state.speed * state.speed
      - 2 * CONTROLS.heightExchange * TERRAIN.heightScale * dh);
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

    // --- the ground giving way -------------------------------------------
    // A launch with nothing to launch off. Where the hill tips away (see
    // curvatureAt), staying on the surface would need a downward acceleration
    // of v^2 * curvature; past what the grade can supply, the rider is already
    // airborne and the only question is whether the game noticed.
    //
    // SPEED IS THE WHOLE TEST, because curvature is fixed by the terrain and v
    // is the only other term. Arrive at the lip fast and it throws you; crawl
    // over the same ground and you follow it down. That is a drop behaving like
    // a drop rather than like a trigger volume someone painted on a hill.
    if (!state.airActive && !state.grind && state.tripT <= 0) {
      const need = state.speed * state.speed * curvatureAt(state.s);
      // ONE LAUNCH PER LIP. Without the latch, landing while still inside the
      // convex half of a drop re-satisfies the test on the very next frame and
      // throws the rider again -- Amit: "I still get the point, sometimes more
      // than one for a drop." It happens at lower speeds, where the flight is
      // short enough to touch down before the ground stops curving away.
      //
      // Re-armed below, once the hill is no longer outrunning gravity, which is
      // the same condition that fires it. So a drop launches exactly once and
      // the next one is free to.
      if (need <= TERRAIN.launchG) state.dropArmed = true;
      if (need > TERRAIN.launchG && state.dropArmed) {
        state.dropArmed = false;
        // Scaled by how far past the threshold you were, so the same lip pays
        // out more the harder you hit it -- and capped, because the curvature
        // spikes at the very start of the lip and an uncapped ratio would make
        // a marginally faster approach a wildly bigger jump.
        const over = Math.min(2.2, need / TERRAIN.launchG);
        // NO TRICK OFF A DROP. Amit: "I think we should either stop with the
        // spins and tricks when we drop, or just when it's like a really big
        // drop. Let's start for now by just switching them off completely."
        //
        // A spin needs something to spin ABOUT, and a drop gives the rider no
        // impulse at all -- the ground simply leaves. Rotating out of that reads
        // as the animation deciding something the physics never did, which is a
        // close relative of the fake floor this whole pass removed.
        //
        // `null` rather than `undefined`: undefined means "consult the height
        // ladder", null means "no trick, final". Restoring tricks for big drops
        // later is this one argument -- pass undefined and the ladder decides
        // again, or gate it on the drop's depth.
        //
        // pop:false -- see beginAir. The rider is not thrown; the hill leaves.
        beginAir(0.55 * over, 0, null, 'DROP', { pop: false });
      }
    }
    if (state.airActive) {
      // ONE PARABOLA, no phases. Integrate the rider's actual vertical velocity
      // and compare against the actual ground beneath them. There is no arc, no
      // authored duration governing the flight, and above all no launch tangent
      // standing in for a floor that is no longer there -- the flight ends when
      // and only when the rider meets the hill.
      // Captured BEFORE it is cleared. Clearing the flag inside the branch and
      // then testing !state.airFresh for touchdown a few lines further down
      // means that test sees the flag already down on the very frame it was
      // raised -- so the rider lands on the launch frame, with airY still
      // exactly equal to the ground. Every drop flight lasted zero seconds.
      const justLaunched = state.airFresh;
      if (justLaunched) {
        // Skip exactly one frame, so the next step advances the rider and the
        // ground beneath them across the same interval.
        state.airFresh = false;
      } else {
        // EXACT for constant acceleration: y += v0*dt - 0.5*g*dt^2, and only
        // then v -= g*dt. The obvious order (advance v, then move by it) is
        // semi-implicit Euler, which applies the END-of-step velocity across the
        // whole step and so overstates the fall by 0.5*g*dt^2.
        //
        // Normally invisible; here it was decisive. At a drop lip the rider
        // clears the ground by roughly 0.001 units per step -- that margin IS
        // the amount by which the hill outruns gravity -- while the integration
        // error is about 0.007. The rider sank through the surface on the first
        // step every time, so every drop flight lasted exactly zero seconds,
        // which looked for all the world like the launch condition being wrong.
        state.airY += (state.airVel - 0.5 * AIR_G * dt) * dt;
        state.airVel -= AIR_G * dt;
      }

      // The trick clock is SEPARATE from the flight now, and has to be: rotation
      // is locked 1:1 to airT, and a backflip is authored at 0.55s because that
      // is how long a backflip should look. Letting a long hang stretch it would
      // slow the flip down; letting it loop would start a second one. So it runs
      // at its own pace, finishes, and the rider holds the landing pose for
      // however much longer the ground takes to arrive.
      state.airT = Math.min(1, state.airT + dt / state.airDuration);

      // HANG TIME OVER A DROP. The scripted arc says the flight is over; the
      // ground says otherwise. Where the hill has fallen away beneath the
      // trajectory the rider left on, the arc finishing only means the trick
      // is done -- they are still in the air, and they stay there until they
      // actually meet the surface.
      //
      // Held at exactly 1 rather than allowed to run on, because airT drives
      // the rotation animation 1:1: letting it pass 1 would start a second
      // backflip on the way down.
      // TOUCHDOWN IS MEETING THE GROUND. Not "the arc finished", which is what
      // it used to be and what made the flight a shape rather than a fall.
      const ground = groundYAt(state.s, state.theta);
      const touchdown = !justLaunched && state.airVel <= 0 && state.airY <= ground;
      if (touchdown) {
        state.airY = ground;
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
      // Locked to the rail's line while on it -- that's what a grind IS. But
      // HOW FAST it locks depends on how hard the rider was cutting across when
      // they caught it: already aligned and it is effectively instant, a hard
      // cut takes about a fifth of a second to come round. That difference is
      // the whole of what the old approach-angle gate was defending, and it
      // belongs here -- in how the rider settles -- rather than in a rule about
      // whether they are allowed to grind at all.
      const ease = state.grindEase || 0;
      const rate = GRIND_SNAP_RATE + (GRIND_EASE_RATE - GRIND_SNAP_RATE) * ease;
      state.theta += (g.theta - state.theta) * Math.min(1, dt * rate);
      // Bled out rather than zeroed. Killing the lateral velocity on the entry
      // frame is precisely the "magnetic grab" -- the rider stops dead sideways
      // in the same frame they touch the rail. Decaying it lets the crossing
      // momentum carry through and die off, which reads as catching the rail.
      state.thetaVel -= state.thetaVel * Math.min(1, dt * rate);
      state.grindEase = Math.max(0, ease - dt * 4);
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
      // THE RAMP IS SOLID IN THE AIR TOO. This used to read the surface as 0
      // whenever airActive was set, which is where "I fly straight through the
      // next ramp" came from -- nothing was lifting the rider, so the arc just
      // passed through the geometry. The surface is now queried every frame,
      // and an arc that is BELOW it has hit the ramp face.
      //
      // The ramp that launched this jump is excluded: a bank's takeoff is its
      // middle, so for a moment after leaving one the rider is still over its
      // back half and would collide with the ramp they had just left.
      const surfaceH = props.rampHeightAt(state.s, state.theta, state.airFrom);
      // airLift(), not the bare arc: over a drop the rider is also held up by
      // the ground having fallen away, and a ramp they are clearing easily must
      // not read as struck. See airLift().
      const arcLift = airLift();

      if (state.airActive && !state.grind && surfaceH > arcLift + 0.05) {
        // Struck the face. Plant on it and let the ordinary ride-up take over --
        // the rider now runs up this ramp and launches off its lip like any
        // other approach, which is what "I do not want to go through it" should
        // feel like. The trick is ended the same way a touchdown ends it.
        const landedTrick = state.airTrick;
        state.airActive = false;
        state.airT = 0;
        state.airTrick = null;
        state.airPoints = 0;
        rig.onLand();
        scoring.land();
        beginLanding(landedTrick ? LAND_AMOUNT_SPIN : LAND_AMOUNT_PLAIN);
        events.emit(EV.LAND, {
          trick: landedTrick, amount: state.landAmount,
          height: arcLift, points: 0, huge: false,
        });
        state.rampLift = surfaceH;
      }

      const rampTarget = state.airActive || state.grind ? 0 : surfaceH;
      if (rampTarget >= state.rampLift) state.rampLift = rampTarget;
      else state.rampLift += (rampTarget - state.rampLift) * Math.min(1, dt * (1 / 0.16));
    }

    // --- prop interaction ----------------------------------------------
    // props.update() is what actually spawns new patterns as the rider
    // advances (build doc §6) -- without this call every frame, the world
    // stops generating past the first SPAWN_AHEAD stretch, which is exactly
    // the "I see stuff at the start, then nothing" symptom.
    if (state.boostT > 0) {
      state.boostT = Math.max(0, state.boostT - dt);
      // EASED UP TO the floor, not snapped onto it. Math.max() put the whole
      // gain in on the frame you touched the gate, which reads as a teleport --
      // "I immediately get super fast". Approaching it exponentially puts most
      // of the gain in the first half second and lets you SEE the acceleration.
      // Still only ever upward, so a boost never slows a faster rider.
      if (state.speed < state.boostFloor) {
        state.speed += (state.boostFloor - state.speed) * Math.min(1, dt * BOOST_RAMP);
      }
    }
    props.update(state.s, dt);
    {
      // PROBING RUNS DURING A GRIND TOO, for collectables only.
      //
      // This whole block used to be skipped while on a rail, which is why a
      // crystal sitting ON a rail could never be taken -- the one place a pickup
      // is most obviously meant to be collected, since the rail carries you
      // straight through it. Nothing was wrong with the pickup or its collider;
      // the game simply was not looking.
      //
      // Only collectables are honoured while grinding. A launcher, another rail
      // or a hazard is suppressed: the rider is locked to this rail's line and
      // cannot meaningfully meet any of them, and re-entering a grind while
      // already grinding is exactly the loop the original guard existed to
      // prevent. This keeps that protection and drops the collateral.
      // How high off the surface the rider actually is. The same three offsets
      // the render pass adds below -- air arc, ramp deck, rail top -- because a
      // pickup floating overhead has to be judged against where the rider IS,
      // not where their (s, theta) is. NOTE state.height is the TROUGH WALL's
      // height at this position, a different quantity entirely; using it here
      // was the first version of this line and it is always 0 at the bottom.
      const lift = airLift()
        + state.rampLift
        + state.grindLift * state.grindLiftHeight;
      const found = props.probe(state.s, state.theta, state.airActive, state.sPrev, lift);
      const collectable = found
        && (found.def.kind === 'pickup' || found.def.kind === 'boost');
      const hit = (state.grind && !collectable) ? null : found;
      if (hit) {
        if (hit.def.kind === 'launch') {
          // Ramps and banks auto-launch on contact -- no button, no tap. This
          // is the "hit something that isn't a cone and my player automatically
          // does something cool" behaviour: kickers/banks are the "something
          // cool happens" case, cones/potholes/barriers are the "that hurts"
          // case, and the two are told apart by kind, not by a player input.
          beginAir(hit.def.launch.power, hit.def.launch.points, undefined, hit.def.label);
          // So the arc-vs-ramp test below can ignore the ramp we just left.
          state.airFrom = hit;
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
          // TOUCHING A RAIL ALWAYS GRINDS IT. There used to be an approach-angle
          // gate here: arrive too crosswise and the rider hopped OVER the rail
          // instead, on the reasoning that snapping into a grind mid-cut reads
          // as the obstacle magnetically grabbing you.
          //
          // The reasoning was sound and the rule was unusable, because it
          // punished the only way to reach a rail. Measured with a bot steering
          // at rails deliberately: the approach ratio at contact runs 0.60-0.65
          // against a 0.30 limit, and 2 of every 6 attempts were rejected. The
          // input required to GET to a rail is the input that disqualified you
          // from riding it. No threshold fixes that -- anything loose enough to
          // let you aim is loose enough to let everything through.
          //
          // So contact attaches, always, and the grab-feel the gate was guarding
          // against is handled where it belongs: in HOW the rider settles onto
          // the line (see grindEase below) rather than in whether they may.
          {
            state.grind = hit;
            state.grindPoints = 0;
            state.grindTime = 0;
            state.airActive = false;
            state.airT = 0;
            // How hard the rider was cutting across at the moment of contact.
            // Kept, not discarded, because the SETTLE is what sells the catch:
            // a gentle drift should lock on immediately, a hard cut should take
            // a beat to come round. Zeroing thetaVel on this frame -- which is
            // what used to happen -- is the actual "magnetic grab".
            state.grindEase = Math.min(1,
              (Math.abs(state.thetaVel) * radiusAt(state.s)) / Math.max(1, state.speed)
              / GRIND_EASE_REF);
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
          // Pickups sit OUTSIDE the multiplier entirely -- see scoring.award().
          scoring.award(hit.def.pickup.points, hit.def.label, false);
          hit.mesh.visible = false;
          hit.spent = true;
        } else if (hit.def.kind === 'boost') {
          events.emit(EV.BOOST, {
            label: hit.def.label,
            speed: hit.def.boost.speed,
            seconds: hit.def.boost.seconds,
          });
          // A real speed change, not a score bonus dressed up as one: the whole
          // point is that it moves you up the road. Added to the CURRENT speed
          // rather than setting a target, so hitting one while already fast is
          // still worth something -- drag will bleed it back down on its own,
          // which is what makes the boost a burst rather than a new cruise.
          // A FLOOR held for the duration, not a one-off addition. Adding to
          // the speed put drag straight to work on it and the whole boost was
          // gone in under a second -- worth 14 m against a 45 m carve cost, so
          // going for a pad actively lost the race.
          state.boostFloor = Math.min(
            hit.def.boost.ceiling, state.speed + hit.def.boost.speed);
          state.boostT = hit.def.boost.seconds;
          // Remembered so the HUD timer has something to divide by -- gates do
          // not all last the same time, and a bar drawn against a constant
          // would be wrong for the air gates.
          state.boostDuration = hit.def.boost.seconds;
          scoring.award(hit.def.boost.points, hit.def.label, false);
          events.emit(EV.PICKUP, { type: 'boost', points: hit.def.boost.points });
          hit.mesh.visible = false;
          hit.spent = true;
        } else if (hit.def.kind === 'wall') {
          // A REAL CRASH. Not a wobble and not a speed scrub -- the run stops.
          // Speed goes to almost nothing, the rider is out of control for a
          // beat, and everything they had going is gone: the boost, the rolling
          // momentum they had built, and any grind they were on.
          //
          // In a race this is the most expensive thing on the course, and it
          // should be: the field does not stop, so every metre they take while
          // you are down is a metre you have to win back.
          state.speed = hit.def.wall.stopSpeed;
          state.tripT = hit.def.wall.downSeconds;
          // The hill holds the speed back for a beat -- see slowSeconds. Longer
          // than the loss of control on purpose: you get the steering back
          // first and spend the rest of it climbing out of the hole, which is
          // what "and now I'm slow" actually feels like.
          state.wallSlowT = hit.def.wall.slowSeconds || 0;
          state.wallSlowFactor = hit.def.wall.slowFactor || 1;
          state.roll = 0;          // the momentum bonus, earned and now lost
          state.boostT = 0;
          state.grind = null;      // knocked off a rail if you were on one
          state.airActive = false;
          state.airT = 0;
          state.airTrick = null;
          // SHOVED CLEAR, not stopped on its line. Zeroing thetaVel left the
          // rider travelling straight down the barrier they had just hit, which
          // is what made a centre-on impact look like passing through it.
          //
          // Which way: away from the barrier's own line if the rider is off it
          // at all, otherwise continue whichever way they were already drifting,
          // and failing both -- a dead-centre hit with no lateral motion, which
          // is exactly the case that read worst -- toward the middle of the
          // hill, where there is the most room to be pushed into.
          {
            const off = state.theta - hit.theta;
            const dir = Math.abs(off) > 1e-3 ? Math.sign(off)
              : Math.abs(state.thetaVel) > 1e-3 ? Math.sign(state.thetaVel)
                : -Math.sign(state.theta) || 1;
            state.thetaVel = dir * (hit.def.wall.deflect || 0);
          }
          // The heaviest absorb the rider has, held for the whole time they are
          // down -- it is the closest thing to a fall this rig can do without
          // new animation, and it reads as being folded up by the impact.
          beginLanding(LAND_AMOUNT_BACKFLIP);
          state.landDuration = hit.def.wall.downSeconds;
          state.landT = hit.def.wall.downSeconds;
          rig.onLand();
          scoring.hit(0, hit.def.label);
          events.emit(EV.HAZARD, { label: hit.def.label, wobble: 0 });
          hud.banner('CRASH');
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
    rivals.update(dt, state.s, props);
    modes.update(dt);

    // THE HOVER, eased. Engaged only when airborne with nothing else to do:
    // a trick already occupies the rider, and layering a held stance under a
    // rotation reads as two animations disagreeing.
    {
      // Scaled by the air actually earned. airLift() is the real gap between
      // the rider and the hill, so a pop that clears the ground by a tenth of a
      // unit shows a tenth of the pose, and only a genuine drop spreads him
      // out fully.
      // Scaled by the air actually earned. airLift() is the real gap between
      // the rider and the hill, so a pop that clears the ground by a tenth of a
      // unit shows a tenth of the pose, and only a genuine drop spreads him
      // out fully.
      const want = (state.airActive && !state.airTrick)
        ? Math.min(1, airLift() / HOVER_FULL_LIFT)
        : 0;
      const rate = want > state.airHold ? HOVER_IN_RATE : HOVER_OUT_RATE;
      const step = rate * dt;
      state.airHold += Math.max(-step, Math.min(step, want - state.airHold));
      state.airHold = Math.max(0, Math.min(1, state.airHold));
    }

    trough.update(state.s);
  }

  // --- place the rider ---
  toWorld(state.s, state.theta, _pos);
  if (state.airActive) {
    // Air is along the SURFACE NORMAL now, not world-up -- so a launch off a
    // rolled section throws you away from the wall you left, which is what
    // makes a corkscrew readable rather than arbitrary.
    // THE RIDER'S HEIGHT IS SIMPLY WHERE THEY ARE. state.airY is integrated
    // from real velocity under real gravity, so there is nothing to add on top
    // of the surface and nothing to correct for -- the surface is just what they
    // will eventually hit. Set outright rather than offset: an offset would once
    // again be measuring the flight against the ground it left.
    _pos.y = state.airY;
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
    airHold: state.airHold,
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
  // the kill. With it off it marks speed you did not get on your own -- zero at
  // or below the natural ceiling, so riding well at the top is calm, and only a
  // boost shakes the frame. It was measured off SPEED_REF before, which sat
  // BELOW the natural top and so shook the screen at ordinary cruise.
  view.shake = scoring.wobbleEnabled
    ? Math.max(0, (scoring.state.wobble - 55) / 45)
    : Math.min(SHAKE_MAX, Math.max(0, (state.speed - NATURAL_TOP_SPEED) / SHAKE_SPAN));

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
    Math.max(
      (state.speed / SPEED_REF - 0.78) / 0.42,
      // A boost floors them regardless of the speed it produced -- the burst
      // has to be FELT, and the raw speed curve alone under-sells it.
      state.boostT > 0 ? 1 : 0,
    ),
    state.speed, camera, paused ? 0 : dt,
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
  // The panel stays hidden while the briefing is up, or the card would fly to a
  // destination that is already sitting there in plain sight -- which is the one
  // thing that would make the flight pointless. briefing.fly() reveals it for
  // long enough to measure and hands it back.
  objectivesUi.update(briefing.isOpen() ? null : modes.panel());
  hud.boost(state.boostT > 0 ? state.boostT / state.boostDuration : 0, state.boostT);
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
window.__lab = { scene, camera, rider, state, THREE, sparks, props, renderer, radiusAt, speedLines, events, modes, startRun, scoring, progress, missionSelect, faceSelect, rivals, finishLine, trough, sky, applyTheme,
  // Live cross-section, plus the setter -- so a terrain can be swapped mid-run
  // from the console and measured, rather than only via a mode's course.
  TERRAIN, setTerrain: (k) => { setTerrain(k); trough.applyTerrain(); },
  // Terrain probes, for reading the hill's shape from the console.
  elevAt, slopeAt, curvatureAt,
  /**
   * Jump to just before the next drop. Drops are 540m apart and a run is 1800m,
   * so looking at one otherwise means riding 20 seconds to reach it and another
   * 20 to see it again -- which is most of the cost of iterating on it.
   * `__lab.toDrop()` for the next one, `__lab.toDrop(2)` to skip ahead.
   */
  toDrop(n = 1) {
    if (!TERRAIN.dropCycle || TERRAIN.dropCycle.length === 0) return 'this terrain has no drops';
    // Ask the terrain where its lips actually are rather than re-deriving them.
    // The first version computed the lip from a single dropWidth, which stopped
    // existing when drops became a varied cycle -- so it quietly produced NaN
    // and teleported the rider out of the world.
    const lips = dropLipsBetween(state.s + 20, state.s + 20 + TERRAIN.dropSpacing * TERRAIN.dropCycle.length * 2);
    const lip = lips[Math.max(0, Math.min(lips.length - 1, n - 1))];
    if (!lip) return 'no lip found ahead';
    const target = lip.s - 60; // ride the approach rather than start on the edge
    state.s = target;
    state.sPrev = target;
    props.reset(target);
    return `${lip.drop.profile} drop, depth ${lip.drop.depth} over ${lip.len.toFixed(0)}m -- lip in 60m`;
  },
  /** Every drop lip in a stretch, for measuring. */
  dropLips: (from, to) => dropLipsBetween(from, to),
  // The LIVE input instance. A dynamic import() of the module gives a second
  // copy whose initInput() never ran, so its key set stays empty and every
  // reading is zero -- which looks exactly like a broken mapping.
  input: { readInput, setStance, getStance },
  // THE LIVE mission setter. A dynamic import() of modes/missions.js under
  // Vite's HMR hands back a SECOND module instance whose pendingId is its own,
  // so setting it there leaves the running game's pendingId null and every
  // mission falls back to the default course -- which reads exactly like the
  // face missions loading the ridge. Same trap as the input module earlier.
  setPendingMission };

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
