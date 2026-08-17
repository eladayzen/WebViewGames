// The inter-sector surface transition -- the screen-covered swap.
//
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
//
// §5.2/§5.4 originally transitioned surfaces diegetically, by flying across the
// far-void layer at the sector seam. The POC-8 decision note (§3) supersedes
// that ordering: with a covering screen between sectors, the far-void seam
// becomes "polish rather than a dependency [...] Build the screen-covered swap
// first; add the diegetic fly-across seam after, if it earns its place." This
// is that screen-covered swap, and nothing more.
//
// It is also NOT §7.2's inter-sector sequence. There is no results tally, no
// diegetic loading console, no sector briefing and no CONTINUE countdown here
// -- those are MVP item 9 and they are absent, not stubbed. What is here is a
// placeholder covering beat whose entire job is to hide the frame for long
// enough that a surface can be exchanged behind it, so the change of place can
// be judged before any of that UI gets built.
//
// The beat is ~2.35 s unskipped, against the decision note's <= 10 s budget for
// the whole eventual sequence -- so the real UI has room to land on top of this
// without the sequence stacking.
//
// WHY THE SIMULATION FREEZES WHILE COVERED: the player cannot see the playfield
// during the cover, and on a balance board they cannot react anyway. Letting
// enemies keep firing behind an opaque screen would be taking a hit for reasons
// the player was given no chance to read. So the whole sim stops -- this is not
// a pause state (§9.2's `paused` is untouched, and the pause button still means
// what it meant), it is a phase of the run.

import { SECTOR_TRANSITION } from '../data/tuning.js';
import { surfaceAt } from '../data/surfaces.js';

export const TransitionPhase = {
  COVER_IN: 'coverIn',
  HOLD: 'hold',
  COVER_OUT: 'coverOut',
};

/** Start a transition from the current surface to the next one in the ring.
 *  Returns false if one is already running (so a key mash cannot stack them). */
export function beginSurfaceTransition(w, toIndex) {
  const t = w.transition;
  if (t.active) return false;
  t.active = true;
  t.phase = TransitionPhase.COVER_IN;
  t.t = 0;
  t.fromIndex = w.surfaceIndex;
  t.toIndex = toIndex;
  t.swapped = false;
  return true;
}

/**
 * Advance the transition. `onSwap` is invoked exactly once, at the instant the
 * cover is fully opaque -- that callback owns the actual exchange (renderer
 * textures, surface scatter, director restart).
 */
export function updateTransition(w, dt, onSwap) {
  const t = w.transition;
  if (!t.active) return;
  const C = SECTOR_TRANSITION;
  t.t += dt;

  if (t.phase === TransitionPhase.COVER_IN) {
    if (t.t >= C.coverInS) {
      t.t -= C.coverInS;
      t.phase = TransitionPhase.HOLD;
    }
  }

  // Not `else if`: on a long frame the cover can complete and the swap must
  // still happen on that same frame, or the uncovered old surface flashes.
  if (t.phase === TransitionPhase.HOLD) {
    if (!t.swapped) {
      t.swapped = true;
      w.surfaceIndex = t.toIndex;
      onSwap(surfaceAt(t.toIndex));
    }
    if (t.t >= C.holdS) {
      t.t -= C.holdS;
      t.phase = TransitionPhase.COVER_OUT;
    }
  }

  if (t.phase === TransitionPhase.COVER_OUT && t.t >= C.coverOutS) {
    t.active = false;
    t.t = 0;
  }
}

/** Cover opacity in [0,1] -- 1 means the playfield is fully hidden. */
export function coverAmount(w) {
  const t = w.transition;
  if (!t.active) return 0;
  const C = SECTOR_TRANSITION;
  if (t.phase === TransitionPhase.COVER_IN) {
    return ease(Math.min(1, t.t / C.coverInS));
  }
  if (t.phase === TransitionPhase.HOLD) return 1;
  return 1 - ease(Math.min(1, t.t / C.coverOutS));
}

// Fast in, soft out. The cover has to reach opaque quickly (it is hiding a
// swap, and a slow fade would show the old surface for most of it) but should
// release gently, so the new surface is read before anything is shot at.
function ease(k) {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}
