#!/bin/sh
# Recapture the two level screenshots (3D Toon, Ooze Street) into shots/levels-N.png. Headless + muted.
cd "$(dirname "$0")"
for n in 1 2; do EVALS="__noSpawn=true" node capture.mjs "levels.html?level=$n" levels-$n 3500 >/dev/null 2>&1; mv shots/levels-$n-1.png shots/levels-$n.png; done
