# Shell Siege — lobby tile

Generated with Kolbo `gpt-image-2` from a real screenshot of the production
build (`source-prepped/ShellSiege_source.png`), 12 credits, one generation, no
re-rolls.

## The name

**Shell Siege.** It was already the working title and it is what the game
literally is: one turtle with a shell, holding ground while a crowd closes in.
Two words, alliterative, trivially legible as a logo at 200px.

It is a DISPLAY title only. The save key is `TurtlesActionGame` and is settled
separately — see `../DROP.md`. Those two never need to match, and the one that
can never change is already fixed.

## Sizes

| file | size | for |
|---|---|---|
| `output/Shell Siege 600x680.png` | 600×680 | what the lobby wiring asked for |
| `output/Shell Siege.png` | 200×226 | the size in the thumbnail skill |
| `output/@2x/Shell Siege.png` | 400×452 | @2x of that |
| `output/masters/Shell Siege.png` | 864×976 | re-export at any size, free |

All RGBA, fully opaque, **square corners** — Unity rounds them so every tile is
cut the same way. Art goes full bleed; no frame is baked in.

## One thing worth keeping

`finalize.py` trims a 3:4 generation down to 0.885 and takes **25% off the top**
by default, because gpt-image-2 ignores "safe area" clauses and usually puts the
title about 5% from the top. Here it put the title higher still — a 25% top
share would have cut the ascender off the first "S". Run with
`--top-share 0.05`, and check the contact sheet before trusting any trim.

## Content notes

The platform rule is that tiles read friendly and energetic, never scary or
gritty, and this game's enemies are skeletons — so the prompt asks for them
explicitly as rounded, goofy, big-eye-socket cartoons, and says outright that
it is for young children with no horror and nothing grim. Worth keeping that
clause if this is ever regenerated.

The medallion, the teal rune ring and the braziers in the art are the real ones
from the game, not invented.
