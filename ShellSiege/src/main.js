// SHELL SIEGE -- phases 1 and 2: the plaza, and Raphael standing in it.
//
// WHAT THIS BUILD IS FOR. Not a game yet, and deliberately not pretending to
// be one. It answers three questions that cannot be answered from a desk and
// that everything later depends on:
//
//   1. Does the camera angle read? A fixed isometric pitch either makes a
//      crowd legible or it does not, and 50 degrees is a guess until someone
//      has stood on a board and looked at it.
//   2. Is a bright green turtle legible on this floor, while things are
//      happening on it? That is the one question the floor art exists to pass.
//   3. Does the lean still mean what the player thinks it means once the
//      camera is turned 45 degrees? See core/axes.js.
//
// THAT WAS THE PROTOTYPE. It has grown a campaign since: rooms you clear,
// a box that hands you one ability after each, levels that bank. The three
// questions above are still the ones that matter, and every system below is
// there to keep asking them for longer than a single encounter.
import * as THREE from 'three';
import { createWorld, updateWorld, __setSpeedSource, ARENA } from './core/world.js';
import { screenToWorld } from './core/axes.js';
import { initInput, readInput, TUNING } from './systems/input.js';
import { updateFiring, updateBullets, nearestTarget, BASE_GUN, DEV } from './systems/combat.js';
import { stepAngle, desiredFacing, AIM_RANGE_MUL } from './core/facing.js';
import { THROW } from './core/throwing.js';
import { localHeading } from './core/locomotion.js';
import { createTargets, updateTargets } from './systems/targets.js';
import { updateFoes, updateFoeShots, PLAYER_HP } from './core/foes.js';
import { createView, CAM } from './render/view.js';
import { createStage } from './render/stage.js';
import { createFx } from './render/fx.js';
import { createHeld } from './render/held.js';
import { FLOORS } from './render/floors.js';
import { THEMES, layoutObstacles, usedFloors } from './core/looks.js';
import { createFoes, loadEnemies } from './render/foes.js';
import { createDebris, loadDebris } from './render/debris.js';
import { createArrival } from './render/arrival.js';
import { showLobby } from './ui/lobby.js';
import { GAME_TITLE } from './core/brand.js';
import { createPowers } from './render/powers.js';
import { createGhost } from './render/ghost.js';
import { createMachines } from './render/machines.js';
import { createMachineUi } from './ui/machineUi.js';
import { updateMachines } from './core/machines.js';
import { updatePowers, noteKill, chainArc, rushMul, cooldownsOf } from './core/powers.js';
import { createTelegraphs } from './render/telegraph.js';
import { createSeeThrough } from './render/seethrough.js';
import { createAllies } from './render/allies.js';
import { updateAllies, updatePizzas } from './core/allies.js';
import { stats } from './core/abilities.js';
import { START, roomsIn } from './core/breeds.js';
import { clearTemp, createBuild } from './core/abilities.js';
import { createRun, stepRun, restartLevel, nextLevel, beginStartRoll, frozen } from './core/run.js';
import { enemiesLeft } from './core/rooms.js';
import { createRollUi } from './ui/roll.js';
import { pickChoice } from './core/roll.js';
import { createHud } from './ui/hud.js';
import { renderEnd, playRewind } from './ui/endscreen.js';
import { createTravel } from './ui/travel.js';
import { loadSave, saveProgress } from './systems/save.js';
import { looseOf, bankOnWin, bankOnDeath, pickToKeep, buildFromBank } from './core/bank.js';
import { createIris } from './ui/iris.js';
import { TRANS, irisOpen } from './core/transition.js';
import { loadRig } from './render/rig.js';
import { PX } from './render/units.js';

__setSpeedSource(() => TUNING.speedPxS);

const canvas = document.getElementById('game');
const view = createView(canvas);

function loadTex(url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
}

