// The boss framework (§6.4). Plain data in, plain data out -- /render draws it.
//
// WHAT THIS FILE IS FOR. §6.4 specs five bosses (three, after the POC-8
// decision note) and then says the thing that decides how to build them:
// "Per-boss flavour is in the pod layout and pattern assignment, not in new
// systems." So everything here is the SHARED machine -- entry, pods,
// pattern-shedding, the vulnerable window, the death sequence -- and a boss is
// a row in /data/bosses.js over it. Level one's boss cost three sprites and
// four table rows; levels two and three should cost about the same.
//
// The five shared properties §6.4 requires, and where each one lives:
//
//   1. "Never enters the player band. Its lowest extent is y = 0.58."
//      -> stationY + the hull half-height are checked against BOSS.maxExtentY
//         at boot (constraints R4) and the sway is lateral only.
//   2. "Each pod owns ONE attack pattern; destroying it removes that pattern
//      permanently." -> pods carry their own emitter instance, exactly as an
//      Emitter craft does, and killing the pod drops the instance. The fight
//      measurably calms as you win, which §6.4 calls the right shape for a
//      board -- and it is, because a player who is losing ground gets a
//      shorter fight rather than a longer one.
//   3. "Core HP only begins dropping once all 4 pods are gone -- or during a
//      vulnerable window." -> coreExposed().
//   4. The vulnerable window, "the game's one designed use of the vertical
//      axis", ALWAYS OPTIONAL. -> the window doubles core damage for a player
//      who drifts up; it never gates the kill. Asserted at boot.
//   5. "full-width red WARNING band 2.0 s before, through the single-slot
//      banner queue so it can never collide with another banner."
//      -> /systems/director.js owns the phase and pushes it as a critical
//         banner, which is the one path that preempts.
//
// THE DO-NOT-PORT LIST IS STRUCTURAL HERE, not a review note. The boss sits
// entirely above the player and every pod fires downward, so there is no
// simultaneous top-and-bottom pressure and nothing that would ask for an
// emergency forward or back lean -- the worst thing this product can request
// (§0.5). No pod runs a diagonal staircase curtain; the only patterns it has
// are B1 and B2, which the player has already met.

import {
  BOSS,
  BANDS,
  FORMATION_X,
  PLAYABLE_X,
  DESIGN_W,
  DESIGN_H,
  PLAYER,
} from '../data/tuning.js';
import { bossDef, bossIsHullBoss } from '../data/bosses.js';
import { cfg } from '../core/mode.js';
import { createEmitter } from '../patterns/patterns.js';
import { spawnFragment } from './enemies.js';
import { liveCount } from '../core/state.js';

const TWO_PI = Math.PI * 2;

