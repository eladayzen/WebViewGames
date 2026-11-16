// TMNT Wave Surf -- boot, the run's state machine, and the one game loop.
//
// ONE DOCUMENT, ONE LOOP. The prototype ran the wave in an iframe with its own
// rAF loop and passed state through window globals. Here a single
// requestAnimationFrame callback (through the index.html shim, so the host's
// __pumpFrames drives it on device) steps the rider, renders the wave into the
// WebGL canvas underneath, and draws the gameplay on the 2D canvas on top.
//
// THE RUN: countdown -> running -> (died: result screen with a clock | quit:
// board with no clock). Every ending banks the score, then shows the board.
import './style.css';
import { createWave } from './wave/wave.js';
import { createSurf } from './game/surf.js';
import { RUN } from './game/constants.js';
import { installInput, pollBoard, holding, directKeys, setSensitivity, thresholds } from './input/input.js';
import { createHud } from './ui/hud.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { installDevUnlock } from './ui/devUnlock.js';
import { mountDevPanel, applyDefaultPreset } from './ui/devPanel.js';
import { submitRun, fetchBoard, resultSections } from './systems/scoreboard.js';

const State = { COUNTDOWN: 'countdown', RUNNING: 'running', DEAD: 'dead', QUIT: 'quit' };

function boot() {
  applyDefaultPreset();   // physics preset C, every boot
  const stage = document.getElementById('stage');
  const waveCanvas = document.getElementById('wave');
  const fx = document.getElementById('fx');
  const hud = createHud(document);

  let wave;
  try { wave = createWave(waveCanvas); }
  catch (e) {
    // No WebGL: say so on screen (there is no console on device), keep the X working.
    if (window.Unity) window.Unity.call('JS ERROR: WebGL unavailable: ' + e.message);
    hud.setCountdown('This device cannot show the wave');
    return;
  }
  let W = 0, H = 0;
  function fitViewport() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    if (w === W && h === H) return;
    W = w; H = h;
    wave.layout(W, H);
    fx.width = W; fx.height = H;
  }
  fitViewport();
  wave.precompile();

  // ---------------------------------------------------------------- run state
  let state = State.COUNTDOWN;
  let paused = false;            // the confirm modal freezes everything, wave included
  let pausedBeforeConfirm = false;
  let lives = RUN.LIVES;
  let waveT = 0;
  let countdownT = RUN.COUNTDOWN_S;
  let goT = 0;                   // "GO!" stays up briefly once the run starts
  let resultT = -1;              // death screen clock; -1 = not counting
  let pendingDeath = false;

  const surf = createSurf({
    canvas: fx, wave, holding, directKeys,
    hooks: {
      onDamage() {
        if (state !== State.RUNNING) return;
        lives = Math.max(0, lives - 1);
        hud.setLives(lives);
        if (lives === 0) pendingDeath = true;   // finish drawing this frame (the hit flash), then end
      },
    },
  });
  installInput(fx);

  const runScore = () => Math.floor(surf.game.score);
  const statsText = () => {
    const g = surf.game, secs = Math.floor(g.dist / RUN.DIST_PER_SEC);
    return `score ${runScore().toLocaleString()} · ${g.stars} stars · ${g.specials} nunchaku · ` +
      `${g.bossKills} boss KO${g.bossKills === 1 ? '' : 's'} · surfed ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  function setPaused(next) { paused = !!next; }

  /** Leaders plus a window around the run just played (scoreboard.js). When the
   *  run is already among the leaders resultSections returns no window, so the
   *  run is marked where it sits -- otherwise nothing on the board says which
   *  row was this run. */
  function boardGroups(rows, score) {
    const { top, window: near } = resultSections(rows, score);
    if (near.length) return [top, near];
    const i = top.findIndex((r) => r.isYou && Math.round(r.score || 0) === score);
    return [top.map((r, k) => (k === i ? { ...r, isRun: true } : r))];
  }

  /** A complete fresh run: score zero, full shells, nothing on the water, countdown. */
  function restart() {
    surf.reset();
    lives = RUN.LIVES; hud.setLives(lives);
    pendingDeath = false; resultT = -1; goT = 0;
    hud.hideGameOver(); hud.hideQuit(); hud.hideConfirm(); hud.setResultCountdown(0);
    state = State.COUNTDOWN; countdownT = RUN.COUNTDOWN_S;
    setPaused(false);
  }

  // ---------------------------------------------------------------- endings
  /** Died: result screen, the board, and a clock that restarts the run. */
  function die() {
    state = State.DEAD;
    pendingDeath = false;
    hud.setCountdown(null);
    resultT = RUN.RESULT_SECONDS;
    hud.setResultCountdown(Math.ceil(resultT));
    hud.showGameOver(statsText());
    const score = runScore();
    submitRun(score).then(() => fetchBoard().then((board) => {
      if (state !== State.DEAD) return;
      hud.showBoard('result', board, boardGroups(board.rows, score));
    }));
  }
  /** Quit mid-run: the score still counts. Board, PLAY AGAIN / QUIT, no clock. */
  function endRunAndShowQuit() {
    hud.hideConfirm();
    state = State.QUIT;
    setPaused(false);
    hud.setCountdown(null);
    hud.showQuit(statsText());
    const score = runScore();
    submitRun(score).then(() => fetchBoard().then((board) => {
      if (state !== State.QUIT) return;
      hud.showBoard('quit', board, boardGroups(board.rows, score));
    }));
  }
  /** Restart from the death screen. Guarded on STATE (not on the clock) and on
   *  the screen's age, so the press that killed you cannot also skip it. */
  function restartFromResult() {
    if (state !== State.DEAD) return;
    if (RUN.RESULT_SECONDS - resultT < RUN.SKIP_GUARD_S) return;
    restart();
  }
  document.getElementById('restart-button').addEventListener('click', (e) => { e.stopPropagation(); restartFromResult(); });
  document.getElementById('gameover-overlay').addEventListener('pointerdown', (e) => { if (e.target.id !== 'restart-button') restartFromResult(); });
  addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && state === State.DEAD) restartFromResult();
  });

  // ---------------------------------------------------------------- the X
  const leaveToLobby = () => {
    if (window.GoBalance && typeof window.GoBalance.back === 'function') { window.GoBalance.back(); return; }
    if (window.Unity) window.Unity.call('nav:back');
  };
  // The X's inline onclick prefers this hook and falls back to nav:back if
  // this module never loaded. Ask only when there is a run to lose.
  window.__gbBack = () => {
    if (hud.isQuitOpen()) return leaveToLobby();
    if (state !== State.RUNNING) return leaveToLobby();
    if (hud.isConfirmOpen()) return;
    pausedBeforeConfirm = paused;
    setPaused(true);
    hud.showConfirm();
  };
  document.getElementById('confirm-stay').addEventListener('click', (e) => {
    e.stopPropagation(); hud.hideConfirm(); setPaused(pausedBeforeConfirm);
  });
  document.getElementById('confirm-quit').addEventListener('click', (e) => { e.stopPropagation(); endRunAndShowQuit(); });
  document.getElementById('quit-again').addEventListener('click', (e) => { e.stopPropagation(); restart(); });
  document.getElementById('quit-leave').addEventListener('click', (e) => { e.stopPropagation(); leaveToLobby(); });
  // A clicked button keeps focus, and Space would click it again (Space is the
  // hold key). Drop focus after every button press.
  stage.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) e.target.closest('button').blur(); });

  // ---------------------------------------------------------------- settings
  // Sensitivity only (the game has no audio). The panel pushes the value to
  // the host and re-applies the stored value on boot; onSensitivity moves this
  // game's own board thresholds, because the host never scales __gbSensor.
  const settings = createSettingsPanel(document, { onSensitivity: setSensitivity });
  stage.appendChild(settings.button);
  stage.appendChild(settings.panel);

  // ---------------------------------------------------------------- dev tools
  // Hold the shells for 7 s, then the code. Not persisted: a reload re-locks.
  // `?dev=1` skips the gesture on a desktop.
  const dbg = document.getElementById('dbg');
  let devPanel = null;
  const devApi = {
    setTheme: (t) => wave.setTheme(t),
    getTheme: () => wave.getTheme(),
    toggleMode: () => surf.setMode(surf.mode === 'Physics' ? 'Direct' : 'Physics'),
    getMode: () => surf.mode,
    summonBoss: () => surf.dev.summonBoss(),
  };
  function mountDev() {
    if (devPanel) return;
    devPanel = mountDevPanel(stage, devApi);
    dbg.classList.remove('hidden');
    addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') { wave.setTheme('toon'); devPanel.refreshSwitches(); }
      if (e.code === 'Digit2') { wave.setTheme('ooze'); devPanel.refreshSwitches(); }
      if (e.code === 'KeyB') surf.dev.summonBoss();
      if (e.code === 'KeyN') surf.dev.summonJet();
      if (e.code === 'KeyC') { devApi.toggleMode(); devPanel.refreshSwitches(); }
      if (e.code === 'Backquote') devPanel.toggleVisible();
    });
    // Scripted access for headless checks -- exists only once unlocked.
    window.__tws = {
      state: () => state, lives: () => lives, score: runScore, paused: () => paused,
      rider: surf.dev.rider, spawnObstacle: surf.dev.spawnObstacle, spawnPicks: surf.dev.spawnPicks,
      summonBoss: surf.dev.summonBoss, setNoSpawn: surf.dev.setNoSpawn, setTheme: devApi.setTheme, thresholds,
    };
  }
  installDevUnlock(document, document.getElementById('lives'), mountDev);
  // DEV_ON_BY_DEFAULT: Elad (2026-11-11) wants the physics dev panel open in the Unity build so he can
  // tune on the board. Flip to false before a player-facing release -> back to the hold + code unlock.
  const DEV_ON_BY_DEFAULT = true;
  if (DEV_ON_BY_DEFAULT || /[?&]dev=1\b/.test(window.location.search || '')) mountDev();

  // ---------------------------------------------------------------- the loop
  hud.setLives(lives);
  let prev = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);   // first, so a throw below cannot end the loop
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
    fitViewport();
    pollBoard();
    if (!paused && (state === State.COUNTDOWN || state === State.RUNNING)) {
      waveT += dt;
      surf.frame(dt, W, H, waveT, state === State.RUNNING);
      if (state === State.COUNTDOWN) {
        countdownT -= dt;
        if (countdownT <= 0) { state = State.RUNNING; goT = 0.7; }
        hud.setCountdown(state === State.COUNTDOWN ? String(Math.ceil(countdownT)) : 'GO!');
      } else if (goT > 0) {
        goT -= dt;
        if (goT <= 0) hud.setCountdown(null);
      }
      if (pendingDeath) die();
    } else if (state === State.DEAD && resultT >= 0) {
      resultT -= dt;
      hud.setResultCountdown(Math.max(0, Math.ceil(resultT)));
      if (resultT <= 0) { resultT = -1; restart(); }
    }
    hud.setScore(runScore());
    if (devPanel) dbg.textContent = surf.debugText + `\nstate ${state}${paused ? ' (paused)' : ''}   lives ${lives}   theme ${wave.getTheme()}   ctl ${surf.mode}   board ${window.__gbSensor ? (+window.__gbSensor.x).toFixed(2) : 'none'} (press ${thresholds().press.toFixed(2)})`;
  }
  requestAnimationFrame(tick);
}

boot();
