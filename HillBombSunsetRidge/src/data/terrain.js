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
 * }} Terrain
 */

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
   * CHEAPER TO LEAVE THE CENTRE. heightScale 0.55. Height is R*(1-cos theta),
   * so a bigger radius is FLATTER near the floor -- 20 units out costs 4.4 of
   * climb here against 7.7 in the pipe -- and halving the exchange on top of
   * that makes mid-field about a third the price it was. This is the one that
   * decides whether the extra width is real. Leave the exchange alone and the
   * centreline is still the only fast line; the face just gets bigger margins.
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
    thetaGravity: 41.0,
    funnelSpacing: 520,
    funnelWidth: 0.42,
    funnelTightness: 0.80,
    rollAmount: 0.13,
    rollWavelength: 260,
    carveScale: 0.62,
    dampScale: 1.25,
    heightScale: 0.55,
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
