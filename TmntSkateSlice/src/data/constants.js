// TMNT: Skate & Slice -- shared tunables.
// All layout values are FRACTIONS of the current canvas size (build-doc
// §9/game-assets-enhancement Phase 4 convention: never hardcode pixels), so
// the game is resize-safe across whatever aspect the GoBalance WebView
// actually renders at.

// --- Camera / framing (build doc §5.5) ---
// Amit's stated preference: pull the camera back from concept-01.png's tight
// crop -- more open sky above Michelangelo, more travel distance for falling
// items. GROUND_Y_FRAC is where his feet/skateboard sit; PLAYER_HEIGHT_FRAC
// is deliberately small so there's still open sky above his head.
// GROUND_Y_FRAC is calibrated to the generated stage backgrounds' actual
// floor line (checked against all 3: bg_rooftop's floor starts ~0.58,
// bg_fire_escape's deck doesn't start until ~0.77 -- well below its railing
// at ~0.57 -- and bg_alley's pavement starts ~0.37), not just an abstract
// framing fraction -- 0.66 put the player standing on the fire-escape
// railing instead of the floor. Re-check this against new art any time a
// background is regenerated.
export const GROUND_Y_FRAC = 0.87;
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
// height (GROUND_Y_FRAC - PLAYER_HEIGHT_FRAC to GROUND_Y_FRAC) AND within
// this horizontal half-width, checked every frame while it's unresolved
// (see isWithinPlayerBand in entities/fallingItem.js). Base half-width of
// Michelangelo's swing/hit tolerance, as a fraction of the play-area width.
// The ooze buff (§5.3) widens this -- and widens it for BOTH good-item
// strikes and bomb overlap checks, since the doc explicitly calls the added
// bomb risk during the buff an intentional tension, not a bug.
export const BASE_HIT_HALF_WIDTH_FRAC = 0.075;
export const OOZE_HIT_HALF_WIDTH_FRAC = 0.12;
export const OOZE_BUFF_DURATION_SEC = 8; // within the doc's 6-10s range

// --- Falling items ---
export const ITEM_SIZE_FRAC = 0.075; // width/height of a falling item sprite, as a fraction of canvas height
export const ITEM_MIN_X_FRAC = PLAY_AREA_LEFT_FRAC + 0.02;
export const ITEM_MAX_X_FRAC = PLAY_AREA_RIGHT_FRAC - 0.02;

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

// --- Lives (§5.4, §8) ---
export const STARTING_LIVES = 3;
export const HIT_INVULNERABILITY_SEC = 1.2;

// --- Countdown ---
export const COUNTDOWN_SEC = 3;
