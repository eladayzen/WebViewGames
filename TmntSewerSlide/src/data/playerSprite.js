// Raphael's sprite art (§6, §10 milestone 9). Ride/lean is the default
// in-run billboard; hit is the game-over pose swapped in by main.js when
// the run ends (§6: "game-over pose"). Both generated against the same
// style anchor via Kolbo -- see STYLE.md.
export const PLAYER_SPRITE_URL = new URL('../assets/raph_ride.png', import.meta.url).href;
export const PLAYER_HIT_SPRITE_URL = new URL('../assets/raph_hit.png', import.meta.url).href;
export const PLAYER_PLACEHOLDER_COLOR = 0xff5a3c;
// Natural aspect (height / width) of raph_ride.png (~506x512), so the
// billboard doesn't stretch the art.
export const PLAYER_ASPECT = 512 / 506;
