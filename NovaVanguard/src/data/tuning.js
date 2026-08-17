// Nova Vanguard -- every gameplay constant in the build doc, in one file.
//
// Build doc §9.3: "/data/tuning.js holds every cap and constant in this
// document in one file [...] Nothing anywhere else hardcodes a gameplay
// number." That rule is what makes the on-device tuning pass (§10, POC-8) a
// config session rather than a code hunt, so keep it: if a number affects how
// the game FEELS or how hard it is, it belongs here, not at its use site.
//
// All coordinates and speeds are in the fixed 1920x1080 design space (§5.1).
// Fractions of width/height are written as fractions; pixel values as pixels.

// ---------------------------------------------------------------------------
// Design space (§5.1)
// ---------------------------------------------------------------------------

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

// ---------------------------------------------------------------------------
// Frame layout -- the band budget (§5.1)
// ---------------------------------------------------------------------------

export const BANDS = {
  // Boss HP bar only. No entity ever occupies it.
  hudStrip: { top: 0.000, bottom: 0.050 },
  // Warning markers for anything arriving from the top edge (§5.3).
  entryTelegraph: { top: 0.050, bottom: 0.075 },
  // Where formations lock and hold.
  formation: { top: 0.060, bottom: 0.340 },
  // 34% -- comfortably over the >=25% floor. Enemies cross it; nothing camps.
  gutter: { top: 0.340, bottom: 0.680 },
  // Where the interceptor lives, and where the game promises safety.
  player: { top: 0.680, bottom: 0.960 },
  // Surface only.
  bottomStrip: { top: 0.960, bottom: 1.000 },
};

// Horizontal budget (§5.1). Outer 6% each side is HUD margin.
export const PLAYABLE_X = { min: 0.06, max: 0.94 };
// Player clamped tighter so the craft is never visually under a gauge.
export const PLAYER_CLAMP_X = { min: 0.08, max: 0.92 };

// Vertical player clamp -- the exact same idea as PLAYER_CLAMP_X, applied to
// the other axis, and added for the same class of reason.
//
// THE BUG IT FIXES (Amit, playtest round 3): "when I go back, back, back down,
// my airplane spaceship is a little bit cut. I cannot see, it's last 10%."
// The player was clamped to BANDS.player.bottom = 0.960, i.e. y = 1036.8. The
// hull is 128 px tall and centre-anchored, so its bottom edge landed at 1101
// against a 1080 px frame -- 21 px, ~16% of the sprite, off the bottom.
//
// WHAT THIS DOES NOT TOUCH, which matters more than the fix. The BAND BUDGET
// in BANDS is untouched, so:
//   * the reaction gap is still formation.bottom -> player.top = 367 px and
//     APPROACH_BUDGET is unchanged at 300 px/s (§5.3);
//   * the player band is still the authored bottom 30% (§5.1);
//   * LATERAL_ONLY_TEST_Y stays 0.82, comfortably inside the new clamp, so
//     §5.3's "hold y = 0.82 and move laterally only" line is unaffected and
//     MVP item 23a is unaffected.
// This only stops the player travelling into the last 3% of the frame, which
// was never usable space -- it was the part where the ship left the screen.
// The pacing arithmetic does not move at all.
export const PLAYER_CLAMP_Y = {
  // 0.62, NOT the player band's top edge of 0.680 -- and this was a real
  // conflict, found by the boot validator rather than by eye.
  //
  // Clamping the player at the band's ceiling makes two things the design
  // requires physically impossible. §5.6: "No pickup ever sits above y = 0.62.
  // Reaching the highest one is a ~1.1 s slow drift." §6.4's vulnerable window
  // doubles core damage for "drifting up to y ~= 0.62". Both put an OPTIONAL
  // reward at 0.62, which is 60 px above 0.680 -- so a player clamped to the
  // band could never claim either, and §6.4's "one designed use of the
  // vertical axis" would have been dead on arrival.
  //
  // So the band and the clamp mean different things, which is what §5.1
  // actually says: the player band is "where the interceptor LIVES and where
  // the game promises safety", not a wall. Drifting above it is exactly the
  // risk §5.5 describes -- "contact damage exists on the swoop, which is
  // exactly what makes a player who is drifting upward for a chevron take a
  // real risk" -- and a swoop bottoms out at 0.62 precisely so that the two
  // can meet. That only works if the player can get there.
  //
  // None of this touches the pacing contract: the reaction gap is measured
  // between BANDS.formation.bottom and BANDS.player.top, both unchanged.
  min: 0.620,
  // 1080 - (128/2) - 10 px of visible margin = 1006 -> 0.9315. Rounded to
  // 0.930 so the ship's tail clears the frame edge by a visible sliver rather
  // than kissing it.
  max: 0.930,
};
// Formations are laid out inside this.
export const FORMATION_X = { min: 0.10, max: 0.90 };
// Banner band, centred in the gutter (§7.1).
export const BANNER_Y = 0.42;

// ...and where it goes while a boss hull is on screen.
//
// TWO AUTHORED NUMBERS COLLIDED HERE and the validator has been reporting it as
// an unresolved note: §7.1 puts banners at y = 0.42, §6.4 hangs the boss into
// the upper gutter, and at the shipped hull aspect the hull covers y = 94..586
// -- so 0.42 (y = 454) is squarely on armour. The banner that suffered most was
// "CORE EXPOSED — CLIMB", which is the single line telling the player what the
// vertical axis is for.
//
// The tie-break is not "which section is more senior", it is that an
// instruction which cannot be read is not an instruction. So banners step down
// to 0.575 for exactly as long as a boss hull is on screen, and step back
// afterwards. 0.575 is chosen from both sides:
//   * BELOW the hull. The hull's lowest point is 0.543 (its central mast; the
//     body ends at 0.479), so the band clears the art rather than tucking under
//     a wing.
//   * ABOVE anywhere the player can be. PLAYER_CLAMP_Y.min is 0.620, so even a
//     player holding the vulnerable window's climb line sits below the band.
// It is still inside §7.1's gutter (0.34..0.68), so the rule the number came
// from is intact -- only the position within the gutter moves.
export const BANNER_Y_BOSS = 0.575;
// Centre-top stays clear: no persistent readout above this y in the middle 60%.
export const CENTRE_CLEAR_ABOVE_Y = 0.34;
// An entering squadron may transit a margin for at most this long, and may not
// fire while inside one (§5.1).
export const MARGIN_TRANSIT_MAX_S = 0.6;

// ---------------------------------------------------------------------------
// Controls (§4) -- analog mode. The game reads window.__gbSensor itself and
// must NEVER also listen for the host's synthetic arrow keys.
// ---------------------------------------------------------------------------

