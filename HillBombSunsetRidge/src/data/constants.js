// Tuning constants for the render lab. Numbers here are directional, from the
// build doc's §5.1 speed model -- they exist so the harness feels like the real
// game while the rider layer is being compared, NOT as final tuning. Every one
// of these is explicitly an on-device decision later (build doc §12).

// --- speed model (build doc §5.1) ---
// accel = GRADE_ACCEL - DRAG*v^2 - CARVE_SCRUB*|carve|*v
// THE RANGE IS COMPRESSED FROM BOTH ENDS, which is two requests that sound
// opposed and are not. The START had to come up (13.2, +20%) so the opening
// seconds are not a crawl; the unassisted TOP had to come down a long way so a
// boost gate actually means something. Raising the grade did the first and
// undid the second -- cruise measured 38.7 u/s, and a booster on top of that is
// barely a change of pace.
//
// So the grade now sets a fairly low ceiling and the rolling bonus supplies the
// rest, which also gives the top speed to the rider who earns it:
//
//     base terminal      sqrt(12.5/0.0175)  = 26.7 u/s   (~69 km/h)
//     with full roll     sqrt(15.25/0.0175) = 29.5 u/s   (~77 km/h)
//     on a boost pad                          up to 44    (~114 km/h)
//
// Trimmed ~8% off the unassisted top (was 32.0) while leaving DRAG alone, so
// the ~1 s ramp to terminal is unchanged -- the ceiling moved, not the feel of
// getting there.
//
// A gate is now worth roughly half again your best unassisted speed, which is
// the gap that makes one worth steering for.
export const GRADE_ACCEL = 12.5; // gravity down the grade, world units/s^2
// Aero drag, and it is the knob that decides HOW FAST you reach terminal, not
// just where terminal is. Approach to terminal has a time constant of roughly
// 1/(2*DRAG*v_terminal), so raising drag and raising the grade to match keeps
// the same top speed and gets there sooner. Nearly doubled (0.0095 -> 0.0175)
// against a matching grade rise: the ride settles in about 1.0 s instead of
// 2.2 s, which is what "get to the maximum speed twice as fast" asks for.
//
// Raising the GRADE alone would have done the opposite -- a higher ceiling
// reached no quicker, and a longer wait before the run feels like anything.
export const DRAG = 0.0175;
// Residual tyre scrub only. On the flat road this was THE brake (0.85), but in
// the trough the cost of turning is paid physically -- carving climbs the wall,
// and the climb takes the speed. Keeping both double-counted it: a 3.3-unit
// climb cost 20 u/s when the energy exchange only justified 0.7. The geometry
// is the brake now.
// Cut from 0.10. Turning was costing far too much: measured, three seconds of
// carving covered 62.6 m against 107.3 m in a straight line -- a 42% loss, which
// made steering something you paid dearly for rather than the main thing the
// board does. At 0.022 a full carve costs roughly a tenth of that, enough to
// feel the line matter and not enough to punish using the controller. SLOWING
// DOWN IS THE BRAKE'S JOB now, not the steering's.
export const CARVE_SCRUB = 0.022;
// --- TUCK AND BRAKE (the fore/aft axis) -------------------------------------
// Lean forward to tuck and gain speed, lean back to drag the tail and slow.
// Both are CONTINUOUS: the input scales the effect and the effect is eased in,
// so speed builds and bleeds smoothly rather than switching between two states.
// OFF. Holding forward for speed made the optimal line "lean forward and never
// stop", which flattened every other decision -- and in the race it meant a
// player who simply held one input beat a field that could not. The tuck POSE
// stays; it just does not pay any more. The speed it used to provide has gone
// into the base grade and into ROLL_GAIN below, where it is earned by riding
// cleanly rather than by holding a button.
export const TUCK_BONUS = 0.0; // extra accel at full tuck, world units/s^2

