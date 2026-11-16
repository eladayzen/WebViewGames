# Sewer Shred — light TMNT look test (branch `claude/sewer-shred-look`)

Reference: `~/Documents/explaine to claude/55/image (1).png`.
Goal: less dark, less noisy, a clean cartoon TMNT look rather than a gritty, Dark Knight one.

## Where we are vs the target (measured on the frame, HUD cropped out)

| | Reference | Current build |
|---|---|---|
| Mean brightness (0–255) | **56** | 31–32 |
| Saturation | **67** | 147–163 |
| Pixels near black (<40) | **23%** | 72–74% |

So the target is about 1.8× brighter, about half the saturation, and roughly a third as much black.

## What makes the reference read the way it does

1. **Walls:** flat slate-grey concrete panels with thick black ink grout lines that form rings plus longitudinal seams. There is almost no texture noise inside a panel.
2. **Decals:** a few lime slime splats on the walls give the green accent. The walls themselves are not tinted green or rusty.
3. **Lighting:** even and soft. There is no hotspot or vignette, and the far end fades to a mid blue-grey rather than black.
4. **Water:** a narrow olive-brown channel with some floating debris. The splashes are white and cyan cartoon shapes with ink outlines.
5. **Big side portals:** bolted concrete flanges around black holes, which is our junction pipe.
6. **Objects:** crates and grates are flat-shaded with outlines. The hero is cel-shaded with a black outline.

## Plan, in order (each step gets a screenshot and the three numbers above)

1. **Light and grade.** Fog and background go to blue-grey (around `#3e4c55`) and the fog is pushed out. Hemisphere light goes up, and the headlamp gets wider and softer. Tone mapping switches to AgX/neutral at a lower exposure so flats stay flat. I'll drop `PATINA_GRADE` and the `antiRepeat` darkening. *Target: mean brightness ≥ 50.*
2. **New wall art (Kolbo, illustrated, per the art rule).** One seamless tile: grey concrete panels with bold black ink seams, cel style, light stains only. I'll also make a slightly warmer grey variant so zones still change. These replace the four rust/patina zones (parked, not deleted).
3. **Slime decals.** A Kolbo-generated set of lime splats (transparent PNGs), scattered sparsely on the walls as quads, the way junctions are placed.
4. **River.** Recolour it to a lighter olive-brown and narrow the band a little, with a few floating debris bits. Spray becomes white/cyan cartoon splash sprites with an ink edge, replacing the grey dots.
5. **Ink outlines and toon shading.** Use an inverted-hull black outline and banded toon shading on Raphael and the board. The board turns yellow to match the reference. Foot Soldiers get a black outline instead of the magenta glow, plus the same treatment for crates and grates.
6. **Junction portals.** A thick bolted concrete flange around the mouth, as in the reference, while keeping the waterfall.
7. **Pass/fail.** A side-by-side contact sheet against the reference, with the three numbers inside ±15% of the reference, at 60 fps headless.

## Not changing

Gameplay, cameras, modes, the HUD and the attack audition.

## PINNED: "stage 1" — the old patina walls under the new light grade (Elad liked it, 2026-11-16)

Elad saw an in-between frame while the look was changing and said it "also looked good". It is
**stage 1** of this branch: the original Kolbo patina/rust zone art, unchanged, rendered with the
new light grade, before the concrete tiles went in. Screenshots: `look-ref/stage1-patina-light-grade*.jpg`.
Nothing is done with it yet — kept as a candidate look / possible zone.

To recreate it exactly:
- zones = the four patina zones (`rust_patina`, `pat_a`, `rust_hazard`, `pat_c`, around 3/3/3/4), load names `wall_rust_patina`… back in `main.js` boot
- `PATINA_GRADE = { tint: 0xffffff, fog: 0x4a5860, hemi: [0xf2f6f6, 0x6e7876] }`
- `antiRepeat` wall shader body:
  ```glsl
  diffuseColor.rgb *= 0.9 + 0.2 * macro + 0.12 * (macro2 - 0.5);
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.35) * 1.25 + 0.03;   // 65% desaturate + lift
  ```
- renderer `NeutralToneMapping`, exposure **1.15**; `FOG = { color: 0x4a5860, near: 30, far: 200 }`
- hemi `0xf2f6f6 / 0x6e7876`, 3.0; headLamp `0xfff2dc, 70, 60, 1.0`; slimeLight `0xa8c080, 6` (±1.5)
- graffiti still visible; river was still the old painted sewage
- measured: brightness 49–59, saturation 65–86, near-black 36–45%
