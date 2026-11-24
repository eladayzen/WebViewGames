// TMNT Wave Surf -- boot, the run's state machine, and the one game loop.
//
// ONE DOCUMENT, ONE LOOP. The prototype ran the wave in an iframe with its own
// rAF loop and passed state through window globals. Here a single
// requestAnimationFrame callback (through the index.html shim, so the host's
// __pumpFrames drives it on device) steps the rider, renders the wave into the
// WebGL canvas underneath, and draws the gameplay on the 2D canvas on top.
//
// THE RUN is a short campaign: mission brief -> countdown -> running -> boss KO
// -> mission complete -> next brief ... -> after the last mission, the board.
// Dying shows the result screen with a clock; quitting shows the board with no
// clock. Every ending banks the score, then shows the board.
import './style.css';
import { createWave } from './wave/wave.js';
import { createSurf } from './game/surf.js';
import { RUN, MISSIONS, MISSION, GAME } from './game/constants.js';
import happyUrl from './assets/mikey_happy.webp';
import surfUrl from './assets/mikey_surf.webp';
import bossUrl from './assets/boss.webp';
import yachtUrl from './assets/yacht_boss.webp';
import { installInput, pollBoard, holding, directKeys, setSensitivity, thresholds, control, takeBurst, clearBurst, inputMode, setInputMode, getAxis, setAxis } from './input/input.js';
import { createAxisCard } from './ui/axisCard.js';
import { createHud } from './ui/hud.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { installDevUnlock } from './ui/devUnlock.js';
import { createComic, preloadComic } from './ui/comic.js';
import { mountDevPanel, applyDefaultPreset } from './ui/devPanel.js';
import { submitRun, fetchBoard, resultSections } from './systems/scoreboard.js';

const State = { SETUP: 'setup', BRIEF: 'brief', COUNTDOWN: 'countdown', RUNNING: 'running', WON: 'won', DEAD: 'dead', QUIT: 'quit' };

