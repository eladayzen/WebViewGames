// Central tuning file (build doc §9.3, §12: exact numbers are left to
// stage 4 to tune within directional guidance -- edit here, Vite hot-reloads).
//
// POC scope only (pipeline/build-docs/HalfShellHustle.md §2, §10): no CHASE
// meter, no difficulty ramp, no blocks -- forward speed and spawn pacing are
// therefore plain constants, not per-block/ramping values.

// --- Lanes (§5.1, §9.1 -- reusing CarRacer/src/constants.js's LANE_WIDTH
// pattern as the proven flat-3-lane-street building block) ---
export const LANE_WIDTH = 3.2;
export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH];
export const CENTER_LANE = 1;
export const PLAYER_Z = 0;

// --- Forward speed (§5.1: never player-controlled; §11: overall pace stays
// deliberately slower than the native genre's tempo, at every tier -- this
// is a fixed constant since POC has no difficulty ramp, §2) ---
// Bumped from the original 9 per direct playtest feedback -- obstacles/
// street needed to read as much faster.
export const FORWARD_SPEED = 16; // world units/sec

// --- Player lane easing + jump arc (§5.2) ---
export const LANE_RESPONSE = 10; // exponential lane-follow rate
// Jump is back per direct feedback -- and load-bearing: clearing entities/
// platform.js's kill-barrier type depends on being airborne at contact, and
// entities/obstacles.js's 'low' type depends on being HIGH ENOUGH at
// contact (see data/obstacleTypes.js). Reshaped from one symmetric sine arc
// into 3 phases -- eased rise, flat hold at JUMP_HEIGHT, eased fall (direct
// feedback: "I will stay a little bit more near the maximum point before I
// start falling down") -- so there's a real hover window, not just a
// momentary peak. Total airtime nudged up too ("a bit longer").
export const JUMP_RISE_DURATION = 0.28; // seconds, ground -> peak
export const JUMP_HOLD_DURATION = 0.22; // seconds, flat at JUMP_HEIGHT -- the hover
export const JUMP_FALL_DURATION = 0.28; // seconds, peak -> ground
// Raised from 2.0 per direct feedback, specifically so a jump can now also
// clear data/obstacleTypes.js's 'medium' (the original barricade, ~2.4
// tall) -- see that file's jumpClearHeight for the margin math. Does NOT
// let a jump grant platform elevation via a mid-air lane-switch:
// isPlatformLaneBlocked (entities/platform.js) is only ever compared
// against player.elevationY, never player.airHeight -- the two are fully
// decoupled by construction, so this number has zero effect on that check
// no matter how high it goes.
export const JUMP_HEIGHT = 2.4;

// --- Obstacle spawn/scroll/recycle (§5.3, §9.3 -- reusing CarRacer/src/
// traffic.js's pool/spawn/recycle pattern) ---
// Lane-blocking obstacles only -- no obstacle ever spans all 3 lanes.
export const SPAWN_Z = -140; // where new obstacles appear
export const DESPAWN_Z = 12; // behind camera, safe to recycle
export const FIRST_SPAWN_DELAY_SEC = 3; // grace period to read the scene before the first obstacle
// Main obstacle-density/difficulty knob (both entities/obstacles.js types,
// medium AND low, spawn off this one timer -- data/obstacleTypes.js's
// LOW_OBSTACLE_SPAWN_CHANCE only controls the MIX between them, not the
// overall rate). Direct feedback: "much more" -- dropped from the original
// 3.4 to a real density increase. Still subject to
// MIN_ENEMY_OBSTACLE_GAP_SEC below, so the effective average interval is a
// bit higher than this in practice.
export const SPAWN_INTERVAL_SEC = 1.6;

// --- Foot Soldier enemy spawn (entities/enemy.js) -- a new "bump-to-kill"
// entity type, not in the original build doc. Own pace/offset from the
// obstacle spawner so the two don't always land in the same window during
// this first-pass tuning.
export const ENEMY_FIRST_SPAWN_DELAY_SEC = 4.5;
// TEMPORARY demo density bump (direct feedback: "just for demonstration,
// add twice as much enemies") -- normal value is 2.8. Dialed back 30% from
// the demo's 1.4 (direct feedback: fun, but a bit too much) to 2.0. Still
// denser than the 2.8 baseline on purpose; revert to 2.8 once the demo pass
// is done, this is not a locked-in balance call either way.
export const ENEMY_SPAWN_INTERVAL_SEC = 2.0;

// --- Collision (§5.3, §9.3: lane-index + z-distance overlap, no physics) ---
export const OBSTACLE_COLLISION_HALF_Z = 1.5;

// --- Enemy/obstacle minimum spacing (locked-in gameplay rule, direct
// feedback): the GoBalance lean-board controller reacts slower than a
// phone swipe, so an enemy spawned too close to an obstacle baits the
// player into approaching (enemies are safe/rewarding) right as an
// obstacle arrives with no time left to lane-change away from it. Both
// obstacles and enemies spawn at the same fixed SPAWN_Z and scroll at the
// same FORWARD_SPEED, so their world-space gap is fixed at spawn time and
// never changes afterward -- enforcing this at spawn time (core/main.js)
// fully guarantees it for the entity's whole lifetime, not just near the
// player. Time-based (not distance-based) since spawn timing is what's
// actually compared.
export const MIN_ENEMY_OBSTACLE_GAP_SEC = 1.5; // -> 24 world units at FORWARD_SPEED=16

// --- Camera follow rig (§5.1, §9.1 -- reusing CarRacer/src/camera-rig.js's
// FOLLOW_LERP-style easing pattern) ---
// Tuned close/low per pipeline/build-docs/laneRunnerRef.png -- that reference
// is a "look/character/sizes" anchor (not its enemy or exact prop set): Leo
// reads big and close, low in frame, camera only mildly tilted down, not the
// distant/high vantage point this rig started with.
export const CAMERA_FOLLOW_LERP = 0.1;
export const CAMERA_OFFSET_Y = 1.9;
export const CAMERA_OFFSET_Z = 4.6;
export const CAMERA_LOOKAHEAD_Z = -10;
// Raised from 1.6 per direct feedback -- pushes the player (and the shrunk
// PLAYER_SCALE in entities/player.js already helps here too) further down
// in frame, opening up the view of the lanes ahead of him.
export const CAMERA_LOOKAHEAD_Y = 1.85;
export const CAMERA_FOV = 58;

// --- Stage aspect (locked 16:9 letterbox, matching this repo's other
// GoBalance games) ---
export const ASPECT_W = 16;
export const ASPECT_H = 9;
