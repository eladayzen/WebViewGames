/* Pong Master — wiring.
 *
 * The run model these games use, which every ending below obeys: a player
 * steps onto a board, plays until they die or stop, and steps off. Nothing
 * carries into the next run, there is no mid-run save, and there is nothing to
 * resume. What that buys is one rule --
 *
 *     Every way a run can end, ends the same way: bank the score, then show
 *     the board.
 *
 * -- including the ending it is easiest to get wrong. A run the player CHOSE
 * to stop still happened, and a board that only records deaths quietly
 * punishes stopping: it teaches people to stand there and lose on purpose
 * rather than press the button that means "I'm done".
 */

import { createRenderer } from './render/renderer.js';
import { createHud } from './ui/hud.js';
import { createInput } from './input/input.js';
import { createDevPanel } from './ui/devPanel.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { GameState, isOver } from './core/state.js';
import {
  createWorld,
  applyOrientation,
  setState,
  serve,
  resetRun,
  advanceLadder,
  parkBall,
  runScore,
  SIDE_NEAR,
  SIDE_FAR,
} from './sim/world.js';
import { stepBall } from './sim/physics.js';
import { stepAI, resetAIForRally } from './sim/ai.js';
import { updatePickups, collidePickups, tickPerks, resetPickups, activePerk } from './sim/pickups.js';
import { SHARED, LADDER, DEFAULT_MAPPING, RECENTER } from './data/tuning.js';
import { OPPONENTS, tint, isLastOpponent } from './data/opponents.js';
import { CLASSIC, DEFAULT_TILT_SIGN } from './data/orientation.js';
import { submitRun, renderBoard } from './systems/scoreboard.js';

const GAME_OVER_RESTART_SEC = 10;
// One press can reach two skip listeners, and the second will skip the screen
// the first just opened. Guarding on the screen's AGE rather than on listener
// order is what stops that.
const SKIP_GUARD_SEC = 0.3;
const FIXED_STEP = 1 / 120;
// Bumped when a stored choice must stop winning over a new default. v2:
// horizontal (CLASSIC) is the layout the game is being built around, and a
// LATERAL saved during the comparison would otherwise keep overriding it.
const CFG_KEY = 'pongmaster.experiment.v2';

const gbApi = () => (typeof window !== 'undefined' ? window.GoBalance : null);

/* The live experiment settings. Persisted so a choice made on the board
 * survives a reload -- guarded, because localStorage can throw outright in a
 * restricted WebView rather than merely returning nothing.
 *
 * CLASSIC is the committed layout: paddles on the left and right walls, the
 * player steering on the board's fore/aft axis. LATERAL stays reachable from
 * the panel so the comparison can be re-run, but it is no longer a coin toss
 * between two candidates. */
const cfg = {
  orientation: CLASSIC,
  mapping: DEFAULT_MAPPING[CLASSIC],
  sign: DEFAULT_TILT_SIGN[CLASSIC],
  recenter: RECENTER.enabled,
  assist: true,
  // Set from the player's sensitivity setting on boot. Deliberately NOT
  // persisted here -- settingsPanel.js owns that preference under its own key,
  // because it is a player setting and this object is a developer experiment.
  sensitivityScale: 1,
};

function loadCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) Object.assign(cfg, JSON.parse(raw));
  } catch (e) {
    /* no storage: defaults are correct */
  }
}

function saveCfg() {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* no storage: the choice simply does not persist */
  }
}

