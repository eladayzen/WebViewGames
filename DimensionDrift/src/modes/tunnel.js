// PIPE SKATE — a sewer main, a board, and nothing that shoots back.
//
// ── WHAT THIS MODE IS NOT ──────────────────────────────────────────────────
//
// It is not skirmish with the drones turned off. Every other mode in this game
// descends from the same idea -- a long run down an open mountain where the
// pressure comes from an ENEMY (a clock, a squad, a rival) -- and this one
// deliberately keeps none of that:
//
//   NO DRONES. "No enemies, just obstacles." The gun is off, the health bar is
//   off, the medkits and the boons are off. A health economy with nothing
//   attacking it is a bar that only ever sits full, and a weapon with nothing
//   to shoot is a button that does nothing.
//
//   NO CLOCK. There is no timer and nothing paying time, so the run ends when
//   the player hits something badly enough, and not before.
//
//   SO THE RUBBLE IS THE WHOLE GAME. Everything the mode has to offer is
//   "there is a thing in front of you, pick a side" repeated faster than you
//   can plan it. That is a thin brief on an open mountainside, where there is
//   always room to go around; inside a pipe it is the right one, because the
//   pipe is what takes the room away.
//
// ── AND THE CAMERA IS THE MODE ─────────────────────────────────────────────
//
// `cameraFollow: 'tunnel'`. The camera stops following the rider entirely and
// pins to the pipe's axis, rolling as the rider climbs the transition so that
// the RIDER stays upright at the bottom of the frame and the TUNNEL turns
// around them. See `_updateTunnel` in rider.js.
//
// That one choice is why this is a mode and not just a place. The drain could
// be ridden with either of the other two rigs and it would be a novelty
// mountain; with this rig it is a different game, and the rig would be wrong
// on any place that is not a tube.
//
// ── WHAT IS MISSING, SO IT IS NOT MISTAKEN FOR DONE ────────────────────────
//
//   THE ART. The obstacles are the scatter's boulders at high density. A sewer
//   wants ring seams, grates, pipe mouths and standing water; it has rocks.
//   The SHAPE is what is being tried here.
//
//   THE ROOF. The pipe is open-topped -- a very large half-pipe rather than a
//   closed tube -- because closing it means a ceiling, which means the sky,
//   the fog, the islands and the light all need an answer. The camera rig does
//   not care either way, so this can be closed later without touching it.
//
//   AND IT STILL DESCENDS. `p` only goes one way, the way it does everywhere
//   else in this game. A drain that ran level, or that you could pump speed
//   back out of, is a movement model and not a camera.

import { registerMode } from './mode.js';

export default registerMode({
  id: 'tunnel',
  name: 'pipe skate',
  tagline: 'down the storm main',
  routeName: 'Main',
  explainer: 'Ride the pipe. Lean to climb the wall, and do not hit the rubble!',
  order: 5,

  /**
   * Parked while the shoulder mode is the one being made fun. The mode stays
   * registered and reachable with ?all=1 -- nothing here is deleted, it is just
   * off the lobby so the only route a player can take is the one being worked
   * on. Same reasoning as the parked places in places.js.
   */
  hidden: true,

  /** The whole reason this is a mode. See the header, and rider.js. */
  cameraFollow: 'tunnel',

  /**
   * CLOSE AND LOW. The chase rig sits at 6.2 m back framing a character; this
   * one is framing a THROAT, and the subject of the shot is how much pipe is
   * visible ahead rather than how big the rider reads.
   *
   * `camLookAhead` is long on purpose and is the number to tune first: it is
   * how far down the tunnel the eye is thrown, and therefore how much warning
   * an obstacle gives. Too short and the mode is unfair; too long and the
   * rider shrinks to nothing at the bottom of the frame.
   */
  camera: { camBack: 7.0, camUp: 2.2, camLookAhead: 30, camLookUp: 2.0 },

  music: ['sewer_steel_a', 'foot_clan_a', 'sewer_steel_b', 'foot_clan_b'],

  /** No clock, no health, no gun. The rubble is the only pressure. */
  usesClock: false,
  timeGates: false,
  showsStartLine: false,

  /**
   * THE SKIRT STAYS WIDE. A plume thrown off the edge inside a pipe is thrown
   * at a wall a few metres away rather than into open air, so it fills more of
   * the frame than it does anywhere else -- this is the one mode where it is
   * worth looking at before trusting the number.
   */
  skirt: 0.22,

  create(game) {
    return {
      courseOffset(place) { return place.offset[0]; },

      start() {
        // EVERYTHING THAT FIGHTS, OFF. Stated positively and in one place
        // rather than relied on as a default: skirmish turns these on and a
        // mode that ran after it would inherit a hostile hill otherwise. This
        // is `mode.js`'s "put the hill back" rule applied at the near end.
        game.combat.setRules({ hostile: false, droneHp: 1, density: 1 });
        game.combat.setEnabled(false);
        game.medkits.setEnabled(false);
        game.boons.setEnabled(false);
        game.beams.setEnabled(false);
        game.hud.showHealth(false);
        game.roster.reset();

        /**
         * AND THE RUBBLE GOES ON, which is a SWITCH and not just a density.
         *
         * `obstaclesPerBand` says how many; `scatter.obstacles` says whether
         * any are planted on the ridden line at all, and it defaults to false
         * because on every other place the trees belong beside the course
         * rather than in it. Setting the count without the switch is the
         * quietest possible failure -- a mode whose entire content is the
         * obstacles, with none of them placed, and nothing anywhere saying so.
         * Measured before this line existed: 701 m ridden, 0 crashes.
         */
        game.scatter.obstacles = true;
        // A clear run-in, so the first thing the player meets is the pipe and
        // not a rock. The race's own rule, at the race's own distance.
        game.scatter.obstacleFromP = game.rider.p + 220;
        game.scatter.reset(game.rider.p);
      },

      pickMusic(ids) { return ids; },

      update() {},

      stop() {
        // PUT THE HILL BACK -- `mode.js` says this hook is not optional. A
        // mode that left the rubble on would hand the next run a mountain with
        // boulders planted down the middle of its racing line.
        game.scatter.obstacles = false;
        game.scatter.obstacleFromP = -Infinity;
        game.combat.setEnabled(true);
      },
    };
  },
});
