# Kolbo MCP — Game Asset Pipeline

How this repo generates 2D game art via the Kolbo MCP server. This is the
concrete, tested-and-working companion to the `game-assets-enhancement`
skill (installed at `~/.claude/skills/game-assets-enhancement`, personal —
available in every project). That skill defines the *process* (style guide →
manifest → generate → parallax); this doc pins down the exact Kolbo tool
calls, model IDs, and gotchas so the process doesn't have to be
re-discovered per game. Last verified: 2026-07-20.

## The four tools you actually need

| Step | Tool | Model | Notes |
|---|---|---|---|
| Style anchor (first sprite of a set) | `generate_image` | `nano-banana-pro` or `gpt-image-2` | text-to-image, no reference |
| Every sprite after the anchor | `generate_image_edit` | `nano-banana-pro/edit` | `source_images: [anchor_url]`, style-matched prompt |
| Local file needs to become a Kolbo URL (e.g. an existing placeholder you're relighting) | `upload_media` | — | `source_images`/`reference_images` need URLs, not local paths |
| Background cutout | **do this locally, not via Kolbo** | — | see "Background removal" below |

Always pass a specific `model` — omitting it triggers Kolbo's Smart Select
auto-pick, which is inconsistent run to run. Never pass `project_id` unless
the user has actually named a Kolbo project for this game; omitting it is
correct and lands the generation in the default bucket.

## Style anchor generation

```
generate_image(
  prompt: "<subject>, <style guide sentence>, plain solid white background,
           isolated single object, no baked ground shadow, no text",
  model: "nano-banana-pro",   // or "gpt-image-2" -- see comparison below
  aspect_ratio: "1:1"          // match the object's natural proportions if not square
)
```

Returns `urls[0]` — a Kolbo CDN URL. That URL is what every subsequent
`generate_image_edit` call in this set references as the style reference.

### gpt-image-2 vs nano-banana-pro (tested 2026-07-19, same prompt, same fox-sprite subject)

- **`gpt-image-2`** — tighter cel-shading, cleaner line work, actually
  respects "no baked ground shadow" / plain-background instructions.
  **Default choice for anchors and any sprite the cutout step depends on.**
- **`nano-banana-pro`** — softer painterly rendering, nicer fur/rim-light
  texture, but tends to ignore "no baked shadow" and paints a cast shadow
  under the subject anyway. That shadow is a similar tone to the subject
  (not near-white), so it **survives background cutout** as an opaque blob.
  Usable, but expect to explicitly re-prompt against the shadow, or manually
  mask it, or just prefer gpt-image-2 for anything that needs a clean cutout.

### nano-banana-pro/edit vs gpt-image/1.5-image-to-image for POSE changes (tested 2026-07-21)

The comparison above is for anchor/first-generation quality. For editing an
*existing* character into a meaningfully different **pose** (not just a
restyle), the two edit models are not interchangeable:

- **`nano-banana-pro/edit`** tends to under-commit on a pose change that
  deviates significantly from the reference -- across several attempts at
  turning a wide open running stride into legs actually crossing (a ninja
  cross-step), it kept returning either a near-copy of the reference pose
  or drifted off-model (flatter shading, different face/proportions) on the
  more dramatic ask, without ever landing the actual requested pose.
- **`gpt-image/1.5-image-to-image`** followed the same literal pose
  instruction correctly on the first or second try, while staying on-model
  (same colors/linework/proportions as the reference). It was also the
  model that succeeded at generating new poses (attack wind-up, hit flinch)
  purely from a text description + reference image.

**Practical rule:** default to `nano-banana-pro/edit` for restyles/prop
removal/proportion fixes (small deltas from the reference), but reach for
`gpt-image/1.5-image-to-image` when the ask is "put this character in a
different pose" and the first attempt on `nano-banana-pro/edit` reverts to
something close to the input instead of actually changing the pose.

### Combining a good pose with corrected proportions/style (dual reference)

When an existing sprite already has a great **pose** but the wrong
**build/props** (e.g. an older, taller/thinner character generation, or one
with a prop -- like a skateboard -- that needs removing), don't redraw the
pose from scratch. Pass **two** `source_images`: the existing pose as the
first, and a current on-model reference (e.g. the game's already-correct
idle sprite) as the second, and call them out explicitly in the prompt --
`generate_image_edit` supports referring to images by ordinal position:

```
generate_image_edit(
  prompt: "Using the exact same character build, proportions, and style as
           the SECOND reference image, redraw him in the exact same [pose
           description] as the FIRST reference image. Remove/change
           [prop/detail] ...",
  source_images: [existing_pose_url, current_style_reference_url],
  model: "gpt-image/1.5-image-to-image"
)
```

This reliably grafted a correct no-prop, correct-proportions build onto an
already-good pose in one shot, rather than needing several rounds of
descriptive-prompt iteration to reinvent a pose that already existed.

## Style-referenced sprite generation

```
generate_image_edit(
  prompt: "using the exact same hand-painted cartoon style as this reference
           image, <new subject>, plain solid white background, isolated
           single object, no baked ground shadow",
  source_images: ["<anchor_or_prior_sprite_url>"],
  model: "nano-banana-pro/edit",
  aspect_ratio: "1:1"
)
```

Chain the first good result of a set as the reference for the rest of that
set (not always back to the original anchor) so drift stays low across many
sprites.

## Background removal — Kolbo's `removebg` is currently broken, use local cutout

**Do not rely on `edit_image(operation: "removebg")`.** As of 2026-07-20 it
fails 100% of the time with `Generation document not found` — tested on:
- URLs fresh off a `generate_image` response (same turn)
- The same URLs a few minutes later
- URLs re-registered via `upload_media` first (still failed)
- A brand-new generation, called immediately (still failed)

This is a Kolbo-side issue (the tool errors before it can even run the
removal), not something fixable by URL formatting or retry timing. Re-check
periodically, but don't spend time debugging it further per-run.

**Working substitute:** every anchor/edit prompt already asks for "plain
solid white background, isolated single object" — so key out near-white
locally instead. Script lives at
[`tools/kolbo-assets/remove_white_bg.py`](tools/kolbo-assets/remove_white_bg.py):

```bash
python3 tools/kolbo-assets/remove_white_bg.py <downloaded_input.png> <output.png>
```

What it does (matches the skill's Phase 2 steps 3-4 in one pass):
1. Keys near-white pixels to transparent (threshold 245/255 per channel),
   with a linear feather band (225–245) so soft anti-aliased edges dissolve
   instead of leaving a white fringe.
2. Crops to the alpha bounding box.
3. Downscales so the long edge is ≤512px (override with `--max-edge`, e.g.
   larger for full-screen backdrops per the skill's guidance).

Requires Python 3 + Pillow (`pip3 install pillow`) — already confirmed
available in this environment.

**Caveat:** this only works because the prompt keeps the background flat
near-white. It is not a real subject/background segmentation — a sprite
with a baked non-white shadow (see nano-banana-pro note above) will keep
that shadow as an opaque blob, since it's never close to white. If that
happens, either fix it at the prompt level (re-generate) or mask it by hand;
don't try to widen the threshold to catch it, that starts eating legitimate
light-colored parts of the subject.

## Full flow, end to end

1. `generate_image` (anchor, `nano-banana-pro` or `gpt-image-2`) → get URL.
2. Download the URL locally (`curl -sL -o art/tmp/<name>.png <url>`) — Kolbo
   URLs are remote, everything downstream needs a local file.
3. `generate_image_edit` (model `nano-banana-pro/edit`, `source_images:
   [anchor_url]`) for every other sprite in the set → download each.
4. `python3 tools/kolbo-assets/remove_white_bg.py <in> <out>` per sprite.
5. Sprite lands trimmed, transparent, ≤512px — ready to drop into the
   game's art folder per the skill's per-game manifest.

## Known gotchas

- `source_images` / `reference_images` on Kolbo image tools require URLs.
  Local files need `upload_media` first.
- `project_id` is per-call, not sticky — irrelevant here since we don't use
  named Kolbo projects for these games, but worth remembering if that
  changes.
- `edit_image` is for *mechanical* ops only (upscale/reframe/removebg/
  enhance_skin) — content edits ("make it night", "add a hat") go through
  `generate_image_edit`, not `edit_image`.
- `list_models` responses are large (100k+ tokens for `format: "json"`) —
  grep the saved tool-result file rather than reading it whole if you need
  to re-verify a model ID or cap.
- `upload_media` re-encodes a transparent PNG (JPEG or indexed palette),
  which can corrupt the transparent area into a non-white/noisy color
  instead of clean white -- breaks the "plain white background" assumption
  the cutout/edit pipeline depends on if you re-upload an existing sprite
  as an edit source. Fix: flatten the PNG onto a real white RGB background
  locally first (`Image.new('RGB', size, (255,255,255)).paste(im,
  mask=im.split()[3])` in Pillow), then upload that.