async function boot() {
  loadCfg();

  const renderer = await createRenderer();
  const hud = createHud();
  const input = createInput();
  const world = createWorld(cfg.orientation, Math.random);

  renderer.setOrientation(cfg.orientation);
  hud.setOrientation(cfg.orientation);
  renderer.start();

  let pausedBeforeConfirm = false;
  let lastRestartAt = -1;
  // A roster change mid-rally would swap an opponent for a human under the
  // player's hands, so it is held and applied at the start of the next run.
  let pendingTwoPlayer = false;
  let nearName = 'YOU';
  let farName = 'CPU';

  // ---- host wiring -------------------------------------------------------
  async function readRoster(applyNow) {
    const gb = gbApi();
    const multi = !!(gb && gb.multiplayer);
    pendingTwoPlayer = multi;

    if (gb && typeof gb.getProfile === 'function') {
      try {
        const p = await gb.getProfile();
        if (p && p.name) nearName = p.name.toUpperCase();
      } catch (e) {
        /* keep the default */
      }
    }

    if (multi && gb && typeof gb.getPlayers === 'function') {
      const players = gb.getPlayers() || [];
      if (players[0] && players[0].name) nearName = String(players[0].name).toUpperCase();
      farName = players[1] && players[1].name ? String(players[1].name).toUpperCase() : 'PLAYER 2';
    }

    if (applyNow) world.twoPlayer = multi;
    hud.setNames(nearName, farName);
    if (applyNow) showFarSide();
  }

  /* Who is on the far side, in the HUD and in the court's own colours. In one
   * player that is the current ladder opponent; in two player it is a person,
   * who keeps the neutral far colour. */
  function showFarSide() {
    if (world.twoPlayer) {
      hud.setFarIdentity(farName, '#ff7a59');
      renderer.setFarTint(0xff7a59);
      hud.setMatchLine('VERSUS');
      return;
    }
    const o = world.opponent;
    hud.setFarIdentity(o.name, o.css);
    renderer.setFarTint(tint(o));
    hud.setMatchLine(`${world.matchIndex + 1} / ${OPPONENTS.length} · ${o.name}`);
  }

  const gb = gbApi();
  if (gb && typeof gb.on === 'function') gb.on('playerschange', () => readRoster(false));
  await readRoster(true);

  // ---- the experiment ----------------------------------------------------
  function changeOrientation(next) {
    cfg.orientation = next;
    // The lean sign is a property of the physical axis, not of the player's
    // preference, so it reverts to that axis's default rather than carrying a
    // choice made about a different axis.
    cfg.sign = DEFAULT_TILT_SIGN[next];
    saveCfg();
    applyOrientation(world, next);
    renderer.setOrientation(next);
    hud.setOrientation(next);
  }

  const settings = createSettingsPanel({
    onChange: (scale) => {
      cfg.sensitivityScale = scale;
    },
  });

  const dev = createDevPanel({
    cfg,
    onOrientation: changeOrientation,
    onRecentreNow: () => input.recentre(),
    onChange: saveCfg,
  });

  // ---- pause -------------------------------------------------------------
  // Every pause goes through here, so nothing can drift out of step with it.
  function setPaused(paused) {
    world.paused = paused;
    hud.setPaused(paused);
  }

  hud.el.pause.addEventListener('click', () => {
    if (isOver(world.state) || hud.isConfirmOpen()) return;
    setPaused(!world.paused);
  });

  // ---- quitting ----------------------------------------------------------
  function leaveToLobby() {
    const api = gbApi();
    if (api && typeof api.back === 'function') return api.back();
    if (window.Unity) window.Unity.call('nav:back');
  }

  /* The X is the only way out on a board -- no keyboard, no gesture, no home
   * button the player can reach. So it must always work, and it must not end a
   * run on a single mis-tap. It asks only when there is a run to lose: from a
   * screen the player is already stopped on, asking "are you sure?" is noise. */
  window.__gbBack = () => {
    if (hud.isConfirmOpen()) return leaveToLobby();
    if (isOver(world.state)) return leaveToLobby();
    pausedBeforeConfirm = world.paused;
    setPaused(true);
    hud.showConfirm();
  };

  hud.el.confirmNo.addEventListener('click', () => {
    hud.hideConfirm();
    // Restore what the player had, not "unpaused". Someone who paused, reached
    // for the X and changed their mind should still be paused.
    setPaused(pausedBeforeConfirm);
  });

  hud.el.confirmYes.addEventListener('click', () => {
    hud.hideConfirm();
    endRun('quit');
  });

  // ---- endings -----------------------------------------------------------
  async function endRun(kind, winner) {
    world.ball.live = false;
    setPaused(false);
    hud.hideConfirm();
    hud.hideBanner();

    const score = runScore(world);
    const twoPlayer = world.twoPlayer;

    const beatenLine = `${world.matchesWon} of ${OPPONENTS.length} beaten`;

    if (kind === 'gameover') {
      setState(world, GameState.GAME_OVER, GAME_OVER_RESTART_SEC);
      hud.setGameOverClock(GAME_OVER_RESTART_SEC);
      hud.showGameOver({
        title: `${world.opponent.name} WINS`,
        score,
        sub: beatenLine,
      });
    } else {
      const finished = kind === 'finished';
      setState(world, finished ? GameState.FINISHED : GameState.QUIT);

      let title = 'STOPPED';
      if (finished) title = twoPlayer ? `${winner === SIDE_NEAR ? nearName : farName} WINS` : 'LADDER CLEARED';

      hud.showResult({
        kicker: finished ? (twoPlayer ? 'MATCH OVER' : 'ALL OPPONENTS BEATEN') : 'RUN ENDED',
        title,
        score: twoPlayer ? `${world.score[SIDE_NEAR]} – ${world.score[SIDE_FAR]}` : score,
        sub: twoPlayer ? 'Two-player matches are not ranked.' : beatenLine,
      });
    }

    /* Bank on the way IN to the screen, not on the way out: the player can
     * leave to the lobby from here and the page is simply gone.
     *
     * Two-player is the one case with nothing to bank. submitScore records
     * against the signed-in profile on THIS device, and the multiplayer roster
     * carries a name and a colour but no profileId -- so there is no way to
     * credit player two's win to player two. Submitting anyway would file a
     * versus result under player one regardless of who won, on a board whose
     * other rows are one-player ladder runs and not comparable to it. */
    if (twoPlayer) return;

    const submitted = await submitRun(score);
    const onGameOver = kind === 'gameover';
    await renderBoard(
      onGameOver ? hud.el.goBoard : hud.el.resultBoard,
      onGameOver ? hud.el.goBoardTitle : hud.el.resultBoardTitle,
      submitted,
    );
  }

  /* PLAY AGAIN and the death screen's clock both start a COMPLETE fresh run --
   * match one, score zero, ladder reset. There is no "continue where you left
   * off" because there is nothing to continue. */
  function restart() {
    const now = performance.now();
    // On device the host clicks #restart-button AND forwards the keydown, so
    // this can be called twice for one press.
    if (now - lastRestartAt < 300) return;
    lastRestartAt = now;

    hud.hideGameOver();
    hud.hideResult();
    hud.hideConfirm();
    setPaused(false);
    world.twoPlayer = pendingTwoPlayer;
    readRoster(true);
    resetRun(world);
    resetPickups(world);
    hud.setScore(0, 0);
    showFarSide();
    hud.hideBanner();
  }

  hud.el.restart.addEventListener('click', () => {
    if (world.state !== GameState.GAME_OVER || world.stateAge < SKIP_GUARD_SEC) return;
    restart();
  });

  hud.el.resultAgain.addEventListener('click', () => {
    if (!isOver(world.state) || world.stateAge < SKIP_GUARD_SEC) return;
    restart();
  });

  hud.el.resultQuit.addEventListener('click', () => leaveToLobby());

  // Browser-only convenience: on device the host already synth-clicks the
  // restart button on Space/Enter whenever the game-over overlay is visible.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (world.state === GameState.GAME_OVER && world.stateAge >= SKIP_GUARD_SEC) restart();
  });

  // ---- scoring -----------------------------------------------------------
  function onPoint(scoredBy) {
    world.score[scoredBy] += 1;
    if (!world.twoPlayer && scoredBy === SIDE_NEAR) world.rallyPointsWon += 1;
    // Winner serves, off their own paddle: win a point and the ball comes back
    // to you, at the spot you won it.
    world.server = scoredBy;
    hud.setScore(world.score[SIDE_NEAR], world.score[SIDE_FAR]);

    if (world.score[scoredBy] >= LADDER.pointsPerMatch) return onMatchEnd(scoredBy);

    setState(world, GameState.POINT, SHARED.pointPauseSec);
    hud.showBanner(scoredBy === SIDE_NEAR ? 'POINT' : 'LOST');
  }

  function onMatchEnd(winner) {
    if (world.twoPlayer) return endRun('finished', winner);
    if (winner === SIDE_FAR) return endRun('gameover');

    // Beating the last one finishes the campaign. Finishing and quitting leave
    // the player in exactly the same position -- run over, score banked, play
    // again or leave -- so they share one screen and differ in the headline.
    if (isLastOpponent(world.matchIndex)) {
      world.matchesWon += 1;
      return endRun('finished', SIDE_NEAR);
    }

    const beaten = world.opponent;
    advanceLadder(world);
    // A new opponent is a clean court: perks do not carry across a match.
    resetPickups(world);
    hud.setScore(0, 0);
    showFarSide();
    setState(world, GameState.MATCH_END, 2.2);
    hud.showBanner(`${beaten.name} BEATEN\nNEXT: ${world.opponent.name}`);
  }

  function startRally() {
    serve(world, world.server);
    resetAIForRally(world);
    setState(world, GameState.RALLY);
    hud.hideBanner();
    // Every point opens from whatever stance the player has settled into, so
    // drift never accumulates across a whole match.
    if (cfg.recenter) input.recentre();
  }

  // ---- frame -------------------------------------------------------------
  function drivePaddles(dt) {
    // Arm the sweep: remember where every paddle starts this frame, so the
    // collision test can credit the ground it covers rather than only the
    // position it happens to end on.
    for (const pad of world.paddles) pad.prevAcross = pad.across;
    world.assist = cfg.assist;
    input.update(world, dt, cfg);
    if (!world.twoPlayer) stepAI(world, dt);
    input.settle(world, dt);
  }

  function simulate(dt) {
    updatePickups(world, dt);
    tickPerks(world, dt);

    // Sub-stepped so a ball near the top of its speed ramp cannot skip past a
    // paddle between frames.
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / FIXED_STEP)));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      const from = { along: world.ball.along, across: world.ball.across };
      const result = stepBall(world, sub);
      // Pickup collection is tested against the path the ball travelled in
      // this substep, not its endpoints, so a fast ball cannot pass through
      // one without touching it.
      collidePickups(world, from, { along: world.ball.along, across: world.ball.across });
      if (result) return onPoint(result.scoredBy);
    }
  }

  function update(dt) {
    world.stateAge += dt;
    if (world.paused) return;
    if (world.timer > 0) world.timer -= dt;

    switch (world.state) {
      case GameState.SERVING:
        drivePaddles(dt);
        // Re-parked every frame so the ball follows the server's paddle right
        // up until it launches.
        parkBall(world, world.server);
        if (world.timer <= 0) startRally();
        break;

      case GameState.RALLY:
        drivePaddles(dt);
        simulate(dt);
        break;

      case GameState.POINT:
      case GameState.MATCH_END:
        drivePaddles(dt);
        if (world.timer <= 0) {
          hud.hideBanner();
          setState(world, GameState.SERVING, SHARED.servePauseSec);
        }
        break;

      case GameState.GAME_OVER:
        // The only screen with a clock, because it is the only one a player
        // lands on without choosing to.
        hud.setGameOverClock(world.timer);
        if (world.timer <= 0) restart();
        break;

      default:
        // FINISHED and QUIT wait for the player. They pressed something to get
        // here; a celebration screen that yanks itself away while someone is
        // reading their score is the exact failure this avoids.
        break;
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    // The pump can stall (an occluded WebView, a backgrounded tab). Clamp so
    // the world never takes one enormous step on the way back.
    if (dt > 0.25) dt = 0.25;
    if (dt > 0) update(dt);
    hud.setPerk(activePerk(world));
    dev.update(input, world);
    renderer.draw(world);
  }

  /* POC only: a handle on the live state for headless verification, since
   * there is no console inside the WebView and a screenshot cannot tell you
   * whether the input path is actually moving a paddle or the renderer just
   * happens to be drawing one. Goes away with the dev panel before ship. */
  window.__pong = { world, cfg, input, renderer };

  hud.setScore(0, 0);
  showFarSide();
  setState(world, GameState.SERVING, SHARED.servePauseSec);
  requestAnimationFrame(frame);
}

boot();
