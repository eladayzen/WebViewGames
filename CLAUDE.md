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
on the device that nobody else can reproduce. It is a two-second check that turns
a likely mistake into an impossible one.

This exists because it has gone wrong twice. RoboRun shipped from a branch stale
for RoboRun and silently lost its analytics and a measured 44 -> 55 fps fix, live
for five days. Bloop shipped a bundle (`index-DkEc4hk2.js`) that could not be
rebuilt from any pushed source at all — the work existed only in one worktree.

Both were invisible: the build succeeds, the bundle looks fine, the game runs.
The hash check is the only thing that catches either one before players do.

## Source folder names are not the shipped folder names

`HalfShellHustle/` ships into `StreamingAssets/RoboRun/`. Check where a game actually lands
before you sync; the names differ for several games, and the shipped folder is also the key for
that game's saves, so renaming it after launch orphans every player's save data.

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
