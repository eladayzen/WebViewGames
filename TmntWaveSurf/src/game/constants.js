// Every tuning number in the game. PHYS / PHYS_PRESETS / GAME / WAKE are the
// prototype's (DawnPatrol/experiments/wave-levels/levels.html), unchanged. RUN
// and INPUT are new: the rules that turn the prototype into a run that can end.

// ===================== surf physics (rail units: 0 = trough, 1 = crest; 1 rail = trough-to-crest distance) =====================
export const PHYS = {
  GRAVITY: 5.88,       // rail/s^2 pulling down the face, always on
  THRUST: 8.23,        // rail/s^2 upward push while the single input is held (net up = THRUST - GRAVITY)
  DAMP: 4.2,           // 1/s damping
  LAUNCH_MIN_V: 0.15,  // rail/s upward speed needed at the lip to launch
  AIR_PEAK_Y: 0.165,   // aerial peak: board height as a fraction of screen height from the top
  AIR_TIME: 1.35,      // s in the air (gravity derived from peak + time)
  AIR_TOP_MARGIN: 8,   // px: sprite top never goes above this (soft clamp)
  LAND_KEEP: 0.35,     // fraction of downward speed kept on landing
  BOUNCE: 0.25,        // trough bounce (fraction of impact speed), below 0.3 rail/s it just settles
  TILT_PER_V: 0.55,    // board tilt (rad) per rail/s of vertical speed
  TILT_NOSE_UP: 0.38,  // max nose-up tilt (rad)
  TILT_NOSE_DOWN: 0.14,// max nose-down tilt (rad) - kept small so fast drops do not tip him over
  AIR_VX: 420,         // px/s (at 1080p) of 'forward speed' used to turn the jump's vertical speed into a board angle
  AIR_LAND_TILT: 0.40, // rad nose-down the board reaches at touchdown
  AIR_TILT_MAX: 0.42,  // rad, max nose up / down in the air
  AIR_SPIN: 1,         // full backflips per jump (0 = none); spun through the middle of the air time
  RAMP: 0,             // extra thrust gained while holding: thrust x (1 + RAMP * min(1, holdTime / RAMP_T))
  RAMP_T: 1.6,         // s of holding to reach the full ramp
};
// ---- saved physics presets (dev panel) ----
export const PHYS_PRESETS = {
  'A · Current': { GRAVITY: 5.88, THRUST: 8.23, DAMP: 4.2, RAMP: 0, RAMP_T: 1.6, AIR_PEAK_Y: 0.165, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40, AIR_SPIN: 0 },
  // drop 20% slower (terminal fall 1.12 vs 1.40 rail/s); climb takes the same 2.03 s trough->lip but accelerates the longer you hold
  'B · Soft drop + ramp': { GRAVITY: 4.704, THRUST: 5.512, DAMP: 4.2, RAMP: 0.5, RAMP_T: 1.6, AIR_PEAK_Y: 0.165, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40, AIR_SPIN: 0 },
  // the user's saved Custom (B physics) with every jump locked to peak at 0.27 of screen height
  'C · Saved, locked jump': { GRAVITY: 4.704, THRUST: 5.512, DAMP: 4.2, RAMP: 0.5, RAMP_T: 1.6, AIR_PEAK_Y: 0.27, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40, AIR_SPIN: 0 },
  // C with a quicker start off the bottom -- one knob changed each (2026-11-18 "the pull-up start feels hard")
  'D · C + fast ramp': { GRAVITY: 4.704, THRUST: 5.512, DAMP: 4.2, RAMP: 0.5, RAMP_T: 0.55, AIR_PEAK_Y: 0.27, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40, AIR_SPIN: 0 },
  'E · C + more thrust': { GRAVITY: 4.704, THRUST: 6.5, DAMP: 4.2, RAMP: 0.5, RAMP_T: 1.6, AIR_PEAK_Y: 0.27, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40, AIR_SPIN: 0 },
  'F · C + less drag': { GRAVITY: 4.704, THRUST: 5.512, DAMP: 3.2, RAMP: 0.5, RAMP_T: 1.6, AIR_PEAK_Y: 0.27, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40, AIR_SPIN: 0 },
  // 2026-11-24: bigger jump -- the sea sits lower (SEA_DROP), the peak is higher and the hang time longer, with a backflip
  'G · C, full push at once': { GRAVITY: 4.704, THRUST: 7.5, DAMP: 4.2, RAMP: 0, RAMP_T: 1.6, AIR_PEAK_Y: 0.18, AIR_TIME: 1.7, AIR_LAND_TILT: 0.40, AIR_SPIN: 1 },
};
export const DEFAULT_PRESET = 'G · C, full push at once';   // picked 2026-11-18: full push from the first frame, no build-up
export const DIRECT_RATE = 1.68;   // Direct (dev) controller: face-heights per second
export const WAKE = { RATE: 160, LIFE: 0.55, FLOW: 0.75, SPREAD: 55, GROW: 2.4 };   // per s, s, screen-widths/s, px/s, radius growth

