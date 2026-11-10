// SKIRMISH — the hill shoots back.
//
// The third mode, and the first one whose rules are about something other than
// how far or how fast. Chill vibe is a clock, race is a line, THIS IS A FIGHT.
// Those three sentences are the whole mode table and none of them needs a
// second one.
//
// ── NO CLOCK, AND HEALTH IN ITS PLACE ──────────────────────────────────────
//
// The clock is what ends a chill vibe run and the line is what ends a race.
// Here it is health, and the swap is deliberately one-for-one rather than an
// addition: a mode with both a clock and health has two independent ways to
// lose, which means neither of them is ever the thing the player is actually
// managing. It also frees the most valuable piece of HUD in the game — the
// centre of the top edge, where chill vibe's countdown lives — for the bar,
// so a player arriving from chill vibe already knows where to look for "the
// resource that is running out".
//
// DEAD IS DEAD. No lives, no respawn, no regeneration. Elad's call, and the
// consequence to be honest about is the one he was shown when he made it: a
// bad early stretch can end a run in twenty seconds. The defence is not a
// safety net, it is that the mode is lost by NOT FIGHTING — see the range
// note below — so the player who is taking damage always has something they
// could have done about it.
//
// ── A WIPEOUT STILL COSTS SPEED AND GROUND, AND NOT HEALTH ─────────────────
//
// Also Elad's call, and the stronger half of the reason is a rule this project
// has held through every pass: DIFFICULTY DOES NOT MOVE INSIDE A FEATURE.
// `TREE_R`, the tree density, the clumping and the reach were tuned against a
// clock that this mode does not have. Charging health for a crash would be a
// balance change to the terrain smuggled in under a combat mode, and it would
// be invisible — nothing in the diff would say "the forest got harder".
//
// It also keeps two languages separate, which is worth more than the tidiness
// of one pool: the terrain punishes your LINE, the drones punish your FIGHT.
// A player who is dying can tell which one is killing them.
//
// ── WHY THE FIGHT IS WINNABLE: YOU OUTRANGE THEM ───────────────────────────
//
// A ninja star reaches 86 m and a drone's bolt reaches 58. The twenty-eight
// metres between those numbers is the mode. A drone killed while you close
// through that band never fires; a drone still alive when you enter its reach
// starts shooting. So the skill is the one this game already asks for and not
// a new one — acquire early and HOLD THE HEADING through the approach, which
// is a commitment of line paid in exactly the currency every gate and every
// mote is paid in.
//
// A drone takes three stars and the default fires every 0.36 s, so killing one
// on the approach takes about a second of being pointed at it. That is why the
// squads are thinned here (`density`): four drones at chill vibe's spacing
// cannot all be cleared in the window, and a mode whose correct play is
// impossible is a mode that teaches nothing.
//
// ── WHAT THE GATES DO HERE ─────────────────────────────────────────────────
//
// One gate in five is a POWER GATE (cyan, see `course.js`), which hands over a
// timed weapon. `keen` — three times the damage, so a drone dies on the first
// hit instead of the third — or, less often, `storm`, which throws three at
// once in a fan AND gives a speed boost. The step from 1 to 3 damage is a
// change of KIND and not of degree, which is the only kind of power-up worth
// building: the squad that was a problem becomes a sweep.
//
// The rest of the gates stay a slalom and keep paying score. There is no time
// to pay, so nothing in this mode pays time.
//
// ── AND IT IS WRITTEN FOR A FIGHT THAT IS NOT ALL PLAYERS ──────────────────
//
// Nothing in this file names `rider`. It reads `game.roster`, which is a list
// of Fighters — see `fighters.js` for why that exists before it is needed. The
// AI competitors and PVP arrive as entries in that list with different team
// labels, and the two places this mode would have to change for either are
// `ended()` (whose health ends the run) and `results()` (what the card says).
// Both are already written against the roster rather than against a player.

import { setChannel } from '../mountain.js';
import { registerMode } from './mode.js';
import { TEAM } from '../fighters.js';
import { rollGift, SHIELD_SECONDS } from '../weapons.js';

