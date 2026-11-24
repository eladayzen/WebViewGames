// Every tuning number in one place. World units are METRES; x runs to the
// right (the run direction), y is up, z is toward the camera.

export const PLAYER = {
  H: 1.75,          // the turtle's height
  W: 0.7,           // collision width
  G: 36,            // gravity, m/s^2
  JUMP_V: 18,       // take-off speed -> apex 4.5 m, air time 1.0 s on the flat: big jumps, tall platforms
  AIR_JUMPS: 1,     // extra jumps in mid-air (double jump)
  AIR_JUMP_V: 16,   // the second jump's take-off speed
  BUFFER_S: 0.14,   // a tap just before landing still jumps
  COYOTE_S: 0.08,   // ... and one just after running off an edge
  FALL_OUT: 6,      // metres below the roof line = fell between buildings
};

export const SPEED = {
  START: 8.5,       // m/s
  MAX: 13,
  RAMP_S: 150,      // seconds from START to MAX
  EASE: 3,          // how fast actual speed follows the target
};

export const GEN = {
  ROOF_LEN: [12, 30],        // a building's roof length, m
  GAP_AIR: [0.30, 0.55],     // a gap is this fraction of a full jump's length
  STEP: [-2.6, 2.2],         // roof height change between buildings, m
  Y_RANGE: [-5, 5],          // roof heights stay inside this band
  FOOT_GAP_S: 1.45,          // seconds of running between two hazards, min (a jump is 1.0 s of air)
  FOOT_CHANCE: 0.8,          // a roof long enough gets a Foot soldier this often
  PIZZA_ARC: 0.5,            // chance a gap has a pizza arc over it
};

// Hazards (metres). Each needs a specific move, so left/right both matter:
//   barrier  (crate)        -> JUMP only (a roll or a run into it hurts)
//   overhead (hanging sign) -> ROLL only (too low to run under, too high to jump)
//   shield   (shielded ninja)-> ROLL only (a stomp or a run-in hurts)
//   foe                     -> roll through him, or land on him
export const HAZARD = {
  BARRIER_W: 0.95, BARRIER_H: 1.0,
  OVER_W: 1.2, OVER_LOW: 0.95, OVER_TOP: 3.0,
  LIFT_AMP: 0.5, LIFT_PERIOD: 3.4,
  // HOVER PADS: floating platforms stacked above the roofs -- an optional upper
  // road. Land from above, jump up through from below. Miss one and you drop
  // back onto the roof, so the upper road never costs a life.
  PAD_RISE: 3.0,          // a pad sits this far above the surface it is reached from
  PAD_LEN: [5, 8],
  PAD_DROP_CLEAR: 10,     // metres of hazard-free roof where he lands after walking off the last pad
  // distance (m) from the start where each kind first appears, so a new one turns up every ~15 s
  UNLOCK: { barrier: 70, overhead: 170, shield: 300, stairs: 120, chain: 150, lift: 220, gauntlet: 330, pads: 90, skyway: 200 },
  HEART_EVERY: [170, 290],     // metres between hearts; they only ever sit on the HIGHEST pads
};

// A pickup counts if he is within this of its centre. The vertical radius is
// small on purpose: a pizza hanging at jump height must be jumped for.
export const PICKUP = { RX: 0.9, RY: 0.7 };

export const ENEMY = { W: 0.9, H: 1.45, DRAW_H: 1.65 };

export const CAMERA = {
  FOV: 28,                   // narrow lens: flat, side-on, still real depth
  DIST: { in: 18, mid: 27, out: 38 },      // dolly distances (Elad: "much more pulled out")
  DOLLY_EASE: 1.2,           // how fast the dolly moves (per second)
  LEAD_X: 3.2,               // look ahead of the turtle
  ROOF_FRAME: 0.16,          // screen centre this x dist above the roof -> roof in the lower third
  LOOK_DOWN: 0.10,           // camera this x dist above its aim point: a slight look down
  FOLLOW_Y: 3,
};

export const RUN = {
  LIVES: 5,
  COUNTDOWN_S: 3,
  RESULT_SECONDS: 8,
  SKIP_GUARD_S: 1.0,
  INVULN_S: 1.6,
  PAD_GRACE_S: 0.9,  // walking off a hover pad is a miss, not a mistake worth a life: brief grace while he drops
  RESPAWN_FREEZE_S: 0.6,
  SCORE_PER_M: 1,
  PIZZA: 25,
  KO: 100,
  HEART: 50,         // a heart at full lives is worth this instead
};

export const INPUT = {
  PRESS_AT_MIN: 0.60,  // board lean that counts as a tap, at sensitivity 0
  PRESS_AT_MAX: 0.15,  // ... and at sensitivity 100
  RELEASE_RATIO: 0.6,  // back under press x this re-arms the next tap
  COOLDOWN_MS: 200,
  OFF_BALANCE_S: 0.45, // held off-centre longer than this = off balance
  // lean LEFT or RIGHT = jump; again in the air = double jump; HOLD it and he jumps again on every landing
  JUMP_CODES: ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'],   // left = right = jump
};