export const INPUT = {
  // The two axes are deliberately asymmetric (§4). Lateral is fast, lightly
  // deadzoned and precise; vertical is slow and heavily deadzoned so a player
  // who never intends to use it never drifts by accident while leaning hard
  // sideways. Do NOT "fix" the vertical axis by speeding it up or narrowing
  // its deadzone -- that asymmetry IS the lean-ergonomics finding (§0.5).
  deadzoneX: 0.08,
  deadzoneY: 0.28,
  // Full lateral traverse ~= 1.9 s.
  lateralMax: 840, // px/s
  // Full player-band traverse ~= 1.6 s.
  verticalMax: 190, // px/s
  // Roll-state hysteresis so the sprite doesn't strobe at the deadzone edge
  // (§6.1). Roll engages above `rollOn`, releases below `rollOff`.
  rollOn: 0.22,
  rollOff: 0.14,
  // Desktop dev fallback: keyboard ramps toward full deflection over this many
  // seconds, so a keyboard feels a little more like a lean and a little less
  // like a switch. It is a dev convenience, not a second input path (§4).
  keyboardRampS: 0.18,
};

// ---------------------------------------------------------------------------
// The pacing contract (§5.3) -- reaction floor, aisle floor, density caps.
// These four are FLOORS, NOT DIFFICULTY LEVERS (§5.7). The constraints
// validator (§9.4, /systems/constraints.js) asserts all of them at boot.
// ---------------------------------------------------------------------------

// enemy band bottom -> player band top = 734 - 367 = 367 px, crossed in >=1.2s.
export const REACTION_GAP_PX =
  BANDS.player.top * DESIGN_H - BANDS.formation.bottom * DESIGN_H; // 367
export const REACTION_FLOOR_S = 1.2;
// The doc rounds 367/1.2 = 305.8 DOWN to 300 and then authors every per-mode
// share off that rounded figure (Mode S: 300 - 135 = 165). Keep the authored
// 300 rather than the derived 305.8 -- rounding down errs safe, and the
// validator asserts the authored budget never exceeds the true derived one.
export const APPROACH_BUDGET = 300; // px/s

// Aisle floor. ~12x the player's hitbox radius.
export const AISLE_MIN = 0.09 * DESIGN_W; // 172.8 px
// Patterns that MOVE their aisle may move it no faster than half the player's
// lateral top speed, so following it is a committed lean, not a chase.
export const AISLE_MOVE_MAX = 420; // px/s

export const DENSITY_CAPS = {
  normal: {
    bullets: 22,
    enemies: 20,
    minBulletRadius: 18,
    simultaneousPatterns: 2,
  },
  elite: {
    bullets: 30,
    enemies: 26,
    minBulletRadius: 18,
    simultaneousPatterns: 3,
  },
};

// ---------------------------------------------------------------------------
// FLAGGED DOC CONFLICT -- read before touching this number.
//
// §5.5's F1 formation is 12 x 2 = 24 craft, and §2/§10 make that grid the
// POC's ONLY formation. §5.3's density cap allows 20 simultaneous air enemies
// at Normal (26 at Elite). A fully-locked 12 x 2 therefore exceeds the Normal
// cap by 4 craft, by design, in the one formation the POC is specified to
// build. Both numbers are authored; the doc never reconciles them.
//
// Stage 4 does not get to pick which of two authored numbers wins, so this is
// flagged back rather than silently resolved. What is built here is the least
// invasive reading that keeps BOTH POC deliverables intact:
//
//   * The 12 x 2 grid is preserved whole -- the pre-lock kill window and the
//     "wide shallow formation" read are the things POC-4 exists to test, and
//     gating spawns at 20 would mean the grid never actually forms.
//   * The POC's simultaneous-enemy cap is raised to exactly the slot count
//     (24), which sits between Normal's 20 and Elite's 26 -- so it is inside
//     the range the doc itself already sanctions, not a new invented ceiling.
//   * Every OTHER cap (bullets, bullet radius, simultaneous patterns) stays
//     at Normal, untouched.
//   * The validator reports this as an explicit named deviation on every boot
//     rather than passing quietly, so it cannot be forgotten.
//
// Resolution needed from stage 3 / Amit: either the Normal air-enemy cap
// rises to >= 24, or F1 is re-cut narrower (e.g. 10 x 2) for Normal.
export const POC_ENEMY_CAP_OVERRIDE = 24;

// The entry-band telegraph (§5.3). Required in both modes.
export const TELEGRAPH = { leadS: 1.0, fadeInS: 0.2 };

// The vertical-requirement rule as a testable line (§5.3): a player who holds
// this y for an entire wave and moves only laterally must be able to clear it
// without taking a hit.
export const LATERAL_ONLY_TEST_Y = 0.82;

// ---------------------------------------------------------------------------
// Framing modes (§5.2) -- ONE config value selects everything mode-dependent.
// Read it through core/mode.js's accessor; nothing else branches on it ad hoc.
// ---------------------------------------------------------------------------

// The POC default. Overridable by ?mode=S|A and by the live in-session toggle.
export const DEFAULT_FRAMING_MODE = 'S';

// SCROLL_SPEED sits at 45% of the approach budget. 50% (150 px/s) is the
// absolute cap and the fastest the scroll may EVER be tuned, at any tier, in
// any sector (§5.3).
export const SCROLL_SPEED = 135; // px/s
export const SCROLL_SPEED_HARD_CAP = 0.5 * APPROACH_BUDGET;

export const MODES = {
  // Mode S -- scrolling wide arena.
  S: {
    id: 'S',
    label: 'MODE S — SCROLL',
    scrollSpeed: SCROLL_SPEED,
    // Scroll counts against the approach budget (§5.3). This is a binding
    // TUNING RULE, not a physics claim -- do not "optimise" it away for air
    // projectiles just because a bullet is in the air frame.
    patternDescentCap: APPROACH_BUDGET - SCROLL_SPEED, // ~= 170, doc says 165
    patternDescentTuned: 130,
    swoopDescentSpeed: 145,
    // Entry-path loop amplitude, as a fraction of height. Bounded so the
    // loop's own downward velocity stays inside the descent cap.
    entryLoopAmp: 0.06,
    // Ambient overlay drift multipliers -- cheap two-layer parallax.
    overlayDriftMul: [0.6, 1.4],
    // Mode S has no anti-deadness budget: the world supplies the flow.
    ambientLateralDrift: 0,
    surfaceEventsPerWave: 0,
  },
  // Mode A -- fixed arena. The sector is one place you hover over.
  A: {
    id: 'A',
    label: 'MODE A — FIXED',
    scrollSpeed: 0,
    patternDescentCap: APPROACH_BUDGET,
    patternDescentTuned: 240,
    swoopDescentSpeed: 230,
    entryLoopAmp: 0.10,
    overlayDriftMul: [0.6, 1.4],
    // Mode A's anti-deadness budget (§5.2) -- REQUIRED, not decoration.
    // Overlays never stop moving; emissives pulse; at least one authored
    // surface event per wave, placed off the player's line.
    ambientLateralDrift: 11, // px/s, slow lateral/rotational loop
    surfaceEventsPerWave: 1,
  },
};

// Mode-agnostic hard cap used by the validator for the Elite ceiling.
export const PATTERN_DESCENT_HARD_CAP = { S: 165, A: 290 };

// ---------------------------------------------------------------------------
// Surface (§5.4)
// ---------------------------------------------------------------------------

