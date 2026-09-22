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
  // More monsters to feed the presents (Amit: "if needed we can bring more
  // enemies also"). Raised with the drop rule, not before it -- a field that
  // grew first would just be harder.
  maxLive: 9,
  spawnIntervalS: 1.9,

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
// THEY ARE BOMBS. The first version was purely cosmetic, on the reasoning that
// anything which fights competes with the Buddy Bots toy and flattens the
// difficulty ramp. That reasoning was sound and it did not matter: a line that
// only follows you is decoration, and Amit's verdict on playing it was that it
// was stupid. Correct -- a mechanic that cannot do anything is not a mechanic.
//
// So a squad member DETONATES on contact with a monster, damaging everything in
// a radius and being consumed doing it. Which makes the line a RESOURCE rather
// than a trophy: it is protection you spend, it shortens visibly when it saves
// you, and it has to be rebuilt by popping more. It also answers the tail's own
// worst problem -- ten members sweeping across the field obscuring monsters --
// because the ones in the way are exactly the ones that get used up.
//
// The ramp concern is real and now TESTABLE rather than theoretical: the counter
// is that bombs are spent, so a player who is doing well is also constantly
// losing the thing that helps them.
//
// AND IT RESETS EVERY RUN, which is what keeps it clear of rule 5: no
// meta-progression, nothing saved, nothing carried between runs. The squad is a
// readout of THIS run and nothing else.
// ---------------------------------------------------------------------------

export const SQUAD = {
  // OFF. The trail is parked, not deleted -- the code stays because the blast it
  // proved out is now what the Buddy Bombs do, and because "we might need to
  // reverse that" reads better as a decision with the thing still here.
  // `?squad=N` forces it on for review.
  //
  // Why it is off: measured 3-13 detonations across a four-minute run, and ZERO
  // for a pod that holds still, because the tail occupies the path the pod just
  // travelled -- which applyClearance keeps monsters out of by design. It fired
  // almost exclusively when the player was flying badly. The orbiting buddies
  // have the opposite geometry: they sit in the ring around the pod, which is
  // where monsters actually arrive.
  enabled: false,

  // Every Nth pop recruits. Three is frequent enough that the first one arrives
  // inside the opening half-minute -- a mechanic a child never sees is a
  // mechanic that does not exist -- and sparse enough that the line still grows
  // visibly rather than instantly.
  everyNPops: 3,
  // A ceiling, because the line follows the pod's exact path: much past a dozen
  // and the tail is still crossing screen while the head has turned twice, which
  // reads as clutter rather than as a parade.
  maxMembers: 12,
  // Gap from the POD to the first member, kept separate from the gap between
  // members because they answer different questions. This one is about the pod
  // staying legible: at 46 px the first member sat inside the saucer's own
  // silhouette, reading as part of the ship rather than as someone following it.
  leadPx: 104,
  // PIXELS between one member and the next, measured ALONG THE PATH -- not
  // seconds of delay. The difference matters and it is the whole reason this
  // works: with a time delay, every member reads a position from N frames ago,
  // so the instant the pod stops moving they all converge on the same point and
  // the line collapses into a pile. A six-year-old holds still constantly.
  // Spacing by distance instead means a stopped pod simply leaves the line where
  // it is, holding its shape.
  spacingPx: 76,
  // A new path point is only recorded once the pod has moved this far, so the
  // history is a PATH rather than a time series -- standing still records
  // nothing instead of flooding the buffer with identical points.
  pathStepPx: 4,
  radius: 20,

  // The blast. Damage is deliberately a ONE-SHOT on a small (9 hp), a serious
  // dent in a medium (24) and about a third of a large (42): a bomb has to feel
  // like an event, and one that merely chips the thing that ran into it reads as
  // a bug. The radius is wide enough to catch a neighbour, so a tail detonating
  // in a crowd is the best thing that happens in a run.
  bomb: {
    damage: 14,
    radiusPx: 175,
    // A newly recruited member cannot detonate until it has taken its place --
    // it is born where its monster died, which is frequently touching whatever
    // that monster was drifting next to, and an instant chain of detonations at
    // the moment of recruiting reads as random.
    armS: 0.6,
  },
  // How long a newcomer takes to swell from nothing to full size, so joining is
  // an event you notice rather than a member appearing between frames.
  joinS: 0.45,
  bobPxS: 2.6,
  bobAmp: 4,
};