// --- rolling momentum --------------------------------------------------------
//
// A slow, continuous gain for staying off the brake. Amit: "as long as you don't
// brake it too much you're always gaining speed a little bit."
//
// It is a bonus to TERMINAL speed rather than a push, so it cannot run away --
// drag still bounds it, the ceiling just moves. It builds over about half a
// minute of clean riding and the brake takes it back fast, which is what makes
// braking a real decision instead of a free way to slow down.
// Doubled too, so the EARNED half of the top speed arrives on the same
// timescale as the rest of it -- a ceiling that takes forty seconds to reach is
// not a ceiling the player ever meets in a ninety-second race.
export const ROLL_GAIN = 0.16;      // extra terminal per second of clean riding
export const ROLL_MAX = 2.75;       // ceiling on that bonus, world units/s
export const ROLL_BRAKE_LOSS = 2.2; // bonus lost per second of full braking
// How fast the tuck engages and releases. Deliberately unhurried -- a tuck that
// snaps on reads as a button, and Amit asked for speed that arrives naturally.
// Halved the time to reach full tuck (3.2 -> 6.4 is twice the rate). The build
// should still be felt rather than switched, just sooner.
export const TUCK_SMOOTH = 6.4;
// Release when the INPUT simply stops. Faster than the engage, because letting
// go should visibly end the pose rather than have it linger -- but nowhere near
// instant, which would be a one-frame pop.
export const GROUND_CTRL_LETGO = 9.0;
// How fast tuck and brake RELEASE when a higher-priority state takes over.
// Much quicker than they engage: a takeoff or a rail catch should look like the
// rider committing to that, not like he is slowly giving up on the tuck.
// 11 measured 215ms to hand over, which is ~40% of a 0.55s backflip -- the
// tuck was still visibly present well into the jump. 26 gives ~88ms: fast
// enough to read as the new state taking over outright, still eased rather
// than a single-frame pop.
export const GROUND_CTRL_RELEASE = 26.0;

// Braking. Scales with speed rather than being a flat subtraction, so it bites
// hard when you are flying and cannot yank a slow rider to a dead stop.
export const BRAKE_DRAG = 1.35; // fraction of speed shed per second at full brake
export const BRAKE_SMOOTH = 5.0;
// Raised from 4.0. A rider dragged down to walking pace has nothing to steer
// with -- the pendulum needs speed to carve at all -- so the brake bottomed out
// in a state the controller could not get out of. 12 is slow enough to read as
// braking hard and fast enough to still ride.
export const BRAKE_MIN_SPEED = 10.0; // never drag below this -- a stall is not a brake

// The floor for everything ELSE that costs speed (carving, scrub, wall climbs).
// Separate from the brake's floor on purpose: the brake is a deliberate act and
// may take you lower than merely riding badly ever should.
export const MIN_SPEED = 12.0;
// Tail sparks, quieter than a grind's: this is friction on a surface, not steel
// on steel.
export const BRAKE_SPARK_RATE = 95;

// LOADING THE TAIL. Pressing back compresses the board; whatever load is still
// stored when you cross a ramp's takeoff scales the jump. That is how a real
// pop works, and it turns the brake into a setup move rather than only a way to
// slow down -- time the compression into the lip and you go higher.
export const TAIL_LOAD_RATE = 1.9;  // how fast braking charges it
export const TAIL_LOAD_DECAY = 2.6; // and how fast it bleeds away once released
// Extra jump height at full load, as a fraction. Cut from 0.55 because a
// perfectly loaded big kicker was reaching 6.19 units, which forced the backflip
// bar above it and dragged the whole flip absurdly high with it. Still worth
// setting up for -- a fifth more air is plainly visible -- just no longer enough
// to turn a wedge into a vert wall.
export const TAIL_LOAD_BOOST = 0.22;
export const START_SPEED = 13.2; // +20%, matching the raised grade

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
// --- the brake needs a bigger commitment than the steering ------------------
//
// On the real board a rider's body weight drifts onto the brake axis without
// them meaning it -- you shift your weight to stay balanced, not to brake, and
// the board cannot tell the difference. Steering wants to be sensitive; braking
// wants to be deliberate. So the brake gets its own, much larger deadzone, and
// has to be HELD before it counts at all.
//
// The hold is the half that matters on the board. A weight shift is transient
// and a decision is sustained, so time separates them where magnitude alone
// cannot -- and unlike a deadzone, it works in digital mode too, where the game
// never sees the tilt angle at all and only gets a key.
export const BRAKE_DEADZONE = 0.42; // vs DEADZONE for steering, far larger
export const BRAKE_HOLD_MS = 200;   // sustained before any braking registers

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
export const AIR_HEIGHT_BASE = 1.40;
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
export const BACKFLIP_MIN_HEIGHT = 4.4;

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
// NO LONGER GATES THE SPIN. Which trick you do is now decided by the height you
// actually reach and nothing else -- see beginAir(). Kept because the value is
// still the honest answer to "was this rider moving sideways", and the spin's
// DIRECTION is still taken from that motion.
export const SPIN_LATERAL_MIN = 15.0;

