// CHOOSING ONE OF THREE, BY LEANING.
//
// A balance board has no buttons, so the choice has to be made with the only
// thing the player can do: lean. Three cards map onto lean left, stand
// centred, lean right -- which is an idiom the platform already teaches; the
// other games in this repo literally print "TILT TO MOVE LEFT / RIGHT /
// MIDDLE" in their tutorials.
//
// TWO PROBLEMS HAD TO BE SOLVED AND BOTH ARE ABOUT STANDING STILL.
//
// 1. CENTRE IS ALSO THE RESTING POSITION. A player who is simply standing
//    there is already "choosing" the middle card. So a selection cannot
//    commit on its own the moment the screen opens -- it would pick for them
//    before they had read anything.
//
// 2. NOBODY STANDS PERFECTLY STILL ON A BALANCE BOARD. A child wobbles across
//    a zone boundary constantly, so a commit that fires the instant a zone is
//    entered would fire on the wrong card.
//
// Both are answered by the same mechanism: HOLD TO CONFIRM, with a grace
// period before any hold counts. The player leans, a ring fills over about
// three quarters of a second, and the pick lands when it completes. Wobbling
// out resets the fill, which makes a mis-pick recoverable rather than
// punishing -- and because the fill is visible, the rule teaches itself
// without a tutorial.
//
// This module is deliberately pure: it takes a lean and a delta time and
// returns what is selected and how far along the hold is. No DOM, no Pixi, so
// the behaviour that matters can be tested without a browser.

export const CHOOSE = {
  // Wide enough that a child does not have to be precise, narrow enough that
  // the three zones are clearly distinct.
  zoneX: 0.35,
  // How long to hold a card before it is taken.
  holdS: 0.75,
  // No hold accumulates for this long after the screen opens, so a player who
  // happens to be standing centred does not have a card chosen for them while
  // they are still reading.
  graceS: 0.5,
};

export function createChoice(options) {
  return { options, zone: null, heldS: 0, graceS: CHOOSE.graceS, taken: null };
}

/** Which card a given lean is pointing at: 0 left, 1 centre, 2 right. */
export function zoneFor(leanX) {
  if (leanX < -CHOOSE.zoneX) return 0;
  if (leanX > CHOOSE.zoneX) return 2;
  return 1;
}

/**
 * Advance the choice by one frame.
 *
 * Returns the key that was taken this frame, or null. The caller resumes the
 * run on a non-null return; nothing else changes state.
 */
export function updateChoice(choice, leanX, dt) {
  if (choice.taken) return null;
  if (choice.graceS > 0) {
    choice.graceS -= dt;
    // The zone still tracks during grace so the ring is already under the
    // right card when it becomes live -- it just does not fill yet.
    choice.zone = zoneFor(leanX);
    return null;
  }

  const z = zoneFor(leanX);
  if (z !== choice.zone) {
    choice.zone = z;
    choice.heldS = 0;
    return null;
  }

  // A zone with no card behind it cannot be held. Late in a run there may be
  // only two abilities left to offer, and holding over the empty slot must do
  // nothing rather than crash or pick the neighbour.
  if (z >= choice.options.length) { choice.heldS = 0; return null; }

  choice.heldS += dt;
  if (choice.heldS >= CHOOSE.holdS) {
    choice.taken = choice.options[z];
    return choice.taken;
  }
  return null;
}

/** 0..1, for drawing the fill. */
export function holdProgress(choice) {
  if (choice.graceS > 0) return 0;
  return Math.min(1, choice.heldS / CHOOSE.holdS);
}
