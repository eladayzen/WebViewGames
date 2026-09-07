// BLOOP SQUAD -- POC.
//
// What this build is for, and nothing else:
//
//   1. THE CAMERA. Fixed (the world is one screen), drift (the starfield
//      scrolls past, the frame stays nailed down) or lateral (the frame follows
//      the pod). Toggled live with C, judged standing on a board.
//   2. HOW CLOSE A MONSTER MAY PASS. Drift speed on [ and ], pass clearance on
//      - and =, and the run reports passes / near misses / contacts / the worst
//      reaction time any monster gave.
//
// Everything else is deliberately thin. The endings, the leaderboard and the
// audio come from the shell once these two answers exist.

import { createRenderer } from './render/renderer.js';
import { createLoop } from './core/loop.js';
import { makeRng } from './core/rng.js';
import { createWorld, resetWorld, GameState } from './core/state.js';
import { initInput, readInput } from './input/input.js';
import { updateMonsters, maybeSpawn } from './systems/monsters.js';
import { updatePlayer, updateBullets, updateCollisions, updateCoinsAndPops } from './systems/play.js';
import { updateFiring, updateToyPickups, equip } from './systems/toys.js';
import { CAMERA, MONSTERS, TOYS, DESIGN_W } from './data/tuning.js';

const CAMERA_MODES = ['fixed', 'drift', 'lateral'];

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = await createRenderer(canvas);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());

  initInput();
  const rng = makeRng(0x1005);
  const world = createWorld();
  world.state = GameState.RUNNING;

  function update(dt) {
    if (world.paused || world.state !== GameState.RUNNING) return;
    world.time += dt;

    const input = readInput(dt);
    updatePlayer(world, input, dt);
    updateFiring(world, dt);
    updateBullets(world, dt);
    updateToyPickups(world, dt);
    maybeSpawn(world, rng, dt);
    updateMonsters(world, dt);
    updateCollisions(world, rng);
    updateCoinsAndPops(world, dt);

    world.camera.starOffset += CAMERA.driftPxS * dt;
    if (CAMERA.mode === 'lateral') {
      // Follow only once the pod leaves a centre box, and softly. This is the
      // mode most likely to be rejected -- it moves the frame on the axis every
      // dodge is made on -- but it has to be felt to be ruled out.
      const dead = DESIGN_W * CAMERA.deadZoneFrac;
      const target = Math.max(-dead, Math.min(dead, world.player.x - DESIGN_W * 0.5));
      world.camera.x += (target - world.camera.x) * Math.min(1, dt / CAMERA.followLag);
    } else {
      world.camera.x = 0;
    }

    if (!world.player.alive) {
      world.state = GameState.FAILED;
      showGameOver();
    }
  }

  const loop = createLoop((dt) => update(dt));
  renderer.app.ticker.add((t) => {
    loop.step(Math.max(0, t.deltaMS / 1000));
    renderer.draw(world);
  });
  renderer.app.ticker.start();

  // --- the POC's controls -------------------------------------------------
  function report() {
    const s = world.stats;
    return {
      camera: CAMERA.mode,
      driftMul: +MONSTERS.driftMul.toFixed(2),
      clearanceMul: +MONSTERS.passClearanceMul.toFixed(2),
      passes: s.passes, nearMisses: s.nearMisses, contacts: s.contacts,
      worstReactionS: s.worstReactionS < 90 ? +s.worstReactionS.toFixed(2) : null,
      floorS: MONSTERS.reactionFloorS,
      score: s.score, popped: s.popped, coins: s.coins, toysUsed: s.toysUsed,
      toy: world.toy.active ? world.toy.active.id : null,
      minutes: +(world.time / 60).toFixed(2),
    };
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyC': {
        const i = CAMERA_MODES.indexOf(CAMERA.mode);
        CAMERA.mode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length];
        break;
      }
      case 'BracketLeft':  MONSTERS.driftMul = Math.max(0.4, MONSTERS.driftMul - 0.1); break;
      case 'BracketRight': MONSTERS.driftMul = Math.min(3.0, MONSTERS.driftMul + 0.1); break;
      case 'Minus':        MONSTERS.passClearanceMul = Math.max(0, MONSTERS.passClearanceMul - 0.1); break;
      case 'Equal':        MONSTERS.passClearanceMul = Math.min(3, MONSTERS.passClearanceMul + 0.1); break;
      // Force a toy, so each one can be judged without waiting for a drop.
      case 'Digit1':       equip(world, 'wand'); break;
      case 'Digit2':       equip(world, 'twirl'); break;
      case 'Digit3':       equip(world, 'buddies'); break;
      case 'KeyR':         restart(); break;
      case 'Enter':
      case 'Space':        if (world.state === GameState.FAILED) restart(); break;
      default: break;
    }
  });

  function showGameOver() {
    const el = document.getElementById('gameover-overlay');
    if (el) el.classList.remove('hidden');
    const s = document.getElementById('gameover-stats');
    if (s) {
      const r = report();
      s.textContent = `${r.score} points · ${r.popped} popped · ${r.contacts} contacts`;
    }
    // eslint-disable-next-line no-console
    console.log('[bloop] run report', report());
  }

  function restart() {
    const el = document.getElementById('gameover-overlay');
    if (el) el.classList.add('hidden');
    resetWorld(world);
  }

  document.getElementById('restart-button')?.addEventListener('click', restart);

  // The X is the only way out on the board. The inline fallback in index.html
  // covers the case where this module never loads.
  window.__gbBack = () => {
    if (window.GoBalance?.back) return window.GoBalance.back();
    if (window.Unity) window.Unity.call('nav:back');
  };

  window.__bloop = { world, tuning: { CAMERA, MONSTERS, TOYS }, report, restart, equip: (k) => equip(world, k) };
}

boot();
