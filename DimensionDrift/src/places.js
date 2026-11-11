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
//   HOURS   the mood's five stops (void, portal rise, high xenon, ion storm,
//           red shift) are colour tables that the ground, rock, fog, sky and
//           key shaders all read. A place that narrows which stops it draws
//           from changes the light without touching a line of code.
//           "Hours" is carve's word for them and it has outlived its dimension
//           -- there is no sun here and nothing is an hour -- but it is the
//           field name on every place below, so renaming it is a separate
//           change from recolouring them.
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
export function listPlaces(all = false) {
  return [...registry.values()]
    /** `all` is `?all=1`. See the same argument on `listModes`. */
    .filter((p) => all || !p.hidden)
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
  /**
   * ── A LEVEL MAY LOCK ITS LIGHT, AND ONE DOES ──────────────────────────
   *
   * Everything below picks an hour at random and jitters it, and the mood
   * then WALKS through the rest of the day as the track plays. Two sources of
   * variation, so no two runs of a level were ever lit the same way.
   *
   * That is lovely for a descent you are looking at and ruinous for one you
   * are reading. Every hazard in this mode is a mark on the snow, and whether
   * a mark separates from snow depends entirely on the light falling on both
   * -- so a hazard tuned to be legible on one run was washed out on the next,
   * and the tuning could never converge because the target moved. It cost
   * several rounds before it was named.
   *
   * `lockHour` pins both: this value, and no walk. See `_moodAt` in main.js.
   */
  if (place.lockHour != null) return place.lockHour;
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
// NAMED AS PLACES, which the first set were not. FIRST LIGHT and WHITEOUT were
// an hour and a weather, and both of those are things a place HAS rather than
// things a place IS -- the mood label in the corner of the HUD already names
// the light when the light is that, so the word was on screen twice meaning two
// different things. A player picking a level is picking ground.
//
// Each name is the thing you would actually see there: an open basin, a field
// of standing shards, a gorge packed with crystal, a hollow with nothing
// visible out of it.
//
// THE IDS DO NOT CHANGE WITH THE NAMES. `bowl`, `needles`, `blackpine` and
// `hollow` are what `analytics.levelStarted` reports and what `lookqa.mjs`
// drives, so renaming them would break the continuity of every number already
// recorded against them and silently retheme nothing. The id is a key; the
// name is what a player reads. Only one of those is Dimension X's business.
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
  /**
   * PARKED WITH THE OTHER TWO. Only the shards are offered while they are the
   * level being worked on; `hidden` keeps the place registered and reachable
   * by id, so the harnesses and `?place=` still find it.
   */
  hidden: true,
  name: 'THE BASIN',
  tagline: 'the home ground',
  order: 0,
  /** The stretch this game has always been tuned and measured on. Every default. */
  offset: [0, 6000],
  hours: [0, 1],
  /** A little shape, so even the home ground is not a straight trough. */
  valley: 0.45,
  /**
   * HUE IN THE FAR RANGE, which the home ground had none of.
   *
   * `rock` is not about geology here, it is about colour: the range shader
   * tints and darkens the faces too steep to hold dust and below the line, and
   * with the tint now violet (see `uRockTint` in range.js) that is the only
   * way the biggest surface in the upper frame gets a hue of its own instead
   * of being a pale plate of whatever the fog is doing.
   *
   * Lower than the shards' 0.85 and with a higher line, because this is the
   * open place: the range is a backdrop here, not the subject.
   */
  rock: 0.9,
  /**
   * 400 PUTS THE LINE ABOVE EVERYTHING. `low` is 1 BELOW `snowLine`, so a line
   * over the tallest summit means elevation gates nothing and the tint lands
   * purely on the steepness term — the faces too steep to hold dust take the
   * violet, the flat tops stay the pale colour of the air. That is rock with
   * dust on its ledges. A line THROUGH the range, which is what the shards
   * want, gives the other picture: pale above, coloured below, which at this
   * distance is indistinguishable from a snow cap.
   */
  snowLine: 400,
  /**
   * NOT THE DEFAULT ROLLING MASSIFS. They are the alpine shape in `range.js`
   * and they occupy the top third of the frame. See `shatter` there.
   */
  rangeProfile: 'shatter',
  /**
   * THE BASIN IS THE NO-GROUND ONE: the original POC, flying with the floor
   * simply not drawn. See `_setGroundStyle` in main.js for everything that has
   * to go with the terrain, and why.
   *
   * Read only by a mode that asks — `experimentalGround` in
   * modes/shoulder.js. Chill vibe, the race and skirmish draw this place
   * exactly as they always have.
   */
  skyStyle: 'hidden',
});

