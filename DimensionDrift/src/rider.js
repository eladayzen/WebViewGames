// The rider: carving physics, the board rig, and the chase camera.
//
// WHY THIS GENRE. The BoBo pipeline smooths the lean with a tau of about a third
// of a second before the game ever sees it. In a game that asks you to BE at a
// coordinate on a beat, that lag is a tax paid on every single input. Here the
// lean is a FORCE — it sets an edge, the edge bends a heading, the heading
// integrates into a position. Two integrations later, a third of a second of
// smoothing is indistinguishable from the weight of a rider on snow. The lag
// stopped being latency and became momentum.
//
// The model, in one paragraph. Lean left/right sets an edge; edge times speed is
// a turn rate, so a fixed edge traces a fixed-radius arc exactly like a real
// sidecut. Speed is not a number the game grants you — it is the component of
// gravity along wherever you happen to be pointing, minus drag, minus what the
// edge scrubs. Point down the fall line and you accelerate; carve across it and
// you bleed. That single relationship is the whole game: every turn is a
// negotiation between where you need to be and how fast you are willing to
// arrive. Lean fore/aft trades grip and drag against a hard scrub.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLitMaterial } from './lit.js';
import { meshHeight, EDGE_MAX } from './mountain.js';
import { clamp, mulberry32, smoothstep } from './rng.js';

/**
 * The carving stance, as rotations from the model's bind pose.
 *
 * A snowboarder does not stand the way a rigged character ships. They stand
 * ACROSS the board, knees deeply folded, hips open toward the nose, upper body
 * counter-rotated against the board's incline. All of that is applied once at
 * load; only the parts that should change with the turn are touched per frame.
 *
 * Bone names are the Mixamo standard, minus the `mixamorig1:` prefix.
 */
const STANCE = {
  // Square across the board: the feet line up along the nose-tail axis. After
  // the wrapper yaw the character's chest faces -X (the toe edge) and the RIGHT
  // hand leads toward the nose.
  bodyYaw: -1.5708,
  // EVERY value below comes from tools/axes-probe.mjs, which loads the shipped
  // GLB, replays these exact transforms and prints where each joint axis moves
  // the limbs in board space. Guessing these from screenshots failed four times
  // running — the hips yaw twists every child frame, and on this rig the knee
  // flexes on NEGATIVE x (positive is hyperextension), which is precisely the
  // backwards-bent "sitting in the air behind the board" the guessed stance
  // produced.
  Hips: { x: 0.22, y: 0.30, z: 0 },
  Spine: { x: 0.16, y: -0.10, z: 0 },
  Spine1: { x: 0.12, y: -0.08, z: 0 },
  Spine2: { x: 0.08, y: -0.06, z: 0 },
  // Head up and looking down the hill through everything.
  Neck: { x: -0.14, y: -0.30, z: 0 },
  Head: { x: -0.10, y: -0.22, z: 0 },
  // The bind feet sit 0.18 m apart — half a snowboard stance — so the thighs
  // split along the board first (UpLeg z, probe: 0.39 m of foot travel per
  // half radian). Thigh flex leads knee flex so the shins finish angled a
  // little FORWARD, knees over the toes; knee > thigh is how you sit in a
  // chair, which is what the last stance was.
  LeftUpLeg: { x: -0.70, y: 0, z: 0.21 },
  LeftLeg: { x: -0.58, y: 0, z: 0 },
  // ── FEET ACROSS THE DECK ──────────────────────────────────────────────────
  // The real bug behind every "feet are 45 degrees" report: the boots pointed
  // ALONG the board like ski boots -- visible the moment a camera finally
  // looked AT them instead of at the torso. Days of pitch-tuning were the
  // wrong axis. These values are solved numerically in-page (coordinate
  // descent per foot, cost = sole pitch squared + yaw-vs-across-the-deck with
  // 15 degrees of duck), then verified by boot-cam screenshot: soles flat ON
  // the deck, toes across it. Residual pitch 0.1 deg left, 0.0 right.
  // Direction corrected on Elad's eye ("the other direction -- do a minus"):
  // both toes to +X, re-solved with the side FIXED rather than auto-detected
  // (auto kept re-mirroring the left). Residual sole pitch 0.1/-0.1 deg.
  // Set by Elad's directed yaws on the deck plane (right 40 left, left 180),
  // composed about the group-up axis and read back as local eulers. The live
  // tuning hook CARVE.footYaw(side, deg) exists so the next adjustment is his
  // eye and one console line, not another remote-guessing round.
  // Elad's directed yaws (right 30 right, left 40 left, on the deck plane),
  // applied through the LIVE hook with the strap-rigid ankle running -- the
  // first round where the verifying screenshot and his screen were the same
  // machine. The old X-only ankle counter twisted yawed feet about a diagonal,
  // which is why every earlier remote round disagreed with his eye.
  LeftFoot: { x: 1.763, y: 0.252, z: -1.411 },
  RightUpLeg: { x: -0.68, y: 0, z: -0.21 },
  RightLeg: { x: -0.55, y: 0, z: 0 },
  RightFoot: { x: 0.521, y: -0.157, z: -0.132 },
  // Arms: x+ lowers from the T-pose (probe: hand travels straight down on both
  // sides), z swings fore/aft and mirrors. Down to ~55 degrees, hands a touch
  // forward, elbows soft.
  LeftArm: { x: 0.86, y: 0, z: 0.12 },
  LeftForeArm: { x: 0.10, y: 0, z: 0.30 },
  RightArm: { x: 0.84, y: 0, z: -0.22 },
  RightForeArm: { x: 0.10, y: 0, z: -0.32 },
};

/**
 * ── FEET ORIENTATION, STORED WHERE IT IS USED ───────────────────────────────
 * The boots' stance orientation lives as GROUP-SPACE QUATERNIONS -- the exact
 * value the strap-rigid ankle holds every frame -- instead of local eulers in
 * STANCE. Local eulers only reproduce an orientation under the leg pose they
 * were read in, so every bake of the left foot came back warped (measured:
 * 0 deg live -> 12 after rebuild, diverging with iteration -- "wrong axis,
 * left foot looks broken" was bake loss, not an axis at all). A group-space
 * quaternion has no parent to disagree with. null = capture from the euler
 * stance on first boot (the migration path, and how new values get printed
 * for baking: the capture logs them).
 */
/** Per-foot anchor slide along the board (group z, metres; + is the tail).
 *  Position partner to FEET_GROUP_Q, applied to the IK anchors at capture.
 *  Live dial: CARVE.footSlide(side, metres). */
const FEET_ANCHOR_SLIDE = {
  Left: 0,
  Right: 0,
};

/**
 * "Rotate the character -- but the left leg should be the center pivot."
 * Degrees of body yaw about the vertical axis THROUGH THE LEFT ANCHOR: the
 * rig turns, the left boot stays planted (its anchor is the pivot), and the
 * right anchor sweeps to its rotated position -- the right foot moves toward
 * the rider's heel side without the board or the left foot moving at all.
 * Live dial: CARVE.bodyPivot(deg).
 */
const BODY_PIVOT_DEG = -12;

/** Whole-character offset across the board (group x, metres): rig and feet
 *  anchors shift together, so she stands this much to the side of the deck's
 *  centreline. Live dial: CARVE.nudge(metres). */
const RIDER_NUDGE_X = 0.04;

const FEET_GROUP_Q = {
  // Left = the approved Right, yawed 30 deg on the deck (duck) -- set live,
  // baked as the exact held value. These are the strap's own numbers: a fresh
  // boot reproduces the approved frame identically, no euler/parent-pose loss.
  Left: { x: -0.2506, y: 0.5157, z: 0.7123, w: 0.4047 },
  Right: { x: -0.4264, y: 0.3934, z: 0.6232, w: 0.5244 },
};

const BOARD_COLOR = 0x97d700;  // the board's own lime; setProfileColor(null) restores it
const RIDER_SCALE = 1.06;   // Mixamo ships ~1.6 m; a rider on a board is ~1.7 m
const RIDER_LIFT = 0.10;    // boot sole height above the board's top sheet

export const TUNE = {
  /**
   * Radians of body incline at full edge. PURELY COSMETIC — it reaches the drawn
   * quaternion and the board's lift out of the snow, and nothing else. `omega`
   * is `edge * (turnBase + vh * turnV)`, so turning this changes how a carve
   * LOOKS and never how tightly it goes round.
   *
   * It lives in TUNE rather than as a module constant so it can be swept live
   * through `CARVE.TUNE` against a screenshot, which is the only way to judge
   * it: the world-space angle is not what anyone sees.
   *
   * WHY IT CAME DOWN FROM 0.86 (49°). Reported from play as the rider "lying on
   * the floor, flat" at the extremes, and she was — the photograph at full edge
   * on the piste, with crashes disabled so the pose could not be confused with
   * the crash animation, shows her essentially horizontal at a measured 47.9°.
   *
   * The reason 48° reads as 90° is the camera. It sits seven metres up and looks
   * down the hill, and that downward pitch foreshortens vertical extent — so an
   * incline in the world projects far flatter on screen than it is — and the rig
   * banks up to 8° into the turn on top, in the same direction. The honest fix is
   * this number, because the alternative is the camera, and the camera framing is
   * load-bearing for the whole game.
   *
   * 0.52 rad is 29.8°, chosen off a sweep photographed under fixed conditions —
   * edge 0.98, on the piste at u ~6, 65 km/h, crashes disabled — because the
   * first sweep drifted off-piste between shots and compared four different
   * situations. At 0.86 she lies on her side; at 0.40 she reads correctly but
   * tamely; at 0.55 she is committed and still legible. A real carve at speed
   * lays a rider over 30-45°, so this is both honest and survives the camera.
   */
  maxRoll: 0.52,

  /**
   * WHAT HITTING SOMETHING COSTS. Three numbers, softened together after the
   * race put trees on the racing line — "right now the panishment is to harsh -
   * it might also be relevant for the original mode", and it is, so this is
   * turned down for both rather than made a mode's business.
   *
   * It was 0.55 / 3.5 / 1.1: nearly half the speed taken on the frame of
   * contact AND a second of hard braking on top of it, which compounds into a
   * near stop. That was sized when a tree was something you met only by leaving
   * the piste — a rare, self-inflicted event. In the race a tree is course
   * furniture you are aimed at, and a punishment that ends the run is not a
   * punishment, it is a restart.
   *
   * `crashKeep` is the fraction of speed left on contact; `crashDrag` the extra
   * deceleration while down; `crashTime` how long that lasts. They are in TUNE
   * so the dev panel can reach them and so a mode could differ later without
   * either of them being a literal in two files.
   *
   * Nudged once after play — "trees hit feel better now, but they could slow me
   * down a bit more - 15%". Read as 15% more slowdown than the softened value
   * rather than 15 points off it: the loss goes from 22% to 25%, which is a
   * nudge, where 0.78 - 0.15 would have been 37% and most of the way back to
   * the version that was too harsh.
   */
  crashKeep: 0.75,
  crashDrag: 1.8,
  crashTime: 0.8,

  // ── HOW FAST THE BOARD ANSWERS ────────────────────────────────────────────
  //
  // Three numbers decide it and they are not the same kind of number, so they
  // were retuned together on 21 Aug after hardware said the board was too slow
  // to steer (Gadi, 20 Aug, playing through Mueller on an ankle cradle):
  //
  //   edgeRate   how long the board takes to reach the edge you asked for.
  //              CONTROL LAG. It buys nothing and it is the honest place to
  //              spend a complaint about response.
  //   edgeCurve  how much of the range you must give up before the board takes
  //              you seriously. CONTROL SHAPING.
  //   turnBase/V how tight the arc is once the edge is set. WORLD PHYSICS —
  //              this one is a claim about snowboards, not about sensors.
  //
  // The total lag a player feels is the pipeline's tau of about 0.33 s
  // (BRIDGE.md §5.3, fixed for every host) plus whatever `edgeRate` adds. At
  // 3.8 the board's own half-life was 0.18 s and the chain came to roughly half
  // a second, of which the game owned a third. Halving the game's share is the
  // only part of that anyone here can spend, so it is spent.
  //
  // Sensitivity presets deliberately do NOT appear in any of these. A preset is
  // `settings.maxAngleDeg` and it changes how far a player leans to reach full
  // deflection; full deflection is still full edge on every preset, exactly as
  // wend's DESIGN 2.5 says of its plate. Scaling the turn rate by the preset as
  // well would make the radius of a carve a property of the patient rather than
  // of the mountain, and two players would then be riding different physics.
  edgeRate: 7.0,          // half-life 0.099 s, was 3.8 / 0.18 s
  tuckRate: 4.2,

  // Turning. omega = edge * (turnBase + v * turnV): the speed term is what makes
  // a held edge trace a constant radius, the constant is only there so a nearly
  // stopped rider can still pivot back onto the fall line.
  //
  // History, because this pair has now moved in both directions. 0.40/0.052
  // traced a 15 m radius at 90 km/h and 0.26/0.034 gave 22 m; both read as
  // twitchy to a player standing on a board with a 19 degree gamut under both
  // feet, so it was tuned down to 0.15/0.020 — about a 38 m arc, giant slalom.
  // That was right for the board and wrong for the cradle: on an ankle the same
  // gamut is roughly 12 degrees, the whole range is reached with a movement the
  // player can barely see, and a 38 m arc gives them almost nothing back for it.
  // 0.20/0.026 puts it at about 29 m — still a carve rather than a pivot, but
  // half way back toward the number the standing test rejected, which is the
  // part of that rejection worth keeping.
  turnBase: 0.20,
  turnV: 0.026,
  // Response curve on the lean. Without shaping, half a lean was already half
  // the turn rate and everything felt like a flick, so the range was bent so
  // that a casual lean is a casual turn and the last third is where the game
  // gets sharp. 1.7 does that at the cost of a soft middle — and the middle is
  // where an ankle in a cradle spends its whole session, because the outer third
  // of a 12 degree gamut is at the end of a patient's comfortable range rather
  // than at the end of a healthy body's lean. 1.35 keeps the commit-to-carve
  // shape and gives the middle of the range back.
  //
  // ── IT IS THE COMPOSED EXPONENT, NOT THIS FILE'S SHARE OF IT ──────────────
  // The pipeline now applies a radial gamma of its own (`bobo-host/tilt.js`,
  // shipped at 1.4) because the other four games were twitchy in the middle of
  // the range. This game was NOT: 1.35 is a measured answer to exactly that
  // complaint, arrived at by walking 1.7 back down. Left alone the two would
  // have multiplied to 1.89 — softer than the 1.7 that was already rejected for
  // burying the middle — and nothing would have failed, because a response
  // curve has no test that can tell "deliberately shaped" from "shaped twice".
  //
  // So 1.35 stays the number the mountain is tuned to, and `edgeExp` below is
  // what the rider actually raises the lean by: the RESIDUAL over whatever the
  // pipeline already did. Change this to change the feel; do not change it to
  // compensate for the pipeline.
  edgeCurve: 1.35,

  // The residual, recomputed by `setPipelineGamma`. 1.35 until told otherwise,
  // which is correct for a pipeline with no curve.
  edgeExp: 1.35,
  tuckTurnGain: 0.22,     // nose pressure tightens the arc
  bankPull: 0.55,         // how hard the bowl steers you back toward its centre
  airTurn: 0.30,

  // Speed.
  gravity: 9.81,
  // TUNED FOR ABOUT +10% ON THE CRUISE, which is the third setting this has
  // had in two days and the first one asked for by size: 0.0032 originally,
  // 0.00272 to compensate for fore-aft input going away (+11.4%, too much),
  // back to 0.0032, and now "a bit - like 10%".
  //
  // Terminal speed goes as the inverse square root of drag, but the measured
  // pair does slightly better than that law predicts -- 0.85x the drag gave
  // 1.114x the speed where the arithmetic says 1.085 -- because the friction
  // terms are linear in v and do not scale with it. Solving against the
  // MEASURED curve rather than the ideal one: 0.872x drag for 1.10x speed.
  drag: 0.00279,
  tuckDrag: 0.36,         // fraction of drag a full tuck removes
  baseFric: 0.035,
  edgeFric: 0.09,
  brake: 0.35,            // scrub from sitting back
  minSpeed: 7,
  maxSpeed: 44,

  // Camera.
  //
  // Portrait is a tall, narrow window: `fov` in three.js is VERTICAL, so at this
  // aspect a 68 degree setting bought only about 38 degrees horizontally — too
  // narrow for the bowl to read at all, while the bottom of the frame filled
  // with empty snow. The fix is not a wider fov (that only makes the frame
  // taller) but a higher camera looking further down the hill, which spends the
  // generous vertical angle on the course ahead instead of on the ground
  // underfoot.
  // Pulled in from 18/8.0/46: at those distances the rider was a speck in a
  // landscape frame — impressive mountain, unreadable game. This keeps the
  // course ahead in frame while the rider actually occupies it.
  camBack: 13.0,
  camUp: 5.9,
  camLookAhead: 36,
  /**
   * Metres above the snow at the look point — and the single number that decides
   * whether this game has a sky in it.
   *
   * The chase camera sits above the rider and aims at a point on the snow ahead,
   * so on a seventeen degree slope it is inherently pitched down; at 5 it came
   * out at twenty-seven degrees, which put the top of frame at four degrees of
   * elevation. Everything above that — the whole distant range, the horizon
   * band, the stars — was outside the picture, and three separate blind
   * reviewers, shown the frame with no context, independently reported that it
   * had no sky and no skyline at all.
   *
   * Raising the look point is the only lever that works. Looking FURTHER ahead
   * does not: the pitch converges to atan(slope) however far out the target
   * goes, because the ground falls away just as fast. At 13 the terrain skyline
   * lands at 14% of frame height against the reference art's 14.2%, and the
   * rider stays legible in the lower third. At 21 the vista is better still and
   * the rider is gone off the bottom of the frame, which is the trade this
   * number is really making.
   */
  camLookUp: 13,
  camLateral: 0.82,       // how much of the rider's drift off the centre line the camera follows
  camMaxOffset: 3.0,      // metres the rider may sit off centre-screen, hard limit
  camFollow: 4.2,
  camBackSlack: 2.2,      // metres the follow may sag behind camBack before it is caught
  camLookFollow: 3.0,
  camRoll: 0.16,
  camClearance: 2.2,
  fovBase: 56,
  fovSpeedGain: 11,

  // Tricks. See the TRICKS table below for what these buy.
  trickMinAir: 0.80,      // seconds of predicted flight before anything is attempted
  trickSpot: 0.24,        // seconds of the flight reserved for spotting the landing
  trickPace: 0.94,        // fraction of what is left the trick is allowed to fill
};


