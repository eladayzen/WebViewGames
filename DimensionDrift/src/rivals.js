// THE FIELD — the four riders you are actually racing.
//
// Ported in shape from HillBombSunsetRidge/src/entities/rivals.js, and its two
// load-bearing decisions are kept because both were paid for there:
//
//   THEY ARE CLONES OF THE PLAYER'S RIG, not a second art path. Same mesh, same
//   skeleton, tinted per jersey. A billboard reads as a cardboard cut-out the
//   moment you get close to one, and the character only has to be authored once.
//
//   THEY DO NOT RUN THE PLAYER'S CONTROLLER. Driving a rival through `Rider`
//   would need a synthetic lean stream — a carve per frame — which is a harder
//   problem than the one being solved, and would make every feel constant in
//   TUNE a constraint on the AI as well. What a rival needs is to be BELIEVABLE:
//   the right pace and a plausible line.
//
// ── WHAT COULD NOT BE PORTED: THE PACE ANCHOR ────────────────────────────────
//
// HillBomb's own note says the pace is "the number that decides whether the
// race is a race", and that they got it wrong once by anchoring to a perfect
// tuck nobody rides — "I lose them and cannot catch up after 3 seconds".
//
// carve has an obvious-looking anchor in `ReferenceRun`, which the file calls
// "a competent rider" and which every gate is placed against. It is the WRONG
// one, and only measuring showed it: sampled over a race it runs at 14.6-16.9
// m/s, while the player measured over the same race runs at a median of 30.4
// and a mean of 27.7. It is about half pace. It is built to predict where a
// gate should go, not to say how fast anyone rides, and a field anchored to it
// would be dropped before the first gate — the same failure HillBomb had,
// arrived at from the opposite direction.
//
// So PACE_REF is the measured player. Re-measure it if the hill or TUNE
// changes, because every pace below is a fraction of it.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { HALF, meshHeight } from './mountain.js';
import { makeLitMaterial } from './lit.js';

/**
 * The player's own pace, in METRES OF MOUNTAIN PER SECOND, measured.
 *
 * THIS IS NOT `rider.speed`, and confusing the two is what made the first
 * field 15% too fast. `rider.speed` is measured along the BOARD, and a rider
 * holding an edge is not pointing down the fall line — measured, the ratio of
 * down-mountain progress to board speed is 0.92, and it falls further the
 * harder you carve. A rival adds its speed straight to `p`, so the number it
 * needs is dp/dt, not the speedometer.
 *
 * Measured on a strong run: 1619 m of mountain in 60 s, so 27.0 m/s including
 * the standing start, at a board speed of 29.3. Over the whole 2400 m, where
 * the back half is slower, it comes out nearer 24.7.
 *
 * 24 left the fastest rival (1.08 -> 25.9 m/s) as something a good run had to
 * actually beat, and that held until fore-aft input was disabled and `drag` was
 * cut to compensate. Measured like for like with the axis already off, that
 * took the player from 23.59 to 26.29 m/s -- 11.4% -- and the field did not
 * come with it: two full races in a row ended with the player winning and the
 * whole field 128 to 366 m behind at the flag, where before the change ZED was
 * finishing at 94.1 s and it was close.
 *
 * 24.8 is that gain handed back, and it is BRACKETED rather than derived --
 * the 11.4% measured over 60 s from a standing start overstates what it is
 * worth across 2400 m, so the arithmetic answer of 26.7 is wrong. Two full
 * races either side of it:
 *
 *   24.0   won by 128 m, nobody else finished           too easy
 *   24.8   came 3rd, beaten by ZED 95.9 and RIFF 97.8    too hard
 *   25.5   came 3rd, beaten by ZED 92.8 and RIFF 96.5    too hard
 *
 * That bracket was measured BEFORE the boost chain existed, and it has moved
 * with the player three times since. Where it stands now: the cruise went up
 * about 10% (drag 0.0032 -> 0.00279) and the chain was halved in the same
 * breath, so the player gained at the bottom and lost at the top. 24.5 is the
 * middle of a bracket whose ends are both known -- 24.0 was too easy at a
 * 26.29 cruise with a FULL chain, 24.8 was too hard at the same -- and the
 * player now sits between those with less peak than either.
 *
 * AND THE HUMAN RUN SETTLED IT: "slow down the enemies speed as well - make it
 * fair and fun - give me a chance to win." 22.
 *
 * That is a 10% cut, and the reason it is a cut rather than a nudge is that
 * every number above it was bracketed with the AUTOPILOT, which is the wrong
 * rider to tune a race against and was flagged as such each time. It holds a
 * near-perfect line, it takes almost every boost gate, and it therefore almost
 * never breaks the chain -- so it measures the ceiling of what this course can
 * be ridden at, not what riding it is like. A field balanced against the
 * ceiling is a field nobody else can beat.
 *
 * At 22 the four sit at 19.8 / 21.3 / 22.4 / 23.8 m/s. A clean run is now
 * clearly quicker than the slower half of the field and has to work for ZED,
 * which is what "a chance to win" should mean: winnable, not given.
 *
 * The coupling is the lesson, not the number: this is a fraction of what the
 * player can do, so every change to TUNE.drag, the grade or the friction terms
 * moves the race whether or not anyone re-measures it.
 *
 * It is still the number most likely to need moving, and the race draws a
 * RANDOM course offset, so one race decides nothing. Ten would, and ten
 * autopilot races are a worse guide than one run by a person who can feel
 * whether the field is in front of them.
 *
 * It is the number most likely to need moving
 * again, because it is the only one here that is a fraction of something the
 * player can change: every tuning pass on TUNE.drag, the grade or the friction
 * terms silently re-tunes the whole field unless it is brought back and
 * re-measured against what the player can actually do.
 *
 * ── DEMOTED FROM REFERENCE TO SEED ──────────────────────────────────────────
 *
 * 22 is the measured KEYBOARD player, and on the physical board nobody is the
 * keyboard player: "when I play with the actual balancing controller it's so
 * much harder -- even on a distant run I'm constantly losing, last position."
 * A field pinned to one input device's pace is unbeatable on the other, and
 * any flat number replacing it would just pin it to one player's cushion on
 * one day instead.
 *
 * So the field now anchors to the PLAYER'S OWN measured rate -- "they just
 * need to adjust themselves to my progress" -- a slow EMA of `playerRate`,
 * exactly the way the reach calibration measures a lean instead of assuming
 * one. PACE_REF survives as the seed before the measurement exists and as the
 * scale of the clamps around it. See `refRate` in `update`.
 */
