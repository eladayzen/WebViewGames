// The level: an endless chain of rooftops with gaps between them, hazards on
// them, and pizza. Pure data, seeded, generated a little ahead of the turtle
// and dropped behind him -- no DOM, no three.js, so tools/sim.mjs can play it.
//
// VARIETY comes from a small director: it strings SEGMENTS together --
//   normal   a roof with a few random hazards
//   breather a long clean roof with pizza (rest after a set piece)
//   stairs   a short staircase of roofs dropping away
//   chain    a run of short roofs, jump after jump
//   gauntlet one long roof carrying a hand-made hazard pattern
//   lift     a gap crossed by a moving platform (see below)
// and new hazard kinds unlock with distance (HAZARD.UNLOCK), so something new
// shows up every ~15 s of play.
//
// FAIRNESS is built in, not checked after: every gap is a fraction of the jump
// the turtle can actually make at the speed he will be going there, and every
// hazard gets a run-up of FOOT_GAP_S seconds of running before it.
//
// PIZZA hangs at jump height, on the arc a real jump draws (a "hop trail"), so
// every pizza needs a jump -- or a climb onto a hover pad, where it is a walk-
// through reward for having got up there.
//
// HOVER PADS: an optional UPPER ROAD of floating platforms stacked above a roof,
// two tiers high, so there are parallel ways to go and ways to climb. A pad is a
// floor you land on from above and jump up through from below; miss one and you
// just drop back to the roof, so it costs nothing to try. HEARTS sit only on the
// top tier. The roof below it is cleared of hazards where he drops back down.
//
// LIFTS: a platform that bobs up and down in the middle of a wide gap. He never
// stops, so it works like a stepping stone: jump on, ride one bob, jump off.
// It only moves +-LIFT_AMP, the gaps either side are sized for the worst case
// of that, and it rides him if he is standing on it -- so it never has to be
// timed, only reached.
import { PLAYER, SPEED, GEN, HAZARD, ENEMY } from './constants.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The speed the turtle will roughly have when he reaches x (for spacing). */
export function expectedSpeed(x) {
  const ramp = SPEED.RAMP_S * (SPEED.START + SPEED.MAX) / 2;
  return SPEED.START + (SPEED.MAX - SPEED.START) * Math.min(1, Math.max(0, x) / ramp);
}

/** Air time of a jump that lands dy higher (dy < 0 = lower). */
export function airTime(dy) {
  const V = PLAYER.JUMP_V, G = PLAYER.G;
  const d = V * V - 2 * G * dy;
  return d < 0 ? 0 : (V + Math.sqrt(d)) / G;
}

