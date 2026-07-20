---
description: Run stage 2 (macro game designer) over unsynthesized video-analyst reports to propose macro game briefs
argument-hint: [optional track override, e.g. "tmnt only" or "general only"; or "redo" to force resynthesizing already-covered reports]
---

Check `pipeline/reports/*.md` against the `source_reports` frontmatter of
every existing `pipeline/macro-briefs/{proposed,approved}/*/brief.md`. If
every report is already covered by an existing brief and `$ARGUMENTS`
doesn't say to redo it anyway, tell me that (which reports, which briefs
cover them) and stop — don't invoke the subagent just to regenerate
near-duplicates.

Otherwise, invoke the `macro-game-designer` subagent, pointing it at
whichever reports are new/uncovered, to write proposed macro briefs (each
its own folder with `brief.md` + 4 concept-frame image variations) to
`pipeline/macro-briefs/proposed/`. By default it proposes at least one TMNT
brief and at least one general brief — if `$ARGUMENTS` says otherwise (e.g.
"tmnt only", "general only", "3 general concepts"), pass that instruction
through to override the default for this run. When it's done, list the
proposed briefs for me (name + track + one-sentence hook each) so I can
decide which to approve — don't approve anything yourself.
