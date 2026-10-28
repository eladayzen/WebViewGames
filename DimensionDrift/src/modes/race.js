// RACE — first to the line.
//
// Ported from HillBombSunsetRidge/src/modes/speedRace.js, which is the mode that
// REPLACED their scored rivals contest. That one is still in their tree at
// `modes/rivals.js`, registered `hidden`, and its header says why:
//
//   > Scoring the contest by points turned out not to read as a race at all:
//   > the field is spread down the hill where you cannot see it, and a
//   > leaderboard of numbers is not a thing you feel while riding.
//
// That applies harder here. Their hill is an open half-pipe; carve's bowl is
// 64 m wide with height fog closing at 0.003 to 0.011 density, so the field is
// even less visible. PLACEMENT IS BY DISTANCE — the riders ahead of you are
// literally ahead of you, and that needs no reading.
//
// ── NO CLOCK. AT ALL. ───────────────────────────────────────────────────────
// Elad's call, and it is what makes the two modes distinct rather than the same
// mechanic at different numbers: CHILL VIBE IS A CLOCK, RACE IS A LINE.
//
// HillBomb keeps a 180 s cap even in the race, for one specific reason — "a
// rider who stops riding must not sit on the hill forever, and on a balance
// board 'I fell off and wandered away' is a real state". carve does not need it,
// because that escape already exists and is better: X -> pause -> lobby, from
// any screen, built when the back button became a back button. A stranded rider
// taps out rather than waiting for a buzzer.
//
// The consequence worth naming: A WIPEOUT COSTS SPEED AND GROUND, NOTHING ELSE.
// There is no time to charge, so the punishment is the metres the field takes
// off you while you are down — which in a race is a real punishment, and in the
// clock mode it would only have been a second charge on top of the seconds.
//
// ── WHAT THE COURSE CARRIES ─────────────────────────────────────────────────
// Motes are OFF (`pickups.setEnabled(false)`). They feed the clock, and there is
// no clock; riding through a currency you cannot spend is an invitation to
// detour for nothing. HillBomb dropped its crystals from the race course for the
// same reason and put it better: "a contest decided by speed should not also be
// asking you to detour for points, and the two pickups would compete for the
// same glance."
//
// The slalom gates STAY. They are what carve is, and the lean-as-a-force
// question the whole game exists to answer is asked by a slalom.

import { registerMode } from './mode.js';
import { pickOffset, pickHour } from '../places.js';
import { SPAWN_LEAD_DEFAULT } from '../course.js';

/**
 * Metres of descent to the line.
 *
 * Chosen against the measured field rather than picked. `ReferenceRun` — which
 * IS "a competent rider", at REF_TRAVERSE 0.86 and AVG_EDGE 0.45 — covers
 * 2793 m in the 171.5 s of one track, and the measured speed band is p10 52.3 /
 * p50 63.9 / p90 75.7 km/h. 2400 m is about two and a half minutes at the
 * median, which fits INSIDE one pass of the music: the race never reaches the
 * 1-2-1-2 hand-over, so it gets a single unbroken piece to run against and the
 * mood arc runs about 85% of one cycle, dawn to late afternoon.
 */
export const RACE_LENGTH = 2400;

