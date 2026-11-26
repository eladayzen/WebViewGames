# ShellSiege v2: game design / PRD

Source: Elad's FigJam board "GameDesigns-TMNT" (flow diagram) plus his answers of 26 Nov 2026.
Status: design agreed. BUILT (26 Nov): weapon/skill rule, skill pick, death summary with random title, level-clear stats, 4 slots, level flythrough. Not yet built: dagger-as-skill. Old saves are dropped.

## Scope rule for this stage

**UX and UI changes only. No new styling, no generated art, no Kolbo credits.** Everything is built from the assets and CSS
that exist. A look revamp is the next stage; Elad is gathering style references. Anything that needs new art uses the
existing icons and shapes as placeholders.

## The one-line rule

**Weapons are temporary. Skills are permanent.** Turtles are a kind of weapon.

| | Weapons (incl. turtles) | Skills (the "Ref upgrades") |
|---|---|---|
| Lifetime | temporary: all lost on death | permanent: kept forever |
| Effect | small boost | big boost |
| Offered | at the start of every room (the giveaway) | once, after the last room of a level is won |
| How | shuffle (spin), or pick 1 of 2 | pick 1 of 2 |

The basic dagger throw is never lost. Elad is considering making the dagger's base numbers (and the second dagger) a
skill. Parked for later; the current perm pool stays for now (rapid, damage, reach, hearts, pierce).

## Flow

1. **Lobby**: 4 save slots (below). Slots exist -> slot list. All empty -> straight to Start New Game.
2. **First time only (new game)**: Level Travel. Show the advanced levels as potential, then tween back to focus on level 1.
3. **Room loop**: Room Start -> Giveaway (weapon or turtle) -> Fight.
   - First room of a level: the starting shuffle gives the first weapon (after a death all weapons are gone).
   - Tap during the giveaway to speed it up (nice to have).
4. **Fight**: unchanged for now (Donnie's drops and the fight explanation are explicitly left as they are).
5. **Middle room won**: Room Traveling (the map moment), then the next Room Start.
6. **Last room won**: celebration and final travel, with stats -> **skill pick (1 of 2, permanent)** -> Level Travel
   (the island view, star(s), next level) -> next level's first room.
7. **Death**: Run Summary -> back to room 1 of the same level. All weapons lost (except the basic dagger); skills kept.

Weapons carry from level to level until death. They are never reset by a level change. The strip keeps growing (no cap yet;
revisit after play).

## Giveaway

- Choose = pick 1 of 2 (as today). Shuffle = the spin wheel (as today). The same two modes stay.
- Proposed default for play-testing: **shuffle for weapons, choose for skills.** Switchable by URL param for the A/B.
- Card style for the choice: see the artifact comparing the banner-card and the big-icon layouts.

## Run Summary (death)

- Comforting title, picked at random each time from three drafts (below).
- Rooms cleared (total), mobs killed, weapons lost (the strip of what was held).
- One button: back to room 1.

Title drafts: **"Even heroes need a nap"**, **"The shells are still strong"**, **"Next time, cowabunga"**.

## Last-room celebration stats

Rooms cleared, mobs killed, time, hits taken. Shown during the celebration before the skill pick.

## Slots and saves

- **4 slots.** A slot saves: the permanent skills, the level reached, and, if a run is in progress, the temporary weapons
  and the last room started.
- **Resume**: quitting mid-run saves only *which room was last started*. Coming back starts that room from its beginning.
  Nothing inside a room (enemy state, hp) is saved.
- **Highest reach only.** No replaying earlier levels, no level select.
- **Last played date and time**: saved per slot; used to order the slots (most recent first). Whether to show it is open.
- **Slot card** shows: level reached (the island icon if possible), skill icons. If all four slots are full, a delete option
  appears when starting a new game.
- The existing lobby (level cards and room map) is replaced.
- The Unity folder `TurtlesActionGame` and the localStorage key `shellsiege.progress` are permanent save keys; migrate, never rename.

## Level Travel

- First time in a new game only: advanced levels shown as potential, camera tweens back to level 1.
- After clearing a level: the island view with the earned star(s) and the next level, then straight in.
- Reference: islands with "Reach X-Y"; each level has its own world look (styling is a later stage).

## Open items

- Dagger base numbers as a skill.
- Weapon cap, if the strip gets too long.
- Shuffle vs choose vs both, decided by play-testing.
- Donnie's drops; the fight-phase explanation.
- Whether the slot shows the last-played time.
- Look revamp (next stage).

## What changes in the code (from today's game)

| Today | v2 |
|---|---|
| Boxes roll weapons and skills, half and half | between rooms: weapons and turtles only |
| Skills banked at level clear from whatever was found | one skill pick (1 of 2) after the last room |
| One save blob with a run | 4 slots, each its own blob, with a timestamp |
| Lobby with level cards and room map | slot list; level travel on first new game |
| OVERRUN shows kept vs lost | death summary: rooms, mobs, weapons lost; skills untouched |
