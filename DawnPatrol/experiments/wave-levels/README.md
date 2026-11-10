# Wave levels — TMNT surf prototype (Dawn Patrol reskin)

A playable throwaway prototype, not wired into the game. One procedural 3D toon
wave (no painted textures) with Mikey surfing it, composed like the WaveSurf
reference: rider at ~25 % width, barrel at the left edge, sky above.

Serve the folder over http (e.g. `python3 -m http.server 8790`) and open
`levels.html` — it loads the wave pages in iframes and draws the rider and all
gameplay on a canvas on top.

## Levels

- **1 · 3D Toon** (default) — `level-1.html`, Three.js 0.160 from jsdelivr, ink
  edge post-pass. The sea line follows a reference profile (`yTopDyn`, lowered by
  `SEA_DROP`) and breathes slowly. The barrel break is a screen-space
  superellipse arch in the post pass: the lip rises above the shoulder, a thick
  white band with torn sawtooth spikes and grey-blue shadow blobs pours down to
  the bottom-left, spray flies off the top, and a stepped dark hollow sits under
  the hood. The lip pattern uses a static warp only (a time-growing term made
  it go pointy over minutes — see `shots/lip-t3-vs-t300.jpg`).
- **2 · Ooze Street** — the same `level-1.html` with `?theme=ooze`: identical
  wave shape and motion, ooze-green palette, halftone shading, magenta comic sky
  with brownstones. Candidate for a temporary "double energy" mode.

The old SDF-ink and separate ooze-street levels were retired on 2026-11-10.

## Controls

Hold Space / ↑ / mouse / touch to push up the face, release to drop, launch off
the lip. `C` toggles the Direct controller, `1`/`2` switch level, `B` summons the
boss, `` ` `` hides the dev panel.

## Gameplay (all in `levels.html`, tuning in `PHYS` and `GAME`)

- **Physics dev panel** (top right, on by default): presets **A · Current**,
  **B · Soft drop + ramp** (drop 20 % slower, climb same 2.0 s but accelerates the
  longer you hold) and **C · Saved, locked jump** (default: B physics, every jump
  peaks exactly at `AIR_PEAK_Y` 0.27 of screen height, 1.35 s air time). Sliders,
  live climb/drop times, Save as Custom (localStorage), Copy JSON.
- **Air rotation**: starts at the take-off angle, eases to level at the top of
  the jump, accelerates to `AIR_LAND_TILT` (0.40 rad nose-down) at touchdown.
- **Obstacles**: mutant blobs (`obstacle_a/b.png`) poke out of the water and drift
  at 0.22 x the water flow; hits flash + stagger, counted in the HUD.
- **Pickups → ammo clip**: ninja-star strings along the face or arcs over the lip
  (jump to reach), some ending in a nunchaku special. Each pickup appends to a
  12-slot clip (top centre), fired front-first.
- **Shooting**: only while airborne and a boss is up, 4 shots/s. When rider and
  target are both in the upper half the stars fly flat (0°, no homing) — timing
  matters; otherwise they aim and home lightly. Star = 1 damage, nunchaku = 3.
- **Boss** (`boss.png`): flies in every 20–30 s, hovers at the rider's jump-peak
  body height, winds up and fires ooze balls (`projectile.png`). If the rider is
  in the upper half he swoops to the rider's height and fires flat (0°) — staying
  high gets punished. 14 HP, spins off when KO'd.
- **Jetski water boss** (`jetski_boss.png`): rides the face with the same physics
  as the player (AI on the one input), launches off the lip to fire flat. Built
  and tested, switched off for now (`GAME.JET_ENABLED = false`).

Star and nunchaku are drawn in code (Kolbo timed out); `shuriken.png` /
`nunchaku.png` dropped in this folder replace them automatically.

## Art

All sprites are Kolbo `nano-banana-pro` with the `@tales_tmnt_style` Visual DNA,
cut out locally — generation ids and credits in `../../.kolbo/production.md`.

## Tools

`node capture.mjs <page> <tag> <ms,...>` takes headless, muted screenshots into
`shots/` (`EVALS="js|js|..."` runs one snippet before each shot, `VW`/`VH` set the
size). `shoot-all.sh` recaptures `shots/levels-1.png` and `levels-2.png`.
`measure-speed.sh` / `measure-sky.sh` measure scroll speeds from frame pairs
(written for the retired level 2; `?level=1` works the same way).
