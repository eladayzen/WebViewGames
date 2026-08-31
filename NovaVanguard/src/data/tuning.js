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

  // BOARD AXIS SIGNS -- applied to the window.__gbSensor read ONLY, never to
  // the desktop keyboard fallback.
  //
  // THE BUG THESE FIX (Amit, on the real board through the Unity SDK): "right
  // and left are working properly, but forward and backward are flipped. So
  // when I press forward in the go balance controller the plane goes backwards.
  // And when I lean backwards, the plane goes forward."
  //
  // GOBALANCE_SDK.md documents that `__gbSensor = {x, y}` is published every
  // pump but does not state a sign convention for y, and no other shipped game
  // uses that axis at all -- TmntSkateSlice's build doc says outright that "the
  // y component of __gbSensor is UNUSED". So Nova Vanguard is the first game to
  // find out what the board actually reports, and hardware is the authority.
  // The board reports lean-forward as POSITIVE y; screen space has positive y
  // pointing DOWN, so the raw value has to be negated for forward to mean
  // forward.
  //
  // WHY IT IS A SIGN ON THE SENSOR AND NOT ON `nudge` OR ON `verticalMax`.
  // Both of those would also invert the keyboard, where ArrowDown correctly
  // means "move down the screen" and is not broken. Only the board's y is
  // wrong, so only the board's y is flipped -- and it is a named constant so
  // that if hardware ever disagrees again this is a one-character change with a
  // paper trail, rather than a hunt through the input module.
  sensorXSign: 1, // lateral is confirmed correct on the board; do not flip
  sensorYSign: -1,

  // Full lateral traverse ~= 1.9 s.
  lateralMax: 840, // px/s

  // Vertical. RAISED FROM 190 (Amit, on the board: "vertical movement is too
  // slow"), and the number he was judging was authored blind against a keyboard.
  //
  // THE ASYMMETRY IS KEPT, because it is the lean-ergonomics finding expressed
  // as two constants (§0.5, §4) and not a tuning accident: lateral is the
  // comfortable, sustainable axis and forward/back is a more committed, more
  // tiring motion with worse fine control. What was wrong was the DEGREE.
  // Vertical was 23% of lateral; it is now 32%, so the axis is still visibly
  // damped and still heavily deadzoned (0.28 vs 0.08, untouched -- that is the
  // half of the asymmetry that stops accidental drift while leaning hard
  // sideways, and it is the half that matters most).
  //
  // WHAT IT DOES NOT BREAK, checked by /systems/constraints.js rather than by
  // eye: §6.4's vulnerable window still asks for a DRIFT and not a dash. The
  // climb from the lateral-only line to the reward line is 216 px, which was
  // 1.14 s and is now 0.80 s -- still over the 0.6 s floor R7 warns below, and
  // the 3.5 s window still leaves ~1.9 s of firing inside a round trip.
  verticalMax: 270, // px/s
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
  // How long the REPAIR sphere takes to swell and fade. Short: it is a
  // confirmation, not a state, and anything longer starts competing with the
  // barrier ring for "you currently have something".
  repairFlashS: 0.95,
  damage: { bullet: 1, enemyCollision: 2, groundFire: 1 },
  invulnS: 1.2,
  // Auto-fire is unconditional: no fire button, no cooldown the player can
  // affect, no input that changes it (§4). Rank changes what comes out; POC
  // has no chevrons so rank is pinned at 1 (§2).
  fire: {
    // 30% SLOWER THAN IT SHIPPED (playtest round 8). Amit: "the basic shot
    // should be like I said 30% slower fire rate. And then to have a pickup
    // which [...] just gives me more fire rate which will be the current fire
    // rate."
    //
    // 0.105 -> 0.150 was rate x 0.7 (9.52 shots/s -> 6.67); playtest round 9
    // took another 20% off, 0.150 -> 0.1875, i.e. 5.33 shots/s. Cumulatively
    // the baseline is at 56% of what it shipped with. The gap RAPID fills is
    // now large enough to be the point of picking it up rather than a nuance.
    //
    // PROJECTILE SPEED IS UNTOUCHED, deliberately -- he was explicit that this
    // is a fire-RATE change. boltSpeed drives the reaction-time arithmetic in
    // §5.3, so moving it would silently retune every pattern in the game.
    rank1IntervalS: 0.1875,
    boltSpeed: 1450, // px/s upward
    boltRadius: 9,
    boltDamage: 1,
    muzzleOffsetY: -52,
  },
};

// ---------------------------------------------------------------------------
// Weapons (§4, §8.1) -- what auto-fire actually puts out.
//
// §4 fixes the INPUT side of this permanently: "Firing is automatic and
// unconditional. It never stops, has no cooldown the player can affect, and
// there is no input that changes it. Rank changes what comes out; nothing else
// does." A pickup is not an input, so a temporary weapon swap is a change to
// what comes out -- the same category as rank -- and it leaves that rule whole.
//
// Everything here is a ROW, and the player carries `weapon` + `weaponT`. Adding
// a second temporary weapon is a row plus a pickup kind; /player has no idea
// what weapons exist.
// ---------------------------------------------------------------------------

export const WEAPONS = {
  // Rank 1's single bolt (§8.1). Identical to PLAYER.fire, read through the
  // same accessor so there is exactly one code path for firing.
  standard: {
    id: 'standard',
    name: 'BOLT',
    intervalS: PLAYER.fire.rank1IntervalS,
    // One bolt, straight up. §0.2: the guns always fire straight up; there is
    // no aim in this game, and an angled shot is a SPREAD, never an aim.
    shots: [{ angle: 0 }],
    speed: PLAYER.fire.boltSpeed,
    radius: PLAYER.fire.boltRadius,
    damage: PLAYER.fire.boltDamage,
    textureKey: 'bolt',
    tint: 0xd8fbff,
    // On-screen length multiplier over the radius, matching /render's existing
    // r*2.6 rule for the standard bolt.
    drawScale: 2.6,
  },

  // The pickup weapon (§5.6, and Amit's ask: "the simplest one is another
  // weapon like a fire different kind of projectiles for limited time").
  //
  // WHAT MAKES IT A DIFFERENT WEAPON RATHER THAN A BIGGER ONE. It fires THREE
  // fat slow rounds in a shallow fan instead of one fast needle. Against a
  // single small craft directly overhead it is worth roughly what the bolt is;
  // against a wide formation, a swooping pair or a boss hull it covers ground
  // the bolt cannot. So it changes WHERE you can be effective from rather than
  // how hard you hit, which is the only axis this game has (§3: "the only verb
  // is where do I stand").
  //
  // IT IS NOT STRICTLY BETTER, deliberately. The rounds travel at 0.72x the
  // bolt's speed, so at boss range the lead time is visibly longer, and the
  // angled pair miss a narrow target the centre round would have hit. A
  // temporary weapon that is simply "more damage" teaches nothing and makes the
  // base weapon feel bad for the other 90% of the level.
  //
  // COLOUR IS NOT NEGOTIABLE. §5.4 colour-codes bullet OWNERSHIP -- player
  // cyan-white, enemy orange/magenta, "no exceptions" -- so the alternate
  // weapon may change shape, count, speed and size, and may never change side.
  scatter: {
    id: 'scatter',
    name: 'SCATTER',
    intervalS: 0.145,
    // ±9.5°. Wide enough that the outer rounds clear a neighbouring formation
    // slot by the time they reach the band, narrow enough that all three still
    // land on a boss hull from directly underneath.
    shots: [{ angle: -0.166 }, { angle: 0 }, { angle: 0.166 }],
    speed: 1040,
    radius: 15,
    damage: 1,
    textureKey: 'spread',
    tint: 0xeafcff,
    drawScale: 3.0,
    // How long a pickup grants it. Long enough to span two squadron arrivals at
    // level two's pace, short enough that the loss is felt and the next drop is
    // wanted (§5.6 -- a temporary weapon is a lure, not a state).
    durationS: 11.0,
    // Picking a second one up while it is running tops the clock back up rather
    // than stacking, so two drops in quick succession are never wasted.
    refresh: true,
  },

  // -------------------------------------------------------------------------
  // RAPID -- the baseline's old fire rate, now something you earn.
  //
  // WHY THIS WEAPON EXISTS, and it is the whole point of playtest round 8.
  // Amit: "most of what I'm looking for is to fire all of the time. Because
  // it's much easier to aim like that, just going left and right and not having
  // to sniper anyone."
  //
  // That is a statement about what fire rate MEANS in this game. There is no
  // aim input (§0.2/§4) -- the only verb is where you stand -- so rate is not a
  // damage stat, it is COVERAGE. A faster gun widens the window in which
  // standing in roughly the right place is good enough. That is why a
  // slower-but-stronger weapon reads as a punishment here even at equal DPS,
  // and why the reward for a pickup should be rate.
  //
  // It is the one weapon with NO exotic behaviour: no spread, no pierce, no
  // homing, no range limit. Identical to the bolt in every respect except that
  // it fires at 0.105 -- exactly what the baseline was before this round. Its
  // weakness is therefore honest and structural rather than authored: it is the
  // only alternate weapon that gives you nothing you could not already do, so
  // taking it over a situational weapon is a real choice rather than a free
  // upgrade.
  rapid: {
    id: 'rapid',
    name: 'RAPID',
    // The pre-nerf baseline, referenced as a literal rather than through
    // PLAYER.fire so that retuning the baseline again does not silently drag
    // this with it -- the two numbers are related by history, not by rule.
    intervalS: 0.105,
    shots: [{ angle: 0 }],
    speed: PLAYER.fire.boltSpeed,
    radius: 9,
    damage: 1,
    textureKey: 'boltRapid',
    // ELECTRIC CYAN, and the colour has been through two corrections worth
    // recording. A warm gold read best as "running hotter" and R9 rejected it:
    // §5.4 codes bullet OWNERSHIP by hue and warm is the ENEMY's side. Amit
    // then asked for "some stronger color [...] maybe green" for feedback --
    // green fails the same rule (it needs blue >= green >= red) and would also
    // collide with the Emitter craft, which is the game's green thing.
    //
    // So the axis that IS free is saturation, not hue. The standard bolt is a
    // pale near-white cyan; this is the same hue driven hard, which separates
    // the two at a glance without either leaving the player's side of §5.4.
    // AZURE, the third colour this weapon has worn, and the constraint is the
    // interesting part. §5.4 codes bullet ownership by hue and R9 enforces it
    // as blue >= green >= red, so the player's side of the line is a WEDGE:
    // white through cyan through blue, and nothing else. Warm gold was rejected
    // outright; green fails the same test and collides with the Emitter craft.
    //
    // Round 9 asked for more separation again, and cyan had already spent the
    // saturation axis -- so this moves as far along the wedge as the rule
    // allows while staying bright enough to read over a near-black surface. A
    // deep blue would satisfy R9 and disappear on Ashfall.
    tint: 0x4da6ff,
    drawScale: 2.6,
    // 9 -> 16 -> 11 (rounds 9 and 11). The swing is worth recording, because
    // both moves were right for the state the game was in at the time.
    //
    // 16 was set when RAPID had just become the thing that restores the
    // original feel of a baseline cut to 56% -- a short clock then meant a
    // brief window of the game feeling right and a long one of it not. What
    // changed since is the scarcity rule: a weapon canister no longer spawns
    // while one is running, so a 16s RAPID also meant 16s of no weapon drops at
    // all. The clock stopped being just this weapon's duration and became the
    // length of everyone else's drought.
    //
    // 11 matches SCATTER, so RAPID is no longer the outlier in either
    // direction -- long enough to be worth crossing the frame for, short enough
    // that the rest of the weapon set still gets to appear.
    durationS: 11.0,
    refresh: true,
  },

  // -------------------------------------------------------------------------
  // THREE MORE, and the reason they are three rather than one bigger number.
  //
  // Amit, playtest round 5: "we have one pickup for one special weapon. We need
  // more."
  //
  // The rule every row below is authored against is the one the Scatter note
  // already states and is worth restating because it is the whole difference
  // between four weapons and four damage numbers: A TEMPORARY WEAPON CHANGES
  // WHERE YOU CAN BE EFFECTIVE FROM, NOT HOW HARD YOU HIT. This game's only
  // verb is where you stand (§3), so a weapon is interesting exactly to the
  // extent that it changes which positions are good ones. Each of the three
  // below therefore has a REAL WEAKNESS that a player can find by playing:
  //
  //   LANCE  strong through a column, bad against a shield (see below).
  //   SWARM  hits things you are not under, nearly useless against a boss.
  //   FLAK   enormous close coverage, cannot reach the formation band at all.
  //
  // NONE OF THEM ADDS AN INPUT. §4 is permanent: firing is automatic and
  // unconditional, there is no fire button and no input that changes it. A
  // pickup changes what comes out, which is the same category as rank.
  //
  // COLOUR IS STILL NOT NEGOTIABLE (§5.4): all four are cyan-white. Shape,
  // count, speed, size and BEHAVIOUR may change; side may not. R9 asserts it.
  // -------------------------------------------------------------------------

  // THE PIERCING LANCE. One heavy needle, fired slowly, that does not stop at
  // the first thing it hits.
  //
  // WHAT MAKES IT FEEL DIFFERENT: the stream stops being a hose and becomes a
  // series of decisions. At 0.34 s between shots you can see each round leave,
  // and lining the craft up under a COLUMN -- a grid's two rows, a lens's near
  // and far arcs, a Splitter with something behind it -- is worth doing on
  // purpose, which the standard bolt never rewards.
  //
  // WHY IT IS NOT STRICTLY BETTER, and this is the good part because it falls
  // out of a rule that already exists rather than from a nerf. §6.2's Warden
  // shield "absorbs whole bolts, not points" -- so three lance rounds strip a
  // shield exactly as three bolts do, except they take 1.02 s instead of 0.32 s.
  // The Lance is the WORST weapon in the game against the type level two and
  // three lean on hardest, and the player learns that the first time they point
  // it at a Warden. Nothing had to be invented to make that true.
  //
  // Against a boss it does not pierce: /enemies/boss.js resolves one bolt to
  // one thing, and a lane holds one pod. That is honest rather than a special
  // case -- the round is spent where it lands.
  lance: {
    id: 'lance',
    name: 'LANCE',
    intervalS: 0.34,
    shots: [{ angle: 0 }],
    speed: 1750,
    radius: 13,
    damage: 3,
    // How many craft one round passes through before it is spent. Each craft
    // is hit at most once by a given round (see the pierce stamp in
    // /systems/collision.js), so this is a count of victims, not of frames.
    pierce: 4,
    // BLAST ON HIT (playtest round 9). Amit: "you can create an explosion that
    // if it hits something it's an explosion that might take out close by
    // entities."
    //
    // This answers LANCE reading as a punishment. Its problem was never its
    // damage, it was COVERAGE -- a 0.34s gun in a game with no aim leaves gaps
    // a faster one does not. A blast radius buys coverage back without touching
    // the fire rate: a shot that lands slightly off still clears what it was
    // aimed at, which is exactly the forgiveness the slow rate was removing.
    //
    // Radius is a little over one formation slot's spacing, so a centre hit
    // reliably takes the neighbour. Splash damage is 1 rather than the full 3 --
    // the pierce is what makes LANCE strong against a column, and a blast that
    // also hit for 3 would make it strictly the best weapon in the game rather
    // than the specialist one.
    blastRadius: 132,
    blastDamage: 1,
    textureKey: 'lance',
    tint: 0xd8fbff,
    drawScale: 2.0,
    durationS: 10.0,
    refresh: true,
  },

  // THE HOMING SWARM. Two small finned rounds per volley, thrown wide and then
  // steering onto whatever craft is nearest ahead of them.
  //
  // -------------------------------------------------------------------------
  // THE TENSION THIS ROW HAS WITH §0.2, STATED OUT LOUD BECAUSE IT IS REAL.
  //
  // §0.2 rule 3 and §4 are emphatic that "the guns always fire straight up;
  // there is no aim in this game". A round that curves toward a target is a
  // form of aim, and pretending otherwise would be dishonest.
  //
  // What is actually preserved, and why this is judged to be inside the rule
  // rather than around it:
  //   * THE CRAFT still points north and never yaws. §0.2's rule is about the
  //     SILHOUETTE and the camera, and the interceptor is untouched.
  //   * THERE IS STILL NO AIM INPUT. The player cannot point at anything; the
  //     rounds leave at two fixed authored angles exactly as Scatter's do. What
  //     changes is what the round does afterwards, which is the same category
  //     of change as "it passes through things" or "it dies after 420 px".
  //   * IT IS TEMPORARY, ten seconds at a time, and it is the only weapon in
  //     the game that behaves this way.
  // The reason it is worth the tension: it is the one weapon that makes a
  // position OTHER than "directly underneath" pay, which is the single biggest
  // change of feel available in a game whose verb is where you stand. Flagged
  // in the build report rather than smuggled in.
  // -------------------------------------------------------------------------
  //
  // ITS WEAKNESS IS THE BOSS. Homing acquires CRAFT only -- never a boss pod,
  // never the core -- so during a boss fight the swarm is two rounds a volley
  // fired 17° off vertical, which mostly miss the shot channels entirely. Pick
  // one up before a WARNING band and you have made a bad trade, and you will
  // know it within two seconds. That is the intended lesson.
  swarm: {
    id: 'swarm',
    name: 'SWARM',
    intervalS: 0.19,
    shots: [{ angle: -0.30 }, { angle: 0.30 }],
    speed: 880,
    radius: 11,
    damage: 1,
    // Steering. `turnRate` is radians/second of heading change -- deliberately
    // low enough that a round CURVES visibly rather than snapping onto a
    // target, which is what makes it read as a missile instead of as a bug.
    // `acquireY` is the important one: a round only ever considers craft ABOVE
    // it, so nothing ever turns back down toward the player band.
    homing: { turnRate: 3.2, acquireRange: 900, retargetS: 0.22 },
    // NOT OFFERED DURING A BOSS FIGHT (playtest round 12). Amit: "swarm weapon
    // doesn't work good at all on the bosses, doesn't understand where to shoot
    // them. Instead of fixing it, let's try to not give swarm when I'm working
    // on a boss."
    //
    // The right call, because this is not a bug to fix -- it is the weapon's
    // authored weakness meeting the one fight where a weakness becomes a dead
    // hand. SWARM homes onto CRAFT and deliberately never onto a boss (§6.4's
    // hull is not a valid target and should not become one; a homing round that
    // tracked a boss would trivialise every fight in the game). Against a boss
    // it therefore flies straight, which is a worse bolt.
    //
    // Everywhere else that trade is fine: you took a specialist and met the
    // wrong wave. In a boss fight it is not a trade at all, because there is
    // nothing else to shoot and no way to decline the canister -- so the honest
    // fix is to stop offering it, not to make the homing lie about its rules.
    craftOnly: true,
    textureKey: 'swarm',
    tint: 0xe6fbff,
    drawScale: 2.4,
    durationS: 10.0,
    refresh: true,
  },

  // THE FLAK BURST. Five fat crescents in a wide fan that die after 420 px.
  //
  // THE RANGE LIMIT IS THE WHOLE WEAPON. 420 px from the player's usual line
  // (y = 0.86) reaches y ~= 0.47 -- into the transit gutter, and NOWHERE NEAR
  // the formation band, whose bottom edge is y = 0.34. So for as long as it is
  // running the locked formation is simply out of reach and the only things
  // worth shooting are the ones that came to you: swooping craft, Splitter
  // fragments, a carrier's brood. It inverts the game's default posture from
  // "delete them before they arrive" to "let them come", for eight seconds.
  //
  // That inversion is the point, and it is the reason the row is worth its art:
  // it is the only configuration in which §5.5's swoop -- the game's one dive
  // shape -- is the main event rather than a nuisance.
  //
  // ONE EMERGENT PROPERTY WORTH KNOWING ABOUT, discovered by arithmetic rather
  // than designed: a boss's damage skirt sits at y ~= 0.42, which is 479 px
  // above the player's normal line and therefore OUT of Flak's range -- but
  // only 220 px above §6.4's vulnerable-window climb line at y = 0.62. So Flak
  // reaches a boss if and only if the player takes the optional climb. It is a
  // pleasant accident that the one weapon with no reach is also the one that
  // rewards the game's one designed use of the vertical axis, and it is left in
  // deliberately. It adds no REQUIREMENT: the climb is optional, and any other
  // weapon reaches the boss from the safe line.
  flak: {
    id: 'flak',
    name: 'FLAK',
    intervalS: 0.20,
    // ±24° at the extremes. Kept inside R9's 0.45 rad advisory so the outer
    // rounds still travel a useful distance upward rather than sideways off
    // the frame.
    // THREE, NOT FIVE (playtest round 10). Amit: "we don't need so many lines
    // of burst. We can just use three out of what is currently five."
    //
    // The outer pair went rather than the inner: keeping ±0.42 and dropping
    // ±0.21 would leave a hole straight ahead exactly where the player aims by
    // standing. This keeps the centre round and the two that still clear a
    // neighbouring formation slot.
    shots: [{ angle: -0.28 }, { angle: 0 }, { angle: 0.28 }],
    speed: 900,
    radius: 20,
    damage: 1,
    // Distance travelled before the round is spent. THIS IS THE ROW'S WHOLE
    // IDENTITY -- see the note above before retuning it.
    // NO RANGE LIMIT (playtest round 10). Amit: "let those my projectiles run
    // and live until they exit the screen. Right now they die too early."
    //
    // THIS DELETES THE ROW'S ORIGINAL WEAKNESS, deliberately, and the weakness
    // had to move somewhere. FLAK was authored as a close-quarters weapon whose
    // trade was that locked craft were out of reach -- twice now that has read
    // as broken rather than as a trade, which is the signal that it was the
    // wrong axis for this game: a range limit punishes the player for standing
    // still, and standing in the right place IS the game's only verb.
    //
    // What carries the cost instead: three rounds rather than five, and every
    // intercept spending one of them. A fan that both reaches the formation band
    // and shoots down fire is strong -- but it is 3 rounds on a 0.20s clock
    // against a 5-round burst's coverage, and each orb it stops is a round that
    // never reaches a craft. Its weakness is now opportunity cost, which the
    // player controls, rather than a wall they cannot see.
    rangePx: 0,
    // SHOOTS DOWN ENEMY FIRE (playtest round 9). Amit asked for a weapon that
    // can "hit and eliminate enemy projectiles", and for FLAK to be it.
    //
    // THE ROUND DIES ON THE INTERCEPT, his call: "does it die from the enemy
    // projectile or keep on going? [...] I think it should die because it would
    // be too strong if it would keep on going." Structurally right -- a
    // five-round fan that survived every intercept would delete a whole pattern
    // per volley, and §5.3's aisles are authored assuming bullets get DODGED.
    // One round, one orb keeps interception a partial answer: it thins a wall,
    // it never erases one.
    //
    // The short life is what keeps this safe. FLAK reaches ~700px, so it clears
    // what is already close and nothing still crossing the gap -- the player
    // reads the pattern exactly as before and gets to punch a hole in the last
    // stretch of it.
    intercepts: true,
    textureKey: 'flak',
    tint: 0xdff8ff,
    drawScale: 3.4,
    durationS: 8.0,
    refresh: true,
  },
};

