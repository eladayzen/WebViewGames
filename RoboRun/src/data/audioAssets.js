// SFX + music asset manifest -- systems/audio.js loads every entry into an
// AudioBuffer at boot. Keys here are what playSfx/startMusic take, not
// filenames, so a future re-generation under a different filename doesn't
// touch any call site.
function audioUrl(file) {
  return new URL(`../assets/audio/${file}`, import.meta.url).href;
}

export const AUDIO_MANIFEST = {
  music: audioUrl('music_theme.mp3'),
  sfx_jump: audioUrl('sfx_jump.mp3'),
  sfx_coin: audioUrl('sfx_coin.mp3'),
  sfx_enemy_kill: audioUrl('sfx_enemy_kill.mp3'),
  sfx_hit: audioUrl('sfx_hit.mp3'),
  sfx_gameover: audioUrl('sfx_gameover.mp3'),
  sfx_level_complete: audioUrl('sfx_level_complete.mp3'),
  sfx_ui_tap: audioUrl('sfx_ui_tap.mp3'),
};
