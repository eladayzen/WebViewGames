// The POC scenario director.
//
// §3: "POC runs steps 1-5, 9 and a bare loop of step 3, in both modes,
// forever." So this is a deliberately small thing: a three-wave cycle that
// repeats, with no boss, no sector, no results screen (§2).
//
// The one property that matters more than anything else here is that the
// content is IDENTICAL in both framing modes and deterministic across a mode
// toggle (§0.1, §5.2). Everything the director decides -- which side a
// squadron enters from, entry timing jitter, path shape -- draws from the
// seeded stream in core/rng.js, reseeded on every scenario (re)start. Toggling
// the mode mid-session therefore replays the same squadrons in the same
// places, which is what makes the A/B an A/B rather than two different games.

import {
  POC_SCENARIO,
  ENEMY,
  BOSS,
  enemyDef,
  levelAt,
  levelWaves,
} from '../data/tuning.js';
import { cfg } from '../core/mode.js';
import { RunPhase } from '../core/state.js';
import {
  spawnEntering,
  fleeAll,
  slotCount,
  craftPatternId,
} from '../enemies/enemies.js';
import { createEmitters, createEmitter } from '../patterns/patterns.js';
import { triggerSurfaceEvent } from '../surface/surface.js';
import { surfaceAt } from '../data/surfaces.js';
import { bossIsBuilt, bossDef } from '../data/bosses.js';
import { beginBoss, updateBoss, clearBoss, BossPhase } from '../enemies/boss.js';
import { sfx } from './audio.js';

export function startScenario(w, rng, banners) {
  rng.reseed(POC_SCENARIO.seed);
  const d = w.director;
  d.waveIndex = 0;
  d.cycle = 0;
  d.lastReportedCycle = 0;
  d.bossCleared = false;
  clearBoss(w);
  beginWaveBanner(w, banners);
}

/**
 * The wave list this level runs (LEVELS in /data/tuning.js).
 *
 * The one structural change of this slice, and it is small on purpose: the
 * director used to run POC_SCENARIO.waves on every surface, so all three levels
 * were the same fight over different art. A level now owns its own list, keyed
 * by the same index /data/surfaces.js uses.
 *
 * LEVEL ONE'S LIST IS STILL POC_SCENARIO.waves, by reference (see LEVELS), so
 * nothing about its content can move without editing POC_SCENARIO -- which is
 * exactly the property "level one is locked" needs. The wave-taxonomy rename
 * (POC-8 decision note, playtest round 2 §1) is still pending and deliberately
 * untouched here: these are `waves`, four-to-a-wave nesting is a later edit.
 */
function waveList(w) {
  return levelWaves(w.surfaceIndex);
}

function currentWave(w) {
  const list = waveList(w);
  return list[w.director.waveIndex % list.length];
}

/** Per-level wave timeout. Level two's waves take genuinely longer to clear
 *  (2 HP drones, Wardens behind shields), and a wave that times out makes its
 *  survivors flee -- which would read as the game giving up rather than as the
 *  player being slow. */
function waveTimeout(w) {
  return levelAt(w.surfaceIndex).waveTimeoutS || POC_SCENARIO.waveTimeoutS;
}

function beginWaveBanner(w, banners) {
  const d = w.director;
  d.phaseT = 0;
  w.phase = RunPhase.WAVE_BANNER;
  const wave = currentWave(w);
  banners.push(
    `${wave.name}${d.cycle > 0 ? ` · LOOP ${d.cycle + 1}` : ''}`,
    POC_SCENARIO.waveBannerS
  );
}