/**
 * ONE GATE IN FIVE, where chill vibe promotes one in seven to a boost.
 *
 * More often than chill vibe's boosts because a power here is the only answer
 * the player has to a squad they cannot out-shoot, and a mode where the answer
 * shows up every half minute is a mode where most squads are simply endured.
 * Not so often that the default weapon stops being the weapon: at one in five
 * and fourteen seconds a power, a run is roughly a third powered.
 */
const POWER_EVERY = 5;

/**
 * THINNER THAN CHILL VIBE'S HILL, at 0.72 of the squad chance.
 *
 * Measured against the range band rather than chosen: at full density a squad
 * arrives every ~113 m, which at 30 m/s is every 3.8 s, and a four-drone
 * chevron takes about 3 s of sustained aim to clear with the default weapon.
 * That leaves no frame of the run in which the player is not already behind,
 * and a fight with no gaps in it is not a fight, it is weather.
 *
 * 0.72 puts a squad every ~157 m, or 5.2 s. The gap is the part that makes the
 * engagements read as engagements.
 */
const DENSITY = 0.72;

/** Three stars from the default weapon, one from either power. */
const DRONE_HP = 3;

/**
 * THE RULES, SEPARATED FROM THE REGISTRATION.
 *
 * `modes/shoulder.js` is the same fight seen through a different camera, and
 * it reuses this rather than copying it. That is not tidiness: the numbers in
 * this file — the density, the drone health, the gate cadence, the health
 * economy — were each solved against a measurement, and two copies of them is
 * two things to re-derive the next time one moves. A mode that genuinely wants
 * different RULES should write them; a mode that wants a different CAMERA
 * should not have to.
 */
export function skirmishRules(game) {
  return BASE_CREATE(game);
}

export default registerMode({
  id: 'skirmish',
  /**
   * Parked, and this is the one worth being careful about: `shoulder` IMPORTS
   * this mode's rules rather than copying them, so hiding it from the lobby
   * does not take it out of the game -- it is still what the shards are
   * played by. See `skirmishRules`.
   */
  hidden: true,
  name: 'skirmish',
  tagline: 'they shoot back · stay alive',
  routeName: 'Route',
  explainer: 'Point the board at a drone and your stars fly. Ride through cyan gates for a stronger throw!',
  order: 3,

  /** The race's close chase, which is what both other modes settled on. */
  camera: { camBack: 4.0, camUp: 1.9, camLookAhead: 36, camLookUp: 13 },

  music: ['sewer_steel_a', 'foot_clan_a', 'sewer_steel_b', 'foot_clan_b'],

  skirt: 0.22,

  /** No line to start behind. */
  showsStartLine: false,

  /**
   * NOTHING HERE PAYS TIME, so nothing here is a time gate.
   *
   * The drift lines keep their look and change their currency instead — see
   * `pickupsPay`. "I do like the look of the gates that are adding time and
   * the mote pickups that are adding time; we should remove them completely
   * from this mode and add new ones in the same look, because the glowing look
   * is good."
   */
  timeGates: false,

  /**
   * THE GLOWING MOTES PAY HEALTH HERE.
   *
   * A declarative flag on the DEFINITION rather than a method on the instance,
   * which is the established shape for this sort of thing in this file —
   * `timeGates`, `skirt` and `showsStartLine` are all read off the definition
   * by `main.js`. It is also the trap that has caught this project twice: a
   * copy on the instance is simply never seen, and the symptom is a feature
   * that silently does nothing.
   */
  pickupsPay: 'health',

  create: BASE_CREATE,
});

