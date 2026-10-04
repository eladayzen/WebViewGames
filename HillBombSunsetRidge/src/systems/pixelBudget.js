// Bound the PIXELS a frame costs, not the device pixel ratio.
//
// THE BUG THIS REPLACES. Every game here did some version of:
//
//     Math.min(window.devicePixelRatio, 2)
//
// which reads like a performance cap and is not one. It bounds the multiplier,
// while the thing that costs money is multiplier x viewport -- and viewport is
// not a constant across devices:
//
//     phone   390x844  @2 -> 1.3 Mpx
//     iPad   1024x768  @2 -> 3.1 Mpx     same cap, 2.4x the work
//
// On a tablet that is also several GPU generations behind a current phone, those
// two factors multiply, which is the difference between smooth and unplayable.
//
// WHAT THIS DOES INSTEAD. Pick a pixel budget and derive the ratio from it, so
// a bigger viewport lowers the ratio rather than raising the cost. Small screens
// are unaffected -- their honest DPR already fits inside the budget, and the
// min() keeps it.
//
// THE NUMBER IS MEASURED, NOT CHOSEN. On Elad's iPad (768x1024, 9.7"/10.2"
// class), speedRace with the full field on track, 2026-09-28:
//
//     2.72 Mpx (before)   116 ms   8.6 fps    n=33
//     1.60 Mpx (this)      74 ms  13.5 fps    n=58
//
// 40 ms of frame time for a resolution drop nobody reported noticing. Both
// figures are plateau values -- every configuration ramps for ~15s after load
// before settling, so comparing first readings would have been meaningless.
//
// ONLY THIS GAME. The same change was measured on Nova Vanguard and bought
// 0.4 ms (37.9 -> 37.5 ms across a 32% pixel cut): there it is pure sharpness
// loss for nothing, because Nova draws 46 things and is not fill-bound. Rooftop
// Ninja already holds 60 fps untouched. Three games, three different problems --
// do not copy this file into them on the assumption that it generalises.

const QS = new URLSearchParams(location.search);

/**
 * Megapixels per frame. Overridable as ?budget=N purely so the next person can
 * re-measure the way this one was measured, rather than re-deriving the rig.
 */
const DEFAULT_BUDGET_MPX = 1.6;

export function requestedBudgetMpx() {
  const raw = QS.get('budget');
  if (raw == null) return DEFAULT_BUDGET_MPX;
  const n = Number(raw);
  // ?budget=0 deliberately means "off", for A/B against the old behaviour.
  if (raw === '0') return null;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BUDGET_MPX;
}

/**
 * The pixel ratio to actually use.
 *
 * @param {number} w        CSS width being rendered
 * @param {number} h        CSS height being rendered
 * @param {number} [dprCap] the existing cap, still honoured as an upper bound
 * @returns {number}
 */
export function pixelRatioFor(w, h, dprCap = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const budget = requestedBudgetMpx();
  if (!budget || w <= 0 || h <= 0) return dpr;
  // sqrt because the budget is an AREA and the ratio scales both axes.
  const fromBudget = Math.sqrt((budget * 1e6) / (w * h));
  // Never scale UP past the device's own ratio: a budget is a ceiling, and
  // rendering above native resolution would spend the budget on nothing.
  return Math.min(dpr, fromBudget);
}
