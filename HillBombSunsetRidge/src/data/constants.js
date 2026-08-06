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
// REGULAR jump (ollie / grind-exit / most ramp launches). Amit: the old 4.2
// peak height "feels insane, just too much" -- cut hard, and duration follows
// it down too (roughly sqrt of the height ratio) so a shorter hop doesn't end
// up floaty/moonwalking at the old hang time.
export const AIR_DURATION = 0.62; // seconds from launch to landing
export const AIR_HEIGHT = 1.2;

// --- EARNED AIR ------------------------------------------------------------
// Jump height is DERIVED from what the rider actually did, not from which
// trick got rolled. Amit: "the height of the jump needs to be calculated based
// on the action movement of the boy, and if it hits a minimum threshold then
// enable doing a backflip."
//
//   height = AIR_HEIGHT_BASE * power^2 * speedFactor
//
// power is the launcher's own strength (ollie 0.72, kicker 1.0, bank 1.2, big
// kicker 1.5) and it's SQUARED so the ramps spread out properly instead of
// bunching -- linear left every launcher within a whisker of every other, which
// makes a height threshold meaningless as a gate.
export const AIR_HEIGHT_BASE = 1.6;
// Speed's contribution, as a fraction of SPEED_REF. Never drops to zero: even a
// crawling rider gets some pop off a ramp, they just can't reach a flip.
export const AIR_SPEED_FLOOR = 0.45;
export const AIR_SPEED_GAIN = 0.55;

// The bar a jump must clear to permit a backflip. Sized against the spread the
// formula actually produces at full speed:
//   ollie 0.83 | kicker 1.60 | bank 2.30 | big kicker 3.60
// so 2.2 means a bank or a big kicker earns a flip and an ollie or plain kicker
// never can -- and slowing down takes even the big ramps below it. Speed and
// ramp choice both matter, which is the point.
export const BACKFLIP_MIN_HEIGHT = 2.2;

// SPIN vs BACKFLIP -- decided by how hard you were moving SIDEWAYS at takeoff.
// Amit: "if my velocity going from side to side is too strong... it won't be a
// backflip, it would be a spin."
//
// Which is also just physics read back to the player: a rider carrying real
// lateral momentum into a launch has angular momentum about the vertical axis,
// so they rotate flat rather than end-over-end. It gives the trick choice a
// cause the player controls, instead of a dice roll.
//
// MEASURED distribution of lateral speed (|thetaVel| * radiusAt(s), world units
// per second across the trough) so the threshold means something:
//
//     hands off, riding neutral    0.0 at every percentile -- the pendulum
//                                  settles in the floor and simply stays there
//     actively carving   p50 10.08   p90 20.27   p99 25.35   max 26.11
//
// The first pass used 9.0, from a cruder probe that assumed a fixed 26 radius
// and topped out at 13. That was wrong twice over: radiusAt(s) varies along the
// trough so the real ceiling is double that, and 9.0 turned out to sit BELOW
// the median of active carving -- 54.7% of carving frames cleared it, which
// would have made the spin the common case rather than the exceptional one.
//
// 15.0 sits between p50 and p90: comfortably above an ordinary committed lean,
// reached only when genuinely crossing the trough at pace. Ordinary riding
// never comes close, since neutral is a flat zero.
export const SPIN_LATERAL_MIN = 15.0;

// The spin gets the SAME earned height and cap as the backflip -- it replaces
// that jump rather than being a different one, and having the same ramp produce
// wildly different hang time depending on your drift would read as a bug. Its
// air time is only a little longer: a flat yaw rotation reads quicker than an
// end-over-end flip at equal duration, so it needs a touch more to land as
// clearly as the backflip does at 0.55.
export const AIR_DURATION_SPIN = 0.62;
// BACKFLIP: a SNAPPY up-and-down, "like half a second of a jump" (Amit,
// after seeing the 1.5s version). Since the rotation is locked 1:1 to air time,
// halving the duration is exactly what makes the flip itself whip round faster
// -- there's no separate rotation-speed knob to touch, and there shouldn't be:
// that decoupling is what made an earlier pass finish the flip before landing.
//
// Height is no longer a fixed number for the backflip -- it's whatever the
// EARNED AIR formula above produced, which is what qualified the jump for a
// flip in the first place. AIR_HEIGHT_BACKFLIP is kept only as the ceiling, so
// an unusually hot launch can't fling the rider absurdly high.
export const AIR_HEIGHT_BACKFLIP_MAX = 4.0;
export const AIR_DURATION_BACKFLIP = 0.55;

