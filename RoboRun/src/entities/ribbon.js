// Leonardo's mask-tail ribbon (build doc §6, §9.1): a separate billboard
// with its own 5-frame looping flutter cycle and independent side-to-side
// sway, tracking the body's head-anchor position each frame (entities/
// player.js's getPlayerHeadAnchor) rather than being baked into the body's
// run-cycle art -- per direct playtest feedback, a ribbon locked to the
// body's footfall timing couldn't move independently the way a flowing
// cloth tail should.

import * as THREE from 'three';
import { getTexture } from './textureLoader.js';
import { RIBBON_FRAMES, RIBBON_ASPECT, RIBBON_FRAME_DURATION } from '../data/ribbonSprite.js';

const RIBBON_WIDTH = 0.75;
const RIBBON_HEIGHT = RIBBON_WIDTH * RIBBON_ASPECT;
const SWAY_AMPLITUDE = 0.12; // world units
const SWAY_SPEED = 2.1; // radians/sec
// Slightly closer to the camera than the body sprite -- two coplanar
// transparent billboards at the exact same depth can sort unpredictably
// (flicker); this keeps the ribbon reliably drawn over the body.
const Z_OFFSET = 0.03;

export function createRibbon() {
  const material = new THREE.SpriteMaterial({ map: getTexture(RIBBON_FRAMES[0].url), transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(RIBBON_WIDTH, RIBBON_HEIGHT, 1);
  return { sprite, frameIndex: 0, frameTimer: 0, swayPhase: 0 };
}

export function resetRibbon(ribbon) {
  ribbon.frameIndex = 0;
  ribbon.frameTimer = 0;
  ribbon.swayPhase = 0;
  ribbon.sprite.material.map = getTexture(RIBBON_FRAMES[0].url);
  ribbon.sprite.visible = true;
}

export function updateRibbon(ribbon, dt, anchor) {
  ribbon.frameTimer += dt;
  if (ribbon.frameTimer >= RIBBON_FRAME_DURATION) {
    ribbon.frameTimer -= RIBBON_FRAME_DURATION;
    ribbon.frameIndex = (ribbon.frameIndex + 1) % RIBBON_FRAMES.length;
    ribbon.sprite.material.map = getTexture(RIBBON_FRAMES[ribbon.frameIndex].url);
  }

  ribbon.swayPhase += dt * SWAY_SPEED;
  const sway = Math.sin(ribbon.swayPhase) * SWAY_AMPLITUDE;
  ribbon.sprite.position.set(anchor.x + sway, anchor.y, anchor.z + Z_OFFSET);
}
