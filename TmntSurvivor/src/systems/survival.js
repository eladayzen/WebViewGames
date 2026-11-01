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
  // TWELVE, not five. Five came from Bloop Squad, where a hit is a mistake
  // you can see coming and avoid. Here the horde converges from every side at
  // once and taking damage is not a mistake, it is the texture of the game --
  // being touched is how you learn the field is closing. A pool that small
  // turns every run into two minutes, which is too short to reach the
  // level-ups that make a build interesting.
  maxLives: num('lives', 12),
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
