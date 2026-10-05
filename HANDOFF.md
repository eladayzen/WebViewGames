# Handoff — web games perf, analytics and branching

Written 2026-10-05 for whoever picks this up next, human or agent. Everything
here was measured or read out of a live system; where something is a hypothesis
it says so.

**Read first:** `CLAUDE.md` (branching), `ANALYTICS.md` (the analytics contract),
`PERF_FINDINGS.md` (the measurements), `DASHBOARD_PLAN.md` (the hosted dashboard).
This file is the map between them and the current state.

---

## 1. The one rule that matters

**Branch from `all-games`. Build every game from `all-games`.**

There are five games in one repo. There used to be one branch per game, each
authoritative for its own game and stale for the other four. Shipping a game from
a branch that is stale *for that game* silently reverts it — which happened:
RoboRun shipped on 29 Sep from a branch missing its analytics and a measured
44 → 55 fps fix, and was broken on the device for five days before anyone looked.

Precise form of the rule, because the loose version caused confusion:

> Ship each game from a branch that is current **for that game**.

`all-games` is current for all five, which is why it removes the problem rather
than merely reducing it. Do not merge one game's branch into another's — the
lines have different bases and a merge resolves against ancestors predating half
the work.

Three sessions share this branch. **Pull immediately before you push.**

---

## 2. State of each game

| game | source folder | ships to | perf | analytics |
|---|---|---|---|---|
| Skateboard Extreme | `HillBombSunsetRidge/` | `StreamingAssets/HillBombSunsetRidge/` | pixel budget **shipped** | yes |
| Nova Vanguard | `NovaVanguard/` | `StreamingAssets/NovaVanguard/` | **open — see §4** | yes |
| Rooftop Ninja | `TmntSkateSlice/` | `StreamingAssets/RooftopNinja/` | nothing needed, 60 fps | yes |
| RoboRun | `HalfShellHustle/` | `StreamingAssets/RoboRun/` | pixel budget **shipped** | yes |
| Bloop Squad | `BloopSquad/` | `StreamingAssets/BloopSquad/` | never measured | yes |

**Source folder names are not shipped folder names.** `TmntSkateSlice` →
`RooftopNinja`, `HalfShellHustle` → `RoboRun`. The shipped name is also the
save-document key (`web_robo_run`), so renaming one after launch orphans saves.

---

## 3. What the perf work established

Measured on Elad's iPad (768×1024, 9.7"/10.2" class) over Safari on the LAN,
~800 samples. Full detail in `PERF_FINDINGS.md`.

**The headline: the device is not slow.** Rooftop Ninja holds a locked 60 fps at
2.86 Mpx using Canvas 2D. Any explanation starting "it's an old iPad" is wrong.

**The pixel budget helps two of four games, and that is the finding:**

| game | before | after |
|---|---|---|
| Skateboard VS | 116 ms / 8.6 fps | 74 ms / 13.5 fps |
| RoboRun | 22.8 ms / 43.9 fps | 18.1 ms / 55.2 fps |
| Nova | 40.5 ms | 39.1 ms — **no effect**, n=171 |
| Ninja | already 60 fps | n/a |

**Nothing generalises.** Every time I assumed a fix would transfer, it did not.

**Declined with evidence, do not redo:**

- **Draw-call batching.** RoboRun issues ~170 draw calls at 43.9 fps; Skateboard
  VS issues 24 at 8.6. Within one game the count swung 28 → 160 with frame time
  pinned at 74 ms. RoboRun carries 317 distinct materials and 40 unbatched
  sprites — real inefficiencies costing nothing observable.
- **Thermal throttling.** 12 minutes continuous: 25.8 fps at the start, 25.6 at
  the end. Flat.
- **Shadow passes.** Skateboard has none — the only `shadow` in it is CSS.

**Every perf number is a lower bound.** All of it was measured in mobile Safari,
never inside the WebView, so the Unity scene rendering behind an opaque overlay
was never competing. On device the real figures are worse.

### The rig

`tools/perf-collector/` + `src/systems/perfHud.js` (`?perf=1`). Panel shows
pixels, frame time, and the js/frame split. Collector serves a tap-menu of
variants at `:5300` and logs every sample. **`perfHud.js` is only wired into
RoboRun on this branch**; it is on `perf-hotfix` for three others.

---

## 4. Nova — the open problem

Nova sits at a **~40 ms floor** nothing moves. Eliminated with data:

| suspect | evidence |
|---|---|
| pixels | 1.4 ms across a 32% cut, n=171 |
| JavaScript | 7–8% of frame |
| object count | correlation +0.38; 2× objects = +9% time |
| scene size | 46–137 renderables, trivially small |
| rAF shim | Ninja has the identical shim at 60 fps |