// HOP-OVER -- the bail-out when you meet a rail or ledge at a bad angle.
//
// Amit's design note: gliding a pole only makes sense if you arrive roughly
// ALONG it. Arriving crosswise and magnetically snapping into a grind reads as
// wrong. The first attempt at this was a barrel roll, which didn't land as an
// idea -- replaced with a literal hop: clear the obstacle by a small margin
// while TUCKING THE LEGS UP (knees toward the chest, board rising with the
// feet), which is what a skater actually does to get over something.
//
// Height is deliberately small: rails/ledges are 0.52-0.62 tall, so ~1.1 clears
// them by a believable margin rather than launching.
export const AIR_HEIGHT_HOP = 1.1;
export const AIR_DURATION_HOP = 0.5;

// How hard the legs fold at the peak of a hop, in radians of added bone
// rotation (see rider.js). Applied to the Mixamo thigh/shin bones on top of
// whatever the animation is doing, peaking mid-air and unfolding by landing.
// Solved from measurement rather than guessed twice more. Apex lift (how far
// the feet rise toward the hips) turns out to go roughly as fold^2.3 -- the
// rotations compound down the leg chain -- so eyeballing it overshoots badly
// in both directions:
//   fold 1.15/1.45 -> 0.70 lift: a cannonball, feet ABOVE the hips, and since
//                     the board is pinned to the feet the deck came up to his
//                     chest.
//   fold 0.45/0.55 -> 0.08 lift: barely a twitch.
// Fitting those two points and solving for ~0.29 lift puts the feet just under
// hip height at the apex -- a real skate tuck over an obstacle.
export const HOP_HIP_FOLD = 0.78; // knees driven up toward the chest
export const HOP_KNEE_FOLD = 0.96; // heels tucked back under, board follows

// --- AIR POSE (every jump) --------------------------------------------------
// Amit: "every jump -- he brings his knees upwards a bit, and the arms are
// going down to the sides."
//
// Applies to EVERY air, not just the hop: plain pops, ramp launches, backflips
// and spins all get it, enveloped 0 -> peak at apex -> 0 so the legs are fully
// extended again for touchdown and it hands straight over to the landing
// absorb. The hop keeps its own deeper fold; the two are max'd rather than
// summed, since they're the same joints doing the same thing.
//
// MEASURED knee rise on this rig, against the hop for scale:
//     0.30/0.40 -> 0.090     0.45/0.55 -> 0.136
//     0.60/0.70 -> 0.183     0.78/0.96 -> 0.237  (the hop)
// 0.45/0.55 is "a bit" -- a little over half the hop's tuck.
export const AIR_TUCK_HIP = 0.45;
export const AIR_TUCK_KNEE = 0.55;

// Arms down. Two axes, because neither alone does it: the idle holds the lead
// arm FORWARD and the trailing arm already low and out, so the chains are not
// symmetric to begin with. Probing a grid of (x, z) and reading each hand's
// displacement in the rider's own frame, x+0.3/z-0.35 is the combination that
// takes BOTH hands down (left -0.064, right -0.022 -- the right starts low, so
// it has less to travel) while swinging them back rather than across the body.
// The z term is mirrored between the arms because the two chains are mirror
// images and a shared sign would swing them opposite ways in world space.
export const AIR_ARM_DROP = 0.35; // rotation.x, same sign both arms
export const AIR_ARM_SWING = 0.35; // rotation.z, mirrored

