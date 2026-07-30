// Power-up pickup definitions (special abilities, progression update
// 2026-07-30). Falling rare pickups caught the same way as everything else
// (no new input). Each has a distinct icon shape + color so all four read
// apart at a glance -- colors chosen to not collide with pizza-reward gold,
// bomb amber, or the box-variant blue/purple/red:
//   ooze   cyan/teal  -- wider hit-tolerance buff (existing effect, recolored
//                        FROM green so green could go to shield)
//   shield green       -- blocks bomb hits for a duration
//   wave   orange      -- instant: clears every bomb currently on screen
//   magnet pink        -- pulls good items toward the player for a duration
//
// `effect` is what core/main.js dispatches on. `weight` is the relative share
// of the stage's power-up spawn budget (stage.powerUpChance) -- ooze most
// common (the baseline), the 3 flashy ones rarer. Durations live in
// data/constants.js (grant* fns in entities/player.js read them); wave has no
// duration (instant). All first-pass/directional -- tune against feel.
export const POWER_UPS = [
  { id: 'ooze',   effect: 'ooze',   sprite: 'ooze_canister', kind: 'power-up', hex: '#1FC8D8', weight: 0.34 },
  { id: 'shield', effect: 'shield', sprite: 'powerup_shield', kind: 'power-up', hex: '#4CE05A', weight: 0.26 },
  { id: 'wave',   effect: 'wave',   sprite: 'powerup_wave',   kind: 'power-up', hex: '#FF8A2E', weight: 0.22 },
  { id: 'magnet', effect: 'magnet', sprite: 'powerup_magnet', kind: 'power-up', hex: '#F84FA0', weight: 0.18 },
];

export const POWER_UP_BY_EFFECT = Object.fromEntries(POWER_UPS.map((p) => [p.effect, p]));

// Weighted pick among the power-ups (called once rollItemType has decided a
// power-up spawns). A fresh sub-roll -- the stage budget decides "a power-up
// drops," this decides which one.
export function pickPowerUp() {
  const total = POWER_UPS.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (const p of POWER_UPS) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return POWER_UPS[0];
}
