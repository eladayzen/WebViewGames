import { defineConfig } from 'vite';

// GoBalance hosts this over a real local HTTP server (see ../GOBALANCE_SDK.md),
// not file:// -- so this is a plain Vite build: default base, real ES modules,
// hashed assets. `public/` ships verbatim, which is what the glb and the floor
// art rely on: they are fetched by path at runtime, not imported.
export default defineConfig({});
