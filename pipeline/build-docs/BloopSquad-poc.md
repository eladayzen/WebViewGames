# Bloop Squad — POC handoff

**Read this before touching `BloopSquad/`.** It says what exists, what the POC is
*for*, and — most importantly — which decisions are already paid for and must
not be quietly undone.

Upstream: `pipeline/macro-briefs/approved/bloop-squad/brief.md` (approved) and
`pipeline/reports/viral-collapse-clip.md` (where the idea came from).
Art is locked to `concepts/art-bible-concept-09.jpg`.

---

## What this is

A cute-monster **field shooter** for eight-year-olds, mostly boys. Structurally
it is the Viral Collapse family, which differs from Nova Vanguard in three ways
that are the whole reason it exists:

- **Enemies fill the field and pass beside and below the pod.** There is no
  protected band.
- **Bullets live in world space**, so moving sideways paints a ribbon of them
  behind the pod. That ribbon is the signature read; do not "fix" it by
  parenting shots to the player.
- **The camera is a question**, not a given (below).

## Run it

```
cd BloopSquad && npm run dev          # or: npx vite build && serve dist/
```

Landed in the SDK **sandbox** (`~/PracticulaProjects/gobalance_bobo_sdk`) for
board testing. **Not** in the product (`~/UnityProjects/gobalance`) — Amit's
call, it is too early. When it does go there, follow
`GOBALANCE_APP_INTEGRATION.md` exactly, manifest included.

## The two questions the POC exists to answer

Neither can be settled at a desk. Both are judged standing on a board.

**1. The camera.** `C` cycles `fixed → drift → lateral`.
- *fixed* — the world is one screen; nothing pans. The fallback that certainly
  works.
- *drift* — the starfield scrolls past the pod; the frame stays nailed down. The
  sense of travelling somewhere without the player ever dragging the camera.
- *lateral* — follows the pod horizontally. **The argument against it is already
  written down:** it moves the frame on the axis every dodge is made on. It is
  in the build to be ruled out honestly, not because it is expected to win.

**2. How close a monster may pass.** `[` `]` speed, `-` `=` clearance. The HUD
prints `passes / near / contacts / worst reaction`, and `__bloop.report()`
returns the same as JSON. **Worst reaction** is the number that matters: the
least time any monster gave between appearing and reaching the pod's row. Nova
Vanguard's floor is **1.2 s**. Defaults sit around 3.4 s, deliberately gentle —
"too easy" is easy to judge standing up; "unfair" is not recoverable with a
child.

## Rules that are paid for — do not undo them by accident

- **Every threat must be answerable by leaning SIDEWAYS.** Forward/back is the
  expensive, imprecise axis on this hardware. `applyClearance()` in
  `systems/monsters.js` nudges a monster once, while it is still over a second
  out, so it clears the pod laterally. **Once, never re-applied** — something
  that steered continuously would be chasing the player by another name, and no
  one could learn where it was going.
- **No buttons. Ever.** Auto-fire, and toys activate on contact. There is no
  fire key, no bomb key, and no place to add one.
- **One toy at a time; the plain gun never goes away.** A new toy replaces the
  old outright. No inventory, no stacking, no state for a child to manage — and
  a player can have a worse round but never a worse pod.
- **The toy timer is a ring around the pod**, not a bar in a corner, so eyes
  stay on the field. Readable at three metres.
- **Vertical movement is greed, never survival.** Coins and toys spawn slightly
  above the pod's band on purpose: fetching one is a choice.

## Landmines already stepped on

- **Pixi `arc()` continues the current path.** Always `moveTo` the arc's start
  first, or it strokes a line from wherever the path last was. This drew a green
  streak across the whole field. Nova Vanguard hit the identical trap.
- **A "pass" must be measured near the pod.** The first version counted any
  crossing of the pod's row, so a monster entering from the left edge at that
  height passed it instantly from 900 px away and reported a worst reaction of
  0.25 s. `PASS_LANE_PX = 420` fixes it. **A metric that lies is worse than no
  metric**, because it sends the next session hunting a danger that is not there.
- **Presents have to actually arrive.** A 45 s run once produced zero toys —
  most of what dies is small, mediums take five hits. Drop rates are now
  medium 0.40 / large 0.85 with a token 3 % on smalls.
- **Test with a browser, not by reading.** Headless Chrome over CDP found all
  three of the above. Launch with `--mute-audio`; the harness lives in the job's
  tmp dir and is ~40 lines of raw WebSocket, no dependencies.

## What to build next, in order

1. **Answer the two questions on a board.** Everything else is cheaper
   afterwards; the camera decision in particular changes the art (a panning
   camera needs parallax, a fixed one does not).
2. **Real sprites** from the art bible, via Kolbo per `KOLBO_ASSET_PIPELINE.md` —
   monsters in three size tiers, the pod, coins, toy bubbles. Everything is drawn
   from code today, and every shape is a placeholder standing in at the right
   size.
3. **The remaining toys**: Boomerang Bubble, Tickle Beam, Big Bloop (brief has
   the specs).
4. **The Mama healer** — heals nearby monsters through a visible tether. It is
   the fight's one decision and the roster's only interesting enemy so far.
5. **The shell**: audio, the three endings, the leaderboard, dev unlock and
   settings — lift from Nova Vanguard, follow `GOBALANCE_APP_INTEGRATION.md`.

## Map of the code

| File | What it owns |
|---|---|
| `data/tuning.js` | every knob, each with its reason. Start here |
| `systems/monsters.js` | spawning, drift, the clearance rule, the pass measurements |
| `systems/toys.js` | the temporary weapons, and the firing rule while one runs |
| `systems/play.js` | pod movement, bullets, coins, collisions |
| `render/renderer.js` | all placeholder art, drawn from code in the locked palette |
| `main.js` | the loop, the camera modes, the POC's keys and report |
