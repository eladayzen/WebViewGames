// Canvas 2D renderer. Everything is fraction-based (Layout convention, per
// game-assets-enhancement Phase 4 / build doc §9) so the scene resizes
// cleanly regardless of the actual device viewport. Falls back to flat
// vector-drawn placeholders for any sprite that hasn't been generated yet
// (or fails to load) so the game is fully playable/testable before real art
// exists, and upgrades silently the moment art lands at the same path.

import { ITEM_SIZE_FRAC, PLAYER_HEIGHT_FRAC } from '../data/constants.js';
import { getShakeOffsetFrac } from '../systems/juice.js';
import { getRunCycleSpriteKey, getSwingCycleSpriteKey, getHitCycleSpriteKey, getBlockCycleSpriteKey } from '../entities/player.js';
import { BOX_COLOR_BY_ID } from '../data/boxColors.js';

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

  // window.innerWidth/innerHeight, not canvas.clientWidth/clientHeight --
  // matches the proven pattern from TmntSewerSlide/Astro_Tunnel's
  // fitStageToAspect(). Inside the actual GoBalance/Unity WebView
  // (gree/unity-webview), Unity resizes the native WebView container after
  // the page has already started running, and does NOT reliably fire a DOM
  // `resize` event when it does -- so a canvas.clientWidth read can capture
  // a stale/small pre-resize layout and never update, while renderFrame's
  // independent per-frame clientWidth/clientHeight read (see below) DOES
  // eventually reflect the real size. That mismatch between a stale drawing
  // buffer and fresh draw-position math is exactly what caused the "only
  // the upper corner renders" bug (2026-07-26) -- everything was being
  // positioned for the full real canvas size but physically clipped to
  // whatever tiny buffer got locked in at startup. window.innerWidth/
  // innerHeight has no such layout dependency and is what the two confirmed
  // -working games above already rely on.
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
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
  const groundY = h * stage.groundYFrac;
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, groundY);

  ctx.fillStyle = '#3a2f2a';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, groundY, w, h * 0.015);
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

function drawPlayer(ctx, xFrac, w, h, images, player, isRunning, stage) {
  const x = px(xFrac, w);
  const y = h * stage.groundYFrac;
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
  } else if (player.state === 'block') {
    spriteKey = getBlockCycleSpriteKey(player);
  } else if (player.state === 'idle' && player.isMoving && isRunning) {
    spriteKey = getRunCycleSpriteKey(player);
  }
  const img = images[spriteKey];

  ctx.save();
  if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }
  if (player.oozeBuffTimer > 0) {
    ctx.shadowColor = 'rgba(31, 200, 216, 0.9)'; // cyan (ooze recolored off green)
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

  // Shield bubble aura (special abilities, 2026-07-30) -- a translucent
  // green sphere + rim around the player while shielded, so the defensive
  // state reads at a glance beyond the HUD chip.
  if (player.shieldBuffTimer > 0) {
    const cx = x;
    const cy = y - size * 0.5;
    const r = size * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#4CE05A';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#8CFF98';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Magnet aura (special abilities, 2026-07-30) -- a pink magnetic field
  // around the player while the magnet buff is active: a faint constant glow
  // plus rings that CONTRACT inward and fade, reading as "pulling things in."
  // Distinct from the shield's solid green bubble. Cheap -- no shadowBlur.
  if (player.magnetBuffTimer > 0) {
    const cx = x;
    const cy = y - size * 0.5;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.fillStyle = '#F84FA0';
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FF7AC4';
    ctx.lineWidth = size * 0.025;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.5 + i / 3) % 1; // 0 (outer) -> 1 (inner); slower cycle
      const rr = size * (0.6 - 0.42 * phase);
      ctx.globalAlpha = 0.35 * Math.sin(phase * Math.PI); // fade in/out at the ends
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawItemFallback(ctx, x, y, size, type) {
  ctx.save();
  ctx.translate(x, y);
  if (type.id === 'pizza') {
    // All pizza (plain + box variants) uses the same gold slice here -- the
    // box color is conveyed by the outer glow in drawItems, not the slice.
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
  } else if (type.kind === 'power-up') {
    // Generic power-up fallback (ooze/shield/wave/magnet) -- a glowing
    // circle in the pickup's own color. Real icon art normally covers this.
    const hex = type.hex || '#1FC8D8';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
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

// hex "#rrggbb" -> "rgba(r,g,b,a)" for gradient stops.
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Cached solid-color silhouette of a sprite (the sprite's alpha shape filled
// with `hex`), used to draw a colored contour that hugs the sprite's actual
// outline. Built once per color via an offscreen canvas + 'source-in'
// composite. All box-variant pizzas share one sprite, so keying by color is
// enough (3 entries).
const _silhouetteCache = new Map();
function getTintedSilhouette(img, hex) {
  if (!img) return null;
  let c = _silhouetteCache.get(hex);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = hex;
    cx.fillRect(0, 0, c.width, c.height);
    _silhouetteCache.set(hex, c);
  }
  return c;
}

function drawItems(ctx, items, w, h, images) {
  const size = h * ITEM_SIZE_FRAC;
  const now = performance.now();
  for (const item of items) {
    if (item.resolved) continue;
    const x = px(item.xFrac, w);
    const y = px(item.yFrac, h);
    const bc = item.type.boxColor;
    const isVariant = bc && bc !== 'regular';
    const hex = isVariant ? BOX_COLOR_BY_ID[bc].hex : null;
    const pulse = isVariant ? 0.5 + 0.5 * Math.sin(now / 300 + (item.id || 0) * 1.7) : 0;
    const img = images[item.type.sprite];

    // Box-variant highlight (every box EXCEPT 'regular'): a SOFT pulsing glow
    // (radial gradient, no hard ring) plus a colored CONTOUR that hugs the
    // slice's actual silhouette (feedback 2026-07-30). No ctx.shadowBlur.
    if (isVariant) {
      const gr = size * (0.72 + 0.16 * pulse);
      const grad = ctx.createRadialGradient(x, y, size * 0.15, x, y, gr);
      grad.addColorStop(0, hexToRgba(hex, 0.34 + 0.22 * pulse));
      grad.addColorStop(0.6, hexToRgba(hex, 0.13 + 0.09 * pulse));
      grad.addColorStop(1, hexToRgba(hex, 0));
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, gr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(item.rotationRad || 0);
    if (img) {
      // Contour outline: the tinted silhouette drawn offset in a ring behind
      // the real slice, so a colored rim traces the pizza's shape. Rim
      // thickness breathes with the same pulse.
      if (isVariant) {
        const sil = getTintedSilhouette(img, hex);
        if (sil) {
          const o = size * (0.045 + 0.02 * pulse);
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            ctx.drawImage(sil, -size / 2 + Math.cos(ang) * o, -size / 2 + Math.sin(ang) * o, size, size);
          }
        }
      }
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

export function renderFrame(ctx, world) {
  // Same source as setupCanvas's resize() above -- window.innerWidth/
  // innerHeight, not canvas.clientWidth/clientHeight -- so the buffer size
  // and the draw-position math can never drift apart from each other.
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { images, stage, player, items, juice, isRunning } = world;

  ctx.clearRect(0, 0, w, h);

  const shake = getShakeOffsetFrac(juice);
  ctx.save();
  ctx.translate(px(shake.x, w), px(shake.y, h));

  drawBackground(ctx, w, h, images, stage);
  drawItems(ctx, items, w, h, images);
  drawPlayer(ctx, player.xFrac, w, h, images, player, isRunning, stage);
  drawRings(ctx, juice, w, h);
  drawParticles(ctx, juice, w, h);

  ctx.restore();
}