/** Fraction of the vertical half-fov the rider may sit off the view axis.
 *  0.62 holds them in the lower third at any pitch. */
const RIDER_KEEP = 0.62;

/**
 * How far across the fall line the board may ever point, radians.
 *
 * Without this a hard turn could carry the heading past ninety degrees and on
 * round to facing back UP the mountain. Gravity then decelerated instead of
 * accelerating, and the chase camera — which sits behind the rider along the
 * heading and looks ahead along it — swung up to stare at the sky with no input
 * able to recover it. Past about seventy-five degrees a rider is side-slipping
 * rather than riding anyway, so the limit costs nothing real.
 */
const MAX_YAW = 1.31;
const BOARD_HALF_W = 0.145;

/**
 * How fast a boost reaches its floor, per second. High enough that most of the
 * gain lands in the first half second — the point is to SEE the acceleration,
 * not to be teleported to a speed.
 */
const BOOST_RAMP = 3.2;

/**
 * Metres the board must clear the snow by before the rider counts as airborne.
 *
 * WITHOUT IT THE CONTACT TEST IS A COIN FLIP. On contact the rider is planted
 * with `y = ground` and `vy = mNew * vh`, the slope-following velocity, where
 * `mNew` comes from `gradient()` — a forward difference over 0.9 m. The next
 * frame is ballistic and then asks whether she cleared the snow by ANY amount,
 * so the only margin is `g * dt^2`.
 *
 * Measured against this terrain, traversing the bank at the reported condition:
 *
 *   speed     145 fps   60 fps   20 fps      <- frames where the gradient error
 *   25 km/h      0%       0%       0%           EXCEEDS the contact margin
 *   35 km/h     15%       0%       0%
 *   55 km/h     94%       0%       0%
 *   80 km/h    100%       0%       0%
 *
 * At 145 fps and 35 km/h the margin is 0.467 mm and the median gradient error
 * is 0.418 mm — the same size, which is what makes it alternate frame to frame
 * rather than fail outright. The error grows LINEARLY with the step (`v * dt`)
 * while the margin grows QUADRATICALLY (`g * dt^2`), so a faster frame rate is
 * strictly worse; below about 60 fps it never happens, which is why it could
 * not be reproduced in the software-rasterised QA harness at 20 fps.
 *
 * It matters far more than a millimetre of height suggests, because `airborne`
 * switches the rider's whole ORIENTATION — `upRef` flips between the surface
 * normal and world up, and the roll between full and 0.55 of it. Alternating
 * every frame draws two poses at once, which was reported from play as two
 * riders with a ribbon between them, one solid and one faint.
 *
 * 3 cm is about sixty times the errors measured here and small against both a
 * real launch (metres) and the board's own half width (14.5 cm), so nothing
 * that should leave the ground is held down by it. Hysteresis, not a dead zone:
 * leaving the snow needs this much clearance, landing needs none, so a real
 * flight still ends the instant the board touches.
 */
const AIR_CLEARANCE = 0.03;

/**
 * Peak angular amplitude of a camera shake, radians, at `shake` = 1.
 *
 * Quoted as an ANGLE because the shake is a rotation now (see the block in
 * `CameraRig.update`). The number is carried over from what the old positional
 * jitter subtended: 0.76 m of lateral offset at the 13 m the chase camera sits
 * back is about 0.058 rad. Set below that rather than at it: the old jitter was
 * uncorrelated, so most of its amplitude was spent cancelling itself out
 * frame to frame, and a smooth path of the same nominal size lands visibly
 * harder. Sampled at 60 Hz this traces about 1.1 m of peak-to-peak subject
 * travel against the old model's measured 0.94 m. `kick` caps `shake` at 1.4,
 * so the hardest wipeout peaks near four degrees.
 */
const SHAKE_ANGLE = 0.036;

// ── Tricks ──────────────────────────────────────────────────────────────────

/**
 * Automatic aerial tricks.
 *
 * WHAT A TRICK IS HERE, EXACTLY. It is an animation and an accounting entry, and
 * nothing else. It moves the visual rig — the group's spin about the board's own
 * vertical, the board mesh's own tip and yaw, and the skeleton — and it touches
 * `yaw`, `vh`, `vy`, `edge` and the collision path nowhere. Speed is not granted: what the rider gets in the air is exactly what
 * the run-up earned them, and a trick can neither add a metre per second nor
 * take one away. The only thing it changes about the run is what the landing is
 * worth.
 *
 * That is not a shortcut, it is the only version that is honest. Rotating the
 * simulated heading would feed straight into the speed model — `omega` bends
 * `yaw`, `yaw` picks the component of gravity that accelerates you — so a spin
 * would pay out in free acceleration on the landing, and a 360 that finished a
 * few degrees off would leave the board pointing somewhere the player never
 * asked for at ninety kilometres an hour.
 *
 * CHOSEN AT THE LIP AND NOT REVISITED. The whole flight is predicted the instant
 * the board leaves the snow, by marching the same analytic terrain the rider is
 * about to land on, and the biggest trick that fits in that flight is committed
 * to there and then. A trick that changed its mind at the apex would read as a
 * fumble however good the pose was.
 *
 * Board space, which every number below is written in, comes from
 * `tools/axes-probe.mjs`: +Y up, -Z the nose, +X the rider's right-of-travel.
 * The character faces -X, so -X is the TOE edge and +X the HEEL edge; the LEFT
 * foot and arm are the tail (rear) pair and the RIGHT the nose (lead) pair.
 */

/** Every bone a trick pose may write to — the same set `_flexSkeleton` drives. */
const TRICK_BONES = [
  'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg',
  'Spine', 'Spine1', 'Spine2', 'Neck',
  'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm',
];

function makeTrickPose() {
  const b = {};
  for (const n of TRICK_BONES) b[n] = [0, 0, 0];
  return { b, spin: 0, roll: 0, boardYaw: 0, tuck: 0 };
}

function zeroTrickPose(o) {
  for (const n of TRICK_BONES) {
    const v = o.b[n];
    v[0] = 0; v[1] = 0; v[2] = 0;
  }
  o.spin = 0; o.roll = 0; o.boardYaw = 0; o.tuck = 0;
}

/** Ramp in by `a`, hold, ramp back out from `b`. Zero at both ends, always. */
const hold = (ph, a, b) => smoothstep(0, a, ph) * (1 - smoothstep(b, 1, ph));

/**
 * Angle of a spin at phase `p`, normalised so a full trick is exactly 1 turn.
 *
 * TRAPEZOIDAL, not a smoothstep. A smoothstep's angular velocity is zero at both
 * ends and peaks in the middle, which on a 360 means the board barely moves for
 * the first fifth of the flight and then whips — a rider initiates a spin off
 * the lip and checks it before landing, and holds a constant rate in between.
 * `r` is the fraction of the trick spent ramping at each end.
 */
function spinEase(p, r = 0.18) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const S = (u) => u * u * u * (1 - 0.5 * u);   // ∫ smoothstep, S(1) = 0.5
  const n = 1 - r;                              // total area at unit peak rate
  if (p < r) return (r * S(p / r)) / n;
  if (p <= 1 - r) return (0.5 * r + (p - r)) / n;
  return (n - r * S((1 - p) / r)) / n;
}

/**
 * Knees up, body down toward the deck.
 *
 * These are much bigger than they look. The rider's hand reaches about 0.40 m
 * below the shoulder and the shoulder is 0.17 m above the hips, so the ONLY
 * thing that decides whether a grab reaches the board is how far the legs fold:
 * measured on the shipped rig, an extra half radian of knee takes the hips down
 * 0.12 m and the hand down with them, while an extra half radian of ARM moves
 * the hand about two centimetres — the stance already has the arm hanging
 * straight down, so past that it swings fore and aft on a cone rather than
 * reaching any lower. Every one of these numbers came off that measurement.
 */
function tuckLegs(o, k) {
  // Knee flex is NEGATIVE x on this rig — positive is hyperextension, which is
  // how the first stance ended up sitting in the air behind the board.
  // SYMMETRIC, unlike the riding flex it sits on top of. The board now follows
  // the boots, so the eight per cent more bend the rear knee carries while
  // carving — invisible on the snow — became twenty degrees of tail-high board
  // on every plain grab.
  o.b.LeftLeg[0] -= 1.30 * k;
  o.b.RightLeg[0] -= 1.30 * k;
  o.b.LeftUpLeg[0] -= 0.75 * k;
  o.b.RightUpLeg[0] -= 0.75 * k;
  // Curl over the board as well as under it: spine z is the axis that points
  // down the board, so this is the rider folding toward the nose.
  o.b.Spine[2] += 0.20 * k;
  o.b.Spine1[2] += 0.16 * k;
  o.tuck += k;
}

/**
 * A hand on an edge of the board.
 *
 * @param {'rear'|'lead'} side rear is the LEFT arm (the tail foot's side)
 * @param {number} edgeSign -1 toe edge (-X, the chest side), +1 heel edge (+X)
 */
function grab(o, side, edgeSign, k) {
  const rear = side === 'rear';
  const arm = rear ? 'LeftArm' : 'RightArm';
  const fore = rear ? 'LeftForeArm' : 'RightForeArm';
  // Probe: arm x+ drops the hand on both sides, but arm z+ carries the LEFT hand
  // to -X and the RIGHT hand to +X. The z that reaches a given edge is therefore
  // opposite on the two arms, which is exactly the sort of mirror that has to be
  // read off the table rather than guessed.
  const zs = (rear ? 1 : -1) * (edgeSign < 0 ? 1 : -1);
  o.b[arm][0] += 0.66 * k;
  o.b[arm][2] += 0.60 * k * zs;
  o.b[fore][0] += 0.40 * k;
  o.b[fore][2] += 0.55 * k * zs;
  // The shoulder has to go with the hand or the arm reads as detached: lean the
  // spine over the edge being grabbed. Spine x+ bows toward the toe edge.
  //
  // SMALL, and spread thinnest at the top. Pitch stacked across the spine chain
  // is the one thing this rig has already been broken by — a method carrying
  // 0.42, 0.34 and 0.22 through three bones plus its own arch came out head-down
  // with its boots off the board, which is the README's "folded in half at the
  // waist" arriving in the air instead of on the snow.
  o.b.Spine[0] -= 0.22 * k * edgeSign;
  o.b.Spine1[0] -= 0.12 * k * edgeSign;
}

/** The other arm, thrown up and out for balance. */
function freeArm(o, side, k) {
  const rear = side === 'rear';
  const arm = rear ? 'LeftArm' : 'RightArm';
  const fore = rear ? 'LeftForeArm' : 'RightForeArm';
  o.b[arm][0] -= 0.50 * k;
  o.b[arm][2] += (rear ? 1 : -1) * 0.34 * k;
  o.b[fore][0] -= 0.22 * k;
}

/**
 * The trick table, ORDERED BY the air each one needs.
 *
 * `air` is the seconds of flight it needs AFTER the spotting window has been
 * taken off the top, so it is genuinely how long the trick has to happen in and
 * not how long the jump is. `dur` is how long it takes when it is not rushed:
 * these kickers give between one and a half and three and a half seconds of
 * air depending on how much speed was carried in, and a 360 stretched to fill
 * three seconds is not a slower 360, it is a rider forgetting to spin. Past its
 * natural length the trick finishes and the rider holds the landing pose, which
 * is what spotting a landing looks like anyway. `value` is what landing it
 * awards before the combo multiplier, and is what the HUD prints next to `name`.
 *
 * The values are deliberately a fraction of what the same jump's AIR is worth —
 * a 360 is 220 against the 550 that two and a half seconds of air pays, both
 * then multiplied by the same combo. Par for the whole run is about 32,000 and
 * a course has eight kickers, so a trick priced level with the air would have
 * made hitting ramps worth more than the gates and the carving put together,
 * and the game is not about the ramps.
 *
 * The rotations are all WHOLE turns. A 180 or a 540 lands switch, and since the
 * visual rig is the only thing turning, switch would mean a rider permanently
 * facing backwards over a board still travelling nose-first — the pose is
 * bolted to the direction of travel, so half rotations have nowhere to end.
 */
