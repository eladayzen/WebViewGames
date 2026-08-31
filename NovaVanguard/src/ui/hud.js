// The HUD (§7.1) -- a DOM/CSS overlay on top of the game canvas, not drawn
// into the render layer. Keeps text crisp and updates cheap.
//
// POC subset (§2: "No boss, chevrons, vent, ground targets, scoring UI, sector
// campaign, results screen, star objectives"):
//   * the 6-segment shield gauge, left margin, cyan, shield glyph at its foot
//     -- the whole fail model, and the only required in-run readout;
//   * the single-slot banner queue in the gutter;
//   * the framing-mode switch (§5.2's POC requirement);
//   * the game-over overlay, on the SDK's DOM contract.
//
// Everything lives in the MARGINS. The centre stays clear (§5.1), and the
// HUD-exclusion rule is why: the report caught a reference frame with a
// formation physically overlapping the score readout, and in a shallow frame
// that is much worse.

import { avatarFor } from '../data/avatars.js';
import {
  PLAYER,
  BANNERS,
  BOSS,
  DESIGN_W,
  DESIGN_H,
  weaponDef,
} from '../data/tuning.js';
import { RunPhase } from '../core/state.js';
import {
  bossHullHpFraction,
  bossPodHpFraction,
  bossCoreHpFraction,
  bossHalfH,
} from '../enemies/boss.js';

