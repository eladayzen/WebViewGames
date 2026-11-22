# Shell Siege: registering it in the GoBalance app (a NEW game)

Written 2026-11-22 by the ShellSiege session, with the drop. **The build files are copied in. Nothing
is registered and nothing is committed on the Unity side.** Those are the project owner's edits,
the same split as TMNT Survivor's landing.

## What was dropped

`~/UnityProjects/gobalance/Assets/StreamingAssets/ShellSiege/`: **22 content files + `manifest.txt`,
7.36 MB**, byte-identical to the game's `dist/`. There is **no `.meta` yet**: Unity writes them on import.

**A drop is not committable until Unity has imported it.** Compare, in BOTH directions:

```bash
c=$(find "$SDK/Assets/StreamingAssets/ShellSiege" -type f -not -name '*.meta' | wc -l)   # 23 with manifest.txt
m=$(find "$SDK/Assets/StreamingAssets/ShellSiege" -name '*.meta' | wc -l)               # 0 now; equal only after an import
```

(The orphan check alone passes on a fresh drop, which is exactly why it is not enough.)

## The four edits (owner), as for Survivor

| | |
|---|---|
| `folderName` | `ShellSiege`, exact, no trailing space. It is also the **save key**. |
| `displayName` | Shell Siege (working title) |
| `forwardSteeringKeys` | **0.** The game reads `window.__gbSensor`, through the same `input.js` as TMNT Survivor (including the board y-sign fix). Left at the default 1 the player steers about twice as fast as he leans. Copy AstroTunnel or TmntSkateSlice, not a 1/1 scene. |
| `forwardVerticalAxis` | irrelevant: both axes come from `__gbSensor`. Keyboard is the browser fallback only. |

Plus the `EditorBuildSettings.asset` entry and a `GameEntry` in `GamesList.unity`. **No lobby tile exists yet.**

## Checked before the drop

Manifest: 22 lines = 22 content files, no `.meta` entries, does not list itself, every path resolves.
`index.html` carries `__pumpFrames`, `#gameover-overlay`, `#restart-button`, `#gb-back`, `nav:back`.
Played a whole level unattended on this exact build: 5 rooms, 143 s, no console errors.
It ships `.glb`, `.json` and `.webp`; Sewer Shred already ships the first two, and `MimeFor()` already serves `.webp`.

**Not tested on a real board.** The sensitivity, the room lengths (18 to 29 s with an idle player that only auto-fires),
and every enemy number are first guesses that need a child on the board.

## LICENCE: the log is now out of date (`Assets/GoBalance/ASSET_LICENCES.md`, Elad's file)

I have not edited it. What it needs:

| Asset | What ships in this drop | Status |
|---|---|---|
| **POLYGON Fantasy Rivals (Synty)** | **Five character models** (Slayer, Evil God, Mechanical, Elemental and Fort Golem) and their **texture atlas** (`rivals.webp`), plus the two prop meshes already logged | **WIDER than logged.** The log says "two prop meshes only ... No characters or textures ship." That stops being true with this drop. The pack still has **no licence file**, so it is the same OPEN question about a larger use. |
| Quaternius Universal Animation Library | Walk, attack and idle clips, retargeted onto those characters | **CC0 / public domain** (listed on OpenGameArt). Source recorded in `~/Documents/3d/cc0-animation-library/LICENCE.md`. |
| Kolbo-generated art | Three floor paintings (sewer, rooftop, tech), the pizza-box sprites | Generated in-house. |
| `raphael.glb`, `clips.json` | The player | **Already OPEN** in the log (origin unknown; Mixamo-derived animations). |
| TMNT name and characters | Raphael, the pizza | The big open one, as for every `Tmnt*` game. |

It is a prototype, which the log itself says is the stance ("a log, not a clearance"); this note is only
so the log tells the truth about what is in the build.
