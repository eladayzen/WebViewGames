import * as THREE from 'three';

// Sci-fi hover-racer sky: bright cyan gradient, a few low clouds near the
// horizon, and diagonal white speed-streaks for energy.

export function createSkyBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#3fd6e8');
  grad.addColorStop(0.55, '#8fe8ee');
  grad.addColorStop(1, '#eafcf4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const puffs = [[36, 34, 22], [58, 26, 20], [80, 34, 20], [50, 40, 18], [68, 40, 16]];
  for (const [x, y, r] of puffs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createClouds(scene) {
  const texture = createCloudTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false,
  });
  const geo = new THREE.PlaneGeometry(32, 14);
  const positions = [
    [-34, 12, -110], [26, 10, -125], [-14, 8, -80], [40, 11, -95], [10, 9, -140],
  ];
  for (const [x, y, z] of positions) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  }
}

function createStreakTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

export function createSpeedStreaks(scene) {
  const texture = createStreakTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false,
  });
  const layout = [
    [-20, 40, -130, 22, -0.5], [30, 46, -150, 18, -0.65], [-40, 34, -100, 26, -0.4],
    [12, 52, -160, 20, -0.55], [-4, 60, -140, 16, -0.7],
  ];
  for (const [x, y, z, len, rot] of layout) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.6), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rot;
    scene.add(mesh);
  }
}
