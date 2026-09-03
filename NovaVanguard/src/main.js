// Nova Vanguard -- POC bootstrap.
//
// Scope is POC and only POC (§2, §10 milestones POC-1..POC-8). No boss, no
// chevrons, no vent, no ground targets, no scoring UI, no sector campaign, no
// results screen, no star objectives -- all of that is MVP and is deliberately
// absent, not stubbed.
//
// The POC's central job is the two-mode experiment (§0.1), so the two things
// this file guards hardest are:
//   * the content is IDENTICAL in both modes and deterministic across a swap;
//   * the swap itself lands in under a second, mid-session, no reload.

import { createRenderer } from './render/renderer.js';
import { createLoop } from './core/loop.js';
import { createWorld, resetWorld, GameState, RunPhase } from './core/state.js';
import { makeRng } from './core/rng.js';
import {
  resolveBootMode,
  modeId,
  cfg,
  setMode,
  toggleMode,
  onModeChange,
} from './core/mode.js';
import { initInput, sampleInput } from './input/input.js';
import { updatePlayer, updatePlayerBolts } from './player/player.js';
import { updateEnemies } from './enemies/enemies.js';
import { updateEmitters, updateEnemyBullets, activeAisle } from './patterns/patterns.js';
import { initSurface, updateSurface } from './surface/surface.js';
import {
  beginSurfaceTransition,
  updateTransition,
} from './surface/transition.js';
import { surfaceAt, SURFACES } from './data/surfaces.js';
import { BOSSES, bossIsBuilt } from './data/bosses.js';
import { createSectorTransitionUi } from './ui/sectorTransition.js';
import { createDevPanel } from './ui/devPanel.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { installDevUnlock } from './ui/devUnlock.js';
import {
  updateDirector,
  startScenario,
  currentWaveName,
  sectorComplete,
  forceBossWarning,
} from './systems/director.js';
import { resolveCollisions, assertRuntimeInvariants } from './systems/collision.js';
import {
  resetPickups,
  updatePickups,
  updateTelegraphs,
  devSpawnPickup,
} from './systems/pickups.js';
import { runValidator } from './systems/constraints.js';
import { submitRun, fetchBoard, resultSections } from './systems/scoreboard.js';
import {
  initAudio,
  suspendAudio,
  resumeAudio,
  toggleMuted,
  isMuted,
  isMusicOn,
  isSfxOn,
  setMusicOn,
  setSfxOn,
  refreshMix,
  audioStats,
  sfx,
} from './systems/audio.js';
import { createHud } from './ui/hud.js';
import { createInstrumentation } from './debug/instrumentation.js';
import { createPanel } from './debug/panel.js';
import { POC_SCENARIO, SECTOR_TRANSITION, PICKUPS, START_SCREEN } from './data/tuning.js';
import * as TUNING from './data/tuning.js';

const stage = document.getElementById('stage');
const mount = document.getElementById('app');

boot();

