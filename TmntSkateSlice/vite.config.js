import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GoBalance SDK hosts this via a real local HTTP server (see
// ../GOBALANCE_SDK.md), not file:// -- so this is a plain Vite build:
// default base ('/'), real ES module output, normal hashed multi-file
// assets. No singlefile inlining, no IIFE conversion.
//
// Two builds share this one codebase (2026-08-20, shared-engine reskin):
// the TMNT game (default, and `npm run build:tmnt`) and an original,
// non-TMNT reskin (`npm run build:original`).
//
// - outDir varies by --mode so building one theme never clobbers the
//   other's output on disk: dist/ for tmnt (and the plain, mode-less
//   `npm run build`, preserving existing muscle-memory/CI usage),
//   dist-original/ for original.
// - `@hero-assets` is aliased to a genuinely separate file per theme
//   (src/core/heroAssets.tmnt.js vs. heroAssets.original.js), not resolved
//   via a runtime if/ternary inside one shared module. That distinction is
//   load-bearing, not stylistic: Vite's asset pipeline emits whatever
//   `new URL(..., import.meta.url)` calls it finds anywhere in the built
//   module graph, regardless of which side of a runtime conditional
//   they're on -- a single-file-ternary version of this leaked BOTH
//   themes' art (mike_*.png AND hero_*.png) into BOTH builds, confirmed by
//   inspecting dist/assets/ after a build. Aliasing which physical file
//   '@hero-assets' resolves to means the non-selected theme's file, and
//   therefore its image references, are never part of that build's module
//   graph at all -- this is what actually guarantees a TMNT build ships
//   zero non-TMNT hero art and vice versa, which matters here because the
//   'original' build must not ship anything TMNT-adjacent, at all, ever.
export default defineConfig(({ mode }) => {
  const isOriginal = mode === 'original';
  return {
    resolve: {
      alias: {
        '@hero-assets': path.resolve(
          __dirname,
          isOriginal ? 'src/core/heroAssets.original.js' : 'src/core/heroAssets.tmnt.js'
        ),
      },
    },
    build: {
      outDir: isOriginal ? 'dist-original' : 'dist',
    },
  };
});