export function createHud(root) {
  const el = {
    shield: root.querySelector('#shield-gauge'),
    shieldSegs: [],
    banner: root.querySelector('#banner'),
    bannerText: root.querySelector('#banner-text'),
    // The on-screen framing switch was removed once Mode S was decided
    // (playtest round 3). These stay as null-tolerant lookups rather than
    // being deleted: `M` and ?mode= still swap modes, so the HUD is still told
    // about it, and Mode A's code path is explicitly retained by the decision
    // note. If the switch is ever put back, nothing here has to change.
    modeS: root.querySelector('#mode-s'),
    modeA: root.querySelector('#mode-a'),
    gameover: root.querySelector('#gameover-overlay'),
    gameoverStats: root.querySelector('#gameover-stats'),
    scoreboard: root.querySelector('#scoreboard'),
    startOverlay: root.querySelector('#start-overlay'),
    startCountdown: root.querySelector('#start-countdown'),
    gameoverCountdown: root.querySelector('#gameover-countdown'),
    startScoreboard: root.querySelector('#start-scoreboard'),
    startScoreboardTitle: root.querySelector('#start-scoreboard-title'),
    startScoreboardRows: root.querySelector('#start-scoreboard-rows'),
    scoreboardTitle: root.querySelector('#scoreboard-title'),
    scoreboardRows: root.querySelector('#scoreboard-rows'),
    restart: root.querySelector('#restart-button'),
    warn: root.querySelector('#constraint-warning'),
    bossBar: root.querySelector('#boss-bar'),
    bossName: root.querySelector('#boss-bar-name'),
    bossFill: root.querySelector('#boss-bar-fill'),
    bossPips: root.querySelector('#boss-pips'),
    bossWarning: root.querySelector('#boss-warning'),
    // The hull boss's own bar, which rides above the hull rather than sitting
    // at the top edge. See index.html for why there are two readouts.
    hpWrap: root.querySelector('#boss-hp'),
    hpName: root.querySelector('#boss-hp-name'),
    hpFill: root.querySelector('#boss-hp-fill'),
    hpChip: root.querySelector('#boss-hp-chip'),
    hpValue: root.querySelector('#boss-hp-value'),
    // The temporary weapon's clock (§5.6).
    weapon: root.querySelector('#weapon-timer'),
    weaponName: root.querySelector('#weapon-name'),
    weaponFill: root.querySelector('#weapon-fill'),
  };

  // Build the 6 segments once. Cyan segmented gauge per concept-01.
  for (let i = 0; i < PLAYER.shieldSegments; i++) {
    const seg = document.createElement('div');
    seg.className = 'shield-seg';
    el.shield.appendChild(seg);
    el.shieldSegs.push(seg);
  }

  // --- single-slot banner queue (§7.1) ------------------------------------
  // "One banner at a time, minimum 0.8 s each, queue depth 3, oldest
  // non-critical dropped if the queue overflows. WARNING / BOSS always
  // preempts. Two banners can never collide -- this is a CODE INVARIANT, not
  // a timing coincidence."
  const queue = [];
  let showing = null;
  let showT = 0;

  const banners = {
    push(text, durationS, critical = false) {
      if (critical) {
        // Preempt: drop whatever is on screen and jump the queue.
        queue.length = 0;
        showing = { text, dur: durationS, critical };
        showT = 0;
        return;
      }
      if (queue.length >= BANNERS.queueDepth) {
        // Drop the oldest NON-critical entry rather than the newest, so the
        // most recent state of the world is what the player ends up reading.
        const i = queue.findIndex((b) => !b.critical);
        if (i >= 0) queue.splice(i, 1);
        else return;
      }
      queue.push({ text, dur: Math.max(BANNERS.minShowS, durationS), critical });
    },
    update(dt) {
      if (showing) {
        showT += dt;
        if (showT >= showing.dur) {
          showing = null;
          showT = 0;
        }
      }
      if (!showing && queue.length) {
        showing = queue.shift();
        showT = 0;
      }
      // Exactly one banner is ever in the DOM. The invariant is structural:
      // there is one element and one `showing` slot.
      if (showing) {
        el.banner.classList.remove('hidden');
        if (el.bannerText.textContent !== showing.text) {
          el.bannerText.textContent = showing.text;
        }
        const k = Math.min(1, showT / 0.18);
        const out = Math.max(0, Math.min(1, (showing.dur - showT) / 0.25));
        el.banner.style.opacity = String(k * out);
      } else {
        el.banner.classList.add('hidden');
      }
    },
    clear() {
      queue.length = 0;
      showing = null;
      showT = 0;
      el.banner.classList.add('hidden');
    },

    /**
     * Move the band out of the boss hull for as long as one is on screen.
     *
     * §7.1 puts banners at y = 0.42 and §6.4 hangs the boss into the upper
     * gutter; at the shipped hull aspect the hull covers 94..586, so 0.42 is
     * squarely on armour and every boss-fight banner was being printed on it.
     * The validator has been reporting the collision as an unresolved note
     * because both numbers are authored -- but an instruction that cannot be
     * read is not an instruction, so the band moves and the note now records the
     * resolution. See BANNER_Y_BOSS in /data/tuning.js for the clearances.
     */
    setBossPhase(active) {
      el.banner.classList.toggle('on-boss', !!active);
    },
  };

  let lastShield = -1;

  // --- boss readouts (§6.4, §7.1) ------------------------------------------
  //
  // ONE READOUT PER BOSS, CHOSEN BY THE ROW. A hull boss (boss one) gets
  // #boss-hp riding above its hull; a pod boss (two and three) gets the
  // top-edge bar with per-pod gauges. Never both, and never neither -- a fight
  // with no legible HP readout is the thing being fixed here.
  //
  // Per-pod elements are rebuilt only when the pod COUNT changes (i.e. per
  // fight), never per frame.
  let pipEls = [];
  let lastPodCount = -1;
  let lastBossId = '';
  let lastHpText = '';
  let lastStateText = '';

  /** The hull boss's bar (boss one). Position resolved from the hull's live
   *  geometry every frame, which is what makes it read as the boss's own. */
  function updateHullBar(w) {
    const b = w.boss;
    el.hpWrap.classList.remove('hidden');
    if (b.name !== el.hpName.textContent) el.hpName.textContent = b.name;

    // Anchored by its BOTTOM edge, so the bar's own height (which is in vmin and
    // therefore viewport-dependent) never has to be measured or guessed.
    const halfBody = bossHalfH(b) * BOSS.hullHitHalfHFrac;
    const barBottom = b.y - halfBody - BOSS.hpBar.gapAboveHull;
    const barW = BOSS.width * BOSS.hpBar.widthFrac;
    el.hpWrap.style.left = `${((b.x - barW * 0.5) / DESIGN_W) * 100}%`;
    el.hpWrap.style.width = `${(barW / DESIGN_W) * 100}%`;
    el.hpWrap.style.bottom = `${((DESIGN_H - barBottom) / DESIGN_H) * 100}%`;

    const frac = bossHullHpFraction(b);
    // Scale rather than width: a transform does not force layout, and this runs
    // every frame of a ~25 s fight.
    el.hpFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    // The chip extends past the fill by the damage taken in the last instant --
    // the only thing on the readout that a single 1-damage bolt visibly moves.
    const chipFrac = Math.min(
      1,
      frac + (b.maxHullHp > 0 ? b.chipHp / b.maxHullHp : 0)
    );
    el.hpChip.style.transform = `scaleX(${chipFrac.toFixed(4)})`;

    // The integer. This is the part that makes "lots of HP" legible per shot:
    // 240 -> 239 -> 238 is unambiguous where 0.42% of a bar is invisible.
    const txt = `${Math.ceil(b.hullHp)}/${b.maxHullHp}`;
    if (txt !== lastHpText) {
      lastHpText = txt;
      el.hpValue.textContent = txt;
    }
  }

  /** The pod boss's readout (bosses two and three). Per-pod gauges, each
   *  positioned over the pod it belongs to, plus a core gauge that is visibly
   *  sealed until the pods are gone.
   *
   *  WHY IT IS NOT ONE POOLED BAR ANY MORE: pooling four 6-HP pods and a 30-HP
   *  core into one fraction moved the bar 11% for a whole pod kill and 1.9% for
   *  a bolt, so the fight's only milestone was its least visible event. The
   *  gauges are placed at each pod's own x fraction so "which bar is which pod"
   *  needs no legend. */
  function updatePodBar(w) {
    const b = w.boss;
    el.bossBar.classList.remove('hidden');

    if (b.id !== lastBossId || b.pods.length !== lastPodCount) {
      lastBossId = b.id;
      lastPodCount = b.pods.length;
      el.bossPips.textContent = '';
      pipEls = b.pods.map((pod) => {
        const d = document.createElement('div');
        d.className = 'boss-pod-gauge';
        const f = document.createElement('div');
        f.className = 'boss-pod-fill';
        d.appendChild(f);
        // Positioned at the pod's own x, as a fraction of the frame -- the
        // whole point of the redesign, so it is computed from the same pod dx
        // the playfield uses rather than laid out by flexbox.
        const px = DESIGN_W * 0.5 + (pod.dx - 0.5) * BOSS.width;
        d.style.left = `${(px / DESIGN_W) * 100}%`;
        el.bossPips.appendChild(d);
        return { wrap: d, fill: f };
      });
    }

    const live = b.pods.reduce((n, p) => n + (p.alive ? 1 : 0), 0);
    const open = live === 0;
    // Named after what the boss actually has -- BAYS on the carrier, BATTERIES
    // on a gun platform. A readout that calls a launch bay a "pod" is a readout
    // the player has to translate before they can use it.
    const state =
      `${b.name} · ${b.podNoun}S ${live}/${b.pods.length} · ` +
      (open ? 'CORE EXPOSED' : b.windowOpen ? 'CORE OPEN — CLIMB' : 'CORE SEALED');
    if (state !== lastStateText) {
      lastStateText = state;
      el.bossName.textContent = state;
    }

    el.bossFill.style.transform = `scaleX(${bossCoreHpFraction(b).toFixed(4)})`;
    el.bossBar.classList.toggle('core-sealed', !open && !b.windowOpen);

    for (let i = 0; i < pipEls.length; i++) {
      const pod = b.pods[i];
      pipEls[i].wrap.classList.toggle('dead', !pod.alive);
      pipEls[i].wrap.classList.toggle('firing', pod.alive && pod.firing && pod.open);
      // A SHUT BAY IS MARKED HERE TOO (§6.4, BOSS.bay). The gauge is positioned
      // at the bay's own x, so a player who has looked up at the bar can map
      // "that one is closed" onto the frame without looking for it -- and a
      // gauge that stayed bright on an immune target would be the top-edge
      // version of the lit-but-invulnerable lie the playfield is careful not to
      // tell. Non-bay bosses are permanently `open`, so nothing changes for
      // them.
      pipEls[i].wrap.classList.toggle('shut', pod.alive && !pod.open);
      pipEls[i].fill.style.transform = `scaleX(${bossPodHpFraction(pod).toFixed(3)})`;
    }
  }

  /**
   * The temporary weapon's remaining time (§5.6: "for limited time").
   *
   * Present ONLY while a pickup weapon is running. §7.3 is explicit that the
   * HUD does not carry threat legibility and §5.1 keeps the margins spare, so a
   * permanently-visible slot that says "BOLT" for 95% of a level would be
   * chrome. It appears when there is something to say and leaves when there is
   * not.
   */
  let lastWeapon = '';
  function updateWeapon(w) {
    const p = w.player;
    if (p.weaponT <= 0 || p.weapon === 'standard') {
      el.weapon.classList.add('hidden');
      el.weapon.classList.remove('expiring');
      lastWeapon = '';
      return;
    }
    const def = weaponDef(p.weapon);
    el.weapon.classList.remove('hidden');
    if (lastWeapon !== def.id) {
      lastWeapon = def.id;
      el.weaponName.textContent = def.name;
    }
    const frac = Math.max(0, Math.min(1, p.weaponT / def.durationS));
    // scaleX, not width: this runs every frame for eleven seconds and a width
    // change would force layout on each one.
    el.weaponFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    el.weapon.classList.toggle('expiring', p.weaponT <= 2.0);
  }

  function updateBoss(w) {
    const b = w.boss;
    const warning = w.phase === RunPhase.BOSS_WARNING;
    el.bossWarning.classList.toggle('hidden', !warning);

    if (!b.active) {
      el.bossBar.classList.add('hidden');
      el.hpWrap.classList.add('hidden');
      return;
    }
    if (b.hullBoss) {
      el.bossBar.classList.add('hidden');
      updateHullBar(w);
    } else {
      el.hpWrap.classList.add('hidden');
      updatePodBar(w);
    }
  }

  return {
    banners,

    update(w, dt) {
      // Before the banner is drawn, not after: the class has to be right on the
      // same frame the text appears, or the first frame of every boss banner
      // flashes at 0.42 on the hull.
      banners.setBossPhase(w.boss.active);
      banners.update(dt);
      const s = w.player.shield;
      if (s !== lastShield) {
        lastShield = s;
        for (let i = 0; i < el.shieldSegs.length; i++) {
          el.shieldSegs[i].classList.toggle('off', i >= s);
          // The lowest two segments read hot, so "nearly out" is legible from
          // the centre of the screen without reading the gauge (§7.3).
          el.shieldSegs[i].classList.toggle('low', s <= 2 && i < s);
        }
      }
      updateWeapon(w);
      updateBoss(w);
    },

    /** Hide every boss readout. Used on restart and on a mode swap, where the
     *  world is replaced wholesale and a stale bar would otherwise survive one
     *  frame into the new run. */
    hideBoss() {
      el.bossBar.classList.add('hidden');
      el.hpWrap.classList.add('hidden');
      el.bossWarning.classList.add('hidden');
      el.banner.classList.remove('on-boss');
      lastBossId = '';
      lastPodCount = -1;
      lastHpText = '';
      lastStateText = '';
    },

    setMode(id) {
      if (el.modeS) el.modeS.classList.toggle('on', id === 'S');
      if (el.modeA) el.modeA.classList.toggle('on', id === 'A');
    },

    onModeClick(fn) {
      if (el.modeS) el.modeS.addEventListener('click', () => fn('S'));
      if (el.modeA) el.modeA.addEventListener('click', () => fn('A'));
    },

    /** The SDK's overlay DOM contract (§7.4, GOBALANCE_SDK.md): the Unity host
     *  synthetically clicks #restart-button while #gameover-overlay is
     *  visible, and checks for the exact `hidden` class name to decide
     *  whether it is. Do not rename either, and do not invent a different
     *  structure for it. */
    showGameOver(w) {
      el.gameoverStats.textContent =
        `${w.stats.kills} destroyed · ${w.stats.preLockKills} pre-lock · ` +
        `wave ${w.director.waveIndex + 1} · score ${w.stats.score.toLocaleString()}`;
      el.gameover.classList.remove('hidden');
    },

    /**
     * Paint the account scoreboard, or leave it hidden.
     *
     * HIDDEN IS A REAL OUTCOME, not a failure path. Outside the Unity app there
     * is no SDK, and a profile that has never played has no rows -- in both
     * cases an empty framed panel would look broken, so the section simply does
     * not exist. The game-over card reads exactly as it did before.
     *
     * `complete: false` means only this device could be read (offline, or
     * nobody signed in). The title says so, because presenting one device as
     * the whole family is a claim the player has no way to check.
     */
    /**
     * Paint a board screen.
     *
     * `groups` is a list of row-runs, drawn in order with a visible break
     * between them -- the result screen passes [leaders, windowAroundYourRun],
     * the start screen passes one group. The break matters: without it, rows
     * #5 and #34 sitting flush look like consecutive places.
     *
     * HIDDEN IS A REAL OUTCOME. Outside the app there is no SDK, and a profile
     * that has never played has no rows; an empty framed panel would look
     * broken, so the section simply does not exist.
     */
    showBoard(where, board, groups) {
      const startScreen = where === 'start';
      const box = startScreen ? el.startScoreboard : el.scoreboard;
      const title = startScreen ? el.startScoreboardTitle : el.scoreboardTitle;
      const list = startScreen ? el.startScoreboardRows : el.scoreboardRows;
      if (!box) return;

      const total = (groups || []).reduce((n, g) => n + g.length, 0);
      if (!board || !board.available || !total) {
        box.classList.add('hidden');
        return;
      }
      title.textContent = board.complete
        ? 'BEST ON THIS ACCOUNT'
        : 'BEST ON THIS DEVICE';
      list.textContent = '';

      groups.forEach((rows, gi) => {
        if (gi > 0 && rows.length) {
          const gap = document.createElement('li');
          gap.className = 'sb-gap';
          gap.textContent = '·  ·  ·';
          list.appendChild(gap);
        }
        rows.forEach((r) => {
          const li = document.createElement('li');
          // `isRun` marks the run just played; `isYou` marks any row of the
          // player's. Only the run gets the strong highlight -- on a board
          // where a player holds several rows, lighting all of them up would
          // stop answering "which one was this run".
          li.className =
            'sb-row' + (r.isRun ? ' sb-you' : r.isYou ? ' sb-mine' : '');

          const rank = document.createElement('span');
          rank.className = 'sb-rank';
          // The TRUE position, never the index within this group.
          rank.textContent = String(r.rank);

          const av = document.createElement('span');
          av.className = 'sb-avatar';
          const art = avatarFor(r.avatarType);
          if (art) {
            av.style.backgroundColor = art.color;
            const img = document.createElement('img');
            img.src = art.src;
            img.alt = '';
            av.appendChild(img);
          } else {
            // Unknown avatar type: the app can add one at any time and this
            // game's mirrored copy will not know it yet. Fall back to the
            // initial rather than a broken image.
            av.classList.add('sb-avatar-fallback');
            av.textContent = (r.name || '?').charAt(0).toUpperCase();
          }

          const name = document.createElement('span');
          name.className = 'sb-name';
          name.textContent = r.name || 'PLAYER';

          const score = document.createElement('span');
          score.className = 'sb-score';
          score.textContent = Number(r.score || 0).toLocaleString();

          li.appendChild(rank);
          li.appendChild(av);
          li.appendChild(name);
          li.appendChild(score);
          list.appendChild(li);
        });
      });
      box.classList.remove('hidden');
    },

    /** The pre-run screen. Same card and same board as the result screen. */
    showStart() {
      if (el.startOverlay) el.startOverlay.classList.remove('hidden');
    },
    hideStart() {
      if (el.startOverlay) el.startOverlay.classList.add('hidden');
    },
    /** Seconds remaining on the START screen, as a whole number. */
    setCountdown(secs) {
      if (!el.startCountdown) return;
      el.startCountdown.textContent = secs > 0 ? `Starting in ${secs}` : 'Go';
    },

    /** Seconds remaining on the RESULT screen before it restarts itself. */
    setResultCountdown(secs) {
      if (!el.gameoverCountdown) return;
      el.gameoverCountdown.textContent =
        secs > 0 ? `Restarting in ${secs}` : '';
    },

    hideGameOver() {
      el.gameover.classList.add('hidden');
      if (el.scoreboard) el.scoreboard.classList.add('hidden');
    },
    onRestart(fn) {
      el.restart.addEventListener('click', fn);
    },

    /** The validator fails LOUDLY (§9.4). On-device there is no console, so a
     *  violation has to be visible on the screen itself. */
    showConstraintReport(res) {
      if (!res.errors.length && !res.warnings.length) {
        el.warn.classList.add('hidden');
        return;
      }
      const bits = [];
      if (res.errors.length) bits.push(`${res.errors.length} CONSTRAINT VIOLATION(S)`);
      if (res.warnings.length) bits.push(`${res.warnings.length} warning(s)`);
      el.warn.textContent = `${bits.join(' · ')} — see console`;
      el.warn.classList.toggle('is-error', res.errors.length > 0);
      el.warn.classList.remove('hidden');
    },
  };
}
