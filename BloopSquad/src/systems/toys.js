// The temporary weapons: what drops them, what happens when one is collected,
// and what each one does while its timer runs.
//
// The firing itself lives here rather than in play.js so that ONE function
// decides everything that comes out of the pod. A toy does not take the gun
// over -- it fires alongside it -- and the only way to keep that honest is for
// both to be emitted by the same few lines, where a toy branch cannot quietly
// skip the base gun by returning early. It did exactly that until it was fixed;
// see updateFiring.

import { TOYS, BULLETS, PLAYER } from '../data/tuning.js';
import { registerHit } from './monsters.js';
import { playShoot, playPickup } from './audio.js';

/**
 * One ACTIVE TOY. Several run at once -- see `w.toys`.
 *
 * This used to be a single shared bag on the world, with every toy's fields
 * mixed together and `equip` overwriting the lot. That was the only thing
 * stopping toys from cooperating: nothing about the toys themselves conflicts,
 * they just all wrote to one `fireT`, one `spin`, one `chain`.
 *
 * Every instance carries the full field set even though each kind uses two or
 * three of them. The alternative -- per-kind shapes -- saves nothing that
 * matters at eight instances and costs a type check at every read.
 */
export function createToyInstance(kind, durationS) {
  const inst = {
    kind,
    t: durationS,
    total: durationS,
    fireT: 0,        // this toy's own fire clock, independent of every other
    spin: 0,         // twirl's angle / buddies' orbit angle
    side: 1,         // wand: which way the next bubble launches
    buddies: [],
    chain: [],
    charges: 0,      // shield: saves remaining
    graceT: 0,       // shield: brief immunity after a save
    punch: null,     // punch arm: { phase, t, cool, tx, ty }
  };
  if (kind.id === 'buddies') {
    for (let i = 0; i < kind.count; i++) {
      inst.buddies.push({ a: (Math.PI * 2 * i) / kind.count, armT: kind.armS });
    }
  }
  if (kind.id === 'shield') inst.charges = kind.charges;
  if (kind.id === 'punch') inst.punch = { phase: 'idle', t: 0, cool: 0, tx: 0, ty: 0 };
  return inst;
}

/** The running instance of one kind, or null. The renderer and the collision
 *  hooks ask by id rather than walking the list themselves. */
export function activeToy(w, id) {
  for (const inst of w.toys) if (inst.kind.id === id) return inst;
  return null;
}

/** Roll for a toy where a monster just died. */
export function maybeDropToy(w, m, rng) {
  const chance = TOYS.dropFrom[m.tierName] || 0;
  if (!chance) return;
  if (w.toyPickups.filter((t) => t.alive).length >= TOYS.maxLive) return;
  if (w.time - w.lastToyDropT < TOYS.minGapS) return;
  if (rng.next() >= chance) return;

  const pick = pickToyKind(w, rng);
  if (!pick) return;

  w.lastToyDropT = w.time;
  w.toyPickups.push({
    alive: true,
    kind: pick,
    x: m.x,
    // Born ABOVE the kill, so collecting it is a small climb: greed, not duty.
    y: m.y - TOYS.riseAboveKillPx,
    t: TOYS.lifeS,
    bob: 0,
  });
}

/**
 * Choose what drops, by FAMILY ROTATION rather than a pure weighted roll.
 *
 * Pure weighting has no memory, so streaks are not a risk, they are the expected
 * behaviour -- with three shooters in a pool of seven, four shooters in a row is
 * ordinary, and a player meets it often. Rotating by family means the roster
 * stays spread across the KINDS of thing the game can do.
 *
 * The family that has waited longest goes next; the weights then choose within
 * it. Ties break by the order in TOYS.families, which only matters on the first
 * drop of a run, when every family has waited forever.
 *
 * Returns null when nothing is eligible -- every family still locked, or all of
 * its toys disabled.
 */
