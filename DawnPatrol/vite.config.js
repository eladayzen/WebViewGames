import { defineConfig } from 'vite';
import { constraintScanPlugin } from './tools/constraint-scan.js';

// The GoBalance SDK hosts this over a real local HTTP server (see
// ../GOBALANCE_SDK.md), never file:// -- so this is a plain Vite build:
// default base ('/'), real ES-module output, normal hashed multi-file assets.
// No singlefile inlining, no IIFE conversion, no base: './'.
//
// Dawn Patrol's build doc (§9.3) deliberately defers every bundling/shipping
// question to GOBALANCE_SDK.md and explicitly says NOT to take bundling
// guidance from brief-for-webgames.md or from older GDDs -- which is why there
// is nothing game-specific in here.
// §9.5 rules 5 and 6 (the one-axis rule and the zero-input rule) are STATIC
// source checks, so they run here rather than at boot -- a violation fails
// `npm run dev` and `npm run build` instead of shipping and being noticed on a
// board six weeks later.
export default defineConfig({
  plugins: [constraintScanPlugin()],
});