// The spin has its OWN, much lower height gate. It used to inherit the
// backflip's 2.2, which made it effectively unreachable: that bar needs a big
// launcher AT SPEED, while the lateral threshold needs hard carving -- and
// carving bleeds speed through the height exchange, so the two conditions fight
// each other. Measured over 70s of mixed play: 10 launches, 5 hops and 5 plain
// jumps, ZERO backflips and zero spins, with takeoff heights of 1.25-2.11 never
// once clearing 2.2.
//
// Physically it was the wrong bar anyway. A flat 360 needs far less air than an
// end-over-end flip -- you can spin off a small pop, but you cannot flip off
// one. So the spin now asks only for enough air to complete a rotation, and
// lateral speed is what actually selects it.
// --- the GRAB, one tier below the spin ---------------------------------------
//
// Amit's suggestion: "he can crouch a little bit, one arm touching the board,
// the other one raised to the sky." It fills the gap the spin floor opened up --
// without it, everything between "too small to spin" and "spins" was a plain
// jump with no character at all, and a low ramp taken at a sensible speed did
// nothing.
//
// Deliberately NOT a rotation. Every other trick on the ladder turns the whole
// body, so the one move that just holds a shape reads as a different KIND of
// thing rather than a smaller version of the same thing.
// OFF until the pose is right. The tier and the ladder work -- what does not
// work yet is the pose itself. Measured mid-air with the current values: the
// two hands sit 0.01 apart vertically and the reaching hand is 1.02 above the
// deck with its upper arm crossing the torso, so on screen it reads as both
// arms flailing forward rather than one arm down to the board and one to the
// sky. Shipping that would be worse than the plain jump it replaces.
//
// What the probing established, for whoever picks this up: on this rig
// armR/foreR parent +Z is the only pairing that moves the hand down AND away
// from the body, and the left arm cannot be raised past ~1.4 rad of abduction
// before the hand starts coming back down. Getting the hand to the deck almost
// certainly needs the reach solved as IK against a target on the board -- the
// same conclusion the tuck reached for the feet -- rather than as FK angles.
export const GRAB_ENABLED = false;
export const GRAB_MIN_HEIGHT = 0.95;
// AXES AND MAGNITUDES ARE MEASURED, not chosen -- this rig's arm bones are
// near-degenerate in their local frames and the obvious axis is wrong as often
// as it is right. Probing each bone's response at 0.8 rad gave, as hand
// displacement (up / clearance from the torso axis):
//
//     armL  -Y  +0.191 / -0.102     the only axis that really raises a hand
//     armR  +Z  -0.066 / +0.033     down AND away from the body
//     foreR +Z  -0.190 / +0.059     the main lever for dropping the hand
//
// The first attempt used -Z on the forearm, which the sweep showed moves the
// hand UP (+0.154) -- the pose was inverted and the measurement caught it.
export const GRAB_CROUCH_HIP = 0.34;   // thigh toward the chest
export const GRAB_CROUCH_KNEE = 0.55;  // heel folded back under
export const GRAB_SKY_ARM = 1.40;      // left arm, through the abduction path
export const GRAB_REACH_ARM = 0.90;    // right upper arm, parent +Z
export const GRAB_REACH_ELBOW = 2.20;  // right forearm, parent +Z

