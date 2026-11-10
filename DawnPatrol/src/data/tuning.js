// Every gameplay constant in the build doc, in one file (§9.3).
//
// "Nothing anywhere else hardcodes a gameplay number." If you are about to
// type a number into a system, a player module or a spawn table, it belongs
// here instead -- the on-device tuning pass (§10, MVP-20) is meant to be a
// config session, not a code hunt.
//
// Design space is 1920x1080 (§5.1). Every px value below is in that space.

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

// ---------------------------------------------------------------------------
// §4 -- input and the height model
// ---------------------------------------------------------------------------

// The ONE input scalar's deadzone. Applied to the lateral tilt component only;
// the forward/back component is never read anywhere in this codebase (§0.2).
export const LEAN_DEADZONE = 0.10;

// Keyboard dev fallback ramps to +/-1 over this, so it approximates a lean
// rather than a step (§4). Dev convenience, not a second input path.
export const LEAN_KEY_RAMP_SEC = 0.25;

export const H_TRIM = 0.45;      // board-neutral resting line
export const H_SPAN = 0.55;      // full left lean targets the lip (0.45+0.55=1.00)
export const H_RATE_MAX = 0.34;  // /s -- full-face traverse in ~2.9 s
export const H_RESPONSE = 3.2;   // /s -- first-order lag constant
export const H_LAUNCH = 0.90;    // the face clamp; reaching it launches you

// Carve-sprite hysteresis, so the sprite does not strobe at the deadzone edge
// (§6.1). Enter a carve state above ENTER, fall back below EXIT.
// ZERO carve latency, per Amit on a playtest build: "there is a delay from
// input until the frame of the character change - lose the delay. set it on 0
// time." These were 0.22 / 0.12, a magnitude threshold plus hysteresis, which
// on keyboard cost ~0.09 s of lean ramp before the sprite flipped.
//
// Zero is safe here because LEAN_DEADZONE (0.10) is applied UPSTREAM in
// input.js: `lean` is already exactly 0 inside the deadzone, so board noise
// around neutral can never reach this test and flicker the frame. The deadzone
// is doing the anti-flutter job the hysteresis used to do.
export const CARVE_ENTER = 0;
export const CARVE_EXIT = 0;

// ---------------------------------------------------------------------------
// §5.2 / §5.3 -- scroll and the pacing contract
// ---------------------------------------------------------------------------

export const SCROLL_BASE = 864;   // px/s -- the report's measured 0.45 screen-widths/s
export const SCROLL_CAP = 1240;   // px/s -- the tuned ramp ceiling (§5.10)
export const SCROLL_MAX = 1352;   // px/s -- absolute ceiling, never exceeded

export const PLAYER_X = 0.25;     // fixed player column, never changes (§5.1)
export const SPAWN_X = 1.06;      // just off-frame right, so entities fade in
export const DESPAWN_X = -0.10;

// The travel from spawn edge to player column, in design px. Everything about
// the reaction floor is derived from this one number.
export const REACTION_SPAN_PX = (SPAWN_X - PLAYER_X) * DESIGN_W; // 1555.2

export const REACTION_FLOOR = 1.15;  // s -- hard floor, bounds the scroll ramp

export const H_GAP_MIN = 0.22;       // the gap floor (~171 px of face)
export const MAX_REQUIRED_MOVE = 0.50; // no group may demand a larger move
export const GAP_REACT_MARGIN = 0.30;  // s subtracted from reactionTime for reachability

export const HAZARD_GAP_DRIFT_MAX = 0.17; // /s -- a moving gap moves at half the player's rate

// Density caps (§5.3)
export const CAP_HAZARDS_ON_SCREEN = 6;
export const CAP_DISTINCT_BANDS = 4;
export const CAP_PUFFERS = 1;
export const MIN_GROUP_GAP_SEC = 0.9;
export const MIN_HAZARD_BAND = 0.06;
export const CAP_PICKUP_STRINGS = 3;

// ---------------------------------------------------------------------------
// §5.4 -- aerials
// ---------------------------------------------------------------------------

// AERIAL SPIN diverges from §5.4's table (AIR_MAX 3.40, SPIN_RATE 660), which
// specced 1-6 rotations per air. On a playtest build Amit read the top end as
// "rolling endlessly" -- 3.4 s at 660 deg/s is 6.2 rotations -- and asked for
// an air that leaves the water and comes back in. Halving the spin and
// shortening the arc gives a 1-2 rotation air (360 at a lazy drift, 720 at
// full commitment) while keeping §5.4's payout FORMULA and the "AIR_MIN never
// pays zero" guarantee intact. Knock-on: the trick ceiling drops from 2160 to
// 720, so top-end trick payouts are 3x smaller against the crew marks -- §12
// says scale trick payout and crew marks together here if the gap reads wrong.
export const AIR_MIN = 1.10;       // s -- a lazy drift over the lip
export const AIR_MAX = 2.20;       // s -- a full-commitment climb into the lip
export const SPIN_RATE = 330;      // deg/s
export const LAUNCH_COOLDOWN = 0.6;// s after landing before a new launch
export const CLIMB_AVG_WINDOW = 0.40; // s of dh/dt averaged for launch power
export const LANDING_IMMUNITY = 0.8;  // s of hazard immunity after a landing
export const AIR_PEAK_BASE = 0.06;    // y of the arc peak at full power
export const AIR_PEAK_SPAN = 0.10;    // ...plus this much at zero power
export const AIR_X_DRIFT = 0.10;      // she drifts right this much during the arc