function beginWave(w, rng, banners) {
  const d = w.director;
  const wave = currentWave(w);

  d.waveT = 0;
  d.phaseT = 0;
  d.spawnedThisWave = 0;
  d.killedThisWave = 0;
  d.hitsThisWave = 0;
  d.pending.length = 0;
  d.emitters = createEmitters(wave.patterns);
  w.phase = RunPhase.WAVE;

  // Queue every craft's launch up front, in file, spaced 0.15-0.25 s apart
  // (§5.5). Squadrons enter from the LEFT or RIGHT EDGE ONLY.
  //
  // A squadron now names its FORMATION and its first SLOT rather than a grid
  // row, so the same table drives a grid, an ellipse and a chevron -- which is
  // what let playtest round 2's placement variety land as a data edit.
  const formation = wave.formation || 'F1';
  const slots = slotCount(formation);
  for (let s = 0; s < wave.squadrons.length; s++) {
    const sq = wave.squadrons[s];
    const base = sq.slot || 0;
    const delay = sq.delayS || 0;
    let t = delay;
    for (let i = 0; i < sq.count; i++) {
      const slot = base + i;
      if (slot >= slots) break;
      // A squadron's `types` map is keyed by OFFSET WITHIN THE SQUADRON, not
      // by absolute slot, so a squadron can be moved to a different part of a
      // formation without silently relocating its Emitters.
      //
      // `fill` IS THE SQUADRON'S DEFAULT TYPE, and it exists because of the
      // HP-tier rule (see ENEMY in /data/tuning.js). Levels two and three used
      // to get their tougher rank-and-file from `hp: { drone: 2 }`, which made
      // a craft tougher without making it look tougher; they now author the
      // LANCER instead. Naming a dozen slots per squadron to say "these are all
      // Lancers" would have buried the two or three slots that actually differ,
      // so the bulk type is one field and `types` stays a list of exceptions.
      const type = (sq.types && sq.types[i]) || sq.fill || 'drone';
      d.pending.push({
        t, side: sq.side, slot, squadron: s, formation, pace: sq.pace, type,
      });
      t += rng.range(ENEMY.entry.fileSpacingS[0], ENEMY.entry.fileSpacingS[1]);
    }
  }

  // Mode A's scheduled surface activity: at least one authored surface event
  // per wave (§5.2 anti-deadness). A no-op in Mode S, where the world's own
  // motion carries the flow.
  if (cfg().surfaceEventsPerWave > 0) triggerSurfaceEvent(w, rng);
}

// ---------------------------------------------------------------------------
// The boss beat (§6.4)
//
// WHERE THE BOSS SITS, AND WHY HERE. The POC-8 decision note's working
// assumption is "one boss at the end of each level (after its 4 waves)". It
// also re-cuts the wave taxonomy one level deeper (today's `waves[]` become
// `subWaves[]`, four of those per wave, four waves per level) -- and that
// rename is EXPLICITLY still pending, because it forces a session-length call
// that is Amit's to make.
//
// So the boss is hung off the event that already means "the authored content
// has run once end to end": the completion of a full cycle of POC_SCENARIO's
// wave list, which is the same edge the surface transition already fires on.
// That gives level one a real ending today without inventing a level structure
// that the rename is about to define differently. When the taxonomy lands, the
// boss moves to the end of the level's four waves by changing WHERE
// beginBossWarning() is called from -- none of the boss code changes.
// ---------------------------------------------------------------------------

/** Does the surface we are standing on have a boss that is actually built? */
export function bossForSurface(w) {
  return surfaceAt(w.surfaceIndex).boss;
}

export function hasBuiltBoss(w) {
  return bossIsBuilt(bossForSurface(w));
}

/** Dev entry point: skip straight to the boss beat from wherever the run is.
 *  Exposed on the `G` key and on __nv (see /main.js) so the fight can be
 *  verified without replaying six waves to reach it. Reuses the real path, so
 *  what it tests is the real beat and not a special case. */
export function forceBossWarning(w, banners) {
  if (!hasBuiltBoss(w)) return false;
  if (
    w.phase === RunPhase.BOSS_WARNING ||
    w.phase === RunPhase.BOSS ||
    w.phase === RunPhase.BOSS_DEATH
  ) {
    return false;
  }
  beginBossWarning(w, banners);
  return true;
}

function beginBossWarning(w, banners) {
  const d = w.director;
  w.phase = RunPhase.BOSS_WARNING;
  d.phaseT = 0;
  // Survivors leave before the boss arrives: a leftover formation would still
  // be holding station over a fight that owns the whole enemy band, and the
  // combined density would breach §5.3's caps on the boss's first frame.
  fleeAll(w);
  d.pending.length = 0;
  d.emitters = [];
  // CRITICAL, which is the one banner class that preempts (§7.1). §6.4 wants
  // the WARNING band to go through the single-slot queue precisely so it can
  // never collide with another banner -- the report caught three text layers
  // colliding in one reference frame.
  banners.push(`WARNING — ${bossDef(bossForSurface(w)).name}`, BOSS.warningS, true);
  // §6.4's warning band is 2 s of READ TIME with a cleared frame. A sound is
  // the half of it that works when the player is looking at where their ship
  // is rather than at the top of the screen.
  sfx('bossWarning');
}