// Below this, no rotation at all -- just a jump.
//
// The floor existed before but sat at 1.0, which after the height rescale was
// under almost everything the course could launch: a bank hit at walking pace
// still cleared it, so the plain jump had effectively stopped existing. At 1.6
// it separates the launchers by approach rather than by type:
//
//     kicker    0.63 .. 1.90   plain unless fast or tail-loaded
//     bank      0.91 .. 2.73   plain when slow, spins at speed
//     bigKicker 1.27 .. 3.83   spins
//
// Which is the same rule as everything else here -- the trajectory decides, so
// rolling up to a low ramp with no speed gets you a hop over it and nothing
// more, and that is a legible consequence rather than a dead input.
export const SPIN_MIN_HEIGHT = 1.6;

// --- how much a spin actually spins ------------------------------------------
//
// Every spin used to be exactly one revolution, so a scrape off a bank and a
// full-speed big-kicker air looked like the same move played at two speeds --
// which is precisely what made the whole category feel like one trick.
//
// Turns come from the height, the same quantity that chose the trick in the
// first place, so the ladder stays honest: earn more air, get more rotation.
// WHOLE revolutions only. A 540 lands the rider facing backwards, and with no
// switch stance to land in, the yaw would have to snap round on touchdown --
// exactly the one-frame snap this rig has been fighting all along.
export const SPIN_720_HEIGHT = 2.6;

// How far the rider leans OUT of vertical while spinning, in radians, at one
// revolution. A perfectly flat spin reads as a turntable; a real one is thrown
// off-axis by the rotation. Scales with turns, and eases in and out with the
// arc so the rider is upright at takeoff and upright again to land.
export const SPIN_LEAN = 0.30;

// The spin gets the SAME earned height and cap as the backflip -- it replaces
// that jump rather than being a different one, and having the same ramp produce
// wildly different hang time depending on your drift would read as a bug. Its
// air time is only a little longer: a flat yaw rotation reads quicker than an
// end-over-end flip at equal duration, so it needs a touch more to land as
// clearly as the backflip does at 0.55.
export const AIR_DURATION_SPIN = 0.62;

// --- hang time comes from the HEIGHT -----------------------------------------
//
// Air time used to be authored per trick, so every backflip hung for 0.55s
// whether it came off a kerb or a vert wall. That was a deliberate fix for an
// older bug (power stretched the duration and silently slowed the flip), but it
// makes the one thing the player is being asked to read -- how big this jump is
// -- invisible in the air.
//
// A real projectile's hang time goes as sqrt(height), so that is what this is:
//
//     duration = AIR_TIME_K * sqrt(height)
//
// K is calibrated so a 2.5-unit jump still lasts ~0.62s, which is where the
// authored spin already sat -- the existing ramps therefore feel unchanged, and
// only the new taller launches float longer. Clamped at both ends because
// rotation is locked 1:1 to air time: below the floor a flip becomes a blur,
// above the ceiling it drifts.
// How fast a boost's speed comes ON, as an exponential approach rate. The boost
// used to be applied as a floor with Math.max(), which snapped the rider to the
// new speed inside one frame -- it read as a teleport rather than as thrust.
// ~4.5 puts most of the gain in the first half second: quick enough to feel like
// a kick, slow enough to see the acceleration happen.
export const BOOST_RAMP = 4.5;

export const AIR_TIME_K = 0.392;
/**
 * GRAVITY FOR A FLIGHT, in units/s^2. DERIVED, not chosen.
 *
 * Air used to be a scripted arc -- sin(t*PI) * height over an authored duration
 * -- which meant the rider was following a shape rather than a trajectory. On
 * flat ground you cannot tell the difference. Over a drop you absolutely can,
 * and Amit could: "it feels like you are calculating the trick to the previous
 * floor, to the regular floor... you do like a fake floor which is not there
 * anymore and then I keep on dropping." That is precisely what it did -- the arc
 * completed against the launch tangent, and only then did a second, separate
 * fall phase take over. Two glued phases with a visible seam.
 *
 * Real ballistics has no seam, but it must not silently retune every jump in the
 * game either. A projectile launched to apex h takes 2*sqrt(2h/G); the old arc
 * took AIR_TIME_K*sqrt(h). Setting those equal for ALL h gives G = 8/K^2, so
 * this value is whatever keeps every existing flight time identical. Verified
 * across the full height range: the two agree to four decimal places, which is
 * why the half-pipe does not move.
 */
