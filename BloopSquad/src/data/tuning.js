// BLOOP SQUAD -- POC tuning.
//
// Every number the standing-up session needs to move lives here, and the ones
// the POC exists to answer are marked THE QUESTION. Nova Vanguard's convention:
// a constant carries the reason it holds that value, or it will be "fixed" by
// the next person who does not know what it was protecting.

/** The world is exactly one screen. See CAMERA below for why. */
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const CAMERA = {
  // 'fixed' | 'drift' | 'lateral'
  //
  // FIXED IS THE STARTING ANSWER and the fallback that certainly works: the
  // world is one screen, nothing pans, and the frame never argues with the
  // player. `drift` scrolls the starfield past the pod so the game reads as
  // travelling somewhere without the player ever dragging the camera.
  // `lateral` pans with the pod and is the one to beat -- it moves the frame on
  // the axis every dodge is made on, which is the argument against it.
  mode: 'fixed',
  // Starfield scroll for 'drift', px/s. Background only; nothing gameplay
  // depends on it, so it can be judged purely on feel.
  driftPxS: 34,
  // 'lateral' only: how far the pod may get from centre before the camera
  // starts following, and how softly it catches up.
  deadZoneFrac: 0.22,
  followLag: 0.12,
};

export const PLAYER = {
  startX: DESIGN_W * 0.5,
  startY: DESIGN_H * 0.72,
  radius: 42,
  hearts: 3,
  // AFTER A HIT: long, generous, and visibly flashing. This is a game for
  // eight-year-olds; the punishment for being touched is losing the heart, not
  // losing the next three seconds as well.
  invulnS: 1.6,

  // THE TWO AXES ARE ASYMMETRIC, and this is the one rule inherited wholesale
  // from Nova Vanguard because it is a hardware finding rather than a taste:
  // lateral lean is comfortable and sustainable, forward/back is expensive and
  // imprecise. Lateral is fast and lightly deadzoned; vertical is slower and
  // more deadzoned so a player who never means to use it never drifts.
  lateralMaxPxS: 900,
  verticalMaxPxS: 380,
  deadzoneX: 0.08,
  deadzoneY: 0.20,
  // Board y is positive when leaning FORWARD; screen y grows downward.
  sensorXSign: 1,
  sensorYSign: -1,
  keyboardRampS: 0.18,

  // The pod may not reach the very edges: something has to be able to pass it.
  clampMarginX: 70,
  clampMinY: DESIGN_H * 0.30,
  clampMaxY: DESIGN_H * 0.92,
};

export const BULLETS = {
  // No fire button, ever. The only verb is where you float.
  intervalS: 0.11,
  speedPxS: 1250,
  radius: 9,
  damage: 1,
  // Bullets live in WORLD space, not attached to the pod. That is what paints
  // the ribbon behind a moving player (concept-10) -- it is not decoration, it
  // is a readout of where the player has just been, and it is the single most
  // recognisable thing about the reference.
  maxLive: 220,
};

export const MONSTERS = {
  // Three size tiers, all the same behaviour: drift, do not chase, never dash.
  // Nothing in this game hunts the player -- being caught is always the result
  // of the player moving into something, or of failing to move out of the way
  // of something that announced itself.
  tiers: {
    small:  { radius: 46, hp: 2,  speedMul: 1.15, points: 10, coins: 1, tint: 0x7ed321 },
    medium: { radius: 68, hp: 5,  speedMul: 0.85, points: 25, coins: 2, tint: 0xf5a623 },
    large:  { radius: 96, hp: 12, speedMul: 0.60, points: 60, coins: 4, tint: 0x9b59d0 },
  },
  tierWeights: { small: 0.62, medium: 0.30, large: 0.08 },

  // ---- THE QUESTION, part one: how fast may something drift? --------------
  // Deliberately gentle to start. "Too easy" is easy to judge standing on a
  // board; a first impression of "unfair" is not recoverable with a child.
  driftPxS: 95,
  // Live multiplier, moved with [ and ] during a session.
  driftMul: 1.0,

  // ---- THE QUESTION, part two: how close may it pass? --------------------
  // A monster crossing the pod's row is nudged so that it clears the pod's
  // centre by at least this much. Raise it and the field feels safe; lower it
  // and the field starts asking for real dodges.
  passClearancePx: 150,
  passClearanceMul: 1.0,

  // The reaction floor, inherited: Nova Vanguard requires >= 1.2 s from a
  // threat first being visible to it reaching the player. The POC MEASURES
  // this rather than assuming it, and prints the worst case per run.
  reactionFloorS: 1.2,

  maxLive: 26,
  spawnIntervalS: 0.85,
  // Spawn side weights. `below` is the whole point of the game: things come up
  // past the pod as well as down onto it.
  edgeWeights: { top: 0.52, left: 0.17, right: 0.17, bottom: 0.14 },
};

