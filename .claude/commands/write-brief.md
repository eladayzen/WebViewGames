---
description: Run stage 3 (brief writer) on an approved macro brief to produce a complete build doc
argument-hint: <brief-slug>
---

Check `pipeline/macro-briefs/approved/$ARGUMENTS.md` exists. If it doesn't,
list what's actually in `approved/` (and separately, what's still sitting
unapproved in `proposed/`, so it's clear if that's the mix-up) and ask which
one I meant — never fall back to a brief that's still in `proposed/`. If it
exists, invoke the `brief-writer` subagent on it to produce
`pipeline/build-docs/<GameName>.md`.