export const BossPhase = {
  ENTERING: 'entering',
  FIGHTING: 'fighting',
  DYING: 'dying',
  DONE: 'done',
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Hull half-height in design space, from the authored width and the art's
 *  aspect. Kept in one place because three separate rules read it: the
 *  0.58 extent cap, the pod anchors and the core anchor. */
export function bossHalfH(b) {
  return (BOSS.width / Math.max(0.01, b.aspect)) * 0.5;
}

/** Lateral sway. Slow, bounded, and LATERAL ONLY -- the hull never drifts
 *  downward, so its lowest extent is a constant the validator can check
 *  statically rather than a thing that depends on when you look. */
function swayX(time) {
  return BOSS.swayAmpX * Math.sin((time / BOSS.swayPeriodS) * TWO_PI);
}

export function podPosition(b, pod) {
  return {
    x: b.x + (pod.dx - 0.5) * BOSS.width,
    y: b.y,
  };
}

/**
 * The y of the hull's lower armour skirt -- where a deflected bolt dies and
 * where every shot channel has its mouth.
 *
 * NOT the drawn half-height. The hull art is a lens with a narrow central mast
 * running to the texture edge, so the full rect extends ~69px below the visible
 * body. Deflecting a bolt in that empty strip looks exactly as broken as
 * absorbing it silently, which is the whole class of bug being fixed here.
 */
export function bossSkirtY(b) {
  return b.y + bossHalfH(b) * BOSS.hullHitHalfHFrac;
}

/** Copy every pod's world position onto the pod itself, so the pod can act as
 *  a pattern-emitter owner (see the x/y fields in beginBoss). */
function syncPods(b) {
  for (const pod of b.pods) {
    pod.x = b.x + (pod.dx - 0.5) * BOSS.width;
    pod.y = b.y;
  }
}

export function corePosition(b) {
  return { x: b.x + (b.coreDx - 0.5) * BOSS.width, y: b.y };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Arm the boss for a sector. `aspect` is the hull texture's width/height,
 * handed in by /render -- this file must never touch a texture (§9.1), but the
 * hull's real proportions decide its extent, so the number is passed as data.
 */
export function beginBoss(w, bossId, aspect) {
  const def = bossDef(bossId);
  if (!def || !def.built) return false;

  const b = w.boss;
  b.active = true;
  b.id = def.id;
  b.name = def.name;
  b.aspect = aspect || 2.7;
  b.phase = BossPhase.ENTERING;
  b.t = 0;
  // Which KIND of row this is, resolved once at arm time and then read
  // everywhere. Nothing downstream looks at the id or at the def again.
  b.hullBoss = bossIsHullBoss(def);
  b.coreDx = def.coreDx === undefined ? 0.5 : def.coreDx;
  b.podNoun = def.podNoun || 'BATTERY';

  b.x = DESIGN_W * 0.5;
  b.y = BOSS.entryFromY * DESIGN_H;

  // The entry is a descent, so its duration is DERIVED from the mode's
  // approach cap rather than authored -- the same discipline the squadron peel
  // uses in /enemies. A fixed duration would silently breach §5.3 the moment
  // someone retuned the station height or the scroll speed.
  const drop = BOSS.stationY * DESIGN_H - b.y;
  b.entryS = Math.max(BOSS.entryMinS, drop / cfg().patternDescentCap);

  b.pods.length = 0;
  b.launched = 0;
  for (let i = 0; i < (def.pods || []).length; i++) {
    const p = def.pods[i];
    b.pods.push({
      index: i,
      dx: p.dx,
      // --- launch-bay fields (§6.4, BOSS.bay) ---------------------------
      // Only a boss whose row asks for it has any of this. A pod that does
      // not launch is permanently `open`, which is what makes every existing
      // pod-boss rule read unchanged: `open` gates damage and firing, and a
      // non-bay pod is simply always open.
      launches: !!p.launches,
      phase: p.phase || 0,
      open: true,
      // 0..1 door travel, so /render can slide the doors rather than cut.
      doorK: 1,
      launchT: 0,
      // LIVE WORLD POSITION, refreshed every frame in updateBoss.
      //
      // A pod is an emitter OWNER, exactly as an Emitter craft is, and
      // /patterns fires an owned volley from `owner.x` / `owner.y`. A pod that
      // only knew its dx would hand the pattern NaN and the boss would rotate
      // its batteries in complete silence -- which is precisely what happened
      // before these two fields existed.
      x: 0,
      y: 0,
      alive: true,
      hp: BOSS.podHp,
      maxHp: BOSS.podHp,
      hitFlashT: 0,
      deathT: -1,
      patternId: p.pattern,
      // The pod owns its emitter, and dies with it. This is the same
      // ownership the Emitter craft uses, deliberately: "destroying it removes
      // that pattern permanently" is then a property of the object graph
      // rather than a flag someone has to remember to clear.
      emitter: null,
      // Only `firing` pods actually tick. See rotatePods().
      firing: false,
    });
  }
  // Emitters are attached here rather than in the loop above so that the pod
  // record is already complete when it becomes an emitter's owner.
  for (const pod of b.pods) pod.emitter = bossOwned(createEmitter(pod.patternId, pod));

  // A HULL BOSS OWNS ITS PATTERNS DIRECTLY.
  //
  // The boss record already carries live x/y (updated every frame in
  // updateBoss), which is the entire contract /patterns asks of an owner -- the
  // same contract a pod satisfies and an Emitter craft satisfies. So "the hull
  // fires for itself" needs no new machinery at all: it is the existing emitter
  // ownership with the boss body as the owner. That is why a podless boss is a
  // row rather than a fork.
  b.hullEmitters = (def.hullPatterns || []).map((id) =>
    bossOwned(createEmitter(id, b))
  );

  // One pool or a gated core, never both. The unused half is zeroed rather than
  // left stale so a readout that asks the wrong question gets 0 instead of a
  // plausible-looking number from the previous fight.
  b.maxHullHp = b.hullBoss ? def.hullHp : 0;
  b.hullHp = b.maxHullHp;
  // Core size is per-boss where the row says so. Boss two's bays are only
  // shootable for roughly half the fight, so 24 points of pods cannot carry its
  // length -- the core is where the fight's duration actually lives, and that
  // is a property of THIS boss's shape rather than of the framework.
  b.maxCoreHp = b.hullBoss ? 0 : (def.coreHp || BOSS.coreHp);
  b.coreHp = b.maxCoreHp;
  b.coreHitFlashT = 0;
  b.hullSparkT = 0;
  b.hitFlashT = 0;
  // Damage-chip bookkeeping for the HP bar: how much has been lost so recently
  // that the bar should still be showing it as a bright leading slice. Without
  // this a single bolt moves a 240-point bar by 0.42% and is invisible, which is
  // the exact failure the previous readout had.
  b.chipHp = 0;
  b.lastPodsRemaining = b.pods.length;
  b.rotateT = 0;
  b.windowT = BOSS.window.intervalS;
  b.windowOpen = false;
  b.windowAnnounced = false;
  b.deathT = 0;
  b.deathPodsFired = 0;
  b.deathPoints = null;
  return true;
}

/** Fraction of the hull pool remaining. Hull bosses only; a pod boss has no
 *  single pool by design (see the note on bossPodHpFraction). */
export function bossHullHpFraction(b) {
  return b.maxHullHp > 0 ? Math.max(0, b.hullHp) / b.maxHullHp : 0;
}

/**
 * Has the boss run out of whatever it is that kills it?
 *
 * The two kinds of row die from different pools, and the FIGHTING branch used to
 * test `b.coreHp <= 0` directly. A hull boss has no core, so its coreHp is 0 --
 * meaning the unguarded test would have killed boss one on the first frame of
 * its own fight. Asking one question instead is what stops that class of thing.
 */
export function bossIsDead(b) {
  return b.hullBoss ? b.hullHp <= 0 : b.coreHp <= 0;
}

export function clearBoss(w) {
  const b = w.boss;
  b.active = false;
  b.phase = BossPhase.DONE;
  b.pods.length = 0;
}

export function podsRemaining(b) {
  let n = 0;
  for (const p of b.pods) if (p.alive) n++;
  return n;
}

/**
 * Is the core taking damage right now, and at what multiplier?
 *
 * §6.4: core HP only drops once all pods are gone, OR during a vulnerable
 * window. The window's x2 is claimed by drifting up to y = 0.62 -- which is
 * the TOP OF THE PLAYER BAND, so the player never actually leaves the band to
 * take it. That is what keeps §0.5's vertical rule intact: the move is slow,
 * optional, generously timed, and stays inside the space the player already
 * occupies.
 *
 * Returns 0 when the core is sealed.
 */
export function coreDamageMultiplier(w) {
  const b = w.boss;
  const exposed = podsRemaining(b) === 0;
  if (!exposed && !b.windowOpen) return 0;
  const rewardY = BOSS.window.rewardY * DESIGN_H;
  // The reward is for being at or above the line, with a little tolerance so a
  // player holding the very edge of it is not cheated by a pixel.
  const claimed = b.windowOpen && w.player.y <= rewardY + 12;
  return claimed ? BOSS.window.damageMultiplier : 1;
}

// ---------------------------------------------------------------------------
// Per-frame
// ---------------------------------------------------------------------------

export function updateBoss(w, dt, fx, banners) {
  const b = w.boss;
  if (!b.active) return;

  b.t += dt;
  b.x = DESIGN_W * 0.5 + swayX(w.time);

  if (b.hullSparkT > 0) b.hullSparkT = Math.max(0, b.hullSparkT - dt);
  if (b.coreHitFlashT > 0) b.coreHitFlashT = Math.max(0, b.coreHitFlashT - dt);
  if (b.hitFlashT > 0) b.hitFlashT = Math.max(0, b.hitFlashT - dt);
  for (const p of b.pods) {
    if (p.hitFlashT > 0) p.hitFlashT = Math.max(0, p.hitFlashT - dt);
    if (p.deathT >= 0) p.deathT += dt;
  }

  // The HP bar's damage chip drains back toward the true fill.
  //
  // Rate rather than timer: BOSS.hpChipDrainPerS points per second, so the chip
  // is always about the same visual length under sustained fire regardless of
  // how fast the player is shooting, and a single isolated bolt still shows for
  // a readable beat. A timer would make the chip flicker at rank 1's fire rate.
  if (b.chipHp > 0) b.chipHp = Math.max(0, b.chipHp - BOSS.hpChipDrainPerS * dt);

  // Announce the structure as the player dismantles it. POD BOSSES ONLY -- a
  // hull boss has no structure to announce, and "no tricks, nothing super
  // interesting to see" rules out narrating one.
  //
  // Driven off the POD COUNT rather than pushed from the damage path: that path
  // is called up to ten times a second and has no business owning UI, and a
  // count edge cannot double-fire. Non-critical except the last line -- "the
  // core is open" changes what the player should be doing, so it earns the
  // preempt §7.1 reserves for exactly that.
  if (!b.hullBoss) {
    const live = podsRemaining(b);
    if (b.lastPodsRemaining === undefined) b.lastPodsRemaining = live;
    if (live < b.lastPodsRemaining) {
      b.lastPodsRemaining = live;
      if (live > 0) {
        // The noun is per boss: Cinderjaw's pods would have been batteries,
        // Brood Gantry's are bays, Nadir Coil's will be segments. Naming the
        // thing the player just destroyed after what it looks like is most of
        // what makes a banner worth the gutter it occupies (§7.1).
        banners.push(`${b.podNoun} DOWN — ${live} LEFT`, 1.1);
      } else {
        banners.push('CORE EXPOSED', 1.5, true);
      }
    }
  }
  // Refresh pod world positions BEFORE anything reads them this frame -- the
  // pattern emitters fire from these, and collision and the renderer resolve
  // them the same way through podPosition().
  syncPods(b);

  switch (b.phase) {
    case BossPhase.ENTERING: {
      const k = Math.min(1, b.t / b.entryS);
      // LINEAR in y, so the descent rate is exactly drop/entryS and provably
      // inside the cap. An eased entry would peak well above its average and
      // quietly breach §5.3 -- the same trap the squadron peel avoids.
      b.y = BOSS.entryFromY * DESIGN_H +
        (BOSS.stationY * DESIGN_H - BOSS.entryFromY * DESIGN_H) * k;
      if (k >= 1) {
        b.phase = BossPhase.FIGHTING;
        b.t = 0;
        rotatePods(w);
      }
      break;
    }

    case BossPhase.FIGHTING:
      b.y = BOSS.stationY * DESIGN_H;
      updateBays(w, dt, fx);
      // The vulnerable window is a PROPERTY OF THE CORE, so a boss with no core
      // does not have one -- no announcement banner, no climb line, no reward
      // geometry. That is the whole of "no tricks" for boss one, and it falls
      // out of the row rather than being switched off by hand.
      if (!b.hullBoss) updateWindow(w, dt, banners);
      b.rotateT -= dt;
      if (b.rotateT <= 0) rotatePods(w);
      if (bossIsDead(b)) beginDeath(w, fx);
      break;

    case BossPhase.DYING:
      updateDeath(w, dt, fx);
      break;
  }
}

/**
 * Launch bays (§6.4, BOSS.bay) -- boss two's mechanic, and the reason boss two
 * is more than a bigger boss one.
 *
 * THE RULE, in one sentence the player never has to be told: THE BAY THAT IS
 * LAUNCHING AT YOU IS THE BAY YOU CAN KILL. An open bay is lit, reticled,
 * disgorging drones, running its bullet pattern, and takes damage. A shut bay
 * is a flat armoured disc that rings bolts off with the same deflect burst the
 * player already learned on boss one's hull. Nothing explains this; the two
 * states look nothing alike and the feedback is immediate either way.
 *
 * That last clause is the whole design constraint, inherited from boss one's
 * failure. Boss one was mechanically correct and unplayable because its pods
 * were unmarked and hull hits were silent, so a working fight read as
 * invulnerable. A cycling weak point is exactly the mechanic most at risk of
 * repeating that -- so it is only safe alongside three things this build
 * already has and one it adds:
 *   * the shot channels, carets and reticles that mark what is shootable;
 *   * the deflect burst that says a shot went nowhere;
 *   * per-pod HP pips that show progress on what is;
 *   * and here, the guarantee that SOMETHING IS ALWAYS OPEN -- four bays
 *     evenly phased at openFrac 0.55 leave two or three open at any instant,
 *     and /systems/constraints.js proves it rather than hoping.
 *
 * The endgame is guarded separately: once BOSS.bay.alwaysOpenAtOrBelow bays
 * remain they jam open permanently, because a last bay that spent 45% of the
 * fight's tail invulnerable would be the same "nothing is happening" failure
 * wearing a timer.
 */
function updateBays(w, dt, fx) {
  const b = w.boss;
  const B = BOSS.bay;
  let live = 0;
  let bays = 0;
  for (const p of b.pods) {
    if (!p.alive) continue;
    live++;
    if (p.launches) bays++;
  }
  if (!bays) return;

  // Live brood, recounted rather than tracked. A decrement ledger would drift
  // the first time a craft died by a path that forgot to decrement it, and the
  // symptom would be a carrier that silently stops launching for the rest of
  // the fight.
  let brood = 0;
  for (let i = 0; i < w.enemies.length; i++) {
    if (w.enemies[i].alive && w.enemies[i].fromBay) brood++;
  }
  b.launched = brood;

  const jam = live <= B.alwaysOpenAtOrBelow;
  const doorRate = dt / Math.max(0.01, B.doorS);

  for (const p of b.pods) {
    if (!p.alive || !p.launches) continue;

    // Where this bay is in its own cycle. Phase-shifted per pod, so the four
    // never move together -- a carrier whose bays opened in unison would read
    // as one shutter, and the choice of which one to stand under would vanish.
    const k = ((w.time / B.cycleS) + p.phase) % 1;
    const wantOpen = jam || k < B.openFrac;

    const before = p.open;
    p.doorK = Math.max(0, Math.min(1, p.doorK + (wantOpen ? doorRate : -doorRate)));
    // Damage follows the DOORS, not the clock: a bay counts as open once it is
    // past halfway, so what the player sees and what the bolt meets agree.
    p.open = p.doorK >= 0.5;
    // Re-deal the firing slots the moment a bay changes state, so the pattern
    // pressure tracks which bays are actually open rather than lagging a
    // rotation behind it.
    if (p.open !== before) rotatePods(w);

    if (!p.open) continue;

    // The stream. §6.4: "launch bays that emit drones on a timer; killing a bay
    // stops its stream" -- which is literally true here, because a dead pod
    // never reaches this line.
    p.launchT -= dt;
    if (p.launchT > 0) continue;
    p.launchT = B.launchIntervalS;
    if (brood >= B.maxLaunched) continue;
    if (liveCount(w.enemies) >= w.caps.enemies) continue;

    const pp = podPosition(b, p);
    // Outward, away from the hull's centre, so the brood clears the ship rather
    // than crossing under it. The arc itself is ENEMY.fragment's -- lateral,
    // floored at y = 0.58, never a dive (§5.5's do-not-port list).
    const dir = pp.x < DESIGN_W * 0.5 ? -1 : 1;
    const e = spawnFragment(w, pp.x, pp.y + BOSS.podRadius * 0.6, dir, 'drone',
      B.launchScore);
    if (e) {
      e.fromBay = true;
      brood++;
      fx.impact(pp.x, pp.y + BOSS.podRadius * 0.6);
    }
  }
}

/**
 * Hand the firing slots round the surviving pods.
 *
 * §6.4 gives every pod its own pattern; §5.3 caps simultaneous patterns at 2
 * (Normal) / 3 (Elite). Four pods firing at once would breach the cap on the
 * first frame of every boss fight, so the boss rotates instead of firing
 * everything. Both rules survive whole -- and the rotation is not a fudge, it
 * reads as a capital ship cycling its batteries, and it means the pattern you
 * are dodging changes often enough that you notice which pod is responsible.
 */
function rotatePods(w) {
  const b = w.boss;
  b.rotateT = BOSS.podRotateS;
  // OPEN pods get the firing slots. That is the mechanic stated as scheduling:
  // a shut bay is not shooting at you, which is exactly why it is also not
  // killable, and the player reads the two facts as one fact. The fallback to
  // any live pod exists so a boss with no bays at all (Cinderjaw's shape, and
  // Nadir Coil's segments) behaves precisely as it did before -- their pods are
  // permanently `open`, so the filter is a no-op for them.
  let live = b.pods.filter((p) => p.alive && p.open);
  if (!live.length) live = b.pods.filter((p) => p.alive);
  const slots = Math.min(w.caps.simultaneousPatterns, live.length);
  for (const p of b.pods) p.firing = false;
  if (!live.length) return;
  // Advance the window start by one each rotation, so every pod gets a turn
  // and the sequence does not depend on which ones happen to be alive.
  b.rotateHead = ((b.rotateHead || 0) + 1) % live.length;
  for (let i = 0; i < slots; i++) {
    live[(b.rotateHead + i) % live.length].firing = true;
  }
}

/** Pattern instances the boss wants to fire this frame. /patterns owns the
 *  cap; this only reports which emitters are live.
 *
 *  Two sources, one list: a pod boss reports the pods currently in the firing
 *  rotation, a hull boss reports the emitters the hull owns directly. The caller
 *  cannot tell which, and the §5.3 simultaneous-pattern cap applies to the list
 *  either way -- for the hull boss because /data/bosses.js authors at most that
 *  many hullPatterns and the validator says so. */
export function bossEmitters(w, out) {
  out.length = 0;
  const b = w.boss;
  if (!b.active || b.phase !== BossPhase.FIGHTING) return out;
  if (b.hullBoss) {
    const cap = w.caps.simultaneousPatterns;
    for (const e of b.hullEmitters || []) {
      if (out.length >= cap) break;
      out.push(e);
    }
    return out;
  }
  for (const p of b.pods) {
    // `open` is the bay gate and is permanently true for a pod that is not a
    // bay, so this reads unchanged for every other boss shape.
    if (p.alive && p.open && p.firing && p.emitter) out.push(p.emitter);
  }
  return out;
}

/**
 * The vulnerable window (§6.4). Announced, then open, then closed, on a loop.
 *
 * ANNOUNCED FIRST, and the lead time is the point: §0.5 allows the vertical
 * axis only for "slow, optional, generously-timed moves", so the player is
 * told the window is coming 1.5 s before it opens and then has 3.5 s of it.
 * That is a 5 s envelope around a 1.1 s drift. Opening it unannounced would
 * turn an optional reward into a reaction test on the axis this product is
 * least able to serve.
 */
function updateWindow(w, dt, banners) {
  const b = w.boss;
  const W = BOSS.window;
  b.windowT -= dt;

  if (!b.windowOpen) {
    if (!b.windowAnnounced && b.windowT <= W.announceS) {
      b.windowAnnounced = true;
      // Not critical: it must never preempt a WARNING band, and it is optional
      // information by definition. If the queue is busy the player simply
      // plays the fight the ordinary way, which is always a valid answer.
      //
      // TWO WORDINGS, because the window means two different things depending
      // on whether pods are still up, and the old single line was wrong in one
      // of them. With pods alive the window is the ONLY way into the core, so
      // "core exposed" is the news. With the pods already gone the core is
      // permanently open and the window is purely a damage bonus -- calling
      // that "core exposed" told the player something they had already been
      // told, right after the pod-clear banner said it properly.
      banners.push(
        podsRemaining(b) > 0 ? 'CORE EXPOSED — CLIMB' : 'DOUBLE DAMAGE — CLIMB',
        1.4
      );
    }
    if (b.windowT <= 0) {
      b.windowOpen = true;
      b.windowT = W.durationS;
    }
    return;
  }

  if (b.windowT <= 0) {
    b.windowOpen = false;
    b.windowAnnounced = false;
    b.windowT = W.intervalS;
  }
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/**
 * Resolve one player bolt against the boss. THE ONE ENTRY POINT -- collision
 * asks this and does what it is told, rather than testing the hull itself and
 * then asking about damage separately. That split is what let the fight ship
 * unkillable: the hull test consumed the bolt 246px below the pods and the
 * damage test, run afterwards on the already-dead bolt's position, could never
 * agree that anything had been hit.
 *
 * Returns:
 *   null      -- the bolt is unobstructed and must keep flying. Either it is
 *                nowhere near the boss, or it is climbing a shot channel and
 *                has not reached its target yet.
 *   'hullHp'  -- damage applied to a hull boss's single pool.
 *   'pod'     -- damage applied to a pod.
 *   'core'    -- damage applied to the core.
 *   'sealed'  -- reached the core, which is shut. Rings off the shutter.
 *   'hull'    -- hit armour and deflected (pod bosses only; a hull boss has no
 *                armour that does not count).
 * Every non-null result consumes the bolt AND produces a visible effect. There
 * is no path through this function that eats a shot in silence; that is the
 * property being fixed, so it is stated as an invariant rather than left to be
 * re-derived from the branches.
 *
 * See BOSS.podHitHalfW in /data/tuning.js for the shot-channel model and the
 * arithmetic of the bug it replaces.
 */
export function boltHitsBoss(w, x, y, r, amount, fx) {
  const b = w.boss;
  if (!b.active) return null;
  // Entering: the hull is descending and nothing on it is armed yet, so every
  // shot rings off it. Dying: it is coming apart, and bolts pass through the
  // wreck rather than adding a wall of sparks to the break-up.
  if (b.phase === BossPhase.DYING || b.phase === BossPhase.DONE) return null;

  const halfH = bossHalfH(b) * BOSS.hullHitHalfHFrac;
  const skirt = b.y + halfH;
  const roof = b.y - halfH;

  // Outside the hull's damage silhouette -- the bolt is not the boss's problem.
  if (Math.abs(x - b.x) > BOSS.width * 0.5 + r) return null;
  if (y > skirt + r || y < roof - r) return null;

  // DAMAGE IS LIVE FROM THE MOMENT THE HULL IS ON SCREEN, entry included.
  //
  // It used to start only at FIGHTING, which meant the first ~4.3 s of every
  // boss -- the whole descent -- was a stretch where shooting the boss did
  // literally nothing. That is the precise feeling this whole pass exists to
  // remove, and there is no reason to keep a scripted dose of it at the front of
  // the fight. The boss still does not FIRE until it is on station
  // (bossEmitters gates on FIGHTING), so the entry is a free opening rather than
  // a dead one, which is a better read of "the boss is arriving" anyway.
  if (b.hullBoss) {
    // --- HULL BOSS: one pool, hit it anywhere -----------------------------
    // No weak point, no channel, no gate. The simplest damage rule the engine
    // can express, which is the requirement: "super easy super simple to
    // understand there's lots of HP".
    //
    // A SMALL EXPLOSION AT THE CONTACT POINT, at the bolt's own x. Leaning
    // across the hull therefore walks a line of impacts along the armour, which
    // is what makes sustained fire feel like sustained work rather than like
    // waiting for a number to move.
    //
    // Clamped to the skirt, which is the part worth keeping from the pod work:
    // the hull texture is a lens with a narrow mast, so its rect runs ~69px
    // below the visible body, and an unclamped burst detonates in empty space --
    // which reads as a broken game for the same reason no feedback at all did.
    b.hullHp = Math.max(0, b.hullHp - amount);
    b.hitFlashT = BOSS.hullHitFlashS;
    b.chipHp = Math.min(b.maxHullHp, Math.max(b.chipHp + amount, BOSS.hpChipMin));
    fx.bossImpact(x, Math.min(y, skirt));
    return 'hullHp';
  }

  if (b.phase === BossPhase.FIGHTING) {
    // --- pod shot channels ------------------------------------------------
    // A live pod owns a vertical lane through the armour. Inside a lane the
    // hull does not stop the bolt: it climbs to the pod and detonates there,
    // where the player is looking and where the pip row is.
    for (const p of b.pods) {
      if (!p.alive) continue;
      const pp = podPosition(b, p);
      if (Math.abs(x - pp.x) > BOSS.podHitHalfW + r) continue;
      // In the lane but still below the pod: keep flying. The bolt steps
      // ~24px per frame against a 2*(43+9) = 104px tall acceptance window, so
      // it cannot tunnel past.
      if (y > pp.y + BOSS.podRadius + r) return null;

      // A SHUT BAY IS ARMOUR (§6.4, BOSS.bay). The bolt rings off the closed
      // doors, ON THE BAY -- not on anonymous plating 200 px away -- which is
      // the same lesson boss one's sealed core taught: feedback located at the
      // thing you were aiming at says "this is the target, it is just shut",
      // where a spark somewhere else says "this game is broken".
      //
      // `open` is permanently true for a pod that is not a bay, so every other
      // boss shape never reaches this branch.
      if (!p.open) {
        p.hitFlashT = 0.1;
        fx.deflect(x, Math.min(y, pp.y + BOSS.podRadius));
        return 'shut';
      }

      p.hp -= amount;
      p.hitFlashT = 0.14;
      if (p.hp <= 0) {
        p.alive = false;
        p.hp = 0;
        p.deathT = 0;
        // The pattern goes with it, permanently (§6.4). Dropping the instance
        // rather than flagging it means there is nothing left to re-enable.
        p.emitter = null;
        w.stats.score += BOSS.podScore;
        fx.explosion(pp.x, pp.y);
        // A pod dying is the fight's only real milestone before the core, and
        // §6.4's promise is that the fight "measurably calms as you win". Give
        // it a beat the player can feel as well as see.
        w.fx.shakeT = 0.16;
        w.fx.shakeMag = 10;
        // Re-deal the firing slots immediately: the fight should audibly calm
        // the instant a pod dies, not at the end of the current rotation.
        rotatePods(w);
        w.boss.podKilledT = 0;
      } else {
        // Same contact burst the hull boss uses, at the pod. One vocabulary
        // for "your shot landed on the boss", so a player who learns it on
        // boss one reads it unchanged on bosses two and three.
        fx.bossImpact(pp.x, pp.y + BOSS.podRadius * 0.4);
      }
      return 'pod';
    }

    // --- the core's channel, on exactly the same rule ---------------------
    const core = corePosition(b);
    if (Math.abs(x - core.x) <= BOSS.coreRadius + r) {
      if (y > core.y + BOSS.coreRadius + r) return null;
      const mul = coreDamageMultiplier(w);
      if (mul <= 0) {
        // Sealed. The bolt rings off the closed shutter, ON the core -- which
        // says "this is the thing, it is just shut" far better than a spark on
        // anonymous armour 200px away, and better than the nothing it used to
        // say.
        b.coreHitFlashT = 0.12;
        fx.deflect(x, Math.min(y, core.y + BOSS.coreRadius));
        return 'sealed';
      }
      b.coreHp = Math.max(0, b.coreHp - amount * mul);
      b.coreHitFlashT = 0.12;
      fx.bossImpact(core.x, core.y + BOSS.coreRadius * 0.4);
      return 'core';
    }
  }

  // --- bare armour --------------------------------------------------------
  // Consumed, and VISIBLY so. A bolt that vanishes into a hull with no spark
  // reads as a broken game rather than as a missed shot, which is exactly how
  // this fight came to look invulnerable even where it was working.
  const at = Math.min(y, skirt);
  if ((b.hullSparkT || 0) <= 0) {
    b.hullSparkT = BOSS.hullSparkCooldownS;
    fx.deflect(x, at);
  } else {
    fx.impact(x, at);
  }
  return 'hull';
}

/** The hull's damage silhouette, for the debug hitbox overlay and for /render's
 *  shot channels, which have to end exactly where deflections happen. */
export function bossHullBox(b) {
  const halfH = bossHalfH(b) * BOSS.hullHitHalfHFrac;
  return {
    left: b.x - BOSS.width * 0.5,
    right: b.x + BOSS.width * 0.5,
    top: b.y - halfH,
    bottom: b.y + halfH,
  };
}

// ---------------------------------------------------------------------------
// Death (§6.4: "staged pod detonations, then a hull break-up over ~2 s,
// particle-driven"). No authored frames -- §9.5 rule 3.
// ---------------------------------------------------------------------------

function beginDeath(w, fx) {
  const b = w.boss;
  b.phase = BossPhase.DYING;
  b.deathT = 0;
  b.deathPodsFired = 0;
  b.windowOpen = false;
  for (const p of b.pods) p.firing = false;
  w.stats.score += BOSS.coreScore;

  // WHERE THE STAGED DETONATIONS GO. §6.4 asks for "staged pod detonations,
  // then a hull break-up" -- on a pod boss those are literally the pods, and on
  // a hull boss there are none, so the stagger walked zero points and the death
  // collapsed straight into the break-up puff with no sequence at all.
  //
  // Resolved as data at the moment of death rather than as a branch in the
  // per-frame code: a list of x offsets to walk, taken from the pods if there
  // are any and otherwise spaced evenly along the hull. §6.4's "sequence of
  // failures rather than one puff" then holds for both kinds of row.
  if (b.pods.length) {
    b.deathPoints = b.pods.map((p) => p.dx);
  } else {
    const n = BOSS.death.hullStages;
    b.deathPoints = [];
    for (let i = 0; i < n; i++) b.deathPoints.push((i + 0.5) / n);
  }
}

function updateDeath(w, dt, fx) {
  const b = w.boss;
  const D = BOSS.death;
  b.deathT += dt;

  // Staged detonations walk the hull bow to stern, so the break-up reads as a
  // sequence of failures rather than one puff.
  const points = b.deathPoints || [];
  const want = Math.min(points.length, Math.floor(b.deathT / D.podStaggerS));
  while (b.deathPodsFired < want) {
    const dx = points[b.deathPodsFired++];
    fx.explosion(b.x + (dx - 0.5) * BOSS.width, b.y);
    w.fx.shakeT = 0.18;
    w.fx.shakeMag = D.shakeMag;
  }

  // Then the hull itself, as a rolling series of blasts along its length.
  const startS = points.length * D.podStaggerS;
  if (b.deathT >= startS) {
    b.breakT = (b.breakT || 0) + dt;
    if (b.breakT >= 0.09) {
      b.breakT = 0;
      const k = Math.min(1, (b.deathT - startS) / D.breakUpS);
      const halfH = bossHalfH(b);
      fx.explosion(
        b.x + (Math.random() - 0.5) * BOSS.width * (0.35 + k * 0.65),
        b.y + (Math.random() - 0.5) * halfH * 1.5
      );
    }
  }

  if (b.deathT >= startS + D.breakUpS) {
    b.phase = BossPhase.DONE;
    b.active = false;
  }
}

/**
 * WHY THERE IS NO LONGER A POOLED HP FRACTION.
 *
 * There was one, and it drove a single full-width bar. Amit's report on the
 * fight: "the UI of it, like where is its HP, it's not clear, maybe it's the
 * line up there, but I don't know". The pooling is most of why. Boss HP is not
 * one number -- it is four 6-HP pods gating a 30-HP core -- so the aggregate
 * moved 11% when a whole pod died and 1.9% per bolt into a pod, which is both
 * unreadable and a lie about the structure. Landing a full pod kill should be
 * the most visible thing on the readout; on a 54-point pool it was the least.
 *
 * /ui/hud.js now shows the real model: one gauge per pod, positioned over the
 * pod it belongs to, plus a separate core gauge that is visibly sealed until it
 * is not. Nothing pools, so nothing has to be un-pooled by the player.
 */
export function bossPodHpFraction(pod) {
  return pod.maxHp > 0 ? Math.max(0, pod.hp) / pod.maxHp : 0;
}

export function bossCoreHpFraction(b) {
  return b.maxCoreHp > 0 ? Math.max(0, b.coreHp) / b.maxCoreHp : 0;
}

/**
 * Mark an emitter as the boss's, so volleyInterval() applies BOSS.fireRateMul.
 *
 * Amit, from the board: "the boss fight needs fewer projectiles too." The
 * multiplier that answers that lives in /data/tuning.js and /patterns reads it
 * off `st.boss` -- but nothing set that flag, so the knob was inert and turning
 * it produced measurably identical fights (1.0, 1.25 and 1.5 all gave a peak of
 * 11 concurrent orbs). A tuning constant that does nothing is worse than a
 * missing one, because the next person to find the fight too busy will turn it
 * further and conclude the fight cannot be calmed.
 *
 * Applied at CREATION, at the two places a boss makes an emitter, rather than
 * inside createEmitter: /patterns has no concept of a boss and should not gain
 * one -- an owner is an owner. This is the boss saying which of its emitters are
 * its own, which it is the only thing that knows.
 */
function bossOwned(em) {
  if (em) em.boss = true;
  return em;
}

/** Boot-time geometry facts the validator checks. Exported so constraints.js
 *  computes them exactly the way the game does, rather than re-deriving. */
export function bossGeometry(aspect) {
  const halfH = (BOSS.width / aspect) * 0.5;
  return {
    halfH,
    top: BOSS.stationY * DESIGN_H - halfH,
    bottom: BOSS.stationY * DESIGN_H + halfH,
    // The damage silhouette, which is what a bolt actually meets. Published
    // separately from the drawn extent because the two are no longer the same
    // (BOSS.hullHitHalfHFrac) and the validator has to check the reachability of
    // the fight against the one the game really uses.
    skirt: BOSS.stationY * DESIGN_H + halfH * BOSS.hullHitHalfHFrac,
    podY: BOSS.stationY * DESIGN_H,
    left: DESIGN_W * 0.5 - BOSS.width * 0.5 - BOSS.swayAmpX,
    right: DESIGN_W * 0.5 + BOSS.width * 0.5 + BOSS.swayAmpX,
    playerBandTop: BANDS.player.top * DESIGN_H,
    marginLeft: PLAYABLE_X.min * DESIGN_W,
    marginRight: PLAYABLE_X.max * DESIGN_W,
    layoutLeft: FORMATION_X.min * DESIGN_W,
    layoutRight: FORMATION_X.max * DESIGN_W,
    hitboxRadius: PLAYER.hitboxRadius,
  };
}
