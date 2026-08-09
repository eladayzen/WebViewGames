// MISSIONS -- time-limited objectives on a hard-capped clock.
//
// The rules, from Amit: each mission has its own time limit and its own list of
// things to do; the limit is a HARD CAP and never changes during the run. So
// there is exactly one place the clock is touched (`left -= dt`) and nothing
// else in this file can add to it. The mode that hands out extra seconds for
// tricks is a separate mode, deliberately -- if both lived here the cap would
// become a variable and the mission mode would quietly turn into the other one.
//
// Everything is counted off the ride's event stream. This file never reads the
// rider, the physics or the input, which is what keeps the controller a single
// shared system: a mission can change what you are asked to do, never how the
// board responds.
//
// PROGRESSION lives here rather than in the lobby, because the lobby's only
// choice is the mode itself. Clear a mission and the next one loads; fail it and
// you retry the same one. The index survives a restart within the session, so
// "again" means "the mission I was on", not "back to the first".

import { registerMode } from './mode.js';
import { RIDE_EVENTS as EV } from '../core/events.js';
import { MISSIONS } from '../data/missions.js';
import { DEFAULT_COURSE } from '../data/courses.js';

// How each objective kind reads the event stream: which event feeds it, whether
// a given payload counts, how far a payload advances it, and how it is worded.
// Adding a kind is adding an entry here -- missions themselves stay pure data.
//
// LABELS NAME THE THING, NOT THE TARGET. "COLLECT 6 CRYSTALS" beside a counter
// reading 0/6 says six twice, and at the panel's real on-device width it wrapped
// to two lines to do it. The label is what you are after; the counter is how far
// you have got. The full phrasing survives where it is actually useful -- the
// popup when a line completes, which has the room and no counter next to it.
const KIND_SPECS = {
  pickup: {
    event: EV.PICKUP,
    match: (o, p) => !o.type || p.type === o.type,
    label: (o) => `${(o.type || 'pickup').toUpperCase()}S`,
  },
  trick: {
    event: EV.TRICK,
    match: (o, p) => p.type === o.trick,
    label: (o) => `${String(o.trick).toUpperCase()}${o.count > 1 ? 'S' : ''}`,
  },
  anyTrick: {
    event: EV.TRICK,
    match: () => true,
    label: () => 'TRICKS',
  },
  launch: {
    event: EV.LAUNCH,
    match: () => true,
    label: () => 'RAMPS',
  },
  grind: {
    event: EV.GRIND,
    match: () => true,
    label: () => 'RAILS',
  },
  air: {
    event: EV.LAND,
    // LAND fires on every touchdown including the little side hops, so this is
    // gated on the SAME threshold that makes the on-screen popup read HUGE AIR.
    // It used to test `p.height`, a field the LAND event never carried, so it
    // could never advance and the mission was unwinnable. Matching the banner's
    // own definition also fixes the softer half of that bug: the objective said
    // "BIG AIRS" while the game only ever says AIR or HUGE AIR, so there was no
    // way to tell which landings were supposed to count.
    match: (o, p) => !!p.huge,
    label: () => 'HUGE AIRS',
  },
  score: {
    // Score is a level, not a tally of events, so it is polled in update()
    // rather than driven by a subscription. Kept in the same table so the panel
    // and the completion check do not need to know the difference.
    poll: (ctx) => ctx.scoring.state.score,
    label: () => 'SCORE',
  },
};

// Progression is per session, not per run -- see the header note.
let missionIndex = 0;