// ---------------------------------------------------------------------------
// HEARTS -- the only pickup that undoes a mistake.
//
// The pod has three hearts and, until now, no way to get one back: a run was a
// one-way slide from three to zero. For six-year-olds that is the difference
// between a game that forgives a bad thirty seconds and one that quietly
// decides the run is over long before it ends.
//
// DROPPED BY BIG MONSTERS ONLY, and never above the cap. The large tier is the
// one that takes real commitment to kill, so the reward points at the thing
// worth doing -- and a heart that appears when you are already full is a reward
// that reads as nothing, so it simply does not drop.
// ---------------------------------------------------------------------------

export const HEARTS = {
  // Per kill, and only from these tiers. Deliberately not from smalls: a heart
  // from chaff would make the hearts meaningless and the cap permanent.
  dropFrom: { small: 0, medium: 0.10, large: 0.55 },
  // No two hearts inside this window, so a lucky pair of large kills cannot
  // hand back a whole run's worth of mistakes at once.
  minGapS: 18,
  maxLive: 1,
  radius: 26,
  // Drifts DOWN toward the player rather than sitting where it dropped -- the
  // one pickup a player in trouble must not have to climb for, since climbing
  // is the expensive axis and they are already being hit.
  driftPxS: 54,
  magnetRadius: 230,
  magnetPxS: 620,
  lifeS: 12,
};

export const COINS = {
  radius: 16,
  driftPxS: 60,
  magnetRadius: 190,
  magnetPxS: 620,
  lifeS: 9,
};

// ---------------------------------------------------------------------------
// XP AND LEVELS -- the celebration, and nothing else.
//
// WITHIN A RUN ONLY. Levels reset to 1 on every restart and nothing is saved.
// That is rule 5 (no meta-progression) and it is not negotiable, but it is also
// the better design here: an arcade run is whole or it is nothing, and a level
// carried in from yesterday would mean two children never play the same game.
//
// LEVELS NOW GRANT SOMETHING, and this reverses an earlier decision here. The
// first version granted nothing on the reasoning that power fights the
// difficulty ramp. Amit, playing it: by level three or four the action has to
// visibly go up -- more creatures AND more that the player can do.
//
// So a level does two things and only two: it UNLOCKS toys (see TOYS.unlockLevel)
// and it lengthens them slightly. It never touches the cannon, the hearts or the
// clearance -- the three things the six-year-old work depends on.
//
// The ramp concern was right and is answered by pairing them: levels add crowd
// as well as power (`DIFFICULTY.maxLivePerLevel`), so the game escalates on both
// sides at once rather than the player simply outgrowing it. And because levels
// come from KILLS rather than from the clock, the escalation tracks how well
// someone is actually doing -- a struggling player is not handed a harder game
// for having survived four minutes.
// ---------------------------------------------------------------------------