/** Every weapon a pickup can grant -- i.e. everything except the one the
 *  player always has. Derived rather than listed, so adding a WEAPONS row plus
 *  a PICKUPS.kinds row is genuinely all it takes (§9.3). */
export const PICKUP_WEAPONS = Object.keys(WEAPONS).filter((id) => id !== 'standard');

export function weaponDef(id) {
  return WEAPONS[id] || WEAPONS.standard;
}

// ---------------------------------------------------------------------------
// The empty-screen fire hold (Amit, playtest round 4)
//
//   "just for the composition of the pause shooting, nothing, if anything is
//    near the screen, like everything is inside the screen, there's no way I'm
//    not shooting. It's only for those times where like there's nothing on the
//    screen and I keep on shooting, it looks a bit bad."
//
// THE SCOPE IS THE SAFETY MARGIN, so it is stated as an invariant rather than
// left to the implementation: if ANYTHING shootable exists -- an enemy in any
// state, a boss in any phase including its warning band, an enemy bullet still
// in the air, or a squadron whose launch is imminent -- the guns fire. Only a
// genuinely empty playfield holds them.
//
// WHY THE MARGIN IS GENEROUS. §5.5 enters squadrons from the side edges, and
// bolts already climbing are part of how fast the first row dies -- §5.3 sizes
// the pre-lock kill window against a stream that is ALREADY in the air, so a
// late resume would quietly shorten it. Erring wide costs nothing (a few
// unnecessary bolts) and erring narrow costs the pacing contract.
//
// WHY THERE IS AN IDLE TELL. Auto-fire is why this game has no action button
// (§4), which means the fire stream is the player's ONLY passive confirmation
// that the game is still reading their lean. Stopping it silently is
// indistinguishable from a frozen game on a board, so the hold has to LOOK
// deliberate: /render draws a charged muzzle glow that breathes while held.
// ---------------------------------------------------------------------------

export const FIRE_HOLD = {
  // Anything within this many pixels of the frame counts as on screen. 520 px
  // is comfortably beyond §5.5's entry spawn x (±0.07 of the width = 134 px
  // outside the frame), so fire is already running before the first craft is
  // drawn rather than starting when it appears.
  marginPx: 520,
  // A squadron whose queued launch is this close also counts. Covers the beat
  // between "the wave started" and "the first craft exists".
  leadS: 1.0,
  // Grace before the guns actually stop, so a half-second gap between the last
  // kill and the next arrival does not chop the stream. RESUME IS NEVER
  // DELAYED -- there is no counterpart to this on the way back up, by design.
  holdDelayS: 0.45,
};

// ---------------------------------------------------------------------------
// Pickups (§5.6) -- and the drop rule Amit asked for by name:
//
//   "add some pickups that every now and then when an enemy dies we should
//    have a value to control it on what's the chances of getting a pick up.
//    Basically when the enemy dies he gives birth to like a pick up item."
//
// THE VALUE HE ASKED FOR IS `dropChance`, ONE ROW PER ENEMY TYPE, right here.
// Nothing in /systems/pickups.js decides whether a drop happens; it reads this
// table. Retuning how often pickups appear is editing numbers in this block and
// nothing else.
//
// §5.6's flight-path rules are honoured in full and they are not style points:
// lateral-only lures, offset capped at 0.35 of the width, never above y = 0.62,
// re-offered if they scroll past. Every one of them exists so that a pickup can
// never induce a vertical dash -- the expensive lean on a balance board (§0.5),
// and the single failure mode §12 says the Mode S decision is most exposed to.
// ---------------------------------------------------------------------------