export const AIR_G = 8 / (AIR_TIME_K * AIR_TIME_K);

export const AIR_DURATION_MIN = 0.42;
export const AIR_DURATION_MAX = 1.20;
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
export const AIR_HEIGHT_MAX = 6.2;
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

// ARMS HIGH IN THE AIR. This REPLACES an earlier "arms down to the sides" pass
// -- Amit reversed it: hands should go up, and high, on every jump and through
// the landing. Applied through the same parent-X abduction the balance lift
// uses, so it inherits the never-inward guarantee instead of needing its own.
//
// MEASURED reach, hand displacement against the idle pose, with the head
// sitting 0.515 above the hips:
//     0.9 -> up 0.232, out +0.192      1.2 -> up 0.346, out +0.199
//     1.6 -> up 0.500, out +0.159  (hand level with the head)
//     2.0 -> up 0.634, out +0.070  (hand above the head)
//     2.4 -> up 0.727, out -0.055  (arm has swung over the centreline)
//
// Note where "out" turns around: past ~1.2 the arm keeps rising but starts
// coming back IN, and by 2.4 the hand is closer to the body than it began.
// That is the clipping failure all over again, which is why ARM_LIFT_MAX caps
// the combined total well short of it.
// Cut to half the on-screen RISE of the original 1.75, which reached head
// height at the apex and read as a star jump rather than a skater popping an
// ollie.
//
// Note the value is NOT half the angle: the abduction response is nonlinear, so
// 0.88 rad -- the arithmetic half -- actually cut the rise to 0.201 against the
// original 0.514, a 61% reduction rather than 50%. Solving against the measured
// curve (0.9 rad -> 0.232 of rise, 1.2 -> 0.346) for the 0.257 that is a true
// half lands here.
//
// The landing lift is deliberately untouched: Amit liked that one, and it is a
// separate additive term, so the two tune independently.
export const AIR_ARM_LIFT = 0.98;  // at the apex of a jump
export const LAND_ARM_LIFT = 1.50; // still high through the absorb

// --- catching a rail ---------------------------------------------------------
//
// There is no longer an angle at which a rail refuses you: touching one always
// grinds it. What used to be a yes/no gate is now a question of HOW LONG the
// rider takes to settle onto the line, which is the thing the gate was really
// protecting -- snapping a hard crossing straight onto the rail is what read as
// the obstacle grabbing you, not the fact of grinding it.
//
// GRIND_EASE_REF is the crossing ratio treated as "fully crosswise" when scaling
// that settle. 0.65 because that is what a deliberate aiming carve actually
// measures at contact -- the old gate rejected anything past 0.30, which is why
// aiming at a rail disqualified you from riding it.
export const GRIND_EASE_REF = 0.65;
// How fast the rider comes onto the rail's line, in exponential rate. The first
// is for an approach already aligned -- effectively instant -- and the second
// for the hardest cut, which takes about a fifth of a second to come round.
export const GRIND_SNAP_RATE = 22.0;
export const GRIND_EASE_RATE = 5.5;

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
export const CAM_BACK = 3.15; // follow distance behind the rider
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
export const CAM_HEIGHT = 1.05;
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
// Dropped BELOW CAM_HEIGHT on purpose. The camera aims at a point this high
// above the rider, so while it sat above the camera the whole rig tilted
// slightly UP and pushed him toward the bottom of frame -- fighting exactly the
// thing the low camera was buying. Below it, the rig tilts DOWN and lifts him,
// which is what makes room for the much closer follow distance.
// Nudged just below CAM_HEIGHT so the rig tilts very slightly DOWN, lifting the
// rider a hair. At a level aim the framing measured worst-bottom -0.99 -- inside
// the frame, but 0.01 of margin is not margin, and a deep landing absorb or a
// grind pose would spend it. This spreads the slack across both edges instead
// of leaving it all at the top.
export const CAM_LOOK_HEIGHT = 0.92;
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
// --- camera shake -------------------------------------------------------------
//
// SHAKE IS RESERVED FOR SPEED YOU DID NOT GET ON YOUR OWN. It used to ramp off
// raw speed, so simply riding well at the natural top shook the screen
// constantly -- which spends the effect on the ordinary case and leaves nothing
// for the extraordinary one.
//
// The threshold is the natural ceiling, DERIVED rather than typed: anything at
// or under what the hill alone can give you is calm by construction, and only a
// boost puts you above it. Deriving it means retuning the grade or the rolling
// bonus cannot silently leave the shake firing at cruise again.
export const NATURAL_TOP_SPEED = Math.sqrt((GRADE_ACCEL + ROLL_MAX) / DRAG);
export const SHAKE_SPAN = 12.0; // u/s above the natural top for full shake
export const SHAKE_MAX = 0.38;

