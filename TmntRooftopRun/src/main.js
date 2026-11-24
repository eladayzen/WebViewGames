// TMNT Rooftop Run -- boot, the run's state machine, and the one game loop.
//
// Donnie (3D) runs across the rooftops on his own. Board centred = keep
// running; a tap to either side = jump, again in the air = double jump, hold = re-jump on landing.
// The world is painted 2D sprites at real depths, seen by a 3D camera that
// dollies in for fights and out for big jumps.
//
// THE RUN: countdown -> running -> (died: result screen with a clock | quit:
// board with no clock). Every ending banks the score, then shows the board.
// The GoBalance contract (rAF shim, X button, #gameover-overlay) is in index.html.
import './style.css';
import { createWorld } from './game/world.js';
import { createRunner, botWantsTap } from './game/runner.js';
import { createScene } from './render/scene.js';
import { RUN } from './game/constants.js';
import { installInput, pollBoard, consumeTap, clearTaps, setSensitivity, thresholds, inputHeld } from './input/input.js';
import { createHud } from './ui/hud.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { installDevUnlock } from './ui/devUnlock.js';
import { submitRun, fetchBoard, resultSections } from './systems/scoreboard.js';

const State = { COUNTDOWN: 'countdown', RUNNING: 'running', DEAD: 'dead', QUIT: 'quit' };

