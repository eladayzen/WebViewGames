// Bootstrap. Wires the renderer, the input module, the DOM overlay, the audio
// bus, the instrumentation panel and the game together, then starts the rAF
// loop that the SDK's __pumpFrames shim drives on-device.
//
// THE FIRST PLAYABLE STATE IS REACHED ON LOAD WITH NO KEY PRESS
// (GOBALANCE_SDK.md, §7.3). The title auto-advances into the drop-in beat,
// which auto-advances into the ride. Nothing here waits for input.
//
// INPUT MODE: ANALOG. Tell the project owner at Phase 2 to set
// `forwardSteeringKeys = false` on this game's WebGameController. This game
// reads `window.__gbSensor`'s lateral component directly (in /input, and only
// there) and never listens for the host's synthetic arrow keys -- doing both
// double-applies the tilt and the surfer over-steers.

import { Renderer } from './render/renderer.js';
import { Input } from './input/input.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Audio } from './audio/audio.js';
import { Instrumentation } from './debug/instrumentation.js';
import { Game } from './core/game.js';

async function boot() {
  const host = document.getElementById('app');

  const renderer = new Renderer();
  await renderer.init(host);

  const hud = new Hud();
  const screens = new Screens();
  const audio = new Audio();
  const input = new Input();
  const instrumentation = new Instrumentation({});

  const game = new Game({ input, renderer, hud, screens, audio, instrumentation });
  game.boot();

  // Screen chrome only (§0.4, §9.5 rule 6). None of these can move the surfer.
  screens.el.restart.addEventListener('click', () => game.restart());
  hud.el.pause.addEventListener('click', () => game.togglePause());

  // The Back button asks nothing and leaves immediately -- it is the one
  // control that must always work, and it is already wired inline in
  // index.html. This hook only makes sure a run in progress is not left
  // holding the audio duck.
  window.__gbBack = () => {
    audio.duck(false);
    if (window.Unity) window.Unity.call('nav:back');
  };

  audio.init();

  // ?warm=<seconds> fast-forwards the simulation before the first draw -- see
  // Game#warmUp. Verification affordance only; it takes no input and cannot be
  // reached from the board.
  const params = new URLSearchParams(window.location.search);
  const warm = Number(params.get('warm'));
  if (Number.isFinite(warm) && warm > 0) game.warmUp(warm, params.get('seek') === '1');

  function loop(now) {
    game.frame(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  // A boot failure must be VISIBLE. There is no devtools console inside the
  // WebView, so the native bridge is the on-device channel -- and the same
  // panel the constraints validator uses is the on-screen one, because a game
  // that fails to start should say so rather than sit on its title card
  // forever.
  if (window.Unity) window.Unity.call('BOOT ERROR: ' + (e && e.message));
  if (console && console.error) console.error(e);
  const panel = document.getElementById('constraint-warning');
  if (panel) {
    panel.classList.remove('hidden');
    panel.textContent = 'BOOT ERROR\n\n' + ((e && e.stack) || e);
  }
});