// How crosswise is too crosswise to grind. The rider's lateral speed is
// |thetaVel| * R (angular rate around the trough, times local radius); compare
// it to forward speed and the ratio is the tangent of the approach angle.
// 0.30 ~= 17 degrees: drifting gently onto a rail still grinds, deliberately
// carving across one flips over it instead.
export const GRIND_MAX_CROSS_RATIO = 0.30;

// --- BOARDSLIDE POSE -------------------------------------------------------
// The grind used to be pure physics: the rider held his ordinary ride pose and
// simply travelled along the rail, which read as sliding rather than as a
// trick. This is the pose that sells it, and every term is layered on top of
// the running idle clip rather than replacing it, so the body still breathes.
//
// The board turns almost side-on to the rail -- a boardslide. Not the full 90
// degrees: dead perpendicular reads as a modelled prop rotated by a right
// angle, while a few degrees short keeps the rider's line visible and looks
// ridden. 1.35 rad ~= 77 degrees.
export const GRIND_YAW = 1.35;

// Knees. Applied as FK on the same thigh/shin chain the hop tuck uses. In bone
// terms a crouch and a tuck are the SAME operation -- the hips are the root of
// the chain, so folding the legs always closes the hip-to-foot distance; what
// separates them is the compensation (a tuck lets the board rise, a crouch
// pins it and sinks the body instead).
//
// These are MEASURED against the rig's actual response, not picked by feel,
// because the two joints pull in OPPOSITE directions and an intuitive-looking
// pair does the wrong thing entirely. Sweeping (hip, knee) and reading the
// hip-to-foot closure in tilt space gave:
//
//     hip 0.0, knee 0.6  ->  -0.111   shin fold ALONE straightens the stance
//     hip 0.6, knee 0.0  ->  +0.068   thigh alone closes it, weakly
//     hip 0.34, knee 0.6 ->  -0.035   the intuitive first guess: a stretch
//     hip 0.5, knee 1.0  ->  +0.059
//     hip 0.7, knee 1.2  ->  +0.205   deep -- nearly sitting on the heels
//
// So the knee term has to be carried well past the thigh term before the pose
// closes at all. 0.60/1.10 lands ~0.13 of sink against a 0.445 rest stance:
// an athletic crouch, not a squat.
export const GRIND_HIP_BEND = 0.60;
export const GRIND_KNEE_BEND = 1.10;

// Arms out for balance. MEASURED, not guessed at Mixamo's bone axes: probing
// each local axis of the upper arms and reading the hand's displacement in the
// rider's own frame showed rotation.x is the lateral one, and -- despite the
// idle holding the two arms in quite different places (lead arm forward,
// trailing arm out) -- the SAME negative sign spreads both, 0.6 rad of it
// moving each hand ~0.15 outward and slightly up. Hence one constant, not a
// mirrored pair.
export const GRIND_ARM_SPREAD = 0.95;
export const GRIND_ELBOW_OPEN = 0.32; // straightens the arms into the spread

// Sparks live only as long as the contact does; this is the tail after the
// rider leaves the rail, so the last few embers fall away instead of vanishing
// mid-air the frame the grind ends.
export const GRIND_SPARK_RATE = 150; // particles per second while in contact

// Amit: the push clip must not play "at all while gliding + 1 second
// afterwards". The tail matters as much as the grind itself -- a kick-push
// firing the instant the rider drops off a rail reads as a stumble.
export const GRIND_PUSH_LOCKOUT = 1.0;

// Coming OFF a rail. This was an exponential ease toward zero at 1/0.22, and an
// exponential has a long tail: it took ~0.47s just to fall the first 88% of a
// half-metre rail, and well over a second to finish. Amit: "the fall from the
// glide downwards is way too long -- it should be super short."
//
// So it's an actual accelerating drop now rather than a decay curve, which is
// also closer to the original ask for "a straight-on physical fall back to the
// road". Time to ground is sqrt(2h/g): off a 0.58 rail at this g that's ~0.18s,
// and unlike the ease it genuinely ARRIVES instead of asymptoting.
export const GRIND_EXIT_FALL_G = 34.0; // world units/s^2