/**
 * What a boost gate is worth, MEASURED rather than chosen.
 *
 * Two numbers had to be taken on carve's own hill, because HillBomb's do not
 * transfer at all:
 *
 *   A DETOUR COSTS ~7 m. Measured over 8 s from a fixed start: riding straight
 *   covers 135.9 m, a hard weave covers 117.0 — 18.9 m over about 2.7
 *   out-and-backs. HillBomb measured ~15 m PER SECOND of carving, because their
 *   half-pipe walls bleed hard; carve's REF_TRAVERSE of 0.86 means a carving
 *   rider keeps most of their fall-line progress. Steering here is cheap.
 *
 *   A BOOST OF +2 m/s^2 FOR 3 s IS WORTH 22.9 m, same measurement: 159.4 m
 *   against the 136.5 m baseline. +4 for 3 s is 44.7, +8 for 3 s is 84.1.
 *
 * The boost is a SPEED FLOOR now rather than an added acceleration — see
 * `rider.boost` — and it was re-measured after that change, because the two
 * models are not comparable:
 *
 *   +8 m/s for 3 s   ->  26.7 m, peaking at  86 km/h
 *   +12             ->  46.0 m, peaking at  93
 *   +16             ->  67.7 m, peaking at 103
 *   +22             ->  97.4 m, peaking at 123
 *
 * against a cruise of 80 km/h and a 136.5 m baseline.
 *
 * +16 FOR 3 s. Asked for as "much stronger": the surge from 80 to 103 km/h is
 * the part that is felt, and 67.7 m is about ten times what a detour costs, so
 * a gate is never a trap. +22 was tried and rejected — 97 m a gate across
 * twelve gates is half of a 2400 m race, at which point the race is an
 * inventory of gates rather than a ride.
 *
 * Duration past ~3 s buys almost nothing: +16 for 4 s measured 67.9 m against
 * 67.7. The rider reaches the floor in about a second and drag balances it
 * there, so the gain is in the floor's HEIGHT and not in how long it is held.
 */
const BOOST = {
  addSpeed: 16,
  seconds: 3.0,
  /**
   * Absolute cap, m/s — about 115 km/h. Below `TUNE.maxSpeed` (44, or 158 km/h)
   * on purpose: the floor is set from the speed you arrive at, so without a cap
   * lower than the rider's own limit a chain of gates would walk the whole way
   * up to it. 32 is a shade over the 103 km/h a single gate reaches from cruise,
   * so one gate is unaffected and only a chain is bounded.
   */
  ceiling: 32,
};

/**
 * ── THE CHAIN, WHICH IS HOW YOU GET BACK INTO A RACE ────────────────────────
 *
 * "Currently too hard to come back from mistakes - if I pick up 4 boosters
 * straight without bumping into anything, even when I am late after some bumps,
 * I expect to come back better than now."
 *
 * The reason four gates were worth no more than one is `ceiling`, and it is a
 * one-line diagnosis: the floor is set to min(ceiling, arrival speed + 16), the
 * player cruises at about 28, so ONE gate already lands on 32 and every gate
 * after it lands on 32 as well. Stringing them together bought a longer 32,
 * never a faster one. There was no comeback because there was no reward for the
 * only thing a player behind can actually do.
 *
 * So a clean chain raises the roof. The ceiling climbs by CHAIN_CEIL per
 * consecutive gate and the hold lengthens by CHAIN_SECS, four steps deep:
 *
 *   chain   1      2      3      4      5
 *   ceiling 32.0   33.3   34.6   35.9   37.2   m/s
 *   hold    3.00   3.35   3.70   4.05   4.40   s
 *
 * HALVED from 2.6 per step, asked for as "cool down the cumulative chain, let's
 * say 50%". At 2.6 a full chain reached 42.4 m/s -- 153 km/h against a 115 km/h
 * single gate -- and that was the larger half of why the game got quick.
 *
 * The HOLD is deliberately not halved with it. The complaint is about speed,
 * and the hold is what makes a chain feel like it is paying without making it
 * faster: four gates is still four and a half seconds of held boost instead of
 * three, which is the reward for the riding, at a ceiling only 16% over a
 * single gate rather than 33%.
 *
 * Four clean gates is 143 km/h held for four seconds against 115 for three --
 * a real recovery, and available at any point in the race because it is not
 * conditioned on being behind. It is NOT rubber-banding: it pays for riding,
 * not for losing, and someone already in front gets exactly the same.
 *
 * The chain breaks on CONTACT and on nothing else -- "without bumping into
 * anything" is the rule, so missing a gate keeps what you have built and only
 * a tree, a rock or going off-piste takes it away. That is the version where
 * the recovery is a thing you do rather than a thing you are given.
 *
 * 42.4 stays under TUNE.maxSpeed (44) so the rider's own limit is never the
 * thing that catches it, which is what the ceiling note above is protecting.
 */
const CHAIN_MAX = 5;
const CHAIN_CEIL = 1.3;
const CHAIN_SECS = 0.35;

