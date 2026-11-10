// TMNT SURVIVOR: the thin loop, end to end.
//
// Kill things, collect what they drop, level up, choose one of three, stack it
// on everything chosen before. That is the whole genre and it is all here,
// with eight abilities, no art, and a grid instead of a world.
//
// WHAT IS DELIBERATELY ABSENT. No sound, no second player, no
// evolutions, no meta-progression, no boss. The point of this build is to
// find out whether the LOOP is fun on a board, and every one of those would
// make that question harder to answer rather than easier. The camera framing
// rule for two players is in the PRD and is not built: single player puts the
// camera on the player, full stop.

import { Application, Container, Graphics } from 'pixi.js';
import { loadGround, createGround } from './systems/ground.js';
import { initHud, updateHud, clock } from './ui/hud.js';
import {
  loadArt, makePlayer, makeKatana, faceSprite, playLocomotion, EnemyPool, ShurikenPool,
  PickupPool,
  EnemyShotPool,
  muzzleAt, makeBarrelStar, barrelStarScale, setBarrelStar,
} from './systems/sprites.js';
import { installGbSdk } from './systems/gbSdk.js';
import { initInput, readInput, TUNING } from './systems/input.js';
import {
  createWorld, updateWorld, __setSpeedSource, WORLD, DESIGN_W, DESIGN_H,
} from './core/world.js';
import { createBuild, stats, draw, take, xpForLevel, ABILITIES } from './core/abilities.js';
import { createChoice, updateChoice, holdProgress, CHOOSE } from './core/levelup.js';
import {
  updateHorde, updateGems, updateHearts, updateEnemyShots, compactEnemies,
} from './systems/horde.js';
import { updateFiring, updateBullets, updateKatana, KATANA, katanaState } from './systems/combat.js';
import { updateSurvival, blinking, heal, SURVIVAL } from './systems/survival.js';
import './style.css';

__setSpeedSource(() => TUNING.speedPxS);

// THE HEALTH BAR LIVES ON THE CHARACTER'S HEAD, not in the corner.
//
// It was a row of pips in the HUD, which is where a health readout goes in
// every game written for someone sitting at a screen. This player is not
// sitting at a screen. They are standing back on a board with their weight
// shifting, watching the one thing that is moving and can kill them -- the
// horde closing on their own character -- and the top-left corner is
// somewhere they look only if something makes them look. Nothing does: this
// game has no hit sound, and the i-frame blink is on the character too.
//
// So the number that decides whether the run continues was being discovered
// at zero. Elad, 1 Nov: "the hp bar should be above the head of the
// character - for constant reminder." Putting it in world space over the
// turtle means it is inside the fixation the player already holds, and it
// moves with the thing it describes.
//
// SEGMENTED, NOT CONTINUOUS. A hit here always costs exactly one, so the bar
// can show the player how many hits they have left rather than a fraction
// they would have to convert. That is the pip's one real virtue and there is
// no reason to lose it by becoming a bar. Past twenty the segments are too
// thin to count and it falls back to a solid fill -- reachable with ?lives=,
// which exists for exactly this kind of trying-it-out.
const HP_BAR = {
  widthPx: 130,
  heightPx: 11,
  // Above the head: the sprite is 124 tall anchored at 0.78, so the crown is
  // about 97px up. This clears it by a dozen pixels and still sits well
  // below the heading arrow at -146.
  offsetY: -112,
  gapPx: 2,
  // Green while it is not a problem, amber while it is becoming one, red
  // while it is. The thresholds are fractions rather than counts so they
  // survive ?lives= and any future change to the pool.
  colourAt: (frac) => (frac > 0.5 ? 0x4cd97b : frac > 0.25 ? 0xf2c14e : 0xff5f7a),
};

/** Draw the pool over the player's head, in world coordinates. */
function drawHealthBar(g, x, y, lives, max) {
  if (max <= 0) return;
  const { widthPx: W, heightPx: H, offsetY, gapPx } = HP_BAR;
  const left = x - W / 2;
  const top = y + offsetY;
  const frac = Math.max(0, Math.min(1, lives / max));
  const colour = HP_BAR.colourAt(frac);

  // The backing is drawn at full width whatever is left, so the bar never
  // changes size -- the eye judges the fraction by shape, exactly as the
  // pips did, instead of measuring a shrinking object against nothing.
  g.roundRect(left - 2, top - 2, W + 4, H + 4, 4).fill({ color: 0x0a101a, alpha: 0.72 });

  if (max > 20) {
    g.roundRect(left, top, W * frac, H, 3).fill({ color: colour });
    return;
  }
  const seg = (W - gapPx * (max - 1)) / max;
  for (let i = 0; i < max; i++) {
    const on = i < lives;
    g.roundRect(left + i * (seg + gapPx), top, seg, H, 2)
      .fill({ color: on ? colour : 0x2a3444, alpha: on ? 1 : 0.65 });
  }
}

