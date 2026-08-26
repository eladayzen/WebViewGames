// The world state. PLAIN DATA ONLY -- no renderer objects, no Pixi imports,
// no DOM nodes (§9.1, §9.2).
//
// "game state is plain data, systems mutate plain data, and the render layer
// reads it." That isolation is what keeps the PixiJS-vs-raw-Canvas question
// (§9.1, §12) a cheap swap rather than a rewrite, so it is load-bearing even
// though nothing in this file knows about it.
//
// Everything that spawns is POOLED (§9.1): entities carry an `alive` flag and
// are reused in place. Nothing in the hot loop allocates.

import {
  PLAYER,
  POC_SCENARIO,
  DENSITY_CAPS,
  POC_ENEMY_CAP_OVERRIDE,
  DESIGN_W,
  DESIGN_H,
} from '../data/tuning.js';

/** The explicit state machine (§9.2). POC uses a strict subset of the MVP
 *  graph: boot -> running -> failed. No title gate, no sector select, no
 *  results -- POC has none of those (§2), and the SDK contract requires the
 *  first playable state to be reached on load with no key press. */
export const GameState = {
  BOOT: 'boot',
  RUNNING: 'running',
  FAILED: 'failed',
};

/** Sub-states inside `running`, gated by a single enum rather than by flags
 *  scattered through the loop (§9.2).
 *
 *  §9.2 lists exactly these: "`running` has sub-states `wave`, `waveBanner`,
 *  `bossWarning`, `boss`, `bossDeath` -- all inside one update path, gated by
 *  a single enum, not by flags scattered through the loop." The three boss
 *  states land here now that there is a boss; nothing else about the shape
 *  changes. */
export const RunPhase = {
  WAVE: 'wave',
  WAVE_BANNER: 'waveBanner',
  BOSS_WARNING: 'bossWarning',
  BOSS: 'boss',
  BOSS_DEATH: 'bossDeath',
};

function makePool(size, factory) {
  const arr = new Array(size);
  for (let i = 0; i < size; i++) arr[i] = factory();
  return arr;
}

