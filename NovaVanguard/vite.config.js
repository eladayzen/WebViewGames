import { defineConfig } from 'vite';

// The GoBalance SDK hosts this via a real local HTTP server (see
// ../GOBALANCE_SDK.md), never file:// -- so this is a plain Vite build:
// default base ('/'), real ES-module output, normal hashed multi-file assets.
// No singlefile inlining, no IIFE conversion, no base: './'.
//
// Nova Vanguard's build doc (§9.3) deliberately defers all bundling/shipping
// questions to GOBALANCE_SDK.md, which is why there is nothing game-specific
// in here.
export default defineConfig({});
