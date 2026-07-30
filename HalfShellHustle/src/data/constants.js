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

// --- Forward speed (§5.1: never player-controlled) ---
// No longer a constant: direct feedback turned the old fixed 16 into a RAMP.
// The previously-shipped 16 became the ceiling minus 10% (SPEED_MAX), and a
// run now starts 30% below that ceiling and climbs, to ease a new player in.
// systems/speed.js owns the curve; core/main.js reads one speed per frame and
// hands the same value to every pool.
//
// NOTE the ramp changes reaction time, NOT encounter density: spawn intervals
// are in seconds (systems/spawner.js), so the number of hazards per second is
// identical at every point on the ramp -- only the window to react to each
// one tightens (~0.30s -> ~0.21s). And since SPEED_MAX is below the old 16,
// the game is permanently ~10% gentler past the ramp than it used to be.
export const SPEED_MAX = 14.4; // world units/sec -- the old shipped 16, minus 10%
export const SPEED_START = 10.08; // 30% below SPEED_MAX
export const SPEED_RAMP_DURATION_SEC = 45; // seconds from SPEED_START to SPEED_MAX

// --- Lives (systems/lives.js) ---
// Direct feedback: an obstacle costs a life instead of ending the run.
export const LIVES_START = 3;
// Ceiling a health PICKUP may top you up to. Same as LIVES_START for now --
// pickups restore, they don't extend.
export const LIVES_SOFTCAP = 3;
// Hard ceiling the system and HUD are built to handle, for a future
// "extra heart" upgrade. NOT the tray size -- ui/hud.js builds the tray from
// the live cap, because rendering 5 slots while holding 3 lives would show
// two pre-greyed hearts and read as "you already lost two."
export const LIVES_MAX_SUPPORTED = 5;
// Grace window after a hit. See systems/lives.js for why this is required for
// correctness (a single obstacle would otherwise drain every life in one
// pass) and why 1.2s stays safe at every point on the speed ramp.
export const HIT_INVULNERABILITY_SEC = 1.2;

// --- Timed magnet ability (entities/player.js, entities/coins.js) ---
// SCAFFOLDING ONLY: the ability works, but nothing grants it yet -- there is
// no magnet pickup entity. Press M to test (core/main.js debug key).
export const MAGNET_DURATION_SEC = 7;
// How far ahead in z a coin starts being pulled. In world units, so it
// self-scales agreeably with the speed ramp: at a slower speed a coin spends
// longer inside this range, giving the pull more time to work.
export const MAGNET_RANGE_Z = 26;
// Pull strength 0..1 at which a coin is treated as collectible regardless of
// lane and reach -- see entities/coins.js's collectCoins.
export const MAGNET_COLLECT_PULL_THRESHOLD = 0.45;
// How fast a coin's pull eases toward its target strength (1/sec). Eased
// rather than snapped so gaining or losing the buff mid-flight doesn't
// teleport coins sideways.
export const MAGNET_EASE_RATE = 6;

// --- Player lane easing + jump arc (§5.2) ---
export const LANE_RESPONSE = 10; // exponential lane-follow rate

// --- Board steering modes (input/input.js, tuned live via ui/steeringPanel.js) ---
// Two ways to read the balance board, switchable at runtime so they can be
// A/B'd on the actual hardware:
//
//   'stepped'  -- the SDK's own digital mode. Unity converts tilt into
//                 synthetic ArrowLeft/Right presses and each press is ONE lane
//                 step. Tilt is a GESTURE: to cross two lanes you tilt, return,
//                 and tilt again. Needs forwardSteeringKeys = true on the scene.
//
//   'absolute' -- direct feedback's idea, and a much better fit for a 3-lane
//                 game: the board's tilt range is split into three zones that
//                 map ONE-TO-ONE onto the three lanes, so where you physically
//                 stand IS your lane. Standing left targets lane 0 from
//                 anywhere -- including crossing two lanes at once. Reads the
//                 raw analog value (window.__gbSensor) instead of keys, so it
//                 needs forwardSteeringKeys = FALSE on the scene.
//
// Default is 'stepped' deliberately: it works with the scene exactly as
// shipped, so nothing regresses if the Inspector flag is never flipped.
export const STEERING_STEPPED = 'stepped';
export const STEERING_ABSOLUTE = 'absolute';
export const STEERING_MODES = [STEERING_STEPPED, STEERING_ABSOLUTE];
export const DEFAULT_STEERING_MODE = STEERING_STEPPED;

// Zone edge: |tilt.x| past this leaves the centre lane's zone. 0.35 matches the
// SDK's own pressThreshold, so 'absolute' starts out as responsive as
// 'stepped' was.
export const LANE_ZONE_THRESHOLD = 0.35;
// Hysteresis on that edge -- you must come back this much INSIDE the boundary
// before the zone flips back, which is what stops a lean parked right on a
// threshold from flapping between two lanes. Same purpose as the SDK's
// press/release gap (0.35/0.20, i.e. a 0.15 gap).
export const LANE_ZONE_HYSTERESIS = 0.12;

