/* Run states.
 *
 * GOBALANCE_APP_INTEGRATION.md is explicit that "is this screen up?" must be
 * answered by the state enum and never by a timer -- a screen whose timer has
 * expired calls its own handler with the timer already negative, so a handler
 * guarding re-entry on `timer < 0` rejects the very call the expiry makes and
 * every button on that screen goes dead for the rest of the run. Every guard
 * in this game reads `world.state`.
 *
 * FINISHED is deliberately its own state rather than a flag on GAME_OVER.
 * They suppress the simulation identically, but the state is also what the X
 * button reads to leave without asking and what Space reads to restart, and on
 * a screen with its own buttons "play again" has to be a button the player
 * chooses rather than a key firing under their hands.
 */
export const GameState = {
  SERVING: 'serving',       // brief hold before a ball is put into play
  RALLY: 'rally',           // the only state the ball moves in
  POINT: 'point',           // a point just landed; scoreboard beat
  MATCH_END: 'matchend',    // a match inside a one-player run just ended
  GAME_OVER: 'gameover',    // the run ended by losing -- has a restart clock
  FINISHED: 'finished',     // two-player match decided; no clock
  QUIT: 'quit',             // the player chose to stop; no clock
};

/* States in which the simulation is frozen. One list, so a new ending can
 * never forget to stop the ball. */
const FROZEN = new Set([
  GameState.POINT,
  GameState.MATCH_END,
  GameState.GAME_OVER,
  GameState.FINISHED,
  GameState.QUIT,
]);

export function isFrozen(state) {
  return FROZEN.has(state);
}

/* States the run is genuinely over in -- the X button leaves from these
 * without asking, because the player is already stopped and asking "are you
 * sure?" over a screen they chose to be on is noise. */
const OVER = new Set([GameState.GAME_OVER, GameState.FINISHED, GameState.QUIT]);

export function isOver(state) {
  return OVER.has(state);
}