export const RIM_COLOR = 0xa8ecff;
export const RIM_STRENGTH = 0.55;
export const RIM_POWER = 2.2; // higher = tighter edge, less wash over the body

// White direction arrows painted up the face of every launcher (see props.js's
// buildChevrons). Pure white rather than the cyan used for trough markings:
// these sit ON an object you interact with, and cyan already means "painted on
// the ground, ignore me".
export const RAMP_ARROW_COLOR = 0xffffff;

// --- ARM BALANCE ------------------------------------------------------------
// Procedural counter-balance on the arms, layered over the idle clip so the
// rider stops repeating the same loop forever. Amit: "bring more liveliness
// into it... him trying to balance himself... break the bottom of the idle
// cycle."
//
// FK, not IK, and that's deliberate. IK earns its keep when a hand must reach a
// specific world-space point -- planting on a rail, a grab meeting the deck.
// Balance flailing has no such target; the hand just needs to go "out there".
// A solver would add a target rig and pole vector to produce what two rotations
// already give, and would be harder to blend against the running clip.
//
// MEASURED response of this rig's arms, hand displacement in the rider's own
// frame per rotation applied:
//     axis x   +0.3 -> 0.120   +0.6 -> 0.237   +0.9 -> 0.341   +1.2 -> 0.424
//     axis y   negligible (0.11 at its very best -- a twist about the bone)
//     axis z   asymmetric: swings the LEFT hand forward with lateral coupling,
//              the RIGHT hand backward with almost none
//
// Two consequences baked into the numbers below. Rotation x is the only strong,
// symmetric lever, so it does the work. And it SATURATES -- those increments
// are 0.120, 0.117, 0.104, 0.083, so past ~0.9 rad more rotation buys steadily
// less movement. Peak stays well under that.
//
// The arm LINE tilts rather than both arms doing the same thing: one arm rises
// as the other drops, which is how a person actually counterweights. Perfectly
// mirrored flailing reads as robotic.
export const BALANCE_CARVE = 0.55; // how much carve feeds the balance signal
// Drift contributes separately from carve, because the pendulum means they
// disagree: you can be carving right while still travelling left, and that
// disagreement is exactly the moment a rider is fighting for balance.
export const BALANCE_LATERAL = 0.35;
export const BALANCE_LATERAL_REF = 15.0; // world units/s that counts as "full"
// Eased, never snapped -- an arm that steps to a new angle in one frame reads
// as a glitch rather than a correction.
export const BALANCE_SMOOTH = 6.5;

// THE IDLE POSE IS THE FLOOR. Amit: the arms' animated position is the CLOSEST
// they should ever get to the torso -- the balance may only ever raise them.
// The first pass tilted the arm line, one arm up and the other down, and the
// downward one drove the hand into the hip and clipped through the body.
//
// Both of these are therefore >= 0 and only ever ADD lift. BASE rises on both
// arms with the magnitude of the imbalance -- a person off-balance brings both
// arms up, like a tightrope walker -- and ASYM adds more to the arm on the high
// side, which is what keeps it from reading as a symmetric shrug.
export const BALANCE_LIFT_BASE = 0.30;
export const BALANCE_LIFT_ASYM = 0.38;

