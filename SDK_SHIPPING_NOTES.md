# SDK Shipping — Field Notes (Claude)

**Not the official contract.** `GOBALANCE_SDK.md` is the authority for *how*
shipping to the GoBalance SDK works and *who owns what*. This file is a
running log of things I actually hit while shipping games into
`gobalance_bobo_sdk/Assets/StreamingAssets/<Game>/` in practice — gotchas,
recovery steps, and a recipe that worked — that aren't spelled out there.
Treat it as experience notes to sanity-check against, not a spec. Anything
here that proves durable is a candidate to promote into `GOBALANCE_SDK.md`'s
own "Gotchas" section later; until then it lives here so it isn't lost.

First written 2026-07-30, from repeatedly shipping TmntSkateSlice.

---

## The re-ship recipe that actually worked

Run from the game's own project dir (e.g. `TmntSkateSlice/`) after
`npm run build`:

```bash
TARGET="$HOME/PracticulaProjects/gobalance_bobo_sdk/Assets/StreamingAssets/<Game>"
# 1. delete stale content-hashed bundles + their .meta (NOT with a shell glob
#    -- see gotcha #2). Vite re-hashes index-*.js/css every build, so old
#    ones orphan if not removed.
find "$TARGET/assets" -maxdepth 1 -name 'index-*.js'       -delete
find "$TARGET/assets" -maxdepth 1 -name 'index-*.js.meta'  -delete
find "$TARGET/assets" -maxdepth 1 -name 'index-*.css'      -delete
find "$TARGET/assets" -maxdepth 1 -name 'index-*.css.meta' -delete
# 2. copy the fresh build in
cp dist/index.html "$TARGET/index.html"
cp dist/assets/* "$TARGET/assets/"
# 3. regenerate manifest.txt -- content files only, NO .meta (see gotcha #1)
{ echo "index.html"; for f in "$TARGET"/assets/*; do
    case "$f" in *.meta) ;; *) echo "assets/$(basename "$f")" ;; esac
  done; } > "$TARGET/manifest.txt"
```

Then in the SDK repo: `git add` **only** your game's StreamingAssets path,
commit, and stop (Phase 1 ends here per `GOBALANCE_SDK.md` — no scenes, no
Build Settings, no GamesList).

---

## Gotchas, in the order they bit me

**1. `manifest.txt` lists content files only — never `.meta` files.**
My first ship generated the manifest by globbing `assets/*`, which swept in
all the Unity `.meta` files. The existing shipped games (checked CarRacer)
list only real content: `index.html`, `assets/<hash>.js`,
`assets/<hash>.css`, the PNGs/MP3s. Filter `*.meta` out when generating it.

**2. zsh aborts the whole command on a no-match glob.** `rm -f
"$TARGET"/assets/index-*.js` looks safe, but in zsh if nothing matches, the
shell errors `no matches found` and **aborts the entire `&&` chain** before
anything runs — which silently half-shipped once. Use `find … -delete` (or
`setopt null_glob`) in any ship script. Related: a bare `TARGET=~/…` +
`cd "$TARGET"` chain also bit me once when a previous command's `cd`
persisted between bash calls and made a relative path resolve wrong — prefer
`"$HOME/…"` and absolute paths in ship scripts.

**3. Unity re-generates `.meta` files asynchronously after a ship.** If the
Unity Editor is open (it usually is — someone's doing Phase 2), it imports
the new StreamingAssets files and writes their `.meta` a moment later. So
right after committing a ship, `git status` in the SDK repo shows new
untracked `.meta` files that weren't there when I staged. Follow up with a
second commit adding them, or the folder's git state is inconsistent with
what Unity expects.

**4. The SDK repo is SHARED and branch-volatile — verify before every
ship.** Mid-session the SDK repo moved from `web-games-test` to a totally
different branch (`color-tunnel-overhaul`, unrelated tunnel/other-game
work), and the entire `StreamingAssets/TmntSkateSlice/` folder was simply
*gone* from the checked-out branch — because all my earlier ships were local
commits on `web-games-test` that were never pushed (it's shared; I don't
push it). Lessons: (a) `git branch --show-current` and check the target
folder exists *before* assuming a re-ship is an update vs. a first ship;
(b) never trust that the branch/folder state survived since last session;
(c) only ever `git add` your own game's path — other games' folders and
`ProjectSettings/` changes in flight belong to someone else.

**5. Content hashes change every build (the doc's own warning, confirmed
real).** `index-<hash>.js/css` filenames change on every `npm run build`. If
you copy the new build over the old without deleting the old hashed files
first, you leave orphaned duplicates that `manifest.txt` no longer lists —
and on Android (which reads `manifest.txt` to extract from the APK) that
matters, while Editor/iOS/macOS ignore the manifest and read the folder
directly, so a stale manifest can pass unnoticed on whatever platform you
happen to test on. Always: delete-old -> copy-new -> regenerate-manifest.

---

## Meta-note

Shipping to the SDK is *secondary* — the primary deliverable is the game's
own commit in this `WebViewGames` repo (pushed to origin). The SDK ship is
for on-device/board testing, is committed locally-only in a shared repo I
don't push, and is the kind of thing the human may redo, move, or supersede
on their own branch. So: don't over-invest in it, always surface (not
silently "fix") anything that looks off about the SDK repo's state, and if
the human says "forget the SDK," the game's origin commit still stands on
its own.