export const PICKUPS = {
  // --- THE KNOB -----------------------------------------------------------
  // Probability that a kill of this type drops a pickup. Tuned so that a
  // normal level-one run yields ABOUT TWO, which is the explicit ask: "in the
  // first level I need like two chances to pick up some new weapon so I can
  // understand where this game is going."
  //
  // The arithmetic, so the next person retuning it knows what they are moving:
  // level one authors 88 craft across its six waves -- 81 drones and 7
  // Emitters -- so the expectation is 81*0.018 + 7*0.10 = 2.2 drops.
  //
  // Level two's roster is worth more per kill because its craft cost more to
  // kill: a Warden eats eight bolts behind its shield and a Splitter answers
  // its own death with two more craft, so a drop is the fight paying for the
  // commitment rather than a lottery ticket.
  // ROUND 9: ROUGHLY DOUBLED. Amit: "we need more rapid pickups on general."
  // Two knobs move that, and both had to: this table decides how often ANY
  // canister appears, and weaponWeights decides which one it is. Raising only
  // the weight would have made RAPID a larger share of a supply that is itself
  // scarce -- about two per level -- which is not what "more" means when the
  // baseline has just been cut to 56% of its original rate.
  //
  // The floor below (maxKillsWithoutDrop) comes down with it, so the dry
  // stretches shorten too rather than only the average.
  dropChance: {
    drone: 0.038,
    emitter: 0.20,
    warden: 0.40,
    splitter: 0.26,
    // Anything not named above (splitter fragments, bay-launched drones).
    // Zero on purpose: a Splitter that could drop twice through its own
    // fragments would make the type the best farm in the game, which is a
    // strategy nobody asked for.
    default: 0,
  },

  // The floor under the randomness, and the reason it exists: "about two" and
  // "sometimes zero" are different promises. An independent 2% roll per kill
  // has a real chance of producing NO drop across a whole level, and the run
  // where a first-time player never sees the mechanic is the run that fails
  // the brief. After this many kills with nothing, the next kill drops --
  // which converts a 0-to-5 distribution into a reliable 2.
  //
  // It is a second knob in the same block rather than logic buried in the
  // system, for exactly the reason the first one is.
  maxKillsWithoutDrop: 22,

  // At most one on screen, and never two inside this window. Both are anti-
  // clutter rather than anti-generosity: two canisters drifting at once turn a
  // lure into a scatter of choices, and §5.6's offset cap only means something
  // if there is one thing to be offset FROM.
  maxOnScreen: 1,
  minGapS: 6.5,

  // --- §5.6's flight-path rules, verbatim ---------------------------------
  // "A pickup's lateral offset from the player is capped at 0.35 of the width,
  // which is ~1.1 s of travel at LATERAL_MAX. Enough to be a decision, never a
  // sprint."
  maxOffsetFrac: 0.35,
  // "No pickup ever sits above y = 0.62." The drop is born at the kill site,
  // which is up in the formation band -- so it is not COLLECTABLE until it has
  // descended past this line, and it is not a lure until then either. That is
  // the honest reading: what §5.6 forbids is a reward the player must climb
  // for, and a canister falling toward you is the opposite of one.
  maxLureY: 0.62,
  // Mode A has no scrolling surface to ride, so §5.6 gives pickups their own
  // descent there. In Mode S they ride the surface at SCROLL_SPEED, which is
  // what "ground pickups ride the surface" means literally.
  driftSpeedA: 90,
  // "Collected by a generous radius (72 px), so a near-miss is a hit."
  collectRadius: 72,

  // "Anything that scrolls past uncollected is either optional or re-offered
  // within 8 s." Re-offered ONCE: the weapon is a bonus, not an entitlement,
  // and an infinitely re-offered pickup would eventually be collected by a
  // player standing still, which is the opposite of a lure.
  reOfferS: 6.5,
  reOffers: 1,

  // Presentation. §5.6: "all spun/pulsed at runtime from a single static
  // sprite each" -- so this is the whole animation budget for the type.
  // BIGGER AND ALMOST STILL (playtest round 10). Amit: "all of the pickups
  // should not be rotating so fast [...] when they enter the screen from the
  // top and leave from the bottom they won't even complete 30 degrees of spin.
  // They should also be a bit bigger. My aim is that it would be clear that
  // it's a positive thing."
  //
  // That is a readability goal, not a taste one, and the arithmetic follows
  // from it. A canister falls at the scroll speed (SCROLL_SPEED 135 px/s) over
  // a 1080px frame, so it is on screen for ~8 s. The old 0.42 Hz spun it 3.4
  // FULL turns in that time -- which reads as a tumbling coin, i.e. as loot in
  // a different genre, and a tumbling object is also harder to identify than a
  // still one. At 0.010 Hz it turns 0.08 of a rotation, or ~29 degrees, over
  // the whole traversal: enough to look alive, not enough to obscure the
  // emblem that says which pickup it is.
  spriteWidth: 82,
  spinHz: 0,
  pulseHz: 1.6,
  // Halved (playtest round 10): "the squeeze animation is a bit too strong."
  // At 0.12 the canister breathed +/-12% of its own width, which at the new
  // 82px size is a visible 10px pump; 0.06 keeps it alive without the squeeze.
  pulseAmp: 0.06,
  // A soft additive halo under the canister so it reads as hot against a dark
  // surface without needing a second texture.
  haloScale: 2.5,
  haloAlpha: 0.34,
  // Which weapon a canister grants. Four kinds, one per WEAPONS row that is
  // not `standard`, each with its own canister sprite: the same casing with a
  // different cyan emblem on the face (art/build_assets.py). A fifth weapon is
  // a row here plus a row in WEAPONS plus a panel on that sheet.
  //
  // TINT STAYS WHITE ON ALL FOUR, on purpose. §5.4 colour-codes ownership and a
  // collectable has to read as YOURS at a glance -- tinting the Flak canister
  // amber to distinguish it would put an enemy-coloured object on the playfield
  // and the player would dodge the reward. The emblem carries the identity;
  // the colour carries the side. R5 asserts it.
  kinds: {
    rapid: { id: 'rapid', weapon: 'rapid', textureKey: 'pickupRapid', tint: 0xffffff },
    // NON-WEAPON CANISTERS (playtest round 10). `effect` instead of `weapon`,
    // and /systems/pickups.js branches on it before touching the weapon at all
    // -- so collecting one never costs the player the gun they are running.
    //
    // BARRIER is time; REPAIR is a segment. Two rows rather than one
    // "defensive" pickup because they answer different questions: at one
    // segment in front of a boss you want the repair, at full shield crossing a
    // curtain you want the barrier.
    barrier: { id: 'barrier', effect: 'barrier', durationS: 7.0, textureKey: 'pickupBarrier', tint: 0xffffff, auraTint: 0xffd98a },
    // TWO SEGMENTS, and it stays two. I raised this to 3 on the theory that a
    // rare heal should also be a big one; Amit's call is that rarity alone is
    // the value ("no - 2 bars is enough"). He is right that they are separate
    // levers: 3 of 6 is half the bar in one canister, which starts to undo a
    // bad stretch rather than reward surviving it.
    repair: { id: 'repair', effect: 'repair', amount: 2, textureKey: 'pickupRepair', tint: 0xffffff, auraTint: 0x9dffc0 },
    scatter: { id: 'scatter', weapon: 'scatter', textureKey: 'pickupScatter', tint: 0xffffff },
    lance: { id: 'lance', weapon: 'lance', textureKey: 'pickupLance', tint: 0xffffff },
    swarm: { id: 'swarm', weapon: 'swarm', textureKey: 'pickupSwarm', tint: 0xffffff },
    flak: { id: 'flak', weapon: 'flak', textureKey: 'pickupFlak', tint: 0xffffff },
  },

  // --- WHICH weapon a drop grants -----------------------------------------
  //
  // The second knob Amit's original ask implies and the first version did not
  // need: with one weapon, "does a pickup drop" was the whole question. With
  // four, "which one" is a separate tuning decision and belongs in the same
  // findable place as the first (§9.3), not in /systems/pickups.js.
  //
  // Relative weights, not probabilities -- they are normalised at the draw, so
  // adding a fifth weapon does not require rebalancing the other four.
  //
  // SCATTER IS WEIGHTED HIGHEST because it is the introductory one: it is the
  // weapon the player is most likely to meet first, it is the least surprising
  // (a wider version of what you already have), and it is the only one with no
  // sharp weakness. Flak is weighted lowest because its range limit makes it
  // the most situational -- a genuinely good draw in a swoop-heavy wave and a
  // poor one in front of a boss.
  // PLAYTEST ROUND 8 REWEIGHTING. Amit asked to see the rate pickup "a lot",
  // and the reason is not generosity: the baseline is now 30% slower, so RAPID
  // is what makes the game feel like itself. It is weighted well above
  // everything else and is the new introductory draw.
  //
  // LANCE IS HALVED, and that is a considered demotion rather than a nudge. Its
  // 0.34s interval is 2.3x the new baseline's, and Amit's report is that a
  // slower-but-stronger weapon "feels like a nerf" in a game where rate is
  // coverage rather than damage. It keeps its pierce and its 3 damage -- it is
  // still the right answer to a stacked column -- but it should be the rare
  // specialist draw, not a coin flip you lose.
  weaponWeights: {
    rapid: 3.20,
    // SPLIT APART (playtest round 11). Amit: "too much health pickups. A health
    // pickup should be something that you see. Same. Not a lot. And yeah, you
    // can give more shields instead of it."
    //
    // They were weighted the same and should never have been. A heal is the
    // only thing in the game that undoes a mistake, so its value comes from
    // being RARE -- a common heal makes taking a hit cost nothing, which is
    // exactly the tension the shield bar exists to create. The barrier prevents
    // damage for a window and expires whether or not it was needed, so it can
    // be frequent without ever erasing a mistake.
    //
    // So: BARRIER becomes the common defensive draw and REPAIR the one you
    // notice arriving.
    barrier: 1.45,
    repair: 0.30,
    scatter: 1.00,
    swarm: 0.85,
    flak: 0.65,
    lance: 0.40,
  },

  // NO SECOND WEAPON WHILE ONE IS RUNNING (playtest round 11).
  //
  // Amit: "players felt like the pickup is taking them back. Like they've had a
  // better weapon and they picked up something that looked to them like not
  // such a great weapon. And they were sorry for picking that up."
  //
  // Two fixes were rejected before this one, and why matters. SCORING the
  // weapons and only offering upgrades cannot work: there is no total order --
  // LANCE beats a stacked column and is the worst weapon in the game against a
  // Warden, FLAK owns a bullet curtain and is useless at a boss. Any ranking is
  // right in one wave and wrong in the next, and a refused pickup feels worse
  // than a downgrade. STACKING breaks the rule the whole system leans on: a
  // canister must visibly change what comes out of the guns (§5.6), and stacked
  // weapons blur exactly that.
  //
  // So the fix is scarcity: the situation simply arises less. A weapon canister
  // will not spawn while a temporary weapon is running -- but the DEFENSIVE
  // canisters still do, because they never overwrite anything and so can never
  // cause the regret.
  suppressWeaponWhileRunning: true,
  // ...except in the last seconds, so chaining is a thing the player can do
  // deliberately rather than a thing they are punished for still holding a
  // weapon during. Without this, the moment a weapon expires is also the moment
  // the drought ends, and the two never overlap.
  chainTailS: 2.5,

  // A drop never grants the weapon that is already running.
  //
  // Not a fairness tweak -- it is what makes a canister worth crossing the
  // frame for. §5.6's whole design is that a pickup pulls the player a measured
  // distance out of the safe lane, and the lure has to be worth the lean. With
  // four kinds and an unfiltered draw, one collection in four would refresh a
  // clock and change nothing on screen, which is the offer failing to be an
  // offer. Excluding the running weapon means every canister visibly changes
  // what comes out of the guns.
  //
  // `refresh` still exists and still matters: two canisters of the SAME kind
  // close together can only happen when the first has already expired, and then
  // topping up is the right behaviour.
  excludeRunningWeapon: true,
};