export const SURFACE = {
  // Readability band, enforced in code by a scrim over the surface container
  // so generated art that comes back too hot is brought into band WITHOUT
  // regenerating it (§9.5 rule 6).
  scrimAlpha: 0.42,
  scrimColor: 0x05060c,
  // Additional desaturation applied as a tint multiplier on surface sprites.
  surfaceTint: 0x8e93a8,
  propTint: 0x9aa0b4,
  targetMaxLuminance: 0.45,
  targetMaxSaturation: 0.35,
  emissiveMaxFrameFraction: 0.12,
  // Emissive pulse (§5.2 anti-deadness). Long, slow, out-of-phase cycles.
  emissivePulse: { base: 0.52, amp: 0.26, periodS: 6.4, period2S: 9.7 },
  // Ambient overlays render UNDER the action layer, never above (§5.4).
  overlayAlpha: [0.16, 0.10],
  // Mode A scheduled surface activity -- a fissure flaring, off the player's
  // line so it is scenery, not a threat.
  surfaceEvent: { durationS: 2.4, radius: 260, peakAlpha: 0.75 },
  // Prop scatter density, per screen-height of surface.
  propsPerScreen: 9,
  // Altitude cue (§5.4): every air entity casts a small soft dark blob shadow.
  shadow: { offsetX: 10, offsetY: 16, scale: 0.82, alpha: 0.38 },
};

// ---------------------------------------------------------------------------
// Inter-sector surface transition -- the screen-covered swap (§5.4, and the
// POC-8 decision note §3, which demotes the far-void diegetic seam to polish
// and puts this first). See /surface/transition.js for what this is NOT.
// ---------------------------------------------------------------------------

export const SECTOR_TRANSITION = {
  // Fast to opaque -- it is hiding a swap, and a slow fade would show the old
  // surface for most of it.
  coverInS: 0.55,
  // Long enough to read the destination name at arm's length, on a board.
  holdS: 1.1,
  // Released gently, so the new surface is read before anything is shot at.
  coverOutS: 0.7,
  // Total 2.35 s, against the decision note's <= 10 s budget for the whole
  // eventual inter-sector sequence -- §7.2's tally / console / briefing have to
  // land on top of this later without the sequence stacking.

  // Fire automatically when the POC's three-wave loop completes a cycle, so the
  // transition can be judged repeatedly without an operator having to press
  // anything. Every sector, not every second sector (decision note §4).
  autoOnWaveCycle: true,
};

// ---------------------------------------------------------------------------
// Player (§6.1, §5.10)
// ---------------------------------------------------------------------------

export const PLAYER = {
  spawnX: 0.5,
  spawnY: 0.86,
  // Far smaller than the ~120px-wide sprite. This is the standard shmup
  // fairness affordance and it matters MORE here than usual, because fine
  // lateral correction on a board is expensive. Do not scale it to the art.
  hitboxRadius: 14,
  spriteWidth: 120,
  // Drawn height at spriteWidth, from the shipped art's 256x274 cell. Used
  // only to keep the craft inside the frame (PLAYER_CLAMP_Y) and asserted
  // against that clamp by the validator, so a taller hull cannot silently
  // start clipping again.
  spriteHeight: 128,
  // Attrition, not lives (§5.10).
  shieldSegments: 6,
  damage: { bullet: 1, enemyCollision: 2, groundFire: 1 },
  invulnS: 1.2,
  // Auto-fire is unconditional: no fire button, no cooldown the player can
  // affect, no input that changes it (§4). Rank changes what comes out; POC
  // has no chevrons so rank is pinned at 1 (§2).
  fire: {
    rank1IntervalS: 0.105,
    boltSpeed: 1450, // px/s upward
    boltRadius: 9,
    boltDamage: 1,
    muzzleOffsetY: -52,
  },
};

// ---------------------------------------------------------------------------
// Air enemies (§5.5, §6.2). POC ships the Drone only.
// ---------------------------------------------------------------------------

