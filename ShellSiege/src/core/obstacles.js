// THINGS YOU CANNOT WALK THROUGH.
//
// Elad, 22 Nov: the rooms should "have something different ... like I cannot
// go here". Until now the only thing that stopped a body was the arena wall, so
// every room was the same open square. This is the smallest thing that changes
// that: circles and axis-aligned rectangles that bodies are pushed out of.
//
// A BODY IS PUSHED OUT, NOT STOPPED. It ends up on the surface and keeps
// whatever motion it had along it, so walking into a pillar at an angle slides
// you round it instead of sticking. That is the feel of every top-down game
// and the reason this is a push-out rather than a "can I move there" test.
//
// THE ONE TRAP IS A CHASER LINED UP EXACTLY BEHIND A PILLAR. Its desired step
// goes straight at the pillar's centre; the push-out cancels it exactly; it
// stands still forever while the player waits on the other side. So the caller
// can pass a `slide`, and the foes do (see core/foes.js). The player never needs
// it: he steers himself.
//
// GO ROUND THE NEARER END. Following intent converges on the point of a wall
// NEAREST THE PLAYER -- which is exactly where a crowd piles up. A Fort Golem and
// the four Slayers it summoned wedged side by side against a barricade there and
// stood for a minute, each pushing into its neighbours. A foe blocked by a long
// wall should instead head for whichever END of it is closer, so a crowd splits
// and flows apart. (A round obstacle has no ends; it uses intent, then the side.)
//
// THE SLIDE MUST COMMIT, TOO. The second version followed intent every frame and
// found a new trap: just off a wall's centre a foe's intent along it sat a hair
// under the threshold, so it used the tie-break side and slid AWAY, which pushed
// it over the threshold, so it followed its intent and slid BACK. It hovered on
// the boundary forever -- even a plain Slayer, in the barricade room. A threshold
// with no memory is the bug. So the first contact CHOOSES a rotational sense
// (`slide.chosen`) and the caller keeps passing it back as `slide.commit` until
// the obstacle has been cleared: wall-following, the standard cure.
//
// THE SLIDE MUST FOLLOW THE FOE'S OWN INTENT, NOT A FIXED SIDE. The first version
// nudged every foe a fixed way round. That broke the case the pillar test did
// not cover: a Fort Golem approaching a long wall at an angle was nudged EAST
// by exactly the amount it was naturally sliding WEST, and stood pinned against
// the wall for four minutes while the player shot at it. Now the nudge goes the
// way the foe is already trying to go along the surface, and the fixed `side` is
// only a tie-break for a foe aligned dead-on, which has no intent along it.
//
// TWO KINDS OF HEIGHT. `tall` obstacles also stop THROWN things (the Evil God's
// orbs). Low ones -- rubble -- are stepped over by bodies' attention but do not
// block a shot. The player's own blades fly over everything: a deliberate
// asymmetry, so that auto-aim never spends a throw on a pillar. Revisit after
// it has been played.

/** { kind:'circle', x, y, r, tall } or { kind:'rect', x, y, hw, hh, tall } -- centre and HALF sizes. */

const EPS = 1e-6;

/**
 * Slide a just-pushed-out body along the surface whose outward normal is (nx, ny).
 *
 * `slide` is either a plain signed number (a FIXED nudge, kept for the tests that
 * demonstrate why it is not enough), or { dx, dy, step, side, commit }: the
 * direction the body was trying to move (unit), the length of that step, a tie-break sign
 * for a body whose intent is straight into the surface, and the sign it has
 * ALREADY committed to (0 if none). The sign it uses is written to `slide.chosen`.
 */
function nudge(p, nx, ny, slide, hint = 0) {
  if (!slide) return;
  let amount, sign;
  if (typeof slide === 'number') {
    amount = Math.abs(slide);
    sign = Math.sign(slide);
  } else {
    const tx = -ny, ty = nx;                              // the surface's tangent here
    const along = tx * slide.dx + ty * slide.dy;          // how much of its intent runs ALONG the surface
    // already committed: keep going the same way round. Otherwise choose now: the
    // nearer END of a wall if there is one, else by intent if it has any along the
    // surface, else by the tie-break side.
    sign = slide.commit || hint || (Math.abs(along) > 0.05 ? Math.sign(along) : slide.side);
    slide.chosen = sign;                                  // the caller remembers this
    // SET THE SIDEWAYS SPEED, DO NOT ADD TO IT. A foe pressed into a wall already
    // slides by (step x along): its intended step, redirected by the push-out. An
    // added nudge fixed at 0.6 x step was cancelled EXACTLY wherever that natural
    // slide reached 0.6 -- which is 484px from a player 650px beyond the wall --
    // so foes slid to that spot and stopped. So the nudge is whatever makes the
    // TOTAL sideways motion 0.7 x step in the committed sense, whatever the
    // natural slide is doing, and there is no equilibrium to find.
    const step = slide.step ?? slide.amount ?? 0;
    const extra = step * 0.7 * sign - step * along;
    p.x += tx * extra;
    p.y += ty * extra;
    return;
  }
  p.x += -ny * amount * sign;
  p.y += nx * amount * sign;
}