const PACE_REF = 22;

/** The pace the field anchors to: how fast THIS player actually descends,
 *  learned over roughly [REF_TAU] seconds and clamped to [REF_MIN..REF_MAX] of
 *  PACE_REF. The floor keeps a parked player from parking the race -- riding
 *  past someone who stopped is the correct outcome -- and the ceiling keeps a
 *  tucked keyboard run from turning the field into motorcycles. */
const REF_TAU = 12;
const REF_MIN = 0.45;
const REF_MAX = 1.15;

/**
 * Distinct jerseys. The player's board is acid green and their jacket is
 * red-and-blue, so none of these are any of those.
 */
/**
 * REPAINTED TWICE, and the second time for the right reason. The first set
 * (navy/umber/maroon/pine) was dark and read as silhouettes. The second fix
 * lifted them to vivid -- royal blue, mint -- and walked into the real
 * constraint: "most of the road is white, BLUISH ... it's like they have
 * camouflage." The mountain owns the cool half of the wheel: snow, haze, sky,
 * shadow are all blue-white, so any cool suit is terrain-coloured however
 * saturated it is. Ski courses flag in red-orange for exactly this reason.
 *
 * So: WARM ONLY. Orange, crimson, gold, magenta -- four hues the piste never
 * wears, distinct from each other at a glance, visibility outranking the old
 * don't-match-the-player rule by Elad's call.
 */
// WARM ONLY, because the mountain owns the cool half of the wheel -- snow, haze,
// sky and shadow are all blue-white, so a cool suit is terrain-coloured however
// saturated. Orange, gold, magenta, crimson: four hues the piste never wears.
//
// But the colour is only half the fix. The body MESH carries the character's
// own texture, and the lit shader multiplied base x map, so the texture painted
// over the jersey and three palettes in a row "didn't take" -- the texture was
// outvoting the colour. matFor now runs these through a low uMapTint so the
// jersey leads and the texture survives as shading. The board has no map and
// needs no tint.
const JERSEYS = [
  { name: 'ACE', suit: 0xff6a00, board: 0x4fc3ff },
  { name: 'NOVA', suit: 0xffd60a, board: 0xffc233 },
  { name: 'RIFF', suit: 0xff2d9c, board: 0xff5f9e },
  { name: 'ZED', suit: 0xd90429, board: 0x35e0b0 },
];

