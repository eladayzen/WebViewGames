// HOW LONG THE THROW OWNS THE ARMS.
//
// The clip is two seconds of wind-up, release and follow-through; the gun
// fires every 0.55s. Playing the whole thing is not an option, and it is not
// wanted either -- the only frame that has to line up with anything is the
// release, which tools/extract-clips.mjs measures by tracking the right hand
// through a real mixer and taking the frame where it moves fastest.
//
// So the layer plays a WINDOW around that frame: a little wind-up, the
// release, and enough follow-through to settle. The window is sized to fit
// inside one firing interval, because two throws overlapping on one pair of
// arms is a shuffle rather than a second throw.
//
// THE RELEASE LANDS ON THE SHOT, not after it. The fire clock is a countdown
// the sim already keeps, so the next shot is not a surprise -- the throw can
// be started `preS` seconds BEFORE it, and the hand opens exactly as the star
// appears. Triggering on the shot instead would put the whole wind-up after
// the star had already left, which is the thing that reads as broken.

const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const num = (k, d) => {
  const v = Number(QS.get(k));
  return Number.isFinite(v) && QS.get(k) !== null ? v : d;
};

export const THROW = {
  /** Which tagged clip. ?throw=slash|down|horiz */
  clip: 'throw_' + (QS.get('throw') || 'slash'),
  /** Seconds of wind-up before the release. Also the predictive trigger lead. */
  preS: num('thpre', 0.18),
  /** Seconds of follow-through after it. */
  postS: num('thpost', 0.32),
  fadeInS: num('thin', 0.08),
  fadeOutS: num('thout', 0.14),
};

export const THROW_SPAN = THROW.preS + THROW.postS;

/**
 * How much of the arms the throw owns, `sinceStartS` into the window.
 *
 * Ramps in, holds, ramps out, and is exactly 0 at both ends -- so the arms
 * leave the walk and come back to it without a step. Outside the window it is
 * 0, which is what makes "no throw playing" mean "the walk drives everything"
 * with no special case anywhere else.
 */
export function throwEnvelope(sinceStartS, span = THROW_SPAN) {
  if (!(sinceStartS > 0) || sinceStartS >= span) return 0;
  const up = THROW.fadeInS > 0 ? sinceStartS / THROW.fadeInS : 1;
  const down = THROW.fadeOutS > 0 ? (span - sinceStartS) / THROW.fadeOutS : 1;
  return Math.max(0, Math.min(1, up, down));
}

/** Where in the clip we are, `sinceStartS` into the window. */
export function throwClipTime(sinceStartS, releaseAt, duration) {
  const t = releaseAt - THROW.preS + sinceStartS;
  return Math.max(0, Math.min(duration, t));
}
