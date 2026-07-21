# SideBySideCatcher

## Source

- Folder: `pipeline/videos-inbox/SideBySideCatcher/`
- Video: `dino-sidebyside.mp4` — approx. 53.6 seconds long.
- Notes file: `dino context.rtf` (RTF, converted via `textutil -convert txt -stdout`).
- Frames sampled: 12 frames from the single video, at ~3-second intervals
  across its ~54s runtime (`tools/pipeline/sample_frames.py ... --interval-sec 3
  --max-frames 12`). This is a sparse sample (roughly 1 frame per 4.5s of
  footage) — treat timing/scoring specifics below as approximate, not verified
  frame-by-frame.

## Notes, verbatim

Amit's notes file (`dino context.rtf`) contained the following, reproduced in
full:

> This dino-sidebyside.mp4 file is a very bad/low product value example from
> this genre - the design, the animation, even the tempo of the game - nothing
> really good here - just for you to understand the general mechanics - then
> the agents are welcome to bring better references and knowledge from online.
>
> For this genre I want us to focus on a 2d light atmosphere - humoritstic
> ninja turtles game - where a ninja turtle (maybe option to choose one later
> on)

(The note appears to end mid-thought — "where a ninja turtle (maybe option to
choose one later on)" trails off without a closing clause. This is reproduced
exactly as it appears in the source file; nothing was cut by the conversion
step — the raw RTF file is only 848 bytes and the converted text matches
that size, so this is how Amit's note actually ends, not a read error.)

Per Amit's own framing, this report treats the provided video strictly as a
"understand the mechanics" reference, not a quality bar, and includes a
separate **External research** section below on stronger, better-known
examples of the genre, as he explicitly invited.

## What's happening

A single red/blue T-Rex-style dinosaur character stands on a flat grassy
ground strip near the bottom of the screen, in front of a static pale-blue sky
with a couple of layered cloud bands (no parallax or scrolling background
detected — the horizon and clouds stay fixed while only the dino and the
falling items move). The dinosaur runs in place through a fixed animation
loop and shuffles left and right along the ground to reposition itself under
falling objects.

Sweet-themed items — an ice cream bar/popsicle, a cupcake, a lollipop, a wrapped
candy — fall from the top of the screen at varying horizontal positions and
apparently varying fall speeds. The dino appears to open its mouth/lunge to
"catch" items that reach ground level near it. Alongside the treats, a gray
weight/anvil-style object (marked "16", like a cartoon barbell weight) also
falls periodically and reads as a hazard to dodge rather than catch, given its
visual contrast with the candy items (dark metallic vs. bright confectionery
colors).

A count-up timer in mm:ss format sits at the top center (values seen across
frames: 00:22, 00:24 x2, 00:26, 00:27, 00:28, 00:30, 00:31, 00:38, 00:40,
00:46 x2 — consistent with elapsed session time, not a countdown). A "LEVEL 2"
banner appears at one sampled frame, confirming there is level/stage
progression of some kind, though the sample doesn't show what triggers it
(score threshold, time, or catch count are all plausible — see Gaps). A small
icon (looked like a bug/gem, low-res) appears near the dino's mouth in a couple
of frames, possibly a caught-item or combo indicator, but it's too small and
inconsistent across frames to read with confidence. Standard mute and close
(X) icons sit in the top-right corner, indicating this is packaged as an
embeddable/webview mini-game (consistent with the rest of this pipeline's
target format).

Only one video was provided, so there's nothing to compare across multiple
clips — everything above is from the single `dino-sidebyside.mp4`.

## Genre & comparables

This is a straightforward **catcher game** — a genre where the player moves a
character/receptacle horizontally along a fixed baseline to catch (or dodge)
objects falling from above. It's one of the oldest video game genres (Atari's
*Avalanche*, 1978) and was popularized by Activision's *Kaboom!* (1981), where
the player slides buckets left/right to catch bombs dropped by a "Mad Bomber"
and avoid missing them. The dino-catching-treats framing here is a reskin of
that same core loop — reward items to catch, one clearly-marked hazard item to
avoid, escalating pace/level over time.

## Core mechanic(s)

1. **Horizontal-only positioning** — move the character left/right along a
   single ground line to be underneath the item you want when it lands.
2. **Catch-vs-avoid discrimination** — distinguish "good" falling items
   (treats, worth points) from the "bad" one (the weight, presumably costs a
   life/points or ends the run on contact) and react accordingly — this is
   really the same input as #1, just applied with opposite intent (seek vs.
   flee) depending on what's falling.
3. **Escalation over a level/session** — a "LEVEL 2" transition implies pacing
   or difficulty increases over time (more items, faster falls, and/or denser
   hazard mix), though the sample can't confirm the exact trigger or curve.

## Input demand, explicitly checked against GoBalance

This reads as effectively a **2-direction (left/right) game**, not a
4-direction one — there's no vertical player movement at all in the sampled
footage; only horizontal repositioning along the ground. That's a strong fit
for a lean-based physical board: a left/right catcher maps almost directly
onto left/right tilt, with no need to invent an up/down input for this core
loop.

