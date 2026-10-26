// HOW THE BOARD IS STANDING, and what that does to a lean.
//
// carve was built for one stance: the board laid across the screen, both feet
// pointing at it, lean left and right to carve. That is a balance board's
// natural reading and it is not what a snowboard game looks like -- players see
// a rider standing side-on and reasonably conclude they should turn their board
// to match. BAL-584 lets them, which means the game has to cope with a board
// that is no longer square to the screen.
//
// THE ONE FACT THE REST OF THIS FILE FOLLOWS FROM: the sensor is bolted to the
// board, so the lean it reports is in the BOARD's axes, and those axes turn
// with the board. A player who turns the board a quarter turn clockwise and
// then leans toward the screen is pushing along the board's own forward axis --
// the same numbers the old stance produced for a tuck. To read that as a turn,
// the game turns the vector back by the same quarter turn, and everything
// downstream carries on believing in the stance it was written for.
//
// Deliberately pure: no DOM, no host, no state. The screen that presents this
// and the input layer that applies it both lean on these two exports, and a
// node test can check the mapping without a browser (`orientation.test.mjs`).

/** Clockwise degrees the PLAYER has turned the physical board. */
export const STANCES = [
  {
    deg: 0,
    id: 'square',
    name: 'facing the screen',
  },
  {
    deg: 90,
    id: 'left-forward',
    name: 'left foot forward',
  },
  {
    deg: -90,
    id: 'right-forward',
    name: 'right foot forward',
  },
];

export const DEFAULT_STANCE = 0;

/** The stance after this one, wrapping. The rotate button is this function. */
export function nextStance(deg) {
  const i = STANCES.findIndex((s) => s.deg === deg);
  return STANCES[(i < 0 ? 0 : i + 1) % STANCES.length].deg;
}

export function stanceFor(deg) {
  return STANCES.find((s) => s.deg === deg) ?? STANCES[0];
}

/**
 * Turn a board-space lean into the screen-space lean the game was written for.
 *
 * Both vectors are y-UP (the input layer has already done its single negation).
 * `deg` is how far the player turned the BOARD clockwise, so the lean turns
 * back by the same amount -- a plain rotation, which is why the two quarter
 * turns need no special cases and a future 180 would cost nothing.
 *
 *   0    lean right  -> steer right      lean forward -> tuck
 *   +90  lean forward-> steer right      lean right   -> tail pressure
 *   -90  lean forward-> steer left       lean right   -> tuck
 *
 * The +90 line is the requirement in BAL-584's own words: "physically leaning
 * up should be the right input".
 */
export function rotateLean(x, y, deg) {
  switch (deg) {
    case 90:  return { x: y, y: -x };
    case -90: return { x: -y, y: x };
    default:  return { x, y };
  }
}