/**
 * One planned beat in every `KEEP_EVERY` becomes a gate. The other two are
 * DROPPED, not converted.
 *
 * THERE ARE NO SLALOM GATES IN THIS MODE AT ALL. A slalom gate pays score and
 * seconds; this mode has no score worth reading and no clock, so a slalom gate
 * here is furniture asking the player to steer for nothing — and competing for
 * the same glance as the thing that does matter. It is HillBomb's own argument
 * for dropping crystals from their race course, one level further on: "a
 * contest decided by speed should not also be asking you to detour for points".
 *
 * TRIPLED ON REQUEST, from one beat in three to every beat — a gate every
 * 4.08 s rather than every ~12. That changes what the mode IS, and the change
 * is worth stating because it was not obvious from the ask:
 *
 * A boost is +16 m/s held for 3 s, and gates now arrive every 4.08. So a clean
 * line is boosted almost continuously, and `BOOST.ceiling` stops being a guard
 * against a freak chain and becomes THE DESIGN — the race settles at 115 km/h
 * and the skill is not falling off it. Missing a gate or hitting a tree drops
 * you, and the ground you lose is the ground back up to the ceiling.
 *
 * That is a coherent race and a faster, more arcade one than the version it
 * replaced. What it is NOT is the earlier arithmetic, where taking every gate
 * against taking none was worth ~336 m; at this spacing the gap is most of the
 * course, and the ceiling is the only reason it does not run away entirely.
 *
 * The survivors keep their own beat, side and amplitude, because `planGates`
 * solved those against the turn model and nothing about the spacing makes a
 * gate less reachable.
 */
const KEEP_EVERY = 1;

/**
 * Seconds of riding after the line before the run is called.
 *
 * Asked for directly — "give me a few more seconds to keep on surfing before
 * you stop motions" — and it is right for a reason beyond feel: every other
 * ending in this game is a stop (the clock runs out, you are done), but
 * crossing a line at 100 km/h is an ARRIVAL, and cutting the world dead on the
 * frame you reach it throws away the one moment the whole race was for. The
 * rider keeps their speed, their steering and their trail; the race is simply
 * already decided.
 */
/** Seconds of coasting after the line before the run ends. Was 4.5, and the
 *  player sat through their own deceleration -- "start fading in the end
 *  screen much sooner, so I won't see my character stop." 1.2 keeps the
 *  crossing itself as a moment (the line, the plume, one breath of glide) and
 *  the panel is up before the braking animation reads as braking. The time on
 *  the panel is frozen at the line either way -- see crossedAt. */
const RUN_OUT = 1.2;

/**
 * Seconds of the track skipped before the first gate may be planned.
 *
 * "there should be a minimum for first gate since the start. last run the first
 * gate was too close, second one was perfect (as a first gate)." The second gate
 * is one beat further on, so the fix is to begin where that one was.
 *
 * A TIME AND NOT A DISTANCE, which is the opposite of what it looks like it
 * should be. A distance floor was tried first, as `Course.minP`: refuse to
 * place a gate closer than 210 m. It fails, and quietly. Gates are placed
 * against the PREDICTED position, and the pace estimator starts at 16 m/s while
 * the rider is still accelerating — so the first several gates predict short,
 * fall under the floor, and are consumed by the spawner rather than deferred.
 * The measured result was an empty course for the opening stretch.
 *
 * Dropping the BEATS instead cannot do that: the plan simply starts later, and
 * every gate that survives is placed by the same predictor at the same accuracy
 * it always had. It is also what `planGates` already does at the top of a run
 * for exactly this reason — "no gates until the rider is up to speed".
 */
const FIRST_GATE_DELAY = 7;

/**
 * Metres of clear road before the first obstacle tree.
 *
 * The same argument as the first gate, and it needs its own number because the
 * two are placed by different machinery: gates are planned against beats and
 * deferred in TIME, while trees are planted per 40 m band and so are deferred
 * in DISTANCE. A start line with a tree on it is a wipeout nobody could have
 * read, which in a race is ground given away before the first turn.
 *
 * Shorter than the first gate's 147 m on purpose: the opening stretch should
 * ask something of the rider before it starts paying them.
 */
