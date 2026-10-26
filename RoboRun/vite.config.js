import { defineConfig } from 'vite';

// GoBalance SDK hosts this via a real local HTTP server (see
// ../GOBALANCE_SDK.md), not file:// -- so this is a plain Vite build:
// default base ('/'), real ES module output, normal hashed multi-file
// assets. No singlefile inlining, no IIFE conversion; GOBALANCE_SDK.md
// supersedes brief-for-webgames.md's older single-bundle guidance on this
// specific point (build/bundling output), per that doc's own precedence
// note.
//
// ONE FOLDER, ONE GAME. This builds RoboRun and nothing else. Half-Shell
// Hustle is its own folder now -- see ../HalfShellHustle/ and the note at the
// top of its src/data/enemyTypes.js for why the two were separated rather
// than kept as two themes of one codebase.
export default defineConfig({});
