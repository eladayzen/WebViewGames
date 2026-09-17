# Skateboard Extreme — the mission ladder

**Generated — do not edit.** `npm run missions` rebuilds it from
`src/data/missions.js`, which is the only place these numbers live.

Counts are EFFECTIVE: what the player is actually asked for, after the
0.7 difficulty scaling. The authored numbers in the source are higher.

- **DP** — difficulty points. Budget: under 50 through the middle, 60 at most in the last ten.
- **ramp %** — the ramp ask as a share of the ramps that exist on that hill in that clock.
  Anything over 40% is a "hunt them all" rather than a "collect some". This is the
  column the original model never checked, and it is how mission 15 shipped asking for
  91% of them.
- **2★ / 3★** — score thresholds. The first star is finishing at all.
- **ceiling** — every point-bearing prop on that hill, measured. The star bars are 55% and 85% of it.

| # | mission | clock | terrain | objectives | DP | ramp % | 2★ | 3★ | ceiling |
|--:|---|--:|---|---|--:|--:|--:|--:|--:|
| 1 | **CRYSTAL RUN** | 90s | ridgeDrops | 8 crystals | 8 | — | 9,500 | 14,500 | 24,370 |
| 2 | **FIRST DROP** | 80s | ridgeWeave | 5 ramps | 15 | 26% | 3,500 | 5,500 | 9,244 |
| 3 | **RAIL RUNNER** | 90s | ridgeNarrows | 4 rails | 16 | — | 5,500 | 8,500 | 14,286 |
| 4 | **SPEED GATES** | 95s | ridgeLongFall | 4 gates | 16 | — | 6,000 | 9,500 | 15,966 |
| 5 | **IDOL HUNT** | 130s | ridgeStaircase | 7 idols | 35 | — | 7,000 | 10,500 | 17,647 |
| 6 | **CRYSTAL HAUL** | 85s | ridgeBowl | 18 crystals | 18 | — | 10,500 | 16,500 | 27,731 |
| 7 | **IRON LINE** | 100s | ridgeDrops | 4 rails + 6 ramps | 44 | 26% | 10,500 | 16,500 | 27,731 |
| 8 | **FAST LANE** | 75s | ridgeWeave | 12.0k pts | 27 | — | 11,000 | 17,000 | 28,571 |
| 9 | **FULL PLATE** | 95s | ridgeNarrows | 11 crystals + 2 rails + 4 ramps | 53 | 18% | 11,000 | 17,000 | 28,571 |
| 10 | **RIDGE MASTER** | 100s | ridgeLongFall | 16 crystals + 8.5k pts | 40 | — | 10,500 | 16,500 | 27,731 |
| 11 | **DOUBLE DOWN** | 90s | ridgeStaircase | 16 crystals + 5 ramps | 40 | 24% | 11,000 | 17,000 | 28,571 |
| 12 | **STEEL RUSH** | 105s | ridgeBowl | 4 rails + 8.0k pts | 42 | — | 10,500 | 16,500 | 27,731 |
| 13 | **HIGH ROLLER** | 85s | ridgeDrops | 15.0k pts | 35 | — | 10,500 | 16,500 | 27,731 |
| 14 | **SWEEP** | 100s | ridgeWeave | 10 crystals + 5 gates | 39 | — | 11,000 | 17,000 | 28,571 |
| 15 | **LAUNCH PARTY** | 95s | ridgeNarrows | 7 crystals + 8 ramps | 40 | 36% | 11,000 | 17,000 | 28,571 |
| 16 | **GOLD RUSH** | 105s | ridgeLongFall | 16 crystals + 3 idols | 40 | — | 10,500 | 16,500 | 27,731 |
| 17 | **GRIND CITY** | 110s | ridgeStaircase | 22 crystals + 3 rails | 44 | — | 11,000 | 17,000 | 28,571 |
| 18 | **TOP SPEED** | 90s | ridgeBowl | 4 gates + 8.0k pts | 44 | — | 10,500 | 16,500 | 27,731 |
| 19 | **THE GAUNTLET** | 110s | ridgeDrops | 8 crystals + 8 ramps | 42 | 31% | 10,500 | 16,500 | 27,731 |
| 20 | **LAST LIGHT** | 120s | ridgeWeave | 18 crystals + 11.0k pts | 49 | — | 11,000 | 17,000 | 28,571 |
| 21 | **NIGHT SHIFT** | 100s | ridgeNarrows | 5 idols + 3 rails | 48 | — | 11,000 | 17,000 | 28,571 |
| 22 | **FREE FALL** | 90s | ridgeLongFall | 8 ramps + 6.5k pts | 44 | 38% | 11,000 | 17,000 | 28,571 |
| 23 | **STONE STEP** | 105s | ridgeStaircase | 5 ramps + 5 gates | 46 | 21% | 10,500 | 16,500 | 27,731 |
| 24 | **DEEP END** | 95s | ridgeBowl | 15.0k pts | 34 | — | 11,000 | 17,000 | 28,571 |
| 25 | **LOOSE PACK** | 110s | ridgeDrops | 11 crystals + 8 ramps | 46 | 31% | 10,500 | 16,500 | 27,731 |
| 26 | **SWITCH HOUSE** | 100s | ridgeWeave | 18 crystals + 4 gates | 44 | — | 10,500 | 16,500 | 27,731 |
| 27 | **PINCH POINT** | 85s | ridgeNarrows | 5 ramps + 6 gates | 51 | 25% | 11,000 | 17,000 | 28,571 |
| 28 | **LONG HAUL** | 115s | ridgeLongFall | 5 rails + 10.0k pts | 51 | — | 11,000 | 17,000 | 28,571 |
| 29 | **STEP LADDER** | 100s | ridgeStaircase | 8 ramps + 9.0k pts | 52 | 35% | 10,500 | 16,500 | 27,731 |
| 30 | **STORM CHASE** | 110s | ridgeBowl | 5 idols + 3 rails | 48 | — | 11,000 | 17,000 | 28,571 |
| 31 | **IRON WILL** | 95s | ridgeDrops | 22 crystals + 4 rails | 49 | — | 10,500 | 16,500 | 27,731 |
| 32 | **FAST CURRENT** | 80s | ridgeWeave | 5 gates + 8.5k pts | 51 | — | 10,500 | 16,500 | 27,731 |
| 33 | **CLEAN SWEEP** | 105s | ridgeNarrows | 30 crystals | 30 | — | 11,000 | 17,000 | 28,571 |
| 34 | **BIG NUMBERS** | 90s | ridgeLongFall | 15.0k pts | 34 | — | 11,000 | 17,000 | 28,571 |
| 35 | **NERVE PLAY** | 90s | ridgeStaircase | 18 crystals + 8 ramps | 55 | 38% | 10,500 | 16,500 | 27,731 |
| 36 | **SKY LINE** | 95s | ridgeBowl | 8 ramps + 5 gates | 57 | 36% | 11,000 | 17,000 | 28,571 |
| 37 | **TIGHT ROPE** | 85s | ridgeDrops | 5 idols + 4 rails | 53 | — | 10,500 | 16,500 | 27,731 |
| 38 | **FULL TILT** | 85s | ridgeWeave | 7 ramps + 11.5k pts | 57 | 35% | 10,500 | 16,500 | 27,731 |
| 39 | **LAST CALL** | 100s | ridgeNarrows | 5 crystals + 3 rails + 5 ramps | 54 | 22% | 11,000 | 17,000 | 28,571 |
| 40 | **SUNDOWN** | 115s | ridgeLongFall | 5 idols + 4 gates | 53 | — | 11,000 | 17,000 | 28,571 |