/**
 * How fast each rival rides, as a fraction of the anchored reference.
 *
 * STRADDLING THE PLAYER IS THE WHOLE POINT. One clearly slower, one clearly
 * faster, two inside a second of them. Ride well and you take the field; give
 * away a boost gate or put yourself into a tree and they are past you. A field
 * that is entirely slower than the player is a parade, and one entirely faster
 * is a cutscene.
 */
const PACES = [0.90, 0.97, 1.02, 1.08];

/**
 * How hard a rival eases toward its pace.
 *
 * HillBomb uses 1.8 and it is wrong here, because their skater does not start
 * from a standstill and carve's rider does. At 1.8 the field is at full pace
 * within about a second while the player is still winding up out of the gate,
 * so the race opened with the player in 5th and 60 m down before they had done
 * anything — which is precisely the "I lose them and cannot catch up" that
 * HillBomb's own pace note is a scar from.
 *
 * 0.35 is a time constant of about three seconds, which is roughly how long
 * the player's own grade-minus-drag takes to come up to cruise. The field
 * leaves the line WITH the player rather than away from them.
 */
const SEEK = 0.35;

/**
 * ── LEAVING THE GATE TOGETHER ───────────────────────────────────────────────
 *
 * Reported twice, and the second time after the SEEK fix: "the competitors are
 * starting much faster than me."
 *
 * Measured off the line, the player's DOWN-MOUNTAIN rate goes 13.5, 16.0, 16.8,
 * 23.3, 29.5 m/s at t = 3, 5, 7, 9, 11 -- they spend the first eight seconds
 * winding up, because a standing rider has no speed to turn into speed and the
 * first few carves are scrubbing more than they gain. A rival easing toward
 * 21.6 m/s is already doing 17 at t=2 and 21 at t=8, so the field took 67 m out
 * of the player before the player had done anything wrong.
 *
 * Lowering the constants alone could not fix it: the shapes are different, not
 * just the scale. The player's curve is flat then steep; an exponential ease is
 * steep then flat. So for the opening the field is CAPPED to the player's own
 * rate -- everyone leaves the gate together -- and the cap is lifted smoothly
 * over LAUNCH_FADE so nothing lurches when it goes.
 *
 * The small margin per rival is what keeps the field ordered during the launch,
 * so ZED is still the one pulling away first.
 */
const LAUNCH = 9;
const LAUNCH_FADE = 3;

/** How far ahead a rival reads the hill for trees, metres. */
const LOOK = 34;
/** Lateral room a rival wants past a trunk. Wider than the player's, on purpose. */
const AVOID_CLEAR = 4.2;
/** How fast the avoidance bias slides across. m/s of lateral travel. */
const AVOID_RATE = 7;
/**
 * How quickly a rival's heading catches up to the line it is tracking.
 *
 * The heading used to be recomputed from scratch every frame out of the
 * INSTANTANEOUS lateral rate, `(u - prevU) / dt`. That is a one-frame
 * difference of a number the weave and the avoidance are both already moving,
 * divided by a frame time that itself varies -- so it is mostly noise, and the
 * rivals snapped between angles from one frame to the next instead of turning.
 * Reported as "they jump from pose to pose, from angle to angle in like one
 * frame".
 *
 * So the rate feeds a heading that is eased toward rather than assigned. 6 is
 * about a sixth of a second, fast enough to still read as reacting to the
 * avoidance and slow enough that a single noisy frame goes nowhere.
 */
const YAW_SMOOTH = 6;
/**
 * How far a rival leans, as a fraction of its heading.
 *
 * NEGATIVE, and that is the fix rather than the convention: "it looks like they
 * are tilting the other way from where they're moving -- when they move right
 * their body tilts left." A rider going right leans INTO the turn, and this was
 * rolling them out of it. The rig is authored facing away from the camera (see
 * the note in `rider.js` about the Mixamo import), which flips the sign of a
 * roll relative to the heading that drives it.
 */
const ROLL = -0.9;
/** What a tree costs: the fraction of speed kept, and seconds of no seeking. */
const TREE_KEEP = 0.58;
const TREE_DOWN = 0.9;
/** How near a boost gate a rival has to be to take it. */
const BOOST_REACH = 5.0;