const TRICKS = [
  {
    // Rear hand on the toe edge between the bindings: the plainest grab there
    // is, and the one that reads at eighty pixels because the whole body balls
    // up around the board.
    name: 'indy', value: 70, air: 0.62, dur: 0.75, spins: 0,
    pose(ph, o) {
      const k = hold(ph, 0.34, 0.60);
      tuckLegs(o, k * 0.95);
      grab(o, 'rear', -1, k);
      freeArm(o, 'lead', k * 0.6);
      o.roll = -0.20 * k;
    },
  },
  {
    // Rear hand behind, on the heel edge — the board tips the other way, which
    // is the whole point of having two grabs.
    name: 'stalefish', value: 75, air: 0.62, dur: 0.75, spins: 0,
    pose(ph, o) {
      const k = hold(ph, 0.34, 0.60);
      tuckLegs(o, k * 0.9);
      grab(o, 'rear', 1, k);
      freeArm(o, 'lead', k * 0.7);
      o.roll = 0.26 * k;
    },
  },
  {
    // Lead hand across to the toe edge: the arms cross, so the silhouette is
    // different from the indy even when the board is at the same angle.
    name: 'mute', value: 75, air: 0.70, dur: 0.80, spins: 0,
    pose(ph, o) {
      const k = hold(ph, 0.32, 0.60);
      tuckLegs(o, k);
      grab(o, 'lead', -1, k);
      freeArm(o, 'rear', k * 0.6);
      o.roll = -0.28 * k;
    },
  },
  {
    // Shifty: the board swings across the direction of travel and back while the
    // shoulders stay pointing down the hill. Nothing rotates on balance, so it
    // is the one trick that cannot possibly be caught out mid-rotation — which
    // is why it sits at the bottom of the range where the margin is thinnest.
    name: 'shifty', value: 100, air: 0.85, dur: 0.90, spins: 0,
    pose(ph, o) {
      const k = hold(ph, 0.30, 0.55);
      tuckLegs(o, k * 0.8);
      o.boardYaw = 0.95 * k;
      o.b.LeftArm[0] -= 0.30 * k;
      o.b.RightArm[0] -= 0.34 * k;
      o.b.Spine[2] += 0.16 * k;
      o.roll = -0.14 * k;
    },
  },
  {
    // Method: rear hand on the heel edge, front leg boned out, back arched, the
    // board pulled over until the base faces the camera. The most photographed
    // trick in the sport because it is the most legible one, which is the same
    // reason it is here.
    name: 'method', value: 150, air: 1.15, dur: 1.20, spins: 0,
    pose(ph, o) {
      const k = hold(ph, 0.36, 0.58);
      grab(o, 'rear', 1, k);
      // One leg boned, one leg tucked: the asymmetry IS the trick. Kept inside
      // what the boots can take — the re-plant holds their MIDPOINT, so a big
      // difference between the two legs walks one boot off the deck however
      // well the average behaves.
      o.b.RightLeg[0] += 0.20 * k;
      o.b.RightUpLeg[0] += 0.12 * k;
      o.b.LeftLeg[0] -= 0.72 * k;
      o.b.LeftUpLeg[0] -= 0.42 * k;
      o.tuck += 0.5 * k;
      // The lead arm goes up. The arch is left to the board roll, which is what
      // a method actually reads as at this distance anyway.
      o.b.RightArm[0] -= 0.70 * k;
      o.b.RightArm[2] -= 0.28 * k;
      o.roll = 0.62 * k;
    },
  },
  {
    // Melon: lead hand across to the heel edge, board tweaked the other way from
    // the method. It exists because the method was otherwise the only thing a
    // kicker taken at sixty kilometres an hour could ever produce.
    name: 'melon', value: 140, air: 1.15, dur: 1.10, spins: 0,
    pose(ph, o) {
      const k = hold(ph, 0.32, 0.60);
      tuckLegs(o, k * 0.8);
      grab(o, 'lead', 1, k);
      freeArm(o, 'rear', k * 0.8);
      o.roll = 0.42 * k;
    },
  },
  {
    // A full turn each way, with a grab held through the middle. Frontside is
    // the one that takes the chest toward the nose: the chest faces -X and a
    // positive rotation about the board's up carries -X toward +Z (the tail),
    // so frontside for this rider is the NEGATIVE direction. Derived once,
    // here, rather than guessed at each call site.
    name: 'frontside 360', value: 220, air: 1.80, dur: 1.55, spins: -1,
    pose(ph, o) {
      const k = hold(ph, 0.22, 0.72);
      tuckLegs(o, k);
      grab(o, 'rear', -1, k * 0.85);
      freeArm(o, 'lead', k * 0.5);
      o.roll = -0.16 * k;
    },
  },
  {
    name: 'backside 360', value: 220, air: 1.80, dur: 1.55, spins: 1,
    pose(ph, o) {
      const k = hold(ph, 0.22, 0.72);
      tuckLegs(o, k);
      grab(o, 'lead', -1, k * 0.85);
      freeArm(o, 'rear', k * 0.5);
      o.roll = -0.20 * k;
    },
  },
  {
    // Two turns, and three and a quarter seconds of flight to be offered it.
    // Measured on the shipped kickers, that means the biggest of them taken at
    // over a hundred kilometres an hour: rare by construction rather than by a
    // die roll, which is the right way for the biggest trick in the game to be
    // rare. (It is also why `_predictAir` marches to four seconds and not to
    // three — at a three second cap this threshold is simply unreachable, and
    // the trick would have been dead code that looked alive.)
    name: 'backside 720', value: 450, air: 3.00, dur: 2.60, spins: 2,
    pose(ph, o) {
      const k = hold(ph, 0.14, 0.80);
      tuckLegs(o, k * 1.15);
      grab(o, 'lead', -1, k * 0.9);
      o.b.LeftArm[0] += 0.30 * k;     // both arms pulled in tight to the spin
      o.b.LeftForeArm[0] += 0.40 * k;
      o.roll = -0.12 * k;
    },
  },
];

// ── Geometry ────────────────────────────────────────────────────────────────

/**
 * A lofted snowboard: sidecut waist, wider tips, rocker at the ends and a touch
 * of camber underfoot. It is on screen for the entire run, so it is worth the
 * twenty lines it takes to make it an actual board shape rather than a slab.
 */