export function pickToyKind(w, rng) {
  const eligible = (name) => {
    const kind = TOYS.kinds[name];
    if (!kind || kind.enabled === false) return false;
    return (TOYS.unlockLevel[name] || 1) <= w.level;
  };

  let bestFamily = null;
  let bestSeen = Infinity;
  for (const [family, names] of Object.entries(TOYS.families)) {
    if (!names.some(eligible)) continue;
    const seen = w.familyLastDropT[family] ?? -Infinity;
    if (seen < bestSeen) { bestSeen = seen; bestFamily = family; }
  }
  if (!bestFamily) return null;

  const names = TOYS.families[bestFamily].filter(eligible);
  let total = 0;
  for (const n of names) total += TOYS.weights[n] || 0;
  let r = rng.next() * total;
  let pick = names[0];
  for (const n of names) {
    r -= TOYS.weights[n] || 0;
    if (r <= 0) { pick = n; break; }
  }
  w.familyLastDropT[bestFamily] = w.time;
  return pick;
}

export function updateToyPickups(w, dt) {
  const p = w.player;
  for (const c of w.toyPickups) {
    if (!c.alive) continue;
    c.t -= dt;
    c.bob += dt * 3.4;
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < TOYS.magnetRadius) {
      c.x += (dx / d) * TOYS.magnetPxS * dt;
      c.y += (dy / d) * TOYS.magnetPxS * dt;
    } else {
      c.y += TOYS.driftPxS * dt;
    }
    if (d < PLAYER.radius + TOYS.radius) {
      c.alive = false;
      equip(w, c.kind);
    }
    if (c.t <= 0) c.alive = false;
  }
  w.toyPickups = w.toyPickups.filter((c) => c.alive);
}

/**
 * Collect a toy. EVERYTHING STACKS.
 *
 * A new toy runs alongside whatever is already going; the only thing it ever
 * replaces is another copy of ITSELF, which refreshes the timer rather than
 * adding a duplicate. Amit: "when I pick up a new one it should not disable the
 * other unless it's a must" -- and it turns out almost nothing is a must. The
 * toys occupy different space by construction (the shield's bubble at 86 px,
 * the buddies' orbit at 132, the chain hanging below, the punch reaching out)
 * and the shooters only ever ADD bullets.
 *
 * THE OLD RULE'S REASON SURVIVES INTACT. "One at a time; no inventory, no
 * stacking, nothing for a child to manage" was about not handing a six-year-old
 * things to juggle. Stacking automatically is still zero management: no buttons,
 * no choosing, no dropping. What changed is only that good luck compounds.
 *
 * The forward cannon is not a toy and is untouched by anything in here.
 */
export function equip(w, kindName) {
  const kind = TOYS.kinds[kindName];
  if (!kind) return;
  // Levels lengthen a toy a little. Deliberately small and capped: the
  // escalation a player should feel is MORE KINDS of toy, not the same one
  // overstaying -- a 60 % longer twirl is not exciting, it is a twirl you are
  // waiting out.
  const bonus = Math.min(TOYS.levelDurationCap, 1 + (w.level - 1) * TOYS.levelDurationBonus);
  const dur = kind.durationS * bonus;

  const existing = activeToy(w, kind.id);
  if (existing) {
    // Refresh, do not stack a second copy. Two chains would be two ropes from
    // one anchor and two shields would double the charges invisibly -- the
    // player picked up "more of this", not "another one of these".
    existing.t = dur;
    existing.total = dur;
    if (kind.id === 'shield') existing.charges = kind.charges;
  } else {
    w.toys.push(createToyInstance(kind, dur));
  }
  w.stats.toysUsed++;
  playPickup();
}

/** `damage` is per bullet and defaults to the cannon's. It is carried on the
 *  bullet rather than read from the active toy at impact time, because a bullet
 *  outlives the toy that fired it -- a twirl shot still in flight when the timer
 *  runs out must still land for three. */
function spawnBullet(w, x, y, vx, vy, homing, tint, damage) {
  if (w.bullets.length >= BULLETS.maxLive) return;
  w.bullets.push({ alive: true, x, y, vx, vy, homing: !!homing, tint, damage });
}

/**
 * Fire for this frame. Returns nothing; mutates the bullet list.
 *
 * THE PLAIN GUN IS NOT A FALLBACK, IT IS THE FLOOR. It fires straight up on its
 * own clock for the entire run and nothing in this function can stop it, slow
 * it, or bend it -- which is why it is handled FIRST, before the toy is even
 * looked at, and why it has no `if` in front of it. Every toy is strictly
 * additive on top: its own timer, its own bullets, alongside the base stream.
 *
 * This is rule 3 in tuning.js and it used to be a comment rather than a fact:
 * the twirl branch returned before reaching the base gun (nine seconds with the
 * cannon off) and the wand replaced the straight shot with a homing one. A
 * player on the board reported it as the gun stopping, which is exactly what it
 * was. A player can have a worse round; they can never have a worse pod.
 */
