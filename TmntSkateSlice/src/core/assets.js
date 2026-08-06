// Sprite + audio manifest and loaders. One entry per generated asset (game-
// assets-enhancement skill: "one sprite = one object", nothing composite
// baked together). Files live in ../assets/ (audio in ../assets/audio/),
// generated via the Kolbo pipeline (see KOLBO_ASSET_PIPELINE.md) against the
// style guide in STYLE.md.
//
// Loading is best-effort: a missing/not-yet-generated image or audio clip
// resolves to `null` in the returned map rather than throwing, so render.js
// falls back to a flat-shape placeholder draw (sprites) or systems/audio.js
// silently no-ops (audio) during early development before art exists, and
// both silently upgrade the instant a real file lands at the same path --
// no code changes needed either side of that swap.

import { loadAudioBuffer } from '../systems/audio.js';

const MANIFEST = {
  mike_idle: new URL('../assets/mike_idle.png', import.meta.url).href,

  // No-skateboard experiment (Visual DNA "mikey_skate" generation, board
  // edited out): same crouched fighting stance/torso/nunchaku grip as
  // mike_idle, barefoot, legs redrawn per frame for a fast run-cycle. See
  // getRunCycleSpriteKey in entities/player.js. (A 3rd "tucked midpoint"
  // frame was generated and dropped -- came back off-model.)
  mike_run_1: new URL('../assets/mike_run_1.png', import.meta.url).href,
  mike_run_3: new URL('../assets/mike_run_3.png', import.meta.url).href,

  // Swing (attack) and hit (flinch) sequences, regenerated no-skateboard
  // against the current mike_idle's proportions -- see getSwingCycleSpriteKey
  // / getHitCycleSpriteKey in entities/player.js. Original skateboard-era
  // single-frame versions archived at art/archive/hit-swing-skateboard-era/.
  mike_swing_1: new URL('../assets/mike_swing_1.png', import.meta.url).href,
  mike_swing_2: new URL('../assets/mike_swing_2.png', import.meta.url).href,
  mike_swing_3: new URL('../assets/mike_swing_3.png', import.meta.url).href,
  mike_hit_1: new URL('../assets/mike_hit_1.png', import.meta.url).href,
  mike_hit_2: new URL('../assets/mike_hit_2.png', import.meta.url).href,

  pizza_slice: new URL('../assets/pizza_slice.png', import.meta.url).href,
  ooze_canister: new URL('../assets/ooze_canister.png', import.meta.url).href,
  bomb: new URL('../assets/bomb.png', import.meta.url).href,

  // Special-ability pickups (progression update, 2026-07-30). ooze_canister
  // above is recolored green->cyan; these 3 are new icons.
  powerup_shield: new URL('../assets/powerup_shield.png', import.meta.url).href,
  powerup_wave: new URL('../assets/powerup_wave.png', import.meta.url).href,
  powerup_magnet: new URL('../assets/powerup_magnet.png', import.meta.url).href,

  bg_rooftop: new URL('../assets/bg_rooftop.png', import.meta.url).href,
  bg_fire_escape: new URL('../assets/bg_fire_escape.png', import.meta.url).href,
  bg_alley: new URL('../assets/bg_alley.png', import.meta.url).href,
  bg_subway: new URL('../assets/bg_subway.png', import.meta.url).href,
  bg_sewer: new URL('../assets/bg_sewer.png', import.meta.url).href,
  bg_neon_street: new URL('../assets/bg_neon_street.png', import.meta.url).href,
  bg_warehouse: new URL('../assets/bg_warehouse.png', import.meta.url).href,
  bg_docks: new URL('../assets/bg_docks.png', import.meta.url).href,
};

function loadOne(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadAssets() {
  const keys = Object.keys(MANIFEST);
  const images = await Promise.all(keys.map((k) => loadOne(MANIFEST[k])));
  const map = {};
  keys.forEach((k, i) => { map[k] = images[i]; });
  return map;
}

// --- Audio ---------------------------------------------------------------
// Same manifest/best-effort-loader shape as sprites above, decoded via
// systems/audio.js's loadAudioBuffer (WebAudio AudioBuffer, not an <audio>
// element -- see that file for why). Keys map 1:1 to the discrete game
// events in core/main.js that trigger them.
const AUDIO_MANIFEST = {
  sfx_pizza_splash: new URL('../assets/audio/sfx_pizza_splash.mp3', import.meta.url).href,
  sfx_ooze_catch: new URL('../assets/audio/sfx_ooze_catch.mp3', import.meta.url).href,
  sfx_bomb_hit: new URL('../assets/audio/sfx_bomb_hit.mp3', import.meta.url).href,
  sfx_combo_up: new URL('../assets/audio/sfx_combo_up.mp3', import.meta.url).href,
  sfx_stage_advance: new URL('../assets/audio/sfx_stage_advance.mp3', import.meta.url).href,
  sfx_game_over: new URL('../assets/audio/sfx_game_over.mp3', import.meta.url).href,
  sfx_countdown_tick: new URL('../assets/audio/sfx_countdown_tick.mp3', import.meta.url).href,
  sfx_countdown_go: new URL('../assets/audio/sfx_countdown_go.mp3', import.meta.url).href,
  sfx_ui_tap: new URL('../assets/audio/sfx_ui_tap.mp3', import.meta.url).href,
  sfx_box_complete: new URL('../assets/audio/sfx_box_complete.mp3', import.meta.url).href,
  sfx_shield_block: new URL('../assets/audio/sfx_shield_block.mp3', import.meta.url).href,
  sfx_wave_clear: new URL('../assets/audio/sfx_wave_clear.mp3', import.meta.url).href,
  music_bed: new URL('../assets/audio/music_bed.mp3', import.meta.url).href,
};

export async function loadAudioAssets() {
  const keys = Object.keys(AUDIO_MANIFEST);
  const buffers = await Promise.all(keys.map((k) => loadAudioBuffer(AUDIO_MANIFEST[k])));
  const map = {};
  keys.forEach((k, i) => { map[k] = buffers[i]; });
  return map;
}
