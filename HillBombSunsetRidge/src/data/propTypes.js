// Prop catalogue for the descent.
//
// Everything the rider can interact with is described here as DATA -- geometry
// size, colour, and what happens on contact -- so adding new content is a table
// entry rather than new placement or collision logic (build doc §6's "keep all
// obstacle types driven by one shared behaviour" rule).
//
// Three interaction classes, deliberately kept to a small vocabulary:
//   'launch'  -- ride over it and you're airborne (kickers, banks)
//   'grind'   -- ride onto it and you're locked to its line, scoring per metre
//   'hazard'  -- clip it and you take a wobble spike and a speed scrub
//   'scenery' -- no interaction at all, just something for the eye
//
// PLACEMENT RULE, inherited from the build doc (§5.5): trick props are opt-in.
// They are never placed across the whole road, so a rider who ignores every one
// of them can always complete a run. `laneBias` biases a prop toward one side so
// there is always a clean line past it.

export const PROP_TYPES = {
  // --- launchers ---------------------------------------------------------
  kicker: {
    kind: 'launch',
    // A wedge: low at the near edge, rising toward the rider's direction.
    size: { w: 4.2, h: 0.95, l: 3.4 },
    colour: 0x6c3fd8,
    accent: 0x4223a2,
    launch: { power: 1.0, points: 120, profile: 'wedge' },
    label: 'KICKER',
  },
  bigKicker: {
    kind: 'launch',
    size: { w: 5.6, h: 1.6, l: 5.0 },
    colour: 0x8a4fe8,
    accent: 0x5427b6,
    launch: { power: 1.42, points: 260, profile: 'wedge' },
    label: 'BIG AIR',
  },
  // THE ONLY LAUNCHER THAT CAN PRODUCE A BACKFLIP, and only when hit at speed.
  // A proper vert wall rather than a wedge: tall, narrow, and steepening toward
  // the lip, so it reads from a distance as something you have to commit to.
  // power 1.9 puts its range at 2.3-6.7 units against a 4.4 flip bar, so it
  // needs roughly 23 u/s and up to flip and a scrubbed-off approach spins --
  // the speed requirement is the physics, not a separate rule.
  barrel: {
    kind: 'launch',
    size: { w: 5.0, h: 3.6, l: 6.5 },
    colour: 0xb84fd8,
    accent: 0xffd166,
    launch: { power: 1.9, points: 420, profile: 'curve' },
    label: 'VERT WALL',
  },
  bank: {
    kind: 'launch',
    // Wide, shallow quarter-pipe style bank -- a gentler launch, and forgiving
    // because it's wide enough that you don't have to aim.
    size: { w: 9.0, h: 1.2, l: 6.0 },
    colour: 0x35538f,
    accent: 0x27406f,
    launch: { power: 1.2, points: 150, profile: 'hump' },
    label: 'BANK',
  },

  // --- grindables --------------------------------------------------------
  // SPRING GREEN, and deliberately its own hue. These were cyan -- the exact
  // colour of the painted guide stripes -- so a solid object you ride and a
  // marking you're meant to ignore looked identical at a glance. Hue here
  // carries FUNCTION, not mood: indigo ground, cyan paint, magenta boundary,
  // violet launcher, yellow hazard, green grindable. Green also reads as
  // "positive, go for it", which is what a rail is.
  rail: {
    kind: 'grind',
    size: { w: 0.16, h: 0.52, l: 16 },
    colour: 0x5cff9e,
    accent: 0x1f8f52,
    grind: { pointsPerSecond: 260, catchWidth: 1.5 },
    label: 'RAIL',
  },
  longRail: {
    kind: 'grind',
    size: { w: 0.16, h: 0.58, l: 28 },
    colour: 0x5cff9e,
    accent: 0x1f8f52,
    grind: { pointsPerSecond: 320, catchWidth: 1.5 },
    label: 'LONG RAIL',
  },
  // NOT CURRENTLY EMITTED -- no pattern places one; see 'rail plaza'. Kept
  // whole because a replacement wide grindable is coming and this is the shape
  // of the slot it drops into, not because anything still uses it.
  ledge: {
    kind: 'grind',
    size: { w: 1.5, h: 0.62, l: 14 },
    colour: 0x4ae08a,
    accent: 0x1a7a48,
    grind: { pointsPerSecond: 220, catchWidth: 1.9 },
    label: 'LEDGE',
  },

  // --- real obstacles ------------------------------------------------------
  //
  // A WALL IS NOT A HAZARD. The old hazard kind (cones, potholes) nudges the
  // wobble meter and scrubs a little speed -- a tap on the wrist. This is the
  // other thing entirely: hit it and the run stops. Its own kind because that
  // difference has to be visible to a course: a mode can have walls without
  // cones, and today only the race has either.
  //
  // Built to be AVOIDED, which is the whole design. It is narrow enough to go
  // round, tall enough to read from a distance, and made of planks in a warm
  // timber that nothing else on the course uses -- the palette is otherwise
  // violet launchers, green rails, cyan and gold gates, amber crystals, and a
  // red rider. A thing that ends your run should not have to be identified.
  woodWall: {
    kind: 'wall',
    size: { w: 3.6, h: 1.15, l: 0.5 },
    colour: 0x9c6b3f,
    accent: 0x6b4526,
    wall: {
      catchWidth: 1.9,   // half-width of the collider, in world units
      clearHeight: 1.3,  // an arc above this sails over it
      stopSpeed: 6.0,    // what you are left with after hitting it
      downSeconds: 1.1,  // how long the rider is out of control
      // Less shove than the face's blocker: this one is a run-ender, and being
      // flung sideways on top of losing the race reads as piling on.
      deflect: 0.14,
      slowSeconds: 2.0,
      slowFactor: 0.3,
    },
    label: 'WALL',
  },

  /**
   * THE BLOCKER -- what makes the middle of the hill cost something.
   *
   * Amit, riding the open face: "I can just stay in the middle and go through
   * the ride." He was right, and measurably so: 17% of every placement sat at
   * exactly theta 0, which the spread multiplier cannot move (0 x 1.75 is still
   * 0), so the centreline was a route that collected crystals and hit ramps and
   * was never once punished for it. Spreading the REWARDS outward does not fix
   * that on its own -- it makes the middle boring, and boring is not a cost.
   * Something has to be in the way.
   *
   * It was a low-poly rock first, and looked wrong: every other object here is
   * flat unlit colour and hard edges, and a naturalistic stone read as an import
   * from another game. Same bones as woodWall now, restyled -- see buildBlocker.
   *
   * GENTLER THAN woodWall on purpose. That one drops you to 6 u/s for 1.1s,
   * which is a run-ending mistake -- correct as one authored hazard in a race,
   * far too harsh when these are the standard furniture of every pattern.
   * Clipping one should cost you a line and some speed, not the descent.
   */
  blocker: {
    kind: 'wall',
    size: { w: 3.4, h: 1.6, l: 0.4 },
    colour: 0x241a3d, // near-black indigo, so the lit parts carry it
    accent: 0xff3ea5, // the boundary magenta, same hue as the coping
    wall: {
      catchWidth: 2.0,
      clearHeight: 1.9,  // a real drop's air clears it; an ollie does not
      stopSpeed: 12.0,   // knocked down to a crawl, not stopped dead
      downSeconds: 0.55,
      /**
       * How long the hill refuses to give the speed back, and by how much.
       *
       * Amit: "he's pushing too much and he's not slowing down. He should feel
       * like -- oh, I got pushed a little bit, and now I'm slow."
       *
       * The second half is not fixed by a deeper stopSpeed, which is the
       * obvious move and does almost nothing: the grade accelerates hardest at
       * low speed, so recovery to 25 u/s takes 2.3s from 15 and 3.0s from 8.
       * Measured -- the depth of the hit barely changes how long it is felt.
       *
       * What does is holding the grade off for a moment afterwards. At 0.35 the
       * pull barely beats drag, so the rider crawls out of it rather than being
       * fired back up to cruise, and the whole event lasts about three and a
       * half seconds instead of two.
       */
      slowSeconds: 1.6,
      slowFactor: 0.35,
      /**
       * Sideways shove on impact, in rad/s of lateral velocity.
       *
       * Amit: "I'm running into a barricade -- if you hit it on the side it
       * looks okay, but if you hit it in the middle you just go through it.
       * Try to see if we can push him to the side as well as slowing him."
       *
       * He is describing the tell that it is not solid. The crash zeroed
       * thetaVel, so the rider stopped dead ON the barrier's line and then
       * carried straight down it -- through the thing that just hit them.
       * Deflecting says the barrier has a shape and a side, which is the
       * difference between an obstacle and a trigger volume.
       *
       * 0.26 rad/s against the controller's 1.69 damping settles about 0.15
       * rad out, roughly 7 units at this radius. The barrier is 4 wide, so that
       * is clear of it and no further -- a nudge off your line, not a throw
       * across the hill. It was 0.55 first, which moved the rider 13 units:
       * unmistakably past the barrier and unmistakably too much.
       */
      deflect: 0.26,
    },
    label: 'BLOCKED',
  },

  // --- hazards -----------------------------------------------------------
  cone: {
    kind: 'hazard',
    size: { w: 0.55, h: 0.8, l: 0.55 },
    colour: 0xffd23f,
    accent: 0xfff6c4,
    hazard: { wobble: 9, scrub: 0.14 },
    label: 'CONE',
  },
  pothole: {
    kind: 'hazard',
    size: { w: 2.2, h: 0.05, l: 2.6 },
    colour: 0x1b1640,
    accent: 0x1b1640,
    hazard: { wobble: 14, scrub: 0.2 },
    label: 'POTHOLE',
  },
  roadwork: {
    kind: 'hazard',
    size: { w: 2.6, h: 1.0, l: 0.5 },
    colour: 0xffd23f,
    accent: 0x1b1640,
    hazard: { wobble: 16, scrub: 0.24 },
    label: 'BARRIER',
  },
  // --- scenery -----------------------------------------------------------
  // Only the lip lamps remain as scenery. Palms, bushes and buildings were
  // removed: they were flat-road furniture and looked absurd sprouting from the
  // rim of a half-pipe in the sky.
  lamp: { kind: 'scenery', size: { w: 0.24, h: 6.5, l: 0.24 }, colour: 0x5b4f9e, accent: 0xd8f4ff },

  // --- pickups -------------------------------------------------------------
  // What the missions mode asks you to collect. Given their own KIND rather
  // than being scenery you happen to touch, so a mode can switch them on and
  // off with the same allowed-kinds filter that turns hazards off, and so a
  // pickup can never be mistaken for something you ride.
  //
  // Colour follows the palette's functional rule -- every hue already means
  // something (cyan paint, green grindable, magenta boundary, violet launcher,
  // yellow hazard, red player), so pickups take WHITE-GOLD, the one bright
  // value left, and they glow rather than sitting flat so they read as
  // "collect me" rather than "avoid me".
  crystal: {
    kind: 'pickup',
    // WIDE rather than tall. The rider approaches along the road and reaches
    // laterally, so width is what makes a crystal look catchable and height is
    // mostly wasted on it -- a narrow gem read as a distant speck at the range
    // you actually have to commit to the carve.
    size: { w: 1.15, h: 1.25, l: 1.15 },
    colour: 0xffb43c,
    accent: 0xffe89a,
    // `height` is where it floats above the surface, and `reach` how far above
    // or below that the rider may be and still take it. Chest height with a
    // generous reach: a crystal on the deck should not need a hop.
    pickup: { type: 'crystal', points: 120, catchWidth: 3.4, height: 0.9, reach: 2.2 },
    label: 'CRYSTAL',
  },

  /**
   * A STONE IDOL -- the rare one.
   *
   * Amit, on what missions should ask for: "the mission needs to introduce new
   * content every time... I need to collect some statues or big stuff. But it's
   * not every second that you can get one, it's every now and then."
   *
   * That second sentence is the whole design and it is the part a normal pickup
   * cannot express. A crystal is texture -- there are twenty of them in every
   * pattern and collecting one is a rhythm, not a decision. This is the
   * opposite: roughly one every three or four patterns, worth fifteen crystals,
   * and always placed somewhere that costs you something to reach. Seeing one is
   * meant to change your line for the next four seconds.
   *
   * A SEPARATE pickup `type`, not just a bigger crystal, so a mission can count
   * idols without counting crystals -- which is what makes "collect 3 idols" a
   * different objective from "collect 30 crystals" rather than a scaled one.
   */
  statue: {
    kind: 'pickup',
    /**
     * A TOTEM STANDING ON THE GROUND, not a thing hovering over it.
     *
     * Amit: "the idols look really bad... they're floating way up in the air,
     * looks like I might be missing them from going under them, though I'm not.
     * Maybe they need to be taller and reach the floor."
     *
     * Both halves of that are real. It floated 2.2 units up because every
     * pickup does -- a crystal is a gem you reach for and hovering says so --
     * but a four-metre figure hanging in mid-air says nothing except that it
     * has come loose. Worse, hovering invents a gap under it, and a gap the
     * player can see is a gap they will try to ride through; being collected
     * anyway then reads as the collider being wrong rather than generous.
     *
     * So it is grounded and much taller: 7 units, planted, unmissable from a
     * long way up the hill -- which is what a thing worth changing your line
     * for has to be.
     *
     * COLOUR. It was pale cyan, which is the hue this game spends on PAINT --
     * the guide stripes and the centreline. The one object you are meant to
     * cross the hill for was dressed as a road marking. It is dark stone with
     * amber inlay now, and the amber is the crystal's own hue: same currency,
     * much bigger. The dark body is what makes the glow read at distance.
     */
    size: { w: 2.4, h: 7.0, l: 2.4 },
    colour: 0x2e2338, // dark stone, so the inlay carries
    accent: 0xffb43c, // the crystal's amber -- same currency, larger denomination
    pickup: {
      type: 'idol', points: 1800, catchWidth: 4.2,
      // Grounded: what you see standing on the hill is what you ride into.
      height: 0,
      // Generous vertically because it is seven units tall -- clipping its
      // shoulder should count, and so should sailing over it off a drop.
      reach: 5.0,
      // No bob. A crystal bobbing reads as a floating gem; a planted monument
      // bobbing reads as a bug.
      grounded: true,
    },
    label: 'IDOL',
  },

  // --- speed boost -------------------------------------------------------
  // Its OWN kind, not another pickup. Kinds are how a course decides what may
  // spawn, so giving the boost its own means the race can have boosts without
  // crystals and the missions can have crystals without boosts -- no mode has
  // to filter anything itself.
  //
  // Read as a PAD on the road rather than a floating object: it is something
  // you steer onto, and a thing at chest height would compete with the crystals
  // for what "collectable" looks like.
  boostPad: {
    kind: 'boost',
    // Width IS the gap between the gate posts, and the catch width matches it
    // -- what you see is what you have to ride through.
    size: { w: 4.2, h: 2.9, l: 3.2 },
    colour: 0x00e5ff,
    accent: 0xffffff,
    // A SUSTAINED overspeed, not a spike. Measured: a one-off +11 u/s was worth
    // 14 m over three seconds because drag ate it almost immediately, while
    // carving for the same three seconds costs 44.7 m -- so steering for a pad
    // was strictly worse than ignoring it, and a bot that chased them finished
    // last by 1.3 km. Held for `seconds`, +13 is worth roughly 35 m, which is
    // worth roughly 55 m. That number is not a preference, it is solved against
    // two measurements: carving costs ~15 m per second of progress, and a pad at
    // 0.2W needs about a second of carve each way to reach, so anything under
    // ~30 m is a trap. At 13 u/s it WAS a trap -- a bot that took 18 pads
    // finished a place BELOW one that ignored them.
    //
    // `ceiling` is the absolute cap, and it is not optional: the floor is set
    // from the CURRENT speed, so back-to-back pads compounded without bound --
    // 38 -> 51 -> 64 -> 77 -- and a bot that simply held forward covered 8.4 km
    // in ninety seconds and beat the field by nearly five kilometres.
    // catchWidth is the gate's own half-width plus a little: the posts sit at
    // +-w/2, so anything that touches the FRAME counts. Tying it to the size
    // rather than typing a number keeps the collider and the thing you can see
    // from drifting apart.
    boost: { speed: 16, seconds: 2.8, points: 60, catchWidth: 2.4, ceiling: 44, height: 0 },
    label: 'BOOST',
  },

  // The same gate, hung in the AIR just past a ramp lip. `height` is what makes
  // it a different thing: a gate on the road is taken by steering, and this one
  // can only be taken by being airborne at the right moment, so the reward for
  // committing to a ramp is not just the trick.
  airGate: {
    kind: 'boost',
    size: { w: 4.2, h: 2.9, l: 3.2 },
    colour: 0xffd166,
    accent: 0xffffff,
    boost: {
      // `height` is where the arch's BASE hangs; its top is height + size.h,
      // and that whole span is what counts as passing through it (see
      // withinGateArch). There is no separate reach to drift out of step.
      speed: 18, seconds: 3.0, points: 120, catchWidth: 2.6, ceiling: 48,
      height: 2.6,
    },
    label: 'AIR GATE',
  },

  // Same crystal, parked out of reach of a rider on the ground. This is a
  // separate TYPE rather than a per-instance height so the reward stays legible
  // -- you can see from the road that it is up there, and only real air gets it.
  highCrystal: {
    kind: 'pickup',
    size: { w: 1.15, h: 1.25, l: 1.15 },
    colour: 0xffb43c,
    accent: 0xffe89a,
    // The reach has to cover the arcs that actually reach it. These are placed
    // over ramp landings to be taken IN THE AIR, and a backflip now peaks around
    // 5.0-5.6 -- against height 3.1 the old reach of 2.0 topped out at 5.1, so
    // taking one at the apex of a flip failed by a couple of tenths. That is the
    // same mismatch the boost gates had: a collider tuned before the air heights
    // moved, and intermittent because it depends where in the arc you cross.
    pickup: { type: 'crystal', points: 260, catchWidth: 3.6, height: 3.1, reach: 2.7 },
    label: 'HIGH CRYSTAL',
  },
};

