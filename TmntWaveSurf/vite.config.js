import { defineConfig } from 'vite';

// Served by the GoBalance host over a real local HTTP server, never file:// --
// so a plain Vite build: default base ('/'), ES-module output, hashed assets.
// assetsInlineLimit 0 keeps every sprite a real .webp file in dist/assets
// rather than a base64 string inside the JS bundle. three.js alone is ~500 kB
// minified, so the default 500 kB chunk warning is raised rather than split.
export default defineConfig({
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
});
