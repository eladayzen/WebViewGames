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

/** Safety cap, not the goal -- see the note above. */
const RACE_TIMEOUT = 180;
const FIELD_SIZE = 4;

export default registerMode({
  id: 'speedRace',
  name: 'SPEED RACE',
  tagline: 'Four rivals. First to the line.',
  course: RACE_COURSE,
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
      ctx.finishLine.hide();
      ctx.endRun(won ? 'complete' : 'timeup', {
        tone: won ? 'success' : 'fail',
        title: won ? 'WINNER' : `FINISHED ${ordinal(me.place)}`,
        subtitle: 'SPEED RACE',
        detail: reason === 'timeout'
          ? `time cap  ·  ${Math.round(finishS - me.s)} m short of the line`
          : `${(course.length / 1000).toFixed(1)} km  ·  ${homeCount} of ${FIELD_SIZE + 1} home`,
        stars: me.place === 1 ? 3 : me.place === 2 ? 2 : me.place === 3 ? 1 : 0,
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
          end('finish');
          return;
        }

        left -= dt;
        if (left <= 0) end('timeout');
      },

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