// ---------------------------------------------------------------------------
// PATTERNS
//
// Props are emitted in authored GROUPS rather than sprinkled uniformly, so the
// descent reads as a sequence of deliberate set-pieces -- a rail run, a slalom,
// a jump line -- instead of noise. Each pattern returns props positioned
// relative to its own start, in (ds, u) where ds is metres past the pattern's
// start and u is lateral offset from the centreline.
//
// `W` is the ridable half-width, passed in so patterns scale with the road.
// ---------------------------------------------------------------------------

export const PATTERNS = [
  {
    name: 'rail run',
    length: 70,
    build: (W) => [
      { type: 'rail', ds: 0, u: -W * 0.35 },
      { type: 'rail', ds: 26, u: W * 0.35 },
      { type: 'cone', ds: 14, u: 0 },
      // Strung ALONG the rail line, drifting from one rail to the next, so the
      // reward for taking the crystals is the same carve that sets up the
      // second rail. Crystals sitting on the centreline collect themselves.
      { type: 'crystal', ds: 10, u: -W * 0.34 },
      { type: 'crystal', ds: 16, u: -W * 0.14 },
      { type: 'crystal', ds: 21, u: W * 0.1 },
      { type: 'crystal', ds: 40, u: W * 0.3 },
      { type: 'kicker', ds: 50, u: -W * 0.35 },
    ],
  },
  {
    name: 'jump line',
    length: 85,
    build: (W) => [
      { type: 'kicker', ds: 0, u: -W * 0.25 },
      { type: 'kicker', ds: 26, u: W * 0.25 },
      { type: 'bigKicker', ds: 56, u: 0 },
      { type: 'boostPad', ds: 14, u: -W * 0.15 },
      { type: 'woodWall', ds: 40, u: W * 0.26 },
      // Just past the big kicker's lip, where the arc actually is.
      { type: 'airGate', ds: 64, u: 0 },
      // Far enough past the kicker to get the speed back before committing.
      { type: 'barrel', ds: 78, u: -W * 0.2 },
      { type: 'cone', ds: 40, u: -W * 0.6 },
      { type: 'cone', ds: 44, u: -W * 0.6 },
      // Parked just past each kicker's lip: reachable in the air, so a jump
      // taken properly pays twice.
      { type: 'crystal', ds: 9, u: -W * 0.25 },
      { type: 'highCrystal', ds: 35, u: W * 0.25 },
      { type: 'crystal', ds: 67, u: 0 },
    ],
  },
  {
    name: 'slalom',
    length: 80,
    build: (W) => {
      const out = [];
      for (let i = 0; i < 7; i++) {
        out.push({ type: 'cone', ds: i * 10, u: (i % 2 ? 1 : -1) * W * 0.28 });
        out.push({ type: 'crystal', ds: i * 10 + 5, u: (i % 2 ? -1 : 1) * W * 0.3 });
      }
      out.push({ type: 'pothole', ds: 34, u: 0 });
      out.push({ type: 'boostPad', ds: 45, u: -W * 0.33 });
      return out;
    },
  },
  {
    name: 'rail plaza',
    length: 90,
    build: (W) => [
      // WAS TWO LEDGES. Amit: "there are two types of glide right now... lose
      // the wider one for now, I'll replace it with another one." The wide
      // 1.5-unit block and the thin 0.16 bar read as two grindables that behave
      // the same, and the block is the one that looks like street furniture on
      // a mountain face. Its TYPE stays defined and unused -- there is a
      // replacement coming, and re-adding it should be one word here.
      { type: 'rail', ds: 0, u: -W * 0.5 },
      { type: 'rail', ds: 0, u: W * 0.5 },
      { type: 'bank', ds: 40, u: 0 },
      { type: 'boostPad', ds: 74, u: W * 0.30 },
      { type: 'woodWall', ds: 46, u: -W * 0.28 },
      { type: 'hydrant', ds: 20, u: -W * 0.78 },
      { type: 'hydrant', ds: 60, u: W * 0.78 },
      { type: 'roadwork', ds: 68, u: -W * 0.2 },
      { type: 'crystal', ds: 12, u: -W * 0.5 },
      { type: 'crystal', ds: 52, u: W * 0.5 },
    ],
  },
  {
    name: 'gauntlet',
    length: 95,
    build: (W) => [
      { type: 'roadwork', ds: 0, u: -W * 0.55 },
      { type: 'roadwork', ds: 30, u: W * 0.5 },
      { type: 'longRail', ds: 20, u: W * 0.1 },
      { type: 'boostPad', ds: 48, u: -W * 0.16 },
      { type: 'woodWall', ds: 12, u: W * 0.30 },
      { type: 'pothole', ds: 62, u: -W * 0.45 },
      { type: 'cone', ds: 70, u: -W * 0.2 },
      { type: 'cone', ds: 74, u: W * 0.05 },
      { type: 'pothole', ds: 78, u: -W * 0.15 },
      // On the rail itself -- take the grind and they come free.
      { type: 'crystal', ds: 26, u: W * 0.1 },
      { type: 'crystal', ds: 34, u: W * 0.1 },
    ],
  },
  {
    name: 'big air',
    length: 100,
    build: (W) => [
      { type: 'bank', ds: 0, u: -W * 0.4 },
      { type: 'bank', ds: 0, u: W * 0.4 },
      { type: 'barrel', ds: 44, u: 0 },
      { type: 'longRail', ds: 66, u: 0 },
      { type: 'boostPad', ds: 24, u: W * 0.34 },
      { type: 'woodWall', ds: 76, u: -W * 0.24 },
      // Off the vert wall, which is the biggest arc on the course.
      { type: 'airGate', ds: 56, u: 0 },
      // Over the big kicker's landing: only reachable with real height.
      { type: 'highCrystal', ds: 54, u: 0 },
      { type: 'highCrystal', ds: 60, u: 0 },
    ],
  },
  {
    name: 'breather',
    // Deliberate empty stretch. Density everywhere is exhausting and leaves the
    // player no room to just feel the speed, which is the point of the game.
    length: 55,
    build: (W) => [{ type: 'boostPad', ds: 28, u: W * 0.26 }],
  },
];

