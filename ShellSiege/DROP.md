# Shell Siege — ready for the Unity drop

Built and verified from `dist/`, not from the dev server. 161 tests pass.

```
npm test && npm run build && node tools/manifest.mjs
```

## What is in the build

| | |
|---|---|
| `dist/` | **3.46 MB**, 13 files |
| biggest | `raphael.glb` 925 KB · `clips.json` 566 KB · `skeleton.glb` 410 KB · `floor_warm.webp` 516 KB |
| tests | 161 pass, 0 fail |

## Verified on the built output, served over HTTP

Not `file://` — ES modules are blocked there, so a production build can only
be sanity-checked over real HTTP (`npx vite preview`).

- Boots, loading overlay clears, no console errors
- A run plays: 13 s → 5 kills → level 2 → choice screen opens and freezes the run
- Losing works: died at 12 s, `#gameover-overlay` appeared, card read **4 down**
- `#restart-button` resets in place — health, level, build, kills, timer — no page reload
- `__pumpFrames` present, `#gb-back` present, dev readout **closed** by default
- `manifest.txt`: 13 lines, 13 files on disk, lists no `.meta`, does not list itself

## What the project owner still has to do

This is phase 2 in `GOBALANCE_SDK.md` and it is deliberately not done here.

1. Copy `dist/` into **`Assets/StreamingAssets/TurtlesActionGame/`** on the
   branch that is currently checked out. That name is SETTLED -- see below.
2. Open the Unity Editor so it imports the new files and **writes their
   `.meta`s** — that cannot be done from outside the Editor.
3. **Count the metas in BOTH directions before committing.** A re-drop renames
   every hashed file, so deleting the old folder takes the old `.meta`s out
   with the old names and leaves the new files bare. That state passes an
   orphaned-`.meta` check perfectly, because the orphans left with the
   filenames they belonged to:
   ```bash
   c=$(find "$DST" -type f -not -name '*.meta' | wc -l)
   m=$(find "$DST" -name '*.meta' | wc -l)   # must equal c once Unity has imported
   for f in "$DST"/*; do case "$f" in *.meta) ;; *) [ -e "$f.meta" ] || echo "NO META: $f";; esac; done
   ```
4. Scene, `WebGameController`, Build Settings and `GamesList` — owner's job.

## The save key is `TurtlesActionGame` — settled

`FirestoreStructureStrings.WebGameKey()` derives each game's save and score key
from its **StreamingAssets folder name**, and renaming it after launch orphans
every player's data with no migration. Elad settled it on 17 Nov:
**`TurtlesActionGame`**.

So the drop folder is `Assets/StreamingAssets/TurtlesActionGame/`.

**The source project stays `ShellSiege`, and that is fine.** The key comes from
the StreamingAssets folder, not from the repo directory, so the two do not have
to match -- and the one that must never change is the one that is now fixed.
"Shell Siege" also stays as the game's display title; `TurtlesActionGame` is a
database key, not a name anybody reads.

## One thing still to settle

**The art licence is unresolved.** The enemy mesh and its animations come from
the Dungeon Skeletons demo pack, and the death debris from Polygon Fantasy
Rivals. **Neither extracted tree contains a licence, EULA, or readme of any
kind** — I looked. Standard Asset Store terms would cover this, but a demo pack
sometimes carries narrower ones, and this art ends up in a JS bundle rather
than a Unity build. That question needs an answer from the purchase record, not
from the files. Raised with the session holding the gobalance repo on 17 Nov,
to carry on their list rather than this one.

## Not in the build, not lost

`tools/make-rival.mjs` retargets our Mixamo clips onto any of the twenty
Fantasy Rivals characters through one 22-line bone map. It runs, the clips
bind, the bones move. The posture still needs a bind-pose correction, so no
part of it ships; the tool regenerates it whenever that is worth finishing.

## Knobs that matter on a board

```
?pace=0.7        board responsiveness -- still needs a verdict on real hardware
?fhp=35 ?fspawn=1.2 ?foes=10     enemy pressure
?php=100         player health
?dev=1           open the readout
```