export function updateFiring(w, dt) {
  const p = w.player;
  if (!p.alive) return;

  // Expire finished toys first, so nothing fires on the frame it ends.
  for (const inst of w.toys) {
    inst.t -= dt;
    if (inst.graceT > 0) inst.graceT = Math.max(0, inst.graceT - dt);
  }
  w.toys = w.toys.filter((inst) => inst.t > 0);

  // ---- THE FORWARD CANNON. Unconditional, and first. ----------------------
  //
  // A toy may make this FASTER (rapid's `baseIntervalS`) and may not do anything
  // else to it. Rule 3 forbids stopping, replacing or redirecting the cannon; it
  // does not forbid improving it, which is the opposite failure mode. The tint
  // rides along so a rate buff -- the hardest kind to see -- is visible.
  //
  // Read from whichever active toy supplies a base interval, taking the FASTEST
  // if several ever do. `rapid` is the only one today, but reducing across the
  // list rather than finding the first one means a second never silently loses
  // to list order.
  let baseInterval = BULLETS.intervalS;
  let baseTint;
  for (const inst of w.toys) {
    if (inst.kind.baseIntervalS && inst.kind.baseIntervalS < baseInterval) {
      baseInterval = inst.kind.baseIntervalS;
      baseTint = inst.kind.tint;
    }
  }
  p.fireT -= dt;
  if (p.fireT <= 0) {
    p.fireT = baseInterval;
    spawnBullet(w, p.x, p.y - PLAYER.radius, 0, -BULLETS.speedPxS, false, baseTint);
    playShoot();
  }

  // ---- ...and whatever every active toy adds on top of it. ----------------
  //
  // One pass per instance, each on its OWN clock. This is the whole of the
  // stacking change: the wand, the twirl and the cross can all be running and
  // none of them can starve another, because no two of them share a timer.
  for (const inst of w.toys) {
    const kind = inst.kind;
    if (kind.spinRadPerS) inst.spin += kind.spinRadPerS * dt;

    if (kind.id === 'buddies') {
      // Bombs emit nothing; they detonate by touch (updateBuddies).
      for (const b of inst.buddies) {
        if (b.armT > 0) b.armT = Math.max(0, b.armT - dt);
      }
      continue;
    }
    if (kind.id === 'chain') {
      for (const c of inst.chain) {
        if (c.armT > 0) c.armT = Math.max(0, c.armT - dt);
      }
      continue;
    }
    // Rapid's whole effect was applied above, to the cannon's interval.
    if (kind.id === 'rapid') continue;
    if (kind.id === 'shield') continue;   // see consumeShield, from collisions
    if (kind.id === 'punch') continue;    // see updatePunch

    inst.fireT -= dt;
    if (inst.fireT > 0) continue;
    inst.fireT = kind.intervalS;

    if (kind.id === 'cross') {
      // Four fixed axes. Spawned at the pod's edge rather than its centre so the
      // shots leave the hull instead of appearing inside the pilot.
      for (const [dx, dy] of kind.dirs) {
        spawnBullet(w,
          p.x + dx * PLAYER.radius, p.y + dy * PLAYER.radius,
          dx * kind.speedPxS, dy * kind.speedPxS,
          false, kind.tint, kind.damage);
      }
      continue;
    }

    if (kind.id === 'twirl') {
      for (let i = 0; i < kind.arms; i++) {
        const a = inst.spin + (Math.PI * 2 * i) / kind.arms;
        spawnBullet(w, p.x, p.y, Math.cos(a) * kind.speedPxS, Math.sin(a) * kind.speedPxS,
                    false, kind.tint, kind.damage);
      }
      continue;
    }

    if (kind.id === 'wand') {
      // Alternating left/right launch: the base stream already owns the column
      // straight above the pod, and a bubble fired into it would be invisible
      // until it peeled off. The homing steer brings it back onto a target.
      inst.side = inst.side === 1 ? -1 : 1;
      const a = -Math.PI / 2 + inst.side * kind.launchSpreadRad;
      spawnBullet(w, p.x, p.y - PLAYER.radius,
                  Math.cos(a) * kind.speedPxS, Math.sin(a) * kind.speedPxS,
                  true, kind.tint);
    }
  }
}