/**
 * FACE PATTERNS -- content authored FOR a wide hill, spread across ALL of it.
 *
 * THE RULE, in Amit's words: "I generally want the stuff scattered along the
 * road. I would have to move left and right to avoid stuff everywhere, and I
 * could meet stuff to do everywhere -- on the outer lines, in the middle, and
 * in the middle of the middle."
 *
 * That is a correction to what these patterns were, and worth recording. The
 * first version answered "I can just stay in the middle and go through the
 * ride" by making the middle pay nothing and putting a wall of blockers down
 * it, with every reward pushed to the rims. Measured, that produced three
 * segregated zones -- 10 of 12 barriers inside 20% of centre, 14 of 17 ramps in
 * the single band at 60-80%, and mid-field nearly empty of everything. It did
 * stop you riding the centreline, but for the wrong reason: not because the
 * hill was full and you had to work through it, but because two thirds of the
 * hill were bare.
 *
 * SO WEAVING COMES FROM ALTERNATION, NOT FROM EMPTINESS. Every band carries
 * every kind of thing -- barriers, ramps, rails and pickups at the centreline,
 * at mid-field and out at the rim alike -- and consecutive items along the
 * course alternate SIDES. Hold any fixed line and the hill is busy but you
 * catch only a fraction of it; move with the content and you get all of it.
 * That is a better answer than a bare corridor, because the reason to leave the
 * middle is now that something better is elsewhere, rather than that the middle
 * is a punishment.
 *
 * Authored against the true rim, so `spread` must be 1 on any terrain using
 * this set -- scaling a table that already reaches 0.95 would only clamp it.
 */
