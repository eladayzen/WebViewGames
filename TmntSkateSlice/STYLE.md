# TMNT: Skate & Slice — Style Guide

Derived from the approved concept art: `pipeline/macro-briefs/approved/tmnt-skate-strike-catcher/concepts/concept-01.png`.

**Style sentence:** Hand-drawn-over-CG painterly comic style (Mutant Mayhem
movie look) — thick dark linework, saturated warm dusk lighting, soft
painterly cel shading, slightly gritty rooftop-city texture.

## Palette anchors

- **Mike green** — #6FA34A (skin), shadow #3F6B2E
- **Wrap/mask orange** — #E8862B, highlight #FFB25C
- **Shell tan/brown** — #C79A5B, shadow #8A6636
- **Dusk sky gradient** — deep indigo #2B2454 (top) → warm amber-orange #E8783C (horizon)
- **Building silhouette purple** — #4A3B6B
- **Pizza warm red/gold** — crust #E8A23C, sauce/pepperoni #C4432A
- **Ooze glow green** — #4CFF7A core, #1E8F3E canister body, glass #DCEFE0
- **Bomb hazard** — near-black body #1B1B1F, hazard stripe amber-yellow #F2C230, fuse spark #FF7A2E

## Semantic color (sacred)

- Amber/yellow hazard stripes + spark = danger (bomb only — never reused elsewhere)
- Warm gold/orange = reward (pizza, score)
- Glowing green = power-up (ooze only)

## Light direction

Warm dusk key light from upper-right (matching the concept's horizon glow),
soft cool-purple fill/shadow on the opposite side. Every sprite gets a
highlight plane toward upper-right and a shadow shape toward lower-left, plus
a thin warm rim light on silhouette edges.

## Notes

- This is a static-camera, non-scrolling catcher — no parallax layer stack
  needed (§5.5 of the build doc). Backgrounds are single full-canvas static
  images per stage, not layered/scrolling.
- Falling items must be legible at a glance and small size: bomb reads as
  stark black/hazard-yellow (cold, dangerous) against the warm pizza/ooze
  palette — never let the bomb read "warm" or friendly.
- Camera framing is pulled back from the concept's tight crop (§5.5) — plan
  character proportions knowing Michelangelo renders smaller in-game, roughly
  lower-third-to-half of screen height, with more open sky above him.