export const XP = {
  // Earned from what the player already does. Weighted to POPPING rather than
  // collecting, so the celebration tracks the thing the game is about.
  perPop: { small: 10, medium: 26, large: 55 },
  perCoin: 4,
  // Level N costs base * N^curve. Slightly super-linear: the first level arrives
  // fast enough to teach what the popup means, and the fifth still feels earned.
  base: 120,
  curve: 1.25,
  // ---- THE CELEBRATION LADDER --------------------------------------------
  //
  // EVERY LEVEL IS A BIGGER PARTY THAN THE LAST, up to ten (Amit: "each one
  // should be more and more celebrative... bigger, more party... plan that in
  // ten, the whole screen goes").
  //
  // The reason this is worth building properly rather than scaling one number:
  // a reward that is identical every time stops being a reward on about the
  // third showing. A child who has seen level 3 has to be able to tell that
  // level 7 is BIGGER, at a glance, without reading the numeral -- so each tier
  // adds a new KIND of thing, not just more of the last one.
  //
  // The ladder, and what appears when:
  //   1-2   the burst, rays and the numeral. The baseline.
  //   3+    confetti fires out of the popup itself.
  //   5+    confetti rains from the top of the screen, and the rays double.
  //   7+    the whole screen washes with colour, twice.
  //   10    everything at once, longest, plus a ring of bursts around the edge.
  //         Ten is the ceiling on purpose: past it a run is long over.
  popupS: 1.6,
  // Each level past the first adds this, capped -- so ten holds noticeably
  // longer than two without a late level parking the screen.
  popupPerLevelS: 0.14,
  popupMaxS: 3.1,

  // Confetti fired by the popup itself, from level `confettiFromLevel` up.
  confettiFromLevel: 3,
  confettiPerLevel: 16,
  confettiMax: 190,
  // Confetti raining from the top of the screen.
  rainFromLevel: 5,
  rainPerLevel: 14,
  rainMax: 150,
  // Full-screen colour washes.
  washFromLevel: 7,
  // The everything-at-once level.
  finaleLevel: 10,
};

// ---------------------------------------------------------------------------
// THE SKY -- one colour per level.
//
// THE RULE THAT MAKES THIS SAFE: shift HUE, hold LUMINANCE. Every colour below
// sits in the same narrow brightness band (16-22 on a 0-255 luma scale), because
// the monsters are saturated blobs read against near-black and the entire
// six-year-old pass depends on that contrast. A sky that got lighter as the
// player improved would punish them for improving.
//
// It eases rather than cuts. A hard colour change mid-fight reads as a bug or as
// having been hit; slid under the celebration it registers as the world having
// changed without anyone noticing the moment.
//
// And because levels reset every run, the sky doubles as a readout of how THIS
// run is going -- which is what two children comparing runs actually want.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE POD EVOLVES -- the third progression signal, and the most personal one.
//
// The sky says where you are and the music says how big the run got. This says
// it about YOU: the saucer is the one thing a player's eyes never leave, so an
// upgrade bolted to it is progress they cannot miss and never have to look away
// to read. Two children on two boards can see whose ship is further along
// without a word or a number passing between them.
//
// PURELY COSMETIC, all of it. Not a single line below changes a hitbox, a rate
// or a heart. The moment a visible upgrade also made the pod stronger it would
// be fighting the difficulty ramp -- which levels already feed on the other side
// by adding monsters -- and a six-year-old would be handed a compounding
// advantage exactly when the field is getting harder to read.
//
// EACH TIER ADDS A NEW PART rather than scaling the last one, for the same
// reason the celebration ladder does: "slightly bigger" is not a difference
// anyone can see, and a child has to be able to tell tier 7 from tier 4 at a
// glance. Ten is the ceiling; past it a run is long over.
// ---------------------------------------------------------------------------

