# Archived: pre-Track-B Sewer / Warehouse / Docks backgrounds

Original Kolbo-generated versions of `bg_sewer.png`, `bg_warehouse.png`,
and `bg_docks.png`, kept as a backup before Track B's `generate_image_edit`
pass (2026-08-06) fixes their floor-obstruction issues (see the
floor-alignment plan discussed that day): Sewer's floor is really three
zones split by a center water channel, Warehouse has pallets/cable clutter
intruding deep into both edges, and Docks' deck physically narrows away
near the right edge with no floor pixels past a point. Unlike Fire
Escape/Alley/Subway, these three needed too much crop to fix with the
scale/pan approach in `core/render.js`'s `drawBackground` alone, so the
art itself is being edited directly.

Restore by copying a file back to `src/assets/` if the edited version
doesn't work out.
