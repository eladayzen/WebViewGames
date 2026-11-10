# TMNT surf reskin — Kolbo production log

## Visual DNAs (2026-11-10)
Source: Tales of TMNT style guide (TMNT_2024_SG_REV1.pdf), crops rendered at 200 dpi.
- `@tales_tmnt_style` — style — id 6af2e416f1da97211468d8a9 — refs: p43 comp (Defenders of NYC), p25 Leatherhead, p25 Ray Fillet, p25 Scumbug+Wingnut
- `@tales_mikey` — character — id 6af2e4219ad55a89f3ecf6f7 — refs: p23 MIKE_005 (standing), MIKE_006 (skateboard), MIKE_007 (crouch), MIKE_003 (kick)

## Mikey surfing — first test (2026-11-10)
nano-banana-pro, 4 variations, 1:1, DNAs @tales_mikey + @tales_tmnt_style, 72.8 credits, session 6af2e534ce7f92989466b6e3
- https://media.kolbo.ai/kolboai-media/generated-images/6ae6ed7ed49aaf5cd0e5e048/6aeb437327086616839746fa/tales_mikey-surfing-drawn-6af2e5359fc10d5f32fe265a-edit-1.jpeg
- https://media.kolbo.ai/kolboai-media/generated-images/6ae6ed7ed49aaf5cd0e5e048/6aeb437327086616839746fa/tales_mikey-surfing-drawn-6af2e5359fc10d5f32fe265a-edit-2.jpeg
- https://media.kolbo.ai/kolboai-media/generated-images/6ae6ed7ed49aaf5cd0e5e048/6aeb437327086616839746fa/tales_mikey-surfing-drawn-6af2e5359fc10d5f32fe265a-edit-3.jpeg
- https://media.kolbo.ai/kolboai-media/generated-images/6ae6ed7ed49aaf5cd0e5e048/6aeb437327086616839746fa/tales_mikey-surfing-drawn-6af2e5359fc10d5f32fe265a-edit-4.png
- **Picked: variation 2** (user, 2026-11-10). Cut out locally (remove_white_bg.py, 768 px) → scratchpad mikey/mikey_surf.png. Still to fix: chest X straps + "M" buckle.

## 2026-11-10 — Enemies (sea obstacles, boss, projectile)
- Refs uploaded: badguys1 (media 6af31466ce7f92989466ced2), boss1 (media 6af31467ce7f92989466ced4)
- generate_image nano-banana-pro, DNA @tales_tmnt_style, 4 prompts, session 6af31479ce7f92989466cee3, 72.8 credits (18.2 each)
  - obstacle A (brown/orange tentacle-hair blob): 6af3147ded765d7814c27055
  - obstacle B (yellow/mint blob, red band): 6af3147d931bb7c7c183f182 — came with painted sea; cropped at the waterline
  - boss flying (orange head, black tracksuit): 6af3147d931bb7c7c183f1b1
  - projectile (green ooze ball): 6af3147ded765d7814c2705a
- Cut out with a border flood-fill (keeps the boss's white eyes), not the global white key.

- 2026-11-10 jetski water boss: generate_image nano-banana-pro, DNA @tales_tmnt_style, session 6af32208ce7f92989466d361, 18.2 credits, id 6af3220ae7877679bbe98c5f (flood-fill cut-out -> jetski_boss.png). Two earlier shuriken/nunchaku attempts timed out (no charge).