function buildBoardGeometry() {
  const LEN = 1.56;
  const N = 26;
  const W_WAIST = 0.125;
  const W_TIP = 0.152;
  const THICK = 0.021;
  const TIP_RISE = 0.075;
  const CAMBER = 0.012;

  const pos = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 - 1;                    // -1 tail .. +1 nose
    const round = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 8)), 0.5);
    const w = (W_WAIST + (W_TIP - W_WAIST) * t * t) * round;
    const y = TIP_RISE * Math.pow(Math.abs(t), 6) - CAMBER * (1 - t * t);
    const z = -t * LEN * 0.5;                     // local -Z is forward
    // Cross-section: top-left, top-right, bottom-right, bottom-left.
    pos.push(-w, y + THICK, z, w, y + THICK, z, w, y, z, -w, y, z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 4;
    const b = a + 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function box(w, h, d, x, y, z, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  if (rx || rz) m.makeRotationFromEuler(new THREE.Euler(rx, 0, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

/**
 * A stance, not a skeleton. The rider is posed once in a compressed carving
 * position and animated entirely by the group above it — roll, pitch and a
 * crouch. At thirteen metres behind, articulated joints would cost a rig and buy
 * nothing; the silhouette against backlit snow is doing all the work.
 */
function buildRiderGeometry() {
  const parts = [
    box(0.16, 0.10, 0.26, -0.10, 0.09, 0.20),   // rear boot
    box(0.16, 0.10, 0.26, 0.10, 0.09, -0.22),   // front boot
    box(0.19, 0.44, 0.24, -0.11, 0.32, 0.15, 0.30, 0.10),   // rear leg
    box(0.19, 0.44, 0.24, 0.11, 0.32, -0.17, -0.30, -0.10), // front leg
    box(0.34, 0.30, 0.26, 0.0, 0.63, 0.0),      // hips
    box(0.38, 0.40, 0.28, 0.0, 0.92, -0.03, -0.16, 0),      // torso, folded forward
    box(0.11, 0.40, 0.13, -0.26, 0.98, 0.10, 0, 0.55),      // trailing arm, flung out
    box(0.11, 0.36, 0.13, 0.25, 0.98, -0.12, 0, -0.75),     // leading arm, reaching
  ];
  return mergeGeometries(parts, false);
}

function buildHelmetGeometry() {
  const g = new THREE.IcosahedronGeometry(0.135, 1);
  g.translate(0.02, 1.20, -0.06);
  return g;
}

function buildGogglesGeometry() {
  const g = new THREE.BoxGeometry(0.235, 0.085, 0.055);
  g.translate(0.02, 1.205, -0.175);
  return g;
}

// ── Rider ───────────────────────────────────────────────────────────────────

/**
 * Decide, per vertex, whether this piece of the character belongs to the
 * profile colour: the cap and the jacket do, everything else does not.
 *
 * Per VERTEX and not per texel, because the 128x128 atlas packs its UV islands
 * so tightly that head, suit and skin share pixels -- a mask painted in
 * texture space bleeds across all of them (measured: painting only the head's
 * triangles recoloured half the suit). A vertex carries its dominant bone and
 * its own sample of the atlas, and that pair cuts cleanly: the HELMET is the
 * maroon cluster (144,48,96) on head-weighted vertices -- the ponytail and the
 * face fail the colour test and keep their own; the SHIRT is every spine- and
 * shoulder-weighted vertex that is not bright warm skin, which spares the bare
 * midriff. Clusters measured off the shipped atlas and the cuts verified by
 * recolouring in-page from both sides, 2026-10-13. Mind the V axis: this is a
 * glTF texture, flipY is FALSE, and sampling at 1-v reads a mirrored atlas --
 * the first mask looked right in a race and was wrong everywhere (the jacket
 * rule matched by coincidence).
 *
 * Baked once per GEOMETRY: rider two is cloned from the same model, shares the
 * buffer, and finds the attribute already there.
 *
 * @returns {boolean} whether the attribute exists, i.e. the material should be
 *   built with the garment path at all
 */
function bakeGarmentMask(mesh, map) {
  const geo = mesh.geometry;
  if (geo.getAttribute('aGarment')) return true;
  const img = map.image;
  const uv = geo.getAttribute('uv');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  if (!img || !uv || !si || !sw || !mesh.skeleton) return false;
  let px;
  const w = img.width;
  const h = img.height;
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    px = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // A compressed or tainted texture cannot be read back; the rider simply
    // has no profile garments then, which only costs the colour.
    return false;
  }
  const names = mesh.skeleton.bones.map((b) => b.name.replace(/^mixamorig\d*[:_ ]?/i, ''));
  const flip = map.flipY;
  const out = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) {
    let best = 0;
    let bw = -1;
    for (let k = 0; k < 4; k++) {
      const wgt = sw.getComponent(i, k);
      if (wgt > bw) { bw = wgt; best = si.getComponent(i, k); }
    }
    const bone = names[best] ?? '';
    const x = Math.min(w - 1, Math.max(0, Math.round(uv.getX(i) * (w - 1))));
    const v = flip ? 1 - uv.getY(i) : uv.getY(i);
    const y = Math.min(h - 1, Math.max(0, Math.round(v * (h - 1))));
    const j = (y * w + x) * 4;
    const r = px[j];
    const g = px[j + 1];
    const b = px[j + 2];
    const helmet = /Head|Neck/.test(bone)
      && r >= 70 && g <= r * 0.62 && b <= r * 0.95;
    const skin = r - g >= 40 && r >= 200;
    const shirt = /Spine|Shoulder/.test(bone) && !skin;
    out[i] = helmet || shirt ? 1 : 0;
  }
  geo.setAttribute('aGarment', new THREE.BufferAttribute(out, 1));
  return true;
}

export class Rider {
  /**
   * @param {object|null} model a loaded glTF scene, or null to fall back to the
   *   primitive rider. The fallback is kept deliberately: the model is a 226 kB
   *   asset fetched over the localhost server, and a game that cannot start
   *   because one file did not arrive is worse than one with a blocky rider.
   */
  constructor(terrain, scene, mood, model = null) {
    this.terrain = terrain;
    this.mood = mood;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.matBoard = makeLitMaterial(mood, { color: BOARD_COLOR, wrap: 0.3, gloss: 60, specular: 0.55 });
    this.matSuit = makeLitMaterial(mood, { color: 0x1a1d24, wrap: 0.45, gloss: 22, specular: 0.22 });
    this.matHelmet = makeLitMaterial(mood, { color: 0xf2f4f8, wrap: 0.35, gloss: 40, specular: 0.4 });
    this.matGoggles = makeLitMaterial(mood, { color: 0xff8a3d, wrap: 0.2, gloss: 90, specular: 1.1, emissive: 0.35 });
    this.materials = [this.matBoard, this.matSuit, this.matHelmet, this.matGoggles];

    // ── THE BOARD DRAWS OVER THE TRAIL AND ITS OWN SHADOW ──────────────
    // Being opaque was not enough. Opaque draws first and the trail is depth
    // tested against it, which is correct everywhere except the one place it
    // matters: the board clears the ducked trail by 17 mm, and the moment it
    // ROLLS onto an edge the downhill rail dips under that and the spray closes
    // over it. Seventeen millimetres is not a margin, it is a coincidence.
    //
    // So it joins the transparent pass at the top of the stack instead: trail
    // (2), shadow (3), board (4). `depthTest` stays on, so anything genuinely
    // in front -- a tree, the rider's own leg -- still occludes it; but the
    // trail and the shadow write no depth at all, so nothing of theirs can
    // paint over it any more. Opacity is 1 and `depthWrite` stays on, so it
    // behaves exactly like the opaque object it is.
    this.matBoard.transparent = true;
    this.board = new THREE.Mesh(buildBoardGeometry(), this.matBoard);
    this.board.renderOrder = 4;
    this.board.frustumCulled = false;

    this.bodyGroup = new THREE.Group();
    this.bones = null;
    if (model) this._attachModel(model, mood);
    else {
      this.bodyGroup.add(new THREE.Mesh(buildRiderGeometry(), this.matSuit));
      this.bodyGroup.add(new THREE.Mesh(buildHelmetGeometry(), this.matHelmet));
      this.bodyGroup.add(new THREE.Mesh(buildGogglesGeometry(), this.matGoggles));
    }
    this.bodyGroup.traverse((o) => { o.frustumCulled = false; });

    this.group.add(this.board);
    this.group.add(this.bodyGroup);

    // Scratch objects, allocated once — the update runs every frame.
    this.world = new THREE.Vector3();
    this.heading = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 1, 0);
    this._fwd = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._rgt = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._qr = new THREE.Quaternion();
    this._spinAxis = new THREE.Vector3(0, 1, 0);
    this._v0 = new THREE.Vector3();
    this._v1 = new THREE.Vector3();
    this._boot = { x: 0, y: 0, z: 0 };
    this._bootRef = null;
    this._grad = { gx: 0, gz: 0 };
    this._tp = makeTrickPose();

    this.reset();
  }

  /** Swap in the rigged character and put it into the carving stance. */
  _attachModel(model, mood) {
    const root = model;
    this.bones = new Map();
    root.traverse((o) => {
      // FBX2glTF sanitises node names, so the rig's `mixamorig1:LeftLeg` can
      // arrive as `mixamorig1_LeftLeg`. Matching only the colon form found
      // nothing, applied no stance at all, and left the rider riding the
      // mountain in a T-pose.
      if (o.isBone) this.bones.set(o.name.replace(/^mixamorig\d*[:_ ]?/i, ''), o);
      if (!o.isMesh && !o.isSkinnedMesh) return;
      // The character keeps its own diffuse but is lit by the game's sun, fog
      // and ambient split, exactly like the trees and the gates. Anything else
      // and it reads as a cut-out laid over the mountain.
      // A SECOND RIDER IS BUILT FROM A CLONE OF THE FIRST'S MODEL, and by then
      // the first Rider has already swapped every material for a lit
      // ShaderMaterial -- which has no `.map`; the diffuse lives in its uMap
      // uniform. Reading only `.map` gave player two no texture at all, and
      // they rode the race as a white ghost against the snow (BAL-594).
      const map = o.material?.map ?? o.material?.uniforms?.uMap?.value ?? null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
      }
      const garment = o.isSkinnedMesh && map ? bakeGarmentMask(o, map) : false;
      o.material = makeLitMaterial(mood, {
        color: 0xffffff, wrap: 0.42, gloss: 26, specular: 0.22, map, garment,
      });
      this.materials.push(o.material);
      o.castShadow = false;
      o.frustumCulled = false;
    });

    // WRAP, never overwrite. FBX2glTF puts Mixamo's Z-up to Y-up conversion — and
    // any unit scale — on the scene root's own transform. Assigning rotation.y
    // there wipes it, and the rider rides the whole mountain lying on their back.
    const rig = new THREE.Group();
    rig.add(root);
    rig.scale.setScalar(RIDER_SCALE);
    rig.position.y = RIDER_LIFT;
    rig.rotation.y = STANCE.bodyYaw + BODY_PIVOT_DEG * Math.PI / 180;
    this.rig = rig;

    // Record every bone's bind rotation BEFORE the stance touches anything, so
    // a stance value can be re-applied — or live-tuned from the console — as an
    // absolute delta from bind rather than compounding on itself.
    for (const bone of this.bones.values()) {
      bone.userData.bind = bone.rotation.clone();
    }
    for (const [name, r] of Object.entries(STANCE)) {
      if (name === 'bodyYaw') continue;
      const bone = this.bones.get(name);
      if (!bone) continue;
      bone.rotation.x += r.x ?? 0;
      bone.rotation.y += r.y ?? 0;
      bone.rotation.z += r.z ?? 0;
      // Remember the stance so the per-frame flex is relative to it, not
      // cumulative — otherwise the rider slowly folds in half over a run.
      bone.userData.stance = bone.rotation.clone();
    }
    this.plantFeet();

    const missing = Object.keys(STANCE)
      .filter((k) => k !== 'bodyYaw' && !this.bones.has(k));
    if (missing.length) {
      console.warn(`[carve] rig bones not found: ${missing.join(', ')} — ` +
        `have: ${[...this.bones.keys()].slice(0, 8).join(', ')}…`);
    }
    this.bodyGroup.add(rig);
  }

  /**
   * Plant the boots on the top sheet. Bending a knee in forward kinematics
   * lifts the FOOT; the hips do not come down to meet the board. Rather than
   * hand-tuning an offset that goes stale the moment the stance changes,
   * measure where the boots ended up — in the bodyGroup's space, so it works
   * mid-run as well as at construction — and move the rig to compensate.
   */
  /**
   * Yaw one foot ON THE DECK PLANE (about the group's up axis), live, and make
   * it stick: the stance is updated so every later frame builds on it, the IK
   * references recapture, and the resulting local angles are logged for baking.
   * QA tool -- exposed as CARVE.footYaw('Left'|'Right', degrees).
   */
  /**
   * Tint the character, so two humans on one screen can tell who is who.
   *
   * A MULTIPLY over the full texture, not the rivals' recolour: the rivals run
   * a low uMapTint so their jersey colour wins, which is exactly what makes them
   * read as "the field". A player keeps the whole character -- face, seams,
   * suit -- and only takes a cast of their colour, `strength` of the way from
   * white. Only the textured body takes it; the board keeps its own colour.
   *
   * @param {number|null} hex  null puts the rider back to untinted
   * @param {number} [strength] 0 = no tint, 1 = full multiply
   */
  setTint(hex, strength = 0.45) {
    const base = new THREE.Color(0xffffff);
    if (hex != null) base.lerp(new THREE.Color(hex), strength);
    for (const m of this.materials) {
      if (m.uniforms?.uMap) m.uniforms.uBase.value.copy(base);
    }
  }

  /**
   * The profile's theme colour, worn rather than washed over: the cap, the
   * jacket and the board take the colour outright; face, hair, pants and
   * boots keep their own. Which texels count as cap and jacket is decided per
   * VERTEX at load (bakeGarmentMask) -- the 128x128 atlas packs its islands
   * too tightly for a texture-space mask (painting the head's own triangles
   * recoloured half the suit, measured 2026-10-13).
   *
   * The fallback primitive rider has no garment vertices, so there the helmet
   * primitive takes the colour instead, and the board carries most of it.
   *
   * @param {number|null} hex  the profile colour; null returns every piece to
   *   its shipped colour
   * @param {number} [strength] how fully the cap and jacket take it (0..1)
   */
  setProfileColor(hex, strength = 1) {
    for (const m of this.materials) {
      if (!m.uniforms?.uProfile) continue;
      if (hex != null) m.uniforms.uProfile.value.set(hex);
      m.uniforms.uProfileMix.value = hex == null ? 0 : strength;
    }
    this.matBoard.uniforms.uBase.value.set(hex == null ? BOARD_COLOR : hex);
    this.matHelmet.uniforms.uBase.value.set(hex == null ? 0xf2f4f8 : hex);
  }

  /** Rotate the STRAP TARGET itself, in group space -- lossless: what you see
   *  held is literally the value that bakes (FEET_GROUP_Q). */
  _spinFootTarget(side, axisGroup, deg) {
    this._ikCapture();
    const G = side === 'Left' ? this._ik?.L : this._ik?.R;
    if (!G) return null;
    const q = new THREE.Quaternion().setFromAxisAngle(axisGroup, deg * Math.PI / 180);
    G.qFootGroup0.premultiply(q);
    const o = G.qFootGroup0;
    console.log(`[carve] ${side}Foot groupQ -> { x: ${o.x.toFixed(4)}, y: ${o.y.toFixed(4)}, z: ${o.z.toFixed(4)}, w: ${o.w.toFixed(4)} }`);
    return { x: +o.x.toFixed(4), y: +o.y.toFixed(4), z: +o.z.toFixed(4), w: +o.w.toFixed(4) };
  }

  /**
   * Yaw the body about the LEFT anchor: rig turns by deg, the right anchor
   * rotates about the left by the same deg (group-space Y), the left anchor is
   * the fixed pivot. `turnRig` false at capture (the rig's stance yaw is baked
   * separately there via the same constant).
   */
  _applyPivot(L, R, deg, turnRig = true) {
    const th = deg * Math.PI / 180;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const dx = R.anchor.x - L.anchor.x;
    const dz = R.anchor.z - L.anchor.z;
    R.anchor.x = L.anchor.x + dx * c + dz * sn;
    R.anchor.z = L.anchor.z - dx * sn + dz * c;
    if (turnRig && this.rig) this.rig.rotation.y += th;
  }

  /** Nudge the WHOLE character across the board, feet included. Live dial:
   *  CARVE.nudge(metres); logs the running total for RIDER_NUDGE_X. */
  nudge(dx) {
    if (!this.rig) return null;
    this.rig.position.x += dx;
    this._rigBaseX += dx;
    if (this._ik) { this._ik.L.anchor.x += dx; this._ik.R.anchor.x += dx; }
    this._standRef = null; // re-measure against the moved stance
    this._nudgeTotal = (this._nudgeTotal ?? 0) + dx;
    console.log(`[carve] nudge total -> ${this._nudgeTotal.toFixed(3)} m (add to RIDER_NUDGE_X)`);
    return this._nudgeTotal;
  }

  /** Live dial: CARVE.bodyPivot(deg). Logs the running total to bake. */
  bodyPivot(deg) {
    this._ikCapture();
    if (!this._ik) return null;
    this._applyPivot(this._ik.L, this._ik.R, deg, true);
    this._pivotTotal = (this._pivotTotal ?? 0) + deg;
    console.log(`[carve] body pivot total -> ${this._pivotTotal.toFixed(1)} deg (bake into BODY_PIVOT_DEG)`);
    return this._pivotTotal;
  }

  /** Slide one foot's deck anchor along the board, live. + = tail. Logs the
   *  running total for baking into FEET_ANCHOR_SLIDE. */
  slideFootOnDeck(side, metres) {
    this._ikCapture();
    const G = side === 'Left' ? this._ik?.L : this._ik?.R;
    if (!G) return null;
    G.anchor.z += metres;
    G._slideTotal = (G._slideTotal ?? 0) + metres;
    console.log(`[carve] ${side}Foot slide total -> ${G._slideTotal.toFixed(3)} m (bake into FEET_ANCHOR_SLIDE)`);
    return G._slideTotal;
  }

  yawFootOnDeck(side, deg) {
    return this._spinFootTarget(side, new THREE.Vector3(0, 1, 0), deg);
  }

  /**
   * Pitch one foot's TOE down/up about the deck-plane axis perpendicular to
   * the toe direction -- the companion dial to yawFootOnDeck. Negative drops
   * the toe. Same contract: sticks via stance, recaptures IK, logs the bake.
   * Exposed as CARVE.footPitch('Left'|'Right', degrees).
   */
  pitchFootOnDeck(side, deg) {
    // axis = deck-plane direction perpendicular to the toe, in GROUP space
    const foot = this.bones?.get(`${side}Foot`);
    const toe = this.bones?.get(`${side}ToeBase`);
    if (!foot || !toe) return null;
    this.group.updateMatrixWorld(true);
    const a = this.group.worldToLocal(foot.getWorldPosition(new THREE.Vector3()));
    const t = this.group.worldToLocal(toe.getWorldPosition(new THREE.Vector3()));
    const d = t.sub(a);
    const axis = new THREE.Vector3(-d.z, 0, d.x).normalize();
    return this._spinFootTarget(side, axis, deg);
  }

  plantFeet() {
    if (!this.bones || !this.rig) return;
    const lf = this.bones.get('LeftFoot');
    const rf = this.bones.get('RightFoot');
    if (!lf || !rf) return;
    // Measure from the resting height, not from wherever the per-frame air
    // crouch happens to have left the rig.
    if (this._rigBaseY != null) this.rig.position.set(this._rigBaseX, this._rigBaseY, this._rigBaseZ);
    this.bodyGroup.updateMatrixWorld(true);
    const a = this.bodyGroup.worldToLocal(lf.getWorldPosition(new THREE.Vector3()));
    const b = this.bodyGroup.worldToLocal(rf.getWorldPosition(new THREE.Vector3()));
    this.rig.position.y += RIDER_LIFT - (a.y + b.y) * 0.5;
    this.rig.position.z += -(a.z + b.z) * 0.5;
    this.rig.position.x += -(a.x + b.x) * 0.5;
    this.rig.position.x += RIDER_NUDGE_X;
    this._rigBaseX = this.rig.position.x;
    this._rigBaseY = this.rig.position.y;
    this._rigBaseZ = this.rig.position.z;
    // Invalidate the bare-stance reference; _replant re-measures it lazily.
    // (Measuring HERE broke boot: construction-time plantFeet runs before the
    // scratch vectors _bootMid borrows exist.)
    this._standRef = null;
  }

  /** Where the boots sit right now, in the bodyGroup's frame. */
  _bootMid(out = { x: 0, y: 0, z: 0 }) {
    const lf = this.bones?.get('LeftFoot');
    const rf = this.bones?.get('RightFoot');
    if (!lf || !rf || !this.rig) return null;
    // A stale parent world matrix cancels out: the boots are taken to world
    // through the same chain they are brought back through.
    this.bodyGroup.updateMatrixWorld(true);
    const a = this.bodyGroup.worldToLocal(lf.getWorldPosition(this._v0));
    const b = this.bodyGroup.worldToLocal(rf.getWorldPosition(this._v1));
    out.x = (a.x + b.x) * 0.5;
    out.y = (a.y + b.y) * 0.5;
    out.z = (a.z + b.z) * 0.5;
    return out;
  }

  /**
   * Hold the boots where the lip left them, whatever the trick does to the legs.
   *
   * A trick folds the knees about twice as far as anything else in the game, and
   * forward kinematics lifts the FOOT rather than lowering the hips — so without
   * this the boots leave the deck and the whole tuck goes into the air instead
   * of into the crouch. It is `plantFeet`'s measurement again, per frame and
   * mixed in by `w`.
   *
   * Against the boot position MEASURED AT THE LIP, not against `RIDER_LIFT`.
   * The construction-time plant is made on the bare stance; by the time a rider
   * is in the air the per-frame flex and the air drop have moved the boots ten
   * centimetres from it, so planting to the construction number mid-flight is a
   * step of exactly that size — it lifted the whole rider on take-off, which is
   * the opposite of what a measurement is for.
   */
  /**
   * ── PER-LEG TWO-BONE IK (the plan's last tier, asked for by name) ─────────
   *
   * The midpoint replant kept the BOOTS' AVERAGE on the deck; at a hard lean
   * the per-foot residual still showed ("better but still not perfect"). This
   * places EACH ankle on its own deck anchor exactly, and turns the crouch
   * physically honest: the PELVIS drops (crouch/air/absorb) and the knees
   * derive from geometry, instead of knee angles being authored and the feet
   * landing wherever FK leaves them.
   *
   * Planar per leg, no axis archaeology: `flex()` already established that X
   * is the pitch axis on UpLeg/Leg/Foot for this rig, and the STANCE pose is
   * the baseline every angle is solved as a delta from -- at the bare stance
   * the solver is exactly identity. Out-of-plane lean is a small clamped aim
   * on the hip's Z. The ankle counter-rotates so the sole keeps its stance
   * pitch. Tricks keep their authored poses: IK yields whenever trickBlend is
   * up, the same boundary every other layer here respects.
   */
  _ikCapture() {
    if (this._ik || !this._v0 || !this.bones) return;
    const hips = this.bones.get('Hips');
    if (!hips) return;
    this.bodyGroup.updateMatrixWorld(true);
    const inBody = (bone) => this.bodyGroup.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    const leg = (side) => {
      const hipB = this.bones.get(`${side}UpLeg`);
      const kneeB = this.bones.get(`${side}Leg`);
      const ankleB = this.bones.get(`${side}Foot`);
      if (!hipB || !kneeB || !ankleB) return null;
      const hip0 = inBody(hipB);
      const knee0 = inBody(kneeB);
      const ankle0 = inBody(ankleB);
      const L1 = hip0.distanceTo(knee0);
      const L2 = knee0.distanceTo(ankle0);
      const V0 = ankle0.clone().sub(hip0);
      const d0 = V0.length();
      // The leg's working plane: vertical, through hip->ankle. `u` is its
      // horizontal direction; the knee's side of the hip-ankle line fixes
      // which of the two triangle solutions this leg actually uses.
      const u = new THREE.Vector3(V0.x, 0, V0.z);
      if (u.lengthSq() < 1e-6) u.set(0, 0, 1); else u.normalize();
      const phi0 = Math.atan2(V0.x * u.x + V0.z * u.z, -V0.y);
      const a0 = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d0 * d0 - L2 * L2) / (2 * L1 * d0))));
      const k0 = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d0 * d0) / (2 * L1 * L2))));
      // which side of the hip-ankle line the knee sits on, in-plane
      const t = knee0.clone().sub(hip0);
      const along = (t.x * V0.x + t.y * V0.y + t.z * V0.z) / (d0 * d0);
      const perp = t.clone().sub(V0.clone().multiplyScalar(along));
      const sgn = Math.sign(perp.x * u.x + perp.z * u.z - perp.y * 0) || 1;
      return {
        hipB, kneeB, ankleB,
        anchor: ankle0, u, L1, L2, phi0, a0, k0, sgn,
        hipX0: hipB.userData.stance.x, hipZ0: hipB.userData.stance.z,
        kneeX0: kneeB.userData.stance.x, footX0: ankleB.userData.stance.x,
      };
    };
    const L = leg('Left');
    const R = leg('Right');
    if (!L || !R) return;
    // STRAP-RIGID BOOTS: capture each foot's orientation relative to the GROUP
    // (the board's frame) at stance. Every frame the ankle is set so the boot
    // keeps exactly this orientation to the deck -- bindings do not rotate.
    // This replaces the old X-only ankle counter, which after any foot yaw was
    // spinning about a DIAGONAL (local X is only pitch on an un-yawed foot):
    // the live game twisted the boots off-plane while frozen-writer screenshots
    // looked fine, which is why no remote round ever matched Elad's screen.
    const gq = this.group.getWorldQuaternion(new THREE.Quaternion());
    const capture = (G, side) => {
      const fixed = FEET_GROUP_Q[side];
      if (fixed) {
        G.qFootGroup0 = new THREE.Quaternion(fixed.x, fixed.y, fixed.z, fixed.w);
      } else {
        G.qFootGroup0 = gq.clone().invert()
          .multiply(G.ankleB.getWorldQuaternion(new THREE.Quaternion()));
        const q = G.qFootGroup0;
        console.log(`[carve] ${side}Foot groupQ -> { x: ${q.x.toFixed(4)}, y: ${q.y.toFixed(4)}, z: ${q.z.toFixed(4)}, w: ${q.w.toFixed(4)} }`);
      }
    };
    this._ikQ1 = new THREE.Quaternion();
    this._ikQ2 = new THREE.Quaternion();
    // BOTH ANCHORS ON THE DECK PLANE. The stance capture inherited a 3.4 cm
    // height difference between the boots (measured), and holding each ankle
    // to its own captured height keeps one boot hovering exactly that much.
    // The deck is flat; the lower boot defines it; both anchors snap to it.
    const deckY = Math.min(L.anchor.y, R.anchor.y);
    L.anchor.y = deckY;
    R.anchor.y = deckY;
    L.anchor.z += FEET_ANCHOR_SLIDE.Left;
    R.anchor.z += FEET_ANCHOR_SLIDE.Right;
    if (BODY_PIVOT_DEG) this._applyPivot(L, R, BODY_PIVOT_DEG, false);
    capture(L, 'Left');
    capture(R, 'Right');
    this._ik = { hips, hipsY0: hips.position.y, hipsX0: hips.position.x, L, R };
  }

  _ikSolveLeg(G) {
    const A = this.bodyGroup.worldToLocal(G.hipB.getWorldPosition(this._v0));
    const V = this._v1.copy(G.anchor).sub(A);
    const inPlane = V.x * G.u.x + V.z * G.u.z;
    const lateral = (V.x * -G.u.z + V.z * G.u.x); // perpendicular, horizontal
    const d = Math.min(G.L1 + G.L2 - 1e-3,
      Math.max(Math.abs(G.L1 - G.L2) + 1e-3, Math.hypot(inPlane, V.y)));
    const phi = Math.atan2(inPlane, -V.y);
    const a = Math.acos(Math.min(1, Math.max(-1, (G.L1 * G.L1 + d * d - G.L2 * G.L2) / (2 * G.L1 * d))));
    const k = Math.acos(Math.min(1, Math.max(-1, (G.L1 * G.L1 + G.L2 * G.L2 - d * d) / (2 * G.L1 * G.L2))));
    const dHip = (phi + G.sgn * a) - (G.phi0 + G.sgn * G.a0);
    const dKnee = G.k0 - k; // positive = more bend
    G.hipB.rotation.x = G.hipX0 - dHip;
    G.kneeB.rotation.x = G.kneeX0 - dKnee;
    // small out-of-plane aim, clamped -- a lean, not a yoga pose
    const aim = Math.max(-0.3, Math.min(0.3, Math.atan2(lateral, Math.max(0.05, -V.y))));
    G.hipB.rotation.z = G.hipZ0 + aim;
    // THE BOOT IS STRAPPED TO THE BOARD: whatever the leg above it did, the
    // ankle is set so the foot's world orientation stays exactly its stance
    // orientation relative to the group. Quaternion composition, no eulers,
    // no axis to get wrong.
    this.bodyGroup.updateMatrixWorld(true);
    const gq = this.group.getWorldQuaternion(this._ikQ1);
    const pw = G.ankleB.parent.getWorldQuaternion(this._ikQ2);
    G.ankleB.quaternion.copy(pw.invert().multiply(gq).multiply(G.qFootGroup0));
  }

  /** Crouch as physics: the pelvis drops, the solver bends the knees.
   *  EXPERIMENT (feet-ik branch): big body movement for the tilts -- the
   *  pelvis also TRANSLATES across the board with the edge, and the legs
   *  angulate to keep the planted feet. Dial: CARVE.sway(metres per full edge).
   */
  _ikUpdate(crouchLike, air) {
    this._ikCapture();
    const ik = this._ik;
    if (!ik) return false;
    const sway = (this._swayK ?? 0.10) * this.edge * (1 - air);
    // CENTER DROP (experiment): riding straight she sits lower -- an athletic
    // ready stance -- rising as the edge loads (the lean's own crouch takes
    // over there). Dial: CARVE.centerDrop(m).
    const centered = Math.max(0, 1 - Math.abs(this.edge)) * (1 - air);
    ik.hips.position.x = ik.hipsX0 + sway;
    const lowDrop = (this._centerDropM ?? 0.10) * centered
      + (this._settleM ?? 0.12) * (this._centerDwell ?? 0) * centered;
    // normalized "how low is she" for the posture layers (arch, balance arms)
    this._lowNow = Math.min(1, lowDrop / 0.22);
    ik.hips.position.y = ik.hipsY0 - crouchLike * 0.20 - air * 0.12 - lowDrop;
    this.bodyGroup.updateMatrixWorld(true);
    this._ikSolveLeg(ik.L);
    this._ikSolveLeg(ik.R);
    return true;
  }

  _replant(w) {
    // A trick replants against the lip measurement; everything else against the
    // bare stance, measured lazily on first use (plantFeet may run before the
    // scratch vectors exist) and refreshed whenever plantFeet invalidates it.
    if (!this._standRef && this._v0) {
      const m = this._bootMid({ x: 0, y: 0, z: 0 });
      if (m) this._standRef = m;
    }
    const trick = this.trickBlend > 0.01;
    const ref = (trick && this._bootRef) ? this._bootRef : this._standRef;
    const cur = ref ? this._bootMid(this._boot) : null;
    if (!cur) return false;
    // RIDING IS Y-ONLY. The first always-on cut countered x/z too, and the
    // alive weight shift then slid the whole rig against the legs every frame
    // -- "the character is rotating on the board, you can see her legs
    // rotating". Vertical keeps the boots ON the deck (the float, the actual
    // complaint); lateral drift of millimetres is the body moving over the
    // board, which is what a body does. Tricks keep all three axes against
    // their lip reference, as they always did.
    if (trick) {
      this.rig.position.x += w * (ref.x - cur.x);
      this.rig.position.z += w * (ref.z - cur.z);
    }
    this.rig.position.y += w * (ref.y - cur.y);
    return true;
  }

  /**
   * Pitch the board so its deck lies along the line between the two boots.
   *
   * THE BOARD FOLLOWS THE BOOTS, because it cannot be the other way round: the
   * board is bolted to the group and the boots hang off a skeleton, so any pose
   * that treats the legs differently — a method bones one leg and tucks the
   * other, which is the whole trick — leaves one boot hanging in the air over a
   * deck that stayed flat. Matching the deck to the boots costs one atan2 of
   * numbers `_replant` has already measured, and it is right for every pose
   * rather than tuned for one. A symmetric tuck gives zero and pays nothing.
   *
   * Left is the TAIL boot on this rig, so a tail-high line is a nose-down board,
   * which is negative x: about +X, a point at +z (the tail) rises when the angle
   * is negative.
   */
  _boardFollowsBoots(w) {
    const a = this._v0;   // left  = tail boot, as measured by _replant
    const b = this._v1;   // right = nose boot
    const dz = a.z - b.z;
    if (Math.abs(dz) < 1e-3) return;
    // Clamped: no boot line justifies a deck past ~20 degrees, and atan2 over a
    // 0.18 m stance will happily ask for more.
    const ang = -Math.atan2(a.y - b.y, dz) * w;
    this.board.rotation.x = Math.max(-0.35, Math.min(0.35, ang));
  }

  /**
   * Live stance editing from the console — QA only. Sets a bone's rotation as a
   * delta from its BIND pose (not from wherever it is now, which would
   * compound), updates the remembered stance so the per-frame flex builds on
   * it, and re-plants the feet. Exists because guessing an unfamiliar rig's
   * local axes from screenshots has failed here repeatedly; posing it live and
   * baking the numbers back into STANCE cannot mis-guess.
   */
  setStanceRotation(name, x = 0, y = 0, z = 0) {
    const b = this.bones?.get(name);
    if (!b || !b.userData.bind) return null;
    b.rotation.set(b.userData.bind.x + x, b.userData.bind.y + y, b.userData.bind.z + z);
    b.userData.stance = b.rotation.clone();
    this.plantFeet();
    return { [name]: [x, y, z] };
  }

  /** Every bone whose stance differs from bind, as deltas ready for STANCE. */
  dumpStance() {
    const out = {};
    if (!this.bones) return out;
    for (const [n, b] of this.bones) {
      const { bind, stance } = b.userData;
      if (!bind || !stance) continue;
      const d = [stance.x - bind.x, stance.y - bind.y, stance.z - bind.z]
        .map((v) => +v.toFixed(3));
      if (d.some((v) => Math.abs(v) > 1e-4)) out[n] = d;
    }
    return out;
  }

  /** Flex the stance with the turn: deeper edge, deeper knees, more counter. */
  _flexSkeleton() {
    if (!this.bones) return;
    const load = Math.abs(this.edge);
    const crouch = clamp(load * 0.5 + Math.max(0, this.tuck) * 0.55 + this.absorb * 0.7, 0, 1);
    this._crouchNow = crouch; // the IK reads the same number the flex styled
    const air = this.airPose;
    const sway = Math.sin(this.bob) * 0.035 * (1 - air);
    // The trick pose is a LAYER on the same flex, not a second animation system:
    // one `rotation.set` per bone, still absolute from the remembered stance, so
    // nothing can compound and fold the rider in half over a run.
    const tb = this.trickBlend;
    const tp = tb > 0.002 ? this._tp.b : null;
    // ── THE 'ALIVE' LAYER ─────────────────────────────────────────────────
    // Always on, independent of speed and load, so she is never a frozen pose
    // even cruising straight -- the whole point of this pass. Fades out in the
    // air (bracing, not breathing) and under a trick. Two cycles at different
    // rates so it never reads as a metronome: a breath and a slower weight shift.
    const alive = (1 - air) * (1 - tb);
    const breath = Math.sin(this._alive * 1.65) * alive;
    const shift = Math.sin(this._alive * 1.05 + 0.7) * alive;
    const flex = (name, dx, dy, dz) => {
      const b = this.bones.get(name);
      if (!b || !b.userData.stance) return;
      const t = tp?.[name];
      b.rotation.set(
        b.userData.stance.x + dx + (t ? t[0] * tb : 0),
        b.userData.stance.y + dy + (t ? t[1] * tb : 0),
        b.userData.stance.z + dz + (t ? t[2] * tb : 0),
      );
    };
    // The generic air pose — arms spread, elbows out — is exactly what a grab is
    // not, so it yields to the trick rather than fighting it. The knees do not:
    // a tucked jump and a tucked trick want the same legs.
    const airArm = air * (1 - tb * 0.92);
    // Knees absorb the load and come up in the air. Knee flex is NEGATIVE x on
    // this rig; the air amounts stay modest because the board cannot follow the
    // boots — the rig is lowered toward the deck instead, in _syncTransform.
    // Knees: the reactive fold is cranked up (0.40 -> 0.55) so a bump or a hard
    // carve visibly loads the legs, plus a tiny constant knee pump from the
    // weight shift so the stance breathes at rest. The two legs pump in
    // opposition (shift vs -shift) -- a weight transfer, not a squat.
    // The alive shift on the LEGS runs quiet (0.05, was 0.16): the opposition
    // pump at close camera read as the legs rotating -- the weight transfer now
    // lives mostly in the spine/arms where it reads as balance, with just a
    // breath of it in the knees.
    flex('LeftLeg',  -crouch * 0.55 - air * 0.38 + shift * 0.05, 0, 0);
    flex('RightLeg', -crouch * 0.52 - air * 0.35 - shift * 0.05, 0, 0);
    flex('LeftUpLeg',  -crouch * 0.34 - air * 0.30 - shift * 0.03, 0, 0);
    flex('RightUpLeg', -crouch * 0.32 - air * 0.28 + shift * 0.03, 0, 0);
    // The rider stands SIDEWAYS, so the anatomical axes are transposed from a
    // forward-facing rig: bowing (spine x) leans toe/heel — the EDGE axis — and
    // side-bending (spine z) points down the board — the TUCK axis. The edge
    // lean counter-rotates against the board roll so the body stays stacked.
    // ── THE BANANA (feet-ik experiment) ───────────────────────────────────
    // "Banana shape when I am tilting -- arch back, the whole body from the
    // pelvis goes in that direction." The old terms COUNTER-rotated the spine
    // against the edge to keep the torso stacked; the banana does the
    // opposite: each vertebra adds curve INTO the lean, growing up the chain,
    // over the pelvis sway that already carries the base. Spine x is the edge
    // axis on this sideways rig (the file's own note). Dial: CARVE.banana(k).
    // Both directions tried live; INTO the lean won ("it looked better in the
    // last version -- bring it back").
    const ban = (this._bananaK ?? 1) * this.edge * (1 - air);
    // LOW POSTURE: as the pelvis sinks (center drop + settle) the torso arches
    // BACK a bit and the head stays high -- proud, not slumped. Spine z is the
    // fore-aft bow on this sideways rig (the tuck's axis, opposite sign).
    const low = (this._lowNow ?? 0) * (1 - air) * (1 - tb);
    flex('Spine',  ban * 0.14 + sway + breath * 0.040, -this.edge * 0.06, this.tuck * 0.16 + shift * 0.05 - low * 0.08);
    flex('Spine1', ban * 0.20 + sway + breath * 0.055, -this.edge * 0.05, this.tuck * 0.12 + shift * 0.04 - low * 0.12);
    flex('Spine2', ban * 0.26 + breath * 0.065, 0, this.tuck * 0.08 - low * 0.16);
    // The head rides the arch at half strength so the gaze mostly survives --
    // and lifts as she sinks: head held high over the arched back.
    flex('Neck', ban * 0.12 - air * 0.10, 0, -this.tuck * 0.14 - low * 0.14);
    // Arms rise for balance as the edge loads, more on the inside of the turn,
    // and spread in the air.
    const inside = clamp(-this.edge, 0, 1);
    const outside = clamp(this.edge, 0, 1);
    // ── RESPONSIVE HANDS (feet-ik experiment) ─────────────────────────────
    // Dial: CARVE.arms(k). Two parts: the edge-driven balance gesture scaled
    // up (k), and a SNAP from edge velocity -- entering a carve throws the
    // arms before the lean settles, one rising, one dropping, decaying as the
    // edge stabilises. Reaction to change is what reads as "responsive".
    const armK = this._armsK ?? 1.5;
    const snap = Math.max(-0.3, Math.min(0.3, (this._edgeVel ?? 0) * 0.14)) * (1 - tb);
    // COUNTERBALANCE: the arms swing OPPOSITE the body's lean (inside/outside
    // swapped) -- the body banks one way, the arms reach the other, which is
    // what a balancing human actually does. And the ELBOWS ARTICULATE: the
    // forearms bend with the same gesture instead of staying locked.
    // BALANCE ARMS while low: raised and actively working -- two incommensurate
    // wobble rates per arm so it reads as balancing, not metronoming.
    // Dial: CARVE.balanceArms(k).
    const balK = (this._balanceArmsK ?? 1) * low;
    const wobL = Math.sin(this._alive * 1.35) * 0.12 + Math.sin(this._alive * 0.83 + 1.2) * 0.07;
    const wobR = Math.sin(this._alive * 1.21 + 2.1) * 0.12 + Math.sin(this._alive * 0.91) * 0.07;
    flex('LeftArm',  -outside * 0.48 * armK - airArm * 0.30 + breath * 0.10 + snap * 0.5
      - balK * (0.38 + wobL), 0,
      outside * 0.30 * armK + sway * 2 + shift * 0.12 + snap * 0.35 + balK * (0.15 + wobL * 0.6));
    flex('LeftForeArm', outside * 0.25 * armK, 0,
      outside * 0.50 * armK + airArm * 0.45 + breath * 0.14 + snap * 0.25);
    flex('RightArm', -inside * 0.44 * armK - airArm * 0.28 + breath * 0.10 - snap * 0.5
      - balK * (0.38 + wobR), 0,
      -inside * 0.28 * armK - sway * 2 - shift * 0.12 + snap * 0.35 - balK * (0.15 + wobR * 0.6));
    flex('RightForeArm', inside * 0.25 * armK, 0,
      -inside * 0.50 * armK - airArm * 0.42 - breath * 0.14 + snap * 0.25);
  }

  reset(p = 0) {
    this.z = -p;
    this.x = this.terrain.centerX(this.z);
    this.y = this.terrain.height(this.x, this.z);
    this.yaw = 0;
    this.vh = 12;
    this.vy = 0;
    this.edge = 0;
    this.tuck = 0;
    this.airborne = false;
    this.airTime = 0;
    this.lastAirTime = 0;
    this.crashTimer = 0;
    this.invuln = 0;
    this.slip = 0;
    /** Seconds of boost left, and the speed floor it holds. See `_step`. */
    this.boostT = 0;
    this.boostFloor = 0;

    // Carve accounting: a turn only counts once it is finished, so the reward
    // lands on the release, which is where the payoff actually feels like it is.
    this.carveSign = 0;
    this.carveHold = 0;
    this.carveQuality = 0;
    this.justCarved = null;
    this.justLanded = null;

    // Tricks. `trick` is the one in flight, `justTrick` is the report the frame
    // it comes down; everything else is the visual state the pose drives.
    this.trick = null;
    this.justTrick = null;
    this.trickForce = null;   // QA: name from TRICKS to override the choice
    this.trickBlend = 0;      // how much of the trick pose is applied, 0..1
    this.trickSpin = 0;       // radians about the board's own vertical, visual only
    this.trickRoll = 0;       // radians about the board's long axis, visual only
    this.trickBoardYaw = 0;   // the board alone, for a shifty
    this.trickTuck = 0;
    this.stumble = 0;         // a bailed trick's scrappy landing, seconds' worth
    this.trickCount = 0;
    // Seeded, so a QA run that seeks to the same kicker twice gets the same
    // trick twice — a look that cannot be reproduced cannot be judged.
    this._trickRand = mulberry32(0x7c1c ^ (Math.round(p) * 2654435761));
    zeroTrickPose(this._tp);

    // Animation state. All of it is derived from the physics rather than played
    // back: a rider absorbs what the mountain does to them, and a clip cannot
    // know what the mountain just did.
    this.absorb = 0;      // knee compression from impacts and terrain
    this.airPose = 0;     // 0 on snow, 1 fully tucked in the air
    this.bob = 0;         // slow idle sway so a straight run is never static
    this._alive = 0;      // steady breathing/weight phase, speed-independent

    this._syncTransform();
  }

  // ── Tricks ────────────────────────────────────────────────────────────────

  /**
   * How long this flight lasts, in seconds.
   *
   * Marched against `terrain.height` — the ONE definition of the snow, the same
   * function the landing itself will be resolved against — so the answer is not
   * an estimate of the surface, it is the surface. What it cannot know is what
   * the rider does with the air steering in the meantime: at full edge that is
   * about a sixth of a radian a second of yaw, a couple of metres of lateral
   * drift over a long jump, and a few hundredths of a second of flight either
   * way. The spotting window absorbs that, and the re-check in `_updateTrick`
   * catches anything larger.
   */
  _predictAir(maxT = 4.0, h = 0.05) {
    const hx = -Math.sin(this.yaw);
    const hz = -Math.cos(this.yaw);
    let x = this.x;
    let z = this.z;
    let y = this.y;
    let vy = this.vy;
    let vh = this.vh;
    let prev = y - this.terrain.height(x, z);
    if (prev <= 0) return 0;
    for (let t = 0; t < maxT; t += h) {
      vh -= TUNE.drag * 0.5 * vh * vh * h;
      vy -= TUNE.gravity * h;
      y += vy * h;
      x += hx * vh * h;
      z += hz * vh * h;
      const d = y - this.terrain.height(x, z);
      if (d <= 0) {
        // Interpolate the crossing rather than returning it quantised to the
        // march: a step of 0.05 s is a twentieth of a second of slop in a
        // budget that is only a second and a half long.
        return t + h * clamp(prev / Math.max(prev - d, 1e-6), 0, 1);
      }
      prev = d;
    }
    return maxT;
  }

  /** The board has just left the snow: decide, once, what happens in the air. */
  _takeOff() {
    if (this.trick || this.crashTimer > 0) return;
    // Straight to the march, with no "was that a real pop?" test in front of it.
    // The obvious one — is the board rising faster than the snow it just left —
    // is WRONG at the only place that matters: the last metre of a kicker is
    // still climbing, so at the lip the snow is rising faster than the rider and
    // every genuine jump in the game measured as a non-event. What makes a
    // kicker a kicker is the ground BEHIND the lip falling away, which is a
    // question about the terrain ahead and not about the instant of the launch.
    //
    // It is affordable because the march is self-limiting: it stops the moment
    // the path meets the snow, so the rollers that trigger a takeoff many times
    // a minute cost five or six terrain samples each and only a flight that is
    // actually seconds long ever runs to sixty.
    const air = this._predictAir();
    if (air < TUNE.trickMinAir) return;

    // Everything the trick has to fit in, with the last quarter second kept back
    // for the rider to spot the landing and for the pose to unwind.
    const budget = air - TUNE.trickSpot;
    const afford = TRICKS.filter((d) => d.air <= budget);
    if (!afford.length) return;
    let def;
    if (this.trickForce) {
      def = TRICKS.find((d) => d.name === this.trickForce) ?? null;
      if (!def) return;
    } else {
      // The biggest thing the air affords, then a die roll only between tricks
      // that are genuinely of that size. Bigger air is a better trick, always;
      // the randomness is there so two identical jumps are not two identical
      // shots, not to decide how much the jump was worth.
      //
      // The 0.35 s window is what stops a tier being a single trick. The ladder
      // is spaced against what the shipped kickers MEASURE: 1.7 s of air at
      // 16 m/s, 2.4 at 22, 3.1 at 28, 3.9 at 34 — so a slow hit is a tweak, a
      // normal hit is a 360, and only a fast hit on the biggest ramp is a 720.
      // Read off the maximum rather than off the end of the array: the table is
      // kept in order for reading, but a trick appended in the wrong place must
      // not quietly become the only thing the game ever picks.
      let top = 0;
      for (const d of afford) if (d.air > top) top = d.air;
      const pool = afford.filter((d) => d.air >= top - 0.35);
      def = pool[Math.floor(this._trickRand() * pool.length) % pool.length];
    }
    this.trickCount++;
    // Where the boots are at the lip: the trick's pose is planted against this
    // and nothing else, so the rider cannot grow or shrink as it comes on.
    this._bootRef = this._bootMid({ x: 0, y: 0, z: 0 }) ?? null;
    this.trick = {
      def,
      t: 0,
      dur: Math.max(0.30, Math.min(def.dur, budget * TUNE.trickPace)),
      phase: 0,
      check: 0.10,
      done: false,
      air,
    };
  }

  /**
   * Advance the trick. Once per FRAME, not per sub-step: it is animation, and
   * animating it four times inside one frame would only cost time.
   */
  _updateTrick(dt) {
    const tk = this.trick;
    const flying = !!tk && !tk.done && this.airborne;
    // Blend in fast, out faster: a bailed grab must not stay welded to the board
    // through the landing.
    const rate = flying ? 16 : 9;
    this.trickBlend += ((flying ? 1 : 0) - this.trickBlend) * (1 - Math.exp(-rate * dt));
    this.stumble = Math.max(0, this.stumble - dt * 2.4);

    if (!tk) {
      if (this.trickBlend < 0.002) zeroTrickPose(this._tp);
      this.trickRoll = this._tp.roll * this.trickBlend;
      this.trickBoardYaw = this._tp.boardYaw * this.trickBlend;
      this.trickTuck = this._tp.tuck * this.trickBlend;
      return;
    }

    const target = tk.def.spins * Math.PI * 2;
    if (!tk.done) {
      tk.t += dt;
      // HURRY, NEVER DAWDLE. The flight is re-marched a few times a second and
      // the trick's remaining time can only ever be CUT — if the snow comes up
      // sooner than the lip predicted, the spin finishes faster; if the jump
      // turns out longer, the trick lands early and the rider holds the pose,
      // which is what spotting a landing looks like anyway. A rate that could
      // also slow down would let a trick that is already behind fall further
      // behind, and it is the unfinished rotation that reads as a crash.
      tk.check -= dt;
      if (tk.check <= 0 && tk.phase < 1) {
        tk.check = 0.10;
        const need = tk.dur - tk.t;
        // March only as far as the answer could matter. A fixed horizon shorter
        // than the trick reports its own cap as "not enough time left" and
        // hurries a 720 that had seconds to spare.
        const left = this._predictAir(need + TUNE.trickSpot + 0.4, 0.06) - TUNE.trickSpot;
        const have = Math.max(0.08, left);
        if (have < need) tk.dur = tk.t + have;
      }
      tk.phase = clamp(tk.t / tk.dur, 0, 1);
      this.trickSpin = target * spinEase(tk.phase);
    } else {
      // Landed or aborted: carry whatever is left of the rotation FORWARD to the
      // whole turn rather than rewinding it. A board that keeps swinging round
      // after a scrappy touchdown is what actually happens; a board that runs
      // backwards to where it started is a video being scrubbed.
      this.trickSpin += (target - this.trickSpin) * (1 - Math.exp(-9 * dt));
    }

    const o = this._tp;
    zeroTrickPose(o);
    tk.def.pose(tk.phase, o);
    this.trickRoll = o.roll * this.trickBlend;
    this.trickBoardYaw = o.boardYaw * this.trickBlend;
    this.trickTuck = o.tuck * this.trickBlend;

    if (tk.done && this.trickBlend < 0.02 && Math.abs(this.trickSpin - target) < 0.02) {
      // A whole number of turns is the identity, so dropping back to zero here
      // is invisible — and it means the next trick starts from a clean angle
      // rather than from wherever the last one finished.
      this.trickSpin = 0;
      this.trick = null;
    }
  }

  /**
   * Close out the trick at touchdown and say whether it was landed.
   *
   * @returns {object|null} the report, also left on `justTrick` for one frame
   */
  _closeTrick(landedOnSnow) {
    const tk = this.trick;
    if (!tk || tk.done) return null;
    tk.done = true;
    // SQUARELY, or not at all. A rotation still coming round when the board
    // touches reads as a crash whatever the scoreboard says, so the threshold is
    // on the rotation being finished rather than on it being nearly finished.
    const landed = landedOnSnow && tk.phase >= 0.94;
    if (!landed) this.stumble = 1;
    this.justTrick = {
      name: tk.def.name,
      value: tk.def.value,
      landed,
      phase: +tk.phase.toFixed(2),
      spins: tk.def.spins,
      spinDeg: Math.round(tk.def.spins * 360 * spinEase(tk.phase)),
      airTime: +this.airTime.toFixed(2),
      predicted: +tk.air.toFixed(2),
    };
    return this.justTrick;
  }

  get p() { return -this.z; }
  get u() { return this.x - this.terrain.centerX(this.z); }
  /** Speed along the actual 3D travel direction, m/s. */
  get speed() {
    return this.airborne ? Math.hypot(this.vh, this.vy) : this.vh * this._sec();
  }

  _sec() {
    this.terrain.gradient(this.x, this.z, this._grad);
    const hx = -Math.sin(this.yaw);
    const hz = -Math.cos(this.yaw);
    const m = this._grad.gx * hx + this._grad.gz * hz;
    return Math.sqrt(1 + m * m);
  }

  /**
   * @param {number} dt seconds
   * @param {{x:number,y:number}} lean unit-disc lean from the sensor
   */
  update(dt, lean) {
    this.justCarved = null;
    this.justLanded = null;
    this.justTrick = null;
    // Sub-step so a slow frame cannot make the integration lie. Everything here
    // is a genuine ODE, unlike an exponential follow, so step size matters. The
    // cap has to cover the caller's whole stall guard (0.25 s) or a long frame
    // would silently integrate at a step size the model is not stable at.
    const steps = Math.min(14, Math.ceil(dt / 0.02));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this._step(h, lean);

    this.invuln = Math.max(0, this.invuln - dt);
    this.crashTimer = Math.max(0, this.crashTimer - dt);

    // Absorption: the rate of change of vertical speed IS the load through the
    // legs, so the knees fold on compressions and extend over the crests without
    // anything having to detect a bump.
    const dvy = (this.vy - (this._lastVy ?? this.vy)) / Math.max(dt, 1e-4);
    this._lastVy = this.vy;
    const load = clamp(dvy / 45, -1, 1);
    this.absorb += (Math.max(0, load) - this.absorb) * (1 - Math.exp(-9 * dt));
    this.airPose += ((this.airborne ? 1 : 0) - this.airPose) * (1 - Math.exp(-5.5 * dt));
    this.bob += dt * (1.4 + this.vh * 0.045);
    // A SLOW, SPEED-INDEPENDENT phase for the always-on 'alive' layer -- breath
    // and a weight micro-shift that run even when cruising dead straight, which
    // is where the old pose read as frozen. Separate from `bob` (which scales
    // with speed and drives the carve sway) so breathing stays calm at 90 km/h.
    this._alive = (this._alive ?? 0) + dt;
    // Edge VELOCITY, smoothed -- the hands react to the carve STARTING, not
    // just to the lean being there (the responsiveness experiment).
    // GUARDED AGAINST NaN: one non-finite frame (boot, reset) latched the
    // smoother at NaN forever, NaN-posed the arms, and rendered them invisible
    // -- "arms are not visible now". A smoother must self-heal.
    let er = (this.edge - (this._prevEdge ?? this.edge)) / Math.max(dt, 1e-3);
    if (!Number.isFinite(er)) er = 0;
    if (!Number.isFinite(this._edgeVel)) this._edgeVel = 0;
    this._edgeVel = (this._edgeVel ?? 0) + (er - this._edgeVel) * (1 - Math.exp(-8 * dt));
    this._prevEdge = Number.isFinite(this.edge) ? this.edge : 0;
    // CENTER DWELL (experiment): time spent riding centered accumulates toward
    // a deeper settle -- "the more time I spend in center, the lower I get".
    // Builds over ~8 s of centered riding, unwinds quickly on a real edge.
    const centeredNow = Math.abs(this.edge) < 0.25 && !this.airborne;
    this._centerDwell = Math.max(0, Math.min(1,
      (this._centerDwell ?? 0) + (centeredNow ? dt / (this._settleT ?? 8) : -dt * 1.5)));
    this._updateTrick(dt);

    this._syncTransform();
  }

  _step(dt, lean) {
    const T = TUNE;
    const crashed = this.crashTimer > 0;

    // ── control ───────────────────────────────────────────────────────────
    const lx = clamp(lean.x, -1, 1);
    const wantEdge = crashed ? 0 : Math.sign(lx) * Math.pow(Math.abs(lx), T.edgeExp);
    const wantTuck = crashed ? 0 : clamp(lean.y, -1, 1);
    this.edge += (wantEdge - this.edge) * (1 - Math.exp(-T.edgeRate * dt));
    this.tuck += (wantTuck - this.tuck) * (1 - Math.exp(-T.tuckRate * dt));

    const g = this.terrain.gradient(this.x, this.z, this._grad);
    const hx = -Math.sin(this.yaw);
    const hz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);

    // Slope along the direction of travel, and across it.
    const mAlong = g.gx * hx + g.gz * hz;
    const mLat = g.gx * rx + g.gz * rz;
    const sec = Math.sqrt(1 + mAlong * mAlong);

    // ── heading ───────────────────────────────────────────────────────────
    const authority = this.airborne ? T.airTurn : 1;
    const tuckGain = 1 + T.tuckTurnGain * this.tuck;
    // Turning right (edge > 0) means yaw decreasing: heading is
    // (-sin yaw, -cos yaw), so +X is reached by driving yaw negative.
    let omega = -this.edge * (T.turnBase + this.vh * T.turnV) * tuckGain * authority;
    if (!this.airborne) {
      // The bowl leans on you. Gravity's in-surface component perpendicular to
      // travel bends the heading downhill, which is what turns the banked walls
      // into something you ride rather than something you hit.
      //
      // SIGN, derived once and for all: heading h = (-sin yaw, -cos yaw), so
      // dh/dyaw = -right, and a lateral acceleration a·right rotates the
      // heading at dyaw/dt = -a/v. Gravity along the right axis is -g·mLat, so
      // the yaw rate is +g·mLat/v. This term shipped with the sign flipped —
      // the "restoring" bowl actually herded every rider INTO the walls, and
      // once they were on the wall at low speed it out-muscled a full edge and
      // pinned the yaw clamp pointing off-piste. The autopilot never noticed:
      // its feed-forward used the same wrong sign, so it cancelled exactly.
      const bankRate = T.gravity * mLat / Math.sqrt(1 + mLat * mLat);
      omega += (bankRate / Math.max(this.vh, 6)) * T.bankPull;
    }
    // Soft wall at MAX_YAW: authority fades over the last quarter radian rather
    // than stopping dead, so it reads as the board refusing to come further round
    // rather than as the controls being taken away.
    const slack = 0.28;
    const over = (Math.abs(this.yaw) - (MAX_YAW - slack)) / slack;
    if (over > 0 && Math.sign(omega) === Math.sign(this.yaw)) {
      omega *= Math.max(0, 1 - over);
    }
    this.yaw = clamp(this.yaw + omega * dt, -MAX_YAW, MAX_YAW);

    // ── speed ─────────────────────────────────────────────────────────────
    if (this.airborne) {
      this.vh -= T.drag * 0.5 * this.vh * this.vh * dt;
      this.airTime += dt;
    } else {
      let v3 = this.vh * sec;
      const dragK = T.drag * (1 - T.tuckDrag * Math.max(0, this.tuck));
      let a = -T.gravity * mAlong / sec;             // negative slope => accelerate
      a -= dragK * v3 * v3;
      a -= T.baseFric * v3;
      a -= T.edgeFric * Math.abs(this.edge) * v3;
      a -= T.brake * Math.max(0, -this.tuck) * v3;
      if (crashed) a -= T.crashDrag;
      v3 += a * dt;
      // ── A BOOST IS A SPEED FLOOR, HELD, THEN LET GO ────────────────────
      // It was an acceleration added beside gravity's, which is the tidier idea
      // and the weaker one: it reads as the hill getting slightly steeper, and
      // what a boost gate should read as is being fired down the mountain.
      //
      // A FLOOR, EASED UP TO — HillBomb's model and their measurement with it:
      // "Math.max() put the whole gain in on the frame you touched the gate,
      // which reads as a teleport — 'I immediately get super fast'. Approaching
      // it exponentially puts most of the gain in the first half second and lets
      // you SEE the acceleration."
      //
      // ONLY EVER UPWARD, so a boost never slows a rider who is already faster
      // than the floor — a gate taken at the bottom of a steep pitch must not be
      // a brake.
      //
      // THE COOL-DOWN IS DRAG DOING ITS JOB, not a second mechanism. When
      // `boostT` runs out the floor simply stops being applied and the ordinary
      // speed law takes the rider back down, which is slower than it went up and
      // is exactly the shape a boost should have.
      if (this.boostT > 0) {
        this.boostT = Math.max(0, this.boostT - dt);
        if (v3 < this.boostFloor) {
          v3 += (this.boostFloor - v3) * Math.min(1, dt * BOOST_RAMP);
        }
      }
      // A soft floor rather than a hard one: a rider who has traversed to a stop
      // skates back onto the fall line instead of the run simply ending.
      if (v3 < T.minSpeed && !crashed) v3 += (T.minSpeed - v3) * 1.6 * dt;
      this.vh = clamp(v3, 0.5, T.maxSpeed) / sec;
    }

    // ── position ──────────────────────────────────────────────────────────
    this.x += hx * this.vh * dt;
    this.z += hz * this.vh * dt;

    // The hard course boundary. EDGE_MAX is where the rideable world ends; the
    // clamp is the guarantee, and the yaw decay is what makes it read as the
    // valley side turning the board downhill instead of an invisible wall the
    // rider grinds along forever. Speed scrubs only while still pointed out.
    const cxB = this.terrain.centerX(this.z);
    const uB = this.x - cxB;
    if (Math.abs(uB) > EDGE_MAX) {
      const sB = Math.sign(uB);
      this.x = cxB + sB * EDGE_MAX;
      if (hx * sB > 0) {
        this.yaw *= Math.max(0, 1 - 4.5 * dt);
        this.vh *= Math.max(0, 1 - Math.abs(hx) * 1.1 * dt);
      }
    }

    // Everything is ballistic, then clamped to the snow. A roller that falls away
    // faster than gravity launches you for free, with no jump detection anywhere.
    this.vy -= T.gravity * dt;
    this.y += this.vy * dt;

    const ground = this.terrain.height(this.x, this.z);
    // HYSTERESIS. Already flying: land on contact. On the snow: stay on it until
    // genuinely clear. See AIR_CLEARANCE.
    if (this.y <= ground + (this.airborne ? 0 : AIR_CLEARANCE)) {
      const wasAir = this.airborne && this.airTime > 0.22;
      const g2 = this.terrain.gradient(this.x, this.z, this._grad);
      const mNew = g2.gx * hx + g2.gz * hz;
      // The trick is closed out BEFORE the landing is judged, because whether
      // the rotation finished is part of whether the landing was clean. A trick
      // still coming round is a bad landing by definition, and it goes through
      // the same path a bad landing always did rather than a parallel one.
      const trick = this._closeTrick(wasAir);
      if (wasAir) {
        // Impact is how much faster you were falling than the surface drops.
        const impact = Math.max(0, -this.vy - (-mNew * this.vh));
        const loss = clamp(impact / 46, 0, 0.42);
        const sideways = Math.abs(this.edge) * clamp(impact / 26, 0, 1);
        this.vh *= 1 - loss;
        this.justLanded = {
          airTime: this.airTime,
          impact,
          clean: sideways < 0.55 && impact < 26 && (!trick || trick.landed),
          trick,
        };
        this.lastAirTime = this.airTime;
      }
      this.y = ground;
      this.vy = mNew * this.vh;
      this.airborne = false;
      this.airTime = 0;
    } else {
      if (!this.airborne) this._takeOff();
      this.airborne = true;
    }

    // ── carve accounting ──────────────────────────────────────────────────
    const engaged = !this.airborne && !crashed && Math.abs(this.edge) > 0.30;
    const sign = Math.sign(this.edge);
    if (engaged && (this.carveSign === 0 || sign === this.carveSign)) {
      this.carveSign = sign;
      this.carveHold += dt;
      this.carveQuality += Math.abs(this.edge) * this.vh * dt;
    } else if (this.carveSign !== 0 && (!engaged || sign !== this.carveSign)) {
      if (this.carveHold > 0.55) {
        this.justCarved = { hold: this.carveHold, quality: this.carveQuality, dir: this.carveSign };
      }
      this.carveSign = engaged ? sign : 0;
      this.carveHold = engaged ? dt : 0;
      this.carveQuality = engaged ? Math.abs(this.edge) * this.vh * dt : 0;
    }

    // Visual scrub: the board yaws out of its line under a hard, fast edge.
    //
    // THE DIRECTION TERM MUST VANISH WITH THE EDGE, and `Math.sign` does not —
    // it SNAPS, +1 to -1, across a zero crossing the rider passes through on
    // every single turn transition. The first term below survived that because
    // `load` carries `|edge|`, so it fades to nothing before the sign can flip.
    // The back-lean term did not: it is `max(0, -tuck)` times the sign alone, so
    // at full back-lean it held its whole 0.22 rad right up to the crossing and
    // then inverted.
    //
    // Reported from play as the rider "flickering left and right", and measured:
    // scrubbing with the edge hovering near neutral swung the board through 23°
    // of yaw and reversed 2.2 times a second. The same dither WITHOUT back-lean
    // moved 9.8° and reversed 0.4 times a second, which is what isolated the
    // term — a scrub is a consequence of a loaded edge, and with no edge there
    // is no direction to scrub in.
    //
    // `clamp(edge * 4, -1, 1)` is that sign made continuous: still full strength
    // by a quarter edge, so nothing about a real scrub is softened, and zero at
    // zero so there is no discontinuity left to cross.
    const load = Math.abs(this.edge) * this.vh * 0.016;
    const dir = clamp(this.edge * 4, -1, 1);
    const wantSlip = clamp(load - 0.55, 0, 1) * dir * 0.30
      + Math.max(0, -this.tuck) * dir * 0.22;
    this.slip += (wantSlip - this.slip) * (1 - Math.exp(-6 * dt));
  }

  /**
   * Run a boost for `seconds`, worth `accel` m/s^2 of extra downhill.
   *
   * Taking a second gate while one is running REPLACES it rather than stacking:
   * the ceiling would swallow a stack anyway, and a rider who strings three
   * gates together should be fast for longer, not briefly faster.
   */
  boost(seconds, addSpeed, ceiling = TUNE.maxSpeed) {
    this.boostT = Math.max(this.boostT, seconds);
    // Relative to the speed you ARRIVE at, capped at the ceiling `maxSpeed`
    // already provides. Taking a second gate while one runs raises the floor
    // rather than stacking a second one: a rider who strings gates together
    // should stay fast for longer, and the cap stops it running away — which is
    // the failure HillBomb's `ceiling` field exists to stop, after a bot that
    // held forward covered 8.4 km in ninety seconds.
    // A CEILING BELOW `maxSpeed`, because the floor is set from the CURRENT
    // speed and would otherwise compound: gate, faster, gate, faster still. In
    // practice gates are 8.7 to 13.1 s apart and a boost lasts 3, so they
    // cannot chain — but HillBomb paid for this one and said so: without a
    // ceiling "a bot that simply held forward covered 8.4 km in ninety seconds
    // and beat the field by nearly five kilometres". A guard that costs one
    // `Math.min` is worth keeping for the day the spacing changes.
    this.boostFloor = Math.min(ceiling, this.vh * this._sec() + addSpeed);
  }

  /** Force a crash: the rider washes out, loses the edge and sheds speed. */
  crash() {
    // Hitting a tree mid-trick ends the trick, and it ends it as a bail. The
    // report is left on `justTrick` for whoever is listening this frame; the
    // wipeout has already taken the combo, so nothing else needs to happen.
    this._closeTrick(false);
    this.crashTimer = TUNE.crashTime;
    // A crash ends a boost. Being launched out of a tree is not a reward.
    this.boostT = 0;
    this.invuln = 1.6;
    this.vh *= TUNE.crashKeep;
    this.edge = 0;
    this.carveSign = 0;
    this.carveHold = 0;
    this.carveQuality = 0;
  }

  _syncTransform() {
    const g = this.terrain.gradient(this.x, this.z, this._grad);
    const hx = -Math.sin(this.yaw);
    const hz = -Math.cos(this.yaw);
    const mAlong = this.airborne ? 0 : g.gx * hx + g.gz * hz;

    this.heading.set(hx, mAlong, hz).normalize();
    this.normal.set(-g.gx, 1, -g.gz).normalize();
    // In the air the board follows its flight, not the ground far below.
    const upRef = this.airborne ? this._up.set(0, 1, 0) : this.normal;

    this._fwd.copy(this.heading);
    this._rgt.copy(this._fwd).cross(upRef).normalize();
    this._up.copy(this._rgt).cross(this._fwd).normalize();
    this.right.copy(this._rgt);

    const roll = this.edge * TUNE.maxRoll * (this.airborne ? 0.55 : 1);
    this._m.makeBasis(this._rgt, this._up, this._fwd.clone().negate());
    this._q.setFromRotationMatrix(this._m);
    this._qr.setFromAxisAngle(this._fwd, roll);
    this._q.premultiply(this._qr);
    // Scrub shows as the board pointing off its line, about the surface normal.
    if (Math.abs(this.slip) > 1e-3) {
      this._qr.setFromAxisAngle(this._up, this.slip);
      this._q.premultiply(this._qr);
    }
    // THE SPIN GOES HERE AND ONLY HERE. Post-multiplied about the rig's own +Y,
    // so it is a rotation in the plane of the board however the board is rolled
    // — and, far more importantly, it is applied to the drawn transform after
    // the physics basis has been built from `yaw`. The simulated heading never
    // sees it, so a 360 cannot pay out in free acceleration down the fall line
    // and cannot leave the board pointing somewhere the player did not ask for.
    // The camera never sees it either: that rig is locked to the fall line, so
    // the rider spins and the world does not.
    if (this.trickSpin) {
      this._qr.setFromAxisAngle(this._spinAxis, this.trickSpin);
      this._q.multiply(this._qr);
    }

    // Lifting by the board's half-width keeps the downhill edge in the snow
    // instead of burying the board to its middle at full incline. Off the EDGE
    // roll alone: the trick roll only ever happens in the air, where there is
    // nothing to keep out of the snow, and folding it in here would make the
    // board hop as a grab came on.
    const lift = BOARD_HALF_W * Math.abs(Math.sin(roll));
    this.group.position.set(this.x, this.y + lift, this.z);
    this.group.quaternion.copy(this._q);
    this.world.set(this.x, this.y + 0.4, this.z);

    // Angulation: the upper body stays nearer vertical than the board, and
    // compresses through the turn. Both are what a carving rider actually does,
    // and together they are most of what sells the pose.
    const crouch = clamp(Math.abs(this.edge) * 0.55 + Math.max(0, this.tuck) * 0.6, 0, 1);
    this.bodyGroup.rotation.z = -this.edge * 0.34;
    // The constant forward hunch eased ("the original pose x rotation is just
    // a bit off"): head-over-hips measured 8.8 degrees forward; dropping the
    // baked -0.05 leaves ~6, an athletic lean rather than a stoop.
    this.bodyGroup.rotation.x = -0.22 * this.tuck - 0.01;
    // A shifty is the BOARD swinging under a rider whose shoulders stay pointing
    // down the hill, so it is the one thing that moves the board mesh alone. The
    // body takes a quarter of it back the other way, which is what stops the
    // whole rider looking like they are being steered.
    this.board.rotation.y = this.trickBoardYaw;
    this.bodyGroup.rotation.y = -this.trickBoardYaw * 0.26;
    // THE TWEAK TIPS THE BOARD, NOT THE RIDER. Rolling the whole group about the
    // heading — the obvious way to show the base of the board to the camera —
    // rolls the body with it, and at the thirty-five degrees a method wants that
    // is not a tweak, it is a rider going over backwards. The board's long axis
    // runs through the bindings, so tipping the mesh alone barely moves the deck
    // under the boots and reads as exactly the thing it is.
    this.board.rotation.z = this.trickRoll;
    if (this.bones) {
      this._flexSkeleton();
      // In the air the knees come up — and the body comes DOWN to meet the
      // board, because the board is bolted to the group, not to the boots.
      // Without this the boots visibly leave the deck on every jump. A trick's
      // tuck is deeper than the generic air pose and lowers it further, for the
      // same reason and by measurement of the same kind.
      if (this.rig && this._rigBaseY != null) {
        this.rig.position.set(this._rigBaseX, this._rigBaseY, this._rigBaseZ);
        if (!this._standRef) {
          // no skeleton to measure yet: the old approximation
          this.rig.position.y -= this.airPose * 0.16 + this.absorb * 0.05;
        }
        // ── BOOTS ON THE DECK, BY MEASUREMENT, EVERY FRAME ──
        // This replant used to run only during tricks, with air and absorb
        // covered by the hand-tuned offsets above and ordinary crouch covered
        // by nothing — so the edge crouch and the alive-layer weight shift
        // lifted the boots off the board ("feet are sometimes not on the
        // board"). The trick-time mechanism is simply ALWAYS ON now: measure
        // where the flex left the boots, move the rig so they are back on the
        // deck, and let the deck pitch to lie along the boot line — which
        // also means the weight shift reads as the BOARD working, not feet
        // floating. The hand-tuned terms retire; measurement covers them.
        // IK first (riding only): each ankle to its own anchor, pelvis-led.
        // The y-replant after it is a measured safety net that should read ~0.
        if (this.trickBlend <= 0.01) {
          this._ikUpdate(this._crouchNow ?? 0, this.airPose);
        }
        const w = this.trickBlend > 0.01 ? this.trickBlend : 1;
        if (this._replant(w)) {
          // Follow the boot line only in tricks, whose poses author it. Even a
          // quarter-weight follow in riding seesawed under the weight shift and
          // read as the character rotating on the board -- Elad's call: the
          // deck stays flat to the group outside tricks.
          if (this.trickBlend > 0.01) this._boardFollowsBoots(w);
          else this.board.rotation.x = 0;
        } else this.board.rotation.x = 0;
      }
    } else {
      // The primitive rider has no joints to pose, so its trick is the group
      // spin, the roll, the board's shifty and a deeper crouch. It looks less,
      // which is the correct amount of effort for a path that only runs when a
      // 226 kB download failed — but it must never be the path that throws.
      this.bodyGroup.scale.set(1, 1 - 0.16 * crouch - 0.22 * this.trickTuck, 1);
    }
    if (this.crashTimer > 0) {
      this.bodyGroup.rotation.x -= this.crashTimer * 0.9;
      this.bodyGroup.rotation.z += this.crashTimer * 0.7;
    }
    // A bailed trick lands scrappy: the body is thrown for half a second, on the
    // same channels the wipeout uses and at a fraction of its size, so it reads
    // as "that was not clean" rather than as a crash that did not happen.
    if (this.stumble > 0) {
      this.bodyGroup.rotation.x -= this.stumble * 0.42;
      this.bodyGroup.rotation.z += this.stumble * 0.30;
    }
  }
}