export const FACE_PATTERNS = [
  {
    // A full sweep rim to rim, with something to do at every depth on the way
    // across rather than only at the two ends.
    name: 'the crossing',
    length: 120,
    build: (W) => [
      { type: 'crystal', ds: 6, u: -W * 0.88 },
      { type: 'boostPad', ds: 36, u: -W * 0.66 },
      { type: 'kicker', ds: 14, u: -W * 0.52 },
      { type: 'blocker', ds: 20, u: -W * 0.14 },
      { type: 'crystal', ds: 26, u: W * 0.34 },
      { type: 'rail', ds: 32, u: W * 0.70 },
      { type: 'rail', ds: 78, u: -W * 0.50 },
      { type: 'blocker', ds: 44, u: W * 0.92 },
      { type: 'crystal', ds: 50, u: W * 0.10 },
      { type: 'bigKicker', ds: 58, u: -W * 0.38 },
      { type: 'blocker', ds: 66, u: -W * 0.76 },
      { type: 'crystal', ds: 74, u: -W * 0.22 },
      { type: 'kicker', ds: 84, u: W * 0.16 },
      { type: 'crystal', ds: 92, u: W * 0.60 },
      { type: 'blocker', ds: 100, u: W * 0.30 },
      { type: 'statue', ds: 112, u: W * 0.90, rare: 2 },
    ],
  },
  {
    // Gates at three different depths, so which gap you take is decided at the
    // rim, at mid-field and on the centreline in turn.
    name: 'three gates',
    length: 110,
    build: (W) => [
      { type: 'blocker', ds: 12, u: -W * 0.86 },
      { type: 'boostPad', ds: 44, u: W * 0.32 },
      { type: 'crystal', ds: 18, u: -W * 0.44 },
      { type: 'rail', ds: 24, u: W * 0.06 },
      { type: 'longRail', ds: 68, u: -W * 0.72 },
      { type: 'blocker', ds: 36, u: W * 0.48 },
      { type: 'crystal', ds: 42, u: W * 0.88 },
      { type: 'kicker', ds: 50, u: W * 0.26 },
      { type: 'blocker', ds: 58, u: -W * 0.10 },
      { type: 'crystal', ds: 64, u: -W * 0.62 },
      { type: 'barrel', ds: 74, u: -W * 0.90 },
      { type: 'blocker', ds: 84, u: -W * 0.34 },
      { type: 'crystal', ds: 92, u: W * 0.20 },
      { type: 'rail', ds: 100, u: W * 0.66 },
    ],
  },
  {
    // A ladder worked outward and back, so the run passes through every band
    // twice instead of hugging one edge.
    name: 'the ladder',
    length: 130,
    build: (W) => [
      { type: 'crystal', ds: 8, u: W * 0.12 },
      { type: 'boostPad', ds: 64, u: W * 0.22 },
      { type: 'blocker', ds: 16, u: -W * 0.30 },
      { type: 'longRail', ds: 24, u: W * 0.44 },
      { type: 'crystal', ds: 34, u: W * 0.78 },
      { type: 'blocker', ds: 44, u: W * 0.20 },
      { type: 'kicker', ds: 52, u: -W * 0.24 },
      { type: 'crystal', ds: 60, u: -W * 0.68 },
      { type: 'blocker', ds: 70, u: -W * 0.94 },
      { type: 'rail', ds: 80, u: -W * 0.40 },
      { type: 'rail', ds: 112, u: W * 0.62 },
      { type: 'crystal', ds: 88, u: W * 0.04 },
      { type: 'bigKicker', ds: 98, u: W * 0.50 },
      { type: 'blocker', ds: 108, u: W * 0.84 },
      { type: 'crystal', ds: 118, u: W * 0.32 },
      { type: 'statue', ds: 126, u: -W * 0.86, rare: 3, rarePhase: 1 },
    ],
  },
  {
    // Alternating turns at varying depth -- some gates near the centreline,
    // some out wide, so the weave is never the same amplitude twice.
    name: 'slalom',
    length: 140,
    build: (W) => {
      const at = [-0.18, 0.54, -0.86, 0.22, -0.50];
      const out = [];
      at.forEach((u, i) => {
        out.push({ type: 'blocker', ds: 18 + i * 26, u: u * W });
        out.push({ type: 'crystal', ds: 30 + i * 26, u: -u * 0.72 * W });
      });
      out.push({ type: 'kicker', ds: 40, u: W * 0.80 });
      out.push({ type: 'boostPad', ds: 96, u: -W * 0.70 });
      out.push({ type: 'rail', ds: 74, u: -W * 0.08 });
      out.push({ type: 'rail', ds: 24, u: W * 0.44 });
      out.push({ type: 'longRail', ds: 118, u: W * 0.16 });
      out.push({ type: 'bigKicker', ds: 108, u: -W * 0.62 });
      out.push({ type: 'kicker', ds: 132, u: W * 0.36 });
      return out;
    },
  },
  {
    // Looser, and the breather in the set -- but busy at every depth rather
    // than clear down the middle.
    name: 'open ground',
    length: 120,
    build: (W) => [
      { type: 'kicker', ds: 10, u: W * 0.02 },
      { type: 'boostPad', ds: 30, u: W * 0.44 },
      { type: 'crystal', ds: 20, u: -W * 0.56 },
      { type: 'blocker', ds: 28, u: -W * 0.88 },
      { type: 'crystal', ds: 36, u: -W * 0.16 },
      { type: 'rail', ds: 46, u: W * 0.58 },
      { type: 'rail', ds: 88, u: -W * 0.64 },
      { type: 'blocker', ds: 56, u: W * 0.14 },
      { type: 'crystal', ds: 64, u: W * 0.86 },
      { type: 'bigKicker', ds: 74, u: W * 0.40 },
      { type: 'blocker', ds: 84, u: -W * 0.46 },
      { type: 'crystal', ds: 94, u: -W * 0.80 },
      { type: 'longRail', ds: 104, u: -W * 0.12 },
      { type: 'crystal', ds: 114, u: W * 0.24 },
      // A THIRD idol in the cycle. Two was "every now and then" and nothing
      // more: under the rareAlways override a mission built entirely around
      // finding them still only met about three a minute, which does not
      // support asking for five. Three placements puts it near five a minute
      // with the override on, and still under two a minute at the authored
      // cadence -- so the incidental case does not become a parade.
      { type: 'statue', ds: 58, u: -W * 0.92, rare: 3 },
    ],
  },
];