export const ENEMY = {
  // §6.2's bestiary is composed from three ORTHOGONAL pieces -- entry path,
  // formation slot behaviour, fire pattern -- "so new types at Post-MVP are
  // data, not code". Two of the six are built, and the second one exists to
  // answer playtest round 2's repetition note at the level the previous pass
  // concluded actually matters: "every craft still enters the same way, holds
  // the same way and swoops the same way. One type with a different behaviour
  // would do more for 'feels repetitive' than F4 and F5 combined."
  //
  // `swoops` and `pattern` ARE that composition. Nothing in /enemies branches
  // on a type name.
  types: {
    drone: {
      id: 'drone',
      hp: 1,
      radius: 34,
      spriteWidth: 92,
      // Drawn height at spriteWidth, from the shipped art's 176x224. Band
      // discipline (§5.1) is a statement about the sprite's VERTICAL extent,
      // and the validator used to approximate that with spriteWidth -- which
      // silently under-reported the drone (taller than it is wide) and would
      // have over-reported the Emitter (wider than it is tall). Authoring the
      // real number is the fix.
      spriteHeight: 117,
      score: 100,
      // Contact damage exists on the swoop (§5.5).
      contactDamage: PLAYER.damage.enemyCollision,
      // The drone comes to YOU. It is the reactive threat.
      swoops: true,
      // Its fire is the wave's, not its own -- drones are formation filler and
      // B1 picks a random locked shooter from among them (§6.2).
      pattern: null,
      tint: 0xffffff,
    },

    // §6.2: "Emitter | 3 | Sits in formation and runs B2 sweeps. Never
    // swoops." Chosen by Amit as the second type, and the reason it was
    // chosen is the reason for every number here: the drone comes to you and
    // the Emitter does not, so it is a persistent threat that has to be
    // cleared DELIBERATELY rather than reacted to, and it changes what you
    // decide to shoot rather than how fast you dodge.
    emitter: {
      id: 'emitter',
      // 3 HP is ~29 bolts/second x 3 = a real, felt commitment of fire time
      // at rank 1, not an incidental kill on the way past. That commitment is
      // the decision the type exists to create.
      hp: 3,
      radius: 44,
      spriteWidth: 118,
      // From the shipped art's 232x176 -- WIDER than it is tall, which is the
      // silhouette doing the gameplay work: a planted gun platform, not a
      // swept fighter. It is therefore also the SHORTER of the two types, so
      // it is the drone that sizes the band-discipline check.
      spriteHeight: 90,
      // Worth well over 2x a drone: it costs 3x the fire time and removing it
      // removes a whole bullet pattern, so the score has to agree with the
      // priority the design wants the player to feel.
      score: 260,
      contactDamage: PLAYER.damage.enemyCollision,
      // NEVER, at any tier, not even as a rare variant. The entire value of
      // the type is that it stays put -- give it a peel path and it collapses
      // back into a slower drone. /systems/constraints.js asserts this.
      swoops: false,
      // It OWNS its pattern. B2 is emitted by this craft from its own slot,
      // not by the wave, which is what makes "kill it and the sweep stops"
      // literally true rather than a flavour claim (see /patterns).
      pattern: 'B2',
      tint: 0xffffff,
    },
  },
  // Entry (§5.5): craft enter in file from the left or right edge only.
  entry: {
    fileSpacingS: [0.15, 0.25],
    yRange: [0.12, 0.34],
    // The path crosses at least 60% of the frame width in full view.
    minWidthCrossed: 0.60,
    durationS: [2.5, 4.0],
    // Then peels to its formation slot and settles. Extended automatically if
    // the descent to the slot would otherwise breach the approach cap.
    peelS: 0.5,
    // Entering craft do NOT fire until locked -- this keeps the pre-lock kill
    // window a clean risk-free offer and makes aggression unambiguously
    // correct (§5.5).
    firesWhileEntering: false,
  },
  // Formation hold (§5.5).
  formationDriftMax: 60, // px/s, lateral only, never downward out of band
  formationDriftPeriodS: 8.5,
  // The swoop -- the one dive shape this game has (§5.5).
  swoop: {
    // Dips to the TOP of the player band, never into it.
    minY: 0.62,
    // §5.5 measures the swoop as "dips from y ~= 0.30 to y ~= 0.62 (346 px)"
    // and gives it 2.2-3.5 s. Those two numbers only agree with each other if
    // the clock starts at the BOTTOM OF THE FORMATION BAND, not at the craft's
    // own slot: a row-0 craft sits at y = 0.11, and dropping it all the way
    // from there inside the Mode S descent cap takes 3.8 s of descent alone,
    // which no 3.5 s window can contain. So the swoop has a separate,
    // uncounted PEEL-OUT phase that glides the craft from its slot down to the
    // band bottom first -- itself capped -- and the authored duration window
    // applies to the dip + return, exactly the span the doc describes.
    startY: 0.30,
    durationS: [2.2, 3.5],
    returnS: 1.0,
    minWidthTravelled: 0.35,
    // How often a locked craft peels, per craft.
    cooldownS: [3.4, 7.5],
    maxConcurrent: 3,
  },
  // Pre-lock bonus x2 (§8.2). Tracked at POC for instrumentation only -- POC
  // has no scoring UI (§2).
  preLockScoreMultiplier: 2,

  // PER-CRAFT RUNTIME VARIATION -- the cheap half of playtest round 2's
  // "feels a bit too repetitive".
  //
  // §0.3 fixed the rendered idiom partly BECAUSE "it permits runtime
  // transforms": one ship image is meant to cover every heading via rotation.
  // This is the same trade applied to sameness -- a formation of twenty drones
  // stops looking like twenty copies of one file for the cost of two numbers per
  // craft and no new art at all.
  //
  // ALL THREE ARE PRESENTATION OR CADENCE, NEVER GEOMETRY, and that boundary is
  // the point:
  //   * `size` scales the DRAWN sprite only. The hitbox stays `def.radius`, so
  //     §5.3's collision arithmetic and the aisle guarantees are untouched, and
  //     a craft can never be harder to hit than it looks.
  //   * `tint` skews within the enemy family only. §5.4 colour-codes OWNERSHIP
  //     (enemy orange/magenta, player cyan-white) and these all sit inside that,
  //     so a varied craft can never be misread as friendly.
  //   * `cadence` jitters an owned emitter's volley interval. It changes WHEN a
  //     pattern fires, never how many orbs it contains or how wide its aisle
  //     is -- so every authored §5.3 guarantee still holds volley by volley, and
  //     the runtime bullet-cap assertion covers the aggregate.
  //
  // WHAT IS DELIBERATELY NOT HERE: a twin-shot Emitter variant. Doubling a
  // craft's orbs changes the bullet count and the aisle geometry, which
  // /systems/constraints.js proves statically per PATTERN -- so a per-craft
  // "fires two" would be a real pattern hiding from the validator that exists to
  // check it. The honest version is a new authored pattern row (say `B2T`) that
  // gets validated like B1 and B2, and authoring a new bullet pattern is content
  // design rather than a presentation fix. Flagged, not smuggled in.
  vary: {
    // Deterministic, but HASHED FROM THE CRAFT'S IDENTITY rather than drawn from
    // the seeded stream -- see varyHash in /enemies/enemies.js. Same craft, same
    // look, every replay and both modes (§0.1), with the RNG sequence §10's
    // instrumentation samples were collected against left exactly where it was.
    sizeRange: [0.90, 1.10],
    // Small multiplicative skews on the texture's own colour. Kept subtle: the
    // silhouette is doing the work, and a strong tint would start to read as a
    // TYPE distinction, which would be a lie about what the craft does.
    tints: [0xffffff, 0xffe4ea, 0xe6e2ff, 0xfff0dc, 0xe8f2ff],
    cadenceRange: [0.86, 1.18],
  },

  // Damage feedback (§6.2: "One shared damaged/scorched overlay per type [...]
  // one floating HP pip for damaged craft").
  //
  // This only became worth building with the Emitter. A 1 HP drone is alive or
  // gone, so a pip over it would carry no information and a scorch would never
  // be seen. A 3 HP craft that must be gone after deliberately is exactly the
  // case where "have I already put two bolts into that one, or am I starting
  // over" is a real question mid-wave, and answering it is what makes the
  // focus-fire decision legible instead of guesswork.
  damage: {
    // Pips appear only for types that can survive a hit at all.
    pipMinMaxHp: 2,
    pipW: 15,
    pipH: 7,
    pipGap: 5,
    // Above the craft, as a fraction of its sprite width -- so the pip row
    // clears the hull on a wide craft and a narrow one alike.
    pipOffsetY: -0.46,
    pipOnColor: 0x9dff5a,
    pipOffColor: 0x2a3524,
    // The scorch fades IN as HP drops, rather than switching on at a
    // threshold: a craft at 2/3 is visibly singed and one at 1/3 is visibly
    // wrecked, which reads as progress on a target you are committing to.
    scorchScale: 0.78,
    scorchMaxAlpha: 0.92,
  },
};

/** Per-type definition (§6.2). Nothing outside /data may hardcode a type
 *  name; everything reads the composition through here. */
export function enemyDef(type) {
  return ENEMY.types[type] || ENEMY.types.drone;
}

// ---------------------------------------------------------------------------
// Bullet patterns (§5.5). POC ships B1 and B2 (§10, POC-5).
// Each declares its guaranteed aisle so /systems/constraints.js can verify it.
// ---------------------------------------------------------------------------

