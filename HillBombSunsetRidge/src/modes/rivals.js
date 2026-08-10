// RIVALS -- a timed race against a field of AI skaters.
//
// The third mode, and the one that proves the seam works: it wants something
// completely different from the ride (where am I relative to four other people)
// and still touches nothing the controller owns. It reads distance through the
// same read-only ctx.getState() the missions mode uses, and its rivals are their
// own entity with their own simple model.
//
// IT IS SCORED, NOT A RACE TO A LINE. The first version placed everyone by
// distance, which made the whole contest "hold forward and do not crash":
// tucking is the fastest way down, carving costs speed, and every ramp, rail
// and crystal on the course was beside the point. Scoring by POINTS puts the
// contest back on the things the controller can actually do, and it is the same
// score the player earns everywhere else -- tricks, grinds and pickups -- so
// nothing here invents a second economy.
//
// The clock is what ends it, because a finish line needs a finite course and
// there isn't one: courses.js declares that kind and throws if anything uses
// it. Ninety seconds, highest score wins.

import { registerMode } from './mode.js';
import { DEFAULT_COURSE } from '../data/courses.js';

/** Seconds on the clock. Long enough for the field to spread out on pace. */
const RACE_SECONDS = 90;
const FIELD_SIZE = 4;

export default registerMode({
  id: 'rivals',
  name: 'RIVALS',
  tagline: 'Four other skaters. One hill.',
  // PARKED, not deleted. Scoring the contest by points turned out not to read
  // as a race at all: the field is spread down the hill where you cannot see
  // it, and a leaderboard of numbers is not a thing you feel while riding.
  // SPEED RACE is the version that replaced it. The code stays because the
  // scoring model here is sound and is the obvious basis for a future
  // "best run" mode -- it is reachable by ?gamemode=rivals.
  hidden: true,
  course: DEFAULT_COURSE,

  create(ctx) {
    let left = RACE_SECONDS;
    let finished = false;
    const rivals = ctx.rivals;

    /**
     * Everyone in the race, sorted by distance. The player is a row like any
     * other rather than a special case, so the standings cannot disagree with
     * themselves about who is where.
     */
    function standings() {
      const rows = rivals.field.map((r) => ({
        name: r.name, colour: r.colour, score: Math.round(r.score), you: false,
      }));
      rows.push({ name: 'YOU', colour: 0xff5a4b, score: Math.round(ctx.scoring.state.score), you: true });
      rows.sort((a, b) => b.score - a.score);
      return rows.map((r, i) => ({ ...r, place: i + 1 }));
    }

    function place() {
      return standings().find((r) => r.you).place;
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
        // The field belongs to the run, not to the session. Leaving it alive
        // would put four skaters on the hill in free ride.
        rivals.despawn();
        finished = true;
      },

      update(dt) {
        if (finished) return;
        left -= dt;
        if (left <= 0) {
          left = 0;
          finished = true;
          const p = place();
          const won = p === 1;
          ctx.endRun(won ? 'complete' : 'timeup', {
            tone: won ? 'success' : 'fail',
            title: won ? 'WINNER' : `FINISHED ${ordinal(p)}`,
            subtitle: 'RIVALS',
            detail: `${ordinal(p)} of ${FIELD_SIZE + 1}`,
            // Podium finishes earn stars; being dropped by the field does not.
            stars: p === 1 ? 3 : p === 2 ? 2 : p === 3 ? 1 : 0,
            rows: standings().map((r) => ({
              label: `${ordinal(r.place)}  ${r.you ? 'YOU' : r.name}`,
              text: r.score.toLocaleString(),
              done: r.you,
            })),
          });
        }
      },

      // Reuses the missions panel: a title, a clock, and a list of rows. The
      // rows happen to be a leaderboard rather than a checklist, which is
      // exactly the point of the panel taking data instead of knowing what a
      // mission is.
      panel: () => {
        const rows = standings();
        return {
          title: `${ordinal(rows.find((r) => r.you).place)} PLACE`,
          seconds: left,
          limit: RACE_SECONDS,
          objectives: rows.map((r) => ({
            label: r.you ? 'YOU' : r.name,
            // Score, not placement -- the gap is the information. "2nd" tells
            // you nothing about whether you are 200 points down or 20,000.
            text: r.score >= 10000
              ? `${(r.score / 1000).toFixed(0)}k` : r.score.toLocaleString(),
            done: r.you,
          })),
        };
      },
    };
  },
});
