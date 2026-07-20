---
description: Approve a proposed macro brief by moving it from macro-briefs/proposed/ to macro-briefs/approved/
argument-hint: <brief-slug>
---

Move `pipeline/macro-briefs/proposed/$ARGUMENTS.md` to
`pipeline/macro-briefs/approved/$ARGUMENTS.md` and update its frontmatter
`status` field from `proposed` to `approved`. If no exact filename match
exists for `$ARGUMENTS`, list what's actually in `proposed/` and ask which
one I meant rather than guessing. Confirm the move, then stop — don't
automatically continue to stage 3 (`/write-brief`) unless I ask for that
too.
