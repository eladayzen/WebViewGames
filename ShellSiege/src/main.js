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
// There is no horde, no health, no level-up and no score, because none of
// those change the answers above and all of them would slow down getting to
// them. The shooting range is here only so that something is moving while the
// first two questions are being looked at.
import * as THREE from 'three';
import { createWorld, updateWorld, __setSpeedSource, ARENA } from './core/world.js';
import { screenToWorld } from './core/axes.js';
import { initInput, readInput, TUNING } from './systems/input.js';
import { updateFiring, updateBullets, nearestTarget, BASE_GUN } from './systems/combat.js';
import { stepAngle, desiredFacing, AIM_RANGE_MUL } from './core/facing.js';
import { THROW } from './core/throwing.js';
import { localHeading } from './core/locomotion.js';
import { createTargets, updateTargets } from './systems/targets.js';
import { maybeSpawn, updateFoes } from './core/foes.js';
import { createView, CAM } from './render/view.js';
import { createStage } from './render/stage.js';
import { createFx } from './render/fx.js';
import { createHeld } from './render/held.js';
import { FLOOR } from './render/floors.js';
import { createFoes, loadEnemy, ENEMIES, ENEMY_KIND } from './render/foes.js';
import { createDebris, loadDebris } from './render/debris.js';
import { createBuild, stats, draw, take, xpForLevel } from './core/abilities.js';
import { createChoice, updateChoice } from './core/levelup.js';
import { createLevelUpUi } from './ui/levelup.js';
import { loadRig } from './render/rig.js';
import { PX } from './render/units.js';

__setSpeedSource(() => TUNING.speedPxS);

const canvas = document.getElementById('game');
const view = createView(canvas);

function loadTex(url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
}

async function boot() {
  const [floor, crate, shuriken, sai, enemy, skinAtlas, debrisGeos] = await Promise.all([
    loadTex(FLOOR.tex),
    loadTex('tex/crate.webp'),
    loadTex('tex/shuriken.webp'),
    loadTex('tex/sai.webp'),
    loadEnemy(),
    loadTex(ENEMIES[ENEMY_KIND].tex),
    loadDebris(),
  ]);
  const stage = createStage(view.scene, { floor });
  const foesFx = createFoes(view.scene, enemy, skinAtlas);
  const debrisFx = createDebris(view.scene, debrisGeos);
  const fx = createFx(view.scene, { crate, shuriken, sai });
  const rig = await loadRig(view.scene);
  // After the rig, because the blades are parented to its hand bones.
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

  /** Put the run back to the start WITHOUT reloading the page. */
  function restart() {
    Object.assign(w, createWorld());
    w.targets = createTargets();
    crates = w.targets.slice();
    hits = 0;
    kills = 0;
    choice = null;
    levelUi.close();
    // Hide the pool immediately, or the last frame's bodies are still standing
    // there behind the overlay when it fades.
    foesFx.syncFoes([], 0, 0);
    overlay?.classList.add('hidden');
  }
  document.getElementById('restart-button')?.addEventListener('click', restart);

  // --- the build -----------------------------------------------------
  // THE BUILD IS THE ONLY PLACE STATS LIVE. `stats(build)` is derived every
  // frame rather than cached, because a cached stat is a bug that only
  // appears after a level-up -- the hardest moment to reproduce.
  const levelUi = createLevelUpUi();
  let choice = null;

  const xpFill = document.getElementById('xp-fill');
  const lvBadge = document.getElementById('lv-badge');

  function gainXp(n) {
    w.xp += n;
    const need = xpForLevel(w.level);
    if (w.xp >= need && !choice) {
      w.xp -= need;
      w.level += 1;
      const options = draw(w.build, Math.random, 2);
      // Nothing left to offer means every ability is maxed. Levelling with no
      // choice to make is not a screen worth opening.
      if (options.length) {
        choice = createChoice(options);
        levelUi.open(choice, w.level);
      }
    }
  }

  let last = performance.now();
  let muzzleY = 1.1;
  let kills = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    // Clamped: a WebView that was backgrounded hands back a dt measured in
    // seconds, and an unclamped step teleports everything through everything.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // THE CHOICE SCREEN FREEZES THE RUN. Input is still read -- the lean IS
    // the interface here -- but nothing else in the world advances, which is
    // what makes this the one place in the game a player can stop and read.
    if (choice) {
      const lean = readInput(dt);
      const taken = updateChoice(choice, lean.x, dt);
      levelUi.update(choice);
      if (taken) {
        take(w.build, taken);
        choice = null;
        levelUi.close();
      }
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
          gainXp(1);
          // The burst goes here rather than in the renderer because this is
          // the one place that knows a kill JUST happened, as opposed to
          // "is dead", which is true on every frame afterwards.
          debrisFx.burst(t.x, t.y, 1);
        }
        fx.spark(t.x, t.y, 0.6);
      });
      updateTargets(w, dt);

      // THE FOOT CLAN. Spawn first so a new one gets a frame of walking before
      // anything looks at it, then step them -- the strike is committed inside
      // updateFoes, on the release frame of its own windup.
      maybeSpawn(w, dt);
      updateFoes(w, dt, () => fx.spark(w.player.x, w.player.y, 0.9));

      if (w.dead && overlay?.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        if (finalScore) finalScore.textContent = String(kills);
      }

      view.follow(w.camera.x, w.camera.y, dt);
      stage.update(w.timeS);
      fx.syncCrates(crates, w.timeS);
      foesFx.syncFoes(w.foes, w.timeS, dt);
      fx.syncShots(w.bullets, w.timeS, muzzleY);
      // After the rig has been posed and after updateFiring, so the hand is
      // emptied on the same frame the blade it threw first appears.
      heldFx.sync(rig);
      fx.updateSparks(dt);
      debrisFx.update(dt);

      if (hpFill) hpFill.style.width = Math.max(0, (w.hp / w.maxHp) * 100) + '%';
      if (xpFill) xpFill.style.width = Math.min(100, (w.xp / xpForLevel(w.level)) * 100) + '%';
      if (lvBadge) lvBadge.textContent = String(w.level);
      if (hudKills) hudKills.textContent = String(kills);
      if (hudTime) hudTime.textContent = w.timeS.toFixed(1) + 's';
      if (hudSrc) hudSrc.textContent = lean.source;
      if (hudHits) hudHits.textContent = String(hits);
    }

    view.renderer.render(view.scene, view.camera);
  }
  requestAnimationFrame(frame);

  // Handy while tuning from a desk.
  window.__ss = {
    w, view, stage, rig, fx, heldFx, foesFx, debrisFx, restart, floor: FLOOR, ARENA,
    get choice() { return choice; }, get stats() { return stats(w.build); },
  };
}

boot().catch((e) => {
  if (window.Unity) window.Unity.call('BOOT FAILED: ' + e.message);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'boot failed: ' + e.message;
  throw e;
});
