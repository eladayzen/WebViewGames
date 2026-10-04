# Why the games are slow on an old iPad — measured, 2026-09-28

Measured on Elad's iPad (`screen 768x1024`, a 9.7"/10.2" class device) over Safari
on the LAN, against four games at their shipped code. ~800 samples, collected
automatically by `tools/perf-collector/` from the on-device panel in
`src/systems/perfHud.js` (`?perf=1`).

## The headline: the iPad is not slow

| game | renderer | pixels | frame | js | fps |
|---|---|---|---|---|---|
| **Rooftop Ninja** | Canvas 2D | 2.86 Mpx | **16.7 ms** | 3% | **59.9** |
| RoboRun | three.js | 2.36 Mpx | 22.8 ms | 7% | 43.9 |
| Nova Vanguard | PixiJS | 2.36 Mpx | 41.5 ms | 7% | 24.1 |
| Skateboard, lobby | three.js | 2.72 Mpx | 39 ms | — | 25 |
| Skateboard, **VS** | three.js | 2.72 Mpx | **116 ms** | — | **8.6** |

Ninja holds a locked 60 fps at **more** pixels than anything else here, using the
slowest renderer of the four, on the same device in the same session.

**That refutes the premise the investigation started from.** The written analysis
this began with attributed everything to device class — old GPU, tablet viewport,
MSAA, thermal throttling. If any of that were binding, Ninja could not hold 60 fps
at 2.86 Mpx. The hardware has headroom; the games differ.

## What the pixel budget is worth, per game

The same change — budget the pixel AREA instead of capping `devicePixelRatio` —
measured on each game. **It does not generalise, and that is the main finding.**

| game | before | after | verdict |
|---|---|---|---|
| Skateboard VS | 116 ms / 8.6 fps | 74 ms / 13.5 fps | **ship it** |
| RoboRun | 22.8 ms / 43.9 fps | 18.1 ms / 55.2 fps | **ship it** |
| Nova | 41.5 ms / 24.1 fps | 43.2 ms / 23.2 fps | no effect |
| Ninja | already 60 fps | — | nothing to gain |

Both wins have non-overlapping distributions (RoboRun: baseline p25 22.1ms against
budgeted p75 18.6ms). Nova's two runs overlap almost completely.

## Draw calls are not expensive on this hardware

Worth stating on its own, because it is the assumption most likely to cause
expensive pointless work:

    RoboRun          ~170 draw calls,   0.4k triangles   ->  43.9 fps
    Skateboard VS      24 draw calls, 229k   triangles   ->   8.6 fps

Seven times the draw calls, five times the frame rate. Within Skateboard VS the
count swung 28 -> 160 with frame time pinned at 74 ms.

RoboRun carries **317 distinct materials, 40 unbatched sprites and 131 transparent
drawables** — all real inefficiencies, all costing nothing observable. Batching
them would be significant work for no user-visible gain. Measure before optimising.

## Skateboard Extreme — the real problem

Two independent costs, roughly equal, both only visible in the heavy scene.

| lever | change | saves |
|---|---|---|
| pixels | 2.72 -> 1.60 Mpx | ~40 ms |
| geometry | 229k -> 103k tris | ~40 ms |

The geometry is 4 rivals at ~31.5k triangles each, spawned by
`rivals.spawn(FIELD_SIZE=4)` as skinned-mesh clones. Skinned meshes cost more per
triangle than the count suggests. **Rival LOD is the other ~40 ms** and needs an
art asset, so it is next-version work.

**Still unknown:** the js/frame split for VS specifically.

## Nova Vanguard — still unsolved

Everything measurable has been eliminated:

| suspect | evidence | verdict |
|---|---|---|
| JavaScript | 7% of frame, n=26 | not it |
| pixels | 41.5 vs 43.2 ms, overlapping | not it |
| object count | correlation **+0.38**; 2x objects = +9% time | not it |
| scene size | 46–137 renderables | trivially small |
| rAF shim | Ninja has the identical shim, hits 60 fps | not it |

~41 ms is a floor that barely responds to anything. **Leading hypothesis, untested:
texture memory.** Nova loads 69 textures totalling 25.8 Mpx — roughly **103 MB as
uncompressed RGBA** — including ten 1024x2048 surface pairs. That fits every
observation: independent of output resolution, independent of object count, not
JavaScript, a fixed per-frame floor, absent on desktop (ample VRAM) and absent in
Ninja (Canvas 2D, small sheets).

Test: build a variant with the surface textures halved and re-measure.

## Rooftop Ninja / RoboRun — resolved

Ninja: 60 fps, 3% JS, nothing to fix. Whatever "a bit slow" described, it is not
frame rate — look at input latency or the stalls.

RoboRun: fixed by the budget, 44 -> 55 fps. Note this game was written off at
"45 fps, healthy enough, nothing to do" an hour before the measurement that
disproved it. Elad's instinct said otherwise and was right.

## Stalls (probable cause on the skateboard)

Isolated frames of 150–760 ms — 15 in 223 samples. The large ones (~550–760 ms)
line up with entering/leaving a race, pointing at `rivals.spawn()`:
`SkeletonUtils.clone()` x4 plus `material.clone()` per node, all in one frame.

**Likely fix, cheapest of any here:** pool the four rivals — hide/reset instead of
clone/discard. No art, no gameplay change. Does nothing for steady-state cost;
removes the most visible symptom.

*Confidence: moderate.* Only 3 stalls are unambiguously tagged as mode changes.

## A caveat that applies to every number above

**All of it was measured in mobile Safari, not inside the Unity WebView.** The URP
scene keeps rendering behind an opaque WebView (`WebGameController`), so in the real
app these games are also competing with it. **Every figure here is a lower bound.**

As of 2026-09-29 `WebGameController` disables enabled cameras while a web game is
visible (`suspendCamerasWhileVisible`, default on). Whether that helps, and by how
much, is unmeasured — the panel cannot currently turn on in-app because the WebView
loads `index.html` with no query string.

## Method

Every wrong answer came from reasoning about code; every right one from changing
one variable on the device and reading the result. Four traps, all of which cost
real time:

1. **The first pixel A/B ran in the lobby** — the one scene too light to be
   GPU-bound — so it showed no effect and suggested pixels were irrelevant. *Test
   where the problem is, not where it is convenient.*
2. **Nothing was measured on a known-good game until late.** Ninja's 60 fps was the
   single most informative number of the day. *Establish what the hardware can do
   before explaining what it cannot.*
3. **Single samples were trusted three times, and were wrong three times.** Every
   configuration ramps ~15s after load before settling. *Compare plateau to plateau.*
4. **RoboRun was written off on a number that was not alarming.** 45 fps looked fine,
   so the looking stopped; the budget was worth 11 fps. *"Healthy enough" is not a
   measurement.*

## Reproducing

    node tools/perf-collector/collector.mjs     # :5300, and a tap-menu of variants
    cd <game> && npx vite --host                # 5200 skateboard / 5201 nova
                                                # 5202 ninja / 5203 roborun

Open `http://<mac-lan-ip>:5300/` on the device and tap a variant. The panel's 2nd
line is the pixel cost, the 5th is the js split. Samples land in
`tools/perf-collector/samples.ndjson`. `?budget=0` disables the budget for A/B.
