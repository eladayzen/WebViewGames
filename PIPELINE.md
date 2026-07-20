# WebViewGames Agent Pipeline

A four-stage agent system that turns gameplay-reference videos into a
shipped GoBalance game, with a human approval gate before real build effort
is spent. v1 — every stage is triggered manually. A more automated version
(a Manager agent orchestrating the chain) is a deliberate later phase, not
built yet — see "Roadmap" below.

## The stages

| # | Agent | Command | Reads | Writes |
|---|---|---|---|---|
| 1 | `video-analyst` | `/analyze-videos` | `pipeline/videos-inbox/<topic>/` (videos + optional `notes.txt`) | `pipeline/reports/<topic>.md` |
| 2 | `macro-game-designer` | `/propose-briefs` | `pipeline/reports/*.md` | `pipeline/macro-briefs/proposed/<slug>/` (`brief.md` + 4 concept-frame images) |
| — | *(you)* | `/approve-brief <slug>` | — | moves a brief folder `proposed/` → `approved/` |
| 3 | `brief-writer` | `/write-brief <slug>` | `pipeline/macro-briefs/approved/<slug>/` | `pipeline/build-docs/<GameName>.md` |
| 4 | `game-builder` | `/build-game <GameName>` | `pipeline/build-docs/<GameName>.md` | a new game folder at repo root, shipped into the SDK |

Agent definitions: `.claude/agents/*.md`. Commands: `.claude/commands/*.md`.

## The product constraint every stage (1-3) respects

GoBalance is a **physical** product — input is a board tilt mapped to
roughly 4 directions (up/down/left/right), not a keypress. Two rules, baked
into stages 1-3's own instructions so they don't have to be re-explained
per run:

1. Demanding **all four directions fast/reflexively** is a real physical-
   exertion problem, not just a controls-complexity one — avoid concepts
   that need it.
2. **2D only**, at this stage.

Stage 3 additionally picks (and states) which of the SDK's two input-
forwarding modes a game needs — digital synthetic arrow-keys vs. analog
`window.__gbSensor` — at a conceptual level. The full technical contract for
*implementing* that choice lives in `GOBALANCE_SDK.md`, which is
**deliberately scoped to stage 4 only** — the other three stages don't need
Unity-host wiring details, DOM ids, or build config to do their jobs.

## The two tracks: general and TMNT

Every `/propose-briefs` run defaults to proposing **at least one TMNT-track
brief and at least one general-track brief** (unless you explicitly say
otherwise for that run) — WebViewGames ships both under an active TMNT
licensing deal. TMNT concepts should aim for the *Mutant Mayhem*-era movie
art style — reference stills live at `/Users/eladayzen/Documents/tmnt/` and
get fed into that brief's concept-frame generation as style reference.

## Concept art on every proposed brief

Stage 2 doesn't just pitch in text — for every brief it writes, it also
writes a concept-frame image prompt and generates **4 variations** via
Kolbo (`generate_image`, `num_images: 4`), saved into that brief's
`concepts/` folder alongside the prompt used. Review the images alongside
`brief.md` when deciding what to approve; stage 3 carries the approved
concept art forward as the art-direction anchor for stage 4.

## Input: the videos-inbox folder structure

```
pipeline/videos-inbox/
  <topic-name>/            # a game, a cluster of similar games, or a genre
    some-clip.mp4
    another-clip.mov
    notes.txt              # optional — your own thoughts on this topic as a whole
                            # (notes.rtf etc. also fine — any notes.* file works,
                            #  converted via macOS textutil if not plain text)
```

If the notes flag the footage itself as weak/unrepresentative, stage 1 will
run a couple of `WebSearch` queries for stronger genre examples rather than
over-indexing on it, keeping that research clearly separate from what it
actually observed in the video.

One report per folder (not per video) — `notes.txt` covers the whole topic,
and stage 1 synthesizes all videos in the folder together rather than
writing N disconnected reports. Stage 1 reproduces `notes.txt` **verbatim**
in its report (not a paraphrase), and stage 2 is required to quote back any
note that directly shaped a brief in that brief's "Inspired by" section —
so your own notes are traceable through both stages, not just trusted to
have been read.

## Why videos need a preprocessing step

No tool in this environment reads video directly (Read handles images/PDFs/
notebooks, not video). Stage 1 samples each video down to a handful of
stills first (`tools/pipeline/sample_frames.py`, using `imageio_ffmpeg`'s
bundled static ffmpeg binary — this machine has neither system ffmpeg nor
Homebrew, so `pip3 install imageio-ffmpeg` is the actual dependency, not a
system package). Confirmed working 2026-07-20 against a synthetic test clip.

## The approval gate

Stage 2 only ever writes to `macro-briefs/proposed/` — nothing downstream
acts on a brief sitting there. `/approve-brief <slug>` is the explicit human
action that moves the whole brief folder (`brief.md` + `concepts/`) to
`macro-briefs/approved/` (and flips `brief.md`'s frontmatter `status`),
which is the only thing stage 3 is allowed to read from. This is
intentionally a manual, deliberate step, not a formality to streamline
away.

## Roadmap

- **v1 (now):** every stage triggered manually via its slash command. This
  doc + the four agent definitions are it.
- **v2 (later, not started):** a Manager agent that drives the chain more
  automatically — watching `videos-inbox/` for new topic folders, running
  stage 1 without being asked, surfacing stage 2's proposals for approval,
  etc. Deliberately deferred until the manual version has proven the
  file-based handoffs actually work — the same `pipeline/` structure is
  what a Manager agent would drive too, just triggered by it instead of by
  you.

## Related docs

- `KOLBO_ASSET_PIPELINE.md` — the asset-generation side stage 4 leans on.
- `GOBALANCE_SDK.md` — the shipping contract, stage 4 only.
- `brief-for-webgames.md` — general web-minigame tech constraints (engine/
  framework choice, etc.) stage 4 still draws on, **except** where it
  conflicts with `GOBALANCE_SDK.md` on build/bundling output (module format,
  `file://` assumptions) — the SDK doc wins there, it's newer and verified
  against the actual Unity-side source.
- `TmntRunner/gdd-ninja-runner.md` — the depth/format reference for stage
  3's output.