// A trick's rotation is now synced 1:1 to its OWN jump's air time (airT 0->1),
// finishing exactly as the rider lands, per Amit's direct correction: the
// earlier version rate-multiplied the rotation and held it once complete,
// which finished the spin visibly before touching down. "Faster" now belongs
// entirely to each trick's height/duration (AIR_*_HIGH / AIR_*_BACKFLIP above)
// -- a shorter flight over the same one full rotation reads as quicker on its
// own, without decoupling the trick from the landing.
//
// --- LANDING ABSORB --------------------------------------------------------
// Amit: "every time the character lands and touches ground, do a small bending
// down -- torso goes down, knees bend -- to sell the impact. Strongest on the
// backflip, but also on the spins, and when we end a glide, and the little jump
// to the side."
//
// This REPLACES the old TRICK_LAND_SETTLE, which was a pitch rotation on the
// whole rider group and fired only after tricks. Rotating the group tipped the
// BOARD with it, which is not what a landing looks like; and an absorb is a
// compression, not a tilt. The pose is now real bone work -- knees fold, spine
// curls -- on the same FK chain and the same board-planting compensation the
// boardslide crouch uses, so the deck stays on the ground while the body sinks.
export const LAND_SETTLE_DURATION = 0.40; // seconds, compress + recover
// ...scaled by impact, for the same saturation reason: a heavier landing can't
// go much deeper, but it can take longer to push back out of.
export const LAND_DURATION_FLOOR = 0.78;
export const LAND_DURATION_GAIN = 0.42;
// Where in that window the compression peaks. Early -- an impact is a sharp
// squash followed by a slower push back up, and a symmetric curve reads as a
// gentle bob rather than a hit. Kept SHORT for a second reason too: see the
// dead-zone note below.
export const LAND_SETTLE_PEAK = 0.16;

// The crouch pose, and the scale range it is driven over.
//
// THE POSE CANNOT SIMPLY BE SCALED FROM ZERO, and this is geometry rather than
// tuning. Sweeping the pair and measuring the hips' vertical closure gave:
//
//     scale  0.2    0.4    0.6    0.8    0.9    1.0    1.2    1.3
//     sink  -0.040 -0.058 -0.049 -0.012 +0.016 +0.051 +0.139 +0.190
//
// Everything below ~0.85 is NEGATIVE -- the rider stands UP. At small angles
// the shin's fold drops the foot faster than the hip flexion lifts it, and
// since the board is pinned to the feet, that reads as the body rising. Tried
// five different hip/knee/ankle ratios; all of them start negative, because
// the knee's contribution is first-order in the angle and the hip's is
// second-order. So a linearly-scaled crouch has a dead zone at the bottom, and
// the original LAND_AMOUNT table (0.42-0.55 for plain/hop/grind landings) sat
// squarely inside it -- measured 0.03 of sink on a grind exit versus 0.18 on a
// backflip, when it should have been roughly half.
//
// Two consequences, both deliberate:
//   1. Amount maps into the MONOTONIC part of the curve (>= ~0.95), not from
//      zero. LAND_K_FLOOR is the weakest landing's scale, LAND_K_GAIN spreads
//      the rest up to the backflip.
//   2. The envelope still has to travel from neutral, so it does cross the
//      dead zone -- but the short peak time above gets it across in ~35ms,
//      where the brief upward drift is imperceptible and, if anything, reads
//      as the legs extending to meet the ground before absorbing.
export const LAND_HIP_BEND = 0.52;
export const LAND_KNEE_BEND = 0.95;
// Solved against the LIVE response, not the offline sweep: the first pass
// (0.95/0.42, peaking at k=1.37) measured 0.397 of sink on a backflip against a
// 0.63 rest stance -- nearly sitting on the heels. Fitting the measured
// sink-vs-k slope (~0.76 per unit k) for a ~0.24 backflip and ~0.13 grind exit
// gives these, which keep every landing inside the monotonic band while landing
// at an athletic depth.
export const LAND_K_FLOOR = 0.84;
export const LAND_K_GAIN = 0.33;
// Spine curl, split down the chain. MEASURED: +rotation.x on any spine bone
// moves the head down and forward (the fold direction), strongest at the lower
// spine -- Spine -0.083Y/-0.146Z per 0.4 rad, tapering to -0.050/-0.060 by
// Spine2. Weighting it the same way curls the back instead of hinging it.
// Driven by the RAW amount, not by the leg scale -- and this is what actually
// separates a backflip landing from a spin. The leg fold SATURATES: measured
// sink was 0.249 at k=1.12 and 0.250 at k=1.17, i.e. the knee is already about
// as folded as it gets, so pushing the scale higher buys nothing and the two
// biggest tricks landed identically. The torso has plenty of range left, so the
// curl carries the difference (a full 1.0 vs 0.85 vs 0.5 vs 0.42 spread).
export const LAND_SPINE_CURL = 0.85;

