// Original (non-TMNT) theme's collectible art. Resolved via vite.config.js's
// `resolve.alias` (aliased to '@collectible-assets' for --mode original
// builds only) -- same genuinely-separate-file mechanism as heroAssets.*.js,
// so the idol PNGs never enter the TMNT build's module graph (see
// heroAssets.tmnt.js's header for the full why).
//
// The unify idea (2026-08-23): the SAME idol that falls is the SAME art shown
// in its HUD collection box. One sprite per collection color, used for both
// the falling item AND the box chip. TMNT keeps its old rigging (one
// pizza_slice for every tier + separate cardboard-box chips) -- see
// collectibleAssets.tmnt.js, which maps every color back to pizza_slice so
// the TMNT build renders exactly as before.
const idolRegular = new URL('../assets/gem_regular.png', import.meta.url).href;
const idolBlue = new URL('../assets/gem_blue.png', import.meta.url).href;
const idolPurple = new URL('../assets/gem_purple.png', import.meta.url).href;
const idolRed = new URL('../assets/gem_red.png', import.meta.url).href;

// Merged into core/assets.js's canvas image MANIFEST. Keyed by the sprite
// keys the falling item + collect-flyer look up at render time.
export const COLLECTIBLE_MANIFEST = {
  collectible_regular: idolRegular,
  collectible_blue: idolBlue,
  collectible_purple: idolPurple,
  collectible_red: idolRed,
};

// Which loaded-image key a falling pizza-item (and its fly-to-chip "twin")
// uses, per collection box color. render.js/main.js read this instead of the
// hardcoded item.type.sprite for pizza items.
export const FALLING_SPRITE_KEY_BY_BOX_COLOR = {
  regular: 'collectible_regular',
  blue: 'collectible_blue',
  purple: 'collectible_purple',
  red: 'collectible_red',
};

// HUD collection-chip DOM <img> icon per box color -- the SAME idol art as
// the falling item (the whole point of the unify).
export const BOX_ICON_URLS = {
  regular: idolRegular,
  blue: idolBlue,
  purple: idolPurple,
  red: idolRed,
};

// Intro tutorial "what to catch" primary DOM icon.
export const INTRO_PRIMARY_GOOD_URL = idolRegular;

// Box-completion popup title (ui.js). The gems aren't "pizza" and aren't in a
// "box", and the popup already shows the big colored gem icon, so the color/
// tier doesn't need to be in words -- a single generic "SET COMPLETE!" reads
// cleaner for every set (including the bomb-kill one). The whole title string
// is theme-provided so TMNT can keep its own "<COLOR> BOX!" wording unchanged.
export function boxCompleteTitle() {
  return 'SET COMPLETE!';
}

// Stage-transition curtain (the "closing door" between stages) -- theme-varying
// because the TMNT drape is TMNT-branded (pizza / nunchaku / orange masks).
// The original curtain is ONE symmetric blue/gold ninja curtain SPLIT down the
// middle, so each half is edge-pinned toward the seam (left panel -> right,
// right panel -> left) so the centered motif reunites when the panels meet.
// ui.js sets these as CSS vars on the panels; style.css reads them.
export const STAGE_CURTAIN_LEFT_URL = new URL('../assets/stage_curtain_rn_left.png', import.meta.url).href;
export const STAGE_CURTAIN_RIGHT_URL = new URL('../assets/stage_curtain_rn_right.png', import.meta.url).href;
export const STAGE_CURTAIN_LEFT_POS = 'right center';
export const STAGE_CURTAIN_RIGHT_POS = 'left center';
