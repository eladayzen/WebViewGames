import {
  createEngine,
  createScene,
  createCamera,
  createLighting,
  createSky,
  createGround,
  updateCameraFollow,
  updateEnvironmentFollow,
} from './sceneSetup';
import { createPostFx } from './postfx';
import { createPlayer, updatePlayer, setPlayerLane, startPlayerJump, resetPlayer } from '../entities/player';
import { onAction, initSwipeInput } from '../input/handleAction';
import {
  createChunkPool,
  updateChunkPool,
  resetChunkPool,
  getActiveObstacleSlots,
  getActivePickupSlots,
} from '../track/chunkPool';
import { checkCollision } from '../entities/collision';
import { checkPickupHit, PICKUP_TYPES, PICKUP_VALUES } from '../entities/pickups';
import { createGameState } from './gameState';
import { createHud } from '../ui/hud';
import { clampLane } from '../track/lanes';

function boot() {
  const canvas = document.getElementById('renderCanvas');
  const engine = createEngine(canvas);
  const scene = createScene(engine);
  const camera = createCamera(scene, canvas);

  createLighting(scene);
  const sky = createSky(scene);
  const groundGroup = createGround(scene);
  const postFx = createPostFx(scene, camera);

  const player = createPlayer(scene);
  const pool = createChunkPool(scene);
  const hud = createHud();

  const gameState = createGameState({ onRestart: resetGame });

  let coins = 0;
  let pizzaCount = 0;

  function resetGame() {
    resetPlayer(player);
    resetChunkPool(pool);
    coins = 0;
    pizzaCount = 0;
  }

  onAction((action) => {
    if (gameState.state.current !== 'playing') return;
    if (action === 'LANE_LEFT') setPlayerLane(player, clampLane(player.targetLane - 1));
    else if (action === 'LANE_RIGHT') setPlayerLane(player, clampLane(player.targetLane + 1));
    else if (action === 'JUMP') startPlayerJump(player);
  });
  initSwipeInput(canvas);

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;

    if (gameState.state.current === 'playing') {
      updatePlayer(player, dt);
      updateChunkPool(pool, player.root.position.z);

      for (const slot of getActivePickupSlots(pool)) {
        if (checkPickupHit(player, slot)) {
          if (slot.type === PICKUP_TYPES.COIN) coins += 1;
          else if (slot.type === PICKUP_TYPES.PIZZA) pizzaCount += 1;
          slot.collect();
        }
      }

      // Score = base distance value + coin value + pizza value (GDD §8);
      // no power-up multiplier yet, that's Milestone 5.
      const distanceScore = player.root.position.z * 10;
      const pickupScore = coins * PICKUP_VALUES.COIN + pizzaCount * PICKUP_VALUES.PIZZA;
      hud.setScore(distanceScore + pickupScore);
      hud.setCoins(coins);

      for (const slot of getActiveObstacleSlots(pool)) {
        if (checkCollision(player, slot)) {
          gameState.triggerGameOver(`Distance: ${Math.floor(player.root.position.z)}m`);
          break;
        }
      }
    }

    updateCameraFollow(camera, player.root.position);
    updateEnvironmentFollow(groundGroup, sky, player.root.position.z);
    postFx.watchdogTick(dt, engine.getFps());
    scene.render();
  });

  window.addEventListener('resize', () => engine.resize());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