// How hard each kind of landing hits, 0..1. Ordered per Amit: the backflip is
// the strongest, spins just under it, and the grind exit and hop are real but
// lighter -- they're short drops, and overselling them would make ordinary
// riding look like a series of stumbles.
export const LAND_AMOUNT_BACKFLIP = 1.0;
export const LAND_AMOUNT_SPIN = 0.85;
export const LAND_AMOUNT_GRIND = 0.55;
export const LAND_AMOUNT_HOP = 0.5;
export const LAND_AMOUNT_PLAIN = 0.42; // a bare ollie or a small ramp pop

// --- camera: FORTNITE-STYLE STEADY THIRD-PERSON ---
// Per Amit's direct direction, this REPLACES the build doc's §5.2 orbiting
// "trick swing" camera. No orbit, no roll, no FOV pumping -- a stable
// over-the-shoulder rig that stays put. See camera/cameraRig.js's header.
// --- LENS ---------------------------------------------------------------
// Amit: a longer camera length, with the character always bigger in frame --
// what the team called "more isometric feeling". That reading is right: a long
// lens is exactly what produces it. Narrowing the FOV compresses depth, so the
// trough walls and the matte painting flatten toward parallel instead of
// racing to a vanishing point, and the rider stops being distorted by
// wide-angle perspective.
//
// MEASURED before and after, since apparent size is 1/(distance x tan(fov/2))
// and moving either one alone gets it wrong:
//     before   fov 66 at speed, 5.69 away  ->  rider 32.5% of frame height,
//              108.5 degrees horizontal -- practically fisheye
//     after    fov 44 at speed, ~6.6 away  ->  rider ~45% of frame height,
//              ~82 degrees horizontal
// So the camera moves BACK and the rider still ends up much larger: that gap is
// the lens doing the work rather than the dolly.
// Pulled in for a further +20% on-screen character size. Done as DISTANCE, not
// more lens: apparent size is 1/(distance x tan(fov/2)), and narrowing the FOV
// again would drop the horizontal field below the 81.6 degrees the long-lens
// pass already traded down to, costing reaction time on wide-placed props.
// Distance is the free lever here; focal length is not.
export const CAM_BACK = 3.80; // follow distance behind the rider
// Lowered with the lens. How far below frame-centre the rider sits is set by
// the height:distance ratio -- atan(CAM_HEIGHT / follow distance) -- and a
// narrow FOV magnifies that same angle into a much larger slice of the frame.
// At 1.85 he sat at -0.47 NDC and spilled off the bottom edge once he was big
// enough to be worth looking at.
// Lowered again with the closer camera. How far below frame-centre the rider
// sits is atan(CAM_HEIGHT / distance), so pulling IN without dropping the
// camera pushes him toward the bottom edge -- at 1.42 and this distance he
// started clipping it. Dropping the height buys that margin back and costs no
// on-screen size at all, which pure pull-back would.
export const CAM_HEIGHT = 1.15;
// Over-the-shoulder lateral offset (the Fortnite tell). Scaled down with the
// lens: this is a fixed WORLD offset, so a narrower FOV turns the same 0.85
// into a much larger share of the frame -- it pushed the rider to -0.38 NDC,
// well left of centre, once the lens went long. 0.55 restores roughly the
// original on-screen offset.
export const CAM_SHOULDER = 0.55;
// Pulled in with the lens. The rider sits below centre by however far the aim
// point leads him, and a narrow FOV magnifies that same angular offset into a
// much bigger slice of the frame -- at 11.0 he sank toward the bottom edge.
export const CAM_LOOK_AHEAD = 7.0; // how far down-road the camera aims
export const CAM_LOOK_HEIGHT = 1.35;
// Follow easing. Raised from 6.0, because at 6.0 the STEADY-STATE trail is
// speed/CAM_LERP -- 5.8 units at 34.6 u/s, nearly as much again as the rig's
// own 6.3 -- so the real follow distance was 12.1 and, worse, it GREW with
// speed: the character shrank exactly when the game got fast. Amit asked for
// him to be bigger in frame *always*, which means the distance has to be set by
// the rig rather than by how far the lerp happens to be losing. At 14 the trail
// is 2.5 units and roughly constant across the speeds the game actually uses.
// Carve still adds its own lag via CAM_LAG_AT_FULL_CARVE, so the rider keeps
// leading the frame through a turn.
export const CAM_LERP = 14.0; // base follow easing (per second)
export const CAM_LAG_AT_FULL_CARVE = 0.35; // eases slower at full carve so the
// rider leads the frame through a turn -- without the camera leaving its rig.
export const FOV_BASE = 39;
export const FOV_AT_SPEED = 44; // only a slight breathe with speed, not a pump
export const CAM_PULLBACK = 0.8; // modest extra distance at top speed

