// Canvas 2D renderer. Everything is fraction-based (Layout convention, per
// game-assets-enhancement Phase 4 / build doc §9) so the scene resizes
// cleanly regardless of the actual device viewport. Falls back to flat
// vector-drawn placeholders for any sprite that hasn't been generated yet
// (or fails to load) so the game is fully playable/testable before real art
// exists, and upgrades silently the moment art lands at the same path.

import { GROUND_Y_FRAC, PLAYER_HEIGHT_FRAC, ITEM_SIZE_FRAC } from '../data/constants.js';
import { getShakeOffsetFrac } from '../systems/juice.js';
import { getRunCycleSpriteKey, getSwingCycleSpriteKey, getHitCycleSpriteKey } from '../entities/player.js';

// Gentle idle "breathing" pulse (no-skateboard standing pose only, not the
// run-cycle) -- vertical-only scale from 1x to 1.08x and back over a
// 1.3s/1.3s ease-in-out-cubic loop, pivoted at the sprite's feet (the same
// origin drawPlayer already translates to before drawing), not its center,
// so he stretches upward from the ground rather than growing from his
// middle.
const IDLE_BREATH_HALF_PERIOD_SEC = 1.3;
const IDLE_BREATH_MAX_SCALE = 1.02;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function getIdleBreathScale() {
  const period = IDLE_BREATH_HALF_PERIOD_SEC * 2;
  const t = (performance.now() / 1000) % period;
  const triangle = t < IDLE_BREATH_HALF_PERIOD_SEC
    ? t / IDLE_BREATH_HALF_PERIOD_SEC
    : 1 - (t - IDLE_BREATH_HALF_PERIOD_SEC) / IDLE_BREATH_HALF_PERIOD_SEC;
  return 1 + (IDLE_BREATH_MAX_SCALE - 1) * easeInOutCubic(triangle);
}

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  return ctx;
}

function px(frac, extent) {
  return frac * extent;
}

function drawBackgroundFallback(ctx, w, h, stage) {
  const skyColors = {
    rooftop: ['#3a2a5c', '#e8763c'],
    'fire-escape': ['#2c2450', '#c85a3c'],
    alley: ['#241c3c', '#8a4a3c'],
  };
  const [top, bottom] = skyColors[stage.id] || skyColors.rooftop;
  const grad = ctx.createLinearGradient(0, 0, 0, h * GROUND_Y_FRAC);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * GROUND_Y_FRAC);

  ctx.fillStyle = '#3a2f2a';
  ctx.fillRect(0, h * GROUND_Y_FRAC, w, h - h * GROUND_Y_FRAC);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, h * GROUND_Y_FRAC, w, h * 0.015);
}

function drawBackground(ctx, w, h, images, stage) {
  const img = images[stage.bg];
  if (img) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    drawBackgroundFallback(ctx, w, h, stage);
  }
}

function drawPlayerFallback(ctx, x, y, size, player) {
  const stateColor = { idle: '#f0862e', swing: '#ffde50', hit: '#ff5a3c' }[player.state] || '#f0862e';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(player.facing, 1);
  ctx.fillStyle = '#5a8a3c';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.35, size * 0.28, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = stateColor;
  ctx.fillRect(-size * 0.32, -size * 0.15, size * 0.64, size * 0.3);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(-size * 0.4, size * 0.12, size * 0.8, size * 0.06);
  ctx.restore();
}