export const POD = {
  // FOUR SHIPS, NOT SEVEN BOLT-ONS. The first version added a part per tier --
  // fins, a halo, extra rim lights, gold trim -- and Amit's verdict was that it
  // "revealed a lower production value feeling". He was right, and the diagnosis
  // is worth keeping because it applies to anything added here later:
  //
  // The monsters work because they all follow ONE RECIPE -- blob silhouette,
  // thick dark outline on every form, a gloss highlight up-left, a belly shade,
  // big eyes with catchlights. Basic, but coherent, and coherent basic reads as
  // a style. The bolted-on upgrades shared none of it: flat triangles with no
  // shading, a bare stroked ellipse with no outline, a colour swap. They read as
  // ACCRETION -- a saucer with bits stuck on -- and because they sat at a
  // different fidelity from everything around them they dragged the whole
  // screen's perceived quality down with them.
  //
  // So: four whole ships, each a silhouette you could recognise in black, each
  // drawn with the monsters' recipe. A tier changes the OUTLINE, never adds a
  // part. The wings are points on the hull path, not separate shapes.
  //
  // CUT ENTIRELY: the halo ring, the gold trim, the rim-light count change.
  // None of them altered the silhouette and all three read cheap.
  tiers: [
    // hullW    half-width, in pod radii -- the headline of each silhouette
    // tipRise  how far the wingtips lift above the hull's centre line
    // topH     crown height
    // underY / keel  the underside, which is what gives a ship mass
    // THE CANOPY IS SMALL. The first pass had it at 0.74-1.02 radii against a
    // hull only ~0.9 tall, so the dome dwarfed the ship and the whole thing read
    // as a head with little wings rather than as a craft. A saucer is a WIDE
    // BODY with a bubble on top; the body has to dominate.
    // ONE PILOT, ALWAYS (Amit: "having 2 characters inside the spaceship - not a
    // good idea"). It was the tier-5 upgrade and it was the wrong kind: the
    // pilot is the player, and a second face in the canopy quietly asks who the
    // player now is. It also crowded a bubble sized for one. The tiers carry
    // plenty without it -- hull width, wing sweep, thruster count, canopy size
    // and keel depth all move, and those are silhouette changes rather than
    // passengers.
    { from: 1,  name: 'scout',    hullW: 1.32, tipRise: 0.02, topH: 0.16, underY: 0.30, keel: 0.54, thrusters: 1, dome: 0.46 },
    { from: 4,  name: 'cruiser',  hullW: 1.70, tipRise: 0.20, topH: 0.22, underY: 0.32, keel: 0.60, thrusters: 2, dome: 0.52 },
    { from: 7,  name: 'heavy',    hullW: 1.98, tipRise: 0.32, topH: 0.28, underY: 0.36, keel: 0.68, thrusters: 3, dome: 0.58 },
    { from: 10, name: 'flagship', hullW: 2.24, tipRise: 0.44, topH: 0.34, underY: 0.38, keel: 0.76, thrusters: 3, dome: 0.64 },
  ],
  // The exhaust ribbon, from the cruiser up. Kept because it is a thruster
  // effect rather than a part bolted to the hull -- it reads as the ship doing
  // something, which is the test the cut upgrades failed.
  trailFrom: 4,
  trailPoints: 16,
  trailStepPx: 9,
};

export const SKY = {
  // MEASURED AND REDONE. The first palette held luminance at 16-22 to protect
  // contrast, and sampling the rendered pixels showed why that failed: level 4
  // came out rgb(12,16,32) against level 1's rgb(11,16,32). At that brightness
  // hue is essentially invisible -- the rule was right about contrast and wrong
  // about the feature, because a sky nobody can see is not feedback.
  //
  // These sit at luma 23-37 with much higher saturation. Still deeply dark: the
  // monsters run 150+ (the small green is ~150, the coin ~200), so contrast
  // stays above 4:1 everywhere, and the playfield never approaches the blobs.
  // The trade is deliberate and it is the whole feature -- a background that
  // cannot be told apart between levels is not worth drawing.
  colors: [
    0x0e1430, // 1  navy (home)
    0x1d1140, // 2  indigo
    0x07262b, // 3  teal
    0x2a0f2e, // 4  plum
    0x0b2a18, // 5  forest
    0x300f1c, // 6  wine
    0x14203f, // 7  slate
    0x06303c, // 8  deep cyan
    0x260d3a, // 9  aubergine
    0x0d2f26, // 10 pine
  ],
  lerpS: 1.5,
  // How far the starfield follows the sky. Stars staying pure white against a
  // shifted sky is what makes a recoloured background look like a filter laid
  // over the game rather than a different place.
  starTint: 0.30,
};

