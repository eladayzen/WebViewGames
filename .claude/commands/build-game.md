---
description: Run stage 4 (game builder) on a complete build doc to actually build and ship the game
argument-hint: <GameName>
---

Check `pipeline/build-docs/$ARGUMENTS.md` exists. If it doesn't, list
what's actually in `pipeline/build-docs/` and ask which one I meant. If it
exists, invoke the `game-builder` subagent on it. This is the expensive,
long-running stage (real code, real art generation, real credits spent) —
confirm with me before kicking it off if anything about the build doc looks
incomplete or ambiguous, rather than proceeding on a guess.
