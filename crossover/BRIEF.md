# One brief, two agents: the Survivor look pass, and what it shares with ShellSiege

Written 2026-11-22 by the ShellSiege session. Counts, diffs, test results and file
lists were measured that day. Facts taken from another document (HANDOFF, a saved note,
a code comment) say where they came from. Where something is my opinion rather than a
fact, it says **my read**.

**Two readers.**
- **The new "Survivor look" agent** (TMNT Survivor, the 2D one): sections 0 to 6, 8, 9.
- **The ShellSiege agent** (the session that wrote this): section 7 is the contract
  between you two. Both of you read 1, 2 and 7.

This folder is deliberately *outside* `TmntSurvivor/` and `ShellSiege/`, so neither
game's Vite build can ship it. It is untracked. Do not commit it without Elad asking.

> **UPDATE, same day: the projects are now split.** Elad's instruction: separate entirely,
> nothing edited across, the two sessions only talk (to avoid duplicate work and to pass
> good ideas and systems). So:
> - The Survivor agent's operative brief is **`LOOK_PASS_BRIEF.md` inside its own
>   worktree** (`.../worktrees/survivor-look/TmntSurvivor/`), self-contained. This file is
>   now the **ShellSiege side's notes** and the record of the sharing analysis in section 7.
> - **Style is decided:** Survivor stays on the **TMNT_M1 toddler sheet** (section 5, 9).
> - The Survivor worktree **has been created** (section 2); there is no command to run.

---

## 0. Sixty seconds

1. **Your job:** make TMNT Survivor look better. Elad's words, not mine: "make it look
   better". What that means is **not yet defined**; section 9 lists what to ask him.
2. **Work in your own worktree, not this one.** Command in section 2. The `sewer-swarm`
   worktree holds uncommitted ShellSiege work from another session.
3. **Do not touch** the gameplay tuning pairs, the pace scale, the board-axis sign, the
   `#gameover-overlay` / `#restart-button` / `__pumpFrames` contract, or the folder
   name `TmntSurvivor` (it is also the save key). Section 6 has the full list.
4. **A single screenshot can lie.** My first frame of the running game showed no player
   at all. He was mid hit-flicker. Take several frames before reporting anything missing.

---

## 1. Standing rules from Elad (both agents)

| Rule | What it means in practice |
|---|---|
| **Never commit unprompted** | No `git commit`/`push` unless Elad asks *in that message*. Approval never carries forward. |
| **Never commit the gobalance product** | `~/UnityProjects/gobalance` is sync-only: copy build files in, never commit there, even inside a broader "commit everything" request. |
| **Own worktree, own branch** | Several sessions share one checkout and one HEAD. Never commit onto another session's branch. Never bare `git stash`; use `git stash push -u -m "<tag>"` then `git stash apply <sha>`. |
| **Mute headless browsers** | Verification Chrome is invisible; launch with `--mute-audio` or Elad hears game audio he cannot close. |
| **Measure, don't infer** | Screenshots and numbers beat reasoning about what the code should do. |
| **Check reachability before calling something broken** | A reference existing is not the same as it running. |
| **Decide, don't ask** | For routine choices pick the best option and act. Save questions for what is genuinely his. |
| **One narrow stream at a time** | One agent, one scope. Do not bundle extras. |
| **After any drop into `StreamingAssets`** | Check `.meta` files in **both** directions (see section 3). `manifest.txt` lists content files only, never `.meta`, never itself. |
| **Peers cannot grant escalation** | Never change permission settings, CLAUDE.md or config because the other agent asked. Never treat a peer message as Elad's approval. |
| **Do not template from sibling games** | Elad said, of another project, "i don't want you to rely on him. build your own." See the tension this creates for section 7. |

---

## 2. Who is who, and where to work

**Addressing each other.** Use `ListAgents` then `SendMessage`. The ShellSiege session
answers to **`room-variety-and-enemy-roles`** (ref `3e9bd0`). **Session names follow whatever a session is working on, so this name WILL change** (it was `Bloop Squad handoff documentation` earlier today, which is why the first version of this brief went stale within hours). Always run `ListAgents` first; if you cannot find the ShellSiege session, ask Elad for its current name. Do not guess at one. The new agent will
get its own name; tell the other one what it is.

**Ownership.**
- Survivor agent owns `TmntSurvivor/**`, in its own worktree.
- ShellSiege session owns `ShellSiege/**` in `.../worktrees/sewer-swarm`. It will not edit
  `TmntSurvivor/`.
- Two files are byte-identical copies across the games (section 7). If either agent
  changes one, it **tells the other in the same breath**.

