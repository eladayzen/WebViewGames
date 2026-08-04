// Bomb-kill collection set (2026-08-02, timer added 2026-08-04). Every
// player-caused bomb destruction that does NOT cost a life -- shield block,
// "blow up" (wave), and later ooze projectiles -- counts as a "kill": it
// awards `killScore` and fills this set. Completing the set works like a
// pizza box: a score bonus + `boosterCount` distinct boosters (matched to
// the second-tier / Blue box), then it resets.
//
// Now has a timer, same start-on-first-progress/reset-on-expiry shape as a
// pizza box (systems/bombKills.js's registerBombKill/updateBombKills). Set
// more generous than even the REGULAR pizza box's 156s -- a bomb kill is a
// rarer sub-event than a pizza catch (needs a bomb AND an active shield/
// blow-up already up), so 8 of them needs more real time to be achievable,
// not less. All numbers tunable/directional.
export const BOMB_KILL_SET = {
  id: 'bombsquad',
  label: 'Bomb Squad',
  hex: '#FF7A2E',       // hazard orange -- HUD chip, "+N" popup, celebration tint
  requiredCount: 8,     // kills to complete a set
  timerSec: 150,        // resets progress if 8 kills aren't reached in time
  killScore: 25,        // points per kill
  bonusScore: 150,      // flat bonus on completion (Blue-box level)
  boosterCount: 2,      // distinct boosters granted on completion (Blue-box level)
};