/**
 * Push `p` ({x, y}, mutated) out of every obstacle it overlaps, as a body of
 * `radius`. Returns true if anything pushed it.
 *
 * Two passes, because pushing out of one obstacle can push you into a
 * neighbour (two walls meeting at a corner).
 */
export function resolveCircle(p, radius, obstacles, slide = 0) {
  if (!obstacles || obstacles.length === 0) return false;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const o of obstacles) {
      if (o.kind === 'circle') {
        const dx = p.x - o.x, dy = p.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = radius + o.r;
        if (d >= min) continue;
        // dead centre has no direction; pick one rather than divide by zero
        const nx = d < EPS ? 1 : dx / d, ny = d < EPS ? 0 : dy / d;
        p.x = o.x + nx * min;
        p.y = o.y + ny * min;
        nudge(p, nx, ny, slide);
        moved = true;
      } else if (o.kind === 'rect') {
        const cx = Math.max(o.x - o.hw, Math.min(o.x + o.hw, p.x));
        const cy = Math.max(o.y - o.hh, Math.min(o.y + o.hh, p.y));
        const dx = p.x - cx, dy = p.y - cy;
        const d = Math.hypot(dx, dy);
        if (d > EPS) {
          if (d >= radius) continue;
          p.x = cx + (dx / d) * radius;
          p.y = cy + (dy / d) * radius;
          // which way is the NEARER END of this face? 0 if it is a tie.
          const nxs = dx / d, nys = dy / d;
          let hint = 0;
          if (slide && typeof slide === 'object') {
            const tx = -nys, ty = nxs;
            const vertical = Math.abs(nys) >= Math.abs(nxs);          // a top/bottom face runs along x
            const half = vertical ? o.hw : o.hh;
            const pos = vertical ? (p.x - o.x) * Math.sign(tx || 1) : (p.y - o.y) * Math.sign(ty || 1);
            const toPlus = half - pos, toMinus = half + pos;
            hint = Math.abs(toPlus - toMinus) < 8 ? 0 : (toPlus < toMinus ? 1 : -1);
          }
          nudge(p, nxs, nys, slide, hint);
          moved = true;
        } else {
          // the centre is INSIDE the rectangle: leave by the nearest face
          const left = p.x - (o.x - o.hw), right = (o.x + o.hw) - p.x;
          const up = p.y - (o.y - o.hh), down = (o.y + o.hh) - p.y;
          const m = Math.min(left, right, up, down);
          if (m === left) p.x = o.x - o.hw - radius;
          else if (m === right) p.x = o.x + o.hw + radius;
          else if (m === up) p.y = o.y - o.hh - radius;
          else p.y = o.y + o.hh + radius;
          moved = true;
        }
      }
    }
    if (!moved) break;
    hit = true;
  }
  return hit;
}

/** Would a body of `radius` at (x, y) overlap any obstacle? Used to keep spawns out of walls. */
export function overlapsAny(x, y, radius, obstacles) {
  if (!obstacles) return false;
  for (const o of obstacles) {
    if (o.kind === 'circle') {
      if (Math.hypot(x - o.x, y - o.y) < radius + o.r) return true;
    } else {
      const cx = Math.max(o.x - o.hw, Math.min(o.x + o.hw, x));
      const cy = Math.max(o.y - o.hh, Math.min(o.y + o.hh, y));
      if (Math.hypot(x - cx, y - cy) < radius) return true;
    }
  }
  return false;
}

/** Does a thrown thing of `radius` at (x, y) strike a TALL obstacle? Low ones are flown over. */
export function blocksShot(x, y, radius, obstacles) {
  if (!obstacles) return false;
  return overlapsAny(x, y, radius, obstacles.filter((o) => o.tall));
}