The main open question is **pace, not direction-count**. Even at a sparse
12-frame sample, multiple falling items are often on screen simultaneously
(e.g. a treat and the hazard weight visible at once, frame timestamps ~3s
apart showing different items at different heights), which suggests the
"real" game likely asks for reasonably quick left/right corrections to hit
one falling object and dodge another in short order. Given this is explicitly
flagged by Amit as a low-quality/low-tempo example, the actual tempo of a
well-made version of this genre could be faster than what's visible here —
that's a real risk for a physical-lean board, where quick alternating
left-right corrections are more strenuous than a keypress or thumb-swipe.
**Recommendation for stage 2:** treat this as a 2-direction mechanic (good
fit) but budget for pacing carefully — fall speeds and item density should be
tuned generously slow/spaced-out relative to typical mobile catcher-genre
tempo, since GoBalance's lean input can't reliably do fast alternating
corrections the way a touchscreen swipe can.

## Visual style notes

- Flat, simple 2D cutout-style art: single static background (sky + two cloud
  bands + grass strip), no environmental variety in the sample.
- Character (T-Rex) uses a single running-in-place animation cycle; no
  distinct "catch" or "hit" animation was clearly identified in the sampled
  frames (see Gaps).
- Falling items are rendered as flat, bright, high-contrast icon-style sprites
  (ice cream, cupcake, lollipop, candy) against the pale sky — readable at a
  glance, which is a reasonable pattern to carry forward regardless of the
  weak execution here.
- The hazard item (gray "16" weight) is deliberately drab/desaturated against
  the candy-colored treats — a legible "avoid this" visual language worth
  reusing.
- Overall production value is low, per Amit's own note and consistent with
  what the frames show: stiff single-pose animation, no background depth or
  parallax, plain sans-serif UI text. This should not be treated as a visual
  bar for the ninja-turtle direction Amit wants — see notes section above.

## Gaps / low-confidence areas

- **Scoring rules**: no visible score counter was captured in any sampled
  frame (only the elapsed timer and one "LEVEL 2" banner) — couldn't confirm
  whether points, lives, or a fail-state exist, or what catching/missing/
  hitting the hazard actually does mechanically.
- **Level-up trigger**: "LEVEL 2" appeared once in the sample; unclear whether
  progression is time-based, score-based, or catch-count-based, and what
  changes between levels (speed? item variety? hazard frequency?).
- **Fail/lose condition**: never observed a game-over or "hit" state in the
  sample — unclear if touching the hazard ends the run, costs a life, or just
  deducts points.
- **Small on-screen icon** near the dino's mouth in a couple of frames — too
  low-resolution and inconsistent to identify confidently (possibly a caught-
  item indicator, combo counter, or unrelated sprite in motion).
- **Exact fall speed / spawn cadence** — only having ~1 frame per 4.5s of a
  53s clip means the true density and pacing of falling items (how many are
  ever on-screen at once, how fast they descend) is only loosely inferable,
  not measured.
- Only one reference video was provided for this topic, so there's no
  cross-video comparison to sanity-check any of the above against a second
  playthrough.

## External research

Per Amit's explicit invitation ("agents are welcome to bring better references
and knowledge from online"), since the provided footage was flagged as
low-quality:

- The catcher genre's originator is generally credited as Atari's
  **Avalanche** (1978), with **Kaboom!** (Activision, 1981) as the game that
  popularized it — the player slides water buckets left/right on a paddle
  controller to catch bombs dropped by a "Mad Bomber," with speed escalating
  over time and a miss ending that bucket's usefulness. This is structurally
  almost identical to what's in `dino-sidebyside.mp4` (single hazard type,
  escalating drop rate, horizontal-only repositioning), just reskinned.
- Modern browser/mobile versions of the same loop follow the same shape:
  e.g. "CorgiChomp" (move a corgi left/right to catch falling bones) and
  various "Catch the Balls / Catch the Fruit" mini-games — all built around
  the identical horizontal-catch, avoid-the-bad-item, escalating-speed loop,
  usually with a lives or points system rather than an instant-fail hazard.
  This reinforces that the genre's fun tends to come from tempo escalation
  and item-variety/juice rather than mechanical complexity — there isn't a
  "deeper" version of this mechanic hiding in better references; the genre is
  inherently simple, and quality differentiation comes from art, animation
  feedback (catch/hit reactions, screen shake, combo streaks), and pacing
  tuning rather than added input complexity. That's a relevant data point for
  stage 2: this genre doesn't need extra directions or depth to feel good, it
  needs polish and tempo control, both of which suit GoBalance well if paced
  conservatively.

Sources consulted:
- [Catcher video game overview — TheAlmightyGuru](https://www.thealmightyguru.com/Wiki/index.php?title=Catcher_video_game)
- [Kaboom! (video game) — Wikipedia](https://en.wikipedia.org/wiki/Kaboom!_(video_game))
- [CorgiChomp — GitHub](https://github.com/joycechau/CorgiChomp)
