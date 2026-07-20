# macro-briefs/proposed

One folder per candidate game concept, written by the `macro-game-designer`
subagent (via `/propose-briefs`):

```
<slug>/
  brief.md          # the pitch — includes track: general | tmnt
  concepts/
    prompt.txt       # concept-frame image prompt used
    concept-01.png   # 4 generated variations to react to
    concept-02.png
    concept-03.png
    concept-04.png
```

Defaults to at least one `general` and one `tmnt` brief per run. Awaiting
human review — approve one with `/approve-brief <slug>`, which moves the
whole folder to `../approved/`. See `../../../PIPELINE.md`.
