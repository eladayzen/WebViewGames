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
import { updateFiring, updateBullets, nearestTarget, BASE_GUN } from './systems/combat.js';
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
import { createTelegraphs } from './render/telegraph.js';
import { createSeeThrough } from './render/seethrough.js';
import { createAllies } from './render/allies.js';
import { updateAllies } from './core/allies.js';
import { clearTemp } from './core/abilities.js';
import { stats } from './core/abilities.js';
import { START } from './core/breeds.js';
import { createRun, stepRun, restartLevel, nextLevel, beginStartRoll, frozen } from './core/run.js';
import { enemiesLeft } from './core/rooms.js';
import { createRollUi } from './ui/roll.js';
import { createHud } from './ui/hud.js';
import { renderEnd } from './ui/endscreen.js';
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
  const [floorList, crate, shuriken, sai, enemies, debrisGeos] = await Promise.all([
    Promise.all(floorKeys.map((k) => loadTex(FLOORS[k].tex))),
    loadTex('tex/crate.webp'),
    loadTex('tex/shuriken.webp'),
    loadTex('tex/sai.webp'),
    loadEnemies(),
    loadDebris(),
  ]);
  const floors = Object.fromEntries(floorKeys.map((k, i) => [k, floorList[i]]));
  const stage = createStage(view.scene, { floors });
  const foesFx = createFoes(view.scene, enemies);
  const debrisFx = createDebris(view.scene, debrisGeos);
  const telegraphs = createTelegraphs(view.scene);
  const fx = createFx(view.scene, { crate, shuriken, sai });
  const rig = await loadRig(view.scene);
  // After the rig, because the blades are parented to its hand bones.
  const seeThrough = createSeeThrough(view.camera);
  const alliesFx = await createAllies(view.scene, rig);
  const heldFx = createHeld(rig, { shuriken, sai }, view.camera);

  const clips = await rig.loadClips();
  if (!rig.hasWalks()) console.warn('no four-way walk set; rig will not animate', clips);

  const w = createWorld();
  w.targets = createTargets();
  // The crates never leave the array once laid out, so hold them here rather
  // than filtering `w.targets` by kind on every frame: the foes share it now.
  let crates = w.targets.slice();
  initInput();

  document.getElementById('boot')?.remove();

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
  let run = createRun({ level: START.level, room: START.room });

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
    const n = run.roomIdx + 1;
    if (run.room.isLast) hud.say('FINAL ROOM', `LEVEL ${run.level}  \u00b7  BOSS`);
    else hud.say(`ROOM ${n}`, `LEVEL ${run.level}  \u00b7  ${n} / ${run.rooms}`);
  }

  /** ONE CARD FOR BOTH ENDINGS: the SDK's restart contract is this overlay and button. */
  function showEnd(kind) {
    if (!overlay) return;
    const btn = document.getElementById('restart-button');
    if (btn) btn.textContent = kind === 'won' ? 'NEXT LEVEL' : 'GO AGAIN';
    renderEnd(kind, { build: w.build, level: run.level, rooms: run.rooms });
    if (finalScore) finalScore.textContent = String(kills);
    hud.hideBanner();
    overlay.classList.remove('hidden');
  }

  /** What a run event looks like on screen. The run itself never touches the DOM. */
  function onRunEvent(e) {
    if (e.type === 'cleared') {
      // THE MOMENT. A beat of slow motion and a white pop on the last kill, the
      // banner with the count, and then (from core/transition.js, driven by the
      // run's own clock) the iris closes on the turtle.
      slowT = TRANS.slowS;
      hud.flash();
      hud.say(e.last ? 'LEVEL CLEAR' : 'ROOM CLEAR', `${kills} down`);
    }
    else if (e.type === 'rollStart') { if (!e.roll.done) rollUi.open(e.roll, { black: !!e.start }); }
    else if (e.type === 'rollDone') rollUi.close();
    else if (e.type === 'roomStart') { applyLook(run.room.look); announceRoom(); }
    else if (e.type === 'won') showEnd('won');
  }

  /**
   * Put the run back WITHOUT reloading the page.
   *
   * THE BUILD IS KEPT. Every ability is permanent today, and the design is
   * that permanent stats survive a death -- so dying costs the rooms cleared
   * on this level and nothing else, and a player who keeps falling over comes
   * back stronger each time. A WON level goes on to the next one instead.
   */
  function restart() {
    const keepBuild = w.build;
    const won = run.phase === 'won';
    Object.assign(w, createWorld());
    w.build = won ? clearTemp(keepBuild) : keepBuild;     // a won level takes the turtle allies with it
    syncMaxHp(stats(w.build), true);
    w.targets = createTargets();
    crates = w.targets.slice();
    hits = 0;
    kills = 0;
    run = won ? nextLevel(run) : restartLevel(run);
    applyLook(run.room.look);
    rollUi.close();
    slowT = 0;
    hud.hideBanner();
    // Hide the pool immediately, or the last frame's bodies are still standing
    // there behind the overlay when it fades.
    foesFx.syncFoes([], 0, 0);
    alliesFx.sync([], 0, 0);
    telegraphs.sync([], [], 0);
    overlay?.classList.add('hidden');
    // THE FREE START POWER: over black, one quick roll, and THEN the room begins. The roll
    // freezes the world (frozen(run)); when it ends the run enters room 1 as usual.
    const startEv = beginStartRoll(run, w);
    if (startEv.length) for (const e of startEv) onRunEvent(e);
    else announceRoom();
  }
  document.getElementById('restart-button')?.addEventListener('click', restart);
  announceRoom();

  let last = performance.now();
  let muzzleY = 1.1;
  let kills = 0;

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
      readInput(dt);
      if (!paused) for (const e of stepRun(run, w, dt)) onRunEvent(e);
      if (frozen(run)) rollUi.update(run.roll);
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
      w.speedMul = st.speedMul;
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
      if (aimAt && w.fireT <= THROW.preS) {
        const d = Math.hypot(aimAt.x - w.player.x, aimAt.y - w.player.y);
        // The aim radius is wider than the gun's, so being aimed at something
        // is not the same as being able to hit it. Only a shot that is really
        // coming gets an animation.
        if (d <= st.rangePx) rig.startThrow(Math.max(0, THROW.preS - Math.max(0, w.fireT)));
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
      const m = rig.muzzle();
      if (m) {
        w.muzzle = { x: m.x * PX, y: m.z * PX };
        muzzleY = m.y;
      }

      updateFiring(w, st, dt);
      updateBullets(w, dt, (t) => {
        hits++;
        if (t.kind === 'foe' && !t.alive) {
          kills++;
          // The burst goes here rather than in the renderer because this is
          // the one place that knows a kill JUST happened, as opposed to
          // "is dead", which is true on every frame afterwards.
          debrisFx.burst(t.x, t.y, Math.min(2, (t.radius || 44) / 44));
        }
        fx.spark(t.x, t.y, 0.6);
      });
      updateTargets(w, dt);

      // THE OTHER TURTLES act after the player's own blades and before the foes step,
      // so what they kill this frame is dead before the room is asked if it is cleared.
      // A kill by an ally counts exactly like one of the player's: the counter and the burst.
      const allyHooks = {
        onKill: (f) => { kills++; debrisFx.burst(f.x, f.y, Math.min(2, (f.radius || 44) / 44)); },
        onHit: (f) => fx.spark(f.x, f.y, 0.5),
      };
      if (!frozen(run)) updateAllies(w, dt, allyHooks);

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
      alliesFx.sync(w.allies, w.timeS, dt);
      telegraphs.sync(w.foes, w.foeShots, w.timeS);
      fx.syncShots(w.bullets, w.timeS, muzzleY);
      // After the rig has been posed and after updateFiring, so the hand is
      // emptied on the same frame the blade it threw first appears.
      heldFx.sync(rig);
      fx.updateSparks(dt);
      debrisFx.update(dt);

      hud.setAbilities(w.build);
      hud.setAllyTimers(w.allies);
      if (hpFill) hpFill.style.width = Math.max(0, (w.hp / w.maxHp) * 100) + '%';
      hud.setRooms(run.roomIdx, run.rooms,
        run.phase === 'cleared' || run.phase === 'roll' || run.phase === 'won');
      hud.setLeft(enemiesLeft(w, run.room), run.phase === 'fight');
      if (hudKills) hudKills.textContent = String(kills);
      if (hudTime) hudTime.textContent = w.timeS.toFixed(1) + 's';
      if (hudSrc) hudSrc.textContent = lean.source;
      if (hudHits) hudHits.textContent = String(hits);
    }

    updateIris();
    view.renderer.render(view.scene, view.camera);
  }
  requestAnimationFrame(frame);

  // Handy while tuning from a desk.
  window.__ss = {
    w, view, stage, rig, fx, heldFx, foesFx, debrisFx, telegraphs, restart, floors: FLOORS, ARENA,
    hud, rollUi, get run() { return run; }, get stats() { return stats(w.build); },
  };
}

boot().catch((e) => {
  if (window.Unity) window.Unity.call('BOOT FAILED: ' + e.message);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'boot failed: ' + e.message;
  throw e;
});
