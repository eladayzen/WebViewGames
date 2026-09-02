// AI SKATERS -- the field you compete against in the rivals mode.
//
// They are CLONES OF THE PLAYER'S RIG, not a second art path: same mesh, same
// skeleton, same idle clip, tinted per jersey. That costs more than the tinted
// billboard this started as, and it is worth it -- a billboard of a standing
// character with no board read as a pedestrian on the road the moment you got
// close to one. It also means the character only has to be authored once.
//
// THEY DO NOT RUN THE PLAYER'S CONTROLLER. That was considered and rejected on
// purpose: the controller is one system tuned around a human on a balance board,
// and driving a rival through it would need a synthetic input stream -- carve,
// tuck and brake per frame -- which is a harder AI problem than the one being
// solved, and would make every feel constant a constraint on the AI as well.
// What a rival needs is to be BELIEVABLE: the right pace, a plausible line, and
// points earned from the same things the player earns them from. So the LOOK is
// shared and the physics is a much simpler model borrowing the same grade and
// drag numbers.
//
// PERSONALITY IS A SEED, NOT A SCRIPT. Pace, weave and skill all come from the
// rival's index, so the field spreads out on its own and the same rival is
// recognisably the same rival every run.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toWorld, surfaceUp, frameAt, makeFrame, radiusAt } from '../world/trough.js';
import { TERRAIN } from '../data/terrain.js';
import { SPEED_REF, NATURAL_TOP_SPEED } from '../data/constants.js';

/** Distinct, high-contrast jerseys. The player is RED, so none of these are. */
const JERSEYS = [
  { name: 'ACE', colour: 0x6fd0ff },
  { name: 'NOVA', colour: 0x7ef0a8 },
  { name: 'RIFF', colour: 0xffd166 },
  { name: 'ZED', colour: 0xc98cff },
  { name: 'KIT', colour: 0xff9f5a },
];

/**
 * Deterministic 0..1 from a pad's position and a rival's index. Used so a rival
 * MISSES pads at a rate set by its skill -- but misses the same ones every run,
 * so a rival stays the character it was rather than being re-rolled each time.
 */
function hash01(a, b) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}


/**
 * How much further over the player a BOOSTED rival may go, on top of the
 * ordinary correction.
 *
 * CUT FROM 5, and this was the leak that kept first place out of reach. The
 * headroom only applies to a rival that is BEHIND its station -- which is
 * exactly the situation when the player is winning. So every gate a rival took
 * while losing paid it +5 u/s for three seconds, about 16 m clawed straight
 * back off the lead the player had just earned. Measured with it: nine gates
 * and a single crash still finished 2nd.
 *
 * At 1.8 a rival's gate is still visible -- they close, and you can see them
 * closing -- but it no longer erases a gate the player took.
 */
const BOOST_HEADROOM = 1.8;

/**
 * The most a rival may run OVER the player's pace while closing a gap -- a
 * third of the band. See the asymmetry note in update(): being outridden is not
 * a fault to correct, it is the player winning.
 */
/**
 * How far a rival may bend its own pace to stay near the player, as a fraction.
 * Wide enough that an ordinary run has company; narrow enough that a good run
 * escapes and a bad one is left.
 */
const PACE_BAND = 0.16;

/**
 * How much of that band a rival may spend CHASING, against all of it for
 * holding back. See the asymmetry note in update().
 */
const CHASE_SHARE = 0.35;

/**
 * THE HARD LIMIT ON HOW FAST A RIVAL CAN CROSS THE ROAD, in radians per second.
 *
 * Measured off the player: holding FULL carve, a rider's peak lateral rate is
 * 0.61 rad/s. The rivals had no limit at all -- they eased toward a target at
 * 2.4x the remaining distance every frame, which across a wide swing is up to
 * 3.6 rad/s, roughly SIX TIMES what a human on the board can do. Amit: "their
 * movement is not realistic, they just move super fast and hit the speed
 * collectables."
 *
 * So they are capped BELOW the player rather than at parity. A rival should
 * never out-steer you: if one takes a pad you both wanted, it should be because
 * they had the better line coming in, not because they crossed the road in a
 * way you cannot.
 */
const RIVAL_TURN_MAX = 0.52;