// ?hp=4 STARTS A RUN PART-WAY DOWN THE POOL.
//
// The health bar's whole job is what it looks like when it is NOT full, and
// getting there means playing for a minute and taking ten hits on purpose.
// That is the same trap `?levelup=1` was added for: a state you cannot open
// on demand is a state nobody looks at, and the amber and red thresholds
// would have shipped unexamined.
function startingLives(max) {
  const n = Number(new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search).get('hp'));
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.round(n)) : max;
}

async function boot() {
  installGbSdk();
  initInput();
  await Promise.all([loadArt(), loadGround()]);

  const app = new Application();
  await app.init({
    canvas: document.getElementById('game'),
    width: DESIGN_W, height: DESIGN_H,
    background: 0x12161f,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });

  // World space is a container; the camera moves the container. Everything
  // below lives in world coordinates and knows nothing about the camera.
  const world = new Container();
  app.stage.addChild(world);

  world.addChild(createGround());

  // ONE Graphics PER LAYER, cleared and redrawn each frame, rather than a
  // display object per entity. With up to 90 enemies plus bullets and gems,
  // creating and destroying objects every frame is the expensive way to do
  // this; redrawing into three retained Graphics is not.
  const gfxGems = new Graphics();
  const layerEnemies = new Container();
  const layerBullets = new Container();
  // Orbiters and the facing arrow are still primitives; only the characters
  // are art. They share a layer that sits ABOVE the player sprite so the
  // arrow is never hidden behind the character's own head.
  const gfxPlayer = new Graphics();
  // THE TWO PICKUPS. Drawn at roughly 1.7x their collect radius -- GEM is 13
  // and HEART is 19 -- which is deliberate: see PickupPool. They go in BEFORE
  // the enemies in the child order so a crowd walking over loot hides it
  // rather than the loot sitting on top of the horde.
  // Their own layer, so the z-order is decided HERE and not by whichever
  // sprite happened to be created first. A pool that addChild'd straight to
  // `world` would append at pickup time, which is after the horde layer --
  // loot drawn over the enemies standing on it.
  const layerPickups = new Container();
  const gemPool = new PickupPool(layerPickups, 'gem', 44);
  const pizzaPool = new PickupPool(layerPickups, 'pizza', 58);

  /** One sprite per blade, made on the level-up that adds it. */
  const bladeSprites = [];

  const sprPlayer = makePlayer(0);
  // The loaded round, sitting in the barrel. ABOVE the player sprite, because
  // it is poking out of the gun that sprite is holding -- behind it, the
  // barrel would hide the very thing the mask exists to reveal.
  const sprBarrelStar = makeBarrelStar();
  world.addChild(gfxGems, layerPickups, layerEnemies, layerBullets,
                 sprPlayer, sprBarrelStar, gfxPlayer);

  const enemyPool = new EnemyPool(layerEnemies);
  const bulletPool = new ShurikenPool(layerBullets);
  // ABOVE the player's own fire, so an incoming star is never hidden under
  // the stream going the other way.
  const enemyShotPool = new EnemyShotPool(layerBullets);

  const w = createWorld();
  w.lives = startingLives(SURVIVAL.maxLives);

  // Last frame's position, so the speed the walk cycle is gated on comes from
  // the step actually TAKEN rather than from the input -- a board never reads
  // exactly zero, so input alone would never let the turtle stand still.
  // There is no odometer any more: the cycle is paced by a fixed clock that
  // only runs while moving, see advanceWalk() in systems/sprites.js.
  let lastX = w.player.x;
  let lastY = w.player.y;
  let build = createBuild();
  let st = stats(build);
  w.speedMul = st.speedPxS;

  initHud();
  const panel = document.getElementById('levelup');
  const over = document.getElementById('gameover-overlay');
  const overStats = document.getElementById('gameover-stats');

  // --- PAUSE, and the quit that goes with it ------------------------------
  //
  // The house chrome is quit-then-pause in every game here, and this one had
  // only the quit. That is not a missing nicety: a child on a board cannot
  // put a survivor run down to answer the door, and the X without a pause
  // means the only way to stop is to abandon the run.
  //
  // PAUSE IS A GATE IN THE TICKER, not a stopped ticker. The ticker keeps
  // running and keeps drawing -- stopping it would freeze the WebView's rAF
  // pump, which on a device is the thing the app drives the page with -- so
  // the frame is still painted, the world simply is not advanced. It also
  // means dt cannot accumulate across the pause and teleport the horde on
  // resume, because dt is read fresh each frame and never integrated while
  // paused.
  const pausedOverlay = document.getElementById('paused-overlay');
  const confirmOverlay = document.getElementById('confirm-overlay');
  let paused = false;

  function setPaused(on) {
    // Never pause a run that has already ended: the game-over card is a
    // screen the player chose to be on, and pausing it would strand them
    // behind an overlay with no run underneath to go back to.
    if (w.dead) return;
    paused = on;
    pausedOverlay.classList.toggle('hidden', !on);
  }

  document.getElementById('pause-button').addEventListener('click', () => setPaused(!paused));
  document.getElementById('resume-button').addEventListener('click', () => setPaused(false));

  // THE X ASKS FIRST, and pauses while it asks. Quitting is the one
  // irreversible thing on this screen and it is a 54px button next to the
  // one a player taps to breathe.
  const quitButton = document.getElementById('gb-back');
  quitButton.removeAttribute('onclick');   // the boot fallback, now superseded
  function leave() {
    if (window.__gbBack) window.__gbBack();
    else if (window.Unity) window.Unity.call('nav:back');
  }
  quitButton.addEventListener('click', () => {
    // Mid-run: pause and ask. On the game-over screen there is no run left
    // to protect, so leave immediately -- a confirm there is pure friction.
    if (w.dead) { leave(); return; }
    setPaused(true);
    confirmOverlay.classList.remove('hidden');
  });
  document.getElementById('confirm-stay').addEventListener('click', () => {
    confirmOverlay.classList.add('hidden');
    setPaused(false);
  });
  document.getElementById('confirm-quit').addEventListener('click', leave);

  // #gameover-overlay and #restart-button are the SDK's required DOM
  // contract, not a choice -- see GOBALANCE_SDK.md. The ids matter even
  // though this game styles them itself.
  document.getElementById('restart-button').addEventListener('click', () => {
    const fresh = createWorld();
    Object.keys(fresh).forEach((k) => { w[k] = fresh[k]; });
    w.lives = startingLives(SURVIVAL.maxLives);
    build = createBuild();
    st = stats(build);
    w.speedMul = st.speedPxS;
    // lastX/lastY would still point at wherever the last run ended, and the
    // jump back to the spawn point would read as a frame of enormous speed.
    lastX = w.player.x;
    lastY = w.player.y;
    over.classList.add('hidden');
    closeLevelUp();
  });

  function openLevelUp() {
    const options = draw(build);
    if (!options.length) return;                 // everything maxed: keep playing
    w.choice = createChoice(options);
    panel.innerHTML = '';
    panel.classList.remove('hidden');
    options.forEach((key, i) => {
      const a = ABILITIES[key];
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.slot = String(i);
      card.innerHTML =
        `<div class="card-fill"></div>` +
        `<div class="card-body">` +
        // THE ICON CARRIES THE CARD. The cards are read in the couple of
        // seconds before the horde closes back in, by a child standing on a
        // board several feet from the screen -- a picture is read in that
        // time and a sentence is not. The key drives it through CSS rather
        // than a src here, so the sheet is one request and one decode for
        // all eight rather than eight separate images.
        `<i class="card-icon" data-k="${key}"></i>` +
        `<div class="card-name">${a.label}</div>` +
        `<div class="card-blurb">${a.blurb}</div>` +
        `<div class="card-have">${build[key] > 0 ? `you have ${build[key]}` : ''}</div>` +
        `</div>` +
        `<div class="card-lean">${['LEAN LEFT', 'LEAN RIGHT'][i]}</div>`;
      panel.appendChild(card);
    });
  }

  function closeLevelUp() {
    panel.classList.add('hidden');
    w.choice = null;
  }

  // ?levelup=1 opens the choice screen the moment the game boots.
  //
  // That screen is otherwise only reachable by playing to level 2, which is
  // why its proportions went unlooked-at for as long as they did: a screen
  // you cannot open on demand is a screen nobody reviews, and nobody can
  // screenshot. Same reasoning as every other hook in this repo.
  if (new URLSearchParams(location.search).get('levelup') === '1') openLevelUp();

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 20);
    const input = readInput(dt);

    // BEFORE EVERYTHING, including the level-up picker: a player who paused
    // while three cards were open must not have their lean keep moving the
    // selection behind the overlay.
    if (paused) { placePlayer(0); drawFrame(0); return; }

    // PAUSED ON A CHOICE. The horde does not move, nothing fires, and the
    // lean drives the picker instead of the player. Freezing the field is not
    // politeness -- a player reading three cards cannot also be dodging.
    if (w.choice) {
      const took = updateChoice(w.choice, input.x, dt);
      const cards = panel.querySelectorAll('.card');
      cards.forEach((c, i) => {
        c.classList.toggle('sel', i === w.choice.zone);
        c.querySelector('.card-fill').style.transform =
          `scaleX(${i === w.choice.zone ? holdProgress(w.choice) : 0})`;
      });
      if (took) {
        build = take(build, took);
        st = stats(build);
        w.speedMul = st.speedPxS;
        closeLevelUp();
      }
      placePlayer(0);
      drawFrame(0);
      return;
    }

    if (w.dead) { placePlayer(0); drawFrame(0); return; }

    updateWorld(w, input, dt);
    updateHorde(w, dt);
    // The sprite moves BEFORE the gun fires, so the shot leaves the barrel
    // where the barrel actually is this frame. See placePlayer.
    placePlayer(dt);
    updateFiring(w, st, dt);
    updateBullets(w, dt);
    updateKatana(w, st, dt);
    updateGems(w, dt, st.magnetPx, (v) => {
      w.xp += v;
      if (w.xp >= xpForLevel(w.level)) {
        w.xp -= xpForLevel(w.level);
        w.level += 1;
        openLevelUp();
      }
    });
    // BEFORE updateSurvival, which is what reads w.contact. A shot that
    // landed this frame has to be in before the hit is resolved, or it is
    // counted a frame late and can land after the run has already ended.
    updateEnemyShots(w, dt);
    updateHearts(w, () => heal(w, 1));
    compactEnemies(w);

    if (updateSurvival(w, dt)) {
      // TIME FIRST. In this genre how long you lasted IS the score, and it
      // is the number people say out loud to each other afterwards.
      overStats.innerHTML =
        `<b>${clock(w.timeS)}</b><small>survived</small>`
        + `<b>${w.kills}</b><small>knocked out</small>`
        + `<b>${w.level}</b><small>level reached</small>`;
      over.classList.remove('hidden');
    }
    drawFrame(dt);
  });

  /**
   * Put the player sprite where the player is, and publish the muzzle.
   *
   * CALLED BEFORE THE SIM FIRES, not from drawFrame, and that ordering is the
   * whole point. updateFiring reads w.muzzle, and the muzzle is a point inside
   * the sprite -- so if the sprite were still being placed at draw time, every
   * shot would leave from where the barrel was a frame ago. At a full lean
   * that is about eight pixels of daylight between the gun and its own fire,
   * and it only shows up while moving, which is most of the game.
   *
   * Exactly once per frame: it advances the walk clock, so a second call in
   * the same frame would run the legs at double speed.
   */
  function placePlayer(dt) {
    // THE SPRITE IS NEVER ROTATED -- it is a side view, and rotating a side
    // view lays the character on its back. Heading is a mirror plus the arrow
    // in drawFrame. See systems/sprites.js.
    const moved = Math.hypot(w.player.x - lastX, w.player.y - lastY);
    lastX = w.player.x;
    lastY = w.player.y;
    sprPlayer.x = w.player.x;
    // Speed from the step actually taken rather than from the input: a board
    // never reads exactly zero, so only real movement may count as walking.
    playLocomotion(sprPlayer, dt > 0 ? moved / dt : 0,
                   dt, w.timeS, w.player.y);
    faceSprite(sprPlayer, w.player.facing);
    w.muzzle = muzzleAt(sprPlayer);
  }

  function drawFrame(dt) {
    gfxGems.clear();
    gemPool.sync(w.gems, w.timeS);
    pizzaPool.sync(w.hearts, w.timeS);

    enemyPool.sync(w.enemies, w.player.x, w.timeS);

    bulletPool.sync(w.bullets, w.timeS);
    enemyShotPool.sync(w.enemyShots, w.timeS);

    gfxPlayer.clear();
    const st2 = st;
    // THE BLADES, drawn only while the weapon is out.
    //
    // Pooled rather than rebuilt: the count only changes when a level-up is
    // taken, but sprites are made once and hidden the rest of the time, the
    // way every other pool in this game works.
    //
    // POINTED OUTWARD ALONG THE RADIUS, tip away from the turtle. It was on
    // the tangent -- which is where a blade mid-swing physically points --
    // and Elad's call after seeing it is that it reads wrong: at this size
    // and from overhead a tangential blade looks like it is orbiting
    // sideways rather than being swung, and the tip, which is the part that
    // says where the reach ends, points at nothing. ?krot= to try another.
    const kat = katanaState(w, st2.blades);
    for (let i = 0; i < Math.max(st2.blades, bladeSprites.length); i++) {
      let blade = bladeSprites[i];
      if (!blade && i < st2.blades) {
        blade = makeKatana(KATANA.bladeLenPx);
        bladeSprites.push(blade);
        world.addChild(blade);
      }
      if (!blade) continue;
      const on = kat.out && i < st2.blades;
      blade.visible = on;
      if (!on) continue;
      const a = w.bladePhase + (i * Math.PI * 2) / st2.blades;
      blade.position.set(
        w.player.x + Math.cos(a) * KATANA.distancePx,
        w.player.y + Math.sin(a) * KATANA.distancePx,
      );
      blade.rotation = a + KATANA.artRotRad;
      // The last fifth of the sweep fades out, so being sheathed is
      // something the player sees coming rather than a blade that blinks
      // out of existence mid-swing.
      blade.alpha = kat.progress > 0.8 ? 1 - (kat.progress - 0.8) / 0.2 : 1;
    }
    sprPlayer.visible = !blinking(w);

    // THE ROUND IN THE BARREL. Sits on the muzzle, mirrors with the player so
    // the masked edge stays against the barrel lip, and scales through the
    // reload pop. It blinks with the player during invulnerability for the
    // same reason the player does -- a star hanging in mid-air next to an
    // invisible turtle reads as a bug.
    const k = barrelStarScale(w.timeS - w.lastFireS, st.fireIntervalS);
    // Defensive: a restart builds a fresh world with muzzle: null, and a null
    // deref here would take the whole render loop down rather than misplace
    // one sprite for one frame.
    const mz = w.muzzle ?? w.player;
    sprBarrelStar.x = mz.x;
    sprBarrelStar.y = mz.y;
    sprBarrelStar.scale.x = sprPlayer.scale.x < 0 ? -1 : 1;
    setBarrelStar(sprBarrelStar, k);
    sprBarrelStar.visible = sprPlayer.visible && k > 0.001;

    // The arrow above the head. It carries the heading the mirror cannot --
    // a mirror has two states and a compass has 360 -- and it is what the
    // reference game uses for exactly that. Drawn in world space above the
    // character, pointing where the player is actually travelling.
    // FIXED POSITION, ROTATING POINT. The first version orbited the arrow
    // around the player in the travel direction, which put it on top of the
    // character's head whenever they walked up and buried it behind their
    // feet whenever they walked down. It sits at one place above the head
    // instead and only its direction changes -- the eye finds it in the same
    // spot every frame, which is the whole job.
    const nx = Math.cos(w.player.facing);
    const ny = Math.sin(w.player.facing);
    const ax = w.player.x;
    // Moved up from -128 to make room for the health bar, which now owns the
    // space directly above the head. The arrow keeps the outer slot because
    // the bar is the thing being glanced at and should be the one nearer the
    // character it belongs to.
    const ay = w.player.y - 146;
    gfxPlayer.poly([
      ax + nx * 17,          ay + ny * 17,
      ax - ny * 12 - nx * 8, ay + nx * 12 - ny * 8,
      ax + ny * 12 - nx * 8, ay - nx * 12 - ny * 8,
    ]).fill({ color: 0xffd166 });

    // Drawn after the sprite's own visibility is decided and never hidden
    // with it: the character blinks out while invulnerable, and the pool is
    // most worth reading in exactly the second after a hit lands.
    drawHealthBar(gfxPlayer, w.player.x, w.player.y, w.lives, SURVIVAL.maxLives);

    world.position.set(DESIGN_W / 2 - w.camera.x, DESIGN_H / 2 - w.camera.y);

    updateHud(w, build, ABILITIES, xpForLevel(w.level), katanaState(w, st.blades));
  }

  const fit = () => {
    const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    app.canvas.style.width = `${DESIGN_W * s}px`;
    app.canvas.style.height = `${DESIGN_H * s}px`;
  };
  window.addEventListener('resize', fit);
  fit();
}

boot();
