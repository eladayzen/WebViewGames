import { defineConfig } from 'vite';

// GoBalance SDK hosts this via a real local HTTP server (see
// ../GOBALANCE_SDK.md), not file:// -- so this is a plain Vite build:
// default base ('/'), real ES module output, normal hashed multi-file assets.
//
// ONE FOLDER, ONE GAME. If a reskin of this game is ever wanted, it gets its
// own folder -- see CLAUDE.md on why two games that diverge in feel do not
// survive sharing a codebase.
export default defineConfig({});
