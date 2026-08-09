// Raphael (§6, §5.2): a single continuous `theta` around the tunnel's fixed
// ring radius -- never a discrete lane index, never radial (in/out)
// movement. `theta`'s angular velocity eases toward the input-driven target
// (input/input.js) rather than snapping, so steering reads as a smooth
// lean-in/out (§4).

import * as THREE from 'three';
import { tunnelCenterAt } from '../tunnel/spline.js';
import { CROSS_SECTIONS } from '../tunnel/crossSection.js';
import { getTexture } from './textureLoader.js';
import { PLAYER_SPRITE_URL, PLAYER_HIT_SPRITE_URL, PLAYER_PLACEHOLDER_COLOR, PLAYER_ASPECT } from '../data/playerSprite.js';
import {
  ARC_CENTER,
  RING_RADIUS,
  PLAYER_VISUAL_RADIUS,
  PLAYER_Z,
  MAX_ANGULAR_SPEED,
  ANGULAR_RESPONSE,
  SECTION_RECLAMP_SECONDS,
} from '../data/constants.js';

// Small soft dark oval, generated once -- a contact shadow under the board
// so the character reads as standing ON the tunnel surface rather than
// floating in front of it, independent of the sprite's own art.
function createShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPlayer() {
  // Placeholder billboard (POC, §10 milestone 1) -- a plain colored plane
  // sprite until data/playerSprite.js's URL is filled in by the art pass
  // (§6, §10 milestone 9), which needs no changes here at all.
  const texture = getTexture(PLAYER_SPRITE_URL);
  const material = new THREE.SpriteMaterial({
    color: texture ? 0xffffff : PLAYER_PLACEHOLDER_COLOR,
    map: texture,
    transparent: true,
    depthTest: false, // always renders over the tunnel wall/obstacles/rail, never clipped by them
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.3 * 4 * 0.8, 1.3 * 4 * 0.8 * PLAYER_ASPECT, 1);
  // Pivot at the bottom-center (where the skateboard/feet touch), not the
  // sprite's geometric middle -- this is both the anchor used for
  // sprite.position AND the pivot material.rotation spins around, so the
  // lean/bank tilt (updatePlayerPosition below) rocks from the board contact
  // point instead of swinging the whole body around its torso.
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;

  const shadowMaterial = new THREE.SpriteMaterial({
    map: createShadowTexture(),
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const shadow = new THREE.Sprite(shadowMaterial);
  shadow.scale.set(1.3 * 4 * 0.8 * 0.6, 1.3 * 4 * 0.8 * 0.6 * 0.35, 1); // flattened oval, roughly board-width
  shadow.renderOrder = 9; // draws just under the character, still over the environment

  return {
    sprite,
    shadow,
    theta: ARC_CENTER,
    angularVel: 0,
    x: 0,
    y: 0,
  };
}

// Both the character and its contact shadow should blink/hide together
// (invulnerability flicker, hit-pose swap) -- routing visibility through
// here keeps main.js from needing to know the shadow exists at all.
export function setPlayerVisible(player, visible) {
  player.sprite.visible = visible;
  player.shadow.visible = visible;
}

export function resetPlayer(player) {
  player.theta = ARC_CENTER;
  player.angularVel = 0;
  player.reclamp = null;
  updatePlayerPosition(player);
  setPlayerVisible(player, true);
  player.sprite.material.rotation = 0;
  setPlayerRidePose(player);
}

// Game-over pose swap (§6) -- a different sprite, not a new render path;
// resetPlayer() (called on restart) swaps back to the ride pose.
export function setPlayerHitPose(player) {
  const texture = getTexture(PLAYER_HIT_SPRITE_URL);
  if (!texture) return;
  player.sprite.material.map = texture;
  player.sprite.material.color.setHex(0xffffff);
  player.sprite.material.needsUpdate = true;
}

export function setPlayerRidePose(player) {
  const texture = getTexture(PLAYER_SPRITE_URL);
  player.sprite.material.map = texture;
  player.sprite.material.color.setHex(texture ? 0xffffff : PLAYER_PLACEHOLDER_COLOR);
  player.sprite.material.needsUpdate = true;
}

// Section-boundary transition (§5.3 last bullet, §12): if a section change
// ever narrows the valid range and the player's current theta falls outside
// it, ease back inside over SECTION_RECLAMP_SECONDS rather than snapping or
// treating it as a hit. Not exercised by this MVP's section order (every
// step only widens: partialArc -> partialArc -> halfPipe), but implemented
// generally since the doc calls this out as a genuine edge case worth
// handling deliberately, not something to special-case away.
export function maybeStartReclamp(player, sectionKey) {
  const s = CROSS_SECTIONS[sectionKey];
  if (player.theta >= s.min && player.theta <= s.max) return false;
  const toTheta = THREE.MathUtils.clamp(player.theta, s.min, s.max);
  player.reclamp = { fromTheta: player.theta, toTheta, t: 0 };
  return true;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

// dt is frame-normalized (~1 at 60fps, see main.js). steeringX is the
// input layer's single continuous -1..1 value (§4) -- never read y.
export function stepPlayerAngle(player, steeringX, dt, sectionKey) {
  if (player.reclamp) {
    player.reclamp.t += dt / 60;
    const frac = Math.min(1, player.reclamp.t / SECTION_RECLAMP_SECONDS);
    player.theta = THREE.MathUtils.lerp(player.reclamp.fromTheta, player.reclamp.toTheta, easeInOutQuad(frac));
    player.angularVel = 0;
    if (frac >= 1) player.reclamp = null;
    return;
  }
  const targetAngularVel = steeringX * MAX_ANGULAR_SPEED;
  const followT = 1 - Math.exp(-ANGULAR_RESPONSE * (dt / 60));
  player.angularVel += (targetAngularVel - player.angularVel) * followT;
  player.theta += player.angularVel * (dt / 60);
  const s = CROSS_SECTIONS[sectionKey];
  player.theta = THREE.MathUtils.clamp(player.theta, s.min, s.max);
}

export function updatePlayerPosition(player) {
  const c = tunnelCenterAt(PLAYER_Z);
  // Logical/collision position stays at RING_RADIUS (shared with
  // obstacles/pickups/rail, §5.5) -- only the rendered sprite+shadow sit
  // closer to the wall (PLAYER_VISUAL_RADIUS), a purely cosmetic fix for the
  // character otherwise floating above the tunnel surface now that its
  // pivot is at its own feet.
  player.x = c.x + Math.cos(player.theta) * RING_RADIUS;
  player.y = c.y + Math.sin(player.theta) * RING_RADIUS;
  const visualX = c.x + Math.cos(player.theta) * PLAYER_VISUAL_RADIUS;
  const visualY = c.y + Math.sin(player.theta) * PLAYER_VISUAL_RADIUS;
  player.sprite.position.set(visualX, visualY, PLAYER_Z);
  player.shadow.position.set(visualX, visualY, PLAYER_Z);
  // Radial pipe alignment (§5.2), not an arbitrary screen-space tilt: he's
  // standing on the inside of a curved tube, so his "up" should always point
  // from his position toward the tube's own central axis -- same as real
  // gravity/normal-force on a pipe wall -- not just react to how fast he's
  // turning. In-plane sprite rotation r that makes local "up" (0,1) point
  // toward the tube center works out to r = theta + PI/2 (derived from the
  // sprite shader's standard CCW rotation matrix): at the default resting
  // theta = ARC_CENTER = -PI/2 this is exactly 0 (upright, as before);
  // moving around the reachable arc continuously re-aligns him to whichever
  // part of the pipe wall he's currently on.
  const radialAlign = player.theta + Math.PI / 2;
  // A small extra lean layered on top for an active turn -- carving a bit
  // harder than just standing still at that wall position would. Secondary
  // to the radial alignment above, not the primary source of tilt anymore.
  const extraLean = THREE.MathUtils.clamp(-player.angularVel * 0.12, -0.35, 0.35);
  player.sprite.material.rotation = radialAlign + extraLean;
}