// ===================== obstacles + boss tuning =====================
export const GAME = {
  OBST_SIZE: 0.70,          // obstacle height as a fraction of Mikey's height (205 px at 1080p)
  OBST_GAP: [2.6, 4.6],     // s between obstacle spawns (x1.7 while the boss is on screen)
  OBST_SPEED: 0.22,         // obstacles drift at this fraction of the water flow at their height
  OBST_H: [0.06, 0.88],     // face height band they spawn in (0 trough .. 1 crest)
  OBST_BOB: 6,              // px bob amplitude
  BOSS_SIZE: 0.80,          // boss height as a fraction of Mikey's height
  BOSS_EVERY: [8, 12],      // s between visits (was 20-30; Elad 2026-11-17: more often)
  BOSS_STAY: [8, 12],       // s hovering per visit
  BOSS_POS: { x: [0.65, 0.85], y: 0.13 },   // hover zone (screen fractions)
  BOSS_SHOTS: [2, 4],       // projectiles per visit
  WINDUP: 0.6,              // s telegraph before each shot
  PROJ_TIME: [1.2, 1.6],    // s for a projectile to reach where the rider was when it fired
  PROJ_R: 0.026,            // projectile radius (fraction of screen height)
  INVULN: 0.9,              // s of invulnerability after a hit
  KNOCK_V: 0.55,            // physics: downward knock on hit (rail/s)
  // --- pickups -> ammo clip -> shooting the boss while airborne ---
  PICK_GAP: [2.6, 4.4],     // s between pickup strings
  PICK_N: [4, 7],           // pickups per string
  PICK_SPACING: 0.05,       // screen widths between pickups in a string
  PICK_SPEED: 0.30,         // face strings drift at this fraction of the water flow
  PICK_AIR_CHANCE: 0.35,    // chance a string is an arc over the lip (only reachable by jumping)
  PICK_SPECIAL: 0.30,       // chance a string ends in a special (nunchaku for Mikey)
  PICK_SIZE: 0.30,          // pickup size as a fraction of Mikey's height
  LIFE_EVERY: [16, 26],     // s between shell (extra life) pickups on the face
  LIFE_PTS: 20,             // points for a shell pickup
  // OOZE POWER: a mutagen pickup timed to the boss. While it lasts: ooze-green world, +3 lives,
  // glowing stars that hit harder. It shows up shortly before the boss, and picking it up calls
  // the boss in, so the boss is always on screen before the power runs out.
  OOZE_ENABLED: false,      // 2026-11-24: ooze power-up switched off (maybe level 2, needs more work)
  OOZE_DURATION: 14,        // s
  OOZE_LIVES: 3,            // extra lives on pickup (may go past RUN.LIVES)
  OOZE_DMG: 3,              // damage multiplier for thrown stars / nunchaku
  OOZE_LEAD: 7,             // spawn the pickup when the boss is this many s from arriving
  OOZE_BOSS_IN: 2.5,        // after pickup, the boss arrives within this many s
  OOZE_COOLDOWN: 30,        // s after a power starts before another canister can spawn (bosses now come every ~20 s)
  CLIP_MAX: 12,             // ammo clip capacity
  FIRE_RATE: 4,             // shots per second while level with the boss
  FIRE_BAND: 0.75,          // 'level with the boss' = rider body within this many Mikey-heights of the boss's centre, vertically
  FIRE_NEEDS_BOSS: true,    // only fire when the boss is on screen (otherwise ammo is kept)
  SHOT_SPEED: 0.55,         // screen widths / s (stars); specials fly at 0.75x and spin
  SHOT_SIZE: 1.3,           // thrown star radius vs a pickup's
  BOSS_HP: 56,              // (x4 from 14, Elad 2026-11-17) star = 1 damage, special = 3 (kept between a boss's visits within a mission)
  YACHT_SIZE: 0.95,         // yacht sprite height as a fraction of Mikey's height (it is ~2.3x as wide)
  YACHT_X: [0.66, 0.80],    // where the yacht holds station (screen width fraction)
  YACHT_H: 0.06,            // its waterline on the face (0 = trough, 1 = crest)
  SPECIAL_DMG: 3,
  BASIC_DMG: 0.25,          // endless basic pellet when the clip is empty: a quarter of a star
  BASIC_RATE: 2.5,          // basic pellets per second
  BASIC_SPEED: 0.45,        // screen widths / s
  BASIC_R: 0.011,           // pellet radius, fraction of screen height. An ooze ball it touches destroys it and flies on
  JET_ENABLED: false,       // water (jetski) boss switched off for now
  JET_SIZE: 1.05,           // water boss (jetski) height vs Mikey's
  JET_X: [0.66, 0.80],      // water boss rides here (screen fraction)
  FLAT_ZONE: 0.5,           // rider above this screen fraction -> boss swoops to his height and fires FLAT; rider stars fly flat, no homing
  SWOOP_RATE: 5,            // 1/s: how fast the boss slides to the firing lane
};

