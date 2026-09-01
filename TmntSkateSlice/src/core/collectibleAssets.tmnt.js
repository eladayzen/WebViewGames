// TMNT theme's collectible art. Resolved via vite.config.js's `resolve.alias`
// (aliased to '@collectible-assets' for the default/--mode tmnt build only).
// This file exists purely to preserve the TMNT theme's ORIGINAL collectible
// rigging unchanged while the original theme gets distinct per-color idols
// (see collectibleAssets.original.js): every collection color maps back to
// the single shared pizza_slice sprite for the falling item, and the HUD
// chips keep the dedicated colored-cardboard box art. Net effect: the TMNT
// build renders exactly as it did before this split (verified by diffing the
// built dist/ output).
const pizzaBox = new URL('../assets/pizza_box.png', import.meta.url).href;
const pizzaBoxBlue = new URL('../assets/pizza_box_blue.png', import.meta.url).href;
const pizzaBoxPurple = new URL('../assets/pizza_box_purple.png', import.meta.url).href;
const pizzaBoxRed = new URL('../assets/pizza_box_red.png', import.meta.url).href;
const pizzaSlice = new URL('../assets/pizza_slice.png', import.meta.url).href;

// pizza_slice is already in core/assets.js's base MANIFEST, so nothing extra
// to add for the canvas image loader here.
export const COLLECTIBLE_MANIFEST = {};

// Every tier falls as the same pizza_slice -- the box variants are told apart
// only by the colored glow render.js draws (unchanged), not by the sprite.
export const FALLING_SPRITE_KEY_BY_BOX_COLOR = {
  regular: 'pizza_slice',
  blue: 'pizza_slice',
  purple: 'pizza_slice',
  red: 'pizza_slice',
};

// HUD collection-chip icons: the original per-color cardboard box art.
export const BOX_ICON_URLS = {
  regular: pizzaBox,
  blue: pizzaBoxBlue,
  purple: pizzaBoxPurple,
  red: pizzaBoxRed,
};

// Intro tutorial "what to catch" primary icon: the pizza slice.
export const INTRO_PRIMARY_GOOD_URL = pizzaSlice;

// Box-completion popup title -- TMNT's original "<COLOR> BOX!" wording
// (e.g. "PIZZA BOX!", "BLUE BOX!", "BOMB SQUAD BOX!"), unchanged. `label`
// comes from boxColors.js / bombKills.js per completed set.
export function boxCompleteTitle(label) {
  return `${String(label).toUpperCase()} BOX!`;
}

// Stage-transition curtain -- the original TMNT-branded red drape (pizza /
// nunchaku / orange masks), unchanged. Each panel is a full curtain shown
// center-cropped, exactly as it shipped (positions stay 'center'). Kept out of
// shared CSS so the non-TMNT build never references this art (ui.js sets these
// as CSS vars; style.css reads them).
export const STAGE_CURTAIN_LEFT_URL = new URL('../assets/stage_curtain_left.png', import.meta.url).href;
export const STAGE_CURTAIN_RIGHT_URL = new URL('../assets/stage_curtain_right.png', import.meta.url).href;
export const STAGE_CURTAIN_LEFT_POS = 'center';
export const STAGE_CURTAIN_RIGHT_POS = 'center';
