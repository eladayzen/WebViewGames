// TMNT theme's hero sprite URLs. Resolved via vite.config.js's
// `resolve.alias` (aliased to '@hero-assets' for the default/--mode tmnt
// build only) -- so the 'original' theme's build NEVER includes this
// module, or the mike_*.png files it references, anywhere in its module
// graph. That's the actual guarantee here, not a runtime if/ternary in one
// shared file: Vite's asset pipeline emits whatever `new URL(...,
// import.meta.url)` calls it finds anywhere in the built module graph,
// regardless of which side of a runtime conditional they're on -- an
// earlier version of this file tried a single-file ternary and it leaked
// both themes' art into both builds (confirmed by inspecting dist/assets/
// after a build, see the commit this replaced). Keeping the two themes in
// genuinely separate files, swapped at the import-resolution level, is
// what makes the exclusion real. See src/core/assets.js and src/ui/ui.js
// for the two places '@hero-assets' gets imported.
export const HERO_SPRITES = {
  hero_idle: new URL('../assets/mike_idle.png', import.meta.url).href,
  hero_run_1: new URL('../assets/mike_run_1.png', import.meta.url).href,
  hero_run_2: new URL('../assets/mike_run_3.png', import.meta.url).href,
  hero_swing_1: new URL('../assets/mike_swing_1.png', import.meta.url).href,
  hero_swing_2: new URL('../assets/mike_swing_2.png', import.meta.url).href,
  hero_swing_3: new URL('../assets/mike_swing_3.png', import.meta.url).href,
  hero_hit_1: new URL('../assets/mike_hit_1.png', import.meta.url).href,
  hero_hit_2: new URL('../assets/mike_hit_2.png', import.meta.url).href,
};
