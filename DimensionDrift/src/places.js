// PLACES — where on the mountain a run happens, and in what light.
//
// The second lobby screen, and the seam that "more levels" will be built on.
// Ported in shape from HillBombSunsetRidge, which splits a location into three
// axes on purpose — COURSE (what is on the ground), THEME (what it looks like)
// and TERRAIN (the shape of the ground) — so that a new palette never forces a
// new course. carve does not need three yet; it needs the seam to exist before
// the content does, the same way `modes/mode.js` existed before there were two
// modes.
//
// ── WHAT A PLACE MAY OWN, AND WHY IT IS NOT THE SEED ────────────────────────
//
// The obvious lever is `SEED` (main.js), which feeds the terrain, the far
// range, the scatter, the kicker plan and the gate plan. It is also the WRONG
// one to reach for first: all five of those are built ONCE at load, so a
// per-run seed means rebuilding the terrain mesh, re-planning every gate and
// re-integrating the reference run on every trip through the lobby. That is a
// real feature and it is not this one.
//
// Two axes already work per run, with no rebuild at all:
//
//   OFFSET  the mountain is ANALYTIC in `p` — `slopeAt`, `centerX`, `relief`,
//           the scatter bands and the pickup bands are all pure functions of
//           distance — and it has been ridden to 1,000,000 m. So a different
//           stretch IS different terrain: different steeps, different meander,
//           a different far range past it. The race already proves this works;
//           it draws a random offset every run for replayability.
//
//   HOURS   the mood's five stops (first light, sunrise, bluebird, squall,
//           alpenglow) are colour tables that the snow, rock, fog, sky and sun
//           shaders all read. A place that narrows which stops it draws from
//           changes the light without touching a line of code.
//
// So a place is a REGION plus a LIGHT, and both compose with what the modes
// already do rather than fighting it: the mode still randomises within the
// region, so two races in the same place are still two different races.
//
// ── WHAT A PLACE MAY NOT DO ────────────────────────────────────────────────
//
// It must not recolour anything that carries MEANING. HillBomb's themes file
// is explicit about this and it applies here exactly: purple is a boost gate,
// acid green is the player's board, dark is a tree you will hit, chequered is
// the finish. A place that repainted those would make every level a new visual
// language to learn. The world changes; the vocabulary on it does not.

/** @type {Map<string, object>} */
const registry = new Map();

/**
 * ── WHAT A PLACE MAY SET, AND WHY THESE FOUR ────────────────────────────────
 *
 * Colour and hour alone were not enough -- "we need to change something
 * drastically to make it feel different" -- and the four knobs below are the
 * ones that change how a stretch PLAYS rather than how it looks:
 *
 *   trees      the forest narrows the line you can hold, and in the race it is
 *              what breaks a boost chain. Slots are allocated to TREES_CAP and
 *              a place uses as many as it wants of them.
 *   obstacles  trees planted ON the racing line, per band. Race only.
 *   fog        a multiplier on the hour's own fog. How far ahead the mountain
 *              can be read is a different game at speed, not a palette.
 *   treeClump  0 an even spatter, 1 thickets with gaps between them
 *   treeReach  how far out the forest sits; under 1 it crowds the corridor
 *   obstacleU  how wide the race's blockers scatter across the racing line
 *   gateAmp    how far from the centre a gate may sit -- the BOOSTERS' layout:
 *              low is a tight rhythmic weave, high is full traverses
 *   rangeProfile  which SKYLINE: 'ridges' the rolling massifs this game has
 *              always had, 'spires' few very steep peaks, 'bluffs' a long low
 *              flat horizon. See `RANGE_PROFILES` in range.js -- they are a
 *              table of pyramid heights and gradients, not art.
 *   range      how much of the far massif is above the horizon: 1 the range
 *              this game has always had, 0 bare sky. It is the single largest
 *              change in the frame for the least work -- see `setPresence`.
 *   valley     how far the valley sides close in, 0 open to 1 a gorge, and it
 *              breathes along the descent on a ~2.7 km wavelength so a run
 *              rides through it rather than sitting in one shape. It moves the
 *              WALLS and the meander, never the rideable width -- see the note
 *              on `setValleyScale`.
 *   kickerGap  metres of clear run the planner must leave between jumps, so
 *              LOWER is more airtime; `kickerEnergy` is how hard the track has
 *              to be leaning on a beat before one goes there, so lower is also
 *              more. Re-planned per run, which is cheap: a pure function of the
 *              beat grid, the reference run and a seed.
 *
 * Anything omitted keeps the value the game boots with, so adding a key here
 * never silently re-tunes the places that do not mention it.
 *
 * @param {{id:string, name:string, tagline:string, order?:number,
 *          hidden?:boolean, offset:[number,number], hours:number[],
 *          trees?:number, obstacles?:number, fog?:number, valley?:number,
 *          range?:number, rangeProfile?:string, treeClump?:number, treeReach?:number, obstacleU?:number,
 *          gateAmp?:number,
 *          kickerGap?:number, kickerEnergy?:number, kickerBars?:number}} def
 */