function boot() {
  applyDefaultPreset();   // physics preset C, every boot
  const stage = document.getElementById('stage');
  const waveCanvas = document.getElementById('wave');
  const fx = document.getElementById('fx');
  const hud = createHud(document, RUN.LIVES, GAME.OOZE_LIVES);

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
  let state = State.BRIEF;
  let mission = 0;               // index into MISSIONS
  let koT = -1;                  // counts down after the boss KO, then the mission is won
  let cardT = 0, holdT = 0;      // the mission / win card: auto-advance clock, hold-to-continue
  let paused = false;            // the confirm modal freezes everything, wave included
  let pausedBeforeConfirm = false;
  let lives = RUN.LIVES;
  let waveT = 0;
  let countdownT = RUN.COUNTDOWN_S;
  let goT = 0;                   // "GO!" stays up briefly once the run starts
  let resultT = -1;              // death screen clock; -1 = not counting
  let pendingDeath = false;

  const surf = createSurf({
    canvas: fx, wave, control, takeBurst, inputMode, directKeys,
    hooks: {
      onBossKO() { if (state === State.RUNNING && koT < 0) koT = MISSION.KO_HOLD_S; },
      onOoze(on) {   // ooze power: the world goes ooze green; +3 lives on pickup
        wave.setTheme(on ? 'ooze' : 'toon');
        if (on && state === State.RUNNING) { lives = Math.min(RUN.LIVES + GAME.OOZE_LIVES, lives + GAME.OOZE_LIVES); hud.setLives(lives); }
        // when it wears off the 3 bonus lives go too -- but never below 2 (3 or fewer left -> 2)
        if (!on && state === State.RUNNING) { lives = Math.max(2, lives - GAME.OOZE_LIVES); hud.setLives(lives); }
      },
      onLife() { if (state === State.RUNNING && lives < RUN.LIVES) { lives++; hud.setLives(lives); } },
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

  function setPaused(next) {
    paused = !!next;
    document.getElementById('pause-button').classList.toggle('on', paused);
    document.getElementById('paused-overlay').classList.toggle('hidden', !paused);
  }
  /** The pause button: only while riding (countdown or run), never under the confirm modal. */
  function togglePause() {
    if (hud.isConfirmOpen() || !(state === State.COUNTDOWN || state === State.RUNNING)) return;
    setPaused(!paused);
  }
  for (const id of ['pause-button', 'resume-button']) {
    document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
    document.getElementById(id).addEventListener('pointerdown', (e) => e.stopPropagation());   // not a surf hold
  }
  document.getElementById('paused-overlay').addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) togglePause(); });

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
    comic.stop(); wave.setTheme('toon'); hud.setOoze(0);
    setPaused(false);
    showBrief(0);
  }

  // ---------------------------------------------------------------- missions
  const $ = (id) => document.getElementById(id);
  const missionEl = $('mission-overlay'), winEl = $('win-overlay');
  missionEl.querySelector('.m-hero').src = surfUrl; winEl.querySelector('.m-happy').src = happyUrl;
  /** One pip per mission: done ones ticked green, the current one lit. */
  function pips(el, cur, doneUpTo) {
    el.querySelector('.pips').innerHTML = MISSIONS.map((_, k) => `<i class="${k < doneUpTo ? 'done' : ''}${k === cur ? ' cur' : ''}"></i>`).join('');
  }
  const comic = createComic(document); preloadComic();
  function showBrief(i) {
    mission = i; const m = MISSIONS[i];
    wave.setDay(m.sky, i === 0 ? 0 : 3);   // first card cuts straight to its sky; later ones fade behind the card
    missionEl.querySelector('.m-boss').src = m.boss === 'yacht' ? yachtUrl : bossUrl;
    missionEl.querySelector('.m-boss').classList.toggle('wide', m.boss === 'yacht');
    pips(missionEl, i, i);
    winEl.classList.add('hidden'); missionEl.classList.add('hidden');
    hud.setCountdown(null);
    state = State.BRIEF; cardT = MISSION.BRIEF_SECONDS; holdT = 0; koT = -1;
    comic.play(m.intro, () => { if (state === State.BRIEF && mission === i) { missionEl.classList.remove('hidden'); holdT = 0; } });   // story first, then the card
  }
  function startMission() {
    if (state !== State.BRIEF) return;
    missionEl.classList.add('hidden');
    const f = MISSION.FIRST_BOSS_S;
    surf.setMission(MISSIONS[mission].boss, f[0] + Math.random() * (f[1] - f[0])); wave.setTheme('toon');
    lives = RUN.LIVES; hud.setLives(lives);   // every mission starts with full shells
    state = State.COUNTDOWN; countdownT = RUN.COUNTDOWN_S;
  }
  function missionWon() {
    koT = -1;
    const last = mission >= MISSIONS.length - 1;
    state = State.WON; cardT = MISSION.WIN_SECONDS; holdT = 0; hud.setCountdown(null);
    comic.play(MISSIONS[mission].outro, () => { if (state !== State.WON) return; if (last) campaignDone(); else showWinCard(); });
  }
  function showWinCard() {
    pips(winEl, mission, mission + 1);
    winEl.classList.remove('hidden');
    cardT = MISSION.WIN_SECONDS; holdT = 0;
  }
  /** The last boss is down: bank the score and show the board (the quit board, retitled). */
  function campaignDone() {
    state = State.QUIT;
    $('quit-title').textContent = 'ALL MISSIONS COMPLETE!';
    hud.setCountdown(null); hud.showQuit(statsText());
    const score = runScore();
    submitRun(score).then(() => fetchBoard().then((board) => {
      if (state !== State.QUIT) return;
      hud.showBoard('quit', board, boardGroups(board.rows, score));
    }));
  }
  function advanceCard() {
    if (comic.isOn()) return;
    if (state === State.BRIEF) startMission();
    else if (state === State.WON) showBrief(mission + 1);
  }
  $('mission-go').addEventListener('click', (e) => { e.stopPropagation(); advanceCard(); });
  $('win-go').addEventListener('click', (e) => { e.stopPropagation(); advanceCard(); });
  for (const el of [missionEl, winEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());   // a card press is not a surf hold
  addEventListener('keydown', (e) => { if ((e.code === 'Enter') && !e.repeat && (state === State.BRIEF || state === State.WON)) advanceCard(); });

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
    $('quit-title').textContent = 'RUN ENDED';
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
  const AXIS_ICON = { lr: 'M2 12 7 7v3h10V7l5 5-5 5v-3H7v3z', fb: 'M12 2 17 7h-3v10h3l-5 5-5-5h3V7H7z' };
  const settings = createSettingsPanel(document, {
    onSensitivity: setSensitivity,
    controls: { title: 'BOARD', get: getAxis, set: setAxis,
      options: [{ id: 'lr', label: 'Left / right', icon: AXIS_ICON.lr }, { id: 'fb', label: 'Forward / back', icon: AXIS_ICON.fb }] },
  });
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
    getInput: inputMode,
    toggleInput: () => setInputMode(inputMode() === 'burst' ? 'relative' : 'burst'),
  };
  function mountDev() {
    if (devPanel) return;
    devPanel = mountDevPanel(stage, devApi);   // starts hidden; the wrench in the chrome row opens it
    // Chrome row, right to left: X (12px), pause (70px), this wrench (128px, dev only), gear (186px).
    const devBtn = document.createElement('button');
    devBtn.id = 'dev-button'; devBtn.type = 'button'; devBtn.setAttribute('aria-label', 'Dev tools');
    devBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.7 19 13.6 9.9c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>';
    stage.appendChild(devBtn); stage.classList.add('dev-on');
    const showDev = (on) => { devPanel.setVisible(on); dbg.classList.toggle('hidden', !on); devBtn.classList.toggle('on', on); };
    devBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    devBtn.addEventListener('click', (e) => { e.stopPropagation(); showDev(!devPanel.isVisible()); });
    devPanel.onClose = () => showDev(false);
    addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') { wave.setTheme('toon'); devPanel.refreshSwitches(); }
      if (e.code === 'Digit2') { wave.setTheme('ooze'); devPanel.refreshSwitches(); }
      if (e.code === 'KeyB') surf.dev.summonBoss();
      if (e.code === 'KeyM' && state === State.RUNNING) missionWon();   // dev: skip to mission complete
      if (e.code === 'KeyN') surf.dev.summonJet();
      if (e.code === 'KeyC') { devApi.toggleMode(); devPanel.refreshSwitches(); }
      if (e.code === 'Backquote') devBtn.click();
    });
    // Scripted access for headless checks -- exists only once unlocked.
    window.__tws = {
      state: () => state, setAxis, getAxis, setInputMode, control, holding, lives: () => lives, score: runScore, paused: () => paused,
      rider: surf.dev.rider, spawnObstacle: surf.dev.spawnObstacle, spawnPicks: surf.dev.spawnPicks,
      summonBoss: surf.dev.summonBoss, koBoss: surf.dev.koBoss, game: () => surf.game, setNoSpawn: surf.dev.setNoSpawn, setTheme: devApi.setTheme, thresholds,
    };
  }
  installDevUnlock(document, document.getElementById('lives'), mountDev);
  // DEV_ON_BY_DEFAULT: Elad (2026-11-11) wants the physics dev panel open in the Unity build so he can
  // tune on the board. Flip to false before a player-facing release -> back to the hold + code unlock.
  const DEV_ON_BY_DEFAULT = true;
  if (DEV_ON_BY_DEFAULT || /[?&]dev=1\b/.test(window.location.search || '')) mountDev();

  // ---------------------------------------------------------------- the loop
  hud.setLives(lives);
  // every start opens on the board card (which lean drives the rider), then the first mission
  const axisCard = createAxisCard(document, surfUrl);
  let waitRelease = false;       // the lean that picked the axis must let go before it can skip the comic
  state = State.SETUP; hud.setCountdown(null);
  axisCard.show(() => { waitRelease = true; clearBurst(); showBrief(0); });
  const pauseBtn = document.getElementById('pause-button');
  let prev = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);   // first, so a throw below cannot end the loop
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
    fitViewport();
    pollBoard();
    pauseBtn.classList.toggle('idle', !(state === State.COUNTDOWN || state === State.RUNNING));
    wave.stepDay(dt);
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
      else if (koT >= 0 && state === State.RUNNING) { koT -= dt; if (koT <= 0) missionWon(); }
    } else if (state === State.SETUP) {
      waveT += dt;
      surf.frame(dt, W, H, waveT, false);
      axisCard.tick(dt);
    } else if (!paused && (state === State.BRIEF || state === State.WON)) {
      // the card is up: the wave keeps rolling behind it (nothing spawns, nothing scores)
      waveT += dt;
      surf.frame(dt, W, H, waveT, false);
      if (waitRelease && !holding()) waitRelease = false;
      holdT = holding() && !waitRelease ? holdT + dt : 0;
      if (comic.isOn()) { if (holdT >= 1.0) { holdT = 0; comic.skip(); } }   // the story: lines advance by themselves; a 1 s lean skips it
      else {
      cardT -= dt;                       // lean (or hold Space / press) for 1 s = the button
      const btn = state === State.BRIEF ? $('mission-go') : $('win-go');
      btn.style.setProperty('--hold', Math.min(1, holdT / 1.0).toFixed(3));
      btn.parentNode.style.setProperty('--t', Math.max(0, cardT / (state === State.BRIEF ? MISSION.BRIEF_SECONDS : MISSION.WIN_SECONDS)).toFixed(3));   // the ring runs down
      if (holdT >= 1.0 || cardT <= 0) advanceCard();
      }
    } else if (state === State.DEAD && resultT >= 0) {
      resultT -= dt;
      hud.setResultCountdown(Math.max(0, Math.ceil(resultT)));
      if (resultT <= 0) { resultT = -1; restart(); }
    }
    hud.setScore(runScore());
    hud.setOoze(surf.game.ooze / GAME.OOZE_DURATION);
    if (devPanel) dbg.textContent = surf.debugText + `\nstate ${state}${paused ? ' (paused)' : ''}   lives ${lives}   theme ${wave.getTheme()}   ctl ${surf.mode}   board ${window.__gbSensor ? (+window.__gbSensor.x).toFixed(2) : 'none'} (press ${thresholds().press.toFixed(2)}, axis ${getAxis()}, input ${inputMode()}${inputMode() === 'relative' ? ' ' + control().toFixed(2) : ''})`;
  }
  requestAnimationFrame(tick);
}

boot();
