// Coin arc templates (§5.5) -- the Sonic-style curving trails the report saw in
// the reference's frame 2.
//
// Each arc is a start h, an end h, a curve shape and a world-x span. THE WHOLE
// STRING SITS INSIDE A SINGLE TRAVERSABLE SWEEP: an arc may never span more
// than COIN_ARC_MAX_SPAN (0.45) of the face, so collecting it is a lean, never
// a sprint. The validator checks that statically; the spawn director checks the
// live clearance from hazards at placement time (§5.5's routing rule).
//
//   shape: 'arcUp'    bows toward the lip in the middle
//          'arcDown'  bows toward the trough in the middle
//          'line'     straight diagonal
//          'sCurve'   shallow S
//
// Coins are gold -- one of only two warm colours on screen (§1) -- and they are
// the primary reason to leave the trim line. A coin is NOT currency: there is
// no wallet, nothing persists, nothing is spent (§8.6).

export const COIN_ARCS = [
  { id: 'sweep-up-mid',    count: 7, h0: 0.30, h1: 0.68, shape: 'arcUp',   xSpanSec: 1.15 },
  { id: 'sweep-down-mid',  count: 7, h0: 0.68, h1: 0.30, shape: 'arcDown', xSpanSec: 1.15 },
  { id: 'scoop-low',       count: 9, h0: 0.46, h1: 0.46, shape: 'arcDown', xSpanSec: 1.40, bow: 0.20 },
  { id: 'crest-hop',       count: 6, h0: 0.52, h1: 0.52, shape: 'arcUp',   xSpanSec: 1.05, bow: 0.22 },
  { id: 'diagonal-climb',  count: 5, h0: 0.26, h1: 0.62, shape: 'line',    xSpanSec: 0.90 },
  { id: 'diagonal-drop',   count: 5, h0: 0.66, h1: 0.30, shape: 'line',    xSpanSec: 0.90 },
  { id: 's-mid',           count: 8, h0: 0.34, h1: 0.62, shape: 'sCurve',  xSpanSec: 1.30 },
  { id: 's-high',          count: 8, h0: 0.58, h1: 0.82, shape: 'sCurve',  xSpanSec: 1.30 },
  // Tops out below H_LAUNCH on purpose: a coin placed at the lip is a coin the
  // player cannot take, because reaching the lip launches her (§5.4).
  { id: 'lip-run',         count: 6, h0: 0.68, h1: 0.82, shape: 'arcUp',   xSpanSec: 1.00 },
  { id: 'trough-run',      count: 6, h0: 0.24, h1: 0.10, shape: 'arcDown', xSpanSec: 1.00 },
];

// The barrel's own routing (§5.7): long serpentine runs across the full
// interior height. The section's reward IS the routing, and there is a lot of
// it -- these are longer and denser than anything on the open face, which is
// affordable because the barrel has no hazards at MVP.
export const BARREL_COIN_ARCS = [
  { id: 'barrel-s-long',   count: 9, h0: 0.22, h1: 0.78, shape: 'sCurve',  xSpanSec: 1.80 },
  { id: 'barrel-s-back',   count: 9, h0: 0.78, h1: 0.22, shape: 'sCurve',  xSpanSec: 1.80 },
  { id: 'barrel-scoop',    count: 9, h0: 0.50, h1: 0.50, shape: 'arcDown', xSpanSec: 1.60, bow: 0.28 },
  { id: 'barrel-crest',    count: 9, h0: 0.50, h1: 0.50, shape: 'arcUp',   xSpanSec: 1.60, bow: 0.28 },
];

/**
 * Resolve an arc template into a list of { t, h } samples, where t in [0,1] is
 * the position along the arc's world-x span. Shared by the spawner and by the
 * validator, so the thing checked is literally the thing spawned.
 */
export function arcPoints(arc) {
  const pts = [];
  const bow = arc.bow ?? 0.12;
  for (let i = 0; i < arc.count; i++) {
    const t = arc.count === 1 ? 0.5 : i / (arc.count - 1);
    let h = arc.h0 + (arc.h1 - arc.h0) * t;
    const belly = Math.sin(Math.PI * t);
    switch (arc.shape) {
      case 'arcUp': h += bow * belly; break;
      case 'arcDown': h -= bow * belly; break;
      case 'sCurve': h += bow * Math.sin(2 * Math.PI * t) * 0.6; break;
      case 'line': default: break;
    }
    pts.push({ t, h });
  }
  return pts;
}

/** The h extent an arc actually occupies, after its bow. */
export function arcSpan(arc) {
  const pts = arcPoints(arc);
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { if (p.h < lo) lo = p.h; if (p.h > hi) hi = p.h; }
  return { lo, hi, span: hi - lo };
}
