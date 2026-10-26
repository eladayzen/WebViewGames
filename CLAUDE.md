# WebViewGames — read this before you branch

## Branch from `all-games`. Always.

`all-games` is the single integration branch for **every** game in this repo. Branch from it,
and land your work back on it.

**Why this is a rule and not a preference.** This repo previously ran one branch per game:
`roborun-perf`, `ninja-analytics`, `nova-analytics`, `budget-on-analytics`,
`claude/bloop-squad-trail`. Each held the best version of *its* game and a stale version of the
other four. Building any game from its own branch therefore shipped a build that **reverted the
other four games**, and it did: a RoboRun ship on 2026-09-29 silently dropped that game's
analytics and a measured 44 → 55 fps fix, which stayed broken on the device for five days before
anyone noticed. Nothing warns you. The build succeeds and the bundle looks fine.

So:

- **Never** create a branch that becomes authoritative for one game. That is the bug.
- If you find work on an old per-game branch that is not on `all-games`, bring it across —
  don't build from the old branch.
- **Do not merge one game's branch into another's.** The five lines have different bases, so a
  merge resolves against an ancestor predating half the work. `budget-on-analytics` looks like
  an analytics branch but is *Skateboard Extreme's*; merging it for RoboRun would have **deleted**
  RoboRun's analytics while appearing to add analytics. Assemble per game folder instead.

## Nothing ships that cannot be rebuilt from `origin/all-games`

**The rule:**

> Nothing reaches `StreamingAssets` that is not reproducible from `origin/all-games`.

**Every time you ship a game:**

    1. branch from origin/all-games
    2. commit
    3. pull, then push to all-games
    4. rebuild from that pushed state
    5. confirm the bundle hash matches what you are about to ship
    6. only then copy into StreamingAssets

**Step 5 is the enforcement, not a formality.** If the rebuilt hash does not match
what you are shipping, your source is not pushed, and you are about to put a build
on the device that nobody else can reproduce.

**Three things that make step 5 actually work, each learned by it failing:**

1. **Rebuild from a CLEAN checkout of the pushed state — not from your own
   worktree.** A dirty worktree reproduces its own hash perfectly, so checking
   against yourself always passes. That is exactly how `index-DkEc4hk2.js`
   reached a device from source on no branch.

2. **Byte-diff the whole `dist/`, not just the hashed assets.** Vite content-hashes
   the JS and CSS; it does **not** hash `index.html` or `manifest.txt`. A change
   living only in `index.html` ships with an identical bundle hash and looks
   unchanged to a grep — this has already caused one drop to be misread as
   missing its change. The full diff also catches a stale `manifest.txt`, the one
   file whose absence fails *only* on a device.

3. **Pin the hash check to that game's entry chunk.** Asset hashes are
   content-addressed, so a *differing* hash can also mean somebody else's game
   changed something shared. Matching proves your source; differing needs looking
   at before it means anything.

This exists because it has gone wrong twice. RoboRun shipped from a branch stale
for RoboRun and silently lost its analytics and a measured 44 -> 55 fps fix, live
for five days. Bloop shipped a bundle (`index-DkEc4hk2.js`) that could not be
rebuilt from any pushed source at all — the work existed only in one worktree.

Both were invisible: the build succeeds, the bundle looks fine, the game runs.
The hash check is the only thing that catches either one before players do.

## Check where a game lands, and how many games a folder builds

**One folder does not always mean one game, and a plain `npm run build` is not always the
thing that ships.** Both halves of that have cost real time.

| source folder | build command | ships into |
|---|---|---|
| `TmntSkateSlice/` | `npm run build:tmnt` | `StreamingAssets/TmntSkateSlice/` |
| `TmntSkateSlice/` | `npm run build:original` | `StreamingAssets/RooftopNinja/` |
| everything else | `npm run build` | `StreamingAssets/<same name>/` |

**In `TmntSkateSlice`, a plain `npm run build` produces NEITHER shipped game.** It is a third,
mode-less bundle that nothing ships. Nothing warns you: it builds, it runs, and it is wrong.
That folder holds both themes' art and aliases `@hero-assets` to a different module per mode,
so the build you did not ask for is a real build of a game nobody plays.

Everywhere else the source folder name now equals the shipped folder name. `HalfShellHustle/`
used to build into `StreamingAssets/RoboRun/`, which is how this section started; the two were
split into separate folders on 2026-10-26 and that mismatch is gone. Don't create a new one.

**The shipped folder name is a three-way contract the moment a build ships**, and only the
first use is obvious:

- the `StreamingAssets` folder the app serves the game from;
- the per-profile save key;
- the Firestore document id, **derived** from it rather than listed --
  `FirestoreStructureStrings.WebGameKey("HalfShellHustle")` -> `web_half_shell_hustle`.

Renaming afterwards migrates nothing. It files progress under a new document and every
player's saved state reads as absent. Pick the final name before the first build, not before
launch.

**Two skins of one game is not automatically one folder.** `TmntSkateSlice`/`RooftopNinja`
share a folder because they differ only in pictures. `HalfShellHustle`/`RoboRun` were tried
that way and lasted an afternoon: the reskin had also made the enemies taller, stopped them
breathing, collapsed four shadow footprints into one and lifted them off the ground, so turtle
art on robot numbers gave oversized hovering enemies. A theme module can swap pictures; it
cannot swap how a character occupies the world. If the two versions differ in **feel**, give
them separate folders and accept that a fix in one no longer reaches the other.

## Shipping into the Unity project (`~/UnityProjects/gobalance`)

Full contract: `GOBALANCE_APP_INTEGRATION.md` here, and `Assets/GoBalance/WebGames/README.md`
in the gobalance repo. The three that actually bite:

1. **`manifest.txt` is not produced by the build.** It lives only in the shipped folder, lists one
   relative path per line (`index.html` first, then the rest sorted, itself and `.meta` files
   excluded), and **Android will not launch the game without it** — `WebGameController` reads it
   to pull files out of the APK and gives up if it is missing. A plain `rsync --delete` deletes
   it, because it is not in `dist/`. Regenerate it on every ship and check the entry count.
   The Editor and the browser both work fine without it, so this fails only on a real device.
2. **Check `.meta` pairing in BOTH directions** — a `.meta` whose asset is gone, *and* an asset
   with no `.meta`. A one-directional check here once deleted 85 live asset metas. Unity's
   `.meta` files carry a **trailing space** after `userData:`, `assetBundleName:` and
   `assetBundleVariant:`; omit them and Unity rewrites the file later, surfacing as an
   unexplained diff nobody can place.
3. **Never commit in the gobalance repo.** It is sync-only from here and usually carries other
   people's in-flight work. Copy the build in and leave it uncommitted.

## Verify a shipped bundle by behaviour, not by name

Minifiers rewrite numeric literals (`20000` becomes `2e4`), so grepping a bundle for a constant
proves nothing. Grep for strings that survive minification — UI text, DOM ids, event names — and
confirm the call site in the source, not just the presence of a token.
