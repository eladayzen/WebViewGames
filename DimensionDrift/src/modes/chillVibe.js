// CHILL VIBE — the endless descent, which is the game carve already was.
//
// It is a mode now rather than the only thing the game does, and this file is
// deliberately almost empty: everything it describes was already true, and
// moving it behind the seam must not change a single thing about how it plays.
// That is the point of doing this mode first. If the seam is wrong, it is wrong
// against a run whose behaviour is already known, rather than against a race
// nobody has ridden yet.
//
// WHAT DEFINES IT: the mountain does not end, the music loops 1-2-1-2, and the
// CLOCK is what ends the run. Gates, motes, kickers and the drift lines are all
// income; a wipeout is a charge. See `timer.js` for the economy and why every
// number in it came from playing rather than from arithmetic.
//
// THE CLOCK IS THE WHOLE DISTINCTION between this mode and the race, and it is
// worth keeping it that clean: chill vibe is a clock, race is a line. Neither
// needs a sentence of explanation beyond that.

import { registerMode } from './mode.js';
import { CLOCK } from '../timer.js';

export default registerMode({
  id: 'chill',
  name: 'chill vibe',
  tagline: 'endless descent · beat the clock',
  /** No race, so no race route -- just the ground you will ride. */
  routeName: 'Route',
  /** The route screen's tutorial line. "Diamonds", not motes -- players have
   *  never heard a mote; they have all met a diamond. */
  explainer: 'Ride as far as you can before the time runs out!',
  order: 1,

  /**
   * The framing this game was tuned against, stated rather than inherited. It
   * is the same set `TUNE` boots with — written out here so that changing the
   * race's camera can never move this one by accident, which is exactly what
   * would happen while both modes shared one table.
   */
  // PULLED IN TO THE RACE'S FRAMING -- "put the camera in, you can take almost
  // the same values as the competitive mode." Was 13.0/5.9, a wide observing
  // shot; the race's close chase (4.0/1.9) is the one he kept preferring.
  camera: { camBack: 4.0, camUp: 1.9, camLookAhead: 36, camLookUp: 13 },

  /** Both tracks, in order — the 1-2-1-2 playlist an endless descent needs. */
  music: ['carve_theme', 'sunrise_ascent'],

  /**
   * A QUARTER OF THE SIZE. The skirt is tuned for the race's four-metre camera;
   * this mode watches from thirteen, where the same plume is three times the
   * screen. See where it is applied in `main.js`.
   */
  skirt: 0.22,

  /** No start line: an endless descent has no line to start behind. */
  showsStartLine: false,

  /** Plain gates here GIVE TIME, and they dress for it: tall bare amber poles,
   *  amber floor mark -- "I need them to feel completely different from the
   *  gates that give you boost speed." ON THE DEFINITION, not the instance:
   *  main reads `_modeDef`, and this key spent one build on the instance doing
   *  nothing -- the same definition-vs-instance trap as `hidesScore`, caught by
   *  a screenshot showing flagged poles where bare ones were ordered. */
  timeGates: true,

  create(game) {
    let seen = 0;
    return {
      /** The clock IS this mode. See the note above. */
      usesClock: true,

      /**
       * THE SAME MOUNTAIN EVERY TIME, per place.
       *
       * The start of the place's band rather than a draw inside it. This mode
       * is scored and the score is compared across runs, so the ground has to
       * be the same ground -- a random offset would make a best score a
       * statement about which stretch you happened to get. The race takes the
       * opposite view and draws randomly, which is why this is the MODE's
       * decision and not the place's.
       *
       * ON THE INSTANCE, not the definition. `main.js` calls this on what
       * `create` returns, and a copy on the definition is simply never seen --
       * it reported an offset of 0 for a place whose band starts at 34000. The
       * same trap `hidesScore` set earlier; the rule is that anything main.js
       * reaches for through `this._mode` belongs in here.
       */
      courseOffset(place) { return place.offset[0]; },

      start() {
        game.timer.reset();
      },

      /** In order, so the descent hands over 1-2-1-2 as it always has. */
      pickMusic(ids) { return ids; },

      /**
       * ONE GATE IN SEVEN IS A BOOST GATE.
       *
       * "We could use here in this original mode the boosters every now and
       * then." Every seventh, which at this mode's gate cadence is roughly one
       * every half minute -- often enough to be a thing you look forward to and
       * rare enough that the slalom is still what the run is made of.
       *
       * The race marks EVERY kept beat as a boost and drops the rest; this
       * keeps every beat and promotes a few, which is the difference between a
       * course made of boosts and a course with boosts in it.
       */
      shapePlan(entries) {
        for (const e of entries) {
          if (seen++ % 7 === 6) e.kind = 'boost';
        }
        return entries;
      },

      /** What one pays here. Shorter and gentler than the race's: there is no
       *  field to catch, and the clock is what a boost is really worth. */
      boost: { addSpeed: 12, seconds: 2.4, ceiling: 30 },

      // The clock is drained in `_updatePlay` alongside the physics, because it
      // must be charged before anything can pay into it — a gate taken on the
      // frame it runs out cannot resurrect a run that is already over. So there
      // is nothing to do per frame here; the mode only has to say when it is
      // finished.
      ended() {
        return game.timer.expired ? 'timeup' : null;
      },

      results() {
        // ── WHAT AN ENDLESS DESCENT'S RESULT ACTUALLY IS ──────────────────
        // The race got this treatment first and Elad asked for the same here:
        // "only relevant stuff". The mode's one question is HOW FAR, so the
        // kilometres take the big number slot the score used to hold, the
        // score moves to the summary line with the seconds the clock ate, and
        // the generic stats grid (carves, air, top speed) stays hidden -- a
        // row of near-zeroes under a grade is noise wearing a layout. The
        // grade keeps the rank slot: it is this mode's native judgement.
        // Total time IN THE RUN, from the mode's own economy rather than the
        // audio clock: the run ends when the timer dies, so its length is
        // exactly the seconds it started with plus every second earned. No
        // audio dependence (runTime read 0:00 in a muted harness), no wall
        // clock (a minute on the pause screen is not a minute of descending).
        const t = CLOCK.start + game.timer.earned;
        const clock = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        return {
          title: 'out of time',
          headline: `${(game.distance / 1000).toFixed(2)} km`,
          // The grade is gone by request; the run's full duration arrives in
          // its place on the summary line.
          showRank: false,
          summary: `${clock} ridden — score ${Math.round(game.score).toLocaleString('en-US')} — ${Math.round(game.timer.earned)}s earned`,
          statsRow: false,
          run: { distance: game.distance, earned: game.timer.earned },
        };
      },

      stop() {},
    };
  },
});
