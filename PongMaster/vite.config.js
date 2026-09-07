import { defineConfig } from 'vite';

// The GoBalance host serves this over a real local HTTP server (see
// ../GOBALANCE_APP_INTEGRATION.md), never file:// -- so this is a plain Vite
// build: default base ('/'), real ES-module output, normal hashed multi-file
// assets. No singlefile inlining, no IIFE conversion, no base: './'.
//
// brief-for-webgames.md's single-bundle guidance predates the local HTTP
// server and is superseded here; PIPELINE.md records that the SDK docs win on
// build output.
export default defineConfig({});
