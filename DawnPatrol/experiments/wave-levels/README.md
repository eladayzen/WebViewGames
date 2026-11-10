# Wave levels — procedural wave experiments for the TMNT surf reskin

Throwaway prototypes, not wired into the game. Three fully procedural waves
(no painted textures) on one page, with the surfing-Mikey sprite as the rider,
composed like the WaveSurf reference: rider at ~25 % width, curl at the left
edge, crest ~30 % from the top, trough at the bottom, sky above.

- `levels.html` — switch levels with the buttons or keys 1/2/3; ↑/↓ (or W/S)
  ride up/down the face, auto-rides when idle. `?level=N` opens one directly.
- `level-1.html` — 3D toon wave (Three.js 0.160 from jsdelivr), ink edge pass.
- `level-2.html` — single 2D SDF fragment shader, ink from the distance field.
  The user's favourite for the water motion.
- `level-3.html` — ooze-green comic wave down a NYC street (Three.js),
  halftone + speed lines.
- `mikey_surf.png` — Kolbo nano-banana-pro variation 2 (see `../../.kolbo/production.md`),
  white keyed out with `tools/kolbo-assets/remove_white_bg.py`.

Serve the folder over http (e.g. `python3 -m http.server 8790`) — the pages
load each other in iframes. `node capture.mjs <page> <tag> <ms,...>` takes
headless, muted screenshots into `shots/`; `shoot-all.sh` also expects a
reference frame at `ref/frame_005.jpg` sampled from the WaveSurf video
(`tools/pipeline/sample_frames.py`), not committed.

Known gaps (2026-11-10): level 2's tube still reads as a dark porthole; levels
1 and 3 have a flat-sheet lip with no barrel; motion was tuned from stills.
