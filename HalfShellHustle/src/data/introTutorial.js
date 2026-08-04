// First-run-of-every-run onboarding: two auto-cycling explainer steps shown
// before the world starts, one per steering axis (data/constants.js's
// STEERING_ABSOLUTE mode -- a lean is a direct lane/action TARGET, not a
// step). Direct feedback: an actual moving diagram, not a static screenshot
// with an arrow drawn on it -- "showing the go balance tilted left and
// showing the character on the left lane... center... right." Shown every
// run, not just once ever -- core/main.js's beginIntro runs from both boot()
// and restart().

// --- Step 1: left/right lane steering -----------------------------------
// Cycle order, direct feedback verbatim: "middle-left-right-middle-left...
// loop" -- NOT a ping-pong (center-left-center-right-center). It jumps
// straight from left to right the way a real lean does, and only passes
// back through center once every third step.
export const INTRO_LANE_CYCLE = ['center', 'left', 'right'];
export const INTRO_LANE_STATE_HOLD_SEC = 1.3;

// --- Step 2: forward/backward lean = jump --------------------------------
// Direct feedback: "you click a button and see the board tilting up and
// down for jump." EITHER direction jumps in the real game (input/input.js's
// pollJumpPress reads |tilt.y|, the magnitude, not a signed value) -- so
// this alternates a forward-lean jump and a backward-lean jump rather than
// only ever leaning one way, which would misteach the mechanic as
// one-directional.
//
// Board tilt is simulated with rotateX (a front/back lean -- the board's far
// edge tilts away from/toward the viewer) in ui/hud.js -- the same 3D-tilt
// language as step 1's rotateY (src/style.css), just around the other axis,
// since this board art is a top-down plan view where a real lean in either
// direction foreshortens an edge rather than spinning the whole silhouette.
// HorizontalBoard.png (copied from the GoBalance Unity project's
// CrazySnowboard UI) is the only board asset on hand -- direct feedback:
// reuse it creatively rather than wait on a dedicated forward/back asset.
//
// Each entry: which data/playerSprite.js PLAYER_JUMP_FRAMES index to show,
// the board's rotateX in degrees at that instant, and how long to hold it.
//
// CAUSALITY, direct feedback: the first cut had this backwards -- the jump
// only appeared to happen once the board eased BACK toward level, reading as
// "release triggers the jump." The real mechanic (input/input.js's
// pollJumpPress) fires on the RISING edge -- the instant a lean crosses the
// threshold outward -- so the jump has to start the moment the board reaches
// its tilted extreme, play out WHILE it eases back to level, and show
// nothing (an idle beat) once it's back at center. Frame 2 (the airborne
// main pose) doubles as that idle beat -- a legs-tucked running pose reads
// fine as "just standing/moving" too, and there's no 4th dedicated idle
// frame to spend on a beat this short.
export const INTRO_JUMP_CYCLE = [
  { frame: 2, boardDeg: 0, holdSec: 0.4 }, // idle, board level -- between jumps, nothing happening
  { frame: 0, boardDeg: -58, holdSec: 0.1 }, // squeeze-down AT the forward tilt -- the jump starts here
  { frame: 1, boardDeg: -58, holdSec: 0.12 }, // launching-up, still tilted forward
  { frame: 2, boardDeg: -20, holdSec: 0.25 }, // airborne, board easing back toward level
  { frame: 2, boardDeg: 0, holdSec: 0.4 }, // idle, board level -- landed
  { frame: 0, boardDeg: 58, holdSec: 0.1 }, // squeeze-down AT the backward tilt -- the jump starts here
  { frame: 1, boardDeg: 58, holdSec: 0.12 }, // launching-up, still tilted backward
  { frame: 2, boardDeg: 20, holdSec: 0.25 }, // airborne, board easing back toward level
];
// -58/58 (not the -20/20 that felt natural on paper), and 380px perspective
// (see ui/hud.js) rather than a longer one: verified via screenshot that
// gentler numbers barely moved on screen -- a perspective rotation on a
// wide, mostly-flat oval reads far less dramatically than a flat in-plane
// rotate does at the same angle. Step 1's rotateY (src/style.css) uses this
// exact same magnitude/perspective for the same reason.

// How long each step waits with no input before auto-advancing on its own.
// A click/Space/Enter always short-circuits this immediately (core/main.js);
// this is purely the zero-interaction fallback that keeps the game
// compliant with GOBALANCE_SDK.md's "first playable state must be reachable
// with no key required" -- see core/gameState.js's own note on the 'intro'
// state for the full reasoning.
export const INTRO_STEP_AUTO_ADVANCE_SEC = 8;