export const PATTERNS = {
  // B1 -- sparse aimed lob. Move and it misses; the aisle is everywhere but
  // where you were.
  B1: {
    id: 'B1',
    name: 'Sparse aimed lob',
    orbs: 3,
    orbRadius: 21,
    // Staggered so they arrive as a readable sequence, not a wall.
    staggerS: 0.4,
    volleyIntervalS: 3.8,
    // Aimed at the player's x AT TIME OF FIRE.
    aimed: true,
    // The aim is scaled so the DOWNWARD component is exactly the mode's tuned
    // descent speed -- which is what keeps an aimed shot inside the cap.
    maxAimRatio: 0.75, // |vx| <= this * vy
    guaranteedAisle: AISLE_MIN * 2.4, // sparse by construction
    aisleMoveSpeed: 0,
  },
  // B2 -- lateral sweep fan. One authored gap travels with the fan.
  B2: {
    id: 'B2',
    name: 'Lateral sweep fan',
    rows: 2,
    rowIntervalS: 0.7,
    orbSpacing: 300,
    orbRadius: 24,
    volleyIntervalS: 7.4,
    // The authored gap: wider than the floor, and it MOVES no faster than
    // AISLE_MOVE_MAX so following it is a committed lean, not a chase.
    guaranteedAisle: AISLE_MIN * 1.9,
    aisleMoveSpeed: 300,
  },
};

// Enemy bullets never fire from below the player band, and nothing may fire
// while transiting a HUD margin (§5.1, §5.5 do-not-port list).
export const BULLET = {
  // Below this y an enemy bullet is retired; nothing survives into the bottom
  // strip to become a surprise.
  despawnY: 1.02,
  // Near-miss radius, used by instrumentation (and by the vent at MVP).
  nearMissRadius: 40,
};

// ---------------------------------------------------------------------------
// POC scenario (§2, §3). "POC runs steps 1-5, 9 and a bare loop of step 3, in
// both modes, forever." The loop is deterministic and IDENTICAL in both modes
// -- that identity is the entire basis of the A/B (§0.1).
// ---------------------------------------------------------------------------

// Entry pace buckets (§5.5: the transit takes 2.5-4.0 s end to end). A squadron
// picks a SUB-RANGE of that authored window rather than a new number, so
// "vary the entry timing" cannot quietly widen the spec. `fileSpacingS` is left
// alone for the same reason -- §5.5 fixes it at 0.15-0.25 s.
export const ENTRY_PACE = {
  brisk: [0.0, 0.42],
  normal: [0.0, 1.0],
  lazy: [0.58, 1.0],
};

export const POC_SCENARIO = {
  seed: 0x4e6f7661, // 'Nova'
  // A short escalating cycle that repeats forever.
  //
  // Six entries, not three, and every one of them differs from its neighbours
  // in FORMATION SHAPE, entry side, squadron split, arrival delay and entry
  // pace. That is the direct answer to playtest round 2's "at some point it
  // feels a bit too repetitive": the old cycle was three near-identical 12x2
  // grids, so the third loop looked exactly like the first.
  //
  // NAMING: these are still `waves`. Playtest round 2 §1 re-cuts the taxonomy
  // (`waves[]` -> `subWaves[]`, four of them per wave, four waves per level) but
  // that change forces a session-length call that is Amit's, so the rename and
  // the nesting are deliberately NOT done here. Renaming half of it now would
  // make the pending decision harder to apply, not easier.
  //
  // `slot` is the first formation slot the squadron fills; it runs `count`
  // consecutive slots from there. Slot indices are formation-relative, so the
  // same squadron table works for a grid, an ellipse and a chevron.
  // WHERE B2 WENT. Waves used to author `patterns: ['B1','B2']` and the sweep
  // fan came from nowhere in particular. It now comes from EMITTER CRAFT, and
  // only from them -- §6.2 says the Emitter "sits in formation and runs B2
  // sweeps", so the wave authors the craft and the craft brings the pattern.
  //
  // That relocation is the whole gameplay claim of this slice, made literal:
  // kill the Emitter and the sweep genuinely stops, because the thing emitting
  // it is gone. It also means an Emitter's 3 HP is not just durability, it is
  // how long the pattern survives your decision to deal with it.
  //
  // `types` on a squadron is optional and per-slot-offset: 'drone' everywhere
  // unless named. Emitters are placed at slots the player has to travel to,
  // not at the apex they were already shooting.
  waves: [
    {
      name: 'WAVE 1',
      formation: 'F1',
      squadrons: [{ side: 'L', count: 12, slot: 0, pace: 'normal' }],
      patterns: ['B1'],
      hardest: false,
    },
    {
      // A chevron off one wing, then the other -- the apex lands last, so the
      // natural focus-fire target is also the newest arrival. ONE Emitter, on
      // a wing, as the introduction: it is the only thing sweeping, it is
      // visibly not diving, and it is far from the apex the player's guns are
      // already pointed at.
      name: 'WAVE 2',
      formation: 'F3',
      squadrons: [
        { side: 'R', count: 6, slot: 0, pace: 'brisk', types: { 0: 'emitter' } },
        { side: 'L', count: 5, slot: 6, delayS: 1.1, pace: 'lazy' },
      ],
      patterns: ['B1'],
      hardest: false,
    },
    {
      // The lens, filled as two opposing arcs.
      name: 'WAVE 3',
      formation: 'F2',
      squadrons: [
        { side: 'L', count: 9, slot: 0, pace: 'normal' },
        { side: 'R', count: 9, slot: 9, delayS: 1.8, pace: 'brisk' },
      ],
      patterns: ['B1'],
      hardest: false,
    },
    {
      // F5 SPLIT PODS. Two blocks at the outer thirds with 806 px of empty
      // centre: the guns point one way, so covering one block is choosing not
      // to cover the other. One Emitter per block makes that choice cost
      // something either way -- whichever side you commit to, the other side's
      // sweep is still coming, and you cannot answer it by out-shooting it.
      name: 'WAVE 4',
      formation: 'F5',
      squadrons: [
        { side: 'L', count: 6, slot: 0, pace: 'normal', types: { 4: 'emitter' } },
        { side: 'R', count: 6, slot: 6, delayS: 1.4, pace: 'brisk', types: { 1: 'emitter' } },
      ],
      patterns: ['B1'],
      hardest: false,
    },
    {
      // Fewer craft, more pattern pressure, so the difficulty curve is not
      // just "more ships": one long lazy chevron carrying two Emitters at
      // opposite wings.
      name: 'WAVE 5',
      formation: 'F3',
      squadrons: [
        { side: 'L', count: 11, slot: 0, pace: 'lazy', types: { 0: 'emitter', 10: 'emitter' } },
      ],
      patterns: ['B1'],
      hardest: false,
    },
    {
      // The designated hardest wave: full 12x2 from both sides. POC-8's
      // lateral-corrections metric is measured against this one, so it stays a
      // full grid -- changing its shape would break comparability with the
      // samples already collected. Two Emitters buried in the back row, which
      // is the hardest place to reach them from.
      name: 'WAVE 6',
      formation: 'F1',
      squadrons: [
        { side: 'R', count: 12, slot: 0, pace: 'normal', types: { 3: 'emitter' } },
        { side: 'L', count: 12, slot: 12, delayS: 1.2, pace: 'brisk', types: { 8: 'emitter' } },
      ],
      patterns: ['B1'],
      hardest: true,
    },
  ],
  // A wave ends when it is cleared, or when its timer expires and survivors
  // flee (§5.7).
  waveTimeoutS: 46,
  waveBannerS: 1.2,
  interWaveS: 1.4,
};

// ---------------------------------------------------------------------------
// Formation shapes (§5.5). POC ships F1 only.
// ---------------------------------------------------------------------------

