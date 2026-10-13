// BLOOP SQUAD -- POC.
//
// What this build is for, and nothing else:
//
//   1. THE CAMERA. Fixed (the world is one screen), drift (the starfield
//      scrolls past, the frame stays nailed down) or lateral (the frame follows
//      the pod). Toggled live with C, judged standing on a board.
//   2. HOW CLOSE A MONSTER MAY PASS. Drift speed on [ and ], pass clearance on
//      - and =, and the run reports passes / near misses / contacts / the worst
//      reaction time any monster gave.
//
// Everything else is deliberately thin. The endings, the leaderboard and the
// audio come from the shell once these two answers exist.

import { createRenderer } from './render/renderer.js';
import { installGbSdk } from './systems/gbSdk.js';
import { analytics } from './systems/analytics.js';
import { createLoop } from './core/loop.js';
import { makeRng } from './core/rng.js';
import { createWorld, resetWorld, resizePods, GameState } from './core/state.js';
import { initInput, readInput, setPlayerCount, liveSeatCount } from './input/input.js';
import { updateMonsters, maybeSpawn, spawnMonster } from './systems/monsters.js';
import {
  updatePod, updateTether, updateBeamCharge, updateBullets, updateCollisions, updateCoinsAndPops,
  updateSquad, updateSquadBombs, updateBlasts, updateLevelPopup, updateHearts,
  celebrate, popMonster, award, xpForLevel,
} from './systems/play.js';
import { updateFiring, updateToyPickups, equip, updateChain } from './systems/toys.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { installDevUnlock } from './ui/devUnlock.js';
import { createDevPanel } from './ui/devPanel.js';
import { createEndings, fakeBoard } from './ui/endings.js';
import { refreshRoster, ensureRoster } from './systems/roster.js';
import {
  initAudio, startMusic, stopMusic, setAudioPaused, playGameOver, playLevelUp,
  getAudioPrefs, setSfxEnabled, setMusicEnabled, setMusicLevel,
} from './systems/audio.js';
import { CAMERA, DEV, MONSTERS, TOYS, SQUAD, DESIGN_W, DESIGN_H, difficulty01 } from './data/tuning.js';

