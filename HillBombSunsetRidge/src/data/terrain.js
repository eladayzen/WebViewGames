// TERRAIN -- the SHAPE of the ground, as a per-course choice.
//
// The third axis. A location was already a COURSE (what is on the ground) plus a
// THEME (what it looks like); this is the ground itself. Until now the trough's
// geometry lived in constants.js as fixed numbers, which quietly made "half-pipe"
// not a design decision but a property of the universe -- every mode, forever,
// on the same cross-section.
//
// WHY IT HAD TO BECOME DATA. The snowboard footage Amit sent is played on an
// OPEN FACE: a broad mountainside you carve long arcs across, where the whole
// width is ridable and the fun is in the line you choose. Our trough is the
// opposite instrument -- narrow, steep-walled, and with a fast line down the
// middle that punishes you for leaving it. You cannot get one out of the other
// by adding props. The cross-section has to change.
//
// So: same physics, same controller, same everything else. One object decides
// how wide the world is, how far up it goes, how hard it pulls you back down,
// and how much leaving the centre costs. A course names a preset and the whole
// hill changes character.
//
// THE THREE SCALES ARE MULTIPLIERS, NOT VALUES, and that is deliberate. Carve
// torque, damping and height-exchange belong to the CONTROL PRESET -- they are
// the player's choice of feel (data/controlPresets.js), and Amit picked
// "planted" by riding both. A terrain that set them outright would silently
// throw that choice away every time you changed hill. Scaling preserves it: the
// open face is proportionally lazier than the half-pipe under whichever preset
// you ride, rather than being one fixed feel wearing a different shape.

import {
  AIR_G,
  TROUGH_RADIUS, THETA_MAX, THETA_GRAVITY,
  FUNNEL_SPACING, FUNNEL_WIDTH, FUNNEL_TIGHTNESS,
  TROUGH_ROLL_AMOUNT, TROUGH_ROLL_WAVELENGTH,
} from './constants.js';

/**
 * @typedef {{
 *   id: string, name: string,
 *   radius: number, thetaMax: number, thetaGravity: number,
 *   funnelSpacing: number, funnelWidth: number, funnelTightness: number,
 *   rollAmount: number, rollWavelength: number,
 *   carveScale: number, dampScale: number, heightScale: number,
 *   catchScale: number,
 *   lipMode: 'cushion'|'wall', wallHeight: number, wallScrub: number,
 *   lipLamps: boolean,
 * }} Terrain
 */

/**
 * HOW THE EDGE OF THE WORLD BEHAVES. Two answers, and they are opposites.
 *
 * CUSHION is the half-pipe's: the wall stiffens as you approach the rim, a
 * transition steepening toward vert, so running out of road feels like the wall
 * pushing back. It is the right answer for a pipe, where the top of the wall is
 * a place you visit at the peak of an arc and immediately leave.
 *
 * WALL is the open face's, and it exists because the cushion was solving a
 * problem the face does not have. Amit, on the wide hill: "we need an ability to
 * play all around it without being slowed down... just let him reach all the way
 * to the top." On a mountainside the far edge is not a transition you pump
 * against, it is simply where the ridable world stops -- so it stops, hard and
 * visibly, and everything short of it is free.
 */
export const LIP_CUSHION = 'cushion';
export const LIP_WALL = 'wall';

