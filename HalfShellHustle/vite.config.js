import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GoBalance SDK hosts this via a real local HTTP server (see
// ../GOBALANCE_SDK.md), not file:// -- so this is a plain Vite build:
// default base ('/'), real ES module output, normal hashed multi-file
// assets. No singlefile inlining, no IIFE conversion; GOBALANCE_SDK.md
// supersedes brief-for-webgames.md's older single-bundle guidance on this
// specific point (build/bundling output), per that doc's own precedence
// note.
//
// ONE SOURCE, TWO GAMES.
//
//   npm run build:original  -> dist/          -> StreamingAssets/RoboRun
//   npm run build:tmnt      -> dist-tmnt/     -> StreamingAssets/HalfShellHustle
//
// A PLAIN `vite build` IS THE SCRAP-BOT, deliberately: that is what this
// repo's ship steps and every clean-rebuild check already run, and making
// the mode-less build mean "nothing" would break them silently.
//
// `@theme` is aliased to a genuinely separate module per mode, each of which
// resolves its images against its OWN assets directory with a literal path.
// That is what keeps the two builds apart -- the non-selected theme's module
// is never imported, so its directory is never globbed and not one of its
// files is emitted. Verify it the same way it was verified when written: look
// at dist/assets and dist-tmnt/assets and confirm neither contains the
// other's art.
//
// WHY TWO THEMES AT ALL: the scrap-bot reskin overwrote the turtle art in
// place, which left the shipped TMNT game unbuildable from all-games. See
// src/data/theme.tmnt.js.
export default defineConfig(({ mode }) => {
  const isTmnt = mode === 'tmnt';
  return {
    resolve: {
      alias: {
        '@theme': fileURLToPath(
          new URL(isTmnt ? './src/data/theme.tmnt.js' : './src/data/theme.original.js', import.meta.url),
        ),
      },
    },
    build: {
      outDir: isTmnt ? 'dist-tmnt' : 'dist',
      emptyOutDir: true,
    },
  };
});
