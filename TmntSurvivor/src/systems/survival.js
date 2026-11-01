// GETTING HIT, AND RUNNING OUT.
//
// Without this the game has no pressure and therefore no tuning: enemy speed,
// horde growth and every ability's worth are all judged against "what happens
// if they reach me", and until something happens the answer is nothing.

export const SURVIVAL = {
  // One second of invulnerability. Enemies converge, so the frame you are
  // touched you are usually touching several -- without a window one mistake
  // ends the run and the player never learns what they did wrong.
  invulnS: 1.0,
  // Blink rate while invulnerable. The player has to be able to SEE that they
  // are briefly safe, or the window reads as the game failing to hit them.
  blinkHz: 8,
};

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
