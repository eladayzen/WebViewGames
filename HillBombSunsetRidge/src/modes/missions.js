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
// WHICH MISSION runs is decided by the mission-select screen, not here. This
// file used to hold a private index and advance it on a win, which meant the
// only way to play a mission was to arrive at it in order -- there was nowhere
// to express "replay the one I two-starred". Selection lives in the UI, results
// go to the progress store, and this mode just runs whatever it was handed.

import { registerMode } from './mode.js';
import { RIDE_EVENTS as EV } from '../core/events.js';
import { MISSIONS , getMission } from '../data/missions.js';
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
/**
 * TWO LABELS PER OBJECTIVE, and they are not the same job.
 *
 * `label` is for the HUD panel during a run -- a glance at the corner, where
 * "CRYSTALS 12/16" is exactly right and a verb is noise you re-read every time.
 *
 * `action` is for the briefing card, which is the one screen whose entire
 * purpose is explaining what you are about to be asked to do. Amit: "instead of
 * writing crystals -- collect crystals. The creative explanation needs to be
 * much more simple and clear." A bare noun is a category; a verb is an
 * instruction, and the card should give an instruction.
 */
const KIND_SPECS = {
  pickup: {
    event: EV.PICKUP,
    match: (o, p) => !o.type || p.type === o.type,
    label: (o) => `${(o.type || 'pickup').toUpperCase()}S`,
    action: (o) => `COLLECT ${(o.type || 'pickup').toUpperCase()}S`,
  },
  trick: {
    event: EV.TRICK,
    match: (o, p) => p.type === o.trick,
    label: (o) => `${String(o.trick).toUpperCase()}${o.count > 1 ? 'S' : ''}`,
    action: (o) => `LAND ${String(o.trick).toUpperCase()}${o.count > 1 ? 'S' : ''}`,
  },
  anyTrick: {
    event: EV.TRICK,
    match: () => true,
    label: () => 'TRICKS',
    action: () => 'LAND TRICKS',
  },
  launch: {
    event: EV.LAUNCH,
    /**
     * RAMPS ONLY -- not everything that puts the rider in the air.
     *
     * A terrain drop fires the same LAUNCH event as a kicker, which was
     * deliberate (the ride reports leaving the ground, and what threw you is a
     * detail) and is wrong for an objective. Amit, on RAMP SCHOOL: "it says hit
     * ramps, but you actually collect also drops. A drop in the road -- I don't
     * have to do nothing, I didn't want to navigate there, and I still get the
     * point."
     *
     * An objective is a thing you go and do. A drop happens to you whether you
     * steer or not, so counting it pays the player for the hill's behaviour
     * rather than their own. Requiring a named launcher also excludes the bare
     * ollie, for the same reason: HIT RAMPS should mean ramps.
     */
    match: (o, p) => !!p.launcher && p.launcher !== 'DROP',
    label: () => 'RAMPS',
    action: () => 'HIT RAMPS',
  },
  boost: {
    event: EV.BOOST,
    match: () => true,
    label: () => 'BOOSTS',
    action: () => 'RIDE SPEED GATES',
  },
  grind: {
    event: EV.GRIND,
    match: () => true,
    label: () => 'RAILS',
    action: () => 'RIDE RAILS',
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
    action: () => 'LAND HUGE AIRS',
  },
  score: {
    // Score is a level, not a tally of events, so it is polled in update()
    // rather than driven by a subscription. Kept in the same table so the panel
    // and the completion check do not need to know the difference.
    poll: (ctx) => ctx.scoring.state.score,
    label: () => 'SCORE',
    action: () => 'SCORE POINTS',
    // Its own counter format: "12043/20000" does not fit the panel's width and
    // is unreadable at a glance anyway. Thousands are the unit that matters.
    fmt: (o) => `${Math.floor(o.have / 1000)}k/${Math.round(o.count / 1000)}k`,
  },
};

// Set by the mission-select screen just before the run starts. Null falls back
// to the first mission, so a direct ?gamemode=missions still works.
let pendingId = null;

/** @param {string} id */
export function setPendingMission(id) {
  pendingId = id;
}