const FIRST_TREE_MIN = 110;

/*
 * THE HOUR THIS RACE IS RUN AT now comes from `places.js`, because it is a
 * property of WHERE you are rather than of the race: a place declares which of
 * the mood's five stops it draws from, and the no-repeat rule that used to live
 * here moved with it so both modes get it.
 */

/** 1-based, so `ORDINALS[1]` is '1st'. A field of four can only reach 5th. */
const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th'];

export default registerMode({
  id: 'race',
  name: 'race',
  tagline: 'four rivals · first to the line',
  /** What the route screen calls what it is choosing. See `setPlaceFor`. */
  routeName: 'Race Route',
  /** The route screen's tutorial line -- plain and instructional by request:
   *  "very simple very clear tutorial explainer texts". */
  explainer: 'Chain speed boosts and race to the finish line.',
  /** First in the lobby — see `listModes`. */
  order: 0,

  /**
   * Its own framing, and it has now diverged hard from chill vibe's 13.0 / 5.9.
   * Set from the dev panel and kept: 4.0 back and 1.9 up is right behind the
   * rider's shoulder and barely above the deck, which is a race camera rather
   * than a landscape one — the mountain stops being the subject and the next
   * hundred metres becomes it.
   *
   * 4.0 is the floor the stepper clamps to, so this is as close as the panel
   * can go. Worth knowing before anyone tries to take it further: `near` is 1.0
   * (README, on why it is not 0.4) and the chase rig keeps `camClearance` above
   * the snow, so there is not much room left underneath this.
   */
  camera: { camBack: 4.0, camUp: 1.9, camLookAhead: 36, camLookUp: 13 },

  /**
   * One track per race, drawn at random, so two races in a row are not the same
   * two and a half minutes. `sunrise_ascent` leads because it is the better
   * grid of the two — quality 4.128 against 1.70 and zero tempo drift against
   * 36.7 — and the whole course is cut from the grid, so a cleaner one puts the
   * gates closer to the beat.
   *
   * ONE ENTRY TODAY, and that is the ask — "take the second music from the
   * other mode as default" — not a limitation of the mechanism. `pickMusic`
   * already draws at random, so adding ids to this line is the whole job when
   * there are more tracks; nothing else changes. `carve_theme` is deliberately
   * NOT here: it is chill vibe's, and a race that played it half the time would
   * not sound like its own mode.
   */
  music: ['sunrise_ascent'],

  /**
   * Seconds into the track the run begins. "i want to start where the bit
   * starts - around 10 - 20 seconds."
   *
   * It costs the first few planned beats, which `_seekTo` fast-forwards past,
   * and that is correct: a gate whose beat has already gone should not be
   * placed. The race is measured in metres, so nothing downstream cares that it
   * began part-way through a track.
   */
  musicStart: 23,

  /**
   * The score and the combo are HIDDEN here, and it is the same argument that
   * removed the slalom gates: this mode is decided by arrival order, so a score
   * has no bearing on whether you are winning. HillBomb's `speedRace` puts it
   * best — "showing a number that has no bearing on whether you are winning is
   * worse than showing nothing: it reads as the thing you are being judged on."
   *
   * Points still accrue underneath. Nothing special-cases the scoring system,
   * so distance and air still bank exactly as they do in chill vibe and a best
   * is still a best; the readout is simply not shown to someone racing.
   */
  hidesScore: true,

  create(game) {
    let finishP = 0;
    let done = false;
    /** Run time the line was crossed, or null. See RUN_OUT. */
    let crossedAt = null;
    /** Finishing place, frozen the moment the player crosses. */
    let placed = null;
    /** BAL-594. Run time player two crossed the line, or null. In two-player
     *  the AI field is gone and the only question is which of the two humans
     *  got there first, so each crossing is stamped and the order IS the
     *  result. Player one's stamp is `crossedAt` above. */
    let crossed2At = null;
    /** Set when the player who has already finished presses `finish the race`
     *  rather than waiting for the other to come down. */
    let calledIt = false;
    /** For the player's down-mountain rate, smoothed — see `update`. */
    let lastP = 0;
    let playerRate = 0;
    /** Consecutive boost gates taken without hitting anything -- ONE PER
     *  PLAYER. A streak is something a person built, so two people racing
     *  side by side cannot share one: player one taking a gate would have
     *  lengthened player two's boost, and player one hitting a tree would
     *  have taken it away again. Index by `who`, as the course's events are.
     *
     *  Player two's streak currently cannot break, because collisions are
     *  tested for player one only -- player two rides through the trees
     *  (BAL-594, reported separately). The shape is right and the asymmetry
     *  disappears the day that lands. */
    const chains = [0, 0];
    /** Planned beats seen so far — see `shapePlan`. */
    let kept = 0;

    return {
      /** See the header. The line ends this, and nothing else does. */
      usesClock: false,

      /**
       * ONE AT RANDOM, not the first. A race is short enough to hear the whole
       * of a track, so hearing the same one every time is how a mode gets old
       * fastest. The picked one plays alone: at 2400 m the race is shorter than
       * a single pass, so it never reaches a hand-over.
       */
      pickMusic(ids) { return [ids[Math.floor(Math.random() * ids.length)]]; },

      /**
       * Keep one planned beat in three and make it a boost gate; drop the rest.
       *
       * The MODE shapes the plan rather than the planner knowing about modes.
       * `planGates` solves beats, sides and reachable amplitudes and all of that
       * is still wanted — this only decides which of its answers are used.
       *
       * The counter lives on the mode instance, which is rebuilt every run, so
       * the pattern is continuous across the segments `_extendCourse` cuts and
       * starts clean on a restart without anything having to reset it.
       */
      shapePlan(entries) {
        const out = [];
        const openAt = (game._musicStart ?? 0) + FIRST_GATE_DELAY;
        for (const e of entries) {
          if (e.t < openAt) continue;
          if (kept++ % KEEP_EVERY !== 0) continue;
          e.kind = 'boost';
          out.push(e);
        }
        return out;
      },

      /** What a boost gate pays. See BOOST. */
      boost: BOOST,

      /**
       * The boost this gate is worth, and the chain it advances.
       *
       * Called by `main.js` on a boost gate instead of reading `boost`
       * directly, so the run owns the streak rather than the constant table.
       */
      takeBoost(who = 0) {
        const chain = chains[who] = Math.min(CHAIN_MAX, chains[who] + 1);
        const step = chain - 1;
        return {
          addSpeed: BOOST.addSpeed,
          seconds: BOOST.seconds + CHAIN_SECS * step,
          ceiling: BOOST.ceiling + CHAIN_CEIL * step,
          chain,
        };
      },

      /** Contact with anything solid. See the note on the chain. */
      breakChain(who = 0) { chains[who] = 0; },

      /**
       * A DIFFERENT 2400 m OF MOUNTAIN EVERY RACE.
       *
       * Nothing here is scored against a fixed benchmark — you are racing the
       * riders beside you and they ride whatever you ride — so the layout is
       * free to change, and it should. HillBomb reached the same conclusion for
       * their race course and put it best: "the whole point of a race is not
       * knowing what is round the next bend."
       *
       * IT COSTS NOTHING TO GENERATE, which is the reason this is possible at
       * all. carve's mountain is analytic and endless — probed sane out to
       * 1,000,000 m — and its character genuinely varies along p: the pitch
       * breathes on 260 m and 95 m periods, the corridor meanders on 220 m and
       * 88 m, and the relief is fbm sampled at 0.0072. So a race 12 km further
       * down is a different hill, not the same hill re-rolled, and no seed, no
       * regeneration and no rebuild is involved. The scatter and pickup bands
       * are pure functions of the band index, so the trees move with it.
       *
       * 40 km of range, which is sixteen non-overlapping races and far more
       * than that in character. Kept well under the ~500 km where world-space
       * float32 starts losing the carve trench — measured when the descent
       * became endless.
       *
       * CHILL VIBE DELIBERATELY DOES NOT DO THIS. Its score is kept as a best
       * and compared across runs, so it needs the same mountain every time;
       * a race is compared only against the four riders on it.
       */
      courseOffset(place) { return pickOffset(place); },

      start() {
        finishP = game.rider.p + RACE_LENGTH;
        // Published so the second half can show its own metres-to-go. The
        // mode owns the line; everyone else should read it rather than
        // keep a second copy that can drift.
        game.finishP = finishP;
        game.pickups.setEnabled(false);
        game.finishLine.place(game.terrain, finishP);
        // No gates past the line — see `Course.limitP`. A little short of it,
        // so a gate never straddles the banner.
        game.course.limitP = finishP - 40;
        // Gates on the hill from far enough out to be ridden TOWARD rather than
        // arrived at — see `Course.spawnLead`. Nine seconds is about 270 m at
        // race speed, just inside the 280 m the renderer draws to.
        game.course.spawnLead = 9;
        // TREES ON THE LINE — the blockers. Off in chill vibe, where being
        // stopped dead charges the only resource a run has; here the cost is
        // ground lost to four riders who went round, which is what an obstacle
        // should cost.
        game.scatter.obstacles = true;
        game.scatter.obstacleFromP = game.rider.p + FIRST_TREE_MIN;
        game.scatter.reset(game.rider.p);
        game.course.isBlocked = (p, u) => game.scatter.blocksGate(p, u);
        // THE FIELD. Spawned after the rider is at its starting distance, so
        // they stage on the same line the player does.
        // ── THE HOUR IS FIXED FOR THE RUN, AND DRAWN FOR EACH ONE ────────
        // "In this mode the hour and weather should not change during the run
        // - but will differentiate one run from the other."
        //
        // Chill vibe walks the mood with the music, dawn to alpenglow and round
        // again, because an endless descent needs somewhere to go. A race is
        // two and a half minutes against four riders: the light changing under
        // it is one more thing moving that nobody asked to move, and it makes
        // two races of the same course look like different places for no reason
        // the player can act on.
        //
        // `_moodPin` already exists for the dev panel, and pinning it is
        // exactly this. Drawn fresh per run, so the hill you get is part of
        // what makes one race not the last one -- the same argument as
        // `courseOffset`.
        //
        // Applied IMMEDIATELY as well as pinned: `setProgress` is called from
        // the play frame, which does not run during the countdown, so without
        // this the start line would sit in the previous run's light and snap
        // over on the first frame of the race.
        game._moodPin = pickHour(game._place);
        game.mood.setProgress(game._moodPin);

        // PLAYER TWO REPLACES THE FIELD. Elad's call: a two-player race is
        // 1v1, not two humans in a crowd of four computers. Spawning them and
        // hiding them would still cost the geometry, which is the one budget
        // split screen actually spends.
        if (game.rider2) game.rivals.despawn();
        else game.rivals.spawn(game.rider.p);
        lastP = game.rider.p;
        playerRate = 0;
        // `chains`, PLURAL AND BY INDEX. This read `chain = 0` -- a leftover
        // from before the streak was split per player (BAL-594), naming a
        // variable that has not existed since. carve never noticed: its bundle
        // is `format: 'iife'` (build.mjs), so the assignment ran in sloppy mode
        // and quietly created a global nobody reads, and `create()` is called
        // fresh per run so the state it meant to reset was already [0, 0].
        // Dead code, harmless, invisible.
        //
        // This game ships ES modules, and a module is ALWAYS strict -- so the
        // same line is a ReferenceError that killed every race before the
        // countdown. Nothing was wrong with the logic; the port simply moved it
        // somewhere the mistake is fatal instead of free.
        chains[0] = chains[1] = 0;
        placed = null;
        done = false;
        crossedAt = null;
        game.p1FinishT = null;
        game.p2FinishT = null;
        // Last race's frozen distances, gone with the rest of the result --
        // a stale one would be shown as this race's near miss.
        game.p1ToGo = null;
        game.p2ToGo = null;
      },

      /**
       * The rivals move with the world, AFTER it — `update` is called once the
       * player's frame is integrated, so a place read here is a place against
       * where the player actually is this frame rather than last.
       */
      update(dt) {
        // Handed the same course the player is riding: the trees they have to
        // read, and the gates they can take. See `rivals.js` -- a field that
        // rode through trunks and could not answer a boost was the report.
        // The player's own DOWN-MOUNTAIN rate, which is not `rider.speed` --
        // that is measured along the board and runs about 8% higher. The field
        // is capped to this off the line, so it is the number they need.
        const rate = dt > 0 ? (game.rider.p - lastP) / dt : 0;
        lastP = game.rider.p;
        playerRate += (rate - playerRate) * Math.min(1, dt * 4);
        if (game.rider2) {
          // ── 1v1 ───────────────────────────────────────────────────────
          // No field to place against: the whole contest is the two of them.
          // Stamp player two's crossing here, where the rate is already being
          // tracked, so the order survives the run-out either rider is in.
          if (crossed2At === null && game.rider2.p >= finishP) {
            crossed2At = game.runTime;
            game.p2Finished = true;
            game.p2FinishT = crossed2At;
          }
          // Ahead by crossing order if both are home, otherwise by ground.
          const oneFirst = crossedAt !== null && (crossed2At === null || crossedAt <= crossed2At);
          const twoFirst = crossed2At !== null && (crossedAt === null || crossed2At < crossedAt);
          const lead = oneFirst ? 1 : twoFirst ? 2 : (game.rider.p >= game.rider2.p ? 1 : 2);
          game.p1Place = lead === 1 ? 1 : 2;
          game.p2Place = lead === 1 ? 2 : 1;
          game.hud.setPlace(ORDINALS[game.p1Place] ?? '—');
        } else {
          game.rivals.update(dt, game.rider.p, game.runTime, finishP,
            { scatter: game.scatter, gates: game.course.live, playerRate });
          // FROZEN AT THE LINE. Past the finish the player coasts through
          // RUN_OUT seconds of run-out, and a placing that kept moving during
          // it would let the race be won or lost after it was over.
          if (placed === null && crossedAt !== null) placed = game.rivals.placeOf(game.rider.p, crossedAt);
          // Live while racing, frozen once crossed — the same number either way.
          const now = placed ?? game.rivals.placeOf(game.rider.p);
          game.hud.setPlace(ORDINALS[now] ?? '—');
        }
      },

      /** Metres still to run — what the HUD reads instead of a clock. */
      toGo() {
        return Math.max(0, finishP - game.rider.p);
      },

      progress() {
        return 1 - this.toGo() / RACE_LENGTH;
      },

      /**
       * Metres to the line, in the slot chill vibe puts its clock in. `warn` and
       * `critical` are borrowed as "nearly home" rather than "nearly dead" —
       * the same urgency, earned the opposite way round.
       */
      readout() {
        // Past the line the metres are meaningless and zero is a lie — the
        // number becomes the word, and the bar sits full.
        if (crossedAt !== null) {
          const ord = placed ? ORDINALS[placed] : 'finish';
          return { text: ord, unit: '', fraction: 1, low: false };
        }
        const togo = this.toGo();
        return {
          text: togo >= 1000 ? (togo / 1000).toFixed(1) : String(Math.round(togo)),
          unit: togo >= 1000 ? 'km' : 'm',
          fraction: this.progress(),
          low: togo < RACE_LENGTH * 0.12,
        };
      },

      /** The finished player chose not to wait. Routed through the SAME
       *  ending the line would have reached, so there is no second path for
       *  the results screen to drift between (Skateboard Extreme's rule). */
      callIt() {
        calledIt = true; game.endedBy = 'called';
        // HOW FAR EACH ONE STILL HAD, AT THE TAP (BAL-622). The results card
        // shows this to whoever was still riding, and it has to be the number
        // their own TO FINISH was showing when the race was taken away from
        // them -- read a frame or two later, after their last integration, it
        // would be a few metres short of what they saw.
        game.p1ToGo = Math.max(0, finishP - game.rider.p);
        game.p2ToGo = game.rider2 ? Math.max(0, finishP - game.rider2.p) : null;
      },

      /** How this race ended: run to the line, or called by the winner while
       *  the other was still out there. Only meaningful in two-player. */
      endedBy() { return calledIt ? 'called' : 'line'; },

      ended() {
        if (done) return null;
        // ── THE CALL ENDS THE RACE, WHICHEVER HALF MADE IT ────────────────
        // This was below the "has player one crossed?" gate, so when PLAYER
        // TWO finished first and pressed their button, the gate returned
        // early on player one still being out there and the call was thrown
        // away. The button registered the press and nothing happened, which
        // from the lower half of the screen is indistinguishable from a
        // button that cannot be pressed -- which is exactly how it was
        // reported from a device, 2026-10-15.
        //
        // crossedAt is PLAYER ONE's crossing. Nothing below it may be read as
        // "somebody has finished": player two's is crossed2At and it is kept
        // independently, further up.
        //
        // No run-out wait on a call. The label says end the race now, the
        // player has already watched their own run-out, and the only thing a
        // delay would buy is a button that looks broken for another second.
        if (calledIt) { done = true; return 'finish'; }
        if (crossedAt === null) {
          if (game.rider.p < finishP) return null;
          crossedAt = game.runTime;
          game.p1Finished = true;
          game.p1FinishT = crossedAt;
          game.hud.callout('finish', { big: true, color: '#9ff4ff' });
          game.audio.settle();
          game.host.haptic('success');
          return null;
        }
        // ── TWO PLAYERS: THE RACE IS NOT OVER WHEN THE WINNER IS ──────────
        // The other one keeps riding, which is Elad's call and the whole
        // reason the finisher gets a button. The run ends when BOTH are home
        // (each having had their run-out) or when the finisher calls it.
        // calledIt is handled above, so this is the ordinary both-home path.
        if (game.rider2) {
          if (crossed2At === null) return null;
          if (game.runTime - Math.max(crossedAt, crossed2At) < RUN_OUT) return null;
        } else if (game.runTime - crossedAt < RUN_OUT) {
          return null;
        }
        done = true;
        return 'finish';
      },

      /** True once the line is behind you and the run-out is playing. */
      crossed() { return crossedAt !== null; },

      results() {
        const ord = ORDINALS[placed ?? 5];
        // The run time AT THE LINE, not when the panel came up -- there are
        // RUN_OUT seconds of coasting after the finish and none of them are
        // part of the race.
        const t = crossedAt ?? game.runTime;
        const mm = Math.floor(t / 60);
        const ss = t - mm * 60;
        return {
          // ── WHAT A RACE RESULT ACTUALLY IS ────────────────────────────
          // Reported as "D won 38,54 in competition mode - makes no sense".
          // Three readouts and all three belonged to the other mode: D is the
          // endless descent's letter grade, 3,854 is its distance score, and
          // neither answers the only two questions a race asks -- where did I
          // come, and how long did it take.
          //
          // So the placing takes the big rank slot it is the right shape for,
          // the TIME takes the number slot, and the title says whether that
          // placing was a win.
          // READ TOGETHER WITH THE RANK ABOVE IT: "1st" then "place". The
          // title was 'won' or 'finished', which made the two lines say the
          // same thing twice for a win and disagree about what they were
          // describing for anything else. It is one phrase split across two
          // sizes, so it says the same word every time and the placing above
          // it carries the news.
          title: 'place',
          rank: ord,
          headline: `${mm}:${ss < 10 ? '0' : ''}${ss.toFixed(1)}`,
          // No `earned`: there is no clock in this mode to earn into, and
          // reporting 0 of a currency that does not exist reads as a fault.
          run: { distance: game.distance },
        };
      },

      stop() {
        game.course.limitP = Infinity;
        // The light goes back to walking with the music for chill vibe.
        game._moodPin = null;
        game.course.spawnLead = SPAWN_LEAD_DEFAULT;
        game.course.isBlocked = null;
        game.scatter.obstacles = false;
        game.scatter.obstacleFromP = -Infinity;
        // The mode's things belong to the run. A finish line left standing
        // would turn up in a chill vibe descent, where there is nothing to
        // finish, and the motes would stay switched off for good.
        game.finishLine.hide();
        // Four skinned rigs left standing would turn up in the middle of a
        // chill vibe descent, which is the exact thing `stop()` exists for.
        game.rivals.despawn();
        game.pickups.setEnabled(true);
      },
    };
  },
});