export function updateDirector(w, rng, dt, banners, fx) {
  const d = w.director;

  if (w.phase === RunPhase.BOSS_WARNING) {
    d.phaseT += dt;
    // Nothing is spawned during the warning: it is 2 s of read time, and the
    // fleeing survivors clearing the frame is most of what makes it readable.
    if (d.phaseT >= BOSS.warningS) {
      w.phase = RunPhase.BOSS;
      beginBoss(w, bossForSurface(w), w.bossAspect);
      banners.push(bossDef(bossForSurface(w)).name, 1.2, true);
    }
    return;
  }

  if (w.phase === RunPhase.BOSS || w.phase === RunPhase.BOSS_DEATH) {
    updateBoss(w, dt, fx, banners);
    if (w.phase === RunPhase.BOSS && w.boss.phase === BossPhase.DYING) {
      w.phase = RunPhase.BOSS_DEATH;
    }
    if (w.boss.phase === BossPhase.DONE) {
      clearBoss(w);
      d.bossCleared = true;
    }
    return;
  }

  if (w.phase === RunPhase.WAVE_BANNER) {
    d.phaseT += dt;
    if (d.phaseT >= POC_SCENARIO.waveBannerS + POC_SCENARIO.interWaveS * 0.4) {
      beginWave(w, rng, banners);
    }
    return;
  }

  // --- wave running -------------------------------------------------------
  d.waveT += dt;

  // Launch queued craft.
  for (let i = d.pending.length - 1; i >= 0; i--) {
    const q = d.pending[i];
    if (d.waveT < q.t) continue;
    // The simultaneous-air-enemy cap is a floor of the pacing contract, so a
    // launch that would breach it waits rather than being dropped.
    let live = 0;
    for (let j = 0; j < w.enemies.length; j++) if (w.enemies[j].alive) live++;
    if (live >= w.caps.enemies) continue;
    const e = spawnEntering(
      w, rng, q.side, q.slot, q.squadron, q.formation, q.pace, q.type
    );
    // Attach the craft-owned pattern instance, if its type has one. Done here
    // rather than inside spawnEntering because /patterns reads back into
    // /enemies for B1's shooter list, and constructing an emitter there would
    // close that into an import cycle.
    if (e) {
      // WHICH pattern is per craft, not per type. §6.2's Emitter declares
      // `patternVariants` and craftPatternId picks one from the craft's stable
      // identity hash, so two Emitters in a formation run visibly different
      // rhythms. Both variants are authored rows that /systems/constraints.js
      // proves at boot -- the variation is which validated pattern a craft
      // carries, never what is inside one (see craftPatternId).
      const pid = craftPatternId(w, e);
      if (pid) e.emitter = createEmitter(pid, e);
    }
    d.spawnedThisWave++;
    d.pending.splice(i, 1);
  }

  // Wave ends when it is cleared, or when its timer expires and its survivors
  // flee (§5.7) -- durations are targets, not hard gates.
  let live = 0;
  for (let j = 0; j < w.enemies.length; j++) {
    const e = w.enemies[j];
    if (e.alive && e.mode !== 'fleeing') live++;
  }

  const cleared = d.pending.length === 0 && live === 0;
  const expired = d.waveT >= waveTimeout(w);

  if (expired && !cleared) {
    fleeAll(w);
    d.pending.length = 0;
  }

  if (cleared || (expired && live === 0)) {
    d.waveIndex++;
    d.emitters = [];
    if (d.waveIndex % waveList(w).length === 0) {
      d.cycle++;
      // The authored content has run once end to end. If this surface has a
      // boss that is actually built, it ends the level; if it does not (levels
      // two and three are declared but unbuilt), fall through to the loop the
      // POC has always had rather than stalling on a fight that cannot start.
      if (hasBuiltBoss(w)) {
        beginBossWarning(w, banners);
        return;
      }
    }
    beginWaveBanner(w, banners);
  }
}

/**
 * Has the sector just finished? Consumes the flag, so the caller fires the
 * inter-sector beat exactly once.
 *
 * Two endings, because only one of the three surfaces has a built boss yet: a
 * surface WITH one ends when the boss dies, and a surface without one ends
 * when its authored waves have run through once -- which is the behaviour the
 * POC has always had. Both are "the sector is over"; the caller does not need
 * to know which.
 */
export function sectorComplete(w) {
  const d = w.director;
  if (d.bossCleared) {
    d.bossCleared = false;
    return true;
  }
  if (!hasBuiltBoss(w) && d.cycle !== d.lastReportedCycle) {
    d.lastReportedCycle = d.cycle;
    return true;
  }
  return false;
}

/** Is the currently running wave the designated hardest one? POC-8 measures
 *  lateral corrections per second "under the hardest available wave", so the
 *  instrumentation needs to know which samples count. */
export function isHardestWave(w) {
  return !!currentWave(w).hardest && w.phase === RunPhase.WAVE;
}

export function currentWaveName(w) {
  if (w.phase === RunPhase.BOSS_WARNING) return 'WARNING';
  if (w.phase === RunPhase.BOSS || w.phase === RunPhase.BOSS_DEATH) {
    return w.boss.name || 'BOSS';
  }
  return currentWave(w).name;
}