/**
 * ── THE DRAIN ───────────────────────────────────────────────────────────────
 *
 * A sewer main, ridden from the inside. The only place in the game whose
 * corridor is a TUBE rather than an open face -- see `setPipeScale` in
 * mountain.js for what that does and, more importantly, for what it leaves
 * alone.
 *
 * NO TREES AND NO POLES. The scatter's three props are a conifer, a boulder
 * and a slalom marker, and two of those are absurd underground. The boulders
 * stay, as fallen masonry and debris washed down the pipe, and they stay at a
 * density well above any other place because in this mode they are not scenery
 * -- THEY ARE THE ENTIRE GAME. `obstacles` plants them on the ridden line
 * rather than beside it, which is the race's own mechanism reused rather than
 * a second one invented.
 *
 * THE ART IS PLACEHOLDER AND IS NOT PRETENDING OTHERWISE. A sewer wants ring
 * seams, grates, pipe mouths and standing water, and it has a rock. The SHAPE
 * is the thing being tried here; the dressing is the next piece of work.
 *
 * Fog is pulled in hard. A tunnel that can be seen to the horizon is not a
 * tunnel -- the whole tension of the mode is an obstacle arriving out of the
 * dark with just enough time to pick a side.
 */
registerPlace({
  id: 'drain',
  name: 'THE DRAIN',
  tagline: 'skate the storm main',
  order: 4,
  /** Parked with the pipe-skate mode it exists for. See the note on 'bowl'. */
  hidden: true,
  /** 1 is a full tube. See `setPipeScale`. */
  pipe: 1,
  /** No valley. A pipe has no distant sides; the wall term is faded out with it. */
  valley: 0,
  trees: 0,
  /**
   * DENSE, and set against the fact that nothing else in this mode can hurt
   * you. Every other place carries drones, a clock or a rival to supply the
   * pressure; here the rubble is the only thing between the player and a ride
   * with no decisions in it.
   */
  obstacles: 7,
  /** Across the whole floor and well up both transitions. */
  obstacleU: 0.74,
  /**
   * AND A GAP DOWN THE MIDDLE IS EXACTLY WHAT THIS MODE MUST NOT HAVE.
   * `obstacleGap` exists so a forest reads as two flanks with a road between
   * them; a road through the obstacles is a line the player can hold without
   * steering, which is the one outcome that makes a dodging game boring.
   */
  obstacleGap: 0,
  /**
   * DOWN FROM 2.1. That number was tuned for a mountain whose distance was
   * meant to dissolve; this level's whole point is a skyline you can see.
   */
  fog: 0.95,
  hours: [0.08, 0.22],
  offset: [1200, 5200],
  gateAmp: 0.6,
  skyStyle: 'solid',
});