function boot() {
  const stage = document.getElementById('stage');
  const fx = document.getElementById('fx');
  const hud = createHud(document);

  const seedParam = /[?&]seed=(\d+)/.exec(window.location.search || '');
  const track = createWorld(seedParam ? +seedParam[1] : (Date.now() % 100000));
  let renderer = null;
  let highRoad = false;
  const runner = createRunner(track, {
    onDamage(kind) {
      if (state !== State.RUNNING) return;
      lives = Math.max(0, lives - 1);
      hud.setLives(lives);
      if (lives === 0) pendingDeath = true;
    },
    onRespawn() { renderer.resetCamera(); },
    onKO(f) { renderer.burst(f.x, f.y + 1.2, 0xffd400, 16, 7); },
    onHeart(h) {
      renderer.burst(h.x, h.y, 0xff3d5e, 14, 5);
      if (lives < RUN.LIVES) { lives++; hud.setLives(lives); }          // a lost shell comes back
    },
    onPizza(z) { renderer.burst(z.x, z.y, 0xff7a2a, 6, 3); },
    onJump(dbl) { if (dbl) { const p = runner.p; renderer.burst(p.x, p.y + 0.3, 0xbfe9ff, 9, 3.5); } },
    onLand() { const p = runner.p; renderer.burst(p.x, p.y + 0.1, 0xfff0dc, 5, 2.2); },
  });
  renderer = createScene(fx, track, runner);
  installInput(fx);

  let W = 0, H = 0;
  function fitViewport() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    if (w === W && h === H) return;
    W = w; H = h; fx.width = W; fx.height = H; renderer.resize(W, H);
  }
  fitViewport();

  // ---------------------------------------------------------------- run state
  let state = State.COUNTDOWN;
  let paused = false, pausedBeforeConfirm = false;
  let lives = RUN.LIVES;
  let countdownT = RUN.COUNTDOWN_S, goT = 0, resultT = -1, pendingDeath = false;
  let autopilot = false;

  const runScore = () => runner.score();
  const statsText = () => {
    const p = runner.p, secs = Math.floor(p.t);
    return `score ${runScore().toLocaleString()} · ${p.pizzas} pizza · ${p.kos} Foot ninjas knocked out · ${Math.floor(p.dist)} m · ` +
      `ran ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  function boardGroups(rows, score) {
    const { top, window: near } = resultSections(rows, score);
    if (near.length) return [top, near];
    const i = top.findIndex((r) => r.isYou && Math.round(r.score || 0) === score);
    return [top.map((r, k) => (k === i ? { ...r, isRun: true } : r))];
  }

  function restart() {
    runner.reset(); if (!seedParam) track.reset(Date.now() % 100000);
    renderer.resetCamera(); clearTaps();
    lives = RUN.LIVES; hud.setLives(lives);
    pendingDeath = false; resultT = -1; goT = 0;
    hud.hideGameOver(); hud.hideQuit(); hud.hideConfirm(); hud.setResultCountdown(0);
    document.getElementById('pause-overlay').classList.add('hidden'); document.getElementById('pause-button').classList.remove('on');
    state = State.COUNTDOWN; countdownT = RUN.COUNTDOWN_S;
    paused = false;
  }

  // ---------------------------------------------------------------- endings
  function die() {
    state = State.DEAD; pendingDeath = false;
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
  function endRunAndShowQuit() {
    hud.hideConfirm();
    state = State.QUIT; paused = false;
    hud.setCountdown(null);
    hud.showQuit(statsText());
    const score = runScore();
    submitRun(score).then(() => fetchBoard().then((board) => {
      if (state !== State.QUIT) return;
      hud.showBoard('quit', board, boardGroups(board.rows, score));
    }));
  }
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
  window.__gbBack = () => {
    if (hud.isQuitOpen()) return leaveToLobby();
    if (state !== State.RUNNING) return leaveToLobby();
    if (hud.isConfirmOpen()) return;
    if (isPauseOpen()) { pauseOverlay.classList.add('hidden'); pauseBtn.classList.remove('on'); }
    pausedBeforeConfirm = false; paused = true;
    hud.showConfirm();
  };
  document.getElementById('confirm-stay').addEventListener('click', (e) => { e.stopPropagation(); hud.hideConfirm(); paused = pausedBeforeConfirm; clearTaps(); });
  document.getElementById('confirm-quit').addEventListener('click', (e) => { e.stopPropagation(); endRunAndShowQuit(); });
  document.getElementById('quit-again').addEventListener('click', (e) => { e.stopPropagation(); restart(); });
  document.getElementById('quit-leave').addEventListener('click', (e) => { e.stopPropagation(); leaveToLobby(); });
  stage.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) e.target.closest('button').blur(); });

  // ---------------------------------------------------------------- pause
  // Button, Escape, or the page losing focus (a call, the app backgrounded) all
  // pause; only RESUME (or Escape) un-pauses, so a run never restarts by itself.
  const pauseBtn = document.getElementById('pause-button');
  const pauseOverlay = document.getElementById('pause-overlay');
  const isPauseOpen = () => !pauseOverlay.classList.contains('hidden');
  function openPause() {
    if (isPauseOpen() || hud.isConfirmOpen()) return;
    if (state !== State.RUNNING && state !== State.COUNTDOWN) return;
    paused = true; pauseOverlay.classList.remove('hidden'); pauseBtn.classList.add('on');
  }
  function closePause() {
    if (!isPauseOpen()) return;
    pauseOverlay.classList.add('hidden'); pauseBtn.classList.remove('on');
    paused = false; clearTaps();
  }
  pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); isPauseOpen() ? closePause() : openPause(); });
  pauseBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.getElementById('pause-resume').addEventListener('click', (e) => { e.stopPropagation(); closePause(); });
  document.getElementById('pause-quit').addEventListener('click', (e) => {
    e.stopPropagation(); pauseOverlay.classList.add('hidden'); pauseBtn.classList.remove('on');
    if (state === State.RUNNING) endRunAndShowQuit(); else leaveToLobby();
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !e.repeat) isPauseOpen() ? closePause() : openPause(); });
  addEventListener('blur', openPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) openPause(); });

  // ---------------------------------------------------------------- settings
  const settings = createSettingsPanel(document, { onSensitivity: setSensitivity });
  stage.appendChild(settings.button);
  stage.appendChild(settings.panel);

  // ---------------------------------------------------------------- dev tools
  // Hold the shells for 7 s, then the code; `?dev=1` skips it on a desktop.
  // P = autopilot (the fairness bot), I = invincible.
  const dbg = document.getElementById('dbg');
  let devOn = false, invincible = false;
  function mountDev() {
    if (devOn) return; devOn = true;
    dbg.classList.remove('hidden');
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') autopilot = !autopilot;
      if (e.code === 'KeyI') invincible = !invincible;
      if (e.code === 'KeyH') highRoad = !highRoad;       // autopilot takes the upper road
    });
    window.__tfd = {
      state: () => state, lives: () => lives, score: runScore, p: runner.p, track,
      setAutopilot: (v) => { autopilot = !!v; }, setHighRoad: (v) => { highRoad = !!v; }, setInvincible: (v) => { invincible = !!v; },
      skipCountdown: () => { countdownT = 0; }, thresholds,
      warp: (x) => {                                  // dev: jump ahead to test late-game content
        track.ensure(x + 160, -Infinity);
        const r = track.roofAt(x) || track.nextRoof(x); const q = runner.p;
        Object.assign(q, { x: track.roofAt(x) ? x : r.x0 + 1, y: r.y, roofY: r.y, vy: 0, grounded: true, wall: false });
        renderer.resetCamera();
      },
    };
  }
  installDevUnlock(document, document.getElementById('lives'), mountDev);
  if (/[?&]dev=1\b/.test(window.location.search || '')) mountDev();

  // ---------------------------------------------------------------- the loop
  hud.setLives(lives);
  let prev = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
    fitViewport();
    pollBoard();
    const live = !paused && state === State.RUNNING;
    let tapped = consumeTap();
    if (!live) tapped = null;
    if (live && autopilot) tapped = botWantsTap(runner, track, highRoad) || tapped;
    if (invincible) runner.p.invuln = Math.max(runner.p.invuln, 0.05);
    if (!paused && (state === State.COUNTDOWN || state === State.RUNNING)) {
      runner.frame(dt, tapped, live, live && !autopilot && inputHeld());
      if (state === State.COUNTDOWN) {
        countdownT -= dt;
        if (countdownT <= 0) { state = State.RUNNING; goT = 0.7; clearTaps(); }
        hud.setCountdown(state === State.COUNTDOWN ? String(Math.ceil(countdownT)) : 'GO!');
      } else if (goT > 0) { goT -= dt; if (goT <= 0) hud.setCountdown(null); }
      if (pendingDeath && !invincible) die();
    } else if (state === State.DEAD && resultT >= 0) {
      resultT -= dt;
      hud.setResultCountdown(Math.max(0, Math.ceil(resultT)));
      if (resultT <= 0) { resultT = -1; restart(); }
    }
    renderer.frame(paused ? 0 : dt);
    hud.setScore(runScore());
    if (devOn) {
      const p = runner.p;
      dbg.textContent = `state ${state}  x ${Math.round(p.x)}  speed ${p.speed.toFixed(1)}  ${p.grounded ? 'ground' : 'air'}  cam ${renderer.cam.mode} ${renderer.cam.dist.toFixed(1)}\n` +
        `jumps ${p.jumps}  falls ${p.falls}  hits ${p.hits}  autopilot ${autopilot ? 'ON' : 'off'} (P)  invincible ${invincible ? 'ON' : 'off'} (I)  board ${window.__gbSensor ? (+window.__gbSensor.x).toFixed(2) : 'none'} (press ${thresholds().press.toFixed(2)})`;
    }
  }
  requestAnimationFrame(tick);
}

boot();
