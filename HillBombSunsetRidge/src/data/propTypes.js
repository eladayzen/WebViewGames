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
    launch: { power: 1.5, points: 260, profile: 'wedge' },
    label: 'BIG AIR',
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
      { type: 'cone', ds: 40, u: -W * 0.6 },
      { type: 'cone', ds: 44, u: -W * 0.6 },
    ],
  },
  {
    name: 'slalom',
    length: 80,
    build: (W) => {
      const out = [];
      for (let i = 0; i < 7; i++) {
        out.push({ type: 'cone', ds: i * 10, u: (i % 2 ? 1 : -1) * W * 0.28 });
      }
      out.push({ type: 'pothole', ds: 34, u: 0 });
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
      { type: 'hydrant', ds: 20, u: -W * 0.78 },
      { type: 'hydrant', ds: 60, u: W * 0.78 },
      { type: 'roadwork', ds: 68, u: -W * 0.2 },
    ],
  },
  {
    name: 'gauntlet',
    length: 95,
    build: (W) => [
      { type: 'roadwork', ds: 0, u: -W * 0.55 },
      { type: 'roadwork', ds: 30, u: W * 0.5 },
      { type: 'longRail', ds: 20, u: W * 0.1 },
      { type: 'pothole', ds: 62, u: -W * 0.45 },
      { type: 'cone', ds: 70, u: -W * 0.2 },
      { type: 'cone', ds: 74, u: W * 0.05 },
      { type: 'pothole', ds: 78, u: -W * 0.15 },
    ],
  },
  {
    name: 'big air',
    length: 100,
    build: (W) => [
      { type: 'bank', ds: 0, u: -W * 0.4 },
      { type: 'bank', ds: 0, u: W * 0.4 },
      { type: 'bigKicker', ds: 44, u: 0 },
      { type: 'longRail', ds: 66, u: 0 },
    ],
  },
  {
    name: 'breather',
    // Deliberate empty stretch. Density everywhere is exhausting and leaves the
    // player no room to just feel the speed, which is the point of the game.
    length: 55,
    build: () => [],
  },
];