export const COINS = {
  radius: 16,
  driftPxS: 60,
  magnetRadius: 190,
  magnetPxS: 620,
  lifeS: 9,
};

export const HUD = {
  // The POC prints what the session needs to remember, because a number written
  // down beats a memory of how it felt.
  showStats: true,
};

// ---------------------------------------------------------------------------
// TOYS -- the temporary weapons.
//
// FOUR RULES, and the first is forced by the hardware:
//   1. No buttons. A toy activates on contact and runs on a timer.
//   2. One at a time. A new toy replaces the current one outright.
//   3. The plain gun never goes away -- a toy is always a bonus on top.
//   4. The timer is a ring around the pod, not a bar in a corner, so the
//      player's eyes never leave the field.
// ---------------------------------------------------------------------------

export const TOYS = {
  // Which monsters can drop one. Smalls give coins; killing something BIG is
  // what earns a present, so the reward points at the interesting target.
  // RAISED after a 45 s headless run produced ZERO toys: most of what dies is
  // small, and mediums take five hits. A game whose presents arrive twice a
  // minute is a game an eight-year-old never finds out about. Smalls now carry
  // a token chance so the mechanic introduces itself early.
  dropFrom: { small: 0.03, medium: 0.40, large: 0.85 },
  // No two toys within this window, so a lucky streak cannot hand out three at
  // once and flatten the whole minute after it.
  minGapS: 6,
  maxLive: 1,

  // A toy is born slightly ABOVE where it died and drifts down slowly: fetching
  // it is a small act of greed on the expensive axis, never a duty. Same rule
  // as the coins.
  riseAboveKillPx: 90,
  driftPxS: 42,
  magnetRadius: 150,
  magnetPxS: 520,
  radius: 26,
  lifeS: 11,

  kinds: {
    // Shots seek the nearest monster in ANY direction. The purest answer to
    // "there is one right beside me and I can only fire up".
    wand: {
      id: 'wand', label: 'BUBBLE WAND', durationS: 10, tint: 0x74d7ff,
      intervalS: 0.11, turnRate: 7.5, speedPxS: 1000, seekRadius: 1400,
    },
    // A spray that rotates a full turn about every 1.2 s. Covers everything --
    // if the player holds still, which makes standing your ground a choice
    // rather than a mistake.
    twirl: {
      id: 'twirl', label: 'TWIRL', durationS: 9, tint: 0xffc93c,
      intervalS: 0.055, speedPxS: 900, spinRadPerS: 5.2, arms: 2,
    },
    // Two little monsters orbit the pod and pop what they touch. Answers the
    // ones that sneak up from below, and it is the cutest thing in the game.
    buddies: {
      id: 'buddies', label: 'BUDDY BOTS', durationS: 12, tint: 0x7ed321,
      count: 2, orbitPx: 132, spinRadPerS: 2.9, radius: 26, damage: 1,
      hitCooldownS: 0.35,
    },
  },
  // Equal weights for the POC: the point is to feel all three, not to tune
  // rarity before we know which of them is worth being rare.
  weights: { wand: 1, twirl: 1, buddies: 1 },
};
