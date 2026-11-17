# Sewer Shred — worlds (branch `claude/sewer-shred-look`)

Elad, 2026-11-16: "devide them to groups of worlds. a world can show a few different pipe areas."

## Built

| World | Areas | Feel |
|---|---|---|
| **SEWERS** (upper deck) | COPPER DEEP, VERDIGRIS RUN, THE HONEYCOMB (clean Kolbo redraws of the patina tiles: `clean_*.jpg`) | river, waterfalls, the usual obstacles + Foot Soldiers. 3 areas × 300 m per visit |
| **SUBWAY** (lower deck) | OLD MAINLINE (warm concrete), STORM DRAIN (grey concrete) | a short moment (one 330 m area): two low metal rails, no river/waterfalls, no sewer obstacles; **trains** come at you up the rails (dodge up the wall; a near miss = CLOSE CALL) |

Parked as too noisy (Elad): brick, iron vault, cave, rust, station tile, HAZARD LINE.

## Junctions (track.js `FORKS`, one machinery, three kinds)

At the end of every visit:
- **Sewers →** either a **Y** (40% of the time): two arms, two different sewer areas; the half of the
  pipe you're on picks the arm, locked at the last moment (2 m before the split). The arms are real
  geometry, each cut away where it runs inside the other.
- **Sewers →** or a **drop**: a hole in the floor (dark pit, yellow lips) over a chute 14 m down to
  the subway. Narrow hole (0.5 rad) = your call: ride over it to fall in, round it to stay up.
  Wide hole (the whole reachable arc) = forced ("FLOOR'S OUT!").
- **Subway →** always a **ramp** that forces you back up into the sewers.

No obstacles, lamps or waterfalls in a junction; river/rails dry out through it.

## Next

1. Technodrome world (needs Kolbo sci-fi panel art), probably as another Y/drop destination.
2. Open-top tube + matte painting (we only play 180/220).
3. Train art (the cars are plain boxes with an ink hull).

Dev: WORLD button / N key = start world; `?world=subway`; `track.nextKind = 'y' | 'drop' | 'forced'`
forces the next junction; `node tools/drive.mjs <out> --script=fork --kind=… --off=… --marks=…`.
