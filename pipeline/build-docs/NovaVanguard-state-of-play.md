# Nova Vanguard — state of play

**Written 2026-09-02, updated 2026-09-07. The game is shipped into the GoBalance
app and is the reference implementation for everything in
`GOBALANCE_APP_INTEGRATION.md`.**

**If you are picking this game up:** read this file, then
`GOBALANCE_APP_INTEGRATION.md`, then the app team's own
`~/UnityProjects/gobalance/Assets/GoBalance/WebGames/README.md`. Then read
`src/data/tuning.js` — it is 3,700 lines and every constant carries the
measurement or the quote behind it, which makes it the real design document.

Why this file exists: the build doc (`NovaVanguard.md`) is dated 13 Aug and was
written before a line of the game existed, and the decision note
(`NovaVanguard-decision-poc8.md`) stops at playtest round 2 on 16 Aug — where it
still says *"three levels, not five."* Everything from round 3 onward, plus the
whole app integration, lives only in code comments and git history. This is the
catch-up: what the game **is** now, so the next decision starts from the real
thing rather than from the plan.

Where this disagrees with the build doc, **this file is what shipped**. The
build doc is kept as the record of intent, not as a description.

---

## Content inventory

**Five levels, index-locked 1:1 to surfaces, each with its own boss.** No boss
repeats — that was explicit (round 7).

| # | Surface | Boss | Look |
|---|---|---|---|
| 1 | `ashfall` | CINDERJAW | lava, dark |
| 2 | `skyfield` | NADIR COIL | open sky, bright |
| 3 | `kesselring` | BROOD GANTRY | shipyard, dark |
| 4 | `glacis` | VESPIDAE | open ice, bright |
| 5 | `bulwark` | SIEGE WARDEN | armour, dark |

The bright/dark alternation is deliberate (round 7): the game never runs three
grim industrial levels in a row. The Hive Plate surface was cut entirely —
Amit: *"don't use the hive plate at all."*

**Enemies:** 5 kinds — `drone`, `lancer`, `emitter`, `warden`, `splitter` — each
with `normal` and `elite` tiers. **Formations:** F1–F5, 30 authored wave entries.

**Player weapons:** `standard` plus 5 pickups — `scatter`, `rapid`, `lance`,
`swarm`, `flak` — and two non-weapon effects, `barrier` (7 s) and `repair` (+2).
Drop weights are heavily skewed to `rapid` (3.20) against `repair` (0.30);
weapon supply is deliberately scarce, about two per level.

**Audio:** 18 clips, one music bed. Two takes of the music exist
(`art/audio-raw/music-take1|2.mp3`); take 1 ships.

---

## The single biggest fact about the campaign

**It does not end.** `main.js:344`:

```js
const to = (world.surfaceIndex + 1) % SURFACES.length;
```

After SIEGE WARDEN the run wraps to `ashfall` and continues — and **nothing
scales on the second lap.** Level 2 is as hard the third time through as the
first. There is no victory screen, no "you finished it", and no reason for a
strong player to keep going except their own score.

This was never decided; it is what the modulo does. Any content plan has to
answer it first, because it determines whether new content means *more levels*
or *more reasons to replay five*.

---

## Decisions made after the decision note stops

Compressed, with the reason, because the reason is the part that stops it being
re-litigated:

- **Five levels, not three.** The note's "three levels" was superseded once
  surfaces existed and each earned a boss.
- **Bosses must actually fight.** Pod bosses were silent because *one pod = one
  pattern* — fixed with `hullPatterns: ['B1']` on all four. The first fix (a
  pressure floor) treated the symptom; simulation proved the last pod *was*
  firing, just with nothing to fire.
- **Escorts removed from boss fights.** Amit: bosses shooting back is what makes
  a boss, not more bodies on screen.
- **SWARM is suppressed during bosses** rather than fixed — it reads badly
  against a large static target, and the cheap answer was to not offer it there.
- **Level 1 is locked** and its fire rate eased to 1.15× from a measured soak
  (12 concurrent bullets peak against a cap of 22), *after* the emitter-geometry
  bug was fixed — so the easing wasn't double-counting a bug.