// Three of §5.5's five shapes. F1 was the POC's only formation; F2 and F3 are
// pulled forward from MVP items 10-11 because playtest round 2 named repetition
// the POC's most-felt flaw ("we need a bit of variation with the enemies and the
// enemies placement"), and shape variety is the part of that which needs no new
// art at all. F4 (staggered picket) and F5 (split pods) are still MVP.
//
// Each declares `kind` + its own parameters; /enemies/enemies.js turns a
// (formation, slot) pair into a position, and /systems/constraints.js walks
// EVERY slot of EVERY shape at boot against the band budget. That check is the
// reason adding a shape is safe: an ellipse or a V that drifted out of the
// formation band would be a §5.1 violation the eye would not reliably catch.
// A NOTE ON THE ROW POSITIONS, which moved by ~6 px in this slice.
//
// The band-discipline check in /systems/constraints.js used to approximate a
// craft's vertical extent with its sprite WIDTH. Correcting it to the real
// drawn height (the drone is 117 px tall against 92 wide) showed that the top
// row of F1, F2 and F5 was overhanging the formation band's ceiling by ~5 px --
// a latent violation that predates the second enemy type and was hidden by the
// approximation, not caused by it.
//
// The rows are nudged down by the minimum that clears it rather than the check
// being relaxed. The overhang was into the entry-telegraph band (§5.1), which
// has to stay legible for top-edge arrivals; the HUD strip was never breached.
// Nothing about the F1 12x2 slot count is touched -- that conflict is still
// stage 3's to resolve (see POC_ENEMY_CAP_OVERRIDE).
export const FORMATIONS = {
  F1: {
    id: 'F1',
    name: 'Wide grid',
    kind: 'grid',
    cols: 12,
    rows: 2,
    // Both rows sit inside the formation band with sprite half-height margin.
    rowY: [0.116, 0.235],
  },
  // §5.5 F2: "~18 craft on a wide ellipse, 4.5:1 -- the report's observed
  // ring/diamond, squashed to fit a shallow band."
  F2: {
    id: 'F2',
    name: 'Flattened lens',
    kind: 'ellipse',
    count: 18,
    cx: 0.5,
    cy: 0.200,
    // Radii in FRACTION OF HEIGHT for both axes, so the 4.5:1 ratio is a ratio
    // of pixels rather than of normalised units (which would silently become
    // 8:1 on a 16:9 frame).
    // Tightened from 0.090 so both poles of the ellipse clear the formation
    // band once the sprite's real height is accounted for. The 4.5:1 ratio is
    // untouched, so the shape §5.5 asks for is unchanged.
    ryH: 0.083,
    ratio: 4.5,
    // Slot 0 at the left extreme, running clockwise, so a squadron filling a
    // contiguous slot range arrives as one recognisable arc of the lens.
    theta0: Math.PI,
  },
  // §5.5 F3: "11 craft in a very flat V. Its apex is the natural focus-fire
  // target." The apex is the LOWEST point -- nearest the player -- which is
  // what makes it the natural thing to shoot first.
  F3: {
    id: 'F3',
    name: 'Shallow chevron arc',
    kind: 'chevron',
    count: 11,
    xMin: 0.12,
    xMax: 0.88,
    wingY: 0.118,
    apexY: 0.265,
  },
  // §5.5 F5: "Split pods | Two 6-craft blocks at the outer thirds, centre
  // empty | Forces a lateral commitment: you cannot cover both."
  //
  // The previous pass named this the highest-value remaining shape and the
  // reasoning is why it is here and F4 is not: F4 (staggered picket) "reads as
  // depth without using any" -- it changes how a formation LOOKS. F5 changes
  // what the player has to DO, because the two blocks are 806 px apart and the
  // guns only point one way. That is the axis the repetition note was about.
  //
  // Zero new art, by construction: a formation is a slot table.
  F5: {
    id: 'F5',
    name: 'Split pods',
    kind: 'blocks',
    // Two 3x2 blocks = 12 craft, comfortably inside the Normal enemy cap
    // (20) without needing POC_ENEMY_CAP_OVERRIDE at all.
    cols: 3,
    rows: 2,
    // Centres of the outer thirds of the formation span [0.10, 0.90].
    blockCx: [0.215, 0.785],
    colGap: 0.075,
    rowY: [0.116, 0.235],
  },
};

// ---------------------------------------------------------------------------
// Bosses (§6.4) -- the SHARED framework. Per-boss flavour is /data/bosses.js.
//
// §6.4: "Per-boss flavour is in the pod layout and pattern assignment, not in
// new systems." So everything that is true of every boss lives here, and a
// second or third boss is a row in bosses.js over this.
// ---------------------------------------------------------------------------

