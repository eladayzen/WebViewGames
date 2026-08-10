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
  ledge: {
    kind: 'grind',
    size: { w: 1.5, h: 0.62, l: 14 },
    colour: 0x4ae08a,
    accent: 0x1a7a48,
    grind: { pointsPerSecond: 220, catchWidth: 1.9 },
    label: 'LEDGE',
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
      speed: 18, seconds: 3.0, points: 120, catchWidth: 2.6, ceiling: 48,
      height: 2.6, reach: 1.7,
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
    pickup: { type: 'crystal', points: 260, catchWidth: 3.6, height: 3.1, reach: 2.0 },
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
      { type: 'boostPad', ds: 20, u: W * 0.20 },
    ],
  },
  {
    name: 'jump line',
    length: 85,
    build: (W) => [
      { type: 'kicker', ds: 0, u: -W * 0.25 },
      { type: 'kicker', ds: 26, u: W * 0.25 },
      { type: 'bigKicker', ds: 56, u: 0 },
      { type: 'boostPad', ds: 14, u: -W * 0.19 },
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
      out.push({ type: 'boostPad', ds: 22, u: W * 0.20 });
      out.push({ type: 'boostPad', ds: 45, u: -W * 0.21 });
      return out;
    },
  },
  {
    name: 'ledge plaza',
    length: 90,
    build: (W) => [
      { type: 'ledge', ds: 0, u: -W * 0.5 },
      { type: 'ledge', ds: 0, u: W * 0.5 },
      { type: 'bank', ds: 40, u: 0 },
      { type: 'boostPad', ds: 74, u: W * 0.20 },
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
      { type: 'boostPad', ds: 48, u: -W * 0.22 },
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
      { type: 'boostPad', ds: 24, u: W * 0.19 },
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
    build: (W) => [{ type: 'boostPad', ds: 28, u: W * 0.18 }],
  },
];
