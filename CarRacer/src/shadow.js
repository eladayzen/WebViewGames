import * as THREE from 'three';

// One shared radial-gradient texture -- every blob shadow in the game is a
// flat disc using this same material, just scaled. Cheap grounding cue
// without a real-time shadow map.
let shadowTexture = null;
function getShadowTexture() {
  if (!shadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(canvas);
  }
  return shadowTexture;
}

export function createBlobShadow(diameter) {
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTexture(),
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(diameter, diameter), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