/** @type {Record<string, Terrain>} */
export const TERRAIN_PRESETS = {
  /**
   * THE HALF-PIPE. The game as shipped, to the digit -- every field here reads
   * its value straight out of constants.js rather than restating it, so this
   * preset cannot drift away from the tuning the missions were measured
   * against. All three scales are 1, so the control preset passes through
   * untouched and the physics is arithmetically identical to before this file
   * existed.
   */
  halfpipe: {
    id: 'halfpipe',
    name: 'Half-pipe',
    radius: TROUGH_RADIUS,
    thetaMax: THETA_MAX,
    thetaGravity: THETA_GRAVITY,
    funnelSpacing: FUNNEL_SPACING,
    funnelWidth: FUNNEL_WIDTH,
    funnelTightness: FUNNEL_TIGHTNESS,
    rollAmount: TROUGH_ROLL_AMOUNT,
    rollWavelength: TROUGH_ROLL_WAVELENGTH,
    carveScale: 1,
    dampScale: 1,
    heightScale: 1,
    catchScale: 1,
    lipMode: LIP_CUSHION,
    wallHeight: 0,
    wallScrub: 0,
    spread: 1,
    patternSet: 'street',
    // No drops: dropDepth 0 short-circuits the whole elevation profile back to
    // GRADE * s, which is what the pipe has always been.
    // No drops: an empty cycle short-circuits the elevation profile back to
    // GRADE * s, which is what the pipe has always been.
    dropSpacing: 1, dropCycle: [], dropCycleDepth: 0,
    dropAccelGain: 0, launchG: Infinity, lipRamps: 0,
    // Never read on this terrain -- groundGap is 0 everywhere without drops, so
    // the free-fall phase cannot trigger. Present so the shape of a terrain is
    // the same object everywhere and a missing key can never read as NaN.
    fallG: 55,
    // Lamps line the pipe's lip like coping lights. They stay here and go on the
    // open face, where a real wall does the job of saying where the edge is.
    lipLamps: true,
  },

  /**
   * THE OPEN FACE. A mountainside rather than a pipe.
   *
   * Four changes, each answering something specific about why the trough feels
   * cramped:
   *
   * WIDER. Radius 26 -> 46. At the rim that is 42 units of arc out from the
   * centreline instead of 30, so the ridable band goes from ~60 units across to
   * ~85. Width alone is most of the complaint: there is currently nowhere to go.
   *
   * SHALLOWER. thetaMax 1.15 -> 0.92 (66deg -> 53deg). Counter-intuitive
   * alongside the bigger radius, but the two are doing different jobs -- the
   * radius buys width, and cutting the angle stops that width being spent on
   * near-vertical wall nobody rides. What is left is a face you can be anywhere
   * on, which is the point.
   *
   * FREE TO LEAVE THE CENTRE. heightScale 0. Not "cheaper" any more -- the
   * height/speed exchange is switched off outright on this hill, because
   * halving it did not go far enough. Amit rode the wide version and the note
   * was that the width is good but "we need an ability to play all around it
   * without being slowed down": as long as climbing costs anything, the
   * centreline is still the fast line and the extra ground is a place you visit
   * on a budget rather than a place you ride.
   *
   * This is the biggest single departure from the game's original design, and
   * it should be named as one. The pipe's central inversion is that the RESTFUL
   * posture is the fast one -- sitting high is continuously uphill, so
   * wall-surfing is genuinely slow, and pumping emerges from the same equation
   * for free. Setting the exchange to zero deletes all of that: no pump, no
   * fast line, no speed cost anywhere on the face. What replaces it as the
   * reason not to simply park at the edge is the WALL (see lipMode) -- a hard
   * boundary with a scrub, rather than a gradient that makes the whole outer
   * half of the hill mildly wrong to be on.
   *
   * One number, and the honest thing to move first if the face turns out to
   * need some terrain feel back. 0.12 would restore a hint of it.
   *
   * SLOWER. carveScale 0.62, dampScale 1.25, and gravity raised only enough to
   * keep full lean landing near the rim (equilibrium is sin(theta) =
   * carve*torque*R/gravity, and R nearly doubled). A traverse takes ~4-5s
   * instead of ~1.4s, so a turn is a committed arc you ride out rather than a
   * flick. That is what the footage looks like.
   *
   * The funnel and the roll both stay, turned down: a throat that closes to 46%
   * is a pipe idea and would undo the width every 760m, so it breathes between
   * 46 and 37 instead. Enough to see the ground move; not enough to pinch.
   */
  openFace: {
    id: 'openFace',
    name: 'Open face',
    radius: 46.0,
    thetaMax: 0.92,
    /**
     * NO PULL TO THE MIDDLE AT ALL.
     *
     * The pendulum's restoring term is (thetaGravity / R) * sin(theta) -- the
     * hill's own gravity, dragging the rider back to the floor whenever they
     * stop fighting it. On a half-pipe that is the entire instrument: the trough
     * is a curved surface, standing still means sliding to the bottom, and that
     * is what makes pumping possible and the centreline fast.
     *
     * On this hill it is the last thing still insisting the middle is home.
     * Amit: "the controller is still pulling me to the middle all of the time.
     * Can we try to not do that? ... maybe it won't be hard at all to get to the
     * sides of the arena. I would just have something that won't let me go
     * further up, like a collider, but it's not slowing me down to go to the
     * side."
     *
     * At 0 the pendulum stops being a pendulum. What is left is a damped
     * velocity controller: lean and you accelerate across the face, let go and
     * you hold the line you are on. Lateral position becomes something you SET
     * rather than something you maintain against a spring, and the edges cost
     * exactly what the middle costs, which is nothing.
     *
     * THIS IS THE LAST PIECE OF THE ORIGINAL DESIGN TO GO. heightScale 0 already
     * removed the speed cost of altitude; this removes the force. No part of the
     * geometry pushes the rider anywhere any more -- the only reasons to be
     * somewhere are what is placed there and what is in the way. That is a real
     * bet: it makes the hill a pure positioning game, and it only holds up if
     * the content is interesting enough to carry it alone.
     */
    thetaGravity: 0,
    funnelSpacing: 520,
    funnelWidth: 0.42,
    funnelTightness: 0.80,
    rollAmount: 0.13,
    rollWavelength: 260,
    carveScale: 0.62,
    dampScale: 1.25,
    heightScale: 0,
    // COLLIDERS ARE AUTHORED IN WORLD UNITS, and the collision test converts an
    // angular miss to an arc with the LOCAL radius -- so on a hill with a bigger
    // radius the same authored number covers a smaller share of the ground. A
    // crystal's 3.4-unit catch is 11.4% of the half-pipe's width and would be
    // 8.0% of this one: every pickup quietly 30% harder to take, on the hill
    // where the whole point is that you range further across it.
    //
    // 1.415 is not a taste value -- it is exactly the ratio of the two ridable
    // widths (84.6 / 59.8), which is the factor that restores parity to the
    // digit. Deliberately no more than that: colliders already run wider than
    // the meshes they belong to (Amit asked for that), and overshooting here
    // starts collecting things the player can see they missed.
    catchScale: 1.415,

    /**
     * A WALL, not a cushion. The soft push-back is gone entirely: everything
     * from the centreline to the rim is equally ridable at equal speed, and
     * then the world stops.
     *
     * It has to be RENDERED to be fair. A hard clamp you cannot see is the
     * worst of both -- you get stopped by nothing, with no warning and no way
     * to learn where the edge is. So the lip band grows a real barrier standing
     * on it (world/trough.js), and that barrier is the only thing on the hill
     * that says "not past here".
     *
     * 6 units is a bit over three rider-heights: tall enough to occlude and to
     * read as solid from a long way up the course, short enough not to wall off
     * the sky matte, which is doing most of the work of making the face feel
     * like it is somewhere.
     */
    lipMode: LIP_WALL,
    wallHeight: 6.0,

    /**
     * The cost of leaning on the barrier, in u/s^2 of drag while pinned. ZERO
     * here, deliberately -- it used to be 5.
     *
     * Amit asked for a collider that stops you going further and costs nothing
     * to reach: "it's not slowing me down to go to the side." A scrub is
     * precisely a charge for being at the side, so it goes.
     *
     * WHAT THIS GIVES UP, stated plainly because it was load-bearing: with no
     * restoring force AND no scrub, holding one rim for a whole descent takes no
     * effort and costs no speed. The only thing left making it a bad idea is
     * that the content is not there -- the face patterns run their reward chains
     * rim to rim and alternate which side they favour, so a parked rider misses
     * most of the hill. That is a softer answer than a speed penalty and it
     * depends entirely on the layout continuing to be worth crossing for. If
     * parking turns out to be a viable way to play, this is the number to bring
     * back first.
     */
    wallScrub: 0,

    // The wall replaces them -- two kinds of edge marker is one too many, and
    // lamps on the rim of a mountain face read as leftover street furniture.
    lipLamps: false,

    /**
     * PUSH THE CONTENT OUT TO THE EDGES.
     *
     * The patterns are authored as fractions of the half-width, and measured
     * across all seven of them, 83% of every placement sits in the INNER HALF
     * of the road and not one thing is further out than 80%. Ramps never leave
     * the middle 40%. That was survivable on the pipe, where the outer wall is
     * somewhere you pass through at the top of an arc; on a face that is 41%
     * wider and now free to ride anywhere, it means the ground we just opened
     * up is empty. Amit: "we need to spread out the different elements all
     * across the field. Right now it's pretty centered."
     *
     * A MULTIPLIER RATHER THAN A REWRITE, because the patterns are shared with
     * the half-pipe and the missions are measured against them -- re-authoring
     * the tables would silently move every star threshold in the game. At 1.75
     * the bands land at 0-35 / 35-70 / 70-100 and the outer half finally
     * carries real content, while the pipe stays at 1 and does not move.
     *
     * Clamped at the rim by the placer, so nothing lands inside the wall.
     *
     * It can only redistribute what a pattern already has; it cannot invent
     * content at the edges. If the rim still reads thin after a ride, the next
     * step is face-specific patterns rather than a bigger number here.
     */
    // AUTHORED, NOT SCALED. spread is 1 here because the face set already
    // reaches the rim on its own -- multiplying a table that goes to 0.95 would
    // only clamp its outermost content into the wall. The multiplier stays in
    // the codebase for the street set, which is still laid out for the pipe.
    spread: 1,
    patternSet: 'face',

    /**
     * THE DROPS -- a sequence, not a shape. See world/trough.js for how the
     * cycle is evaluated; this is the authoring.
     *
     * The first pass was one 12-unit roll-over every 540m. Amit rode it, liked
     * it, and asked for "more of them, smaller ones, different lines, different
     * shapes." So: five drops at 230m, repeating as a group -- one every ~8
     * seconds, and the same one only every ~40.
     *
     * DEPTH IS THE LEAST INTERESTING COLUMN. Launch curvature goes as
     * depth/length^2, so `length` is what decides whether a drop throws you:
     *
     *   depth 5.5 over 69m  -> needs 45 u/s to launch  -> you never leave it
     *   depth 3.5 over 23m  -> needs 19 u/s            -> pops you every time
     *   depth 8.0 over 37m  -> needs 20 u/s            -> the big one
     *   depth 2.5 over 18m  -> needs 17 u/s            -> a snap off a small edge
     *
     * The wide shallow ones are deliberately un-launchable. A hill where every
     * feature throws you into the air is as monotonous as one where none of
     * them do -- these are the ones you flow across and set up on, and they are
     * what make the sharp ones read as events.
     *
     * The group falls 24 units over 1150m, so the average grade is the same as
     * the single-drop version it replaces. That is the point of a fixed cycle
     * total: the sequence can be re-authored freely without the run quietly
     * getting faster or slower overall.
     */
    /**
     * WIDTH IS SET BY HOW MUCH AIR THE DROP SHOULD GIVE, and the relationship
     * is not linear -- it is cubic, which is why the first two attempts felt
     * like nothing at all.
     *
     * Relative to the line the rider leaves on, the ground falls d*(3x^2-2x^3)
     * while the rider falls 0.5*g*t^2. Solving for when the ground stops
     * outrunning them gives, with R the lip's curvature as a multiple of the
     * critical g/v^2:
     *
     *     peak lift = depth * (1 - 1/R)^3        hang = 1.5 * (1 - 1/R) * L/v
     *
     * A drop that merely CLEARS the launch threshold has R just over 1, so
     * (1-1/R)^3 is nearly zero: the previous cycle lifted the rider 0.05 units
     * -- five centimetres -- for a fifth of a second. Technically airborne and
     * completely invisible. Amit rode exactly that: it has to feel like "wow,
     * I'm in the air for a second."
     *
     * Authored at R = 3, which puts the big drop 2.4 units up for 0.55s -- a
     * real hover -- and the small ones at a pop. Everything is shorter and
     * steeper than it looks like it ought to be, because at a fixed depth the
     * only way to buy curvature is to shorten the run.
     */
    dropSpacing: 230,
    dropCycle: [
      // A long shallow roll. No launch -- terrain you read, not terrain you hit.
      { depth: 5.5, width: 0.30, profile: 'roll' },
      // Short and sharp. Small, but the lip is four times the curvature of the
      // one above it despite being a shallower drop.
      { depth: 3.5, width: 0.046, profile: 'roll' },
      // The big one. Deep AND fairly short, so it both throws you and drops the
      // ground a long way while you are up there.
      { depth: 8.0, width: 0.070, profile: 'roll' },
      // Two steps with a breather between -- two small airs in quick
      // succession rather than one big one. Authored at 0.34 first, which
      // measured out at needing 33.5 u/s to launch: against a 26.7 cruise that
      // is a shape you can never leave the ground on, making it a second flow
      // drop rather than the distinct thing it is meant to be. 0.26 puts both
      // steps under cruising speed.
      { depth: 4.5, width: 0.105, profile: 'stair' },
      // A snap. Barely a drop at all, over almost no distance.
      { depth: 2.5, width: 0.039, profile: 'roll' },
    ],
    /**
     * The cycle's total descent. Stated rather than summed at import so
     * elevAt stays O(1); the measurement harness asserts it against the table,
     * because a stale total here would tilt the entire hill.
     */
    dropCycleDepth: 24.0,

    /**
     * How many drop lips get a ramp planted on them, 0..1. Amit: "maybe
     * sometimes having a ramp just above them."
     *
     * A launcher at the edge of a drop is the two air systems stacking -- the
     * ramp throws you and then the ground is not there when you come down -- and
     * it is the biggest air in the game by a distance. SOMETIMES, though: at
     * every lip it stops being a discovery, and the drops can no longer be read
     * as terrain because there is always furniture on them.
     *
     * Placed off-centre, alternating sides, so a lip with a ramp on it still
     * has a clean roll-in beside it. That is the "different lines" half -- the
     * same drop is a jump or a flow depending on where you cross it.
     */
    lipRamps: 0.5,

    /**
     * How much the steeper ground accelerates you, as a fraction of how much
     * steeper it is. Physically this ought to be proportional -- 7.7x the slope
     * is 7.7x the pull -- and that is exactly what must NOT be built: the grade
     * accel and the drag coefficient are tuned numbers in tuned units, not a
     * real gravity, and scaling one of them by 7.7 puts terminal speed at 74
     * u/s on a hill balanced for 27.
     *
     * There is no height/speed exchange left on this terrain to damp it either
     * (heightScale is 0), so a drop that hands out speed has nothing at all
     * taking it back. That is the same shape as the boost-compounding runaway
     * that once produced 8.4km in 90 seconds. 0.10 is deliberately timid;
     * measured, not assumed.
     */
    dropAccelGain: 0.10,

    /**
     * THE LAUNCH THRESHOLD IS GRAVITY, and it is not a free parameter.
     *
     * Staying on a convex surface needs a downward acceleration of v^2 *
     * curvature. Above what gravity can supply, the rider is airborne -- so the
     * number to compare against is AIR_G and nothing else. It is the same
     * gravity the flight is then integrated under, and the two MUST agree.
     *
     * It was 14, picked by hand, against an AIR_G of 52. Every drop therefore
     * "launched" a rider whom gravity immediately pulled back down onto ground
     * it was falling toward faster than the hill was: measured, nine launches in
     * thirty seconds and not one lasting a single frame. The old scripted arc
     * concealed this entirely by lifting the rider on a shape regardless of what
     * the surface underneath was doing -- exactly the fake floor Amit could feel.
     *
     * Tying them together forced the cycle below to be re-authored so the lips
     * genuinely clear it. That is the right way round: the terrain earns its air.
     */
    launchG: AIR_G,

    /**
     * Gravity for the free fall AFTER the trick's arc is spent, in units/s^2.
     *
     * Not real gravity, and it should not be: the scripted arcs this game
     * launches -- roughly 6 units of rise in 0.4s -- imply about 75, and a fall
     * that heavy makes a 12-unit drop last a quarter of a second and read as
     * the rider being yanked down rather than falling. 55 gives roughly 0.66s
     * of hang over a full drop, which is about a backflip's worth of air and
     * long enough to see.
     */
    fallG: 55,
  },
};

export const DEFAULT_TERRAIN = 'halfpipe';

/**
 * The live terrain. Read through every frame -- by the surface mesh, the
 * pendulum, the prop placer and the collision arithmetic alike -- for the same
 * reason CONTROLS is: one object, one truth, and a change lands without a
 * reload. Nothing may cache a field off it.
 */
export const TERRAIN = { ...TERRAIN_PRESETS[DEFAULT_TERRAIN] };

/**
 * @param {string} key
 * Unknown keys fall back to the half-pipe rather than throwing: a course with a
 * typo'd terrain should give you the game you already had, not a black screen.
 */
export function setTerrain(key) {
  Object.assign(TERRAIN, TERRAIN_PRESETS[key] || TERRAIN_PRESETS[DEFAULT_TERRAIN]);
}

/** Arc distance from the centreline to the rim -- the ridable half-width. */
export function fieldHalfWidth() {
  return TERRAIN.radius * TERRAIN.thetaMax;
}
