// BLOOP SQUAD -- POC tuning.
//
// Every number the standing-up session needs to move lives here, and the ones
// the POC exists to answer are marked THE QUESTION. Nova Vanguard's convention:
// a constant carries the reason it holds that value, or it will be "fixed" by
// the next person who does not know what it was protecting.
//
// ---------------------------------------------------------------------------
// THE AUDIENCE IS SIX AND EIGHT, not eight alone (Amit, after the board).
// That one sentence is the reason behind most of the numbers below, so it is
// written down once here rather than re-argued at each of them.
//
// A six-year-old on a balance board is not a worse eight-year-old; the chain is
// longer at every link -- see the monster, decide, shift weight, hold the aim
// while the shot lands. The design answer is NOT weaker monsters, it is a
// field that stays FAR AWAY and EMPTY enough that the whole chain fits:
//   - fewer things alive at once, arriving further apart
//   - drifting slower
//   - arriving from the TOP and high on the sides, so "new" always means "far"
//   - a ramp that tops out lower, because nobody watches the third minute
// Sizes still differ, and the big ones are still a commitment. What went away
// is the crowd, not the challenge.
// ---------------------------------------------------------------------------

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
  //
  // SLOWED 35 % (0.11 -> 0.17, Amit from the board). The old rate did not leave
  // room above it: with the cannon already near-continuous, a rapid-fire pickup
  // had nothing to offer, and the only way to make a toy feel like a gift was to
  // give it a different SHAPE of fire. Dropping the floor creates headroom, and
  // the old 0.11 is now what the RAPID toy hands back -- so the number a player
  // used to have all the time is the number they now earn.
  //
  // Every health value in the file is denominated in this: hp * intervalS is
  // seconds of held aim. Changing it silently re-tunes every monster, so the
  // tier comments quote the figure rather than the hp.
  intervalS: 0.17,
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
  // FEWER, TOUGHER (Amit: "less creatures - more hp"). Halving the crowd trades
  // a busy screen for a readable one: at six years old, twelve things drifting
  // at once is not twelve decisions, it is one blur. A monster that takes a
  // moment to pop is also a monster you have looked at, which is what makes the
  // size tiers mean anything and what gives the toys something to be visibly
  // better at.
  //
  // HEALTH IS MEASURED IN SECONDS OF HELD AIM, not in hits. That is what it
  // actually costs the player: at the base gun's 0.11 s cadence, hp * 0.11 is
  // how long you must keep one target lined up while the rest of the field
  // drifts. Every argument about these numbers is really about that figure.
  //
  // DOUBLED (Amit, playing it: "most of the enemies need like twice HP"), and
  // note this is a reversal of the cut made one pass earlier -- which is fine,
  // because the thing that made high health unaffordable was fixed in between.
  // At the old 68 px/s drift, a 2.9 s kill happened in the player's lap; at
  // 46 px/s a top-spawned monster now has ~16 s of travel, so even the large
  // tier's 3.1 s of aim is spent while it is still far away. Slow arrivals are
  // what buy tough monsters. If drift ever goes back up, these come back down
  // with it -- they are two halves of one setting.
  //
  // Large is a touch under 2x on purpose: "most of the enemies" is the smalls
  // and mediums (94 % of spawns between them), and the large tier was already
  // the commitment in the room.
  // BIGGER AND TOUGHER AGAIN (Amit, from the board). Size and health move
  // together on purpose: a bigger monster is a bigger target, so raising the
  // radius alone would make the game EASIER, and raising health alone would
  // make a small target take longer to chew through, which is the version that
  // feels like the gun got weaker. Raised together, a large reads as a proper
  // boss -- a thing you commit to, that is hard to miss while you do.
  //
  // Large is now 120 px radius -- 240 px across, 22 % of the screen height.
  // That is close to the ceiling: much past this and the pass clearance stops
  // being able to route it around the pod without the swerve being visible.
  //
  // MEASURE HEALTH AGAINST TRAVEL TIME, always (headless sim, idle pod):
  //   small   16.2 s travel, 0.99 s of held aim
  //   medium  22.6 s travel, 2.64 s of held aim
  //   large   33.2 s travel, 4.62 s of held aim
  // The large tier is the one to watch: 4.6 s is well past the 2.9 s that was
  // cut as too long for a six-year-old two passes ago. It is affordable only
  // because its 33 s of travel means that aim is spent at a distance -- but it
  // is now the longest single commitment in the game, and it is the first
  // number to revisit if a child gets bored of chewing on one monster.
  tiers: {
    small:  { radius: 58,  hp: 9,  speedMul: 1.15, points: 15, coins: 1, tint: 0x7ed321 },
    medium: { radius: 86,  hp: 24, speedMul: 0.85, points: 40, coins: 3, tint: 0xf5a623 },
    large:  { radius: 120, hp: 42, speedMul: 0.60, points: 90, coins: 5, tint: 0x9b59d0 },
  },

  // ---- THE HIT REACTION ---------------------------------------------------
  // Every hit squashes, not just the killing one (Amit: "squash every time they
  // get hit"). This is the only feedback a player gets that a shot connected on
  // something that did not die, and with health now doubled it is most of what
  // they see: a small takes six hits, so five of them used to be a white flash
  // and nothing else. A monster that visibly recoils reads as "I am hurting
  // this", which is the difference between a tough enemy and an unresponsive
  // one -- the same number of hits either way.
  hit: {
    flashS: 0.09,
    // Peak compression, as a fraction of the radius. Along the axis the shot
    // came from: bullets arrive from below, so it flattens vertically and
    // spreads sideways, then overshoots back through stretch before settling.
    //
    // HALVED from 0.30 (Amit, playing it: "too strong"). At 0.30 a monster
    // under sustained fire was never at rest -- the recoil fires every 0.11 s
    // and the impulse lasts 0.26 s, so they overlap, and the whole field looked
    // like it was made of jelly. The feedback has to read on ONE hit without
    // the twentieth being exhausting, and 0.15 is the version you stop noticing
    // and start just feeling.
    squashAmount: 0.15,
    squashS: 0.26,
    // How much of a full oscillation to run. Above 1.0 the blob passes through
    // stretch on the way back, which is the "and stretch" half -- at exactly
    // 1.0 it only ever squashes and eases back, which reads as a dent.
    squashCycles: 1.25,
  },
  // Weighted further toward smalls: a small is the tier a six-year-old can pop
  // on the way past without stopping to commit to it.
  tierWeights: { small: 0.70, medium: 0.24, large: 0.06 },

  // ---- THE QUESTION, part one: how fast may something drift? --------------
  // Deliberately gentle to start. "Too easy" is easy to judge standing on a
  // board; a first impression of "unfair" is not recoverable with a child.
  //
  // SLOWED FROM 95, THEN FROM 68 (Amit: "make them slower generally", then
  // "they'll be moving slower" for the six-year-old). At 95 the field moved
  // faster than an eight-year-old can shift their weight -- reading a monster,
  // deciding, and leaning is a chain of three things on a balance board, and
  // the whole chain has to fit inside the time the monster gives. At 46 a
  // top-spawned monster takes about 17 s to reach the pod's row, which is the
  // "far away, and I have time to shoot them" the game was asked for: the time
  // is spent aiming, not reacting.
  driftPxS: 46,
  // Live multiplier, moved with [ and ] during a session.
  driftMul: 1.0,

  // ---- THE QUESTION, part two: how close may it pass? --------------------
  // A monster crossing the pod's row is nudged so that it clears the pod's
  // centre by at least this much. Raise it and the field feels safe; lower it
  // and the field starts asking for real dodges.
  //
  // RAISED 150 -> 240 for the younger end. 150 px is a lean that has to be
  // roughly right; 240 is a lean that only has to be in the right direction.
  // Note this is the one difficulty knob the ramp deliberately never touches,
  // so it is a floor on how mean the game can ever get, at any point in a run.
  passClearancePx: 240,
  passClearanceMul: 1.0,

  // The reaction floor, inherited from Nova Vanguard at 1.2 s from a threat
  // first being visible to it reaching the player, and RAISED TO 1.8 s here
  // because the audience is younger than Nova Vanguard's. The POC MEASURES
  // this rather than assuming it, and prints the worst case per run: if a
  // session reports a worst reaction under this, the field is wrong no matter
  // how it felt to the adult holding the laptop.
  reactionFloorS: 1.8,

  // FEWER THINGS ALIVE, ARRIVING FURTHER APART -- the two numbers that do most
  // of the work for the six-year-old, and the ones to move first if the board
  // session still says "too much". Seven on screen is a field a child can
  // actually count; 2.4 s apart means each arrival gets looked at on its own.
  maxLive: 7,
  spawnIntervalS: 2.4,

  // Nothing arrives for the first few seconds of a run. A child needs to find
  // out what the pod does before anything is asked of them, and the alternative
  // -- a monster already on screen at t=0 -- means the run's first event is a
  // surprise rather than a discovery.
  warmUpS: 3.5,
  // Spawn side weights.
  //
  // BOTTOM CUT FROM 0.14 (Amit, playing it: "too much of them are coming from
  // down to up"). Something rising from behind you is the game's spice, not its
  // staple -- it works precisely because it is rare enough to surprise. At one
  // in seven it stopped being a surprise and started being the weather, and it
  // is also the hardest arrival to read, since it comes from the half of the
  // screen the player is not looking at.
  // CUT AGAIN for the six-year-old, and this is the change that buys "most of
  // the time they are far away from me" more than any speed number does. The
  // top edge is the only one that is far by construction: an arrival there is
  // 800-plus px up the screen, in the half the player is already looking at,
  // and it takes many seconds to become anyone's problem. A side arrival is
  // beside you the moment it exists. So the field is now four out of five from
  // the top, and the sides and floor are seasoning.
  edgeWeights: { top: 0.80, left: 0.09, right: 0.09, bottom: 0.02 },
  // Side arrivals get a DOWNWARD bias rather than a symmetric one, for the same
  // reason: a monster entering from the left and drifting up is a riser too,
  // just a quieter one, and there were far more of those than the bottom weight
  // suggested. 0 would make every side arrival sink; this leaves a few climbing.
  sideSkewBias: 0.34,
  // ...and they enter HIGH: a left/right monster is placed in the top this much
  // of the screen, never down at the pod's row. Same principle as the edge
  // weights -- the thing that makes an arrival fair is not how fast it moves,
  // it is how far away it is when the player first sees it. Without this, one
  // arrival in six materialised at the player's own height with no travel time
  // at all, which is exactly the case the reaction floor is meant to catch.
  sideEntryMaxYFrac: 0.42,
};