// ---------------------------------------------------------------------------
// §5.5 / §5.6 -- pickups
// ---------------------------------------------------------------------------

// PICKUP RADII are deliberately much larger than the hazard hitbox
// (PLAYER_H_HALF 0.035 / PLAYER_X_HALF 26). Amit on a playtest build: the
// collider for good things should be bigger, for bad things it should stay as
// it is. So collecting is forgiving and getting hit is not -- near-misses on a
// coin arc read as collected, while hazards keep the tight box §6.1 specced.
export const COIN_PICK_H = 0.075;    // generous collection radius in h
export const COIN_PICK_X = 62;       // ...and in design px
export const COIN_ARC_MAX_SPAN = 0.45; // an arc may never span more of the face

export const ORB_PICK_H = 0.082;
export const ORB_PICK_X = 68;

export const SLOT_COUNT = 3;
export const SLOT_HOLD = 14;         // s from the last orb before one slot drops
export const SLOT_MULTIPLIERS = [1, 2, 3, 6]; // indexed by slots filled

// ---------------------------------------------------------------------------
// §5.7 -- the barrel section
// ---------------------------------------------------------------------------

export const BARREL_ENTRY = 1.2;     // s
export const BARREL_DURATION = 9.0;  // s
export const BARREL_EXIT = 1.0;      // s
export const BARREL_MULTIPLIER = 6;
export const BARREL_COOLDOWN = 20;   // s

// ---------------------------------------------------------------------------
// §5.8 -- the fail state
// ---------------------------------------------------------------------------

// 'leash3' | 'onehit'. MVP default is the three-wipeout leash; the one-hit path
// is kept behind this one flag so POC-7's A/B stays runnable on hardware
// without a rebuild (§5.8, §10). Do not delete the losing path.
export const FAIL_MODEL_DEFAULT = 'leash3';
export const WIPEOUTS_ALLOWED = 3;

export const TUMBLE_DURATION = 1.6;      // s, board input ignored
export const TUMBLE_IMMUNITY = 1.5;      // s of hazard immunity on recovery

// The player's own hitbox -- small and generous, deliberately far smaller than
// the drawn sprite. DO NOT scale this to the art (§6.1).
export const PLAYER_H_HALF = 0.035;
export const PLAYER_X_HALF = 26;         // design px

// ---------------------------------------------------------------------------
// §5.9 -- zones
// ---------------------------------------------------------------------------

export const ZONE_LENGTH_SEC = 22;                        // of scroll, per zone
export const ZONE_LENGTH = ZONE_LENGTH_SEC * SCROLL_BASE; // 19,008 world px
export const ZONE_CROSSFADE = 3.0;                        // s
export const ZONE_CAPTION_SEC = 1.5;

// ---------------------------------------------------------------------------
// §5.10 -- the difficulty ramp
// ---------------------------------------------------------------------------

export const RAMP_DURATION = 150;  // s of ride time, then flat forever

export const RAMP = {
  scroll:        { from: SCROLL_BASE, to: SCROLL_CAP },
  groupInterval: { from: 2.8, to: 1.35 },
  groupSize:     { from: 2, to: 4 },
  orbInterval:   { from: 11, to: 8 },
  coinInterval:  { from: 6, to: 4.5 },
  pufferInterval:{ from: Infinity, to: 30 },
};

export const PUFFER_FIRST_ALLOWED = 25; // s -- never before this
export const ONRAMP_SEC = 20;           // jellyfish only, one at a time

// ---------------------------------------------------------------------------
// §6.2 -- hazards, and the one trick target
// ---------------------------------------------------------------------------

export const HAZARDS = {
  jellyfish: { band: 0.08, xHalf: 46,  drift: 0.06 },
  rock:      { band: 0.20, xHalf: 54,  drift: 0 },
  timber:    { band: 0.07, xHalf: 390, drift: 0 },  // ~0.9 s of scroll wide
  puffer:    { band: 0.26, xHalf: 78,  drift: 0.17 },
};

export const PUFFER_TELEGRAPH_X = 0.92;   // holds station here...
export const PUFFER_TELEGRAPH_SEC = 1.5;  // ...for this long, with the ! bubble
export const PUFFER_CLOSE_MULT = 1.35;    // then closes at this x scroll speed
export const PUFFER_MIN_BUDGET = 2.6;     // s from first appearance to contact

export const SEABIRD_INTERVAL = 40;       // s
// Above crestY (so it is in the sky band), and capped so that the bird's whole
// traversal stays BELOW the TOP RUN panel's exclusion rect -- the report's one
// explicit HUD criticism of the reference is a pelican passing behind that
// panel, and we do not repeat it (§5.1). The validator re-derives this cap from
// the rail rather than trusting the number.
export const SEABIRD_H_RANGE = [1.02, 1.10];
// The airborne bounding-box test against the bird, in design px (§6.2).
export const SEABIRD_HIT_X = 92;
export const SEABIRD_HIT_Y = 78;
export const SEABIRD_BONUS = 2500;
export const SEABIRD_BONUS_DEGREES = 360;