export default registerMode({
  id: 'missions',
  name: 'MISSIONS',
  tagline: 'Beat the clock. Tick the list.',
  course: DEFAULT_COURSE,

  create(ctx) {
    const mission = MISSIONS[missionIndex % MISSIONS.length];
    // Each objective carries its own live progress. Copied rather than mutated
    // in place so MISSIONS stays immutable data and a retry starts clean.
    const objectives = mission.objectives.map((o) => ({
      ...o,
      spec: KIND_SPECS[o.kind],
      have: 0,
      done: false,
    }));

    let left = mission.seconds;
    let finished = false;
    /** @type {Function[]} */
    const unsubs = [];

    /** What you were asked to do and how far you got, for the results screen. */
    function recap() {
      return objectives.map((o) => ({
        label: o.spec ? o.spec.label(o) : o.kind,
        have: o.have, count: o.count, done: o.done,
      }));
    }

    /**
     * Stars for a CLEARED mission: one for finishing, two more from score.
     * A failed run gets none -- see the data file for why partial credit is
     * deliberately not offered.
     */
    function starsFor(score) {
      const [two, three] = mission.stars || [Infinity, Infinity];
      return score >= three ? 3 : score >= two ? 2 : 1;
    }

    function checkComplete() {
      if (finished || objectives.some((o) => !o.done)) return;
      finished = true;
      // Bank the remaining seconds: it rewards route planning over grinding out
      // the clock, which is the behaviour a hard cap is meant to encourage.
      const bonus = Math.round(left * 25);
      ctx.scoring.award(bonus, 'TIME BONUS');
      missionIndex += 1;
      // Read the score AFTER the bonus lands, so banking time can be what
      // carries a run over a star threshold.
      ctx.endRun('complete', {
        tone: 'success',
        title: 'MISSION COMPLETE',
        subtitle: mission.name,
        detail: `${Math.ceil(left)}s to spare`,
        stars: starsFor(ctx.scoring.state.score),
        rows: recap(),
      });
    }

    function credit(o, amount) {
      if (o.done || finished) return;
      o.have = Math.min(o.count, o.have + amount);
      if (o.have >= o.count) {
        o.done = true;
        // ONE report, not two. Awarding with the label is enough: scoring
        // publishes a lastEvent that main.js already turns into a popup, so the
        // manual popup that used to sit here produced a second floating line --
        // and the paired award(250, null) printed it as literally "null".
        // The popup gets the full phrasing -- it has the room, and unlike the
        // panel row there is no counter beside it to supply the number.
        ctx.scoring.award(250, `${o.count} ${o.spec.label(o)}`);
        checkComplete();
      }
    }

    return {
      start() {
        ctx.hud.banner(mission.name);
        for (const o of objectives) {
          if (!o.spec || !o.spec.event) continue;
          unsubs.push(ctx.events.on(o.spec.event, (p) => {
            if (o.spec.match(o, p)) credit(o, 1);
          }));
        }
      },

      stop() {
        // Every subscription, unconditionally. A mission that outlived its run
        // would keep counting into the next one.
        for (const off of unsubs) off();
        unsubs.length = 0;
        finished = true;
      },

      update(dt) {
        if (finished) return;

        // Polled objectives (score) -- read the level, then treat it like any
        // other progress value.
        for (const o of objectives) {
          if (!o.spec || !o.spec.poll) continue;
          const v = o.spec.poll(ctx);
          if (v > o.have) credit(o, v - o.have);
        }

        // THE HARD CAP. This is the only line that changes the clock.
        left -= dt;
        if (left <= 0) {
          left = 0;
          finished = true;
          const done = objectives.filter((o) => o.done).length;
          ctx.endRun('timeup', {
            tone: 'fail',
            // The verdict, not just the cause. "TIME UP" alone reads as a
            // neutral status line; the player has to work out from the rest of
            // the screen whether that was good or bad.
            title: 'TIME UP — MISSION FAILED',
            subtitle: mission.name,
            detail: `${done}/${objectives.length} objectives cleared`,
            stars: 0,
            rows: recap(),
          });
        }
      },

      panel: () => ({
        title: mission.name,
        seconds: left,
        limit: mission.seconds,
        objectives: objectives.map((o) => ({
          label: o.spec ? o.spec.label(o) : o.kind,
          have: o.have,
          count: o.count,
          done: o.done,
        })),
      }),
    };
  },
});

/** Lets a fresh session (or a test) start from a known mission. */
export function setMissionIndex(i) {
  missionIndex = i;
}
export function getMissionIndex() {
  return missionIndex;
}
