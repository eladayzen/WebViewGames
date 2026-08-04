// First-run-of-every-run onboarding, two steps shown before the world starts
// (core/gameState.js's 'intro' state), adapted from HalfShellHustle's pattern
// -- see WEB_MINIGAME_TECH_RETROSPECTIVE.md's "DOM/CSS onboarding tutorial
// overlay for GoBalance input" note for the full reasoning this is ported
// from. Two deliberate departures for THIS game (2026-08-04):
//
// 1. Step order is flipped: step 1 here teaches WHAT to catch/avoid (this
//    game's core objective), step 2 teaches HOW to move. HalfShellHustle's
//    two steps were both about input gestures (it has none of this game's
//    "what's good vs bad" question -- coins/enemies there are more legible
//    on sight); this game's item legibility (colored-glow pizza variants,
//    power-ups, bombs) is worth teaching before the movement gesture.
// 2. Step 2's movement diagram is CONTINUOUS, not a 3-state snap cycle.
//    input/input.js's own header comment is explicit: this game is Analog
//    mode (`forwardSteeringKeys = false`) -- "continuous proportional lean,
//    x-axis only" -- there is no lane target to snap between, unlike
//    HalfShellHustle's STEERING_ABSOLUTE (lean = a direct lane target). A
//    discrete left/center/right cycle would teach the WRONG mental model
//    here. See style.css's .intro-steer-board/.intro-steer-player keyframes
//    -- a single continuous sweep (CSS-driven, not JS state-cycled) instead.

// How long each step waits with no input before auto-advancing on its own --
// required for GOBALANCE_SDK.md's "first playable state reachable with no
// key" contract (a click/Space/Enter is a speed-up over this, never a
// requirement -- see core/gameState.js's 'intro' state comment). Tuned per
// step (2026-08-04, was one shared 8s for both): step 1 (item recognition)
// needs a bit longer to actually read both panels; step 2 (the movement
// sweep) communicates faster since it's just watching a loop.
export const INTRO_STEP1_AUTO_ADVANCE_SEC = 9;
export const INTRO_STEP2_AUTO_ADVANCE_SEC = 6;

// Step 2's run-cycle frame swap cadence while the tutorial sweep plays --
// kept as its own knob (not imported from entities/player.js's internal
// RUN_CYCLE_FRAME_DURATION_SEC) so the tutorial's pacing can be retuned
// independently of real gameplay animation timing. Same value today.
export const INTRO_RUN_FRAME_DURATION_SEC = 0.1;
