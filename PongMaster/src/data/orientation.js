/* Orientation — the ONLY place in the game that knows which way the court
 * faces on screen.
 *
 * The whole simulation runs in an orientation-free axis space:
 *
 *   along   goal-to-goal. 0 is player one's goal line, L is player two's.
 *           This is the axis the ball has to cross to score.
 *   across  paddle travel. 0..A. This is the axis a player steers on.
 *
 * Nothing in sim/ ever asks about x, y, left or up. Orientation is a
 * projection applied at exactly two boundaries: reading the board (which tilt
 * component drives `across`) and drawing (where a (along, across) pair lands
 * on screen). That is what makes the two layouts the same game rather than two
 * codebases.
 *
 * CLASSIC is what Pong has always been: paddles on the left and right walls,
 * ball crossing the long axis of a landscape screen. The player steers on the
 * board's fore/aft axis.
 *
 * LATERAL rotates the whole thing a quarter turn: paddles on the top and
 * bottom walls, ball crossing the short axis, player steering left/right.
 *
 * Why both exist: fore/aft is the ergonomically expensive axis on a balance
 * board -- a rider's weight drifts onto it without them meaning to, which
 * GOBALANCE_SDK.md documents as a real problem rather than a tuning nuisance.
 * LATERAL trades that away, but a quarter turn does not rotate the screen with
 * it, so it buys the comfortable axis at the cost of a worse-shaped court.
 * Which trade is better is a question for a board, not a document, so both
 * ship behind a live switch until it is settled.
 */

export const CLASSIC = 'classic';
export const LATERAL = 'lateral';

export const ORIENTATIONS = [CLASSIC, LATERAL];

/* Fit the court inside the letterboxed design frame.
 *
 * `ratio` is L/A -- the court's own goal-axis-to-paddle-axis proportion, held
 * in sim units and deliberately independent of the screen. On a 16:9 frame the
 * two orientations want very different numbers: CLASSIC lays L along the long
 * screen edge and can afford a wide court, while LATERAL lays L along the
 * SHORT edge, so matching CLASSIC's proportions there means a narrow column
 * with real margins either side. Letting the court fill the frame instead
 * would hand LATERAL a short, wide playfield -- fast turnarounds, no rallies,
 * a different and worse game. So the court is fitted from its own ratio and
 * the leftover frame becomes margin.
 */
export function courtBox(orientation, ratio, frameW, frameH, marginFrac = 0.055) {
  const availW = frameW * (1 - marginFrac * 2);
  const availH = frameH * (1 - marginFrac * 2);

  // Screen aspect the court wants: CLASSIC maps along->x, so w/h = L/A.
  // LATERAL maps along->y, so w/h = A/L.
  const wantAspect = orientation === CLASSIC ? ratio : 1 / ratio;

  let w = availW;
  let h = w / wantAspect;
  if (h > availH) {
    h = availH;
    w = h * wantAspect;
  }

  return {
    x: (frameW - w) / 2,
    y: (frameH - h) / 2,
    w,
    h,
    // Sim extents this box represents. A is always 1, so sim units are
    // "fractions of the paddle-travel span" in both orientations and every
    // tuning number below transfers unchanged.
    L: ratio,
    A: 1,
    // Pixels per sim unit. Uniform on both axes by construction, so a 45
    // degree ball really looks like 45 degrees.
    scale: orientation === CLASSIC ? w / ratio : h / ratio,
  };
}

/* (along, across) -> screen pixels inside the court box.
 *
 * Both orientations put player one's goal at the near end -- left in CLASSIC,
 * BOTTOM in LATERAL. Bottom rather than top because the near edge of the
 * screen is the one a player standing at a board reads as "mine", and player
 * one is always this device's own board (index 0 of the roster).
 */
export function project(orientation, along, across, court) {
  if (orientation === CLASSIC) {
    return {
      x: court.x + (along / court.L) * court.w,
      y: court.y + (across / court.A) * court.h,
    };
  }
  return {
    x: court.x + (across / court.A) * court.w,
    y: court.y + court.h - (along / court.L) * court.h,
  };
}

/* Which component of a board tilt drives `across`.
 *
 * The host publishes {x, y} in -1..1 every pump, unconditionally -- it is NOT
 * gated on forwardSteeringKeys, which only ever governs synthetic arrow keys
 * (WebGameController.Update calls bridge.PublishFrame outside that branch). So
 * reading fore/aft in CLASSIC needs no Unity-side flag; forwardVerticalAxis is
 * a digital-mode concern and irrelevant to us.
 */
export function tiltComponent(orientation, tilt) {
  if (!tilt) return 0;
  return orientation === CLASSIC ? (tilt.y || 0) : (tilt.x || 0);
}

/* Sign that turns a raw tilt into "toward increasing across".
 *
 * This is a guess until it is felt on a real board, which is exactly why it is
 * a named constant with a dev toggle rather than a minus sign buried in the
 * input code. CLASSIC wants leaning forward to move the paddle UP the screen,
 * and across grows downward there, so forward (+y) has to map to -across.
 * LATERAL wants leaning left to move the paddle left, and across grows
 * rightward, so that one is already aligned.
 */
export const DEFAULT_TILT_SIGN = {
  [CLASSIC]: -1,
  [LATERAL]: 1,
};

/* Keyboard fallback for browser dev, per orientation. The board is the real
 * input; this only exists so the game is playable and testable at a plain dev
 * URL, which GOBALANCE_APP_INTEGRATION.md makes a hard requirement -- a game
 * that only works inside the WebView cannot prove its own feature detection.
 */
export const KEYS = {
  [CLASSIC]: {
    p1: { neg: ['ArrowUp', 'KeyW'], pos: ['ArrowDown', 'KeyS'] },
    p2: { neg: ['KeyI'], pos: ['KeyK'] },
  },
  [LATERAL]: {
    p1: { neg: ['ArrowLeft', 'KeyA'], pos: ['ArrowRight', 'KeyD'] },
    p2: { neg: ['KeyJ'], pos: ['KeyL'] },
  },
};
