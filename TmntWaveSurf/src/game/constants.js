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
  RAMP: 0,             // extra thrust gained while holding: thrust x (1 + RAMP * min(1, holdTime / RAMP_T))
  RAMP_T: 1.6,         // s of holding to reach the full ramp
};
// ---- saved physics presets (dev panel) ----
export const PHYS_PRESETS = {
  'A · Current': { GRAVITY: 5.88, THRUST: 8.23, DAMP: 4.2, RAMP: 0, RAMP_T: 1.6, AIR_PEAK_Y: 0.165, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40 },
  // drop 20% slower (terminal fall 1.12 vs 1.40 rail/s); climb takes the same 2.03 s trough->lip but accelerates the longer you hold
  'B · Soft drop + ramp': { GRAVITY: 4.704, THRUST: 5.512, DAMP: 4.2, RAMP: 0.5, RAMP_T: 1.6, AIR_PEAK_Y: 0.165, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40 },
  // the user's saved Custom (B physics) with every jump locked to peak at 0.27 of screen height
  'C · Saved, locked jump': { GRAVITY: 4.704, THRUST: 5.512, DAMP: 4.2, RAMP: 0.5, RAMP_T: 1.6, AIR_PEAK_Y: 0.27, AIR_TIME: 1.35, AIR_LAND_TILT: 0.40 },
};
export const DEFAULT_PRESET = 'C · Saved, locked jump';
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
  BOSS_EVERY: [20, 30],     // s between visits
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
  CLIP_MAX: 12,             // ammo clip capacity
  FIRE_RATE: 4,             // shots per second while airborne
  FIRE_NEEDS_BOSS: true,    // only fire when the boss is on screen (otherwise ammo is kept)
  SHOT_SPEED: 0.55,         // screen widths / s (stars); specials fly at 0.75x and spin
  SHOT_SIZE: 1.3,           // thrown star radius vs a pickup's
  BOSS_HP: 14,              // star = 1 damage, special = 3
  SPECIAL_DMG: 3,
  JET_ENABLED: false,       // water (jetski) boss switched off for now
  JET_SIZE: 1.05,           // water boss (jetski) height vs Mikey's
  JET_X: [0.66, 0.80],      // water boss rides here (screen fraction)
  FLAT_ZONE: 0.5,           // rider above this screen fraction -> boss swoops to his height and fires FLAT; rider stars fly flat, no homing
  SWOOP_RATE: 5,            // 1/s: how fast the boss slides to the firing lane
};

// ===================== the run: lives, score, endings (new for the shipped game) =====================
export const RUN = {
  LIVES: 3,                 // shells; every obstacle or ooze-ball hit costs one, the last one ends the run
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

// ===================== board input (lateral axis only) =====================
// The hold is |__gbSensor.x| past PRESS, released below RELEASE (hysteresis).
// Thresholds follow the player's sensitivity with the SAME mapping the host
// uses for its own synthetic keys (WebGameController.ApplySensitivity):
// press = lerp(0.60, 0.15, pct/100), release = press * 0.6. The host does NOT
// scale __gbSensor itself, so with forwardSteeringKeys off this is the only
// place the setting takes effect.
export const INPUT = {
  PRESS_AT_MIN: 0.60,       // press threshold at sensitivity 0
  PRESS_AT_MAX: 0.15,       // press threshold at sensitivity 100
  RELEASE_RATIO: 0.6,       // release = press x this
  HOLD_CODES: ['Space', 'ArrowUp', 'KeyW'],
};

// the jump peak's rider-body height, used by the boss hover
export const SPRITE_H_1080 = 205;   // Mikey's on-screen height at 1080p