function BASE_CREATE(game) {
    let seen = 0;
    let downAt = null;

    return {
      /** THE WHOLE DISTINCTION. See the header. */
      usesClock: false,

      /**
       * The same ground every time, for chill vibe's reason: this mode is
       * scored and compared across runs, so a random offset would make a best
       * score a statement about which stretch you happened to draw.
       */
      courseOffset(place) { return place.offset[0]; },

      start() {
        downAt = null;
        seen = 0;
        game.roster.reset();
        game.combat.setEnabled(true);
        // THE RULES GO ON BEFORE THE RING IS BUILT, which is why `reset` takes
        // the rider's p: `droneHp` and `density` are both baked into a band at
        // build time, so a mode that set them without replacing what is
        // already on the hill would get one stretch of the previous mode's.
        /**
         * ── THE DRONES NO LONGER SHOOT BACK ───────────────────────────────
         *
         * `hostile: false`. Asked for directly, and it is the end of a line of
         * evidence rather than a whim, so it is worth recording why the half
         * of this mode that fired bolts is being switched off rather than
         * tuned again.
         *
         * It was measured eight ways. Guided bolts made movement pointless;
         * straight bolts with a lead made movement actively WORSE than holding
         * the fall line, because carving costs speed and a slower target is
         * what an imperfect lead fits. A committed telegraph -- the gun freezing
         * its aim a second ahead and drawing the line it will fire down -- was
         * built to make the dodge real, and the dodge still lost. The board
         * reverses a carve in 0.72 s and crosses at 6.2 m/s; against a bolt
         * with a 1.9 m hit radius there was never enough room.
         *
         * So incoming fire in this mode was damage with no answer. The
         * BARRIERS are the answer -- a hazard that does not chase, that you
         * beat outright by reading it, which is the thing the mode never had.
         * The drones stay: they are targets, and shooting them is the other
         * half of the loop. They simply stop being weather.
         *
         * NOTHING IS DELETED. `hostile` is the flag the whole firing path
         * already hangs on, the telegraph and the aim-commit live on in
         * combat.js, and turning this back to `true` restores all of it.
         */
        game.combat.setRules(
          { hostile: false, droneHp: DRONE_HP, density: DENSITY },
          game.rider.p,
        );
        // THE ONLY WAY HEALTH COMES BACK. Dead is dead and nothing
        // regenerates, so without kits the length of a run is fixed before it
        // starts: a hundred points against six-point bolts is sixteen hits
        // whatever the player does. See `medkits.js`.
        game.medkits.setEnabled(true);
        game.medkits.reset(game.rider.p);
        /**
         * AND THE ABILITIES, which on a level with gates are a second way to
         * get one and on a level without them are the only way. See
         * `boons.js`: they hang in open air, so they work identically whether
         * the ground under them is drawn, hidden or holographic.
         *
         * ON IN BOTH MODES rather than only in the experimental one. A boon is
         * not a workaround for a missing gate -- it is a pickup you have to
         * actually go to, where a gate is a line you ride, and the mode is
         * better for having both asks in it.
         */
        game.boons.setEnabled(true);
        game.boons.reset(game.rider.p);
        /**
         * BEAM CURTAINS, and they are the point of the fight now rather than
         * decoration on it. See `beams.js`: the drones chase, and a threat
         * that chases a board this slow laterally cannot be dodged, so the
         * mode had pressure with no answer. A curtain with a hole in it is the
         * answer, and it is the only hazard here the player can beat outright.
         */
        /**
         * NARROW THE WORLD FIRST, then place the curtains in it -- `beams.js`
         * spans every curtain to `channelHalf()`, so the channel has to be set
         * before the first band is built or the opening curtains are the width
         * of the old corridor.
         *
         * 20 m each side. The gap is 9 m wide and the board crosses at
         * 6.2 m/s, so the worst case -- hole hard against one wall, rider hard
         * against the other -- is about six seconds of travel, against a
         * curtain that is visible from 170 m out. Wide enough to have to
         * commit, narrow enough that committing is always possible.
         */
        /**
         * ── THE GATES, CLEARED FOR REAL ───────────────────────────────────
         *
         * `shapePlan` below is the designed seam and it is kept, but on its
         * own it does NOT empty this run: main re-plans and shapes the course
         * in its run-reset, which plays out before the mode object exists, so
         * `this._mode?.shapePlan` is read off a mode that is not there yet and
         * the full 93-gate plan survives into the first descent. Measured --
         * gates were still spawning with `shapePlan` returning [].
         *
         * So the plan is emptied HERE, where the mode is demonstrably alive,
         * and `course.reset` retires everything already standing on the hill.
         * Both are needed: the empty plan stops new gates, the reset removes
         * the ones placed before this ran.
         */
        /**
         * ── NO GATES IN THIS MODE ─────────────────────────────────────────
         *
         * Asked for: "remove all those legacy gates". See `_place` in
         * course.js for why this is a switch rather than an empty plan.
         *
         * WHY THEY HAD TO GO, beyond being asked. They were inherited
         * furniture from a timed descent -- they pay a clock this mode does
         * not run, and their slalom is placed to a beat grid for a game about
         * rhythm. Worse, a gate is a DOORWAY: two uprights with a space
         * between them, which is now exactly the shape of a BARRIER, the one
         * thing here you must not ride through. Two doorways meaning opposite
         * things is not difficulty, it is a contradiction, and it was already
         * costing runs -- it is what "there are some gates, when I pass
         * through them the run ends" turned out to be.
         *
         * The power gates went with them. Abilities come from boons now, which
         * are flown to rather than lined up with, and that is the better ask.
         */
        game.course.setGatesOff(true);

        setChannel(20);
        game.beams.setEnabled(true);
        game.beams.reset(game.rider.p);
        /**
         * AND THE SQUADS BECOME FENCES. See `fields.js`. This is what gives a
         * drone formation teeth now that it does not shoot: the pods string
         * light between themselves, and the way through is either the gap the
         * chevron left you or the one you shoot.
         */
        /**
         * EVERY POD RAKES A BEAM DOWN TO THE SNOW, and what the player reads
         * is the scorch it lands in. See `fields.js`.
         *
         * 'fence' is the other style and it is kept whole -- a panel between
         * each pair of pods, with the gun able to drop a section by killing a
         * post. It works, and it is the best use this mode has found for
         * shooting; it is parked because with barriers already standing across
         * the course it arrived as a second wall in the same sentence and read
         * as confusion rather than as two mechanics. Swap this one word back
         * to try it again.
         */
        game.fields.setStyle('bars');
        game.fields.setEnabled(true);
        game.fields.reset();
        game.hud.showHealth(true, game.roster.length);
        game.hud.healthNames(game._playerNames?.() ?? ['Player 1', 'Player 2']);
      },

      pickMusic(ids) { return ids; },

      /**
       * ONE GATE IN FIVE IS A POWER GATE, and the rest stay a slalom.
       *
       * The same shape chill vibe uses to promote a boost: keep every beat and
       * promote a few, which is the difference between a course made of power
       * gates and a course with power gates in it.
       */
      shapePlan(entries) {
        for (const e of entries) {
          if (seen++ % POWER_EVERY !== POWER_EVERY - 1) continue;
          e.kind = 'power';
          // WHICH POWER, HERE, AND THAT IS THE WHOLE OF "THE GATES SHOULD BE
          // CLEAR WHAT THEY GIVE ME".
          //
          // It used to be rolled when the gate was taken, which is the obvious
          // place and the wrong one: a payload that does not exist until
          // contact cannot be drawn on an object the player is reading from
          // sixty metres away. Deciding it in the plan costs nothing and lets
          // `course.js` hang the right legend on the right gate.
          //
          // DRAWN FROM THE GATE ITSELF, not from Math.random, so a given gate
          // on a given seed always offers the same thing — a stretch re-ridden
          // is the same stretch, the way every other placement in this game
          // already is, and the two players in a split screen are offered the
          // same thing by the same gate, which a shared random stream could
          // not guarantee and which would read as the game cheating one of
          // them.
          //
          // `beat` AND `t`, NOT `p`. A plan entry is {t, beat, side, u,
          // spacing} — IT HAS NO `p`. The first cut hashed `e.p`, which is
          // undefined, so `Math.round(undefined * 100) | 0` was 0 for every
          // gate on the mountain and all seventeen rolled the same payload.
          // The symptom looked like a bad generator and two rounds were spent
          // on the hash before the input was checked; the harness found it
          // because it asserts that BOTH powers occur, which is the kind of
          // claim a feature like this has to make about itself.
          //
          // `beat` is the gate's index and restarts each lap, so `t` — the
          // reference run's time, which does not — is mixed in with it.
          //
          // An integer hash rather than fract(sin(x)): gates are placed on a
          // rhythm, so their inputs are near-regularly spaced, and a sine
          // sampled on a regular lattice aliases.
          let h = (e.beat | 0) ^ Math.imul(Math.round((e.t ?? 0) * 1000) | 0, 0x9e3779b1);
          h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
          h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
          h ^= h >>> 15;
          e.power = rollGift((h >>> 0) / 4294967296);
        }
        return entries;
      },

      /**
       * The storm's speed boost comes off its weapon row, not from here — see
       * `weapons.js`. This is what a plain boost would be worth if a gate ever
       * handed one out, and it is chill vibe's own numbers so that a boost
       * means one thing in this game and not two.
       */
      boost: { addSpeed: 12, seconds: 2.4, ceiling: 30 },

      update() {
        // THE HUD IS DRIVEN FROM HERE and not from the frame loop, because
        // whether this mode has a health bar at all is a rule. A frame loop
        // that drew health for every mode would need to know which modes have
        // it, which is the mode table leaking into the renderer.
        for (const f of game.roster) {
          const w = f.gun;
          game.hud.health(f.slot, f.health, {
            weapon: f.powerLeft > 0 ? w.label : null,
            powerLeft: f.powerLeft,
            powerFull: w.duration ?? 1,
            shieldLeft: f.shieldLeft,
            shieldFull: SHIELD_SECONDS,
          });
        }
      },

      /**
       * WHOSE HEALTH ENDS THE RUN.
       *
       * Everyone on the crew being down, which in one player is the one
       * player and in two is both. NOT the first to fall: a split screen that
       * cut to results the moment one rider died would end the other's run
       * mid-corner for something they did not do.
       *
       * This is one of the two methods a PVP match would change, and it is
       * already written against the roster rather than against a rider: there
       * it would ask whether one SIDE is down rather than whether the crew is.
       */
      ended() {
        if (game.roster.aliveCount(TEAM.CREW) > 0) return null;
        // A beat before the card, so the fall, the sound and the last bolt
        // all land before the screen changes. Without it the results panel
        // arrives on the same frame as the hit that caused it and the player
        // never sees what killed them.
        if (downAt === null) downAt = game.runTime ?? 0;
        return (game.runTime ?? 0) - downAt > 1.1 ? 'down' : null;
      },

      results() {
        const c = game.combat.stats;
        const acc = c.shots > 0 ? Math.round((c.kills * DRONE_HP / c.shots) * 100) : 0;
        return {
          title: 'you went down',
          headline: `${c.kills}`,
          headlineUnit: 'drones',
          showRank: false,
          summary: `${(game.distance / 1000).toFixed(2)} km ridden — `
            + `${Math.round(game.score).toLocaleString('en-US')} points — `
            + `${acc}% of stars on target`,
          statsRow: false,
          run: { distance: game.distance, kills: c.kills, sweeps: c.sweeps,
            healed: game.medkits.stats.healed },
        };
      },

      stop() {
        // PUT THE HILL BACK. A mode that leaves its rules on gives them to the
        // next run, and the next run may be chill vibe — where a drone that
        // shoots back and takes three hits is a balance change nobody asked
        // for. This is the one hook `mode.js` says is not optional.
        game.combat.setRules({ hostile: false, droneHp: 1, density: 1 });
        // GIVEN BACK, like the channel below -- the course is shared, and a
        // mode that left gates off would hand the next run a silent hill.
        game.course.setGatesOff(false);
        game.medkits.setEnabled(false);
        game.boons.setEnabled(false);
        game.beams.setEnabled(false);
        game.fields.setEnabled(false);
        // THE CLAMP IS GLOBAL, so it has to be given back. A mode that left it
        // narrowed would hand the next run a 40 m corridor with nothing drawn
        // at the edges of it -- an invisible wall, which is the exact thing
        // the walls were added to stop existing.
        setChannel(Infinity);
        game.hud.showHealth(false);
        game.roster.reset();
      },
    };
}