async function boot() {
  // EVERY FLOOR PAINTING A ROOM CAN USE, up front: swapping rooms is then a
  // pointer change under the black, not a decode the player could feel.
  const floorKeys = usedFloors();
  const [floorList, crate, shuriken, sai, enemies, debrisGeos, donnieHead] = await Promise.all([
    Promise.all(floorKeys.map((k) => loadTex(FLOORS[k].tex))),
    loadTex('tex/crate.webp'),
    loadTex('tex/shuriken.webp'),
    loadTex('tex/sai.webp'),
    loadEnemies(),
    loadDebris(),
    loadTex('tex/donnie_head.png'),
  ]);
  const floors = Object.fromEntries(floorKeys.map((k, i) => [k, floorList[i]]));
  const stage = createStage(view.scene, { floors });
  const foesFx = createFoes(view.scene, enemies);
  const debrisFx = createDebris(view.scene, debrisGeos);
  const telegraphs = createTelegraphs(view.scene);
  const fx = createFx(view.scene, { crate, shuriken, sai });
  const rig = await loadRig(view.scene);
  const arrival = createArrival(view.scene, rig);
  const powersFx = createPowers(view.scene);
  const ghostFx = await createGhost(view.scene, rig);
  const machinesFx = createMachines(view.scene, { crate, head: donnieHead });
  const machineUi = createMachineUi(view.camera);
  // After the rig, because the blades are parented to its hand bones.
  const seeThrough = createSeeThrough(view.camera);
  const alliesFx = await createAllies(view.scene, rig);
  const heldFx = createHeld(rig, { shuriken, sai }, view.camera);

  const clips = await rig.loadClips();
  if (!rig.hasWalks()) console.warn('no four-way walk set; rig will not animate', clips);

  const w = createWorld();
  // WHAT YOU KEEP: the permanent abilities from your last session (systems/save.js). Not for the
  // test rooms (?kit=) and not with ?fresh=1, which starts from nothing.
  // THE BANK (core/bank.js): what is saved. Permanent abilities are held loose during a run and
  // only banked when a level is cleared (all of them) or you die (one pick).
  let bank = {};
  let persist = true;
  let unlocked = 1;           // the furthest level reached: the level picker offers 1..this
  let savedRun = null;        // the run left in progress, for the lobby's CONTINUE
  {
    const q = new URLSearchParams(location.search);
    persist = !q.get('kit') && !q.get('fresh');
    if (persist) {
      const saved = await loadSave();
      savedRun = saved.run;
      unlocked = Math.max(saved.unlocked || 1, saved.run ? saved.run.level : 1);
      const kept = saved.perm;
      bank = { ...kept };
      for (const [k, c] of Object.entries(kept)) w.build[k] = Math.max(w.build[k] || 0, c);
    }
  }
  w.targets = createTargets();
  // The crates never leave the array once laid out, so hold them here rather
  // than filtering `w.targets` by kind on every frame: the foes share it now.
  let crates = w.targets.slice();
  initInput();

  document.getElementById('boot')?.remove();

  document.title = GAME_TITLE;
  const hurtEl = document.getElementById('hurt');
  const hudTime = document.getElementById('hud-time');
  const hudSrc = document.getElementById('hud-src');
  const hudHits = document.getElementById('hud-hits');
  let hits = 0;
  let paused = false;

  document.getElementById('pause-button')?.addEventListener('click', () => {
    paused = !paused;
    document.getElementById('paused-overlay')?.classList.toggle('hidden', !paused);
  });
  document.getElementById('resume-button')?.addEventListener('click', () => {
    paused = false;
    document.getElementById('paused-overlay')?.classList.add('hidden');
  });

  // --- losing, and going again ------------------------------------------
  const overlay = document.getElementById('gameover-overlay');
  const hpFill = document.getElementById('hp-fill');
  const hudKills = document.getElementById('hud-kills');
  const finalScore = document.getElementById('final-kills');

  const rollUi = createRollUi();
  const travelUi = createTravel();
  rollUi.onPick = (i) => pickChoice(run.roll, i);
  const hud = createHud();
  const iris = createIris();
  const irisAt = new THREE.Vector3();
  // Real seconds of slow motion still to run after the last kill. See core/transition.js.
  let slowT = 0;

  /**
   * WHERE YOU ARE IN THE CAMPAIGN. The run is pure state (core/run.js); this
   * file only reacts to what it reports. `?level=` and `?room=` start partway
   * in, so one room can be looked at without clearing the ones before it.
   */
  // THE A/B (Elad, 24 Nov): every OTHER room-end box is a pick between two. ?choice=off = always random, ?choice=always = always a pick.
  const CHOICE = ['off', 'always'].includes(new URLSearchParams(location.search).get('choice')) ? new URLSearchParams(location.search).get('choice') : 'alt';
  let run = createRun({ level: START.level, room: START.room, choice: CHOICE });

  /**
   * PUT A ROOM'S LOOK ON THE SCREEN AND ITS OBSTACLES IN THE WORLD, from the one
   * list, so what you see is exactly what stops you. Called when a room begins
   * -- which is while the iris is still closed, so nothing visibly changes --
   * and again after a restart, which rebuilds the world and so empties it.
   */
  function applyLook(look) {
    const theme = THEMES[look.theme];
    w.obstacles = layoutObstacles(look.layout);
    stage.setTheme(theme);
    stage.setObstacles(w.obstacles, theme);
  }
  applyLook(run.room.look);

  /** Health scales with THICK HIDE, and picking one heals exactly what it added. */
  function syncMaxHp(st, full = false) {
    const m = Math.max(1, Math.round(PLAYER_HP * st.maxHpMul));
    if (m !== w.maxHp) {
      const gained = m - w.maxHp;
      w.maxHp = m;
      w.hp = full ? m : Math.min(m, w.hp + Math.max(0, gained));
    } else if (full) {
      w.hp = m;
    }
  }

  /** Put the iris on the turtle, wherever he is on screen right now. */
  function updateIris() {
    const open = irisOpen(run);
    if (open >= 1) { iris.set(1, 0, 0); return; }
    irisAt.set(w.player.x / PX, 0.9, w.player.y / PX).project(view.camera);
    iris.set(open, (irisAt.x * 0.5 + 0.5) * window.innerWidth, (-irisAt.y * 0.5 + 0.5) * window.innerHeight);
  }

  function announceRoom() {
    // remember where this run is, so the lobby can offer CONTINUE next time (death or a cleared level end it)
    unlocked = Math.max(unlocked, run.level);
    if (persist) saveProgress(bank, { level: run.level, room: run.roomIdx, build: w.build }, unlocked);
    arrival?.start();                       // every room opens with the turtle teleporting in
    hud.peekUpgrades();                     // HUD option 1: Raphael's upgrades show for a moment, then go
    const n = run.roomIdx + 1;
    // Level on the first line, room on the second: small and plain, so it does not hide the turtle.
    hud.say(`LEVEL ${run.level}`, run.room.isLast ? 'FINAL ROOM' : `ROOM ${n}`, true);
  }

  /** ONE CARD FOR BOTH ENDINGS: the SDK's restart contract is this overlay and button. */
  function showEnd(kind) {
    if (!overlay) return;
    const btn = document.getElementById('restart-button');
    if (btn) btn.textContent = kind === 'won' ? 'NEXT LEVEL' : 'GO AGAIN';
    // BANK NOW: a level clear banks every permanent ability; a death banks one pick.
    const loose = looseOf(w.build, bank);
    const keptPick = kind === 'won' ? null : pickToKeep(w.build, bank);
    const newBank = kind === 'won' ? bankOnWin(bank, w.build) : bankOnDeath(bank, w.build);
    // WHERE THE RUN ENDED, for the map: the room reached plus the share of its enemies already down
    const frac = Math.max(0, Math.min(1, 1 - enemiesLeft(w, run.room) / Math.max(1, run.room.total)));
    const playEnd = renderEnd(kind, { progress: kind === 'won' ? null : { t: run.roomIdx + frac }, build: w.build, bank: newBank, oldBank: bank, loose, keptPick, level: run.level, rooms: run.rooms });
    bank = newBank;
    if (kind === 'won') unlocked = Math.max(unlocked, run.level + 1);      // clearing a level opens the next
    if (persist) saveProgress(bank, null, unlocked);
    if (finalScore) finalScore.textContent = String(kills);
    hud.hideBanner();
    overlay.classList.remove('hidden');
    if (playEnd) requestAnimationFrame(() => playEnd({ celebrate: () => hud.celebrate() }));      // the flight needs the card on screen to measure it
  }

  /** What a run event looks like on screen. The run itself never touches the DOM. */
  function onRunEvent(e) {
    if (e.type === 'cleared') {
      // THE MOMENT. A beat of slow motion and a white pop on the last kill, the
      // banner with the count, and then (from core/transition.js, driven by the
      // run's own clock) the iris closes on the turtle.
      slowT = e.last ? TRANS.slowS * 2.5 : TRANS.slowS;
      hud.flash();
      hud.say(e.last ? 'LEVEL CLEAR' : 'ROOM CLEAR', `${kills} down`);
      if (e.last) hud.celebrate();            // confetti over the field: a level is a bigger moment than a room
    }
    else if (e.type === 'rollStart') { travelUi.hide(); if (!e.roll.done) rollUi.open(e.roll, { black: !!e.start, build: w.build, bank }); }
    else if (e.type === 'rollDone') { rollUi.close(); }
    else if (e.type === 'travelStart') { travelUi.show(e); }
    else if (e.type === 'roomStart') { travelUi.hide(); applyLook(run.room.look); announceRoom(); }
    else if (e.type === 'won') showEnd('won');
  }

  /**
   * Put the run back WITHOUT reloading the page.
   *
   * WHAT SURVIVES: a death restarts the level from the BANK (core/bank.js) -- the permanent
   * abilities banked by earlier clears plus one pick -- and loses every temporary ability. A WON
   * level goes on to the next one with everything it holds.
   */
  function restart(forceNew = false, startLevel = 1) {
    const keepBuild = w.build;
    const won = !forceNew && run.phase === 'won';
    Object.assign(w, createWorld());
    // A won level keeps EVERYTHING (the permanent ones are banked now, the temporary ones carry on).
    // A death restarts from the BANK alone: the temporary ones are gone and the loose ones with them.
    w.build = won ? keepBuild : persist ? buildFromBank(bank, createBuild) : clearTemp(keepBuild);
    syncMaxHp(stats(w.build), true);
    w.targets = createTargets();
    crates = w.targets.slice();
    hits = 0;
    kills = 0;
    run = forceNew ? createRun({ level: startLevel, choice: CHOICE }) : won ? nextLevel(run) : restartLevel(run);
    applyLook(run.room.look);
    rollUi.close(); travelUi.hide();
    slowT = 0;
    hud.hideBanner();
    // Hide the pool immediately, or the last frame's bodies are still standing
    // there behind the overlay when it fades.
    foesFx.syncFoes([], 0, 0);
    alliesFx.sync([], 0, 0, []);
    telegraphs.sync([], [], 0);
    overlay?.classList.add('hidden');
    // THE FREE START POWER: over black, one quick roll, and THEN the room begins. The roll
    // freezes the world (frozen(run)); when it ends the run enters room 1 as usual.
    const startEv = beginStartRoll(run, w);
    if (startEv.length) for (const e of startEv) onRunEvent(e);
    else announceRoom();
  }
  let rewinding = false;
  document.getElementById('restart-button')?.addEventListener('click', async () => {
    if (rewinding) return;
    // after OVERRUN the screen stays: only the progression map is left, and the turtle runs back to room 1
    if (w.dead && overlay?.querySelector('.over-card.dead')) {
      rewinding = true;
      await playRewind(run.level);
      rewinding = false;
      overlay.querySelector('.over-card')?.classList.remove('rewinding');
    }
    restart();
  });

  // --- LEAVING: X during play asks first, then goes to the LOBBY; the X in the lobby leaves for the
  // GoBalance lobby (that one is the page's own handler, so here it is simply let through).
  const quitEl = document.getElementById('quit-confirm');
  let confirmOpen = false, pausedBeforeConfirm = false;
  async function goLobby() {
    const endShown = !!overlay && !overlay.classList.contains('hidden');
    paused = true;
    let snap;
    if (endShown) {      // the run just ended: the lobby offers the next one (same level after a death, the next after a win)
      const wonRun = run.phase === 'won';
      snap = { level: wonRun ? run.level + 1 : run.level, room: 0, build: wonRun ? w.build : (persist ? buildFromBank(bank, createBuild) : w.build) };
    } else {
      snap = { level: run.level, room: run.roomIdx, build: w.build };
      if (persist) saveProgress(bank, snap, unlocked);
    }
    const pick = await showLobby({ run: { ...snap, rooms: roomsIn(snap.level - 1) }, bank, unlocked, midGame: true });
    paused = false;
    if (pick.choice === 'new') restart(true, pick.level);
    else if (endShown) restart();
  }
  document.addEventListener('click', (e) => {
    if (!(e.target.closest && e.target.closest('#gb-back'))) return;
    if (document.body.classList.contains('in-lobby')) return;            // the lobby's X: let the host take it
    e.preventDefault(); e.stopImmediatePropagation();
    if (confirmOpen) return;
    confirmOpen = true; pausedBeforeConfirm = paused; paused = true;
    quitEl?.classList.remove('hidden');
  }, true);
  document.getElementById('quit-stay')?.addEventListener('click', () => { quitEl?.classList.add('hidden'); confirmOpen = false; paused = pausedBeforeConfirm; });
  document.getElementById('quit-leave')?.addEventListener('click', () => { quitEl?.classList.add('hidden'); confirmOpen = false; goLobby(); });
  // THE VERY FIRST RUN OPENS WITH THE FREE POWER TOO (Elad: "too boring too quick"): a game-changer
  // before the first fight. Not in test rooms (?kit=) or ?fresh=1, which start from a chosen state.
  {
    const q = new URLSearchParams(location.search);
    const normal = !q.get('kit') && !q.get('fresh') && !q.get('room');
    let choice = 'new', pick = { choice: 'new', level: 1 };
    if (normal) {
      paused = true;                                     // the world waits behind the lobby
      pick = await showLobby({ run: savedRun && { ...savedRun, rooms: roomsIn(savedRun.level - 1) }, bank, unlocked });
      choice = pick.choice;
      paused = false;
    }
    if (normal && choice === 'continue' && savedRun) {
      for (const [k, n] of Object.entries(savedRun.build)) w.build[k] = Math.max(w.build[k] || 0, n);
      syncMaxHp(stats(w.build), true);
      run = createRun({ level: pick.level, room: pick.room ?? savedRun.room, choice: CHOICE });      // LOAD GAME may restart from any door it reached
      applyLook(run.room.look);
      announceRoom();
    } else {
      if (normal && pick.level > 1) { run = createRun({ level: pick.level, choice: CHOICE }); applyLook(run.room.look); }
      const startEv = normal ? beginStartRoll(run, w) : [];
      if (startEv.length) for (const e of startEv) onRunEvent(e);
      else announceRoom();
    }
  }

  let last = performance.now();
  let muzzleY = 1.1;
  let kills = 0;
  let allyHooksRef = {};
  // HUD LAYOUT (Elad, 24 Nov): ?hud=2 (default) upgrades on the RIGHT and abilities on the LEFT, always shown;
  // ?hud=1 abilities along the bottom, upgrades only at the start of each room.
  document.body.classList.add(new URLSearchParams(location.search).get('hud') === '2' ? 'hud-2' : 'hud-1');
  // DEV OPTION: aim the daggers at enemy projectiles (off by default). ?aimshots=1 or the button in the dev panel.
  {
    DEV.aimShots = new URLSearchParams(location.search).get('aimshots') === '1';      // always OFF at load unless asked: option 1 is the default
    const btn = document.getElementById('dev-aimshots');
    const paint = () => { if (btn) btn.textContent = `aim at shots: ${DEV.aimShots ? 'ON' : 'off'}`; };
    paint();
    btn?.addEventListener('click', () => { DEV.aimShots = !DEV.aimShots; paint(); });
  }
  // "enemies left" is centred under the health BAR itself (which is not at the middle of the screen: the kill count sits beside it)
  {
    const hpW = document.getElementById('hp-wrap'), el = document.getElementById('enemies-left');
    const centre = () => { if (!hpW || !el) return; const r = hpW.getBoundingClientRect(); if (!r.width) return; const z = 0.9; /* the CSS zoom on #enemies-left */ el.style.transform = 'none'; const ew = el.getBoundingClientRect().width; const want = r.left + r.width / 2 - ew / 2; el.style.left = (want / z).toFixed(1) + 'px'; const got = el.getBoundingClientRect().left; if (got > 1 && Math.abs(got - want) > 1) el.style.left = (parseFloat(el.style.left) * want / got).toFixed(1) + 'px'; };      /* zoom makes the px unit unreliable: measure and correct */
    centre(); setInterval(centre, 400); addEventListener('resize', centre);
  }
  // THE RANGE RING (Elad, 25 Nov): a thin white circle round Raphael, all the time, at the reach of the main weapon.
  const rangeRing = (() => {
    const pts = []; for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
    const m = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, fog: false }));
    m.position.y = 0.07; m.renderOrder = 5; m.frustumCulled = false; m.material.opacity = 0.95;
    // a faint dark twin just outside it, so the white line still reads on a light floor
    const shade = new THREE.LineLoop(m.geometry, new THREE.LineBasicMaterial({ color: 0x14210f, transparent: true, opacity: 0.35, fog: false }));
    shade.scale.setScalar(1.006); shade.renderOrder = 4; shade.frustumCulled = false;
    m.add(shade);
    view.scene.add(m);
    return m;
  })();
  let hurtFlashOn = false;
  // DOM writes only when the value CHANGED: assigning textContent or a style every frame restyles the page
  // whether or not anything differs, and on a phone that is a real share of the frame.
  const seen = {};
  const setStyle = (id, el, prop, v) => { if (seen[id] !== v) { seen[id] = v; el.style[prop] = v; } };
  const setText = (id, el, v) => { if (seen[id] !== v) { seen[id] = v; el.textContent = v; } };
  const hudPanel = document.getElementById('hud');
  const hudHidden = () => !hudPanel || hudPanel.classList.contains('hidden');       // the ally hooks of the latest frame, for the dagger-hit arcs

  function frame(now) {
    requestAnimationFrame(frame);
    // Clamped: a WebView that was backgrounded hands back a dt measured in
    // seconds, and an unclamped step teleports everything through everything.
    const realDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // SLOW MOTION IS A SCALE ON THE SIMULATION'S CLOCK ONLY. The camera and the
    // slow-motion countdown itself keep real time, or the beat would last as
    // long again as it was meant to and the camera would lag behind the action.
    const dt = realDt * (slowT > 0 ? TRANS.slowScale : 1);
    if (slowT > 0) slowT = Math.max(0, slowT - realDt);

    // THE BOX FREEZES THE WORLD, and nothing else. It runs by itself -- there is
    // no lean to wait for, which is the point of having replaced the choice
    // screen, and also why a whole level can now be played unattended. Input
    // is still sampled so the smoothing does not go stale across the pause.
    if (frozen(run)) {
      const ln = readInput(dt);
      if (!paused) for (const e of stepRun(run, w, dt)) onRunEvent(e);
      if (frozen(run) && run.roll && run.phase === 'roll') rollUi.update(run.roll, ln, dt);
      updateIris();
      view.renderer.render(view.scene, view.camera);
      return;
    }

    if (!paused && !w.dead) {
      const lean = readInput(dt);
      const dir = screenToWorld(lean, CAM.yaw);
      const was = { x: w.player.x, y: w.player.y };
      updateWorld(w, dir, dt);

      // HOW FAST HE ACTUALLY WENT, not how hard the player leaned. The two
      // differ whenever he is held against a wall, and a character jogging on
      // the spot into a wall is the classic tell of animating the input
      // instead of the motion.
      const moved = Math.hypot(w.player.x - was.x, w.player.y - was.y);
      const speedPxS = dt > 0 ? moved / dt : 0;
      const movingNow = speedPxS > 1;

      // THE BODY FACES WHAT IT IS SHOOTING AT. Same targeting call the gun
      // makes, so the two can never disagree about what he is aiming at --
      // a body pointed at one crate while the stars fly at another is worse
      // than no aiming at all. Fourteen crates, one linear scan; when the
      // horde lands this is the place to hand both a single result.
      const st = { ...stats(w.build), weapon: BASE_GUN.weapon };
      {   // ADRENALINE: kills stack a faster throw (core/powers.js)
        const rm = rushMul(w);
        if (rm !== 1) { st.fireIntervalS /= rm; if (st.stars) st.stars = { ...st.stars, intervalS: st.stars.intervalS / rm }; }
      }
      w.speedMul = st.speedMul;
      rangeRing.position.x = w.player.x / PX; rangeRing.position.z = w.player.y / PX; rangeRing.scale.setScalar(st.rangePx / PX);
      syncMaxHp(st);
      const aimAt = nearestTarget(w, st.rangePx * AIM_RANGE_MUL);
      const want = desiredFacing(w.player, aimAt, movingNow, w.bodyFacing);
      w.bodyFacing = stepAngle(w.bodyFacing, want, dt);

      // THE THROW STARTS BEFORE THE SHOT, not on it. `w.fireT` is a countdown
      // the sim already keeps, so the next shot is not a surprise: opening the
      // window `preS` early puts the hand's release -- measured, not guessed,
      // see tools/extract-clips.mjs -- on the same frame the star appears.
      // Triggering on the shot instead would play the entire wind-up after the
      // star had already gone, which is the thing that reads as broken.
      // ONLY WHEN A DAGGER IS ACTUALLY IN THE QUIVER: with every dagger out the gun holds fireT at the full
      // interval, and once that interval is shorter than the window (Rapid Throw, Adrenaline) the
      // throw animation would otherwise re-open every frame with nothing to throw.
      const daggersOut = w.bullets.reduce((n, b) => n + (b.alive && b.kind !== 'star' ? 1 : 0), 0);
      if (aimAt && daggersOut < (st.quiver ?? st.projectiles) && w.fireT <= THROW.preS) {
        const d = Math.hypot(aimAt.x - w.player.x, aimAt.y - w.player.y);
        // The aim radius is wider than the gun's, so being aimed at something
        // is not the same as being able to hit it. Only a shot that is really
        // coming gets an animation.
        if (d <= st.rangePx) rig.startThrow(Math.max(0, THROW.preS - Math.max(0, w.fireT)));
      }
      // THE NINJA STARS HAVE THEIR OWN CLOCK, so they get their own throw too: the same animation,
      // opened `preS` before each volley so the release lands on the frame the stars leave.
      if (st.stars && (w.starT ?? 0) <= THROW.preS && nearestTarget(w, st.stars.rangePx)) {
        rig.startThrow(Math.max(0, THROW.preS - Math.max(0, w.starT ?? 0)));
      }

      // THE RIG IS PLACED BEFORE THE GUN FIRES. Survivor learned this the
      // hard way: firing first spawns the volley from where the hand was on
      // the previous frame, which at a full lean is a visible error and is
      // worst exactly when the player is watching the character.
      rig.place(w.player.x, w.player.y, w.bodyFacing);
      rig.setLocomotion(
        speedPxS / PX,
        movingNow ? localHeading(w.player.facing, w.bodyFacing) : 0,
        dt,
      );
      rig.update(dt);
      arrival.update(dt);
      const m = rig.muzzle();
      if (m) {
        w.muzzle = { x: m.x * PX, y: m.z * PX };
        muzzleY = m.y;
      }

      updateFiring(w, st, dt);
      updateBullets(w, dt, (t) => {
        hits++;
        if (t.kind === 'foe') chainArc(w, t, st.damage, allyHooksRef);      // CHAIN LIGHTNING
        if (t.kind === 'foe' && !t.alive) {
          kills++; noteKill(w);
          // The burst goes here rather than in the renderer because this is
          // the one place that knows a kill JUST happened, as opposed to
          // "is dead", which is true on every frame afterwards.
          debrisFx.burst(t.x, t.y, Math.min(2, (t.radius || 44) / 44));
        }
        fx.spark(t.x, t.y, 0.6);
      }, (sh) => fx.spark(sh.x, sh.y, 0.9));      // a dagger cut an enemy projectile
      updateTargets(w, dt);

      // THE OTHER TURTLES act after the player's own blades and before the foes step,
      // so what they kill this frame is dead before the room is asked if it is cleared.
      // A kill by an ally counts exactly like one of the player's: the counter and the burst.
      const allyHooks = {
        onKill: (f) => { kills++; noteKill(w); debrisFx.burst(f.x, f.y, Math.min(2, (f.radius || 44) / 44)); },
        onHit: (f) => fx.spark(f.x, f.y, 0.5),
        onPizza: (z) => { fx.spark(z.x, z.y, 1.2); hud.flash(); },
      };
      allyHooksRef = allyHooks;
      if (!frozen(run)) { updateAllies(w, dt, allyHooks); updatePizzas(w, dt, allyHooks); if (run.phase === 'fight') updatePowers(w, dt, allyHooks); updateMachines(w, dt, run.phase === 'fight', allyHooks); }

      // THE ROOM RUNS FIRST, so a new arrival gets a frame of walking before
      // anything looks at it, and so a room whose last enemy fell to this
      // frame's bullets is seen as cleared on THIS frame -- then the foes step,
      // and the strike is committed inside updateFoes, on the release frame of
      // its own windup.
      for (const e of stepRun(run, w, dt)) onRunEvent(e);
      updateFoes(w, dt, () => fx.spark(w.player.x, w.player.y, 0.9));
      updateFoeShots(w, dt, () => fx.spark(w.player.x, w.player.y, 0.9));

      if (w.dead && overlay?.classList.contains('hidden')) showEnd('dead');

      view.follow(w.camera.x, w.camera.y, realDt);
      stage.update(w.timeS);
      fx.syncCrates(crates, w.timeS);
      foesFx.syncFoes(w.foes, w.timeS, dt, seeThrough.update(w.foes, w.player, w.foeShots));
      alliesFx.sync(w.allies, w.timeS, dt, w.pizzas, w.shield, w.player, w.grenades);
      telegraphs.sync(w.foes, w.foeShots, w.timeS);
      powersFx.sync(w, w.timeS);
      ghostFx.sync(w.decoy, w.timeS, dt);
      machinesFx.sync(w, w.timeS);
      machineUi.sync(w);
      fx.syncShots(w.bullets, w.timeS, muzzleY);
      // After the rig has been posed and after updateFiring, so the hand is
      // emptied on the same frame the blade it threw first appears.
      // the spare dagger in the hand: only with twin daggers, and only while one is still in the quiver
      heldFx.sync(rig, { quiver: st.quiver, out: w.bullets.reduce((n, b) => n + (b.alive && b.kind !== 'star' ? 1 : 0), 0) });
      fx.updateSparks(dt);
      debrisFx.update(dt);

      {   // GETTING HIT: a red vignette, and the turtle flashes (core/foes.js sets w.hurtT on each hit)
        const k = Math.min(1, (w.hurtT || 0) / 0.35);
        if (hurtEl) setStyle('hurt', hurtEl, 'opacity', String(Math.round(k * 0.95 * 50) / 50));
        // walk the rig's meshes only while the flash is live (and once more to clear it), not every frame
        if (k > 0 || hurtFlashOn) {
          hurtFlashOn = k > 0;
          rig.model.traverse((o) => {
            if (!o.isMesh || !o.material.emissive) return;
            const b = o.material.userData.baseEm || (o.material.userData.baseEm = o.material.emissive.clone());
            o.material.emissive.setRGB(b.r + k * 0.9, b.g + k * 0.15, b.b + k * 0.12);
          });
        }
      }
      hud.setAbilities(w.build, bank);
      hud.setAllyTimers(w.allies);
      hud.setCooldowns(cooldownsOf(w, st));
      if (hpFill) setStyle('hp', hpFill, 'width', Math.max(0, Math.round((w.hp / w.maxHp) * 1000) / 10) + '%');
      hud.setRooms(run.roomIdx, run.rooms,
        run.phase === 'cleared' || run.phase === 'roll' || run.phase === 'won');
      hud.setLeft(enemiesLeft(w, run.room), run.phase === 'fight');
      if (hudKills) setText('kills', hudKills, String(kills));
      if (hudTime && !hudHidden()) setText('time', hudTime, w.timeS.toFixed(1) + 's');
      if (hudSrc && !hudHidden()) setText('src', hudSrc, lean.source);
      if (hudHits && !hudHidden()) setText('hits', hudHits, String(hits));
    }

    updateIris();
    view.renderer.render(view.scene, view.camera);
  }
  requestAnimationFrame(frame);

  // Handy while tuning from a desk.
  window.__ss = { arrival,
    w, view, stage, rig, fx, heldFx, showEnd, get bank() { return bank; }, foesFx, debrisFx, telegraphs, restart, floors: FLOORS, ARENA,
    hud, rollUi, get run() { return run; }, get stats() { return stats(w.build); },
  };
}

boot().catch((e) => {
  if (window.Unity) window.Unity.call('BOOT FAILED: ' + e.message);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'boot failed: ' + e.message;
  throw e;
});