// Jump, in 'absolute' mode only. Board-jump normally arrives as a synthetic
// ArrowUp, but forwardVerticalAxis is nested INSIDE forwardSteeringKeys in
// WebGameController -- so the moment a scene goes analog for absolute
// steering, ArrowUp stops being dispatched entirely and the game has to read
// tilt.y itself. Higher than the lane threshold on purpose: forward/back is
// the ergonomically harder axis on this board, so it wants a deliberate lean,
// and a low threshold would fire jumps from the postural noise of a
// left/right weight shift.
export const JUMP_TILT_THRESHOLD = 0.45;
export const JUMP_TILT_HYSTERESIS = 0.15;

// --- Blocked-lane nudge (entities/player.js's triggerBlockedNudge) ---
// Direct feedback: when a lane change is REFUSED because a platform/ramp is
// in the way, the input currently vanishes silently and reads as the game
// missing the press. A small lurch that direction, springing straight back,
// acknowledges the input while still clearly denying the move.
//
// Deliberately NOT applied when there's simply no lane to move into (already
// in the outermost lane) -- that's a boundary the player can see, so it needs
// no explanation; only a BLOCKED move is ambiguous.
export const BLOCKED_NUDGE_DISTANCE = 0.34; // world units, ~10% of LANE_WIDTH -- a lurch, not a step
export const BLOCKED_NUDGE_DECAY = 13; // 1/sec, exponential spring back (mostly home in ~0.2s)
export const BLOCKED_NUDGE_LEAN = 0.5; // radians of body tilt per world unit of lurch
// Jump is back per direct feedback -- and load-bearing: clearing entities/
// platform.js's kill-barrier type depends on being airborne at contact, and
// entities/obstacles.js's 'low' type depends on being HIGH ENOUGH at
// contact (see data/obstacleTypes.js). Reshaped from one symmetric sine arc
// into 3 phases -- eased rise, flat hold at JUMP_HEIGHT, eased fall (direct
// feedback: "I will stay a little bit more near the maximum point before I
// start falling down") -- so there's a real hover window, not just a
// momentary peak. Total airtime nudged up too ("a bit longer").
export const JUMP_RISE_DURATION = 0.28; // seconds, ground -> peak
// Direct feedback: cut the hold in half (0.253 -> 0.1265) and hand every
// bit of it to the fall (0.28 -> 0.4065) -- total airtime (RISE+HOLD+FALL)
// stays exactly the same, this only shifts the balance from "hanging at
// the top" to "the accelerating decline itself" (see entities/player.js's
// jumpArcHeight, now an ease-in cubic fall -- more time in that phase
// makes the accelerating character read more clearly).
export const JUMP_HOLD_DURATION = 0.1265; // seconds, flat at JUMP_HEIGHT -- the hover
export const JUMP_FALL_DURATION = 0.4065; // seconds, peak -> ground
// Raised from 2.0 per direct feedback, specifically so a jump can now also
// clear data/obstacleTypes.js's 'medium' (the original barricade, ~2.4
// tall) -- see that file's jumpClearHeight for the margin math. Does NOT
// let a jump grant platform elevation via a mid-air lane-switch:
// isPlatformLaneBlocked (entities/platform.js) is only ever compared
// against player.elevationY, never player.airHeight -- the two are fully
// decoupled by construction, so this number has zero effect on that check
// no matter how high it goes.
export const JUMP_HEIGHT = 2.4;
// Grace margin (world units) on top of a jumpable obstacle's own
// jumpClearHeight -- direct feedback: a jump that "technically" barely
// touched an obstacle, especially coming down out of the fall phase,
// should still be forgiven rather than counted as a hit. Added directly to
// player.airHeight at the clearance check (entities/collision.js), not a
// separate timing/hysteresis system -- simplest version of "some value for
// how forgiving this is," tune this one number to adjust it.
export const JUMP_CLEAR_GRACE_HEIGHT = 0.3;

// --- Obstacle spawn/scroll/recycle (§5.3, §9.3 -- reusing CarRacer/src/
// traffic.js's pool/spawn/recycle pattern) ---
// Lane-blocking obstacles only -- no obstacle ever spans all 3 lanes.
// Spawn/despawn geometry -- shared by every spawner (obstacles, enemies,
// platforms). Pacing/frequency knobs (how often, how soon) all live in
// data/spawnConfig.js now, not here.
export const SPAWN_Z = -140; // where new obstacles appear
export const DESPAWN_Z = 12; // behind camera, safe to recycle

// --- Collision (§5.3, §9.3: lane-index + z-distance overlap, no physics) ---
export const OBSTACLE_COLLISION_HALF_Z = 1.5;

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