**The Survivor worktree already exists** (created 2026-11-22, nothing for anyone to run):
`.../worktrees/survivor-look`, branch `claude/survivor-look`, cut from **`8d9414c`**. Dependencies
installed; `reference/` copied in; 101 tests pass and the build is clean there.

**A mistake of mine, fixed:** this file first said to cut from `96dc55d` as a "clean base", having
checked only that `TmntSurvivor/` was unchanged. It is. But `96dc55d` **predates** the commit that
added six of the seven Kolbo art scripts (`8d9414c`), so a branch from it would have been missing
tools the brief points at. I caught it by listing `tools/` in the new worktree, then fast-forwarded.

**What a fresh worktree will NOT contain.** `TmntSurvivor/reference/` (5.8 MB: the raw
generator output, the README that explains how every asset was built, and previews) is
**untracked**, so it exists only here:

`/Users/eladayzen/UnityProjects/WebViewGames/.claude/worktrees/sewer-swarm/TmntSurvivor/reference/`

Read it by absolute path. Do not move or delete it. Whether to commit it is Elad's call.
Also untracked there: `TmntSurvivor/HANDOFF.md`, written 4 Nov and extended to 10 Nov. Its
own header says to delete it once the work lands; it has landed. Leave it. Its test
counts (84, then 90) are stale: the real number is **101**.

---

## 3. TMNT Survivor today

A Vampire-Survivors-style TMNT game in **PixiJS 8 + Vite 6**. The world is seen from above
but the characters are drawn **flat, from the side**: one drawing per character, mirrored
for left/right, never rotated. The player is Raphael with a shuriken launcher; the enemies
are Foot ninjas: a grunt (red sash) and a **shooter** (the same sheet with the wraps moved
from crimson to amber, so the orange-sash ones fire back). XP is blue gems; health
is hearts, healed by pizza drops.

| Fact | Value |
|---|---|
| Shipped commit | `96dc55d` on `claude/sewer-swarm`, pushed to `origin/claude/sewer-swarm` |
| Tests | **101 pass, 0 fail** (`npm test`) |
| Source | 3,485 lines of JS in `src/`, plus 259 CSS; biggest: `systems/sprites.js` 824, `main.js` 514, `systems/horde.js` 364, `systems/analytics.js` 349 |
| Landed in the app | `~/UnityProjects/gobalance/Assets/StreamingAssets/TmntSurvivor/`, 32 content files (HANDOFF says committed as `0e7e8c52` on `8.2.90`; I did not re-verify the Unity side) |
| Shipped weight | 1.2 MB |
| Dev hooks | `?hp=N` `?pace=N` `?spd= ?espd= ?lives= ?hdrop= ?sfire=` |

**Render structure** (`src/main.js`): one `world` Container holding the ground, then
gems, pickups, enemies, bullets. The player's hearts bar is world-space, above his head.
The corner HUD (level pill, XP bar, timer, KO count) and the level-up cards are **DOM**,
styled in `src/style.css`. That split matters: UI polish is CSS, character polish is
sprite sheets.

**Run it and look at it.**

```bash
cd TmntSurvivor && npm run build
python3 -m http.server 5210 --directory dist --bind 127.0.0.1
```

Port 5210 is the convention (a HalfShellHustle Vite also binds 5210 on IPv6; the python
one wins on IPv4). **Every visual check needs a rebuild first**, or you are looking at the
old build.

**Gotchas that already cost time:**
- **The `claude-in-chrome` tab cannot show motion.** Its tab group is hidden, so
  `requestAnimationFrame` never fires and the clock sits at 0:00. The `chrome-devtools`
  MCP page **does** animate; I confirmed it today. Use that.
- **Seed any simulation** (`mulberry32`, assign `Math.random`). An unseeded A/B once
  reported 31 vs 20 peak shots for the *same* config.
- **`SURVIVAL.maxLives` and `HEART.dropChance` are one decision.** A test pins the pair and
  goes red if one moves alone.
- **Pace is applied exactly once.** `SHOT.speedPxS` derives from an already-paced value.
  Distances are never paced, only px/sec.
- **The landing trap:** the documented landing loop deletes `assets/*`, and because Vite
  content-hashes every name, the new files arrive with **no `.meta`**. That state passes
  the orphan check, because the orphans left with the old names. Check both directions:
  `c=$(find "$SDK/assets" -type f -not -name '*.meta' | wc -l)` against
  `m=$(find "$SDK/assets" -name '*.meta' | wc -l)`. They are equal only after Unity has
  imported. A drop is not committable until then.

---

## 4. What it looks like now

