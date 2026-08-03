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
// Residual tyre scrub only. On the flat road this was THE brake (0.85), but in
// the trough the cost of turning is paid physically -- carving climbs the wall,
// and the climb takes the speed. Keeping both double-counted it: a 3.3-unit
// climb cost 20 u/s when the energy exchange only justified 0.7. The geometry
// is the brake now.
export const CARVE_SCRUB = 0.10;
export const TUCK_BONUS = 2.4; // small extra accel while holding a straight line
export const TUCK_DWELL = 0.35; // seconds of near-neutral before the tuck engages
export const START_SPEED = 11;

// --- lateral motion (build doc §5.1) ---
export const LATERAL_SPEED = 13.0; // world units/s of sideways travel at full carve

// --- carve feel: SOFT tilt response ---
// Two independent softeners, because raw analog tilt straight off the board is
// twitchy and every small wobble of the rider's stance shows up as steering.
//
// CARVE_CURVE shapes the response: |carve|^curve, sign preserved. Above 1 this
// flattens the region near centre, so small unintentional tilts do almost
// nothing while a deliberate big lean still reaches full authority. This is the
// one that matters most for "soft" -- it buys forgiveness around neutral without
// capping how hard you can actually turn.
export const CARVE_CURVE = 1.8;
// CARVE_SMOOTH eases the shaped value rather than applying it instantly
// (per-second rate for an exponential approach). Takes the edge off jitter and
// makes the camera roll and speed-scrub move smoothly with it, since both read
// the same value.
export const CARVE_SMOOTH = 5.0;
export const TURN_LOSS = 0.42; // turn authority lost at SPEED_REF (0..1)
export const SPEED_REF = 30;
// --- THE TROUGH -------------------------------------------------------------
// A vast half-pipe rather than a road. Radius is huge on purpose: Amit asked for
// a "very very very wide" channel, and a big radius also makes the pendulum slow
// and weighty rather than twitchy.
export const TROUGH_RADIUS = 26.0;
// How far up the wall is ridable, in radians from the floor. 1.15 rad ~= 66deg,
// which is a deep transition -- steep enough that the top of the wall feels like
// a real commitment.
export const THETA_MAX = 1.15;

// Pendulum: theta accelerates back toward the floor under gravity, and the
// carve input is a torque driving it up the wall.
//   thetaAcc = carve*THETA_CARVE_TORQUE - (THETA_GRAVITY/R)*sin(theta)
//              - THETA_DAMP*thetaVel
// Neutral input therefore settles you in the trough floor -- which preserves the
// existing design where the RESTFUL posture is the fast one.
export const THETA_GRAVITY = 34.0;
// Full carve must be able to drive you near the lip against gravity:
// equilibrium is sin(theta) = TORQUE*R/GRAVITY, so 1.7 reaches theta ~ 1.0 of
// the 1.15 available.
export const THETA_CARVE_TORQUE = 1.7;
export const THETA_DAMP = 0.9; // livelier, so pumping is possible

// Height/speed exchange. Climbing the wall raises you by R*(1-cos(theta)) and
// that energy comes out of your speed; dropping back gives it back:
//   v^2 -= 2 * HEIGHT_EXCHANGE * dh
// This is THE answer to the wall-surfing problem -- sitting high on a wall is
// continuously uphill, so it bleeds the speed that scores. The fast line is the
// floor, which is where all the content sits.
// Sized so a full climb to the lip (15.4 units at R=26) costs roughly a third
// of top speed, and dropping back returns it -- expensive enough that parking on
// the wall is a real sacrifice, cheap enough that using the walls stays fun.
export const HEIGHT_EXCHANGE = 18.0;

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
export const SKY_TOP = 0xc3b2dc;
export const SKY_BOTTOM = 0xf7d3bf;
export const FOG_COLOR = 0xecd9dd;
export const FOG_NEAR = 90;
export const FOG_FAR = 340;
export const TROUGH_COLOR = 0xdfcbaa; // warm sand wall (concept-02) // pale lilac concrete, pastel-sky palette
export const TROUGH_FLOOR_COLOR = 0xfffaf0; // near-white dashed centre line // brighter stripe marking the fast line
export const LIP_COLOR = 0x6f7a83; // DARK slate coping -- a value break against the pale wall // glowing coping at the top of the wall
export const ROAD_COLOR = 0x6f6257;
export const LINE_COLOR = 0xf2c14a;
export const SHOULDER_COLOR = 0x9c8f6a;
// Ground either side of the road. Must read as LAND, not sky: the first pass
// used a pale sand (0xd8b98a) that was within a few percent of FOG_COLOR, so
// wherever the road curved away the terrain beside it looked like empty sky and
// the road appeared to be missing half its width. A dry sage green separates it
// from both the warm sky and the road's dark brown.
// Placeholder sky until the phase-3 matte painting. Pastel, per the chosen
// dreamlike sky-city direction -- the previous sage green read as GRASS above
// the lips, which made the trough look like a ditch in a field.
export const TERRAIN_COLOR = 0xefdce0;
export const RAIL_COLOR = 0xbfb4a4;

// --- funnels: the trough pinching to a throat and flaring open again ---
// The set-piece from concept-01, and the cheapest possible proof that connected
// structure is GEOMETRY, not painting: it is radiusAt(s) returning a smaller
// number. A tighter throat also accelerates you, since height = R*(1-cos theta)
// shrinks with R and the energy exchange hands that back as speed.
export const FUNNEL_SPACING = 760; // world units between funnel throats
export const FUNNEL_WIDTH = 0.30; // fraction of the cycle spent pinched
export const FUNNEL_TIGHTNESS = 0.46; // throat radius as a fraction of full

// --- trough roll (the corkscrew hook) ---
// A gentle roll is on by default so the frame maths is exercised and visible;
// the dramatic corkscrews are authored per-section in phase 4.
export const TROUGH_ROLL_AMOUNT = 0.22; // radians
export const TROUGH_ROLL_WAVELENGTH = 190; // world units per half-cycle

// --- trough geometry ---
export const SEG_LEN = 4; // world units per road segment
export const SEGMENTS_AHEAD = 90;
export const SEGMENTS_BEHIND = 8;
export const GRADE = 0.055; // vertical drop per unit travelled

// Longitudinal guide stripes down the trough walls. Without them the surface is
// a featureless field: you cannot see the curvature, and you cannot perceive
// speed at all -- which makes the "does carving up the wall feel good" gate
// impossible to judge. Cheap to add, and they double as the painted guide lines
// the real texture will carry.
// Guide stripes up the walls. concept-02 keeps the walls fairly clean and puts
// the graphic interest in a dashed CENTRE line down the floor, so these are
// pulled back to two faint lines and the centre line does the speed-reading.
export const GUIDE_THETAS = [0.62, 0.98];
export const GUIDE_COLOR = 0xfdf8ee; // road markings, near-white
