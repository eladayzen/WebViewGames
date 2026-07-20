---
description: Approve a proposed macro brief by moving its folder from macro-briefs/proposed/ to macro-briefs/approved/
argument-hint: <brief-slug>
---

Move the folder `pipeline/macro-briefs/proposed/$ARGUMENTS/` to
`pipeline/macro-briefs/approved/$ARGUMENTS/` (the whole folder — `brief.md`
plus its `concepts/` subfolder) and update `brief.md`'s frontmatter `status`
field from `proposed` to `approved`. If no exact folder match exists for
`$ARGUMENTS`, list what's actually in `proposed/` and ask which one I meant
rather than guessing. Confirm the move, then stop — don't automatically
continue to stage 3 (`/write-brief`) unless I ask for that too.
