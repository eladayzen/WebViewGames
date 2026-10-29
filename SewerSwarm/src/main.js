// PROTOTYPE 1: a character walking a world larger than the screen, on a board.
//
// Nothing else. No enemies, no firing, no abilities, no art. The one question
// this answers is whether moving in two dimensions on a balance board feels
// good enough to build a top-down survivor on -- see BAL-632, where it is the
// first thing listed because everything else depends on the answer.
//
// The grid and the markers are not placeholder ART, they are INSTRUMENTS: a
// plain colour field gives the eye nothing to judge motion against, so a
// player cannot tell smooth from juddery or fast from slow. The grid exists to
// make movement legible, and it goes when the real world does.

import { Application, Container, Graphics } from 'pixi.js';
import { installGbSdk } from './systems/gbSdk.js';
import { initInput, readInput, TUNING } from './systems/input.js';
import { createWorld, updateWorld, __setSpeedSource, WORLD, DESIGN_W, DESIGN_H } from './core/world.js';
import './style.css';

__setSpeedSource(() => TUNING.speedPxS);

const GRID = 240;          // world px between grid lines
const PLAYER_R = 42;       // the same radius a Bloop Squad pod has, for scale

async function boot() {
  installGbSdk();
  initInput();

  const app = new Application();
  await app.init({
    canvas: document.getElementById('game'),
    width: DESIGN_W,
    height: DESIGN_H,
    background: 0x12161f,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });

  // WORLD SPACE LIVES IN A CONTAINER AND THE CAMERA MOVES THE CONTAINER. This
  // is the structural difference from Bloop Squad, where the playfield IS the
  // screen and nothing ever scrolls. Everything that will later be an enemy or
  // a pickup goes in here, in world coordinates, and none of it needs to know
  // the camera exists.
  const world = new Container();
  app.stage.addChild(world);

  // --- the instrument grid, drawn once in world space ---------------------
  const grid = new Graphics();
  for (let x = 0; x <= WORLD.width; x += GRID) {
    grid.moveTo(x, 0).lineTo(x, WORLD.height)
        .stroke({ width: x % (GRID * 4) === 0 ? 3 : 1, color: 0x253044, alpha: 1 });
  }
  for (let y = 0; y <= WORLD.height; y += GRID) {
    grid.moveTo(0, y).lineTo(WORLD.width, y)
        .stroke({ width: y % (GRID * 4) === 0 ? 3 : 1, color: 0x253044, alpha: 1 });
  }
  // The edge of the world, so walking into it is a visible event rather than
  // the character mysteriously refusing to move.
  grid.rect(0, 0, WORLD.width, WORLD.height).stroke({ width: 10, color: 0x7a3b3b });
  world.addChild(grid);

  // --- the player ----------------------------------------------------------
  // A disc with a nose. The nose is the whole reason it is not just a disc:
  // facing-follows-travel is one of the things being judged, and a symmetric
  // shape cannot show it.
  const body = new Graphics();
  body.circle(0, 0, PLAYER_R).fill({ color: 0x5fd38a });
  body.circle(0, 0, PLAYER_R).stroke({ width: 5, color: 0x0d2c1b });
  body.moveTo(PLAYER_R * 0.2, -PLAYER_R * 0.55)
      .lineTo(PLAYER_R * 1.15, 0)
      .lineTo(PLAYER_R * 0.2, PLAYER_R * 0.55)
      .fill({ color: 0xffd166 });
  world.addChild(body);

  const w = createWorld();
  const readout = document.getElementById('readout');
  let readoutT = 0;

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 20);
    const input = readInput(dt);
    updateWorld(w, input, dt);

    body.position.set(w.player.x, w.player.y);
    body.rotation = w.player.facing;

    // THE CAMERA. Moving the world container by the negative of the camera
    // position is the camera: there is no camera object and there does not
    // need to be one.
    world.position.set(DESIGN_W / 2 - w.camera.x, DESIGN_H / 2 - w.camera.y);

    // Four times a second is enough to read and cheap enough not to matter.
    readoutT += dt;
    if (readoutT >= 0.25 && readout) {
      readoutT = 0;
      readout.textContent =
        `${input.source}   lean ${input.x.toFixed(2)}, ${input.y.toFixed(2)}   ` +
        `deadzone x ${TUNING.deadzoneX} y ${TUNING.deadzoneY}   speed ${TUNING.speedPxS}`;
    }
  });

  // Letterbox to fit, the same way every other game here does.
  const fit = () => {
    const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    const c = app.canvas;
    c.style.width = `${DESIGN_W * s}px`;
    c.style.height = `${DESIGN_H * s}px`;
  };
  window.addEventListener('resize', fit);
  fit();
}

boot();