- **The game owns its audio.** The SDK no longer force-mutes; every game starts
  with sound on. Separate `sfx`/`music` buses under a master gain, a user-facing
  sound menu, prefs in `novavanguard:audio`.
- **The board bookends the run.** Leaderboard on the start screen (5 s) and the
  result screen (10 s), rows are *runs* not per-profile bests, true ranks, top 5
  plus a window around your own run.
- **Quitting is deliberate.** X asks while a run is live, over a paused
  playfield, and banks the score; the quit screen has no timer.
- **Dev tools are hidden** behind a 7 s hold plus a 4-digit code, split from a
  player-facing settings panel (sensitivity).
- **Avatars are derived, never mirrored** — initial on a colour from
  `avatarIndex`. The copied PNGs were deleted.

---

## Changed since this file was first written (7 Sep)

- **The campaign ends.** Beating level five's boss used to wrap silently back to
  level one. It now shows CAMPAIGN COMPLETE, then CONTINUE, then the board —
  reusing the QUIT screen rather than the result screen, because that screen
  already was the right shape (board, play again, leave, no clock). Finishing
  and stopping by hand differ only in the headline. `GameState.CLEARED` is
  separate from `FAILED` on purpose.
- **Pickups are more generous.** Drop chance +32 % across every type, dry-streak
  floor 22 → 16 kills, spacing gate 6.5 → 5.0 s (that gate, not the roll, was
  the real limiter at one canister on screen), and levels one and two carry a
  further ×1.30 through a per-level `pickupMul` that moves the roll AND the
  floor together. Simulated: 4.6 → 7.7 pickups per level in levels 1–2.
- **Shield 7 → 10 s, repair +2 → +3 hull** and it drops twice as often.
- **The vertical axis is faster.** Deadzone 0.28 → 0.20 and cap 270 → 350 px/s.
  The old comment defended the gap as "32 % of lateral", which is only true at a
  full pinned lean; at the moderate leans people actually hold it was 11–22 %.
  **350 is the ceiling** — R7 warns when the climb to the boss window drops under
  0.6 s, and at 350 it is 0.62 s.
- **The dev keypad no longer leaks its code.** It used to compare as-you-type and
  reset on the first wrong digit, so a correct digit added a dot and a wrong one
  did nothing — the pad answered each digit individually and a 4-digit code was
  worth about 36 guesses. Now every press adds a dot, nothing is judged until the
  last one, and a wrong code holds the full row before clearing. **`devUnlock.js`
  is a template copied into other games: Hill Bomb still has the leaky version.**
- **Avatars are derived, not mirrored.** Initial on a colour from `avatarIndex`;
  the copied PNGs are deleted.

## Open on the app team's side (raised, not fixed)

- `submitScore` resolves before the Firestore write commits, so a board fetched
  immediately after can miss the run just played.
- One board per game — the key comes from `folderName` and neither call takes a
  board id, so per-mode or per-mission boards are impossible today.
- `MaxRunsKept` is now 100 (was 10), which is what stopped quit-runs vanishing.
  It is still **best**-100, not last-100, so the same symptom returns for anyone
  with 100 better runs.
- Avatar art is not reachable from a page; a host-served endpoint would let every
  game stop deriving.

## Where things live

| Path | What |
|---|---|
| `src/data/tuning.js` | **3,681 lines. Every knob, each with the measurement or quote behind it.** Start here for any balance change. |
| `src/data/surfaces.js` | Surface identity, props, and which boss belongs to it |
| `src/data/bosses.js` | Boss definitions, phases, emitters |
| `src/systems/constraints.js` | The boot validator — runs in node with browser stubs; 0 errors is the gate before landing |
| `src/systems/scoreboard.js` | `submitRun` / `fetchBoard` / `resultSections` |
| `src/systems/audio.js` | Buses, prefs, gesture unlock |
| `src/ui/devUnlock.js`, `src/ui/settingsPanel.js` | Written to be lifted into the next game |

Landing into the app is `GOBALANCE_APP_INTEGRATION.md` at the repo root.

---

## Open threads

**Ours:**
- The campaign loop above — undecided, not designed.
- Level 1's waves are `POC_SCENARIO.waves` by reference. Fine, but it means the
  teaching level is still literally the POC's wave list.

**Theirs:** see "Open on the app team's side" above.
