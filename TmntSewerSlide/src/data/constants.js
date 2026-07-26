// Central tuning file (§9.3, §12 of the build doc: exact numbers are left to
// stage 4 to tune within the doc's directional guidance). Edit values here --
// Vite's dev server hot-reloads automatically.

export const TUNNEL_RADIUS = 6;
// Raphael rides at a fixed distance from the tunnel's central axis (§5.1) --
// same technique as Astro_Tunnel's RING_RADIUS. Slightly inside the wall so
// the billboard doesn't clip through it.
export const RING_RADIUS = TUNNEL_RADIUS - 1.1;
// Visual-only placement for the player's sprite/shadow -- closer to the wall
// than RING_RADIUS (which stays as-is for collision/obstacle/pickup/rail
// alignment). With the sprite's pivot at its bottom-center (feet/board), the
// full RING_RADIUS gap read as the character floating above the floor;
// this closes most of that gap for the character specifically without
// touching the shared gameplay radius everything else still uses.
export const PLAYER_VISUAL_RADIUS = TUNNEL_RADIUS - 0.35;

export const PLAYER_Z = 0;
// Added to every obstacle/pickup's own toleranceRad so the theta-tolerance-
// window check accounts for both sprite widths (§5.5), not just the
// obstacle's -- Raphael's own billboard has some width too.
export const PLAYER_ANGULAR_RADIUS = 0.05;

// How close (world z) an obstacle/pickup must be to PLAYER_Z before its
// theta is compared at all (§5.5's "strike range"), and how far past the
// player before it's recycled.
export const STRIKE_WINDOW = 0.9;
export const RECYCLE_MARGIN = 9;
export const SPAWN_START_Z = -140;

// --- Steering (§4) ---------------------------------------------------------
// theta's angular velocity eases toward sensor.x * MAX_ANGULAR_SPEED every
// frame (exponential-follow, not an instant snap) -- same technique as
// Astro_Tunnel's ANGULAR_SPEED/ANGULAR_RESPONSE (see main.js's `tick`).
// Deliberately gentler than Astro_Tunnel's 2.6/10: that game reads full
// 360 degrees of open tunnel and rewards fast full-deflection snaps between
// gaps, while this game's whole point is smooth, held leans and the
// "no fast alternating corrections" discipline the build doc calls out
// (§5.1, §10 pacing pass) -- a twitchier response here would fight that.
export const MAX_ANGULAR_SPEED = 3.4; // radians/sec at full deflection
export const ANGULAR_RESPONSE = 10; // higher = snappier turning

// --- Cross-sections (§5.3) --------------------------------------------------
// The doc specifies partial-arc as "~70%" and explicitly states half-pipe
// (180 deg) must read as a WIDER, more disorienting reachable arc than the
// partial-arc default (§5.1 core loop step 6, §5.4). Taken literally as
// "70% of the full 360 deg circumference" (252 deg) that would make
// partial-arc WIDER than half-pipe's 180 deg -- the opposite of what the doc
// says. Resolved here by reading "~70%" as 70% of a half-circle (180 deg),
// i.e. ~126 deg -- this keeps the monotonic partial-arc < half-pipe < (Post-MVP)
// full-pipe ordering the doc repeatedly states, and is roughly the size a
// "partial arc" (implicitly less than a half pipe) suggests on its own.
// Both are centered at the tunnel's bottom (theta = -PI/2), matching
// Astro_Tunnel's "ship starts at bottom of the tunnel" convention.
export const ARC_CENTER = -Math.PI / 2;
export const PARTIAL_ARC_HALF_WIDTH = ((Math.PI * 0.7) / 2); // ~63 deg either side = ~126 deg reachable
export const HALF_PIPE_HALF_WIDTH = Math.PI / 2; // 90 deg either side = 180 deg reachable

// How long (seconds) a section-boundary theta-reclamp eases the player back
// inside a newly-narrowed range, rather than snapping (§5.3 last bullet).
// Not exercised by this MVP's section order (every step only widens), but
// implemented generally per the doc's explicit call-out that this is worth
// handling deliberately.
export const SECTION_RECLAMP_SECONDS = 0.5;

// --- Lives / hits (§8) ------------------------------------------------------
// Precedent: Astro_Tunnel's MAX_LIVES/HIT_INVULNERABILITY_SECONDS -- same
// hit-handling model against a comparable continuous-angular mechanic,
// reused here as the doc explicitly calls for (§2 MVP, §10 milestone 4).
export const MAX_LIVES = 3;
export const HIT_INVULNERABILITY_SECONDS = 1.2;

// --- Scoring / multiplier (§8, §5.6) ---------------------------------------
export const SCORE_DISTANCE_RATE = 0.6; // score per world-unit of forward travel
export const PIZZA_BASE_VALUE = 20;
export const MAX_MULTIPLIER = 3;
export const MULTIPLIER_DECAY_SECONDS = 7; // within the doc's ~6-8s guidance

// --- Countdown / state ------------------------------------------------------
export const COUNTDOWN_SECONDS = 3;

// --- Camera ------------------------------------------------------------------
export const ASPECT = 16 / 9;
export const CAMERA_FOV = 78;
export const CAMERA_DISTANCE = 9;

// --- Local best-score display only (§8: display only, gates nothing, no
// meta-progression) ---
export const BEST_SCORE_STORAGE_KEY = 'tmnt-sewer-slide-best';