/**
 * How fast that rate itself may change. A rival with an instant turn rate still
 * darts -- it just darts at a legal speed. This is the board's inertia: they
 * have to lean into a turn and back out of it, which is what makes a line read
 * as ridden rather than plotted.
 */
const RIVAL_TURN_ACCEL = 2.2;

export function createRivals(scene, rider) {
  const group = new THREE.Group();
  scene.add(group);

  /** @type {Array<object>} */
  let field = [];
  /** For deriving the player's pace -- see update(). */
  let lastPlayerS = 0;
  let playerSpeed = SPEED_REF;
  const _pos = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _basis = new THREE.Matrix4();
  const _frame = makeFrame();

  function makeBoard() {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.06, 1.15),
      new THREE.MeshBasicMaterial({ color: 0xdcb079 }),
    );
    g.add(deck);
    return g;
  }

  /**
   * Attach the cloned rig to a rival. Split out of spawn() because the FBX
   * loads asynchronously and a run can start before it is ready -- which is
   * exactly what happened: spawn() saw a null prefab, every rival got a bare
   * skateboard with no body on it, and nothing errored to say so. Bodies are
   * attached now if the rig is loaded and as soon as it loads if it is not.
   */
  function attachBody(r, index) {
    const prefab = rider.rigPrefab();
    // The clips load AFTER the rig itself, so a prefab can exist with an empty
    // clip table. Attaching then gave a body that never animated and nothing to
    // say why -- which is exactly how it looked: rivals standing still on the
    // road. Waiting for both is what makes them move.
    if (!prefab || r.mixer || Object.keys(prefab.clips).length === 0) return;
    // SkeletonUtils.clone(), not Object3D.clone(): a skinned mesh needs its
    // bones rebound to the CLONE's skeleton, and a plain clone leaves every
    // copy driven by the original's bones -- they would all move as one.
    const body = cloneSkinned(prefab.object);
    body.traverse((n) => {
      if (!n.isMesh) return;
      n.frustumCulled = false;
      // Clone the material so tinting one rival does not tint them all --
      // the source material is shared with the player.
      n.material = n.material.clone();
      n.material.color = new THREE.Color(r.colour);
    });
    r.holder.add(body);
    r.mixer = new THREE.AnimationMixer(body);
    const idle = prefab.clips.idle || Object.values(prefab.clips)[0];
    if (idle) {
      const action = r.mixer.clipAction(idle);
      action.setLoop(THREE.LoopRepeat);
      // Offset so the field is not a chorus line -- four identical rigs
      // breathing in perfect sync reads as one object copied, not four skaters.
      action.time = index * 0.37;
      action.play();
    }
  }

  function spawn(count, startS) {
    despawn();
    // Station-keeping measures against the player, so both have to start from
    // where the player actually is -- seeding these at 0 made the first frame
    // read as a 4,000 m gap on a varying course and the whole field bolted.
    lastPlayerS = startS;
    playerSpeed = SPEED_REF;

    for (let i = 0; i < count; i++) {
      const jersey = JERSEYS[i % JERSEYS.length];
      const holder = new THREE.Group();
      group.add(holder);

      let mixer = null;
      holder.add(makeBoard());

      const rival = {
        name: jersey.name,
        index: i,
        colour: jersey.colour,
        holder,
        mixer,
        s: startS + 6 + i * 4.5,
        theta: (i - (count - 1) / 2) * 0.13,
        speed: SPEED_REF * 0.8,
        score: 0,
        // PACE, and this is the number that decides whether the race is a race.
        //
        // It was anchored to a PERFECT tuck -- 0.98..1.27, topping out at the
        // 38 u/s a rider holding forward the whole way reaches. That is the
        // wrong reference: nobody rides a whole run in a perfect tuck, least of
        // all on a balance board, so in practice the field simply left and never
        // came back. Amit: "I lose them and cannot catch up after 3 seconds."
        //
        // Anchored to the player's UNASSISTED range, which is now 24 u/s at
        // cruise and 28 with a full rolling bonus. The field straddles it:
        // 18.6 / 21.0 / 23.4 / 25.8. Ride clean and you pull away; brake a lot,
        // or bleed speed on the walls, and they come back. Re-anchoring matters
        // more than the numbers -- these are a FRACTION of SPEED_REF, so every
        // change to the grade silently re-tunes the whole field unless they are
        // brought back to what the player can actually do.
        /**
         * AN ABSOLUTE PACE, in the same units the player rides in.
         *
         * These were 0.62-0.86 of SPEED_REF, which was right while `pace` only
         * TINTED a speed derived from the player's -- the rival kept station and
         * this decided who sat slightly ahead. Read as a real speed it means
         * 18.6-25.8 u/s against a player who cruises at 30 and reaches 40 on a
         * gate, and the field is simply not in the race: measured, a clean run
         * won with the last rival 813 m back.
         *
         * Anchored to what the hill gives an unassisted rider instead --
         * NATURAL_TOP_SPEED is 30.9, and the spread straddles it. The slowest
         * rival is beatable by riding cleanly; the fastest is not beatable
         * without taking gates. That is the whole contest, and it is now a
         * property of the field rather than of a rubber band.
         */
        pace: (NATURAL_TOP_SPEED / SPEED_REF) * (0.88 + (i / Math.max(1, count - 1)) * 0.16),
        /**
         * WHERE THIS RIVAL WANTS TO BE, RELATIVE TO THE PLAYER, in metres.
         *
         * Pace used to be absolute -- a fixed fraction of SPEED_REF with
         * nothing referring to the player at all -- so the field simply spread
         * down the hill and stayed spread. Amit: "the objective is that they
         * will be around me during the game, so I feel action and competition."
         * Nothing in the old model was trying to keep them there.
         *
         * So each rival holds a station instead: one hangs off your shoulder,
         * one keeps trying to break away up the road, one hunts you from
         * behind. Personality becomes POSITIONAL, which is the thing you can
         * actually see, rather than a pace number you can only infer.
         *
         * Spread front to back and deliberately not symmetric -- a field
         * evenly split around you reads as an escort. See the correction cap in
         * update() for what stops this being visible rubber-banding.
         */
        /**
         * Two ahead and two behind for a four-rival field, so a player riding
         * neutrally sits about third and both directions are live: someone to
         * catch, and someone catching you. Amit's benchmark for the whole model
         * -- "if I hit 3-5 pickups without hitting walls I should be 1st or
         * 2nd" -- sets the SCALE: a pad is worth roughly 30 m against a field
         * held to +4.5 u/s, so 3-5 of them is 90-160 m, and the furthest
         * station ahead has to sit inside that.
         */
        /**
         * STATIONS PULLED IN AND BACK. Measured on the previous set
         * ([18,-30,34,-48]): a player who took NINE gates cleanly and crashed
         * once still finished 2nd, beaten by RIFF -- which holds the furthest
         * forward station AND has the highest skill, so it was both ahead to
         * begin with and the best at staying there.
         *
         * Amit's benchmark is the target: "if I collected four or five boosters
         * and hit one bumper on the way, I should probably be number one." A
         * gate is worth roughly 30 m, so 4-5 of them is 120-150 m and a crash
         * gives back about 50 -- call it 70-100 m of real advantage. The
         * furthest station ahead has to sit comfortably inside that, so it is
         * 20 rather than 34, and only one rival is meaningfully up the road at
         * all.
         *
         * The field still starts ahead of the player, so first place is
         * something to go and take rather than something to be handed.
         */
        offset: [2, -46, 6, -64, 0][i % 5],
        // SKILL decides how much of the course a rival converts into points.
        // Spread wide so the leaderboard is not just the pace ladder again.
        /**
         * SKILL SPREAD COMPRESSED, 0.62-1.12 down to 0.52-0.82. The top of the
         * old range was the problem rather than the average: RIFF at 1.02 read
         * pads earliest, turned fastest and took the most of them, and won
         * every measured race regardless of how the field was otherwise tuned.
         * One rival that good is not a difficulty setting, it is a wall.
         */
        skill: 0.52 + ((i * 7) % 5) / 5 * 0.3,
        /**
         * As a FRACTION OF THE RIM, not an absolute angle. At the old fixed
         * 0.18-0.30 a rival never left the middle quarter of a 1.15 road --
         * measured, they rode |theta| <= 0.30 while the speed gates sit at 0.48
         * median and 0.76 out. A rival was arithmetically incapable of being
         * within the 0.16 gate of a pad, which is exactly why they never took
         * one. It also has to be a fraction so the narrow hills and the wide
         * ones both work.
         */
        weaveAmp: 0.30 + (i % 3) * 0.08,
        weaveRate: 0.55 + (i % 4) * 0.13,
        weavePhase: i * 1.7,
        t: 0,
        /** Eased toward, never snapped to -- see the steering block. */
        aimTheta: 0,
        /** Lateral rate, so the line has momentum instead of being teleported. */
        thetaVel: 0,
        /**
         * The pad this rival has COMMITTED to, by its s. Re-picking a target
         * every frame is most of what made them look robotic: two pads roughly
         * equidistant swapped the aim back and forth and the rival twitched
         * between them. A skater picks one and goes.
         */
        chaseS: 0,
        boostT: 0,
        boostSpeed: 0,
        downT: 0, // seconds left crashed after a wall
      };
      field.push(rival);
      attachBody(rival, i);
    }

    // If the rig was still loading, come back for the bodies once it lands.
    // Guarded on the field still being the same one, so a mode switch during
    // the load cannot resurrect a despawned rival.
    if (!field[0].mixer) {
      const spawned = field;
      rider.ready.then(() => {
        if (field !== spawned) return;
        field.forEach(attachBody);
      });
    }
  }

  function despawn() {
    for (const r of field) {
      if (r.mixer) r.mixer.stopAllAction();
      r.holder.traverse((n) => {
        if (n.isMesh && n.material && n.material.dispose) n.material.dispose();
      });
      group.remove(r.holder);
    }
    field = [];
  }

  return {
    get field() { return field; },
    spawn,
    despawn,

    /**
     * @param {number} dt
     * @param {number} playerS -- used only to cull, never to rubber-band.
     * @param {object} props -- the live prop field, so rivals earn points from
     *   the same launchers, rails and pickups the player does.
     *
     * NO RUBBER-BANDING. It is the obvious way to keep a contest close and it is
     * why competitive AI so often feels fake: if the field improves when you are
     * ahead, your own riding stops meaning anything.
     */
    update(dt, playerS, props) {
      // The player's own pace, derived rather than passed: station-keeping is
      // expressed as "match them, plus a correction", so the field needs to
      // know how fast the thing it is holding station on is going. Smoothed
      // hard -- a frame-to-frame delta is noisy enough to make the whole field
      // surge on a single hitched frame.
      /**
       * THE PLAYER'S SUSTAINED PACE -- deliberately a slow average, not their
       * current speed.
       *
       * This is the difference between a field you can beat and one you cannot.
       * Station-keeping targets "the player's speed, plus a correction", so at
       * the old third-of-a-second average every pad the player took raised the
       * whole field's target in the same instant: the rivals matched the surge
       * automatically and the ground gained was always zero. Measured on that
       * version, a player who chased nothing but speed gates took EIGHT of them
       * cleanly and still sat 4th of 5. Amit: "they're too good, impossible to
       * beat -- if I hit 3-5 pickups without hitting walls I should be 1st or
       * 2nd."
       *
       * At an ~8 second time constant a 2.8 second boost barely moves this, so
       * a pad is worth its full distance against the field. What the field
       * still answers is a LASTING change of pace -- riding well for twenty
       * seconds, or crashing -- which is what station-keeping is actually for.
       *
       * The clamp is a hitched-frame guard: one long frame produces a wild
       * delta, and without it the whole field surges on a stutter.
       */
      if (dt > 0) {
        const raw = (playerS - lastPlayerS) / dt;
        if (raw > 0 && raw < 120) playerSpeed += (raw - playerSpeed) * Math.min(1, dt * 0.125);
      }
      lastPlayerS = playerS;
      const rim = TERRAIN.thetaMax || 1.15;
      for (const r of field) {
        r.t += dt;
        // A boost RAISES THE TARGET for a while rather than adding to the speed
        // directly. Adding to the speed did nothing: the pace-seeking term below
        // pulls the rival back to its target within about a second and a half,
        // so every pad a rival took evaporated before it covered any ground,
        // while the player's decayed slowly through drag alone. Measured with
        // the naive version: the player won by 257 m without even steering for
        // the pads.
        // Down after a wall: no pace-seeking at all, just the clock running out
        // on them, exactly as the player's trip works.
        if (r.downT > 0) {
          r.downT = Math.max(0, r.downT - dt);
          r.s += r.speed * dt;
          r.holder.visible = r.s > playerS - 120 && r.s < playerS + 300;
          if (r.mixer && r.holder.visible) r.mixer.update(dt);
          continue;
        }
        if (r.boostT > 0) r.boostT = Math.max(0, r.boostT - dt);
        /**
         * A REAL PACE, NUDGED TOWARD THE PLAYER -- not a speed derived from
         * theirs.
         *
         * The previous model was fully player-relative: a rival's target WAS
         * the player's speed plus a correction. That gave the closeness Amit
         * asked for and destroyed the race to get it -- with no absolute pace,
         * a rival slows down as far as it needs to in order to stay near a bad
         * run. Amit: "I got into all of the barriers by intention and I'm still
         * coming in first." Of course: nothing in the model could out-ride him,
         * because their speed was defined as roughly his.
         *
         * So each rival now rides its OWN pace, and station-keeping is allowed
         * to bend that pace by at most PACE_BAND either way. The consequences
         * are the two halves of what he asked for:
         *
         *   RIDING WELL PAYS. Beyond +PACE_BAND they cannot answer. Take gates,
         *   hold a clean line, and you leave them -- and the gap keeps growing
         *   rather than being reeled back in.
         *
         *   RIDING BADLY LOSES. Below -PACE_BAND they will not wait. Crash into
         *   everything and the field simply rides away, which is the thing that
         *   was impossible before.
         *
         *   IN BETWEEN, THEY STAY WITH YOU. Within the band the correction
         *   pulls them toward their station, so an ordinary run has company on
         *   both sides. Amit: "they should adjust themselves to me in a way,
         *   but it should also matter how well I play."
         *
         * The band is what makes those three the same rule rather than three
         * modes with edges to fall between.
         */
        const ownPace = SPEED_REF * r.pace;
        const band = ownPace * PACE_BAND;
        const want = playerS + r.offset;
        /**
         * ASYMMETRIC ON PURPOSE. Holding a rival BACK is worth the full band;
         * letting one CHASE is worth a third of it.
         *
         * Symmetric correction is why the field could not be beaten: it made a
         * station something the rivals returned to no matter what the player
         * did. Take five pads, open 150 m, and they closed it again at the same
         * rate they would have used to stop themselves running away. Measured
         * on the symmetric version -- a player chasing nothing but speed gates
         * took TWELVE cleanly and never got above 4th of 5.
         *
         * The two directions are not the same problem. A rival disappearing up
         * the road ruins the mode, so that is worth correcting hard. A rival
         * dropping behind because the player outrode them is the mode WORKING,
         * so it barely needs correcting at all -- only enough that they are
         * still in the mirror and can capitalise if the player crashes.
         *
         * The numbers agree with Amit's benchmark. A pad is worth roughly 30 m;
         * at CHASE_MAX a rival claws back 1.5 m a second, so one pad buys about
         * twenty seconds of holding them off and 3-5 is a lead that lasts.
         */
        /**
         * Still asymmetric, and still for the same reason: a rival vanishing up
         * the road ruins the mode, whereas a rival dropped because the player
         * outrode them IS the mode. So it may hold itself back by the full band
         * but only chase within a third of it.
         */
        const rawCorr = (want - r.s) * 0.45;
        const correction = rawCorr > 0
          ? Math.min(band * CHASE_SHARE, rawCorr)
          : Math.max(-band, rawCorr);
        let target = ownPace + correction + (r.boostT > 0 ? r.boostSpeed : 0);
        /**
         * THE CAP GOES ON THE FINAL NUMBER, boost included.
         *
         * Measured without this: a rival on the new steering takes a pad every
         * few seconds, and boostSpeed (up to +16) simply out-voted a correction
         * that could only pull back 4.5 -- so a well-riding rival sat ~11 u/s
         * over the player permanently and left. RIFF was 332 m up the road and
         * still gaining, which is the exact failure the stations exist to stop.
         *
         * So a boost is worth a real surge (BOOST_HEADROOM) and nothing more:
         * it changes who is in front over the next few seconds, which is what a
         * pad is FOR, without letting a lucky run of them decide the race in
         * the first thirty seconds.
         */
        /**
         * A BOOST ONLY HELPS A RIVAL THAT IS BEHIND ITS STATION.
         *
         * Granting the headroom unconditionally let the good rivals ratchet:
         * RIFF takes most pads, so it spent much of the race at
         * playerSpeed + 9.5 and simply walked away -- measured at +183 m while
         * the player was cleanly taking pads of their own. A rival already
         * ahead of where it wants to be has no reason to spend a pad going
         * further, and letting it do so is exactly what made the field
         * impossible to beat: the player's pads bought ground that the rivals'
         * pads bought straight back.
         *
         * So ahead of station a boost adds nothing on top of the ordinary
         * correction. Behind it, it is a real surge that closes the gap fast --
         * which is when a pad is dramatic anyway: the rival you dropped is
         * coming back.
         */
        const behind = r.s < want;
        // Clamped around the rival's OWN pace. This is the line that decides
        // whether the race can be lost: nothing here refers to the player's
        // speed, so a player riding badly is simply left behind.
        const ceiling = ownPace + band + (r.boostT > 0 && behind ? BOOST_HEADROOM : 0);
        const floorSpeed = ownPace - band;
        target = Math.max(floorSpeed, Math.min(ceiling, target));
        // EASE STRAIGHT TO THE TARGET. This used to run the player's own
        // grade-minus-drag law with a pace-seeking term added on top, which
        // looked principled and was quietly wrong: the two terms fight, so a
        // rival settles wherever they balance rather than at its pace. Measured
        // -- ZED was set to 38.1 u/s and settled at 34.4, and the error grew
        // with pace, so the whole field ran slower than intended and the fastest
        // rival was penalised most. The hill is already baked into what a pace
        // MEANS; simulating it twice just made the number a lie.
        r.speed += (target - r.speed) * Math.min(1, dt * 1.8);
        const prevS = r.s;
        r.s += r.speed * dt;
        /**
         * RIDE THE COURSE, don't ride past it.
         *
         * The line was a bare sine -- the same weave whatever was on the road.
         * With the gates now out at two thirds of the rim that meant a rival
         * spent the whole race in the middle while the content went by on both
         * sides, so they never took a pad and never hit a barrier: the two
         * things Amit noticed.
         *
         * So: aim at the next speed gate, unless a barrier is closer, in which
         * case aim off it. Everything else falls back to the weave, which is
         * what keeps them moving when the road ahead is empty.
         *
         * SKILL DECIDES WHETHER THEY BOTHER. A poor rival ignores most pads and
         * spots barriers late, so the field still differs in how well it rides
         * rather than only in how fast -- and the player can watch one make a
         * mess of a gate they themselves just took.
         */
        /**
         * RIDE THE COURSE, don't ride past it -- and ride it like a person.
         *
         * The line was a bare sine, so with the gates out at two thirds of the
         * rim a rival spent the whole race in the middle while the content went
         * by on both sides: they never took a pad and never hit a barrier. Then
         * the first fix over-corrected -- they aimed at everything and crossed
         * the road faster than a human can. Both of those are the same mistake,
         * which is treating the line as a target to be solved rather than as
         * something a rider has to physically achieve.
         *
         * Three things make it organic:
         *
         *   COMMITMENT. A pad is chosen and kept (chaseS) until it is passed or
         *   given up on. Re-deciding every frame is what made them twitch
         *   between two equidistant pads.
         *
         *   REACHABILITY. A rival only goes for a pad it could actually get to
         *   at its own turn rate in the distance remaining, with a margin. This
         *   is the honest reason they now miss things: you will watch one look
         *   at a gate across the road and let it go, because it genuinely
         *   cannot make it -- not because a dice roll said so.
         *
         *   INERTIA. They steer with a rate that has to be built up and bled
         *   off (thetaVel), capped below the player's own measured maximum, so
         *   nobody out-carves you.
         *
         * `skill` now sets how EARLY they see a pad and how sharply they commit,
         * rather than a straight probability of taking one. A poor rival reacts
         * late and arrives half-heartedly, which looks like poor riding; a dice
         * roll just looks like inconsistency.
         */
        let aim = Math.sin(r.t * r.weaveRate + r.weavePhase) * r.weaveAmp * rim;
        if (props) {
          const look = 26 + r.skill * 34; // a good rival reads further ahead
          const turn = RIVAL_TURN_MAX * (0.62 + r.skill * 0.3);
          let pad = null, padD = 1e9, wall = null, wallD = 1e9;
          for (const it of props.active) {
            if (it.spent || !it.def) continue;
            const d = it.s - r.s;
            if (d < 2) continue;
            if (it.def.kind === 'boost' && d < look) {
              // Can they physically get there? Angle to cover against angle
              // available at their turn rate over the time it takes to arrive.
              const need = Math.abs(it.theta - r.theta);
              const have = turn * (d / Math.max(1, r.speed)) * 0.8;
              // Whatever they are already committed to wins ties, so a closer
              // pad appearing does not yank them off a line they are mid-way
              // through committing to.
              const bias = (it.s === r.chaseS) ? 0.6 : 1;
              if (need <= have && d * bias < padD) { padD = d * bias; pad = it; }
            } else if (it.def.kind === 'wall' && d < 30 && d < wallD) { wallD = d; wall = it; }
          }
          if (wall && Math.abs(wall.theta - r.theta) < 0.34
              && hash01(wall.s, r.index + 3) < r.skill * 0.85) {
            // Steer off it, and drop whatever pad was being chased -- a rider
            // who keeps aiming at a gate through a barrier is not avoiding it.
            aim = wall.theta + (wall.theta > 0 ? -0.4 : 0.4) * rim;
            r.chaseS = 0;
          } else if (pad) {
            aim = pad.theta;
            r.chaseS = pad.s;
          } else {
            r.chaseS = 0;
          }
        }
        r.aimTheta = aim;
        /**
         * A RATE, not a position. Steer toward the aim at a speed that is
         * capped and that itself has to be built up -- so a rival leans into a
         * turn, holds it, and leans out, instead of sliding along the road on
         * rails.
         */
        const turnMax = RIVAL_TURN_MAX * (0.62 + r.skill * 0.3);
        const wantVel = Math.max(-turnMax,
          Math.min(turnMax, (r.aimTheta - r.theta) * 1.5));
        r.thetaVel += (wantVel - r.thetaVel) * Math.min(1, dt * RIVAL_TURN_ACCEL);
        r.theta += r.thetaVel * dt;
        if (r.theta > rim * 0.92) { r.theta = rim * 0.92; r.thetaVel = 0; }
        if (r.theta < -rim * 0.92) { r.theta = -rim * 0.92; r.thetaVel = 0; }

        // --- points, from the same course the player rides -------------------
        // A rival scores off whatever it passes, scaled by its skill: a good one
        // converts most of what it goes past, a poor one misses. Deliberately
        // NON-CONSUMING -- a rival taking a crystal out from under the player
        // would make the leaderboard a race to the pickups rather than a contest
        // of riding, and losing points to something off-screen reads as a bug.
        if (props) {
          for (const it of props.active) {
            if (it.s <= prevS || it.s > r.s) continue;
            const def = it.def;
            if (def.kind === 'launch') r.score += (def.launch.points || 0) * r.skill;
            else if (def.kind === 'grind') {
              // Grinds pay PER SECOND for the player, not per rail, so a flat
              // `points` field does not exist here -- reading one produced NaN
              // and poisoned the whole leaderboard. A rival's grind is worth
              // roughly the seconds it would spend on the bar: the prop's own
              // length over its speed.
              const seconds = it.def.size.l / Math.max(1, r.speed);
              r.score += def.grind.pointsPerSecond * seconds * r.skill;
            }
            else if (def.kind === 'boost') {
              // Rivals take pads too. Without this the player had a speed source
              // the field could not answer, and a 90-second race was decided by
              // 30 seconds: measured 84 m clear before this existed. Scaled by
              // skill and gated on their line, so a pad is still something a
              // good rival takes and a poor one drifts past.
              // A rival must be near the pad AND actually take it. Being on the
              // line alone meant they took every single pad they passed while
              // the player has to steer onto each one -- so the field had a
              // speed source the player was paying for and they were not, and it
              // pulled away no matter how the paces were tuned.
              // IN ARC METRES, the same units the player's own collision uses
              // -- catchWidth is a world half-width, so comparing it against a
              // raw angle was dimensionally meaningless and quietly generous on
              // wide hills and stingy on narrow ones.
              const gap = Math.abs(it.theta - r.theta) * radiusAt(it.s);
              // NO BONUS MARGIN, and a real chance of fluffing it. The +0.6
              // slop plus a 0.9 take rate meant a good rival banked essentially
              // every pad it passed near -- Amit: "they're way too good."
              // Steering them onto the line is now the honest way they earn a
              // pad, so the roll only decides whether they actually catch it,
              // the way a player who clips the edge of a gate does not.
              // ROUGHLY TWO IN FIVE, not two in three. With the higher rate a
              // clean player reached 2nd on six pads and then slid back to 4th,
              // because the field was banking pads at very nearly the same rate
              // -- measured, rivals averaging 37 u/s against the player's 30.
              // A pad the player earns has to be worth more than a pad the
              // field collects on the way past.
              // Down again, to roughly one pad in three. Amit: "they are still
              // a bit too good, I can hardly beat them." The field taking pads
              // at close to the player's own rate is the single biggest thing
              // keeping a good run from converting into places.
              // Roughly one gate in four. Down again from one in three: the
              // field banking gates at close to the player's own rate is what
              // makes a good run fail to convert into places, and in a RACE
              // that is the whole result rather than a scoring detail.
              // About one gate in six. Measured on one-in-four: a player taking
              // SEVEN gates with a single crash still finished 2nd, which is
              // well past Amit's bar of "four or five boosters and one bumper
              // should be number one". The field's own gates are the thing that
              // cancels the player's, so this is the lever that moves it.
              if (gap < def.boost.catchWidth
                  && hash01(it.s, r.index) < 0.03 + r.skill * 0.07) {
                r.boostT = def.boost.seconds;
                // Capped the same way the player's is, and against the same
                // ceiling -- an uncapped stack ran away on both sides.
                r.boostSpeed = Math.min(
                  def.boost.ceiling - SPEED_REF * r.pace, def.boost.speed * r.skill);
              }
            }
            else if (def.kind === 'wall') {
              // RIVALS CRASH TOO, or the wall is a tax the player alone pays and
              // the race stops being one. Gated on their line and on skill, so a
              // good rival mostly threads them and a poor one does not -- the
              // same deterministic hash the gates use, so a rival hits the same
              // walls every run and stays the character it was.
              const gap = Math.abs(it.theta - r.theta) * radiusAt(it.s);
              if (gap < def.wall.catchWidth
                  && hash01(it.s, r.index + 7) > r.skill * 0.62) {
                r.speed = def.wall.stopSpeed;
                r.boostT = 0;
                r.downT = def.wall.downSeconds;
              }
            }
            else if (def.kind === 'pickup') {
              // Only if it was actually near their line -- a rival on the far
              // wall did not collect anything.
              const gap = Math.abs(it.theta - r.theta) * radiusAt(it.s);
              if (gap < def.pickup.catchWidth) r.score += (def.pickup.points || 0) * r.skill;
            }
          }
        }

        // --- place them on the road -----------------------------------------
        toWorld(r.s, r.theta, _pos);
        surfaceUp(r.s, r.theta, _up);
        r.holder.position.copy(_pos);
        // Face down the road, standing on the surface normal. Built as an
        // explicit basis for the same reason the props are: lookAt's axis
        // convention differs between cameras and meshes.
        const f = frameAt(r.s, _frame);
        // NEGATED. The prefab is authored facing AWAY from the camera -- rider.js
        // applies rotation.y = PI to it -- and a clone carries that with it. Put
        // local +Z on the tangent and that built-in flip turns the rival around
        // to look back up the road at you, which is exactly what it was doing.
        // Local +Z goes up-road so the flip lands it down-road.
        _fwd.copy(f.tangent).negate();
        _right.crossVectors(_up, _fwd).normalize();
        _basis.makeBasis(_right, _up, _fwd);
        r.holder.quaternion.setFromRotationMatrix(_basis);

        const visible = r.s > playerS - 120 && r.s < playerS + 300;
        r.holder.visible = visible;
        // Skinning is the expensive part, so the mixer only runs for rivals
        // that are actually on screen. An off-screen rival still moves and
        // still scores -- it just is not animated.
        if (r.mixer && visible) r.mixer.update(dt);
      }
    },
  };
}
