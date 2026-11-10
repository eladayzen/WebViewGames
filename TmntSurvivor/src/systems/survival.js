// GETTING HIT, AND RUNNING OUT.
//
// Without this the game has no pressure and therefore no tuning: enemy speed,
// horde growth and every ability's worth are all judged against "what happens
// if they reach me", and until something happens the answer is nothing.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return QS.get(k) !== null && Number.isFinite(v) ? v : d;
};

export const SURVIVAL = {
  // FOURTEEN. Doubled from seven on Elad's call, 1 Nov, after playing the
  // cut -- and the heart drop went UP 30% in the same breath, so this is a
  // deliberate reversal of the tightening made earlier the same day and not
  // a drift away from it.
  //
  // The history, because the number has now moved three times and the
  // reasoning is what carries: five (Bloop Squad's) ended every run in two
  // minutes; twelve let a run top itself up faster than the horde could
  // spend it; seven was the correction to twelve and overshot. A hit in this
  // game is not a mistake the player could have avoided -- the horde
  // converges and contact is the texture of it -- so the pool is not a
  // punishment dial, it is how long the run gets to be. Seven made the run
  // short rather than tense.
  //
  // Read this with HEART.dropChance, as always. The pair is the difficulty,
  // and moving one without the other moves it the wrong way: doubling the
  // pool while leaving the drops where they were would have made a long run
  // bottom out exactly as fast once the pool was spent.
  maxLives: num('lives', 14),
  // One second of invulnerability. Enemies converge, so the frame you are
  // touched you are usually touching several -- without a window one mistake
  // ends the run and the player never learns what they did wrong.
  invulnS: 1.0,
  // Blink rate while invulnerable. The player has to be able to SEE that they
  // are briefly safe, or the window reads as the game failing to hit them.
  blinkHz: 8,
};

/** Heal, never past the top of the pool. */
export function heal(w, amount = 1) {
  w.lives = Math.min(SURVIVAL.maxLives, w.lives + amount);
  return w.lives;
}

/**
 * Take a hit if anything is touching, then run the timer down.
 *
 * `w.contact` is set by the horde each frame. It is read and cleared here so
 * there is exactly one place that decides what a touch costs.
 */
export function updateSurvival(w, dt) {
  if (w.invulnS > 0) w.invulnS -= dt;

  if (w.contact && w.invulnS <= 0 && !w.dead) {
    w.lives -= 1;
    w.invulnS = SURVIVAL.invulnS;
    if (w.lives <= 0) {
      w.lives = 0;
      w.dead = true;
    }
  }
  w.contact = false;
  return w.dead;
}

/** True while the player should be drawn flickering. */
export function blinking(w) {
  return w.invulnS > 0 && Math.floor(w.invulnS * SURVIVAL.blinkHz) % 2 === 0;
}
