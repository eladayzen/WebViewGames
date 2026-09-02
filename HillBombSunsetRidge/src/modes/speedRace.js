// SPEED RACE -- first past the post, on the clock.
//
// This replaces the scored version of the rivals contest (modes/rivals.js, now
// parked). Scoring it by points made it stop reading as a race: the field ends
// up spread down a hill you cannot see all of, and a column of numbers is not
// something you feel while riding. Placement by DISTANCE is legible without
// reading anything -- the people ahead of you are literally ahead of you.
//
// IT RUNS TO A FINISH LINE. It was on a clock while the finite course was still
// a hook -- "furthest down the hill after ninety seconds" -- which works but
// ends the race with a buzzer rather than with an arrival, and gives the player
// nothing to aim at. The course now carries a length, there is a line across the
// road at it, and the race ends when you reach it.
//
// PLACEMENT IS CROSSING ORDER. Everyone who reaches the line before you beat
// you, full stop; anyone still out on the course when you finish is behind you
// and is ordered by how far they got. That is the same rule a real race uses and
// it needs no explaining on screen.
//
// The clock is still here, as a CAP rather than as the goal: a rider who stops
// riding must not sit on the hill forever, and on a balance board "I fell off
// and wandered away" is a real state. It is generous enough that finishing is
// the normal ending and the cap is the exception.
//
// BOOST PADS are what stop it being "hold forward and wait". They are their own
// prop kind on their own course, so this mode gets pads and no crystals while
// the missions get crystals and no pads -- neither mode has to filter anything.
// The line through them is not the straight line, so there is a route to ride.

import { registerMode } from './mode.js';
import { RACE_COURSE, getCourse } from '../data/courses.js';
import { getRace, RACE_IDS, starsForPlace, RACE_UNLOCK_PLACE } from '../data/races.js';

/**
 * WHICH RACE THE LOBBY PICKED, set immediately before startRun.
 *
 * The same pattern the missions use, and for the same reason: a mode is chosen
 * by id through a registry that cannot carry an argument, so the choice is
 * parked here and read by courseFor/terrainFor as the run is built.
 */
let pendingId = RACE_IDS[0];

export function setPendingRace(id) {
  if (RACE_IDS.includes(id)) pendingId = id;
}

/** Safety cap, not the goal -- the race ends by arriving, not by a buzzer. */
const RACE_TIMEOUT = 180;
const FIELD_SIZE = 4;

/**
 * How long the player keeps riding after crossing the line, in seconds. Long
 * enough to see the gate pass overhead and the road open out behind it; short
 * enough that it reads as the end of a race rather than the game forgetting to
 * stop. Amit: "give me another second or two to run after the finish line."
 */
const RUNOUT_SECONDS = 2;