/** Homing steering, applied to bullets that have it. Turn rate is limited so a
 *  wand shot arcs toward its target rather than snapping onto it -- an arc
 *  reads as a helpful bubble, a snap reads as the game playing itself. */
export function steerHomingBullets(w, dt) {
  const kind = TOYS.kinds.wand;
  for (const b of w.bullets) {
    if (!b.alive || !b.homing) continue;
    let best = null;
    let bestD = kind.seekRadius;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - b.x, m.y - b.y);
      if (d < bestD) { bestD = d; best = m; }
    }
    if (!best) continue;
    const want = Math.atan2(best.y - b.y, best.x - b.x);
    const have = Math.atan2(b.vy, b.vx);
    let diff = want - have;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = Math.max(-kind.turnRate * dt, Math.min(kind.turnRate * dt, diff));
    const a = have + step;
    const sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }
}

/**
 * Spend a shield charge instead of a heart. Returns true if the hit was eaten.
 *
 * Called from the monster-vs-pod branch of collisions, BEFORE the heart is
 * taken -- which is the whole point, and why this returns a boolean rather than
 * doing anything itself. The caller still pops the monster: rule 4 does not get
 * an exception for being blocked.
 */
export function consumeShield(w) {
  const inst = activeToy(w, 'shield');
  if (!inst) return false;
  if (inst.charges <= 0) return false;
  if (inst.graceT > 0) return true;   // already saved this instant; eat it free
  inst.charges--;
  inst.graceT = inst.kind.graceS;
  if (inst.charges <= 0) {
    // Spent, not expired -- the same rule the bombs use. A shield that ran out
    // of time while the player was flying carefully would punish playing well.
    inst.t = 0;
  }
  return true;
}

/**
 * The punch arm: pick the nearest monster in reach, then punch it.
 *
 * Auto-targeted and auto-fired, because there are no buttons. Damage lands at
 * FULL EXTENSION rather than on contact along the way -- a punch that hurt
 * things it passed through would be a lance, and the toy's whole job is to
 * answer the one thing that is already beside you.
 */
export function updatePunch(w, dt, onHit) {
  const inst = activeToy(w, 'punch');
  if (!inst || !inst.punch) return;
  const kind = inst.kind;
  const st = inst.punch;
  const p = w.player;

  if (st.phase === 'idle') {
    st.cool = Math.max(0, st.cool - dt);
    if (st.cool > 0) return;
    // Nearest monster in reach. Nearest rather than weakest or biggest: the
    // threat a player wants dealt with is always the closest one.
    let best = null, bestD = kind.reachPx;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bestD) { bestD = d; best = m; }
    }
    if (!best) return;
    st.phase = 'out';
    st.t = 0;
    st.tx = best.x;
    st.ty = best.y;
    return;
  }

  st.t += dt;
  if (st.phase === 'out' && st.t >= kind.extendS) {
    st.phase = 'hold';
    st.t = 0;
    // Land it. The target position was locked when the punch started, so a
    // monster that drifted out of the way genuinely dodges -- which is fairer
    // than a fist that curves after it, and reads better.
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - st.tx, m.y - st.ty) > m.r + kind.fistPx) continue;
      onHit(m);
      break;
    }
    return;
  }
  if (st.phase === 'hold' && st.t >= kind.holdS) { st.phase = 'back'; st.t = 0; return; }
  if (st.phase === 'back' && st.t >= kind.retractS) {
    st.phase = 'idle';
    st.t = 0;
    st.cool = kind.cooldownS;
  }
}

/** 0 at the pod, 1 at full stretch. Drives both the drawing and nothing else. */
export function punchExtension(w) {
  const inst = activeToy(w, 'punch');
  if (!inst || !inst.punch || inst.punch.phase === 'idle') return 0;
  const kind = inst.kind;
  const st = inst.punch;
  if (st.phase === 'out') return Math.min(1, st.t / kind.extendS);
  if (st.phase === 'hold') return 1;
  return Math.max(0, 1 - st.t / kind.retractS);
}

