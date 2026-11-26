# SkyShred (prototype 1)

Spec: `pipeline/build-docs/SkyShred.md`.  Three.js + Vite.

    npm install
    npm run serve        # http://127.0.0.1:8141/  (dev server)
    npm run build        # plain build -> dist/ (never ship a watch build)
    node tools/drive.mjs # headless autopilot run, screenshots -> shots/  (muted Chrome, needs the dev server up)
    node tools/closeup.mjs  # close-ups of the rider: run pose, wing deploy, glide pose

## Play
- LEAN LEFT/RIGHT: arrows or A/D, drag, or the board.  That is the only control.
- Hold your sights on a drone: machine gun.  Hold longer (~1.5 s): a missile launches itself.
- Run phase: ninja stars throw themselves; stick/kick when something gets close.
- `M` or the ALT button: altitude test mode.  PATH = the path sets altitude.  PATH+NUDGE = W/S (forward/back lean) nudges it.
- `O` or the AUTO button: autopilot.  `P`: pause.  `N`: skip to the next leg.  URL: `?auto=1`, `?mode=nudge`, `?s=300` (jump into the glide), `?leg=2`.

## Where the knobs are
- `src/main.js` `T` — run speed, glide speeds (V0 / vDive / vMax), steering rate, skim height + boost, nudge range.
- `src/path.js` `SECTIONS` — the leg: length, ground slope, clearance (height over ground), kind.  Slope sets speed.
- `src/combat.js` `GUN` — lock radius, fire rate, missile arm time, `DRONE_HP`.

No audio yet.  No fail state yet (nothing hurts you).
