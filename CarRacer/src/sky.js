import * as THREE from 'three';

// Neon-void backdrop: a near-black gradient, not flat black -- keeps a hint
// of depth. Clouds/static streak decals are gone; motion energy now comes
// from the neon pillar geometry and the VFX streaks (vfx.js), not the sky.
export function createSkyBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#05060c');
  grad.addColorStop(0.6, '#0a0e1e');
  grad.addColorStop(1, '#12162a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