// ---------------------------------------------------------------------------
// Air enemies (§5.5, §6.2). POC ships the Drone only.
// ---------------------------------------------------------------------------
//
// ===========================================================================
// THE HP-TIER READABILITY RULE -- read this before adding a type or a level.
//
// Amit, playtest round 5:
//
//   "The only one which feels he needs a different asset, it's like it's an
//    enemy with two lives. He can get hit twice. But it looks really really
//    close or maybe the same sprite even to the ones in level one which have
//    only one life, one shot and dead. And it looks a bit too close."
//
// WHAT HE WAS LOOKING AT was level two's `hp: { drone: 2 }` override. A 2 HP
// craft was wearing the 1 HP drone's sprite, so the only way to learn that a
// level-two drone takes two bolts was to shoot one and watch it survive.
//
// THAT IS THE SAME CLASS OF FAILURE AS BOSS ONE'S UNMARKED PODS, and it gets
// the same rule rather than a patch:
//
//   HOW TOUGH SOMETHING IS MUST BE READABLE BEFORE IT IS SHOT AT.
//
// Expressed as two things this file enforces, both asserted by R6:
//
//   1. HP IS A PROPERTY OF A TYPE, AND EVERY TYPE HAS ITS OWN CHASSIS. No two
//      types share a texture key. A craft's toughness is carried by its
//      silhouette and its art, which is information the player has before
//      pulling a trigger they cannot release anyway (§4: fire is automatic --
//      "learn by shooting" is not even a choice the player makes).
//   2. NO LEVEL MAY OVERRIDE A TYPE'S HP. `LEVELS[i].hp` is dead and R6 fails
//      on any level that authors one. §5.7 does list "enemy HP" as a sanctioned
//      campaign ramp lever -- and it still is: the lever is exercised by
//      authoring TOUGHER TYPES into later waves, which is exactly what §6.2's
//      six-type bestiary is a ladder for. What is banned is the same craft
//      being secretly tougher somewhere else.
//
// RUNTIME TINT AND SCALE ARE NOT A SUBSTITUTE and must never be reached for
// here. ENEMY.vary deliberately skews both WITHIN a type, so a tint that also
// meant "tier" would collide with variation that means nothing -- and Amit's
// note is explicit that this needs "a different asset".
//
// THE TIER LANGUAGE, so the next type follows it: ARMOUR PLATING. The 1 HP
// drone is a thin bare dart with exposed spines; the 2 HP Lancer is the same
// violet faction visibly up-armoured, with heavy bolted gunmetal plate over the
// core. A 4 HP Spoke, when it lands, should read as more of the same.
// ===========================================================================

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
      // Every type names its own texture. R6 asserts no two share one, which is
      // the HP-tier rule above expressed as a check rather than a hope.
      textureKey: 'drone',
      // The rim's colour (ENEMY.rim) -- the craft's own family hue, never the
      // player's blue-cyan. Violet, matching the drone's dart.
      rimColor: 0xc46bff,
    },

    // §6.2: "Lancer | 2 | The swooper. Peels more often than anything else."
    //
    // THE ANSWER TO PLAYTEST ROUND 5's ONLY ART NOTE, and it is a roster fix
    // rather than a new idea: the 2 HP tier was already in §6.2's bestiary and
    // level two was reaching it through an HP override on the drone instead,
    // which is exactly the thing that read wrong. Authoring the type deletes the
    // override (see LEVELS below) and the tier gets its own chassis.
    //
    // ITS BEHAVIOUR IS ALSO ITS OWN, not just its HP -- otherwise it would be a
    // tougher drone wearing better armour, which is the criticism build_assets
    // records for why the Lancer was passed over the first time. §6.2 gives it
    // one line and that line is a behaviour: "the swooper, peels more often
    // than anything else". So it carries its own swoop cooldown, roughly half
    // the shared one, and it is the only type that does.
    //
    // WHAT THAT DOES TO A WAVE: a formation with Lancers in it comes at you.
    // The drone's dive is occasional punctuation; a block of Lancers keeps
    // something in the gutter almost continuously, which is pressure on the
    // lateral axis (§0.5's comfortable one) and never on the vertical -- the
    // swoop bottoms out at ENEMY.swoop.minY like every other dive and
    // /systems/collision.js asserts it live.
    lancer: {
      id: 'lancer',
      hp: 2,
      // Between the drone's 34 and the Emitter's 44, which is what "heavier
      // than a drone, lighter than a gun platform" should cost to hit. R6
      // checks it against the tightest slot separation of every formation.
      radius: 36,
      // SIZED BY THE BAND, exactly as the Warden and the Splitter were. The
      // shipped art is 200x236, so a craft wide enough to look its weight would
      // stand taller than the drone's 117 px envelope and push the formation
      // rows -- which are level one's, and locked. 98 x 116 fits inside that
      // envelope, so adding the type costs the band budget nothing.
      spriteWidth: 98,
      spriteHeight: 116,
      // 1.6x a drone: twice the fire time, and it is in the player's face far
      // more often, so it is worth more than the HP alone suggests.
      score: 160,
      contactDamage: PLAYER.damage.enemyCollision,
      swoops: true,
      // ITS OWN, and the only per-type override of the swoop clock. §6.2's
      // whole line for this type is that it "peels more often than anything
      // else", so the number that says so lives on the type rather than in a
      // wave. Bounded by ENEMY.swoop.maxConcurrent like everything else, so a
      // formation full of Lancers cannot put more than three in the air at once
      // and the gutter never fills.
      swoopCooldownS: [1.8, 3.6],
      pattern: null,
      tint: 0xffffff,
      textureKey: 'lancer',
      // Violet like the drone's, because the Lancer IS the drone's faction seen
      // up-armoured -- the rim should say "same species" while the plated hull
      // says "more of it".
      rimColor: 0xa96bff,
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
      // ...but WHICH sweep is per craft. Two authored rows, picked by the
      // craft's stable identity hash (see varyHash in /enemies/enemies.js), so
      // two Emitters in one formation are audibly and visibly running different
      // rhythms rather than the same metronome twice.
      //
      // THIS IS THE HONEST VERSION OF THE "TWIN-SHOT VOLLEY" IDEA the previous
      // pass flagged and refused to smuggle in. Its objection was exact:
      // varying a craft's ORB COUNT or aisle geometry at runtime would be a
      // bullet pattern that /systems/constraints.js -- which proves §5.3's
      // guarantees per PATTERN, statically -- cannot see. So the variation is
      // expressed as a second authored pattern that gets validated exactly like
      // B1 and B2, and the per-craft part is only which of the two it owns.
      // Both are proved; neither can drift out of contract.
      patternVariants: ['B2', 'B2T'],
      tint: 0xffffff,
      textureKey: 'emitter',
      // Acid jade, the type's own signature and used by nothing else.
      rimColor: 0x9dff5a,
    },

    // §6.2: "Warden | 5 | Carries a shimmer shield that absorbs 3 hits before
    // its body takes damage. Forces focus fire."
    //
    // CHOSEN AGAINST A NAMED COMPLAINT, not off the list in order. Amit:
    // "the simple enemies are just blown up with one super rocket fire of mine.
    // And if I move or stand in the right place I can kill the whole wave
    // before it even gets to their positions." The real fault underneath is
    // that the FORMATION-ARRIVAL MOMENT -- the thing the whole Galaga lineage
    // is built on, and the thing §5.5's fly-in exists to stage -- never
    // happens. HP alone does not fix that; it just moves the number.
    //
    // The shield does, because it changes the SHAPE of an approach kill rather
    // than its price. Eight bolts (3 shield + 5 hull) is 0.84 s of unbroken
    // on-target fire at rank 1, so a parked player can still take ONE Warden
    // out of a squadron mid-entry -- and while they are doing it, the other
    // eleven craft arrive and lock. The pre-lock window stays a real offer;
    // it just stops being a free wave-clear.
    warden: {
      id: 'warden',
      hp: 5,
      // 44, not 46, and the two pixels are not arbitrary: R6 requires a type's
      // radius to fit twice inside the tightest slot separation of any
      // formation, and F2's lens has slots 90 px apart. A 46 px Warden would
      // have overlapped its neighbours on the ellipse -- the validator caught
      // it at boot rather than it being noticed, or not, in a screenshot.
      radius: 44,
      // SIZED BY THE BAND, NOT BY THE ART, and this is the one place level
      // one's lock actually constrained level two's design.
      //
      // The shipped art is 209x248 -- a tall craft -- and at the ~124 px width
      // its bulk wants, it stands 147 px and its top edge lands at y = 51,
      // inside the entry-telegraph band and nearly into the HUD strip. §5.1's
      // band discipline is a hard container for a locked craft's sprite, and
      // the previous pass established the precedent by nudging the formation
      // rows DOWN rather than relaxing the rule. Those rows are level one's,
      // and level one is locked -- so the craft moves, not the band.
      //
      // 98 x 116 puts it exactly inside the drone's 117 px envelope, which
      // means the R4 margin (~1.7 px at the top row) is unchanged by adding
      // this type at all. What carries "heaviest craft in the fleet" instead is
      // its shield ring (120 px across while up), its dense crimson-and-
      // charcoal art against the drone's thin purple dart, and its pip row.
      // Flagged rather than fudged: see the report.
      spriteWidth: 98,
      spriteHeight: 116,
      // 3x a drone: it costs 8x the fire time and it is the craft that decides
      // whether a squadron gets to form up at all.
      score: 400,
      contactDamage: PLAYER.damage.enemyCollision,
      // It swoops. That is the other half of the answer -- a Warden that
      // reached formation and then came down at you is a threat the player has
      // to actually deal with, rather than a wall to be ground through.
      swoops: true,
      pattern: null,
      tint: 0xffffff,
      // THE SHIELD. Absorbs whole bolts before the hull takes any damage, and
      // does NOT regenerate: partial progress is kept, so focus fire is
      // rewarded and spraying is not. /render draws one arc per remaining hit,
      // so "three more, then it starts dying" is readable with no tutorial.
      shieldHits: 3,
      textureKey: 'warden',
      // Hot orange, off its nacelles. The Warden is the darkest craft in the
      // game by measurement (median luma 0.155 before the lift) and the one
      // Amit meant by "the orange one a little bit too dark", so its rim is
      // doing more work than any other.
      rimColor: 0xff7a3c,
    },

    // §6.2: "Splitter | 3 | On death, breaks into 2 drones that immediately fly
    // a short exit arc -- never a surprise dive."
    //
    // THE OTHER HALF OF THE SAME ANSWER, from the opposite direction. The
    // Warden makes an early kill expensive; the Splitter makes it
    // COUNTERPRODUCTIVE -- kill it during the fly-in and the squadron that
    // arrives is bigger than the one that left. There is no parking spot that
    // empties a wave containing these, which is precisely the property the
    // complaint says level one lacks.
    //
    // "NEVER A SURPRISE DIVE" IS LOAD-BEARING, not flavour. The fragments are
    // born in the formation band, above the player, at the moment the player is
    // committed to a lateral position -- so anything that fell straight down
    // out of a kill would be an unavoidable hit and an emergency vertical lean,
    // which is the worst thing this product can ask for (§0.5, §5.5's
    // do-not-port list). They arc laterally out of the frame instead: shootable
    // for score, contact-damaging if you fly into them, and never descending
    // past the swoop floor.
    splitter: {
      id: 'splitter',
      hp: 3,
      radius: 40,
      // Same constraint as the Warden's, from the same locked rows: the art is
      // 175x236, so a 112 px-wide Splitter would stand 151 px and overhang the
      // formation band's ceiling. 86 x 116 fits inside the drone's envelope, so
      // adding the type costs the band budget nothing.
      spriteWidth: 86,
      spriteHeight: 116,
      // The pair it leaves behind are worth 100 each on top (§8.2 prices a
      // splitter at 200 "+50 per fragment"; the fragments here are real drones
      // and are scored as drones, which is simpler and pays the same order).
      score: 240,
      contactDamage: PLAYER.damage.enemyCollision,
      swoops: true,
      pattern: null,
      tint: 0xffffff,
      // What it becomes, and how many. Read by /systems/collision.js on death.
      splitsInto: 'drone',
      splitCount: 2,
      // §8.2 prices this type at "splitter 200 (+50 per fragment)", so the pair
      // is worth 50 each rather than a drone's 100 -- otherwise killing one
      // Splitter would out-score killing three drones, and the type would read
      // as a bonus instead of as a cost.
      fragmentScore: 50,
      textureKey: 'splitter',
      // Hot magenta, off its split seam. The Splitter is already the palest hull
      // in the game (median luma 0.796) and needed no lift at all -- its rim is
      // for type identity rather than for rescue.
      rimColor: 0xff5fd0,
    },
  },
  // -------------------------------------------------------------------------
  // THE CRAFT RIM (playtest round 5) -- the runtime half of the readability fix.
  //
  // Amit: "A lot of the enemies right now are too dark. It's hard to see them on
  // the dark backgrounds. Mainly actually mainly the one that's like grey dark.
  // Also the green ones are a little bit too dark. The orange one a little bit
  // too dark. [...] I don't know if you have to change the whole asset maybe or
  // just add some auto-stroke or glow."
  //
  // WHY IT IS A RULE AND NOT THREE RETOUCHES. §5.4 requires a desaturated,
  // low-contrast surface, and the three shipped surfaces measure at a SIXTH of
  // that ceiling (rendered luminance means 0.071 / 0.083 / 0.074 against 0.45).
  // The ground is very dark by design and must stay that way -- that darkness is
  // what makes bullets readable, and brightening it would trade an enemy problem
  // for a bullet problem. So every dark craft disappears into it, and so will
  // every dark craft added after these. The answer is applied to the TYPE TABLE,
  // once, and inherited:
  //
  //   * a hue-preserving luminance LIFT baked into every craft sprite at build
  //     time (art/build_assets.py, CRAFT_TARGET_MEDIAN), which fixes the hull;
  //   * this RIM, which fixes the separation -- an outline cut from the craft's
  //     own alpha, drawn additively behind it in the type's family colour.
  //
  // /systems/constraints.js asserts the measured contrast at boot from the
  // numbers art/measure_readability.py emits, so this cannot regress quietly.
  //
  // THE RIM COLOURS ARE THE TYPES' OWN and none of them is the player's. §5.4
  // colour-codes ownership -- player cyan-white, enemy orange/magenta -- and a
  // rim is the brightest thing about a craft at distance, so a blue one would
  // undo the coding at exactly the range where it matters most. R6 asserts that
  // no rim colour is blue-dominant.
  rim: {
    // Drawn this much larger than the hull, so the outline sits just outside
    // the silhouette and reads as light coming off the edge rather than as a
    // stroke painted on it.
    scale: 1.13,
    // Additive, so this is a real brightness contribution rather than an
    // opacity. Kept well under 1: the rim has to separate the craft from the
    // ground, not become the craft.
    alpha: 0.62,
    // A slow breath, in the same idiom as the enemy orbs' pulse (FX) -- a
    // static glow reads as a UI decal, a breathing one reads as a live ship.
    // Phase is offset per craft by its pool index so a formation does not
    // pulse in lockstep.
    pulseHz: 0.55,
    pulseAmp: 0.18,

    // THE BRIGHT-SURFACE INVERSION (playtest round 7). Amit asked for open,
    // light levels ("a bit more white colors, just a bit. Not so dark and
    // creepy"), and additive light adds nothing visible over a near-white sky
    // or ice shelf -- so on those surfaces the same silhouette is drawn as an
    // opaque dark outline instead. Craft do not change; only the rim's blend
    // mode and tint do, driven by SURFACES[i].darkRim.
    //
    // Slightly wider than the additive rim (1.16 vs 1.13): an opaque outline
    // has a hard edge where a glow falls off, so it needs a touch more width to
    // read as deliberate rather than as a rendering artefact.
    darkScale: 1.16,
    // Near-black, but not pure black -- a cool very dark blue sits in the same
    // family as the game's own shadows rather than reading as a hole cut in
    // the sky.
    darkColor: 0x0a1018,
    // Higher than the additive alpha: this is the ONLY thing separating a
    // craft from a pale ground, where on the dark surfaces the craft's own
    // luminance is already doing most of the work.
    darkAlpha: 0.82,
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

  // THE EXIT ARC -- shared by Splitter fragments and by Brood Gantry's
  // bay-launched drones (§6.2, §6.4). One behaviour, two sources, because it is
  // the same promise in both cases: something new appeared above you and it is
  // LEAVING, not coming for you.
  //
  // Every number here is bounded by the do-not-port list (§5.5) rather than
  // chosen for feel. `descentSpeed` is a downward component and obeys §5.3's
  // approach budget like everything else; `floorY` stops the arc at the same
  // line the swoop bottoms out at, so nothing born mid-fight can ever reach the
  // player band. The craft stays shootable and contact-damaging the whole way,
  // which is what stops it being scenery.
  fragment: {
    lateralSpeed: 340,
    descentSpeed: 78,
    floorY: 0.58,
    // A little upward kick out of the parent, so the pair visibly separates
    // before it starts drifting down.
    riseS: 0.35,
    riseSpeed: 90,
    // Spread of the two halves, in fractions of the width per second, applied
    // as opposite lateral directions.
    spreadJitter: 0.22,
  },

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
    // NO HOVER BOB, AND THE REASON IS WORTH KEEPING -- it is a finding about
    // the authored layout, not a taste call, and the next person to reach for
    // this idea should not have to rediscover it.
    //
    // A slow out-of-phase vertical bob on locked craft is the cheapest possible
    // answer to "at some point it feels a bit too repetitive": twenty sprites
    // pinned to twenty fixed points read as a decal, and a few pixels of
    // out-of-phase motion make the same twenty read as individually flying. It
    // was built, and the boot validator rejected it immediately.
    //
    // THE AUTHORED FORMATIONS HAVE ABOUT 2 PX OF VERTICAL SLACK. F1's top row
    // sits at y = 125 with a 117 px craft, so its top edge is 66.5 against a
    // band ceiling of 64.8. F2's lower arc clears the gutter by ~3.5 px. Any
    // vertical excursion at all, in either direction, breaches §5.1's band
    // discipline -- and the fix would be to re-author the rows, which are level
    // one's and are locked.
    //
    // A LATERAL bob was the obvious alternative and it is no better: the
    // whole-formation drift already spends the entire lateral margin (the
    // outermost slot at x = 192 drifts 76.8 px against a 115.2 px HUD margin,
    // i.e. exactly to the line), so per-craft lateral sway would push craft
    // under a gauge.
    //
    // So per-craft motion is genuinely blocked by the current layout, and it is
    // flagged rather than forced. What the variation thread got instead is
    // patternVariants below -- the honest version of the "twin-shot volley"
    // idea the previous pass refused to smuggle in.
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

// THE FAN IS AUTHORED AS A SEPARATION, NOT AS A VELOCITY. Read this before
// touching a `fanSepPx` below.
//
// A fan's aisle is the hole left by the omitted slot MEASURED AT THE PLAYER'S
// LINE, so its width is (slots omitted + 1) separations minus the two
// neighbouring orbs' own radii. The first rewrite authored the outermost slot's
// lateral VELOCITY instead, which makes the separation -- and therefore the
// aisle -- a function of how long the orbs happen to fall:
//
//     sep = spreadVx-derived spacing x (fall distance / descent speed)
//
// Both of those vary. A boss fires from y=370 and a formation craft from y=254;
// Mode A descends at 240 px/s and Mode S at 130. At 96 px/s of spread that
// spans an aisle of 332 px (Mode S, formation) down to 158 px (Mode A, boss) --
// and 158 is UNDER AISLE_MIN. §5.3 does not offer a mode or an altitude
// exemption: "every authored bullet pattern must guarantee a continuously
// traversable gap of at least 173 px", full stop.
//
// So the separation at the player's line is the authored quantity and the
// lateral velocity is derived from it per shot, from the real muzzle altitude
// and the real descent speed (see fanGeometry in /patterns/patterns.js). The
// aisle is then the same width no matter who fires the fan or which mode is
// running, which is the only version of this pattern the validator can actually
// prove rather than spot-check.
const B2_SEP = 190; // px between adjacent slots at LATERAL_ONLY_TEST_Y
const B2_ORB_R = 24;
const B2T_SEP = 195;
const B2T_ORB_R = 22;
const B4_SEP = 205;
const B4_ORB_R = 20;

// B4's sine. §5.5: "Sine curtain -- a row of orbs descends with phase-offset
// lateral sine. Aisle travels laterally, predictably, at <= 420 px/s."
//
// THE PHASE OFFSET IS THE PART THAT NEEDED CARE, and getting it wrong would
// have repeated exactly the bug the fan note above documents. If every orb
// shared one phase the whole row would slide as a rigid body and separations
// would be constant -- safe, but not a curtain. Giving each slot its own phase
// makes the row undulate, which is the pattern §5.5 describes -- and it also
// means adjacent orbs move RELATIVE to each other, so the aisle BREATHES.
//
// That breathing is bounded in closed form rather than eyeballed. Two orbs
// whose phases differ by d have a relative lateral displacement of at most
// 2*amp*sin(d/2), so the hole across an omitted run of k slots -- whose
// flanking orbs are (k+1) phases apart -- narrows by at most
// 2*amp*|sin((k+1)*phasePerSlot/2)|. fanAisle() below subtracts exactly that,
// /patterns/patterns.js derives the emitted geometry from the same numbers, and
// R2 re-derives it independently at every altitude in both modes. The aisle is
// therefore a proved floor, not a typical value.
const B4_SINE = {
  amp: 46,
  rateHz: 0.38,
  // Radians of phase between adjacent fan slots. 0.55 rad is a visible wave
  // across five slots (2.2 rad end to end, about a third of a cycle) while
  // costing only 48 px of aisle at the omitted run.
  phasePerSlot: 0.55,
};

/** How much lateral speed the sine itself contributes to the aisle's travel.
 *  Counts against AISLE_MOVE_MAX alongside the gap's row-to-row step, because
 *  §5.3 caps how fast the hole moves and does not care what moves it. */
export function sineAisleSpeed(d) {
  return d && d.sine ? d.sine.amp * TWO_PI_C * d.sine.rateHz : 0;
}

/** How much of the hole the phase offset can eat at its worst instant. */
export function sineAisleLoss(d) {
  if (!d || !d.sine) return 0;
  const spread = d.sine.phasePerSlot * ((d.fanGapSlots || 1) + 1);
  return 2 * d.sine.amp * Math.abs(Math.sin(spread * 0.5));
}

const TWO_PI_C = Math.PI * 2;

/** The hole one omitted run of slots leaves, at the player's line. */
function fanAisle(sepPx, gapSlots, orbRadius, sine) {
  const base = sepPx * (gapSlots + 1) - 2 * orbRadius;
  if (!sine) return base;
  const spread = sine.phasePerSlot * (gapSlots + 1);
  return base - 2 * sine.amp * Math.abs(Math.sin(spread * 0.5));
}

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
  // B2 -- LATERAL SWEEP FAN, from the craft that fires it.
  //
  // §5.5: "A fan from one formation section sweeps sideways across the width at
  // <= 420 px/s. One authored gap >= AISLE_MIN travels with the fan."
  //
  // Read that literally, because the first implementation did not and it cost a
  // real bug: it emitted a row across the ENTIRE playable width at the emitter's
  // altitude, so orbs were born up to 1100 px from the craft that fired them.
  // Amit, from the board: "projectiles are being fired from thin air." They
  // were. Every orb now leaves the owner's hull with a lateral velocity and the
  // fan spreads as it falls, so the source is always visible -- which is also
  // the only thing that makes §6.2's "kill the Emitter and the sweep stops" a
  // decision the player can actually take.
  //
  // THE AISLE IS AUTHORED AT THE PLAYER'S LINE (see the fan note above) and the
  // lateral velocity is derived from it per shot. `guaranteedAisle` and
  // `aisleMoveSpeed` below are therefore COMPUTED from the same two numbers the
  // emitter uses, so the declared floor cannot drift away from the emitted
  // geometry -- and /systems/constraints.js re-derives both from the real muzzle
  // altitudes, in both framing modes, rather than trusting either.
  B2: {
    id: 'B2',
    name: 'Lateral sweep fan',
    rows: 2,
    rowIntervalS: 0.7,
    orbRadius: B2_ORB_R,
    volleyIntervalS: 7.4,
    // Five slots, one omitted -- FOUR orbs per row against the old full-width
    // row's six, which is a third of Amit's "far too many projectiles" answered
    // by geometry rather than by a rate cut.
    fanOrbs: 5,
    // 190 px between adjacent slots at the player's line, so the omitted slot
    // leaves a 332 px hole against AISLE_MIN's 173 -- and the whole fan spans
    // 760 px, well under half the playable width. "A fan from one formation
    // section", not a curtain.
    fanSepPx: B2_SEP,
    fanGapSlots: 1,
    guaranteedAisle: fanAisle(B2_SEP, 1, B2_ORB_R), // 332
    // The aisle steps one slot per row, so it travels one separation per row
    // interval: 190 / 0.7 = 271 px/s, inside §5.3's 420.
    aisleMoveSpeed: B2_SEP / 0.7,
  },
  // B2T -- the twin-tempo sweep. B2's fan with a different RHYTHM, authored as
  // its own row so the validator proves it like any other pattern.
  //
  // WHY IT EXISTS. Per-craft variation was left half-built: size, tint and
  // cadence skew were in, and "twin-shot volleys" was flagged as the thing that
  // must NOT be done per-craft, because varying orb count or aisle geometry at
  // runtime hides a real pattern from the static checker that exists to prove
  // §5.3's guarantees. The flag also named the honest version -- "a new
  // authored pattern row (say B2T) that gets validated like B1 and B2" -- and
  // this is it. An Emitter owns B2 or B2T by its identity hash; both are
  // proved; nothing varies inside a pattern.
  //
  // HOW IT READS DIFFERENT. B2 is two evenly-spaced rows. B2T fires its four
  // rows as TWO PAIRS -- bang-bang, a beat, bang-bang -- through a NARROWER fan.
  // The aisle cannot move inside a pair (0.16 s x 315 px would be ~2000 px/s,
  // five times §5.3's cap), so the pair goes through the same hole and the hole
  // steps between pairs. /patterns enforces that arithmetically rather than
  // trusting the numbers here: standing in an aisle that has just gone quiet and
  // finding it has not finished with you is a genuinely different thing to
  // survive, at four orbs a pair.
  //
  // THREE ROWS, NOT FOUR, AND THE ROW IT LOST IS A DENSITY FIX. R3 now walks
  // every level rather than only level one, and it caught this pattern putting
  // 12 orbs on screen per volley -- two Emitters running it at once reached 24
  // against §5.3's 22-orb cap, so the SPAWNER was silently dropping authored
  // orbs to stay legal. §5.3 is explicit about which way that trade goes:
  // "trade bullet count for bullet size [...] if a pattern needs more bullets
  // to feel dangerous, it is the wrong pattern."
  //
  // The rhythm survives the cut, which is why this is the row to take it from:
  // the pattern fires bang-bang, a beat, bang. A pair, then a straggler through
  // a hole that has moved. Standing in an aisle that has just gone quiet and
  // finding it has not finished with you is intact -- it is the ANSWER to the
  // pair that is now a single shot rather than a second pair.
  B2T: {
    id: 'B2T',
    name: 'Twin-tempo sweep',
    rows: 3,
    // Read in order, last value repeated: 0.16 s inside a pair, 0.9 s between.
    rowIntervalsS: [0.16, 0.9, 0.16],
    rowIntervalS: 0.16,
    orbRadius: B2T_ORB_R,
    volleyIntervalS: 9.5,
    fanOrbs: 4,
    fanSepPx: B2T_SEP,
    fanGapSlots: 1,
    guaranteedAisle: fanAisle(B2T_SEP, 1, B2T_ORB_R), // 346
    // Measured on the interval the aisle is actually ALLOWED to step across --
    // the 0.9 s beat between pairs. Stepping inside a 0.16 s pair would be
    // 1219 px/s, so /patterns refuses it and the pair shares one hole; that
    // refusal is the pattern's rhythm, not a workaround.
    aisleMoveSpeed: B2T_SEP / 0.9,
  },

  // B4 -- SINE CURTAIN. §5.5: "A row of orbs descends with phase-offset lateral
  // sine. Aisle travels laterally, predictably, at <= 420 px/s."
  //
  // LEVEL THREE'S PATTERN, and the first genuinely new bullet vocabulary since
  // the POC. §6.4 also assigns it to Nadir Coil, which is why it is introduced
  // in level three's WAVES first: by the time the coil arrives the player has
  // already learned to read an undulating wall, so the boss adds a mechanic
  // rather than a mechanic and a pattern at once. That ordering is the same one
  // boss two got (its bays fire B1/B2/B2T, all previously met) and it is worth
  // keeping as a rule: A BOSS INTRODUCES AT MOST ONE NEW THING.
  //
  // HOW IT READS AGAINST B2, which matters because the two are the same machine
  // underneath. B2 is a fan whose hole STEPS one slot at a time -- discrete,
  // rhythmic, and you follow it in hops. B4's hole steps too, but the whole
  // curtain is also breathing sideways continuously, so the hole ARRIVES
  // somewhere slightly different from where the step alone would have put it.
  // Standing in it means tracking a smooth line rather than hitting marks, and
  // that is a different lateral skill using the same lateral axis.
  //
  // ITS AISLE IS AUTHORED AT THE PLAYER'S LINE like every other fan, and the
  // sine's worst-case narrowing is subtracted from the declared floor rather
  // than hoped away -- see B4_SINE above for the arithmetic and the reason it
  // is closed form rather than sampled.
  B4: {
    id: 'B4',
    name: 'Sine curtain',
    rows: 3,
    rowIntervalS: 0.78,
    orbRadius: B4_ORB_R,
    volleyIntervalS: 8.6,
    // FOUR SLOTS, so a row is three orbs and a volley is nine. Sized against
    // §5.3's bullet cap from the start rather than trimmed afterwards: a
    // three-row pattern is the densest shape in the game per volley, and two
    // Emitters may run it at once, so 9 is what leaves the campaign's busiest
    // wave clear of the 22 ceiling with real headroom. The aisle does not
    // depend on the slot count at all -- it is the omitted run's separation --
    // so a narrower fan costs the pattern nothing it was authored for.
    fanOrbs: 4,
    fanSepPx: B4_SEP,
    fanGapSlots: 1,
    sine: B4_SINE,
    // 205*2 - 40 - 48 = 322 px against AISLE_MIN's 173.
    guaranteedAisle: fanAisle(B4_SEP, 1, B4_ORB_R, B4_SINE),
    // BOTH CONTRIBUTIONS. The gap steps one separation per row (205/0.78 = 263)
    // and the curtain itself slides at amp*omega (46 * 2pi * 0.38 = 110), and
    // §5.3 caps how fast the hole moves without caring which of the two moved
    // it. 373 against the 420 ceiling. /patterns budgets the step against
    // whatever the sine leaves, so this can never drift out of contract by
    // someone retuning one half.
    aisleMoveSpeed: B4_SEP / 0.78 + B4_SINE.amp * TWO_PI_C * B4_SINE.rateHz,
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

// ---------------------------------------------------------------------------
// The start screen (playtest round 13). The same board the run ends on, shown
// before it begins, on a countdown.
//
// TEN SECONDS is Amit's number and it is longer than a countdown needs to be
// for its own sake -- which is the point. On a board the player has to physically
// get on and settle before the first squadron arrives, and the screen is where
// they read who they are trying to beat. A 3-second countdown would be a
// formality; this is a beat.
//
// It auto-advances and any input skips it, so the SDK's "first playable state
// on load, no key press" requirement is intact either way.
// ---------------------------------------------------------------------------
export const START_SCREEN = {
  // FIVE at the start, TEN at the end (playtest round 13). Amit's numbers, and
  // they are different for a reason worth keeping: the two screens carry the
  // same board but not the same job.
  //
  // At the START the player is already standing on the board waiting to play --
  // the screen is a settling beat, and anything longer is a queue. At the END
  // they have just finished and the board finally contains their own run, so it
  // is the only moment they will actually read the names. Ten seconds is time
  // to look; five would be a flash of a result.
  seconds: 5,
  // The result screen restarts itself when it runs out, so an abandoned run
  // never parks the machine on a dead screen -- the same reasoning as §7.2's
  // timeout, which exists so a walk-up queue is not stalled by someone who
  // wandered off. Any input skips it, so nobody who wants to go again waits.
  resultSeconds: 10,
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
  // §5.5 F4: "Staggered picket | 2 rows of 7, offset by half a slot | Reads as
  // depth without using any."
  //
  // THE LAST UNBUILT SHAPE, pulled in for level three because a third level
  // whose fights are laid out exactly like the second one's is the repetition
  // note (playtest round 2 §3) coming back one level later. Zero new art, by
  // construction: a formation is a slot table.
  //
  // WHY IT IS WORTH A ROW even though F5 was called the higher-value shape. F5
  // changes what the player has to DO; F4 changes what the player has to READ,
  // and level three is the level with the most going on to read. A half-slot
  // offset means no two craft share a column, so there is no vertical line
  // through the formation that the guns can clear in one pass -- every kill is
  // its own aim rather than a column being deleted. That is the one thing the
  // grid, the lens, the chevron and the pods all fail to ask for.
  //
  // THE SPAN IS TIGHTER THAN F1's AND THAT IS FORCED, not a taste call. Row 1
  // is shifted right by half a column, so the layout has to fit 6.5 column
  // spacings inside FORMATION_X's 0.10..0.90 rather than 6. At 0.1215 per
  // column the far slot lands at 0.891 -- inside the bound with room for the
  // whole-formation drift, which R4 checks against the HUD margins.
  F4: {
    id: 'F4',
    name: 'Staggered picket',
    kind: 'picket',
    cols: 7,
    rows: 2,
    xMin: 0.10,
    colGap: 0.1215,
    // Row 1 sits half a column to the right of row 0.
    rowOffset: [0, 0.5],
    // Same rows as F1 and F5, so the band arithmetic is shared and the sprite
    // envelope check (R4) is the one that already passes.
    rowY: [0.116, 0.235],
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
// LEVELS -- per-level content, indexed by surface (§5.7's campaign ramp).
//
// WHAT THIS IS NOT. It is not the wave-taxonomy re-cut. The POC-8 decision note
// (playtest round 2 §1) renames today's `waves[]` to `subWaves[]` and nests
// four of them inside a `wave`, four waves to a level -- and that rename is
// still pending because it forces a session-length call that is Amit's. So the
// vocabulary here is deliberately UNCHANGED: a level owns a `waves` list
// exactly as POC_SCENARIO always did. When the taxonomy lands it renests these
// lists; nothing else about this table has to move.
//
// WHAT IT IS. The one dimension the code was missing: /systems/director.js used
// to run POC_SCENARIO.waves on every surface, so all three levels were the same
// fight over different art. A level is now a row.
//
// LEVEL ONE IS LOCKED and this is where that is enforced structurally. Its
// `waves` is POC_SCENARIO.waves BY REFERENCE, not a copy -- so it is impossible
// to "tune level two" and silently move level one, and a diff that touches
// level one's content is a diff that edits POC_SCENARIO, which is loud. It
// authors no HP overrides, so every craft in it has exactly the HP §6.2 gives
// it, unchanged.
// ---------------------------------------------------------------------------

export const LEVELS = [
  // ORDER IS THE CAMPAIGN ORDER and is index-locked to SURFACES.
  // Playtest round 7: the two bright levels are interleaved between the
  // dark ones (lava, open sky, shipyard, open ice, armour) so the game
  // never runs three grim industrial levels in a row. The Hive Plate is
  // gone entirely -- Amit: "don't use the hive plate at all."
  {
    id: 'ashfall',
    name: 'LEVEL 1',
    // LOCKED (Amit is demoing it). By reference, on purpose -- see above.
    waves: POC_SCENARIO.waves,
    hp: null,
    waveTimeoutS: POC_SCENARIO.waveTimeoutS,
    // FIRE RATE, DIALLED BACK -- Amit, from the board: "level 1 has far too
    // many projectiles on screen, it's too hard."
    //
    // SET FROM A MEASUREMENT TAKEN AFTER THE B2 FIX, NOT BEFORE IT. This is the
    // whole reason the number is 1.15 and not the 1.35 the first pass authored.
    // Amit's report was made against a build where a single Emitter painted a
    // six-orb row across the entire frame (see the fan note above), and most of
    // "far too many projectiles" was that bug rather than the rate. Cutting the
    // rate on top of the geometry fix without re-measuring would have discounted
    // the same problem twice and left the teaching level lifeless.
    //
    // Measured over a 200 s level-one soak in Mode S, peak / mean concurrent
    // enemy bullets against §5.3's cap of 22:
    //
    //     1.00 (authored rate) ....... 13 / 7.06
    //     1.15 (here) ................ 12 / 6.08
    //     1.35 (first pass) .......... 11 / 5.23
    //
    // Even at the authored rate the fixed geometry peaks at 13 of 22. So this is
    // a real but modest easing -- 14% off the mean -- rather than a second full
    // discount, and level ONE only: this is the teaching level and a first run
    // is the benchmark it has to pass, while level two is meant to press harder.
    //
    // WHAT THE MEASUREMENT IS AND IS NOT. It is a no-input soak, so it measures
    // DENSITY (what Amit named: "projectiles on screen") and not difficulty --
    // the craft never dodges. Difficulty is still a board judgement, and this is
    // the one constant to move for it.
    //
    // It touches no floor: interval is WHEN a volley fires, never how many orbs
    // it holds, how wide its aisle is, or how fast it falls.
    fireRateMul: 1.15,

    // NOT opted in. Per-craft pattern variants (§6.2's `patternVariants`) would
    // put B2T -- a bullet pattern level one has never had -- into some of its
    // seven Emitters. "Level one is locked" covers what its craft SHOOT, not
    // just how many of them there are, so the opt-in is per level and this row
    // says no.
    craftVariants: false,
  },
  {
    id: 'skyfield',
    name: 'LEVEL 2',
    // NO HP OVERRIDE, AND THE ROW IS GONE RATHER THAN EMPTIED.
    //
    // It used to say `hp: { drone: 2 }`, and that single line is what Amit was
    // looking at in playtest round 5: "it's an enemy with two lives [...] but it
    // looks really really close or maybe the same sprite even to the ones in
    // level one which have only one life". It WAS the same sprite. The override
    // made a craft tougher without making it look tougher, which is the exact
    // failure the HP-tier rule above now forbids outright (R6 fails a level that
    // authors one).
    //
    // §5.7's sanctioned "enemy HP" lever is not lost -- it moves from a hidden
    // multiplier onto the roster, which is what §6.2's six-type ladder is for.
    // Every `drone` that was silently a 2 HP craft is now an authored LANCER,
    // which is a 2 HP craft that looks like one and dives more often besides.
    // The wave-by-wave count is unchanged where the toughness was the point and
    // deliberately mixed where it was not: a formation of all-Lancers would lose
    // the contrast that makes a Lancer read as the heavy one.
    hp: null,
    // Emitters here pick B2 or B2T from their own identity hash, so two of them
    // in one formation run visibly different rhythms (§6.2's patternVariants).
    // Both are authored, validated rows -- the variation is WHICH proved
    // pattern a craft carries, never what is inside one.
    craftVariants: true,
    // FIRE RATE STAYS AT THE AUTHORED 1.00 -- and the road to that answer is
    // worth keeping, because the first attempt at it was wrong.
    //
    // The previous pass flagged that "level two peaks at exactly 22 bullets,
    // the Normal cap; the spawner is actively clamping it". THE VERDICT IS
    // OVER-AUTHORING rather than intended pressure: §5.3's density caps are
    // floors of the pacing contract (§5.7 names them among the four things
    // difficulty "NEVER scales by"), and /patterns enforces the bullet cap AT
    // THE SPAWNER by dropping orbs. A level sitting on the cap is a level where
    // pool arithmetic decides which orbs exist. Not unsafe -- a dropped orb only
    // widens an aisle -- but unauthored, and it hides its own cause from whoever
    // next finds the level busy.
    //
    // THE FIRST FIX WAS TO CUT THIS RATE TO 1.18, AND IT WAS THE WRONG LEVER.
    // Generalising R3 to walk every level (it only ever walked level one, which
    // is why this had to be found by playing) showed the real cause: B2T was
    // authored at 12 orbs per volley, so TWO Emitters running it reached 24
    // before any rate was applied. The overage was the pattern's geometry, not
    // how often it fired -- and cutting the rate on top of fixing the geometry
    // would have discounted the same problem twice and left level two limp,
    // which is precisely the mistake level one's own note warns about.
    //
    // So B2T lost a row (see PATTERNS.B2T) and this stays where it was authored.
    // Level two's worst wave now peaks at 17 of 22 with real headroom, and every
    // orb the player sees is one this table put there.
    fireRateMul: 1.0,
    // Longer than level one's 46 s, because its waves genuinely take longer to
    // clear now (a 22-craft wave at 2 HP with two Wardens is ~73 bolts of
    // committed fire). A wave that times out makes its survivors flee, which
    // would read as the game giving up rather than as the player being slow.
    // This is also the direction playtest round 2 §4 asked for ("sub-waves
    // themselves should run a bit longer") -- the duration half of it, not the
    // taxonomy half, which stays pending.
    waveTimeoutS: 58,
    waves: [
      {
        // MORE EMITTERS FROM THE FIRST BEAT. Level one introduced one Emitter
        // in its second wave; level two opens with two, spaced across the grid
        // so their sweeps overlap from different origins. Nothing new to learn
        // yet -- this wave's only job is "the same shapes, and they do not die
        // as fast".
        name: 'WAVE 1',
        formation: 'F1',
        //
        // FILLED WITH LANCERS, which is where level two's old `hp: {drone: 2}`
        // override went. Same toughness the wave always had; now the player can
        // SEE it before firing (see the HP-tier rule above). Two drones are left
        // in on purpose -- a formation of nothing but armoured craft has nothing
        // to be armoured relative to.
        squadrons: [
          { side: 'L', count: 12, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 2: 'emitter', 5: 'drone', 9: 'emitter', 11: 'drone' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE WARDEN'S INTRODUCTION, at the chevron's APEX.
        //
        // §5.5 says the apex "is the natural focus-fire target" -- it is the
        // lowest point of the V, the nearest craft to the player, the one the
        // guns are already pointed at. Putting the shielded craft exactly there
        // is the cheapest possible way to teach the type with no text: the
        // player shoots the thing they were always going to shoot, sees three
        // arcs break off it one at a time, and then sees it start to burn. The
        // mechanic explains itself in the first two seconds of contact.
        name: 'WAVE 2',
        formation: 'F3',
        squadrons: [
          { side: 'R', count: 11, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 0: 'emitter', 3: 'drone', 5: 'warden', 8: 'drone',
              10: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE SPLITTER'S INTRODUCTION, buried in the lens.
        //
        // Two of them, one in each arc, so the lesson lands twice from opposite
        // sides in one wave. The lens is the right shape for it: 18 craft on a
        // wide ellipse means a Splitter's pair is born into a crowd, which is
        // when "clearing early made this worse" is most legible.
        name: 'WAVE 3',
        formation: 'F2',
        squadrons: [
          { side: 'L', count: 9, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'drone', 3: 'splitter', 7: 'emitter' } },
          { side: 'R', count: 9, slot: 9, delayS: 1.6, pace: 'brisk',
            fill: 'lancer', types: { 2: 'splitter', 6: 'drone' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // F5 SPLIT PODS with a Warden in EACH block, which is the wave the two
        // new types were chosen to make possible.
        //
        // The blocks are 806 px apart and the guns only point one way, so
        // covering one is choosing not to cover the other -- that was already
        // true in level one. What changes is that the side you commit to now
        // takes real time to clear, so the choice has a duration rather than
        // being resolved in a second and a half. That duration IS the
        // difficulty.
        name: 'WAVE 4',
        formation: 'F5',
        squadrons: [
          { side: 'L', count: 6, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'emitter', 4: 'warden' } },
          { side: 'R', count: 6, slot: 6, delayS: 1.3, pace: 'brisk',
            fill: 'lancer', types: { 1: 'warden', 4: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // Fewer craft, more pattern pressure -- the same design move level
        // one's wave 5 makes, so the two levels rhyme rather than just
        // escalate. Three Emitters on eleven craft is the densest sweep
        // coverage in the game; the Splitter at the apex means the obvious
        // focus-fire target answers back.
        name: 'WAVE 5',
        formation: 'F3',
        squadrons: [
          { side: 'L', count: 11, slot: 0, pace: 'lazy', fill: 'lancer',
            types: { 0: 'emitter', 3: 'drone', 5: 'splitter', 7: 'drone',
              10: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // The level's peak: a 22-craft grid from both sides carrying two
        // Wardens, two Emitters and a Splitter.
        //
        // TWENTY-TWO, NOT TWENTY-FOUR, and the two empty slots are the point.
        // The cap is 24 and a Splitter's death adds two craft, so a full grid
        // would silently drop a fragment on the floor -- the type's whole
        // promise ("killing it makes more") would fail exactly in the wave it
        // matters most. Two slots of headroom is the fix, and it also leaves
        // the grid visibly gapped, which reads as a formation already taking
        // losses rather than as a missing squadron.
        //
        // NOT FLAGGED `hardest`. That flag selects which wave §10's
        // lateral-corrections metric samples, and level one's wave 6 owns it --
        // POC-8's collected samples were measured against that specific grid,
        // and quietly adding a second, harder source would make the series
        // incomparable with itself. The mode decision is settled, but the
        // measurement should still mean one thing.
        name: 'WAVE 6',
        formation: 'F1',
        squadrons: [
          { side: 'R', count: 12, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 3: 'emitter', 6: 'drone', 8: 'warden', 11: 'drone' } },
          { side: 'L', count: 10, slot: 12, delayS: 1.2, pace: 'brisk',
            fill: 'lancer',
            types: { 2: 'warden', 4: 'drone', 6: 'emitter', 9: 'splitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
    ],
  },
  {
    id: 'kesselring',
    name: 'LEVEL 3',
    // NO HP OVERRIDE, AND THE ROW IS GONE RATHER THAN EMPTIED.
    //
    // It used to say `hp: { drone: 2 }`, and that single line is what Amit was
    // looking at in playtest round 5: "it's an enemy with two lives [...] but it
    // looks really really close or maybe the same sprite even to the ones in
    // level one which have only one life". It WAS the same sprite. The override
    // made a craft tougher without making it look tougher, which is the exact
    // failure the HP-tier rule above now forbids outright (R6 fails a level that
    // authors one).
    //
    // §5.7's sanctioned "enemy HP" lever is not lost -- it moves from a hidden
    // multiplier onto the roster, which is what §6.2's six-type ladder is for.
    // Every `drone` that was silently a 2 HP craft is now an authored LANCER,
    // which is a 2 HP craft that looks like one and dives more often besides.
    // The wave-by-wave count is unchanged where the toughness was the point and
    // deliberately mixed where it was not: a formation of all-Lancers would lose
    // the contrast that makes a Lancer read as the heavy one.
    hp: null,
    // Emitters here pick B2 or B2T from their own identity hash, so two of them
    // in one formation run visibly different rhythms (§6.2's patternVariants).
    // Both are authored, validated rows -- the variation is WHICH proved
    // pattern a craft carries, never what is inside one.
    craftVariants: true,
    // FIRE RATE STAYS AT THE AUTHORED 1.00 -- and the road to that answer is
    // worth keeping, because the first attempt at it was wrong.
    //
    // The previous pass flagged that "level two peaks at exactly 22 bullets,
    // the Normal cap; the spawner is actively clamping it". THE VERDICT IS
    // OVER-AUTHORING rather than intended pressure: §5.3's density caps are
    // floors of the pacing contract (§5.7 names them among the four things
    // difficulty "NEVER scales by"), and /patterns enforces the bullet cap AT
    // THE SPAWNER by dropping orbs. A level sitting on the cap is a level where
    // pool arithmetic decides which orbs exist. Not unsafe -- a dropped orb only
    // widens an aisle -- but unauthored, and it hides its own cause from whoever
    // next finds the level busy.
    //
    // THE FIRST FIX WAS TO CUT THIS RATE TO 1.18, AND IT WAS THE WRONG LEVER.
    // Generalising R3 to walk every level (it only ever walked level one, which
    // is why this had to be found by playing) showed the real cause: B2T was
    // authored at 12 orbs per volley, so TWO Emitters running it reached 24
    // before any rate was applied. The overage was the pattern's geometry, not
    // how often it fired -- and cutting the rate on top of fixing the geometry
    // would have discounted the same problem twice and left level two limp,
    // which is precisely the mistake level one's own note warns about.
    //
    // So B2T lost a row (see PATTERNS.B2T) and this stays where it was authored.
    // Level two's worst wave now peaks at 17 of 22 with real headroom, and every
    // orb the player sees is one this table put there.
    fireRateMul: 1.0,
    // Longer than level one's 46 s, because its waves genuinely take longer to
    // clear now (a 22-craft wave at 2 HP with two Wardens is ~73 bolts of
    // committed fire). A wave that times out makes its survivors flee, which
    // would read as the game giving up rather than as the player being slow.
    // This is also the direction playtest round 2 §4 asked for ("sub-waves
    // themselves should run a bit longer") -- the duration half of it, not the
    // taxonomy half, which stays pending.
    waveTimeoutS: 58,
    waves: [
      {
        // MORE EMITTERS FROM THE FIRST BEAT. Level one introduced one Emitter
        // in its second wave; level two opens with two, spaced across the grid
        // so their sweeps overlap from different origins. Nothing new to learn
        // yet -- this wave's only job is "the same shapes, and they do not die
        // as fast".
        name: 'WAVE 1',
        formation: 'F1',
        //
        // FILLED WITH LANCERS, which is where level two's old `hp: {drone: 2}`
        // override went. Same toughness the wave always had; now the player can
        // SEE it before firing (see the HP-tier rule above). Two drones are left
        // in on purpose -- a formation of nothing but armoured craft has nothing
        // to be armoured relative to.
        squadrons: [
          { side: 'L', count: 12, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 2: 'emitter', 5: 'drone', 9: 'emitter', 11: 'drone' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE WARDEN'S INTRODUCTION, at the chevron's APEX.
        //
        // §5.5 says the apex "is the natural focus-fire target" -- it is the
        // lowest point of the V, the nearest craft to the player, the one the
        // guns are already pointed at. Putting the shielded craft exactly there
        // is the cheapest possible way to teach the type with no text: the
        // player shoots the thing they were always going to shoot, sees three
        // arcs break off it one at a time, and then sees it start to burn. The
        // mechanic explains itself in the first two seconds of contact.
        name: 'WAVE 2',
        formation: 'F3',
        squadrons: [
          { side: 'R', count: 11, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 0: 'emitter', 3: 'drone', 5: 'warden', 8: 'drone',
              10: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE SPLITTER'S INTRODUCTION, buried in the lens.
        //
        // Two of them, one in each arc, so the lesson lands twice from opposite
        // sides in one wave. The lens is the right shape for it: 18 craft on a
        // wide ellipse means a Splitter's pair is born into a crowd, which is
        // when "clearing early made this worse" is most legible.
        name: 'WAVE 3',
        formation: 'F2',
        squadrons: [
          { side: 'L', count: 9, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'drone', 3: 'splitter', 7: 'emitter' } },
          { side: 'R', count: 9, slot: 9, delayS: 1.6, pace: 'brisk',
            fill: 'lancer', types: { 2: 'splitter', 6: 'drone' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // F5 SPLIT PODS with a Warden in EACH block, which is the wave the two
        // new types were chosen to make possible.
        //
        // The blocks are 806 px apart and the guns only point one way, so
        // covering one is choosing not to cover the other -- that was already
        // true in level one. What changes is that the side you commit to now
        // takes real time to clear, so the choice has a duration rather than
        // being resolved in a second and a half. That duration IS the
        // difficulty.
        name: 'WAVE 4',
        formation: 'F5',
        squadrons: [
          { side: 'L', count: 6, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'emitter', 4: 'warden' } },
          { side: 'R', count: 6, slot: 6, delayS: 1.3, pace: 'brisk',
            fill: 'lancer', types: { 1: 'warden', 4: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // Fewer craft, more pattern pressure -- the same design move level
        // one's wave 5 makes, so the two levels rhyme rather than just
        // escalate. Three Emitters on eleven craft is the densest sweep
        // coverage in the game; the Splitter at the apex means the obvious
        // focus-fire target answers back.
        name: 'WAVE 5',
        formation: 'F3',
        squadrons: [
          { side: 'L', count: 11, slot: 0, pace: 'lazy', fill: 'lancer',
            types: { 0: 'emitter', 3: 'drone', 5: 'splitter', 7: 'drone',
              10: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // The level's peak: a 22-craft grid from both sides carrying two
        // Wardens, two Emitters and a Splitter.
        //
        // TWENTY-TWO, NOT TWENTY-FOUR, and the two empty slots are the point.
        // The cap is 24 and a Splitter's death adds two craft, so a full grid
        // would silently drop a fragment on the floor -- the type's whole
        // promise ("killing it makes more") would fail exactly in the wave it
        // matters most. Two slots of headroom is the fix, and it also leaves
        // the grid visibly gapped, which reads as a formation already taking
        // losses rather than as a missing squadron.
        //
        // NOT FLAGGED `hardest`. That flag selects which wave §10's
        // lateral-corrections metric samples, and level one's wave 6 owns it --
        // POC-8's collected samples were measured against that specific grid,
        // and quietly adding a second, harder source would make the series
        // incomparable with itself. The mode decision is settled, but the
        // measurement should still mean one thing.
        name: 'WAVE 6',
        formation: 'F1',
        squadrons: [
          { side: 'R', count: 12, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 3: 'emitter', 6: 'drone', 8: 'warden', 11: 'drone' } },
          { side: 'L', count: 10, slot: 12, delayS: 1.2, pace: 'brisk',
            fill: 'lancer',
            types: { 2: 'warden', 4: 'drone', 6: 'emitter', 9: 'splitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
    ],
  },
  {
    id: 'glacis',
    name: 'LEVEL 4',
    hp: null,
    craftVariants: true,
    // THE SAME VARIANT LIST LEVEL THREE AUTHORS, copied deliberately rather
    // than extended: the sine curtain is the last bullet shape in the game and
    // a level after the one that introduced it should keep it, not follow it
    // with a sixth thing. Every id here is an authored, validated row in
    // PATTERNS -- R8 proves that at boot.
    variantPatterns: { emitter: ['B2', 'B2T', 'B4'] },
    fireRateMul: 1.0,
    // Level three's timeout. Its waves are the same size and made of the same
    // craft, so a different number here would be a number with no reason.
    waveTimeoutS: 64,
    waves: [
      {
        // THE COMMITMENT SHAPE, FIRST. Twelve craft in two blocks 806 px apart
        // with an Emitter and a Warden in each: whichever side is covered, the
        // other is sweeping and shielded. Level two spent four waves earning
        // the right to ask this; level four opens with it.
        name: 'WAVE 1',
        formation: 'F5',
        squadrons: [
          { side: 'L', count: 6, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'emitter', 4: 'warden' } },
          { side: 'R', count: 6, slot: 6, delayS: 1.2, pace: 'brisk',
            fill: 'lancer', types: { 1: 'warden', 4: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE PICKET WITH SOMETHING IN IT THAT MULTIPLIES. Fourteen craft in
        // two half-offset rows means no column can be deleted in one pass, and
        // the single Splitter's pair is born into the gaps between the rows --
        // the level's through-line, stated once, cleanly, before it is doubled.
        // 14 + 2 = 16 against the 24 cap, so the fragments always arrive.
        name: 'WAVE 2',
        formation: 'F4',
        squadrons: [
          { side: 'R', count: 7, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 2: 'emitter' } },
          { side: 'L', count: 7, slot: 7, delayS: 1.3, pace: 'brisk',
            fill: 'lancer', types: { 4: 'splitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE WIDEST SHAPE CARRYING THE MOST FRAGMENTS. Two Splitters on
        // opposite arcs of the lens, so both lessons land at once from
        // eighteen craft spread across the whole frame width. 18 + 4 = 22
        // against the 24 cap -- tight, and inside it.
        name: 'WAVE 3',
        formation: 'F2',
        squadrons: [
          { side: 'L', count: 9, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 2: 'splitter', 6: 'emitter' } },
          { side: 'R', count: 9, slot: 9, delayS: 1.6, pace: 'brisk',
            fill: 'lancer', types: { 3: 'emitter', 6: 'splitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE BREATHER, IN THE SAME PLACE EVERY OTHER LEVEL PUTS ONE. Eleven
        // craft, no Splitters, but three Emitters and a Warden at the chevron's
        // apex -- so the obvious focus-fire target is the one that takes three
        // rounds before it starts to burn. Fewer things, each of them slower to
        // remove: pressure without count.
        name: 'WAVE 4',
        formation: 'F3',
        squadrons: [
          { side: 'L', count: 11, slot: 0, pace: 'lazy', fill: 'lancer',
            types: { 0: 'emitter', 5: 'warden', 8: 'emitter', 10: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE PICKET RE-READ, the way level three re-reads its own opener: the
        // shape from wave 2, now with a Splitter AND a Warden in each row. The
        // formation that cannot be cleared in passes, full of craft that cannot
        // be cleared quickly. 14 + 4 = 18 against the 24 cap.
        name: 'WAVE 5',
        formation: 'F4',
        squadrons: [
          { side: 'L', count: 7, slot: 0, pace: 'brisk', fill: 'lancer',
            types: { 1: 'splitter', 5: 'warden' } },
          { side: 'R', count: 7, slot: 7, delayS: 1.4, pace: 'normal',
            fill: 'lancer', types: { 2: 'warden', 5: 'splitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE LEVEL'S PEAK. Twenty craft from both sides, all Lancers except
        // three Emitters, two Wardens and a Splitter -- the same census as
        // level three's peak, entered on a level where the player has no drones
        // to clear cheaply on the way through. 20 + 2 = 22 against the 24 cap.
        //
        // STILL NOT FLAGGED `hardest`, for the reason levels two and three are
        // not: that flag selects §10's lateral-corrections sample and level
        // one's wave 6 owns it. The measurement should keep meaning one thing.
        name: 'WAVE 6',
        formation: 'F1',
        squadrons: [
          { side: 'R', count: 10, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'emitter', 4: 'warden', 7: 'emitter' } },
          { side: 'L', count: 10, slot: 12, delayS: 1.1, pace: 'brisk',
            fill: 'lancer',
            types: { 2: 'warden', 5: 'splitter', 8: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
    ],
  },
  {
    id: 'bulwark',
    name: 'LEVEL 5',
    hp: null,
    craftVariants: true,
    // B4 IS OPTED INTO PER LEVEL, exactly as craftVariants is, and for the same
    // reason: §6.2's `patternVariants` on the Emitter type would otherwise put
    // the sine curtain into level TWO's Emitters as well, which would move
    // content Amit has already played. A level names the variant list it wants;
    // an absent row falls through to the type's own.
    variantPatterns: { emitter: ['B2', 'B2T', 'B4'] },
    // THE AUTHORED RATE, like level two's. The density headroom comes from the
    // patterns being sized correctly (B4 is a four-slot fan, three orbs a row)
    // rather than from a rate discount, so the ramp between levels stays a
    // matter of what is on screen and not of how slowly it arrives. R3 walks
    // this level at boot and reports its busiest wave: 18 of §5.3's 22.
    fireRateMul: 1.0,
    // Longest of the three. Its waves genuinely take longer: an F4 picket has to
    // be dismantled craft by craft, and the roster is the heaviest in the game.
    waveTimeoutS: 64,
    waves: [
      {
        // THE PICKET, IMMEDIATELY. Level three's first wave is the one place to
        // introduce its new shape, while the roster is still one the player
        // knows and there is nothing else new to read. Fourteen craft in two
        // offset rows: no column lines up, so the opening beat teaches "you
        // cannot clear this in passes" before anything else is asked.
        name: 'WAVE 1',
        formation: 'F4',
        squadrons: [
          { side: 'L', count: 7, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 3: 'emitter' } },
          { side: 'R', count: 7, slot: 7, delayS: 1.2, pace: 'brisk',
            fill: 'lancer', types: { 3: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE SINE CURTAIN'S INTRODUCTION, on the widest shape in the game.
        //
        // The lens spreads eighteen craft across the whole width, so its three
        // Emitters are far apart and their curtains arrive from visibly
        // different origins -- which is the read the pattern needs on first
        // contact. With craftVariants on, one or more of them carries B4 by its
        // identity hash; the rest run B2 or B2T, so the player meets the new
        // rhythm ALONGSIDE the two they already know rather than instead of
        // them. Learning it is noticing that one wall is breathing.
        name: 'WAVE 2',
        formation: 'F2',
        squadrons: [
          { side: 'L', count: 9, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'emitter', 5: 'drone', 8: 'emitter' } },
          { side: 'R', count: 9, slot: 9, delayS: 1.5, pace: 'brisk',
            fill: 'lancer', types: { 3: 'emitter', 7: 'drone' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE SPLIT-POD COMMITMENT, with the level's heaviest craft on both
        // sides. Level two's version of this wave made the choice cost time; a
        // Warden AND a Splitter per block makes it cost the answer as well --
        // clearing the side you committed to produces two more craft on it.
        name: 'WAVE 3',
        formation: 'F5',
        squadrons: [
          { side: 'L', count: 6, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 1: 'warden', 4: 'splitter' } },
          { side: 'R', count: 6, slot: 6, delayS: 1.3, pace: 'brisk',
            fill: 'lancer', types: { 1: 'splitter', 4: 'warden' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // FEWEST CRAFT, MOST PATTERN. The same shape of beat level one's and
        // level two's fifth waves have, moved earlier because level three needs
        // its breather before its two heaviest waves rather than after them.
        // Four Emitters on eleven craft is the densest sweep coverage the game
        // authors anywhere.
        name: 'WAVE 4',
        formation: 'F3',
        squadrons: [
          { side: 'R', count: 11, slot: 0, pace: 'lazy', fill: 'lancer',
            types: { 0: 'emitter', 2: 'emitter', 5: 'warden', 8: 'emitter',
              10: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE PICKET AGAIN, NOW FULL OF THINGS THAT ANSWER BACK. The shape the
        // level opened with, re-read: two Splitters inside a formation that has
        // no columns means the fragments are born into the gaps between rows,
        // which is the busiest the gutter gets anywhere in the game.
        //
        // Fourteen craft plus four possible fragments is eighteen against the
        // 24 cap, so both Splitters can always deliver.
        name: 'WAVE 5',
        formation: 'F4',
        squadrons: [
          { side: 'R', count: 7, slot: 0, pace: 'brisk', fill: 'lancer',
            types: { 2: 'splitter', 5: 'emitter' } },
          { side: 'L', count: 7, slot: 7, delayS: 1.4, pace: 'normal',
            fill: 'lancer', types: { 1: 'emitter', 4: 'splitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
      {
        // THE LEVEL'S PEAK, and the campaign's: a twenty-craft grid carrying
        // two Wardens, three Emitters and a Splitter, entered from both sides.
        //
        // TWENTY, NOT TWENTY-TWO, and the extra headroom over level two's peak
        // is the Lancer's doing rather than caution: the fill dives far more
        // often, so more of this wave is in the gutter at any moment than in
        // any level-two wave, and the frame gets crowded by BEHAVIOUR rather
        // than by count. 20 + 2 Splitter fragments = 22 against the 24 cap.
        //
        // STILL NOT FLAGGED `hardest`, for the reason level two's peak is not:
        // that flag selects §10's lateral-corrections sample and level one's
        // wave 6 owns it. The measurement should keep meaning one thing.
        name: 'WAVE 6',
        formation: 'F1',
        squadrons: [
          { side: 'L', count: 10, slot: 0, pace: 'normal', fill: 'lancer',
            types: { 2: 'emitter', 5: 'warden', 8: 'drone' } },
          { side: 'R', count: 10, slot: 12, delayS: 1.1, pace: 'brisk',
            fill: 'lancer',
            types: { 1: 'emitter', 3: 'warden', 6: 'splitter', 9: 'emitter' } },
        ],
        patterns: ['B1'],
        hardest: false,
      },
    ],
  },
];

/** The level record for a surface index. Levels and surfaces are 1:1 by
 *  construction (§5.7 gives every sector its own surface), so this is the same
 *  index /data/surfaces.js uses. */
export function levelAt(i) {
  return LEVELS[((i % LEVELS.length) + LEVELS.length) % LEVELS.length];
}

/** The wave list a level actually runs, with the unauthored-level fallback
 *  made explicit rather than implicit. */
export function levelWaves(i) {
  const L = levelAt(i);
  return L.waves || LEVELS[1].waves;
}

/**
 * A type's HP, which is a property of the TYPE and of nothing else.
 *
 * THIS USED TO BE A PER-LEVEL OVERRIDE and it is the thing playtest round 5
 * caught: level two authored `hp: { drone: 2 }`, so the same sprite meant one
 * bolt in level one and two in level two, and the only way to find out was to
 * shoot one. See the HP-tier readability rule above ENEMY for the full note.
 *
 * The signature keeps its level argument on purpose rather than being deleted
 * at every call site: the lookup is still per-level in principle (§5.7 does
 * sanction enemy HP as a campaign lever), it is just exercised by putting
 * TOUGHER TYPES in later waves instead of by making the same craft secretly
 * tougher. R6 fails any level that authors an `hp` row, so this cannot quietly
 * come back.
 */
export function levelHp(i, type) {
  return enemyDef(type).hp;
}

/**
 * Which authored bullet patterns a type's craft may choose between IN THIS
 * LEVEL (§6.2's `patternVariants`, opted into per level).
 *
 * The per-level list exists for the same reason `craftVariants` does. B4 is
 * level three's new pattern; putting it on the Emitter TYPE would immediately
 * put it into level two's Emitters as well, which changes content Amit has
 * already played, and into level one's if the opt-in were ever flipped. A level
 * names what its craft may carry; everything it does not name falls through to
 * the type.
 *
 * Every entry is still an authored PATTERNS row that R2 walks and R6 checks, so
 * this selects between proved patterns and can never introduce an unproved one.
 */
export function levelVariantPatterns(i, type) {
  const L = levelAt(i);
  const v = L.variantPatterns && L.variantPatterns[type];
  return v || enemyDef(type).patternVariants;
}

// ---------------------------------------------------------------------------
// Bosses (§6.4) -- the SHARED framework. Per-boss flavour is /data/bosses.js.
//
// §6.4: "Per-boss flavour is in the pod layout and pattern assignment, not in
// new systems." So everything that is true of every boss lives here, and a
// second or third boss is a row in bosses.js over this.
// ---------------------------------------------------------------------------

export const BOSS = {
  // SUPPLY DURING THE FIGHT (playtest round 9). Amit: "boss fights became too
  // hard now [...] every time that is like on 70% and on 30% he should generate
  // a pickup."
  //
  // WHY THE BOSS SPECIFICALLY GOT HARDER. The baseline fire rate is now 56% of
  // what it shipped with, and every other part of the game absorbed that: waves
  // have formations a blast can catch, and kills roll for drops. A boss has
  // neither -- it is one target, no drops, and pure sustained damage, so the
  // rate cut lands on it undiluted and a fight that was ~25s becomes ~45s with
  // no new decisions in the extra twenty.
  //
  // Fractions of the boss's TOTAL remaining HP, crossed once each and in order.
  // 70% is early enough to change the fight rather than reward its end, and 30%
  // lands where a player is most likely to be losing shield.
  pickupAtFractions: [0.70, 0.30],
  // Dropped below the hull rather than at it: the boss sits at y=0.315 and
  // §5.6 forbids a lure above y=0.62, so a canister at the boss would be one
  // the player must climb for -- the expensive lean, and exactly what §5.6
  // exists to prevent.
  pickupDropY: 0.60,

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

  // BOSS FIRE RATE -- Amit, from the board: "the boss fight needs fewer
  // projectiles too."
  //
  // A multiplier on every boss-owned emitter's volley interval, on top of the
  // level's. It is separate from the level knob because a boss is a different
  // pressure problem: the playfield is otherwise EMPTY during a fight (the
  // warning band flees every survivor), so all the bullets on screen are the
  // boss's and there is nothing else competing for the player's read. At 1.5,
  // Cinderjaw's B1 goes from a volley every 3.8 s to every 7.7 s once level
  // one's own 1.35 is applied as well.
  //
  // Same discipline as every other rate knob here: it changes WHEN, never the
  // orb count, the aisle or the descent, so §5.3's guarantees are untouched.
  //
  // 1.25 RATHER THAN THE 1.5 THE FIRST PASS AUTHORED, and for the same reason
  // level one's is 1.15: measured after the B2 fix instead of before it.
  // Measured over Cinderjaw's full 24 s fight, peak / mean concurrent orbs:
  //
  //     boss 1.00 ....... 11 / 5.80
  //     boss 1.25 (here)  11 / 5.30
  //     boss 1.50 ....... 11 / 5.31
  //
  // Two things worth carrying forward from that table. First, the fight is
  // already sparse once the fan is a fan -- 11 of 22 -- so there is little left
  // to cut and a deeper cut buys a quieter fight rather than a better one.
  // Second, the PEAK does not move at all, because it is set by the size of a
  // single volley (a sweep's 4 orbs x 2 rows, plus B1's 3) and this knob only
  // changes the gap between volleys. If the boss ever needs a lower peak, the
  // lever is the pattern, not this.
  //
  // NOTE FOR ANYONE TURNING IT: until this pass the knob was INERT. /patterns
  // reads it off `st.boss` and nothing set that flag, so 1.0 and 1.5 produced
  // identical fights. See bossOwned() in /enemies/boss.js.
  fireRateMul: 1.25,

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

  // LAUNCH BAYS -- boss two's mechanic (§6.4: "Brood Gantry | Pods are launch
  // bays that emit drones on a timer; killing a bay stops its stream").
  //
  // Only bosses whose row asks for it use any of this; Cinderjaw's pods do not
  // exist and Nadir Coil's will be segments. It lives in the shared block
  // because it is a MODE a pod can be in, not a boss.
  //
  // -------------------------------------------------------------------------
  // WHAT THE MECHANIC IS, AND THE LESSON IT IS BUILT AROUND.
  //
  // Boss one is a plain HP sponge on purpose -- "no tricks, nothing super
  // interesting to see" -- and its job was to teach "shoot the big thing". Boss
  // two has to be more than that. But the thing boss one actually failed at
  // first time was not its mechanic, it was LEGIBILITY: the pods were unmarked
  // and hull hits gave no feedback, so a fight that was mechanically correct
  // read as invulnerable and shipped unplayable.
  //
  // So the rule for boss two is: the mechanic must be discoverable BY PLAYING,
  // with no tutorial line. A bay cycles between OPEN and SHUT. An open bay is
  // launching drones at you, is lit, is reticled, and takes damage. A shut bay
  // is dark, its reticle is dimmed, and bolts visibly ring off it. The thing
  // hurting you is the thing you can hurt, and the two states look nothing
  // alike -- which means the player learns the rule by shooting for four
  // seconds, which is the only teaching method this product can rely on.
  //
  // TWO GUARANTEES MAKE IT SAFE, and both are asserted in
  // /systems/constraints.js rather than left to the phase arithmetic:
  //   * THERE IS ALWAYS SOMETHING TO SHOOT. With four bays evenly phased and
  //     openFrac 0.55, between two and three are open at any instant. A state
  //     where the player can do nothing is exactly the state that made boss one
  //     read as broken, so it must be unreachable, not unlikely.
  //   * THE ENDGAME NEVER WAITS. Once `alwaysOpenAtOrBelow` bays remain, they
  //     jam open permanently -- otherwise the last bay would spend 45% of the
  //     fight's tail invulnerable, which is the same failure wearing a timer.
  //
  // IT ASKS FOR NOTHING ON THE VERTICAL AXIS. Aiming at a bay is lining up
  // under it and holding (BOSS.podHitHalfW's shot-channel model), so the whole
  // mechanic is expressed on the lateral axis a board is actually good at
  // (§0.5). The open/shut cycle is a decision about WHERE to stand, and
  // auto-fire means there is no timing input at all.
  // -------------------------------------------------------------------------
  bay: {
    // Full open+shut period, and the share of it spent open.
    cycleS: 7.2,
    openFrac: 0.55,
    // Doors take this long to slide, so the state change is a visible event
    // rather than a texture swap. Damage follows the DOORS, not the clock: a
    // bay counts as open once it is past halfway.
    doorS: 0.45,
    alwaysOpenAtOrBelow: 2,

    // Drone launching. An open bay disgorges on this interval; a dead one
    // never does, which is §6.4's "killing a bay stops its stream" as a
    // property of the object rather than a flag.
    launchIntervalS: 2.6,
    // Hard ceiling on bay-born craft alive at once, on top of the global enemy
    // cap. The cap is a floor of the pacing contract (§5.3) and a boss that
    // could fill it by itself would leave nothing for the fight.
    maxLaunched: 5,
    // Launched drones fly ENEMY.fragment's exit arc -- never a dive (§5.5's
    // do-not-port list). They are worth shooting and they can be flown into;
    // they can never reach the player band.
    launchScore: 60,
  },

  // THE COIL -- boss three's mechanic (§6.4: "Nadir Coil | Segmented: the pods
  // are body segments and the serpent visibly shortens as they die").
  //
  // Only a boss whose row asks for it (`gate: 'ends'`) uses any of this. It
  // lives in the shared block for the same reason BOSS.bay does: it is a MODE a
  // pod can be in, not a boss.
  //
  // -------------------------------------------------------------------------
  // WHAT THE MECHANIC IS, AND WHY IT IS A THIRD THING RATHER THAN A VARIATION.
  //
  // Boss one is a plain HP pool -- "shoot the big thing". Boss two is a spatial
  // choice ON A CLOCK -- which of the open bays do I stand under, and the answer
  // changes every few seconds. Boss three is a spatial choice IN A FIXED ORDER,
  // and the order is visible in the geometry rather than announced:
  //
  //   ONLY THE TWO OUTERMOST LIVING SEGMENTS ARE EXPOSED. Everything between
  //   them is clamped shut behind its neighbours' armoured couplings. Kill an
  //   end and the coil visibly SHORTENS -- the dead vertebra and the hull
  //   beyond it retract off the frame -- and the next segment inward opens.
  //
  // So the fight walks from the outside in, toward the core, and the player's
  // lateral travel shortens as it goes. Where boss two asks "which one, right
  // now", boss three asks "which end do I work on", and there is no wrong
  // answer, only an order.
  //
  // DISCOVERABLE BY PLAYING, WITH NO TUTORIAL LINE -- the requirement inherited
  // from boss one's failure, and answered with vocabulary the player has
  // already been taught on boss two: an exposed segment is lit violet, reticled
  // and takes damage; a clamped one is a flat dark shutter whose reticle is
  // dimmed and which rings bolts off with the same deflect burst boss one's
  // armour used. Shoot the middle for two seconds and the rule states itself.
  // And THE COIL GETTING SHORTER is the confirmation: the frame itself tells
  // you the last hit did something structural, which no amount of HP bar does.
  //
  // TWO GUARANTEES, both asserted in /systems/constraints.js:
  //   * THERE ARE ALWAYS TWO TARGETS (one, once a single segment remains), by
  //     construction rather than by phase arithmetic -- the ends of a non-empty
  //     list always exist. Boss two needed a search over every surviving subset
  //     to prove the same thing; here it is a property of the definition.
  //   * THE COIL NEVER RETRACTS PAST ITS CORE. The live span is unioned with a
  //     window around coreDx, so the reactor the player is working toward can
  //     never end up outside the hull that is drawn.
  //
  // IT ASKS FOR NOTHING ON THE VERTICAL AXIS. Aiming at a segment is lining up
  // under it and holding (BOSS.podHitHalfW's shot-channel model), so the whole
  // mechanic lives on the lateral axis (§0.5).
  // -------------------------------------------------------------------------
  coil: {
    // How much hull is drawn beyond the outermost living segment, as a fraction
    // of BOSS.width. Enough to read as "the coil ends here" rather than as the
    // segment having been sliced in half.
    endPadDx: 0.085,
    // Half-width of the window around the core that the live span always
    // contains, so the reactor is never outside the drawn hull.
    corePadDx: 0.085,
    // How fast the ends retract, in fractions of BOSS.width per second. Slow
    // enough to be seen as a retraction and fast enough to be finished before
    // the player has relocated to the next end.
    retractPerS: 0.42,
    // Coupling shutters take this long to slide when a segment is exposed or
    // clamped, matching BOSS.bay.doorS so the two bosses share one language for
    // "this target is opening".
    doorS: 0.45,
  },

  // Per-pod HP pips, drawn on the playfield directly above each pod. Same
  // language as a damaged Emitter's pip row (ENEMY.damage), deliberately: the
  // player has already learned "green pips over a thing = that thing's HP", and
  // the pods are then the only parts of the boss wearing them. That is most of
  // what makes "shoot those four" legible with no tutorial line.
  //
  // `maxPips` BOUNDS THE ROW'S WIDTH, and it exists because of a bug a
  // screenshot caught rather than a rule someone remembered.
  //
  // The row used to draw ONE PIP PER HP POINT, which was correct while every
  // pod in the game had 6. Nadir Coil's segments have 20, so four segments drew
  // four 380 px pip rows on a 1340 px hull -- they tiled edge to edge into a
  // single dashed green line running the whole length of the boss, which
  // conveys nothing and looks like a debug overlay. A readout that scales with
  // a tuning number will eventually be tuned into nonsense, so the row is now a
  // FIXED-WIDTH gauge: at most `maxPips` segments, lit proportionally.
  //
  // 8 rather than 10: the row must stay narrower than the tightest gap between
  // two pods, or two segments' gauges merge and the player cannot tell which
  // HP belongs to which target. Nadir Coil's tightest pair is 168 px apart and
  // 8 pips is 148 px. R7 asserts it against every built boss rather than
  // trusting this note.
  podPips: { w: 15, h: 7, gap: 4, offsetY: -74, maxPips: 8 },
  // §5.3 caps simultaneous distinct patterns at 2 (Normal) / 3 (Elite), and
  // four pods each owning a pattern would breach it on the first frame. So the
  // boss ROTATES: at most `caps.simultaneousPatterns` pods are firing at once,
  // handing off on this interval. Both rules survive intact -- a destroyed pod
  // leaves the rotation permanently, so the fight still calms exactly as §6.4
  // requires, and the cap is never exceeded.
  podRotateS: 4.5,
  // PRESSURE FLOOR (playtest round 12). Amit: "level 2 nadir coil does not
  // shoot when last head is left."
  //
  // Volley intervals are authored assuming the cap's worth of pods are firing
  // at once. When only one is -- a coil down to its last segment, a gantry
  // between bay windows -- that pod is running a pattern authored at up to 9.5s
  // between volleys and the fight goes quiet exactly when it should be most
  // desperate. bossPressureMul() in /patterns shortens the interval in
  // proportion to how few sources are live; this is the floor on that, so a
  // lone survivor fires a little over twice as often as authored and no faster.
  // Bounded because §5.3's aisles are proved per pattern.
  //
  // NOTE this was necessary but NOT sufficient -- see hullPatterns in
  // /data/bosses.js. Firing one pattern faster still leaves one pattern.
  pressureFloor: 0.45,

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
// AUDIO (MVP item 21). The mix lives here for the same reason every other
// number in this file does: §9.3 wants the on-device pass to be a config
// session rather than a code hunt, and the mix is the single thing most likely
// to need retuning through a phone speaker held at arm's length.
//
// THE ONE RULE THIS TABLE EXISTS TO ENFORCE: FIRE IS THE QUIET ONE. Auto-fire
// is unconditional (§5.6) and the standard weapon fires every 0.105 s, so the
// fire clip plays roughly ten times a second for the entire run. Anything mixed
// at a normal level there stops being a sound and becomes the noise floor, and
// every event worth hearing -- a kill, a deflect, a hit taken -- has to fight
// it. So the fire clips are authored FIVE TO EIGHT TIMES quieter than the
// events they sit under, and that ratio is the thing to preserve if these
// numbers are ever retuned.
//
// EVERY CLIP IS LEVEL-CORRECTED HERE, not in the file. The generated clips
// arrived between -0.1 and -11 dBFS peak with RMS spread over 20 dB, so a
// uniform gain would have made the mix an accident of what each generation
// happened to return. The `gain` column is per clip and is the correction.
//
// `minGapS` is a retrigger floor, and it is mix protection rather than voice
// economy: three scatter rounds landing on three craft in one frame is three
// identical transients stacking into one spike three times as loud as the
// authored hit. A floor at a few tens of milliseconds collapses that into a
// single hit, which is what the ear was going to hear anyway. It is deliberately
// SHORTER than any weapon's fire interval, so no rate of fire is ever throttled.
//
// `pitchJitter` is +/- that fraction of playback rate, rolled per trigger. Only
// the clips that repeat many times a second get any: ten identical copies of the
// same 0.48 s sample per second phase into a machine-gun buzz, and a few percent
// of rate spread breaks it up without the sound changing character.
// ---------------------------------------------------------------------------

export const AUDIO = {
  // One master trim over everything, so "quieter overall" is one number.
  // 0.8 rather than a nominal 1.0 or 0.9 because it was MEASURED: an offline
  // render of this exact graph at busy-wave event rates (see `limiter` below)
  // peaks at -0.88 dBFS here, against 0.07 dBFS at 0.9 -- i.e. 0.9 still let
  // one sample through the limiter, and 0.8 leaves real headroom for ~0.35 dB
  // of loudness.
  master: 0.8,
  // Bus trims. Music sits well under the SFX bus: it is a bed, and §5.4's whole
  // readability argument is that the player should be reading the playfield.
  sfxVolume: 0.85,
  musicVolume: 0.22,
  // Which music take is wired. Both were generated; only one is shipped, and
  // swapping is this one line plus the file in /public/assets/audio.
  musicTrack: 'musicBed',
  // Start muted? No -- but the mute control (#mute-button) is always available,
  // and mute is a master-gain cut so it silences music and SFX together.
  startMuted: false,

  // THE SAFETY LIMITER ON THE MASTER BUS, and it is here because a measurement
  // said so rather than as boilerplate. An offline mixdown of the shipped clips
  // at realistic event rates (fire 11.25/s, kills 3/s, impacts 8/s, music, the
  // odd hit taken) peaks at +0.8 dBFS -- i.e. the mix CLIPS whenever a few loud
  // events land together, which WebAudio does by hard-truncating at the
  // destination and which sounds like a crackle rather than like anything
  // authored.
  //
  // NO ARRANGEMENT OF PER-CLIP GAINS FIXES THAT. The worst case is a shield
  // break, a kill and a sector shutter inside the same 200 ms, and pulling
  // every gain down far enough for that sum to be safe would leave the common
  // case inaudible. So the peaks are caught at the end of the chain instead.
  //
  // TUNED AS A LIMITER, NOT AS A COMPRESSOR: a high threshold with a hard knee
  // and a big ratio, so it does nothing at all until the mix is genuinely about
  // to clip. A gentler compressor would sit on the whole mix all the time and
  // pump the fire layer, which is the exact thing that would make the quietest
  // layer in the game start drawing attention to itself.
  // VERIFIED, not assumed: the same busy-wave scene rendered through an
  // OfflineAudioContext with this graph goes from +3.95 dBFS peak and 1033
  // clipped samples with no limiter, to -0.88 dBFS peak and zero clipped
  // samples with it. A -3 dB threshold was not quite enough (0.07 dBFS, one
  // clipped sample); -6 is.
  limiter: {
    thresholdDb: -6,
    kneeDb: 0,
    ratio: 20,
    attackS: 0.002,
    releaseS: 0.12,
  },

  clips: {
    // --- fire: the noise floor, kept under everything ---------------------
    fire:        { gain: 0.16, minGapS: 0.030, pitchJitter: 0.06 },
    fireHeavy:   { gain: 0.15, minGapS: 0.040, pitchJitter: 0.05 },
    fireLance:   { gain: 0.17, minGapS: 0.040, pitchJitter: 0.04 },
    fireSwarm:   { gain: 0.15, minGapS: 0.040, pitchJitter: 0.05 },

    // --- contact: frequent, but every one of them is information ----------
    // A bolt that lands and a bolt that kills have to be separable by ear
    // alone, so the kill is mixed a clear step above the impact.
    impact:      { gain: 0.30, minGapS: 0.045, pitchJitter: 0.05 },
    kill:        { gain: 0.55, minGapS: 0.040, pitchJitter: 0.04 },
    // The Warden's shimmer shield. Its whole job is to say "that round did not
    // count", so it must not be quieter than the impact it replaces.
    deflect:     { gain: 0.42, minGapS: 0.045, pitchJitter: 0.05 },
    // FLAK shooting down an enemy orb (WEAPONS.flak.intercepts). Generated in
    // the audio pass and left unwired then, because nothing in the game could
    // destroy an enemy projectile yet -- playtest round 9 gave it a source.
    // Mixed just under the impact: interception happens in fives when a fan
    // meets a curtain, and at impact volume that becomes a wall of noise at
    // exactly the moment the player most needs to hear the pattern.
    orbPop:      { gain: 0.26, minGapS: 0.035, pitchJitter: 0.07 },
    // RAPID's own fire voice. Mixed a touch under the standard bolt's despite
    // being the thing the player wants to notice -- it fires at nearly twice
    // the rate, so equal per-shot gain would make the whole mix jump every time
    // the weapon lands. The DIFFERENCE is the feedback, not the volume.
    fireRapid:   { gain: 0.14, minGapS: 0.028, pitchJitter: 0.05 },

    // --- the player's own state: the loudest things in the game -----------
    playerHit:   { gain: 0.85, minGapS: 0.10 },
    playerDown:  { gain: 0.95, minGapS: 0.50 },
    pickup:      { gain: 0.95, minGapS: 0.10 },
    weaponExpire:{ gain: 0.45, minGapS: 0.20 },

    // --- structure: rare, and each one is a beat --------------------------
    podKill:     { gain: 0.70, minGapS: 0.08 },
    bossWarning: { gain: 0.75, minGapS: 1.00 },
    bossDeath:   { gain: 0.85, minGapS: 1.00 },
    sector:      { gain: 0.70, minGapS: 1.00 },
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
