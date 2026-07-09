export const LANE_WIDTH = 3.2;
export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH];
export const PLAYER_Z = 0;

export const BASE_SPEED = 26; // m/s
export const MAX_SPEED = 64; // m/s
export const SPEED_RAMP_TIME = 90; // seconds to reach max speed

export const LANE_RESPONSE = 9; // exponential lane-follow rate (runner controller)
export const BANK_FACTOR = 0.16;
export const BANK_MAX = 0.35;

// Soft/continuous controller: hold left/right to drift toward the edge,
// release to hold position. No lanes -- position is a free continuous value.
export const SOFT_STEER_SPEED = 6.5; // units/s while held
export const SOFT_STEER_BOUND = LANE_WIDTH * 1.5; // matches outer lane edge

export const STARTING_LIVES = 3;
export const INVINCIBILITY_TIME = 1.2; // seconds of no-collision + blink after a hit

export const DESPAWN_Z = 12; // behind camera, safe to recycle
export const SPAWN_Z = -140; // where new objects appear (inside fog, later)

export const BASE_SPAWN_GAP = 72; // meters of travel between pattern spawns
export const MIN_SPAWN_GAP = 40;
export const SPAWN_GAP_RAMP_TIME = 90; // seconds to reach MIN_SPAWN_GAP

export const TRAFFIC_COLLISION_Z = 2.4;
export const TRAFFIC_COLLISION_X = 1.5;
export const TRAFFIC_NEAR_MISS_X = 2.7;
export const COIN_PICKUP_Z = 1.6;
export const COIN_PICKUP_X = 1.0;
