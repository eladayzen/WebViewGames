---
description: Run stage 2 (macro game designer) over all current video-analyst reports to propose macro game briefs
---

Invoke the `macro-game-designer` subagent to read everything in
`pipeline/reports/` and write proposed macro briefs to
`pipeline/macro-briefs/proposed/`. When it's done, list the proposed briefs
for me (name + one-sentence hook each) so I can decide which to approve —
don't approve anything yourself.