// ===================== the run: lives, score, endings (new for the shipped game) =====================
// ===================== missions (played in order; each ends when its boss is knocked out) =====================
// boss 'yacht' = the villain on his ooze yacht, riding the sea at water level;
// boss 'fly'   = the same villain in the air (the original boss).
// sky: 1 = sunny day, 0 = evening (fades behind the mission card).
// Story: at most 2 bubbles per scene, at most ~6 words each. The cards are icons only.
export const MISSIONS = [
  { boss: 'yacht', sky: 1,
    intro: [{ who: 'yacht', text: 'Ooze for the whole bay! Ha!' },
            { who: 'mikey', text: 'Not on my wave, dude!' }],
    outro: [{ who: 'yacht', text: 'My YACHT!' },
            { who: 'mikey', text: 'Booyah!' }] },
  { boss: 'fly', sky: 0,
    intro: [{ who: 'boss', text: 'Catch me up here, turtle!' },
            { who: 'mikey', text: 'Cowabunga!' }],
    outro: [{ who: 'boss', text: "I'll be back!" },
            { who: 'mikey', text: 'Pizza time!' }] },
];
export const MISSION = {
  FIRST_BOSS_S: [6, 9],     // s into a mission before its boss first shows up
  BRIEF_SECONDS: 15,        // the mission card starts the mission by itself after this long
  WIN_SECONDS: 12,          // the mission-complete card moves on by itself after this long
  KO_HOLD_S: 1.8,           // let the KO animation play before the win card
};

export const RUN = {
  LIVES: 7,                 // shells (also the cap for shell pickups); every obstacle or ooze-ball hit costs one, the last one ends the run
  COUNTDOWN_S: 3,           // auto-start countdown on load and on every restart (no key needed)
  RESULT_SECONDS: 10,       // death screen restarts itself after this long (the quit board has no clock)
  SKIP_GUARD_S: 0.3,        // a skip/restart press in the death screen's first 0.3 s is ignored
  // score
  DIST_PER_SEC: 10,         // distance surfed: points per second of riding (time x speed)
  AIR_PER_SEC: 5,           // small bonus per second airborne
  STAR_PTS: 10,             // per ninja star collected
  SPECIAL_PTS: 30,          // per nunchaku special collected
  BOSS_KO_PTS: 500,         // per boss knocked out
};

// ===================== board input: ONE direction =====================
// Only one lean direction pushes the board up (HOLD_SIDE); every other lean,
// including the opposite side, is "no input" (2026-11-22: leaning either way
// for up was not intuitive). The hold is the lean along HOLD_SIDE past PRESS,
// released below RELEASE (hysteresis).
// Thresholds follow the player's sensitivity with the SAME mapping the host
// uses for its own synthetic keys (WebGameController.ApplySensitivity):
// press = lerp(0.60, 0.15, pct/100), release = press * 0.6. The host does NOT
// scale __gbSensor itself, so with forwardSteeringKeys off this is the only
// place the setting takes effect.
export const INPUT = {
  PRESS_AT_MIN: 0.60,       // press threshold at sensitivity 0
  PRESS_AT_MAX: 0.15,       // press threshold at sensitivity 100
  RELEASE_RATIO: 0.6,       // release = press x this
  HOLD_CODES: ['Space', 'ArrowUp', 'KeyW'],   // keyboard holds (plus the arrow key of HOLD_SIDE)
  MODE: 'classic',          // 2026-11-24 default: lean LEFT = up, RIGHT = down, centre = hold the line. 'one' = HOLD_SIDE only (dev toggle)
  HOLD_SIDE: 'left',
  CLASSIC_DOWN: 1.6,        // classic mode, lean right: gravity x this (a firmer drop than letting go)
  CLASSIC_HOLD_DAMP: 9,     // classic mode, centre: no gravity, speed bleeds off at this rate (holds the line)        // 'left' | 'right' | 'front' | 'back' -- a player setting later
};

// the jump peak's rider-body height, used by the boss hover
export const SPRITE_H_1080 = 205;   // Mikey's on-screen height at 1080p
