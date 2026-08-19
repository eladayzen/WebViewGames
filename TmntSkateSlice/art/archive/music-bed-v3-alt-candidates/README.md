# Alternate takes for the 2026-08-19 music swap

Feedback: the previous `music_bed.mp3` (see `art/archive/music-bed-v2-relaxed/`)
was still "annoying" even after an earlier slow-down pass, and
HalfShellHustle's `music_theme.mp3` was called out as a positive
reference to match. None of these could be evaluated by ear directly
(no audio playback available) -- the pick was informed by a rough
tempo/spectral-centroid/loudness analysis against HalfShellHustle's
actual track (see the commit message for the full numbers), which pointed
at brightness/clarity as the more likely differentiator than tempo alone.

**Installed as the new `src/assets/audio/music_bed.mp3`:** the version
of "Rooftop Funk Run" NOT kept here (the other Suno take of the same
generation) -- closest match to HalfShellHustle's measured profile on
both tempo (~153 BPM vs. their ~145) and brightness (~2905 Hz spectral
centroid vs. their ~2554 Hz), instrumental funk/brass/wah-guitar,
"1980s cartoon-adventure" prompt direction.

**Kept here as easy swaps, all with a similarly bright/energetic profile**
(all scored much closer to HalfShellHustle's brightness than either
archived prior TmntSkateSlice track):
- `candidate_A_original_bright_funk.mp3` -- the other take from the same
  "Rooftop Funk Run" generation as the one installed. Longer (~139s vs.
  the installed take's ~65s) -- Suno extended past the requested length,
  so it may read as more of a full song with its own arc than a tight
  loop; worth a listen if the installed take doesn't land.
- `candidate_B_breezy_groove.mp3` / `candidate_B_alt2_breezy_groove.mp3` --
  a separate "Breezy Rooftop Groove" generation, aimed at a warmer,
  slightly slower, melodic-hook-forward feel (~100-133 BPM) rather than
  the brighter/faster "Rooftop Funk Run" direction. `_alt2` is short
  (~35s) and would loop more often than the others.

To swap: replace `src/assets/audio/music_bed.mp3` with whichever file
here, matching the original filename requirement in `src/core/assets.js`'s
`AUDIO_MANIFEST` is NOT needed -- that entry references `music_bed.mp3` by
name, so any of these can be dropped in under that exact name.