const CAMERA_MODES = ['fixed', 'drift', 'lateral'];

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = await createRenderer(canvas);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());

  initInput();
  // Installs the one-time gesture unlock. The context itself is not built until
  // something plays, and nothing plays before a gesture -- so this is safe to
  // call at boot and is the only place that needs to know about it.
  initAudio();
  startMusic();
  const rng = makeRng(0x1005);

  // HOW MANY SEATS THIS RUN HAS, decided before anything reads it.
  //
  // Read HERE and not down with the other `?` hooks, which live 350 lines
  // below: createWorld needs it on the next line, and a `seats` declared after
  // its own use is the temporal-dead-zone ReferenceError this file has already
  // been bitten by twice (see the note by `const q`). Both times it killed the
  // rest of boot() silently, because the renderer had already started.
  //
  // The board is the source of truth when there is one -- the app publishes a
  // seat per connected player -- and `?players=` is the desk override, so two
  // people can play on one keyboard with no hardware at all.
  const seatQuery = new URLSearchParams(location.search).get('players');
  const forcedSeats = seatQuery ? Math.max(1, parseInt(seatQuery, 10) || 1) : 0;
  const seats = setPlayerCount(forcedSeats || liveSeatCount() || 1);

  const world = createWorld(seats);
  world.state = GameState.RUNNING;
  /**
   * THE FIRST RUN OF A SESSION STARTS HERE, not in restart().
   *
   * There is no title screen and no countdown: boot builds a world already
   * RUNNING, which is the SDK contract -- the first playable state is reached
   * on load with no key press. restart() only covers the SECOND run onward, so
   * hooking it alone reported nothing at all for anyone who played once and
   * left, which is most first sessions. Caught on the wire, not in review.
   */
  analytics.runStarted();
  analytics.levelStarted(`level_${world.level}`, world.level);

  function update(dt) {
    if (world.paused || world.state !== GameState.RUNNING) return;
    world.time += dt;

    // ONE READ PER POD. Each seat has its own board (or its own key set), and
    // a seat whose board has frozen is marked so the pod stops instead of
    // holding that lean into a wall for the rest of the run.
    // THE HOST IS SLOWER THAN BOOT. `window.__gbPlayers` is written by the
    // bridge once per frame, the first of which lands AFTER the page loads --
    // so reading it during boot finds nothing and a two-board session sized
    // itself to one seat. Co-op was therefore impossible in the app, while
    // `?players=2` in a browser worked perfectly and hid it completely.
    //
    // Polled every frame instead, which also covers a board joining or leaving
    // mid-run. `?players=` still wins, so the desk override is unaffected.
    if (!forcedSeats) {
      const live = liveSeatCount();
      if (live && live !== world.players.length) {
        setPlayerCount(live);
        resizePods(world, live);
        // The seats changed, so the names have. Asked for here and not at the
        // end of the run: the roster is only needed for the result screen, but
        // fetching it THEN would race the screen appearing, and a result that
        // says "PLAYER 2" for half a second before correcting itself looks like
        // a fault. It is a cheap call and it is never on a hot path.
        refreshRoster();
      }
    }

    // Names for the result screen, fetched while the run is still going so the
    // screen is right the first time it paints. A no-op once every seat is
    // named, and on every one-player run.
    ensureRoster(world.players.length, world.time);

    for (const pod of world.players) {
      updatePod(world, pod, readInput(dt, pod.slot), dt);
    }
    updateFiring(world, dt);
    // After the pods have moved: the beam is between where they ARE.
    // The level the run is on, because playLevelUp pitches the fanfare by it.
    // Calling it bare made the frequency NaN and froze the game -- see note()
    // in systems/audio.js.
    if (updateBeamCharge(world, dt)) playLevelUp(world.level);
    updateTether(world, dt, rng);
    // After the pod has moved: the anchor's new position is what drives the
    // swing, so simulating before the move would lag the rope by a frame.
    updateChain(world, dt);
    updateBullets(world, dt);
    updateToyPickups(world, dt);
    maybeSpawn(world, rng, dt);
    updateMonsters(world, dt);
    updateCollisions(world, rng, dt);
    updateCoinsAndPops(world, dt);
    updateHearts(world, dt);
    // After the pod has moved and after collisions, so the trail samples the
    // position actually rendered this frame rather than last frame's.
    updateSquad(world, dt);
    // Detonations resolve after the line is placed, so a bomb goes off where it
    // is drawn rather than where it was a frame ago.
    updateSquadBombs(world, rng);
    updateBlasts(world, dt);
    updateLevelPopup(world, dt);

    world.camera.starOffset += CAMERA.driftPxS * dt;
    if (CAMERA.mode === 'lateral') {
      // Follow only once the pod leaves a centre box, and softly. This is the
      // mode most likely to be rejected -- it moves the frame on the axis every
      // dodge is made on -- but it has to be felt to be ruled out.
      const dead = DESIGN_W * CAMERA.deadZoneFrac;
      // The MIDPOINT of the pods, so neither child is pushed off-frame by the
      // other's dodge.
      let mid = 0;
      for (const q of world.players) mid += q.x;
      mid /= world.players.length;
      const target = Math.max(-dead, Math.min(dead, mid - DESIGN_W * 0.5));
      world.camera.x += (target - world.camera.x) * Math.min(1, dt / CAMERA.followLag);
    } else {
      world.camera.x = 0;
    }

    if (world.players.every((q) => !q.alive)) {
      // BEFORE the state changes: which level they died on, and how far into
      // its XP bar they were, are facts still true here and gone a line later.
      reportLevelFailed();
      world.state = GameState.FAILED;
      showGameOver();
    }
  }

  const loop = createLoop((dt) => update(dt));
  renderer.app.ticker.add((t) => {
    loop.step(Math.max(0, t.deltaMS / 1000));
    renderer.draw(world, Math.max(0, t.deltaMS / 1000));
  });
  renderer.app.ticker.start();

  // --- the POC's controls -------------------------------------------------
  function report() {
    const s = world.stats;
    return {
      camera: CAMERA.mode,
      driftMul: +MONSTERS.driftMul.toFixed(2),
      clearanceMul: +MONSTERS.passClearanceMul.toFixed(2),
      passes: s.passes, nearMisses: s.nearMisses, contacts: s.contacts,
      worstReactionS: s.worstReactionS < 90 ? +s.worstReactionS.toFixed(2) : null,
      floorS: MONSTERS.reactionFloorS,
      score: s.score, popped: s.popped, coins: s.coins, toysUsed: s.toysUsed,
      // The headline pair, and they are the SAME quantity now -- see `award`.
      // `level` was missing here and the quit screen rendered "level undefined",
      // which is what a stats line built from a report nobody re-checked looks
      // like.
      level: world.level,
      toys: world.toys.map((inst) => inst.kind.id),
      minutes: +(world.time / 60).toFixed(2),
      ramp: +(difficulty01(world.time) * 100).toFixed(0),
    };
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyC': {
        const i = CAMERA_MODES.indexOf(CAMERA.mode);
        CAMERA.mode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length];
        break;
      }
      case 'BracketLeft':  MONSTERS.driftMul = Math.max(0.4, MONSTERS.driftMul - 0.1); break;
      case 'BracketRight': MONSTERS.driftMul = Math.min(3.0, MONSTERS.driftMul + 0.1); break;
      case 'Minus':        MONSTERS.passClearanceMul = Math.max(0, MONSTERS.passClearanceMul - 0.1); break;
      case 'Equal':        MONSTERS.passClearanceMul = Math.min(3, MONSTERS.passClearanceMul + 0.1); break;
      // Force a toy, so each one can be judged without waiting for a drop.
      case 'Digit1':       equip(world, 'wand'); break;
      case 'Digit2':       equip(world, 'twirl'); break;
      case 'Digit3':       equip(world, 'buddies'); break;
      case 'Digit4':       equip(world, 'rapid'); break;
      case 'Digit5':       equip(world, 'chain'); break;
      case 'Digit6':       equip(world, 'shield'); break;
      case 'Digit7':       equip(world, 'punch'); break;
      case 'Digit8':       equip(world, 'cross'); break;
      case 'KeyR':         restart(); break;
      case 'Enter':
      case 'Space':        if (world.state === GameState.FAILED) restart(); break;
      default: break;
    }
  });

  function showGameOver() {
    playGameOver();
    endings.showDeath();
    // eslint-disable-next-line no-console
    console.log('[bloop] run report', report());
  }

  /**
   * The analytics view of where a run is. Two readers, so the mapping from this
   * game's shape to the shared vocabulary lives in one place.
   *
   * A LEVEL IS A LEVEL -- the easiest mapping of the five games, since this one
   * already uses the word. Progress within one is progress along its XP bar,
   * which the HUD already computes the same way.
   */
  function reportLevelStart() {
    analytics.levelStarted(`level_${world.level}`, world.level);
  }

  function reportLevelFailed() {
    const need = Math.max(1, xpForLevel(world.level));
    analytics.levelFailed(world.stats.score, world.xp, need);
  }

  function restart() {
    /**
     * A RUN BEGINS HERE. resetWorld() below puts the state back to RUNNING and
     * the level back to one, so this is the only entry a fresh run has -- the
     * restart button, and the boot path that calls it.
     *
     * Before the first level is reported, so the stream reads forward.
     */
    endings.hideDeath();
    endings.hideQuitBoard();
    endings.closeConfirm();
    setPaused(false);
    resetWorld(world);
    /**
     * AFTER resetWorld(), and that ordering is the whole point.
     *
     * The first cut reported here BEFORE the reset, so level_start read the level
     * of the run that had just ended -- a player who died on level 3 began their
     * next run reported as "level 3", and the ladder then counted DOWN as the
     * real level climbed from 1. Caught by reading the dashboard against a real
     * session, not by reading the code.
     */
    analytics.runStarted();
    reportLevelStart();
  }

  document.getElementById('restart-button')?.addEventListener('click', restart);

  // --- chrome: pause and settings ----------------------------------------
  const pausedBadge = document.createElement('div');
  pausedBadge.id = 'paused-badge';
  pausedBadge.className = 'hidden';
  pausedBadge.textContent = 'PAUSED';
  document.body.appendChild(pausedBadge);

  // EVERY pause goes through here, so the audio suspend can never drift out of
  // step with the simulation -- the failure mode being music playing on over a
  // frozen game, or worse, a resume that never happens.
  function setPaused(v) {
    world.paused = v;
    pausedBadge.classList.toggle('hidden', !v);
    pauseBtn?.classList.toggle('on', v);
    setAudioPaused(v);
  }
  // Remembered across the confirm so that declining restores the state the
  // player was actually in. Someone who paused, reached for the X, then changed
  // their mind should still be paused -- blindly resuming drops them into a live
  // game they had deliberately stopped.
  let pausedBeforeConfirm = false;

  function leaveToLobby() {
    /**
     * THE ONE PLACE THE PLAYER DELIBERATELY LEAVES, so it is where the session
     * closes. The heartbeat in systems/analytics.js covers every exit that never
     * reaches this line -- an app killed from the switcher, a flat battery.
     */
    analytics.gameLeft();
    if (window.GoBalance?.back) return window.GoBalance.back();
    if (window.Unity) window.Unity.call('nav:back');
  }

  const endings = createEndings(document, {
    getScore: () => world.stats.score,
    // Read at the moment a run ends, never captured at boot: a seat can arrive
    // mid-run (the app publishes its roster after the page loads), so a pod
    // list taken here would be the one-player list on most co-op runs.
    getPods: () => world.players,
    getLevel: () => world.level,
    getStatsLine: () => {
      const r = report();
      return `${r.score} points · ${r.popped} popped · level ${r.level}`;
    },
    restart: () => restart(),
    leave: () => leaveToLobby(),
    // Restore the state the player was ACTUALLY in, not "unpaused". Someone who
    // paused, reached for the X, then changed their mind should still be paused.
    onStay: () => {
      endings.closeConfirm();
      setPaused(pausedBeforeConfirm);
    },
  });

  const pauseBtn = document.getElementById('pause-button');
  pauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPaused(!world.paused);
  });

  // The gear, lifted from Nova Vanguard unchanged: it owns board sensitivity,
  // which is the one setting every game on this hardware shares because the
  // right lean for an adult is not the right lean for a child. The host applies
  // it to the sensor reading itself -- the game must never also scale the
  // value, or the two compound and the number stops meaning what it says.
  let pausedBeforeSettings = false;
  const settings = createSettingsPanel(document, {
    onOpenChange: (open) => {
      if (open) {
        pausedBeforeSettings = world.paused;
        setPaused(true);
      } else {
        setPaused(pausedBeforeSettings);
      }
    },
    toggles: [
      { label: 'Music', get: () => getAudioPrefs().music,
        set: (on) => { setMusicEnabled(on); if (on) startMusic(); else stopMusic(); } },
      { label: 'Sound effects', get: () => getAudioPrefs().sfx, set: setSfxEnabled },
    ],
  });
  document.getElementById('chrome')?.appendChild(settings.button);
  document.body.appendChild(settings.panel);
  // Opening settings pauses the run -- nobody should be adjusting their lean
  // while monsters are still arriving. Done with our own listener rather than a
  // new option on the template: settingsPanel.js is copied verbatim between
  // games, and a per-game parameter added here is exactly how those copies
  // start to drift apart.
  // Opening the settings pauses; CLOSING it resumes. Nobody should be adjusting
  // their lean while monsters are still arriving, and nobody should have to find
  // the pause button again to get going after changing a setting.
  //
  // It restores the PREVIOUS pause state rather than simply unpausing, the same
  // rule the quit confirm follows: a player who paused, then opened settings,
  // then closed them again is still paused on purpose.

  // The X is the only way out on the board. The inline fallback in index.html
  // covers the case where this module never loads.
  /**
   * The X is the only way out on a board, so it must ALWAYS work -- and it must
   * not end a run on a single mis-tap.
   *
   * Confirm only when there is a run to lose. From a screen the player is
   * already stopped on (the death screen, the quit board, an open confirm),
   * asking "are you sure?" is noise, so those leave immediately.
   *
   * The confirm PAUSES, precisely because the playfield stays visible
   * underneath: leaving it running means watching yourself die while deciding.
   */
  window.__gbBack = () => {
    if (endings.isQuitOpen()) return leaveToLobby();
    if (endings.isConfirmOpen()) return leaveToLobby();
    if (world.state !== GameState.RUNNING) return leaveToLobby();
    pausedBeforeConfirm = world.paused;
    setPaused(true);
    endings.openConfirm();
  };

  // --- DEV TOOLS, behind the hold-and-code -------------------------------
  //
  // The hold target is an invisible corner of the screen rather than a HUD
  // element, because this game's HUD is drawn into the canvas and there is no
  // DOM node to press. Bottom-left, unlabelled, never otherwise interactive --
  // nobody holds a blank corner for seven seconds by accident.
  const holdTarget = document.createElement('div');
  holdTarget.id = 'dev-hold-target';
  document.body.appendChild(holdTarget);

  const openDevPanel = () => {
    const dev = createDevPanel(document, {
      world,
      toyIds: Object.keys(TOYS.kinds),
      giveToy: (id) => equip(world, id),
      grantXp: (n) => award(world, n),
      // What the next level still costs. +1 so the grant actually CROSSES the
      // threshold rather than landing exactly on it -- award tests `>=`, but
      // leaving a run of testing sat on the boundary is the kind of off-by-one
      // that gets mistaken for the levelling being broken.
      xpToNext: () => Math.max(1, xpForLevel(world.level) - world.xp + 1),
      clearToys: () => { world.toys = []; },
      setLevel: (n) => {
        world.level = n;
        world.xp = 0;
        celebrate(world, n);
        setMusicLevel(n);
      },
      spawnTier: (tier) => {
        const m = spawnMonster(world, rng);
        if (!m) return;
        const t = MONSTERS.tiers[tier];
        Object.assign(m, {
          tierName: tier, r: t.radius, hp: t.hp, maxHp: t.hp,
          tint: t.tint, points: t.points, coins: t.coins,
        });
      },
      clearField: () => {
        for (const m of world.monsters) if (m.alive) popMonster(world, m, rng);
      },
      restart,
    });
    document.getElementById('chrome')?.appendChild(dev.button);
    document.body.appendChild(dev.panel);
    return dev;
  };

  installDevUnlock(document, holdTarget, openDevPanel);

  // DEV.alwaysVisible puts the wrench up from boot, skipping the gate entirely
  // while the game is being built. The gate is untouched and still works; this
  // only decides whether it is in the way. It must go back to false before a
  // child sees this -- see the note in tuning.js.
  if (DEV.alwaysVisible) openDevPanel();


  window.__bloop = { world, tuning: { CAMERA, MONSTERS, TOYS }, report, restart, equip: (k) => equip(world, k) };

  // ?toy=twirl equips one at boot -- the 1/2/3 keys for something that cannot
  // press keys. A headless screenshot is the only way to check what the toy
  // timer and the two bullet streams actually LOOK like without a browser
  // someone is standing in front of, and the alternative is checking that by
  // eye and reporting a guess.
  const q = new URLSearchParams(location.search);
  // Comma-separated, because toys stack now and the interesting thing to look
  // at is a STACK: ?toy=cross,wand,shield,chain
  // ?dev=1 skips the hold-and-code, and is REFUSED INSIDE THE APP: the guard is
  // `window.GoBalance`, which the host injects and which does not exist at a dev
  // URL. On a board there is no address bar to type it into, so the param can
  // only be set by someone at a keyboard running the dev server -- exactly who
  // the panel is for.
  //
  // It exists because the gate is otherwise untestable: a seven-second hold plus
  // a four-digit code cannot be driven from a headless screenshot, and a panel
  // nobody has looked at is a panel that does not work.
  //
  // IT LIVES HERE, WITH THE OTHER HOOKS, and that is load-bearing: its first
  // version sat 12 lines above `const q = ...` and threw a temporal-dead-zone
  // ReferenceError that killed the rest of boot() silently -- the renderer had
  // already started, so the game still drew and only the things after the throw
  // went missing. It took `?toy=`, `?art=` and `?level=` down with it.
  if (q.get('dev') && !window.GoBalance) {
    openDevPanel().button.click();
  }

  // ?sep=N parks the pods N apart and holds them there. The beam's whole
  // design is a curve against separation, and the two ends of that curve are
  // otherwise only reachable by two people flying -- which a screenshot cannot
  // do.
  const sepHold = parseInt(q.get('sep') || '', 10);
  if (sepHold > 0 && world.players.length > 1) {
    setInterval(() => {
      world.players.forEach((p, i) => {
        p.x = DESIGN_W / 2 + (i - (world.players.length - 1) / 2) * sepHold;
      });
    }, 16);
  }

  // ?lives=N starts the run with N hearts. Reaching the death screen otherwise
  // means actually losing, which a headless browser cannot do on purpose -- and
  // the death path is the one every run ends on.
  const livesHook = parseInt(q.get('lives') || '', 10);
  if (livesHook > 0) world.lives = livesHook;

  const forced = q.get('toy');
  if (forced) {
    for (const name of forced.split(',')) {
      if (TOYS.kinds[name.trim()]) equip(world, name.trim());
    }
  }

  // ?squad=8 pre-fills the squad and lays a synthetic weave into the pod's path
  // history, so one frame shows the line's actual SHAPE. Without it the trail
  // needs seconds of real movement to exist at all, and a headless screenshot
  // catches a pod with nothing behind it -- which is exactly the thing being
  // reviewed. The follow maths is the real one; only the history is fabricated.
  const squadN = parseInt(q.get('squad') || '0', 10);
  if (squadN > 0) {
    SQUAD.enabled = true;   // the feature is parked; this forces it on to look at
    const tiers = Object.values(MONSTERS.tiers);
    for (let i = 0; i < Math.min(squadN, SQUAD.maxMembers); i++) {
      const tier = tiers[i % tiers.length];
      world.squad.push({
        tint: tier.tint, eyes: (i % 3) + 1, horns: true,
        joinT: 0, bob: i * 1.3, x: world.players[0].x, y: world.players[0].y,
      });
    }
    // Walk a smooth curve and record a point only every `pathStepPx`, exactly as
    // the real recorder does. A naive dense sampling folds the path back on
    // itself and the arc-length walk then zigzags -- which looks like a bug in
    // the follow code and is not one.
    let px = world.players[0].x, py = world.players[0].y;
    for (let f = 0; f < 4000; f++) {
      const t = f / 400;
      const nx = world.players[0].x + Math.sin(t * 1.15) * 330;
      const ny = world.players[0].y + Math.sin(t * 0.55) * 80;
      if (Math.hypot(nx - px, ny - py) >= SQUAD.pathStepPx) {
        world.trail.push({ x: nx, y: ny });
        px = nx; py = ny;
      }
    }
  }

  // ?level=N holds the celebration on screen so it can be looked at. It lasts
  // under two seconds in play and fires on a threshold, which is not a thing a
  // headless screenshot can catch by waiting.
  const lvl = parseInt(q.get('level') || '0', 10);
  if (lvl > 0) {
    world.level = lvl;
    // Through the REAL celebration, so a screenshot shows what actually plays.
    // The earlier version built the popup object by hand and therefore missed
    // every tier the ladder adds -- it would have shown level 10 as level 1.
    celebrate(world, lvl);
    world.skySnap = true;   // show the destination, not the journey
    // Held near its peak for the shot: the punch-in is ~18 % of the duration,
    // so parking p01 just past that catches it at full size.
    world.levelPopup.total = 12;
    world.levelPopup.t = 12 * 0.75;
  }

  // ?settings=1 opens the settings panel. Same reason as ?screen= -- it is only
  // otherwise reachable by clicking the gear, which a headless screenshot cannot
  // do, and a panel nobody has looked at is a panel nobody has checked the
  // spacing of.
  if (q.get('settings')) settings.button.click();

  // ?screen=confirm|quit|dead opens an end-of-run screen directly. They are
  // otherwise only reachable by dying or by pressing the X mid-run, neither of
  // which a headless screenshot can do -- and a screen nobody has looked at is a
  // screen that does not work.
  const screen = q.get('screen');
  if (screen === 'confirm') { setPaused(true); endings.openConfirm(); }
  if (screen === 'quit') endings.showQuitBoard();
  // ?rows=8 fills the board with fake entries. The real board only exists inside
  // the app, so this is the only way to see the TALL version of these screens --
  // which is the one that can overflow a phone.
  const rows = parseInt(q.get('rows') || '0', 10);
  if (rows > 0) setTimeout(() => fakeBoard(document, rows, world.players), 0);
  if (screen === 'dead') { world.state = GameState.FAILED; showGameOver(); }

  // ?art=1 puts one of every tier on screen at fixed positions, immediately.
  // The art cannot be reviewed from a headless screenshot otherwise: virtual
  // time barely advances the game clock, so the field is still empty in the
  // warm-up when the shot is taken, and "the monsters look fine" would be a
  // guess. The middle one starts mid-hit so the squash and the "oh!" mouth are
  // in the same frame as the resting ones.
  if (q.get('art')) {
    const tiers = ['small', 'medium', 'large'];
    tiers.forEach((t, i) => {
      const m = spawnMonster(world, rng);
      if (!m) return;
      const tier = MONSTERS.tiers[t];
      Object.assign(m, {
        tierName: t, r: tier.radius, hp: tier.hp, maxHp: tier.hp, tint: tier.tint,
        x: DESIGN_W * (0.24 + i * 0.26), y: DESIGN_H * 0.34,
        vx: 0, vy: 0, eyes: i + 1, horns: true,
      });
      if (i === 1) { m.hitT = MONSTERS.hit.flashS; m.squashT = MONSTERS.hit.squashS * 0.72; }
    });
    // ...and one of every toy pickup, so the three silhouettes can be compared
    // side by side against each other AND against a coin, which is the
    // comparison that matters: they have to be distinguishable at a glance.
    Object.keys(TOYS.kinds).forEach((k, i) => {
      world.toyPickups.push({
        alive: true, kind: k, t: 999, bob: i * 2,
        // Clear of the pod's magnet radius, or the art row collects itself
        // before the screenshot and two thirds of it is missing from the frame.
        x: DESIGN_W * (0.10 + i * 0.115), y: DESIGN_H * 0.50,
      });
    });
    world.coins.push({ alive: true, x: DESIGN_W * 0.03, y: DESIGN_H * 0.62, vx: 0, vy: 0, t: 999 });
    world.hearts.push({ alive: true, x: DESIGN_W * 0.09, y: DESIGN_H * 0.62, t: 999, bob: 0 });
  }
}

/**
 * TEACH THE HOST'S SDK ONE MORE METHOD, before boot can use it.
 *
 * The app injects its own GoBalance SDK as the first script in <head>, and that
 * SDK has no analytics call -- see systems/gbSdk.js. This adds `logEvent` and
 * touches nothing else. A no-op outside the WebView.
 */
installGbSdk();

boot();