export const BOSS = {
  // "Never enters the player band. Its lowest extent is y = 0.58."
  maxExtentY: 0.58,
  // Station: centred in the enemy band, hanging into the upper gutter.
  stationY: 0.315,
  // Wide, lying lengthwise across the frame. Kept inside the playable width
  // even at full sway, so no part of the hull is ever under a HUD gauge
  // (§5.1's HUD-exclusion rule, which §9.4 rule 4 asserts for boss extent).
  width: 1340,
  swayAmpX: 40,
  swayPeriodS: 11.0,

  // Entry: the hull slides in from above the top edge. Its descent is a
  // downward velocity component like any other, so the DURATION IS DERIVED
  // from the mode's approach cap rather than authored -- same discipline as
  // the squadron peel in /enemies (§5.3).
  entryFromY: -0.34,
  entryMinS: 1.6,

  // "full-width red WARNING band 2.0 s before, through the single-slot banner
  // queue so it can never collide with another banner".
  warningS: 2.0,

  // Pods -----------------------------------------------------------------
  // "Each pod owns ONE attack pattern; destroying it removes that pattern
  // permanently and pays score. So the fight measurably calms as you win,
  // which is the right shape for a board."
  //
  // podRadius is the DRAWN pod's own radius -- half of podSpriteWidth. It sizes
  // the reticle, the pip row and the hit FX. It is NOT the hitbox any more; see
  // podHitHalfW.
  podRadius: 43,
  podSpriteWidth: 86,
  podHp: 6,
  podScore: 900,

  // THE FIGHT'S HITBOX MODEL, and the reason it is not four 43px discs.
  //
  // The bug this replaces (Amit, boss playtest): "it's completely unclear how
  // to kill it and it's actually impossible to damage". It was literally
  // impossible, and the arithmetic is worth writing down so it cannot come
  // back. /systems/collision.js tested the boss's whole hull RECT first and
  // absorbed the bolt at the point of entry, then asked whether that point was
  // within podRadius of a pod. A bolt travels straight up, so it entered at the
  // hull's BOTTOM edge -- y = 586 at the shipped aspect -- while every pod sits
  // at the hull's centreline, y = 340. Two hundred and forty-six pixels apart,
  // tested against a 43px radius. Not one player bolt could ever reach a pod,
  // and the core (radius 66) was sealed off by the same 246px. Four pods on a
  // 1340px hull was never the problem; the hull eating the shot 246px early
  // was.
  //
  // WHAT IT IS NOW: each pod owns a SHOT CHANNEL -- a vertical lane through the
  // hull's armour, podHitHalfW either side of the pod's x. A bolt inside a
  // channel is NOT absorbed by the hull; it flies up the lane and detonates on
  // the pod, where the player can see it land. A bolt outside every channel
  // hits armour and visibly deflects. The core owns a channel too, on the same
  // rule, and while it is sealed a bolt in that lane rings off the closed
  // shutter -- feedback that says "this is the thing, it is just shut".
  //
  // Two properties this buys, both of which the disc model lacked:
  //   * AIMING IS PURELY LATERAL. The player lines up under a pod and holds --
  //     which is the only axis a tilt board is actually good at (§0.5, and the
  //     lean-ergonomics finding). Vertical position is irrelevant to landing a
  //     pod hit, so the fight never asks for the axis this product serves worst.
  //   * THE HITBOX IS DRAWABLE. A channel is a rectangle, so /render can show
  //     the player exactly where it is (the cyan lanes and reticles), and what
  //     you see is what you hit. A disc buried 246px inside an opaque hull was
  //     not showable, which is the other half of why nothing told the player
  //     where to shoot.
  //
  // 62, not 43: the channel is a little wider than the pod it serves so that
  // holding roughly under a pod is enough. The tightest adjacent pod pair on
  // Cinderjaw is 168px apart, so two 124px-wide channels still leave a visible
  // 44px armour gap between them -- aiming is easy, but it is still aiming, and
  // missing still teaches. /systems/constraints.js asserts the channels never
  // overlap each other or the core's, and that every channel centre is inside
  // the player's own lateral clamp so lateral movement alone can reach it.
  podHitHalfW: 62,

  // The hull's DAMAGE-TAKING silhouette, as a fraction of its drawn half-height.
  //
  // Measured off the shipped art rather than guessed: boss-cinderjaw-hull.png
  // is a lens whose body runs to |ny| = 0.72 of the texture, with a narrow
  // central mast carrying on to the texture edge. The old test used the full
  // rect, so a bolt could "deflect" in empty space up to 69px below the visible
  // skirt -- which reads as a broken game just as badly as no feedback at all.
  hullHitHalfHFrac: 0.72,

  // Targeting furniture (§5.4's ownership colours: the player is cyan-white,
  // so the player's own aiming overlay is cyan and can never be confused with
  // the boss's orange/magenta fire).
  targeting: {
    channelFillAlpha: 0.055,
    channelEdgeAlpha: 0.30,
    color: 0x6fe8ff,
    // Reticle brackets around each live pod.
    reticleAlpha: 0.72,
    reticleWidth: 3,
    reticleCorner: 22,
    // The caret at the channel's mouth, on the hull skirt -- "shots go in here".
    caretW: 20,
    caretH: 15,
    pulseHz: 2.2,
  },

  // Per-pod HP pips, drawn on the playfield directly above each pod. Same
  // language as a damaged Emitter's pip row (ENEMY.damage), deliberately: the
  // player has already learned "green pips over a thing = that thing's HP", and
  // the pods are then the only parts of the boss wearing them. That is most of
  // what makes "shoot those four" legible with no tutorial line.
  podPips: { w: 15, h: 7, gap: 4, offsetY: -74 },
  // §5.3 caps simultaneous distinct patterns at 2 (Normal) / 3 (Elite), and
  // four pods each owning a pattern would breach it on the first frame. So the
  // boss ROTATES: at most `caps.simultaneousPatterns` pods are firing at once,
  // handing off on this interval. Both rules survive intact -- a destroyed pod
  // leaves the rotation permanently, so the fight still calms exactly as §6.4
  // requires, and the cap is never exceeded.
  podRotateS: 4.5,

  // Hull bosses ----------------------------------------------------------
  // Boss one is one big HP pool with no weak points (see /data/bosses.js for
  // the decision and the wording it came from). The pool size is per-boss data;
  // these are the shared presentation numbers that make a 240-point pool
  // readable one bolt at a time.

  // The hull's own hit flash. SHORT on purpose: at rank 1 the player lands 9.5
  // bolts a second, so anything much longer than a frame or two never releases
  // and the hull just sits permanently lit -- which conveys nothing and hides
  // the death-sequence darkening. The per-shot feedback the player actually
  // reads is the impact spark on the hull plus the HP number ticking; this is
  // only the faint acknowledgement underneath both.
  hullHitFlashS: 0.06,
  hullHitFlashAlpha: 0.22,

  // The HP bar's damage chip -- the bright leading slice showing HP lost in the
  // last instant. Drained at a RATE rather than on a timer so the chip stays a
  // roughly constant length under sustained fire instead of strobing at the
  // fire rate.
  //
  // hpChipMin is what makes it actually visible, and it is not cosmetic padding.
  // One bolt is 1 point of 240, so a chip that only ever showed the literal
  // damage would be a 4px sliver on a ~1000px bar -- the same invisibility that
  // made the old pooled bar unreadable, reproduced one level down. Each hit
  // instead raises the chip to at least 6 points (~2.5% of the bar, ~25px), so
  // sustained fire shows a steady bright leading edge that visibly retreats,
  // and a single isolated shot shows a clear pulse that fades in ~0.23 s.
  hpChipDrainPerS: 26,
  hpChipMin: 6,

  // The bar rides ABOVE THE BOSS, not at the top of the screen. Amit could not
  // interpret the top-edge bar at all ("maybe it's the line up there, but I
  // don't know"), and the fix he asked for is association: "has its own HP bar
  // above it". These are fractions/pixels in design space, resolved per frame
  // from the hull's live geometry so the bar rides in with the entry and sways
  // with the hull.
  hpBar: {
    // Gap between the bar's underside and the top of the hull's VISIBLE body
    // (not the drawn rect -- the art's top strip is a narrow mast, and hanging
    // the bar off the rect would float it 69px higher than it looks).
    gapAboveHull: 16,
    // Width as a fraction of the hull's width. Narrower than the hull so the
    // bar reads as belonging to it rather than as a screen-wide HUD rule.
    widthFrac: 0.76,
  },

  // Core -----------------------------------------------------------------
  // "Core HP only begins dropping once all 4 pods are gone -- or during a
  // vulnerable window."
  coreHp: 30,
  coreRadius: 66,
  coreScore: 4000,

  // The vulnerable window -- "the game's one designed use of the vertical
  // axis" (§6.4), and the one place §0.5's rule that vertical moves must be
  // slow, optional and generously timed is actively exercised.
  //
  // ALWAYS OPTIONAL. The boss is fully killable from y = 0.82 by clearing the
  // pods; the window only doubles core damage for a player who chooses to
  // spend the drift. /systems/constraints.js asserts the window is long enough
  // for the round trip with margin, and that the boss dies without it.
  window: {
    intervalS: 12.0,
    durationS: 3.5,
    // Announced this long before it opens, so the drift can start early.
    announceS: 1.5,
    // Reaching this y doubles core damage. It is the top of the player band --
    // the player never leaves the band to claim it.
    rewardY: 0.62,
    damageMultiplier: 2,
  },

  // Death: "staged pod detonations, then a hull break-up over ~2 s,
  // particle-driven" (§6.4). No authored frames (§9.5 rule 3).
  // `hullStages` is how many staged blasts walk the hull of a boss that has no
  // pods to detonate -- four, so the death beat has the same shape and roughly
  // the same length as a pod boss's rather than collapsing into one puff.
  death: { podStaggerS: 0.28, breakUpS: 2.0, shakeMag: 16, hullStages: 4 },

  // The boss hull is a target the whole time, but only the pods and (when
  // exposed) the core take damage -- a bolt into bare hull sparks and dies.
  //
  // The cooldown is on the DEFLECT BURST, not on the absorption: every bolt
  // that hits armour still dies, but at rank 1 the player fires 9.5 bolts a
  // second and a full spark fan on each one would spend a fifth of
  // FX.particleCap on a single stationary point. Bolts inside the cooldown get
  // the cheap impact spark instead, so the feedback is never absent -- which
  // was the actual complaint -- just not repeated at full size.
  hullSparkCooldownS: 0.12,
};

