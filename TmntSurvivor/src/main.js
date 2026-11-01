// TMNT SURVIVOR: the thin loop, end to end.
//
// Kill things, collect what they drop, level up, choose one of three, stack it
// on everything chosen before. That is the whole genre and it is all here,
// with eight abilities, no art, and a grid instead of a world.
//
// WHAT IS DELIBERATELY ABSENT. No art, no sound, no second player, no
// evolutions, no meta-progression, no boss. The point of this build is to
// find out whether the LOOP is fun on a board, and every one of those would
// make that question harder to answer rather than easier. The camera framing
// rule for two players is in the PRD and is not built: single player puts the
// camera on the player, full stop.

import { Application, Container, Graphics } from 'pixi.js';
import { installGbSdk } from './systems/gbSdk.js';
import { initInput, readInput, TUNING } from './systems/input.js';
import {
  createWorld, updateWorld, __setSpeedSource, WORLD, DESIGN_W, DESIGN_H, PLAYER_RADIUS,
} from './core/world.js';
import { createBuild, stats, draw, take, xpForLevel, ABILITIES } from './core/abilities.js';
import { createChoice, updateChoice, holdProgress, CHOOSE } from './core/levelup.js';
import { updateHorde, updateGems, compactEnemies, ENEMY, GEM } from './systems/horde.js';
import { updateFiring, updateBullets, updateOrbiters, BULLET, ORBIT } from './systems/combat.js';
import './style.css';

__setSpeedSource(() => TUNING.speedPxS);

const GRID = 240;

async function boot() {
  installGbSdk();
  initInput();

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

  const grid = new Graphics();
  for (let x = 0; x <= WORLD.width; x += GRID) {
    grid.moveTo(x, 0).lineTo(x, WORLD.height)
        .stroke({ width: x % (GRID * 4) === 0 ? 3 : 1, color: 0x253044 });
  }
  for (let y = 0; y <= WORLD.height; y += GRID) {
    grid.moveTo(0, y).lineTo(WORLD.width, y)
        .stroke({ width: y % (GRID * 4) === 0 ? 3 : 1, color: 0x253044 });
  }
  grid.rect(0, 0, WORLD.width, WORLD.height).stroke({ width: 10, color: 0x7a3b3b });
  world.addChild(grid);

  // ONE Graphics PER LAYER, cleared and redrawn each frame, rather than a
  // display object per entity. With up to 90 enemies plus bullets and gems,
  // creating and destroying objects every frame is the expensive way to do
  // this; redrawing into three retained Graphics is not.
  const gfxGems = new Graphics();
  const gfxEnemies = new Graphics();
  const gfxBullets = new Graphics();
  const gfxPlayer = new Graphics();
  world.addChild(gfxGems, gfxEnemies, gfxBullets, gfxPlayer);

  const w = createWorld();
  let build = createBuild();
  let st = stats(build);
  w.speedMul = st.speedPxS;

  const hud = document.getElementById('hud');
  const panel = document.getElementById('levelup');

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
        `<div class="card-name">${a.label}</div>` +
        `<div class="card-blurb">${a.blurb}</div>` +
        `<div class="card-have">${build[key] > 0 ? `you have ${build[key]}` : ''}</div>` +
        `</div>` +
        `<div class="card-lean">${['LEAN LEFT', 'STAND STILL', 'LEAN RIGHT'][i]}</div>`;
      panel.appendChild(card);
    });
  }

  function closeLevelUp() {
    panel.classList.add('hidden');
    w.choice = null;
  }

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 20);
    const input = readInput(dt);

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
      drawFrame();
      return;
    }

    updateWorld(w, input, dt);
    updateHorde(w, dt);
    updateFiring(w, st, dt);
    updateBullets(w, dt);
    updateOrbiters(w, st, dt);
    updateGems(w, dt, st.magnetPx, (v) => {
      w.xp += v;
      if (w.xp >= xpForLevel(w.level)) {
        w.xp -= xpForLevel(w.level);
        w.level += 1;
        openLevelUp();
      }
    });
    compactEnemies(w);
    drawFrame();
  });

  function drawFrame() {
    gfxGems.clear();
    for (const g of w.gems) {
      if (!g.alive) continue;
      gfxGems.circle(g.x, g.y, GEM.radius).fill({ color: 0x4fd1ff });
    }

    gfxEnemies.clear();
    for (const e of w.enemies) {
      if (!e.alive) continue;
      gfxEnemies.circle(e.x, e.y, ENEMY.radius)
        .fill({ color: e.hitT > 0 ? 0xffffff : 0xc0455a });
    }

    gfxBullets.clear();
    for (const b of w.bullets) {
      if (!b.alive) continue;
      gfxBullets.circle(b.x, b.y, BULLET.radius).fill({ color: 0xffd166 });
    }

    gfxPlayer.clear();
    const st2 = st;
    for (let i = 0; i < st2.orbiters; i++) {
      const a = w.orbitPhase + (i * Math.PI * 2) / st2.orbiters;
      gfxPlayer.circle(
        w.player.x + Math.cos(a) * ORBIT.distancePx,
        w.player.y + Math.sin(a) * ORBIT.distancePx,
        ORBIT.radius,
      ).fill({ color: 0xa78bfa });
    }
    gfxPlayer.circle(w.player.x, w.player.y, PLAYER_RADIUS).fill({ color: 0x5fd38a });
    gfxPlayer.circle(w.player.x, w.player.y, PLAYER_RADIUS).stroke({ width: 5, color: 0x0d2c1b });
    const nx = Math.cos(w.player.facing);
    const ny = Math.sin(w.player.facing);
    gfxPlayer.circle(w.player.x + nx * PLAYER_RADIUS * 0.55,
                     w.player.y + ny * PLAYER_RADIUS * 0.55, 11)
             .fill({ color: 0xffd166 });

    world.position.set(DESIGN_W / 2 - w.camera.x, DESIGN_H / 2 - w.camera.y);

    if (hud) {
      const need = xpForLevel(w.level);
      hud.textContent =
        `LV ${w.level}   xp ${w.xp}/${need}   kills ${w.kills}   ` +
        `horde ${w.enemies.filter((e) => e.alive).length}   ` +
        `${Object.entries(build).filter(([, v]) => v > 0)
           .map(([k, v]) => `${ABILITIES[k].label} ${v}`).join('  ') || 'no abilities yet'}`;
    }
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