// Hard ceiling on the SUM of every lift source. Beyond ~2.1 the arm swings past
// vertical and the hand starts travelling back toward the body -- see the
// measured reversal above -- so a jump landing mid-carve, which stacks air lift
// on top of balance lift, must not be allowed to add its way through it.
export const ARM_LIFT_MAX = 2.0;

// --- TUCK / BRAKE POSES -----------------------------------------------------
// Forward: torso down and forward over the board, knees bent a little. The
// spine curl reuses the measured landing-absorb chain (+rotation.x folds the
// head down and forward, weighted toward the lower spine so the back curls
// rather than hinging).
export const TUCK_SPINE = 0.44;
// Hip and knee raised from 0.34/0.62. Those sat in the leg chain's DEAD ZONE --
// the same trap the landing absorb hit: the two joints oppose each other, and
// measured, hip 0.34 / knee 0.60 gives -0.035 of closure, i.e. it STRAIGHTENS
// the stance instead of sinking it. The knee term has to be carried past the
// thigh term before the pose closes at all.
// How far the pelvis drops at full tuck, in world units. Applied directly to
// the body rather than derived from a leg fold, with the legs then solved back
// to planted feet -- so this number IS the sink, with no dead zone and no
// nonlinearity to fight.
// 0.30 was far too deep -- against a ~0.9 leg it drove the knees down onto the
// deck and read as crawling rather than tucking. This is the drop that gives an
// aero crouch while the legs still look like legs.
// Reduced again. The pelvis drop is what forces the knee to bend, so a smaller
// sink is directly a gentler knee -- Amit's own suggestion, and it costs little
// since the spine curl carries most of the read anyway.
export const TUCK_SINK = 0.10;
// Knees out to the sides, so the crouch reads as a wide aero stance rather than
// a squat. Applied about the PARENT Z axis and MIRRORED between the legs --
// measured: left +Z and right -Z both push the knee outward (-0.070 and +0.101
// at half a radian), whereas a shared sign splays one and tucks the other.
// How far the knees break outward. With IK this is a POLE direction, not a
// rotation -- it chooses the plane the knee bends in, so it costs the foot
// nothing. That is the whole reason the splay is free now: as FK it swung the
// thigh and dragged the foot on a long lever (measured 0.47 of foot movement).
export const TUCK_KNEE_SPLAY = 0.55;
// The LEFT knee splays far harder than the right on this rig -- measured -0.277
// against -0.064 -- so it swung well out to the side when it should point down
// the lane. Scaling only that leg's lateral pole keeps the pair looking even; a
// single shared value cannot, because the two legs do not respond equally in a
// skate stance.
export const TUCK_SPLAY_LEFT_SCALE = 0.0; // pole dead ahead for that leg
// Elbows fold so the forearms point ahead, down the lane. Per-arm axes, because
// the chains are asymmetric: the left forearm carries the hand forward best on
// parent -X (-0.087 of Z) and the right on parent -Z (-0.154), while a shared
// axis sends one of them backwards.
export const TUCK_ELBOW_FOLD = 0.9;
// Arms reach forward, in front of the body. Parent Y, also mirrored: left -Y
// and right +Y each carry the hand forward (-0.177 and -0.105 of Z at 0.6 rad).
// This composes with the balance lift's abduction rather than replacing it, so
// a tuck taken mid-carve still counter-balances.
export const TUCK_ARM_FORWARD = 0.52;

// Back: stand up and lean away, nose lifts as the tail drags. The spine goes
// the OTHER way, which is why it is a separate constant rather than a negative
// tuck -- the two poses are not mirror images of each other.
export const BRAKE_SPINE = 0.30;
export const BRAKE_BOARD_PITCH = 0.30; // radians of nose-up on the deck