// ── Camera ──────────────────────────────────────────────────────────────────

/**
 * A chase camera that banks into the turn.
 *
 * The roll is not a flourish. Tipping the horizon with the rider is the only
 * feedback that arrives before the board has moved anywhere, which is exactly
 * the window the sensor's smoothing opens up. The world responding instantly
 * while the rider responds with weight is what makes half a second of input lag
 * read as mass instead of as delay.
 */
export class CameraRig {
  constructor(camera, terrain) {
    this.camera = camera;
    this.terrain = terrain;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this._wantPos = new THREE.Vector3();
    this._wantLook = new THREE.Vector3();
    this._toRider = new THREE.Vector3();
    this._toLook = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
    // Phase clock for the shake. Advances only while a shake is alive, so two
    // knocks a minute apart do not start from an arbitrary point on the curve.
    this.shakeT = 0;
    this.roll = 0;
    this.fov = TUNE.fovBase;
    this.ready = false;
  }

  kick(amount) {
    // A knock that lands on a still camera starts the curve at zero, so the
    // first frame of a shake is a departure from where the frame already was
    // rather than a jump to wherever the sines happened to be.
    if (this.shake <= 0) this.shakeT = 0;
    this.shake = Math.min(1.4, this.shake + amount);
  }

  reset() {
    this.ready = false;
    this.shake = 0;
    this.shakeT = 0;
    this.roll = 0;
  }

