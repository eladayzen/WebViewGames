---
description: Run stage 4 (game builder) on a complete build doc to actually build and ship the game
argument-hint: <GameName> [poc|mvp|post-mvp — defaults to mvp if omitted]
---

Check `pipeline/build-docs/$ARGUMENTS.md` exists (the `GameName` is the
first word of `$ARGUMENTS`; the rest, if any, is a tier override). If the
doc doesn't exist, list what's actually in `pipeline/build-docs/` and ask
which one I meant. If it exists, invoke the `game-builder` subagent on it,
telling it explicitly which tier to build — POC or MVP, defaulting to MVP
if no tier was given. Only pass through "post-mvp" if I typed it explicitly
here; that's never an implicit default. This is the expensive, long-running
stage (real code, real art generation, real credits spent) — confirm with
me before kicking it off if anything about the build doc looks incomplete
or ambiguous, rather than proceeding on a guess.