// ---------------------------------------------------------------------------
// §8.1 -- scoring
// ---------------------------------------------------------------------------

export const SCORE_RATE = 1000;   // points/second while riding, x multiplier
export const COIN_VALUE = 250;    // x multiplier

// §8.3 -- the crew ladder's marks are authored constants, the same every run.
// (The names/portraits live in crew.js; the marks live here because they are
// a tuning relationship with SCORE_RATE -- §12 says scale both together.)
export const CREW_MARKS = [25000, 60000, 120000, 240000, 450000];

// ---------------------------------------------------------------------------
// §7.1 -- HUD
// ---------------------------------------------------------------------------

export const BANNER_MIN_SEC = 0.9;
export const BANNER_QUEUE_DEPTH = 3;
export const COIN_POP_CAP = 8;
export const TOPRUN_FADE_DIST = 80;   // px; airborne player within this fades the panel
export const TOPRUN_FADE_SEC = 0.2;
export const TOPRUN_FADE_ALPHA = 0.25;

export const SCORECARD_TIMEOUT = 12;  // s auto-return to title
export const DROPIN_SEC = 2.0;        // the boat drop-in beat, auto-advancing

// §5.1 HUD-exclusion rects, in normalized frame coords. Enforced in code by
// the constraints validator (§9.5 rule 4). No in-world object may pass behind
// these -- except the sanctioned TOP RUN airborne fade above.
// In-world entities FADE OUT before they reach the left-edge multiplier-slot
// rect, which is the one exclusion rect the wave face genuinely passes behind.
// They are fully invisible by `end`, which must sit left of... i.e. at a
// smaller x than... nothing: it must be <= the rect's x1 so that an entity is
// already gone by the time it would overlap. They are also inside the lip
// wall's whitewater by then (x < 0.12), where §5.1 says nothing belongs anyway.
export const ENTITY_FADE = { start: 0.18, end: 0.105 };

// Zone props are parallax scenery and must clear the top-of-frame HUD rects
// outright: a prop's bounding box top may never be above this y, at any x.
// Enforced at placement time, because a prop scrolls through every x.
export const PROP_TOP_MIN_Y = 0.205;

export const HUD_RECTS = {
  score:   { x0: 0.00, x1: 0.26, y0: 0.00, y1: 0.14 },
  topRun:  { x0: 0.72, x1: 1.00, y0: 0.00, y1: 0.20 },
  slots:   { x0: 0.00, x1: 0.075, y0: 0.38, y1: 0.66 },
};

// ---------------------------------------------------------------------------
// §9.1 -- render / sim
// ---------------------------------------------------------------------------

export const FIXED_DT = 1 / 60;       // fixed-timestep simulation
export const MAX_FRAME_DT = 0.25;     // clamp, so a tab stall cannot spiral
export const PARTICLE_CAP = 300;      // hard global cap, oldest-first eviction

// Parallax factors (§5.2)
export const PARALLAX = {
  sky: 0.06,
  stacks: 0.18,
  headland: 0.42,
  face: 1.0,
  foam: 1.15,
};

// ---------------------------------------------------------------------------
// Derived helpers -- these are the pacing contract's arithmetic, in one place
// so no system re-derives it slightly differently.
// ---------------------------------------------------------------------------

/** Reaction time in seconds at a given scroll speed (§5.3). */
export function reactionTimeAt(scrollSpeed) {
  return REACTION_SPAN_PX / scrollSpeed;
}

/** How far in h the player can travel inside one reaction window (§5.3). */
export function reachableMoveAt(scrollSpeed) {
  return H_RATE_MAX * Math.max(0, reactionTimeAt(scrollSpeed) - GAP_REACT_MARGIN);
}

/** Linear ramp of one RAMP entry at ride time t. */
export function rampAt(key, t) {
  const r = RAMP[key];
  const k = Math.min(1, Math.max(0, t / RAMP_DURATION));
  if (r.from === Infinity) return t < PUFFER_FIRST_ALLOWED ? Infinity : r.to;
  return r.from + (r.to - r.from) * k;
}

// ---------------------------------------------------------------------------
// §5.3 -- the stand-still rule, as a number the validator can use
// ---------------------------------------------------------------------------

// "A player who holds h = H_TRIM and never leans at all must survive at least
// 45 s of the base-difficulty spawn stream without a wipeout."
//
// The buildable reading of that: every hazard group in the BASE tier -- the
// only tier the spawn director may draw from before this many seconds of ride
// time -- must leave the trim band (H_TRIM +/- PLAYER_H_HALF) clear, INCLUDING
// after its worst-case drift across one reaction window. That is checked
// statically by /systems/constraints.js, so §0.3's trim line stops being a
// slogan. It also sits comfortably with §5.10's on-ramp, which wants early
// hazards NEAR the trim line: near, never across.
export const STAND_STILL_SEC = 45;