export function createWorld(seed = 1) {
  const w = { roofs: [], foes: [], pizzas: [], barriers: [], overheads: [], pads: [], hearts: [], seed };
  let rnd, endX, endY, count, segCount, lastSeg, sinceBreather, nextHeartX;
  const rand = (a, b) => a + (b - a) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  function reset(newSeed) {
    if (newSeed !== undefined) w.seed = newSeed;
    rnd = mulberry32(w.seed);
    w.roofs.length = 0; w.foes.length = 0; w.pizzas.length = 0;
    w.barriers.length = 0; w.overheads.length = 0; w.pads.length = 0; w.hearts.length = 0;
    nextHeartX = HAZARD.HEART_EVERY[0];
    count = 0; segCount = 0; lastSeg = 'normal'; sinceBreather = 0;
    // a long first roof: the countdown and the first seconds are safe
    w.roofs.push({ id: count++, x0: -30, x1: 45, y: 0 });
    endX = 45; endY = 0;
    hopTrails(12, 40, 0);
  }

  const V = PLAYER.JUMP_V, G = PLAYER.G, CENTER = PLAYER.H / 2;
  /** Pizza on the arc of a jump that takes off at x0: he must JUMP to touch them. */
  function hop(x0, y0, v) {
    const air = airTime(0);
    for (let k = 0; k < 5; k++) {
      const t = (0.26 + 0.48 * (k / 4)) * air;
      w.pizzas.push({ x: x0 + v * t, y: y0 + V * t - 0.5 * G * t * t + CENTER + 0.1, taken: false });
    }
  }
  /** A few hop trails along a stretch of flat roof. */
  function hopTrails(x0, x1, y) {
    const v = expectedSpeed(x0), span = v * airTime(0);
    for (let x = x0; x + span * 0.8 < x1; x += span * rand(0.9, 1.3)) hop(x, y, v);
  }

  /** A roof past a gap sized for the jump. rise = extra worst-case height to clear. */
  function addRoof({ len, dy, frac, arc = true, rise = 0 }) {
    const v = expectedSpeed(endX);
    if (dy === undefined) {
      dy = rand(GEN.STEP[0], GEN.STEP[1]);
      if (rnd() < 0.3) dy = 0;
    }
    const y = Math.min(GEN.Y_RANGE[1], Math.max(GEN.Y_RANGE[0], endY + dy));
    dy = y - endY;
    const air = airTime(dy + rise) * 0.92;
    if (frac === undefined) frac = rand(GEN.GAP_AIR[0], GEN.GAP_AIR[1]);
    const gap = Math.max(2.2, v * Math.min(air, airTime(0)) * frac);
    const x0 = endX + gap, x1 = x0 + len;
    const roof = { id: count++, x0, x1, y, gap };
    w.roofs.push(roof);
    if (arc && rnd() < GEN.PIZZA_ARC) {              // pizza arc over the gap, following the jump
      const t0 = endX - v * 0.05;
      for (let k = 0; k < 4; k++) {
        const t = (0.22 + 0.56 * (k / 3)) * airTime(dy);
        w.pizzas.push({ x: t0 + v * t, y: endY + V * t - 0.5 * G * t * t + CENTER + 0.1, taken: false });
      }
    }
    endX = x1; endY = y;
    return roof;
  }

  // ---------------------------------------------------------------- hazards
  const runupOf = (x) => expectedSpeed(x) * GEN.FOOT_GAP_S;
  const unlocked = (kind) => endX >= HAZARD.UNLOCK[kind];

  function place(kind, x, y) {
    if (kind === 'foe' || kind === 'shield') {
      w.foes.push({ x, y, alive: true, ko: -1, t: rnd() * 10, shield: kind === 'shield' });
    } else if (kind === 'barrier') {
      w.barriers.push({ x, y });
      for (const [dx, h] of [[-0.9, 2.1], [0, 2.6], [0.9, 2.1]]) w.pizzas.push({ x: x + dx, y: y + h, taken: false });
    } else if (kind === 'overhead') {
      w.overheads.push({ x, y });
      w.pizzas.push({ x: x - 0.5, y: y + 0.45, taken: false }, { x: x + 0.5, y: y + 0.45, taken: false });
    }
  }

  /** Hazards along a roof, each with a run-up either side. */
  function populate(roof, density) {
    const kinds = ['foe', 'foe'];
    if (unlocked('barrier')) kinds.push('barrier', 'barrier');
    const ru = runupOf(roof.x0);
    let x = roof.x0 + ru;
    let placed = 0;
    while (x < roof.x1 - ru) {
      if (rnd() < density) { place(pick(kinds), x, roof.y); placed++; x += ru * rand(1.1, 1.9); }
      else x += ru * 0.7;
    }
    if (!placed && roof.x1 - roof.x0 > 12) hopTrails(roof.x0 + 2, roof.x1 - 2, roof.y);
  }

  // ---------------------------------------------------------------- hover pads
  const heartDue = () => endX >= nextHeartX;

  /** Hazards on [x0, x1] of a roof are removed (the landing zone below a pad route's end). */
  function clearHazards(x0, x1) {
    const keep = (o) => o.x < x0 || o.x > x1;
    w.foes = w.foes.filter(keep); w.barriers = w.barriers.filter(keep); w.overheads = w.overheads.filter(keep);
  }

  /**
   * An upper road over roof r: a chain of pads one jump above the roof, with
   * short gaps between them. One pad gets a second tier above it (a climb); a
   * heart sits on that top tier whenever one is due.
   */
  function padRoute(r, forceTier2) {
    const v = expectedSpeed(r.x0), RISE = HAZARD.PAD_RISE;
    const limit = r.x1 - 10;                          // he walks off the last pad and falls ~5-7 m forward
    const pads = [];
    let x = r.x0 + 5 + rand(0, 3), y = r.y + RISE;
    while (x + 6 < limit) {
      const len = Math.min(rand(HAZARD.PAD_LEN[0], HAZARD.PAD_LEN[1]), limit - x);
      pads.push({ x0: x, x1: x + len, y, pad: true });
      const ny = Math.max(r.y + RISE - 0.6, Math.min(r.y + RISE + 0.5, y + rand(-0.6, 0.6)));
      x += len + Math.max(2.2, v * Math.min(airTime(ny - y) * 0.92, airTime(0)) * rand(0.3, 0.42));
      y = ny;
    }
    if (pads.length < 2) return;
    // a hanging sign reaches up through a pad AND through the arc of a hop between pads
    w.overheads = w.overheads.filter((o) => o.x < pads[0].x0 - 2 || o.x > pads[pads.length - 1].x1 + 2);
    for (const p of pads) {
      w.pads.push(p);
      for (let k = 1; k <= 3; k++) w.pizzas.push({ x: p.x0 + ((p.x1 - p.x0) * k) / 4, y: p.y + CENTER + 0.1, taken: false });
    }
    let tail = pads[pads.length - 1].x1;
    // a second tier over one of the earlier pads: the climb
    if ((heartDue() || forceTier2 || rnd() < 0.5) && pads.length >= 3) {
      const base = pads[Math.floor(rnd() * (pads.length - 2))];
      const len = rand(8, 10), x0 = base.x0 + 3;
      const top = { x0, x1: Math.min(x0 + len, r.x1 - 15), y: base.y + RISE, pad: true, tier2: true };
      if (top.x1 - top.x0 >= 5) {
        w.pads.push(top);
        for (let k = 1; k <= 4; k++) w.pizzas.push({ x: top.x0 + ((top.x1 - top.x0) * k) / 5, y: top.y + CENTER + 0.1, taken: false });
        if (heartDue()) {
          w.hearts.push({ x: (top.x0 + top.x1) / 2, y: top.y + CENTER + 0.2, taken: false });
          nextHeartX = endX + rand(HAZARD.HEART_EVERY[0], HAZARD.HEART_EVERY[1]);
        }
        tail = Math.max(tail, top.x1 + 6);            // he may walk off the top tier too
      }
    }
    clearHazards(Math.min(pads[pads.length - 1].x1, tail) - 0.5, tail + HAZARD.PAD_DROP_CLEAR);
  }

  // ---------------------------------------------------------------- segments
  const segments = {
    normal() {
      const route = segCount >= 3 && unlocked('pads') && (heartDue() || rnd() < 0.3);
      const len = segCount < 3 ? rand(18, 26) : route ? rand(34, 46) : rand(GEN.ROOF_LEN[0], GEN.ROOF_LEN[1]);
      const r = addRoof({ len });
      if (segCount >= 2) populate(r, Math.min(0.9, 0.55 + endX / 3000));
      else hopTrails(r.x0 + 2, r.x1 - 2, r.y);
      if (route) padRoute(r);
    },
    breather() {
      const route = unlocked('pads') && (heartDue() || rnd() < 0.5);
      const r = addRoof({ len: route ? rand(36, 46) : rand(28, 40), dy: 0 });
      hopTrails(r.x0 + 3, r.x1 - 3, r.y);
      if (route) padRoute(r);
      sinceBreather = -1;
    },
    stairs() {                                        // a flight of roofs dropping away
      const n = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        addRoof({ len: rand(9, 12), dy: -rand(0.7, 1.1), frac: 0.38 });
      }
    },
    chain() {                                         // jump, land, jump, land
      const n = 4 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) addRoof({ len: rand(7.5, 9.5), dy: 0, frac: rand(0.42, 0.52), arc: true });
    },
    gauntlet() {                                      // one long roof, a hand-made rhythm
      const pool = ['foe', 'foe'];
      if (unlocked('barrier')) pool.push('barrier', 'barrier');
      const n = 4 + Math.floor(rnd() * 3);
      const pattern = [];
      for (let i = 0; i < n; i++) {                   // never the same hazard 3x in a row
        let k = pick(pool);
        if (i >= 2 && pattern[i - 1] === k && pattern[i - 2] === k) k = pick(pool.filter((q) => q !== k));
        pattern.push(k);
      }
      const ru = runupOf(endX + 20) * 1.05;
      const r = addRoof({ len: ru * (n + 1.6), dy: 0 });
      pattern.forEach((k, i) => place(k, r.x0 + ru * (i + 1), r.y));
      if (unlocked('pads') && (heartDue() || rnd() < 0.65)) padRoute(r, true);   // the road over the hazards
    },
    skyway() {                                        // no roof: an arch of pads over a chasm
      const v = expectedSpeed(endX);
      const n = 5 + Math.floor(rnd() * 3), peak = 2 + Math.floor(rnd() * (n - 3));
      let x = endX, y = endY;
      const sky = [];
      const startY = endY, topY = startY + rand(3.6, 5.2);
      for (let i = 0; i < n; i++) {
        // an arch: climb to the peak, then come back down to roughly where it began
        const ty = i === 0 ? startY + rand(1.0, 1.6)
          : i <= peak ? y + (topY - y) / (peak - i + 1) * rand(0.9, 1.1)
          : y - (y - (startY + 1.2)) / (n - i) * rand(0.9, 1.1);
        // a jump is a fixed length (no variable height): take off at the edge and
        // you land D further on, so the next pad is near enough and long enough to hold that landing
        const D = v * airTime(ty - y);
        const gap = Math.max(2.2, D * rand(0.45, 0.6));
        const len = Math.max(rand(4.5, 6), D * 0.5 + 0.5);
        const pad = { x0: x + gap, x1: x + gap + len, y: ty, pad: true, sky: true };
        sky.push(pad); w.pads.push(pad);
        for (let k = 1; k <= 2; k++) w.pizzas.push({ x: pad.x0 + (len * k) / 3, y: ty + CENTER + 0.1, taken: false });
        x = pad.x1; y = ty;
      }
      endX = x; endY = y;
      if (heartDue()) {
        const top = sky.reduce((a, b) => (b.y > a.y ? b : a));
        w.hearts.push({ x: (top.x0 + top.x1) / 2, y: top.y + CENTER + 0.2, taken: false });
        nextHeartX = endX + rand(HAZARD.HEART_EVERY[0], HAZARD.HEART_EVERY[1]);
      }
      addRoof({ len: rand(20, 28), dy: -rand(0.8, 1.4), frac: 0.4, arc: false });
    },
    lift() {                                          // a moving platform in a wide gap
      const v = expectedSpeed(endX);
      const A = HAZARD.LIFT_AMP, mid = endY - 0.3;
      const len = v * airTime(0) * rand(0.8, 0.95);   // long enough to CATCH a full jump, not fly over it
      const g1 = Math.max(2.4, v * airTime(A - 0.3) * 0.92 * rand(0.38, 0.46));
      const lift = { id: count++, x0: endX + g1, x1: endX + g1 + len, y: mid, gap: g1,
        lift: { y0: mid, amp: A, per: HAZARD.LIFT_PERIOD, ph: rnd() * Math.PI * 2 } };
      w.roofs.push(lift);
      for (let k = 1; k <= 3; k++) w.pizzas.push({ x: lift.x0 + (len * k) / 4, y: mid + 2.5, taken: false });
      endX = lift.x1; endY = mid;
      addRoof({ len: rand(18, 26), dy: -rand(0.2, 0.7), frac: 0.4, arc: false, rise: A });   // worst case: he leaves the lift at its low point
    },
  };

  /** The director: what comes next. */
  function nextSegment() {
    segCount++;
    const first = segCount <= 2;
    if (first) return 'normal';
    const opts = [['normal', 46]];
    if (sinceBreather >= 4) opts.push(['breather', 18]);
    const setPiece = lastSeg === 'normal' || lastSeg === 'breather';
    if (setPiece) {
      if (unlocked('stairs')) opts.push(['stairs', 12]);
      if (unlocked('chain')) opts.push(['chain', 12]);
      if (unlocked('lift')) opts.push(['lift', 14]);
      if (unlocked('skyway')) opts.push(['skyway', 14]);
      if (unlocked('gauntlet') && sinceBreather >= 2) opts.push(['gauntlet', 16]);
    }
    let t = opts.reduce((s, o) => s + o[1], 0) * rnd();
    for (const [k, wt] of opts) { t -= wt; if (t <= 0) return k; }
    return 'normal';
  }

  function addSegment() {
    const kind = nextSegment();
    const n0 = w.roofs.length;
    segments[kind]();
    for (let i = n0; i < w.roofs.length; i++) w.roofs[i].seg = kind;
    lastSeg = kind;
    sinceBreather++;
  }

  /** Move the lifts; the runner calls this with its run clock. */
  function tick(t) {
    for (const r of w.roofs) if (r.lift) r.y = r.lift.y0 + r.lift.amp * Math.sin((t * Math.PI * 2) / r.lift.per + r.lift.ph);
  }

  /** Make sure the level reaches x; drop what is far behind `behind`. */
  function ensure(x, behind = -Infinity) {
    while (endX < x) addSegment();
    if (w.roofs.length && w.roofs[0].x1 < behind) {
      const i = w.roofs.findIndex((r) => r.x1 > behind);
      if (i > 0) w.roofs.splice(0, i);
      for (const arr of [w.foes, w.pizzas, w.barriers, w.overheads, w.hearts]) {
        let k = 0; while (k < arr.length && arr[k].x < behind) k++;
        if (k) arr.splice(0, k);
      }
      w.pads = w.pads.filter((p) => p.x1 > behind);
    }
  }

  /** The roof under x, or null over a gap. */
  function roofAt(x) {
    for (const r of w.roofs) if (x >= r.x0 && x <= r.x1) return r;
    return null;
  }
  /** The highest floor under x that is at or below yMax: a roof, a lift or a hover pad. */
  function surfaceBelow(x, yMax) {
    let best = null;
    for (const r of w.roofs) if (x >= r.x0 && x <= r.x1 && r.y <= yMax && (!best || r.y > best.y)) best = r;
    for (const r of w.pads) if (x >= r.x0 && x <= r.x1 && r.y <= yMax && (!best || r.y > best.y)) best = r;
    return best;
  }
  /** The next solid roof that starts after x (lifts move, so never a respawn point). */
  function nextRoof(x) {
    for (const r of w.roofs) if (r.x0 > x && !r.lift) return r;
    return null;
  }

  reset(seed);
  return Object.assign(w, { reset, ensure, roofAt, nextRoof, tick, surfaceBelow });
}
