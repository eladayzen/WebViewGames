---
description: Run stage 1 (video analyst) on any unprocessed topic folders in pipeline/videos-inbox/
---

List the subfolders in `pipeline/videos-inbox/` (each one is a topic: a
game, a cluster of similar games, or a genre — containing one or more
videos and an optional `notes.txt`) and the reports already in
`pipeline/reports/`. For every topic folder that doesn't already have a
matching `pipeline/reports/<topic-name>.md`, invoke the `video-analyst`
subagent (one invocation per folder, they can run in parallel) to process
it as a whole. If there's nothing new to process, say so and stop — don't
re-run reports that already exist.
