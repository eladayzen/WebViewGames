import * as THREE from 'three';

// Neon-void backdrop: a gradient, not flat black -- keeps a hint of depth.
// Colors are driven live by the current zone blend (zones.js) rather than
// fixed, so the sky shifts along with the pylons/fog as distance
// progresses. Clouds/static streak decals are gone; motion energy comes
// from the neon pillar geometry and the VFX streaks (vfx.js), not the sky.
const topColor = new THREE.Color();
const midColor = new THREE.Color();
const bottomColor = new THREE.Color();
const tmp = new THREE.Color();

export function createSkyBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  function update(zoneA, zoneB, blend) {
    topColor.set(zoneA.skyTop).lerp(tmp.set(zoneB.skyTop), blend);
    midColor.set(zoneA.skyMid).lerp(tmp.set(zoneB.skyMid), blend);
    bottomColor.set(zoneA.skyBottom).lerp(tmp.set(zoneB.skyBottom), blend);

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, `#${topColor.getHexString()}`);
    grad.addColorStop(0.6, `#${midColor.getHexString()}`);
    grad.addColorStop(1, `#${bottomColor.getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
  }

  const zone0 = { skyTop: '#05060c', skyMid: '#0a0e1e', skyBottom: '#12162a' };
  update(zone0, zone0, 0); // paint the initial gradient immediately, no blank frame

  return { texture, update };
}
