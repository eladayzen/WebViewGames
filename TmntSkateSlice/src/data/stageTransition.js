// Stage-complete transition timing (freeze + curtain, ported from
// HalfShellHustle's level-complete pattern -- see
// WEB_MINIGAME_TECH_RETROSPECTIVE.md, and core/main.js's 'stagecomplete'
// frame() branch). Mirrors the shape of HalfShellHustle's own
// data/progression.js LEVEL_* block, kept as its own small file (not folded
// into data/stages.js, which is per-stage GAMEPLAY tuning, not transition-UI
// timing) for the same reason data/introTutorial.js is separate.

// Total freeze duration before gameplay resumes. Shorter than
// HalfShellHustle's 5s -- this game only has 2 transitions total per run
// (vs. HalfShellHustle's more frequent tiers), so the beat doesn't need to
// be as long to feel earned. Directional/tunable, same as every other
// pacing constant in this codebase.
export const STAGE_COMPLETE_COUNTDOWN_SEC = 4;

// How far into that countdown the curtains START sliding closed -- gives the
// headline/particle burst a clear beat to itself first. MUST stay under
// STAGE_COMPLETE_COUNTDOWN_SEC or the curtains never close at all.
export const STAGE_CURTAIN_CLOSE_DELAY_SEC = 1.6;

// How long that close (and the matching open) animation itself takes --
// MUST match style.css's .stage-curtain transition duration exactly, since
// nothing enforces the two staying in sync automatically. core/main.js waits
// this long AFTER STAGE_CURTAIN_CLOSE_DELAY_SEC before committing the stage
// advance (background + groundYFrac swap), so it happens only once the
// curtains have actually finished closing, not the instant the close is
// triggered -- swapping earlier would let the swap's ground-line jump peek
// out from behind a still-sliding curtain. CLOSE_DELAY + TRANSITION (2.2s)
// stays comfortably under COUNTDOWN_SEC (4s), leaving a real hidden window.
export const STAGE_CURTAIN_TRANSITION_SEC = 0.6;