/**
 * ── THE ADAPTIVE BAND, AND WHAT IT COSTS ────────────────────────────────────
 *
 * Asked for directly: "a good feeling of them change speed according to me so I
 * will compete through all/most of the race."
 *
 * This is rubber-banding, and HillBomb's file argues against it in as many
 * words -- "if the field improves when you are ahead, your own riding stops
 * meaning anything". That argument is right and it is not the whole story: a
 * field on fixed paces either drops you or is dropped, and either way the last
 * ninety seconds are a solo descent. Their own race is 90 seconds on a 24 m/s
 * road; this one is 2400 m of hill where a bad gate costs real ground.
 *
 * So it is bounded rather than refused, and the bounds are the design:
 *
 *   DEAD    nothing happens inside 70 m. Close racing is left alone entirely,
 *           which is the only place where an adjustment would be FELT.
 *   BAND    at most 14% of pace, ramped in over the next 230 m. A rival can
 *           never out-drive its own character -- ZED stays the fastest and ACE
 *           stays the slowest, because every rival gets the same multiplier.
 *   CLOSING the band switches OFF for the last 400 m. The finish is decided on
 *           the paces the field actually had, so a race can still be won and
 *           lost, and a lead built in the closing stretch is real.
 *
 * The honest cost: between 70 and 400 m, ground you gain is worth a little less
 * than it would be otherwise. What it buys is that there is still a race in
 * front of you at 1500 m.
 */
const ADAPT_DEAD = 70;
const ADAPT_FULL = 300;
const ADAPT_BAND = 0.14;
const ADAPT_CLOSING = 400;

/** Deterministic 0..1 from a tree and a rival, so a rival hits the SAME trees
 *  every run and stays the character it was. HillBomb's hash, kept. */
