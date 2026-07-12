import { defineConfig } from 'vite';

// GoBalance SDK hosts this via a real local HTTP server (see
// GOBALANCE_SDK.md), not file:// -- so this is a plain Vite build: default
// base ('/'), real ES module output, normal hashed multi-file assets. No
// singlefile inlining, no IIFE conversion; both were only needed for the
// file:// constraint this project no longer targets.
export default defineConfig({});
