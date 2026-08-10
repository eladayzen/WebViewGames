// SPEED RACE -- first past the post, on the clock.
//
// This replaces the scored version of the rivals contest (modes/rivals.js, now
// parked). Scoring it by points made it stop reading as a race: the field ends
// up spread down a hill you cannot see all of, and a column of numbers is not
// something you feel while riding. Placement by DISTANCE is legible without
// reading anything -- the people ahead of you are literally ahead of you.
//
// It is timed rather than run to a finish line because a finish line needs a
// finite course and there isn't one yet (courses.js declares that kind and
// throws if used). Ninety seconds, furthest down the hill wins. When the finite
// course arrives, the finish line goes here and the timer becomes the fallback.
//
// BOOST PADS are what stop it being "hold forward and wait". They are their own
// prop kind on their own course, so this mode gets pads and no crystals while
// the missions get crystals and no pads -- neither mode has to filter anything.
// The line through them is not the straight line, so there is a route to ride.

import { registerMode } from './mode.js';
import { RACE_COURSE } from '../data/courses.js';

const RACE_SECONDS = 90;
const FIELD_SIZE = 4;

export default registerMode({
  id: 'speedRace',
  name: 'SPEED RACE',
  tagline: 'Four rivals, ninety seconds, one hill.',
  course: RACE_COURSE,
  // The score readout is hidden in this mode. Points still accrue underneath --
  // nothing special-cases the scoring system -- but showing a number that has no
  // bearing on whether you are winning is worse than showing nothing: it reads
  // as the thing you are being judged on.
  showsScore: false,

  create(ctx) {
    let left = RACE_SECONDS;
    let finished = false;
    const rivals = ctx.rivals;

    /**
     * Everyone in the race by distance. The player is a row like any other
     * rather than a special case, so the standings cannot disagree with
     * themselves about who is where.
     */
    function standings() {
      const rows = rivals.field.map((r) => ({ name: r.name, s: r.s, you: false }));
      rows.push({ name: 'YOU', s: ctx.getState().s, you: true });
      rows.sort((a, b) => b.s - a.s);
      return rows.map((r, i) => ({ ...r, place: i + 1 }));
    }

    function ordinal(n) {
      return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`;
    }

    return {
      start() {
        rivals.spawn(FIELD_SIZE, ctx.getState().s);
        ctx.hud.banner('RACE');
      },

      stop() {
        // The field belongs to the run. Leaving it alive would put four skaters
        // on the hill in free ride.
        rivals.despawn();
        finished = true;
      },

      update(dt) {
        if (finished) return;
        left -= dt;
        if (left <= 0) {
          left = 0;
          finished = true;
          const rows = standings();
          const me = rows.find((r) => r.you);
          const won = me.place === 1;
          const leader = rows[0];
          ctx.endRun(won ? 'complete' : 'timeup', {
            tone: won ? 'success' : 'fail',
            title: won ? 'WINNER' : `FINISHED ${ordinal(me.place)}`,
            subtitle: 'SPEED RACE',
            detail: won
              ? `${(me.s / 1000).toFixed(2)} km`
              // The gap, not just the position: "3rd" does not tell you whether
              // you were beaten by a board length or by half the hill.
              : `${Math.round(leader.s - me.s)} m behind ${leader.name}`,
            stars: me.place === 1 ? 3 : me.place === 2 ? 2 : me.place === 3 ? 1 : 0,
            rows: rows.map((r) => ({
              label: r.name,
              text: ordinal(r.place),
              done: r.you,
            })),
          });
        }
      },

      panel: () => {
        const rows = standings();
        const me = rows.find((r) => r.you);
        return {
          title: `${ordinal(me.place)} PLACE`,
          seconds: left,
          limit: RACE_SECONDS,
          // POSITION, not a gap and not a score. A race is a ladder of places;
          // metres are a number you have to interpret, and the score is not what
          // this mode is even about -- see `showsScore` on the definition.
          objectives: rows.map((r) => ({
            label: r.name,
            text: ordinal(r.place),
            done: r.you,
          })),
        };
      },
    };
  },
});