// --- world look (placeholder, deliberately flat) ---
// NOTE: real illustrated Kolbo textures are a hard requirement for the actual
// game (build doc §0's environment-art correction). This harness is explicitly
// the "very basic environment" case -- flat colors here are a stand-in so the
// comparison isolates the RIDER layer, and must not be taken as the art plan.
// --- PALETTE: DUSK NEON -----------------------------------------------------
// Replaces the pastel sand-and-lilac sunset. That palette had a measured
// problem, not just a taste one -- every element sat inside a 62-point band at
// the very top of a 0..255 luminance scale, and the sky was actually DARKER
// than the playfield:
//
//                       ground  markings  sky   marks-vs-ground  sky-vs-ground
//     pastel sunset      205      248     188         43              -17
//     dusk neon (this)    46      193     129        147               83
//
// The negative number is the heart of it: backdrop and playfield merged instead
// of separating. Everything downstream suffered -- the speed lines were
// invisible until widened and darkened, additive sparks blew out to white, the
// guide stripes got lost in the sand. Flipping the playfield dark fixes all of
// them at once and gives the VFX somewhere to glow.
//
// It is also simply the right register for the audience: 8-12 year olds read
// pastel dusk as calm and pretty, which is a strange thing to feel while
// bombing a hill at 90 km/h.
//
// The ground is 0x2f2763 rather than the 0x272052 of the prototype -- lifted a
// step on purpose. The darker value tested better on a monitor but risks
// crushing on a board-mounted screen in a lit room, and the lift costs almost
// nothing in contrast while giving the eventual surface texture room to read.
export const SKY_TOP = 0x160e47; // sampled from the matte's own top band
export const SKY_BOTTOM = 0x401a5f; // ...and its bottom band
export const FOG_COLOR = 0x5b3070; // the painting's horizon band: the trough now fades INTO the sky art rather than into an invented colour
export const FOG_NEAR = 90;
export const FOG_FAR = 340;
export const TROUGH_COLOR = 0x2f2763; // deep indigo playfield -- the value flip
export const TROUGH_FLOOR_COLOR = 0x4ff0ff; // hot cyan dashed centre line
export const LIP_COLOR = 0xff3ea5; // hot magenta coping: the loudest value break in frame
export const ROAD_COLOR = 0x241d4e;
export const LINE_COLOR = 0x4ff0ff;
export const SHOULDER_COLOR = 0x4a3f8c;
// Ground either side of the road. Must read as LAND, not sky: the first pass
// used a pale sand (0xd8b98a) that was within a few percent of FOG_COLOR, so
// wherever the road curved away the terrain beside it looked like empty sky and
// the road appeared to be missing half its width. A dry sage green separates it
// from both the warm sky and the road's dark brown.
// Placeholder sky until the phase-3 matte painting. Pastel, per the chosen
// dreamlike sky-city direction -- the previous sage green read as GRASS above
// the lips, which made the trough look like a ditch in a field.
export const TERRAIN_COLOR = 0x3b2f72;
export const RAIL_COLOR = 0x5cff9e;

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
// the graphic interest in a dashed CENTRE line down the floor, so the centre
// line still does the speed-reading and these do the POSITION-reading.
//
// Two extra lines added nearer the floor, per Amit: "it really helps read and
// understand where you are on the field." The old pair sat at 0.62 and 0.98,
// which is 16.1 and 25.5 units of arc out from the centreline on a 26-unit
// radius -- so the entire inner half of the trough, which is exactly where the
// rider spends most of the run, had nothing between the centre line and the
// first stripe. Now the spacing grades outward: 5.7, 10.9, 16.1, 25.5 units.
//
// Half-widths taper inward on purpose. The stripes are all the same physical
// width in world terms, but the inner ones sit closer to the camera and so
// render visibly fatter; thinning them keeps the set reading as one even family
// rather than a heavy pair either side of the centre.
export const GUIDE_STRIPES = [
  { theta: 0.22, halfWidth: 0.013 },
  { theta: 0.42, halfWidth: 0.015 },
  { theta: 0.62, halfWidth: 0.018 },
  { theta: 0.98, halfWidth: 0.018 },
];
export const GUIDE_COLOR = 0x76dcff; // road markings -- cyan on indigo

