// Soft feathered ground shadow beneath the player -- a flat radial-gradient
// blob (not a real projected/skewed shadow shader) tracking his x/z, sized
// down and faded while airborne so the jump arc still reads. On top of that,
// a brief scale "punch" fires on every foot-contact frame (main.js calls
// pulseContactShadow when frameIndex enters a contact pose) for a bit of
// impact rather than a static disc.

import * as THREE from 'three';
import { JUMP_HEIGHT } from '../data/constants.js';

function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(20,15,10,0.55)');
  grad.addColorStop(0.6, 'rgba(20,15,10,0.32)');
  grad.addColorStop(1, 'rgba(20,15,10,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

// Shared across every ground shadow in the game (the player's below, and
// entities/enemy.js's per-Foot-Soldier shadows) so they all read as the
// same shadow style and only one canvas/texture ever gets created.
let cachedShadowTexture = null;
export function getShadowTexture() {
  if (!cachedShadowTexture) cachedShadowTexture = createShadowTexture();
  return cachedShadowTexture;
}

// Kept proportional to entities/player.js's PLAYER_SCALE (0.88) -- a
// shadow sized for the original sprite footprint would read as oversized
// once the character himself was dialed down. Exported so entities/enemy.js
// can size its own shadow relative to this one (currently 10% bigger, per
// direct feedback), instead of an unrelated hardcoded number.
const PLAYER_SCALE = 0.88;
export const PLAYER_SHADOW_WIDTH = 1.5 * PLAYER_SCALE;
export const PLAYER_SHADOW_DEPTH = 0.85 * PLAYER_SCALE;
const PULSE_DECAY = 6; // 1/sec, how fast the contact punch settles back down
const PULSE_SCALE = 0.22;
const AIRBORNE_SHRINK = 0.55; // fraction shrunk at jump apex
const AIRBORNE_FADE = 0.6; // fraction of opacity lost at jump apex

export function createContactShadow(scene) {
  const material = new THREE.MeshBasicMaterial({
    map: getShadowTexture(), transparent: true, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLAYER_SHADOW_WIDTH, PLAYER_SHADOW_DEPTH), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015; // just above the street plane, no z-fight
  scene.add(mesh);
  return { mesh, pulse: 0 };
}

export function pulseContactShadow(shadow) {
  shadow.pulse = 1;
}

// The shadow must blink in lockstep with the player during post-hit
// invulnerability -- a shadow left on the street under a blinked-out
// character reads as a bug. Exposed here rather than having core/main.js poke
// `shadow.mesh.visible` directly, keeping the mesh an implementation detail of
// this file (same reasoning as pulseContactShadow above).
//
// Note this is deliberately NOT owned by entities/player.js the way
// TmntSewerSlide's equivalent is -- there, the player object owns its own
// shadow; here the shadow is a separate object created and held by
// core/main.js, so main.js is the only place that has both.
export function setContactShadowVisible(shadow, visible) {
  shadow.mesh.visible = visible;
}

export function updateContactShadow(shadow, player, dt) {
  const { mesh } = shadow;
  mesh.position.x = player.sprite.position.x;
  mesh.position.z = player.sprite.position.z;
  // Rides entities/platform.js's elevationY the same way the player's own
  // sprite does -- otherwise the shadow stayed pinned to street level while
  // he climbed a platform, reading as a shadow cast on the ground far below
  // his feet instead of directly under them.
  mesh.position.y = 0.015 + player.elevationY;

  shadow.pulse = Math.max(0, shadow.pulse - PULSE_DECAY * dt);

  // 0 grounded -> 1 through the jump's hold phase -> 0 grounded, mirrors
  // entities/player.js's actual arc height directly (rather than
  // re-deriving a second copy of the arc math) -- also correctly holds the
  // shrink/fade for the whole hover, not just a one-frame peak.
  const airT = player.airHeight / JUMP_HEIGHT;

  const scale = (1 - airT * AIRBORNE_SHRINK) * (1 + shadow.pulse * PULSE_SCALE);
  mesh.scale.set(scale, scale, 1);
  mesh.material.opacity = 1 - airT * AIRBORNE_FADE;
}