/**
 * The bomb chain: verlet integration, then constraint relaxation.
 *
 * VERLET rather than stored velocities, because the entire behaviour the toy
 * exists for -- swinging out under acceleration, overshooting when the pod
 * stops, whipping on a direction change -- is what you get for free when
 * position is derived from the previous position. Nothing here scripts a swing:
 * the pod moves, the anchor moves with it, and the rest is consequence.
 *
 * The anchor is the pod's underside, set absolutely every frame, and that is
 * what transmits the player's acceleration into the rope: link 0 is yanked to a
 * new place while its previous position stays behind, and that gap IS the
 * velocity the physics then carries down the chain.
 */
export function updateChain(w, dt) {
  const inst = activeToy(w, 'chain');
  if (!inst || !inst.chain.length) return;
  const kind = inst.kind;
  const p = w.player;
  const anchorX = p.x;
  const anchorY = p.y + PLAYER.radius;

  // Fixed step, clamped: a dropped frame should slow the chain, never explode it.
  const h = Math.min(dt, 1 / 30);
  for (const c of inst.chain) {
    const vx = (c.x - c.px) * kind.damping;
    const vy = (c.y - c.py) * kind.damping;
    c.px = c.x;
    c.py = c.y;
    c.x += vx;
    c.y += vy + kind.gravityPxS2 * h * h;
  }

  // Relax: pin link 0 to the pod, then hold each pair linkPx apart. Several
  // passes, because one pass leaves the rope visibly stretched at exactly the
  // moment the player is looking at it -- a hard direction change.
  for (let it = 0; it < kind.iterations; it++) {
    let prevX = anchorX, prevY = anchorY;
    for (const c of inst.chain) {
      const dx = c.x - prevX, dy = c.y - prevY;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - kind.linkPx) / d;
      // The anchor end is immovable and the link takes the whole correction.
      // Sharing it would let the rope drag the pod around -- handing the
      // player's own steering over to a physics object.
      c.x -= dx * diff;
      c.y -= dy * diff;
      prevX = c.x;
      prevY = c.y;
    }
  }
}

/** Chain links detonate on contact like every other bomb. A spent link is
 *  removed and the rope simply gets shorter: the links below re-hang from the
 *  one above on the next relaxation pass, with no special case for a gap. */
export function updateChainBombs(w, onDetonate) {
  const inst = activeToy(w, 'chain');
  if (!inst) return;
  const kind = inst.kind;
  for (let i = inst.chain.length - 1; i >= 0; i--) {
    const c = inst.chain[i];
    if (c.armT > 0) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - c.x, m.y - c.y) > m.r + kind.radius) continue;
      inst.chain.splice(i, 1);
      onDetonate(c.x, c.y, kind.tint, kind.blastDamage, kind.blastRadiusPx);
      break;
    }
  }
  // Spent, not expired -- same rule as the orbiting bombs.
  if (inst.chain.length === 0) {
    inst.t = 0;
  }
}

/**
 * Buddy Bombs vs monsters.
 *
 * Each orbiter detonates on contact and is SPENT. Two bombs, two bangs, and when
 * both are gone the toy is over -- which is what turns them from a passive pet
 * into a decision: the player chooses when to spend one by choosing where to
 * fly, and that is the only choice any toy offers in a game with no buttons.
 *
 * Iterated back to front and spliced, because a detonation removes the buddy.
 */
export function updateBuddies(w, onDetonate) {
  const inst = activeToy(w, 'buddies');
  if (!inst) return;
  const kind = inst.kind;
  const p = w.player;
  for (let i = inst.buddies.length - 1; i >= 0; i--) {
    const b = inst.buddies[i];
    const a = inst.spin + b.a;
    const bx = p.x + Math.cos(a) * kind.orbitPx;
    const by = p.y + Math.sin(a) * kind.orbitPx;
    b.x = bx; b.y = by;
    if (b.armT > 0) continue;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - bx, m.y - by) > m.r + kind.radius) continue;
      inst.buddies.splice(i, 1);
      onDetonate(bx, by, kind.tint, kind.blastDamage, kind.blastRadiusPx);
      break;
    }
  }
  // Spent, not expired: the toy ends when the bombs are gone. Ending on the
  // timer instead would take a bomb away from a player who was saving it.
  if (inst.buddies.length === 0) {
    inst.t = 0;
  }
}
