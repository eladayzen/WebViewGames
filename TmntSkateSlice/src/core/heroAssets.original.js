// Original (non-TMNT) theme's hero sprite URLs. Resolved via
// vite.config.js's `resolve.alias` (aliased to '@hero-assets' for --mode
// original builds only) -- see heroAssets.tmnt.js's header for the full
// reasoning on why this needs to be a genuinely separate file, not a
// runtime conditional inside one shared module.
export const HERO_SPRITES = {
  hero_idle: new URL('../assets/hero_idle.png', import.meta.url).href,
  hero_run_1: new URL('../assets/hero_run_1.png', import.meta.url).href,
  hero_run_2: new URL('../assets/hero_run_2.png', import.meta.url).href,
  hero_run_3: new URL('../assets/hero_run_3.png', import.meta.url).href,
  hero_swing_1: new URL('../assets/hero_swing_1.png', import.meta.url).href,
  hero_swing_2: new URL('../assets/hero_swing_2.png', import.meta.url).href,
  hero_swing_3: new URL('../assets/hero_swing_3.png', import.meta.url).href,
  hero_hit_1: new URL('../assets/hero_hit_1.png', import.meta.url).href,
  hero_hit_2: new URL('../assets/hero_hit_2.png', import.meta.url).href,
};