export default registerMode({
  id: 'speedRace',
  // Just SPEED RACE. The suffix distinguished it from the open-face variant,
  // which is parked and unreachable -- so it was labelling a choice the player
  // does not have. Amit: "change the names in the main lobby to just missions
  // and just speed race."
  name: 'SPEED RACE',
  tagline: 'The ridge. Four rivals, first to the line.',
  course: RACE_COURSE,
  /**
   * THE HILL IS THE RACE. It used to be dealt at random from a shuffled bag,
   * which made every race the same event on scenery the player had no
   * relationship with -- and meant "I want another go at that one" was not
   * something they could ask for. Now the lobby picks it.
   */
  terrainFor: () => getRace(pendingId).terrain,
  /** Named on the results screen and the pre-race card. */
  raceName: () => getRace(pendingId).name,
  // The score readout is hidden in this mode. Points still accrue underneath --
  // nothing special-cases the scoring system -- but showing a number that has no
  // bearing on whether you are winning is worse than showing nothing: it reads
  // as the thing you are being judged on.
  showsScore: false,
  // Racing other riders is where a boost is something you SPEND, so its
  // countdown gets the top of the screen rather than a corner.
  showsBoostBar: true,

  create(ctx) {
    const course = getCourse(RACE_COURSE);
    const rivals = ctx.rivals;
    let left = RACE_TIMEOUT;
    let finished = false;
    let startS = 0;
    let finishS = 0;
    /** Seconds of free coasting left after crossing the line. See update(). */
    let runout = 0;
    /** Finish order, filled as each racer crosses. */
    const crossed = [];

    function distanceOf(r) { return r.s; }

    /**
     * Everyone in the race. Anyone who has CROSSED is ordered by when they did
     * it; anyone still out is ordered by distance and sits behind all finishers.
     * The player is a row like any other so the standings cannot disagree with
     * themselves about who is where.
     */
    function standings() {
      const me = { name: 'YOU', s: ctx.getState().s, you: true };
      const rows = rivals.field.map((r) => ({ name: r.name, s: distanceOf(r), you: false }));
      rows.push(me);
      for (const row of rows) row.finishedAt = crossed.indexOf(row.name);
      rows.sort((a, b) => {
        const af = a.finishedAt, bf = b.finishedAt;
        if (af >= 0 && bf >= 0) return af - bf;   // both home: who first
        if (af >= 0) return -1;                    // a is home, b is not
        if (bf >= 0) return 1;
        return b.s - a.s;                          // neither home: who is closer
      });
      return rows.map((r, i) => ({ ...r, place: i + 1 }));
    }

    function ordinal(n) {
      return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`;
    }

    function end(reason) {
      finished = true;
      const rows = standings();
      const me = rows.find((r) => r.you);
      const won = me.place === 1;
      const homeCount = crossed.length;
      const race = getRace(pendingId);
      const stars = starsForPlace(me.place);
      ctx.finishLine.hide();
      /**
       * THIRD OR BETTER CLEARS THE RACE and unlocks the next.
       *
       * Recorded BEFORE the results screen is built, so the lobby behind it
       * already shows what this run just opened -- the same ordering the
       * missions use, and for the same reason.
       *
       * A worse place records nothing at all rather than a zero-star clear.
       * `cleared` is what gates the next race, so writing a record for fourth
       * would unlock the ladder by losing.
       */
      if (stars > 0) ctx.progress.record(race.id, stars, Math.round(ctx.scoring.state.score));
      ctx.endRun(won ? 'complete' : 'timeup', {
        tone: stars > 0 ? 'success' : 'fail',
        title: won ? 'WINNER' : `FINISHED ${ordinal(me.place)}`,
        // The track, not the mode. Which race it was is the thing worth saying
        // on a screen that already has "FINISHED 2ND" at the top of it.
        subtitle: race.name,
        detail: reason === 'timeout'
          ? `time cap  ·  ${Math.round(finishS - me.s)} m short of the line`
          // Says what the bar was when it was missed, so a fourth place reads as
          // "one more place and it opens" rather than as an unexplained refusal.
          : stars > 0
            ? `${(course.length / 1000).toFixed(1)} km  ·  ${homeCount} of ${FIELD_SIZE + 1} home`
            : `${ordinal(RACE_UNLOCK_PLACE)} or better unlocks the next race`,
        stars,
        rows: rows.map((r) => ({
          label: r.name,
          // Finishers get their place; anyone still out gets how far short they
          // were, which is more use than a place they never actually reached.
          text: r.finishedAt >= 0 ? ordinal(r.place) : `${Math.round(finishS - r.s)} m`,
          done: r.you,
        })),
      });
    }

    return {
      start() {
        startS = ctx.getState().s;
        finishS = startS + course.length;
        rivals.spawn(FIELD_SIZE, startS);
        ctx.finishLine.place(finishS);
        // Empty the road past the line -- see props.setEndS.
        ctx.props.setEndS(finishS);
        ctx.hud.banner('RACE');
      },

      stop() {
        rivals.despawn();
        ctx.finishLine.hide();
        finished = true;
      },

      update(dt) {
        if (finished) return;

        // Record crossings in the order they happen. Rivals first so a rival
        // that crosses on the same frame as the player is ahead of them -- it
        // was ahead on the road, and the alternative silently favours the
        // player on a tie.
        for (const r of rivals.field) {
          if (r.s >= finishS && !crossed.includes(r.name)) crossed.push(r.name);
        }
        const meS = ctx.getState().s;
        if (meS >= finishS && !crossed.includes('YOU')) {
          crossed.push('YOU');
          // A BEAT TO COAST THROUGH. Amit: "give me another second or two to run
          // after the gate and finish line before it's sent to the hub."
          //
          // Ending on the frame the line is crossed cuts the picture at exactly
          // the moment the player is looking at the thing they just achieved --
          // the gate is still filling the screen when the results replace it.
          // Crossing a line is a moment you ride THROUGH, so the run does, and
          // the result screen arrives once it has actually happened.
          //
          // The place is already fixed at this point: `crossed` recorded the
          // order, so nothing about the outcome can change during the runout,
          // and a rival finishing during it still lands behind the player.
          runout = RUNOUT_SECONDS;
        }

        if (runout > 0) {
          runout -= dt;
          if (runout <= 0) { end('finish'); return; }
          // The clock stops during the runout: the race is over, and letting the
          // timeout fire here would report a win as a time cap.
          return;
        }

        left -= dt;
        if (left <= 0) end('timeout');
      },

      /**
       * The pre-race card. Built from the same constants the race is actually
       * run with -- the course's own length and the real field size -- so it
       * cannot drift into describing a race that is not the one about to start.
       *
       * It exists because the race began with no explanation at all: four
       * skaters set off and the player was left to infer both the goal and the
       * mechanic from a leaderboard. Amit: "I don't understand what it should
       * do." Three lines answer it -- where the finish is, who you are racing,
       * and what the gates are for.
       */
      /**
       * THE CARD SAYS WHAT TO DO, not what the race is made of.
       *
       * Amit: "the opening screen is not good, it needs to be very clear --
       * collect speed boosters, avoid those walls, to win. And if you can show
       * some iconic presentation."
       *
       * The old version listed FINISH 2.6 KM, RIVALS 4, BOOST GATES RIDE
       * THROUGH: three facts about the race, none of which is an instruction.
       * A player reading it still had to work out that the gates are how you
       * win and the barriers are how you lose -- which is the entire strategy,
       * and the one thing a pre-race card exists to hand over.
       *
       * So each row is now a VERB with the thing it acts on beside it, and each
       * carries the prop's own icon, so what to chase and what to dodge are
       * told apart before the run starts rather than during it.
       */
      briefing: () => ({
        name: getRace(pendingId).name,
        sub: 'Beat 4 rivals to the finish line.',
        rows: [
          { label: 'RIDE THE GATES', text: 'FASTER', kind: 'boost' },
          { label: 'AVOID THE BARRIERS', text: 'SLOWER', kind: 'wall' },
          { label: 'FIRST TO THE LINE', text: `${(course.length / 1000).toFixed(1)} KM`, kind: 'score' },
        ],
      }),

      panel: () => {
        const rows = standings();
        const me = rows.find((r) => r.you);
        const togo = Math.max(0, finishS - ctx.getState().s);
        return {
          title: `${ordinal(me.place)} PLACE`,
          // The bar is DISTANCE now, not time: it fills as you approach the
          // line, which is the thing the player is actually racing toward.
          meter: {
            frac: 1 - togo / course.length,
            text: togo > 0 ? `${Math.round(togo)} m` : 'FINISH',
            warn: togo < course.length * 0.25,
            critical: togo < course.length * 0.1,
          },
          objectives: rows.map((r) => ({
            label: r.name,
            text: r.finishedAt >= 0 ? ordinal(r.place) : ordinal(r.place),
            done: r.you,
          })),
        };
      },
    };
  },
});