// --- SPEED LINES -----------------------------------------------------------
// Streaks rushing past the camera (entities/speedLines.js), driven by the SPEED
// WOBBLE meter rather than by raw speed.
//
// Raw speed was too touchy. The game accelerates from START_SPEED to terminal
// within a few seconds and then sits at the top of its range -- measured 10.0
// min / 34.4 max, but almost all of the time above 30 -- so an effect mapped
// onto that range snapped from nothing to full almost immediately and then
// stayed pinned there for the rest of the run.
//
// The wobble meter is the same 0..100 signal the HUD bar and the camera shake
// already use, and it INTEGRATES: it fills only while over the speed threshold
// and drains whenever you carve, grind or slow. That gives a ramp measured in
// seconds instead of frames, and ties the streaks to the fail state, so a
// screen thick with them says the same thing a full bar does.
// Tuned down hard from a first pass at 220: at full intensity that read as a
// solid starburst that buried the rider and the road rather than as motion. The
// point is to feel fast, not to obscure the thing you're steering.
export const SPEEDLINE_MAX = 85;
export const SPEEDLINE_COLOR = 0x9fe9ff; // pale cyan -- finally glows against a dark playfield

// --- RIDER RIM LIGHT --------------------------------------------------------
// A bright fresnel edge on the character so his silhouette separates from the
// background regardless of palette. Cool white with a cyan bias, so it reads as
// the scene's own neon bouncing off him rather than as an arbitrary outline.
export const RIM_COLOR = 0xa8ecff;
export const RIM_STRENGTH = 0.55;
export const RIM_POWER = 2.2; // higher = tighter edge, less wash over the body
