// TMNT: Skate & Slice -- shared tunables.
// All layout values are FRACTIONS of the current canvas size (build-doc
// §9/game-assets-enhancement Phase 4 convention: never hardcode pixels), so
// the game is resize-safe across whatever aspect the GoBalance WebView
// actually renders at.

// --- Camera / framing (build doc §5.5) ---
// Amit's stated preference: pull the camera back from concept-01.png's tight
// crop -- more open sky above Michelangelo, more travel distance for falling
// items.
//
// PLAYER_HEIGHT_FRAC is intentionally global, not per-stage (2026-07-22):
// Michelangelo is the same size on every level, full stop -- per-stage
// feedback about how he reads against a given background is feedback on
// that background (see groundYFrac in stages.js, which IS per-stage -- each
// background's floor line sits at a different height), never a reason to
// resize him.
export const PLAYER_HEIGHT_FRAC = 0.30;

// --- Player movement (§4) ---
// Continuous, proportional-to-lean velocity -- never a discrete step. Tuned
// so a full-magnitude tilt crosses the play area in a bit over a second;
// small corrections should feel gentle, per §4's rationale for analog mode.
export const PLAYER_MAX_SPEED_FRAC_PER_SEC = 0.9; // fraction of play-area width per second at |input| = 1
export const PLAY_AREA_LEFT_FRAC = 0.08;
export const PLAY_AREA_RIGHT_FRAC = 0.92;

// --- Strike band / hit tolerance (§3, §5.3, §5.4) ---
// Michelangelo's hit region is his full sprite silhouette, not just his feet
// -- an item overlaps him the moment it's anywhere within his head-to-feet
// height (stage.groundYFrac - PLAYER_HEIGHT_FRAC to stage.groundYFrac)
// AND within this horizontal half-width, checked every frame while it's unresolved
// (see isWithinPlayerBand in entities/fallingItem.js). Base half-width of
// Michelangelo's swing/hit tolerance, as a fraction of the play-area width.
// The ooze buff (§5.3) widens this -- and widens it for BOTH good-item
// strikes and bomb overlap checks, since the doc explicitly calls the added
// bomb risk during the buff an intentional tension, not a bug.
export const BASE_HIT_HALF_WIDTH_FRAC = 0.075;
export const OOZE_HIT_HALF_WIDTH_FRAC = 0.12;
export const OOZE_BUFF_DURATION_SEC = 8; // within the doc's 6-10s range

// --- Special abilities (progression update, 2026-07-30) ---
// Shield: while active, bomb overlaps are blocked (no life lost) -- see the
// bomb branch in core/main.js. Magnet: while active, good items within the
// pull radius drift horizontally toward the player each frame (applyMagnetPull
// in entities/fallingItem.js). Durations tunable; all first-pass/directional.
export const SHIELD_BUFF_DURATION_SEC = 7;
// The shield bubble blinks (faster as it runs out) during its final seconds so
// the player can see it's about to expire (2026-08-02). See drawPlayer.
export const SHIELD_WARN_SEC = 2.5;
export const MAGNET_BUFF_DURATION_SEC = 7;
export const MAGNET_PULL_RADIUS_FRAC = 0.5;            // horizontal reach, fraction of play width
// Gradual pull (revised 2026-07-30 -- the old flat 0.55/s constant snapped
// pizzas overhead in ~1s). Pull is proportional to distance (eases toward
// the player, never snaps past), ramped by how far the item has fallen
// (barely pulls up high, more as it descends), then capped so nothing yanks
// across. See applyMagnetPull in entities/fallingItem.js.
export const MAGNET_PULL_RATE_PER_SEC = 2.5;          // proportional follow rate (before fall-ramp + cap)
export const MAGNET_PULL_MAX_SPEED_FRAC_PER_SEC = 0.3; // hard cap on per-second horizontal drift

// --- Falling items ---
export const ITEM_SIZE_FRAC = 0.075; // width/height of a falling item sprite, as a fraction of canvas height
// How far inside the play-area edge items stay clear of (see data/stages.js's
// getPlayAreaBounds, which reuses this for any per-stage override too).
export const ITEM_EDGE_MARGIN_FRAC = 0.02;
export const ITEM_MIN_X_FRAC = PLAY_AREA_LEFT_FRAC + ITEM_EDGE_MARGIN_FRAC;
export const ITEM_MAX_X_FRAC = PLAY_AREA_RIGHT_FRAC - ITEM_EDGE_MARGIN_FRAC;

// Never require fast alternating left-right corrections (§5.2, §11): cap how
// far a newly spawned item's x can jump from the previous item's x, so
// consecutive falling items stay within one deliberate lean of each other
// rather than demanding a snap across the whole play area.
export const MAX_SPAWN_X_JUMP_FRAC = 0.4;

// --- Scoring (§8) ---
export const PIZZA_SCORE = 10;
export const OOZE_SCORE = 0; // buff-only reward, per §8/§12's "don't double-dip" guidance and the open question there
export const COMBO_STEP = 3; // every N consecutive pizza hits bumps the multiplier
export const COMBO_MULTIPLIER_STEP = 0.5;
export const COMBO_MULTIPLIER_MAX = 3.0;

// Floating "+N" retro score popups: how long each rises and fades (2026-08-02).
export const SCORE_POPUP_TTL_SEC = 1.75;

// Box/bomb-kill completion: how long the "twin" chip flight (tray chip ->
// celebration popup) takes, in ms. Shared between ui.js (drives the flight
// itself and when the popup visually reveals) and core/main.js (delays the
// completion's game-state effects -- score bonus, booster/life grant,
// particle burst, sfx -- to that same moment, 2026-08-04 feedback) so the
// celebration reads as CAUSED by the chip landing, not simultaneous with a
// chip still visibly catching up.
export const BOX_COMPLETE_FLY_MS = 760;

// --- Lives (§5.4, §8) ---
export const STARTING_LIVES = 3;
// Lives can grow past the starting 3 (the red box's completion reward grants an
// extra heart, 2026-08-02) up to this cap. The HUD shows one heart slot per
// point of current capacity.
export const MAX_LIVES = 5;
export const HIT_INVULNERABILITY_SEC = 1.2;

// --- Countdown ---
export const COUNTDOWN_SEC = 3;