// ---------------------------------------------------------------------------
// THE SQUAD -- rescued monsters that trail behind the pod.
//
// The game is called Bloop SQUAD and the player flies alone. Rule 4 already says
// nobody dies: a monster out of hearts giggles, puffs into confetti and floats
// off. So some of them come back and fall in behind you, and by the end of a
// good run there is a conga line of friends following the saucer.
//
// WHAT THIS IS FOR: it makes the score into a PHYSICAL THING ON SCREEN. A
// six-year-old does not read "1,400 points"; they see six friends behind them
// where their brother had three. That is the whole idea -- progress you can
// count at a glance, by a player who cannot read the HUD.
//
// PURELY COSMETIC, and that is a design decision rather than a shortcut. The
// moment squad members shoot or block, they compete with the Buddy Bots toy and
// quietly flatten the difficulty ramp -- a run would get easier exactly as fast
// as it was going well. They have no collision, deal no damage and take none.
//
// AND IT RESETS EVERY RUN, which is what keeps it clear of rule 5: no
// meta-progression, nothing saved, nothing carried between runs. The squad is a
// readout of THIS run and nothing else.
// ---------------------------------------------------------------------------

export const SQUAD = {
  // Every Nth pop recruits. Three is frequent enough that the first one arrives
  // inside the opening half-minute -- a mechanic a child never sees is a
  // mechanic that does not exist -- and sparse enough that the line still grows
  // visibly rather than instantly.
  everyNPops: 3,
  // A ceiling, because the line follows the pod's exact path: much past a dozen
  // and the tail is still crossing screen while the head has turned twice, which
  // reads as clutter rather than as a parade.
  maxMembers: 12,
  // PIXELS between one member and the next, measured ALONG THE PATH -- not
  // seconds of delay. The difference matters and it is the whole reason this
  // works: with a time delay, every member reads a position from N frames ago,
  // so the instant the pod stops moving they all converge on the same point and
  // the line collapses into a pile. A six-year-old holds still constantly.
  // Spacing by distance instead means a stopped pod simply leaves the line where
  // it is, holding its shape.
  spacingPx: 46,
  // A new path point is only recorded once the pod has moved this far, so the
  // history is a PATH rather than a time series -- standing still records
  // nothing instead of flooding the buffer with identical points.
  pathStepPx: 4,
  radius: 20,
  // How long a newcomer takes to swell from nothing to full size, so joining is
  // an event you notice rather than a member appearing between frames.
  joinS: 0.45,
  bobPxS: 2.6,
  bobAmp: 4,
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
//   3. A TOY ADDS, IT NEVER REPLACES. The forward cannon keeps firing straight
//      up at its own cadence for the whole run, underneath whatever the toy is
//      doing, and no toy changes or interrupts it. This was written down from
//      the start and was NOT what the code did -- twirl silently switched the
//      gun off for nine seconds and the wand bent its shots into homing ones --
//      which is what a player noticed from the board as the gun "stopping".
//      Both now run side by side: see updateFiring() in systems/toys.js, where
//      the base gun fires before any toy is even looked at.
//   4. The timer is a BAR UNDER THE POD -- close enough that the player's eyes
//      never leave the field, but not a ring around the character, which reads
//      as a shield or a health bar and had a player on the board asking what
//      was protecting him.
// ---------------------------------------------------------------------------

export const TOYS = {
  // Which monsters can drop one. Smalls give coins; killing something BIG is
  // what earns a present, so the reward points at the interesting target.
  // RAISED after a 45 s headless run produced ZERO toys: most of what dies is
  // small, and mediums take five hits. A game whose presents arrive twice a
  // minute is a game an eight-year-old never finds out about. Smalls now carry
  // a token chance so the mechanic introduces itself early.
  // Raised again alongside the tier change: half as many things die now, so the
  // same per-kill chance would have quietly halved the presents too.
  // Raised AGAIN with the size/health bump, for the third time and the same
  // reason each time: every one of these is a chance PER KILL, and every pass
  // that makes monsters tougher cuts the kill count, which silently cuts the
  // presents with it. A headless 4-minute run went from 3 toys to 1 on the
  // size/health change alone. Any future change to health, size or spawn rate
  // has to re-measure this -- it is the most fragile number in the file.
  dropFrom: { small: 0.10, medium: 0.65, large: 1.0 },
  // No two toys within this window, so a lucky streak cannot hand out three at
  // once and flatten the whole minute after it.
  minGapS: 6,
  maxLive: 1,

  // The toy timer, drawn as a bar UNDER the pod. Under and not over: everything
  // the player is actually looking at -- the monsters, their own shots, where
  // they are aiming -- is up-screen, so a bar above the pod sits in the middle
  // of the attention and a bar below it sits in dead space while still being
  // attached to the thing the eye is already tracking.
  timerBar: {
    offsetY: 34,      // below the pod's bottom edge
    width: 180,
    height: 14,
  },

  // A toy is born slightly ABOVE where it died and drifts down slowly: fetching
  // it is a small act of greed on the expensive axis, never a duty. Same rule
  // as the coins.
  riseAboveKillPx: 90,
  driftPxS: 42,
  magnetRadius: 150,
  magnetPxS: 520,
  // BIGGER, and each kind now draws its own SHAPE rather than a tinted circle
  // (see drawToyPickup): a star for the wand, a pinwheel for the twirl, a pair
  // of little faces for the buddies. A circle is the one silhouette already
  // taken -- by the coins -- and "it looked like a big coin" is exactly what
  // a player said about it.
  radius: 34,
  lifeS: 11,

  kinds: {
    // Shots seek the nearest monster in ANY direction. The purest answer to
    // "there is one right beside me and I can only fire up".
    // MUCH SHORTER THAN THE OTHERS (Amit, from the board), and it should be:
    // the wand removes aiming altogether, which is the one thing the game is
    // actually asking the player to do. Ten seconds of it was ten seconds of
    // the game playing itself. Seven is a burst -- long enough to feel like a
    // rescue when something is beside you, short enough that you go back to
    // steering. (Five while the wand REPLACED the gun; a little longer now that
    // it only adds to it, since the player is still aiming the whole time.)
    //
    // launchSpreadRad: bubbles leave at an angle, alternating left and right,
    // instead of straight up. Now that the forward cannon is firing up the same
    // column, a bubble launched at 0 would spend its first 200 px hidden inside
    // the base stream and the toy would look like it did nothing.
    wand: {
      id: 'wand', label: 'BUBBLE WAND', durationS: 7, tint: 0x74d7ff,
      intervalS: 0.13, turnRate: 7.5, speedPxS: 1000, seekRadius: 1400,
      launchSpreadRad: 0.85,
    },
    // A spray that rotates a full turn about every 1.2 s. Covers everything --
    // if the player holds still, which makes standing your ground a choice
    // rather than a mistake.
    // Tint moved OFF 0xffc93c, which was the coin's exact colour -- a round
    // yellow pickup beside round yellow coins is a present nobody picks up on
    // purpose. Magenta appears nowhere else on the field.
    twirl: {
      id: 'twirl', label: 'TWIRL', durationS: 9, tint: 0xff5fc8,
      intervalS: 0.055, speedPxS: 900, spinRadPerS: 5.2, arms: 2,
    },
    // RAPID: the cannon itself fires faster. The only toy that touches the base
    // gun, and it is worth being precise about why that does not break rule 3 --
    // a toy may never STOP, replace or redirect the cannon, but making it better
    // is the opposite failure mode. The player can still have a worse round and
    // never a worse pod.
    //
    // 0.11 is deliberately the game's old permanent rate: it is a known-good
    // number that shipped, so it needs no separate balancing, and a returning
    // player feels it as "this is how it used to be all the time".
    //
    // Base shots take the toy's tint while it runs -- the buff is a rate change,
    // which is the hardest kind of buff to SEE. Colour is what makes it land.
    rapid: {
      id: 'rapid', label: 'RAPID FIRE', durationS: 8, tint: 0xff4d4d,
      baseIntervalS: 0.11,
    },
    // Two little monsters orbit the pod and pop what they touch. Answers the
    // ones that sneak up from below, and it is the cutest thing in the game.
    // Tint moved off 0x7ed321, which was the SMALL MONSTER's exact green -- the
    // one colour on the field that already means "a thing to shoot". Turquoise
    // is used by nothing else, and the bots orbit the pod where a moment's
    // "is that an enemy?" is worst.
    buddies: {
      id: 'buddies', label: 'BUDDY BOTS', durationS: 12, tint: 0x2fe3b8,
      count: 2, orbitPx: 132, spinRadPerS: 2.9, radius: 26, damage: 1,
      hitCooldownS: 0.35,
    },
  },
  // Equal weights for the POC: the point is to feel all four, not to tune
  // rarity before we know which of them is worth being rare.
  weights: { wand: 1, twirl: 1, buddies: 1, rapid: 1 },
};

// ---------------------------------------------------------------------------
// DIFFICULTY -- the run gets harder the longer it lasts.
//
// A run has no levels and no waves: it is one continuous field, so the only
// honest way to make it build is against the clock. Everything below ramps from
// `from` to `to` over `rampS` and then STOPS. The cap is the important half --
// an endless ramp eventually violates the reaction floor and turns a game an
// eight-year-old is enjoying into one that shrugs them off, and it does it long
// after anyone is still watching for it.
//
// What escalates, and what deliberately does NOT:
//   - more monsters, arriving sooner, moving faster, weighted bigger.
//   - NOT their health. Tougher-over-time makes the same monster take longer to
//     pop, which reads as the gun getting weaker rather than the game getting
//     harder. Size tiers already carry that job.
//   - NOT the pass clearance. That rule is what keeps every threat answerable
//     with a sideways lean, and it is not a difficulty lever.
// ---------------------------------------------------------------------------

export const DIFFICULTY = {
  // Five minutes to full, up from three and a half. A run on a balance board is
  // a few minutes long, so the ramp has to be readable inside one -- but with
  // six-year-olds the interesting part of the curve is the first minute, and it
  // was previously a third of the way to the ceiling by then.
  rampS: 300,
  // Eased so the early climb is slow and the pressure arrives in the back half,
  // rather than the game tightening while the player is still working out what
  // the pod does. LEFT AT 1.6 deliberately, having tried 2.0: stretching rampS
  // AND steepening the ease together made minute three sit at 36% of the ramp,
  // and since a run is a few minutes long that is a difficulty curve that never
  // actually happens. Which matters more than it sounds, because with two ages
  // sharing one build and no difficulty menu, THE RAMP IS THE DIFFICULTY
  // SETTING: the eight-year-old survives longer and is therefore playing the
  // harder game, automatically. A ramp nobody reaches takes that away and
  // leaves the six-year-old's numbers as the only game in the box.
  ease: 1.6,

  // THE CEILING IS THE POINT, and all three came down. What the ramp is allowed
  // to reach matters more than how fast it gets there, because the top of the
  // ramp is where the game spends the rest of the run -- and a six-year-old who
  // is still playing at minute four has earned a game that stopped escalating,
  // not one that finally caught up with them.
  spawnIntervalMul: { from: 1.00, to: 0.70 },  // 2.40s -> 1.68s between arrivals
  speedMul:         { from: 1.00, to: 1.25 },  // 46 -> 58 px/s base drift
  maxLive:          { from: 7,    to: 12   },
  // Late runs lean toward the bigger tiers: the crowd grows, but it also grows
  // UP, so the field does not simply fill with chaff. Halved -- with large now
  // the 1.8 s commitment, a late field of them is the one shape of this game a
  // young player cannot get out of.
  largeShareBonus: 0.07,
};

/** 0 at the start of a run, 1 once the ramp is done. Eased. */
export function difficulty01(timeS) {
  const t = Math.max(0, Math.min(1, timeS / DIFFICULTY.rampS));
  return Math.pow(t, DIFFICULTY.ease);
}

export function lerpDiff(range, d) {
  return range.from + (range.to - range.from) * d;
}
