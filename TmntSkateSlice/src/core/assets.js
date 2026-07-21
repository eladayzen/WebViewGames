// Sprite manifest + loader. One entry per generated asset (game-assets-
// enhancement skill: "one sprite = one object", nothing composite baked
// together). Files live in ../assets/, generated via the Kolbo pipeline
// (see KOLBO_ASSET_PIPELINE.md) against the style guide in STYLE.md.
//
// Loading is best-effort: a missing/not-yet-generated image resolves to
// `null` in the returned map rather than throwing, so render.js can fall
// back to a flat-shape placeholder draw during early development before art
// exists, and silently upgrades the instant a real file lands at the same
// path -- no code changes needed either side of that swap.

const MANIFEST = {
  mike_idle: new URL('../assets/mike_idle.png', import.meta.url).href,
  mike_swing: new URL('../assets/mike_swing.png', import.meta.url).href,
  mike_hit: new URL('../assets/mike_hit.png', import.meta.url).href,

  pizza_slice: new URL('../assets/pizza_slice.png', import.meta.url).href,
  ooze_canister: new URL('../assets/ooze_canister.png', import.meta.url).href,
  bomb: new URL('../assets/bomb.png', import.meta.url).href,

  bg_rooftop: new URL('../assets/bg_rooftop.png', import.meta.url).href,
  bg_fire_escape: new URL('../assets/bg_fire_escape.png', import.meta.url).href,
  bg_alley: new URL('../assets/bg_alley.png', import.meta.url).href,
};

function loadOne(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadAssets() {
  const keys = Object.keys(MANIFEST);
  const images = await Promise.all(keys.map((k) => loadOne(MANIFEST[k])));
  const map = {};
  keys.forEach((k, i) => { map[k] = images[i]; });
  return map;
}
