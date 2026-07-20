# videos-inbox

One subfolder per topic — a game, a cluster of similar games, or a genre
you want covered together:

```
videos-inbox/
  <topic-name>/
    some-clip.mp4
    another-clip.mov
    notes.txt          (optional — your own thoughts on this game/these
                         videos/this genre, covering the whole folder.
                         notes.rtf etc. also fine — any notes.* file works)
```

If a reference clip is low-quality or not representative, say so in the
notes — the video-analyst will pull in outside research on the genre
instead of over-indexing on weak footage.

Run `/analyze-videos` to have the video-analyst stage process any new
folders — one report per folder, not per video. See `../../PIPELINE.md` for
the full system.