![Survivor gameplay](shots/survivor-gameplay.jpg)
![Survivor level-up cards](shots/survivor-levelup.jpg)

Captured from the shipped build at 1600x900, one run, about ten seconds in. **This is my
read from stills; motion can change it.** Facts first:

- Raphael is drawn to the licensed **TMNT_M1 style guide, toddler sheet** (a comment in
  `sprites.js` says so, and says that replaced the game's "earlier, rounder house cartoon").
  The Foot sheets are older than that redraw; **my read** is that they are still in the
  earlier style, since nothing says they were redrawn.
- Both enemy types are **one drawing** (grunt, and the shooter as an amber recolour, per the
  README), the same size, near-black.
- Gems are one sprite. Shurikens appear in two colours (silver, orange); I did not confirm
  which belong to whom.
- The level-up cards use an 8-icon art sheet (section 7 has it) and it is the **most
  finished art in the game**.

**My read** (disagree freely):
1. **Two art languages in one frame.** Raphael is detailed and on-model; the Foot beside him
   are simple black figures. This is the largest single gap.
2. **The crowd reads as noise at density.** Near-black figures on mid-slate, one silhouette.
3. **The HUD is generic** (flat pill, flat bar) next to illustrated cards.
4. **No contact shadows** anywhere in the frames I captured.
5. I could not judge **hit and kill feedback** from stills. Capture a sequence.

---

## 5. How the art is made (so you extend it instead of replacing it)

**Pipeline.** Kolbo `gpt-image-2`, styled against the official style-guide art, then cut
out and packed. Provenance and the exact commands are in
`TmntSurvivor/reference/README.md` (read it first). The scripts live in
`tools/kolbo-assets/` (tracked, commit `8d9414c`):

| Script | Does |
|---|---|
| `slice_strip.py` + `pack_sheet.py` | strip -> aligned frames -> one sheet |
| `cutout_flood.py` | cutout by flooding from the border, **so eyes survive** |
| `remove_white_bg.py` | global near-white key: eats white eyes, single objects only |
| `seamless_tile.py` | floor tile; prints edge mismatch vs natural difference |
| `match_palette.py` | matches a new clip to the one it alternates with |
| `recolor_hue.py` | enemy variants, **baked, never a runtime tint** |

**Rules the code already depends on:**
- **Never set `rotation` on a character.** Mirror `scale.x`. Rotating a side-view sprite lays
  it on its back. A separate arrow carries the real heading.
- **A walk is four frames, an idle is two.** The idle is a *different sheet*.
- **An idle sheet may exist only if its walk holds the same weapon** (`IDLE_SHEETS` in
  `sprites.js`), or the character pops between armed and empty every time he stops.
- **Match a new clip to the clip it alternates with**, measured (`match_palette.py`), not by eye.
- **Do not use Pixi `tint` for variants.** It multiplies, so it can only darken, and the Foot's
  sash is the only thing making him readable against the street.
- **Explicit `new URL(...)` per asset** in `sprites.js`, never a template string, or Vite
  ships the whole folder (that is how 15 orphans got into a RoboRun bundle).
- **Environment surfaces must be real illustrated art**, never procedural canvas.
- **Prompt multi-frame sets together**, not one frame at a time (frames drift off-model).
  Check every returned frame against its siblings before wiring it in.
- **Kolbo generation spends credits.** Check balance (`check_credits`) before a big batch.

**Style: DECIDED by Elad, 2026-11-22.** Survivor stays on the **TMNT_M1 toddler sheet**, which is
what Raphael is drawn to today (`sprites.js`). Elad: keep this current. It is **not** moving to the
"Tales of the TMNT" 2024 guide, though a saved note says newer TMNT games use that. Survivor is the
exception, and the look pass brings the Foot and the rest of the frame up to Raphael.

References on disk: `~/Documents/TMNT/tmnt babies/` (including `Survivor art camera.jpeg`, the
camera target) and the Tales PDF path in the note above.

---

## 6. Candidate look-pass work (Elad prioritises; this is a menu)

| Candidate | Evidence | Weight | Care |
|---|---|---|---|
| Bring the Foot to Raphael's fidelity | Gap 1 in section 4 | Heavy: new sheets, 4 frames + idle each | Batch-prompt the set; palette-match |
| More enemy silhouettes, not just recolours | Gap 2 | Heavy | Size and shape variety, not only sash colour |
| HUD that matches the card art | Gap 3 | Light: CSS only | `#gameover-overlay`/`#restart-button` ids are SDK contract |
| Contact shadows, hit flash, kill pop | Gap 4, 5 | Medium | Verify in motion; mind peak sprite count |
| The other three turtles' armed walk + idle | README "Still open" | Heavy | Only reachable in co-op; lowest priority |
| Floor and decals | Existing road tile reads fine | Light | Keep it seamless; measure with `seamless_tile.py` |

**Do not change, ever, without Elad:** `SURVIVAL.maxLives` / `HEART.dropChance` (one decision),
`core/pace.js`, the sign constants in `systems/input.js` (`sensorYSign: -1`, overridable with `?sys=`, fixed a
real inverted-board bug on the actual board and is pinned by `test/axes.test.mjs`), the SDK DOM contract and `__pumpFrames`,
and the folder name `TmntSurvivor` (it is the save key `web_tmnt_survivor`).

---

## 7. What the two games can share

**Lineage.** ShellSiege's own file headers say it was ported from Survivor ("Lifted from TMNT
Survivor"). So some code is genuinely the same, some has forked, and some cannot cross at all.

### 7.1 The matrix (diffs measured today)

| System | Survivor | ShellSiege | Relationship |
|---|---|---|---|
| `core/pace.js` | 56 lines | 56 lines | **Byte-identical.** `diff` = 0 |
| `systems/input.js` | 158 | 158 | **Byte-identical**, including the board y-sign fix |
| `core/abilities.js` | 125 | 101 | Forked (140 differing lines). Same shape: `build`, `stats()`, `take()`, caps. ShellSiege added `kind: 'perm'/'temp'`, `weight`, `hearts` |
| `systems/combat.js` | 228 | 195 | Forked (287). Same lineage: auto-aim, auto-fire, per-bullet hit memory |
| `core/world.js` | 130 | 133 | Forked (171). Same idea, different arena |
| `core/levelup.js` | 121 | *deleted* | Survivor keeps the lean-and-hold two-card choice. ShellSiege replaced it |
| `systems/gbSdk.js` | 235 | **none** | Host bridge. Copied into **8 games**. ShellSiege has not got it yet |
| `systems/analytics.js` | 349 | **none** | Needs the shared GA4 vocabulary (below) |
| `systems/survival.js` | 72 | none | Hearts, `heal()`, hit-blink. Pure logic |
| `systems/ground.js`, `sprites.js`, `horde.js` | yes | none | Pixi/2D specific (horde is a timer spawner) |
| `core/run.js`, `rooms.js`, `roll.js` | none | new | Pure logic, no renderer import, but `rooms.js` calls ShellSiege's `makeFoe`/`BREEDS`, so it **needs an adapter** |
| `render/*` (11 files), `throwing.js`, `weapon.js`, `facing.js`, `axes.js` | none | yes | Three.js and the 3D camera. **Cannot cross** |

### 7.2 Three moves worth making, in order

**1. Survivor's ability icon art -> ShellSiege. Small, high value, no design decision.**
`TmntSurvivor/assets/ability_icons.webp` is 1536x192: eight 192 px icons in the order
`rapid, multi, damage, pierce, reach, swift, magnet, katana`, used as a CSS sprite
(`src/style.css`, `background-position-x: calc(N * 100% / 7)`).

![Survivor ability icons](shots/survivor-ability-icons.png)

ShellSiege's keys are `rapid, multi, damage, pierce, reach, swift, hearts`. **Six of seven are
the same keys.** The art is shuriken-themed, which fits a game that throws blades. Today
ShellSiege ships my placeholder SVGs (`ShellSiege/src/ui/icons.js`, which I flagged as
placeholder-grade). The one icon with no match is `hearts` ("THICK HIDE"): that needs one
new icon in the same hand. Elad has not asked for this yet.

**2. `gbSdk.js` and the analytics vocabulary -> ShellSiege. Needed for its Phase 2.**
The host app injects `window.GoBalance` with `load`, `save`, `submitScore`, `getScoreboard`,
`getProfile`, `getPlayers` (per-profile, versioned payloads advised by the host README). It is
**not in `GOBALANCE_SDK.md`**; I told Elad "there is no save API" earlier because I only read
that doc, which was wrong. The working precedent is `HillBombSunsetRidge/src/systems/gbProfile.js`
(guarded `localStorage` fallback at a plain dev URL). Analytics names are registered once in
GA4, so ShellSiege must reuse the shared vocabulary **to the letter** (see the header of
Survivor's `analytics.js`) and must not invent its own. **Not yet proven on a real board.**

**3. The "fix both" rule for the two identical files.**
Run this before touching `pace.js` or `input.js`, and after:

```bash
cd /Users/eladayzen/UnityProjects/WebViewGames/.claude/worktrees
for f in core/pace.js systems/input.js; do
  a=sewer-swarm/ShellSiege/src/$f; b=survivor-look/TmntSurvivor/src/$f
  [ -f "$a" ] && [ -f "$b" ] || { echo "MISSING   $f (not a divergence: a path does not exist yet)"; continue; }
  cmp -s "$a" "$b" && echo "same      $f" || echo "DIVERGED  $f  -> tell the other agent"
done
```
(Tested today against the two copies that exist: both print `same`.)

### 7.3 Options that need Elad's decision (listed because he asked, not because I recommend them)

- **`roll.js` into Survivor** (no-choice ability reveal). Elad said choosing "is not as fun"
  with the board but "maybe we'll bring it back". Survivor's lean-and-hold stays unless he says.
- **Rooms and a campaign in Survivor.** Possible with a small adapter (each enemy needs a
  spawn `cost`). It would change the game's whole structure; not a look-pass matter.
- **`survival.js` hearts and pizza drops into ShellSiege**, as an alternative to heal-on-clear.
- **A telegraphed enemy attack in Survivor.** ShellSiege's foes follow walk -> windup ->
  recover, with damage committed on the release frame; Survivor's are contact-damage.

### 7.4 What cannot be shared, and why

Pixi 2D (flat mirrored sheets, `webp`) versus Three.js 3D (rigged `glb`, retargeted clips)
share **no render code and no assets** apart from UI icons. Enemies, floors, characters and
animation do not cross. Do not try.

### 7.5 How to share without a package

The repo has **no shared package**: each game is a self-contained folder, and the host bridge
has been copied (not linked) into eight games. Keep it that way unless Elad says otherwise.
Copy deliberately, put a provenance line in the header of the copied file, and never copy
silently. This is also the honest answer to the "no templating from sibling games" rule:
**contract and bridge code** (the SDK, DOM ids, input signs, analytics names) is mandatory
reuse; **design and internals** are not, and anything in 7.3 crosses that line by definition.

---

## 8. Checklist before you call a Survivor change done

1. `npm test`: **101 pass** (new tests may add to it; none may be removed to get green).
2. `npm run build`, then serve `dist/` and look at it in the `chrome-devtools` page.
3. **At least three frames**, spread over time. Remember the hit-flicker hides the player.
4. Motion checked in a sequence, not inferred from one still.
5. `__pumpFrames`, `#gameover-overlay`, `#restart-button` survive the build (grep `dist/`).
6. New assets: explicit `new URL(...)` in `sprites.js`; bundle size reported against 1.2 MB.
7. If landing into `StreamingAssets`: manifest has no `.meta` and does not list itself; `.meta`
   counted in both directions; **say in words** whether Unity has imported yet.
8. Nothing committed, nothing pushed, unless Elad asked in that message.

---

## 9. Questions for Elad, so neither agent guesses

1. ~~Which style guide?~~ **Answered:** TMNT_M1 toddler sheet, keep current.
2. **What does "better" cover?** (Still open. The Survivor agent's first job is a short proposal
   to Elad, so it is Elad who answers.) Characters and enemies, HUD, effects, or all of it?
3. **Does Survivor keep lean-and-hold** for abilities, or adopt the no-choice reveal?
4. ~~Commit `TmntSurvivor/reference/`?~~ **Answered by the split:** no. It is now *copied* into the
   Survivor worktree (untracked there too), so the projects share nothing and neither depends on
   the other's folder. Committing it remains Elad's call, never an agent's.
5. **Is "TMNT Survivor" the real name?** It is a working title that is already the save key.
6. **Still pending from HANDOFF:** a board verdict on `?pace=0.7`, and a garbled dictated
   sentence never clarified: *"just bring me a contact. So, it comes back maybe he wouldn't
   have done anything, no one would repeat what happened."*

---

## ShellSiege today (context for the Survivor agent)

A three.js 3D prototype in the same family: Raphael on an isometric plaza, auto-throwing,
against five armoured constructs. It is now a room-clearing campaign: clear a room, a pizza
box opens on one random ability, levels bank. **196 tests pass.** Build **6.32 MB** (measured
in bytes; earlier figures in chat were disk blocks). **Uncommitted**, in the `sewer-swarm`
worktree. It is not the thing you are working on; it is here so you know what your sibling is.

![ShellSiege mid-room](shots/shellsiege-gameplay.jpg)
![ShellSiege enemies, mid-stride](shots/shellsiege-enemies.jpg)
![ShellSiege ability reveal](shots/shellsiege-roll.jpg)

The reveal box and the `SPLIT THROW` icon in that last frame are placeholders. The icon is
one of the things section 7.2 proposes replacing with Survivor's art.
