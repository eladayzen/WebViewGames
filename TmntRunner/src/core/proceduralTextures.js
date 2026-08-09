import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';

// Procedurally-drawn textures (canvas-based DynamicTexture) -- the only way
// to get surface detail beyond flat colour without an external art asset or
// image-generation tool, which this project doesn't have access to.
let counter = 0;

// A turtle-shell plate pattern: offset rows of hexagonal plates, like the
// reference image's shell. Applied to the player's shell mesh.
export function createShellTexture(scene) {
  counter += 1;
  const size = 256;
  const texture = new DynamicTexture(`shellTex_${counter}`, { width: size, height: size }, scene, true);
  const ctx = texture.getContext();

  ctx.fillStyle = '#5c3d10';
  ctx.fillRect(0, 0, size, size);

  const rows = 5;
  const cols = 4;
  const cellW = size / cols;
  const cellH = size / rows;
  ctx.strokeStyle = '#33200a';
  ctx.lineWidth = 5;
  ctx.fillStyle = '#8a6420';

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : cellW / 2;
    for (let c = -1; c <= cols; c++) {
      const cx = c * cellW + offset + cellW / 2;
      const cy = r * cellH + cellH / 2;
      drawHexPlate(ctx, cx, cy, cellW * 0.44, cellH * 0.46);
    }
  }

  texture.update(false);
  return texture;
}

function drawHexPlate(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// A lit/unlit window-grid facade texture for roadside buildings, matching
// the reference image's lit-window city backdrop. Each call bakes a fresh
// random lit pattern, so the handful of building colour variants each get a
// distinct facade rather than one texture repeated everywhere.
export function createWindowGridTexture(scene, { base, litColor = '#ffe27a', cols = 4, rows = 7 } = {}) {
  counter += 1;
  const size = 256;
  const texture = new DynamicTexture(`windowTex_${counter}`, { width: size, height: size }, scene, true);
  const ctx = texture.getContext();

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const cellW = size / cols;
  const cellH = size / rows;
  const pad = 0.2;
  ctx.fillStyle = litColor;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.5) continue; // unlit window: just the facade colour shows through
      ctx.fillRect(
        c * cellW + cellW * pad,
        r * cellH + cellH * pad,
        cellW * (1 - 2 * pad),
        cellH * (1 - 2 * pad)
      );
    }
  }

  texture.update(false);
  return texture;
}
