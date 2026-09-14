# Branch/worktree isolation between concurrent agent sessions (2026-08-20)

Why this exists: multiple Claude sessions work in this repo at the same time, one
per game (or per feature). They all used to share **one checked-out folder** —
`WebViewGames/` itself — which means one shared `HEAD`. A session working on
Hill Bomb switching branches silently changed what every other session's next
commit landed on too. Checked branch state on 2026-08-20 and found it had
already happened repeatedly: `halfshellhustle-hero-skin` had a Hill Bomb commit
on its tip, `tmnt-no-skate-ninja-run` had a Hill Bomb commit on its tip,
`nova-vanguard` had a Hill Bomb commit on its tip, a branch literally named
`hillbomb-open-face-walls` had a Nova Vanguard commit on its tip. None of that
was anyone doing anything wrong — it's what sharing one working directory's
`HEAD` across concurrent sessions produces by default.

## The fix: one git worktree per game/feature, not one shared folder

A worktree is a second (third, fourth...) folder checked out to its own
branch, sharing the same underlying `.git` history and remote as the main
folder. Git refuses to let the same branch be checked out in two worktrees at
once, so two sessions literally cannot collide on the same `HEAD` anymore.

Nothing about the main `WebViewGames/` folder changes when you add one —
worktrees are purely additive and fully reversible (`git worktree remove
<path>`, or `rm -rf` the folder + `git worktree prune`).

Sparse-checkout scopes a worktree to just the one game's folder (plus the
shared root docs), so a session physically cannot see or touch another game's
files even by accident:

```bash
cd WebViewGames                      # the shared repo, any folder inside it
git worktree add --no-checkout ../WebViewGames-<short-name> <branch>
cd ../WebViewGames-<short-name>
git sparse-checkout init --cone
git sparse-checkout set <GameFolder>   # e.g. HalfShellHustle
git checkout <branch>
```

## Tag the last known-good/shipped commit before doing anything else

A branch can move (get force-pushed, get another commit stacked on it by a
different session sharing that checkout). A **tag** cannot — once created it
points at one commit forever. Before starting new work on a game that already
has a live/shipped build, tag the exact commit whose build is what's actually
running in the SDK/app projects right now:

```bash
git tag <game>-prod-stable <commit-sha>
```

Verify the tag actually matches what's live by diffing the hashed JS/CSS
filenames in the tag's build output against the manifest.txt already sitting
in the shipped StreamingAssets folders (SDK project and/or the GoBalance app
project) — if they match, the tag is provably the real shipped state, not a
guess.

Branch new work off the TAG, not off whatever the shared folder's `HEAD`
currently is:

```bash
git branch <game>-<feature> <game>-prod-stable
```

This means a hotfix to the live game can always start clean —
`git checkout -b <game>-hotfix <game>-prod-stable` — regardless of whatever
branch chaos is happening elsewhere in the shared folder.

## Applied so far

- **HalfShellHustle**: tagged `halfshellhustle-prod-stable` at `01f4f7c`
  (verified against both `~/PracticulaProjects/gobalance_bobo_sdk` and
  `~/UnityProjects/gobalance`'s `StreamingAssets/HalfShellHustle/manifest.txt`
  — both match). New hero-skin work branches off it at
  `halfshellhustle-hero-skin`, worktree at `../WebViewGames-hsh-skin`,
  sparse-checked-out to `HalfShellHustle/` only.
- **TmntSkateSlice (pizza game)**: already has a worktree at
  `.claude/worktrees/pizza-box-color` on branch `reskin-shared-engine`
  (found while investigating the branch mess — not something this session
  set up). Worth doing the same tag-the-shipped-commit step there too, if it
  hasn't been done: find the commit whose build actually matches what's in
  that game's shipped StreamingAssets folder(s), tag it, and branch new work
  off the tag rather than off `reskin-shared-engine`'s current tip (which,
  same as everything else in this repo, may have picked up commits from
  other games while it happened to be the checked-out branch).

## For any other concurrent session reading this

If you're starting new work on a game that already has a shipped build:
1. Find the commit that build actually came from (check the shipped
   `manifest.txt`'s hashed filenames against `git log`/`git show` for that
   game's folder).
2. Tag it: `git tag <game>-prod-stable <sha>`.
3. Set up a worktree off that tag, sparse-checked-out to just your game's
   folder, per the commands above.
4. Do your work there, not in the shared `WebViewGames/` folder.
