# TMNT: Sewer Slide — Style Guide

Derived from the approved concept art (`pipeline/macro-briefs/approved/
tmnt-sewer-slide-dodger/concepts/concept-01.png` through `-05.png`) and the
*Mutant Mayhem*-era reference stills (`/Users/eladayzen/Documents/tmnt/`),
per build doc §1. This guide governs every sprite generated for the game —
Raphael, obstacles, pickups — and also the tunnel wall art. Per §0/§9.1 the
tunnel is real 3D geometry (a Three.js tube), but its surface art is real
Kolbo-generated illustrated art (`src/assets/tunnel_ring_*.jpg`,
nano-banana-pro styled off `concept-01.png`), matching this same hand-painted
cel-shaded look — not a code-drawn procedural pattern. An earlier version of
this file used a procedural canvas texture for the tunnel wall; that read as
generic/proceduralized 3D instead of the flat, painterly, illustrated feel
the concept art promises, and was replaced. Three ring images
(`tunnel_ring_1/2/3.jpg`) cycle across consecutive tunnel segments
(`src/tunnel/tunnelGeometry.js`) so the wall reads as individual painted ring
sections, not one image tiling/spinning.

## Style sentence

Hand-painted, cel-shaded cutout illustration — rough sketchy linework over
flat-shaded color fields, like a trading card or a paper cutout — never
smooth vector, never photo-real, never modeled 3D. Every sprite reads as a
flat card floating in the tunnel's real 3D depth.

## Palette anchors

- **Raphael green** — `#5f7a3f` body, `#3f5228` shell shadow
- **Mask/wraps red** — `#c23b2e` (Raphael's signature color, per §0's IP
  note — mask + wrist wraps only, not shell/skin)
- **Wood crate brown** — `#8a6a3c` warm mid-brown, `#5a4322` shadow
- **Studded drum steel** — `#8d97a3` cool grey-blue, `#4a525c` shadow
- **Girder steel** — `#5b6570`, darker/cooler than the drum (reads as older,
  more corroded pipe)
- **Pizza gold/red** — `#ffb23c` crust, `#c23b2e` sauce, `#f2e6a8` cheese
- **Ambient sewer teal-green** (environment only, not baked into sprite
  shading) — `#3ce6a0`

## Semantic color

- Warm red (mask/wraps, pizza sauce) = the game's one "friendly warm" accent
  — reserved for Raphael and the pickup, never used on an obstacle silhouette
  (keeps obstacles reading as "the cool-toned stuff", not confusable with
  Raphael himself at a glance).
- Cool greys/steel = obstacles. Consistent across crate/drum/girder despite
  different base hues, so the player's eye groups "cool = dodge this".

## Lighting

- Single light direction: soft overhead-ish key light, slightly camera-side,
  matching the concept art's tunnel ceiling lamps.
- Flat-shaded cel style, 2-3 value bands per surface (base + one shadow +
  one small highlight), rough painterly edge — not smooth airbrushed
  gradients.
- No baked ground shadow, no baked background — every sprite generated on a
  plain white background for local cutout (`tools/kolbo-assets/
  remove_white_bg.py`), per `KOLBO_ASSET_PIPELINE.md`.
- A thin cool rim-light hint (teal-green) on the side facing the tunnel's
  ambient glow keeps every sprite feeling like it's actually sitting inside
  this specific tunnel, not pasted on top of it.

## Sprite manifest

One sprite = one object, per the asset-enhancement skill's cardinal rule.
No baked text/labels on any sprite (HUD is DOM-rendered separately).

| Sprite | File | Notes |
|---|---|---|
| Raphael — ride/lean pose | `raph_ride.png` | Style anchor. Mid-lean, 3/4 rear-ish view reading clearly at a glance despite tunnel depth (§1). No skateboard prop baked in as a separate moving part — full pose in one sprite (POC/MVP scope has no skate-trick animation). |
| Raphael — wipeout/hit pose | `raph_hit.png` | Game-over pose (§6) — edited from the ride-pose anchor, not redrawn from scratch. |
| Crate (obstacle) | `crate.png` | Static wooden crate, no animation. |
| Spinning drum (obstacle) | `drum.png` | Studded metal drum — the *sprite itself* stays static; the spin is done in code (in-plane billboard rotation, §6/§9.1 — never a modeled 3D spin). |
| Pipe girder (obstacle) | `girder.png` | Crossed-pipe girder, wider/taller than the other two — reads as a bigger, more deliberate dodge. |
| Pizza slice (pickup) | `pizza.png` | Floating slice with a small baked sparkle accent (idle bob is code-side, §5.6). |
| Tunnel wall ring (environment) | `tunnel_ring_1/2/3.jpg` | Flat front-on illustrated wall panel — rusty riveted metal, graffiti, moss, teal-green floor glow baked in. Mapped once (non-repeating) per tube segment, cycling through the three so consecutive rings don't look identical (`src/tunnel/tunnelGeometry.js`). Per-section mood is a light color tint on top, not a re-generation. |

Everything renders as a `THREE.Sprite` billboard inside the 3D tunnel
(`entities/*.js`) — square-ish canvases work for all of these; exact aspect
follows each object's natural silhouette.