export function registerPlace(def) {
  registry.set(def.id, def);
  return def;
}

/** What the second lobby screen offers, in the order it should read. */
export function listPlaces() {
  return [...registry.values()]
    .filter((p) => !p.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getPlace(id) {
  return registry.get(id) ?? registry.values().next().value;
}

export function defaultPlaceId() {
  return listPlaces()[0]?.id ?? registry.keys().next().value;
}

/**
 * Metres down the mountain this run starts at.
 *
 * Drawn inside the place's own band, so the place is a character rather than a
 * fixed course: the same place twice is the same KIND of mountain and not the
 * same hundred metres of it.
 */
export function pickOffset(place) {
  const [lo, hi] = place.offset;
  return lo + Math.random() * (hi - lo);
}

/**
 * Which mood stop this run sits in, as a cycle fraction in [0,1].
 *
 * The same no-repeat rule the race's hour already uses, for the same reason: a
 * uniform draw gives the same morning twice in a row often enough to be
 * noticed, and the player experiences the next run rather than the
 * distribution.
 */
const STOPS = 5;
let lastHour = -1;
export function pickHour(place) {
  const hours = place.hours?.length ? place.hours : [0, 1, 2, 3, 4];
  let i = hours[Math.floor(Math.random() * hours.length)];
  if (i === lastHour && hours.length > 1) {
    const others = hours.filter((h) => h !== lastHour);
    i = others[Math.floor(Math.random() * others.length)];
  }
  lastHour = i;
  // Centred on the stop with a third of the gap either side, so the light is
  // recognisably that hour without being the same postcard every time.
  return (i + 0.5 + (Math.random() - 0.5) * 0.66) / STOPS;
}

// ── THE PLACES ──────────────────────────────────────────────────────────────
//
// NAMED AS PLACES, which the first set were not. FIRST LIGHT and WHITEOUT are
// an hour and a weather, and both of those are things a place HAS rather than
// things a place IS -- the mood label in the corner of the HUD already says
// "first light" when the light is that, so the word was on screen twice meaning
// two different things. A player picking a level is picking ground.
//
// Each name is now the thing you would actually see there: a bowl, a set of
// rock needles, a stand of near-black pine, a hollow with nothing visible out
// of it.
//
// Three, because one is not a screen and two is not a choice. They are far
// enough apart on the mountain to be different ground rather than three names
// for the same slope — the fall profile repeats on a long wavelength, so bands
// tens of kilometres apart genuinely differ in steepness and meander.
//
// The hours are what carries most of the character at this stage, and that is
// the honest ordering of effort: the palettes already exist and are tuned, and
// the terrain axis is where the next real work goes.

registerPlace({
  id: 'bowl',
  name: 'THE BOWL',
  tagline: 'the home slope',
  order: 0,
  /** The stretch carve has always been tuned and measured on. Every default. */
  offset: [0, 6000],
  hours: [0, 1],
  /** A little shape, so even the home slope is not a straight trough. */
  valley: 0.45,
});

registerPlace({
  id: 'needles',
  name: 'THE NEEDLES',
  tagline: 'bare rock and big air',
  order: 3,
  offset: [18000, 26000],
  hours: [2, 3],
  /** Above the treeline: almost nothing to hit, and the air to use it. */
  trees: 26,
  obstacles: 0.6,
  fog: 0.75,
  /** Wide open, and it stays wide -- this is the face you can see across. */
  valley: 0.1,
  /** Nothing to clump, and the few trees there are sit well back. The gates
   *  use the whole width because there is a whole width to use. */
  treeReach: 1.35,
  gateAmp: 1.3,
  /**
   * RINGED BY SPIRES. The col is the high place, so what stands above it has to
   * be the sharp stuff -- broad rolling massifs at this altitude would read as
   * the same valley again, higher up. Nearly full presence, because the whole
   * point of this skyline is that you can see it.
   */
  rangeProfile: 'spires',
  range: 0.88,
  /**
   * BARE ROCK ON THE LOWER NEEDLES. Above the snow line they stay white; below
   * it the steep faces show the rock they are made of, which is what makes a
   * spire read as rock with snow ON it rather than as a white shape. It is also
   * the only colour in the frame that is not snow, sky or fog.
   */
  rock: 0.85,
  snowLine: 150,
  obstacleU: 22,
  kickerGap: 62,
  kickerEnergy: 0.22,
  kickerBars: 0.5,
});

registerPlace({
  id: 'blackpine',
  name: 'BLACKPINE',
  tagline: 'a gorge full of trees',
  order: 2,
  offset: [9000, 15000],
  hours: [1, 3],
  /** The opposite place. Nearly three times the forest and four times the
   *  blockers, and no jumps to speak of -- there is nowhere to land. */
  trees: 165,
  obstacles: 2.6,
  fog: 1.15,
  /** A gorge with trees in it. The sides come to the rim and the line curves. */
  valley: 1.0,
  /** Thickets with lanes between them, crowding a corridor that is already a
   *  gorge -- and a tight weave, because there is no room for a traverse. */
  treeClump: 0.85,
  treeReach: 0.88,
  /**
   * A LONG LOW FAR SIDE. Deep in the valley you are looking ACROSS at the other
   * wall rather than up at a range, so the skyline is bluffs: flat, level, and
   * boring on purpose -- it is the trees that are the subject here, and a
   * jagged horizon above them would compete with them for the frame.
   */
  rangeProfile: 'bluffs',
  range: 1,
  /**
   * ── A ROAD THROUGH IT, AND A REASON TO CROSS ──────────────────────────
   * Was 6 blockers at +/-8 m with the gates weaving at 0.55, which put the
   * trees and the boosters in the same narrow strip -- one lane, every gate
   * already in it, and nothing to be gained by leaving. Now the middle 7 m is
   * clear and the blockers stand in the flanks out to 18, while the gates swing
   * to the full width: the path is what you ride and the gates either side are
   * why you keep crossing it.
   */
  gateAmp: 1.0,
  obstacleU: 18,
  obstacleGap: 7,
  kickerGap: 900,
});

registerPlace({
  id: 'hollow',
  name: 'THE HOLLOW',
  tagline: 'no horizon at all',
  order: 1,
  offset: [34000, 42000],
  hours: [4, 0],
  /** Not dense, just unreadable. The trees are ordinary; the distance you can
   *  see one from is not. */
  trees: 110,
  obstacles: 2.4,
  fog: 2.6,
  valley: 0.7,
  /** Loosely grouped, so a stand looms out of the fog as one thing rather than
   *  as a slow drizzle of single trunks. */
  treeClump: 0.5,
  gateAmp: 0.9,
  /** There is no far view in a whiteout. Even the fog has nothing to grade
   *  into, which is the point of it. */
  range: 0,
  kickerGap: 320,
});