async function boot() {
  resolveBootMode();
  initInput();

  // NOT AWAITED, deliberately. Auto-start on load is an SDK requirement (see
  // the note at the bottom of this file), so nothing in boot may block on a
  // network fetch that might never complete -- and every sfx() call before the
  // buffers land is a silent no-op by design. The context itself stays locked
  // until the first gesture, which /systems/audio.js self-installs a listener
  // for; the game is fully playable in the meantime, silently.
  initAudio();

  const renderer = await createRenderer(mount);
  // Keep the DOM HUD glued to the same letterboxed box the canvas uses.
  renderer.onResize((box) => {
    stage.style.left = `${box.x}px`;
    stage.style.top = `${box.y}px`;
    stage.style.width = `${box.w}px`;
    stage.style.height = `${box.h}px`;
  });

  const world = createWorld();
  const rng = makeRng(POC_SCENARIO.seed);
  const hud = createHud(document);
  const muteButton = document.getElementById('mute-button');

  /** Repaint the speaker icon from what the player will actually hear. */
  function paintMute() {
    // The icon reports whether the player will actually hear anything: the app
    // muting us, the master mute, or both channels switched off all end in
    // silence, and an icon that only tracked one of them would contradict the
    // other two.
    // Master mute, or both channels off, both end in silence -- an icon that
    // tracked only one of them would contradict the other.
    const m = isMuted() || (!isMusicOn() && !isSfxOn());
    muteButton.textContent = m ? '\u{1F507}' : '\u{1F508}';
    muteButton.setAttribute('aria-label', m ? 'Sound settings (muted)' : 'Sound settings');
  }
  // --- quitting ------------------------------------------------------------
  //
  // The X is the ONLY way out of a game on the board, which cuts both ways: it
  // must always work, and it must not end a run on a single mis-tap. So it asks
  // first -- but only when there is a run to lose.
  //
  // `window.__gbBack` is the hook the button's inline onclick prefers, falling
  // back to a direct nav:back if this module never loaded. That fallback is
  // deliberate: a game that fails to boot must still be escapable.
  const leaveToLobby = () => {
    if (window.GoBalance && typeof window.GoBalance.back === 'function') {
      window.GoBalance.back();
      return;
    }
    if (window.Unity) window.Unity.call('nav:back');
  };

  /** Quit for real: bank the run, then show the board with no clock on it. */
  function endRunAndShowQuit() {
    hud.hideConfirm();
    // Already paused by the question; setPaused is idempotent and keeps the
    // audio suspend on the single path that owns it.
    setPaused(true);
    // The score counts even though the player stopped early -- Amit's call and
    // the right one: a run that ended by choice still happened, and a board
    // that only ever records deaths quietly punishes stopping.
    showEndBoard(false);
  }

  /**
   * The screen a run ends on when the player is choosing what happens next:
   * they quit, or they finished the campaign. Board, play again, leave, and no
   * clock on any of it. Shared because the two differ only in the headline --
   * everything the player does from here is the same.
   */
  function showEndBoard(cleared) {
    hud.showQuit(world, cleared);
    const runScore = world.stats.score;
    submitRun(runScore).then(() =>
      fetchBoard().then((board) => {
        const { top, window: near } = resultSections(board.rows, runScore);
        hud.showBoard('quit', board, near.length ? [top, near] : [top]);
      })
    );
  }

  // Whether the game was ALREADY paused when the question was asked, so that
  // answering "keep playing" restores what the player had rather than blindly
  // unpausing. Someone who paused, reached for the X, then changed their mind
  // should still be paused.
  let pausedBeforeConfirm = false;

  window.__gbBack = () => {
    // Ask only when a run is actually in progress. On the start screen, the quit
    // screen or the game-over screen the player is already stopped, and asking
    // "are you sure?" over a screen they chose to be on is just noise.
    if (hud.isQuitOpen()) return leaveToLobby();
    if (!started) return leaveToLobby();
    if (world.state !== GameState.RUNNING) return leaveToLobby();
    // Freeze the run while the question is up. The playfield stays visible
    // behind the modal, so leaving it running would mean the player watches
    // themselves die while deciding whether to quit.
    pausedBeforeConfirm = world.paused;
    setPaused(true);
    hud.showConfirm();
  };

  document.getElementById('confirm-stay').addEventListener('click', (e) => {
    e.stopPropagation();
    hud.hideConfirm();
    setPaused(pausedBeforeConfirm);
  });
  document.getElementById('confirm-quit').addEventListener('click', (e) => {
    e.stopPropagation();
    endRunAndShowQuit();
  });
  document.getElementById('quit-again').addEventListener('click', (e) => {
    e.stopPropagation();
    hud.hideQuit();
    setPaused(false);
    restartScenario();
  });
  document.getElementById('quit-leave').addEventListener('click', (e) => {
    e.stopPropagation();
    leaveToLobby();
  });

  // --- the sound menu (Music / Sound effects) ------------------------------
  const soundMenu = document.getElementById('sound-menu');
  const rowMusic = document.getElementById('sound-music');
  const rowSfx = document.getElementById('sound-sfx');

  function paintSoundMenu() {
    const rows = [
      [rowMusic, isMusicOn()],
      [rowSfx, isSfxOn()],
    ];
    for (const [row, on] of rows) {
      if (!row) continue;
      row.querySelector('.sound-state').textContent = on ? 'On' : 'Off';
      row.classList.toggle('on', on);
      row.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function setSoundMenuOpen(open) {
    if (!soundMenu) return;
    soundMenu.classList.toggle('hidden', !open);
    if (open) paintSoundMenu();
  }

  if (rowMusic) {
    rowMusic.addEventListener('click', (e) => {
      e.stopPropagation();
      setMusicOn(!isMusicOn());
      paintSoundMenu();
      paintMute();
    });
  }
  if (rowSfx) {
    rowSfx.addEventListener('click', (e) => {
      e.stopPropagation();
      setSfxOn(!isSfxOn());
      paintSoundMenu();
      paintMute();
    });
  }
  // Anywhere else closes it, so it can never be left covering the playfield.
  document.addEventListener('click', () => setSoundMenuOpen(false));

  paintMute();
  const sectorUi = createSectorTransitionUi(document);
  const instr = createInstrumentation();

  // POC-6: the constraints validator, wired BEFORE authoring a second wave,
  // not after (§10). It checks both framing modes over all authored data.
  //
  // The boss hull's measured aspect is handed in so §6.4's "lowest extent
  // y = 0.58" is checked against the art that actually loaded, rather than
  // against a number someone wrote down next to it.
  // EVERY built boss's real aspect, not just the first one's.
  //
  // §6.4's "never enters the player band" is derived from (authored width /
  // hull aspect), so it is a claim about the ART. With two built bosses of
  // visibly different proportions, handing the validator only surface zero's
  // would leave boss two's extent unchecked -- and the failure mode is a hull
  // that reaches into the player band, which on a machine where the player
  // cannot dodge upward is unrecoverable rather than merely wrong.
  const bossAspects = {};
  for (const s of SURFACES) {
    if (bossIsBuilt(s.boss)) bossAspects[s.boss] = renderer.bossHullAspect(s.boss);
  }
  const report = runValidator({
    onReport: (res) => hud.showConstraintReport(res),
    bossAspect: renderer.bossHullAspect(surfaceAt(0).boss),
    bossAspects,
  });

  const panel = createPanel(document, instr, {});
  const loop = createLoop((dt) => update(dt));

  // Rate-limit runtime invariant assertions -- they are cheap, but not free,
  // and once per ~0.5s is plenty to catch a cap breach.
  let assertT = 0;
  const seenViolations = new Set();
  const reportViolation = (m) => {
    if (seenViolations.has(m)) return;
    seenViolations.add(m);
    console.error(`[NovaVanguard/runtime] ${m}`);
    if (window.Unity) window.Unity.call(`RUNTIME INVARIANT: ${m}`);
  };

  let lastEnemyCount = 0;
  let lastBulletCount = 0;

  // ---------------------------------------------------------------------
  // Scenario control
  // ---------------------------------------------------------------------

  /**
   * (Re)start the scenario. Used on boot, on restart, and on a mode swap.
   *
   * §5.2 requires the mode toggle to restart the current scenario in the other
   * mode "within 1 s and preserving nothing". Nothing here loads, decodes or
   * allocates: textures are already resident and shared between the modes by
   * design, the entity pools are reused in place, and the RNG is reseeded to
   * the same value -- so the swap is a few hundred microseconds of state
   * clearing, and both modes replay the identical squadron script.
   */
  function restartScenario() {
    // Stop the result clock, or a manual restart would be followed by an
    // automatic one a few seconds later.
    resultT = -1;
    hud.setResultCountdown(0);
    hud.hideVictory();
    hud.hideQuit();
    resetWorld(world);
    renderer.clearFx();
    hud.hideGameOver();
    hud.hideBoss();
    hud.banners.clear();
    // The boss's on-screen extent is derived from the real proportions of its
    // hull art, and §6.4's "never enters the player band" guarantee depends on
    // that number rather than on an authored one. resetWorld() puts it back to
    // the default, so it is republished from /render on every (re)start.
    world.bossAspect = renderer.bossHullAspect(surfaceAt(world.surfaceIndex).boss);
    // resetWorld puts surfaceIndex back to 0, so a restart always starts on the
    // POC surface -- and the renderer has to be told, or a restart taken while
    // standing on Kesselring would leave the wrong texture under the action.
    sectorUi.hide();
    renderer.setSurface(surfaceAt(world.surfaceIndex));
    rng.reseed(POC_SCENARIO.seed);
    // Pickups roll on their OWN stream (see /systems/pickups.js) so that adding
    // drops cannot shift a single draw of the scenario's stream -- which is
    // what keeps level one's locked squadron script byte-identical.
    resetPickups(world, POC_SCENARIO.seed);
    initSurface(world, rng);
    startScenario(world, rng, hud.banners);
    instr.runStart(world);
    loop.reset();
    world.state = GameState.RUNNING;
  }

  // ---------------------------------------------------------------------
  // The screen-covered surface transition (§5.4, POC-8 decision note §3)
  //
  // This is a DEMO SLICE, not MVP item 9. There is no sector/wave director, no
  // wave banner system beyond the POC's, no boss, no star objectives and no
  // campaign behind it -- the surface changes and the POC's own three-wave loop
  // starts over. What it is for is seeing the change of place and judging it.
  // ---------------------------------------------------------------------

  /** Fire the beat. Cycles through /data/surfaces.js, so triggering it
   *  repeatedly walks Ashfall -> Kesselring -> Bulwark -> Hive -> Ashfall and
   *  can be watched over and over without a reload. */
  function nextSurface() {
    if (world.state !== GameState.RUNNING) return;
    const to = (world.surfaceIndex + 1) % SURFACES.length;
    if (!beginSurfaceTransition(world, to)) return;
    sectorUi.begin(surfaceAt(to));
  }

  /** The exchange itself, run once, at the instant the cover is opaque. */
  function swapSurface(surface) {
    renderer.setSurface(surface);
    renderer.clearFx();
    // Clear the playfield rather than carrying it across: a squadron that
    // survived the old sector would arrive already in formation over the new
    // one, with no entry telegraph (§5.3) and no reading time.
    for (const e of world.enemies) e.alive = false;
    for (const b of world.enemyBullets) b.alive = false;
    for (const b of world.playerBolts) b.alive = false;
    // Canisters and pending re-offers go with the playfield: one left drifting
    // would arrive over the new surface with no kill behind it, and a re-offer
    // clock would fire a telegraph for a drop the player never saw.
    // The RUNNING WEAPON is deliberately NOT cleared -- the transition is a
    // continuation, not a restart (the player keeps shield and position too),
    // and taking a timed pickup away at a screen wipe would read as a bug.
    for (const q of world.pickups) q.alive = false;
    for (const t of world.telegraphs) t.alive = false;
    // Re-scatter the props and reset the scroll under the cover. The player's
    // shield and position are deliberately NOT reset -- this is a continuation,
    // not a restart, which is the whole point of the decision note's "the
    // default action becomes CONTINUE".
    initSurface(world, rng);
    // Each surface carries its own boss (/data/surfaces.js), so the hull
    // aspect is re-read on the swap for the same reason it is read on restart.
    world.bossAspect = renderer.bossHullAspect(surface.boss);
    hud.hideBoss();
    // Clear BEFORE restarting the loop: startScenario queues the next wave
    // banner, and clearing after would swallow it.
    hud.banners.clear();
    startScenario(world, rng, hud.banners);
    world.sectorsCrossed++;
  }

  function updateSectorTransition(dt) {
    updateTransition(world, dt, swapSurface);
  }

  function swapMode(next) {
    const changed = next ? setMode(next) : toggleMode();
    if (!changed) return;
    // Announce it, so an operator alternating modes on the board always knows
    // which one produced the run they just played (§5.2: every sample is
    // tagged with its mode).
    restartScenario();
    hud.banners.push(cfg().label, 1.4, true);
  }

  function forceBoss() {
    if (forceBossWarning(world, hud.banners)) return;
    hud.banners.push('NO BUILT BOSS ON THIS SURFACE', 1.2);
  }

  /** Jump straight to a level by index (ui/devPanel.js).
   *
   *  Goes through the SAME transition beat as nextSurface() rather than
   *  assigning surfaceIndex directly -- the swap clears the playfield, the
   *  pickups and the pending re-offers, and skipping that would drop the
   *  player into a new surface with the old sector's squadron already locked
   *  in formation over it. Jumping to the level you are already on is a no-op
   *  rather than a redundant 2.35s shutter. */
  function jumpToLevel(index) {
    if (world.state !== GameState.RUNNING) return;
    const to = ((index % SURFACES.length) + SURFACES.length) % SURFACES.length;
    if (to === world.surfaceIndex) return;
    if (!beginSurfaceTransition(world, to)) return;
    sectorUi.begin(surfaceAt(to));
  }

  onModeChange((id) => {
    hud.setMode(id);
    panel.setMode(id);
  });
  hud.setMode(modeId());
  panel.setMode(modeId());
  hud.onModeClick((id) => swapMode(id));
  hud.onRestart(() => restartScenario());

  // ---------------------------------------------------------------------
  // Debug keys (§5.2's `M`, plus the dev guides POC-1 and §5.4 call for)
  // ---------------------------------------------------------------------
  /**
   * The one place `paused` is written, so the audio context can be suspended
   * with it. A BufferSourceNode has no pause of its own, so freezing the music
   * bed means freezing the context -- and a paused game that keeps playing its
   * music is the kind of thing that only gets noticed on a device.
   */
  function setPaused(next) {
    world.paused = next;
    if (world.paused) suspendAudio();
    else resumeAudio();
  }

  function toggleMute() {
    toggleMuted();
    paintMute();
    // Unmuting resumes the context (a tap on the speaker IS the gesture the
    // autoplay policy wants), which would otherwise start the music bed playing
    // over a paused game. Pause wins.
    if (world.paused) suspendAudio();
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyM':
        swapMode();
        break;
      case 'KeyP':
        setPaused(!world.paused);
        break;
      // Mute, on a key as well as on the button -- the button is for a device,
      // the key is for whoever is tuning the mix with the console open.
      case 'KeyU':
        toggleMute();
        break;
      case 'KeyB':
        world.debug.bands = !world.debug.bands;
        break;
      case 'KeyH':
        world.debug.hitboxes = !world.debug.hitboxes;
        break;
      case 'KeyL':
        world.debug.aisle = !world.debug.aisle;
        break;
      // §5.4's required dev-mode toggle: flash the surface layer black so
      // bullets and pickups can be checked in isolation.
      case 'KeyK':
        world.debug.blackSurface = !world.debug.blackSurface;
        break;
      case 'KeyI':
        panel.toggle();
        break;
      // The surface transition, in the same spirit as `M`: fire it on demand,
      // mid-session, so the change of place can be watched repeatedly instead
      // of waited for.
      case 'KeyN':
        nextSurface();
        break;
      case 'KeyR':
        restartScenario();
        break;
      // Jump straight to the boss beat, in the same spirit as `M` and `N`.
      //
      // WHY THIS EXISTS: reaching the boss legitimately means clearing all six
      // authored waves, which is minutes of play. Amit had to do that to find the
      // fight, and anyone verifying a change to it had to do it again -- so the
      // fight got tested least in the build where it was most broken. A one-key
      // path to it is the cheapest possible defence against that recurring.
      case 'KeyG':
        forceBoss();
        break;
      case 'KeyC':
        panel.dump();
        break;
      case 'KeyX':
        instr.reset();
        break;
      default:
        break;
    }
  });

  document.getElementById('pause-button').addEventListener('click', () => {
    setPaused(!world.paused);
  });

  // THE SPEAKER OPENS THE MENU rather than toggling master mute. Two switches
  // that the player can see beat one switch whose meaning they have to infer,
  // and "turn the music off but keep the hits" is the request a single toggle
  // cannot answer.
  muteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    setSoundMenuOpen(soundMenu.classList.contains('hidden'));
  });

  // Dev panel (ui/devPanel.js) -- level jump, skip-to-boss, invincibility.
  // Mounted from JS rather than authored into index.html so the whole tool
  // lives in one file and can be dropped by deleting the import.
  const devPanel = createDevPanel(document, {
    jumpToLevel,
    skipToBoss: forceBoss,
    restart: restartScenario,
    // Dev-only weapon spawner. The list comes from PICKUPS.kinds rather than
    // being written out here, so a fifth weapon appears in the panel the moment
    // it is authored -- the same table-driven discipline the surfaces use.
    spawnPickup: (kind) => devSpawnPickup(world, kind),
    weaponKinds: Object.keys(PICKUPS.kinds),
    // Which of those are non-weapon canisters, so the panel can group them.
    // Derived from the table rather than hardcoded, for the same reason the
    // list itself is.
    effectKinds: Object.keys(PICKUPS.kinds).filter((k) => !!PICKUPS.kinds[k].effect),
    world,
    surfaces: SURFACES,
  });
  // THE PLAYER'S PANEL, always available: a gear, with the settings a player is
  // meant to change. Separate from the wrench for a reason -- mixing them puts
  // a player one tap from invincibility, and a developer behind a secret when
  // they want sensitivity.
  const settings = createSettingsPanel(document);
  document.body.appendChild(settings.button);
  document.body.appendChild(settings.panel);

  // THE DEV PANEL IS NOT MOUNTED UNTIL IT IS UNLOCKED.
  //
  // Hold the shield gauge for seven seconds, then enter the code. The gesture
  // is what makes it undiscoverable; the code is what makes it deliberate. See
  // ui/devUnlock.js for why this is a gesture rather than a build flag -- in
  // short, the production build is exactly the one worth debugging, so a flag
  // can only ever be wrong in one direction.
  let devMounted = false;
  const mountDev = () => {
    if (devMounted) return;
    devMounted = true;
    document.body.appendChild(devPanel.button);
    document.body.appendChild(devPanel.panel);
    devPanel.toggle();
  };
  installDevUnlock(document, document.getElementById('shield-wrap'), mountDev);
  // `?dev=1` skips the gesture, for a desktop session where the hold is just
  // seven seconds of nothing.
  if (/[?&]dev=1\b/.test(window.location.search || '')) mountDev();

  // The SDK forwards Space/Enter, and synthetically clicks #restart-button
  // while the game-over overlay is visible. Space/Enter also restarts here so
  // the two paths agree.
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'Enter') && world.state === GameState.FAILED) {
      restartScenario();
    }
  });

  // ---------------------------------------------------------------------
  // Simulation -- one fixed 60 Hz step (§9.1)
  // ---------------------------------------------------------------------

  let lastInput = { carve: 0, nudge: 0, source: 'keyboard' };

  function update(dt) {
    // Runs before the RUNNING gate below, because during the countdown the
    // state is deliberately not RUNNING.
    if (!started) {
      tickCountdown(dt);
      return;
    }
    // The result screen counts itself down to a restart. Runs before the
    // RUNNING gate because the state is FAILED while it is up.
    if (resultT >= 0) {
      resultT -= dt;
      const secs = Math.max(0, Math.ceil(resultT));
      if (secs !== resultShown) {
        resultShown = secs;
        hud.setResultCountdown(secs);
      }
      if (resultT <= 0) {
        resultT = -1;
        restartScenario();
      }
    }
    // Pause freezes the whole simulation WITHOUT touching the state machine's
    // current value, so resuming drops back into exactly what was paused
    // (§9.2, and the repo-wide convention in BUILD_NOTES.md).
    if (world.paused) return;
    if (world.state !== GameState.RUNNING) return;

    // The run clock advances through the covering beat -- the beat is real
    // elapsed time in the run, not a stopped world -- but nothing else does.
    world.time += dt;

    // The covering beat freezes the rest of the simulation while it runs. Not a
    // pause -- `paused` above is untouched and still means what it meant. The
    // reason is fairness: the playfield is hidden, so nothing may hit the
    // player behind the cover, and on a board they could not react anyway.
    if (world.transition.active) {
      updateSectorTransition(dt);
      return;
    }

    const input = sampleInput(dt);
    lastInput = input;

    // Systems tick over the world in a FIXED ORDER, once per frame (§9.2).
    updateSurface(world, rng, dt);
    updatePlayer(world, input, dt, renderer.fx);
    updatePlayerBolts(world, dt);
    updateDirector(world, rng, dt, hud.banners, renderer.fx);

    // Advance to the next surface when the sector ends. On a surface whose
    // boss is built that means the boss is dead -- level one now has a real
    // ending rather than looping -- and on one whose boss is not yet built it
    // still means the authored waves have run through once, which is the
    // behaviour the POC has always had. /systems/director.js owns which.
    // "Every sector, not every second sector" (decision note §4).
    if (SECTOR_TRANSITION.autoOnWaveCycle && sectorComplete(world)) {
      // THE LAST SECTOR ENDS THE CAMPAIGN INSTEAD OF WRAPPING. Until now
      // `nextSurface()` took the index modulo SURFACES.length, so beating the
      // final boss quietly returned the player to level one with nothing scaled
      // and nothing said. Amit: level five is the end of the campaign, and
      // finishing it should be a screen.
      if (world.surfaceIndex >= SURFACES.length - 1) {
        completeCampaign();
        return;
      }
      nextSurface();
      if (world.transition.active) return;
    }

    updateEnemies(world, rng, dt);
    updateEmitters(world, dt);
    updateEnemyBullets(world, dt);
    // AFTER the director and the enemies, BEFORE collisions: a canister that
    // drops this frame is placed relative to where the player is now, and the
    // collect test then runs in the same frame's collision pass.
    updatePickups(world, dt);
    updateTelegraphs(world, dt);
    resolveCollisions(world, renderer.fx, instr);

    if (world.fx.shakeT > 0) world.fx.shakeT = Math.max(0, world.fx.shakeT - dt);
    if (world.fx.flashT > 0) world.fx.flashT = Math.max(0, world.fx.flashT - dt);

    instr.sample(world, input, dt);

    assertT += dt;
    if (assertT >= 0.5) {
      assertT = 0;
      const counts = assertRuntimeInvariants(world, reportViolation);
      lastEnemyCount = counts.enemies;
      lastBulletCount = counts.bullets;
    }

    // Zero segments = failed. No revive, no continue, no cost to retry (§5.10).
    if (!world.player.alive && world.state === GameState.RUNNING) {
      world.state = GameState.FAILED;
      showResult();
    }
  }

  /**
   * Beating the final boss. A beat of its own before the board: the run is over
   * and the score is already made, but handing straight to a leaderboard would
   * make finishing the campaign feel exactly like dying.
   *
   * The simulation stops here the same way it stops on death -- CLEARED is not
   * RUNNING, so `update()` returns before touching the world -- which is what
   * makes it safe to leave the playfield on screen behind the card.
   */
  function completeCampaign() {
    if (world.state !== GameState.RUNNING) return;
    world.state = GameState.CLEARED;
    hud.showVictory(world);
  }

  /** Leave the victory beat for the ending board. Guarded on the state rather
   *  than on a flag: CLEARED means precisely "the victory screen is up", so a
   *  second press cannot submit the run twice. */
  function continueFromVictory() {
    if (world.state !== GameState.CLEARED) return;
    hud.hideVictory();
    // The state stays CLEARED: the simulation must remain stopped, the X must
    // still leave without asking, and Space must NOT restart -- on this screen
    // "play again" is a button the player chooses, not a key that fires under
    // their hands. PLAY AGAIN calls restartScenario(), which sets RUNNING.
    showEndBoard(true);
  }

  /** The screen a run ends on when the player DIED: the board, and a clock that
   *  restarts the game so an abandoned machine never parks on a dead screen.
   *  Finishing the campaign goes to showEndBoard() instead -- see there. */
  function showResult() {
    hud.showGameOver(world);
    // THE ACCOUNT SCOREBOARD (systems/scoreboard.js). Fire-and-forget: the
    // overlay is already up, and the board fills in underneath it when the
    // round-trip returns. Deliberately not awaited -- a slow or offline
    // Firestore read must never delay the player seeing that they died, and
    // both calls resolve rather than reject, so there is nothing to catch.
    //
    // Submitted BEFORE fetching so the run just finished is in the board the
    // player is about to read -- otherwise their own score is conspicuously
    // missing from the one screen where they are looking for it.
    resultT = START_SCREEN.resultSeconds;
    resultShown = -1;
    hud.setResultCountdown(START_SCREEN.resultSeconds);
    const runScore = world.stats.score;
    submitRun(runScore).then(() =>
      fetchBoard().then((board) => {
        const { top, window: near } = resultSections(board.rows, runScore);
        hud.showBoard('result', board, near.length ? [top, near] : [top]);
      })
    );
  }

  // ---------------------------------------------------------------------
  // Frame callback -- the ONLY requestAnimationFrame consumer in the game,
  // via Pixi's ticker, which goes through the SDK's rAF shim.
  // ---------------------------------------------------------------------
  renderer.app.ticker.add((ticker) => {
    const dt = Math.max(0, ticker.deltaMS / 1000);
    loop.step(dt);
    hud.update(world, dt);
    sectorUi.update(world);
    panel.update(world, dt, {
      surface: surfaceAt(world.surfaceIndex).name,
      waveName: world.phase === RunPhase.WAVE ? currentWaveName(world) : 'BANNER',
      bullets: lastBulletCount,
      enemies: lastEnemyCount,
      aisle: activeAisle(world),
      inputSource: lastInput.source,
    });
    renderer.draw(world);
  });

  // Auto-start on load. No key press, no click, no gating overlay -- the SDK
  // contract requires the first playable state to be reachable on load, and on
  // a device there is no guaranteed click to wait for.
  //
  // No mode banner on boot any more: Mode S is the decided mode, so announcing
  // it every time is noise. `M` still announces a swap, because that is a
  // change the operator needs told about.
  // --- the start screen -----------------------------------------------------
  //
  // The run does not begin until the countdown ends. update() already returns
  // unless the state is RUNNING, so holding the state at BOOT is the whole gate
  // -- no new branch in the simulation, and nothing can spawn, fire or move
  // behind the screen.
  //
  // AUTO-ADVANCING, WITH NO KEY PRESS. GOBALANCE_SDK.md requires the first
  // playable state to be reached on load; a countdown that runs itself down
  // satisfies that where a "press to start" gate would not. Any input skips it,
  // because a player who is ready should not be made to wait.
  let countdownT = START_SCREEN.seconds;
  let countdownShown = -1;
  let started = false;
  // The result screen's own clock. -1 means "not counting", which is the state
  // during a run and after a manual restart.
  let resultT = -1;
  let resultShown = -1;

  function beginRun() {
    if (started) return;
    started = true;
    hud.hideStart();
    restartScenario();
  }

  function tickCountdown(dt) {
    if (started) return;
    countdownT -= dt;
    const secs = Math.max(0, Math.ceil(countdownT));
    if (secs !== countdownShown) {
      countdownShown = secs;
      hud.setCountdown(secs);
    }
    if (countdownT <= 0) beginRun();
  }

  // Prime the board before the player has played anything: on the start screen
  // it is the standing board, so it is fetched rather than submitted to.
  hud.showStart();
  hud.setCountdown(START_SCREEN.seconds);
  // The start screen has no run to place, so it is simply the leaders. Ten
  // rows is what the card holds without scrolling at the sizes the board is
  // read from -- standing up, at arm's length.
  fetchBoard().then((board) =>
    hud.showBoard('start', board, [board.rows.slice(0, 10)])
  );

  // Any deliberate input skips the wait. Pointer and key only -- NOT the board
  // sensor, which is never zero and would skip the screen instantly.
  const skip = () => beginRun();
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });

  // Skipping the RESULT screen is a separate, permanent listener: the start
  // skip above is {once:true} and is spent on the first run, and the result
  // screen comes back after every run thereafter.
  //
  // Deliberately does NOT fire while a run is in progress -- it only acts while
  // the result clock is actually counting, so a stray tap mid-run cannot
  // restart the game.
  const skipResult = () => {
    if (resultT < 0) return;
    // THE TAP THAT LEAVES THE VICTORY BEAT MUST NOT ALSO SKIP THE BOARD. One
    // press can reach both listeners, and the board is what the player pressed
    // TOWARD -- skipping it would restart the game instead of showing the run
    // they just finished. A guard on age rather than on listener order, because
    // ordering is invisible at the call site and this is not.
    if (resultT > START_SCREEN.resultSeconds - 0.3) return;
    resultT = -1;
    restartScenario();
  };
  window.addEventListener('pointerdown', skipResult);

  // CONTINUE IS THE ONLY WAY OFF THE VICTORY SCREEN -- Amit's call. No clock and
  // no tap-anywhere: this is the one screen the player has earned, and a stray
  // touch while they are reading it should not take it away.
  const victoryButton = document.getElementById('victory-continue');
  if (victoryButton) {
    victoryButton.addEventListener('click', (e) => {
      e.stopPropagation();
      continueFromVictory();
    });
  }

  // The scenario is armed but NOT started, so the surface and HUD draw behind
  // the screen while the state stays out of RUNNING.
  restartScenario();
  world.state = GameState.BOOT;

  // Surface the boot report and the scenario controls where an operator (or a
  // scripted run -- §5.2 explicitly wants the mode settable for those) can
  // reach them.
  //
  // `stepSim` advances the simulation by a wall-clock delta WITHOUT waiting for
  // real frames. It exists because the fixed-timestep loop is the thing worth
  // testing headlessly, and a headless browser throttles requestAnimationFrame
  // hard enough that a real-time soak proves nothing. Rendering is skipped, so
  // this is a pure simulation pump.
  window.__nv = {
    world,
    instr,
    renderer,
    report,
    swapMode,
    restartScenario,
    nextSurface,
    forceBoss,
    surfaces: SURFACES,
    // The boss table, live. Same reasoning as `tuning` below -- and one specific
    // reason: /data/bosses.js now carries two SHAPES of row (hull boss vs pod
    // boss, see bossIsHullBoss), and only the hull shape is authored today. An
    // operator can flip cinderjaw to a pod row here and exercise the pod path in
    // the running game, which is the only way to keep the half of the framework
    // that bosses two and three depend on from rotting untested.
    bosses: BOSSES,
    // The whole tuning namespace, live. §9.3 put every constant in one file
    // specifically so that §10's on-device tuning pass is "a config session
    // rather than a code hunt" -- exposing it here is what makes that literally
    // true: an operator on a board can retune a number in the console and feel
    // the result on the next frame, with no rebuild and no reload.
    tuning: TUNING,
    // The audio layer, live, for the same reason the tuning namespace is: the
    // mix is retuned by ear on a device, and `__nv.tuning.AUDIO.clips.fire.gain
    // = 0.1; __nv.audio.refreshMix()` is that whole loop with no rebuild. `sfx`
    // is here so a single clip can be auditioned in isolation, which is the
    // only honest way to judge one against the fire layer it sits over.
    audio: { sfx, refreshMix, audioStats, toggleMuted, isMuted },
    stepSim(seconds) {
      const end = world.time + seconds;
      let guard = 0;
      while (world.time < end && guard++ < 200000) update(1 / 60);
      return world.time;
    },
  };
}
