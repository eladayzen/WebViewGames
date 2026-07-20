---
description: Run stage 2 (macro game designer) over all current video-analyst reports to propose macro game briefs
argument-hint: [optional track override, e.g. "tmnt only" or "general only"]
---

Invoke the `macro-game-designer` subagent to read everything in
`pipeline/reports/` and write proposed macro briefs (each its own folder
with `brief.md` + 4 concept-frame image variations) to
`pipeline/macro-briefs/proposed/`. By default it proposes at least one TMNT
brief and at least one general brief — if `$ARGUMENTS` says otherwise (e.g.
"tmnt only", "general only", "3 general concepts"), pass that instruction
through to override the default for this run. When it's done, list the
proposed briefs for me (name + track + one-sentence hook each) so I can
decide which to approve — don't approve anything yourself.