## Briefs

 1. **CRYSTAL RUN** — Something to collect, and a hill to do it on.
 2. **FIRST DROP** — Ramps, and ground that gives way.
 3. **RAIL RUNNER** — Green metal. Get on it and stay on.
 4. **SPEED GATES** — Ride the arches. They give the hill back.
 5. **IDOL HUNT** — Ten of them, and never where you already are.
 6. **CRYSTAL HAUL** — Leave nothing shining behind you.
 7. **IRON LINE** — Find the rails. Ride them properly.
 8. **FAST LANE** — Tuck low and let the hill do the work.
 9. **FULL PLATE** — A bit of everything, and no time to spare.
10. **RIDGE MASTER** — Prove you have learned the whole ridge.
11. **DOUBLE DOWN** — Crystals everywhere, ramps in between.
12. **STEEL RUSH** — Rails pay, and they pay while you are on them.
13. **HIGH ROLLER** — One number matters. Make it big.
14. **SWEEP** — Sweep the hill, gates and all.
15. **LAUNCH PARTY** — Every ramp you can reach, and what lies between.
16. **GOLD RUSH** — Crystals, and the idols among them.
17. **GRIND CITY** — Metal first, everything else after.
18. **TOP SPEED** — Ride every gate you can reach.
19. **THE GAUNTLET** — All three, all at once, all downhill.
20. **LAST LIGHT** — The last run before the sun goes.
21. **NIGHT SHIFT** — The idols are out tonight.
22. **FREE FALL** — Let the ground do the work.
23. **STONE STEP** — Ramp to gate, all the way down.
24. **DEEP END** — High walls. Use them.
25. **LOOSE PACK** — Everything on the hill is worth points.
26. **SWITCH HOUSE** — The road never lets you settle.
27. **PINCH POINT** — Narrow, and the gates are on the edges.
28. **LONG HAUL** — Wide open and a long way down.
29. **STEP LADDER** — Every drop pays if you land it.
30. **STORM CHASE** — Idols in the bowl. Go and get them.
31. **IRON WILL** — Rails first. Everything else after.
32. **FAST CURRENT** — Never stop accelerating.
33. **CLEAN SWEEP** — Leave nothing on the hill.
34. **BIG NUMBERS** — Chain it. That is the only way.
35. **NERVE PLAY** — Three demands, one short clock.
36. **SKY LINE** — Ramps into gates, and nothing slower.
37. **TIGHT ROPE** — Idols on the tightest hill there is.
38. **FULL TILT** — Nothing held back.
39. **LAST CALL** — Everything you have learned, at once.
40. **SUNDOWN** — Everything the ridge has, one last time.

## Totals

- 40 missions, 65m 0s of clock end to end
- DP from 8 to 57
- over budget (DP > 60): none
- ramp asks over 40% of supply: none
- missions asking for each kind: crystal 17, ramp 15, rail 11, gate 9, idol 6, pts 13
