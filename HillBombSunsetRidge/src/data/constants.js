// Tuning constants for the render lab. Numbers here are directional, from the
// build doc's §5.1 speed model -- they exist so the harness feels like the real
// game while the rider layer is being compared, NOT as final tuning. Every one
// of these is explicitly an on-device decision later (build doc §12).

// --- speed model (build doc §5.1) ---
// accel = GRADE_ACCEL - DRAG*v^2 - CARVE_SCRUB*|carve|*v
export const GRADE_ACCEL = 9.0; // gravity down the grade, world units/s^2
// Aero drag. Terminal speed = sqrt(GRADE_ACCEL/DRAG) ~= 31 u/s (~80 km/h),
// deliberately in the same ballpark as the reference build's 56 km/h opening
// district. An earlier 0.0016 gave ~75 u/s (~195 km/h), which was an unreadable
// blur -- the rider has to be legible for this harness to be worth anything.
export const DRAG = 0.0095;
export const CARVE_SCRUB = 0.85; // the brake -- a hard carve bleeds speed fast
export const TUCK_BONUS = 2.4; // small extra accel while holding a straight line
export const TUCK_DWELL = 0.35; // seconds of near-neutral before the tuck engages
export const START_SPEED = 11;

// --- lateral motion (build doc §5.1) ---
export const LATERAL_SPEED = 9.5; // world units/s of sideways travel at full carve
export const TURN_LOSS = 0.42; // turn authority lost at SPEED_REF (0..1)
export const SPEED_REF = 30;
export const ROAD_HALF_WIDTH = 5.5; // |u| clamp -- the ridable width

// --- input (build doc §4) ---
export const DEADZONE = 0.08; // "board sitting level" must be comfortably reachable
export const POP_PRESS = 0.30; // deliberately MORE forgiving than the SDK's 0.35
export const POP_RELEASE = 0.16; // ...and 0.20, because back-lean is the hard axis

// --- trick / air ---
export const AIR_DURATION = 1.15; // seconds from launch to landing
export const AIR_HEIGHT = 4.2;

// --- camera: FORTNITE-STYLE STEADY THIRD-PERSON ---
// Per Amit's direct direction, this REPLACES the build doc's §5.2 orbiting
// "trick swing" camera. No orbit, no roll, no FOV pumping -- a stable
// over-the-shoulder rig that stays put. See camera/cameraRig.js's header.
export const CAM_BACK = 4.1; // follow distance behind the rider
export const CAM_HEIGHT = 1.85;
export const CAM_SHOULDER = 0.85; // over-the-shoulder lateral offset (the Fortnite tell)
export const CAM_LOOK_AHEAD = 11.0; // how far down-road the camera aims
export const CAM_LOOK_HEIGHT = 1.35;
export const CAM_LERP = 6.0; // base follow easing (per second)
export const CAM_LAG_AT_FULL_CARVE = 0.35; // eases slower at full carve so the
// rider leads the frame through a turn -- without the camera leaving its rig.
export const FOV_BASE = 58;
export const FOV_AT_SPEED = 66; // only a slight breathe with speed, not a pump
export const CAM_PULLBACK = 1.2; // modest extra distance at top speed

// --- world look (placeholder, deliberately flat) ---
// NOTE: real illustrated Kolbo textures are a hard requirement for the actual
// game (build doc §0's environment-art correction). This harness is explicitly
// the "very basic environment" case -- flat colors here are a stand-in so the
// comparison isolates the RIDER layer, and must not be taken as the art plan.
export const SKY_TOP = 0xffc978;
export const SKY_BOTTOM = 0xffe9c4;
export const FOG_COLOR = 0xffd9a4;
export const FOG_NEAR = 90;
export const FOG_FAR = 340;
export const ROAD_COLOR = 0x6f6257;
export const LINE_COLOR = 0xf2c14a;
export const SHOULDER_COLOR = 0x9c8f6a;
export const RAIL_COLOR = 0xbfb4a4;

// --- road geometry ---
export const SEG_LEN = 4; // world units per road segment
export const SEGMENTS_AHEAD = 90;
export const SEGMENTS_BEHIND = 8;
export const GRADE = 0.055; // vertical drop per unit travelled
