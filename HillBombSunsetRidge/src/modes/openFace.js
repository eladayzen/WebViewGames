// OPEN FACE -- a descent down a wide mountain face, scored on air.
//
// AN EXPERIMENT, and it should be read as one. It exists to answer a single
// question that came out of the snowboard footage Amit sent: our hill is a
// narrow steep-walled channel with one fast line down the middle, and that
// footage is a broad face you carve long arcs across because the whole width is
// worth being on. Those are different instruments. This mode changes the
// instrument (data/terrain.js) and puts the thinnest possible game on top of it,
// so that if the answer is "still cramped" almost nothing has been spent.
//
// WHY AIRTIME AND NOT POINTS. The face has no rivals and no clock to beat, so it
// needs something to make the line you pick matter. Airtime is the honest choice:
// it rewards reading the ground ahead and committing to it, it accumulates
// smoothly rather than in the discrete lumps a trick list gives you, and --
// unlike a score -- it cannot be farmed by grinding the same rail. It is also
// the one number the footage is obviously about.
//
// It is a SECOND readout, not a replacement. Points still accrue underneath, and
// the HUD still shows them: crystals and tricks work here exactly as they do
// everywhere, because the controller is one system and a mode does not get to
// re-fork it. The panel simply leads with the thing this mode is about.
//
// WHAT IT DELIBERATELY DOES NOT DO. No stars, no unlock, no progression entry.
// A prototype that writes to the save file is a prototype you cannot delete.

import { registerMode } from './mode.js';
import { OPEN_FACE_COURSE, getCourse } from '../data/courses.js';
import { RIDE_EVENTS as EV } from '../core/events.js';

/**
 * Safety cap, same reasoning as the race: on a balance board "I stepped off and
 * walked away" is a real state, and a run must not sit on the hill forever.
 * Generous -- arriving at the bottom is the normal ending.
 */
const TIMEOUT = 150;

/** Airtime, in seconds, that reads as a good descent. Used for the star cut. */
const AIRTIME_GOOD = 9.0;

export default registerMode({
  id: 'openFace',
  name: 'FREE DESCENT',
  tagline: 'The open face, no list. Scored on air.',
  /**
   * OFF THE FRONT DOOR, like freeride before it.
   *
   * This mode was the scaffolding for building the open face -- somewhere to
   * ride the terrain while the drops, the wall and the controller were being
   * worked out. The face's mission ladder is the real thing now, and having
   * both in the lobby put two buttons there that are both "the open face" with
   * nothing on them to say which one has the missions. Amit, looking at it: "I
   * click free descent and I don't see another lobby for missions."
   *
   * Two names for one hill is a worse problem than one fewer option, so it
   * stays REGISTERED and reachable at ?gamemode=openFace -- it is still the
   * cleanest harness for working on the terrain itself, with no objectives in
   * the way -- and comes off the lobby.
   */
  hidden: true,
  course: OPEN_FACE_COURSE,

  create(ctx) {
    const course = getCourse(OPEN_FACE_COURSE);
    let left = TIMEOUT;
    let startS = 0;
    let finishS = 0;
    let finished = false;

    /** Seconds off the ground this run, accumulated in update(). */
    let airtime = 0;
    /** Longest single flight, which is what a player actually remembers. */
    let bestAir = 0;
    let currentAir = 0;
    let jumps = 0;

    const offs = [];

    function end(reason) {
      finished = true;
      ctx.finishLine.hide();
      const home = reason === 'finish';
      // Three stars is arriving with a good airtime; two is just arriving. The
      // cut is a round number picked to be beaten, not a measured benchmark --
      // this mode is not in the progression, so nothing downstream depends on
      // it being calibrated.
      const stars = !home ? 0 : airtime >= AIRTIME_GOOD ? 3 : airtime >= AIRTIME_GOOD * 0.5 ? 2 : 1;
      ctx.endRun(home ? 'complete' : 'timeup', {
        tone: home ? 'success' : 'fail',
        title: home ? 'BOTTOM OF THE FACE' : 'TIME UP',
        subtitle: 'OPEN FACE',
        detail: home
          ? `${(course.length / 1000).toFixed(1)} km  ·  ${airtime.toFixed(1)}s in the air`
          : `${Math.round(finishS - ctx.getState().s)} m short of the bottom`,
        stars,
        rows: [
          { label: 'AIRTIME', text: `${airtime.toFixed(1)}s`, done: airtime >= AIRTIME_GOOD },
          { label: 'BEST AIR', text: `${bestAir.toFixed(1)}s`, done: bestAir >= 1.2 },
          { label: 'JUMPS', text: `${jumps}`, done: jumps > 0 },
        ],
      });
    }

    return {
      start() {
        startS = ctx.getState().s;
        finishS = startS + course.length;
        ctx.finishLine.place(finishS);
        ctx.props.setEndS(finishS);
        ctx.hud.banner('DROP IN');
        // Counted off the event rather than off the airborne flag: a flight that
        // starts and ends inside one frame should not count as a jump, and the
        // flag alone cannot tell the difference.
        offs.push(ctx.events.on(EV.LAUNCH, () => { jumps += 1; }));
      },

      stop() {
        offs.forEach((off) => off());
        offs.length = 0;
        ctx.finishLine.hide();
        finished = true;
      },

      update(dt) {
        if (finished) return;

        // Airtime by INTEGRATION, not by reading a duration off the launch. The
        // ride decides how long a flight lasts from the height earned, and it
        // can be cut short by landing on a ramp -- so the only number that
        // matches what the player saw is the time actually spent off the ground.
        if (ctx.getState().airborne) {
          airtime += dt;
          currentAir += dt;
          if (currentAir > bestAir) bestAir = currentAir;
        } else {
          currentAir = 0;
        }

        if (ctx.getState().s >= finishS) { end('finish'); return; }
        left -= dt;
        if (left <= 0) end('timeout');
      },

      briefing: () => ({
        name: 'OPEN FACE',
        sub: 'The hill is twice as wide. Use it.',
        rows: [
          { label: 'BOTTOM', text: `${(course.length / 1000).toFixed(1)} KM` },
          { label: 'SCORED ON', text: 'AIRTIME' },
          { label: 'THE LINE', text: 'YOURS' },
        ],
      }),

      panel: () => {
        const togo = Math.max(0, finishS - ctx.getState().s);
        return {
          title: `${airtime.toFixed(1)}s AIR`,
          meter: {
            frac: 1 - togo / course.length,
            text: togo > 0 ? `${Math.round(togo)} m` : 'BOTTOM',
            warn: false,
            critical: false,
          },
          objectives: [
            { label: 'AIRTIME', text: `${airtime.toFixed(1)}s`, done: airtime >= AIRTIME_GOOD },
            { label: 'BEST', text: `${bestAir.toFixed(1)}s`, done: bestAir >= 1.2 },
            { label: 'JUMPS', text: `${jumps}`, done: jumps > 0 },
          ],
        };
      },
    };
  },
});