function hash01(a, b) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createRivals(scene, terrain, mood) {
  const group = new THREE.Group();
  scene.add(group);

  /** @type {Array<object>} */
  let field = [];
  let prefab = null;

  /** Handed the player's assembled rider — board and body in one group. */
  function setPrefab(riderGroup) { prefab = riderGroup; }

  /**
   * The jerseys' materials, built ONCE and reused for every race.
   *
   * NOT by cloning the player's materials and setting `.color`, which is the
   * obvious move and fails twice over. Every material on the rider is a
   * `makeLitMaterial` ShaderMaterial: it HAS no `.color` -- the base colour is
   * a `uBase` uniform -- so the assignment silently does nothing, and cloning
   * the material detaches it from `mood.bind`, so the clone stops being lit and
   * renders as a flat white ghost. Which is what the first attempt put on the
   * mountain.
   *
   * Built through the same factory the rider uses, with the same
   * wrap/gloss/specular, so the field goes through dawn and alpenglow with
   * everything else.
   *
   * AND BUILT ONCE, CACHED FOREVER, because `Mood.bind` has no unbind: it
   * appends to a list that is written every frame, so materials made per spawn
   * would pile up in it for the life of the page and be re-lit every frame for
   * riders long since despawned. Eight materials total, four jerseys by two
   * kinds, is the whole cost.
   *
   * @type {Map<string, THREE.Material>}
   */
  const jerseyMats = new Map();

  function matFor(colour, map) {
    const key = `${colour}:${map ? 'body' : 'board'}`;
    let m = jerseyMats.get(key);
    if (!m) {
      m = map
        // emissive 0.15: not a glow, a refusal to fully take the haze -- the
        // suits stay their own colour at the fog distances the adaptive field
        // keeps the rivals at, instead of greying into it.
        // mapTint 0.25: colour dominates, the character's face and suit seams
        // come back faintly. Only safe to spend detail NOW that the real bug is
        // fixed -- the jerseys were washing to fog colour because their
        // materials were never in the per-frame lit update (uFogBase stuck at 0,
        // ~4 km off), so no mapTint value ever showed. With lighting correct the
        // colour holds at 0.25 and the riders read as people, not blocks.
        ? makeLitMaterial(mood, { color: colour, wrap: 0.42, gloss: 26, specular: 0.22, emissive: 0.15, map, mapTint: 0.25 })
        : makeLitMaterial(mood, { color: colour, wrap: 0.3, gloss: 60, specular: 0.55, emissive: 0.15 });
      jerseyMats.set(key, m);
    }
    return m;
  }

  /**
   * ── WHY A RIVAL IS DARK AND ITS BOARD IS NOT ────────────────────────────
   *
   * "In the snow I can hardly see them." Measured, and the numbers say the
   * first jerseys were the wrong idea rather than the wrong shade. Luminance
   * contrast against the four snow colours:
   *
   *   ACE 0x2fa8ff    1.64-2.44        obstacle tree    8.95-13.34
   *   NOVA 0xffc233   1.03-1.53        rock             5.96- 8.88
   *   RIFF 0xff5f9e   1.81-2.70        THE PLAYER'S     10.73-15.99
   *   ZED 0x35e0b0    1.07-1.60        OWN SUIT
   *
   * NOVA at 1.03 is not a low contrast, it is no contrast: bright saturated
   * paint on a bright white field. And the answer was on the hill already --
   * everything that reads at distance here is DARK. The trees do it, the rocks
   * do it, and the player does it, because `rider.js` dresses them in 0x1a1d24.
   * Saturation was never what made them legible; being a hole in the snow was.
   *
   * So a rival is built the way the player is: a dark suit that silhouettes,
   * and ONE bright thing for identity. The suits measure 5.0-10.4 against snow
   * -- rock territory -- while keeping 83-87% saturation, so ACE is still
   * unmistakably the blue one. The board keeps the old bright colour, which is
   * exactly the job the player's acid-green board already does.
   */
  function dress(obj, jersey) {
    obj.traverse((n) => {
      if (!n.isMesh && !n.isSkinnedMesh) return;
      // The body carries the character's texture and the board does not. Kept,
      // because a rival with the texture stripped off is a mannequin -- and it
      // is also how the two are told apart without relying on node names.
      const src = Array.isArray(n.material) ? n.material[0] : n.material;
      const map = src?.uniforms?.uMap?.value ?? null;
      n.material = matFor(map ? jersey.suit : jersey.board, map);
      n.castShadow = false;
      n.frustumCulled = false;
    });
  }

  /**
   * Put the clone into the player's riding stance.
   *
   * `SkeletonUtils.clone` copies the bone hierarchy but the rivals came out
   * standing bolt upright, which is the BIND POSE — the rig as Mixamo shipped
   * it. carve does not animate the rider: `rider.js` builds the stance by
   * writing every bone's rotation from `userData.stance` and re-applies it
   * every frame, so the pose lives on the live bones rather than in a clip.
   * A clone taken of the hierarchy does not inherit that, and a rival standing
   * to attention at 50 km/h is the single most obviously wrong thing that could
   * be put on this mountain.
   *
   * Copied by NAME rather than by walking both trees in step, because the two
   * hierarchies only match while nobody adds a node to one of them.
   *
   * It is a SNAPSHOT, taken once at spawn. Rivals do not animate — the player's
   * pose is driven by their own lean, and a rival has no lean to drive it with.
   * A held carve is the right read for a rider seen from sixty metres, and it
   * costs nothing per frame.
   */
  function copyPose(src, dst) {
    const pose = new Map();
    src.traverse((n) => { if (n.name) pose.set(n.name, n); });
    dst.traverse((n) => {
      const from = n.name && pose.get(n.name);
      if (!from || from === n) return;
      n.quaternion.copy(from.quaternion);
      n.position.copy(from.position);
      n.scale.copy(from.scale);
    });
  }

  /**
   * @param {number} startP where the player starts, metres down the mountain
   *
   * THE FIELD STARTS ON THE LINE, not strung out down the hill. They are staged
   * across the start line either side of the player, which is what a start line
   * is for, and the spread that matters is the one the PACES open up over the
   * next two thousand metres.
   */
  /** The learned player pace. null until the launch is over and a real rate
   *  has been seen, so the opening seconds (rate climbing from zero) never
   *  drag the measurement down. */
  let refRate = null;

  function spawn(startP) {
    despawn();
    refRate = null;
    if (!prefab) return;
    for (let i = 0; i < JERSEYS.length; i++) {
      const j = JERSEYS[i];
      const holder = cloneSkinned(prefab);
      dress(holder, j);
      copyPose(prefab, holder);
      holder.frustumCulled = false;
      group.add(holder);
      // Two either side, far enough out that nobody is standing in the player's
      // camera and inside the bowl's rim at HALF.
      const lane = (i < 2 ? -1 : 1) * (4.5 + (i % 2) * 4.0);
      const rival = {
        name: j.name,
        index: i,
        colour: j.board,
        holder,
        p: startP,
        u: lane,
        lane,
        // Off the line at the speed the player leaves at. The LAUNCH cap does
        // the rest of the work of keeping them together.
        speed: 11,
        pace: PACES[i],
        // Personality is a SEED, not a script: the same rival weaves the same
        // way every run, so it stays the character it was.
        weaveAmp: 2.2 + (i % 3) * 1.1,
        weaveRate: 0.28 + (i % 4) * 0.07,
        weavePhase: i * 1.7,
        t: 0,
        yaw: 0,
        // SKILL decides whether a rival reads a tree in time and whether it
        // takes a boost gate. Spread wide and tied to the index, so the field
        // is not just the pace ladder a second time: NOVA is slower than RIFF
        // and cleaner through the trees.
        skill: 0.58 + ((i * 3) % 4) / 3 * 0.34,
        avoid: 0,
        downT: 0,
        boostT: 0,
        boostAdd: 0,
        finished: false,
        finishT: 0,
      };
      // Staged on the line straight away, so they are standing where they will
      // start rather than inside the player for the whole countdown.
      rival.u = rival.lane + Math.sin(rival.weavePhase) * rival.weaveAmp;
      field.push(rival);
      place(rival);
    }
  }

  function despawn() {
    // The MESHES go; the materials do not. They are the shared jersey set and
    // the next race wants them back -- see `jerseyMats`.
    //
    // AND THE SKELETONS GO, which is the part that was missing. SkeletonUtils
    // .clone builds a NEW bone hierarchy and a new Skeleton per rival, and
    // three.js allocates a bone texture for each skeleton the first time it
    // renders. Removing the holder from the group drops the only reference
    // the scene had, but the GPU texture is not garbage: it is released when
    // somebody disposes it, and nobody did. Four rivals, so four textures a
    // race, for as long as the app is open.
    //
    // Measured across run/menu cycles: solo textures climbed 15 -> 19 -> 23
    // -> 27, four per run and never down. Two-player never climbed, which is
    // the tell -- player two REPLACES the rival field, so a mode with no
    // rivals leaked nothing.
    //
    // Geometry and material are deliberately NOT disposed: the clone shares
    // both with the prefab, and disposing them would take the next race's
    // riders with them.
    for (const r of field) {
      r.holder.traverse((o) => { if (o.isSkinnedMesh) o.skeleton?.dispose?.(); });
      group.remove(r.holder);
    }
    field = [];
  }

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  /**
   * Put a rival on the mountain at its own (p, u).
   *
   * SHARED WITH `spawn`, and that is the point. A clone carries the PREFAB's
   * transform, which is the player's own group -- so a freshly spawned field
   * sits exactly on top of the player, all four of them, at dxFromPlayer 0.
   * Nothing moved them because `update` only runs while the state is `play`
   * and the countdown is `count`: the world is frozen and the mode's frame
   * never fires. So the whole field spent the countdown inside the player, and
   * what you saw at your own position was somebody else's rider drawn over you
   * -- reported as "my character looks like an opponent while count down".
   */
  function place(r, yaw = 0) {
    const z = -r.p;
    const x = terrain.centerX(z) + r.u;
    r.holder.position.set(x, meshHeight(terrain, x, z), z);
    _e.set(-terrain.slopeAt(r.p), yaw, yaw * ROLL, 'YXZ');
    r.holder.quaternion.setFromEuler(_e);
  }

  /**
   * @param {number} dt
   * @param {number} playerP only ever used to CULL, never to rubber-band.
   * @param {number} runT seconds since the run began, for finish times.
   * @param {number} limitP the finish, or Infinity.
   *
   * NO RUBBER-BANDING. It is the obvious way to keep a contest close and it is
   * exactly why competitive AI so often feels fake: if the field improves when
   * you are ahead, your own riding stops meaning anything.
   */
  function update(dt, playerP, runT, limitP = Infinity, world = null) {
    const scatter = world?.scatter ?? null;
    const gates = world?.gates ?? null;
    const playerRate = world?.playerRate ?? 0;
    // The band is off in the closing stretch -- see ADAPT_* above.
    const adapt = limitP === Infinity || (limitP - playerP) > ADAPT_CLOSING;

    // ── LEARN THE PLAYER, THEN RACE THEM ──────────────────────────────────
    // Only after the rolling start (a rate still climbing from zero is the
    // launch, not the player) and only while the band is live: the closing
    // stretch freezes the reference along with the band, so the finish is run
    // against the field the race actually had and a final sprint beats the
    // rivals rather than feeding them.
    if (playerRate > 0 && runT > LAUNCH + LAUNCH_FADE && adapt) {
      const lo = PACE_REF * REF_MIN;
      const hi = PACE_REF * REF_MAX;
      const seen = Math.min(hi, Math.max(lo, playerRate));
      refRate = refRate === null
        ? Math.min(seen, PACE_REF)      // first reading; never seed ABOVE the old field
        : refRate + (seen - refRate) * Math.min(1, dt / REF_TAU);
    }
    const ref = refRate ?? PACE_REF;

    for (const r of field) {
      r.t += dt;

      if (!r.finished) {
        if (r.downT > 0) {
          // Down after a tree: no seeking at all, just the clock running out on
          // them, exactly the way the player's own crash works.
          r.downT = Math.max(0, r.downT - dt);
        } else {
          // EASE STRAIGHT TO THE TARGET, and do NOT re-run the player's
          // grade-minus-drag law underneath it. HillBomb measured what that
          // costs: the two terms fight, so a rival settles where they balance
          // rather than at its pace -- one set to 38.1 settled at 34.4, and the
          // error grew with pace. The hill is already baked into what a pace
          // MEANS.
          let mult = 1;
          if (adapt) {
            const gap = r.p - playerP;
            const k = Math.min(1, Math.max(0,
              (Math.abs(gap) - ADAPT_DEAD) / (ADAPT_FULL - ADAPT_DEAD)));
            // Ahead of the player: ease off. Behind: press on. The SAME
            // multiplier for every rival, so the field keeps its own order.
            mult = 1 - Math.sign(gap) * k * ADAPT_BAND;
          }
          if (r.boostT > 0) r.boostT = Math.max(0, r.boostT - dt);
          let target = ref * r.pace * mult + (r.boostT > 0 ? r.boostAdd : 0);
          // The rolling start -- see LAUNCH above.
          let seek = SEEK;
          if (runT < LAUNCH + LAUNCH_FADE && playerRate > 0) {
            const cap = playerRate * (1 + 0.06 * r.pace);
            const ease = Math.min(1, Math.max(0, (runT - LAUNCH) / LAUNCH_FADE));
            target = Math.min(target, cap) * (1 - ease) + target * ease;
            // AND TRACK IT TIGHTLY WHILE IT IS ON. `SEEK` is 0.35 -- a three
            // second lag -- which is right for a fixed pace and wrong for a cap
            // that is climbing as fast as the player is. Easing slowly toward a
            // rising target left the field 10-27 m BEHIND off the line, which
            // is the same fault as before with the sign flipped.
            seek = 2.5 * (1 - ease) + SEEK * ease;
          }
          r.speed += (target - r.speed) * Math.min(1, dt * seek);
        }
        r.p += r.speed * dt;
        if (r.p >= limitP) {
          r.p = limitP;
          r.finished = true;
          r.finishT = runT;
        }
      }

      // ── the line ────────────────────────────────────────────────────────
      // A rider holding an edge does not travel in a straight line, and four
      // rivals running dead straight down the fall line read as traffic cones.
      let want = r.lane + Math.sin(r.t * r.weaveRate + r.weavePhase) * r.weaveAmp;

      if (scatter && !r.finished) {
        // THEY GO ROUND THE TREES, which is the whole of "in a smarter way".
        // Riding through a trunk is the single thing that most says these are
        // not riders, and a rival that only ever CRASHED on trees would be a
        // rival that never looked like it was reading the hill.
        //
        // So: read LOOK metres ahead on the line they want, and if it is
        // blocked, take the nearest offset that is not. Skill decides how far
        // ahead they see -- a poor rival gets a short look and commits to a bad
        // line, which is what makes it a poor rival rather than a slow one.
        const reach = LOOK * (0.45 + r.skill * 0.55);
        if (scatter.lineBlocked(r.p, want, reach, AVOID_CLEAR)) {
          for (const step of [4.5, -4.5, 9, -9, 14, -14]) {
            const alt = want + step;
            if (Math.abs(alt) > HALF - 3) continue;
            if (!scatter.lineBlocked(r.p, alt, reach, AVOID_CLEAR)) { want = alt; break; }
          }
        }
      }

      // Eased rather than snapped: a rival that teleports two metres sideways
      // reads as a glitch, and the lateral rate is also what leans them over.
      const maxStep = AVOID_RATE * dt;
      const d = want - r.u;
      const prevU = r.u;
      r.u += Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep;
      if (r.u > HALF - 2) r.u = HALF - 2;
      if (r.u < -(HALF - 2)) r.u = -(HALF - 2);

      // ── what the course does to them ────────────────────────────────────
      if (scatter && !r.finished && r.downT <= 0) {
        const hit = scatter.hitObstacle(r.p, r.u);
        // RIVALS CRASH TOO, or a tree is a tax the player alone pays and the
        // race stops being one. Gated on the same deterministic hash the rest
        // of their character comes from, so a rival hits the same trees every
        // run -- and a good one mostly threads what it failed to steer around.
        if (hit && hash01(-hit.z, r.index + 7) > r.skill * 0.55) {
          r.speed *= TREE_KEEP;
          r.downT = TREE_DOWN;
          r.boostT = 0;
        }
      }

      if (gates && !r.finished && r.boostT <= 0) {
        // RIVALS TAKE BOOST GATES. Without this the player has a speed source
        // the field cannot answer -- HillBomb measured 84 m of drift before
        // they added the same thing. Gated on being ON the gate, not merely
        // passing its distance: a rival that took every gate it went by would
        // have a source the player has to steer for and it would not.
        for (const g of gates) {
          const d2 = g.data;
          if (!d2 || !d2.boost) continue;
          if (d2.p <= r.p - r.speed * dt || d2.p > r.p) continue;
          const du = Math.abs((d2.u ?? 0) - r.u);
          if (du < BOOST_REACH && hash01(d2.p, r.index) < r.skill) {
            r.boostT = 2.6;
            r.boostAdd = 9 * r.skill;
          }
        }
      }

      // Leaning into the turn. The lateral rate over the forward rate is the
      // angle the board is actually tracking at, so this is the heading rather
      // than a decoration bolted on -- and it leans into the AVOIDANCE too,
      // which is most of what sells a rival reading the hill.
      //
      // EASED, not assigned -- see YAW_SMOOTH. The raw rate is a one-frame
      // difference and is far too noisy to point a rider with.
      const rawYaw = Math.atan2((r.u - prevU) / Math.max(1e-4, dt), Math.max(1, r.speed));
      r.yaw += (rawYaw - r.yaw) * Math.min(1, dt * YAW_SMOOTH);
      place(r, r.yaw);

      // Culled rather than drawn at any distance: four skinned rigs is the most
      // expensive thing this scene has ever been asked to hold.
      r.holder.visible = r.p > playerP - 140 && r.p < playerP + 320;
    }
  }

  /**
   * Where the player stands, 1-based, counting only who is actually ahead.
   *
   * A RIVAL PAST THE LINE IS AHEAD ON TIME, NOT ON DISTANCE, and getting that
   * wrong makes the player win every race. Finishers are frozen AT `finishP`,
   * so the moment the player arrives they are all at the same p and `r.p >
   * playerP` is false for every one of them. Measured with the naive version:
   * all four rivals finished at 78.2, 82.8, 87.1 and 93.8 s, the player crossed
   * after every one of them, and the game still said 1st.
   *
   * So a finished rival is compared on the clock and a live one on the hill.
   * Before the player crosses, `playerT` is undefined and the distance test is
   * the right one anyway: a finisher sits at the line, the player does not, so
   * the comparison already puts them ahead.
   *
   * @param {number} playerP
   * @param {number} [playerT] the run time the player crossed, if they have.
   */
  function placeOf(playerP, playerT) {
    let ahead = 0;
    for (const r of field) {
      if (r.finished && playerT != null) { if (r.finishT <= playerT) ahead++; }
      else if (r.p > playerP) ahead++;
    }
    return ahead + 1;
  }

  return {
    get field() { return field; },
    /** The learned reference, for the QA harnesses -- a race tuned to adjust to
     *  the player is only testable if the harness can see what it adjusted to. */
    get refRate() { return refRate; },
    /** THE JERSEY MATERIALS, so the frame loop can light them with everything
     *  else. They were absent from `litMaterials`, so their uFogBase stayed at 0
     *  while a run sits ~4 km down the mountain -- the distance fog term then
     *  computed against a base 4 km off and washed every rival to fog colour,
     *  which is why no jersey colour ever showed. Lazily filled, so this is read
     *  every frame rather than snapshotted once. */
    get materials() { return [...jerseyMats.values()]; },
    setPrefab, spawn, despawn, update, placeOf,
  };
}