registerPlace({
  id: 'needles',
  name: 'THE SHARDS',
  tagline: 'bare rock and big air',
  order: 3,
  offset: [18000, 26000],
  hours: [2, 3],
  /** Above the crystal line: almost nothing to hit, and the air to use it. */
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
   * BARE ROCK ON THE LOWER SHARDS. `snowLine` keeps its name because it is a
   * uniform read by a shader, but what it means here is the height above which
   * a face stays the pale colour of the air. Below it the steep faces take the
   * rock tint, which is what makes a spire read as rock with dust ON it rather
   * than as a pale shape, and it is the strongest hue in the frame that is not
   * sky or fog.
   */
  rock: 0.85,
  snowLine: 150,
  obstacleU: 22,
  kickerGap: 62,
  kickerEnergy: 0.22,
  kickerBars: 0.5,
  /**
   * AND THE NEEDLES ARE THE HOLOGRAM. "Use the geometry of the plain close to
   * me — not the one in the distance — but as a holographic energy field I can
   * ride on."
   *
   * The same mesh, the same vertices, the same streaming ring and the same
   * surface the rider is riding; only the fragment stage differs. See
   * HOLO_FRAG in `mountain.js` for the four things that make it read as a
   * field rather than as a texture, and why it ends at 190 m.
   *
   * It lands on THIS place rather than the basin on purpose: the spires
   * profile gives it a skyline of needles to be seen against, and a grid that
   * stops at 190 m needs something at the horizon or the frame has a hole in
   * the middle of it.
   *
   * `skyStyle` is read ONLY by a mode that asks for it — `experimentalGround`
   * in `modes/shoulder.js`. Chill vibe, the race and skirmish draw this
   * place's ground exactly as they always have, which is the only reason it is
   * safe to hang an experiment on a place three shipped modes also use.
   */
  /**
   * ── SOLID GROUND. THE HOLOGRAM IS WHAT WAS WRONG ──────────────────────
   *
   * This level was a holographic field you ride on -- the ground drawn as a
   * glowing white lattice rather than as a surface. It is a striking effect
   * and it is the single thing most responsible for the look being rejected:
   * a lattice has no material, so the dirt palette above had nowhere to land
   * (the mountain's uniforms were correctly brown and the floor still came out
   * white), and every hazard drawn ON the ground was competing with a ground
   * made of light.
   *
   * 'solid' puts the lit surface back, which is what the palette above is
   * written for. The holo path is untouched in main.js and mountain.js, and
   * the whole previous look is parked on `claude/dimension-drift-holo-look`.
   */
  skyStyle: 'solid',
  /**
   * ── LOCKED, AND THE NUMBER WAS MEASURED TWICE ─────────────────────────
   *
   * Swept the whole day in twentieths, sampling the slope a rider actually
   * reads -- under the horizon, centre third, ahead of the board.
   *
   * The first sweep asked only how much TEXTURE the ground has, and picked
   * 0.95. That was wrong, and wrong in an instructive way: 0.95 is the VOID
   * hour and its snow is purple-pink [179,165,194], so it had the most tonal
   * variation and the WORST hue separation from the hazards drawn on it. A
   * red wall on a pink slope is contrast on paper and mush on screen.
   *
   * The second sweep asked the question that matters -- how far the slope sits
   * in colour from the red of a barrier and the green of a drone mark:
   *
   *     hour  slope rgb        d(red) d(green)  texture
   *     0.95  [179,165,194]      205     192     0.192   <- most texture, worst colour
   *     0.50  [169,202,191]      232     172     0.139   <- green mark nearly invisible
   *     0.80  [222,206,198]      225     220     0.140   <- good colour, flat and bright
   *     0.20  [209,184,211]      221     219     0.158   <- best of both
   *
   * 0.20 it is: near the top for separation from BOTH hazard colours, and
   * still well-textured, with nothing blown out.
   *
   * WORTH NOTING WHAT THIS MEANS. 0.20 is where `hours` above was already
   * aiming. The light this place was art-directed to was never the problem --
   * the problem was that it was a RANGE, re-rolled every run and then walked
   * through the whole day as the track played, so a hazard tuned to read on
   * one descent was washed out on the next and the tuning could never
   * converge. Several rounds were lost to that before it was named.
   */
  lockHour: 0.20,

  /**
   * ── THE SITE: A CONSTRUCTION LOT UNDER A CITY SKY ─────────────────────
   *
   * "the style and look of the surrounding is so wrong ... go all in changing
   * the surrounding to more realistic vibe -- not photorealistic, just high
   * New York buildings far in the distance and in the sides around me, while
   * the route itself is a kind of construction site/area with dirt."
   *
   * The previous look -- alien violet ice under a portal sky -- is parked
   * whole on the branch `claude/dimension-drift-holo-look`, not deleted.
   *
   * Everything here is stated rather than mixed from the day arc, because
   * there is no hour of that alien mountain which is this. The notes that
   * matter:
   *
   * `uSnowColor` IS THE ROUTE. It is the surface the mountain shader reads,
   *   and the file's own warning applies -- the colour you see is this times
   *   the light, so it is authored a stop darker than dirt looks in the hand.
   * `uSparkle` GOES TO ZERO. It is snow glitter. Left on, the dirt twinkles.
   * `exposure` AND `bloom` BOTH COME DOWN hard. The old look earned its glow;
   *   a building site does not glow, and every hazard on this level is a mark
   *   on the ground that bloom was eating.
   */
  palette: {
    uSunColor: 0xffeedd,        // plain high daylight, barely warm
    uSkyColor: 0x8fa6bd,        // the fill, off a pale city sky
    uGroundColor: 0x6b5a46,     // bounce back up off churned earth
    uSnowColor: 0x7d6a53,       // THE DIRT. See the note above about light.
    uRockColor: 0x4c453d,       // wet clay and concrete in the cuts
    uFogColor: 0xb4bfc9,        // city haze, grey-blue, not white
    uFogSunColor: 0xd8d2c4,     // its lit side, dusty rather than golden
    uZenith: 0x5f7ea3,
    uHorizon: 0xc2cdd7,
    uSparkle: 0.0,
    uCloud: 0.42,
    bloom: 0.34,
    exposure: 1.12,
  },
});

registerPlace({
  // The id outlived the thing it was named after by one commit: this place was
  // a stand of near-black pine until the forest became crystal. It stays `blackpine`
  // because analytics has been counting runs under that key for months.
  id: 'blackpine',
  /** Parked. See the note on the basin's `hidden`. */
  hidden: true,
  name: 'GLASSWOOD',
  tagline: 'a gorge packed with crystal',
  order: 2,
  offset: [9000, 15000],
  hours: [1, 3],
  /** The opposite place. Nearly three times the forest and four times the
   *  blockers, and no jumps to speak of -- there is nowhere to land. */
  trees: 165,
  obstacles: 2.6,
  fog: 1.15,
  /** A gorge with a forest in it. The sides come to the rim and the line curves. */
  valley: 1.0,
  /** Thickets with lanes between them, crowding a corridor that is already a
   *  gorge -- and a tight weave, because there is no room for a traverse. */
  treeClump: 0.85,
  treeReach: 0.88,
  /**
   * A LONG LOW FAR SIDE. Deep in the valley you are looking ACROSS at the other
   * wall rather than up at a range, so the skyline is bluffs: flat, level, and
   * boring on purpose -- it is the forest that is the subject here, and a
   * jagged horizon above it would compete with it for the frame.
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
  /** Parked. See the note on the basin's `hidden`. */
  hidden: true,
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