const MISSION_MODE = {
  id: 'missions',
  name: 'MISSIONS',
  tagline: 'Beat the clock. Tick the list.',
  course: DEFAULT_COURSE,
  /**
   * THE MISSION picks the hill, not the mode. Missions now span two terrains
   * in one progression, so a single course on the mode def cannot answer for
   * all of them -- startRun asks this first and falls back to `course` above.
   */
  courseFor: () => (pendingId && getMission(pendingId).course) || DEFAULT_COURSE,
  /**
   * What may appear on the ground for this mission. Null lets the course
   * decide, which is every ridge mission -- only the face's ladder introduces
   * its vocabulary one piece at a time.
   */
  contentFor: () => (pendingId && getMission(pendingId).content) || null,

  create(ctx) {
    const mission = MISSIONS.find((m) => m.id === pendingId) || MISSIONS[0];
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
    function counterText(o) {
      if (o.done) return '\u2713';
      return o.spec && o.spec.fmt ? o.spec.fmt(o) : `${o.have}/${o.count}`;
    }

    function recap() {
      return objectives.map((o) => ({
        label: o.spec ? o.spec.label(o) : o.kind,
        text: counterText(o), done: o.done,
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
      // Neither of a mission's own payouts is a trick, so neither builds the
      // chain -- the run is over by the time the bonus lands anyway.
      ctx.scoring.award(bonus, 'TIME BONUS', false);
      // Read the score AFTER the bonus lands, so banking time can be what
      // carries a run over a star threshold.
      const earned = starsFor(ctx.scoring.state.score);
      // Recorded BEFORE the results screen is built, so the mission list behind
      // it already reflects this run -- including whatever it just unlocked.
      ctx.progress.record(mission.id, earned, ctx.scoring.state.score);
      ctx.endRun('complete', {
        tone: 'success',
        title: 'MISSION COMPLETE',
        subtitle: `${String(mission.number).padStart(2, '0')} \u00b7 ${mission.name}`,
        detail: `${Math.ceil(left)}s to spare`,
        stars: earned,
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
        ctx.scoring.award(250, `${o.count} ${o.spec.label(o)}`, false);
        checkComplete();
      }
    }

    return {
      start() {
        // No banner: the briefing card names the mission far more clearly, and
        // firing both put the name on screen twice at once.

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
            subtitle: `${String(mission.number).padStart(2, '0')} \u00b7 ${mission.name}`,
            detail: `${done}/${objectives.length} objectives cleared`,
            stars: 0,
            rows: recap(),
          });
        }
      },

      /**
       * What the pre-run briefing shows. Built from the SAME objectives the
       * panel will show, so the card the player reads and the panel they glance
       * at are the same list -- which is exactly what the flight into the HUD
       * is claiming.
       */
      briefing: () => ({
        number: mission.number,
        name: mission.name,
        // NO FLAVOUR LINE. Amit: "we have the headline, then we have some
        // sentence that people spend time to look at and it's really confusing
        // and not that funny." It sat between the title and the objectives --
        // the two things that actually say what to do -- and cost a read to
        // discover it said nothing. mission.brief still labels the row in the
        // mission list, where browsing is the point.
        rows: objectives.map((o) => ({
          label: o.spec && o.spec.action ? o.spec.action(o)
            : o.spec ? o.spec.label(o) : o.kind,
          text: o.spec && o.spec.fmt ? `${o.count.toLocaleString()}` : `${o.count}`,
        })),
      }),

      panel: () => ({
        title: mission.name,
        seconds: left,
        limit: mission.seconds,
        objectives: objectives.map((o) => ({
          label: o.spec ? o.spec.label(o) : o.kind,
          text: counterText(o),
          done: o.done,
        })),
      }),
    };
  },
};

/**
 * ONE MODE BODY, TWO FRONT DOORS. The ridge's missions and the open face's are
 * the same game -- same objectives, same clock, same scoring -- played on
 * different hills, and the hill is chosen per mission by courseFor(). So the
 * definition is shared and only the registration differs.
 *
 * The face's half registers in its own module (modes/faceMissions.js) purely so
 * main.js's import order can group the lobby: the two ORIGINAL modes first,
 * then the open-face ones. Registration order is lobby order.
 */
export { MISSION_MODE };

export default registerMode({
  ...MISSION_MODE,
  id: 'missions',
  name: 'MISSIONS · ORIGINAL',
  tagline: 'The ridge. Twenty runs against the clock.',
});


