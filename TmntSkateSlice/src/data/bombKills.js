// Bomb-kill collection set (2026-08-02). Every player-caused bomb destruction
// that does NOT cost a life -- shield block, "blow up" (wave), and later ooze
// projectiles -- counts as a "kill": it awards `killScore` and fills this set.
// Completing the set works like a pizza box: a score bonus + `boosterCount`
// distinct boosters (matched to the second-tier / Blue box), then it resets.
//
// No timer (unlike pizza boxes): kills accumulate until the set completes --
// you can't force bomb kills on a clock. All numbers tunable/directional.
export const BOMB_KILL_SET = {
  id: 'bombsquad',
  label: 'Bomb Squad',
  hex: '#FF7A2E',       // hazard orange -- HUD chip, "+N" popup, celebration tint
  requiredCount: 8,     // kills to complete a set
  killScore: 25,        // points per kill
  bonusScore: 150,      // flat bonus on completion (Blue-box level)
  boosterCount: 2,      // distinct boosters granted on completion (Blue-box level)
};