export function createWorld() {
  // Normal caps, with the one documented, validator-reported deviation for
  // the 12 x 2 formation's slot count -- see POC_ENEMY_CAP_OVERRIDE's comment
  // in tuning.js for the doc conflict this resolves and what stage 3 owes us.
  const caps = { ...DENSITY_CAPS.normal, enemies: POC_ENEMY_CAP_OVERRIDE };
  return {
    state: GameState.BOOT,
    phase: RunPhase.WAVE_BANNER,
    // Wall-clock seconds of simulated time since the run started. Drives
    // instrumentation and every timer; never read performance.now() in a
    // system, or the fixed timestep stops being fixed.
    time: 0,
    paused: false,

    player: {
      x: PLAYER.spawnX * DESIGN_W,
      y: PLAYER.spawnY * DESIGN_H,
      vx: 0,
      vy: 0,
      // Presentational only: never affects hitbox, heading or gun direction.
      // The nose stays north; the guns always fire straight up (§0.2, §4).
      roll: 0, // -1 | 0 | 1
      rank: 1, // pinned at 1 for POC -- no chevrons (§2)
      shield: PLAYER.shieldSegments,
      // BARRIER pickup (§5.6, playtest round 10): seconds of remaining
      // invulnerability. Distinct from invulnT, which is the post-hit i-frame
      // window -- these can overlap and must not clobber each other.
      barrierT: 0,
      // One-shot REPAIR burst (§5.6): counts DOWN from PLAYER.repairFlashS.
      repairFlashT: 0,
      invulnT: 0,
      fireT: 0,
      alive: true,
      hitFlashT: 0,
      // The temporary alternate weapon (§5.6, WEAPONS in tuning.js). `weapon`
      // is a key into WEAPONS and `weaponT` is what is left of it; when the
      // clock runs out the key goes back to 'standard'. Rank is untouched --
      // §8.1's ladder and this are different axes, and a pickup must never
      // interact with rank (a hit already never costs rank, §5.10).
      weapon: 'standard',
      weaponT: 0,
      // The empty-screen fire hold (FIRE_HOLD). `holdT` counts the grace before
      // the guns actually stop; `holding` is the resulting state, which /render
      // reads to draw the idle tell. Resume clears both on the same frame the
      // target appears -- there is deliberately no counterpart timer on the way
      // back up.
      holdT: 0,
      holding: false,
    },

    // --- pooled entity arrays -------------------------------------------
    // Sized generously above the density caps so a pool exhaustion is a bug,
    // not a normal condition. The caps themselves are enforced by the
    // spawners, not by the pool size.
    enemies: makePool(64, () => ({
      alive: false,
      // Which of §6.2's types this craft is. Behaviour is composed from the
      // type's data (entry path, whether it swoops, which pattern it owns) --
      // nothing in /enemies branches on the name.
      type: 'drone',
      x: 0,
      y: 0,
      hp: 0,
      maxHp: 0,
      // A pattern instance this craft owns and dies with, or null. The Emitter
      // carries a B2; a drone carries nothing and fires through the wave's own
      // B1 (§6.2).
      emitter: null,
      // 'entering' | 'peeling' | 'locked' | 'swooping' | 'fleeing'
      mode: 'entering',
      // Heading, for runtime rotation of a flat top-down body (§6.2, §9.5).
      heading: Math.PI / 2,
      slot: -1,
      // Which §5.5 shape this craft's slot belongs to. Carried per craft, not
      // per wave, so two formations can legally overlap in time later without
      // the geometry needing to know about the director.
      formation: 'F1',
      squadron: -1,
      t: 0, // phase-local timer
      dur: 0, // phase-local duration
      // Entry path parameters (all plain numbers -- no closures, so the
      // entity stays poolable and the whole array stays cache-friendly).
      p: { x0: 0, x1: 0, y0: 0, amp: 0, side: 1, loops: 1 },
      // Swoop parameters.
      s: { x0: 0, y0: 0, x1: 0, outY: 0, outS: 0, dipY: 0, descentS: 0, returnS: 0 },
      swoopCooldown: 0,
      hitFlashT: 0,
      // The uid of the last piercing round that hit this craft (WEAPONS.lance).
      // One integer instead of a per-round hit list, which is what keeps the
      // pierce test allocation-free in the hot loop (§9.1). See `uid` on the
      // bolt pool below for why the stamp is needed at all.
      lastPierceUid: -1,
      // Set once the craft has settled: killing before this is the pre-lock
      // kill window and is worth double (§5.5, §8.2).
      locked: false,
      // Per-craft runtime variation (ENEMY.vary), rolled from the seeded stream
      // at spawn. PRESENTATION AND CADENCE ONLY -- `sizeMul` scales the drawn
      // sprite and never the hitbox, `tint` stays inside §5.4's enemy family,
      // and `cadenceMul` shifts when an owned pattern fires, never its shape.
      sizeMul: 1,
      tint: 0xffffff,
      cadenceMul: 1,
      // The Warden's shimmer shield (§6.2): whole bolts absorbed before the
      // hull takes any. Does not regenerate.
      shield: 0,
      shieldFlashT: 0,
      // The exit arc, for Splitter fragments and bay-launched drones
      // (ENEMY.fragment). `fx` is the lateral direction; `ft` is the phase
      // clock for the initial rise.
      fx: 1,
      ft: 0,
      // Score for a craft that was not authored into a wave. Set by the
      // spawner because the same exit arc serves a Splitter's pair (worth a
      // drone) and a Brood Gantry bay launch (worth much less).
      fragScore: 0,
      // Launched by a Brood Gantry bay rather than authored into a wave, so
      // the boss can count its own live brood against BOSS.bay.maxLaunched
      // without keeping a decrement ledger that a missed death would corrupt.
      fromBay: false,
    })),

    enemyBullets: makePool(96, () => ({
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 0,
      pattern: '',
      counted: false, // near-miss bookkeeping
      // B4's sine curtain (§5.5). `bx` is the straight-line base the velocity
      // integrates; `x` above is that base plus the sine offset, so collision
      // and the renderer keep reading one position. Zero on every other pattern.
      bx: 0,
      sAmp: 0,
      sW: 0,
      sPhase: 0,
      sT: 0,
      // Pulse phase for the breathing scale/glow (FX.enemyBulletPulse). Purely
      // presentational -- collision reads `r` and never this -- and stamped at
      // spawn so a volley does not pulse in lockstep.
      phase: 0,
    })),

    playerBolts: makePool(96, () => ({
      alive: false,
      x: 0,
      y: 0,
      // A bolt now carries its own vx and damage rather than the collision
      // layer reading PLAYER.fire. That is what lets a temporary weapon change
      // shape without any system downstream knowing weapons exist -- and it is
      // the only reason a 3-round fan is not a special case in collision, the
      // boss, or the renderer.
      vx: 0,
      vy: 0,
      r: 0,
      dmg: 1,
      // Which WEAPONS row fired it, for the sprite and tint only.
      weapon: 'standard',
      // --- pickup-weapon behaviour, carried on the ROUND ------------------
      // Same discipline as `dmg` and `r` above, and for the same reason: every
      // consumer downstream reads the round rather than looking up the weapon,
      // which is why a 3-round fan needed no change in collision, the boss or
      // the renderer. These three keep that true for four weapons.
      //
      // How many more craft this round may pass through (WEAPONS.lance). Zero
      // means it is spent on the first thing it hits, which is every other
      // weapon in the game.
      pierce: 0,
      // Identity stamp, so a piercing round cannot hit the SAME craft twice.
      // A lance travels ~29 px per frame against a 36 px-radius craft, so it
      // is inside a given hitbox for two or three consecutive frames; without
      // a stamp it would spend its whole pierce budget on one drone. Compared
      // against `lastPierceUid` on the enemy -- an integer test, no allocation
      // and no per-round hit list (§9.1).
      uid: 0,
      // Distance still to travel before the round is spent (WEAPONS.flak's
      // rangePx). Zero means unlimited, which is every other weapon.
      lifePx: 0,
      // Steering (WEAPONS.swarm). `turn` is radians/second; zero means the
      // round flies straight, which is every other weapon.
      turn: 0,
      acquire: 0,
      retargetT: 0,
      target: -1,
    })),

    // --- pickups (§5.6) ---------------------------------------------------
    // Pooled like everything else. §5.6 caps what may be on screen at once
    // (PICKUPS.maxOnScreen) so this is generously oversized on purpose: an
    // exhausted pool would be a bug, never a normal condition.
    pickups: makePool(8, () => ({
      alive: false,
      kind: 'scatter',
      x: 0,
      y: 0,
      vy: 0,
      t: 0,
      // How many times this drop may still be re-offered after scrolling past
      // uncollected (§5.6's "re-offered within 8 s"), and the clock for it.
      reOffers: 0,
      reOfferT: 0,
      // Where it will come back, if it comes back. Stored at drop time so the
      // re-offer honours the same lateral-lure rules the original did.
      reOfferX: 0,
    })),

    // Drop bookkeeping (PICKUPS). Lives on the world rather than in the pickup
    // module so a restart clears it with everything else.
    pickup: {
      // Kills since the last drop, against PICKUPS.maxKillsWithoutDrop -- the
      // floor that turns "about two per level" from an average into a promise.
      killsSinceDrop: 0,
      lastDropT: -999,
      dropped: 0,
      collected: 0,
    },

    // Telegraph markers for anything arriving from the top edge (§5.3).
    // POC has no top-edge spawns (no ground targets), but the band and the
    // marker system exist so MVP does not have to retrofit them.
    telegraphs: makePool(12, () => ({ alive: false, x: 0, t: 0, lead: 0 })),

    // --- surface (§5.4) ---------------------------------------------------
    surface: {
      // Total scrolled distance. In Mode A this stays 0 forever; the progress
      // meter reads a different source there (§5.2) -- not built at POC.
      scroll: 0,
      // Ambient overlay offsets, one per parallax layer.
      overlay: [0, 0],
      overlayX: [0, 0],
      props: makePool(24, () => ({
        alive: false,
        kind: 0,
        x: 0,
        y: 0,
        rot: 0,
        scale: 1,
      })),
      // Mode A's scheduled surface activity (§5.2 anti-deadness).
      event: { active: false, x: 0, y: 0, t: 0, dur: 0 },
      emissivePhase: 0,
    },

    // Which of §5.4's surfaces is under the action. An index into
    // /data/surfaces.js, NOT a sector number -- there is no sector campaign at
    // POC (§2) and this is not the sector/wave director (MVP item 9).
    surfaceIndex: 0,

    // The boss hull texture's width/height, published here by /render at boot.
    // State holds no renderer objects (§9.1), but the hull's real proportions
    // decide its on-screen extent and the 0.58 rule is checked against them,
    // so the NUMBER lives in state where the systems can read it.
    bossAspect: 2.7,

    // --- the screen-covered surface transition ----------------------------
    // A phase of the run, not a pause: `paused` above keeps meaning exactly
    // what it meant, and this freezes the simulation for its own reason (the
    // playfield is hidden, so nothing may hit the player behind the cover).
    // See /surface/transition.js.
    transition: {
      active: false,
      phase: 'coverIn',
      t: 0,
      fromIndex: 0,
      toIndex: 0,
      swapped: false,
    },
    // Bumped once per completed transition. Drives the beat's caption only.
    sectorsCrossed: 0,

    // --- boss (§6.4) ------------------------------------------------------
    // NOT pooled: there is exactly one boss at a time, by definition. Pods are
    // a plain array rebuilt per fight from /data/bosses.js -- they are
    // authored content, not spawned entities, and there are four of them.
    boss: {
      active: false,
      id: '',
      name: '',
      phase: 'done',
      // Hull texture aspect, handed in by /render at fight start. State holds
      // no renderer objects (§9.1), but the hull's real proportions decide its
      // on-screen extent, so the number itself lives here.
      aspect: 2.7,
      x: 0,
      y: 0,
      t: 0,
      entryS: 0,
      pods: [],
      // TWO SHAPES OF BOSS OVER ONE RECORD (/data/bosses.js). `hullBoss` is
      // resolved from the row at arm time; the pool the fight does not use is
      // zeroed rather than left stale, so a readout that asks the wrong question
      // gets 0 instead of a plausible number from the previous fight.
      hullBoss: false,
      // What this boss calls its pods, for the shed-a-pod banner (§7.1).
      podNoun: 'BATTERY',
      hullHp: 0,
      maxHullHp: 0,
      // Patterns a hull boss owns directly, since it has no pods to own them.
      hullEmitters: [],
      // The hull's own hit flash, and the HP bar's bright "just lost this much"
      // chip -- the two things that make one bolt visible against 240 points.
      hitFlashT: 0,
      chipHp: 0,
      coreDx: 0.5,
      coreHp: 0,
      maxCoreHp: 0,
      coreHitFlashT: 0,
      // Deflect-burst cooldown (BOSS.hullSparkCooldownS) and the pod-count edge
      // the banner lines are driven off.
      hullSparkT: 0,
      // Bay-launched craft currently alive (BOSS.bay.maxLaunched), so a
      // carrier boss can never fill §5.3's enemy cap by itself.
      launched: 0,
      lastPodsRemaining: undefined,
      rotateT: 0,
      rotateHead: 0,
      // The vulnerable window (§6.4). `windowT` counts down to the next state
      // change, whichever that is.
      windowT: 0,
      windowOpen: false,
      windowAnnounced: false,
      deathT: 0,
      deathPodsFired: 0,
      // Hull offsets the staged death detonations walk -- the pods if there are
      // any, otherwise evenly spaced points along the hull.
      deathPoints: null,
      breakT: 0,
    },

    // --- director (§5.7, POC subset) --------------------------------------
    director: {
      waveIndex: 0,
      cycle: 0,
      // Edge-tracking for "the sector just ended", which has two triggers
      // depending on whether this surface's boss is built -- see
      // /systems/director.js sectorComplete().
      lastReportedCycle: 0,
      bossCleared: false,
      waveT: 0,
      phaseT: 0,
      // Pending squadron launches for the current wave.
      pending: [],
      // Active pattern emitters, one record per pattern id in the wave.
      emitters: [],
      spawnedThisWave: 0,
      killedThisWave: 0,
      hitsThisWave: 0,
    },

    // --- run stats (no scoring UI at POC -- these feed instrumentation) ---
    stats: {
      score: 0,
      kills: 0,
      preLockKills: 0,
      shotsFired: 0,
      hits: 0,
      // Bolts stopped by boss armour without damaging anything. Counted
      // separately from `hits` so accuracy cannot flatter a fight in which
      // nothing is actually being hurt -- which is how the unkillable boss
      // survived instrumentation.
      deflects: 0,
      damageTaken: 0,
    },

    // --- transient presentation state the renderer reads ------------------
    fx: {
      shakeT: 0,
      shakeMag: 0,
      flashT: 0,
    },

    caps,
    // Dev-only overlays (§10 POC-1's band guide, §5.4's black-surface toggle).
    debug: {
      bands: false,
      blackSurface: false,
      hitboxes: false,
      aisle: false,
      // Dev cheat, honoured in player.js's damagePlayer(). Never set by
      // gameplay -- only by ui/devPanel.js.
      invincible: false,
    },
  };
}

/** Grab a free slot from a pool, or null if exhausted. */
export function alloc(pool) {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].alive) return pool[i];
  }
  return null;
}

/** Count of live entries in a pool. */
export function liveCount(pool) {
  let n = 0;
  for (let i = 0; i < pool.length; i++) if (pool[i].alive) n++;
  return n;
}

/** Reset the world in place for a scenario (re)start. Preserves nothing, per
 *  §5.2's toggle requirement. */
export function resetWorld(w) {
  const fresh = createWorld();
  // Copy field-by-field into the existing object so any renderer binding that
  // holds a reference to `world` keeps working across a restart.
  for (const k of Object.keys(fresh)) w[k] = fresh[k];
  w.state = GameState.RUNNING;
  return w;
}

export const bounds = { w: DESIGN_W, h: DESIGN_H };
export { POC_SCENARIO };