**Standing hypothesis: memory pressure.** Nova loads 69 textures totalling
25.8 Mpx ≈ **103 MB as uncompressed RGBA**, and until `fd32093` also decoded a
3.3 MB music bed into tens of MB of samples.

**`fd32093` removed the audio half** — the bed now streams and the file is
1.6 MB AAC. **Whether that moves the floor is untested**, and it is the next
thing to measure.

### The test, agreed with gobalance-33

Re-run the rig on device after `fd32093` ships. Three outcomes, written down in
advance so the result cannot be reinterpreted to fit:

| result | meaning |
|---|---|
| floor unchanged | audio was a red herring; cause still unidentified |
| drops partially | memory pressure real → **textures are the next lever** |
| drops to ~17 ms | audio was the whole cost; nothing further |

**Baseline to beat:** median 40.5 ms, p25 37.9, p75 42.7, n=38, 2.36 Mpx,
mobile Safari over the LAN. Reproduce those conditions exactly.

**Memory caveat:** `performance.memory` is Chrome-only — **iOS Safari has no
memory API**. Peak RSS is not obtainable on the device that matters. What *is*
exact: sum the `AudioBuffer`s Nova creates (`length × channels × 4`) and the
textures it uploads. Allocation, not RSS, but measured rather than inferred.

---

## 5. Analytics state

Working end to end on all five games, verified on a real Android device and in
the Editor. Full contract in `ANALYTICS.md`.

**The rule people get wrong:** play time is `duration_seconds` on the **last**
event of a session, never a sum. Every heartbeat carries the running total.

**Known gap: Skateboard Extreme never calls `submitScore`.** Confirmed across six
profiles, 52 save revisions and a live run — it reports `score=17576` through
analytics and saves `WebState` fine, but no `Score` array has ever been written.
Every other game has leaderboard entries.

This is a **design question, not a bug**: the other games produce one number per
run; the skateboard produces a score per mission across 40 missions plus race
placements, and the save document holds one `Score` array per game. A scheme has
to be chosen first — career total (sum of best per mission, data already exists
in `progress.js`), total stars (caps at 120), or best single. **Career total is
the recommendation**; it never caps and needs no new tracking.

gobalance-33 has recorded this in their QA register so a tester does not file it
as data loss.

---

## 6. Open items

| item | state | owner |
|---|---|---|
| Nova before/after measurement | waiting on `fd32093` shipping | me / next agent |
| Skateboard `submitScore` scheme | needs Elad's choice | Elad |
| Hosted dashboard | planned, not built — `DASHBOARD_PLAN.md` | blocked on "who can see it" |
| `perfHud.js` into Nova/Ninja/Skateboard | not done | — |
| Bloop never perf-measured | not done | — |
| `~/firebase-gobalance/firestore.rules` | **expired allow-all, never deploy it** | — |

---

## 7. Who else is working here

| session | owns |
|---|---|
| **gobalance-33** | the Unity repo — branching, PRs, shipping, `.meta` and `manifest.txt` |
| **Half Shell Hustle** | RoboRun calibration |
| **Bloop Squad** | Bloop, authoritative branch `claude/bloop-squad-trail`, pushed |

**Never commit in the gobalance repo.** It is sync-only from here and carries
other people's in-flight work. Copy builds in and leave them uncommitted; 33
commits.

---

## 8. Method, because it is what actually produced the results

Every wrong answer this week came from reasoning about code. Every right one came
from changing one variable and reading the result. Five traps that each cost
real time:

1. **The first pixel A/B ran in the lobby** — the one scene too light to be
   GPU-bound — so it showed no effect and suggested pixels were irrelevant. Test
   where the problem is, not where it is convenient.
2. **Nothing was measured on a known-good game until late.** Ninja's 60 fps was
   the most informative number of the week and reframed everything before it.
3. **Single samples were trusted three times and were wrong three times.** Every
   configuration ramps ~15s after load. Compare plateau to plateau.
4. **RoboRun was written off on a number that was not alarming.** 45 fps looked
   fine so the looking stopped; the budget was worth 11 fps.
5. **A hypothesis that explains every observation is still not a measurement.**
   The fill-rate story explained everything and was wrong. The memory story
   currently explains everything. It is untested.

The corollary that saved the most work: **compare artifacts, do not describe
them.** Every near-miss this week — the analytics nearly reverted, the tuning
nearly reverted, the RoboRun overwrite — was caught by diffing bundles or
branches, never by reasoning about what they should contain.