  update(dt, rider, speedNorm) {
    const T = TUNE;

    // THE CAMERA IS LOCKED TO THE FALL LINE, not to the board.
    //
    // Sitting behind the rider along their HEADING meant the whole world swung
    // round every time they carved: the route pointed off to one side, the
    // horizon rotated, and after a hard turn it was genuinely hard to tell which
    // way was downhill. Riding behind the mountain's own direction instead, the
    // route always runs away down the screen and the rider slides across the
    // frame as they traverse — which is also a far better readout of how far off
    // the line they actually are.
    const cxHere = this.terrain.centerX(rider.z);
    const drift = rider.x - cxHere;

    // Follow most of the drift, then HARD CLAMP how far off centre the rider is
    // allowed to sit. Following a fixed fraction alone let a deep traverse push
    // them to the edge of a portrait frame and out of it — the camera was still
    // pointing the right way and had still lost the rider.
    let camX = cxHere + drift * T.camLateral;
    camX = clamp(camX, rider.x - T.camMaxOffset, rider.x + T.camMaxOffset);
    this._wantPos.set(camX, rider.y + T.camUp + rider.airTime * 1.2, rider.z + T.camBack);
    const floor = this.terrain.height(this._wantPos.x, this._wantPos.z) + T.camClearance;
    if (this._wantPos.y < floor) this._wantPos.y = floor;

    const ahead = T.camLookAhead * (0.85 + speedNorm * 0.4);
    const lz = rider.z - ahead;
    const lx = clamp(this.terrain.centerX(lz) + drift * T.camLateral * 0.7,
      rider.x - T.camMaxOffset * 1.6, rider.x + T.camMaxOffset * 1.6);
    this._wantLook.set(lx, this.terrain.height(lx, lz) + T.camLookUp, lz);
    // Whatever the terrain does, the view axis never climbs above the camera.
    this._wantLook.y = Math.min(this._wantLook.y, this._wantPos.y + 1.5);

    // THE RIDER MAY NOT LEAVE THE FRAME. `camLookUp` aims the view well above
    // the snow so the distant range and the sky are in shot, and that is worth a
    // great deal — but its height is a constant while the mountain's pitch is
    // not, so on a steeper pitch the same number tips the rider off the bottom
    // edge. It did exactly that: a capture on a 20 degree section had nothing in
    // frame but a red dot on the last row of pixels.
    //
    // So the framing is expressed as a guarantee instead of a constant. The
    // angle between the view axis and the direction to the rider is capped at a
    // fraction of the half-fov, which holds them inside the lower third at any
    // pitch, any speed and any aspect ratio. Below the cap this does nothing at
    // all, so the vista is untouched wherever it already worked.
    this._toRider.set(rider.x, rider.y, rider.z).sub(this._wantPos);
    this._toLook.copy(this._wantLook).sub(this._wantPos);
    const lenR = this._toRider.length();
    const lenL = this._toLook.length();
    if (lenR > 1e-3 && lenL > 1e-3) {
      this._toRider.divideScalar(lenR);
      this._toLook.divideScalar(lenL);
      const halfFov = THREE.MathUtils.degToRad(this.camera.fov) * 0.5;
      const ang = Math.acos(clamp(this._toRider.dot(this._toLook), -1, 1));
      const angMax = RIDER_KEEP * halfFov;
      if (ang > angMax) {
        // Rotate the view axis back toward the rider by exactly the excess, in
        // the plane the two directions span, so no roll is introduced.
        this._toLook.lerp(this._toRider, (ang - angMax) / ang).normalize();
        this._wantLook.copy(this._toLook).multiplyScalar(lenL).add(this._wantPos);
      }
    }

    if (!this.ready) {
      this.pos.copy(this._wantPos);
      this.look.copy(this._wantLook);
      this.ready = true;
    } else {
      this.pos.lerp(this._wantPos, 1 - Math.exp(-T.camFollow * dt));
      this.look.lerp(this._wantLook, 1 - Math.exp(-T.camLookFollow * dt));
    }
    // The clamps have to bind the SMOOTHED position, not just the target. An
    // exponential follow lags its target by v/k metres at lateral speed v — on a
    // seventy-five degree traverse that is nine metres, which quietly un-does
    // any clamp applied upstream and walks the rider clean out of a portrait
    // frame while the camera is still "pointing the right way".
    this.pos.x = clamp(this.pos.x, rider.x - T.camMaxOffset, rider.x + T.camMaxOffset);
    this.look.x = clamp(this.look.x, rider.x - T.camMaxOffset * 1.6, rider.x + T.camMaxOffset * 1.6);
    // ALONG-TRACK, for the same reason and with far more at stake. The target is
    // always exactly `camBack` behind the rider, but an exponential follow sits
    // v/k metres behind a target moving at v — and here that error does not
    // average out, it is pure extra distance. At 22 m/s and k = 4.2 the rig
    // delivers about 18 m on device against the 13 it is configured for, and at
    // the twelve frames a second a software rasteriser manages, nearly 21.
    //
    // So the rider rendered at half the size the framing was tuned for, every
    // camBack value ever chosen was fighting a rig that ignored a third of it,
    // and — worst for anyone tuning the look — a headless capture was framed
    // differently from the game it was standing in for. Catching the smoothed
    // position keeps the transient spring and removes the steady-state error,
    // which makes the framing identical at any frame rate.
    this.pos.z = Math.min(this.pos.z, rider.z + T.camBack + T.camBackSlack);
    // The ground-clearance floor, for exactly the same reason. When the snow
    // leaps up under the camera — a kicker, a roller crest — the target hops
    // over it while the lagging follow sails INTO the mound, and the player
    // gets a faceful of the mountain's underside. The floor on _wantPos alone
    // cannot prevent that; this line is the actual guarantee.
    //
    // Against the surface AS DRAWN as well as as defined: on concave ground
    // the mesh's chords bulge ABOVE the analytic function — a couple of metres
    // off-piste, where the columns are twenty metres apart — so a camera
    // cleared against the maths alone can still slip under the triangles and
    // look straight through their culled back faces: patches of see-through
    // snow that come and go with the angle.
    const floorNow = Math.max(
      this.terrain.height(this.pos.x, this.pos.z),
      meshHeight(this.terrain, this.pos.x, this.pos.z),
    ) + T.camClearance;
    if (this.pos.y < floorNow) this.pos.y = floorNow;

    const wantRoll = -rider.edge * T.camRoll;
    this.roll += (wantRoll - this.roll) * (1 - Math.exp(-4.5 * dt));

    this.camera.position.copy(this.pos);
    if (this.shake > 0) this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);