// Dev tools. `alwaysVisible` puts the wrench in the chrome row from boot instead
// of behind the seven-second hold and the code.
//
// TRUE ONLY WHILE THE GAME IS BEING BUILT, and it has to go back to false before
// this is in front of a child: every row in that panel either skips content or
// removes a failure condition, and a visible wrench is a wrench a six-year-old
// presses. The gate itself is untouched and still works -- this only decides
// whether it is in the way.
export const DEV = {
  alwaysVisible: true,
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
  // HALVED (Amit: "way too much for sure"). Expected drops per kill went 1.00 ->
  // 0.52, which is the half he asked for measured properly -- halving only the
  // smalls would have reached 0.65, because mediums and larges contribute a
  // third of the total despite being 30 % of the field.
  //
  // Large stays at 1.0 deliberately. It is the longest commitment in the game
  // and the one kill a child plans; a guaranteed present is what pays for it.
  // HALVED AGAIN (Amit: "still way too much"). 0.52 -> 0.26 expected per kill.
  //
  // Worth recording why two halvings were needed rather than one big cut: the
  // monster count went UP in the same pass that made greens drop presents, so
  // kills per minute rose at the same time as drops per kill. Halving the rate
  // while the kill count climbed did not halve what the player actually saw.
  // These are the two numbers that multiply, and only one of them was moving.
  dropFrom: { small: 0.22, medium: 0.3, large: 0.6 },
  // No two toys within this window, so a lucky streak cannot hand out three at
  // once and flatten the whole minute after it.
  // 6s -> 2.5s, and two pickups may be on the field at once. Both had to move
  // when toys started stacking: the gap existed so a lucky streak could not hand
  // out three toys that each cancelled the last, and that reason is gone -- three
  // toys now all run. With the old gap a player would almost never hold more than
  // two at a time, which would make the whole stacking change invisible.
  // The gap is now the real limiter rather than the roll, which is the right way
  // round: the ceiling on presents should be a number we set, not a dice streak.
  // The gap does the rest. At 3 s a lucky cluster of kills still cannot produce
  // a stream of presents, which is the shape that reads as "too much" even when
  // the average is fine -- a player notices the burst, not the mean.
  minGapS: 3.0,
  maxLive: 2,

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
      id: 'wand', label: 'BUBBLE WAND', durationS: 9, tint: 0x74d7ff,
      intervalS: 0.13, turnRate: 7.5, speedPxS: 1000, seekRadius: 1400,
      launchSpreadRad: 0.85,
    },
    // A spray that rotates a full turn about every 1.2 s. Covers everything --
    // if the player holds still, which makes standing your ground a choice
    // rather than a mistake.
    // Tint moved OFF 0xffc93c, which was the coin's exact colour -- a round
    // yellow pickup beside round yellow coins is a present nobody picks up on
    // purpose. Magenta appears nowhere else on the field.
    // OFF (Amit: "disable the pink swirl shooter, don't give him any more").
    // Kept in the file rather than deleted: it still works on key 2 for testing,
    // and its history -- the x3 damage burst rework, the drop-weight cut -- is
    // the record of two passes that did not save it. A spray that crosses
    // everything else on screen was never going to sit well beside toys that
    // now all run at the same time.
    twirl: {
      id: 'twirl', label: 'TWIRL', durationS: 4.5, tint: 0xff5fc8, enabled: false,
      intervalS: 0.055, speedPxS: 900, spinRadPerS: 5.2, arms: 2,
      // x3 PER SHOT, HALF AS LONG (Amit, playing it: "very annoying").
      //
      // The complaint was the nine seconds, not the spray: at 0.055 s across two
      // arms this thing emits ~36 bullets a second, and nine seconds of that is
      // 320 pink dots crossing everything else on screen. It was the longest toy
      // in the game and the busiest, which is the worst pairing available.
      //
      // Shorter AND harder is the trade: half the wall of bullets, and each one
      // worth three, so total damage over the toy's life goes UP by half while
      // the time spent looking at it is halved. A burst you notice beats a
      // period you wait out -- the same reasoning that took the wand to five
      // seconds when it was doing the aiming for you.
      damage: 3,
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
      id: 'rapid', label: 'RAPID FIRE', durationS: 11, tint: 0xff4d4d,
      baseIntervalS: 0.11,
    },
    // THE BOMB CHAIN: a rope of bombs hanging BELOW the pod, simulated rather
    // than animated. Verlet integration plus distance constraints, anchored to
    // the pod -- so it swings out when you accelerate, keeps swinging when you
    // stop, and whips when you change direction. Nothing about that motion is
    // scripted; it falls out of the physics, which is why it reads as real.
    //
    // WHY THIS IS THE RIGHT TOY FOR THIS HARDWARE: the swing is driven by
    // LATERAL acceleration, and lateral lean is the comfortable axis on a
    // balance board. It turns the one movement a child can make confidently into
    // a weapon, and it rewards the thing a good player already does -- committing
    // to a direction and then cutting the other way.
    //
    // It hangs BELOW because below the pod is the one region the cannon cannot
    // reach: the gun fires straight up, so the chain covers exactly the gap.
    chain: {
      id: 'chain', label: 'BOMB CHAIN', durationS: 15, tint: 0xffa63c,
      // 5 x 44 = 220 px of rope. Measured rather than guessed: at 260 the tip
      // sat exactly on the screen's bottom edge with the pod at its start
      // height, and vanished off-screen entirely whenever the player flew low --
      // a toy you cannot see is a toy that is not there. Even at 220 a player
      // sitting at the very bottom of their range loses the last link or two,
      // which is the trade for a rope long enough to swing visibly.
      links: 5,
      linkPx: 44,
      // The toy timer moves ABOVE the pod while this is running. The bar's home
      // is below -- up-screen is where the monsters and the aim are -- but this
      // toy OCCUPIES below, and the bar drew straight through the rope. A rule
      // with one honest exception beats a rule that produces a mess.
      timerAbove: true,
      radius: 18,
      // CALMED DOWN (Amit: "a bit too jumpy"). Gravity 2600 -> 1700 and damping
      // 0.985 -> 0.93. Those two do different jobs and both were wrong: heavy
      // gravity made the rope snap back hard, and near-zero damping meant it
      // then kept snapping for seconds afterwards. A chain that never settles is
      // not lively, it is noise -- and it is noise directly under the pod, in
      // the space the player is trying to read.
      //
      // Still strong enough to hang straight at rest, which is what stops it
      // reading as seaweed; it just stops ringing once the swing is over.
      gravityPxS2: 1700,
      // Per-frame velocity retention. Below ~0.97 the swing dies before the
      // player sees it; at 1.0 it never settles and the chain ispermanently in motion,
      // which is noise rather than feedback.
      damping: 0.93,
      // Constraint relaxation passes. Fewer and the rope stretches visibly on a
      // fast direction change -- the exact moment the player is looking at it.
      iterations: 8,
      // Smaller blasts than the orbiting bombs: there are five of them and they
      // sweep a wide arc, so the same damage would clear the screen.
      blastDamage: 16,
      blastRadiusPx: 150,
      armS: 0.3,
    },
    // THE CROSS: four shots at once, up, down, left and right.
    //
    // FIXED AXES, never rotating -- that is the twirl's job and the difference
    // between the two toys has to be legible in one glance. A cross is a shape
    // the player can aim BY POSITIONING: line up a column and everything in it
    // dies, and the sideways arms cover the approach the cannon cannot. It makes
    // lateral lean into aiming, which is the comfortable axis.
    //
    // Down matters as much as up. The cannon only fires up, so the downward arm
    // is the only sustained answer in the game to something rising from below.
    cross: {
      id: 'cross', label: 'CROSS FIRE', durationS: 10, tint: 0x9be564,
      // THREE ARMS, NOT FOUR: down, left and right. The up arm was deleted
      // (Amit) and it was the redundant one -- the cannon already fires straight
      // up and never stops, so that barrel was the only part of the cross
      // duplicating something the player already had. What is left is exactly
      // the three directions nothing else covers.
      dirs: [[0, 1], [-1, 0], [1, 0]],
      intervalS: 0.13,
      speedPxS: 1100,
      damage: 1,
    },

    // THE SHIELD ORB: a bubble that eats contacts instead of hearts.
    //
    // The only toy that is purely DEFENSIVE, and the only one that changes what
    // happens when the player makes a mistake rather than what happens when they
    // aim well. That matters for a six-year-old more than any weapon does -- the
    // failure it prevents is the one that ends the run.
    //
    // CHARGES, not a timer, decide when it ends: three saves and it is gone,
    // however long that takes. A shield that expires while you were flying
    // carefully is a punishment for playing well.
    //
    // A monster that hits the shield still giggles away rather than bouncing --
    // rule 4 does not get an exception for being blocked.
    shield: {
      id: 'shield', label: 'SHIELD ORB', durationS: 18, tint: 0x8fd4ff,
      charges: 3,
      radiusPx: 86,
      // A beat of grace after a save, so one monster cannot eat two charges by
      // still being on top of the pod the frame after the first.
      graceS: 0.5,
    },

    // THE PUNCH ARM: reaches out and hits whatever is closest.
    //
    // Answers the case nothing else does -- something already beside you, too
    // close for the cannon (which fires straight up) and not yet touching, which
    // for a child is the most frightening moment in a run and the one they have
    // no answer to. It auto-targets and auto-fires, because there are no buttons.
    //
    // It punches ONE thing at a time, hard. A weapon that helps when you are
    // cornered has to be legible in the instant it acts, and an area effect in
    // that moment reads as the screen doing something rather than as help.
    punch: {
      id: 'punch', label: 'PUNCH ARM', durationS: 13, tint: 0xffd166,
      reachPx: 340,
      damage: 20,
      cooldownS: 0.75,
      // The three phases of a punch. Fast out, a beat at full stretch, slower
      // back -- the asymmetry is what makes it read as a punch rather than as a
      // telescope. Damage lands at full extension, not on contact with the arm.
      extendS: 0.10,
      holdS: 0.07,
      retractS: 0.16,
      fistPx: 26,
    },

    // Two little monsters orbit the pod and pop what they touch. Answers the
    // ones that sneak up from below, and it is the cutest thing in the game.
    // Tint moved off 0x7ed321, which was the SMALL MONSTER's exact green -- the
    // one colour on the field that already means "a thing to shoot". Turquoise
    // is used by nothing else, and the bots orbit the pod where a moment's
    // "is that an enemy?" is worst.
    //
    // TWO ORBITING BOMBS. They used to be chip-damage pets that ground monsters
    // down one hit at a time on a cooldown, which made them the dullest toy in
    // the game -- you could not tell they were working.
    //
    // Now each one DETONATES on contact and is spent. Two bombs, two bangs, and
    // the toy ends when both are gone rather than when a timer runs out, so the
    // player decides when to spend them by deciding where to fly. That is the
    // only real decision any toy here has offered, and it needs no button.
    //
    // This is the blast the squad trail proved out, moved somewhere the geometry
    // works: orbiters sit in the ring around the pod, which is where monsters
    // actually arrive -- unlike a tail, which trails through space the pass
    // clearance has already swept clean.
    buddies: {
      id: 'buddies', label: 'BUDDY BOMBS', durationS: 14, tint: 0x2fe3b8,
      count: 2, orbitPx: 132, spinRadPerS: 2.9, radius: 26,
      // Harder-hitting than a squad member was: there are only ever two, they
      // are the whole toy, and a bomb that fails to clear what it touched is a
      // disappointment rather than a rescue. 22 one-shots a small, halves a
      // large, and the radius catches whatever came in alongside it.
      blastDamage: 22,
      blastRadiusPx: 200,
      // Long enough that a bomb cannot detonate on the thing it spawned beside.
      armS: 0.35,
    },
  },
  // NO LONGER EQUAL. The POC's equal weights did their job -- they were there to
  // find out which toys were worth being rare, and playing it answered that.
  //
  // Amit: "everything with bombs is fun, rapid is fun... the pink shots, it's
  // not that fun so you shouldn't give it so much." So the weights now follow
  // the verdict: bombs and rapid are common, twirl is the rare one. The twirl
  // was ALSO the most-seen toy by accident -- equal weight plus the longest
  // duration meant it occupied more seconds of a run than anything else, so its
  // share of screen time was well above its share of drops.
  weights: { wand: 0.7, twirl: 0.35, buddies: 1.4, rapid: 1.3, chain: 1.3, shield: 1.0, punch: 1.1, cross: 1.2 },

  // ---- FAMILIES, AND WHY THE DROP IS NOT A PURE ROLL ----------------------
  //
  // Amit: "for some reason I got only shooter-related toys, and not the bombs
  // and close weapons, for a very long time."
  //
  // That is not a bug and better weights cannot fix it. Weighted random has no
  // memory, so streaks are not merely possible, they are expected -- with three
  // shooters in a pool of seven, four shooters in a row is an ordinary outcome
  // and it happens often enough that a child will meet it.
  //
  // So the drop ROTATES BY FAMILY: each present comes from whichever family has
  // gone longest without one, and the weights then choose within that family.
  // The effect is that you cannot get two bombs in a row while a close-weapon is
  // waiting, and the roster a player sees stays spread across the kinds of thing
  // the game can do, rather than across whatever the dice liked today.
  families: {
    shooter: ['wand', 'cross'],
    bomb: ['buddies', 'chain'],
    close: ['punch', 'shield', 'rapid'],
  },

  // WHAT EACH LEVEL OPENS UP. A toy cannot drop until the player has reached
  // its level, so the roster grows through a run instead of being complete from
  // the first pop. Two are available immediately -- a first toy has to arrive
  // early enough to teach what a toy IS -- and the chain is last because it is
  // the biggest and the strangest.
  // EVERY FAMILY HAS A LEVEL-1 MEMBER, and that is the point of these numbers
  // rather than the escalation. The rotation can only rotate between families
  // that have something unlocked, so the old ladder (wand 1, rapid 2, cross 3,
  // buddies 4...) meant level 1 offered ONE toy, level 2 offered two shooters
  // and nothing else -- measured as shooter 18 / close 15 / bomb 7 across a run,
  // with three shooters in a row early on. Exactly the complaint, caused by the
  // unlock table and not by the roll.
  //
  // So: one shooter, one bomb and one close weapon from the first present, and
  // the rest arrive with levels. Variety first, escalation second.
  unlockLevel: { wand: 1, buddies: 1, rapid: 1, twirl: 1, cross: 3, punch: 4, chain: 5, shield: 6 },

  // Every level past the first adds this much to a toy's duration, capped.
  //
  // THE ARGUMENT AGAINST LONG DURATIONS DIED WHEN TOYS STARTED STACKING. It used
  // to be "a 60 % longer twirl is not exciting, it is a twirl you are waiting
  // out" -- which was true while only one toy could run, because its duration
  // was exactly the time before you could have a different one. Now a longer
  // toy is one you STILL HAVE when the next arrives, which is the whole point.
  // Durations went up with the same change (wand 7->9, rapid 8->11, cross 8->10)
  // for that reason and no other. Twirl stayed at 4.5: it is the one toy asked
  // to be rarer, not commoner.
  levelDurationBonus: 0.07,
  levelDurationCap: 1.5,
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
  maxLive:          { from: 9,    to: 15   },
  // Late runs lean toward the bigger tiers: the crowd grows, but it also grows
  // UP, so the field does not simply fill with chaff. Halved -- with large now
  // the 1.8 s commitment, a late field of them is the one shape of this game a
  // young player cannot get out of.
  largeShareBonus: 0.07,

  // MORE CREATURES AS THE PLAYER LEVELS, so the escalation is felt on both
  // sides: levels hand out toys, and levels also fill the field. Capped hard --
  // this stacks on top of the time ramp, and the two together are how a game
  // for six-year-olds quietly becomes unplayable at minute five.
  maxLivePerLevel: 0.5,
  maxLiveLevelCap: 4,
};

/** 0 at the start of a run, 1 once the ramp is done. Eased. */
export function difficulty01(timeS) {
  const t = Math.max(0, Math.min(1, timeS / DIFFICULTY.rampS));
  return Math.pow(t, DIFFICULTY.ease);
}

export function lerpDiff(range, d) {
  return range.from + (range.to - range.from) * d;
}
