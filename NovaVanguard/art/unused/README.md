# unused

Generated art that no current build references. Kept rather than deleted —
every file here was paid for, and most are one decision away from being used
again.

- `surface-hive-*`, `prop-hive-*` — The Hive Plate. Cut on 2026-08-25: Amit
  found it "way too dark and creamy... too much for what I intended". The
  campaign's dark/light rhythm replaced it. Unlikely to return as-is.
- `boss-vespidae-hull.png`, `boss-sac*.png` — the Vespidae broodmother, §6.4's
  fifth boss. Built as art, never wired; the level that would have used it now
  reuses Brood Gantry.
- `pickup-rapid.png`, `proj-player-rapid.png` — the RAPID weapon. Generated
  during a scope that was cancelled and reverted; the weapon itself was never
  built. If the standard fire rate is ever reduced, this is the pickup that
  restores it.

Nothing here is loaded by `src/render/textures.js`, so none of it ships in a
build. Moving a file back into `public/assets/` and adding its manifest row is
all that is needed to bring it back.