    this._up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    this.camera.up.copy(this._up);
    this.camera.lookAt(this.look);

    /* ── THE SHAKE, AND WHY IT IS NOT `Math.random()` ANY MORE ──────────────
     *
     * It was two `(Math.random() - 0.5) * s` terms added to the camera's x and
     * y, drawn fresh every frame, with `s` reaching 1.5 m on a wipeout. That is
     * not a shake, it is white noise, and it was reported from hardware as the
     * rider FLICKERING in hard turns and off-piste (Gadi, 20 Aug). Measured in
     * the drive rig: with the shake alive the rider's projected screen position
     * moved sixteen times further per frame than in calm riding — mean 0.038 of
     * NDC, peaks at 0.11 — in a direction uncorrelated with the frame before.
     * Uncorrelated noise has no perceived direction, so the eye reads it as a
     * subject strobing rather than a camera being knocked, which is exactly the
     * word that came back.
     *
     * Three things were wrong and all three are fixed here.
     *
     * 1. IT WAS NOISE, NOT MOTION. The offset is now two summed sines per axis
     *    at incommensurate frequencies — about 5.9 and 3.7 Hz, the band a
     *    handheld camera actually shakes in — so consecutive frames lie on a
     *    continuous path and the shake has a direction to read.
     *
     * 2. IT WAS FRAME-RATE DEPENDENT. One random draw per frame means the
     *    shake's whole frequency content is whatever the frame rate is: twice
     *    as fast at 120 fps as at 60, and a different effect again on the
     *    software rasteriser the QA rig runs on. Sampling by `shakeT` makes it
     *    the same physical shake everywhere, which is the same argument §5.3 of
     *    BRIDGE.md makes about the input EMA.
     *
     * 3. IT TRANSLATED THE CAMERA, WHICH PIVOTED IT. The look target did not
     *    move with the position, so displacing the eye re-aimed the view — the
     *    rider swung across the frame instead of the frame sliding under them,
     *    which multiplied a 0.76 m offset into several degrees of subject
     *    travel. It is applied as a rotation AFTER `lookAt` now, which is what a
     *    knocked camera does: the whole frame moves and the subject keeps its
     *    place in it.
     *
     * Rotating instead of translating also retires a guard that used to live
     * here. The old jitter moved the eye through space, and the comment on it
     * said it fired hardest "exactly when the rider is crashing off-piste — the
     * one place the drawn mesh already ate most of the clearance", so it needed
     * a mesh-height floor to stop the shake pushing the camera under the
     * triangles and showing their culled backs. A rotation cannot move the
     * camera anywhere, so that failure is gone by construction rather than by
     * being caught. The clearance floor on `this.pos.y` above is untouched and
     * is still the one that matters.
     */
    if (this.shake > 0) {
      const amp = SHAKE_ANGLE * this.shake * this.shake;
      const t = this.shakeT;
      const nx = Math.sin(t * 37.1) * 0.62 + Math.sin(t * 23.3 + 1.7) * 0.38;
      const ny = Math.sin(t * 29.7 + 0.9) * 0.62 + Math.sin(t * 19.1 + 2.4) * 0.38;
      this.camera.rotateX(ny * amp);
      this.camera.rotateY(nx * amp);
    }

    const wantFov = T.fovBase + speedNorm * T.fovSpeedGain;
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-2.4 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

/**
 * Tell this module what the input pipeline already did to the lean, so
 * `TUNE.edgeCurve` can go on meaning the COMPOSED response the mountain was
 * tuned against.
 *
 * Called once from `main.js` with `host.tilt.gamma`. Not a constant here,
 * because a second copy of the pipeline's number is a copy that drifts, and the
 * drift would show up as "carve feels wrong now" months later with nothing in
 * the diff to point at.
 *
 * The pipeline's gamma is RADIAL and this one is per-axis on the edge, so the
 * composition is exact only on a pure edge lean. That is the axis the number
 * was measured on and the axis the whole game is about; the tuck picks up the
 * pipeline's softening unshaped, which is the change that was asked for.
 */
export function setPipelineGamma(gamma) {
  const g = Number(gamma);
  TUNE.edgeExp = Number.isFinite(g) && g > 0 ? TUNE.edgeCurve / g : TUNE.edgeCurve;
  return TUNE.edgeExp;
}