function drawPlayer(ctx, xFrac, w, h, images, player, isRunning) {
  const x = px(xFrac, w);
  const y = h * GROUND_Y_FRAC;
  const size = h * PLAYER_HEIGHT_FRAC;

  // Run-cycle overrides the idle sprite while moving (see entities/player.js
  // getRunCycleSpriteKey) -- swing/hit still win. Also requires isRunning so
  // a stale isMoving flag can't leave him "running in place" during
  // countdown/gameover (updatePlayer only runs during gs.current==='running').
  // swing/hit are themselves short multi-frame sequences, keyed to elapsed
  // state time (see getSwingCycleSpriteKey/getHitCycleSpriteKey).
  let spriteKey = 'mike_idle';
  if (player.state === 'swing') {
    spriteKey = getSwingCycleSpriteKey(player);
  } else if (player.state === 'hit') {
    spriteKey = getHitCycleSpriteKey(player);
  } else if (player.state === 'idle' && player.isMoving && isRunning) {
    spriteKey = getRunCycleSpriteKey(player);
  }
  const img = images[spriteKey];

  ctx.save();
  if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }
  if (player.oozeBuffTimer > 0) {
    ctx.shadowColor = 'rgba(140, 224, 90, 0.9)';
    ctx.shadowBlur = size * 0.25;
  }

  if (img) {
    const drawH = size;
    const drawW = size * (img.width / img.height);
    const isStandingIdle = player.state === 'idle' && !player.isMoving;
    const breathScale = isStandingIdle ? getIdleBreathScale() : 1;
    ctx.translate(x, y);
    ctx.scale(player.facing, breathScale);
    ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  } else {
    drawPlayerFallback(ctx, x, y, size, player);
  }
  ctx.restore();
}

function drawItemFallback(ctx, x, y, size, type) {
  ctx.save();
  ctx.translate(x, y);
  if (type.id === 'pizza') {
    ctx.fillStyle = '#e8b25c';
    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.arc(0, size * 0.05, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (type.id === 'ooze') {
    ctx.fillStyle = '#7ee060';
    ctx.shadowColor = '#7ee060';
    ctx.shadowBlur = size * 0.4;
    ctx.beginPath();
    ctx.roundRect(-size * 0.25, -size * 0.5, size * 0.5, size, size * 0.12);
    ctx.fill();
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(0, size * 0.1, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.arc(0, size * 0.1, size * 0.42, 0.3, 1.2);
    ctx.stroke();
    ctx.strokeStyle = '#ffaa33';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.32);
    ctx.lineTo(size * 0.15, -size * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItems(ctx, items, w, h, images) {
  const size = h * ITEM_SIZE_FRAC;
  for (const item of items) {
    if (item.resolved) continue;
    const x = px(item.xFrac, w);
    const y = px(item.yFrac, h);
    const img = images[item.type.sprite];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(item.rotationRad || 0);
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      drawItemFallback(ctx, 0, 0, size, item.type);
    }
    ctx.restore();
  }
}

// Particle shapes read as their source material at a glance: triangular
// wedges for shattering pizza crust, soft round blobs for ooze droplets,
// angular diamonds for explosion debris (see spawnPizzaBreak/spawnOozeSplash/
// spawnBombExplosion in systems/juice.js).
function drawParticles(ctx, juice, w, h) {
  for (const p of juice.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const size = h * p.sizeFrac;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.glow) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = size * 1.5;
    }
    ctx.translate(px(p.xFrac, w), px(p.yFrac, h));
    ctx.rotate(p.rotationRad);

    ctx.beginPath();
    if (p.shape === 'shard') {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.75, size * 0.6);
      ctx.lineTo(-size * 0.75, size * 0.6);
      ctx.closePath();
    } else if (p.shape === 'spark') {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.4, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.4, 0);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

// Bomb-only expanding shockwave ring (see spawnBombExplosion) -- grows from
// the blast center and fades out over its lifetime, on top of the existing
// screen-shake for extra impact.
function drawRings(ctx, juice, w, h) {
  for (const r of juice.rings) {
    const t = Math.max(0, r.life / r.maxLife);
    const radius = h * r.maxRadiusFrac * (1 - t);
    ctx.save();
    ctx.globalAlpha = t * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = h * 0.012 * t + h * 0.002;
    ctx.beginPath();
    ctx.arc(px(r.xFrac, w), px(r.yFrac, h), radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function renderFrame(ctx, canvas, world) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const { images, stage, player, items, juice, isRunning } = world;

  ctx.clearRect(0, 0, w, h);

  const shake = getShakeOffsetFrac(juice);
  ctx.save();
  ctx.translate(px(shake.x, w), px(shake.y, h));

  drawBackground(ctx, w, h, images, stage);
  drawItems(ctx, items, w, h, images);
  drawPlayer(ctx, player.xFrac, w, h, images, player, isRunning);
  drawRings(ctx, juice, w, h);
  drawParticles(ctx, juice, w, h);

  ctx.restore();
}
