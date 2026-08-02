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
// of the stage's power-up spawn budget (stage.powerUpChance). Durations live in
// data/constants.js (grant* fns in entities/player.js read them); wave has no
// duration (instant). All first-pass/directional -- tune against feel.
//
// OOZE DISABLED 2026-08-02 (Amit): not in use for now. Its weight is 0 so it
// never occupies a falling-item slot (pickPowerUp skips zero-weight entries),
// and its old 0.34 share was folded into SHIELD -- so every slot that used to
// bring an ooze canister now brings a shield instead. Shield is now the
// dominant power-up; wave/magnet stay as the rarer "flashy" ones for variety.
// To re-enable ooze later: give it a weight again (and trim shield's).
export const POWER_UPS = [
  { id: 'ooze',   effect: 'ooze',   sprite: 'ooze_canister', kind: 'power-up', hex: '#1FC8D8', weight: 0.0 },
  { id: 'shield', effect: 'shield', sprite: 'powerup_shield', kind: 'power-up', hex: '#4CE05A', weight: 0.60 },
  { id: 'wave',   effect: 'wave',   sprite: 'powerup_wave',   kind: 'power-up', hex: '#FF8A2E', weight: 0.22 },
  { id: 'magnet', effect: 'magnet', sprite: 'powerup_magnet', kind: 'power-up', hex: '#F84FA0', weight: 0.18 },
];

export const POWER_UP_BY_EFFECT = Object.fromEntries(POWER_UPS.map((p) => [p.effect, p]));

// Weighted pick among the power-ups (called once rollItemType has decided a
// power-up spawns). A fresh sub-roll -- the stage budget decides "a power-up
// drops," this decides which one. Zero-weight entries (e.g. disabled ooze) are
// excluded, so a disabled power-up can never spawn even as the fallback.
const SPAWNABLE_POWER_UPS = POWER_UPS.filter((p) => p.weight > 0);

export function pickPowerUp() {
  const total = SPAWNABLE_POWER_UPS.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (const p of SPAWNABLE_POWER_UPS) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return SPAWNABLE_POWER_UPS[0];
}
