// OVER THE SHOULDER — skirmish, seen the way a shooter sees.
//
// ── WHAT IS ACTUALLY DIFFERENT, AND WHAT IS NOT ────────────────────────────
//
// The rules are `skirmish`'s, imported rather than copied. The drone health,
// the squad density, the gate cadence and the whole health economy were each
// solved against a measurement, and a second copy of them is a second thing to
// re-derive the next time one moves.
//
// ONE LINE IS DIFFERENT: `cameraFollow: 'chase'`. The rig stops riding the
// mountain's own direction and starts riding the board's — see CAM_MODE in
// `rider.js`, where both rigs live side by side.
//
// ── THIS DELIBERATELY REVERSES A FINDING ───────────────────────────────────
//
// `rider.js` carries a note explaining why the camera is locked to the fall
// line, and it is not a default that nobody revisited — it is a conclusion:
//
//   > Sitting behind the rider along their HEADING meant the whole world swung
//   > round every time they carved: the route pointed off to one side, the
//   > horizon rotated, and after a hard turn it was genuinely hard to tell
//   > which way was downhill.
//
// Every word of that is still true of this mode, and it will be the first
// thing anyone notices. It is here anyway, for two reasons worth stating so
// that the trade is argued rather than forgotten:
//
//   THE BOARD POINTS UP THE SCREEN, which is the convention every third-person
//   shooter has trained every player on. In a mode whose subject is shooting,
//   the thing the frame should be organised around is where the weapon is
//   aimed, not where the hill goes.
//
//   AND "DOWN THE HILL" IS ABOUT TO STOP BEING THE ONLY DIRECTION. The next
//   change to this mode is a controller that can go backwards, and a camera
//   framed on the fall line has nothing to say about a player travelling
//   across or up it. Building the camera first means the movement change
//   arrives into a frame that can already show it.
//
// ── WHAT IS STILL MISSING, SO IT IS NOT MISTAKEN FOR DONE ──────────────────
//
// The mountain is ANALYTIC IN `p` and every ring in this game — the terrain
// chunks, the gates, the scatter, the pickups, the drones, the medkits, the
// islands — recycles forward on the assumption that `p` only increases. This
// mode changes none of that. It is a camera, riding the same one-way descent.

import { registerMode } from './mode.js';
import { skirmishRules } from './skirmish.js';

export default registerMode({
  id: 'shoulder',
  name: 'over the shoulder',
  tagline: 'the camera rides with you',
  routeName: 'Route',
  explainer: 'The camera sits behind your board. Point it at a drone and your stars fly!',
  order: 4,

  /**
   * THE RIG, not the numbers. `camera` below is a partial of `TUNE` and can
   * only ever retune the framing the fall-line rig already does; this picks a
   * different rig entirely.
   */
  cameraFollow: 'chase',

  /**
   * AND IT SITS MUCH CLOSER, which is not a taste call — it is what the rig
   * change forces.
   *
   * The fall-line rig is 4.0 m back and 1.9 up because it is framing a ROUTE:
   * the rider is a figure on a hill and the hill is the subject. A chase rig
   * is framing a CHARACTER, and at the same distance with the world no longer
   * sliding past sideways there is nothing in the frame doing the work the
   * mountain used to do.
   *
   * `camLookUp` means something different under this rig and that is worth
   * flagging: the fall-line path adds it to the TERRAIN height at a point
   * ahead, this one adds it to the RIDER's own height. 1.6 m is a little over
   * head height, which is where a shooter's camera looks.
   */
  camera: { camBack: 6.2, camUp: 2.5, camLookAhead: 16, camLookUp: 1.6 },

  music: ['carve_theme', 'sunrise_ascent'],

  /**
   * THE SKIRT STAYS AT THE CLOSE-CAMERA VALUE. It is tuned against how much of
   * the frame a plume fills, and this camera is closer than skirmish's, not
   * further — so if anything it wants less. Left alone until something is
   * measured rather than guessed at.
   */
  skirt: 0.22,

  showsStartLine: false,
  timeGates: false,
  pickupsPay: 'health',

  create: skirmishRules,
});
