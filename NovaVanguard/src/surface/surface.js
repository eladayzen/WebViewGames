// The surface (§5.4) -- plain data only; /render draws it.
//
// "A dark alien surface fills the frame beneath the action at all times, in
// both modes" (§0.4). There is no starfield-backdrop fallback, at any tier,
// for any sector. This is the single change that answers "I don't care for
// generic": an empty star field gives the eye nothing to identify the game by,
// and a top-down view of nothing reads as flat.
//
// The two modes differ ONLY in the rows of §5.2's table, and every art asset
// is shared -- one mode scrolls the surface, the other doesn't. That shared
// art is the entire reason running the mode experiment is cheap, so resist
// any change here that would make a mode need its own asset.

import { SURFACE, DESIGN_W, DESIGN_H } from '../data/tuning.js';
import { cfg } from '../core/mode.js';
import { surfaceAt } from '../data/surfaces.js';

/** How many distinct props the CURRENT surface has.
 *
 *  Prop sets are per-surface now (§5.4, §6.5), and the count is read from the
 *  surface rather than fixed at 4 so a surface with three props or six is a
 *  table edit. `p.kind` is an index into that surface's own list, which is why
 *  the scatter must be re-rolled on a surface swap -- kind 3 means a different
 *  object on the Bulwark than it did on Kesselring. initSurface() is already
 *  called by the swap for exactly this reason. */
function propKinds(w) {
  return surfaceAt(w.surfaceIndex).props.length;
}

/** (Re)scatter props. Mode S recycles them continuously; Mode A places them
 *  once per sector at authored positions and they do not move (§5.2). */
export function initSurface(w, rng) {
  const s = w.surface;
  const kinds = propKinds(w);
  s.scroll = 0;
  s.overlay[0] = 0;
  s.overlay[1] = 0;
  s.overlayX[0] = 0;
  s.overlayX[1] = 0;
  s.emissivePhase = 0;
  s.event.active = false;

  // A SURFACE MAY LEGITIMATELY HAVE NO PROPS (playtest round 7). The Skyfield
  // and Glacis Shelf are open sky and open ice -- there is nothing standing on
  // them by design. Without this guard `kinds` is 0, rng.int(0, -1) returns a
  // nonsense index, and /render looks up a prop kind that does not exist.
  const n = kinds === 0 ? 0 : Math.min(s.props.length, SURFACE.propsPerScreen * 2);
  for (let i = 0; i < s.props.length; i++) {
    const p = s.props[i];
    if (i >= n) {
      p.alive = false;
      continue;
    }
    p.alive = true;
    p.kind = rng.int(0, kinds - 1);
    p.x = rng.range(0.03, 0.97) * DESIGN_W;
    // Spread over two screen-heights so Mode S has a full screen of props
    // already queued above the top edge at t=0.
    p.y = rng.range(-1.0, 1.0) * DESIGN_H;
    p.rot = rng.range(0, Math.PI * 2);
    p.scale = rng.range(0.62, 1.25);
  }
}

export function updateSurface(w, rng, dt) {
  const m = cfg();
  const s = w.surface;

  // Base layer: scrolls downward toward the player in Mode S, held in Mode A.
  s.scroll += m.scrollSpeed * dt;

  // Ambient overlays. In Mode S they drift at 0.6x and 1.4x scroll for a cheap
  // two-layer parallax. In Mode A they STILL DRIFT, slowly, in a lateral loop
  // -- that is Mode A's anti-deadness budget and it is required, not
  // decoration (§5.2). Either way they render UNDER the action layer, never
  // above it: 1945 Air Force's cloud scrim passes over the action and
  // measurably hurts readability (§5.4).
  s.overlay[0] += m.scrollSpeed * m.overlayDriftMul[0] * dt;
  s.overlay[1] += m.scrollSpeed * m.overlayDriftMul[1] * dt;
  if (m.ambientLateralDrift > 0) {
    s.overlayX[0] += m.ambientLateralDrift * dt;
    s.overlayX[1] -= m.ambientLateralDrift * 0.6 * dt;
    // A slow vertical creep too, so a fixed scene never fully stops moving.
    s.overlay[0] += m.ambientLateralDrift * 0.5 * dt;
    s.overlay[1] -= m.ambientLateralDrift * 0.3 * dt;
  }

  // Surface emissives pulse -- magma fissures breathe -- on long, slow,
  // out-of-phase cycles (§5.2). Runs in both modes; it is what stops a held
  // frame reading as a still image.
  s.emissivePhase += dt;

  // Props ride the surface and recycle in Mode S; in Mode A scrollSpeed is 0
  // so this loop is a no-op and they simply stay where they were placed.
  const kinds = propKinds(w);
  // Propless surface: nothing is alive to recycle, and re-randomising a kind
  // against a zero-length list is the same bug as in initSurface.
  if (m.scrollSpeed > 0 && kinds > 0) {
    const dy = m.scrollSpeed * dt;
    for (let i = 0; i < s.props.length; i++) {
      const p = s.props[i];
      if (!p.alive) continue;
      p.y += dy;
      if (p.y > DESIGN_H + 260) {
        // Re-randomise the scatter on each pass so the base tile's repeat
        // never reads (§5.2).
        p.y -= DESIGN_H + 520;
        p.x = rng.range(0.03, 0.97) * DESIGN_W;
        p.kind = rng.int(0, kinds - 1);
        p.rot = rng.range(0, Math.PI * 2);
        p.scale = rng.range(0.62, 1.25);
      }
    }
  }

  // Scheduled surface activity (Mode A): a fissure flaring, off the player's
  // line so it is scenery, not a threat.
  if (s.event.active) {
    s.event.t += dt;
    if (s.event.t >= s.event.dur) s.event.active = false;
  }
}

/** Fire one authored surface event, placed away from the player's current x
 *  so it can never be misread as an incoming threat (§5.2). */
export function triggerSurfaceEvent(w, rng) {
  const m = cfg();
  if (m.surfaceEventsPerWave <= 0) return;
  const s = w.surface;
  const px = w.player.x / DESIGN_W;
  // Pick the wider half of the frame relative to the player, then sit well
  // inside it.
  const side = px < 0.5 ? 1 : -1;
  s.event.active = true;
  s.event.t = 0;
  s.event.dur = SURFACE.surfaceEvent.durationS;
  s.event.x = (0.5 + side * rng.range(0.16, 0.34)) * DESIGN_W;
  s.event.y = rng.range(0.30, 0.78) * DESIGN_H;
}

/** Emissive intensity in [0,1], as two out-of-phase slow cycles. */
export function emissiveIntensity(w) {
  const e = SURFACE.emissivePulse;
  const t = w.surface.emissivePhase;
  const a = Math.sin((t / e.periodS) * Math.PI * 2);
  const b = Math.sin((t / e.period2S) * Math.PI * 2 + 1.7);
  return Math.max(0, Math.min(1, e.base + e.amp * (a * 0.6 + b * 0.4)));
}