// ---------------------------------------------------------------------------
// Presentation / FX
// ---------------------------------------------------------------------------

export const FX = {
  // Hard global particle cap with oldest-first eviction (§9.1).
  particleCap: 400,
  explosionParticles: 22,
  impactParticles: 6,
  // Bloom is a cheap additive-sprite fake, never a post-process pass, and
  // sits behind an on/off toggle -- unverified GPU cost on real WebView
  // hardware until tested on-device (§9.1).
  bloomEnabled: true,
  screenShake: { hitMagnitude: 9, hitDurationS: 0.22 },

  // Taking a hit (playtest round 3). §5.10's attrition model is the whole fail
  // state, and it was invisible: "it's not clear that the projectiles are bad
  // for me". The fix is the enemy-death explosion, played on the player's own
  // hull -- Amit's explicit instruction, and it costs no new art.
  //
  // Everything here exists to keep it distinguishable from an enemy dying
  // beside you: bigger than the enemy burst (which is 22 embers at 120-580
  // px/s and a 3.4 core), plus a white shockwave ring that nothing else in the
  // game draws. Budgeted at ~55 of FX.particleCap's 400.
  playerHitBurst: {
    coreSize: 5.6,
    embers: 26,
    emberSpeed: [200, 700],
    ring: 26,
    ringSpeed: 620,
    ringLifeS: 0.3,
    ringSize: 0.5,
  },

  // A player bolt striking the boss hull (Amit, after the fight became
  // winnable: "we will see small explosions where my projectiles hit, because
  // right now it feels too dull").
  //
  // THE BUDGET IS THE DESIGN CONSTRAINT HERE, not the look, because this is the
  // only effect in the game that runs at the fire rate for a sustained
  // half-minute. Measured against FX.particleCap's 400:
  //
  //   8 particles/hit x 9.52 hits/s x ~0.22 s mean life = ~17 live
  //
  // ...so the whole boss fight costs about 4% of the pool and cannot push an
  // enemy death (23) or a player hit (55) out of it via oldest-first eviction.
  // Raising `embers` to 12 would still only reach ~25 live; the reason not to is
  // readability, not budget -- see /render/particles.js bossImpact() for why the
  // size, life and colour mix are what they are, and change them together with
  // that reasoning rather than one at a time.
  //
  // Tuned up once already, on a look: the first pass at 6 particles read as a
  // spark rather than a burst against a hull this large. This is the size at
  // which it is unmistakably an explosion and still visibly smaller and cooler
  // than an enemy death, which is the distinction that has to survive.
  bossImpact: {
    coreSize: 2.2,
    coreLifeS: 0.15,
    embers: 7,
    emberSpeed: [110, 300],
    emberLifeS: [0.1, 0.26],
    // Small: an explosion's embers are 0.5-1.25, and at that size a stream of
    // these would read as a second bullet layer over the boss.
    emberSize: [0.26, 0.55],
    // The minority that runs warm. Enough to say "explosion" rather than
    // "spark"; not enough to add a population of orange dots competing with the
    // orange/magenta enemy fire the player is actually reading (§5.4).
    warmFraction: 0.34,
  },

  // Enemy projectiles breathe -- a scale pulse plus an additive-glow pulse, so
  // an orb reads as a live energy round rather than as one static sprite
  // (playtest round 2 §2). Pure runtime transform over the existing texture:
  // no new art, no extra particles, no extra draw call. This is precisely the
  // trade §0.3 made when it fixed the rendered idiom over pixel art.
  //
  // READABILITY IS THE BINDING CONSTRAINT, not the look. §5.3 sizes bullets
  // deliberately against the reaction-time budget and enforces a minimum
  // radius, so the pulse is authored to swing UPWARD ONLY: the multiplier runs
  // 1.00 -> 1.00 + scaleAmp and never dips below 1, which makes the drawn orb
  // never smaller than the authored radius and never smaller than its own
  // hitbox. /systems/constraints.js asserts exactly that at boot.
  //
  // Colour is untouched: the tint stays neutral and the orange/magenta comes
  // from the texture, so §5.4's ownership coding survives (enemy orange/magenta,
  // player cyan-white). Only alpha moves.
  //
  // Player bolts deliberately do NOT pulse. The asymmetry is the point -- enemy
  // fire is the thing that has to be read and dodged, and giving it the only
  // moving silhouette on screen makes it easier to pick out, not harder.
  enemyBulletPulse: {
    rateHz: 2.6,
    scaleAmp: 0.14,
    glowMin: 0.80,
    glowMax: 1.0,
    // Glow peaks slightly after the size does, so the two cycles read as one
    // breath rather than as a single flashing on/off.
    glowPhaseOffset: 1.05,
    // Golden-angle stride between successive spawns, so a volley never pulses
    // in lockstep. Deterministic (spawn order is), which keeps the mode A/B
    // comparison frame-identical.
    spawnPhaseStride: 2.399963,
  },
};

// ---------------------------------------------------------------------------
// Banners (§7.1) -- single-slot queue; two banners can never collide. This is
// a code invariant, not a timing coincidence.
// ---------------------------------------------------------------------------

export const BANNERS = { minShowS: 0.8, queueDepth: 3 };

// ---------------------------------------------------------------------------
// Instrumentation (§10, POC-7/POC-8)
// ---------------------------------------------------------------------------

export const INSTRUMENTATION = {
  // A "lateral correction" is a carve sign-change where both the outgoing and
  // incoming magnitudes exceed this threshold -- i.e. a real reversal, not
  // noise around neutral.
  correctionMagnitude: 0.22,
  // A "vertical dash" is sustained near-max vertical input for > 0.4 s. This
  // is THE drift-chasing detector and the metric Mode S most has to pass.
  verticalDashMagnitude: 0.8,
  verticalDashMinS: 0.4,
  // Rolling sample window for the on-screen readout.
  windowS: 20,
};
