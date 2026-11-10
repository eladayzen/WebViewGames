// CHOOSING ONE OF TWO, BY LEANING.
//
// A balance board has no buttons, so the choice has to be made with the only
// thing the player can do: lean. Two cards map onto lean left and lean right,
// and CENTRE DELIBERATELY MEANS NOTHING -- it is the way out of both cards,
// not a third one.
//
// WHY TWO AND NOT THREE (Elad, 10 Nov). The screen used to offer three, with
// the middle card taken by standing still. That put a card on the one body
// position a player cannot avoid being in: centre is where you are when you
// are reading, deciding, or just balancing. The middle card was therefore
// always half-selected, and the grace period below existed mainly to stop it
// committing before the player had read anything.
//
// Dropping to two cards removes that whole class of problem instead of
// defending against it. Standing still is now a safe, meaningful "not yet",
// which is exactly what a player needs while they read -- and two cards are
// less to read in the one pause the game has.
//
// THE REMAINING PROBLEM IS STILL ABOUT STANDING STILL. Nobody stands
// perfectly still on a balance board: a child wobbles across a zone boundary
// constantly, so a commit that fired the instant a zone was entered would
// fire on the wrong card.
//
// That is answered by HOLD TO CONFIRM, with a grace period before any hold
// counts. The player leans, a ring fills, and the pick lands when it
// completes. Wobbling out -- or simply standing back up -- resets the fill,
// which makes a mis-pick recoverable rather than punishing. Because the fill
// is visible, the rule teaches itself without a tutorial.
//
// The grace period is kept even though centre is now neutral, because a
// player can be mid-lean at the moment the screen opens and should not have a
// card taken out from under them for it.
//
// This module is deliberately pure: it takes a lean and a delta time and
// returns what is selected and how far along the hold is. No DOM, no Pixi, so
// the behaviour that matters can be tested without a browser.

export const CHOOSE = {
  // How far to lean before a card is pointed at. Everything inside this is the
  // neutral band, which with two cards is a real resting place rather than a
  // third option -- so it can be generous without crowding anything out.
  zoneX: 0.35,
  // How long to hold a card before it is taken.
  //
  // DOUBLED FROM 0.75 on Elad's call, 1 Nov, after playing it. The fill is
  // the only undo this screen has: on a board the selection crosses zones
  // constantly, and 0.75s was short enough that drifting through a card
  // could take it before the player had finished reading the other two.
  // A hold is a commitment, and a commitment wants long enough to abandon.
  //
  // It is also the pacing of the only pause in the whole game. Everything
  // else here is continuous, so the one moment the horde is frozen is worth
  // spending rather than rushing.
  holdS: 1.5,
  // No hold accumulates for this long after the screen opens, so a player who
  // happens to be standing centred does not have a card chosen for them while
  // they are still reading.
  graceS: 0.5,
};

export function createChoice(options) {
  return { options, zone: null, heldS: 0, graceS: CHOOSE.graceS, taken: null };
}

/**
 * Which card a given lean is pointing at: 0 left, 1 right, or NULL for none.
 *
 * Null is the centre band, and it is a real answer rather than a missing one.
 * Callers must treat it as "the player is pointing at nothing" -- drawing no
 * highlight and accumulating no hold -- not coerce it to a number, where it
 * would silently become card 0.
 */
export function zoneFor(leanX) {
  if (leanX < -CHOOSE.zoneX) return 0;
  if (leanX > CHOOSE.zoneX) return 1;
  return null;
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

  // A zone with no card behind it cannot be held. That is the centre band,
  // where the player is pointing at nothing on purpose, and also the far side
  // late in a run when only ONE ability is left to offer -- holding over an
  // empty slot must do nothing rather than crash or pick the neighbour.
  if (z === null || z >= choice.options.length) { choice.heldS = 0; return null; }

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
